// @vitest-environment jsdom
// Owner decision D1: a round left after its deciding answer (the tenth Classic card answered, the Streak run
// ended, the third life lost, the Timed minute run out) but before its result was opened is recorded exactly
// as opening the result would record it: card history, record and score. A round left before its deciding
// answer still records nothing but its answers.
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NEXT_ARRIVES_MS, PlayScreen } from "@/components/play/PlayScreen";
import { RESULT_ARRIVES_MS } from "@/components/play/ResultView";
import { PROGRESS_KEY } from "@/src/progress/local";
import { parseProgress, type Progress } from "@/src/progress/progress";
import { DECK_ID, cardByStatement, harness, memoryStorage, pendingFor, type Harness } from "../components/play/fixtures";

const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});
beforeEach(() => {
  router.replace.mockReset();
});
afterEach(cleanup);

const ROUTE = { deckId: DECK_ID, sectionId: "SEC" };
let h: Harness;

async function start(setup: Harness) {
  h = setup;
  const view = render(<PlayScreen services={h.services} />);
  await screen.findByRole("button", { name: "True" });
  await act(async () => {});
  h.advance(1000); // past the settle time of the first card
  return view;
}

function stored(): Progress {
  return parseProgress(h.local.getItem(PROGRESS_KEY));
}

/** Clicks the right (or the wrong) answer for the card on screen. */
function give(right: boolean) {
  const statement = document.querySelector("[data-statement] p:last-of-type")?.textContent;
  const answer = cardByStatement(statement).answer;
  fireEvent.click(screen.getByRole("button", { name: (right ? answer : !answer) ? "True" : "False" }));
}

/** Lets Next card arrive, presses it and waits for the next card to settle. */
async function next() {
  const action = await screen.findByRole("button", { name: "Next card" });
  h.advance(NEXT_ARRIVES_MS);
  fireEvent.click(action);
  await screen.findByRole("button", { name: "True" });
  await act(async () => {});
  h.advance(1000);
}

/** Plays the given answers (true is right), pressing Next card between them but not after the last. */
async function play(rights: readonly boolean[]) {
  for (const [i, right] of rights.entries()) {
    give(right);
    if (i < rights.length - 1) await next();
  }
}

function leaveThroughTheSheet(): HTMLElement {
  fireEvent.click(screen.getByRole("button", { name: "Leave round" }));
  const dialog = screen.getByRole("dialog", { name: "Leave round?" });
  fireEvent.click(within(dialog).getByRole("button", { name: "Leave round" }));
  expect(router.replace).toHaveBeenCalledWith("/");
  return dialog;
}

/** What opening the result records for the same answers: the same round, played to its result. */
async function recordedByTheResult(rights: readonly boolean[], mode: "classic" | "streak" | "lives"): Promise<Progress> {
  cleanup();
  await start(harness(pendingFor(mode)));
  await play(rights);
  const action = await screen.findByRole("button", { name: "See results" });
  h.advance(NEXT_ARRIVES_MS);
  fireEvent.click(action);
  await screen.findByRole("heading", { name: "Round complete" });
  h.advance(RESULT_ARRIVES_MS);
  return stored();
}

const CLASSIC = [true, false, true, true, false, true, true, true, false, true];

describe("leaving after the deciding answer (D1)", () => {
  it("Classic: leaving after the tenth answer records the round as its result would", async () => {
    await start(harness(pendingFor("classic")));
    await play(CLASSIC);
    expect(screen.getByRole("button", { name: "See results" })).toBeTruthy();
    leaveThroughTheSheet();
    const left = stored();
    expect(left.records).toEqual({ "test-deck/SEC#classic": 7 });
    expect(left.last).toEqual({ route: ROUTE, mode: "classic", score: 7, total: 10 });
    expect(Object.values(left.cards).map((entry) => entry.seen)).toEqual(Array(10).fill(1));

    expect(await recordedByTheResult(CLASSIC, "classic")).toEqual(left);
  });

  it("Classic: leaving after the ninth answer still sets no record", async () => {
    await start(harness(pendingFor("classic")));
    await play(CLASSIC.slice(0, 9));
    expect(screen.getByRole("button", { name: "Next card" })).toBeTruthy();
    leaveThroughTheSheet();
    const left = stored();
    expect(left.records).toEqual({});
    expect(left.last).toEqual({ route: ROUTE, mode: "classic", score: null, total: null });
    expect(Object.keys(left.cards)).toHaveLength(9);
  });

  it("the sheet on a decided round says the score is kept, and before it that no record is set", async () => {
    await start(harness(pendingFor("streak")));
    give(true);
    fireEvent.click(screen.getByRole("button", { name: "Leave round" }));
    const describedBy = () => {
      const dialog = screen.getByRole("dialog", { name: "Leave round?" });
      return document.getElementById(dialog.getAttribute("aria-describedby") ?? "")?.textContent;
    };
    expect(describedBy()).toBe("Your answers so far stay in your history. This round won't set a record.");
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Keep playing" }));
    await next();
    give(false);
    fireEvent.click(screen.getByRole("button", { name: "Leave round" }));
    expect(describedBy()).toBe("This round is over and its score is kept. Leaving skips its result.");
  });

  it("Three lives: the page going away after the third life is lost records the round, once", async () => {
    const rights = [false, true, false, true, false];
    const view = await start(harness(pendingFor("lives")));
    await play(rights);
    expect(screen.getByRole("button", { name: "See results" })).toBeTruthy();
    fireEvent(window, new PageTransitionEvent("pagehide", { persisted: false }));
    const left = stored();
    expect(left.records).toEqual({ "test-deck/SEC#lives": 5 });
    expect(left.last).toEqual({ route: ROUTE, mode: "lives", score: 5, total: 5 });
    view.unmount();
    expect(stored()).toEqual(left);

    expect(await recordedByTheResult(rights, "lives")).toEqual(left);
  });

  it("Streak: the back gesture after the run ended records it as its result would", async () => {
    const rights = [true, true, true, false];
    const view = await start(harness(pendingFor("streak")));
    await play(rights);
    view.unmount();
    const left = stored();
    expect(left.records).toEqual({ "test-deck/SEC#streak": 3 });
    expect(left.last).toEqual({ route: ROUTE, mode: "streak", score: 3, total: 4 });

    expect(await recordedByTheResult(rights, "streak")).toEqual(left);
  });

  it("does not lower a better record, as the result would not", async () => {
    const best = { version: 1, cards: {}, records: { "test-deck/SEC#streak": 5 }, last: null };
    await start(harness(pendingFor("streak"), memoryStorage({ [PROGRESS_KEY]: JSON.stringify(best) })));
    await play([true, false]);
    leaveThroughTheSheet();
    const left = stored();
    expect(left.records).toEqual({ "test-deck/SEC#streak": 5 });
    expect(left.last).toEqual({ route: ROUTE, mode: "streak", score: 1, total: 2 });
  });
});
