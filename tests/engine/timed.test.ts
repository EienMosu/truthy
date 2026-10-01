import { describe, expect, it } from "vitest";
import type { Card, Route } from "@/src/content/schema";
import { TIMED, currentCard, isDecided, reduce, startRound, summarise, type Mode, type RoundEvent, type RoundState } from "@/src/engine/round";

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

function start(mode: Mode, size = 40, seed = 1): RoundState {
  return startRound({ mode, route, pool: pool(size), history: {}, seed });
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const inner of Object.values(value)) deepFreeze(inner);
  }
  return value;
}

function play(state: RoundState, events: readonly RoundEvent[]): RoundState {
  return events.reduce((s, event) => reduce(deepFreeze(s), event), state);
}

const NEXT: RoundEvent = { type: "next" };
const ABANDON: RoundEvent = { type: "abandon" };

// Answers the card on screen right or wrong (phase "answered" afterwards; no next).
function give(state: RoundState, right: boolean, at = 1000): RoundState {
  const truth = currentCard(state)?.answer ?? true;
  return play(state, [{ type: "answer", value: right ? truth : !truth, at }]);
}

const T0 = 1_700_000_000_000;
const tick = (now: number): RoundEvent => ({ type: "tick", now });
const hide = (at: number): RoundEvent => ({ type: "visibility", hidden: true, at });
const show = (at: number): RoundEvent => ({ type: "visibility", hidden: false, at });

// Ticks every 100 ms from `from` (exclusive) to `to` (inclusive).
function ticks(from: number, to: number): RoundEvent[] {
  const events: RoundEvent[] = [];
  for (let now = from + 100; now <= to; now += 100) events.push(tick(now));
  return events;
}

function timed(size = 40): RoundState {
  return play(start("timed", size), [tick(T0)]);
}

describe("Timed: the clock", () => {
  it("has sixty seconds, a 700 ms stamp and counts at most one second per tick", () => {
    expect(TIMED).toEqual({ roundMs: 60_000, holdMs: 700, maxStepMs: 1_000 });
  });

  it("starts full and stopped; the first tick starts it without taking time", () => {
    expect(start("timed").clock).toEqual({ remainingMs: 60_000, lastTick: null, hidden: false, holdMs: 0 });
    expect(timed().clock).toEqual({ remainingMs: 60_000, lastTick: T0, hidden: false, holdMs: 0 });
  });

  it("the other modes have no clock and ignore ticks and visibility", () => {
    for (const mode of ["classic", "streak", "lives"] as const) {
      const state = deepFreeze(start(mode));
      expect(state.clock).toBeNull();
      expect(reduce(state, tick(T0))).toBe(state);
      expect(reduce(state, hide(T0))).toBe(state);
    }
  });

  it("counts down by the time between ticks", () => {
    const state = play(timed(), [tick(T0 + 100), tick(T0 + 350)]);
    expect(state.clock?.remainingMs).toBe(59_650);
    expect(state.phase).toBe("question");
  });

  it("never counts backwards when the clock source jumps back", () => {
    const state = play(timed(), [tick(T0 + 500), tick(T0 + 200)]);
    expect(state.clock?.remainingMs).toBe(59_500);
    expect(state.clock?.lastTick).toBe(T0 + 200);
  });

  it("counts a gap of more than a second between two ticks as one second (a sleep without a visibility event)", () => {
    const state = play(timed(), [tick(T0 + 45_000)]);
    expect(state.clock?.remainingMs).toBe(59_000);
  });

  it("pauses while the page is hidden and goes on from where it was", () => {
    const state = play(timed(), [tick(T0 + 1_000), hide(T0 + 1_400), tick(T0 + 5_000), tick(T0 + 9_000), show(T0 + 30_000), tick(T0 + 30_100)]);
    expect(state.clock).toEqual({ remainingMs: 58_500, lastTick: T0 + 30_100, hidden: false, holdMs: 0 });
  });

  it("returns the same state for a tick while hidden, and for a repeated visibility event", () => {
    const hidden = deepFreeze(play(timed(), [hide(T0 + 100)]));
    expect(hidden.clock).toMatchObject({ remainingMs: 59_900, hidden: true, lastTick: null });
    expect(reduce(hidden, tick(T0 + 5_000))).toBe(hidden);
    expect(reduce(hidden, hide(T0 + 6_000))).toBe(hidden);
    const shown = deepFreeze(timed());
    expect(reduce(shown, show(T0 + 50))).toBe(shown);
  });
});

