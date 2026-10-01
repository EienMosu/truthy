### Task 4: Engine: seeded randomness and dealing

The engine gets all its randomness from one seeded generator (`src/engine/rng.ts`), so a seed always deals the same round, here and later in the Swift and Kotlin clones. On top of it, `src/engine/deal.ts` chooses which cards a round gets and in which order, following spec section 6 ("Dealing"): priority (missed, then never seen, then seen longest ago, with at most three missed per ten), no shared conflict group, four to six True per ten, at most three equal answers in a row, and a fixed relaxation order when the pool cannot satisfy everything.

How the dealer works, so the steps below make sense:

1. **Rank.** The pool is de-duplicated by card id and shuffled (random, reproducible tie-breaks). It is then split into a ranked list `withinCap` (the oldest missed cards up to the cap of `floor(size * 3 / 10)`, then every never-seen card, then the cards answered right, oldest first) and `overCap` (the remaining missed cards, oldest first).
2. **Choose.** A depth-first search walks the ranked list and takes each card that keeps every rule (no conflict group shared with a picked card or an `avoid` card; True count kept between `floor(size * 0.4)` and `ceil(size * 0.6)`), and backtracks only when the deal can no longer be completed. The first full deal it finds keeps as many high-ranked cards as possible, so "recency" is the first thing to give way. It tries `withinCap` first, then `withinCap + overCap` (missed cards over the cap are the last resort of recency). If no deal keeps every rule, a three-pass fallback adds cards in rank order: all rules, then without conflict groups, then without the balance. That is the spec's relaxation order: recency, then conflict groups, then answer balance. It always reaches `min(count, distinct cards in the pool)`.
3. **Arrange.** The chosen cards are ordered position by position: True or False is drawn in proportion to how many of each are left, among the answers that still let the rest be placed with no run longer than three. When three is impossible (all True, or 9 True and 1 False after the balance was relaxed) the limit becomes the shortest possible longest run.

The search has a step budget of 20,000 visits. Real decks finish in a few dozen. The budget only runs out on pools where no deal keeps every rule (for example ten cards spread over nine groups), and then the fallback takes over. Measured in the spike on the real CLF deck: every section and the whole deck (214 cards) dealt 500 times with a random history, every rule held every time, about 0.03 ms per deal.

Every command below runs from the repository root, `~/Desktop/workspace/truthy`.

**Files:**
- Create: `src/engine/rng.ts`
- Create: `src/engine/deal.ts`
- Test: `tests/engine/rng.test.ts`
- Test: `tests/engine/deal.test.ts`
- Test: `tests/engine/deal.property.test.ts`

**Interfaces:**
- Consumes: `Card` from `@/src/content/schema` (task 3):

```ts
export type Card = {
  id: string;
  section: string;
  text: { en: { statement: string; explanation: string } };
  answer: boolean;
  source: { title: string; url: string };
  difficulty: 1 | 2 | 3;
  appliesTo: string;
  conflictGroups: string[];
};
```

  Also the Vitest setup and the `@/*` alias from task 1.
- Produces (exactly as in the contract):

```ts
// src/engine/rng.ts
export type Rng = () => number;                                    // uniform in [0, 1)
export function createRng(seed: number): Rng;                      // mulberry32; seed taken as an unsigned 32-bit integer
export function shuffle<T>(items: readonly T[], rng: Rng): T[];    // Fisher-Yates from the end, new array, draws items.length - 1 numbers

// src/engine/deal.ts
export interface CardHistory { seen: number; lastCorrect: boolean; lastSeenAt: number }
export type History = Readonly<Record<string, CardHistory>>;       // by card id
export const DEAL = { missedPerTen: 3, minTrue: 4, maxTrue: 6, maxRun: 3 } as const;
export interface DealOptions { count: number; avoid?: readonly Card[] }
export function deal(pool: readonly Card[], history: History, rng: Rng, options: DealOptions): Card[];
```

Exact semantics that later tasks rely on:
- `deal` never throws and never mutates its arguments. It returns `min(floor(count), number of distinct card ids in the pool)` cards (0 for a count of 0, a negative count or `NaN`), each card at most once. The first card with a given id wins.
- A card counts as seen when its history entry has `seen > 0`; it counts as missed when it is seen and `lastCorrect === false`. A `lastSeenAt` that is not a finite number sorts as 0 (oldest). History entries for cards not in the pool are ignored.
- `avoid` only blocks conflict groups (a card in `avoid` with no groups blocks nothing; a card is not excluded because it is in `avoid`). Removing already dealt cards from the pool is the caller's job (the unbounded modes in step 2).
- Same `pool`, `history`, `options` and a generator with the same seed give the same cards in the same order.

- [ ] **Step 1: Write the failing tests for the seeded generator**

Create `tests/engine/rng.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createRng } from "@/src/engine/rng";

function draw(seed: number, n: number): number[] {
  const rng = createRng(seed);
  return Array.from({ length: n }, () => rng());
}

describe("createRng (mulberry32)", () => {
  it("produces the reference mulberry32 values, so the native clones can match them", () => {
    // Each value times 2^32 is the raw 32-bit output of mulberry32.
    expect(draw(1, 3).map((x) => x * 2 ** 32)).toEqual([2693262067, 11749833, 2265367787]);
    expect(draw(42, 3).map((x) => x * 2 ** 32)).toEqual([2581720956, 1925393290, 3661312704]);
  });

  it("gives the same sequence for the same seed", () => {
    expect(draw(7, 50)).toEqual(draw(7, 50));
  });

  it("gives different sequences for different seeds", () => {
    expect(draw(7, 5)).not.toEqual(draw(8, 5));
  });

  it("keeps two generators with the same seed independent of each other", () => {
    const a = createRng(3);
    const b = createRng(3);
    a();
    a();
    expect(b()).toBe(draw(3, 1)[0]);
  });

  it("stays in [0, 1) over many draws", () => {
    for (const x of draw(123, 10_000)) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it("is roughly uniform: each tenth of [0, 1) gets between 8% and 12% of 10,000 draws", () => {
    const buckets = new Array<number>(10).fill(0);
    for (const x of draw(99, 10_000)) {
      const i = Math.floor(x * 10);
      buckets[i] = (buckets[i] ?? 0) + 1;
    }
    for (const count of buckets) {
      expect(count).toBeGreaterThan(800);
      expect(count).toBeLessThan(1200);
    }
  });

  it("accepts seed 0, negative, fractional and very large seeds", () => {
    expect(draw(0, 3).map((x) => x * 2 ** 32)).toEqual([1144304738, 1416247, 958946056]);
    // Seeds are taken as unsigned 32-bit integers: -1 is 2^32 - 1, 1.9 is 1, 2^32 + 1 is 1.
    expect(draw(-1, 3)).toEqual(draw(2 ** 32 - 1, 3));
    expect(draw(1.9, 3)).toEqual(draw(1, 3));
    expect(draw(2 ** 32 + 1, 3)).toEqual(draw(1, 3));
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

```bash
pnpm vitest run tests/engine/rng.test.ts
```

Expected: the suite cannot load the module.

```
 FAIL  tests/engine/rng.test.ts [ tests/engine/rng.test.ts ]
Error: Cannot find package '@/src/engine/rng' imported from .../truthy/tests/engine/rng.test.ts
 Test Files  1 failed (1)
      Tests  no tests
```

- [ ] **Step 3: Implement the generator**

Create `src/engine/rng.ts`:

```ts
// Seeded randomness for the engine. The engine never calls Math.random: a round gets one
// generator from its seed, so the same seed and the same events always give the same round.

export type Rng = () => number; // uniform in [0, 1)

// mulberry32: a small, fast 32-bit generator. The seed is taken as an unsigned 32-bit integer.
// The Swift and Kotlin clones implement the same arithmetic, so a seed deals the same round everywhere.
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

- [ ] **Step 4: Run the tests and watch them pass**

```bash
pnpm vitest run tests/engine/rng.test.ts
```

Expected:

```
 Test Files  1 passed (1)
      Tests  7 passed (7)
```

- [ ] **Step 5: Commit**

```bash
git add src/engine/rng.ts tests/engine/rng.test.ts
git commit -m "feat: add seeded mulberry32 generator for the engine"
```

- [ ] **Step 6: Write the failing tests for shuffle**

In `tests/engine/rng.test.ts`, replace the import line `import { createRng } from "@/src/engine/rng";` with:

```ts
import { createRng, shuffle } from "@/src/engine/rng";
```

Then append to the end of the file:

