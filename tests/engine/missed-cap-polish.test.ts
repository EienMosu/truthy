import { describe, expect, it } from "vitest";
import type { Card } from "@/src/content/schema";
import { DEAL, deal, dealChunk, type CardHistory, type History } from "@/src/engine/deal";
import { createRng, type Rng } from "@/src/engine/rng";
import { startRound } from "@/src/engine/round";

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

const missed = (lastSeenAt: number) => ({ seen: 1, lastCorrect: false, lastSeenAt });
const right = (lastSeenAt: number) => ({ seen: 1, lastCorrect: true, lastSeenAt });

function isMissed(history: History, c: Card): boolean {
  const entry = history[c.id];
  return entry !== undefined && entry.seen > 0 && !entry.lastCorrect;
}

function missedIn(history: History, dealt: readonly Card[]): number {
  return dealt.filter((c) => isMissed(history, c)).length;
}

function repeatedGroups(dealt: readonly Card[]): string[] {
  const seen = new Set<string>();
  const repeated: string[] = [];
  for (const c of dealt) {
    for (const g of c.conflictGroups) {
      if (seen.has(g)) repeated.push(g);
      seen.add(g);
    }
  }
  return repeated;
}

// The fewest missed cards a deal of `size` can hold while it keeps every rule (no group twice, four to six True
// per ten), or null when no deal keeps every rule. Exact for cards with at most one group each: the pool falls
// into bins (a group, or a card without one) that give at most one card each, and a table over (cards, True,
// missed) tells which deals can be made.
function fewestMissed(pool: readonly Card[], history: History, size: number): number | null {
  const minTrue = Math.floor((size * DEAL.minTrue) / 10);
  const maxTrue = Math.ceil((size * DEAL.maxTrue) / 10);
  const bins = new Map<string, Card[]>();
  for (const c of pool) {
    if (c.conflictGroups.length > 1) throw new Error("fewestMissed handles one group per card");
    const key = c.conflictGroups[0] ?? `card ${c.id}`;
    bins.set(key, [...(bins.get(key) ?? []), c]);
  }
  let reachable = new Set(["0,0,0"]);
  for (const bin of bins.values()) {
    const kinds = new Set(bin.map((c) => `${c.answer ? 1 : 0},${isMissed(history, c) ? 1 : 0}`));
    const next = new Set(reachable);
    for (const state of reachable) {
      const [n, t, m] = state.split(",").map(Number) as [number, number, number];
      if (n === size) continue;
      for (const kind of kinds) {
        const [dt, dm] = kind.split(",").map(Number) as [number, number];
        next.add(`${n + 1},${t + dt},${m + dm}`);
      }
    }
    reachable = next;
  }
  let fewest: number | null = null;
  for (const state of reachable) {
    const [n, t, m] = state.split(",").map(Number) as [number, number, number];
    if (n === size && t >= minTrue && t <= maxTrue && (fewest === null || m < fewest)) fewest = m;
  }
  return fewest;
}

// Spec section 6: cards last answered wrong, at most three per ten; the rules give way only when they cannot all
// be met.
describe("deal: at most three missed cards per ten whenever a deal can keep it", () => {
  it("swaps an old miss that cannot go for a newer one rather than deal a fourth", () => {
    // M1 (the oldest miss) shares a group with N1. M3 to M5 are False, N4 to N7 are False too.
    // M2, M3, M4 and N1 to N7 keep every rule with three missed cards.
    const pool = [
      card("M1", true, ["g"]), card("M2", true), card("M3", false), card("M4", false), card("M5", false),
      card("N1", true, ["g"]), card("N2", true), card("N3", true), card("N4", false), card("N5", false), card("N6", false), card("N7", false),
    ];
    const history: History = {
      ...Object.fromEntries(["M1", "M2", "M3", "M4", "M5"].map((id, i) => [id, missed(i + 1)])),
      ...Object.fromEntries(["N1", "N2", "N3", "N4", "N5", "N6", "N7"].map((id, i) => [id, right(100 + i)])),
    };
    expect(fewestMissed(pool, history, 10)).toBe(3);
    for (let seed = 0; seed < 50; seed++) {
      const round = startRound({ mode: "classic", route: { deckId: "x", sectionId: "SEC" }, pool, history, seed });
      expect(round.cards, `seed ${seed}`).toHaveLength(10);
      expect(missedIn(history, round.cards), `seed ${seed}`).toBe(3);
      expect(repeatedGroups(round.cards), `seed ${seed}`).toEqual([]);
    }
  });

  // A section-sized pool with one group for some cards and a history where most cards were missed: the shape in
  // which the deal used to hold four to six missed cards although three would do.
  function scenario(rng: Rng): { pool: Card[]; history: History } {
    const size = 11 + Math.floor(rng() * 40);
    const pool = Array.from({ length: size }, (_, i) => {
      const group = rng() < 0.35 ? [`g${Math.floor(rng() * Math.max(2, size / 4))}`] : [];
      return card(`c${i + 1}`, rng() < 0.5, group);
    });
    const wrongShare = 0.3 + rng() * 0.6;
    const history: Record<string, CardHistory> = {};
    pool.forEach((c, i) => {
      const draw = rng();
      if (draw < wrongShare) history[c.id] = missed(1 + i);
      else if (draw < wrongShare + 0.2) history[c.id] = right(1 + i);
    });
    return { pool, history };
  }

  it("holds more than the cap only when no deal within it keeps every rule (500 random pools)", () => {
    const rng = createRng(60);
    let overTheCap = 0;
    for (let n = 0; n < 500; n++) {
      const { pool, history } = scenario(rng);
      const seed = Math.floor(rng() * 2 ** 32);
      for (const dealt of [deal(pool, history, createRng(seed), { count: 10 }), dealChunk(pool, history, createRng(seed), [])]) {
        const held = missedIn(history, dealt);
        const cap = Math.floor((dealt.length * DEAL.missedPerTen) / 10);
        if (held <= cap) continue;
        overTheCap++;
        const fewest = fewestMissed(pool, history, dealt.length);
        if (fewest === null) continue; // no deal keeps every rule: the fallback may relax anything
        expect(fewest, `pool ${n}: ${held} missed dealt`).toBeGreaterThan(cap);
        expect(held, `pool ${n}`).toBe(fewest);
      }
    }
    // The pools must reach the case at all, or the test says nothing.
    expect(overTheCap).toBeGreaterThan(20);
  });
});
