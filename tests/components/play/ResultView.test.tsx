// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { StrictMode } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { pointAt } from "@/components/FlightPath";
import { RESULT_ARRIVES_MS, ResultView, recordRound } from "@/components/play/ResultView";
import type { TicketInfo } from "@/components/play/useRound";
import { poolFor } from "@/src/content/load";
import type { Mode } from "@/src/content/play";
import { TIMED, currentCard, reduce, startRound, type RoundState } from "@/src/engine/round";
import { PROGRESS_KEY, createLocalStore, type ProgressStore } from "@/src/progress/local";
import { emptyProgress, parseProgress, recordKey } from "@/src/progress/progress";
import { DECK, DECK_ID, memoryStorage, type MemoryStorage } from "./fixtures";

const motionPreference = vi.hoisted(() => ({ reduced: false }));
vi.mock("motion/react", async (original) => ({
  ...(await original<typeof import("motion/react")>()),
  useReducedMotion: () => motionPreference.reduced,
}));

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});
afterEach(() => {
  cleanup();
  motionPreference.reduced = false;
});

const ROUTE = { deckId: DECK_ID, sectionId: "SEC" };
const KEY = recordKey(ROUTE, "classic");
const LABELS: Record<Mode, string> = { classic: "Classic", streak: "Streak", lives: "Three lives", timed: "Timed" };
const TICKET: TicketInfo = ticketOf("classic");

function ticketOf(mode: Mode): TicketInfo {
  return {
    deckCode: "TST",
    deckName: "AWS Test deck",
    sectionCode: "SEC",
    sectionName: "Security and compliance",
    modeLabel: LABELS[mode],
    best: null,
  };
}

/**
 * A finished round of the mode on SEC: card i is answered right when right[i] is true. Classic, Streak and
 * Three lives answer one card after the other and press Next (so right must end the round, or run to the
 * tenth card in Classic). Timed ticks 700 ms after each answer, then runs the clock out and presses Next.
 */
function finishedRound(mode: Mode, right: readonly boolean[]): RoundState {
  let state = startRound({ mode, route: ROUTE, pool: poolFor(DECK, "SEC"), history: {}, seed: 7 });
  let now = 1_000_000;
  if (mode === "timed") state = reduce(state, { type: "tick", now });
  right.forEach((ok, i) => {
    const card = currentCard(state);
    if (!card) throw new Error("ran out of cards");
    if (mode === "timed") {
      now += 100;
      state = reduce(state, { type: "answer", value: ok ? card.answer : !card.answer, at: now });
      now += TIMED.holdMs;
      state = reduce(state, { type: "tick", now });
    } else {
      state = reduce(state, { type: "answer", value: ok ? card.answer : !card.answer, at: 1000 + i });
      state = reduce(state, { type: "next" });
    }
  });
  while (mode === "timed" && state.clock !== null && state.clock.remainingMs > 0) {
    now += TIMED.maxStepMs;
    state = reduce(state, { type: "tick", now });
  }
  if (mode === "timed") state = reduce(state, { type: "next" });
  if (state.phase !== "finished") throw new Error("the round did not finish");
  return state;
}

const SEVEN_OF_TEN = [true, true, false, true, true, false, true, true, false, true];

function storeWith(records: Record<string, number>): { storage: MemoryStorage; store: () => ProgressStore } {
  const storage = memoryStorage({ [PROGRESS_KEY]: JSON.stringify({ ...emptyProgress(), records }) });
  const store = createLocalStore(storage);
  return { storage, store: () => store };
}

// The clock the result's actions are timed on; each test starts it afresh.
let time = 5_000_000;
const now = () => time;
beforeEach(() => {
  time = 5_000_000;
});

function renderResult(round: RoundState, store: () => ProgressStore, handlers = { onPlayAgain: vi.fn(), onHome: vi.fn() }) {
  const view = render(<ResultView round={round} ticket={ticketOf(round.mode)} progressStore={store} now={now} {...handlers} />);
  return { ...view, ...handlers };
}

