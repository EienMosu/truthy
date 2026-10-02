import { describe, expect, it } from "vitest";
import type { Card } from "@/src/content/schema";
import { CHUNK, DEAL, deal, dealChunk, type History } from "@/src/engine/deal";
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

function cards(prefix: string, n: number, answer: (i: number) => boolean = (i) => i % 2 === 0): Card[] {
  return Array.from({ length: n }, (_, i) => card(`${prefix}${i + 1}`, answer(i)));
}

// A route like the real sections of 45 to 47 cards: 24 True and 23 False cards, with conflict groups of
// four, three, two and two cards (the sizes of the largest groups of CLF "Security and compliance").
function sectionLikePool(): Card[] {
  const groups: Record<number, string> = { 0: "a", 9: "a", 18: "a", 27: "a", 3: "b", 12: "b", 21: "b", 5: "c", 30: "c", 7: "d", 40: "d" };
  return Array.from({ length: 47 }, (_, i) => card(`s${i + 1}`, i % 2 === 0, groups[i] === undefined ? [] : [`group-${groups[i]}`]));
}

function ids(dealt: readonly Card[]): string[] {
  return dealt.map((c) => c.id);
}

// Deals chunk after chunk, as a round does, until at least `length` cards are dealt.
function dealRound(pool: readonly Card[], history: History, seed: number, length: number): { dealt: Card[]; chunks: Card[][] } {
  const dealt: Card[] = [];
  const chunks: Card[][] = [];
  for (let k = 0; dealt.length < length; k++) {
    const chunk = dealChunk(pool, history, createRng(seed + k), dealt);
    if (chunk.length === 0) throw new Error("an empty chunk");
    chunks.push(chunk);
    dealt.push(...chunk);
  }
  return { dealt, chunks };
}

function longestRun(dealt: readonly Card[]): number {
  let longest = 0;
  let run = 0;
  dealt.forEach((c, i) => {
    run = i > 0 && dealt[i - 1]?.answer === c.answer ? run + 1 : 1;
    longest = Math.max(longest, run);
  });
  return longest;
}

// The smallest distance between two showings of the same card.
function smallestGap(dealt: readonly Card[]): number {
  const last = new Map<string, number>();
  let smallest = Infinity;
  dealt.forEach((c, i) => {
    const before = last.get(c.id);
    if (before !== undefined) smallest = Math.min(smallest, i - before);
    last.set(c.id, i);
  });
  return smallest;
}

// The conflict groups a chunk shares with the ten cards dealt before it, or repeats inside itself.
function conflictsOf(chunks: readonly Card[][]): string[] {
  const found: string[] = [];
  const dealt: Card[] = [];
  for (const chunk of chunks) {
    const used = new Set(dealt.slice(-CHUNK).flatMap((c) => c.conflictGroups));
    for (const c of chunk) {
      for (const group of c.conflictGroups) {
        if (used.has(group)) found.push(`${c.id} repeats ${group}`);
        used.add(group);
      }
    }
    dealt.push(...chunk);
  }
  return found;
}

function trueCount(chunk: readonly Card[]): number {
  return chunk.filter((c) => c.answer).length;
}

describe("deal: the run limit across a join", () => {
  it("does not continue a run of three from the cards before", () => {
    for (let seed = 0; seed < 200; seed++) {
      const dealt = deal(cards("c", 40), {}, createRng(seed), { count: 10, before: [false, true, true, true] });
      expect(dealt[0]?.answer).toBe(false);
    }
  });

  it("counts the cards before into the run", () => {
    for (let seed = 0; seed < 200; seed++) {
      const dealt = deal(cards("c", 40), {}, createRng(seed), { count: 10, before: [true, false, false] });
      const start = dealt.findIndex((c) => c.answer);
      expect(start).toBeLessThanOrEqual(1);
    }
  });

  it("puts the one card of the other answer first when the cards before end a run of three", () => {
    const threeTrue = [...cards("t", 3, () => true), card("f1", false)];
    for (let seed = 0; seed < 50; seed++) {
      const dealt = deal(threeTrue, {}, createRng(seed), { count: 4, before: [true, true, true] });
      expect(dealt[0]?.id).toBe("f1");
    }
  });

  it("deals exactly as before when nothing came before", () => {
    for (let seed = 0; seed < 50; seed++) {
      expect(ids(deal(cards("c", 40), {}, createRng(seed), { count: 10, before: [] }))).toEqual(
        ids(deal(cards("c", 40), {}, createRng(seed), { count: 10 })),
      );
    }
  });

  it("still deals when the run cannot be broken", () => {
    const allTrue = cards("t", 5, () => true);
    expect(deal(allTrue, {}, createRng(1), { count: 5, before: [true, true, true] })).toHaveLength(5);
  });
});

