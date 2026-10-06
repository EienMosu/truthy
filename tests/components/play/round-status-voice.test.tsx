// @vitest-environment jsdom
// Review finding U50: in Three lives and Streak the header says a lost life and the end of the round, but the
// header is an image whose label is not live, so a screen reader heard only "Not quite. The answer is X." The
// play screen's polite status now says it after the verdict, at the moment it happens, in the same region.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { NEXT_ARRIVES_MS, PlayScreen } from "@/components/play/PlayScreen";
import { cardByStatement, harness, pendingFor, type Harness } from "./fixtures";
import type { Mode } from "@/src/content/play";

const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});
afterEach(cleanup);

let h: Harness;

async function start(mode: Mode) {
  h = harness(pendingFor(mode));
  render(<PlayScreen services={h.services} />);
  await screen.findByRole("button", { name: "True" });
  await act(async () => {});
  h.advance(1000);
}

function statusRegion(): HTMLElement {
  const regions = screen.getAllByRole("status");
  expect(regions).toHaveLength(1);
  return regions[0] as HTMLElement;
}

/** Answers the card on screen right or wrong and returns the verdict the status starts with. */
function give(right: boolean): string {
  const answer = cardByStatement(document.querySelector("[data-statement] p:last-of-type")?.textContent).answer;
  const given = right ? answer : !answer;
  fireEvent.click(screen.getByRole("button", { name: given ? "True" : "False" }));
  return `${right ? "Correct" : "Not quite"}. The answer is ${answer ? "True" : "False"}.`;
}

async function next() {
  const action = await screen.findByRole("button", { name: "Next card" });
  h.advance(NEXT_ARRIVES_MS);
  fireEvent.click(action);
  await screen.findByRole("button", { name: "True" });
  await act(async () => {});
  h.advance(1000);
}

describe("the play screen's status says what a wrong answer did to the round", () => {
  it("Three lives: a lost life, the last life and the end, in the one status region, without taking focus", async () => {
    await start("lives");
    const region = statusRegion();

    let verdict = give(false);
    expect(region.textContent).toBe(`${verdict} Life lost, 2 left.`);
    expect(document.activeElement).not.toBe(region);
    await next();

    verdict = give(true);
    expect(region.textContent).toBe(verdict);
    await next();

    verdict = give(false);
    expect(region.textContent).toBe(`${verdict} Last life.`);
    await next();

    verdict = give(false);
    expect(statusRegion()).toBe(region);
    expect(region.textContent).toBe(`${verdict} Out of lives.`);
    expect(document.activeElement).not.toBe(region);
    expect(await screen.findByRole("button", { name: "See results" })).toBeTruthy();
  });

  it("Streak: the end with the streak it reached", async () => {
    await start("streak");
    const region = statusRegion();
    let verdict = give(true);
    expect(region.textContent).toBe(verdict);
    await next();
    verdict = give(true);
    expect(region.textContent).toBe(verdict);
    await next();
    verdict = give(false);
    expect(region.textContent).toBe(`${verdict} Streak ended at 2.`);
  });

  it("Streak: a first wrong answer ends at 0", async () => {
    await start("streak");
    const verdict = give(false);
    expect(statusRegion().textContent).toBe(`${verdict} Streak ended at 0.`);
  });

  it("Classic adds nothing to the verdict", async () => {
    await start("classic");
    const verdict = give(false);
    expect(statusRegion().textContent).toBe(verdict);
  });
});
