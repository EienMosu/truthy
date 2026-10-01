// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { StrictMode } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ResultView, recordRound } from "@/components/play/ResultView";
import type { TicketInfo } from "@/components/play/useRound";
import { poolFor } from "@/src/content/load";
import { reduce, startRound, type RoundState } from "@/src/engine/round";
import { PROGRESS_KEY, createLocalStore, type ProgressStore } from "@/src/progress/local";
import { emptyProgress, parseProgress, recordKey } from "@/src/progress/progress";
import { DECK, DECK_ID, memoryStorage, type MemoryStorage } from "./fixtures";

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});
afterEach(cleanup);

const ROUTE = { deckId: DECK_ID, sectionId: "SEC" };
const KEY = recordKey(ROUTE, "classic");
const TICKET: TicketInfo = {
  deckCode: "TST",
  deckName: "AWS Test deck",
  sectionCode: "SEC",
  sectionName: "Security and compliance",
  modeLabel: "Classic",
};

/** A finished Classic round on SEC: card i is answered right when right[i] is true. */
function finishedRound(right: readonly boolean[]): RoundState {
  let state = startRound({ mode: "classic", route: ROUTE, pool: poolFor(DECK, "SEC"), history: {}, seed: 7 });
  right.forEach((ok, i) => {
    const card = state.cards[state.index];
    if (!card) throw new Error("ran out of cards");
    state = reduce(state, { type: "answer", value: ok ? card.answer : !card.answer, at: 1000 + i });
    state = reduce(state, { type: "next" });
  });
  if (state.phase !== "finished") throw new Error("the round did not finish");
  return state;
}

const SEVEN_OF_TEN = [true, true, false, true, true, false, true, true, false, true];

function storeWith(records: Record<string, number>): { storage: MemoryStorage; store: () => ProgressStore } {
  const storage = memoryStorage({ [PROGRESS_KEY]: JSON.stringify({ ...emptyProgress(), records }) });
  const store = createLocalStore(storage);
  return { storage, store: () => store };
}

function renderResult(round: RoundState, store: () => ProgressStore, handlers = { onPlayAgain: vi.fn(), onHome: vi.fn() }) {
  const view = render(<ResultView round={round} ticket={TICKET} progressStore={store} {...handlers} />);
  return { ...view, ...handlers };
}

function comparison(): string | null | undefined {
  return document.querySelector("[data-comparison]")?.textContent;
}

describe("recordRound", () => {
  it("writes the round once, however often it is called, and returns the same outcome", () => {
    const round = finishedRound(SEVEN_OF_TEN);
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
    recordRound(finishedRound(SEVEN_OF_TEN), createLocalStore(storage));
    expect(parseProgress(storage.getItem(PROGRESS_KEY)).last).toEqual({ route: ROUTE, mode: "classic", score: 7, total: 10 });
  });
});

describe("ResultView: the ticket", () => {
  it("shows the completed flight path with every card resolved", () => {
    const { container } = renderResult(finishedRound(SEVEN_OF_TEN), storeWith({}).store);
    expect(screen.getByRole("img", { name: "Round complete. 10 of 10 cards. 7 correct, 3 wrong: cards 3, 6 and 9." })).toBeTruthy();
    expect(container.querySelectorAll('[data-waypoint="correct"]')).toHaveLength(7);
    expect(container.querySelectorAll('[data-waypoint="wrong"]')).toHaveLength(3);
    expect(container.querySelector("[data-plane]")).toBeNull();
  });

  it("fills the ticket head with the route, Class, Cards and Missed", () => {
    const { container } = renderResult(finishedRound(SEVEN_OF_TEN), storeWith({}).store);
    expect(container.querySelector('[data-leg="from"]')?.textContent).toBe("TSTAWS Test deck");
    expect(container.querySelector('[data-leg="to"]')?.textContent).toBe("SECSecurity and compliance");
    expect(screen.getAllByRole("term").map((term) => term.textContent).slice(0, 4)).toEqual(["Class", "Cards", "Missed", "Your score"]);
    expect(screen.getAllByRole("definition").map((value) => value.textContent).slice(0, 4)).toEqual(["Classic", "10 / 10", "03", "7 of 10"]);
  });

  it("has a heading for the result and puts focus on it", () => {
    renderResult(finishedRound(SEVEN_OF_TEN), storeWith({}).store);
    const heading = screen.getByRole("heading", { level: 1, name: "Round complete" });
    expect(document.activeElement).toBe(heading);
  });
});