function comparison(): string | null | undefined {
  return document.querySelector("[data-comparison]")?.textContent;
}

describe("recordRound", () => {
  it("writes the round once, however often it is called, and returns the same outcome", () => {
    const round = finishedRound("classic", SEVEN_OF_TEN);
    const storage = memoryStorage();
    const setItem = vi.spyOn(storage, "setItem");
    const store = createLocalStore(storage);
    const first = recordRound(round, store);
    const second = recordRound(round, store);
    expect(second).toBe(first);
    expect(setItem).toHaveBeenCalledTimes(1);
    const saved = parseProgress(storage.getItem(PROGRESS_KEY));
    expect(saved.records[KEY]).toBe(7);
    expect(Object.values(saved.cards).map((entry) => entry.seen)).toEqual(Array.from({ length: 10 }, () => 1));
  });

  it("remembers the route, the mode and the score for the start screen's Continue", () => {
    const storage = memoryStorage();
    recordRound(finishedRound("classic", SEVEN_OF_TEN), createLocalStore(storage));
    expect(parseProgress(storage.getItem(PROGRESS_KEY)).last).toEqual({ route: ROUTE, mode: "classic", score: 7, total: 10 });
  });
});

describe("ResultView: the ticket", () => {
  it("shows the completed flight path with every card resolved", () => {
    const { container } = renderResult(finishedRound("classic", SEVEN_OF_TEN), storeWith({}).store);
    expect(screen.getByRole("img", { name: "Round complete. 10 of 10 cards. 7 correct, 3 wrong: cards 3, 6 and 9." })).toBeTruthy();
    expect(container.querySelectorAll('[data-waypoint="correct"]')).toHaveLength(7);
    expect(container.querySelectorAll('[data-waypoint="wrong"]')).toHaveLength(3);
    expect(container.querySelector("[data-plane]")).toBeNull();
  });

  it("fills the ticket head with the route, Class, Cards and Wrong", () => {
    const { container } = renderResult(finishedRound("classic", SEVEN_OF_TEN), storeWith({}).store);
    expect(container.querySelector('[data-leg="from"]')?.textContent).toBe("TSTAWS Test deck");
    expect(container.querySelector('[data-leg="to"]')?.textContent).toBe("SECSecurity and compliance");
    expect(screen.getAllByRole("term").map((term) => term.textContent).slice(0, 4)).toEqual(["Class", "Cards", "Wrong", "Your score"]);
    expect(screen.getAllByRole("definition").map((value) => value.textContent).slice(0, 4)).toEqual(["Classic", "10 / 10", "03", "7 of 10"]);
  });

  it("has a heading for the result and puts focus on it", () => {
    renderResult(finishedRound("classic", SEVEN_OF_TEN), storeWith({}).store);
    const heading = screen.getByRole("heading", { level: 1, name: "Round complete" });
    expect(document.activeElement).toBe(heading);
  });
});

