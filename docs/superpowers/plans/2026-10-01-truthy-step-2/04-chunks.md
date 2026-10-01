### Task 4: Dealing in chunks

The unbounded modes need more cards than one deal (spec section 6, "Dealing"): "The unbounded modes deal in chunks of ten and, when every card of the route has been dealt in the round, continue with the cards seen longest ago", with conflict groups kept apart "within the last ten cards dealt", "between four and six" True cards in every ten and "at most three equal answers in a row"; what cannot be kept is relaxed "in this order: recency, then conflict groups, then answer balance". Today `deal` knows nothing of what a round has dealt before: a second call would deal the same priority cards again, and its run limit starts from scratch at every call. This task adds the run limit across a join to `deal` and a new function `dealChunk` that a round calls each time it runs out of cards. Nothing calls `dealChunk` yet (task 5 does), so the game does not change.

The first version of this task dealt only cards the round had not shown until the route was used up. Measured on the built decks (20 seeds, every route) that reversed the spec's order: the last unshown cards of a route broke conflict groups, the balance and the run limit (runs of up to seven) although an older card could have kept them. The rules below fix that; the numbers after the fix are under "What was measured".

**Files:**
- Modify: `src/engine/deal.ts`
- Test: create `tests/engine/chunks.test.ts`
- Unchanged and still green: `tests/engine/deal.test.ts`, `tests/engine/deal.property.test.ts`

**Interfaces:**
- Consumes (`src/engine/deal.ts` as task 2 left it):
  - `DEAL = { missedPerTen: 3, minTrue: 4, maxTrue: 6, maxRun: 3 }`
  - `interface DealOptions { count: number; avoid?: readonly Card[] }`
  - `deal(pool: readonly Card[], history: History, rng: Rng, options: DealOptions): Card[]` with its private `uniqueById`, `dealSize`, `rankByPriority(cards, history, rng, size): Ranking`, `interface Ranking { withinCap; overCap }`, `choose(ranking, size, avoid)`, `searchWithAllRules`, `relaxStepByStep`, `arrange(chosen, rng)`, `runLimit(trues, falses)`, `placementCheck(limit)`.
  - `type CardHistory`, `type History` (from `@/src/content/play`), `createRng(seed)` and `type Rng` (from `./rng`).
- Produces:

```ts
export interface DealOptions {
  count: number; // how many cards to deal
  avoid?: readonly Card[]; // cards whose conflict groups must not be repeated (unbounded modes pass the last ten; Classic passes nothing)
  before?: readonly boolean[]; // the answers of the cards dealt just before this deal, oldest first: the run limit holds across the join
}
export const CHUNK = 10;
export function dealChunk(pool: readonly Card[], history: History, rng: Rng, dealt: readonly Card[]): Card[];
```

**Rules:**

1. **`before`.** `arrange` starts with the last answer of `before` as the previous answer and the length of the run of equal answers that ends `before` as the current run. Its run limit is `DEAL.maxRun` (3) whenever some order of the chosen cards keeps it after those cards; otherwise it is the smallest limit some order can keep (the old formula `ceil(majority / (minority + 1))` is this for an empty `before`). With `before` empty or left out, `deal` returns exactly what it returns today for the same seed: no extra draw from the generator, the same limit.
2. **Never fail to deal** (spec section 10). When a run cannot be broken (only cards of the same answer are left to place), `deal` still deals them.
3. `dealChunk(pool, history, rng, dealt)` returns the next cards of a round that has dealt `dealt` so far (in order):
   1. **Who may be dealt.** The *unshown* cards (in the pool, unique by id, not in `dealt`) and the cards that may *come back*: every dealt card whose last showing lies before the last `gap` cards dealt, `gap = min(10, pool size - 1)`. A card among the last `gap` dealt is never dealt. So a card comes back only after `gap` other cards, whatever else happens.
   2. **How many.** `min(10, unshown + come back)`. A route of twenty cards or more always deals ten; an 11 card route deals ten, then one, then one; a 1 card route deals its card again.
   3. **In which order they are considered.** The unshown cards first, ranked by the stored history as in every deal (missed first with the cap of three per ten, then never seen, then seen longest ago, then the missed cards over the cap). Behind them the cards that may come back, the one the round showed longest ago first, whatever the stored history says. The search takes the first cards in line that keep every rule, so: while ten unshown cards keep the rules the chunk holds unshown cards only; the chunk that uses up the route is filled with the cards shown longest ago; and an unshown card that would break a rule (its conflict group is among the last ten, or it would tip the balance) waits for a later chunk while a card that may come back takes its place. That is the spec's "recency" giving way first.
   4. **The constraint window.** `avoid` is the last ten cards dealt (`dealt.slice(-10)`), so a chunk shares no conflict group with the ten cards before it nor inside itself, and `before` is the answers of those ten cards. The balance (four to six True per ten, scaled for a short chunk) and the missed cap hold per chunk.
   5. **What gives way, and where.** When the unshown cards and the cards that may come back together cannot keep the conflict groups or the balance, `deal` relaxes them in the spec's order (conflict groups, then balance), as it does today. On a route of twenty cards or fewer this is the normal case once the first ten are dealt: the cards that may be dealt are exactly as many as the chunk (one card on an 11 card route), so nothing can be chosen, and the run limit gives way too where the forced cards cannot be ordered inside it. The gap of rule 3.1 is never given up for any of them: a card shown a few cards ago gives its answer away more surely than a card of its conflict group does.
