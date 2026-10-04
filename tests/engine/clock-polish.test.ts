import { describe, expect, it } from "vitest";
import type { Card, Route } from "@/src/content/schema";
import { currentCard, isDecided, reduce, startRound, type Mode, type RoundEvent, type RoundState } from "@/src/engine/round";

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

const route: Route = { deckId: "aws-clf-c02", sectionId: "CON" };
const pool = Array.from({ length: 40 }, (_, i) => card(`c${i + 1}`, i % 2 === 0));

function start(mode: Mode): RoundState {
  return startRound({ mode, route, pool, history: {}, seed: 1 });
}

function play(state: RoundState, events: readonly RoundEvent[]): RoundState {
  return events.reduce((s, event) => reduce(s, event), state);
}

const T0 = 1_700_000_000_000;
const tick = (now: number): RoundEvent => ({ type: "tick", now });

// Ticks every 100 ms from `from` (exclusive) to `to` (inclusive).
function ticks(from: number, to: number): RoundEvent[] {
  const events: RoundEvent[] = [];
  for (let now = from + 100; now <= to; now += 100) events.push(tick(now));
  return events;
}

function rightAnswer(state: RoundState, at: number): RoundEvent {
  return { type: "answer", value: currentCard(state)?.answer ?? true, at };
}

// Spec section 6, Timed: sixty seconds, whatever time a bad clock source reports on the way.
describe("Timed: a time that is not a number", () => {
  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "a tick at %d is ignored, and the minute still ends on time",
    (bad) => {
      const before = play(start("timed"), [tick(T0), ...ticks(T0, T0 + 5_000)]);
      const after = reduce(before, tick(bad));
      expect(after).toBe(before);
      const ended = play(after, ticks(T0 + 5_000, T0 + 61_000));
      expect(ended.clock?.remainingMs).toBe(0);
      expect(isDecided(ended)).toBe(true);
      const late = reduce(ended, rightAnswer(ended, T0 + 61_000));
      expect(late.answers).toHaveLength(ended.answers.length);
    },
  );

  it("an answer at NaN is ignored: it neither counts nor moves the clock", () => {
    const state = play(start("timed"), [tick(T0), ...ticks(T0, T0 + 2_000)]);
    const after = reduce(state, rightAnswer(state, Number.NaN));
    expect(after).toBe(state);
    expect(after.clock?.remainingMs).toBe(58_000);
  });

  it("a page shown again at NaN is ignored, so the clock keeps counting from a real moment", () => {
    const hidden = play(start("timed"), [tick(T0), { type: "visibility", hidden: true, at: T0 + 1_000 }]);
    const after = reduce(hidden, { type: "visibility", hidden: false, at: Number.NaN });
    expect(after).toBe(hidden);
    const shown = play(after, [{ type: "visibility", hidden: false, at: T0 + 9_000 }, ...ticks(T0 + 9_000, T0 + 70_000)]);
    expect(shown.clock?.remainingMs).toBe(0);
    expect(isDecided(shown)).toBe(true);
  });

  it("a Classic answer at NaN is ignored, so no card history can get a time that cannot be stored", () => {
    const state = start("classic");
    expect(reduce(state, rightAnswer(state, Number.NaN))).toBe(state);
    expect(reduce(state, rightAnswer(state, T0)).answers).toHaveLength(1);
  });
});