describe("ResultView: the comparison with the record", () => {
  it("says First round on this route when there was no record, and sets it", () => {
    const { storage, store } = storeWith({});
    renderResult(finishedRound("classic", SEVEN_OF_TEN), store);
    expect(comparison()).toBe("First round on this route");
    expect(parseProgress(storage.getItem(PROGRESS_KEY)).records[KEY]).toBe(7);
  });

  it("stamps New best when an earlier record is beaten, and raises the record", () => {
    const { storage, store } = storeWith({ [KEY]: 6 });
    renderResult(finishedRound("classic", SEVEN_OF_TEN), store);
    expect(document.querySelector("[data-new-best]")?.textContent).toBe("New best");
    expect(comparison()).toBe("New bestPrevious best 6 / 10");
    expect(parseProgress(storage.getItem(PROGRESS_KEY)).records[KEY]).toBe(7);
  });

  it("says Equals your best when the record is matched", () => {
    const { storage, store } = storeWith({ [KEY]: 7 });
    renderResult(finishedRound("classic", SEVEN_OF_TEN), store);
    expect(comparison()).toBe("Equals your bestBest 7 / 10");
    expect(document.querySelector("[data-new-best]")).toBeNull();
    expect(parseProgress(storage.getItem(PROGRESS_KEY)).records[KEY]).toBe(7);
  });

  it("says how many short of the best, and keeps the record", () => {
    const { storage, store } = storeWith({ [KEY]: 9 });
    renderResult(finishedRound("classic", SEVEN_OF_TEN), store);
    expect(comparison()).toBe("2 short of your bestBest 9 / 10");
    expect(parseProgress(storage.getItem(PROGRESS_KEY)).records[KEY]).toBe(9);
  });

  it("keeps comparing with the record from before the round after it has been saved", () => {
    const { store } = storeWith({ [KEY]: 6 });
    const round = finishedRound("classic", SEVEN_OF_TEN);
    const view = renderResult(round, store);
    view.rerender(<ResultView round={round} ticket={TICKET} progressStore={store} onPlayAgain={view.onPlayAgain} onHome={view.onHome} now={now} />);
    expect(comparison()).toBe("New bestPrevious best 6 / 10");
    cleanup();
    renderResult(round, store);
    expect(comparison()).toBe("New bestPrevious best 6 / 10");
  });
});

// jsdom has no layout and no scrollIntoView: the calls are recorded, the e2e spec small-screens measures.
describe("ResultView: bringing the New best into view", () => {
  const original = Object.getOwnPropertyDescriptor(Element.prototype, "scrollIntoView");
  let calls: { element: Element; options: unknown }[] = [];
  beforeEach(() => {
    calls = [];
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      writable: true,
      value(this: Element, options?: unknown) {
        calls.push({ element: this, options });
      },
    });
  });
  afterEach(() => {
    if (original) Object.defineProperty(Element.prototype, "scrollIntoView", original);
    else delete (Element.prototype as Partial<Element>).scrollIntoView;
  });

  it("scrolls the comparison into view, smoothly, as the result appears", async () => {
    renderResult(finishedRound("classic", SEVEN_OF_TEN), storeWith({ [KEY]: 6 }).store);
    await act(async () => {});
    expect(calls).toHaveLength(1);
    expect(calls[0]?.element).toBe(document.querySelector("[data-comparison]"));
    expect(calls[0]?.options).toEqual({ block: "nearest", behavior: "smooth" });
  });

  it("jumps there at once when the player asks for reduced motion", async () => {
    motionPreference.reduced = true;
    renderResult(finishedRound("classic", SEVEN_OF_TEN), storeWith({ [KEY]: 6 }).store);
    await act(async () => {});
    expect(calls).toHaveLength(1);
    expect(calls[0]?.options).toEqual({ block: "nearest", behavior: "instant" });
  });

  it("leaves the scroll alone for the other comparisons", async () => {
    for (const records of [{}, { [KEY]: 7 }, { [KEY]: 9 }]) {
      renderResult(finishedRound("classic", SEVEN_OF_TEN), storeWith(records).store);
      await act(async () => {});
      cleanup();
    }
    expect(calls).toHaveLength(0);
  });

  it("keeps what scrolls under Play again out of the scroll target", () => {
    renderResult(finishedRound("classic", SEVEN_OF_TEN), storeWith({ [KEY]: 6 }).store);
    const scroller = document.querySelector("[data-comparison]")?.closest<HTMLElement>(".overflow-y-auto");
    expect(scroller?.style.scrollPaddingBottom).toBe("calc(var(--space-12) + var(--size-pill))");
  });
});

