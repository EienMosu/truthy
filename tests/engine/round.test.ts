import { describe, expect, it } from "vitest";
import type { Card, Route } from "@/src/content/schema";
import type { History } from "@/src/engine/deal";
import {
  AVAILABLE_MODES,
  CLASSIC_LENGTH,
  currentCard,
  lastAnswer,
  reduce,
  startRound,
  type Mode,
  type RoundEvent,
  type RoundState,
  type StartArgs,
} from "@/src/engine/round";

function card(id: string, answer: boolean): Card {
  return {
    id,
    section: "CON",
    text: { en: { statement: `Statement ${id}`, explanation: `Explanation ${id}` } },
    answer,
    source: { title: "AWS documentation", url: "https://docs.aws.amazon.com/" },
    difficulty: 1,
    appliesTo: "",
    conflictGroups: [],
  };
}

function pool(n: number): Card[] {
  return Array.from({ length: n }, (_, i) => card(`c${i + 1}`, i % 2 === 0));
}

const route: Route = { deckId: "aws-clf-c02", sectionId: "CON" };

function start(overrides: Partial<StartArgs> = {}) {
  return startRound({ mode: "classic", route, pool: pool(40), history: {}, seed: 1, ...overrides });
}

describe("round constants", () => {
  it("offers only Classic in step 1, with ten cards", () => {
    expect(AVAILABLE_MODES).toEqual(["classic"]);
    expect(CLASSIC_LENGTH).toBe(10);
  });
});

describe("startRound", () => {
  it("starts a Classic round on the first card, in the question phase, with no answers", () => {
    const state = start();
    expect(state.mode).toBe("classic");
    expect(state.route).toEqual(route);
    expect(state.cards).toHaveLength(10);
    expect(state.index).toBe(0);
    expect(state.answers).toEqual([]);
    expect(state.phase).toBe("question");
    expect(state.abandoned).toBe(false);
  });

  it("deals ten different cards from the pool", () => {
    const state = start();
    expect(new Set(state.cards.map((c) => c.id)).size).toBe(10);
  });

  it.each([1, 4, 9])("deals the whole pool when it has only %i cards", (n) => {
    expect(start({ pool: pool(n) }).cards).toHaveLength(n);
  });

  it("deals exactly ten from a pool of exactly ten or eleven", () => {
    expect(start({ pool: pool(10) }).cards).toHaveLength(10);
    expect(start({ pool: pool(11) }).cards).toHaveLength(10);
  });

  it("deals the same round for the same seed and a different one for another seed", () => {
    const ids = (seed: number) => start({ seed }).cards.map((c) => c.id);
    expect(ids(5)).toEqual(ids(5));
    expect(new Set([1, 2, 3, 4, 5].map((seed) => ids(seed).join(","))).size).toBeGreaterThan(1);
  });

  it("passes the history to the dealer: the cards answered wrong come back", () => {
    const history: History = {
      c1: { seen: 1, lastCorrect: false, lastSeenAt: 1 },
      c2: { seen: 1, lastCorrect: false, lastSeenAt: 2 },
    };
    const ids = start({ history }).cards.map((c) => c.id);
    expect(ids).toContain("c1");
    expect(ids).toContain("c2");
  });

  it("does not change the pool it is given", () => {
    const frozen = Object.freeze(pool(20));
    expect(() => start({ pool: frozen })).not.toThrow();
    expect(frozen.map((c) => c.id)).toEqual(pool(20).map((c) => c.id));
  });

  it.each(["streak", "lives", "timed"] as const)("rejects the %s mode, which is not available yet", (mode) => {
    expect(() => start({ mode })).toThrow(/not available/);
  });

  it("rejects a mode it does not know", () => {
    expect(() => start({ mode: "sudden-death" as Mode })).toThrow(/not available/);
  });

  it("rejects an empty pool", () => {
    expect(() => start({ pool: [] })).toThrow(/no cards/);
  });
});

describe("currentCard and lastAnswer at the start", () => {
  it("shows the first dealt card and no answer yet", () => {
    const state = start();
    expect(currentCard(state)).toBe(state.cards[0]);
    expect(lastAnswer(state)).toBeUndefined();
  });
});

// Freezes the state and everything in it, so any mutation inside reduce throws (modules run in strict mode).
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const inner of Object.values(value)) deepFreeze(inner);
  }
  return value;
}

// Applies the events one by one, freezing every state before it is handed to reduce.
function play(state: RoundState, events: readonly RoundEvent[]): RoundState {
  return events.reduce((s, event) => reduce(deepFreeze(s), event), state);
}