```ts
describe("shuffle (Fisher-Yates)", () => {
  const items = Object.freeze(["a", "b", "c", "d", "e", "f", "g", "h"]);

  it("returns a new array and leaves the input untouched", () => {
    const result = shuffle(items, createRng(1));
    expect(result).not.toBe(items);
    expect(items).toEqual(["a", "b", "c", "d", "e", "f", "g", "h"]);
  });

  it("returns a permutation: the same items, each exactly once", () => {
    const result = shuffle(items, createRng(5));
    expect(result).toHaveLength(items.length);
    expect([...result].sort()).toEqual([...items]);
  });

  it("gives the reference order for seed 1, so the native clones can match it", () => {
    expect(shuffle(items, createRng(1))).toEqual(["c", "b", "g", "h", "e", "d", "a", "f"]);
  });

  it("is deterministic for a seed", () => {
    expect(shuffle(items, createRng(11))).toEqual(shuffle(items, createRng(11)));
  });

  it("actually reorders: some seed out of ten changes the order", () => {
    const orders = new Set(Array.from({ length: 10 }, (_, seed) => shuffle(items, createRng(seed)).join("")));
    expect(orders.size).toBeGreaterThan(1);
  });

  it("handles an empty list and a single item", () => {
    expect(shuffle([], createRng(1))).toEqual([]);
    expect(shuffle(["only"], createRng(1))).toEqual(["only"]);
  });

  it("can put every item in every position (2,000 seeds over 4 items)", () => {
    const seenAt = new Map<string, Set<number>>();
    for (let seed = 0; seed < 2000; seed++) {
      shuffle(["w", "x", "y", "z"], createRng(seed)).forEach((item, position) => {
        const positions = seenAt.get(item) ?? new Set<number>();
        positions.add(position);
        seenAt.set(item, positions);
      });
    }
    for (const item of ["w", "x", "y", "z"]) {
      expect(seenAt.get(item)?.size).toBe(4);
    }
  });

  it("uses exactly length - 1 draws, so callers can predict the generator state", () => {
    let calls = 0;
    const counting = () => {
      calls++;
      return 0.5;
    };
    shuffle(items, counting);
    expect(calls).toBe(items.length - 1);
  });
});
```

- [ ] **Step 7: Run the tests and watch the shuffle tests fail**

```bash
pnpm vitest run tests/engine/rng.test.ts
```

Expected: all eight shuffle tests fail with `TypeError: shuffle is not a function`; the seven generator tests still pass.

```
 FAIL  tests/engine/rng.test.ts > shuffle (Fisher-Yates) > returns a new array and leaves the input untouched
TypeError: shuffle is not a function
...
 Test Files  1 failed (1)
      Tests  8 failed | 7 passed (15)
```

- [ ] **Step 8: Implement shuffle**

Append to the end of `src/engine/rng.ts`:

```ts
// Fisher-Yates from the end. Returns a new array; the input is never changed.
// Draws exactly items.length - 1 numbers (none for zero or one item).
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const held = result[i] as T;
    result[i] = result[j] as T;
    result[j] = held;
  }
  return result;
}
```

- [ ] **Step 9: Run the tests and watch them pass**

```bash
pnpm vitest run tests/engine/rng.test.ts
```

Expected:

```
 Test Files  1 passed (1)
      Tests  15 passed (15)
```

- [ ] **Step 10: Commit**

```bash
git add src/engine/rng.ts tests/engine/rng.test.ts
git commit -m "feat: add seeded Fisher-Yates shuffle"
```

- [ ] **Step 11: Write the failing tests for deal size, uniqueness, determinism and priority**

Create `tests/engine/deal.test.ts`:

```ts
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
```

- [ ] **Step 12: Run the tests and watch them fail**

```bash
pnpm vitest run tests/engine/deal.test.ts
```

Expected:

```
 FAIL  tests/engine/deal.test.ts [ tests/engine/deal.test.ts ]
Error: Cannot find package '@/src/engine/deal' imported from .../truthy/tests/engine/deal.test.ts
 Test Files  1 failed (1)
      Tests  no tests
```

- [ ] **Step 13: Implement ranking by priority**

This first version only ranks and cuts; the rules come in the next slices. Create `src/engine/deal.ts`:

```ts
// Dealing: which cards a round gets, and in which order (spec section 6, "Dealing").
// Pure: the only source of randomness is the rng passed in.

import type { Card } from "@/src/content/schema";
import { shuffle, type Rng } from "./rng";

export interface CardHistory {
  seen: number;
  lastCorrect: boolean;
  lastSeenAt: number;
}
export type History = Readonly<Record<string, CardHistory>>; // by card id

export const DEAL = { missedPerTen: 3, minTrue: 4, maxTrue: 6, maxRun: 3 } as const;

export interface DealOptions {
  count: number; // how many cards to deal
  avoid?: readonly Card[]; // cards whose conflict groups must not be repeated (unbounded modes pass the last ten; Classic passes nothing)
}

export function deal(pool: readonly Card[], history: History, rng: Rng, options: DealOptions): Card[] {
  const cards = uniqueById(pool);
  const size = dealSize(options.count, cards.length);
  if (size === 0) return [];
  const ranking = rankByPriority(cards, history, rng, size);
  return [...ranking.withinCap, ...ranking.overCap].slice(0, size);
}

// The first card with each id wins, so a card can never be dealt twice.
function uniqueById(pool: readonly Card[]): Card[] {
  const seen = new Set<string>();
  return pool.filter((card) => {
    if (seen.has(card.id)) return false;
    seen.add(card.id);
    return true;
  });
}

function dealSize(count: number, available: number): number {
  if (Number.isNaN(count) || count <= 0) return 0;
  return Math.min(Math.floor(count), available);
}

function wasSeen(card: Card, history: History): boolean {
  const entry = history[card.id];
  return entry !== undefined && entry.seen > 0;
}

function wasMissed(card: Card, history: History): boolean {
  return wasSeen(card, history) && history[card.id]?.lastCorrect === false;
}

function lastSeenAt(card: Card, history: History): number {
  const at = history[card.id]?.lastSeenAt;
  return at !== undefined && Number.isFinite(at) ? at : 0;
}

// Oldest first. Array.prototype.sort is stable, so equal times keep their (shuffled) order.
function oldestFirst(cards: readonly Card[], history: History): Card[] {
  return [...cards].sort((a, b) => lastSeenAt(a, history) - lastSeenAt(b, history));
}

// The pool in the order cards should be considered: missed cards up to the cap (oldest miss first),
// never seen (random), seen longest ago. The missed cards over the cap are kept apart, to be used only
// when a deal cannot be made without them. Shuffling first makes every tie random but reproducible.
interface Ranking {
  withinCap: Card[];
  overCap: Card[];
}

function rankByPriority(cards: readonly Card[], history: History, rng: Rng, size: number): Ranking {
  const shuffled = shuffle(cards, rng);
  const missed = oldestFirst(shuffled.filter((card) => wasMissed(card, history)), history);
  const unseen = shuffled.filter((card) => !wasSeen(card, history));
  const seenRight = oldestFirst(shuffled.filter((card) => wasSeen(card, history) && !wasMissed(card, history)), history);
  const missedCap = Math.floor((size * DEAL.missedPerTen) / 10);
  return {
    withinCap: [...missed.slice(0, missedCap), ...unseen, ...seenRight],
    overCap: missed.slice(missedCap),
  };
}
```

- [ ] **Step 14: Run the tests and watch them pass**

```bash
pnpm vitest run tests/engine/deal.test.ts
```

Expected:

```
 Test Files  1 passed (1)
      Tests  22 passed (22)
```

- [ ] **Step 15: Commit**

```bash
git add src/engine/deal.ts tests/engine/deal.test.ts
git commit -m "feat: deal cards by priority: missed, never seen, seen longest ago"
```

- [ ] **Step 16: Write the failing tests for conflict groups, answer balance and relaxation**

Append to the end of `tests/engine/deal.test.ts`:

```ts
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
```

- [ ] **Step 17: Run the tests and watch the new ones fail**

```bash
pnpm vitest run tests/engine/deal.test.ts
```

Expected: 12 of the 19 new tests fail (the other seven already hold because the first version deals in rank order). The failures, in the order printed:

```
 FAIL  ... > deal: conflict groups > never deals two cards that share a conflict group when ten conflict-free cards exist
AssertionError: expected [ 'group-1' ] to deeply equal []
 FAIL  ... > deal: conflict groups > blocks every group of a card that belongs to several
 FAIL  ... > deal: conflict groups > skips a missed card that conflicts with an older missed card, and fills from lower priority instead
 FAIL  ... > deal: conflict groups > keeps clear of the groups of the avoid cards
 FAIL  ... > deal: answer balance > deals four to six True per ten from a pool that is mostly True
AssertionError: expected 7 to be less than or equal to 6
 FAIL  ... > deal: answer balance > deals four to six True per ten from a pool that is mostly False
 FAIL  ... > deal: answer balance > gives up priority before balance: older False cards replace unseen True ones
 FAIL  ... > deal: answer balance > scales the balance: 5 cards have between 2 and 3 True
 FAIL  ... > deal: answer balance > scales the balance: 3 cards have between 1 and 2 True
 FAIL  ... > deal: answer balance > scales the balance: 20 cards have between 8 and 12 True
 FAIL  ... > deal: relaxing the constraints when the pool is too small > relaxes conflict groups before answer balance
 FAIL  ... > deal: relaxing the constraints when the pool is too small > lets missed cards over the cap in (recency) before giving up the balance
 Test Files  1 failed (1)
      Tests  12 failed | 29 passed (41)
```

