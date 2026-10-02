import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { Card, Route } from "@/src/content/schema";
import type { History } from "@/src/content/play";
import { dealChunk } from "@/src/engine/deal";
import { createRng } from "@/src/engine/rng";
import {
  LIVES,
  TIMED,
  chunkSeed,
  currentCard,
  isDecided,
  livesLeft,
  reduce,
  scoreOf,
  startRound,
  summarise,
  type Mode,
  type RoundEvent,
  type RoundState,
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

// Answers `count` cards right, pressing next after each.
function rightTimes(state: RoundState, count: number): RoundState {
  let s = state;
  for (let i = 0; i < count; i++) s = play(give(s, true), [NEXT]);
  return s;
}

describe("chunkSeed", () => {
  it("is the seed itself for the first chunk and a different 32-bit number for each later one", () => {
    expect(chunkSeed(12345, 0)).toBe(12345);
    const seeds = [0, 1, 2, 3, 4].map((k) => chunkSeed(12345, k));
    expect(new Set(seeds).size).toBe(5);
    expect(seeds.every((s) => Number.isInteger(s) && s >= 0 && s <= 0xffffffff)).toBe(true);
    expect(chunkSeed(0xffffffff, 1)).toBe((0xffffffff + 0x9e3779b9) >>> 0);
  });
});

describe("Streak", () => {
  it("goes on after a right answer and deals a second chunk after card ten", () => {
    const state = rightTimes(start("streak"), 10);
    expect(state.phase).toBe("question");
    expect(state.index).toBe(10);
    expect(state.cards).toHaveLength(20);
    expect(new Set(state.cards.map((c) => c.id)).size).toBe(20);
    expect(state.source.chunks).toBe(2);
  });

  it("is decided by the first wrong answer; next then finishes it", () => {
    const wrong = give(rightTimes(start("streak"), 3), false);
    expect(wrong.phase).toBe("answered");
    expect(isDecided(wrong)).toBe(true);
    const done = play(wrong, [NEXT]);
    expect(done.phase).toBe("finished");
    expect(done.abandoned).toBe(false);
    expect(done.index).toBe(3);
    expect(summarise(done)).toMatchObject({ mode: "streak", score: 3, total: 4, abandoned: false });
    expect(summarise(done).missed.map((a) => a.card.id)).toEqual([wrong.cards[3]?.id]);
  });

  it("is not decided by a right answer", () => {
    expect(isDecided(give(start("streak"), true))).toBe(false);
  });

  it("scores zero when the first answer is wrong", () => {
    expect(summarise(play(give(start("streak"), false), [NEXT])).score).toBe(0);
  });

  it("ignores a second answer to the ending card", () => {
    const wrong = deepFreeze(give(start("streak"), false));
    expect(reduce(wrong, { type: "answer", value: true, at: 2000 })).toBe(wrong);
  });

  it("deals the same round for the same seed and events, across chunks", () => {
    const a = rightTimes(start("streak", 40, 77), 25);
    const b = rightTimes(start("streak", 40, 77), 25);
    expect(b.cards.map((c) => c.id)).toEqual(a.cards.map((c) => c.id));
    expect(rightTimes(start("streak", 40, 78), 25).cards.map((c) => c.id)).not.toEqual(a.cards.map((c) => c.id));
  });

  it("never runs out of cards on an 11 card route", () => {
    const state = rightTimes(start("streak", 11), 30);
    expect(state.phase).toBe("question");
    expect(state.answers).toHaveLength(30);
    expect(new Set(state.cards.slice(0, 11).map((c) => c.id)).size).toBe(11);
    expect(currentCard(state)).toBeDefined();
  });
});

describe("Three lives", () => {
  it("has three lives", () => {
    expect(LIVES).toBe(3);
    expect(livesLeft(start("lives"))).toBe(3);
  });

  it("goes on after the first and the second wrong answer", () => {
    let state = start("lives");
    state = play(give(state, false), [NEXT]);
    expect([state.phase, livesLeft(state)]).toEqual(["question", 2]);
    state = play(give(state, false), [NEXT]);
    expect([state.phase, livesLeft(state)]).toEqual(["question", 1]);
  });

  it("is decided by the third wrong answer, wherever it falls; the score is the cards answered", () => {
    let state = start("lives");
    for (const right of [true, false, true, true, false, true]) state = play(give(state, right), [NEXT]);
    const last = give(state, false);
    expect(isDecided(last)).toBe(true);
    expect(livesLeft(last)).toBe(0);
    const done = play(last, [NEXT]);
    expect(done.phase).toBe("finished");
    expect(summarise(done)).toMatchObject({ mode: "lives", score: 7, total: 7, abandoned: false });
    expect(summarise(done).missed).toHaveLength(3);
  });

  it("is not decided by a right answer on the last life", () => {
    let state = start("lives");
    for (const right of [false, false]) state = play(give(state, right), [NEXT]);
    expect(isDecided(give(state, true))).toBe(false);
  });

  it("plays past the first chunk", () => {
    const state = rightTimes(start("lives", 12), 12);
    expect(state.index).toBe(12);
    expect(state.cards.length).toBeGreaterThan(12);
  });
});

describe("Classic keeps its rule", () => {
  it("is decided by the answer to its last card and finishes on next", () => {
    const state = rightTimes(start("classic"), 9);
    expect(isDecided(state)).toBe(false);
    const last = give(state, true);
    expect(isDecided(last)).toBe(true);
    expect(play(last, [NEXT]).phase).toBe("finished");
    expect(last.cards).toHaveLength(10);
  });

  it("is decided by the last card of a short route", () => {
    expect(isDecided(give(start("classic", 1), false))).toBe(true);
  });
});

describe("leaving a round", () => {
  it.each(["classic", "streak", "lives", "timed"] as const)("%s: a round that is left is abandoned and keeps its answers", (mode) => {
    const left = play(give(start(mode), true), [ABANDON]);
    expect([left.phase, left.abandoned]).toEqual(["finished", true]);
    expect(summarise(left)).toMatchObject({ abandoned: true, total: 1 });
  });

  it("a decided round that is left is abandoned too: only next finishes it with its score", () => {
    const streak = give(rightTimes(start("streak"), 5), false);
    const classic = give(rightTimes(start("classic"), 9), true);
    let lives = start("lives");
    for (const right of [false, false]) lives = play(give(lives, right), [NEXT]);
    lives = give(lives, false);
    for (const decided of [streak, classic, lives]) {
      expect(isDecided(decided)).toBe(true);
      expect(play(decided, [ABANDON])).toMatchObject({ phase: "finished", abandoned: true });
      expect(play(decided, [NEXT])).toMatchObject({ phase: "finished", abandoned: false });
    }
  });

  it("returns a finished round as it is", () => {
    const done = deepFreeze(play(give(start("streak"), false), [NEXT]));
    expect(reduce(done, ABANDON)).toBe(done);
  });
});

describe("scoreOf", () => {
  const answers = [true, true, false, true].map((correct, i) => ({ card: card(`s${i}`, true), given: correct, correct, at: i }));
  it("is the number each mode's record keeps", () => {
    expect(scoreOf("classic", answers)).toBe(3);
    expect(scoreOf("timed", answers)).toBe(3);
    expect(scoreOf("streak", answers)).toBe(2);
    expect(scoreOf("lives", answers)).toBe(4);
  });
});

// Rule 2 and decision 11 of the step 2 plan, the contract the Swift and Kotlin clones keep: chunk k of a round
// is dealt with createRng(chunkSeed(seed, k)), after the cards already dealt. A round dealt with one generator
// for every chunk passes the determinism tests above, so this pins the seed of each chunk.
describe("the seed of each chunk", () => {
  it("deals chunk 1 and chunk 2 of a round with chunkSeed(seed, 1) and chunkSeed(seed, 2)", () => {
    const seed = 4242;
    const state = rightTimes(start("streak", 40, seed), 20);
    const first10 = state.cards.slice(0, 10);
    expect(first10.map((c) => c.id)).toEqual(dealChunk(pool(40), {}, createRng(chunkSeed(seed, 0)), []).map((c) => c.id));
    const chunk1 = dealChunk(pool(40), {}, createRng(chunkSeed(seed, 1)), first10);
    expect(state.cards.slice(10, 20).map((c) => c.id)).toEqual(chunk1.map((c) => c.id));
    const chunk2 = dealChunk(pool(40), {}, createRng(chunkSeed(seed, 2)), [...first10, ...chunk1]);
    expect(state.cards.slice(20, 30).map((c) => c.id)).toEqual(chunk2.map((c) => c.id));
  });
});

// The engine is pure and keeps its own hold; the design token says the same time to the clones.
describe("the Timed hold", () => {
  it("is the hold-timed token of design/system/tokens.json", () => {
    const tokens = JSON.parse(readFileSync(new URL("../../design/system/tokens.json", import.meta.url), "utf8")) as {
      motion: { duration: Record<string, { $value: { value: number; unit: string } }> };
    };
    expect(tokens.motion.duration["hold-timed"]?.$value).toEqual({ value: TIMED.holdMs, unit: "ms" });
  });
});

// Spec section 6, plan decision 9: the stored history ranks the cards a chunk has not shown, missed cards first,
// at most three per ten. Every chunk of an unbounded round is dealt by withNextChunk from the stored history, not
// only the first: a round that dealt the later chunks with an empty history would pass the tests above.
describe("the stored history in every chunk", () => {
  // Nine missed cards of both answers, spread over a pool of forty: three chunks owe three each.
  const missedIds = ["c1", "c4", "c9", "c12", "c17", "c20", "c25", "c28", "c33"];
  const history: History = Object.fromEntries(
    missedIds.map((id, i) => [id, { seen: 2, lastCorrect: false, lastSeenAt: 100 + i }]),
  );
  const missedIn = (state: RoundState, from: number) =>
    state.cards.slice(from, from + 10).filter((c) => missedIds.includes(c.id)).length;
  const tick = (now: number): RoundEvent => ({ type: "tick", now });

  // Answers every card right, Next card (or the Timed hold) in between, until `count` cards are answered.
  function playRight(mode: Mode, seed: number, count: number): RoundState {
    let state = startRound({ mode, route, pool: pool(40), history, seed });
    let now = 1_700_000_000_000;
    while (state.answers.length < count) {
      state = reduce(state, { type: "answer", value: currentCard(state)?.answer ?? true, at: now });
      if (mode === "timed") {
        const answered = state.answers.length;
        while (state.answers.length === answered && state.phase === "stamped") state = reduce(state, tick((now += 100)));
      } else {
        state = reduce(state, NEXT);
      }
    }
    return state;
  }

  it.each(["streak", "lives", "timed"] as const)("%s: deals three missed cards in each of the first three chunks", (mode) => {
    for (let seed = 1; seed <= 40; seed++) {
      const state = playRight(mode, seed, 21);
      expect([0, 10, 20].map((from) => missedIn(state, from)), `seed ${seed}`).toEqual([3, 3, 3]);
    }
  });
});
