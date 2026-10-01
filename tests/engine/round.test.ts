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
  summarise,
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

const ABANDON: RoundEvent = { type: "abandon" };

describe("reduce: abandon", () => {
  it("ends the round as abandoned from the question phase, keeping the answers given", () => {
    const state = play(start(), [answer(true), NEXT, ABANDON]);
    expect(state.phase).toBe("finished");
    expect(state.abandoned).toBe(true);
    expect(state.answers).toHaveLength(1);
  });

  it("ends the round as abandoned from the answered phase", () => {
    const state = play(start(), [answer(true), ABANDON]);
    expect(state.phase).toBe("finished");
    expect(state.abandoned).toBe(true);
    expect(state.answers).toHaveLength(1);
  });

  it("ends the round as abandoned before any answer", () => {
    const state = play(start(), [ABANDON]);
    expect(state.phase).toBe("finished");
    expect(state.abandoned).toBe(true);
    expect(state.answers).toEqual([]);
  });

  it("can abandon at every point of a round", () => {
    const events: RoundEvent[] = [];
    let state = start();
    for (let i = 0; i < 10; i++) {
      events.push(answer(true), NEXT);
    }
    for (let cut = 0; cut < events.length; cut++) {
      const left = play(state, [...events.slice(0, cut), ABANDON]);
      expect(left.abandoned).toBe(true);
      expect(left.phase).toBe("finished");
      expect(left.answers).toHaveLength(Math.ceil(cut / 2));
    }
    state = play(state, events);
    expect(state.abandoned).toBe(false);
  });

  it("ignores abandon once the round has finished normally", () => {
    const finished = deepFreeze(play(start({ pool: pool(1) }), [answer(true), NEXT]));
    expect(reduce(finished, ABANDON)).toBe(finished);
  });

  it("ignores answer and next after abandoning", () => {
    const left = deepFreeze(play(start(), [ABANDON]));
    expect(reduce(left, answer(true))).toBe(left);
    expect(reduce(left, NEXT)).toBe(left);
    expect(reduce(left, ABANDON)).toBe(left);
  });
});

describe("summarise", () => {
  it("scores a finished Classic round: correct answers out of ten, missed cards in order", () => {
    let state = start();
    const wrongAt = new Set([2, 5, 7]);
    for (let i = 0; i < 10; i++) {
      const right = currentCard(state)?.answer ?? true;
      state = play(state, [answer(wrongAt.has(i) ? !right : right, 500 + i), NEXT]);
    }
    const result = summarise(state);
    expect(result.mode).toBe("classic");
    expect(result.route).toEqual(route);
    expect(result.score).toBe(7);
    expect(result.total).toBe(10);
    expect(result.answers).toHaveLength(10);
    expect(result.missed.map((a) => a.card)).toEqual([state.cards[2], state.cards[5], state.cards[7]]);
    expect(result.missed.every((a) => !a.correct)).toBe(true);
    expect(result.abandoned).toBe(false);
  });

  it("scores a perfect round with no missed cards", () => {
    let state = start();
    for (let i = 0; i < 10; i++) state = play(state, answerRight(state));
    expect(summarise(state)).toMatchObject({ score: 10, total: 10, missed: [], abandoned: false });
  });

  it("scores a round of a small pool out of the cards it had", () => {
    let state = start({ pool: pool(4) });
    for (let i = 0; i < 4; i++) state = play(state, answerRight(state));
    expect(summarise(state)).toMatchObject({ score: 4, total: 4, abandoned: false });
  });

  it("summarises an abandoned round with the answers given so far", () => {
    let state = start();
    const first = currentCard(state) as Card;
    state = play(state, [answer(!first.answer, 1), NEXT]);
    state = play(state, answerRight(state));
    state = play(state, [ABANDON]);
    const result = summarise(state);
    expect(result).toMatchObject({ score: 1, total: 2, abandoned: true });
    expect(result.missed.map((a) => a.card)).toEqual([first]);
  });

  it("summarises a round abandoned before any answer as zero out of zero", () => {
    expect(summarise(play(start(), [ABANDON]))).toMatchObject({ score: 0, total: 0, answers: [], missed: [], abandoned: true });
  });

  it("does not change the state it summarises", () => {
    const state = deepFreeze(play(start(), [answer(true), NEXT]));
    expect(() => summarise(state)).not.toThrow();
  });
});

describe("round: review focus", () => {
  it("plays a pool that lists a card twice as a round of its distinct cards, each answered once", () => {
    const twice = [...pool(6), ...pool(6)];
    let state = start({ pool: twice });
    expect(state.cards).toHaveLength(6);
    for (let i = 0; i < 6; i++) state = play(state, answerRight(state));
    expect(state.phase).toBe("finished");
    expect(new Set(state.answers.map((a) => a.card.id)).size).toBe(6);
    expect(summarise(state)).toMatchObject({ score: 6, total: 6 });
  });
});