- [ ] **Step 18: Implement choosing with the rules and the relaxation order**

Replace the whole of `src/engine/deal.ts` with:

```ts
// Dealing: which cards a round gets, and in which order (spec section 6, "Dealing").
// Pure: the only source of randomness is the rng passed in.

import type { Card } from "@/src/content/schema";
import { shuffle, type Rng } from "./rng";

export interface CardHistory {
  seen: number;
  lastCorrect: boolean;
  lastSeenAt: number;
}
export type History = Readonly<Record<string, CardHistory>>; // by card id

export const DEAL = { missedPerTen: 3, minTrue: 4, maxTrue: 6, maxRun: 3 } as const;

export interface DealOptions {
  count: number; // how many cards to deal
  avoid?: readonly Card[]; // cards whose conflict groups must not be repeated (unbounded modes pass the last ten; Classic passes nothing)
}

export function deal(pool: readonly Card[], history: History, rng: Rng, options: DealOptions): Card[] {
  const cards = uniqueById(pool);
  const size = dealSize(options.count, cards.length);
  if (size === 0) return [];
  const ranking = rankByPriority(cards, history, rng, size);
  return choose(ranking, size, options.avoid ?? []);
}

// The first card with each id wins, so a card can never be dealt twice.
function uniqueById(pool: readonly Card[]): Card[] {
  const seen = new Set<string>();
  return pool.filter((card) => {
    if (seen.has(card.id)) return false;
    seen.add(card.id);
    return true;
  });
}

function dealSize(count: number, available: number): number {
  if (Number.isNaN(count) || count <= 0) return 0;
  return Math.min(Math.floor(count), available);
}

function wasSeen(card: Card, history: History): boolean {
  const entry = history[card.id];
  return entry !== undefined && entry.seen > 0;
}

function wasMissed(card: Card, history: History): boolean {
  return wasSeen(card, history) && history[card.id]?.lastCorrect === false;
}

function lastSeenAt(card: Card, history: History): number {
  const at = history[card.id]?.lastSeenAt;
  return at !== undefined && Number.isFinite(at) ? at : 0;
}

// Oldest first. Array.prototype.sort is stable, so equal times keep their (shuffled) order.
function oldestFirst(cards: readonly Card[], history: History): Card[] {
  return [...cards].sort((a, b) => lastSeenAt(a, history) - lastSeenAt(b, history));
}

// The pool in the order cards should be considered: missed cards up to the cap (oldest miss first),
// never seen (random), seen longest ago. The missed cards over the cap are kept apart, to be used only
// when a deal cannot be made without them. Shuffling first makes every tie random but reproducible.
interface Ranking {
  withinCap: Card[];
  overCap: Card[];
}

function rankByPriority(cards: readonly Card[], history: History, rng: Rng, size: number): Ranking {
  const shuffled = shuffle(cards, rng);
  const missed = oldestFirst(shuffled.filter((card) => wasMissed(card, history)), history);
  const unseen = shuffled.filter((card) => !wasSeen(card, history));
  const seenRight = oldestFirst(shuffled.filter((card) => wasSeen(card, history) && !wasMissed(card, history)), history);
  const missedCap = Math.floor((size * DEAL.missedPerTen) / 10);
  return {
    withinCap: [...missed.slice(0, missedCap), ...unseen, ...seenRight],
    overCap: missed.slice(missedCap),
  };
}

// How many True cards a deal of `size` may have: 4 to 6 per ten, scaled (floor of 40%, ceiling of 60%).
interface Balance {
  minTrue: number;
  maxTrue: number;
}

function balanceFor(size: number): Balance {
  return {
    minTrue: Math.floor((size * DEAL.minTrue) / 10),
    maxTrue: Math.ceil((size * DEAL.maxTrue) / 10),
  };
}

// Picks `size` cards, relaxing the rules in the order of the spec only as far as needed:
// 1. every rule, without the missed cards over the cap;
// 2. recency: the missed cards over the cap may join, last in line;
// 3. conflict groups, then 4. answer balance (relaxStepByStep).
function choose(ranking: Ranking, size: number, avoid: readonly Card[]): Card[] {
  const balance = balanceFor(size);
  const everyCard = [...ranking.withinCap, ...ranking.overCap];
  return (
    searchWithAllRules(ranking.withinCap, size, avoid, balance) ??
    searchWithAllRules(everyCard, size, avoid, balance) ??
    relaxStepByStep(everyCard, size, avoid, balance)
  );
}

// A bound on the work the search may do. Real decks need a few dozen steps; the bound only matters
// for pools where no deal keeps every rule, and then the relaxed fallback takes over.
const SEARCH_BUDGET = 20_000;

// Depth-first over the ranked cards: at each card, first try to take it, then try to leave it out.
// The first full deal found keeps as many high-ranked cards as possible, so leaving out a higher card
// in favour of a lower one (relaxing recency) is the first thing that gives way.
// Returns null when no deal keeps both the conflict groups and the balance.
function searchWithAllRules(
  ranked: readonly Card[],
  size: number,
  avoid: readonly Card[],
  balance: Balance,
): Card[] | null {
  const trueAfter = suffixCounts(ranked, true);
  const falseAfter = suffixCounts(ranked, false);
  const usedGroups = new Set(avoid.flatMap((card) => card.conflictGroups));
  const picked: Card[] = [];
  let trues = 0;
  let budget = SEARCH_BUDGET;

  const canTake = (card: Card): boolean =>
    !card.conflictGroups.some((group) => usedGroups.has(group)) &&
    balanceAllows(card.answer, trues, picked.length - trues, size, balance);

  const take = (card: Card) => {
    picked.push(card);
    if (card.answer) trues++;
    for (const group of card.conflictGroups) usedGroups.add(group);
  };

  // A card is only taken when none of its groups is in use, so removing them on the way back is safe.
  const putBack = (card: Card) => {
    picked.pop();
    if (card.answer) trues--;
    for (const group of card.conflictGroups) usedGroups.delete(group);
  };

  const canStillFinish = (from: number): boolean => {
    const falses = picked.length - trues;
    return (
      ranked.length - from >= size - picked.length &&
      trues + (trueAfter[from] ?? 0) >= balance.minTrue &&
      falses + (falseAfter[from] ?? 0) >= size - balance.maxTrue
    );
  };

  const visit = (from: number): boolean => {
    if (picked.length === size) return true;
    if (budget-- <= 0 || !canStillFinish(from)) return false;
    const card = ranked[from];
    if (card === undefined) return false;
    if (canTake(card)) {
      take(card);
      if (visit(from + 1)) return true;
      putBack(card);
    }
    return visit(from + 1);
  };

  return visit(0) ? picked : null;
}

// counts[i] is how many of ranked[i..] have the given answer.
function suffixCounts(ranked: readonly Card[], answer: boolean): number[] {
  const counts = new Array<number>(ranked.length + 1).fill(0);
  for (let i = ranked.length - 1; i >= 0; i--) {
    counts[i] = (counts[i + 1] ?? 0) + (ranked[i]?.answer === answer ? 1 : 0);
  }
  return counts;
}

interface Rules {
  conflicts: boolean; // keep conflict groups apart (within the deal and against `avoid`)
  balance: boolean; // keep the number of True cards inside the balance
}

// The fallback when no deal keeps every rule. Three passes over the ranked cards, each adding to the
// cards already picked: all rules, then without conflict groups, then without the balance.
function relaxStepByStep(ranked: readonly Card[], size: number, avoid: readonly Card[], balance: Balance): Card[] {
  const picked: Card[] = [];
  const pickedIds = new Set<string>();

  const breaks = (card: Card, rules: Rules): boolean => {
    if (rules.conflicts && sharesGroup(card, [...avoid, ...picked])) return true;
    if (!rules.balance) return false;
    const trues = trueCount(picked);
    return !balanceAllows(card.answer, trues, picked.length - trues, size, balance);
  };

  const fill = (rules: Rules) => {
    for (const card of ranked) {
      if (picked.length === size) return;
      if (pickedIds.has(card.id) || breaks(card, rules)) continue;
      picked.push(card);
      pickedIds.add(card.id);
    }
  };

  fill({ conflicts: true, balance: true });
  fill({ conflicts: false, balance: true });
  fill({ conflicts: false, balance: false });
  return picked;
}

function sharesGroup(card: Card, others: readonly Card[]): boolean {
  return card.conflictGroups.some((group) => others.some((other) => other.conflictGroups.includes(group)));
}

function trueCount(cards: readonly Card[]): number {
  return cards.filter((card) => card.answer).length;
}

// True cards may not pass maxTrue, and False cards may not pass size - minTrue,
// so a full deal picked under this rule always lands inside the balance.
function balanceAllows(answer: boolean, trues: number, falses: number, size: number, balance: Balance): boolean {
  return answer ? trues < balance.maxTrue : falses < size - balance.minTrue;
}
```

- [ ] **Step 19: Run the tests and watch them pass**

```bash
pnpm vitest run tests/engine/deal.test.ts
```

Expected:

```
 Test Files  1 passed (1)
      Tests  41 passed (41)
```