describe("ResultView: recording", () => {
  it("records the round exactly once under strict mode and re-renders", () => {
    const storage = memoryStorage();
    const setItem = vi.spyOn(storage, "setItem");
    const store = createLocalStore(storage);
    const progressStore = () => store;
    const round = finishedRound("classic", SEVEN_OF_TEN);
    const handlers = { onPlayAgain: vi.fn(), onHome: vi.fn() };
    const view = render(
      <StrictMode>
        <ResultView round={round} ticket={TICKET} progressStore={progressStore} now={now} {...handlers} />
      </StrictMode>,
    );
    view.rerender(
      <StrictMode>
        <ResultView round={round} ticket={TICKET} progressStore={progressStore} now={now} {...handlers} />
      </StrictMode>,
    );
    expect(setItem).toHaveBeenCalledTimes(1);
    const saved = parseProgress(storage.getItem(PROGRESS_KEY));
    expect(Object.values(saved.cards).every((entry) => entry.seen === 1)).toBe(true);
    expect(comparison()).toBe("First round on this route");
  });

  it("still shows the result when storage throws on every read and write", () => {
    const broken = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    const store = createLocalStore(broken);
    renderResult(finishedRound("classic", SEVEN_OF_TEN), () => store);
    expect(screen.getByRole("heading", { name: "Round complete" })).toBeTruthy();
    expect(comparison()).toBe("First round on this route");
    expect(screen.getByRole("button", { name: "Play again" })).toBeTruthy();
  });
});

describe("ResultView: missed cards", () => {
  it("lists the missed cards with their numbers in the round", () => {
    const round = finishedRound("classic", SEVEN_OF_TEN);
    renderResult(round, storeWith({}).store);
    expect(screen.getByText("3 to review")).toBeTruthy();
    const missedNumbers = screen.getAllByRole("listitem").map((item) => item.getAttribute("data-missed-card"));
    expect(missedNumbers).toEqual(["3", "6", "9"]);
    const third = round.answers[2];
    expect(screen.getByText(third?.card.text.en.statement ?? "")).toBeTruthy();
  });

  it("shows No missed cards after a perfect round", () => {
    renderResult(finishedRound("classic", Array.from({ length: 10 }, () => true)), storeWith({}).store);
    expect(screen.getByText("No missed cards")).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.getAllByRole("definition")[2]?.textContent).toBe("00");
  });
});

describe("ResultView: actions", () => {
  it("offers Play again with the replay icon, and calls onPlayAgain", () => {
    const view = renderResult(finishedRound("classic", SEVEN_OF_TEN), storeWith({}).store);
    const again = screen.getByRole("button", { name: "Play again" });
    expect(again.querySelector("svg path")?.getAttribute("d")).toBe("M3.5 9a5.5 5.5 0 1 0 1.8-4.1M3.5 2.5v3h3");
    time += RESULT_ARRIVES_MS; // the actions take presses once they have arrived
    fireEvent.click(again);
    expect(view.onPlayAgain).toHaveBeenCalledTimes(1);
    expect(view.onHome).not.toHaveBeenCalled();
  });

  it("goes home with Choose another route and with the close button", () => {
    const view = renderResult(finishedRound("classic", SEVEN_OF_TEN), storeWith({}).store);
    time += RESULT_ARRIVES_MS; // the actions take presses once they have arrived
    fireEvent.click(screen.getByRole("button", { name: "Choose another route" }));
    fireEvent.click(screen.getByRole("button", { name: "Close results" }));
    expect(view.onHome).toHaveBeenCalledTimes(2);
    expect(view.onPlayAgain).not.toHaveBeenCalled();
  });
});