describe("Timed: answers and the stamp", () => {
  it("an answer is stamped: recorded, no answered phase, 700 ms hold", () => {
    const state = give(timed(), true, T0 + 2_000);
    expect(state.phase).toBe("stamped");
    expect(state.answers).toHaveLength(1);
    expect(state.clock).toMatchObject({ remainingMs: 59_000, holdMs: 700, lastTick: T0 + 2_000 });
    expect(isDecided(state)).toBe(false);
  });

  it("counts the clock up to the moment of the answer", () => {
    const state = give(play(timed(), [tick(T0 + 900)]), false, T0 + 950);
    expect(state.clock?.remainingMs).toBe(59_050);
  });

  it("ignores answer and next while stamped", () => {
    const state = deepFreeze(give(timed(), true, T0 + 500));
    expect(reduce(state, { type: "answer", value: true, at: T0 + 600 })).toBe(state);
    expect(reduce(state, NEXT)).toBe(state);
  });

  it("shows the next card once 700 ms have been counted since the answer, not before", () => {
    const stamped = give(timed(), true, T0 + 500);
    const before = play(stamped, ticks(T0 + 500, T0 + 1_100));
    expect([before.phase, before.index, before.clock?.holdMs]).toEqual(["stamped", 0, 100]);
    const after = play(before, [tick(T0 + 1_200)]);
    expect([after.phase, after.index, after.clock?.holdMs]).toEqual(["question", 1, 0]);
    expect(after.clock?.remainingMs).toBe(58_800);
  });

  it("holds the stamp while the page is hidden", () => {
    const state = play(give(timed(), true, T0 + 500), [tick(T0 + 800), hide(T0 + 900), show(T0 + 20_000), tick(T0 + 20_200)]);
    expect([state.phase, state.clock?.holdMs]).toEqual(["stamped", 100]);
    expect(play(state, [tick(T0 + 20_300)]).phase).toBe("question");
  });

  it("deals the next chunk when the stamp ends on the last dealt card", () => {
    let state = timed();
    let now = T0;
    for (let i = 0; i < 10; i++) {
      now += 300;
      state = give(state, true, now);
      state = play(state, ticks(now, now + 700));
      now += 700;
    }
    expect([state.phase, state.index, state.cards.length]).toEqual(["question", 10, 20]);
  });
});

describe("Timed: time up", () => {
  // The clock one tick before zero, on the first card, nothing answered.
  function nearlyUp(): RoundState {
    return play(timed(), ticks(T0, T0 + 59_900));
  }

  it("stops at zero on the question: decided, stamped, the card on screen not answered", () => {
    const almost = nearlyUp();
    expect(almost.clock?.remainingMs).toBe(100);
    const up = play(almost, [tick(T0 + 60_000)]);
    expect(up.clock?.remainingMs).toBe(0);
    expect([up.phase, isDecided(up), up.index, up.answers.length]).toEqual(["stamped", true, 0, 0]);
  });

  it("returns the same state for every event but next and abandon once time is up", () => {
    const up = deepFreeze(play(nearlyUp(), [tick(T0 + 60_000)]));
    expect(reduce(up, tick(T0 + 60_100))).toBe(up);
    expect(reduce(up, tick(T0 + 99_000))).toBe(up);
    expect(reduce(up, hide(T0 + 60_200))).toBe(up);
    expect(reduce(up, show(T0 + 60_300))).toBe(up);
    expect(reduce(up, { type: "answer", value: true, at: T0 + 60_400 })).toBe(up);
  });

  it("next after time up finishes the round; the card on screen is neither counted nor recorded", () => {
    let state = timed();
    state = give(state, true, T0 + 1_000);
    state = play(state, ticks(T0 + 1_000, T0 + 1_700));
    state = give(state, false, T0 + 2_000);
    state = play(state, ticks(T0 + 2_000, T0 + 60_000));
    expect([state.phase, isDecided(state), state.index]).toEqual(["stamped", true, 2]);
    const done = play(state, [NEXT]);
    expect(done.phase).toBe("finished");
    const result = summarise(done);
    expect(result).toMatchObject({ mode: "timed", score: 1, total: 2, abandoned: false });
    expect(result.answers.map((a) => a.card.id)).toEqual([state.cards[0]?.id, state.cards[1]?.id]);
    expect(result.answers.some((a) => a.card.id === state.cards[2]?.id)).toBe(false);
  });

  it("an answer that arrives at or after zero does not count", () => {
    const late = play(nearlyUp(), [{ type: "answer", value: true, at: T0 + 60_050 }]);
    expect(late.answers).toEqual([]);
    expect([late.phase, isDecided(late), late.clock?.remainingMs]).toEqual(["stamped", true, 0]);
  });

  it("time running out during the stamp keeps that answer and moves on to a card that does not count", () => {
    const answered = give(nearlyUp(), true, T0 + 59_950);
    expect([answered.answers.length, answered.clock?.remainingMs]).toEqual([1, 50]);
    const up = play(answered, [tick(T0 + 60_000)]);
    expect([up.phase, isDecided(up), up.index, up.answers.length, up.clock?.holdMs]).toEqual(["stamped", true, 1, 1, 0]);
    expect(currentCard(up)).toBe(up.cards[1]);
  });

  it("hiding the page at the moment the time runs out is time up, not a pause", () => {
    const up = play(nearlyUp(), [hide(T0 + 60_000)]);
    expect([up.clock?.remainingMs, up.clock?.hidden, isDecided(up)]).toEqual([0, false, true]);
  });

  it("a round left after time is up is abandoned like any other; next finishes it", () => {
    const up = play(nearlyUp(), [tick(T0 + 60_000)]);
    expect(play(up, [ABANDON])).toMatchObject({ phase: "finished", abandoned: true });
    expect(play(up, [NEXT])).toMatchObject({ phase: "finished", abandoned: false });
  });

  it("ignores every tick after the round was left", () => {
    const left = deepFreeze(play(timed(), [ABANDON]));
    expect(reduce(left, tick(T0 + 100))).toBe(left);
    expect(reduce(left, hide(T0 + 200))).toBe(left);
  });

  it("is the same round for the same seed and events", () => {
    const events: RoundEvent[] = [tick(T0), { type: "answer", value: true, at: T0 + 400 }, ...ticks(T0 + 400, T0 + 1_100), hide(T0 + 1_150), show(T0 + 9_000), tick(T0 + 9_100)];
    expect(play(start("timed", 40, 5), events)).toEqual(play(start("timed", 40, 5), events));
  });
});
