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

function trueCount(dealt: readonly Card[]): number {
  return dealt.filter((c) => c.answer).length;
}

// The conflict groups that appear on more than one of the given cards.
function repeatedGroups(dealt: readonly Card[]): string[] {
  const counts = new Map<string, number>();
  for (const c of dealt) for (const g of c.conflictGroups) counts.set(g, (counts.get(g) ?? 0) + 1);
  return [...counts].filter(([, n]) => n > 1).map(([g]) => g);
}

function inGroup(dealt: readonly Card[], group: string): number {
  return dealt.filter((c) => c.conflictGroups.includes(group)).length;
}

describe("deal: conflict groups", () => {
  // Five groups of three cards and five free cards: exactly ten conflict-free cards are possible.
  const grouped = Array.from({ length: 15 }, (_, i) => card(`g${i + 1}`, i % 2 === 0, [`group-${i % 5}`]));
  const free = cards("f", 5, (i) => i % 2 === 1);
  const pool = [...grouped, ...free];

  it("never deals two cards that share a conflict group when ten conflict-free cards exist", () => {
    for (let seed = 0; seed < 50; seed++) {
      const dealt = deal(pool, {}, createRng(seed), { count: 10 });
      expect(dealt).toHaveLength(10);
      expect(repeatedGroups(dealt)).toEqual([]);
    }
  });

  it("blocks every group of a card that belongs to several", () => {
    const pool2 = [card("multi", true, ["a", "b"]), card("a2", true, ["a"]), card("b2", false, ["b"]), ...cards("f", 12)];
    for (let seed = 0; seed < 30; seed++) {
      const dealt = ids(deal(pool2, {}, createRng(seed), { count: 10 }));
      if (dealt.includes("multi")) {
        expect(dealt).not.toContain("a2");
        expect(dealt).not.toContain("b2");
      }
    }
  });

  it("skips a missed card that conflicts with an older missed card, and fills from lower priority instead", () => {
    const wrongA = card("mA", true, ["shared"]);
    const wrongB = card("mB", false, ["shared"]);
    const older = cards("s", 12);
    const history: History = {
      mA: missed(1),
      mB: missed(2),
      ...Object.fromEntries(older.map((c, i) => [c.id, right(100 + i)])),
    };
    const dealt = ids(deal([wrongB, wrongA, ...older], history, createRng(4), { count: 10 }));
    expect(dealt).toHaveLength(10);
    expect(dealt).toContain("mA");
    expect(dealt).not.toContain("mB");
  });

  it("keeps clear of the groups of the avoid cards", () => {
    const avoid = [card("before", true, ["shared"])];
    const pool2 = [card("x1", true, ["shared"]), card("x2", false, ["shared"]), ...cards("f", 12)];
    for (let seed = 0; seed < 30; seed++) {
      const dealt = ids(deal(pool2, {}, createRng(seed), { count: 10, avoid }));
      expect(dealt).not.toContain("x1");
      expect(dealt).not.toContain("x2");
    }
  });

  it("does not block anything for an avoid card without groups", () => {
    const avoid = [card("before", true)];
    expect(deal(cards("f", 10), {}, createRng(1), { count: 10, avoid })).toHaveLength(10);
  });
});

describe("deal: answer balance", () => {
  it("deals four to six True per ten from a pool that is mostly True", () => {
    const pool = cards("c", 20, (i) => i < 14);
    for (let seed = 0; seed < 50; seed++) {
      const t = trueCount(deal(pool, {}, createRng(seed), { count: 10 }));
      expect(t).toBeGreaterThanOrEqual(4);
      expect(t).toBeLessThanOrEqual(6);
    }
  });

  it("deals four to six True per ten from a pool that is mostly False", () => {
    const pool = cards("c", 20, (i) => i < 6);
    for (let seed = 0; seed < 50; seed++) {
      const t = trueCount(deal(pool, {}, createRng(seed), { count: 10 }));
      expect(t).toBeGreaterThanOrEqual(4);
      expect(t).toBeLessThanOrEqual(6);
    }
  });

  it("gives up priority before balance: older False cards replace unseen True ones", () => {
    const unseenTrue = cards("u", 10, () => true);
    const seenFalse = cards("s", 10, () => false);
    const history: History = Object.fromEntries(seenFalse.map((c, i) => [c.id, right(i + 1)]));
    const dealt = deal([...unseenTrue, ...seenFalse], history, createRng(6), { count: 10 });
    expect(trueCount(dealt)).toBe(6);
    expect(withPrefix(dealt, "s").sort()).toEqual(["s1", "s2", "s3", "s4"]);
  });

  it.each([
    [5, 2, 3],
    [1, 0, 1],
    [3, 1, 2],
    [20, 8, 12],
  ])("scales the balance: %i cards have between %i and %i True", (count, min, max) => {
    const pool = cards("c", 40, (i) => i < 30);
    for (let seed = 0; seed < 30; seed++) {
      const t = trueCount(deal(pool, {}, createRng(seed), { count }));
      expect(t).toBeGreaterThanOrEqual(min);
      expect(t).toBeLessThanOrEqual(max);
    }
  });
});