- [ ] **Step 20: Commit**

```bash
git add src/engine/deal.ts tests/engine/deal.test.ts
git commit -m "feat: keep conflict groups apart and answers balanced when dealing"
```

- [ ] **Step 21: Write the failing tests for the order of the dealt cards**

Append to the end of `tests/engine/deal.test.ts`:

```ts
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
```

- [ ] **Step 22: Run the tests and watch the new ones fail**

```bash
pnpm vitest run tests/engine/deal.test.ts
```

Expected: six of the seven new tests fail ("varies the answer pattern between seeds" already passes because ranking shuffles ties):

```
 FAIL  ... > deal: order > never puts more than three equal answers in a row (200 seeds)
AssertionError: expected 6 to be less than or equal to 3
 FAIL  ... > deal: order > keeps runs of at most three when the balance is at its edge (6 True, 4 False)
 FAIL  ... > deal: order > keeps runs of at most three even with 7 True and 3 False after relaxing the balance
 FAIL  ... > deal: order > makes the longest run as short as it can be when three is impossible: 9 True and 1 False give at most 5
 FAIL  ... > deal: order > keeps runs of at most three over a long deal of twenty
 FAIL  ... > deal: order > shuffles: missed cards are not always dealt first
 Test Files  1 failed (1)
      Tests  6 failed | 42 passed (48)
```

- [ ] **Step 23: Implement the arrangement**

Replace the whole of `src/engine/deal.ts` with the final version:

```ts
// Dealing: which cards a round gets, and in which order (spec section 6, "Dealing").
// Pure: the only source of randomness is the rng passed in.

import type { Card } from "@/src/content/schema";
import { shuffle, type Rng } from "./rng";

export interface CardHistory {
  seen: number;
  lastCorrect: boolean;
  lastSeenAt: number;
}
export type History = Readonly<Record<string, CardHistory>>; // by card id

export const DEAL = { missedPerTen: 3, minTrue: 4, maxTrue: 6, maxRun: 3 } as const;

export interface DealOptions {
  count: number; // how many cards to deal
  avoid?: readonly Card[]; // cards whose conflict groups must not be repeated (unbounded modes pass the last ten; Classic passes nothing)
}

export function deal(pool: readonly Card[], history: History, rng: Rng, options: DealOptions): Card[] {
  const cards = uniqueById(pool);
  const size = dealSize(options.count, cards.length);
  if (size === 0) return [];
  const ranking = rankByPriority(cards, history, rng, size);
  const chosen = choose(ranking, size, options.avoid ?? []);
  return arrange(chosen, rng);
}

// The first card with each id wins, so a card can never be dealt twice.
function uniqueById(pool: readonly Card[]): Card[] {
  const seen = new Set<string>();
  return pool.filter((card) => {
    if (seen.has(card.id)) return false;
    seen.add(card.id);
    return true;
  });
}

function dealSize(count: number, available: number): number {
  if (Number.isNaN(count) || count <= 0) return 0;
  return Math.min(Math.floor(count), available);
}

function wasSeen(card: Card, history: History): boolean {
  const entry = history[card.id];
  return entry !== undefined && entry.seen > 0;
}

function wasMissed(card: Card, history: History): boolean {
  return wasSeen(card, history) && history[card.id]?.lastCorrect === false;
}

function lastSeenAt(card: Card, history: History): number {
  const at = history[card.id]?.lastSeenAt;
  return at !== undefined && Number.isFinite(at) ? at : 0;
}

// Oldest first. Array.prototype.sort is stable, so equal times keep their (shuffled) order.
function oldestFirst(cards: readonly Card[], history: History): Card[] {
  return [...cards].sort((a, b) => lastSeenAt(a, history) - lastSeenAt(b, history));
}

// The pool in the order cards should be considered: missed cards up to the cap (oldest miss first),
// never seen (random), seen longest ago. The missed cards over the cap are kept apart, to be used only
// when a deal cannot be made without them. Shuffling first makes every tie random but reproducible.
interface Ranking {
  withinCap: Card[];
  overCap: Card[];
}

function rankByPriority(cards: readonly Card[], history: History, rng: Rng, size: number): Ranking {
  const shuffled = shuffle(cards, rng);
  const missed = oldestFirst(shuffled.filter((card) => wasMissed(card, history)), history);
  const unseen = shuffled.filter((card) => !wasSeen(card, history));
  const seenRight = oldestFirst(shuffled.filter((card) => wasSeen(card, history) && !wasMissed(card, history)), history);
  const missedCap = Math.floor((size * DEAL.missedPerTen) / 10);
  return {
    withinCap: [...missed.slice(0, missedCap), ...unseen, ...seenRight],
    overCap: missed.slice(missedCap),
  };
}

// How many True cards a deal of `size` may have: 4 to 6 per ten, scaled (floor of 40%, ceiling of 60%).
interface Balance {
  minTrue: number;
  maxTrue: number;
}

function balanceFor(size: number): Balance {
  return {
    minTrue: Math.floor((size * DEAL.minTrue) / 10),
    maxTrue: Math.ceil((size * DEAL.maxTrue) / 10),
  };
}

// Picks `size` cards, relaxing the rules in the order of the spec only as far as needed:
// 1. every rule, without the missed cards over the cap;
// 2. recency: the missed cards over the cap may join, last in line;
// 3. conflict groups, then 4. answer balance (relaxStepByStep).
function choose(ranking: Ranking, size: number, avoid: readonly Card[]): Card[] {
  const balance = balanceFor(size);
  const everyCard = [...ranking.withinCap, ...ranking.overCap];
  return (
    searchWithAllRules(ranking.withinCap, size, avoid, balance) ??
    searchWithAllRules(everyCard, size, avoid, balance) ??
    relaxStepByStep(everyCard, size, avoid, balance)
  );
}

// A bound on the work the search may do. Real decks need a few dozen steps; the bound only matters
// for pools where no deal keeps every rule, and then the relaxed fallback takes over.
const SEARCH_BUDGET = 20_000;

// Depth-first over the ranked cards: at each card, first try to take it, then try to leave it out.
// The first full deal found keeps as many high-ranked cards as possible, so leaving out a higher card
// in favour of a lower one (relaxing recency) is the first thing that gives way.
// Returns null when no deal keeps both the conflict groups and the balance.
function searchWithAllRules(
  ranked: readonly Card[],
  size: number,
  avoid: readonly Card[],
  balance: Balance,
): Card[] | null {
  const trueAfter = suffixCounts(ranked, true);
  const falseAfter = suffixCounts(ranked, false);
  const usedGroups = new Set(avoid.flatMap((card) => card.conflictGroups));
  const picked: Card[] = [];
  let trues = 0;
  let budget = SEARCH_BUDGET;

  const canTake = (card: Card): boolean =>
    !card.conflictGroups.some((group) => usedGroups.has(group)) &&
    balanceAllows(card.answer, trues, picked.length - trues, size, balance);

  const take = (card: Card) => {
    picked.push(card);
    if (card.answer) trues++;
    for (const group of card.conflictGroups) usedGroups.add(group);
  };

  // A card is only taken when none of its groups is in use, so removing them on the way back is safe.
  const putBack = (card: Card) => {
    picked.pop();
    if (card.answer) trues--;
    for (const group of card.conflictGroups) usedGroups.delete(group);
  };

  const canStillFinish = (from: number): boolean => {
    const falses = picked.length - trues;
    return (
      ranked.length - from >= size - picked.length &&
      trues + (trueAfter[from] ?? 0) >= balance.minTrue &&
      falses + (falseAfter[from] ?? 0) >= size - balance.maxTrue
    );
  };

  const visit = (from: number): boolean => {
    if (picked.length === size) return true;
    if (budget-- <= 0 || !canStillFinish(from)) return false;
    const card = ranked[from];
    if (card === undefined) return false;
    if (canTake(card)) {
      take(card);
      if (visit(from + 1)) return true;
      putBack(card);
    }
    return visit(from + 1);
  };

  return visit(0) ? picked : null;
}

// counts[i] is how many of ranked[i..] have the given answer.
function suffixCounts(ranked: readonly Card[], answer: boolean): number[] {
  const counts = new Array<number>(ranked.length + 1).fill(0);
  for (let i = ranked.length - 1; i >= 0; i--) {
    counts[i] = (counts[i + 1] ?? 0) + (ranked[i]?.answer === answer ? 1 : 0);
  }
  return counts;
}

interface Rules {
  conflicts: boolean; // keep conflict groups apart (within the deal and against `avoid`)
  balance: boolean; // keep the number of True cards inside the balance
}

// The fallback when no deal keeps every rule. Three passes over the ranked cards, each adding to the
// cards already picked: all rules, then without conflict groups, then without the balance.
function relaxStepByStep(ranked: readonly Card[], size: number, avoid: readonly Card[], balance: Balance): Card[] {
  const picked: Card[] = [];
  const pickedIds = new Set<string>();

  const breaks = (card: Card, rules: Rules): boolean => {
    if (rules.conflicts && sharesGroup(card, [...avoid, ...picked])) return true;
    if (!rules.balance) return false;
    const trues = trueCount(picked);
    return !balanceAllows(card.answer, trues, picked.length - trues, size, balance);
  };

  const fill = (rules: Rules) => {
    for (const card of ranked) {
      if (picked.length === size) return;
      if (pickedIds.has(card.id) || breaks(card, rules)) continue;
      picked.push(card);
      pickedIds.add(card.id);
    }
  };

  fill({ conflicts: true, balance: true });
  fill({ conflicts: false, balance: true });
  fill({ conflicts: false, balance: false });
  return picked;
}

function sharesGroup(card: Card, others: readonly Card[]): boolean {
  return card.conflictGroups.some((group) => others.some((other) => other.conflictGroups.includes(group)));
}

function trueCount(cards: readonly Card[]): number {
  return cards.filter((card) => card.answer).length;
}

// True cards may not pass maxTrue, and False cards may not pass size - minTrue,
// so a full deal picked under this rule always lands inside the balance.
function balanceAllows(answer: boolean, trues: number, falses: number, size: number, balance: Balance): boolean {
  return answer ? trues < balance.maxTrue : falses < size - balance.minTrue;
}

// Puts the chosen cards in a random order with no run of equal answers longer than the run limit.
// Position by position, it draws True or False in proportion to how many of each are left, among the
// answers that still allow the rest to be placed; then it takes the next card of that answer.
function arrange(chosen: readonly Card[], rng: Rng): Card[] {
  const trues = shuffle(chosen.filter((card) => card.answer), rng);
  const falses = shuffle(chosen.filter((card) => !card.answer), rng);
  const limit = runLimit(trues.length, falses.length);
  const canPlace = placementCheck(limit);
  const order: Card[] = [];
  let last: boolean | null = null;
  let run = 0;

  while (trues.length + falses.length > 0) {
    const allowed = [true, false].filter((answer) => {
      const left = answer ? trues.length : falses.length;
      if (left === 0 || (answer === last && run >= limit)) return false;
      const nextRun = answer === last ? run + 1 : 1;
      return canPlace(trues.length - (answer ? 1 : 0), falses.length - (answer ? 0 : 1), answer, nextRun);
    });
    const answer = pickAnswer(allowed, trues.length, falses.length, rng);
    const card = answer ? trues.shift() : falses.shift();
    if (card === undefined) break;
    order.push(card);
    run = answer === last ? run + 1 : 1;
    last = answer;
  }
  return order;
}

// The run limit is DEAL.maxRun, unless the answers are so uneven that no order can keep it
// (all True, or 9 True and 1 False); then it is the shortest longest run that is possible.
// The majority can be split into at most minority + 1 runs.
function runLimit(trues: number, falses: number): number {
  const majority = Math.max(trues, falses);
  const minority = Math.min(trues, falses);
  return Math.max(DEAL.maxRun, Math.ceil(majority / (minority + 1)));
}

// canPlace(t, f, last, run): can t True and f False cards still be placed after a run of `run` cards
// with answer `last`, without any run passing the limit? Memoised, so a whole deal costs little.
function placementCheck(limit: number): (t: number, f: number, last: boolean, run: number) => boolean {
  const memo = new Map<string, boolean>();
  const canPlace = (t: number, f: number, last: boolean, run: number): boolean => {
    if (t === 0 && f === 0) return true;
    const key = `${t},${f},${last},${run}`;
    const known = memo.get(key);
    if (known !== undefined) return known;
    const result =
      (t > 0 && (last !== true || run < limit) && canPlace(t - 1, f, true, last === true ? run + 1 : 1)) ||
      (f > 0 && (last !== false || run < limit) && canPlace(t, f - 1, false, last === false ? run + 1 : 1));
    memo.set(key, result);
    return result;
  };
  return canPlace;
}

// Chooses between the allowed answers in proportion to the cards left of each.
// The run limit always leaves at least one allowed answer; the empty case is only a guard.
function pickAnswer(allowed: readonly boolean[], trues: number, falses: number, rng: Rng): boolean {
  if (allowed.length === 0) return trues > 0;
  if (allowed.length === 1) return allowed[0] === true;
  return rng() * (trues + falses) < trues;
}
```