// "Choose another route" lies where "See results" was: a second tap on See results, or a player still tapping
// when a Timed minute ends, must not leave the result before it has been seen.
describe("ResultView: the actions arrive", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("ignores presses on Play again, Choose another route and Close results until the result has been shown for a second", () => {
    expect(RESULT_ARRIVES_MS).toBe(1000);
    const view = renderResult(finishedRound("streak", [true, false]), storeWith({}).store);
    const press = () => {
      fireEvent.click(screen.getByRole("button", { name: "Play again" }));
      fireEvent.click(screen.getByRole("button", { name: "Choose another route" }));
      fireEvent.click(screen.getByRole("button", { name: "Close results" }));
    };
    press();
    time += 80;
    press();
    time += RESULT_ARRIVES_MS - 81; // 1 ms short
    press();
    expect(view.onPlayAgain).not.toHaveBeenCalled();
    expect(view.onHome).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Round complete" })).toBeTruthy();

    time += 1;
    press();
    expect(view.onPlayAgain).toHaveBeenCalledTimes(1);
    expect(view.onHome).toHaveBeenCalledTimes(2);
  });

  it("counts from when the result appeared, not from a later render", () => {
    const { store } = storeWith({});
    const round = finishedRound("classic", SEVEN_OF_TEN);
    const view = renderResult(round, store);
    time += 600;
    view.rerender(<ResultView round={round} ticket={TICKET} progressStore={store} onPlayAgain={view.onPlayAgain} onHome={view.onHome} now={now} />);
    time += 400;
    fireEvent.click(screen.getByRole("button", { name: "Play again" }));
    expect(view.onPlayAgain).toHaveBeenCalledTimes(1);
  });

  it("lets taps through to nothing until then: the action row and the close button take no pointer events", () => {
    vi.useFakeTimers();
    renderResult(finishedRound("lives", [false, false, false]), storeWith({}).store);
    const row = screen.getByRole("button", { name: "Play again" }).parentElement;
    const close = screen.getByRole("button", { name: "Close results" });
    expect(row?.className).toContain("pointer-events-none");
    expect(close.className).toContain("pointer-events-none");
    act(() => vi.advanceTimersByTime(RESULT_ARRIVES_MS - 1));
    expect(row?.className).toContain("pointer-events-none");
    act(() => vi.advanceTimersByTime(1));
    expect(row?.className).not.toContain("pointer-events-none");
    expect(close.className).not.toContain("pointer-events-none");
  });
});

function fieldValues(): (string | null)[] {
  return screen.getAllByRole("definition").map((value) => value.textContent).slice(0, 3);
}

function progressText(): string | null | undefined {
  return document.querySelector("[data-progress]")?.textContent;
}

function scoreText(): string | null | undefined {
  return document.querySelector("[data-score]")?.textContent;
}

// The completed route has a mark for each card of the round, not for each card dealt, and its last mark sits
// at the end of the route.
function expectMarksEndingTheRoute(count: number): void {
  const marks = document.querySelectorAll("[data-waypoint]");
  expect(marks).toHaveLength(count);
  const end = pointAt(1);
  expect(marks[count - 1]?.getAttribute("transform")).toMatch(new RegExp(`^translate\\(${end.x} ${end.y}\\)`));
}

// 13 right answers, then a wrong one: a Streak that ends on card 14.
const STREAK_OF_13 = [...Array.from({ length: 13 }, () => true), false];

describe("ResultView: Streak", () => {
  it("the score is the streak, without a unit", () => {
    const { storage, store } = storeWith({ [recordKey(ROUTE, "streak")]: 12 });
    renderResult(finishedRound("streak", STREAK_OF_13), store);
    expect(screen.getByRole("img", { name: "Streak over on card 14. 13 correct in a row. Card 14 was wrong." })).toBeTruthy();
    expect(progressText()).toBe("Ended · 14 cards");
    expect(fieldValues()).toEqual(["Streak", "14", "01"]);
    expect(screen.getAllByRole("term")[3]?.textContent).toBe("Correct in a row");
    expect(scoreText()).toBe("13");
    expect(comparison()).toBe("New bestPrevious best 12");
    expect(document.querySelectorAll('[data-ring="reached"]')).toHaveLength(1);
    expectMarksEndingTheRoute(14);
    expect(parseProgress(storage.getItem(PROGRESS_KEY)).records[recordKey(ROUTE, "streak")]).toBe(13);
  });

  it("says Equals your best", () => {
    const { storage, store } = storeWith({ [recordKey(ROUTE, "streak")]: 13 });
    renderResult(finishedRound("streak", STREAK_OF_13), store);
    expect(comparison()).toBe("Equals your bestBest 13");
    expect(document.querySelector("[data-new-best]")).toBeNull();
    expect(parseProgress(storage.getItem(PROGRESS_KEY)).records[recordKey(ROUTE, "streak")]).toBe(13);
  });

  it("says how many short of the best", () => {
    const { storage, store } = storeWith({ [recordKey(ROUTE, "streak")]: 20 });
    renderResult(finishedRound("streak", STREAK_OF_13), store);
    expect(comparison()).toBe("7 short of your bestBest 20");
    expect(document.querySelector('[data-ring="reached"]')).toBeNull();
    expect(parseProgress(storage.getItem(PROGRESS_KEY)).records[recordKey(ROUTE, "streak")]).toBe(20);
  });
});