describe("deal: relaxing the constraints when the pool is too small", () => {
  it("relaxes conflict groups when every card shares one group, and keeps the balance", () => {
    const pool = Array.from({ length: 12 }, (_, i) => card(`c${i + 1}`, i % 2 === 0, ["everything"]));
    const dealt = deal(pool, {}, createRng(2), { count: 10 });
    expect(dealt).toHaveLength(10);
    expect(trueCount(dealt)).toBeGreaterThanOrEqual(4);
    expect(trueCount(dealt)).toBeLessThanOrEqual(6);
  });

  it("relaxes conflict groups before answer balance", () => {
    // Eight free True cards, two free False cards and four False cards in one group.
    // Keeping the groups would need seven True; keeping the balance needs a second card of the group.
    const pool = [
      ...cards("t", 8, () => true),
      ...cards("f", 2, () => false),
      ...Array.from({ length: 4 }, (_, i) => card(`g${i + 1}`, false, ["clash"])),
    ];
    for (let seed = 0; seed < 30; seed++) {
      const dealt = deal(pool, {}, createRng(seed), { count: 10 });
      expect(dealt).toHaveLength(10);
      expect(trueCount(dealt)).toBe(6);
      expect(inGroup(dealt, "clash")).toBe(2);
    }
  });

  it("lets missed cards over the cap in (recency) before giving up the balance", () => {
    // Missed: m1 to m3 True (oldest), m4 and m5 False. Never seen: eight True, two False.
    // Within the cap there are only two False cards, so the balance needs m4 and m5.
    const wrong = cards("m", 5, (i) => i < 3);
    const unseen = cards("u", 10, (i) => i < 8);
    const history: History = Object.fromEntries(wrong.map((c, i) => [c.id, missed(i + 1)]));
    const dealt = deal([...wrong, ...unseen], history, createRng(3), { count: 10 });
    expect(trueCount(dealt)).toBe(6);
    expect(withPrefix(dealt, "m").sort()).toEqual(["m1", "m2", "m3", "m4", "m5"]);
  });

  it("relaxes the avoid groups too when there is nothing else", () => {
    const avoid = [card("before", true, ["shared"])];
    const pool = Array.from({ length: 10 }, (_, i) => card(`c${i + 1}`, i % 2 === 0, ["shared"]));
    expect(deal(pool, {}, createRng(1), { count: 10, avoid })).toHaveLength(10);
  });

  it("relaxes the balance last: a pool of only True cards is dealt in full", () => {
    const dealt = deal(cards("c", 10, () => true), {}, createRng(1), { count: 10 });
    expect(dealt).toHaveLength(10);
    expect(trueCount(dealt)).toBe(10);
  });

  it("relaxes the balance last: a pool of only False cards is dealt in full", () => {
    const dealt = deal(cards("c", 12, () => false), {}, createRng(1), { count: 10 });
    expect(dealt).toHaveLength(10);
    expect(trueCount(dealt)).toBe(0);
  });

  it("uses every False card there is when there are too few: 9 True and 3 False give 7 and 3", () => {
    const dealt = deal(cards("c", 12, (i) => i < 9), {}, createRng(1), { count: 10 });
    expect(dealt).toHaveLength(10);
    expect(trueCount(dealt)).toBe(7);
  });
});

function longestRun(dealt: readonly Card[]): number {
  let longest = 0;
  let run = 0;
  dealt.forEach((c, i) => {
    run = i > 0 && dealt[i - 1]?.answer === c.answer ? run + 1 : 1;
    longest = Math.max(longest, run);
  });
  return longest;
}