// Spec section 6: the unshown cards come first; recency gives way before a conflict group repeats (a card the round
// has shown comes back in place of an unshown card that would repeat a group of the last ten).
describe("dealChunk: the order in which the rules give way", () => {
  function sharedGroups(dealt: readonly Card[]): string[] {
    const seen = new Set<string>();
    const shared: string[] = [];
    for (const c of dealt) {
      for (const g of c.conflictGroups) {
        if (seen.has(g)) shared.push(g);
        seen.add(g);
      }
    }
    return shared;
  }

  it("brings shown cards back rather than repeat a group inside the chunk", () => {
    // u1 has not been shown and belongs to groups A and B. k1 (A) and k2 (B) were shown longest ago. Ten cards that
    // keep every rule need u1 left out, so that k1 and k2 can both come back.
    const ks = Array.from({ length: 10 }, (_, i) => card(`k${i + 1}`, i % 2 === 0, i === 0 ? ["A"] : i === 1 ? ["B"] : []));
    const rs = Array.from({ length: 10 }, (_, i) => card(`r${i + 1}`, i % 2 === 0));
    const pool = [card("u1", true, ["A", "B"]), ...ks, ...rs];
    for (let seed = 0; seed < 20; seed++) {
      const chunk = dealChunk(pool, {}, createRng(seed), [...ks, ...rs]);
      expect(chunk, `seed ${seed}`).toHaveLength(10);
      expect(sharedGroups(chunk), `seed ${seed}`).toEqual([]);
      expect(ids(chunk).sort(), `seed ${seed}`).toEqual(ids(ks).sort());
    }
  });

  it("brings a card back rather than deal an unshown card that repeats a group of the last ten, when the greedy pick would", () => {
    // c21 (True, not shown) shares group X with c1 (False, shown). c2 to c10 hold six True and three False, so only
    // c1 to c10 keep every rule: c21 has to be left out and c1 has to come back.
    const shown = [
      card("c1", false, ["X"]),
      ...Array.from({ length: 9 }, (_, i) => card(`c${i + 2}`, i % 3 !== 0)),
      ...Array.from({ length: 10 }, (_, i) => card(`c${i + 11}`, i % 2 === 0)),
    ];
    const unshown = card("c21", true, ["X"]);
    for (let seed = 0; seed < 50; seed++) {
      const chunk = dealChunk([...shown, unshown], {}, createRng(seed), shown);
      expect(ids(chunk).sort(), `seed ${seed}`).toEqual(ids(shown.slice(0, 10)).sort());
    }
  });

  it("deals every unshown card, the missed one over the cap too, before any card comes back", () => {
    // Unshown: m1 to m4 answered wrong (m4 is over the cap of three) and u1 to u6 never seen: five True, five False.
    // Shown: k1 (longest ago) to k11. The ten unshown cards keep every rule, so no card comes back.
    const wrong = [card("m1", true), card("m2", false), card("m3", true), card("m4", false)];
    const unseen = Array.from({ length: 6 }, (_, i) => card(`u${i + 1}`, i % 2 === 0));
    const shown = Array.from({ length: 11 }, (_, i) => card(`k${i + 1}`, i % 2 === 1));
    const history: History = Object.fromEntries(wrong.map((c, i) => [c.id, { seen: 1, lastCorrect: false, lastSeenAt: i + 1 }]));
    for (let seed = 0; seed < 20; seed++) {
      const chunk = dealChunk([...wrong, ...unseen, ...shown], history, createRng(seed), shown);
      expect(ids(chunk).sort(), `seed ${seed}`).toEqual(ids([...wrong, ...unseen]).sort());
    }
  });
});

