import { describe, expect, it } from "vitest";
import type { Card } from "@/src/content/schema";
import { DEAL, SEARCH_BUDGET, deal, dealChunk, type History } from "@/src/engine/deal";
import { createRng, type Rng } from "@/src/engine/rng";

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

function trueCount(dealt: readonly Card[]): number {
  return dealt.filter((c) => c.answer).length;
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

function keepsEveryRule(dealt: readonly Card[]): boolean {
  const trues = trueCount(dealt);
  return repeatedGroups(dealt).length === 0 && trues >= DEAL.minTrue && trues <= DEAL.maxTrue;
}

// Every card answered right once, at the given times: the deal ranks them oldest first, so the test sets the order.
function inOrder(cards: readonly Card[]): History {
  return Object.fromEntries(cards.map((c, i) => [c.id, { seen: 1, lastCorrect: true, lastSeenAt: i + 1 }]));
}

// The search keeps every rule when it can, and the cut (canStillFinish) is what lets it find such a deal within a
// small budget: without it, the search walks through every way to fill the deal from the cards in front.
describe("deal: the search cuts a branch that cannot finish", () => {
  it("sees that the groups in use leave too few False cards, and leaves out the True cards that hold them", () => {
    // h1 to h6 (True) come first; f1 to f6 (False) each share a group with one of them; t1 to t20 (True) come last.
    // Four False cards are needed, so four of the h cards must stay out. The search finds that in 20 steps; a cut
    // that counts the False cards ahead without their groups lets it try the h cards in every way, over 100 steps.
    const h = Array.from({ length: 6 }, (_, i) => card(`h${i + 1}`, true, [`g${i + 1}`]));
    const f = Array.from({ length: 6 }, (_, i) => card(`f${i + 1}`, false, [`g${i + 1}`]));
    const t = Array.from({ length: 20 }, (_, i) => card(`t${i + 1}`, true));
    const ranked = [...h, ...f, ...t];
    for (let seed = 0; seed < 20; seed++) {
      const dealt = deal(ranked, inOrder(ranked), createRng(seed), { count: 10, budget: 40 });
      expect(dealt, `seed ${seed}`).toHaveLength(10);
      expect(keepsEveryRule(dealt), `seed ${seed}: ${dealt.map((c) => c.id).join(",")}`).toBe(true);
      // The first deal in rank order that keeps every rule: h1, h2, f3 to f6 and t1 to t4.
      expect(dealt.map((c) => c.id).sort(), `seed ${seed}`).toEqual(["f3", "f4", "f5", "f6", "h1", "h2", "t1", "t2", "t3", "t4"]);
    }
  });

  it.each([
    ["False", false],
    ["True", true],
  ])("sees that %s cards of one group give one card, and leaves out the card of the other answer that holds another", (_name, scarce) => {
    // h comes first and shares group G with g, the last card. a1 to a6 share group A; d1 and d2 have none. a, d and g
    // have the scarce answer, h and t1 to t20 the other. Four cards of the scarce answer are needed (at most six of
    // the other): one a card, d1, d2 and g, so h must stay out.
    const ranked = [
      card("h", !scarce, ["G"]),
      ...Array.from({ length: 20 }, (_, i) => card(`t${i + 1}`, !scarce)),
      ...Array.from({ length: 6 }, (_, i) => card(`a${i + 1}`, scarce, ["A"])),
      card("d1", scarce),
      card("d2", scarce),
      card("g", scarce, ["G"]),
    ];
    for (let seed = 0; seed < 20; seed++) {
      const dealt = deal(ranked, inOrder(ranked), createRng(seed), { count: 10, budget: 200 });
      expect(keepsEveryRule(dealt), `seed ${seed}: ${dealt.map((c) => c.id).join(",")}`).toBe(true);
      expect(dealt.map((c) => c.id), `seed ${seed}`).toEqual(expect.arrayContaining(["a1", "d1", "d2", "g"]));
    }
  });

  it("sees that cards sharing groups across both answers give one card a group, and leaves out the card that blocks two", () => {
    // x (True) belongs to groups X1 and X2, which y1 and y2 (False, the last cards) need. In between: four groups that
    // each hold a True and a False card, and two free cards of each answer. Without x: y1, y2, one card of each pair
    // and the four free cards make ten. With x, at most nine cards remain possible.
    const pairs = Array.from({ length: 4 }, (_, i) => [card(`p${i + 1}t`, true, [`P${i + 1}`]), card(`p${i + 1}f`, false, [`P${i + 1}`])]).flat();
    const ranked = [
      card("x", true, ["X1", "X2"]),
      ...pairs,
      card("t1", true),
      card("t2", true),
      card("f1", false),
      card("f2", false),
      card("y1", false, ["X1"]),
      card("y2", false, ["X2"]),
    ];
    for (let seed = 0; seed < 20; seed++) {
      const dealt = deal(ranked, inOrder(ranked), createRng(seed), { count: 10, budget: 40 });
      expect(keepsEveryRule(dealt), `seed ${seed}: ${dealt.map((c) => c.id).join(",")}`).toBe(true);
      expect(dealt.map((c) => c.id), `seed ${seed}`).not.toContain("x");
    }
  });

  it("finds a deal that keeps every rule whenever one exists (400 random pools, one group per card at most)", () => {
    const rng = createRng(107);
    let checked = 0;
    for (let n = 0; n < 400; n++) {
      const pool = randomPool(rng);
      const seed = Math.floor(rng() * 2 ** 32);
      if (!canKeepEveryRule(pool, 10)) continue;
      checked++;
      for (const dealt of [deal(pool, {}, createRng(seed), { count: 10 }), dealChunk(pool, {}, createRng(seed), [])]) {
        expect(keepsEveryRule(dealt), `pool ${n}: ${dealt.map((c) => `${c.id}${c.answer ? "T" : "F"}${c.conflictGroups.join("")}`).join(" ")}`).toBe(true);
      }
    }
    expect(checked).toBeGreaterThan(200);
  });
});

// The bound: a pool where no deal keeps every rule and the cut cannot tell early, here seven False cards in a ring
// (each shares a group with the next, so at most three go together) after sixty True cards. Without the bound the
// search tries every six of the sixty True cards with every set of False cards: minutes, not milliseconds.
describe("deal: the bound on the search", () => {
  const ring = [
    ...Array.from({ length: 60 }, (_, i) => card(`t${i + 1}`, true)),
    ...Array.from({ length: 7 }, (_, i) => card(`f${i + 1}`, false, [`r${i}`, `r${(i + 1) % 7}`])),
  ];

  it("is finite", () => {
    expect(Number.isFinite(SEARCH_BUDGET)).toBe(true);
  });

  it("hands the deal to the fallback when a search runs out of steps", () => {
    // The first pool of the cut tests: the search finds a deal that keeps every rule in a few dozen steps, and with
    // a budget of one step it gives up, so the fallback deals f1 to f4 together with all six h cards.
    const h = Array.from({ length: 6 }, (_, i) => card(`h${i + 1}`, true, [`g${i + 1}`]));
    const f = Array.from({ length: 6 }, (_, i) => card(`f${i + 1}`, false, [`g${i + 1}`]));
    const t = Array.from({ length: 20 }, (_, i) => card(`t${i + 1}`, true));
    const ranked = [...h, ...f, ...t];
    expect(keepsEveryRule(deal(ranked, inOrder(ranked), createRng(1), { count: 10 }))).toBe(true);
    const starved = deal(ranked, inOrder(ranked), createRng(1), { count: 10, budget: 1 });
    expect(starved).toHaveLength(10);
    expect(repeatedGroups(starved)).toHaveLength(4);
  });

  it("deals a full round from the ring at once, giving way on the groups and keeping the balance", () => {
    const started = performance.now();
    const chunk = dealChunk(ring, {}, createRng(1), []);
    expect(performance.now() - started).toBeLessThan(2_000);
    expect(chunk).toHaveLength(10);
    expect(trueCount(chunk)).toBe(DEAL.maxTrue);
  });
});

// A pool of 12 to 40 cards with some groups of two to four cards and answers more or less balanced.
function randomPool(rng: Rng): Card[] {
  const size = 12 + Math.floor(rng() * 29);
  const groups = Math.max(2, Math.floor(size / (2 + rng() * 3)));
  const grouped = 0.3 + rng() * 0.5;
  const trueShare = 0.3 + rng() * 0.4;
  return Array.from({ length: size }, (_, i) =>
    card(`c${i + 1}`, rng() < trueShare, rng() < grouped ? [`g${Math.floor(rng() * groups)}`] : []),
  );
}

// Exact for cards with at most one group: the pool falls into bins (a group, or a card without one) that give at
// most one card each; a deal of `size` keeps every rule when some choice of bins reaches a True count in the balance.
function canKeepEveryRule(pool: readonly Card[], size: number): boolean {
  const bins = new Map<string, Set<boolean>>();
  for (const c of pool) {
    const key = c.conflictGroups[0] ?? `card ${c.id}`;
    bins.set(key, (bins.get(key) ?? new Set<boolean>()).add(c.answer));
  }
  let reachable = new Set(["0,0"]);
  for (const answers of bins.values()) {
    const next = new Set(reachable);
    for (const state of reachable) {
      const [n, t] = state.split(",").map(Number) as [number, number];
      if (n === size) continue;
      for (const answer of answers) next.add(`${n + 1},${t + (answer ? 1 : 0)}`);
    }
    reachable = next;
  }
  for (let t = DEAL.minTrue; t <= DEAL.maxTrue; t++) if (reachable.has(`${size},${t}`)) return true;
  return false;
}