- [ ] **Step 24: Run the tests and watch them pass**

```bash
pnpm vitest run tests/engine/deal.test.ts
```

Expected:

```
 Test Files  1 passed (1)
      Tests  48 passed (48)
```

- [ ] **Step 25: Commit**

```bash
git add src/engine/deal.ts tests/engine/deal.test.ts
git commit -m "feat: order dealt cards with at most three equal answers in a row"
```

- [ ] **Step 26: Write the property test over generated pools**

This test checks every rule at once over 100 generated sections of 36 to 44 cards (a third of them in one or two of ten conflict groups, a mixed history), ten deal seeds each, with and without `avoid`, and for twenty cards. The generator is seeded, so any failure names a pool that can be rebuilt. Each pool has 16 group-free, evenly split cards, so a deal that keeps every rule always exists and the assertions can be strict.

Create `tests/engine/deal.property.test.ts`:

```ts
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
```

- [ ] **Step 27: Run the property test**

```bash
pnpm vitest run tests/engine/deal.property.test.ts
```

Expected: it passes against the dealer from step 23 (it guards the rules together, it does not drive new code).

```
 Test Files  1 passed (1)
      Tests  4 passed (4)
```

If it ever fails, the message names the broken rule; rebuild the pool with `scenario(<poolSeed>)` and the deal with `createRng(<dealSeed>)` to reproduce it.

- [ ] **Step 28: Commit**

```bash
git add tests/engine/deal.property.test.ts
git commit -m "test: check every dealing rule over generated pools"
```

- [ ] **Step 29: Add the review focus tests for dealing**

Two conditions a player can hit that the tests above do not pin: a small section where some conflicts cannot be avoided (the real Next.js sections have 11 or 12 cards, and four of them, REQ, STR, DAT and REV, cannot be dealt without a shared group), and a card history with corrupt numbers. Append to the end of `tests/engine/deal.test.ts`:

```ts
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
```

- [ ] **Step 30: Run all engine dealing tests and the type check**

```bash
pnpm vitest run tests/engine/rng.test.ts tests/engine/deal.test.ts tests/engine/deal.property.test.ts
pnpm typecheck
```

Expected: the two new tests pass against the dealer from step 23 (the fallback keeps as many cards out of a group as it can; `wasSeen` treats `seen <= 0` and `NaN` as never seen; `lastSeenAt` that is not finite sorts as 0), and the type check prints no errors.

```
 Test Files  3 passed (3)
      Tests  69 passed (69)
```

- [ ] **Step 31: Commit**

```bash
git add tests/engine/deal.test.ts
git commit -m "test: cover unavoidable conflicts and corrupt history in dealing"
```

### Task 5: Engine: the round

`src/engine/round.ts` is the round as a pure reducer: `startRound` deals the cards from a seed, `reduce(state, event)` moves through the phases, and `summarise` turns a finished or abandoned round into the result that task 6 records and task 12 shows. Delivery step 1 of the spec (this plan) ships Classic only; the other modes are rejected by `startRound` until delivery step 2 adds them to `AVAILABLE_MODES`.

Phases for Classic: `question` (card on screen) to `answered` (verdict visible) on `answer`, then to the next card's `question` on `next`, or to `finished` after the last card. `abandon` ends any unfinished round as `finished` with `abandoned: true`. Every event that does not apply to the current phase is ignored, and `reduce` then returns the very same state object (so React skips the re-render).

Every command below runs from the repository root, `~/Desktop/workspace/truthy`.

**Files:**
- Create: `src/engine/round.ts`
- Test: `tests/engine/round.test.ts`

**Interfaces:**
- Consumes: from task 3, `Card` and `Route` from `@/src/content/schema` (`interface Route { deckId: string; sectionId: string }`). From task 4, `deal`, `History` from `@/src/engine/deal` and `createRng` from `@/src/engine/rng`:

```ts
export function deal(pool: readonly Card[], history: History, rng: Rng, options: { count: number; avoid?: readonly Card[] }): Card[];
export function createRng(seed: number): Rng;
```

- Produces (exactly as in the contract):

```ts
export type Mode = "classic" | "streak" | "lives" | "timed";
export const AVAILABLE_MODES: readonly Mode[] = ["classic"];
export const CLASSIC_LENGTH = 10;
export interface Answered { card: Card; given: boolean; correct: boolean; at: number }
export type Phase = "question" | "answered" | "finished";
export interface RoundState { mode: Mode; route: Route; cards: readonly Card[]; index: number; answers: readonly Answered[]; phase: Phase; abandoned: boolean }
export type RoundEvent = { type: "answer"; value: boolean; at: number } | { type: "next" } | { type: "abandon" };
export interface StartArgs { mode: Mode; route: Route; pool: readonly Card[]; history: History; seed: number }
export function startRound(args: StartArgs): RoundState;
export function reduce(state: RoundState, event: RoundEvent): RoundState;
export function currentCard(state: RoundState): Card | undefined;
export function lastAnswer(state: RoundState): Answered | undefined;
export interface RoundResult { mode: Mode; route: Route; score: number; total: number; answers: readonly Answered[]; missed: readonly Answered[]; abandoned: boolean }
export function summarise(state: RoundState): RoundResult;
```