const answer = (value: boolean, at = 1000): RoundEvent => ({ type: "answer", value, at });
const NEXT: RoundEvent = { type: "next" };

// Answers the current card correctly and moves on.
function answerRight(state: RoundState, at = 1000): RoundEvent[] {
  return [answer(currentCard(state)?.answer ?? true, at), NEXT];
}

describe("reduce: the question phase", () => {
  it("records a right answer and shows the verdict", () => {
    const state = deepFreeze(start());
    const first = state.cards[0] as Card;
    const after = reduce(state, answer(first.answer, 1234));
    expect(after.phase).toBe("answered");
    expect(after.index).toBe(0);
    expect(after.answers).toEqual([{ card: first, given: first.answer, correct: true, at: 1234 }]);
    expect(lastAnswer(after)).toEqual({ card: first, given: first.answer, correct: true, at: 1234 });
  });

  it("records a wrong answer as not correct", () => {
    const state = deepFreeze(start());
    const first = state.cards[0] as Card;
    const after = reduce(state, answer(!first.answer, 50));
    expect(after.answers).toEqual([{ card: first, given: !first.answer, correct: false, at: 50 }]);
  });

  it("keeps the card on screen while the verdict shows", () => {
    const state = deepFreeze(start());
    expect(currentCard(reduce(state, answer(true)))).toBe(state.cards[0]);
  });

  it("ignores next before the card is answered", () => {
    const state = deepFreeze(start());
    expect(reduce(state, NEXT)).toBe(state);
  });

  it("ignores an event it does not know", () => {
    const state = deepFreeze(start());
    expect(reduce(state, { type: "tick", now: 5 } as unknown as RoundEvent)).toBe(state);
  });
});

describe("reduce: the answered phase", () => {
  it("ignores a second answer to the same card (a double tap)", () => {
    const answered = play(start(), [answer(true, 10)]);
    const again = reduce(deepFreeze(answered), answer(false, 20));
    expect(again).toBe(answered);
    expect(again.answers).toHaveLength(1);
  });

  it("moves to the next card on next", () => {
    const state = start();
    const after = play(state, [answer(true), NEXT]);
    expect(after.phase).toBe("question");
    expect(after.index).toBe(1);
    expect(currentCard(after)).toBe(state.cards[1]);
  });
});

describe("reduce: a whole Classic round", () => {
  it("finishes after the tenth card, not before", () => {
    let state = start();
    for (let i = 0; i < 9; i++) state = play(state, answerRight(state));
    expect(state.phase).toBe("question");
    expect(state.index).toBe(9);
    state = play(state, [answer(true)]);
    expect(state.phase).toBe("answered");
    state = play(state, [NEXT]);
    expect(state.phase).toBe("finished");
    expect(state.answers).toHaveLength(10);
    expect(state.abandoned).toBe(false);
    expect(currentCard(state)).toBeUndefined();
  });

  it("finishes after the last card when the pool has fewer than ten", () => {
    let state = start({ pool: pool(3) });
    for (let i = 0; i < 3; i++) state = play(state, answerRight(state));
    expect(state.phase).toBe("finished");
    expect(state.answers).toHaveLength(3);
  });

  it("finishes a round of a single card", () => {
    const state = play(start({ pool: pool(1) }), [answer(false), NEXT]);
    expect(state.phase).toBe("finished");
    expect(state.answers).toHaveLength(1);
  });

  it("records every card once, in the order dealt", () => {
    let state = start();
    for (let i = 0; i < 10; i++) state = play(state, [answer(i % 3 === 0, 100 + i), NEXT]);
    expect(state.answers.map((a) => a.card)).toEqual(state.cards);
    expect(state.answers.map((a) => a.at)).toEqual([100, 101, 102, 103, 104, 105, 106, 107, 108, 109]);
  });

  it("ignores answer and next once finished", () => {
    let state = start({ pool: pool(2) });
    state = play(state, [answer(true), NEXT, answer(true), NEXT]);
    const finished = deepFreeze(state);
    expect(reduce(finished, answer(true))).toBe(finished);
    expect(reduce(finished, NEXT)).toBe(finished);
  });

  it("never mutates the state it is given (every state is frozen before reduce)", () => {
    const state = start();
    const snapshot = JSON.stringify(state);
    expect(() => play(state, [answer(true), NEXT, answer(false), NEXT])).not.toThrow();
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});
