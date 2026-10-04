// @vitest-environment jsdom
// Review finding U27: a reload in the middle of the start flow starts at step 1, and it also takes the
// entries of the steps before the reload out of the history, so back from step 1 leaves the site instead of
// bringing an old pass back.
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { StartFlow, entriesBehind, type Entry } from "@/components/start/StartFlow";
import { SWIPE } from "@/src/input/swipe";
import { INDEX, harness, type Harness } from "./fixtures";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});
afterEach(cleanup);

const CLOUD = { areaId: "cloud" };
const AWS = { ...CLOUD, platformId: "aws" };
const CLF = { ...AWS, deckId: "aws-clf-c02" };
const GCP = { ...CLOUD, platformId: "gcp" };
const CDL = { ...GCP, deckId: "gcp-cdl", sectionId: "ALL" };

/** A history holding the flow's entries up to the last one, which is current: the page about to be reloaded. */
function reloadedOn(entries: Entry[]): Harness {
  const h = harness();
  h.history.replace({ truthyStart: entries[0] });
  for (const entry of entries.slice(1)) h.history.push({ truthyStart: entry });
  return h;
}

function heading(): string | null | undefined {
  return [...document.querySelectorAll("[data-step]:not([inert]) h2")].at(-1)?.textContent;
}

async function open(h: Harness) {
  render(<StartFlow services={h.services} />);
  await screen.findByRole("button", { name: "Cloud, 2 decks" });
  await act(async () => {});
}

describe("entriesBehind", () => {
  it("counts one entry per step on the path, with the section step only where the deck has sections", () => {
    expect(entriesBehind(INDEX, { step: 1, choice: {} })).toBe(0);
    expect(entriesBehind(INDEX, { step: 4, choice: CLF })).toBe(3);
    expect(entriesBehind(INDEX, { step: 6, choice: { ...CLF, sectionId: "ALL", mode: "classic" } })).toBe(5);
    expect(entriesBehind(INDEX, { step: 5, choice: CDL })).toBe(3);
  });

  it("never counts more than a deck the index no longer has could have", () => {
    const gone = { areaId: "cloud", platformId: "aws", deckId: "aws-gone" };
    expect(entriesBehind(INDEX, { step: 5, choice: { ...gone, sectionId: "ALL" } })).toBe(3);
    expect(entriesBehind(INDEX, { step: 5, choice: { ...gone, sectionId: "SEC" } })).toBe(4);
  });
});

describe("StartFlow after a reload in the middle of the flow", () => {
  it("moves back to the flow's first entry, so one more back leaves the site", async () => {
    const h = reloadedOn([
      { step: 1, choice: {} },
      { step: 2, choice: CLOUD },
      { step: 3, choice: AWS },
      { step: 4, choice: CLF },
    ]);
    await open(h);
    await waitFor(() => expect(h.history.position).toBe(0));
    expect(h.history.state).toEqual({ truthyStart: { step: 1, choice: {} } });
    expect(heading()).toBe("Choose an area");
    expect(document.querySelector("[data-fill-in-pass]")).toBeNull();
  });

  it("does the same for a deck without sections, whose path has no section step", async () => {
    const h = reloadedOn([
      { step: 1, choice: {} },
      { step: 2, choice: CLOUD },
      { step: 3, choice: GCP },
      { step: 5, choice: CDL },
    ]);
    await open(h);
    await waitFor(() => expect(h.history.position).toBe(0));
    expect(heading()).toBe("Choose an area");
  });

  it("leaves the history alone after a reload on step 1", async () => {
    const h = harness();
    h.history.push({ truthyStart: { step: 1, choice: {} } });
    await open(h);
    expect(h.history.position).toBe(1);
    expect(h.history.entries).toHaveLength(2);
  });

  it("builds the steps again from the first entry, dropping the old ones ahead", async () => {
    const h = reloadedOn([
      { step: 1, choice: {} },
      { step: 2, choice: CLOUD },
      { step: 3, choice: AWS },
    ]);
    await open(h);
    await waitFor(() => expect(h.history.position).toBe(0));
    h.clock.time += SWIPE.settleMs;
    fireEvent.click(screen.getByRole("button", { name: "Frontend, 1 deck" }));
    await waitFor(() => expect(heading()).toBe("Choose a platform"));
    expect(h.history.entries).toEqual([{ truthyStart: { step: 1, choice: {} } }, { truthyStart: { step: 2, choice: { areaId: "frontend" } } }]);
  });

  it("takes no step forward until the browser has moved back", async () => {
    const h = reloadedOn([
      { step: 1, choice: {} },
      { step: 2, choice: CLOUD },
      { step: 3, choice: AWS },
    ]);
    // A browser slow to report the move: the popstate comes only when the test lets it.
    const go = h.history.go.bind(h.history);
    let report: (() => void) | undefined;
    h.history.go = (delta) => {
      report = () => go(delta);
    };
    await open(h);
    h.clock.time += SWIPE.settleMs;
    fireEvent.click(screen.getByRole("button", { name: "Frontend, 1 deck" }));
    await act(async () => {});
    expect(heading()).toBe("Choose an area");
    expect(h.history.entries).toHaveLength(3);
    await act(async () => report?.());
    fireEvent.click(screen.getByRole("button", { name: "Frontend, 1 deck" }));
    await waitFor(() => expect(heading()).toBe("Choose a platform"));
    expect(h.history.position).toBe(1);
  });
});