Exact semantics that tasks 11 and 12 rely on:
- `startRound` throws an `Error` whose message contains `not available` for a mode outside `AVAILABLE_MODES`, and one containing `no cards` for an empty pool. Otherwise it deals `min(10, distinct cards in the pool)` cards with `deal(pool, history, createRng(seed), { count: 10 })` and starts at index 0 in `question`.
- `currentCard` is the card at `index` in `question` and `answered`, and `undefined` once `finished`. On a normal finish `index` stays on the last card.
- `lastAnswer` is the last element of `answers` (the verdict to show in `answered`), or `undefined` before the first answer.
- Ignored events return the same object: `answer` outside `question`, `next` outside `answered`, `abandon` in `finished`, and any unknown event type.
- `summarise`: `score` is the number of correct answers, `total` the number of answers given (10 for a finished Classic round from a large pool, fewer for a small pool or an abandoned round), `missed` the wrong answers in order, `abandoned` copied from the state. Task 6 must not set a record when `abandoned` is true.

- [ ] **Step 1: Write the failing tests for starting a round**

Create `tests/engine/round.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Card, Route } from "@/src/content/schema";
import type { History } from "@/src/engine/deal";
import {
  AVAILABLE_MODES,
  CLASSIC_LENGTH,
  currentCard,
  lastAnswer,
  startRound,
  type Mode,
  type StartArgs,
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

function start(overrides: Partial<StartArgs> = {}) {
  return startRound({ mode: "classic", route, pool: pool(40), history: {}, seed: 1, ...overrides });
}

describe("round constants", () => {
  it("offers only Classic in step 1, with ten cards", () => {
    expect(AVAILABLE_MODES).toEqual(["classic"]);
    expect(CLASSIC_LENGTH).toBe(10);
  });
});

describe("startRound", () => {
  it("starts a Classic round on the first card, in the question phase, with no answers", () => {
    const state = start();
    expect(state.mode).toBe("classic");
    expect(state.route).toEqual(route);
    expect(state.cards).toHaveLength(10);
    expect(state.index).toBe(0);
    expect(state.answers).toEqual([]);
    expect(state.phase).toBe("question");
    expect(state.abandoned).toBe(false);
  });

  it("deals ten different cards from the pool", () => {
    const state = start();
    expect(new Set(state.cards.map((c) => c.id)).size).toBe(10);
  });

  it.each([1, 4, 9])("deals the whole pool when it has only %i cards", (n) => {
    expect(start({ pool: pool(n) }).cards).toHaveLength(n);
  });

  it("deals exactly ten from a pool of exactly ten or eleven", () => {
    expect(start({ pool: pool(10) }).cards).toHaveLength(10);
    expect(start({ pool: pool(11) }).cards).toHaveLength(10);
  });

  it("deals the same round for the same seed and a different one for another seed", () => {
    const ids = (seed: number) => start({ seed }).cards.map((c) => c.id);
    expect(ids(5)).toEqual(ids(5));
    expect(new Set([1, 2, 3, 4, 5].map((seed) => ids(seed).join(","))).size).toBeGreaterThan(1);
  });

  it("passes the history to the dealer: the cards answered wrong come back", () => {
    const history: History = {
      c1: { seen: 1, lastCorrect: false, lastSeenAt: 1 },
      c2: { seen: 1, lastCorrect: false, lastSeenAt: 2 },
    };
    const ids = start({ history }).cards.map((c) => c.id);
    expect(ids).toContain("c1");
    expect(ids).toContain("c2");
  });

  it("does not change the pool it is given", () => {
    const frozen = Object.freeze(pool(20));
    expect(() => start({ pool: frozen })).not.toThrow();
    expect(frozen.map((c) => c.id)).toEqual(pool(20).map((c) => c.id));
  });

  it.each(["streak", "lives", "timed"] as const)("rejects the %s mode, which is not available yet", (mode) => {
    expect(() => start({ mode })).toThrow(/not available/);
  });

  it("rejects a mode it does not know", () => {
    expect(() => start({ mode: "sudden-death" as Mode })).toThrow(/not available/);
  });

  it("rejects an empty pool", () => {
    expect(() => start({ pool: [] })).toThrow(/no cards/);
  });
});

describe("currentCard and lastAnswer at the start", () => {
  it("shows the first dealt card and no answer yet", () => {
    const state = start();
    expect(currentCard(state)).toBe(state.cards[0]);
    expect(lastAnswer(state)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

```bash
pnpm vitest run tests/engine/round.test.ts
```

Expected:

```
 FAIL  tests/engine/round.test.ts [ tests/engine/round.test.ts ]
Error: Cannot find package '@/src/engine/round' imported from .../truthy/tests/engine/round.test.ts
 Test Files  1 failed (1)
      Tests  no tests
```

- [ ] **Step 3: Implement the types, startRound, currentCard and lastAnswer**

Create `src/engine/round.ts`:

```ts
// The round: a pure reducer over the dealt cards (spec section 6, "Shape" and "Modes").
// Randomness comes only from the seed given to startRound; time comes in on the events.

import type { Card, Route } from "@/src/content/schema";
import { deal, type History } from "./deal";
import { createRng } from "./rng";

export type Mode = "classic" | "streak" | "lives" | "timed";
export const AVAILABLE_MODES: readonly Mode[] = ["classic"]; // step 1
export const CLASSIC_LENGTH = 10;

export interface Answered {
  card: Card;
  given: boolean;
  correct: boolean;
  at: number;
}
export type Phase = "question" | "answered" | "finished";

export interface RoundState {
  mode: Mode;
  route: Route;
  cards: readonly Card[]; // the dealt cards
  index: number; // index of the current card
  answers: readonly Answered[];
  phase: Phase;
  abandoned: boolean;
}

export type RoundEvent = { type: "answer"; value: boolean; at: number } | { type: "next" } | { type: "abandon" };

export interface StartArgs {
  mode: Mode;
  route: Route;
  pool: readonly Card[];
  history: History;
  seed: number;
}

// Throws if the mode is not in AVAILABLE_MODES or the pool is empty.
export function startRound(args: StartArgs): RoundState {
  if (!AVAILABLE_MODES.includes(args.mode)) {
    throw new Error(`The mode "${args.mode}" is not available.`);
  }
  if (args.pool.length === 0) {
    throw new Error(`The route ${args.route.deckId}/${args.route.sectionId} has no cards to deal.`);
  }
  const cards = deal(args.pool, args.history, createRng(args.seed), { count: CLASSIC_LENGTH });
  return { mode: args.mode, route: args.route, cards, index: 0, answers: [], phase: "question", abandoned: false };
}

// The card on screen; undefined once the round is finished.
export function currentCard(state: RoundState): Card | undefined {
  return state.phase === "finished" ? undefined : state.cards[state.index];
}

export function lastAnswer(state: RoundState): Answered | undefined {
  return state.answers[state.answers.length - 1];
}
```

- [ ] **Step 4: Run the tests and watch them pass**

```bash
pnpm vitest run tests/engine/round.test.ts
```

Expected:

```
 Test Files  1 passed (1)
      Tests  16 passed (16)
```

- [ ] **Step 5: Commit**

```bash
git add src/engine/round.ts tests/engine/round.test.ts
git commit -m "feat: start a Classic round from a seeded deal"
```

- [ ] **Step 6: Write the failing tests for answering and moving through the round**

In `tests/engine/round.test.ts`, replace the import block from `@/src/engine/round` with:

```ts
import {
  AVAILABLE_MODES,
  CLASSIC_LENGTH,
  currentCard,
  lastAnswer,
  reduce,
  startRound,
  type Mode,
  type RoundEvent,
  type RoundState,
  type StartArgs,
} from "@/src/engine/round";
```

Then append to the end of the file:

```ts
// Freezes the state and everything in it, so any mutation inside reduce throws (modules run in strict mode).
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const inner of Object.values(value)) deepFreeze(inner);
  }
  return value;
}

// Applies the events one by one, freezing every state before it is handed to reduce.
function play(state: RoundState, events: readonly RoundEvent[]): RoundState {
  return events.reduce((s, event) => reduce(deepFreeze(s), event), state);
}

const answer = (value: boolean, at = 1000): RoundEvent => ({ type: "answer", value, at });
const NEXT: RoundEvent = { type: "next" };

// Answers the current card correctly and moves on.
function answerRight(state: RoundState, at = 1000): RoundEvent[] {
  return [answer(currentCard(state)?.answer ?? true, at), NEXT];
}

