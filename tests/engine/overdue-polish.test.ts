import { describe, expect, it } from "vitest";
import type { Card } from "@/src/content/schema";
import { CHUNK, DEAL, dealChunk } from "@/src/engine/deal";
import { createRng } from "@/src/engine/rng";
import { chunkSeed } from "@/src/engine/round";

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

// Deals chunk after chunk with the seeds a round uses, until at least `length` cards are dealt.
function dealRound(pool: readonly Card[], seed: number, length: number): Card[] {
  const dealt: Card[] = [];
  for (let k = 0; dealt.length < length; k++) dealt.push(...dealChunk(pool, {}, createRng(chunkSeed(seed, k)), dealt));
  return dealt;
}

// Where each card of the pool is first dealt; Infinity for a card never dealt.
function firstShown(pool: readonly Card[], dealt: readonly Card[]): number[] {
  return pool.map((c) => {
    const at = dealt.findIndex((d) => d.id === c.id);
    return at === -1 ? Infinity : at;
  });
}

function sharesGroup(a: Card, b: Card): boolean {
  return a.conflictGroups.some((group) => b.conflictGroups.includes(group));
}

// Plan decision 10: the last unshown card of a route may come late, never not at all.
describe("dealChunk: an unshown card is shown, late at worst", () => {
  // Alternating answers, and each of the first size - 20 cards shares a group with the card eleven places later
  // (k1 with k12 in a route of 21; k1 with k12 and k2 with k13 in a route of 22). Without the overdue rule a round
  // could settle into two chunks that take turns for ever: one keeps k1 out because k12 is among the ten cards
  // before it, the other because taking k1 for k12 tips the balance. Without the rule, a card was still unshown
  // after 100 cards in 41 (21 cards), 21 (22) and 27 (23) of the 200 rounds below.
  function route(size: number): Card[] {
    const pairs = size - 2 * CHUNK;
    return Array.from({ length: size }, (_, i) => {
      const pair = i < pairs ? i : i - (CHUNK + 1);
      return card(`k${i + 1}`, i % 2 === 0, pair >= 0 && pair < pairs ? [`pair${pair + 1}`] : []);
    });
  }

  it.each([21, 22, 23])("shows every card of a %i card route within 100 cards (seeds 0 to 199)", (size) => {
    const pool = route(size);
    for (let seed = 0; seed < 200; seed++) {
      const dealt = dealRound(pool, seed, 300);
      expect(Math.max(...firstShown(pool, dealt)), `seed ${seed}`).toBeLessThan(100);
    }
  });

  it("takes the overdue card in even where the fallback alone would leave it out", () => {
    // A 24 card route with three groups, found by a random search: without the overdue card going in first, the
    // fallback filled every chunk from the cards it could take under all rules, and in 169 of 200 rounds a card
    // was still unshown after 300 cards.
    const shape = ["Tg2", "Fg0", "Tg1", "F", "F", "T", "Tg2", "Fg1", "F", "F", "F", "Fg2", "Fg0", "Fg2", "Tg1", "F", "F", "F", "F", "T", "T", "F", "T", "F"];
    const pool = shape.map((s, i) => card(`c${i + 1}`, s.startsWith("T"), s.length > 1 ? [s.slice(1)] : []));
    for (let seed = 0; seed < 200; seed++) {
      const dealt = dealRound(pool, seed, 300);
      expect(Math.max(...firstShown(pool, dealt)), `seed ${seed}`).toBeLessThan(100);
    }
  });

  it("gives way as little as it can: from the second chunk after the last card came in, the round keeps every rule again", () => {
    const pool = route(21);
    for (let seed = 0; seed < 200; seed++) {
      const dealt = dealRound(pool, seed, 300);
      const lastFirst = Math.max(...firstShown(pool, dealt));
      // The chunk right after the overdue card may still give way: the overdue card is in its window, and keeping
      // the balance can leave it no deal without that card's partner (seed 8: chunk 5 takes k1 in, and chunk 6 may
      // deal only the eleven cards outside chunk 5, of which four are False; the balance needs all four, k12 among
      // them). From the chunk after that, no card shares a group with one of the ten before it.
      const settled = (Math.floor(lastFirst / CHUNK) + 2) * CHUNK;
      for (let i = settled; i < dealt.length; i++) {
        const current = dealt[i]!;
        const window = dealt.slice(Math.floor(i / CHUNK) * CHUNK - CHUNK, i);
        expect(window.some((before) => sharesGroup(before, current)), `seed ${seed}, card ${i}`).toBe(false);
      }
    }
  });

  it("keeps the balance in every chunk while it shows an overdue card", () => {
    const pool = route(21);
    for (let seed = 0; seed < 200; seed++) {
      const dealt = dealRound(pool, seed, 300);
      for (let start = 0; start < dealt.length; start += CHUNK) {
        const trues = dealt.slice(start, start + CHUNK).filter((c) => c.answer).length;
        expect(trues, `seed ${seed}, chunk ${start / CHUNK}`).toBeGreaterThanOrEqual(DEAL.minTrue);
        expect(trues, `seed ${seed}, chunk ${start / CHUNK}`).toBeLessThanOrEqual(DEAL.maxTrue);
      }
    }
  });

  it("does not hurry a card that comes in its own time: a route without groups deals exactly as before", () => {
    // Every card of a route without groups is shown in the first pass, so no card is ever overdue.
    const pool = Array.from({ length: 23 }, (_, i) => card(`c${i + 1}`, i % 2 === 0));
    for (let seed = 0; seed < 50; seed++) {
      const dealt = dealRound(pool, seed, 100);
      expect(Math.max(...firstShown(pool, dealt)), `seed ${seed}`).toBeLessThan(pool.length + CHUNK);
    }
  });
});
