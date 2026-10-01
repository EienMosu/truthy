// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NEXT_ARRIVES_MS, PlayScreen } from "@/components/play/PlayScreen";
import { PROGRESS_KEY } from "@/src/progress/local";
import { emptyProgress, parseProgress } from "@/src/progress/progress";
import { DECK_ID, cardByStatement, harness, memoryStorage, pendingFor, type Harness } from "./fixtures";

const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});
beforeEach(() => {
  router.replace.mockReset();
  router.push.mockReset();
});
afterEach(cleanup);

let h: Harness;

async function start(setup: Harness) {
  h = setup;
  const view = render(<PlayScreen services={h.services} />);
  await screen.findByRole("button", { name: "True" });
  // findByRole can resolve before React has run the effects of that render (the key listener and the
  // card's settle time start there): flush them before anything fires.
  await act(async () => {});
  h.advance(1000); // past the 250 ms settle time of the first card
  return view;
}

function statementText(): string | null | undefined {
  return document.querySelector("[data-statement] p:last-of-type")?.textContent;
}

function currentAnswer(): boolean {
  return cardByStatement(statementText()).answer;
}

function status(): string | null {
  return screen.getAllByRole("status").at(-1)?.textContent ?? null;
}

/** Clicks the button that is right (or wrong) for the card on screen. */
function give(right: boolean) {
  const answer = currentAnswer();
  fireEvent.click(screen.getByRole("button", { name: (right ? answer : !answer) ? "True" : "False" }));
}

/** The label of the action button that has replaced True and False. */
function actionLabel(): string {
  return (screen.getByRole("button", { name: /^(Next card|See results)$/ }).textContent ?? "").replace(/\s*→$/, "").trim();
}

/** Lets the action button arrive (420 ms after the answer), presses it and waits for the next card. */
async function go() {
  const action = await screen.findByRole("button", { name: /^(Next card|See results)$/ });
  h.advance(NEXT_ARRIVES_MS);
  fireEvent.click(action);
  await screen.findByRole("button", { name: "True" });
  await act(async () => {});
  h.advance(1000);
}

function fields(): string[] {
  return screen.getAllByRole("definition").map((value) => value.textContent?.slice(0, 7) ?? "");
}

function stored() {
  return parseProgress(h.local.getItem(PROGRESS_KEY));
}

const LEFT_ROUND = { route: { deckId: DECK_ID, sectionId: "SEC" }, mode: "streak", score: null, total: null };

/** Streak: right, right, wrong. The round is decided and its action reads "See results". */
async function decidedStreak() {
  const view = await start(harness(pendingFor("streak")));
  give(true);
  await go();
  give(true);
  await go();
  give(false);
  return view;
}