describe("reduce: the question phase", () => {
  it("records a right answer and shows the verdict", () => {
    const state = deepFreeze(start());
    const first = state.cards[0] as Card;
    const after = reduce(state, answer(first.answer, 1234));
    expect(after.phase).toBe("answered");
    expect(after.index).toBe(0);
    expect(after.answers).toEqual([{ card: first, given: first.answer, correct: true, at: 1234 }]);
    expect(lastAnswer(after)).toEqual({ card: first, given: first.answer, correct: true, at: 1234 });
  });

  it("records a wrong answer as not correct", () => {
    const state = deepFreeze(start());
    const first = state.cards[0] as Card;
    const after = reduce(state, answer(!first.answer, 50));
    expect(after.answers).toEqual([{ card: first, given: !first.answer, correct: false, at: 50 }]);
  });

  it("keeps the card on screen while the verdict shows", () => {
    const state = deepFreeze(start());
    expect(currentCard(reduce(state, answer(true)))).toBe(state.cards[0]);
  });

  it("ignores next before the card is answered", () => {
    const state = deepFreeze(start());
    expect(reduce(state, NEXT)).toBe(state);
  });

  it("ignores an event it does not know", () => {
    const state = deepFreeze(start());
    expect(reduce(state, { type: "tick", now: 5 } as unknown as RoundEvent)).toBe(state);
  });
});

describe("reduce: the answered phase", () => {
  it("ignores a second answer to the same card (a double tap)", () => {
    const answered = play(start(), [answer(true, 10)]);
    const again = reduce(deepFreeze(answered), answer(false, 20));
    expect(again).toBe(answered);
    expect(again.answers).toHaveLength(1);
  });

  it("moves to the next card on next", () => {
    const state = start();
    const after = play(state, [answer(true), NEXT]);
    expect(after.phase).toBe("question");
    expect(after.index).toBe(1);
    expect(currentCard(after)).toBe(state.cards[1]);
  });
});