describe("dealChunk", () => {
  it("is ten", () => {
    expect(CHUNK).toBe(10);
  });

  it("deals the first chunk exactly as deal does for ten cards", () => {
    const pool = cards("c", 40);
    for (let seed = 0; seed < 50; seed++) {
      expect(ids(dealChunk(pool, {}, createRng(seed), []))).toEqual(ids(deal(pool, {}, createRng(seed), { count: 10 })));
    }
  });

  it("deals ten cards whenever the route has twenty or more", () => {
    for (let size = 20; size <= 45; size++) {
      const { chunks } = dealRound(cards("c", size), {}, size, 3 * size);
      expect(chunks.every((chunk) => chunk.length === CHUNK)).toBe(true);
    }
  });

  it("deals only cards it has not shown while ten of them are left", () => {
    for (const size of [20, 34, 47]) {
      const full = Math.floor(size / CHUNK) * CHUNK;
      for (let seed = 0; seed < 20; seed++) {
        const { dealt } = dealRound(cards("c", size), {}, seed, size);
        expect(new Set(ids(dealt.slice(0, full))).size).toBe(full);
      }
    }
  });

  it("fills the chunk that uses up the route with the cards shown longest ago", () => {
    for (let seed = 0; seed < 20; seed++) {
      const { dealt } = dealRound(cards("c", 47), {}, seed, 50);
      const last = dealt.slice(40, 50);
      expect(new Set(ids(dealt)).size).toBe(47);
      const back = last.filter((c) => ids(dealt.slice(0, 40)).includes(c.id));
      expect(back).toHaveLength(3);
      // Shown longest ago: they come from the first chunk of the round.
      expect(back.every((c) => ids(dealt.slice(0, 10)).includes(c.id))).toBe(true);
    }
  });

  it("deals every card of a route of fewer than twenty cards before any card comes back", () => {
    for (const size of [11, 12, 15, 19]) {
      for (let seed = 0; seed < 20; seed++) {
        const { dealt, chunks } = dealRound(cards("c", size), {}, seed, size);
        expect(new Set(ids(dealt.slice(0, size))).size).toBe(size);
        expect(chunks.map((chunk) => chunk.length).slice(0, 2)).toEqual([10, size - 10]);
      }
    }
  });

  it("never deals an empty chunk and never more than ten, for every route size from 1 to 25", () => {
    for (let size = 1; size <= 25; size++) {
      const { chunks } = dealRound(cards("c", size), {}, size, 60);
      for (const chunk of chunks) {
        expect(chunk.length).toBeGreaterThanOrEqual(1);
        expect(chunk.length).toBeLessThanOrEqual(CHUNK);
      }
    }
  });

  it("brings a card back only after min(10, size - 1) other cards", () => {
    for (let size = 2; size <= 25; size++) {
      for (let seed = 0; seed < 10; seed++) {
        const { dealt } = dealRound(cards("c", size), {}, seed, 80);
        expect(smallestGap(dealt)).toBeGreaterThanOrEqual(Math.min(CHUNK, size - 1) + 1);
      }
    }
  });

  it("goes on with the cards shown longest ago: an 11 card route repeats in its first order", () => {
    const { dealt } = dealRound(cards("c", 11), {}, 5, 33);
    expect(ids(dealt.slice(11, 22))).toEqual(ids(dealt.slice(0, 11)));
    expect(ids(dealt.slice(22, 33))).toEqual(ids(dealt.slice(0, 11)));
  });

  it("a one card route deals that card again and again", () => {
    const { dealt } = dealRound(cards("c", 1), {}, 1, 4);
    expect(ids(dealt)).toEqual(["c1", "c1", "c1", "c1"]);
  });

  it("keeps the run limit and the balance of every chunk, through the route and after it", () => {
    for (const size of [20, 34, 60]) {
      for (let seed = 0; seed < 50; seed++) {
        const { dealt, chunks } = dealRound(cards("c", size), {}, seed, 150);
        expect(longestRun(dealt)).toBeLessThanOrEqual(DEAL.maxRun);
        for (const chunk of chunks) {
          expect(trueCount(chunk)).toBeGreaterThanOrEqual(DEAL.minTrue);
          expect(trueCount(chunk)).toBeLessThanOrEqual(DEAL.maxTrue);
        }
      }
    }
  });

  it("keeps a chunk clear of the conflict groups of the ten cards before it", () => {
    // 50 groups of two cards each, a True and a False one.
    const pool = Array.from({ length: 100 }, (_, i) => card(`g${i + 1}`, i % 2 === 0, [`group-${Math.floor(i / 2)}`]));
    for (let seed = 0; seed < 50; seed++) {
      const { chunks } = dealRound(pool, {}, seed, 250);
      expect(conflictsOf(chunks)).toEqual([]);
    }
  });

  it("brings a card back rather than deal a card whose conflict group is among the last ten", () => {
    // 21 cards. The round has shown c1 to c20; c20 and the last unshown card, c21, share a group.
    const pool = cards("c", 21).map((c) => (c.id === "c20" || c.id === "c21" ? { ...c, conflictGroups: ["pair"] } : c));
    const dealt = pool.slice(0, 20);
    const chunk = dealChunk(pool, {}, createRng(3), dealt);
    expect(ids(chunk).sort()).toEqual(ids(pool.slice(0, 10)).sort());
    // One chunk later c20 has left the last ten, and c21 is the first card in line.
    expect(ids(dealChunk(pool, {}, createRng(4), [...dealt, ...chunk]))).toContain("c21");
  });

  it("on a route like a real section keeps every rule for 150 cards and shows every card", () => {
    const pool = sectionLikePool();
    for (let seed = 0; seed < 30; seed++) {
      const { dealt, chunks } = dealRound(pool, {}, seed, 150);
      expect(longestRun(dealt)).toBeLessThanOrEqual(DEAL.maxRun);
      expect(conflictsOf(chunks)).toEqual([]);
      for (const chunk of chunks) {
        expect(chunk).toHaveLength(CHUNK);
        expect(trueCount(chunk)).toBeGreaterThanOrEqual(DEAL.minTrue);
        expect(trueCount(chunk)).toBeLessThanOrEqual(DEAL.maxTrue);
      }
      expect(smallestGap(dealt)).toBeGreaterThanOrEqual(CHUNK + 1);
      expect(new Set(ids(dealt)).size).toBe(47);
    }
  });

  it("on a route of 11 or 12 cards keeps the gap and lets the run limit give way where the route wraps", () => {
    for (const size of [11, 12]) {
      let longest = 0;
      for (let seed = 0; seed < 100; seed++) {
        const { dealt } = dealRound(cards("c", size), {}, seed, 60);
        expect(smallestGap(dealt)).toBe(CHUNK + 1);
        longest = Math.max(longest, longestRun(dealt));
      }
      // No card may come back yet except the one or two whose turn it is, so their answers cannot be chosen.
      expect(longest).toBeGreaterThan(DEAL.maxRun);
      expect(longest).toBeLessThanOrEqual(2 * DEAL.maxRun);
    }
  });

  it("uses the stored history for the cards it has not shown: missed cards first, at most three per chunk", () => {
    const pool = cards("c", 30);
    const history: History = Object.fromEntries(pool.slice(0, 8).map((c, i) => [c.id, { seen: 1, lastCorrect: false, lastSeenAt: i + 1 }]));
    const { chunks } = dealRound(pool, history, 2, 30);
    const missedIn = (chunk: readonly Card[]) => chunk.filter((c) => history[c.id]?.lastCorrect === false).length;
    expect(chunks.map(missedIn)).toEqual([3, 3, 2]);
  });

  it("is deterministic and leaves its inputs alone", () => {
    const pool = Object.freeze(cards("c", 25)) as readonly Card[];
    const dealt = Object.freeze(dealChunk(pool, {}, createRng(1), [])) as readonly Card[];
    const first = ids(dealChunk(pool, {}, createRng(2), dealt));
    expect(ids(dealChunk(pool, {}, createRng(2), dealt))).toEqual(first);
  });
});