describe("deal: order", () => {
  it("never puts more than three equal answers in a row (200 seeds)", () => {
    const pool = cards("c", 20);
    for (let seed = 0; seed < 200; seed++) {
      expect(longestRun(deal(pool, {}, createRng(seed), { count: 10 }))).toBeLessThanOrEqual(DEAL.maxRun);
    }
  });

  it("keeps runs of at most three when the balance is at its edge (6 True, 4 False)", () => {
    const pool = [...cards("t", 6, () => true), ...cards("f", 4, () => false)];
    for (let seed = 0; seed < 200; seed++) {
      expect(longestRun(deal(pool, {}, createRng(seed), { count: 10 }))).toBeLessThanOrEqual(DEAL.maxRun);
    }
  });

  it("keeps runs of at most three even with 7 True and 3 False after relaxing the balance", () => {
    const pool = cards("c", 10, (i) => i < 7);
    for (let seed = 0; seed < 200; seed++) {
      expect(longestRun(deal(pool, {}, createRng(seed), { count: 10 }))).toBeLessThanOrEqual(DEAL.maxRun);
    }
  });

  it("makes the longest run as short as it can be when three is impossible: 9 True and 1 False give at most 5", () => {
    const pool = cards("c", 10, (i) => i < 9);
    for (let seed = 0; seed < 100; seed++) {
      expect(longestRun(deal(pool, {}, createRng(seed), { count: 10 }))).toBeLessThanOrEqual(5);
    }
  });

  it("keeps runs of at most three over a long deal of twenty", () => {
    const pool = cards("c", 40);
    for (let seed = 0; seed < 100; seed++) {
      expect(longestRun(deal(pool, {}, createRng(seed), { count: 20 }))).toBeLessThanOrEqual(DEAL.maxRun);
    }
  });

  it("shuffles: missed cards are not always dealt first", () => {
    const wrong = cards("m", 3);
    const unseen = cards("u", 20);
    const history: History = { m1: missed(1), m2: missed(2), m3: missed(3) };
    const firstIds = new Set(
      Array.from({ length: 30 }, (_, seed) => deal([...wrong, ...unseen], history, createRng(seed), { count: 10 })[0]?.id),
    );
    expect([...firstIds].some((id) => id?.startsWith("u"))).toBe(true);
  });

  it("varies the answer pattern between seeds", () => {
    const pool = cards("c", 20);
    const patterns = new Set(
      Array.from({ length: 30 }, (_, seed) =>
        deal(pool, {}, createRng(seed), { count: 10 })
          .map((c) => (c.answer ? "T" : "F"))
          .join(""),
      ),
    );
    expect(patterns.size).toBeGreaterThan(10);
  });
});

describe("deal: review focus", () => {
  it("deals 10 of a 12-card section whose four cards share a group with exactly two of them (as few as possible)", () => {
    // The shape of the real Next.js sections: 11 or 12 cards, so some conflicts cannot be avoided.
    const pool = [
      ...cards("f", 8),
      ...Array.from({ length: 4 }, (_, i) => card(`g${i + 1}`, i % 2 === 0, ["same-topic"])),
    ];
    for (let seed = 0; seed < 50; seed++) {
      const dealt = deal(pool, {}, createRng(seed), { count: 10 });
      expect(dealt).toHaveLength(10);
      expect(inGroup(dealt, "same-topic")).toBe(2);
      expect(longestRun(dealt)).toBeLessThanOrEqual(DEAL.maxRun);
    }
  });

  it("still deals a full, valid round from a history with corrupt numbers", () => {
    const pool = cards("c", 20);
    const history: History = {
      c1: { seen: 1, lastCorrect: false, lastSeenAt: Number.NaN },
      c2: { seen: -4, lastCorrect: false, lastSeenAt: 5 },
      c3: { seen: 1, lastCorrect: true, lastSeenAt: Number.POSITIVE_INFINITY },
      c4: { seen: Number.NaN, lastCorrect: true, lastSeenAt: -1 },
    };
    const first = deal(pool, history, createRng(12), { count: 10 });
    expect(first).toHaveLength(10);
    expect(new Set(ids(first)).size).toBe(10);
    expect(trueCount(first)).toBeGreaterThanOrEqual(4);
    expect(trueCount(first)).toBeLessThanOrEqual(6);
    expect(longestRun(first)).toBeLessThanOrEqual(DEAL.maxRun);
    expect(ids(deal(pool, history, createRng(12), { count: 10 }))).toEqual(ids(first));
  });
});