describe("reduce: a whole Classic round", () => {
  it("finishes after the tenth card, not before", () => {
    let state = start();
    for (let i = 0; i < 9; i++) state = play(state, answerRight(state));
    expect(state.phase).toBe("question");
    expect(state.index).toBe(9);
    state = play(state, [answer(true)]);
    expect(state.phase).toBe("answered");
    state = play(state, [NEXT]);
    expect(state.phase).toBe("finished");
    expect(state.answers).toHaveLength(10);
    expect(state.abandoned).toBe(false);
    expect(currentCard(state)).toBeUndefined();
  });

  it("finishes after the last card when the pool has fewer than ten", () => {
    let state = start({ pool: pool(3) });
    for (let i = 0; i < 3; i++) state = play(state, answerRight(state));
    expect(state.phase).toBe("finished");
    expect(state.answers).toHaveLength(3);
  });

  it("finishes a round of a single card", () => {
    const state = play(start({ pool: pool(1) }), [answer(false), NEXT]);
    expect(state.phase).toBe("finished");
    expect(state.answers).toHaveLength(1);
  });

  it("records every card once, in the order dealt", () => {
    let state = start();
    for (let i = 0; i < 10; i++) state = play(state, [answer(i % 3 === 0, 100 + i), NEXT]);
    expect(state.answers.map((a) => a.card)).toEqual(state.cards);
    expect(state.answers.map((a) => a.at)).toEqual([100, 101, 102, 103, 104, 105, 106, 107, 108, 109]);
  });

  it("ignores answer and next once finished", () => {
    let state = start({ pool: pool(2) });
    state = play(state, [answer(true), NEXT, answer(true), NEXT]);
    const finished = deepFreeze(state);
    expect(reduce(finished, answer(true))).toBe(finished);
    expect(reduce(finished, NEXT)).toBe(finished);
  });

  it("never mutates the state it is given (every state is frozen before reduce)", () => {
    const state = start();
    const snapshot = JSON.stringify(state);
    expect(() => play(state, [answer(true), NEXT, answer(false), NEXT])).not.toThrow();
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});
```

- [ ] **Step 7: Run the tests and watch the new ones fail**

```bash
pnpm vitest run tests/engine/round.test.ts
```

Expected: all 13 new tests fail because `reduce` does not exist yet.

```
 FAIL  tests/engine/round.test.ts > reduce: the question phase > records a right answer and shows the verdict
TypeError: reduce is not a function
...
 Test Files  1 failed (1)
      Tests  13 failed | 16 passed (29)
```

- [ ] **Step 8: Implement reduce for answer and next**

Append to the end of `src/engine/round.ts`:

```ts
// Pure: returns a new state, or the very same state when the event does not apply to the phase.
export function reduce(state: RoundState, event: RoundEvent): RoundState {
  switch (event.type) {
    case "answer":
      return state.phase === "question" ? recordAnswer(state, event.value, event.at) : state;
    case "next":
      return state.phase === "answered" ? moveOn(state) : state;
    default:
      return state;
  }
}

function recordAnswer(state: RoundState, given: boolean, at: number): RoundState {
  const card = currentCard(state);
  if (card === undefined) return state;
  const answered: Answered = { card, given, correct: given === card.answer, at };
  return { ...state, answers: [...state.answers, answered], phase: "answered" };
}

// To the next card, or to the end after the last one. The index stays on the last card when finished.
function moveOn(state: RoundState): RoundState {
  const nextIndex = state.index + 1;
  if (nextIndex >= state.cards.length) return { ...state, phase: "finished" };
  return { ...state, index: nextIndex, phase: "question" };
}
```

- [ ] **Step 9: Run the tests and watch them pass**

```bash
pnpm vitest run tests/engine/round.test.ts
```

Expected:

```
 Test Files  1 passed (1)
      Tests  29 passed (29)
```

- [ ] **Step 10: Commit**

```bash
git add src/engine/round.ts tests/engine/round.test.ts
git commit -m "feat: answer and move through a Classic round"
```

- [ ] **Step 11: Write the failing tests for abandoning and summarising**

In `tests/engine/round.test.ts`, add `summarise,` to the import block, directly after `startRound,`:

```ts
import {
  AVAILABLE_MODES,
  CLASSIC_LENGTH,
  currentCard,
  lastAnswer,
  reduce,
  startRound,
  summarise,
  type Mode,
  type RoundEvent,
  type RoundState,
  type StartArgs,
} from "@/src/engine/round";
```

Then append to the end of the file:

```ts
const ABANDON: RoundEvent = { type: "abandon" };

describe("reduce: abandon", () => {
  it("ends the round as abandoned from the question phase, keeping the answers given", () => {
    const state = play(start(), [answer(true), NEXT, ABANDON]);
    expect(state.phase).toBe("finished");
    expect(state.abandoned).toBe(true);
    expect(state.answers).toHaveLength(1);
  });

  it("ends the round as abandoned from the answered phase", () => {
    const state = play(start(), [answer(true), ABANDON]);
    expect(state.phase).toBe("finished");
    expect(state.abandoned).toBe(true);
    expect(state.answers).toHaveLength(1);
  });

  it("ends the round as abandoned before any answer", () => {
    const state = play(start(), [ABANDON]);
    expect(state.phase).toBe("finished");
    expect(state.abandoned).toBe(true);
    expect(state.answers).toEqual([]);
  });

  it("can abandon at every point of a round", () => {
    const events: RoundEvent[] = [];
    let state = start();
    for (let i = 0; i < 10; i++) {
      events.push(answer(true), NEXT);
    }
    for (let cut = 0; cut < events.length; cut++) {
      const left = play(state, [...events.slice(0, cut), ABANDON]);
      expect(left.abandoned).toBe(true);
      expect(left.phase).toBe("finished");
      expect(left.answers).toHaveLength(Math.ceil(cut / 2));
    }
    state = play(state, events);
    expect(state.abandoned).toBe(false);
  });

  it("ignores abandon once the round has finished normally", () => {
    const finished = deepFreeze(play(start({ pool: pool(1) }), [answer(true), NEXT]));
    expect(reduce(finished, ABANDON)).toBe(finished);
  });

  it("ignores answer and next after abandoning", () => {
    const left = deepFreeze(play(start(), [ABANDON]));
    expect(reduce(left, answer(true))).toBe(left);
    expect(reduce(left, NEXT)).toBe(left);
    expect(reduce(left, ABANDON)).toBe(left);
  });
});

describe("summarise", () => {
  it("scores a finished Classic round: correct answers out of ten, missed cards in order", () => {
    let state = start();
    const wrongAt = new Set([2, 5, 7]);
    for (let i = 0; i < 10; i++) {
      const right = currentCard(state)?.answer ?? true;
      state = play(state, [answer(wrongAt.has(i) ? !right : right, 500 + i), NEXT]);
    }
    const result = summarise(state);
    expect(result.mode).toBe("classic");
    expect(result.route).toEqual(route);
    expect(result.score).toBe(7);
    expect(result.total).toBe(10);
    expect(result.answers).toHaveLength(10);
    expect(result.missed.map((a) => a.card)).toEqual([state.cards[2], state.cards[5], state.cards[7]]);
    expect(result.missed.every((a) => !a.correct)).toBe(true);
    expect(result.abandoned).toBe(false);
  });

  it("scores a perfect round with no missed cards", () => {
    let state = start();
    for (let i = 0; i < 10; i++) state = play(state, answerRight(state));
    expect(summarise(state)).toMatchObject({ score: 10, total: 10, missed: [], abandoned: false });
  });

  it("scores a round of a small pool out of the cards it had", () => {
    let state = start({ pool: pool(4) });
    for (let i = 0; i < 4; i++) state = play(state, answerRight(state));
    expect(summarise(state)).toMatchObject({ score: 4, total: 4, abandoned: false });
  });

  it("summarises an abandoned round with the answers given so far", () => {
    let state = start();
    const first = currentCard(state) as Card;
    state = play(state, [answer(!first.answer, 1), NEXT]);
    state = play(state, answerRight(state));
    state = play(state, [ABANDON]);
    const result = summarise(state);
    expect(result).toMatchObject({ score: 1, total: 2, abandoned: true });
    expect(result.missed.map((a) => a.card)).toEqual([first]);
  });

  it("summarises a round abandoned before any answer as zero out of zero", () => {
    expect(summarise(play(start(), [ABANDON]))).toMatchObject({ score: 0, total: 0, answers: [], missed: [], abandoned: true });
  });

  it("does not change the state it summarises", () => {
    const state = deepFreeze(play(start(), [answer(true), NEXT]));
    expect(() => summarise(state)).not.toThrow();
  });
});
```

- [ ] **Step 12: Run the tests and watch the new ones fail**

```bash
pnpm vitest run tests/engine/round.test.ts
```

Expected: 11 of the 12 new tests fail ("ignores abandon once the round has finished normally" already passes, since unknown events are ignored):

```
 FAIL  ... > reduce: abandon > ends the round as abandoned from the question phase, keeping the answers given
AssertionError: expected 'question' to be 'finished' // Object.is equality
 FAIL  ... > reduce: abandon > ends the round as abandoned from the answered phase
 FAIL  ... > reduce: abandon > ends the round as abandoned before any answer
 FAIL  ... > reduce: abandon > can abandon at every point of a round
 FAIL  ... > reduce: abandon > ignores answer and next after abandoning
 FAIL  ... > summarise > scores a finished Classic round: correct answers out of ten, missed cards in order
TypeError: summarise is not a function
 FAIL  ... > summarise > scores a perfect round with no missed cards
 FAIL  ... > summarise > scores a round of a small pool out of the cards it had
 FAIL  ... > summarise > summarises an abandoned round with the answers given so far
 FAIL  ... > summarise > summarises a round abandoned before any answer as zero out of zero
 FAIL  ... > summarise > does not change the state it summarises
 Test Files  1 failed (1)
      Tests  11 failed | 30 passed (41)
```

- [ ] **Step 13: Implement abandon and summarise**

Replace the whole of `src/engine/round.ts` with the final version:

```ts
// The round: a pure reducer over the dealt cards (spec section 6, "Shape" and "Modes").
// Randomness comes only from the seed given to startRound; time comes in on the events.

import type { Card, Route } from "@/src/content/schema";
import { deal, type History } from "./deal";
import { createRng } from "./rng";

export type Mode = "classic" | "streak" | "lives" | "timed";
export const AVAILABLE_MODES: readonly Mode[] = ["classic"]; // step 1
export const CLASSIC_LENGTH = 10;

export interface Answered {
  card: Card;
  given: boolean;
  correct: boolean;
  at: number;
}
export type Phase = "question" | "answered" | "finished";

export interface RoundState {
  mode: Mode;
  route: Route;
  cards: readonly Card[]; // the dealt cards
  index: number; // index of the current card
  answers: readonly Answered[];
  phase: Phase;
  abandoned: boolean;
}

export type RoundEvent = { type: "answer"; value: boolean; at: number } | { type: "next" } | { type: "abandon" };

export interface StartArgs {
  mode: Mode;
  route: Route;
  pool: readonly Card[];
  history: History;
  seed: number;
}

// Throws if the mode is not in AVAILABLE_MODES or the pool is empty.
export function startRound(args: StartArgs): RoundState {
  if (!AVAILABLE_MODES.includes(args.mode)) {
    throw new Error(`The mode "${args.mode}" is not available.`);
  }
  if (args.pool.length === 0) {
    throw new Error(`The route ${args.route.deckId}/${args.route.sectionId} has no cards to deal.`);
  }
  const cards = deal(args.pool, args.history, createRng(args.seed), { count: CLASSIC_LENGTH });
  return { mode: args.mode, route: args.route, cards, index: 0, answers: [], phase: "question", abandoned: false };
}

// The card on screen; undefined once the round is finished.
export function currentCard(state: RoundState): Card | undefined {
  return state.phase === "finished" ? undefined : state.cards[state.index];
}

export function lastAnswer(state: RoundState): Answered | undefined {
  return state.answers[state.answers.length - 1];
}

// Pure: returns a new state, or the very same state when the event does not apply to the phase.
export function reduce(state: RoundState, event: RoundEvent): RoundState {
  switch (event.type) {
    case "answer":
      return state.phase === "question" ? recordAnswer(state, event.value, event.at) : state;
    case "next":
      return state.phase === "answered" ? moveOn(state) : state;
    case "abandon":
      return state.phase === "finished" ? state : { ...state, phase: "finished", abandoned: true };
    default:
      return state;
  }
}

function recordAnswer(state: RoundState, given: boolean, at: number): RoundState {
  const card = currentCard(state);
  if (card === undefined) return state;
  const answered: Answered = { card, given, correct: given === card.answer, at };
  return { ...state, answers: [...state.answers, answered], phase: "answered" };
}

// To the next card, or to the end after the last one. The index stays on the last card when finished.
function moveOn(state: RoundState): RoundState {
  const nextIndex = state.index + 1;
  if (nextIndex >= state.cards.length) return { ...state, phase: "finished" };
  return { ...state, index: nextIndex, phase: "question" };
}

export interface RoundResult {
  mode: Mode;
  route: Route;
  score: number; // classic: correct answers
  total: number; // classic: cards answered (10 when finished)
  answers: readonly Answered[];
  missed: readonly Answered[]; // answers with correct === false, in order
  abandoned: boolean;
}

export function summarise(state: RoundState): RoundResult {
  return {
    mode: state.mode,
    route: state.route,
    score: state.answers.filter((a) => a.correct).length,
    total: state.answers.length,
    answers: state.answers,
    missed: state.answers.filter((a) => !a.correct),
    abandoned: state.abandoned,
  };
}
```

- [ ] **Step 14: Run the tests and watch them pass**

```bash
pnpm vitest run tests/engine/round.test.ts
```

Expected:

```
 Test Files  1 passed (1)
      Tests  41 passed (41)
```

- [ ] **Step 15: Commit**

```bash
git add src/engine/round.ts tests/engine/round.test.ts
git commit -m "feat: abandon a round and summarise its result"
```

- [ ] **Step 16: Add the review focus test for the round**

The deck build (task 3) does not reject a card id that appears twice, so a deck file can reach the round with a repeated card. The round must then be a round of the distinct cards. Append to the end of `tests/engine/round.test.ts`:

```ts
describe("round: review focus", () => {
  it("plays a pool that lists a card twice as a round of its distinct cards, each answered once", () => {
    const twice = [...pool(6), ...pool(6)];
    let state = start({ pool: twice });
    expect(state.cards).toHaveLength(6);
    for (let i = 0; i < 6; i++) state = play(state, answerRight(state));
    expect(state.phase).toBe("finished");
    expect(new Set(state.answers.map((a) => a.card.id)).size).toBe(6);
    expect(summarise(state)).toMatchObject({ score: 6, total: 6 });
  });
});
```

- [ ] **Step 17: Run every engine test and the type check**

```bash
pnpm vitest run tests/engine
pnpm typecheck
```

Expected: the new test passes against the round from step 13 (the dealer drops repeated ids), every engine test passes and the type check prints no errors.

```
 Test Files  4 passed (4)
      Tests  111 passed (111)
```

- [ ] **Step 18: Commit**

```bash
git add tests/engine/round.test.ts
git commit -m "test: cover a pool that lists a card twice in a round"
```

### Review focus candidates

Inputs and conditions the spec implies, that a player can hit, and that the tests before the review steps did not cover. Each now has a test.

1. **A small section where conflicts cannot be avoided.** The real Next.js sections have 11 or 12 cards; in REQ, STR, DAT and REV (measured in the spike on `public/decks/nextjs-rendering.json`) every Classic round must contain two cards of one group. The dealer must still deal ten and put as few cards of a group together as possible. Covered by task 4, step 29 ("deals 10 of a 12-card section whose four cards share a group with exactly two of them").
2. **A card history with corrupt numbers** (`NaN` or infinite `lastSeenAt`, `seen` of zero, negative or `NaN`), for example after a storage format slip that `parseProgress` lets through. The dealer must still deal a full, valid, deterministic round. Covered by task 4, step 29 ("still deals a full, valid round from a history with corrupt numbers").
3. **A deck that lists a card id twice.** Nothing upstream rejects it today, so the round must play the distinct cards once each and finish after them. Covered by task 5, step 16 ("plays a pool that lists a card twice as a round of its distinct cards, each answered once").