describe("ResultView: the comparison with the record", () => {
  it("says First round on this route when there was no record, and sets it", () => {
    const { storage, store } = storeWith({});
    renderResult(finishedRound(SEVEN_OF_TEN), store);
    expect(comparison()).toBe("First round on this route");
    expect(parseProgress(storage.getItem(PROGRESS_KEY)).records[KEY]).toBe(7);
  });

  it("stamps New best when an earlier record is beaten, and raises the record", () => {
    const { storage, store } = storeWith({ [KEY]: 6 });
    renderResult(finishedRound(SEVEN_OF_TEN), store);
    expect(document.querySelector("[data-new-best]")?.textContent).toBe("New best");
    expect(comparison()).toBe("New bestPrevious best 6 / 10");
    expect(parseProgress(storage.getItem(PROGRESS_KEY)).records[KEY]).toBe(7);
  });

  it("says Equals your best when the record is matched", () => {
    const { storage, store } = storeWith({ [KEY]: 7 });
    renderResult(finishedRound(SEVEN_OF_TEN), store);
    expect(comparison()).toBe("Equals your bestBest 7 / 10");
    expect(document.querySelector("[data-new-best]")).toBeNull();
    expect(parseProgress(storage.getItem(PROGRESS_KEY)).records[KEY]).toBe(7);
  });

  it("says how many short of the best, and keeps the record", () => {
    const { storage, store } = storeWith({ [KEY]: 9 });
    renderResult(finishedRound(SEVEN_OF_TEN), store);
    expect(comparison()).toBe("2 short of your bestBest 9 / 10");
    expect(parseProgress(storage.getItem(PROGRESS_KEY)).records[KEY]).toBe(9);
  });

  it("keeps comparing with the record from before the round after it has been saved", () => {
    const { store } = storeWith({ [KEY]: 6 });
    const round = finishedRound(SEVEN_OF_TEN);
    const view = renderResult(round, store);
    view.rerender(<ResultView round={round} ticket={TICKET} progressStore={store} onPlayAgain={view.onPlayAgain} onHome={view.onHome} />);
    expect(comparison()).toBe("New bestPrevious best 6 / 10");
    cleanup();
    renderResult(round, store);
    expect(comparison()).toBe("New bestPrevious best 6 / 10");
  });
});

describe("ResultView: recording", () => {
  it("records the round exactly once under strict mode and re-renders", () => {
    const storage = memoryStorage();
    const setItem = vi.spyOn(storage, "setItem");
    const store = createLocalStore(storage);
    const progressStore = () => store;
    const round = finishedRound(SEVEN_OF_TEN);
    const handlers = { onPlayAgain: vi.fn(), onHome: vi.fn() };
    const view = render(
      <StrictMode>
        <ResultView round={round} ticket={TICKET} progressStore={progressStore} {...handlers} />
      </StrictMode>,
    );
    view.rerender(
      <StrictMode>
        <ResultView round={round} ticket={TICKET} progressStore={progressStore} {...handlers} />
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
    renderResult(finishedRound(SEVEN_OF_TEN), () => store);
    expect(screen.getByRole("heading", { name: "Round complete" })).toBeTruthy();
    expect(comparison()).toBe("First round on this route");
    expect(screen.getByRole("button", { name: "Play again" })).toBeTruthy();
  });
});

describe("ResultView: missed cards", () => {
  it("lists the missed cards with their numbers in the round", () => {
    const round = finishedRound(SEVEN_OF_TEN);
    renderResult(round, storeWith({}).store);
    expect(screen.getByText("3 to review")).toBeTruthy();
    const missedNumbers = screen.getAllByRole("listitem").map((item) => item.getAttribute("data-missed-card"));
    expect(missedNumbers).toEqual(["3", "6", "9"]);
    const third = round.answers[2];
    expect(screen.getByText(third?.card.text.en.statement ?? "")).toBeTruthy();
  });

  it("shows No missed cards after a perfect round", () => {
    renderResult(finishedRound(Array.from({ length: 10 }, () => true)), storeWith({}).store);
    expect(screen.getByText("No missed cards")).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.getAllByRole("definition")[2]?.textContent).toBe("00");
  });
});

describe("ResultView: actions", () => {
  it("offers Play again with the replay icon, and calls onPlayAgain", () => {
    const view = renderResult(finishedRound(SEVEN_OF_TEN), storeWith({}).store);
    const again = screen.getByRole("button", { name: "Play again" });
    expect(again.querySelector("svg path")?.getAttribute("d")).toBe("M3.5 9a5.5 5.5 0 1 0 1.8-4.1M3.5 2.5v3h3");
    fireEvent.click(again);
    expect(view.onPlayAgain).toHaveBeenCalledTimes(1);
    expect(view.onHome).not.toHaveBeenCalled();
  });

  it("goes home with Choose another route and with the close button", () => {
    const view = renderResult(finishedRound(SEVEN_OF_TEN), storeWith({}).store);
    fireEvent.click(screen.getByRole("button", { name: "Choose another route" }));
    fireEvent.click(screen.getByRole("button", { name: "Close results" }));
    expect(view.onHome).toHaveBeenCalledTimes(2);
    expect(view.onPlayAgain).not.toHaveBeenCalled();
  });
});
