### Task 5: Golden vectors of the dealing: deal, dealChunk and their internal steps

Dealing is where one draw out of order changes every card after it (spec section 11, risk 1), so the native engines get the most vectors here. This task writes the producer `golden()` of `scripts/native/golden/deal.ts`: 27 golden files for `src/engine/deal.ts`, one per function and constant of reference 3.9 (row "deal"). `deal` and `dealChunk` get every scenario of the nine dealing test files (the exact reference vectors whole, the property loops sampled), cases on the shipped decks, the `budget = Infinity` call of the shipped dealing test, and the corrupt history numbers. Each internal step that reference 3.9 lists as ported (`dealRanked`, `rankByPriority`, `choose`, `arrange` and the rest) gets a file of its own, recorded step by step on the reference scenarios plus tables that reach every branch, so a Swift or Kotlin port that deals differently can be told which step went wrong. To call the internal steps, `src/engine/deal.ts` exports them in one object, `dealInternals`, used only by this producer.

Nothing is written to disk here: `golden()` returns the files and task 9 writes and checks `native-data/`. Every output comes from running the TypeScript; only inputs are written by hand. Two tests run every case again from its decoded input, which is exactly what plans B and C do, so an input that does not describe its call fails here and not on a phone.

Builds on: task 3 (the shipped deck files, `native-data/decks/<id>.json`, whose `cards` array is what `{"$deck": id}` means: the `buildDecks` output in file order) and task 4 (`scripts/native/golden/format.ts` and `scripts/native/registry.ts`).

**Files:**
- Create: `scripts/native/golden/deal-fixtures.ts`, `scripts/native/golden/deal.ts`, `scripts/native/golden/deal-steps.ts`, `tests/scripts/native/golden-replay.ts` (a helper, not a test file)
- Modify: `src/engine/deal.ts` (one export appended), `scripts/native/registry.ts` (`goldenProducers()` returns the deal producer too)
- Test: create `tests/scripts/native/golden-deal.test.ts`, `tests/scripts/native/golden-deal-steps.test.ts`

**Interfaces:**
- Consumes:
  - task 4, `scripts/native/golden/format.ts`: `GoldenCase`, `GoldenFile`, `goldenFile(meta, cases)`, `rngSeed(seed)`, `rngValues(values)`, `deckRef(deckId)`, `rngOf(tag)` (the replay helper builds every rng with it);
  - task 4, `scripts/native/registry.ts`: `NATIVE_FUNCTIONS`, `goldenProducers()`;
  - the web code: `deal`, `dealChunk`, `DEAL`, `CHUNK`, `SEARCH_BUDGET`, `DealOptions` (`src/engine/deal.ts`), `createRng`, `Rng` (`src/engine/rng.ts`), `chunkSeed` (`src/engine/round.ts`), `buildDecks` (`src/content/build.ts`), `poolFor` (`src/content/load.ts`), `WHOLE_DECK`, `Card`, `DeckFile` (`src/content/schema.ts`), `CardHistory`, `History` (`src/content/play.ts`).
- Produces:

```ts
// src/engine/deal.ts: the internal steps, each the function or constant of the same name, for the golden vectors only
export const dealInternals = {
  dealRanked, uniqueById, dealSize, wasSeen, wasMissed, lastSeenAt, oldestFirst, rankByPriority, balanceFor, choose,
  searchOverCap, searchWithAllRules, relaxStepByStep, sharesGroup, trueCount, balanceAllows, arrange, joinOf, runLimit,
  placementCheck, pickAnswer, OVERDUE_AFTER_PASSES,
} as const;

// scripts/native/golden/deal.ts
export function golden(): GoldenFile[]; // 27 files: deal, dealChunk, DEAL, CHUNK, SEARCH_BUDGET, then DEAL_STEPS in order

// scripts/native/golden/deal-steps.ts
export const DEAL_STEPS: readonly [
  "dealRanked", "uniqueById", "dealSize", "wasSeen", "wasMissed", "lastSeenAt", "oldestFirst", "rankByPriority", "balanceFor",
  "choose", "searchOverCap", "searchWithAllRules", "relaxStepByStep", "sharesGroup", "trueCount", "balanceAllows", "arrange",
  "joinOf", "runLimit", "placementCheck", "pickAnswer", "OVERDUE_AFTER_PASSES",
]; // the order of reference 3.9
export function dealStepFiles(): GoldenFile[];

// scripts/native/golden/deal-fixtures.ts (reusable by tasks 6 and 9)
export const DEAL_MODULE = "src/engine/deal";
export const DEAL_SOURCE = "src/engine/deal.ts";
export const DEAL_TESTS: readonly string[]; // the nine dealing test files
export const SAMPLE = 2;
export const ROUND_CHUNKS = 6;
export const GROUPS_GIVE_WAY: readonly string[]; // shipped-dealing-polish's nine routes, "<deck id>/<section id>"
export interface Fixture { id(local: string): string; card(local: string, answer: boolean, conflictGroups?: readonly string[]): Card;
  cards(prefix: string, n: number, answer?: (i: number) => boolean): Card[]; history(entries: Record<string, CardHistory>): History }
export function fixture(name: string): Fixture; // every card id is "<name>:<local id>"
export function shippedDecks(): DeckFile[]; // the 54 decks as scripts/build-decks.ts builds them, catalog order
export function halfMissed(pool: readonly Card[], seed: number): History;
export function pinsPool(): { pool: Card[]; history: History };
export function overCapPool(): { pool: Card[]; history: History };
export function overdueRoute(): Card[];
export function boundaryRoute(): Card[];
export function overdueRouteOf(size: number): Card[];
export function cutPool(): Card[];
export function ringPool(): Card[];

// tests/scripts/native/golden-replay.ts (reusable by tasks 6 to 8)
export interface GoldenJson { format: number; module: string; function: string; source: string; tests: string[];
  cards: Record<string, Card>; cases: { name: string; input: unknown; output: unknown }[] }
export function parseGolden(content: string): GoldenJson;
export function decode(value: unknown, cards: Readonly<Record<string, Card>>, decks: ReadonlyMap<string, readonly Card[]>): unknown;
export function encoded(value: unknown): unknown; // a value as goldenFile writes it
export function ids(value: unknown): string[];    // the ids of a list of {"$card"} references
```