describe("ResultView: Three lives", () => {
  const WRONG_ON_2_4_7 = [true, false, true, false, true, true, false];

  it("the score is the cards answered", () => {
    const { storage, store } = storeWith({});
    renderResult(finishedRound("lives", WRONG_ON_2_4_7), store);
    expect(fieldValues()).toEqual(["Three lives", "04", "03"]);
    expect(scoreText()).toBe("7 cards");
    expect(comparison()).toBe("First round on this route");
    expect(progressText()).toBe("Out of lives");
    expect(screen.getByRole("img", { name: "Out of lives after 7 cards. 4 correct, 3 wrong: cards 2, 4 and 7." })).toBeTruthy();
    // The round dealt a first chunk of 10 cards and used 7 of them.
    expectMarksEndingTheRoute(7);
    expect(parseProgress(storage.getItem(PROGRESS_KEY)).records[recordKey(ROUTE, "lives")]).toBe(7);
  });

  it("a new best gets the stamp", () => {
    renderResult(finishedRound("lives", WRONG_ON_2_4_7), storeWith({ [recordKey(ROUTE, "lives")]: 5 }).store);
    expect(document.querySelector("[data-new-best]")?.textContent).toBe("New best");
    expect(comparison()).toBe("New bestPrevious best 5 cards");
  });
});

describe("ResultView: Timed", () => {
  it("the score is the correct answers of the cards answered", () => {
    const { storage, store } = storeWith({});
    renderResult(finishedRound("timed", [true, false, true]), store);
    expect(fieldValues()).toEqual(["Timed", "60 s", "03"]);
    expect(scoreText()).toBe("2 of 3");
    expect(progressText()).toBe("Time is up · 3 cards");
    expect(screen.getByRole("img", { name: "Time is up. 3 cards answered in 60 seconds. 2 correct, 1 wrong: card 2." })).toBeTruthy();
    const saved = parseProgress(storage.getItem(PROGRESS_KEY));
    expect(saved.records[recordKey(ROUTE, "timed")]).toBe(2);
    expect(Object.keys(saved.cards)).toHaveLength(3);
  });

  it("nothing answered", () => {
    const { storage, store } = storeWith({});
    renderResult(finishedRound("timed", []), store);
    expect(progressText()).toBe("Time is up · 0 cards");
    expect(scoreText()).toBe("0 of 0");
    expect(comparison()).toBe("First round on this route");
    expect(screen.getByText("No missed cards")).toBeTruthy();
    expect(parseProgress(storage.getItem(PROGRESS_KEY)).records[recordKey(ROUTE, "timed")]).toBe(0);
  });
});

describe("ResultView: missed cards in every mode", () => {
  it("lists them with their place in the round", () => {
    renderResult(finishedRound("lives", [true, false, true, false, true, true, false]), storeWith({}).store);
    expect(screen.getByText("3 to review")).toBeTruthy();
    const items = screen.getAllByRole("listitem");
    expect(items.map((item) => item.getAttribute("data-missed-card"))).toEqual(["2", "4", "7"]);
    expect(screen.getByText("Card 02")).toBeTruthy();
    expect(screen.getByText("Card 04")).toBeTruthy();
    expect(screen.getByText("Card 07")).toBeTruthy();
  });
});