4. `dealChunk(pool, history, rng, [])` is exactly `deal(pool, history, rng, { count: 10 })`: a Classic round is the first chunk.
5. `dealChunk` never returns an empty array for a pool with at least one card, and never changes its arguments. No variable may be named `window` (the purity test of task 2 reads it as the DOM).

**What was measured** (the code below on the built decks, every section and every whole deck, 20 seeds, at least 120 cards a round): on every route of more than twenty cards (33 to 214 cards) no run longer than three, no conflict group repeated inside the window, every chunk of ten with four to six True cards, no card back within ten cards. The last unshown card of a route can come late when its conflict group is large: on Cloud Practitioner "Cloud concepts" (45 cards, one group of four) the route was fully shown after 61 to 100 cards. On the 20 card SAA section its one conflict pair meets inside the window about once per pass (twenty cards leave no other card to deal), and on the 11 and 12 card sections runs of four occur where the route wraps. Both are rule 3.5.

**Code.** All in `src/engine/deal.ts`.

`DealOptions` gets the `before` line shown under "Produces". The end of `deal` (the three lines from `const ranking`) becomes one line, and four declarations follow the function:

```ts
export function deal(pool: readonly Card[], history: History, rng: Rng, options: DealOptions): Card[] {
  const cards = uniqueById(pool);
  const size = dealSize(options.count, cards.length);
  if (size === 0) return [];
  return dealRanked(rankByPriority(cards, history, rng, size), size, rng, options);
}

// Chooses `size` cards from a ranking and puts them in order.
function dealRanked(ranking: Ranking, size: number, rng: Rng, options: Pick<DealOptions, "avoid" | "before">): Card[] {
  return arrange(choose(ranking, size, options.avoid ?? []), rng, joinOf(options.before ?? []));
}

// Where a deal joins the cards before it: their last answer and the length of the run of equal answers
// that ends them. Nothing before: no last answer, no run.
interface Join {
  last: boolean | null;
  run: number;
}

function joinOf(before: readonly boolean[]): Join {
  const last = before[before.length - 1] ?? null;
  let run = 0;
  for (let i = before.length - 1; i >= 0 && before[i] === last; i--) run++;
  return { last, run };
}

export const CHUNK = 10;

// The next cards of a round, given every card the round has dealt so far (in order): ten, or as many as
// may be dealt. First in line are the cards the round has not shown, ranked by the stored history. Behind
// them stand the cards it may bring back: every card outside the last min(CHUNK, route size - 1) dealt,
// the one shown longest ago first. Never empty for a pool with a card in it.
export function dealChunk(pool: readonly Card[], history: History, rng: Rng, dealt: readonly Card[]): Card[] {
  const cards = uniqueById(pool);
  const lastDealtAt = new Map<string, number>();
  dealt.forEach((card, position) => lastDealtAt.set(card.id, position));
  const unshown = cards.filter((card) => !lastDealtAt.has(card.id));
  const gap = Math.min(CHUNK, cards.length - 1);
  const comeBack = cards
    .filter((card) => (lastDealtAt.get(card.id) ?? dealt.length) < dealt.length - gap)
    .sort((a, b) => (lastDealtAt.get(a.id) ?? 0) - (lastDealtAt.get(b.id) ?? 0));
  const size = Math.min(CHUNK, unshown.length + comeBack.length);
  const lastTen = dealt.slice(-CHUNK);
  return dealRanked({ ...rankByPriority(unshown, history, rng, size), comeBack }, size, rng, {
    avoid: lastTen,
    before: lastTen.map((card) => card.answer),
  });
}
```

`Ranking` gets a third list, and `rankByPriority` returns it empty (add `comeBack: [],` to its returned object):