- Assumed from task 4 (names the README does not fix):
  - `goldenFile` finds every `Card` object at any depth of an input or an output (inside `options.avoid`, a ranking's lists, `dealt`), writes `{"$card": id}` and puts the card into the table; `null` input stays `null`; objects that are not cards keep their keys in order.
  - `NATIVE_FUNCTIONS` has one entry with `module: "src/engine/deal"` for each of the 27 names above (the five exported ones and the 22 that reference 3.9 lists as "Internal and ported", `OVERDUE_AFTER_PASSES` among them, with `canStillFinish` covered by `searchWithAllRules` as 3.9 says).
  - `goldenProducers()` returns an array literal of the group producers, imported as `golden as <group>Golden`; this task adds `dealGolden`.

**Rules:**

1. **Which cases.** Every `it` of the nine files in `DEAL_TESTS` that calls `deal` or `dealChunk` becomes cases of the same scenario (same pool, history, options, seeds, chunk seeds). The reference vectors of `deal-pins-polish.test.ts` (seeds 1 to 3, the over-cap seeds 1 to 3, the chunks with seeds 100 to 102 and 210 to 215) and `overdue-boundary.test.ts` (seeds 150 to 155) are whole. Every other loop over seeds, sizes or generated pools gives its first `SAMPLE = 2` items (README, "Deviations from the spec": a loop inside a test is sampled, no `it` is dropped), and every round that deals chunk after chunk gives at most its first `ROUND_CHUNKS = 6` chunks, one case per chunk. The vectors check the clones against exact outputs; the web suites keep checking the properties over all seeds.
2. **Card ids.** The tests reuse names such as `c1` for different cards, and a golden file holds one card per id. Each scenario's cards therefore carry its name: `fixture("pins").card("c3", ...)` has the id `pins:c3`. Renaming every id of a scenario at once changes nothing in a deal (ids are only compared and used as keys). Cards that `cards("c", n)` builds with alternating answers share the fixture `alt` across scenarios, since `alt:c7` is the same card in every pool.
3. **Inputs.** `deal`: `{ pool, history, rng, options }`. `dealChunk`: `{ pool, history, rng, dealt }`, plus `budget` only when the call passes one (left out means `SEARCH_BUDGET`). The rng is always `{"$rng": {"seed": s}}` for the seed that call used: `createRng(base + k)` for chunk k of `deal-pins-polish`, `overdue-boundary` and `chunks.test.ts`, `createRng(chunkSeed(seed, k))` for `overdue-polish`, `missed-cap-polish` (a Classic round's first chunk) and the shipped cases. Case names are `"<test file>: <scenario>, seed <s>"`, and `", chunk <k>"` for a round.
4. **Shipped cases.** For each of the 54 decks, the whole deck is written `{"$deck": id}` (so only the dealt cards go into the table), with the first chunk of a round with seed 0, once with the default budget and once with `budget` Infinity. For each route of `GROUPS_GIVE_WAY`, Classic deals (`deal`, count 10) for the first two seeds with an empty history and with `halfMissed`, and a round that goes on. The deal the bound once decided (`aws-clf-c02/SEC`, seed 5670, history `halfMissed(pool, 5670 ^ 0x123)`) as its first six chunks with and without the bound, which deal the same.
5. **Special numbers.** The corrupt history of `deal.test.ts` gains `-Infinity` and `-0` entries; the encoder writes them, `NaN` and `Infinity` as `{"$number": ...}`, and `lastSeenAt` returns `-0` for a `-0` entry (it is finite).
6. **Internal steps.**
   - The steps `dealChunk` takes are recorded on the reference pool (seeds 1 to 3, no cards dealt), the over-cap pool (seeds 1 to 3) and the three chunk sequences, with the arguments `dealChunk` passes: `rankByPriority`, `choose`, `joinOf`, `runLimit`, `arrange`, `dealRanked`. The producer fails if the recorded `dealRanked` output differs from `dealChunk`'s.
   - A `ReadonlySet<string>` (a ranking's `missed`, the `missed` of search limits) is written as the array of its ids in insertion order, and read back into a set.
   - `dealRanked` and `arrange` continue the rng after the shuffle of `rankByPriority`, so their rng is `{"$rng": {"values": [...]}}`: exactly the values `dealRanked` drew, in order. `pickAnswer` cases give only the values the call may draw; an empty list proves the call draws nothing.
   - `placementCheck(limit)` returns a function; a case is one call `placementCheck(limit)(t, f, last, run)` with input `{ limit, t, f, last, run }`.
   - `searchOverCap(ranking, unshown, search)` takes the closure `choose` builds; its input is `{ ranking, unshown, search: { size, avoid, budget } }` and the closure is `(ranked, limits = {}) => searchWithAllRules(ranked, size, avoid, balanceFor(size), { budget, missed: ranking.missed, ...limits })`.
   - Constants (`DEAL`, `CHUNK`, `SEARCH_BUDGET`, `OVERDUE_AFTER_PASSES`) are one case `{"name": "the value", "input": null, "output": <value>}`.
7. **Replay.** The two tests decode each input with `decode` (cards from the file's table, the same object for every reference; `$deck` from `shippedDecks()`; a fresh rng per case), run the function, write the result through `goldenFile` and compare it with the case's output. Cards are compared by id everywhere, except `choose`'s `unshown.includes(card)`, which needs the table's card objects; `decode` gives them.
8. **Size.** The 27 files come to about 4.3 MB (deal 1.2 MB, dealChunk 2.3 MB). A test keeps them below 6 MB, so raising `SAMPLE` or `ROUND_CHUNKS` is a visible decision.
9. `dealInternals` is appended to `src/engine/deal.ts` without changing any line above it; `tests/purity.test.ts` and every dealing suite stay green with the same counts. Nothing outside `scripts/native` and the two tests imports it.

**Steps:**

- [ ] **Step 1: Write the replay helper and the failing test for deal and dealChunk.**

`tests/scripts/native/golden-replay.ts`:

```ts
// Reads a golden vector file back the way plans B and C read it (README, "The golden vector format"), so the web tests
// can run every case again and compare what the TypeScript gives with what the file says.
import { goldenFile, rngOf } from "@/scripts/native/golden/format";
import type { Card } from "@/src/content/schema";

export interface GoldenJson {
  format: number;
  module: string;
  function: string;
  source: string;
  tests: string[];
  cards: Record<string, Card>;
  cases: { name: string; input: unknown; output: unknown }[];
}

export function parseGolden(content: string): GoldenJson {
  return JSON.parse(content) as GoldenJson;
}

// {"$card"} is the card of the table (the same object for every reference), {"$deck"} the deck's cards in file order
// (taken from the table where it has them), {"$rng"} a fresh generator built by the format's own rngOf (a seed's
// stream, or the listed values, failing with the format's message when they run out), {"$number"} and
// {"$undefined"} what they name.
export function decode(value: unknown, cards: Readonly<Record<string, Card>>, decks: ReadonlyMap<string, readonly Card[]>): unknown {
  if (Array.isArray(value)) return value.map((item) => decode(item, cards, decks));
  if (value === null || typeof value !== "object") return value;
  const tagged = value as Record<string, unknown>;
  if (typeof tagged.$card === "string") {
    const card = cards[tagged.$card];
    if (card === undefined) throw new Error(`no card ${tagged.$card} in the table`);
    return card;
  }
  if (typeof tagged.$deck === "string") {
    const deck = decks.get(tagged.$deck);
    if (deck === undefined) throw new Error(`no deck ${tagged.$deck}`);
    return deck.map((card) => cards[card.id] ?? card);
  }
  if (typeof tagged.$number === "string") return Number(tagged.$number);
  if (tagged.$undefined === true) return undefined;
  if (tagged.$rng !== undefined) return rngOf(tagged as Parameters<typeof rngOf>[0]);
  return Object.fromEntries(Object.entries(tagged).map(([key, item]) => [key, decode(item, cards, decks)]));
}

// A value as a golden file writes it, through the format's own encoder.
export function encoded(value: unknown): unknown {
  const file = goldenFile({ module: "m", function: "f", source: "s", tests: [] }, [{ name: "value", input: null, output: value }]);
  return parseGolden(file.content).cases[0]?.output;
}

export function ids(value: unknown): string[] {
  return (value as { $card: string }[]).map((ref) => ref.$card);
}
```

`tests/scripts/native/golden-deal.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { golden } from "@/scripts/native/golden/deal";
import { DEAL_TESTS, GROUPS_GIVE_WAY, shippedDecks } from "@/scripts/native/golden/deal-fixtures";
import type { History } from "@/src/content/play";
import type { Card } from "@/src/content/schema";
import { deal, dealChunk, type DealOptions } from "@/src/engine/deal";
import type { Rng } from "@/src/engine/rng";
import { decode, encoded, ids, parseGolden, type GoldenJson } from "./golden-replay";

const files = golden();
const parsed = files.map((file) => parseGolden(file.content));
const decks = new Map(shippedDecks().map((deck) => [deck.id, deck.cards] as const));

function fileOf(fn: string): GoldenJson {
  const found = parsed.find((file) => file.function === fn);
  if (found === undefined) throw new Error(`no golden file for ${fn}`);
  return found;
}

function caseOf(fn: string, name: string): { name: string; input: unknown; output: unknown } {
  const found = fileOf(fn).cases.find((c) => c.name === name);
  if (found === undefined) throw new Error(`no case "${name}" in ${fn}`);
  return found;
}

// The ids a sequence of chunk cases dealt, in order, without the scenario's prefix.
function dealtBy(name: string, chunks: number, prefix: string): string[] {
  return Array.from({ length: chunks }, (_, k) => ids(caseOf("dealChunk", `${name}, chunk ${k}`).output)).flat().map((id) => id.slice(prefix.length));
}

describe("golden: deal and dealChunk", () => {
  it("writes deal, dealChunk and the three exported constants under their golden paths", () => {
    expect(files.map((file) => file.path)).toEqual(
      expect.arrayContaining([
        "native-data/golden/src.engine.deal.deal.json",
        "native-data/golden/src.engine.deal.dealChunk.json",
        "native-data/golden/src.engine.deal.DEAL.constant.json",
        "native-data/golden/src.engine.deal.CHUNK.json",
        "native-data/golden/src.engine.deal.SEARCH_BUDGET.json",
      ]),
    );
    for (const file of parsed) {
      expect(file.format).toBe(1);
      expect(file.module).toBe("src/engine/deal");
      expect(file.source).toBe("src/engine/deal.ts");
    }
    expect(fileOf("deal").tests).toEqual([...DEAL_TESTS]);
    expect(fileOf("dealChunk").tests).toEqual([...DEAL_TESTS]);
  });

  it("writes each constant as one case with a null input", () => {
    expect(fileOf("DEAL").cases).toEqual([{ name: "the value", input: null, output: { missedPerTen: 3, minTrue: 4, maxTrue: 6, maxRun: 3 } }]);
    expect(fileOf("CHUNK").cases).toEqual([{ name: "the value", input: null, output: 10 }]);
    expect(fileOf("SEARCH_BUDGET").cases).toEqual([{ name: "the value", input: null, output: 20_000 }]);
  });

  it("holds the reference vectors of deal-pins-polish exactly", () => {
    const pins: [number, string[]][] = [
      [1, ["c3", "c10", "c16", "c9", "c5", "c6", "c7", "c14", "c15", "c1"]],
      [2, ["c11", "c13", "c8", "c10", "c14", "c9", "c16", "c15", "c1", "c6"]],
      [3, ["c9", "c6", "c1", "c16", "c4", "c13", "c14", "c11", "c5", "c8"]],
    ];
    for (const [seed, expected] of pins) {
      expect(ids(caseOf("deal", `deal-pins-polish: reference vectors, seed ${seed}`).output)).toEqual(expected.map((id) => `pins:${id}`));
    }
    const overCap: [number, string[]][] = [
      [1, ["c10", "c7", "c6", "c12", "c15", "c16", "c13", "c4", "c9", "c14"]],
      [2, ["c13", "c11", "c4", "c14", "c6", "c16", "c10", "c15", "c9", "c7"]],
      [3, ["c9", "c16", "c10", "c4", "c7", "c14", "c13", "c6", "c11", "c15"]],
    ];
    for (const [seed, expected] of overCap) {
      const output = caseOf("deal", `deal-pins-polish: more missed cards than the cap, seed ${seed}`).output;
      expect(ids(output)).toEqual(expected.map((id) => `pins-over-cap:${id}`));
    }
  });

  it("holds the chunk sequences of deal-pins-polish and overdue-boundary exactly", () => {
    expect(dealtBy("deal-pins-polish: three chunks with the seeds 100 to 102", 3, "pins:")).toEqual([
      "c11", "c6", "c14", "c9", "c13", "c10", "c3", "c16", "c1", "c15",
      "c7", "c4", "c12", "c8", "c5", "c2",
      "c6", "c14", "c11", "c10", "c9", "c13",
    ]);
    expect(dealtBy("deal-pins-polish: six chunks with the seeds 210 to 215", 6, "pins-overdue:")).toEqual([
      "k7", "k3", "k15", "k8", "k12", "k19", "k4", "k14", "k17", "k11",
      "k9", "k10", "k16", "k6", "k21", "k5", "k18", "k2", "k20", "k13",
      "k7", "k11", "k12", "k19", "k3", "k17", "k14", "k4", "k15", "k8",
      "k6", "k13", "k9", "k20", "k5", "k2", "k16", "k21", "k10", "k18",
      "k15", "k7", "k14", "k17", "k4", "k3", "k19", "k8", "k11", "k12",
      "k20", "k1", "k9", "k21", "k2", "k5", "k13", "k10", "k16", "k6",
    ]);
    expect(dealtBy("overdue-boundary: six chunks with the seeds 150 to 155", 6, "boundary:")).toEqual([
      "k15", "k23", "k2", "k6", "k10", "k11", "k22", "k5", "k24", "k14",
      "k12", "k7", "k25", "k21", "k18", "k17", "k20", "k8", "k9", "k19",
      "k3", "k10", "k16", "k6", "k13", "k4", "k22", "k11", "k23", "k24",
      "k12", "k21", "k17", "k19", "k18", "k8", "k25", "k20", "k9", "k7",
      "k10", "k5", "k15", "k23", "k24", "k6", "k22", "k11", "k14", "k2",
      "k25", "k1", "k20", "k9", "k19", "k8", "k21", "k17", "k16", "k18",
    ]);
  });

  it("covers the count, avoid, before and budget options of deal, and dealChunk's dealt and budget", () => {
    const options = fileOf("deal").cases.map((c) => (c.input as { options: Record<string, unknown> }).options);
    expect(options.map((o) => o.count)).toEqual(expect.arrayContaining([0, -3, 4.7, 4, 5, 10, 14, 20]));
    expect(options.some((o) => Array.isArray(o.avoid) && o.avoid.length > 0)).toBe(true);
    expect(options.some((o) => Array.isArray(o.before) && o.before.length === 0)).toBe(true);
    expect(options.some((o) => Array.isArray(o.before) && o.before.length === 10)).toBe(true);
    expect(options.map((o) => o.budget)).toEqual(expect.arrayContaining([1, 40, 200]));
    const chunkInputs = fileOf("dealChunk").cases.map((c) => c.input as { dealt: unknown[]; budget?: unknown });
    expect(chunkInputs.some((input) => input.dealt.length >= 50)).toBe(true);
    expect(chunkInputs.some((input) => input.budget !== undefined)).toBe(true);
  });

  it("writes the budget Infinity and the corrupt history numbers as tagged numbers", () => {
    const unbounded = caseOf("dealChunk", "shipped: aws-clf-c02/ALL, the first chunk without the bound, seed 0").input as Record<string, unknown>;
    expect(unbounded.budget).toEqual({ $number: "Infinity" });
    expect(unbounded.pool).toEqual({ $deck: "aws-clf-c02" });
    const history = (caseOf("deal", "deal.test: a history with corrupt numbers").input as { history: Record<string, Record<string, unknown>> }).history;
    expect(history["alt:c1"]).toEqual({ seen: 1, lastCorrect: false, lastSeenAt: { $number: "NaN" } });
    expect(history["alt:c3"]?.lastSeenAt).toEqual({ $number: "Infinity" });
    expect(history["alt:c4"]?.seen).toEqual({ $number: "NaN" });
    expect(history["alt:c5"]?.lastSeenAt).toEqual({ $number: "-Infinity" });
    expect(history["alt:c6"]?.lastSeenAt).toEqual({ $number: "-0" });
  });

  it("deals from every shipped deck, the routes where the groups give way, and the deal the bound once decided", () => {
    const names = fileOf("dealChunk").cases.map((c) => c.name);
    for (const deckId of decks.keys()) {
      expect(names).toContain(`shipped: ${deckId}/ALL, the first chunk, seed 0`);
      expect(names).toContain(`shipped: ${deckId}/ALL, the first chunk without the bound, seed 0`);
    }
    expect(decks.size).toBe(54);
    const dealNames = fileOf("deal").cases.map((c) => c.name);
    for (const route of GROUPS_GIVE_WAY) {
      expect(dealNames).toContain(`shipped: ${route}, a Classic deal, half missed, seed 0`);
      expect(names).toContain(`shipped: ${route}, a round that goes on, seed 0, chunk 0`);
    }
    const bounded = dealtBy("shipped: aws-clf-c02/SEC, seed 5670, with the bound", 6, "");
    expect(dealtBy("shipped: aws-clf-c02/SEC, seed 5670, without the bound", 6, "")).toEqual(bounded);
  });

  it("gives every output again when the input is decoded and the function runs on it", () => {
    const run: Record<string, (input: unknown) => unknown> = {
      deal: (input) => {
        const i = input as { pool: Card[]; history: History; rng: Rng; options: DealOptions };
        return deal(i.pool, i.history, i.rng, i.options);
      },
      dealChunk: (input) => {
        const i = input as { pool: Card[]; history: History; rng: Rng; dealt: Card[]; budget?: number };
        return i.budget === undefined ? dealChunk(i.pool, i.history, i.rng, i.dealt) : dealChunk(i.pool, i.history, i.rng, i.dealt, i.budget);
      },
    };
    for (const fn of ["deal", "dealChunk"]) {
      const file = fileOf(fn);
      for (const c of file.cases) {
        const runner = run[fn];
        if (runner === undefined) throw new Error(fn);
        expect(encoded(runner(decode(c.input, file.cards, decks))), `${fn}: ${c.name}`).toEqual(c.output);
      }
    }
  });

  it("names each case once and writes the same files twice", () => {
    for (const file of parsed) expect(new Set(file.cases.map((c) => c.name)).size, file.function).toBe(file.cases.length);
    expect(golden()).toEqual(files);
  });
});
```

- [ ] **Step 2: Run it and see it fail.**

```bash
npx -y pnpm@10.34.0 vitest run tests/scripts/native/golden-deal.test.ts
```

Expected: the suite fails to load, `Error: Cannot find package '@/scripts/native/golden/deal' imported from <repository root>/tests/scripts/native/golden-deal.test.ts`, `Test Files  1 failed (1)`, `Tests  no tests`.

- [ ] **Step 3: Write the fixtures.**

`scripts/native/golden/deal-fixtures.ts`:

```ts
// The cards, histories and pools the dealing vectors are made of: the scenarios of the dealing tests, and the shipped
// decks built as scripts/build-decks.ts builds them.
import { readFileSync, readdirSync } from "node:fs";
import { buildDecks } from "@/src/content/build";
import type { CardHistory, History } from "@/src/content/play";
import type { Card, DeckFile } from "@/src/content/schema";
import { CHUNK } from "@/src/engine/deal";
import { createRng } from "@/src/engine/rng";

export const DEAL_MODULE = "src/engine/deal";
export const DEAL_SOURCE = "src/engine/deal.ts";
export const DEAL_TESTS = [
  "tests/engine/deal.test.ts",
  "tests/engine/deal-pins-polish.test.ts",
  "tests/engine/chunks.test.ts",
  "tests/engine/missed-cap-polish.test.ts",
  "tests/engine/search-polish.test.ts",
  "tests/engine/overdue-polish.test.ts",
  "tests/engine/overdue-boundary.test.ts",
  "tests/engine/deal.property.test.ts",
  "tests/content/shipped-dealing-polish.test.ts",
] as const;

// How much of each loop of the web tests goes into the vectors: the first SAMPLE items of a loop over seeds, sizes or
// generated pools, and the first ROUND_CHUNKS chunks of a round. The reference vectors of deal-pins-polish and
// overdue-boundary are whole: they need no more than six chunks.
export const SAMPLE = 2;
export const ROUND_CHUNKS = 6;

export function first<T>(items: readonly T[]): T[] {
  return items.slice(0, SAMPLE);
}

export function range(from: number, to: number): number[] {
  return Array.from({ length: to - from }, (_, i) => from + i);
}

export interface Fixture {
  id(local: string): string;
  card(local: string, answer: boolean, conflictGroups?: readonly string[]): Card;
  cards(prefix: string, n: number, answer?: (i: number) => boolean): Card[];
  history(entries: Record<string, CardHistory>): History;
}

// The web tests reuse names such as c1 for different cards, and a golden file holds one card per id, so the cards of a
// scenario carry its name: "pins:c3" is card c3 of the reference vectors. Otherwise a card is built as the tests build it.
export function fixture(name: string): Fixture {
  const id = (local: string) => `${name}:${local}`;
  const card = (local: string, answer: boolean, conflictGroups: readonly string[] = []): Card => ({
    id: id(local),
    section: "SEC",
    text: { en: { statement: `Statement ${local}`, explanation: `Explanation ${local}` } },
    answer,
    source: { title: "AWS documentation", url: "https://docs.aws.amazon.com/" },
    difficulty: 2,
    appliesTo: "",
    conflictGroups: [...conflictGroups],
  });
  const cards = (prefix: string, n: number, answer: (i: number) => boolean = (i) => i % 2 === 0): Card[] =>
    Array.from({ length: n }, (_, i) => card(`${prefix}${i + 1}`, answer(i)));
  const history = (entries: Record<string, CardHistory>): History =>
    Object.fromEntries(Object.entries(entries).map(([local, entry]) => [id(local), entry]));
  return { id, card, cards, history };
}

export const missed = (lastSeenAt: number): CardHistory => ({ seen: 1, lastCorrect: false, lastSeenAt });
export const right = (lastSeenAt: number): CardHistory => ({ seen: 1, lastCorrect: true, lastSeenAt });

// Each card missed (or answered right) once, the first card longest ago: the times are from, from + 1, ...
export function missedFrom(cards: readonly Card[], from: number): History {
  return Object.fromEntries(cards.map((c, i) => [c.id, missed(from + i)]));
}

export function rightFrom(cards: readonly Card[], from: number): History {
  return Object.fromEntries(cards.map((c, i) => [c.id, right(from + i)]));
}

// deal-pins-polish: 16 cards with answers True, False, True, ...; c3 and c8 share group a, c5 and c12 share group b;
// c1 and c6 were missed, c2 was answered right.
export function pinsPool(): { pool: Card[]; history: History } {
  const f = fixture("pins");
  const pool = Array.from({ length: 16 }, (_, i) =>
    f.card(`c${i + 1}`, i % 2 === 0, i === 2 || i === 7 ? ["a"] : i === 4 || i === 11 ? ["b"] : []),
  );
  return { pool, history: f.history({ c1: missed(5), c2: { seen: 2, lastCorrect: true, lastSeenAt: 9 }, c6: missed(3) }) };
}

// deal-pins-polish, "with more missed cards than the cap": c1 to c8 missed, oldest first; c16 answered right.
export function overCapPool(): { pool: Card[]; history: History } {
  const f = fixture("pins-over-cap");
  const pool = Array.from({ length: 16 }, (_, i) => f.card(`c${i + 1}`, i < 3 || (i >= 8 && i < 15), i === 4 || i === 9 ? ["b"] : []));
  return { pool, history: { ...missedFrom(pool.slice(0, 8), 1), ...f.history({ c16: right(9) }) } };
}

// deal-pins-polish: 21 cards with answers True, False, True, ...; k1 and k12 share group pair.
export function overdueRoute(): Card[] {
  const f = fixture("pins-overdue");
  return Array.from({ length: 21 }, (_, i) => f.card(`k${i + 1}`, i % 2 === 0, i === 0 || i === 11 ? ["pair"] : []));
}

// overdue-boundary: 25 cards; each of k1 to k5 shares a group with the card eleven places later.
export function boundaryRoute(): Card[] {
  const f = fixture("boundary");
  return Array.from({ length: 25 }, (_, i) => {
    const pair = i < 5 ? i : i - (CHUNK + 1);
    return f.card(`k${i + 1}`, i % 2 === 0, pair >= 0 && pair < 5 ? [`pair${pair + 1}`] : []);
  });
}

// overdue-polish: alternating answers, and each of the first size - 20 cards shares a group with the card eleven places later.
export function overdueRouteOf(size: number): Card[] {
  const f = fixture(`overdue-${size}`);
  const pairs = size - 2 * CHUNK;
  return Array.from({ length: size }, (_, i) => {
    const pair = i < pairs ? i : i - (CHUNK + 1);
    return f.card(`k${i + 1}`, i % 2 === 0, pair >= 0 && pair < pairs ? [`pair${pair + 1}`] : []);
  });
}

// search-polish: h1 to h6 (True) first, f1 to f6 (False) each sharing a group with one of them, t1 to t20 (True) last.
export function cutPool(): Card[] {
  const f = fixture("cut-h");
  return [
    ...Array.from({ length: 6 }, (_, i) => f.card(`h${i + 1}`, true, [`g${i + 1}`])),
    ...Array.from({ length: 6 }, (_, i) => f.card(`f${i + 1}`, false, [`g${i + 1}`])),
    ...Array.from({ length: 20 }, (_, i) => f.card(`t${i + 1}`, true)),
  ];
}

// search-polish: sixty True cards, then seven False cards in a ring (each shares a group with the next).
export function ringPool(): Card[] {
  const f = fixture("ring");
  return [
    ...Array.from({ length: 60 }, (_, i) => f.card(`t${i + 1}`, true)),
    ...Array.from({ length: 7 }, (_, i) => f.card(`f${i + 1}`, false, [`r${i}`, `r${(i + 1) % 7}`])),
  ];
}

// Every shipped deck, in catalog order, with its cards in the order of native-data/decks/<id>.json.
export function shippedDecks(): DeckFile[] {
  const content = new URL("../../../content/", import.meta.url);
  const read = (path: string): unknown => JSON.parse(readFileSync(new URL(path, content), "utf8"));
  const reviewed = Object.fromEntries(
    readdirSync(new URL("reviewed/", content))
      .filter((name) => name.endsWith(".json"))
      .sort()
      .map((name) => [name.slice(0, -".json".length), read(`reviewed/${name}`)]),
  );
  return buildDecks({ catalog: read("catalog.json"), reviewed, version: "2026-10-01" }).decks;
}

// shipped-dealing-polish: the routes where the conflict groups give way, and its history with every card seen and
// about half of them missed.
export const GROUPS_GIVE_WAY = [
  "azure-az-900/STO",
  "csharp-fundamentals/RES",
  "docker-fundamentals/REG",
  "docker-fundamentals/SEC",
  "linux-command-line/SYS",
  "tailwind-css/THM",
  "tailwind-css/UTL",
  "terraform-associate/MOD",
  "typescript-fundamentals/ENM",
] as const;

export function halfMissed(pool: readonly Card[], seed: number): History {
  const rng = createRng(seed);
  const history: Record<string, CardHistory> = {};
  for (const c of pool) history[c.id] = { seen: 1, lastCorrect: rng() < 0.5, lastSeenAt: Math.floor(rng() * 1e6) };
  return history;
}
```

- [ ] **Step 4: Write the producer of deal and dealChunk.**

`scripts/native/golden/deal.ts`:

```ts
// Golden vectors of the dealing (reference 3.2 and 3.9): deal and dealChunk on every scenario of the dealing tests and
// on the shipped decks, and the constants. Every output comes from running src/engine/deal.ts; only inputs are written here.
import type { CardHistory, History } from "@/src/content/play";
import { poolFor } from "@/src/content/load";
import { WHOLE_DECK, type Card } from "@/src/content/schema";
import { CHUNK, DEAL, SEARCH_BUDGET, deal, dealChunk, type DealOptions } from "@/src/engine/deal";
import { createRng, type Rng } from "@/src/engine/rng";
import { chunkSeed } from "@/src/engine/round";
import {
  DEAL_MODULE,
  DEAL_SOURCE,
  DEAL_TESTS,
  GROUPS_GIVE_WAY,
  ROUND_CHUNKS,
  SAMPLE,
  boundaryRoute,
  cutPool,
  first,
  fixture,
  halfMissed,
  missed,
  missedFrom,
  overCapPool,
  overdueRoute,
  overdueRouteOf,
  pinsPool,
  range,
  right,
  rightFrom,
  ringPool,
  shippedDecks,
  type Fixture,
} from "./deal-fixtures";
import { deckRef, goldenFile, rngSeed, type GoldenCase, type GoldenFile } from "./format";

interface Cases {
  deal: GoldenCase[];
  dealChunk: GoldenCase[];
}

// One call of deal: the input is its four arguments, the output what it returns.
function dealCase(cases: Cases, name: string, pool: readonly Card[], history: History, seed: number, options: DealOptions): void {
  cases.deal.push({ name, input: { pool, history, rng: rngSeed(seed), options }, output: deal(pool, history, createRng(seed), options) });
}

// One call of dealChunk. The budget is written only when the call passes one; a whole shipped deck is written as
// {"$deck": id} through poolInput.
function chunkCase(
  cases: Cases,
  name: string,
  pool: readonly Card[],
  history: History,
  seed: number,
  dealt: readonly Card[],
  budget?: number,
  poolInput: unknown = pool,
): Card[] {
  const output = budget === undefined ? dealChunk(pool, history, createRng(seed), dealt) : dealChunk(pool, history, createRng(seed), dealt, budget);
  const input = { pool: poolInput, history, rng: rngSeed(seed), dealt: [...dealt], ...(budget === undefined ? {} : { budget }) };
  cases.dealChunk.push({ name, input, output });
  return output;
}

// A round that deals chunk after chunk, chunk k from the seed seedOf(k), until it has dealt `length` cards or
// ROUND_CHUNKS chunks: one case per chunk, named "<name>, chunk <k>".
function roundCases(
  cases: Cases,
  name: string,
  pool: readonly Card[],
  history: History,
  seedOf: (k: number) => number,
  length: number,
  budget?: number,
): void {
  const dealt: Card[] = [];
  for (let k = 0; dealt.length < length && k < ROUND_CHUNKS; k++) {
    dealt.push(...chunkCase(cases, `${name}, chunk ${k}`, pool, history, seedOf(k), dealt, budget));
  }
}

// deal-pins-polish and overdue-boundary: the reference vectors, whole.
function pinsCases(cases: Cases): void {
  const pins = pinsPool();
  for (const seed of [1, 2, 3]) dealCase(cases, `deal-pins-polish: reference vectors, seed ${seed}`, pins.pool, pins.history, seed, { count: 10 });
  roundCases(cases, "deal-pins-polish: three chunks with the seeds 100 to 102", pins.pool, pins.history, (k) => 100 + k, 22);
  const overCap = overCapPool();
  for (const seed of [1, 2, 3]) {
    dealCase(cases, `deal-pins-polish: more missed cards than the cap, seed ${seed}`, overCap.pool, overCap.history, seed, { count: 10 });
  }
  roundCases(cases, "deal-pins-polish: six chunks with the seeds 210 to 215", overdueRoute(), {}, (k) => 210 + k, 60);
  roundCases(cases, "overdue-boundary: six chunks with the seeds 150 to 155", boundaryRoute(), {}, (k) => 150 + k, 60);
}

// tests/engine/deal.test.ts
function dealTestCases(cases: Cases): void {
  const alt = fixture("alt"); // cards("c", n) of the tests: c1, c2, ... with answers True, False, True, ...
  dealCase(cases, "deal.test: an empty pool", [], {}, 1, { count: 10 });
  dealCase(cases, "deal.test: count 0", alt.cards("c", 12), {}, 1, { count: 0 });
  dealCase(cases, "deal.test: count -3", alt.cards("c", 12), {}, 1, { count: -3 });
  for (const size of [1, 3, 9]) dealCase(cases, `deal.test: a pool of only ${size} cards`, alt.cards("c", size), {}, 1, { count: 10 });
  dealCase(cases, "deal.test: exactly the count from a larger pool", alt.cards("c", 40), {}, 1, { count: 10 });
  dealCase(cases, "deal.test: a fractional count", alt.cards("c", 40), {}, 1, { count: 4.7 });
  dealCase(cases, "deal.test: a pool that lists each id twice", [...alt.cards("c", 6), ...alt.cards("c", 6)], {}, 1, { count: 10 });
  dealCase(cases, "deal.test: only cards from the pool", alt.cards("c", 30), {}, 4, { count: 10 });
  const determinism = alt.history({ c1: missed(5), c2: right(3), c3: right(9) });
  for (const seed of [77, ...first(range(0, 10))]) {
    dealCase(cases, `deal.test: the same seed deals the same, seed ${seed}`, alt.cards("c", 40), determinism, seed, { count: 10 });
  }
  const strangers = fixture("strangers").history({ gone1: missed(1), gone2: missed(2), gone3: missed(3), gone4: missed(4) });
  dealCase(cases, "deal.test: history entries for cards not in the pool", alt.cards("c", 12), strangers, 2, { count: 10 });
  {
    const f = fixture("unseen-first");
    const seenBefore = f.cards("s", 10);
    dealCase(cases, "deal.test: cards never seen come first", [...seenBefore, ...f.cards("u", 10)], rightFrom(seenBefore, 1), 3, { count: 10 });
  }
  {
    const pool = fixture("oldest-first").cards("s", 15);
    dealCase(cases, "deal.test: among cards seen, the oldest first", pool, rightFrom(pool, 1000), 3, { count: 10 });
  }
  {
    const f = fixture("missed-first");
    const wrong = f.cards("m", 6);
    const pool = [...f.cards("u", 10, (i) => i % 2 === 1), ...wrong];
    dealCase(cases, "deal.test: missed cards first, three per ten", pool, missedFrom(wrong, 1), 8, { count: 10 });
  }
  {
    const f = fixture("two-missed");
    const pool = [...f.cards("u", 20), ...f.cards("m", 2)];
    dealCase(cases, "deal.test: fewer than three missed cards", pool, f.history({ m1: missed(1), m2: missed(2) }), 8, { count: 10 });
  }
  {
    const f = fixture("missed-twenty");
    const wrong = f.cards("m", 10);
    dealCase(cases, "deal.test: the missed cap scales with the count", [...f.cards("u", 30), ...wrong], missedFrom(wrong, 1), 8, { count: 20 });
  }
  {
    const f = fixture("beyond-cap");
    const wrong = f.cards("m", 5);
    const recent = f.cards("s", 5);
    const pool = [...wrong, ...f.cards("u", 5, (i) => i % 2 === 1), ...recent];
    dealCase(cases, "deal.test: missed cards beyond the cap last", pool, { ...missedFrom(wrong, 1), ...rightFrom(recent, 100) }, 5, { count: 10 });
  }
  {
    const f = fixture("almost-all-missed");
    const wrong = f.cards("m", 8);
    const pool = [...wrong, ...f.cards("u", 2)];
    for (const seed of [1, ...first(range(2, 21))]) {
      dealCase(cases, `deal.test: almost the whole pool missed, seed ${seed}`, pool, missedFrom(wrong, 1), seed, { count: 10 });
    }
  }
  {
    const f = fixture("seen-zero");
    const seen = f.cards("s", 10);
    const history = { ...rightFrom(seen, 1), ...f.history({ z: { seen: 0, lastCorrect: false, lastSeenAt: 0 } }) };
    dealCase(cases, "deal.test: an entry seen 0 times is never seen", [...seen, f.card("z", true)], history, 1, { count: 10 });
  }
  {
    const f = fixture("five-groups");
    const grouped = Array.from({ length: 15 }, (_, i) => f.card(`g${i + 1}`, i % 2 === 0, [`group-${i % 5}`]));
    const pool = [...grouped, ...f.cards("f", 5, (i) => i % 2 === 1)];
    for (const seed of first(range(0, 50))) dealCase(cases, `deal.test: ten conflict-free cards, seed ${seed}`, pool, {}, seed, { count: 10 });
  }
  {
    const f = fixture("multi");
    const pool = [f.card("multi", true, ["a", "b"]), f.card("a2", true, ["a"]), f.card("b2", false, ["b"]), ...f.cards("f", 12)];
    for (const seed of first(range(0, 30))) dealCase(cases, `deal.test: a card in two groups, seed ${seed}`, pool, {}, seed, { count: 10 });
  }
  {
    const f = fixture("missed-conflict");
    const older = f.cards("s", 12);
    const pool = [f.card("mB", false, ["shared"]), f.card("mA", true, ["shared"]), ...older];
    const history = { ...f.history({ mA: missed(1), mB: missed(2) }), ...rightFrom(older, 100) };
    dealCase(cases, "deal.test: a missed card in conflict with an older miss", pool, history, 4, { count: 10 });
  }
  {
    const f = fixture("avoid");
    const avoid = [f.card("before", true, ["shared"])];
    const pool = [f.card("x1", true, ["shared"]), f.card("x2", false, ["shared"]), ...f.cards("f", 12)];
    for (const seed of first(range(0, 30))) dealCase(cases, `deal.test: the groups of the avoid cards, seed ${seed}`, pool, {}, seed, { count: 10, avoid });
  }
  {
    const f = fixture("avoid-free");
    dealCase(cases, "deal.test: an avoid card without groups", f.cards("f", 10), {}, 1, { count: 10, avoid: [f.card("before", true)] });
  }
  {
    const mostlyTrue = fixture("mostly-true").cards("c", 20, (i) => i < 14);
    const mostlyFalse = fixture("mostly-false").cards("c", 20, (i) => i < 6);
    for (const seed of first(range(0, 50))) {
      dealCase(cases, `deal.test: a pool mostly True, seed ${seed}`, mostlyTrue, {}, seed, { count: 10 });
      dealCase(cases, `deal.test: a pool mostly False, seed ${seed}`, mostlyFalse, {}, seed, { count: 10 });
    }
  }
  {
    const f = fixture("balance-first");
    const seenFalse = f.cards("s", 10, () => false);
    const pool = [...f.cards("u", 10, () => true), ...seenFalse];
    dealCase(cases, "deal.test: older False cards replace unseen True ones", pool, rightFrom(seenFalse, 1), 6, { count: 10 });
  }
  {
    const pool = fixture("thirty-of-forty").cards("c", 40, (i) => i < 30);
    for (const count of [5, 1, 3, 20]) {
      for (const seed of first(range(0, 30))) dealCase(cases, `deal.test: the balance of ${count} cards, seed ${seed}`, pool, {}, seed, { count });
    }
  }
  {
    const f = fixture("one-group");
    const pool = Array.from({ length: 12 }, (_, i) => f.card(`c${i + 1}`, i % 2 === 0, ["everything"]));
    dealCase(cases, "deal.test: every card in one group", pool, {}, 2, { count: 10 });
  }
  {
    const f = fixture("clash");
    const pool = [...f.cards("t", 8, () => true), ...f.cards("f", 2, () => false), ...Array.from({ length: 4 }, (_, i) => f.card(`g${i + 1}`, false, ["clash"]))];
    for (const seed of first(range(0, 60))) dealCase(cases, `deal.test: the groups give way before the balance, seed ${seed}`, pool, {}, seed, { count: 10 });
    const history = f.history({ g1: right(1), g2: right(2), g3: right(3), g4: right(4) });
    for (const seed of first(range(0, 20))) {
      dealCase(cases, `deal.test: the groups give way before the balance, group cards last, seed ${seed}`, pool, history, seed, { count: 10 });
    }
  }
  {
    const f = fixture("one-topic");
    const pool = Array.from({ length: 12 }, (_, i) => f.card(`c${i + 1}`, true, ["one-topic"]));
    for (const seed of first(range(0, 20))) {
      dealCase(cases, `deal.test: twelve True cards of one group, seed ${seed}`, pool, {}, seed, { count: 10 });
      chunkCase(cases, `deal.test: twelve True cards of one group, seed ${seed}`, pool, {}, seed, []);
    }
  }
  {
    const f = fixture("recency-first");
    const wrong = f.cards("m", 5, (i) => i < 3);
    const pool = [...wrong, ...f.cards("u", 10, (i) => i < 8)];
    for (const seed of first(range(1, 21))) {
      dealCase(cases, `deal.test: recency gives way before the balance, seed ${seed}`, pool, missedFrom(wrong, 1), seed, { count: 10 });
    }
  }
  {
    const f = fixture("three-false");
    const wrong = [f.card("m1", false), f.card("m2", false), f.card("m3", false), f.card("m4", true)];
    const pool = [...wrong, ...f.cards("u", 10, () => true)];
    for (const seed of first(range(1, 21))) {
      dealCase(cases, `deal.test: only three False cards, seed ${seed}`, pool, missedFrom(wrong, 1), seed, { count: 10 });
      chunkCase(cases, `deal.test: only three False cards, seed ${seed}`, pool, missedFrom(wrong, 1), seed, []);
    }
  }
  {
    const f = fixture("over-cap-oldest");
    const wrong = [...f.cards("m", 3, () => true), ...[4, 5, 6, 7].map((n) => f.card(`m${n}`, false))];
    const pool = [...wrong, ...f.cards("u", 9, () => true), f.card("f1", false)];
    for (const seed of first(range(1, 21))) {
      dealCase(cases, `deal.test: only as many missed cards over the cap as needed, seed ${seed}`, pool, missedFrom(wrong, 1), seed, { count: 10 });
    }
  }
  {
    const f = fixture("cap-leave-out");
    const wrong = [1, 2, 3, 4].map((n) => f.card(`m${n}`, false));
    const pool = [...wrong, f.card("x", true, ["g"]), f.card("y", false, ["g"]), ...f.cards("u", 6, () => true)];
    for (const seed of first(range(1, 21))) {
      dealCase(cases, `deal.test: the cap kept by leaving out a higher card, seed ${seed}`, pool, missedFrom(wrong, 1), seed, { count: 10 });
    }
  }
  {
    const f = fixture("avoid-all");
    const pool = Array.from({ length: 10 }, (_, i) => f.card(`c${i + 1}`, i % 2 === 0, ["shared"]));
    dealCase(cases, "deal.test: the avoid groups give way too", pool, {}, 1, { count: 10, avoid: [f.card("before", true, ["shared"])] });
  }
  dealCase(cases, "deal.test: only True cards", fixture("all-true").cards("c", 10, () => true), {}, 1, { count: 10 });
  dealCase(cases, "deal.test: only False cards", fixture("all-false").cards("c", 12, () => false), {}, 1, { count: 10 });
  dealCase(cases, "deal.test: 9 True and 3 False", fixture("nine-three").cards("c", 12, (i) => i < 9), {}, 1, { count: 10 });
  {
    const sixFour = fixture("six-four");
    const edge = [...sixFour.cards("t", 6, () => true), ...sixFour.cards("f", 4, () => false)];
    const sevenThree = fixture("seven-three").cards("c", 10, (i) => i < 7);
    for (const seed of first(range(0, 200))) {
      dealCase(cases, `deal.test: runs of three at most, seed ${seed}`, alt.cards("c", 20), {}, seed, { count: 10 });
      dealCase(cases, `deal.test: runs at the edge of the balance, seed ${seed}`, edge, {}, seed, { count: 10 });
      dealCase(cases, `deal.test: runs after relaxing the balance, seed ${seed}`, sevenThree, {}, seed, { count: 10 });
    }
    const nineOne = fixture("nine-one").cards("c", 10, (i) => i < 9);
    for (const seed of first(range(0, 100))) {
      dealCase(cases, `deal.test: 9 True and 1 False, seed ${seed}`, nineOne, {}, seed, { count: 10 });
      dealCase(cases, `deal.test: a long deal of twenty, seed ${seed}`, alt.cards("c", 40), {}, seed, { count: 20 });
    }
  }
  {
    const f = fixture("shuffles");
    const pool = [...f.cards("m", 3), ...f.cards("u", 20)];
    const history = f.history({ m1: missed(1), m2: missed(2), m3: missed(3) });
    for (const seed of first(range(0, 30))) dealCase(cases, `deal.test: missed cards not always first, seed ${seed}`, pool, history, seed, { count: 10 });
  }
  for (const seed of first(range(0, 30))) dealCase(cases, `deal.test: the answer pattern varies, seed ${seed}`, alt.cards("c", 20), {}, seed, { count: 10 });
  {
    const f = fixture("next-shape");
    const pool = [...f.cards("f", 8), ...Array.from({ length: 4 }, (_, i) => f.card(`g${i + 1}`, i % 2 === 0, ["same-topic"]))];
    for (const seed of first(range(0, 50))) dealCase(cases, `deal.test: a 12-card section with one group of four, seed ${seed}`, pool, {}, seed, { count: 10 });
  }
  // The corrupt history of the test, with -Infinity and -0 added: a non-finite lastSeenAt counts as 0.
  const corrupt = alt.history({
    c1: { seen: 1, lastCorrect: false, lastSeenAt: Number.NaN },
    c2: { seen: -4, lastCorrect: false, lastSeenAt: 5 },
    c3: { seen: 1, lastCorrect: true, lastSeenAt: Number.POSITIVE_INFINITY },
    c4: { seen: Number.NaN, lastCorrect: true, lastSeenAt: -1 },
    c5: { seen: 1, lastCorrect: false, lastSeenAt: Number.NEGATIVE_INFINITY },
    c6: { seen: 1, lastCorrect: true, lastSeenAt: -0 },
  });
  dealCase(cases, "deal.test: a history with corrupt numbers", alt.cards("c", 20), corrupt, 12, { count: 10 });
  chunkCase(cases, "deal.test: a history with corrupt numbers", alt.cards("c", 20), corrupt, 12, []);
}

// tests/engine/deal-pins-polish.test.ts after the reference vectors
function pinsPolishCases(cases: Cases): void {
  const alt = fixture("alt");
  const alternating = Array.from({ length: 10 }, (_, i) => i % 2 === 0);
  for (const seed of first(range(0, 50))) {
    dealCase(cases, `deal-pins-polish: after T F T F T F T F T F, seed ${seed}`, alt.cards("c", 40), {}, seed, { count: 10, before: alternating });
  }
  {
    const f = fixture("nine-and-one");
    const pool = [...f.cards("t", 9, () => true), f.card("f", false)];
    for (const seed of first(range(0, 50))) {
      dealCase(cases, `deal-pins-polish: 9 True and 1 False after three True, seed ${seed}`, pool, {}, seed, { count: 10, before: [true, true, true] });
    }
  }
  {
    const f = fixture("one-and-nine");
    const pool = [f.card("t", true), ...f.cards("f", 9, () => false)];
    for (const seed of first(range(0, 50))) dealCase(cases, `deal-pins-polish: 1 True and 9 False, seed ${seed}`, pool, {}, seed, { count: 10 });
  }
  {
    const f = fixture("over-cap-group");
    const wrong = [1, 2, 3, 4].map((i) => f.card(`m${i}`, false, i === 4 ? ["g"] : []));
    const m5 = f.card("m5", true);
    const pool = [...wrong, m5, ...[1, 2, 3, 4, 5, 6].map((i) => f.card(`u${i}`, true, i === 1 ? ["g"] : []))];
    for (const seed of first(range(0, 20))) {
      dealCase(cases, `deal-pins-polish: a missed card over the cap rather than a repeated group, seed ${seed}`, pool, missedFrom([...wrong, m5], 1), seed, { count: 10 });
    }
  }
  {
    const f = fixture("seen-zero-wrong");
    const pool = [...f.cards("m", 3), f.card("z", true), ...f.cards("u", 20)];
    const history = f.history({ m1: missed(10), m2: missed(20), m3: missed(30), z: { seen: 0, lastCorrect: false, lastSeenAt: 0 } });
    for (const seed of first(range(0, 20))) dealCase(cases, `deal-pins-polish: seen 0 with the last answer wrong, seed ${seed}`, pool, history, seed, { count: 10 });
  }
  {
    const f = fixture("cap-sizes");
    const wrong = f.cards("m", 10);
    const pool = [...wrong, ...f.cards("u", 30)];
    for (const count of [4, 5, 7, 9, 10, 14]) {
      for (const seed of first(range(0, 10))) dealCase(cases, `deal-pins-polish: the missed cap of ${count}, seed ${seed}`, pool, missedFrom(wrong, 1), seed, { count });
    }
  }
  {
    const f = fixture("true-first");
    const falses = f.cards("f", 20, () => false);
    const pool = [...f.cards("t", 20, () => true), ...falses];
    for (const count of [1, 3, 5, 7, 9, 10, 13, 20]) dealCase(cases, `deal-pins-polish: six True per ten, count ${count}`, pool, rightFrom(falses, 1), 1, { count });
  }
  {
    const f = fixture("false-first");
    const trues = f.cards("t", 20, () => true);
    const pool = [...f.cards("f", 20, () => false), ...trues];
    for (const count of [1, 3, 5, 7, 9, 10, 13, 20]) dealCase(cases, `deal-pins-polish: four True per ten, count ${count}`, pool, rightFrom(trues, 1), 1, { count });
  }
  {
    const f = fixture("window");
    const others = f.cards("k", 30);
    const p = f.card("p", true, ["G"]);
    const u = f.card("u", false, ["G"]);
    const before = others.slice(0, 15);
    for (const back of [CHUNK, CHUNK + 1]) {
      const dealt = [...before.slice(0, 15 - back), p, ...before.slice(15 - back + 1)];
      chunkCase(cases, `deal-pins-polish: the partner ${back} cards back`, [u, p, ...others], f.history({ u: missed(1) }), 7, dealt);
    }
  }
}

// tests/engine/chunks.test.ts (its dealRound seeds chunk k with createRng(seed + k))
function chunksCases(cases: Cases): void {
  const alt = fixture("alt");
  for (const seed of first(range(0, 200))) {
    dealCase(cases, `chunks: no run of three continued from before, seed ${seed}`, alt.cards("c", 40), {}, seed, { count: 10, before: [false, true, true, true] });
    dealCase(cases, `chunks: the cards before count into the run, seed ${seed}`, alt.cards("c", 40), {}, seed, { count: 10, before: [true, false, false] });
  }
  {
    const f = fixture("three-true-one-false");
    const pool = [...f.cards("t", 3, () => true), f.card("f1", false)];
    for (const seed of first(range(0, 50))) {
      dealCase(cases, `chunks: the one card of the other answer first, seed ${seed}`, pool, {}, seed, { count: 4, before: [true, true, true] });
    }
  }
  for (const seed of first(range(0, 50))) dealCase(cases, `chunks: nothing before, seed ${seed}`, alt.cards("c", 40), {}, seed, { count: 10, before: [] });
  dealCase(cases, "chunks: a run that cannot be broken", fixture("five-true").cards("t", 5, () => true), {}, 1, { count: 5, before: [true, true, true] });
  {
    const f = fixture("back-two-groups");
    const ks = Array.from({ length: 10 }, (_, i) => f.card(`k${i + 1}`, i % 2 === 0, i === 0 ? ["A"] : i === 1 ? ["B"] : []));
    const rs = Array.from({ length: 10 }, (_, i) => f.card(`r${i + 1}`, i % 2 === 0));
    const pool = [f.card("u1", true, ["A", "B"]), ...ks, ...rs];
    for (const seed of first(range(0, 20))) chunkCase(cases, `chunks: shown cards come back rather than repeat a group, seed ${seed}`, pool, {}, seed, [...ks, ...rs]);
  }
  {
    const f = fixture("back-x");
    const shown = [
      f.card("c1", false, ["X"]),
      ...Array.from({ length: 9 }, (_, i) => f.card(`c${i + 2}`, i % 3 !== 0)),
      ...Array.from({ length: 10 }, (_, i) => f.card(`c${i + 11}`, i % 2 === 0)),
    ];
    const pool = [...shown, f.card("c21", true, ["X"])];
    for (const seed of first(range(0, 50))) chunkCase(cases, `chunks: a card comes back rather than an unshown card of a group of the last ten, seed ${seed}`, pool, {}, seed, shown);
  }
  {
    const f = fixture("unshown-first");
    const wrong = [f.card("m1", true), f.card("m2", false), f.card("m3", true), f.card("m4", false)];
    const shown = Array.from({ length: 11 }, (_, i) => f.card(`k${i + 1}`, i % 2 === 1));
    const pool = [...wrong, ...Array.from({ length: 6 }, (_, i) => f.card(`u${i + 1}`, i % 2 === 0)), ...shown];
    for (const seed of first(range(0, 20))) chunkCase(cases, `chunks: every unshown card before any card comes back, seed ${seed}`, pool, missedFrom(wrong, 1), seed, shown);
  }
  for (const seed of first(range(0, 50))) chunkCase(cases, `chunks: the first chunk deals as deal does, seed ${seed}`, alt.cards("c", 40), {}, seed, []);
  for (const size of first(range(20, 46))) roundCases(cases, `chunks: ten whenever the route has twenty or more, size ${size}`, alt.cards("c", size), {}, (k) => size + k, 3 * size);
  for (const size of [20, 34, 47]) {
    for (const seed of first(range(0, 20))) roundCases(cases, `chunks: only unshown cards while ten are left, size ${size}, seed ${seed}`, alt.cards("c", size), {}, (k) => seed + k, size);
  }
  for (const seed of first(range(0, 20))) roundCases(cases, `chunks: the chunk that uses up the route, seed ${seed}`, alt.cards("c", 47), {}, (k) => seed + k, 50);
  for (const size of [11, 12, 15, 19]) {
    for (const seed of first(range(0, 20))) roundCases(cases, `chunks: a route of fewer than twenty, size ${size}, seed ${seed}`, alt.cards("c", size), {}, (k) => seed + k, size);
  }
  for (const size of first(range(1, 26))) roundCases(cases, `chunks: never empty and never more than ten, size ${size}`, alt.cards("c", size), {}, (k) => size + k, 60);
  for (const size of first(range(2, 26))) {
    for (const seed of first(range(0, 10))) roundCases(cases, `chunks: a card comes back only after min(10, size - 1), size ${size}, seed ${seed}`, alt.cards("c", size), {}, (k) => seed + k, 80);
  }
  roundCases(cases, "chunks: an 11 card route repeats in its first order", alt.cards("c", 11), {}, (k) => 5 + k, 33);
  roundCases(cases, "chunks: a one card route", alt.cards("c", 1), {}, (k) => 1 + k, 4);
  for (const size of [20, 34, 60]) {
    for (const seed of first(range(0, 50))) roundCases(cases, `chunks: the run limit and the balance, size ${size}, seed ${seed}`, alt.cards("c", size), {}, (k) => seed + k, 150);
  }
  {
    const f = fixture("pairs");
    const pool = Array.from({ length: 100 }, (_, i) => f.card(`g${i + 1}`, i % 2 === 0, [`group-${Math.floor(i / 2)}`]));
    for (const seed of first(range(0, 50))) roundCases(cases, `chunks: clear of the groups of the ten cards before, seed ${seed}`, pool, {}, (k) => seed + k, 250);
  }
  {
    const f = fixture("pair-21");
    const pool = Array.from({ length: 21 }, (_, i) => f.card(`c${i + 1}`, i % 2 === 0, i === 19 || i === 20 ? ["pair"] : []));
    const dealt = pool.slice(0, 20);
    const chunk = chunkCase(cases, "chunks: a card comes back rather than one sharing a group with the last ten", pool, {}, 3, dealt);
    chunkCase(cases, "chunks: one chunk later the last unshown card is first in line", pool, {}, 4, [...dealt, ...chunk]);
  }
  {
    const f = fixture("section-like");
    const groups: Record<number, string> = { 0: "a", 9: "a", 18: "a", 27: "a", 3: "b", 12: "b", 21: "b", 5: "c", 30: "c", 7: "d", 40: "d" };
    const pool = Array.from({ length: 47 }, (_, i) => f.card(`s${i + 1}`, i % 2 === 0, groups[i] === undefined ? [] : [`group-${groups[i]}`]));
    for (const seed of first(range(0, 30))) roundCases(cases, `chunks: a route like a real section, seed ${seed}`, pool, {}, (k) => seed + k, 150);
  }
  for (const size of [11, 12]) {
    for (const seed of first(range(0, 100))) roundCases(cases, `chunks: a route of ${size} keeps the gap, seed ${seed}`, alt.cards("c", size), {}, (k) => seed + k, 60);
  }
  {
    const pool = alt.cards("c", 30);
    roundCases(cases, "chunks: the stored history for the unshown cards", pool, missedFrom(pool.slice(0, 8), 1), (k) => 2 + k, 30);
  }
  {
    const pool = alt.cards("c", 25);
    const dealt = chunkCase(cases, "chunks: deterministic, the first chunk", pool, {}, 1, []);
    chunkCase(cases, "chunks: deterministic, the second chunk", pool, {}, 2, dealt);
  }
}

// tests/engine/overdue-polish.test.ts: chunk k of a round with seed s is dealt from chunkSeed(s, k), as rounds deal.
function overduePolishCases(cases: Cases): void {
  for (const size of [21, 22, 23]) {
    for (const seed of first(range(0, 200))) {
      roundCases(cases, `overdue-polish: every card of a ${size} card route, seed ${seed}`, overdueRouteOf(size), {}, (k) => chunkSeed(seed, k), 300);
    }
  }
  {
    const f = fixture("overdue-24");
    const shape = ["Tg2", "Fg0", "Tg1", "F", "F", "T", "Tg2", "Fg1", "F", "F", "F", "Fg2", "Fg0", "Fg2", "Tg1", "F", "F", "F", "F", "T", "T", "F", "T", "F"];
    const pool = shape.map((s, i) => f.card(`c${i + 1}`, s.startsWith("T"), s.length > 1 ? [s.slice(1)] : []));
    for (const seed of first(range(0, 200))) {
      roundCases(cases, `overdue-polish: the overdue card where the fallback would leave it out, seed ${seed}`, pool, {}, (k) => chunkSeed(seed, k), 300);
    }
  }
  const withoutRepeats = (dealt: readonly Card[]): Card[] => dealt.filter((c, i) => !dealt.slice(i + 1).some((later) => later.id === c.id));
  const pools: [string, Card[]][] = [
    ["without groups", fixture("overdue-free").cards("c", 23)],
    ["of 21 cards with one pair", overdueRouteOf(21)],
    ["of 23 cards with three pairs", overdueRouteOf(23)],
  ];
  for (const [name, pool] of pools) {
    for (const seed of first(range(0, 50))) {
      const dealt: Card[] = [];
      for (let k = 0; dealt.length < 2 * pool.length; k++) {
        const label = `overdue-polish: a route ${name} deals as without the rule, seed ${seed}, chunk ${k}`;
        const chunk = chunkCase(cases, label, pool, {}, chunkSeed(seed, k), dealt);
        chunkCase(cases, `${label}, without repeats`, pool, {}, chunkSeed(seed, k), withoutRepeats(dealt));
        dealt.push(...chunk);
      }
    }
  }
}

// tests/engine/search-polish.test.ts
function searchPolishCases(cases: Cases): void {
  {
    const ranked = cutPool();
    for (const seed of first(range(0, 20))) {
      dealCase(cases, `search-polish: too few False cards behind the groups, budget 40, seed ${seed}`, ranked, rightFrom(ranked, 1), seed, { count: 10, budget: 40 });
    }
    dealCase(cases, "search-polish: too few False cards behind the groups, the default budget", ranked, rightFrom(ranked, 1), 1, { count: 10 });
    dealCase(cases, "search-polish: too few False cards behind the groups, a budget of one step", ranked, rightFrom(ranked, 1), 1, { count: 10, budget: 1 });
  }
  for (const [name, scarce] of [["False", false], ["True", true]] as const) {
    const f = fixture(`cut-scarce-${name.toLowerCase()}`);
    const ranked = [
      f.card("h", !scarce, ["G"]),
      ...Array.from({ length: 20 }, (_, i) => f.card(`t${i + 1}`, !scarce)),
      ...Array.from({ length: 6 }, (_, i) => f.card(`a${i + 1}`, scarce, ["A"])),
      f.card("d1", scarce),
      f.card("d2", scarce),
      f.card("g", scarce, ["G"]),
    ];
    for (const seed of first(range(0, 20))) {
      dealCase(cases, `search-polish: ${name} cards of one group give one card, budget 200, seed ${seed}`, ranked, rightFrom(ranked, 1), seed, { count: 10, budget: 200 });
    }
  }
  {
    const f = fixture("cut-x");
    const pairs = Array.from({ length: 4 }, (_, i) => [f.card(`p${i + 1}t`, true, [`P${i + 1}`]), f.card(`p${i + 1}f`, false, [`P${i + 1}`])]).flat();
    const ranked = [
      f.card("x", true, ["X1", "X2"]),
      ...pairs,
      f.card("t1", true),
      f.card("t2", true),
      f.card("f1", false),
      f.card("f2", false),
      f.card("y1", false, ["X1"]),
      f.card("y2", false, ["X2"]),
    ];
    for (const seed of first(range(0, 20))) {
      dealCase(cases, `search-polish: a card that blocks two groups, budget 40, seed ${seed}`, ranked, rightFrom(ranked, 1), seed, { count: 10, budget: 40 });
    }
  }
  {
    const rng = createRng(107);
    for (let n = 0; n < SAMPLE; n++) {
      const pool = randomPool(fixture(`random-${n}`), rng);
      const seed = Math.floor(rng() * 2 ** 32);
      dealCase(cases, `search-polish: random pool ${n}`, pool, {}, seed, { count: 10 });
      chunkCase(cases, `search-polish: random pool ${n}`, pool, {}, seed, []);
    }
  }
  chunkCase(cases, "search-polish: the ring, a full chunk at once", ringPool(), {}, 1, []);
}

// search-polish's randomPool: 12 to 40 cards, some groups of two to four cards, answers more or less balanced.
function randomPool(f: Fixture, rng: Rng): Card[] {
  const size = 12 + Math.floor(rng() * 29);
  const groups = Math.max(2, Math.floor(size / (2 + rng() * 3)));
  const grouped = 0.3 + rng() * 0.5;
  const trueShare = 0.3 + rng() * 0.4;
  return Array.from({ length: size }, (_, i) => f.card(`c${i + 1}`, rng() < trueShare, rng() < grouped ? [`g${Math.floor(rng() * groups)}`] : []));
}

// tests/engine/missed-cap-polish.test.ts. The first chunk of a Classic round is dealChunk(pool, history, createRng(chunkSeed(seed, 0)), []).
function missedCapCases(cases: Cases): void {
  {
    const f = fixture("swap");
    const pool = [
      f.card("M1", true, ["g"]),
      f.card("M2", true),
      f.card("M3", false),
      f.card("M4", false),
      f.card("M5", false),
      f.card("N1", true, ["g"]),
      f.card("N2", true),
      f.card("N3", true),
      f.card("N4", false),
      f.card("N5", false),
      f.card("N6", false),
      f.card("N7", false),
    ];
    const history = { ...missedFrom(pool.slice(0, 5), 1), ...rightFrom(pool.slice(5), 100) };
    for (const seed of first(range(0, 50))) {
      chunkCase(cases, `missed-cap-polish: an old miss swapped for a newer one, seed ${seed}`, pool, history, chunkSeed(seed, 0), []);
    }
  }
  const rng = createRng(60);
  for (let n = 0; n < SAMPLE; n++) {
    const f = fixture(`cap-random-${n}`);
    const size = 11 + Math.floor(rng() * 40);
    const pool = Array.from({ length: size }, (_, i) => {
      const group = rng() < 0.35 ? [`g${Math.floor(rng() * Math.max(2, size / 4))}`] : [];
      return f.card(`c${i + 1}`, rng() < 0.5, group);
    });
    const wrongShare = 0.3 + rng() * 0.6;
    const history: Record<string, CardHistory> = {};
    pool.forEach((c, i) => {
      const draw = rng();
      if (draw < wrongShare) history[c.id] = missed(1 + i);
      else if (draw < wrongShare + 0.2) history[c.id] = right(1 + i);
    });
    const seed = Math.floor(rng() * 2 ** 32);
    dealCase(cases, `missed-cap-polish: random pool ${n}`, pool, history, seed, { count: 10 });
    chunkCase(cases, `missed-cap-polish: random pool ${n}`, pool, history, seed, []);
  }
}

// tests/engine/deal.property.test.ts: its scenario(seed), with the cards named after the scenario.
function propertyCases(cases: Cases): void {
  const GROUPS = Array.from({ length: 10 }, (_, i) => `topic-${i}`);
  const pick = <T>(items: readonly T[], rng: Rng): T => items[Math.floor(rng() * items.length)] as T;
  for (const poolSeed of first(range(1, 101))) {
    const f = fixture(`property-${poolSeed}`);
    const tec = (local: string, answer: boolean, groups: readonly string[]): Card => ({ ...f.card(local, answer, groups), section: "TEC" });
    const rng = createRng(poolSeed);
    const size = 36 + Math.floor(rng() * 9);
    const pool: Card[] = [];
    const history: Record<string, CardHistory> = {};
    for (let i = 0; i < size; i++) {
      const answer = i < 16 ? i % 2 === 0 : rng() < 0.5;
      const roll = rng();
      const groups = i < 16 || roll < 0.6 ? [] : roll < 0.92 ? [pick(GROUPS, rng)] : [pick(GROUPS, rng), pick(GROUPS, rng)];
      pool.push(tec(`c${i}`, answer, [...new Set(groups)]));
      const kind = rng();
      if (kind < 0.2) history[f.id(`c${i}`)] = { seen: 1 + Math.floor(rng() * 3), lastCorrect: false, lastSeenAt: Math.floor(rng() * 1e6) };
      else if (kind < 0.5) history[f.id(`c${i}`)] = { seen: 1 + Math.floor(rng() * 3), lastCorrect: true, lastSeenAt: Math.floor(rng() * 1e6) };
    }
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j] as Card, pool[i] as Card];
    }
    for (const dealSeed of first(range(0, 10))) dealCase(cases, `deal.property: pool ${poolSeed}, seed ${dealSeed}`, pool, history, dealSeed, { count: 10 });
    const avoidRng = createRng(poolSeed * 31);
    const avoid = Array.from({ length: 10 }, (_, i) => tec(`earlier-${i}`, i % 2 === 0, [pick(GROUPS, avoidRng)]));
    dealCase(cases, `deal.property: pool ${poolSeed}, clear of the groups of the ten before`, pool, history, poolSeed, { count: 10, avoid });
    dealCase(cases, `deal.property: pool ${poolSeed}, twenty cards`, pool, history, poolSeed, { count: 20 });
    dealCase(cases, `deal.property: pool ${poolSeed}, seed 9`, pool, history, 9, { count: 10 });
  }
}

// tests/content/shipped-dealing-polish.test.ts
function shippedCases(cases: Cases): void {
  const decks = shippedDecks();
  for (const deck of decks) {
    const pool = poolFor(deck, WHOLE_DECK);
    chunkCase(cases, `shipped: ${deck.id}/${WHOLE_DECK}, the first chunk, seed 0`, pool, {}, chunkSeed(0, 0), [], undefined, deckRef(deck.id));
    chunkCase(cases, `shipped: ${deck.id}/${WHOLE_DECK}, the first chunk without the bound, seed 0`, pool, {}, chunkSeed(0, 0), [], Infinity, deckRef(deck.id));
  }
  for (const name of GROUPS_GIVE_WAY) {
    const [deckId, sectionId] = name.split("/") as [string, string];
    const deck = decks.find((d) => d.id === deckId);
    if (deck === undefined) throw new Error(`no shipped deck ${deckId}`);
    const pool = poolFor(deck, sectionId);
    for (const seed of first(range(0, 30))) {
      dealCase(cases, `shipped: ${name}, a Classic deal, seed ${seed}`, pool, {}, seed, { count: CHUNK });
      dealCase(cases, `shipped: ${name}, a Classic deal, half missed, seed ${seed}`, pool, halfMissed(pool, seed), seed, { count: CHUNK });
    }
    roundCases(cases, `shipped: ${name}, a round that goes on, seed 0`, pool, {}, (k) => chunkSeed(0, k), 3 * pool.length + CHUNK);
  }
  // The deal the bound once decided: Cloud Practitioner "Security and compliance", seed 5670, chunk 1.
  const clf = decks.find((d) => d.id === "aws-clf-c02");
  if (clf === undefined) throw new Error("no shipped deck aws-clf-c02");
  const security = poolFor(clf, "SEC");
  const history = halfMissed(security, 5670 ^ 0x123);
  roundCases(cases, "shipped: aws-clf-c02/SEC, seed 5670, with the bound", security, history, (k) => chunkSeed(5670, k), 8 * CHUNK);
  roundCases(cases, "shipped: aws-clf-c02/SEC, seed 5670, without the bound", security, history, (k) => chunkSeed(5670, k), 8 * CHUNK, Infinity);
}

export function golden(): GoldenFile[] {
  const cases: Cases = { deal: [], dealChunk: [] };
  pinsCases(cases);
  dealTestCases(cases);
  pinsPolishCases(cases);
  chunksCases(cases);
  overduePolishCases(cases);
  searchPolishCases(cases);
  missedCapCases(cases);
  propertyCases(cases);
  shippedCases(cases);
  const meta = (fn: string, tests: readonly string[]) => ({ module: DEAL_MODULE, function: fn, source: DEAL_SOURCE, tests });
  return [
    goldenFile(meta("deal", DEAL_TESTS), cases.deal),
    goldenFile(meta("dealChunk", DEAL_TESTS), cases.dealChunk),
    goldenFile(meta("DEAL", ["tests/engine/deal.test.ts"]), [{ name: "the value", input: null, output: DEAL }]),
    goldenFile(meta("CHUNK", ["tests/engine/chunks.test.ts"]), [{ name: "the value", input: null, output: CHUNK }]),
    goldenFile(meta("SEARCH_BUDGET", ["tests/engine/search-polish.test.ts"]), [{ name: "the value", input: null, output: SEARCH_BUDGET }]),
  ];
}
```

- [ ] **Step 5: Run the test and the type check.**

```bash
npx -y pnpm@10.34.0 vitest run tests/scripts/native/golden-deal.test.ts
npx -y pnpm@10.34.0 typecheck
```

Expected: `Test Files  1 passed (1)`, `Tests  9 passed (9)` in under two seconds; `tsc --noEmit` prints nothing and exits 0. If a pin test fails, the fixture of that scenario differs from the web test: compare it with the test file line by line, never change the expected ids.

- [ ] **Step 6: Commit.**

```bash
git add scripts/native/golden/deal-fixtures.ts scripts/native/golden/deal.ts tests/scripts/native/golden-replay.ts tests/scripts/native/golden-deal.test.ts
git commit -m "feat: export golden vectors for deal and dealChunk from every dealing test and the shipped decks"
```

- [ ] **Step 7: Write the failing test for the internal steps.**

`tests/scripts/native/golden-deal-steps.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { golden } from "@/scripts/native/golden/deal";
import { DEAL_STEPS } from "@/scripts/native/golden/deal-steps";
import { NATIVE_FUNCTIONS, goldenProducers } from "@/scripts/native/registry";
import type { History } from "@/src/content/play";
import type { Card } from "@/src/content/schema";
import { dealInternals } from "@/src/engine/deal";
import type { Rng } from "@/src/engine/rng";
import { decode, encoded, ids, parseGolden, type GoldenJson } from "./golden-replay";

const {
  dealRanked,
  uniqueById,
  dealSize,
  wasSeen,
  wasMissed,
  lastSeenAt,
  oldestFirst,
  rankByPriority,
  balanceFor,
  choose,
  searchOverCap,
  searchWithAllRules,
  relaxStepByStep,
  sharesGroup,
  trueCount,
  balanceAllows,
  arrange,
  joinOf,
  runLimit,
  placementCheck,
  pickAnswer,
  OVERDUE_AFTER_PASSES,
} = dealInternals;

type Ranking = Parameters<typeof dealRanked>[0];
type WrittenRanking = Omit<Ranking, "missed"> & { missed: string[] };
type Balance = Parameters<typeof searchWithAllRules>[3];
type Limits = NonNullable<Parameters<typeof searchWithAllRules>[4]>;
type Join = Parameters<typeof arrange>[2];

const files = golden();
const parsed = files.map((file) => parseGolden(file.content));

function fileOf(fn: string): GoldenJson {
  const found = parsed.find((file) => file.function === fn);
  if (found === undefined) throw new Error(`no golden file for ${fn}`);
  return found;
}

function caseOf(fn: string, name: string): { name: string; input: unknown; output: unknown } {
  const found = fileOf(fn).cases.find((c) => c.name === name);
  if (found === undefined) throw new Error(`no case "${name}" in ${fn}`);
  return found;
}

const ranking = (written: WrittenRanking): Ranking => ({ ...written, missed: new Set(written.missed) });
const asWritten = (r: Ranking): WrittenRanking => ({ ...r, missed: [...r.missed] });
const limitsOf = (written: Omit<Limits, "missed"> & { missed?: string[] }): Limits =>
  written.missed === undefined ? (written as Limits) : { ...written, missed: new Set(written.missed) };

// How a native port calls each step on a decoded input: a Set of ids is written as an array, placementCheck(limit)
// is called once with (t, f, last, run), and searchOverCap's search is the closure choose builds.
const RUN: Record<string, (input: never) => unknown> = {
  dealRanked: (i: { ranking: WrittenRanking; size: number; rng: Rng; setting: Parameters<typeof dealRanked>[3] }) =>
    dealRanked(ranking(i.ranking), i.size, i.rng, i.setting),
  uniqueById: (i: { pool: Card[] }) => uniqueById(i.pool),
  dealSize: (i: { count: number; available: number }) => dealSize(i.count, i.available),
  wasSeen: (i: { card: Card; history: History }) => wasSeen(i.card, i.history),
  wasMissed: (i: { card: Card; history: History }) => wasMissed(i.card, i.history),
  lastSeenAt: (i: { card: Card; history: History }) => lastSeenAt(i.card, i.history),
  oldestFirst: (i: { cards: Card[]; history: History }) => oldestFirst(i.cards, i.history),
  rankByPriority: (i: { cards: Card[]; history: History; rng: Rng; size: number }) => asWritten(rankByPriority(i.cards, i.history, i.rng, i.size)),
  balanceFor: (i: { size: number }) => balanceFor(i.size),
  choose: (i: { ranking: WrittenRanking; size: number; avoid: Card[]; budget: number; overdue: boolean }) =>
    choose(ranking(i.ranking), i.size, i.avoid, i.budget, i.overdue),
  searchOverCap: (i: { ranking: WrittenRanking; unshown: Card[]; search: { size: number; avoid: Card[]; budget: number } }) => {
    const r = ranking(i.ranking);
    const balance = balanceFor(i.search.size);
    return searchOverCap(r, i.unshown, (ranked, limits = {}) =>
      searchWithAllRules(ranked, i.search.size, i.search.avoid, balance, { budget: i.search.budget, missed: r.missed, ...limits }),
    );
  },
  searchWithAllRules: (i: { ranked: Card[]; size: number; avoid: Card[]; balance: Balance; limits: Omit<Limits, "missed"> & { missed?: string[] } }) =>
    searchWithAllRules(i.ranked, i.size, i.avoid, i.balance, limitsOf(i.limits)),
  relaxStepByStep: (i: { ranked: Card[]; size: number; avoid: Card[]; balance: Balance; first: Card[] }) =>
    relaxStepByStep(i.ranked, i.size, i.avoid, i.balance, i.first),
  sharesGroup: (i: { card: Card; others: Card[] }) => sharesGroup(i.card, i.others),
  trueCount: (i: { cards: Card[] }) => trueCount(i.cards),
  balanceAllows: (i: { answer: boolean; trues: number; falses: number; size: number; balance: Balance }) =>
    balanceAllows(i.answer, i.trues, i.falses, i.size, i.balance),
  arrange: (i: { chosen: Card[]; rng: Rng; join: Join }) => arrange(i.chosen, i.rng, i.join),
  joinOf: (i: { before: boolean[] }) => joinOf(i.before),
  runLimit: (i: { trues: number; falses: number; join: Join }) => runLimit(i.trues, i.falses, i.join),
  placementCheck: (i: { limit: number; t: number; f: number; last: boolean | null; run: number }) => placementCheck(i.limit)(i.t, i.f, i.last, i.run),
  pickAnswer: (i: { allowed: boolean[]; trues: number; falses: number; rng: Rng }) => pickAnswer(i.allowed, i.trues, i.falses, i.rng),
};

describe("golden: the internal steps of the dealing", () => {
  it("writes one file for each function and constant of src/engine/deal in the registry, and nothing else", () => {
    const registered = NATIVE_FUNCTIONS.filter((entry) => entry.module === "src/engine/deal").map((entry) => entry.name);
    expect(parsed.map((file) => file.function).sort()).toEqual([...registered].sort());
    expect(parsed.map((file) => file.function)).toEqual(["deal", "dealChunk", "DEAL", "CHUNK", "SEARCH_BUDGET", ...DEAL_STEPS]);
    expect(goldenProducers()).toContain(golden);
  });

  it("gives every output again when the input is decoded and the step runs on it", () => {
    for (const step of DEAL_STEPS) {
      const file = fileOf(step);
      expect(file.cases.length, step).toBeGreaterThan(0);
      for (const c of file.cases) {
        if (step === "OVERDUE_AFTER_PASSES") {
          expect(c).toEqual({ name: "the value", input: null, output: OVERDUE_AFTER_PASSES });
          continue;
        }
        const run = RUN[step];
        if (run === undefined) throw new Error(`no runner for ${step}`);
        expect(encoded(run(decode(c.input, file.cards, new Map()) as never)), `${step}: ${c.name}`).toEqual(c.output);
      }
    }
  });

  it("records dealChunk step by step: the steps of the first chunk deal the reference vectors of deal", () => {
    const pins = fileOf("deal");
    for (const seed of [1, 2, 3]) {
      const reference = pins.cases.find((c) => c.name === `deal-pins-polish: reference vectors, seed ${seed}`);
      expect(ids(caseOf("dealRanked", `the reference pool, seed ${seed}`).output)).toEqual(ids(reference?.output));
      expect(ids(caseOf("arrange", `the reference pool, seed ${seed}`).output)).toEqual(ids(reference?.output));
    }
    const ranked = caseOf("rankByPriority", "the reference pool, seed 1").output as { missed: unknown; comeBack: unknown };
    expect(ranked.missed).toEqual(["pins:c6", "pins:c1"]);
    expect(ranked.comeBack).toEqual([]);
    const overdue = caseOf("choose", "the overdue route, seeds 210 to 215, chunk 5").input as { overdue: boolean };
    expect(overdue.overdue).toBe(true);
  });

  it("writes the special numbers of the history steps as tagged numbers", () => {
    expect(caseOf("lastSeenAt", "lastSeenAt NaN").output).toBe(0);
    expect(caseOf("lastSeenAt", "lastSeenAt Infinity").output).toBe(0);
    expect(caseOf("lastSeenAt", "lastSeenAt -Infinity").output).toBe(0);
    expect(caseOf("lastSeenAt", "lastSeenAt -0").output).toEqual({ $number: "-0" });
    expect(caseOf("wasSeen", "seen NaN, last right").output).toBe(false);
    expect(caseOf("wasMissed", "seen 0, last wrong").output).toBe(false);
    expect(caseOf("dealSize", "count NaN, available 12")).toEqual({ name: "count NaN, available 12", input: { count: { $number: "NaN" }, available: 12 }, output: 0 });
    expect(caseOf("dealSize", "count Infinity, available 5").output).toBe(5);
  });

  it("draws for an answer only when both answers are allowed", () => {
    expect(caseOf("pickAnswer", "allowed [true], 2 True and 5 False left, draws []").input).toMatchObject({ rng: { $rng: { values: [] } } });
    expect(caseOf("pickAnswer", "allowed [true false], 3 True and 7 False left, draws [0.29]").output).toBe(true);
    expect(caseOf("pickAnswer", "allowed [true false], 3 True and 7 False left, draws [0.3]").output).toBe(false);
  });

  it("keeps the dealing vectors below 6 MB", () => {
    expect(files.reduce((sum, file) => sum + file.content.length, 0)).toBeLessThan(6_000_000);
  });
});
```

- [ ] **Step 8: Run it and see it fail.**

```bash
npx -y pnpm@10.34.0 vitest run tests/scripts/native/golden-deal-steps.test.ts
```

Expected: `Error: Cannot find package '@/scripts/native/golden/deal-steps' imported from <repository root>/tests/scripts/native/golden-deal-steps.test.ts`, `Test Files  1 failed (1)`, `Tests  no tests`.

- [ ] **Step 9: Export the internal steps from the engine.**

Append to the end of `src/engine/deal.ts` (after `pickAnswer`, changing nothing above):

```ts
// The steps of a deal, one by one, for the native golden vectors only (scripts/native/golden/deal-steps.ts): the Swift
// and Kotlin clones port each of them, and each is checked on its own. Nothing in the app reads this.
export const dealInternals = {
  dealRanked,
  uniqueById,
  dealSize,
  wasSeen,
  wasMissed,
  lastSeenAt,
  oldestFirst,
  rankByPriority,
  balanceFor,
  choose,
  searchOverCap,
  searchWithAllRules,
  relaxStepByStep,
  sharesGroup,
  trueCount,
  balanceAllows,
  arrange,
  joinOf,
  runLimit,
  placementCheck,
  pickAnswer,
  OVERDUE_AFTER_PASSES,
} as const;
```

Then run the dealing suites and the purity scan:

```bash
npx -y pnpm@10.34.0 vitest run tests/engine tests/content/shipped-dealing-polish.test.ts tests/purity.test.ts
```

Expected: `Test Files  15 passed (15)`, `Tests  1191 passed (1191)`, the same counts as before the change.

- [ ] **Step 10: Write the producer of the internal steps.**

`scripts/native/golden/deal-steps.ts`:

```ts
// Golden vectors of the internal steps of the dealing that reference 3.9 lists as ported. A step that deal or
// dealChunk takes is recorded on the reference scenarios, step by step, with the arguments dealChunk passes it; the
// small helpers get tables that reach every branch.
import type { CardHistory, History } from "@/src/content/play";
import type { Card } from "@/src/content/schema";
import { CHUNK, SEARCH_BUDGET, dealChunk, dealInternals } from "@/src/engine/deal";
import { createRng, type Rng } from "@/src/engine/rng";
import {
  DEAL_MODULE,
  DEAL_SOURCE,
  DEAL_TESTS,
  boundaryRoute,
  cutPool,
  fixture,
  missed,
  missedFrom,
  overCapPool,
  overdueRoute,
  pinsPool,
  range,
  ringPool,
} from "./deal-fixtures";
import { goldenFile, rngSeed, rngValues, type GoldenCase, type GoldenFile } from "./format";

const {
  dealRanked,
  uniqueById,
  dealSize,
  wasSeen,
  wasMissed,
  lastSeenAt,
  oldestFirst,
  rankByPriority,
  balanceFor,
  choose,
  searchOverCap,
  searchWithAllRules,
  relaxStepByStep,
  sharesGroup,
  trueCount,
  balanceAllows,
  arrange,
  joinOf,
  runLimit,
  placementCheck,
  pickAnswer,
  OVERDUE_AFTER_PASSES,
} = dealInternals;

type Ranking = ReturnType<typeof rankByPriority>;
type Join = ReturnType<typeof joinOf>;
type Limits = NonNullable<Parameters<typeof searchWithAllRules>[4]>;

// A ReadonlySet of card ids is written as the array of its ids, in insertion order.
function written(ranking: Ranking): unknown {
  return { ...ranking, missed: [...ranking.missed] };
}

function writtenLimits(limits: Limits): unknown {
  return limits.missed === undefined ? limits : { ...limits, missed: [...limits.missed] };
}

// An rng that keeps what it returns, so that a step which continues a stream is written with rngValues.
function recording(rng: Rng): { rng: Rng; values: number[] } {
  const values: number[] = [];
  return {
    values,
    rng: () => {
      const value = rng();
      values.push(value);
      return value;
    },
  };
}

// An rng that returns the given values in order and fails when they run out, as {"$rng": {"values": [...]}} does.
function replay(values: readonly number[]): Rng {
  let next = 0;
  return () => {
    const value = values[next++];
    if (value === undefined) throw new Error("the rng ran out of values");
    return value;
  };
}

interface Steps {
  rankByPriority: GoldenCase[];
  choose: GoldenCase[];
  joinOf: GoldenCase[];
  runLimit: GoldenCase[];
  arrange: GoldenCase[];
  dealRanked: GoldenCase[];
}

// One dealChunk call, step by step as dealChunk takes it (deal.ts:71-86 and dealRanked). Fails when the steps put
// together do not give what dealChunk gives.
function chunkSteps(steps: Steps, name: string, pool: readonly Card[], history: History, seed: number, dealt: readonly Card[]): Card[] {
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
  const setting = {
    avoid: lastTen,
    before: lastTen.map((card) => card.answer),
    budget: SEARCH_BUDGET,
    overdue: unshown.length > 0 && dealt.length >= OVERDUE_AFTER_PASSES * cards.length,
  };

  const rng = createRng(seed);
  const ranked = rankByPriority(unshown, history, rng, size);
  steps.rankByPriority.push({ name, input: { cards: unshown, history, rng: rngSeed(seed), size }, output: written(ranked) });
  const ranking = { ...ranked, comeBack };

  const after = recording(rng);
  const output = dealRanked(ranking, size, after.rng, setting);
  steps.dealRanked.push({ name, input: { ranking: written(ranking), size, rng: rngValues(after.values), setting }, output });

  const chosen = choose(ranking, size, setting.avoid, setting.budget, setting.overdue);
  steps.choose.push({ name, input: { ranking: written(ranking), size, avoid: setting.avoid, budget: setting.budget, overdue: setting.overdue }, output: chosen });
  const join = joinOf(setting.before);
  steps.joinOf.push({ name, input: { before: setting.before }, output: join });
  const trues = trueCount(chosen);
  steps.runLimit.push({ name, input: { trues, falses: chosen.length - trues, join }, output: runLimit(trues, chosen.length - trues, join) });
  steps.arrange.push({ name, input: { chosen, rng: rngValues(after.values), join }, output: arrange(chosen, replay(after.values), join) });

  const whole = dealChunk(pool, history, createRng(seed), dealt);
  if (whole.map((c) => c.id).join() !== output.map((c) => c.id).join()) throw new Error(`${name}: the steps do not deal what dealChunk deals`);
  return output;
}

function recordedSteps(): Steps {
  const steps: Steps = { rankByPriority: [], choose: [], joinOf: [], runLimit: [], arrange: [], dealRanked: [] };
  const pins = pinsPool();
  const overCap = overCapPool();
  for (const seed of [1, 2, 3]) {
    chunkSteps(steps, `the reference pool, seed ${seed}`, pins.pool, pins.history, seed, []);
    chunkSteps(steps, `more missed cards than the cap, seed ${seed}`, overCap.pool, overCap.history, seed, []);
  }
  const rounds: [string, Card[], History, (k: number) => number, number][] = [
    ["the reference pool, seeds 100 to 102", pins.pool, pins.history, (k) => 100 + k, 3],
    ["the overdue route, seeds 210 to 215", overdueRoute(), {}, (k) => 210 + k, 6],
    ["the overdue threshold, seeds 150 to 155", boundaryRoute(), {}, (k) => 150 + k, 6],
  ];
  for (const [name, pool, history, seedOf, chunks] of rounds) {
    const dealt: Card[] = [];
    for (let k = 0; k < chunks; k++) dealt.push(...chunkSteps(steps, `${name}, chunk ${k}`, pool, history, seedOf(k), dealt));
  }
  return steps;
}

function tableCases(): Record<string, GoldenCase[]> {
  const pins = pinsPool();
  const overCap = overCapPool();
  const tables: Record<string, GoldenCase[]> = {};

  const twice = fixture("twice-listed");
  const listed = [...twice.cards("c", 6), ...twice.cards("c", 6), twice.card("c7", true)];
  tables.uniqueById = [
    { name: "an empty pool", input: { pool: [] }, output: uniqueById([]) },
    { name: "the reference pool", input: { pool: pins.pool }, output: uniqueById(pins.pool) },
    { name: "a pool that lists each id twice", input: { pool: listed }, output: uniqueById(listed) },
  ];

  const counts: [number, number][] = [[10, 40], [4.7, 40], [0, 12], [-3, 12], [Number.NaN, 12], [10, 6], [10, 0], [Number.POSITIVE_INFINITY, 5], [-0, 3], [0.5, 3], [1, 1]];
  tables.dealSize = counts.map(([count, available]) => ({ name: `count ${count}, available ${available}`, input: { count, available }, output: dealSize(count, available) }));

  // Every kind of history entry, the corrupt ones too: a non-finite lastSeenAt counts as 0, and -0 stays -0.
  const h = fixture("history-kinds");
  const kinds: [string, CardHistory | undefined][] = [
    ["no entry", undefined],
    ["seen 0, last wrong", { seen: 0, lastCorrect: false, lastSeenAt: 0 }],
    ["seen 1, last wrong", missed(5)],
    ["seen 2, last right", { seen: 2, lastCorrect: true, lastSeenAt: 9 }],
    ["seen -4, last wrong", { seen: -4, lastCorrect: false, lastSeenAt: 5 }],
    ["seen NaN, last right", { seen: Number.NaN, lastCorrect: true, lastSeenAt: -1 }],
    ["lastSeenAt NaN", { seen: 1, lastCorrect: false, lastSeenAt: Number.NaN }],
    ["lastSeenAt Infinity", { seen: 1, lastCorrect: true, lastSeenAt: Number.POSITIVE_INFINITY }],
    ["lastSeenAt -Infinity", { seen: 1, lastCorrect: false, lastSeenAt: Number.NEGATIVE_INFINITY }],
    ["lastSeenAt -0", { seen: 1, lastCorrect: true, lastSeenAt: -0 }],
    ["lastSeenAt 1e15", { seen: 3, lastCorrect: true, lastSeenAt: 1e15 }],
  ];
  const kindCards = kinds.map((_, i) => h.card(`k${i + 1}`, i % 2 === 0));
  const kindHistory: History = Object.fromEntries(kinds.flatMap(([, entry], i) => (entry === undefined ? [] : [[h.id(`k${i + 1}`), entry]])));
  const perCard = (run: (card: Card, history: History) => unknown): GoldenCase[] =>
    kinds.map(([label], i) => {
      const card = kindCards[i] as Card;
      return { name: label, input: { card, history: kindHistory }, output: run(card, kindHistory) };
    });
  tables.wasSeen = perCard(wasSeen);
  tables.wasMissed = perCard(wasMissed);
  tables.lastSeenAt = perCard(lastSeenAt);
  const reversed = [...kindCards].reverse();
  tables.oldestFirst = [
    { name: "every kind of entry", input: { cards: kindCards, history: kindHistory }, output: oldestFirst(kindCards, kindHistory) },
    { name: "every kind of entry, reversed", input: { cards: reversed, history: kindHistory }, output: oldestFirst(reversed, kindHistory) },
    { name: "equal times keep their order", input: { cards: overCap.pool, history: overCap.history }, output: oldestFirst(overCap.pool, overCap.history) },
  ];

  tables.balanceFor = range(0, 21).map((size) => ({ name: `size ${size}`, input: { size }, output: balanceFor(size) }));
  tables.balanceAllows = [];
  for (const size of [1, 5, 10, 14]) {
    const balance = balanceFor(size);
    for (const answer of [true, false]) {
      for (let trues = 0; trues <= size; trues += size > 5 ? 2 : 1) {
        for (let falses = 0; trues + falses <= size; falses += size > 5 ? 2 : 1) {
          tables.balanceAllows.push({
            name: `size ${size}, answer ${answer}, ${trues} True and ${falses} False taken`,
            input: { answer, trues, falses, size, balance },
            output: balanceAllows(answer, trues, falses, size, balance),
          });
        }
      }
    }
  }

  tables.trueCount = [
    { name: "no cards", input: { cards: [] }, output: trueCount([]) },
    { name: "the reference pool", input: { cards: pins.pool }, output: trueCount(pins.pool) },
    { name: "more missed cards than the cap", input: { cards: overCap.pool }, output: trueCount(overCap.pool) },
  ];

  const g = fixture("groups");
  const multi = g.card("multi", true, ["a", "b"]);
  const inA = g.card("a", true, ["a"]);
  const inB = g.card("b", false, ["b"]);
  const free = g.card("free", false);
  const inC = g.card("c", true, ["c"]);
  const shares: [string, Card, Card[]][] = [
    ["a card in two groups and a card in one of them", multi, [free, inB]],
    ["a card in two groups and none of them", multi, [free, inC]],
    ["a card without groups", free, [multi, inA, inB]],
    ["no other cards", inA, []],
    ["a card in a group of the other", inA, [multi]],
    ["the card itself", inA, [inA]],
  ];
  tables.sharesGroup = shares.map(([name, card, others]) => ({ name, input: { card, others }, output: sharesGroup(card, others) }));

  const befores: boolean[][] = [
    [],
    [true],
    [false],
    [true, true, true],
    [false, true, true, true],
    [true, false, false],
    [true, true, true, true],
    Array.from({ length: 10 }, (_, i) => i % 2 === 0),
  ];
  tables.joinOf = befores.map((before) => ({ name: `before [${before.map((a) => (a ? "T" : "F")).join(" ")}]`, input: { before }, output: joinOf(before) }));

  const joins: Join[] = [
    { last: null, run: 0 },
    { last: true, run: 1 },
    { last: true, run: 3 },
    { last: false, run: 2 },
    { last: false, run: 4 },
  ];
  tables.runLimit = [];
  for (const join of joins) {
    for (let t = 0; t <= 10; t++) {
      for (let f = 0; t + f <= 10; f++) {
        tables.runLimit.push({ name: `${t} True and ${f} False after ${join.last} x${join.run}`, input: { trues: t, falses: f, join }, output: runLimit(t, f, join) });
      }
    }
  }

  // placementCheck(limit) returns canPlace; a case is one call canPlace(t, f, last, run) on a fresh placementCheck(limit).
  tables.placementCheck = [];
  for (const limit of [1, 3, 5]) {
    for (const [last, run] of [[null, 0], [true, 1], [true, 3], [false, 2], [false, 5]] as const) {
      for (let t = 0; t <= 5; t++) {
        for (let f = 0; f <= 5; f++) {
          tables.placementCheck.push({ name: `limit ${limit}: ${t} True and ${f} False after ${last} x${run}`, input: { limit, t, f, last, run }, output: placementCheck(limit)(t, f, last, run) });
        }
      }
    }
  }

  const picks: [boolean[], number, number, number[]][] = [
    [[], 3, 0, []],
    [[], 0, 3, []],
    [[true], 2, 5, []],
    [[false], 5, 2, []],
    [[true, false], 3, 7, [0.29]],
    [[true, false], 3, 7, [0.3]],
    [[true, false], 3, 7, [0.31]],
    [[true, false], 5, 5, [0]],
    [[true, false], 5, 5, [0.9999999999]],
  ];
  tables.pickAnswer = picks.map(([allowed, t, f, values]) => ({
    name: `allowed [${allowed.join(" ")}], ${t} True and ${f} False left, draws [${values.join(" ")}]`,
    input: { allowed, trues: t, falses: f, rng: rngValues(values) },
    output: pickAnswer(allowed, t, f, replay(values)),
  }));

  tables.searchWithAllRules = [];
  const search = (name: string, ranked: readonly Card[], size: number, avoid: readonly Card[], limits: Limits) => {
    const balance = balanceFor(size);
    tables.searchWithAllRules?.push({ name, input: { ranked, size, avoid, balance, limits: writtenLimits(limits) }, output: searchWithAllRules(ranked, size, avoid, balance, limits) });
  };
  const cut = cutPool();
  for (const budget of [1, 19, 20, 40, SEARCH_BUDGET]) search(`too few False cards behind the groups, budget ${budget}`, cut, 10, [], { budget });
  search("too few False cards behind the groups, no limits", cut, 10, [], {});
  for (const budget of [100, 2000]) search(`the ring, budget ${budget}`, ringPool(), 10, [], { budget });
  const overCapRanking = rankByPriority(overCap.pool, overCap.history, createRng(1), 10);
  const overCapUnshown = [...overCapRanking.withinCap, ...overCapRanking.overCap];
  search("more missed cards than the cap: within the cap only", overCapRanking.withinCap, 10, [], { missed: overCapRanking.missed });
  search("more missed cards than the cap: every card, no limit", overCapUnshown, 10, [], { missed: overCapRanking.missed });
  for (const missedLimit of [0, 3, 4, 5, 6]) {
    search(`more missed cards than the cap: missed limit ${missedLimit}`, overCapUnshown, 10, [], { missed: overCapRanking.missed, missedLimit });
  }
  search("more missed cards than the cap: the group of an avoid card", overCapUnshown, 10, [fixture("avoid-b").card("before", true, ["b"])], {
    missed: overCapRanking.missed,
    missedLimit: 3,
  });

  // searchOverCap's third argument is the closure choose builds; the input names what it closes over.
  tables.searchOverCap = [];
  const overCapCase = (name: string, ranking: Ranking, size: number, budget: number) => {
    const unshown = [...ranking.withinCap, ...ranking.overCap];
    const balance = balanceFor(size);
    const run = (ranked: readonly Card[], limits: Limits = {}) => searchWithAllRules(ranked, size, [], balance, { budget, missed: ranking.missed, ...limits });
    tables.searchOverCap?.push({ name, input: { ranking: written(ranking), unshown, search: { size, avoid: [], budget } }, output: searchOverCap(ranking, unshown, run) });
  };
  for (const seed of [1, 2, 3]) overCapCase(`more missed cards than the cap, seed ${seed}`, rankByPriority(overCap.pool, overCap.history, createRng(seed), 10), 10, SEARCH_BUDGET);
  overCapCase("more missed cards than the cap, a budget of 5", overCapRanking, 10, 5);
  overCapCase("nothing over the cap", rankByPriority(pins.pool, pins.history, createRng(1), 10), 10, SEARCH_BUDGET);
  const allTrue = fixture("over-cap-all-true");
  const allTruePool = [...allTrue.cards("m", 8, () => true), ...allTrue.cards("u", 4, () => true)];
  overCapCase("no deal keeps the balance", rankByPriority(allTruePool, missedFrom(allTruePool.slice(0, 8), 1), createRng(1), 10), 10, SEARCH_BUDGET);

  tables.relaxStepByStep = [];
  const relax = (name: string, ranked: readonly Card[], size: number, avoid: readonly Card[], firstCards: readonly Card[] = []) => {
    const balance = balanceFor(size);
    tables.relaxStepByStep?.push({ name, input: { ranked, size, avoid, balance, first: firstCards }, output: relaxStepByStep(ranked, size, avoid, balance, firstCards) });
  };
  const one = fixture("one-group");
  const everything = Array.from({ length: 12 }, (_, i) => one.card(`c${i + 1}`, i % 2 === 0, ["everything"]));
  relax("every card in one group", everything, 10, []);
  relax("every card in one group, a size of 4", everything, 4, []);
  const c = fixture("clash");
  const clash = [...c.cards("t", 8, () => true), ...c.cards("f", 2, () => false), ...Array.from({ length: 4 }, (_, i) => c.card(`g${i + 1}`, false, ["clash"]))];
  relax("the groups give way before the balance", clash, 10, []);
  relax("the groups give way before the balance, group cards first", [...clash].reverse(), 10, []);
  const topic = fixture("one-topic");
  relax("twelve True cards of one group", Array.from({ length: 12 }, (_, i) => topic.card(`c${i + 1}`, true, ["one-topic"])), 10, []);
  const a = fixture("avoid-all");
  relax("the avoid groups give way too", Array.from({ length: 10 }, (_, i) => a.card(`c${i + 1}`, i % 2 === 0, ["shared"])), 10, [a.card("before", true, ["shared"])]);
  const route = overdueRoute();
  relax("the overdue card goes in first", route.slice(1), 10, route.slice(11, 21), [route[0] as Card]);

  return tables;
}

// The files, in the order of reference 3.9.
export const DEAL_STEPS = [
  "dealRanked",
  "uniqueById",
  "dealSize",
  "wasSeen",
  "wasMissed",
  "lastSeenAt",
  "oldestFirst",
  "rankByPriority",
  "balanceFor",
  "choose",
  "searchOverCap",
  "searchWithAllRules",
  "relaxStepByStep",
  "sharesGroup",
  "trueCount",
  "balanceAllows",
  "arrange",
  "joinOf",
  "runLimit",
  "placementCheck",
  "pickAnswer",
  "OVERDUE_AFTER_PASSES",
] as const;

export function dealStepFiles(): GoldenFile[] {
  const recorded = recordedSteps();
  const tables = tableCases();
  const casesOf = (step: (typeof DEAL_STEPS)[number]): GoldenCase[] => {
    if (step === "OVERDUE_AFTER_PASSES") return [{ name: "the value", input: null, output: OVERDUE_AFTER_PASSES }];
    return [...(step in recorded ? recorded[step as keyof Steps] : []), ...(tables[step] ?? [])];
  };
  return DEAL_STEPS.map((step) => goldenFile({ module: DEAL_MODULE, function: step, source: DEAL_SOURCE, tests: DEAL_TESTS }, casesOf(step)));
}
```

- [ ] **Step 11: Add the step files to golden().**

In `scripts/native/golden/deal.ts`, add the import after the import from `./deal-fixtures`:

```ts
import { dealStepFiles } from "./deal-steps";
```

and make `dealStepFiles()` the last entry of the list `golden()` returns:

```ts
    goldenFile(meta("SEARCH_BUDGET", ["tests/engine/search-polish.test.ts"]), [{ name: "the value", input: null, output: SEARCH_BUDGET }]),
    ...dealStepFiles(),
  ];
```

- [ ] **Step 12: Run the steps test and see the registry check fail.**

```bash
npx -y pnpm@10.34.0 vitest run tests/scripts/native/golden-deal-steps.test.ts
```

Expected: `Tests  1 failed | 5 passed (6)`; the failure is "writes one file for each function and constant of src/engine/deal in the registry, and nothing else" with `AssertionError: expected [ ... ] to include [Function golden]` (the list holds task 4's producers). If the first assertion of that test fails instead, the deal entries of `NATIVE_FUNCTIONS` differ from the 27 names: stop and reconcile with task 4 and reference 3.9, do not drop a file.

- [ ] **Step 13: Register the producer.**

In `scripts/native/registry.ts`, add next to task 4's imports of the group producers:

```ts
import { golden as dealGolden } from "./golden/deal";
```

and add `dealGolden` as the next entry of the array `goldenProducers()` returns, after task 4's entries (for example `return [rngGolden, smallGolden, dealGolden];`).

- [ ] **Step 14: Run the tests, the type check and the whole suite.**

```bash
npx -y pnpm@10.34.0 vitest run tests/scripts/native/golden-deal.test.ts tests/scripts/native/golden-deal-steps.test.ts
npx -y pnpm@10.34.0 typecheck
npx -y pnpm@10.34.0 test
```

Expected: `Test Files  2 passed (2)`, `Tests  15 passed (15)`; `tsc --noEmit` exits 0 with no output; the whole suite ends with `Test Files  160 passed (160)` and `Tests  3280 passed (3280)` (task 4's 158 and 3265 plus this task's 2 files and 15 tests; `tests/repo-hygiene.test.ts` included).

- [ ] **Step 15: Commit.**

```bash
git add src/engine/deal.ts scripts/native/golden/deal-steps.ts scripts/native/golden/deal.ts scripts/native/registry.ts tests/scripts/native/golden-deal-steps.test.ts
git commit -m "feat: export golden vectors for the internal steps of the dealing and register the deal producer"
```
