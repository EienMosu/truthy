import { describe, expect, it } from "vitest";
import type { Card } from "@/src/content/schema";
import { DEAL, deal, type CardHistory, type History } from "@/src/engine/deal";
import { createRng } from "@/src/engine/rng";

function card(id: string, answer: boolean, conflictGroups: string[] = []): Card {
  return {
    id,
    section: "SEC",
    text: { en: { statement: `Statement ${id}`, explanation: `Explanation ${id}` } },
    answer,
    source: { title: "AWS documentation", url: "https://docs.aws.amazon.com/" },
    difficulty: 2,
    appliesTo: "",
    conflictGroups,
  };
}

// n cards named `${prefix}1` .. `${prefix}n`, answers alternating True, False, True, ...
function cards(prefix: string, n: number, answer: (i: number) => boolean = (i) => i % 2 === 0): Card[] {
  return Array.from({ length: n }, (_, i) => card(`${prefix}${i + 1}`, answer(i)));
}

function missed(lastSeenAt: number): CardHistory {
  return { seen: 1, lastCorrect: false, lastSeenAt };
}

function right(lastSeenAt: number): CardHistory {
  return { seen: 1, lastCorrect: true, lastSeenAt };
}

function ids(dealt: readonly Card[]): string[] {
  return dealt.map((c) => c.id);
}

function withPrefix(dealt: readonly Card[], prefix: string): string[] {
  return ids(dealt).filter((id) => id.startsWith(prefix));
}

describe("DEAL", () => {
  it("holds the numbers from the spec", () => {
    expect(DEAL).toEqual({ missedPerTen: 3, minTrue: 4, maxTrue: 6, maxRun: 3 });
  });
});

describe("deal: how many cards", () => {
  it("deals nothing from an empty pool", () => {
    expect(deal([], {}, createRng(1), { count: 10 })).toEqual([]);
  });

  it("deals nothing when asked for zero or a negative count", () => {
    const pool = cards("c", 12);
    expect(deal(pool, {}, createRng(1), { count: 0 })).toEqual([]);
    expect(deal(pool, {}, createRng(1), { count: -3 })).toEqual([]);
  });

  it.each([1, 3, 9])("deals the whole pool when it has only %i cards", (size) => {
    const pool = cards("c", size);
    const dealt = deal(pool, {}, createRng(1), { count: 10 });
    expect([...ids(dealt)].sort()).toEqual([...ids(pool)].sort());
  });

  it("deals exactly the count when the pool is larger", () => {
    expect(deal(cards("c", 40), {}, createRng(1), { count: 10 })).toHaveLength(10);
  });

  it("rounds a fractional count down", () => {
    expect(deal(cards("c", 40), {}, createRng(1), { count: 4.7 })).toHaveLength(4);
  });

  it("never repeats a card, even when the pool lists a card id twice", () => {
    const pool = [...cards("c", 6), ...cards("c", 6)];
    const dealt = deal(pool, {}, createRng(1), { count: 10 });
    expect(dealt).toHaveLength(6);
    expect(new Set(ids(dealt)).size).toBe(6);
  });

  it("only deals cards from the pool", () => {
    const pool = cards("c", 30);
    const known = new Set(ids(pool));
    for (const id of ids(deal(pool, {}, createRng(4), { count: 10 }))) {
      expect(known.has(id)).toBe(true);
    }
  });
});

describe("deal: determinism and purity", () => {
  const pool = cards("c", 40);
  const history: History = { c1: missed(5), c2: right(3), c3: right(9) };

  it("deals the same cards in the same order for the same seed", () => {
    expect(ids(deal(pool, history, createRng(77), { count: 10 }))).toEqual(
      ids(deal(pool, history, createRng(77), { count: 10 })),
    );
  });

  it("deals differently for different seeds", () => {
    const deals = new Set(
      Array.from({ length: 10 }, (_, seed) => ids(deal(pool, history, createRng(seed), { count: 10 })).join(",")),
    );
    expect(deals.size).toBeGreaterThan(1);
  });

  it("does not change the pool or the history", () => {
    const frozenPool = Object.freeze([...pool]);
    const frozenHistory = Object.freeze({ ...history });
    expect(() => deal(frozenPool, frozenHistory, createRng(1), { count: 10 })).not.toThrow();
    expect(frozenPool).toEqual(pool);
    expect(frozenHistory).toEqual(history);
  });

  it("ignores history entries for cards that are not in the pool", () => {
    const strangers: History = { gone1: missed(1), gone2: missed(2), gone3: missed(3), gone4: missed(4) };
    expect(deal(cards("c", 12), strangers, createRng(2), { count: 10 })).toHaveLength(10);
  });
});