```ts
interface Ranking {
  withinCap: Card[];
  overCap: Card[];
  comeBack: Card[]; // dealChunk only: cards the round has shown and may bring back, the one shown longest ago first
}
```

`choose` and its comment become (`searchWithAllRules` and `relaxStepByStep` do not change):

```ts
// Picks `size` cards, relaxing the rules in the order of the spec only as far as needed:
// 1. every rule, without the missed cards over the cap;
// 2. recency: the missed cards over the cap may join, last in line;
// 3. recency again, in a round that goes on: a card the round has shown may come back, last in line;
// 4. conflict groups, then 5. answer balance (relaxStepByStep).
function choose(ranking: Ranking, size: number, avoid: readonly Card[]): Card[] {
  const balance = balanceFor(size);
  const unshown = [...ranking.withinCap, ...ranking.overCap];
  const everyCard = [...unshown, ...ranking.comeBack];
  return (
    searchWithAllRules(ranking.withinCap, size, avoid, balance) ??
    searchWithAllRules(unshown, size, avoid, balance) ??
    (ranking.comeBack.length > 0 ? searchWithAllRules(everyCard, size, avoid, balance) : null) ??
    relaxStepByStep(everyCard, size, avoid, balance)
  );
}
```

In `arrange`, the signature becomes `function arrange(chosen: readonly Card[], rng: Rng, join: Join): Card[]`, the limit `const limit = runLimit(trues.length, falses.length, join);`, and `let last: boolean | null = null; let run = 0;` become `let last = join.last; let run = join.run;`. Nothing else in its body changes. `runLimit` and its comment become:

```ts
// The run limit is DEAL.maxRun, unless no order of these answers after the cards before them can keep
// it (all True, 9 True and 1 False, or a True card alone after three True cards); then it is the
// smallest limit some order can keep. Without cards before, that is ceil(majority / (minority + 1)).
function runLimit(trues: number, falses: number, join: Join): number {
  let limit = DEAL.maxRun;
  while (!placementCheck(limit)(trues, falses, join.last, join.run)) limit++;
  return limit;
}
```

`placementCheck` takes a start without a previous answer: in its return type and in the inner `canPlace`, the parameter `last: boolean` becomes `last: boolean | null` (two places; the body is unchanged, `null` equals neither answer).

**Tests:** `tests/engine/chunks.test.ts`, complete. `dealRound` deals chunk after chunk the way a round does (each chunk with its own generator).

```ts
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
```

**Steps:**

- [ ] **Step 1: Write `tests/engine/chunks.test.ts`** as above.
- [ ] **Step 2: Run it and watch it fail.** `pnpm vitest run tests/engine/chunks.test.ts`. Expected: 20 failed, 2 passed. Every `dealChunk` test fails with `dealChunk is not a function` ("is ten" with `expected undefined to be 10`); "does not continue a run of three from the cards before" fails with `expected true to be false`, "counts the cards before into the run" with `expected 2 to be less than or equal to 1` and "puts the one card of the other answer first ..." with `expected 't1' to be 'f1'` (the option is ignored). "deals exactly as before when nothing came before" and "still deals when the run cannot be broken" already pass.
- [ ] **Step 3: Add `before`**: the option, `dealRanked`, `Join`, `joinOf`, and the changes to `arrange`, `runLimit` and `placementCheck`. Run the file: the five tests of "deal: the run limit across a join" pass.
- [ ] **Step 4: Add `CHUNK`, `dealChunk`, `comeBack` and the new `choose`.** Run the file: 22 tests pass.
- [ ] **Step 5: Run the old suites.** `pnpm vitest run tests/engine tests/purity.test.ts`. Expected: all pass, `deal.test.ts` and `deal.property.test.ts` unchanged (their reference orders prove rule 1 and rule 4).
- [ ] **Step 6: Prove the route tests bite.** In `dealChunk`, pass `comeBack: unshown.length > 0 ? [] : comeBack` to `dealRanked` (no card comes back until the route is used up, which is what the first version of this task did). Run the file: five tests fail, among them "on a route like a real section keeps every rule for 150 cards and shows every card", "brings a card back rather than deal a card whose conflict group is among the last ten" and "keeps the run limit and the balance of every chunk, through the route and after it". Put the line back and run the file green again.
- [ ] **Step 7: Run the gates.** `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm e2e` (port 3100 free). All green.
- [ ] **Step 8: Commit.**

```bash
git add src/engine/deal.ts tests/engine/chunks.test.ts
git commit -m "feat: deal a round in chunks of ten that keep the rules across the join and after the route is used up"
```
