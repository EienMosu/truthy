// @vitest-environment jsdom
// The gate between a class and the player, kept under test now that no real class is closed. The table is
// mocked with Timed closed and the other three open, whatever the real table says.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { StartFlow, canShow } from "@/components/start/StartFlow";
import { continueTarget } from "@/components/start/useCatalog";
import { emptyProgress } from "@/src/progress/progress";
import { SWIPE } from "@/src/input/swipe";
import { INDEX, harness, storedProgress, type Harness } from "./fixtures";

vi.mock("@/src/app-state/modes", async (original) => {
  const real = await original<typeof import("@/src/app-state/modes")>();
  const table = real.MODE_TABLE.map((mode) => ({ ...mode, offered: mode.id !== "timed" }));
  return { ...real, MODE_TABLE: table, isOffered: (mode: string) => table.find((row) => row.id === mode)?.offered ?? false };
});

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});
beforeEach(() => {
  router.push.mockReset();
  router.replace.mockReset();
});
afterEach(cleanup);

const LAST_TIMED = { route: { deckId: "aws-clf-c02", sectionId: "SEC" }, mode: "timed" as const, score: null, total: null };

let h: Harness;

async function start(setup: Harness) {
  h = setup;
  render(<StartFlow services={h.services} />);
  await screen.findByRole("button", { name: "Cloud, 2 decks" });
}

function heading(): string | null | undefined {
  return [...document.querySelectorAll("[data-step]:not([inert]) h2")].at(-1)?.textContent;
}

async function choose(name: string | RegExp, nextHeading: string) {
  h.clock.time += SWIPE.settleMs;
  fireEvent.click(screen.getByRole("button", { name }));
  await waitFor(() => expect(heading()).toBe(nextHeading));
}

describe("a class that is not offered", () => {
  it("is shown as not available, and it cannot be chosen", async () => {
    await start(harness());
    await choose("Cloud, 2 decks", "Choose a platform");
    await choose("AWS, 1 deck", "Choose a deck");
    await choose(/^CLF, Cloud Practitioner/, "Choose a section");
    await choose(/^SEC, Security and compliance/, "Choose how to play");
    const group = screen.getByRole("group", { name: "Timed, not available yet" });
    expect(group.getAttribute("aria-disabled")).toBe("true");
    expect(screen.queryByRole("button", { name: /^Timed/ })).toBeNull();
    fireEvent.click(group);
    expect(heading()).toBe("Choose how to play");
  });

  it("is not continued into", async () => {
    await start(harness(storedProgress({ last: LAST_TIMED })));
    expect(screen.queryByRole("button", { name: /^Continue/ })).toBeNull();
    expect(continueTarget(INDEX, { ...emptyProgress(), last: LAST_TIMED })).toBeNull();
  });

  it("does not show the ready step", () => {
    const choice = { areaId: "cloud", platformId: "aws", deckId: "aws-clf-c02", sectionId: "SEC" };
    expect(canShow(INDEX, 6, { ...choice, mode: "timed" })).toBe(false);
    expect(canShow(INDEX, 6, { ...choice, mode: "streak" })).toBe(true);
  });
});
