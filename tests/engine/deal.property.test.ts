import { describe, expect, it } from "vitest";
import type { Card } from "@/src/content/schema";
import { DEAL, deal, type History } from "@/src/engine/deal";
import { createRng, type Rng } from "@/src/engine/rng";

// A realistic section: about 40 cards, a third of them in one or two of ten conflict groups,
// a mixed history. The generator is seeded, so a failure names a pool that can be rebuilt.
interface Scenario {
  pool: Card[];
  history: History;
}

const GROUPS = Array.from({ length: 10 }, (_, i) => `topic-${i}`);

function pick<T>(items: readonly T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)] as T;
}

function makeCard(id: string, answer: boolean, conflictGroups: string[]): Card {
  return {
    id,
    section: "TEC",
    text: { en: { statement: `Statement ${id}`, explanation: `Explanation ${id}` } },
    answer,
    source: { title: "AWS documentation", url: "https://docs.aws.amazon.com/" },
    difficulty: 2,
    appliesTo: "",
    conflictGroups,
  };
}

function scenario(seed: number): Scenario {
  const rng = createRng(seed);
  const size = 36 + Math.floor(rng() * 9); // 36 to 44 cards
  const pool: Card[] = [];
  const history: Record<string, { seen: number; lastCorrect: boolean; lastSeenAt: number }> = {};
  for (let i = 0; i < size; i++) {
    const id = `p${seed}-c${i}`;
    // The first 16 cards are free of groups and evenly split, so a deal that keeps every rule always exists.
    const answer = i < 16 ? i % 2 === 0 : rng() < 0.5;
    const roll = rng();
    const groups = i < 16 || roll < 0.6 ? [] : roll < 0.92 ? [pick(GROUPS, rng)] : [pick(GROUPS, rng), pick(GROUPS, rng)];
    pool.push(makeCard(id, answer, [...new Set(groups)]));
    const kind = rng();
    if (kind < 0.2) history[id] = { seen: 1 + Math.floor(rng() * 3), lastCorrect: false, lastSeenAt: Math.floor(rng() * 1e6) };
    else if (kind < 0.5) history[id] = { seen: 1 + Math.floor(rng() * 3), lastCorrect: true, lastSeenAt: Math.floor(rng() * 1e6) };
  }
  // Shuffle the pool so the free cards are not always first.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j] as Card, pool[i] as Card];
  }
  return { pool, history };
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

function sharedGroups(cards: readonly Card[]): string[] {
  const counts = new Map<string, number>();
  for (const c of cards) for (const g of new Set(c.conflictGroups)) counts.set(g, (counts.get(g) ?? 0) + 1);
  return [...counts].filter(([, n]) => n > 1).map(([g]) => g);
}

function expectEveryInvariant(dealt: readonly Card[], { pool, history }: Scenario, count: number): void {
  const poolIds = new Set(pool.map((c) => c.id));
  const trues = dealt.filter((c) => c.answer).length;
  const missed = dealt.filter((c) => history[c.id]?.lastCorrect === false).length;

  expect(dealt).toHaveLength(count);
  expect(new Set(dealt.map((c) => c.id)).size).toBe(count);
  expect(dealt.every((c) => poolIds.has(c.id))).toBe(true);
  expect(trues).toBeGreaterThanOrEqual(Math.floor((count * DEAL.minTrue) / 10));
  expect(trues).toBeLessThanOrEqual(Math.ceil((count * DEAL.maxTrue) / 10));
  expect(longestRun(dealt)).toBeLessThanOrEqual(DEAL.maxRun);
  expect(missed).toBeLessThanOrEqual(Math.floor((count * DEAL.missedPerTen) / 10));
}

describe("deal: every invariant over many seeds and generated pools", () => {
  it("keeps every rule for ten cards over 100 pools and 10 deal seeds each", () => {
    for (let poolSeed = 1; poolSeed <= 100; poolSeed++) {
      const s = scenario(poolSeed);
      for (let dealSeed = 0; dealSeed < 10; dealSeed++) {
        const dealt = deal(s.pool, s.history, createRng(dealSeed), { count: 10 });
        expectEveryInvariant(dealt, s, 10);
        expect(sharedGroups(dealt)).toEqual([]);
      }
    }
  });

  it("keeps clear of the groups of the last ten cards dealt (unbounded modes) over 100 pools", () => {
    for (let poolSeed = 1; poolSeed <= 100; poolSeed++) {
      const s = scenario(poolSeed);
      const rng = createRng(poolSeed * 31);
      const avoid = Array.from({ length: 10 }, (_, i) => makeCard(`earlier-${i}`, i % 2 === 0, [pick(GROUPS, rng)]));
      const dealt = deal(s.pool, s.history, createRng(poolSeed), { count: 10, avoid });
      expectEveryInvariant(dealt, s, 10);
      expect(sharedGroups(dealt)).toEqual([]);
      const avoided = new Set(avoid.flatMap((c) => c.conflictGroups));
      expect(dealt.flatMap((c) => c.conflictGroups).filter((g) => avoided.has(g))).toEqual([]);
    }
  });

  it("keeps the balance, the run limit and the missed cap for twenty cards over 100 pools", () => {
    for (let poolSeed = 1; poolSeed <= 100; poolSeed++) {
      const s = scenario(poolSeed);
      expectEveryInvariant(deal(s.pool, s.history, createRng(poolSeed), { count: 20 }), s, 20);
    }
  });

  it("deals the same round twice for the same seed, for every pool", () => {
    for (let poolSeed = 1; poolSeed <= 100; poolSeed++) {
      const s = scenario(poolSeed);
      const first = deal(s.pool, s.history, createRng(9), { count: 10 }).map((c) => c.id);
      const second = deal(s.pool, s.history, createRng(9), { count: 10 }).map((c) => c.id);
      expect(second).toEqual(first);
    }
  });
});