describe("deal: priority", () => {
  it("prefers cards never seen over cards seen before", () => {
    const unseen = cards("u", 10);
    const seenBefore = cards("s", 10);
    const history: History = Object.fromEntries(seenBefore.map((c, i) => [c.id, right(i + 1)]));
    const dealt = deal([...seenBefore, ...unseen], history, createRng(3), { count: 10 });
    expect([...ids(dealt)].sort()).toEqual([...ids(unseen)].sort());
  });

  it("among cards seen before, prefers those seen longest ago", () => {
    const pool = cards("s", 15);
    const history: History = Object.fromEntries(pool.map((c, i) => [c.id, right(1000 + i)]));
    const dealt = deal(pool, history, createRng(3), { count: 10 });
    expect([...ids(dealt)].sort()).toEqual(["s1", "s10", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9"]);
  });

  it("puts cards answered wrong first, at most three per ten, oldest miss first", () => {
    const wrong = cards("m", 6);
    const unseen = cards("u", 10, (i) => i % 2 === 1);
    const history: History = Object.fromEntries(wrong.map((c, i) => [c.id, missed(i + 1)]));
    const dealt = deal([...unseen, ...wrong], history, createRng(8), { count: 10 });
    expect(withPrefix(dealt, "m").sort()).toEqual(["m1", "m2", "m3"]);
    expect(withPrefix(dealt, "u")).toHaveLength(7);
  });

  it("deals the missed cards it has when there are fewer than three", () => {
    const wrong = cards("m", 2);
    const unseen = cards("u", 20);
    const history: History = { m1: missed(1), m2: missed(2) };
    const dealt = deal([...unseen, ...wrong], history, createRng(8), { count: 10 });
    expect(withPrefix(dealt, "m").sort()).toEqual(["m1", "m2"]);
  });

  it("scales the missed cap with the count: six per twenty", () => {
    const wrong = cards("m", 10);
    const unseen = cards("u", 30);
    const history: History = Object.fromEntries(wrong.map((c, i) => [c.id, missed(i + 1)]));
    const dealt = deal([...unseen, ...wrong], history, createRng(8), { count: 20 });
    expect(withPrefix(dealt, "m")).toHaveLength(6);
  });

  it("deals missed cards beyond the cap only after every other card", () => {
    // m: missed long ago, u: never seen, s: answered right recently.
    const wrong = cards("m", 5);
    const unseen = cards("u", 5, (i) => i % 2 === 1);
    const recent = cards("s", 5);
    const history: History = {
      ...Object.fromEntries(wrong.map((c, i) => [c.id, missed(i + 1)])),
      ...Object.fromEntries(recent.map((c, i) => [c.id, right(100 + i)])),
    };
    const dealt = deal([...wrong, ...unseen, ...recent], history, createRng(5), { count: 10 });
    expect(withPrefix(dealt, "m").sort()).toEqual(["m1", "m2", "m3"]);
    expect(withPrefix(dealt, "u")).toHaveLength(5);
    expect(withPrefix(dealt, "s").sort()).toEqual(["s1", "s2"]);
  });

  it("still deals every card when almost the whole pool was missed (the cap is a priority, not a limit)", () => {
    const wrong = cards("m", 8);
    const unseen = cards("u", 2);
    const history: History = Object.fromEntries(wrong.map((c, i) => [c.id, missed(i + 1)]));
    expect(deal([...wrong, ...unseen], history, createRng(1), { count: 10 })).toHaveLength(10);
  });

  it("treats a history entry with seen = 0 as never seen", () => {
    const pool = [...cards("s", 10), card("z", true)];
    const history: History = {
      ...Object.fromEntries(cards("s", 10).map((c, i) => [c.id, right(i + 1)])),
      z: { seen: 0, lastCorrect: false, lastSeenAt: 0 },
    };
    expect(ids(deal(pool, history, createRng(1), { count: 10 }))).toContain("z");
  });
});