describe("PlayScreen ending: Streak", () => {
  it("reads Next card after a right answer and deals on past the first ten cards", async () => {
    await start(harness(pendingFor("streak")));
    for (let i = 0; i < 11; i += 1) {
      give(true);
      expect(actionLabel()).toBe("Next card");
      await go();
    }
    expect(fields()[1]).toBe("12");
  });

  it("reads See results after the first wrong answer, and nothing else", async () => {
    await start(harness(pendingFor("streak")));
    give(false);
    expect(screen.getByRole("button", { name: "See results" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Next card" })).toBeNull();
    // The answer row leaves with its exit animation, so it may take a moment to go.
    await waitFor(() => expect(screen.queryByRole("button", { name: "True" })).toBeNull());
    expect(screen.queryByRole("button", { name: "False" })).toBeNull();
  });

  it("a second tap within 420 ms of the deciding answer does not open the result", async () => {
    await start(harness(pendingFor("streak")));
    give(false);
    const verdict = status();
    expect(verdict).toMatch(/^Not quite\. The answer is (True|False)\.$/);
    h.advance(150);
    fireEvent.click(await screen.findByRole("button", { name: "See results" }));
    expect(screen.queryByRole("heading", { name: "Round complete" })).toBeNull();
    expect(status()).toBe(verdict);
    h.advance(270);
    fireEvent.click(screen.getByRole("button", { name: "See results" }));
    expect(await screen.findByRole("heading", { name: "Round complete" })).toBeTruthy();
  });

  it("Enter opens the result once See results has arrived", async () => {
    await start(harness(pendingFor("streak")));
    give(false);
    await screen.findByRole("button", { name: "See results" });
    h.advance(150);
    fireEvent.keyDown(document.body, { key: "Enter" });
    expect(screen.queryByRole("heading", { name: "Round complete" })).toBeNull();
    h.advance(270);
    fireEvent.keyDown(document.body, { key: "Enter" });
    expect(await screen.findByRole("heading", { name: "Round complete" })).toBeTruthy();
  });

  it("moves focus to See results at 420 ms", async () => {
    await start(harness(pendingFor("streak")));
    give(false);
    const action = await screen.findByRole("button", { name: "See results" });
    await waitFor(() => expect(document.activeElement).toBe(action), { timeout: 1500 });
  });

  it("shows the Card field without a total", async () => {
    await start(harness(pendingFor("streak")));
    expect(fields()).toEqual(["Streak", "01", "F ← → T"]);
  });
});

describe("PlayScreen ending: Three lives", () => {
  it("goes on with Next card after the first and the second wrong answer, and reads See results after the third", async () => {
    await start(harness(pendingFor("lives")));
    const labels: string[] = [];
    for (const right of [false, false, true, false]) {
      give(right);
      labels.push(actionLabel());
      if (labels.length < 4) await go();
    }
    expect(labels).toEqual(["Next card", "Next card", "Next card", "See results"]);
  });
});

describe("PlayScreen ending: Classic", () => {
  it("reads See results on the last card of a one card route", async () => {
    await start(harness(pendingFor("classic", "APP")));
    give(true);
    expect(screen.getByRole("button", { name: "See results" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Next card" })).toBeNull();
  });

  it("keeps the total in the Card field", async () => {
    await start(harness(pendingFor("classic")));
    expect(fields()).toEqual(["Classic", "01 / 10", "F ← → T"]);
  });
});

describe("PlayScreen ending: leaving", () => {
  it.each(["streak", "lives"] as const)("leaving mid-round asks and sets no record (%s)", async (mode) => {
    await start(harness(pendingFor(mode)));
    give(true);
    await go();
    fireEvent.click(screen.getByRole("button", { name: "Leave round" }));
    const dialog = screen.getByRole("dialog", { name: "Leave round?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Leave round" }));
    expect(router.replace).toHaveBeenCalledWith("/");
    const progress = stored();
    expect(progress.records).toEqual({});
    expect(Object.values(progress.cards)).toHaveLength(1);
    expect(Object.values(progress.cards)[0]?.seen).toBe(1);
    expect(progress.last?.score).toBeNull();
  });

  it("leaving a decided round asks too and sets no record", async () => {
    await decidedStreak();
    fireEvent.click(screen.getByRole("button", { name: "Leave round" }));
    const dialog = screen.getByRole("dialog", { name: "Leave round?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Leave round" }));
    expect(router.replace).toHaveBeenCalledWith("/");
    const progress = stored();
    expect(progress.records).toEqual({});
    expect(Object.values(progress.cards)).toHaveLength(3);
    for (const entry of Object.values(progress.cards)) expect(entry.seen).toBe(1);
    expect(progress.last).toEqual(LEFT_ROUND);
    expect(screen.queryByRole("heading", { name: "Round complete" })).toBeNull();
  });

  it("Keep playing on a decided round returns to See results, which then records the round", async () => {
    await decidedStreak();
    fireEvent.click(screen.getByRole("button", { name: "Leave round" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Keep playing" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(router.replace).not.toHaveBeenCalled();
    const action = screen.getByRole("button", { name: "See results" });
    h.advance(NEXT_ARRIVES_MS);
    fireEvent.click(action);
    expect(await screen.findByRole("heading", { name: "Round complete" })).toBeTruthy();
    expect(stored().records).toEqual({ "test-deck/SEC#streak": 2 });
  });

  it("unmounting on a decided round keeps the answers and sets no record", async () => {
    const view = await decidedStreak();
    view.unmount();
    const progress = stored();
    expect(progress.records).toEqual({});
    expect(Object.values(progress.cards)).toHaveLength(3);
    for (const entry of Object.values(progress.cards)) expect(entry.seen).toBe(1);
  });

  it("does not save a round twice when it is left and then unmounts", async () => {
    const view = await decidedStreak();
    fireEvent.click(screen.getByRole("button", { name: "Leave round" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Leave round" }));
    view.unmount();
    for (const entry of Object.values(stored().cards)) expect(entry.seen).toBe(1);
  });

  it("the result that See results opened is not undone by unmounting", async () => {
    const view = await start(harness(pendingFor("streak")));
    give(true);
    await go();
    give(false);
    const action = await screen.findByRole("button", { name: "See results" });
    h.advance(NEXT_ARRIVES_MS);
    fireEvent.click(action);
    await screen.findByRole("heading", { name: "Round complete" });
    view.unmount();
    const progress = stored();
    expect(progress.records).toEqual({ "test-deck/SEC#streak": 1 });
    expect(Object.values(progress.cards)).toHaveLength(2);
    for (const entry of Object.values(progress.cards)) expect(entry.seen).toBe(1);
  });
});

describe("PlayScreen ending: selecting text", () => {
  it("lets the player select the explanation: select-none only while the card can be dragged", async () => {
    await start(harness(pendingFor("classic")));
    const card = document.querySelector("[data-swipe-card]");
    if (!card) throw new Error("no swipe card");
    expect(card.classList.contains("select-none")).toBe(true);
    expect(card.classList.contains("select-text")).toBe(false);
    give(true);
    expect(card.classList.contains("select-text")).toBe(true);
    expect(card.classList.contains("select-none")).toBe(false);
  });
});

/** A Streak round on SEC with a stored record (null: none). */
function streakHarness(record: number | null) {
  const records = record === null ? {} : { [`${DECK_ID}/SEC#streak`]: record };
  return harness(pendingFor("streak"), memoryStorage({ [PROGRESS_KEY]: JSON.stringify({ ...emptyProgress(), records }) }));
}

/** The name of the header image, whatever it says. */
function headerName(): string {
  return screen.getByRole("img").getAttribute("aria-label") ?? "";
}

/** The verdict stamps on screen (the slip has one while a card is answered). */
function stamps(): (string | null)[] {
  return [...document.querySelectorAll("[data-verdict]")].map((stamp) => stamp.getAttribute("data-verdict"));
}

describe("PlayScreen: the Streak header", () => {
  it("shows the Streak header from the first card", async () => {
    await start(harness(pendingFor("streak")));
    expect(screen.getByRole("img", { name: "Streak of 0 correct answers." })).toBeTruthy();
    expect(screen.queryByRole("img", { name: /^Card 1 of/ })).toBeNull();
  });

  it("counts the streak and ends it", async () => {
    await start(harness(pendingFor("streak")));
    give(true);
    expect(headerName()).toBe("Streak of 1 correct answer.");
    await go();
    expect(headerName()).toBe("Streak of 1 correct answer.");
    give(true);
    expect(headerName()).toBe("Streak of 2 correct answers.");
    await go();
    give(false);
    expect(headerName()).toBe("Streak ended at 2.");
  });

  it("shows New best only on the answer that passes a stored best", async () => {
    await start(streakHarness(2));
    give(true);
    expect(stamps()).toEqual(["correct"]);
    await go();
    give(true);
    expect(stamps()).toEqual(["correct"]);
    expect(headerName()).toBe("Streak of 2 correct answers, equal to your best on this route.");
    await go();
    give(true);
    expect(stamps()).toEqual(["new-best"]);
    expect(status()).toMatch(/^Correct\. The answer is (True|False)\. New best\.$/);
    expect(headerName()).toBe("Streak of 3 correct answers. New best on this route, previous best 2.");
    await go();
    give(true);
    expect(stamps()).toEqual(["correct"]);
    expect(status()).toMatch(/^Correct\. The answer is (True|False)\.$/);
  });

  it("shows no New best on a first round, however long the streak", async () => {
    await start(streakHarness(null));
    for (let i = 0; i < 4; i += 1) {
      give(true);
      expect(stamps()).toEqual(["correct"]);
      await go();
    }
  });

  it("does not show New best when the streak only equals the best", async () => {
    await start(streakHarness(2));
    give(true);
    await go();
    give(true);
    expect(stamps()).toEqual(["correct"]);
    expect(headerName()).toBe("Streak of 2 correct answers, equal to your best on this route.");
  });

  it("shows no New best on the slip after a stored best of 0", async () => {
    await start(streakHarness(0));
    expect(headerName()).toBe("Streak of 0 correct answers.");
    give(true);
    expect(stamps()).toEqual(["correct"]);
    expect(status()).toMatch(/^Correct\. The answer is (True|False)\.$/);
    expect(headerName()).toBe("Streak of 1 correct answer.");
  });

  it("Play again reads the record the last round set", async () => {
    await start(streakHarness(null));
    give(true);
    await go();
    give(true);
    await go();
    give(false);
    const action = await screen.findByRole("button", { name: "See results" });
    h.advance(NEXT_ARRIVES_MS);
    fireEvent.click(action);
    await screen.findByRole("heading", { name: "Round complete" });
    fireEvent.click(screen.getByRole("button", { name: "Play again" }));
    await screen.findByRole("button", { name: "True" });
    expect(headerName()).toBe("Streak of 0 correct answers. Your best on this route is 2.");
  });
});

describe("PlayScreen: the Three lives header", () => {
  it("shows the Three lives header from the first card", async () => {
    await start(harness(pendingFor("lives")));
    expect(screen.getByRole("img", { name: "3 of 3 lives left. No cards answered yet." })).toBeTruthy();
    expect(screen.queryByRole("img", { name: /^Card 1 of/ })).toBeNull();
  });

  it("takes a life per wrong answer and ends on the third", async () => {
    await start(harness(pendingFor("lives")));
    give(false);
    expect(headerName()).toBe("2 of 3 lives left. 1 card answered, card 1 was wrong.");
    await go();
    give(true);
    expect(headerName()).toBe("2 of 3 lives left. 2 cards answered, card 1 was wrong.");
    await go();
    give(false);
    expect(headerName()).toBe("1 of 3 lives left. 3 cards answered, cards 1 and 3 were wrong.");
    await go();
    give(false);
    expect(headerName()).toBe("No lives left. The round is over after 4 cards: cards 1, 3 and 4 were wrong.");
    expect(screen.getByRole("button", { name: "See results" })).toBeTruthy();
  });
});
