### Task 7: Progress, the store's side copy, content helpers, the class table, the catalog, the start-flow steps, the list cue and the labels

The round is not the only logic a native app must get exactly right. What it keeps between rounds (progress and records), how it reads what it stored (part by part, with a side copy of what it could not read), how a route and a card's text are read, what the class table says, what the start screen derives from the deck index and the progress, how the six steps of the start flow move, when the list below a step fades, and two accessible names all decide what the player sees and keeps. This task writes the golden vectors for all of it, computed by running the TypeScript functions: 43 files, 626 cases, about 0.8 MB of JSON once task 9 writes them. It also exports two start-screen helpers that were private (a one-word change each, nothing else in the web changes), because reference 3.9 lists them among the functions a native port mirrors.

The producers are `progress.ts` (progress and the store), `content.ts` (routes, names, the pool of a route, card text, the class table) and `start.ts`. `start.ts` only joins `catalog.ts` (the start screen's catalog helpers) and `steps.ts` (the step helpers, the list cue and the two labels), so each half has its own commit and its own test file. `catalog-fixture.ts` holds the small deck index that the content and start vectors run on (the index of the web's start-flow tests).

Every case's name says what it pins, and every pinned case of the web tests listed in reference 3.9 for these modules is among them (the **Rules** below say where each one went). Four things are shaped by this task, and plans B and C must read them the same way; they are stated once in **Rules** and not repeated per file: the `modeTable` key of a case that closes a class, the projections of `findRoute`, `continueTarget` and `recentDecks`, the script format of the store vectors, and the spelling of a few parameters.

Builds on task 4 only: `goldenFile` and its types (`scripts/native/golden/format.ts`), and the inventory and the producer list (`scripts/native/registry.ts`). It does not need the vectors of tasks 5 and 6: the engine-summarised results that `applyResult` is run on come from the real `startRound`, `reduce` and `summarise` of `src/engine/round.ts`, called by the producer.

**Files:**
- Create: `scripts/native/golden/progress.ts`, `scripts/native/golden/content.ts`, `scripts/native/golden/catalog-fixture.ts`, `scripts/native/golden/catalog.ts`, `scripts/native/golden/steps.ts`, `scripts/native/golden/start.ts`
- Modify: `components/start/useCatalog.ts` (two `export` keywords), `scripts/native/registry.ts` (three producers)
- Test: create `tests/scripts/native/progress.test.ts`, `tests/scripts/native/content.test.ts`, `tests/scripts/native/catalog-exports.test.ts`, `tests/scripts/native/start-catalog.test.ts`, `tests/scripts/native/start-flow.test.ts`, `tests/scripts/native/progress-start-registry.test.ts`

**Interfaces:**
- Consumes (task 4, names fixed by the README):

```ts
// scripts/native/golden/format.ts
export interface GoldenCase { name: string; input: unknown; output: unknown }
export interface GoldenFile { path: string; content: string }
export function goldenFile(meta: GoldenMeta, cases: readonly GoldenCase[]): GoldenFile; // meta: { module, function, source, tests }

// scripts/native/registry.ts
export const NATIVE_FUNCTIONS: readonly NativeFunction[]; // { module, name, source, tests, kind: "function" | "constant" }
export function goldenProducers(): readonly (() => GoldenFile[])[];
```

  - What these producers rely on in `goldenFile` (the README's format rules, restated because the tests of this task read the generated text): a `Card` object in an input or an output becomes `{"$card": "<id>"}` with the full card in the `cards` table; an input of `null` stays `null` (a constant); a key whose value is `undefined` is left out; an `undefined` output is `{"$undefined": true}`; a number that JSON cannot carry (`-0`, `Infinity`, `NaN`) is tagged `{"$number": ...}`; an own key named `__proto__` is written as a plain key; the output is two-space JSON with a final newline.
  - What they rely on in the inventory: `NATIVE_FUNCTIONS` lists each function and constant of the reference 3.9 rows for progress, the progress store (without `browserLocalStorage`), content, modes, catalog, start flow (without `entriesBehind`), list cue and the two labels, with `module` the web path without its extension (`src/progress/progress`, `components/start/useCatalog`), `name`, `source` the web file and `kind`.
- Produces:

```ts
// scripts/native/golden/progress.ts, content.ts, start.ts: one producer each, registered in step 32
export function golden(): GoldenFile[];

// scripts/native/golden/content.ts: also used by the catalog and step producers
export function withClosedClasses<T>(closed: readonly Mode[], run: (table: readonly ModeInfo[]) => T): T;

// scripts/native/golden/catalog-fixture.ts
export const CATALOG_INDEX: DeckIndex;
export function indexWithAzure(count: number): DeckIndex;
export function indexWithProDeck(): DeckIndex;

// scripts/native/golden/catalog.ts and steps.ts
export function catalogFiles(): GoldenFile[];
export function stepFiles(): GoldenFile[];

// components/start/useCatalog.ts, now exported
export function deckOfCard(cardId: string, deckIds: ReadonlySet<string>): string | undefined;
export function withoutRemovedCards(progress: Progress, cardIds: DeckCardIds, store: ProgressStore): Progress;
```

  - The vector files these producers write (task 9 writes them under `native-data/golden/`; plans B and C read them). File, then number of cases:

| File (under `native-data/golden/`) | Cases |
| --- | --- |
| `src.progress.progress.emptyProgress.json` | 1 |
| `src.progress.progress.recordKey.json` | 5 |
| `src.progress.progress.bestFor.json` | 5 |
| `src.progress.progress.compareWithBest.json` | 7 |
| `src.progress.progress.applyResult.json` | 40 |
| `src.progress.progress.pruneDeck.json` | 9 |
| `src.progress.progress.seenShare.json` | 9 |
| `src.progress.progress.readProgress.json` | 63 |
| `src.progress.progress.parseProgress.json` | 63 |
| `src.progress.local.PROGRESS_KEY.json` | 1 |
| `src.progress.local.UNREADABLE_KEY.json` | 1 |
| `src.progress.local.createLocalStore.json` | 32 |
| `src.content.schema.WHOLE_DECK.json` | 1 |
| `src.content.schema.routeKey.json` | 2 |
| `src.content.schema.deckPassName.json` | 4 |
| `src.content.schema.findRoute.json` | 10 |
| `src.content.load.poolFor.json` | 7 |
| `src.content.text.textParts.json` | 15 |
| `src.content.text.plainText.json` | 15 |
| `src.app-state.modes.MODE_TABLE.json` | 1 |
| `src.app-state.modes.modeInfo.json` | 6 |
| `src.app-state.modes.isOffered.json` | 9 |
| `src.app-state.modes.lastScoreText.json` | 10 |
| `components.start.useCatalog.deckCount.json` | 5 |
| `components.start.useCatalog.decksLabel.json` | 6 |
| `components.start.useCatalog.deckOfCard.json` | 13 |
| `components.start.useCatalog.seenPercent.json` | 20 |
| `components.start.useCatalog.continueTarget.json` | 12 |
| `components.start.useCatalog.recentDecks.json` | 16 |
| `components.start.useCatalog.RECENT_LIMIT.json` | 1 |
| `components.start.useCatalog.withoutRemovedCards.json` | 8 |
| `components.start.StartFlow.STEP_OF.json` | 1 |
| `components.start.StartFlow.stepOf.json` | 14 |
| `components.start.StartFlow.clearFrom.json` | 17 |
| `components.start.StartFlow.pathTo.json` | 30 |
| `components.start.StartFlow.previousStep.json` | 24 |
| `components.start.StartFlow.chosenOn.json` | 14 |
| `components.start.StartFlow.canShow.json` | 43 |
| `components.start.listCue.FADE_PX.json` | 1 |
| `components.start.listCue.listCue.json` | 52 |
| `components.start.listCue.revealDelta.json` | 12 |
| `components.FillInPass.changeLabel.json` | 8 |
| `components.start.ContinueLine.continueLabel.json` | 13 |

**Rules:**

1. **Computed, never typed.** Every `output` comes from calling the function; a producer types only inputs. `module` is the web path without its extension, `source` the web file, `tests` the test files the registry of task 4 gives the entry: those of its reference 3.9 row that test its own web file (a row over several web files is split per file). A constant is a file of one case with `input: null`.
2. **The pinned cases, by function.**
   - `recordKey`, `bestFor`, `compareWithBest`, `emptyProgress`, `seenShare`, `pruneDeck`: every `it` of `tests/progress/progress.test.ts` and `progress-polish.test.ts` for them, including the look-alike ids (`aws-clf-c02x-1`), a record of 0 that `bestFor` returns as 0, and a card listed twice in `seenShare`.
   - `applyResult` (40 cases): card history (first answer, wrong answer, known card, own times, cards outside the round, no answers, a seen count of 150, a card answered twice), the last route (7 of 10, replaced, abandoned without a score), records (first, beaten, kept, equalled, other routes and classes, other section, a record of 0), the abandoned round (history yes, record never), one record per class (four cases, each starting from the progress the one before left), Streak and Timed records, rounds left in every class, the class's own score in `last`, and two results from the real engine (a finished Streak round, a decided Streak round that was left).
   - `readProgress` and `parseProgress` share one table of 63 stored values, so both files hold the same inputs: every value of `tests/progress/progress.test.ts`, `progress-polish.test.ts` and `partial-read.test.ts`, plus the number rules of reference 3.5 written as raw text (`1e999` reads as Infinity and drops its part alone, `9007199254740992` is not a safe integer and `9007199254740991` is, a fractional `lastSeenAt` is kept, `-0` is kept as `-0`, `7.0` is the integer 7) and a stored value with no `last` key (last `null`, not whole).
   - `createLocalStore` (32 cases): every case of `tests/progress/local.test.ts` and `partial-read.test.ts` that is about the store (see rule 4), and one more that the web tests do not pin: a value the side key already holds is not copied again, so the save goes through even when the side key cannot be written.
   - `routeKey`, `WHOLE_DECK`, `deckPassName`, `findRoute`, `poolFor`, `textParts`, `plainText`, `MODE_TABLE`, `modeInfo`, `isOffered`, `lastScoreText`: every `it` of `schema.test.ts`, `load.test.ts`, `text.test.ts`, `modes.test.ts`, `modes-polish.test.ts`, `modes-score-copy-polish.test.ts` for them, and `findRoute` also the cases of `useCatalog.test.tsx`. The class sentences of `modes-score-copy-polish.test.ts` are held to `scoreOf`, which task 6 owns; here they are only the table.
   - `deckCount`, `decksLabel`, `deckOfCard`, `seenPercent`, `continueTarget`, `recentDecks`, `RECENT_LIMIT`, `withoutRemovedCards`: every `it` of `useCatalog.test.tsx` and `unoffered.test.tsx` for them. `seenPercent` also has the rounding table (half up, `0.29` times 100 is `28.999999999999996`, `0.57` times 100 is `56.99999999999999`).
   - `STEP_OF`, `stepOf`, `clearFrom`, `pathTo`, `previousStep`, `chosenOn`, `canShow`: every `it` of the "steps (pure)" block of `StartFlow.test.tsx` and of `unoffered.test.tsx`, then every step by every path (`pathTo` and `previousStep` for steps 1 to 6, with and without sections, on the ordinary and the recent path) and 43 `canShow` cases.
   - `listCue` (52), `revealDelta` (12), `FADE_PX`: every `it` of `listCue.test.tsx` that calls the pure functions, with the sliver, the gap, the exact 28 px edge and 35 scroll positions of nine cards (the web's per-pixel sweep from 0 to 300 is sampled every 10 px). The hook `useListCue` and `revealInList` read the DOM and are not ported as functions.
   - `changeLabel`, `continueLabel`: every `it` of `FillInPass.test.tsx`, `ContinueLine.test.tsx` and `continue-line-polish.test.tsx` that is about the text of a name.
3. **The reading table.** A stored value is a raw string (or `null` for nothing stored). `readProgress` answers `{progress, whole}`; `parseProgress` answers the progress. A native's JSON decoder may accept or reject a number such as `1e999`; the port must end with the web's result, the part that holds it dropped and the rest kept.
4. **The store is a script.** `createLocalStore` takes a storage that a vector cannot hold, so a case is `{"storage": {"items": {...}} | null, "steps": [...]}` and its output is `{"loads": [...], "items": {...} | null}`. `storage: null` is no storage at all (`createLocalStore(undefined)`) and its `items` come back `null`. Steps run in order, and `loads` collects what each `load` step returned:
   - `{"op": "load"}`: `store.load()`; `{"op": "save", "progress": ...}`: `store.save(progress)`; `{"op": "resave"}`: `store.save(store.load())`, which is what the start of a round does.
   - `{"op": "put", "key": ..., "value": ...}`: the script writes the key straight into the storage, without the store.
   - `{"op": "breakGet"}`: from now on `getItem` throws (a `SecurityError`); `{"op": "breakSet", "keys": [...] | "all"}`: from now on `setItem` throws (a `QuotaExceededError`) for those keys.
   - `items` is the whole storage at the end, key to raw string.
5. **A closed class.** The real table offers all four classes, so the gate between a closed class and the player (`isOffered`, `continueTarget`, `canShow` at step 6) is reached by closing Timed while one case runs (`withClosedClasses`), as `unoffered.test.tsx` does with a mock. Such a case has the table as it stood, in the order of the class step, in its input as `modeTable`: `[{"id": "classic", ..., "offered": true}, ..., {"id": "timed", ..., "offered": false}]`. A native replaces its class table with it for that case. A case without `modeTable` runs on the shipped table. The table is open again after every case (a test pins it, also after a case that throws).
6. **Projections.** A route found in the index is written as `{"areaId", "platformId", "deckId", "sectionId"}` with `sectionId` `null` for the whole deck (`findRoute`, and the `found` of `continueTarget`). A recent deck is written as `{"areaId", "platformId", "deckId", "lastSeenAt"}` (`recentDecks`). `continueTarget` answers `{route, mode, found, lastScore}` or `null`. `withoutRemovedCards` takes a store and calls `save` when the number of card entries changed; its vector gives no store and writes `{"progress": ..., "saved": true | false}`.
7. **Parameters.** `deckOfCard`'s `deckIds` is a list in the vector (the web takes a `Set`). `continueLabel` takes one object; its input key is `props`. An argument that is left out (`recentDecks`' `limit`, `seenPercent`'s `cardIds`, `pathTo`'s `recent`) is a key that is absent from the input. `deckOfCard` and `chosenOn` answer `undefined` as `{"$undefined": true}`; `modeInfo` and `isOffered` throw for a class the table does not know and answer `{"$throws": "Unknown mode \"blitz\"."}`.
8. **Behaviour the vectors pin on purpose.** `pruneDeck` tests the plain prefix `<deckId>-`, so pruning `gcp-cdl` also drops an unlisted card of `gcp-cdl-pro`; a vector says so in its name, and natives port the plain prefix rule, not the longest-prefix rule of `deckOfCard`. `findRoute` answers `null` as soon as the first deck with that id lacks the section. `continueLabel` treats an empty `lastScore` as no score. `readProgress` of a value with no `last` key is not whole, so the store keeps a side copy of it before its first save.
9. **Not vectors.** `browserLocalStorage`, `entriesBehind`, `useCatalog`, `useListCue`, `revealInList` and the components themselves; the web-only parts of reference 3.9.

**Steps:**

- [ ] **Step 1: Check the starting point.**

```bash
git status --short
ls scripts/native/golden/format.ts scripts/native/registry.ts
npx -y pnpm@10.34.0 vitest run tests/scripts/native 2>&1 | tail -6
```

Expected: `git status --short` prints nothing (every earlier task ended with its commit); `ls` lists both files; the vitest summary shows every test file passing (the counts are those of tasks 1 to 6). If `format.ts` does not export `goldenFile`, or the registry has no `goldenProducers`, stop: task 4 is not in place.

- [ ] **Step 2: Write the progress test.**

`tests/scripts/native/progress.test.ts`:

```ts
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { golden } from "@/scripts/native/golden/progress";

// The vectors of the progress module and its store: the shape of every file, and the values the web's own
// tests pin, read back out of the generated files.

const root = fileURLToPath(new URL("../../../", import.meta.url));

interface Case {
  name: string;
  input: any;
  output: any;
}
interface Vectors {
  format: number;
  module: string;
  function: string;
  source: string;
  tests: string[];
  cards: Record<string, unknown>;
  cases: Case[];
}

const files = golden();
const parsed = files.map((file) => ({ path: file.path, content: file.content, vectors: JSON.parse(file.content) as Vectors }));

function vectorsOf(name: string): Vectors {
  const found = parsed.find((file) => file.vectors.function === name);
  if (!found) throw new Error(`no vectors for ${name}`);
  return found.vectors;
}

function caseOf(name: string, title: string): Case {
  const found = vectorsOf(name).cases.find((candidate) => candidate.name === title);
  if (!found) throw new Error(`no case "${title}" in ${name}`);
  return found;
}

describe("progress vectors: the files", () => {
  it("writes one file for each function and constant of progress.ts and local.ts", () => {
    expect(files.map((file) => file.path).sort()).toEqual([
      "native-data/golden/src.progress.local.PROGRESS_KEY.json",
      "native-data/golden/src.progress.local.UNREADABLE_KEY.json",
      "native-data/golden/src.progress.local.createLocalStore.json",
      "native-data/golden/src.progress.progress.applyResult.json",
      "native-data/golden/src.progress.progress.bestFor.json",
      "native-data/golden/src.progress.progress.compareWithBest.json",
      "native-data/golden/src.progress.progress.emptyProgress.json",
      "native-data/golden/src.progress.progress.parseProgress.json",
      "native-data/golden/src.progress.progress.pruneDeck.json",
      "native-data/golden/src.progress.progress.readProgress.json",
      "native-data/golden/src.progress.progress.recordKey.json",
      "native-data/golden/src.progress.progress.seenShare.json",
    ]);
  });

  it("names a source file and test files that exist, and the module and function in the path", () => {
    for (const { path, vectors } of parsed) {
      expect(vectors.format).toBe(1);
      expect(path).toBe(`native-data/golden/${vectors.module.replaceAll("/", ".")}.${vectors.function}.json`);
      expect(existsSync(`${root}${vectors.source}`), vectors.source).toBe(true);
      for (const test of vectors.tests) expect(existsSync(`${root}${test}`), test).toBe(true);
    }
  });

  it("gives every case a distinct name, an input and an output", () => {
    for (const { path, vectors } of parsed) {
      const names = vectors.cases.map((candidate) => candidate.name);
      expect(new Set(names).size, path).toBe(names.length);
      for (const candidate of vectors.cases) {
        expect(candidate, `${path}: ${candidate.name}`).toHaveProperty("input");
        expect(candidate, `${path}: ${candidate.name}`).toHaveProperty("output");
      }
    }
  });

  it("puts every card it mentions in the file's cards table, and ends the file with a newline", () => {
    for (const { path, content, vectors } of parsed) {
      for (const [, id] of content.matchAll(/"\$card": "([^"]+)"/g)) expect(Object.keys(vectors.cards), `${path}: ${id}`).toContain(id);
      expect(content.endsWith("\n"), path).toBe(true);
    }
  });

  it("gives byte-identical files on a second run", () => {
    expect(golden()).toEqual(files);
  });
});

describe("progress vectors: constants and small functions", () => {
  it("pins the two storage keys", () => {
    expect(vectorsOf("PROGRESS_KEY").cases[0]).toMatchObject({ input: null, output: "truthy.progress.v1" });
    expect(vectorsOf("UNREADABLE_KEY").cases[0]).toMatchObject({ input: null, output: "truthy.progress.v1.unreadable" });
  });

  it("emptyProgress and recordKey", () => {
    expect(vectorsOf("emptyProgress").cases[0]).toMatchObject({ input: {}, output: { version: 1, cards: {}, records: {}, last: null } });
    expect(caseOf("recordKey", "joins the route key and the mode with a hash").output).toBe("aws-clf-c02/SEC#classic");
    expect(caseOf("recordKey", "whole deck route").output).toBe("nextjs-rendering/ALL#classic");
    expect(caseOf("recordKey", "same route, Timed").output).toBe("aws-clf-c02/SEC#timed");
  });

  it("bestFor reads a record of 0 as 0, not as missing", () => {
    expect(caseOf("bestFor", "the record of a route and mode").output).toBe(9);
    expect(caseOf("bestFor", "no record for another section").output).toBeNull();
    expect(caseOf("bestFor", "a record of 0 is a record, not null").output).toBe(0);
  });

  it("compareWithBest says first, new best, equal and short", () => {
    expect(caseOf("compareWithBest", "a first round when the route and mode had no record").output).toEqual({ kind: "first" });
    expect(caseOf("compareWithBest", "a new best when the score beats the record").output).toEqual({ kind: "new-best", previousBest: 7 });
    expect(caseOf("compareWithBest", "equals the best when the score matches the record").output).toEqual({ kind: "equal", best: 9 });
    expect(caseOf("compareWithBest", "short of the record by 2").output).toEqual({ kind: "short", best: 9, by: 2 });
    expect(caseOf("compareWithBest", "short of the record by 10").output).toEqual({ kind: "short", best: 10, by: 10 });
  });

  it("seenShare", () => {
    expect(caseOf("seenShare", "0 for a deck with no cards").output).toBe(0);
    expect(caseOf("seenShare", "the share of the given cards seen at least once").output).toBe(0.5);
    expect(caseOf("seenShare", "1 when every card has been seen").output).toBe(1);
    expect(caseOf("seenShare", "an entry with a seen count of 0 is not seen").output).toBe(0);
    expect(caseOf("seenShare", "a card listed twice counts once").output).toBe(0.5);
  });
});

describe("progress vectors: applyResult", () => {
  it("keeps the records the web's tests pin, with the record before and whether the round set a new best", () => {
    const expected: [string, Record<string, number>, number | null, boolean][] = [
      ["records: a first record for a route and mode that has none", { "aws-clf-c02/SEC#classic": 6 }, null, true],
      ["records: replaces a record that the score beats", { "aws-clf-c02/SEC#classic": 8 }, 6, true],
      ["records: keeps a record that the score does not reach", { "aws-clf-c02/SEC#classic": 8 }, 8, false],
      ["records: equalling the record is not a new best", { "aws-clf-c02/SEC#classic": 7 }, 7, false],
      ["records: a first finished round with no correct answer sets the record 0", { "aws-clf-c02/SEC#classic": 0 }, null, true],
      ["records: a later 0 does not replace a record of 0", { "aws-clf-c02/SEC#classic": 0 }, 0, false],
      ["abandoned: does not beat an existing record, however high its score", { "aws-clf-c02/SEC#classic": 2 }, 2, false],
      ["abandoned: does not set a first record", {}, null, false],
      ["modes: equalling a Streak record is not a new best", { "aws-clf-c02/SEC#streak": 12 }, 12, false],
      ["modes: a longer streak replaces the record", { "aws-clf-c02/SEC#streak": 13 }, 12, true],
      ["modes: a first Timed round with no correct answer sets the record 0", { "aws-clf-c02/SEC#timed": 0 }, null, true],
      ["modes: a round that was left sets no record in timed", { "aws-clf-c02/SEC#timed": 4 }, 4, false],
      ["engine: a finished Streak round (3 in a row, 4 cards answered)", { "aws-clf-c02/SEC#streak": 3 }, null, true],
      ["engine: a decided Streak round that was left sets no record", { "aws-clf-c02/SEC#streak": 4 }, 4, false],
    ];
    for (const [title, records, previousBest, isNewBest] of expected) {
      const { output } = caseOf("applyResult", title);
      expect(output.progress.records, title).toEqual(records);
      expect(output.previousBest, title).toBe(previousBest);
      expect(output.isNewBest, title).toBe(isNewBest);
    }
  });

  it("keeps one record per class on the same route, each case starting from the one before", () => {
    expect(caseOf("applyResult", "modes: one record per class on the same route, timed").output.progress.records).toEqual({
      "aws-clf-c02/SEC#classic": 7,
      "aws-clf-c02/SEC#streak": 12,
      "aws-clf-c02/SEC#lives": 21,
      "aws-clf-c02/SEC#timed": 14,
    });
  });

  it("writes the card history: counts, the later verdict, the later time", () => {
    const entry = (title: string, id: string) => caseOf("applyResult", title).output.progress.cards[id];
    expect(entry("history: an entry for a card answered for the first time", "c1")).toEqual({ seen: 1, lastCorrect: true, lastSeenAt: 1000 });
    expect(entry("history: a wrong answer is lastCorrect false", "c1")).toEqual({ seen: 1, lastCorrect: false, lastSeenAt: 1000 });
    expect(entry("history: adds to the seen count and replaces lastCorrect and lastSeenAt of a known card", "c1")).toEqual({ seen: 5, lastCorrect: false, lastSeenAt: 2000 });
    expect(entry("history: the seen count has no ceiling (150 becomes 151)", "c1")).toEqual({ seen: 151, lastCorrect: false, lastSeenAt: 9 });
    expect(entry("history: a card answered twice in one round counts twice and keeps the later answer", "c1")).toEqual({ seen: 2, lastCorrect: false, lastSeenAt: 200 });
    expect(entry("modes: a card answered twice in Three lives counts two sightings and keeps the later verdict", "A")).toEqual({ seen: 2, lastCorrect: true, lastSeenAt: 300 });
    expect(entry("modes: a card answered twice in Three lives counts two sightings and keeps the later verdict", "B")).toEqual({ seen: 1, lastCorrect: true, lastSeenAt: 200 });
    expect(entry("modes: a card answered twice, added to stored history", "A")).toEqual({ seen: 6, lastCorrect: true, lastSeenAt: 300 });
    expect(entry("modes: a card answered right, then wrong, ends wrong", "A")?.lastCorrect).toBe(false);
    expect(caseOf("applyResult", "history: cards that were not in the round are left alone").output.progress.cards.other).toEqual({ seen: 2, lastCorrect: false, lastSeenAt: 10 });
  });

  it("writes the last route with the score of a finished round and none for an abandoned one", () => {
    const last = (title: string) => caseOf("applyResult", title).output.progress.last;
    const route = { deckId: "aws-clf-c02", sectionId: "SEC" };
    expect(last("last: 7 of 10")).toEqual({ route, mode: "classic", score: 7, total: 10 });
    expect(last("last: an abandoned round has no score")).toEqual({ route, mode: "classic", score: null, total: null });
    expect(last("modes: the last round keeps the class's own score")).toEqual({ route, mode: "lives", score: 21, total: 21 });
    expect(last("last: replaces an earlier last route and its score")).toEqual({ route, mode: "classic", score: 1, total: 1 });
  });

  it("refers to cards by id: no full card in an input or an output", () => {
    const { input, output } = caseOf("applyResult", "last: 7 of 10");
    expect(input.result.answers[0].card).toEqual({ $card: "c0" });
    expect(output.progress.cards.c0).toEqual({ seen: 1, lastCorrect: true, lastSeenAt: 1 });
    expect(Object.keys(vectorsOf("applyResult").cards)).toContain("c0");
  });
});

describe("progress vectors: pruneDeck", () => {
  const kept = (title: string) => Object.keys(caseOf("pruneDeck", title).output.cards).sort();

  it("drops the deck's cards that are not listed and keeps every other card", () => {
    expect(kept("removes the deck's cards that no longer exist")).toEqual(["aws-clf-c02-t1.1-01", "aws-clf-c02-t2.1-06", "nextjs-rendering-rsc-01"]);
    expect(kept("keeps the records and the last route when every card goes")).toEqual(["nextjs-rendering-rsc-01"]);
    expect(kept("does nothing for a deck with no history")).toEqual(["aws-clf-c02-t1.1-01", "aws-clf-c02-t1.1-02", "aws-clf-c02-t2.1-06", "nextjs-rendering-rsc-01"]);
    expect(kept("does not add entries for current cards that were never seen")).not.toContain("aws-clf-c02-t9.9-99");
  });

  it("keeps the records and the last route", () => {
    const { output } = caseOf("pruneDeck", "keeps the records and the last route when every card goes");
    expect(output.records).toEqual({ "aws-clf-c02/SEC#classic": 7 });
    expect(output.last).toEqual({ route: { deckId: "aws-clf-c02", sectionId: "SEC" }, mode: "classic", score: 7, total: 10 });
  });

  it("tests the plain prefix: look-alike ids stay, and a gcp-cdl-pro card is dropped when gcp-cdl is pruned", () => {
    expect(kept("a card id that only starts with the same letters belongs to no deck here (aws)")).toEqual(["aws-clf-c02x-1", "nextjs-renderingx-1"]);
    expect(kept("a card id that only starts with the same letters belongs to no deck here (next)")).toEqual(["aws-clf-c02-t1.1-01", "aws-clf-c02x-1", "nextjs-renderingx-1"]);
    expect(kept("the plain prefix rule: pruning gcp-cdl also drops a gcp-cdl-pro card that is not listed")).toEqual(["gcp-cdl-1"]);
  });
});

describe("progress vectors: reading a stored value", () => {
  const whole = (title: string) => caseOf("readProgress", title).output.whole;
  const progressOf = (title: string) => caseOf("readProgress", title).output.progress;

  it("reads a value whole, or says that a part was dropped", () => {
    for (const title of [
      "a valid value",
      "nothing stored",
      "a progress with no last route",
      "the last route of an abandoned round, without a score",
      "a last route stored before scores were kept",
      "only unknown fields to drop",
      "a version written 1.0",
      "a lastSeenAt of 0 is kept",
      "a fractional lastSeenAt is kept",
      "a lastSeenAt of -0 is kept as -0",
      "a seen count of 2^53 - 1 is kept",
      "a score written 7.0 is the integer 7",
    ]) {
      expect(whole(title), title).toBe(true);
    }
    for (const title of [
      "a bad record",
      "a bad card entry",
      "a last route with a mode a later version added",
      "a card history that is not an object",
      "records that are not an object",
      "unparsable JSON",
      "a value cut short",
      "null",
      "a number",
      "an array",
      "a future version",
      "a version stored as a string",
      "no version",
      "no last key at all",
      "a lastSeenAt of 1e999 reads as Infinity and drops that entry alone",
      "a seen count of 2^53 is not a safe integer",
    ]) {
      expect(whole(title), title).toBe(false);
    }
  });

  it("drops only the part that fails and keeps the rest", () => {
    const stored = progressOf("a valid value");
    expect(Object.keys(stored.cards)).toEqual(["aws-clf-c02-t1.1-01", "aws-clf-c02-t2.1-06"]);
    expect(progressOf("a bad record")).toEqual(stored);
    expect(progressOf("a bad card entry")).toEqual(stored);
    expect(progressOf("a last route with a mode a later version added")).toEqual({ ...stored, last: null });
    expect(progressOf("a card history that is not an object")).toEqual({ ...stored, cards: {} });
    expect(progressOf("records that are not an object")).toEqual({ ...stored, records: {} });
    expect(progressOf("a last route stored before scores were kept").last).toEqual({ route: { deckId: "aws-clf-c02", sectionId: "SEC" }, mode: "classic", score: null, total: null });
  });

  it("reads a value that cannot be read at all as empty progress", () => {
    const empty = { version: 1, cards: {}, records: {}, last: null };
    for (const title of ["unparsable JSON", "a value cut short", "an empty string", "null", "a number", "a string", "an array", "an empty object", "a future version", "a version stored as a string", "no version"]) {
      expect(progressOf(title), title).toEqual(empty);
    }
  });

  it("reads a stored value with no last key as last null and not whole", () => {
    expect(progressOf("no last key at all").last).toBeNull();
    expect(Object.keys(progressOf("no last key at all").cards)).toHaveLength(2);
  });

  it("drops a number that is not finite or not a safe integer, and only the part that holds it", () => {
    expect(Object.keys(progressOf("a lastSeenAt of 1e999 reads as Infinity and drops that entry alone").cards)).toEqual(["b"]);
    expect(progressOf("a record of 1e999 drops that record alone").records).toEqual({ "b/ALL#classic": 2 });
    expect(progressOf("a seen count of 2^53 is not a safe integer").cards).toEqual({});
    expect(progressOf("a seen count of 2^53 - 1 is kept").cards.a.seen).toBe(9007199254740991);
    expect(progressOf("a record of 2^53 is dropped").records).toEqual({});
    expect(progressOf("a score of 1e999 drops the last route").last).toBeNull();
    expect(progressOf("a score written 7.0 is the integer 7").last.score).toBe(7);
  });

  it("writes a negative zero as the tagged number", () => {
    expect(progressOf("a lastSeenAt of -0 is kept as -0").cards.a.lastSeenAt).toEqual({ $number: "-0" });
  });

  it("keeps a __proto__ key as a plain key in the file", () => {
    const { content } = parsed.find((file) => file.vectors.function === "parseProgress")!;
    expect(content).toContain('"__proto__": {');
    expect(Object.keys(caseOf("parseProgress", "a __proto__ key in cards and in records").output.cards)).toEqual(["__proto__"]);
    expect(Object.keys(caseOf("parseProgress", "a __proto__ key in cards and in records").output.records)).toEqual(["__proto__"]);
  });

  it("parseProgress is the progress of readProgress, case by case", () => {
    const reads = vectorsOf("readProgress").cases;
    const parses = vectorsOf("parseProgress").cases;
    expect(parses.map((c) => c.name)).toEqual(reads.map((c) => c.name));
    parses.forEach((parse, i) => {
      expect(parse.input, parse.name).toEqual(reads[i]!.input);
      expect(parse.output, parse.name).toEqual(reads[i]!.output.progress);
    });
  });

  it("covers the raw values of the web tests that must never throw", () => {
    const raws = vectorsOf("parseProgress").cases.map((c) => c.input.raw);
    for (const raw of ["", " ", "{", "undefined", "NaN", "true", '{"version":1}', "\u0000", "{}", "[]", "null", "42"]) expect(raws).toContain(raw);
  });
});

describe("progress vectors: the store", () => {
  const run = (title: string) => caseOf("createLocalStore", title).output as { loads: any[]; items: Record<string, string> | null };
  const KEY = "truthy.progress.v1";
  const SIDE = "truthy.progress.v1.unreadable";
  const empty = { version: 1, cards: {}, records: {}, last: null };

  it("loads empty progress when nothing is stored, the value is corrupt, or the storage throws or is missing", () => {
    expect(run("loads empty progress when nothing has been stored").loads).toEqual([empty]);
    expect(run("loads empty progress when the stored value is corrupt").loads).toEqual([empty]);
    expect(run("loads empty progress when getItem throws").loads).toEqual([empty]);
    expect(run("without a storage: load is empty, save does nothing").loads).toEqual([empty, empty]);
    expect(run("without a storage: load is empty, save does nothing").items).toBeNull();
  });

  it("saves under the key as JSON and reads it back", () => {
    const saved = run("saves under the progress key as JSON");
    expect(JSON.parse(saved.items![KEY]!).records).toEqual({ "aws-clf-c02/SEC#classic": 7 });
    expect(run("round-trips progress through the storage").loads[0].records).toEqual({ "aws-clf-c02/SEC#classic": 7 });
    expect(run("loads what the latest save wrote").loads).toEqual([empty]);
    expect(run("does not touch other keys").items!["truthy.deck.aws-clf-c02"]).toBe("deck");
  });

  it("does not throw and keeps the old value when a save cannot write", () => {
    expect(run("a save does not throw when setItem throws because the storage is full").items).toEqual({});
    expect(run("a save does not throw and writes nothing when getItem throws").items).toEqual({});
    expect(run("keeps the previously stored progress when a save fails").loads[0].records).toEqual({ "aws-clf-c02/SEC#classic": 7 });
  });

  it("keeps the raw value of a value that did not read whole under the side key, before writing over it", () => {
    const names = vectorsOf("createLocalStore").cases.map((c) => c.name).filter((name) => name.startsWith("keeps the raw value of "));
    expect(names).toHaveLength(14);
    for (const name of names) {
      const { input, output } = caseOf("createLocalStore", name);
      const put = input.steps.find((step: any) => step.op === "put");
      expect(output.items[SIDE], name).toBe(put.value);
      expect(JSON.parse(output.items[KEY]).version, name).toBe(1);
    }
  });

  it("loads the valid parts, and keeps the valid records through a save", () => {
    expect(run("loads the valid parts of a value with a dropped part").loads[0].last).toBeNull();
    expect(Object.keys(run("loads the valid parts of a value with a dropped part").loads[0].records)).toEqual(["aws-clf-c02/SEC#classic", "gcp-cdl/ALL#classic"]);
    expect(Object.keys(run("the valid records go through a save, as at the start of a round").loads[0].records)).toEqual(["aws-clf-c02/SEC#classic", "gcp-cdl/ALL#classic"]);
  });

  it("makes the copy once, replaces it with a later unreadable value, and writes none for a whole value", () => {
    expect(run("makes the copy once: later saves over the clean value leave the side key alone").items![SIDE]).toBe("marker");
    expect(run("replaces the side key with a later unreadable value").items![SIDE]).toBe("{second");
    expect(SIDE in run("writes no side key over a value that reads whole, or when nothing is stored").items!).toBe(false);
  });

  it("does not write over a value it could not keep aside, but does when the side key already holds it", () => {
    expect(run("does not write over the value when it cannot be kept aside first").items).toEqual({ [KEY]: "{not json" });
    const written = run("writes over the value when the side key already holds it, though the side key cannot be written").items!;
    expect(written[SIDE]).toBe("{not json");
    expect(JSON.parse(written[KEY]!).version).toBe(1);
  });
});
```

- [ ] **Step 3: Run it and see it fail.**

```bash
npx -y pnpm@10.34.0 vitest run tests/scripts/native/progress.test.ts
```

Expected: the file fails to load, `Error: Cannot find package '@/scripts/native/golden/progress' imported from <repository root>/tests/scripts/native/progress.test.ts`; `Test Files  1 failed (1)`, `Tests  no tests`.

- [ ] **Step 4: Write the progress producer.**

`scripts/native/golden/progress.ts`:

```ts
// Golden vectors for the progress module (src/progress/progress.ts) and the progress store
// (src/progress/local.ts). Every output is computed by calling the TypeScript function; nothing is typed by
// hand except the inputs. The cases are the pinned cases of tests/progress/*.test.ts plus the reading rules of
// reference section 3.5 (finite numbers, safe integers, a stored value without a last key).
import type { Card, Route } from "@/src/content/schema";
import { currentCard, reduce, startRound, summarise, type Answered, type Mode, type RoundEvent, type RoundResult, type RoundState } from "@/src/engine/round";
import { PROGRESS_KEY, UNREADABLE_KEY, createLocalStore } from "@/src/progress/local";
import {
  applyResult,
  bestFor,
  compareWithBest,
  emptyProgress,
  parseProgress,
  pruneDeck,
  readProgress,
  recordKey,
  seenShare,
  type Progress,
} from "@/src/progress/progress";
import { goldenFile, type GoldenCase, type GoldenFile } from "./format";

const PROGRESS_TESTS = ["tests/progress/progress.test.ts", "tests/progress/progress-polish.test.ts", "tests/progress/partial-read.test.ts"] as const;
const STORE_TESTS = ["tests/progress/local.test.ts", "tests/progress/partial-read.test.ts"] as const;

function progressFile(name: string, cases: readonly GoldenCase[]): GoldenFile {
  return goldenFile({ module: "src/progress/progress", function: name, source: "src/progress/progress.ts", tests: PROGRESS_TESTS }, cases);
}

function storeFile(name: string, cases: readonly GoldenCase[]): GoldenFile {
  return goldenFile({ module: "src/progress/local", function: name, source: "src/progress/local.ts", tests: STORE_TESTS }, cases);
}

// ---------- fixtures (the ones of the web tests) ----------

const SEC: Route = { deckId: "aws-clf-c02", sectionId: "SEC" };
const CON: Route = { deckId: "aws-clf-c02", sectionId: "CON" };

function card(id: string, answer = true): Card {
  return {
    id,
    section: "SEC",
    text: { en: { statement: `Statement ${id}`, explanation: `Explanation ${id}` } },
    answer,
    source: { title: "AWS docs", url: "https://docs.aws.amazon.com/" },
    difficulty: 1,
    appliesTo: "",
    conflictGroups: [],
  };
}

function answered(id: string, correct: boolean, at: number): Answered {
  return { card: card(id), given: correct, correct, at };
}

function result(answers: Answered[], options: { route?: Route; abandoned?: boolean; mode?: Mode; score?: number } = {}): RoundResult {
  return {
    mode: options.mode ?? "classic",
    route: options.route ?? SEC,
    score: options.score ?? answers.filter((a) => a.correct).length,
    total: answers.length,
    answers,
    missed: answers.filter((a) => !a.correct),
    abandoned: options.abandoned ?? false,
  };
}

// A classic result with the given score out of ten, all answered at time 1.
function scored(score: number, options: { route?: Route; abandoned?: boolean } = {}): RoundResult {
  return result(
    Array.from({ length: 10 }, (_, i) => answered(`c${i}`, i < score, 1)),
    options,
  );
}

function withRecord(route: Route, best: number, mode: Mode = "classic"): Progress {
  return { ...emptyProgress(), records: { [recordKey(route, mode)]: best } };
}

function seenOnce(at = 1) {
  return { seen: 1, lastCorrect: true, lastSeenAt: at };
}

// A round of `total` answers on SEC in the given mode, with the score the mode's record keeps.
function modeResult(mode: Mode, score: number, total: number, options: { abandoned?: boolean } = {}): RoundResult {
  const answers = Array.from({ length: total }, (_, i) => answered(`m${i}`, true, i + 1));
  return result(answers, { mode, score, abandoned: options.abandoned ?? false });
}

// Plays a round on SEC with startRound and reduce: true for a right answer, false for a wrong one, next after
// each but the last; then `end` (next or abandon).
function playedRound(mode: Mode, rights: readonly boolean[], end: RoundEvent): RoundState {
  const pool = Array.from({ length: 20 }, (_, i) => card(`p${i + 1}`, i % 2 === 0));
  let state = startRound({ mode, route: SEC, pool, history: {}, seed: 7 });
  rights.forEach((right, i) => {
    const truth = currentCard(state)?.answer ?? true;
    state = reduce(state, { type: "answer", value: right ? truth : !truth, at: 100 * (i + 1) });
    if (i < rights.length - 1) state = reduce(state, { type: "next" });
  });
  return reduce(state, end);
}

// ---------- the pure functions ----------

function emptyProgressFile(): GoldenFile {
  return progressFile("emptyProgress", [{ name: "version 1, no card history, no records, no last route", input: {}, output: emptyProgress() }]);
}

function recordKeyFile(): GoldenFile {
  const call = (name: string, route: Route, mode: Mode): GoldenCase => ({ name, input: { route, mode }, output: recordKey(route, mode) });
  return progressFile("recordKey", [
    call("joins the route key and the mode with a hash", SEC, "classic"),
    call("whole deck route", { deckId: "nextjs-rendering", sectionId: "ALL" }, "classic"),
    call("same route, Timed", SEC, "timed"),
    call("same route, Streak", SEC, "streak"),
    call("same route, Three lives", SEC, "lives"),
  ]);
}

function bestForFile(): GoldenFile {
  const call = (name: string, progress: Progress, route: Route, mode: Mode): GoldenCase => ({ name, input: { progress, route, mode }, output: bestFor(progress, route, mode) });
  const played: Progress = { ...emptyProgress(), records: { "aws-clf-c02/SEC#classic": 9, "aws-clf-c02/CON#timed": 0 } };
  return progressFile("bestFor", [
    call("the record of a route and mode", played, SEC, "classic"),
    call("no record for another section", played, { deckId: "aws-clf-c02", sectionId: "ALL" }, "classic"),
    call("no record for another mode", played, SEC, "timed"),
    call("a record of 0 is a record, not null", played, CON, "timed"),
    call("empty progress has no record", emptyProgress(), SEC, "classic"),
  ]);
}

function compareWithBestFile(): GoldenFile {
  const call = (name: string, score: number, previousBest: number | null): GoldenCase => ({ name, input: { score, previousBest }, output: compareWithBest(score, previousBest) });
  return progressFile("compareWithBest", [
    call("a first round when the route and mode had no record", 7, null),
    call("a first round with score 0", 0, null),
    call("a new best when the score beats the record", 8, 7),
    call("equals the best when the score matches the record", 9, 9),
    call("equals a record of 0", 0, 0),
    call("short of the record by 2", 7, 9),
    call("short of the record by 10", 0, 10),
  ]);
}

function applyResultFile(): GoldenFile {
  const apply = (name: string, progress: Progress, round: RoundResult): GoldenCase => ({ name, input: { progress, result: round }, output: applyResult(progress, round) });
  const cases: GoldenCase[] = [];

  // card history
  cases.push(apply("history: an entry for a card answered for the first time", emptyProgress(), result([answered("c1", true, 1000)])));
  cases.push(apply("history: a wrong answer is lastCorrect false", emptyProgress(), result([answered("c1", false, 1000)])));
  cases.push(
    apply(
      "history: adds to the seen count and replaces lastCorrect and lastSeenAt of a known card",
      { ...emptyProgress(), cards: { c1: { seen: 4, lastCorrect: true, lastSeenAt: 500 } } },
      result([answered("c1", false, 2000)]),
    ),
  );
  cases.push(apply("history: each answer keeps its own time", emptyProgress(), result([answered("c1", true, 1000), answered("c2", false, 4000)])));
  cases.push(
    apply(
      "history: cards that were not in the round are left alone",
      { ...emptyProgress(), cards: { other: { seen: 2, lastCorrect: false, lastSeenAt: 10 } } },
      result([answered("c1", true, 1000)]),
    ),
  );
  cases.push(
    apply(
      "history: a round with no answers leaves the history unchanged",
      { ...emptyProgress(), cards: { c1: seenOnce() } },
      result([], { abandoned: true }),
    ),
  );
  cases.push(
    apply(
      "history: the seen count has no ceiling (150 becomes 151)",
      { ...emptyProgress(), cards: { c1: { seen: 150, lastCorrect: true, lastSeenAt: 1 } } },
      result([answered("c1", false, 9)]),
    ),
  );
  cases.push(
    apply(
      "history: a card answered twice in one round counts twice and keeps the later answer",
      emptyProgress(),
      result([answered("c1", true, 100), answered("c2", true, 150), answered("c1", false, 200)]),
    ),
  );

  // the last route
  cases.push(apply("last: the route, the mode and the score of a finished round", emptyProgress(), result([answered("c1", true, 1)])));
  cases.push(apply("last: 7 of 10", emptyProgress(), scored(7)));
  cases.push(
    apply(
      "last: replaces an earlier last route and its score",
      { ...emptyProgress(), last: { route: CON, mode: "classic", score: 9, total: 10 } },
      result([answered("c1", true, 1)], { route: SEC }),
    ),
  );
  cases.push(apply("last: an abandoned round has no score", emptyProgress(), result([answered("c1", true, 1)], { abandoned: true })));

  // records
  cases.push(apply("records: a first record for a route and mode that has none", emptyProgress(), scored(6)));
  cases.push(apply("records: replaces a record that the score beats", withRecord(SEC, 6), scored(8)));
  cases.push(apply("records: keeps a record that the score does not reach", withRecord(SEC, 8), scored(5)));
  cases.push(apply("records: equalling the record is not a new best", withRecord(SEC, 7), scored(7)));
  cases.push(
    apply(
      "records: the records of other routes and modes are kept",
      { ...emptyProgress(), records: { [recordKey(CON, "classic")]: 9, [recordKey(SEC, "timed")]: 20 } },
      scored(4, { route: SEC }),
    ),
  );
  cases.push(apply("records: the record of another section is not compared", withRecord(CON, 9), scored(3, { route: SEC })));
  cases.push(apply("records: a first finished round with no correct answer sets the record 0", emptyProgress(), scored(0)));
  cases.push(apply("records: a later 0 does not replace a record of 0", withRecord(SEC, 0), scored(0)));

  // an abandoned round
  cases.push(
    apply(
      "abandoned: updates the card history",
      emptyProgress(),
      result([answered("c1", true, 100), answered("c2", false, 200)], { abandoned: true }),
    ),
  );
  cases.push(apply("abandoned: does not beat an existing record, however high its score", withRecord(SEC, 2), scored(9, { abandoned: true })));
  cases.push(apply("abandoned: does not set a first record", emptyProgress(), scored(5, { abandoned: true })));
  cases.push(
    apply(
      "abandoned: does not add a score to a record of 0",
      withRecord(SEC, 0),
      scored(4, { abandoned: true }),
    ),
  );

  // one record per class; each case starts from the progress the one before left
  let chain = emptyProgress();
  for (const [mode, score, total] of [["classic", 7, 10], ["streak", 12, 13], ["lives", 21, 21], ["timed", 14, 17]] as const) {
    const case_ = apply(`modes: one record per class on the same route, ${mode}`, chain, modeResult(mode, score, total));
    cases.push(case_);
    chain = applyResult(chain, modeResult(mode, score, total)).progress;
  }
  cases.push(apply("modes: equalling a Streak record is not a new best", withRecord(SEC, 12, "streak"), modeResult("streak", 12, 13)));
  cases.push(apply("modes: a longer streak replaces the record", withRecord(SEC, 12, "streak"), modeResult("streak", 13, 14)));
  cases.push(apply("modes: a first Timed round with no correct answer sets the record 0", emptyProgress(), modeResult("timed", 0, 3)));
  for (const mode of ["streak", "lives", "timed"] as const) {
    cases.push(apply(`modes: a round that was left sets no record in ${mode}`, withRecord(SEC, 4, mode), modeResult(mode, 9, 9, { abandoned: true })));
  }
  cases.push(apply("modes: the last round keeps the class's own score", emptyProgress(), modeResult("lives", 21, 21)));
  cases.push(
    apply(
      "modes: a card answered twice in Three lives counts two sightings and keeps the later verdict",
      emptyProgress(),
      result([answered("A", false, 100), answered("B", true, 200), answered("A", true, 300)], { mode: "lives", score: 3 }),
    ),
  );
  cases.push(
    apply(
      "modes: a card answered twice, added to stored history",
      { ...emptyProgress(), cards: { A: { seen: 4, lastCorrect: true, lastSeenAt: 50 } } },
      result([answered("A", false, 100), answered("B", true, 200), answered("A", true, 300)], { mode: "lives", score: 3 }),
    ),
  );
  cases.push(
    apply(
      "modes: a card answered right, then wrong, ends wrong",
      emptyProgress(),
      result([answered("A", true, 100), answered("A", false, 200)], { mode: "lives", score: 2 }),
    ),
  );

  // results the engine itself summarises
  const finished = playedRound("streak", [true, true, true, false], { type: "next" });
  cases.push(apply("engine: a finished Streak round (3 in a row, 4 cards answered)", emptyProgress(), summarise(finished)));
  const left = playedRound("streak", [true, true, true, true, true, false], { type: "abandon" });
  cases.push(apply("engine: a decided Streak round that was left sets no record", withRecord(SEC, 4, "streak"), summarise(left)));

  return progressFile("applyResult", cases);
}

function pruneDeckFile(): GoldenFile {
  const prune = (name: string, progress: Progress, deckId: string, cardIds: readonly string[]): GoldenCase => ({
    name,
    input: { progress, deckId, cardIds },
    output: pruneDeck(progress, deckId, cardIds),
  });
  const before: Progress = {
    version: 1,
    cards: {
      "aws-clf-c02-t1.1-01": seenOnce(),
      "aws-clf-c02-t1.1-02": seenOnce(),
      "aws-clf-c02-t2.1-06": seenOnce(),
      "nextjs-rendering-rsc-01": seenOnce(),
    },
    records: { "aws-clf-c02/SEC#classic": 7 },
    last: { route: SEC, mode: "classic", score: 7, total: 10 },
  };
  const lookalikes: Progress = {
    ...emptyProgress(),
    cards: { "aws-clf-c02-t1.1-01": seenOnce(), "aws-clf-c02x-1": seenOnce(), "nextjs-renderingx-1": seenOnce() },
  };
  const proDeck: Progress = { ...emptyProgress(), cards: { "gcp-cdl-1": seenOnce(), "gcp-cdl-pro-1": seenOnce() } };
  return progressFile("pruneDeck", [
    prune("removes the deck's cards that no longer exist", before, "aws-clf-c02", ["aws-clf-c02-t1.1-01", "aws-clf-c02-t2.1-06"]),
    prune("keeps the history of other decks' cards", before, "aws-clf-c02", ["aws-clf-c02-t1.1-01"]),
    prune("keeps the entries of the cards that still exist unchanged", before, "aws-clf-c02", ["aws-clf-c02-t1.1-01", "aws-clf-c02-t1.1-02", "aws-clf-c02-t2.1-06"]),
    prune("does not add entries for current cards that were never seen", before, "aws-clf-c02", ["aws-clf-c02-t1.1-01", "aws-clf-c02-t9.9-99"]),
    prune("keeps the records and the last route when every card goes", before, "aws-clf-c02", []),
    prune("does nothing for a deck with no history", before, "gcp-cdl", ["gcp-cdl-01"]),
    prune("a card id that only starts with the same letters belongs to no deck here (aws)", lookalikes, "aws-clf-c02", []),
    prune("a card id that only starts with the same letters belongs to no deck here (next)", lookalikes, "nextjs-rendering", []),
    // The test is the plain prefix `${deckId}-`: a card of "gcp-cdl-pro" starts with "gcp-cdl-" too, so pruning
    // "gcp-cdl" drops it unless it is listed. Natives port the plain prefix rule, not a longest-prefix rule.
    prune("the plain prefix rule: pruning gcp-cdl also drops a gcp-cdl-pro card that is not listed", proDeck, "gcp-cdl", ["gcp-cdl-1"]),
  ]);
}

function seenShareFile(): GoldenFile {
  const share = (name: string, history: Progress["cards"], cardIds: readonly string[]): GoldenCase => ({ name, input: { history, cardIds }, output: seenShare(history, cardIds) });
  return progressFile("seenShare", [
    share("0 for a deck with no cards", { a: seenOnce() }, []),
    share("0 with no history", {}, ["a", "b"]),
    share("0 with neither cards nor history", {}, []),
    share("the share of the given cards seen at least once", { a: seenOnce(), c: seenOnce() }, ["a", "b", "c", "d"]),
    share("1 when every card has been seen", { a: seenOnce(), b: seenOnce() }, ["a", "b"]),
    share("history of cards that are not in the list is ignored", { a: seenOnce(), gone: seenOnce(), other: seenOnce() }, ["a", "b"]),
    share("an entry with a seen count of 0 is not seen", { a: { seen: 0, lastCorrect: false, lastSeenAt: 0 } }, ["a"]),
    share("a card listed twice counts once", { a: seenOnce() }, ["a", "a", "b"]),
    share("one third", { a: seenOnce() }, ["a", "b", "c"]),
  ]);
}

// ---------- reading a stored value ----------

const STORED: Progress = {
  version: 1,
  cards: {
    "aws-clf-c02-t1.1-01": { seen: 3, lastCorrect: false, lastSeenAt: 1_790_000_000_000 },
    "aws-clf-c02-t2.1-06": { seen: 1, lastCorrect: true, lastSeenAt: 1_790_000_100_000 },
  },
  records: { "aws-clf-c02/SEC#classic": 7, "gcp-cdl/ALL#classic": 8 },
  last: { route: SEC, mode: "classic", score: 7, total: 10 },
};

const ENTRY = { seen: 3, lastCorrect: false, lastSeenAt: 5 };
const json = (value: unknown): string => JSON.stringify(value);
const withCards = (cards: unknown): string => json({ ...STORED, cards });
const withRecords = (records: unknown): string => json({ ...STORED, records });
const withLast = (last: unknown): string => json({ ...STORED, last });

// The stored values the reading is tried on: each one is a case of readProgress and of parseProgress. The
// raw strings that need a number JSON.stringify cannot write (1e999, -0) are written out.
const RAW_VALUES: readonly { name: string; raw: string | null }[] = [
  { name: "a valid value", raw: json(STORED) },
  { name: "nothing stored", raw: null },
  { name: "a progress with no last route", raw: json({ ...STORED, last: null }) },
  { name: "the last route of an abandoned round, without a score", raw: withLast({ route: SEC, mode: "classic", score: null, total: null }) },
  { name: "a last route stored before scores were kept", raw: withLast({ route: SEC, mode: "classic" }) },
  { name: "only unknown fields to drop", raw: json({ ...STORED, theme: "night" }) },
  {
    name: "unknown fields in an entry, in the last route and in its route",
    raw: json({ ...STORED, theme: "night", cards: { "aws-clf-c02-t1.1-01": { ...ENTRY, flagged: true } }, last: { route: { ...SEC, label: "Security" }, mode: "classic", at: 9 } }),
  },
  { name: "a bad record", raw: withRecords({ ...STORED.records, "aws-clf-c02/APP#classic": 7.5 }) },
  { name: "a record that is a string", raw: withRecords({ ...STORED.records, "aws-clf-c02/APP#classic": "8" }) },
  { name: "a negative record", raw: withRecords({ ...STORED.records, "aws-clf-c02/APP#classic": -3 }) },
  { name: "a bad card entry", raw: withCards({ ...STORED.cards, "aws-clf-c02-t3.1-01": { seen: -1, lastCorrect: true, lastSeenAt: 1 } }) },
  { name: "a card entry with a seen count that is a string", raw: withCards({ ...STORED.cards, a: { seen: "1", lastCorrect: true, lastSeenAt: 1 } }) },
  { name: "a card entry with a fractional seen count", raw: withCards({ ...STORED.cards, a: { seen: 1.5, lastCorrect: true, lastSeenAt: 1 } }) },
  { name: "a card entry with a negative lastSeenAt", raw: withCards({ ...STORED.cards, a: { seen: 3, lastCorrect: false, lastSeenAt: -1 } }) },
  { name: "a card entry whose lastCorrect is not a boolean", raw: withCards({ ...STORED.cards, a: { seen: 3, lastCorrect: 1, lastSeenAt: 1 } }) },
  { name: "a last route with a mode a later version added", raw: withLast({ route: SEC, mode: "daily", score: 7, total: 10 }) },
  { name: "a last route with a mode that is not known", raw: withLast({ route: SEC, mode: "zen" }) },
  { name: "a last route with no mode", raw: withLast({ route: SEC }) },
  { name: "a last route with an empty deck id", raw: withLast({ route: { deckId: "", sectionId: "SEC" }, mode: "classic" }) },
  { name: "a last route with an empty section id", raw: withLast({ route: { deckId: "aws-clf-c02", sectionId: "" }, mode: "classic", score: 8, total: 10 }) },
  { name: "a last route with a negative score", raw: withLast({ route: SEC, mode: "classic", score: -1, total: 10 }) },
  { name: "a last route with a fractional total", raw: withLast({ route: SEC, mode: "classic", score: 7, total: 9.5 }) },
  { name: "a last route with a score that is a string", raw: withLast({ route: SEC, mode: "classic", score: "7", total: 10 }) },
  { name: "a last route with a score and no total", raw: withLast({ route: SEC, mode: "classic", score: 7 }) },
  { name: "a card history that is not an object", raw: withCards("x") },
  { name: "a card history that is an array", raw: withCards([]) },
  { name: "a card history that is null", raw: withCards(null) },
  { name: "records that are not an object", raw: withRecords([]) },
  { name: "records that are null", raw: withRecords(null) },
  { name: "unparsable JSON", raw: "{not json" },
  { name: "a value cut short", raw: json(STORED).slice(0, 40) },
  { name: "an empty string", raw: "" },
  { name: "a space", raw: " " },
  { name: "an opening brace only", raw: "{" },
  { name: "the word undefined", raw: "undefined" },
  { name: "NaN", raw: "NaN" },
  { name: "true", raw: "true" },
  { name: "a NUL character", raw: "\u0000" },
  { name: "null", raw: "null" },
  { name: "a number", raw: "42" },
  { name: "a string", raw: '"progress"' },
  { name: "an array", raw: "[]" },
  { name: "an empty object", raw: "{}" },
  { name: "a version and nothing else", raw: '{"version":1}' },
  { name: "a future version", raw: json({ ...STORED, version: 2 }) },
  { name: "a version stored as a string", raw: json({ ...STORED, version: "1" }) },
  { name: "a version stored as true", raw: json({ ...STORED, version: true }) },
  { name: "a version written 1.0", raw: '{"version":1.0,"cards":{},"records":{},"last":null}' },
  { name: "no version", raw: json({ cards: STORED.cards, records: STORED.records, last: STORED.last }) },
  { name: "no last key at all", raw: json({ version: 1, cards: STORED.cards, records: STORED.records }) },
  { name: "no cards key and no records key", raw: '{"version":1,"last":null}' },
  {
    name: "a __proto__ key stays a plain key, next to a dropped neighbour",
    raw: '{"version":1,"cards":{"__proto__":{"seen":1,"lastCorrect":true,"lastSeenAt":1},"bad":{"seen":-1}},"records":{},"last":null}',
  },
  { name: "a __proto__ key in cards and in records", raw: '{"version":1,"cards":{"__proto__":{"seen":1,"lastCorrect":true,"lastSeenAt":1}},"records":{"__proto__":3},"last":null}' },
  // Numbers: finite, whole where whole is needed, safe integers (reference section 3.5).
  { name: "a lastSeenAt of 1e999 reads as Infinity and drops that entry alone", raw: '{"version":1,"cards":{"a":{"seen":1,"lastCorrect":true,"lastSeenAt":1e999},"b":{"seen":1,"lastCorrect":true,"lastSeenAt":2}},"records":{},"last":null}' },
  { name: "a record of 1e999 drops that record alone", raw: '{"version":1,"cards":{},"records":{"a/ALL#classic":1e999,"b/ALL#classic":2},"last":null}' },
  { name: "a seen count of 2^53 is not a safe integer", raw: '{"version":1,"cards":{"a":{"seen":9007199254740992,"lastCorrect":true,"lastSeenAt":1}},"records":{},"last":null}' },
  { name: "a seen count of 2^53 - 1 is kept", raw: '{"version":1,"cards":{"a":{"seen":9007199254740991,"lastCorrect":true,"lastSeenAt":1}},"records":{},"last":null}' },
  { name: "a record of 2^53 is dropped", raw: '{"version":1,"cards":{},"records":{"a/ALL#classic":9007199254740992},"last":null}' },
  { name: "a fractional lastSeenAt is kept", raw: '{"version":1,"cards":{"a":{"seen":1,"lastCorrect":true,"lastSeenAt":1.5}},"records":{},"last":null}' },
  { name: "a lastSeenAt of 0 is kept", raw: '{"version":1,"cards":{"a":{"seen":0,"lastCorrect":false,"lastSeenAt":0}},"records":{},"last":null}' },
  { name: "a lastSeenAt of -0 is kept as -0", raw: '{"version":1,"cards":{"a":{"seen":1,"lastCorrect":true,"lastSeenAt":-0}},"records":{},"last":null}' },
  { name: "a score written 7.0 is the integer 7", raw: '{"version":1,"cards":{},"records":{},"last":{"route":{"deckId":"aws-clf-c02","sectionId":"SEC"},"mode":"classic","score":7.0,"total":10}}' },
  { name: "a score of 1e999 drops the last route", raw: '{"version":1,"cards":{},"records":{},"last":{"route":{"deckId":"aws-clf-c02","sectionId":"SEC"},"mode":"classic","score":1e999,"total":10}}' },
];

function readProgressFile(): GoldenFile {
  return progressFile(
    "readProgress",
    RAW_VALUES.map(({ name, raw }) => ({ name, input: { raw }, output: readProgress(raw) })),
  );
}

function parseProgressFile(): GoldenFile {
  return progressFile(
    "parseProgress",
    RAW_VALUES.map(({ name, raw }) => ({ name, input: { raw }, output: parseProgress(raw) })),
  );
}

// ---------- the store ----------

// A script for createLocalStore over a storage held as plain data, so a native can run it over its own
// key-value store. Steps run in order; the output holds what each load returned and the storage at the end.
//   load            store.load(); the value goes into `loads`
//   save            store.save(progress)
//   resave          store.save(store.load()), as the start of a round does
//   put             the script writes the key straight into the storage (no store involved)
//   breakGet        from here on every getItem throws
//   breakSet        from here on setItem throws for these keys ("all": every key)
// `storage: null` is createLocalStore(undefined): no storage at all.
type StoreStep =
  | { op: "load" }
  | { op: "save"; progress: Progress }
  | { op: "resave" }
  | { op: "put"; key: string; value: string }
  | { op: "breakGet" }
  | { op: "breakSet"; keys: readonly string[] | "all" };

interface StoreScript {
  storage: { items: Record<string, string> } | null;
  steps: readonly StoreStep[];
}

function runStore(script: StoreScript): { loads: Progress[]; items: Record<string, string> | null } {
  const items = new Map(Object.entries(script.storage?.items ?? {}));
  let getBroken = false;
  let setBroken: readonly string[] | "all" = [];
  const storage = {
    getItem(key: string): string | null {
      if (getBroken) throw new DOMException("The operation is insecure.", "SecurityError");
      return items.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
      if (setBroken === "all" || setBroken.includes(key)) throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
      items.set(key, String(value));
    },
  };
  const store = createLocalStore(script.storage === null ? undefined : storage);
  const loads: Progress[] = [];
  for (const step of script.steps) {
    if (step.op === "load") loads.push(store.load());
    else if (step.op === "save") store.save(step.progress);
    else if (step.op === "resave") store.save(store.load());
    else if (step.op === "put") items.set(step.key, step.value);
    else if (step.op === "breakGet") getBroken = true;
    else setBroken = step.keys;
  }
  return { loads, items: script.storage === null ? null : Object.fromEntries(items) };
}

const PLAYED: Progress = {
  version: 1,
  cards: { "aws-clf-c02-t2.1-06": { seen: 2, lastCorrect: true, lastSeenAt: 1_790_000_000_000 } },
  records: { "aws-clf-c02/SEC#classic": 7 },
  last: { route: SEC, mode: "classic", score: 7, total: 10 },
};

function createLocalStoreFile(): GoldenFile {
  const script = (name: string, input: StoreScript): GoldenCase => ({ name, input, output: runStore(input) });
  const empty = { items: {} };
  const put = (value: string): StoreStep => ({ op: "put", key: PROGRESS_KEY, value });
  const cases: GoldenCase[] = [
    script("loads empty progress when nothing has been stored", { storage: empty, steps: [{ op: "load" }] }),
    script("saves under the progress key as JSON", { storage: empty, steps: [{ op: "save", progress: PLAYED }] }),
    script("round-trips progress through the storage", { storage: empty, steps: [{ op: "save", progress: PLAYED }, { op: "load" }] }),
    script("loads what the latest save wrote", { storage: empty, steps: [{ op: "save", progress: PLAYED }, { op: "save", progress: emptyProgress() }, { op: "load" }] }),
    script("loads empty progress when the stored value is corrupt", { storage: empty, steps: [put("{corrupt"), { op: "load" }] }),
    script("does not touch other keys", { storage: { items: { "truthy.deck.aws-clf-c02": "deck" } }, steps: [{ op: "save", progress: PLAYED }] }),
    script("without a storage: load is empty, save does nothing", { storage: null, steps: [{ op: "load" }, { op: "save", progress: PLAYED }, { op: "load" }] }),
    script("loads empty progress when getItem throws", { storage: { items: { [PROGRESS_KEY]: JSON.stringify(PLAYED) } }, steps: [{ op: "breakGet" }, { op: "load" }] }),
    script("a save does not throw and writes nothing when getItem throws", { storage: empty, steps: [{ op: "breakGet" }, { op: "save", progress: PLAYED }] }),
    script("a save does not throw when setItem throws because the storage is full", { storage: empty, steps: [{ op: "breakSet", keys: "all" }, { op: "save", progress: PLAYED }] }),
    script("keeps the previously stored progress when a save fails", {
      storage: empty,
      steps: [{ op: "save", progress: PLAYED }, { op: "breakSet", keys: "all" }, { op: "save", progress: emptyProgress() }, { op: "load" }],
    }),
  ];

  // A value that did not read back whole: the valid parts load, and a save keeps the raw value aside first.
  const dropped = RAW_VALUES.find((value) => value.name === "a last route with a mode a later version added");
  if (dropped?.raw === undefined || dropped.raw === null) throw new Error("the dropped-part value is missing");
  cases.push(script("loads the valid parts of a value with a dropped part", { storage: empty, steps: [put(dropped.raw), { op: "load" }] }));
  cases.push(script("the valid records go through a save, as at the start of a round", { storage: empty, steps: [put(dropped.raw), { op: "resave" }, { op: "load" }] }));
  const sideCopyNames = [
    "a bad record",
    "a bad card entry",
    "a last route with a mode a later version added",
    "a card history that is not an object",
    "records that are not an object",
    "unparsable JSON",
    "a value cut short",
    "null",
    "a number",
    "an array",
    "a future version",
    "a version stored as a string",
    "no version",
    "no last key at all",
  ];
  for (const name of sideCopyNames) {
    const value = RAW_VALUES.find((candidate) => candidate.name === name);
    if (value?.raw === undefined || value.raw === null) throw new Error(`the value "${name}" is missing`);
    cases.push(script(`keeps the raw value of ${name} under the side key before writing over it`, { storage: empty, steps: [put(value.raw), { op: "resave" }] }));
  }
  cases.push(
    script("makes the copy once: later saves over the clean value leave the side key alone", {
      storage: empty,
      steps: [put("{not json"), { op: "save", progress: STORED }, { op: "put", key: UNREADABLE_KEY, value: "marker" }, { op: "save", progress: emptyProgress() }],
    }),
  );
  cases.push(
    script("replaces the side key with a later unreadable value", {
      storage: empty,
      steps: [put("{first"), { op: "save", progress: STORED }, put("{second"), { op: "save", progress: STORED }],
    }),
  );
  cases.push(script("writes no side key over a value that reads whole, or when nothing is stored", { storage: empty, steps: [{ op: "save", progress: STORED }, { op: "save", progress: emptyProgress() }] }));
  cases.push(
    script("does not write over the value when it cannot be kept aside first", {
      storage: empty,
      steps: [put("{not json"), { op: "breakSet", keys: [UNREADABLE_KEY] }, { op: "save", progress: STORED }],
    }),
  );
  cases.push(
    script("writes over the value when the side key already holds it, though the side key cannot be written", {
      storage: { items: { [UNREADABLE_KEY]: "{not json" } },
      steps: [put("{not json"), { op: "breakSet", keys: [UNREADABLE_KEY] }, { op: "save", progress: STORED }],
    }),
  );
  return storeFile("createLocalStore", cases);
}

function storeKeyFiles(): GoldenFile[] {
  return [
    storeFile("PROGRESS_KEY", [{ name: "the one versioned key", input: null, output: PROGRESS_KEY }]),
    storeFile("UNREADABLE_KEY", [{ name: "where an unreadable value is kept aside", input: null, output: UNREADABLE_KEY }]),
  ];
}

export function golden(): GoldenFile[] {
  return [
    emptyProgressFile(),
    recordKeyFile(),
    bestForFile(),
    compareWithBestFile(),
    applyResultFile(),
    pruneDeckFile(),
    seenShareFile(),
    readProgressFile(),
    parseProgressFile(),
    ...storeKeyFiles(),
    createLocalStoreFile(),
  ];
}
```

- [ ] **Step 5: Run the test and the type check.**

```bash
npx -y pnpm@10.34.0 vitest run tests/scripts/native/progress.test.ts
npx -y pnpm@10.34.0 typecheck
```

Expected: `Test Files  1 passed (1)`, `Tests  34 passed (34)`; `tsc --noEmit` prints nothing after the script header and exits 0.

- [ ] **Step 6: Commit.**

```bash
git add scripts/native/golden/progress.ts tests/scripts/native/progress.test.ts
git commit -m "feat: add the golden vectors for progress and the progress store"
```

- [ ] **Step 7: Write the content test.**

`tests/scripts/native/content.test.ts`:

```ts
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MODE_TABLE } from "@/src/app-state/modes";
import { golden, withClosedClasses } from "@/scripts/native/golden/content";

// The vectors of the content helpers and the class table: the shape of every file, and the values the web's
// own tests pin, read back out of the generated files.

const root = fileURLToPath(new URL("../../../", import.meta.url));

interface Case {
  name: string;
  input: any;
  output: any;
}
interface Vectors {
  format: number;
  module: string;
  function: string;
  source: string;
  tests: string[];
  cards: Record<string, unknown>;
  cases: Case[];
}

const files = golden();
const parsed = files.map((file) => ({ path: file.path, content: file.content, vectors: JSON.parse(file.content) as Vectors }));

function vectorsOf(name: string): Vectors {
  const found = parsed.find((file) => file.vectors.function === name);
  if (!found) throw new Error(`no vectors for ${name}`);
  return found.vectors;
}

function caseOf(name: string, title: string): Case {
  const found = vectorsOf(name).cases.find((candidate) => candidate.name === title);
  if (!found) throw new Error(`no case "${title}" in ${name}`);
  return found;
}

describe("content vectors: the files", () => {
  it("writes one file for each function and constant of the content helpers and the class table", () => {
    expect(files.map((file) => file.path).sort()).toEqual([
      "native-data/golden/src.app-state.modes.MODE_TABLE.json",
      "native-data/golden/src.app-state.modes.isOffered.json",
      "native-data/golden/src.app-state.modes.lastScoreText.json",
      "native-data/golden/src.app-state.modes.modeInfo.json",
      "native-data/golden/src.content.load.poolFor.json",
      "native-data/golden/src.content.schema.WHOLE_DECK.json",
      "native-data/golden/src.content.schema.deckPassName.json",
      "native-data/golden/src.content.schema.findRoute.json",
      "native-data/golden/src.content.schema.routeKey.json",
      "native-data/golden/src.content.text.plainText.json",
      "native-data/golden/src.content.text.textParts.json",
    ]);
  });

  it("names a source file and test files that exist, and the module and function in the path", () => {
    for (const { path, vectors } of parsed) {
      expect(vectors.format).toBe(1);
      expect(path).toBe(`native-data/golden/${vectors.module.replaceAll("/", ".")}.${vectors.function}.json`);
      expect(existsSync(`${root}${vectors.source}`), vectors.source).toBe(true);
      for (const test of vectors.tests) expect(existsSync(`${root}${test}`), test).toBe(true);
    }
  });

  it("gives every case a distinct name, an input and an output, and puts every card it mentions in the cards table", () => {
    for (const { path, content, vectors } of parsed) {
      const names = vectors.cases.map((candidate) => candidate.name);
      expect(new Set(names).size, path).toBe(names.length);
      for (const candidate of vectors.cases) {
        expect(candidate, `${path}: ${candidate.name}`).toHaveProperty("input");
        expect(candidate, `${path}: ${candidate.name}`).toHaveProperty("output");
      }
      for (const [, id] of content.matchAll(/"\$card": "([^"]+)"/g)) expect(Object.keys(vectors.cards), `${path}: ${id}`).toContain(id);
    }
  });

  it("gives byte-identical files on a second run, and leaves the class table open as it found it", () => {
    expect(golden()).toEqual(files);
    expect(MODE_TABLE.map((row) => row.offered)).toEqual([true, true, true, true]);
  });
});

describe("content vectors: routes and names", () => {
  it("pins the whole-deck id and the route key", () => {
    expect(vectorsOf("WHOLE_DECK").cases[0]).toMatchObject({ input: null, output: "ALL" });
    expect(caseOf("routeKey", "joins the deck id and the section id with a slash").output).toBe("aws-clf-c02/SEC");
    expect(caseOf("routeKey", "uses ALL for the whole deck").output).toBe("nextjs-rendering/ALL");
  });

  it("names a deck on the pass: its own pass name, else the platform and the title", () => {
    expect(caseOf("deckPassName", "joins the platform and the deck title when the deck has no pass name").output).toBe("AWS Cloud Practitioner");
    expect(caseOf("deckPassName", "uses the deck's pass name when it has one").output).toBe("Google Cloud Digital Leader");
    expect(caseOf("deckPassName", "Next.js Rendering").output).toBe("Next.js Rendering");
  });

  it("finds a route as the ids of what it found, or null", () => {
    expect(caseOf("findRoute", "finds a section route").output).toEqual({ areaId: "cloud", platformId: "aws", deckId: "aws-clf-c02", sectionId: "SEC" });
    expect(caseOf("findRoute", "finds a whole-deck route of a deck without sections").output).toEqual({ areaId: "cloud", platformId: "gcp", deckId: "gcp-cdl", sectionId: null });
    expect(caseOf("findRoute", "finds a whole-deck route of a deck with sections").output).toEqual({ areaId: "cloud", platformId: "aws", deckId: "aws-clf-c02", sectionId: null });
    for (const title of [
      "finds nothing when the deck is gone",
      "finds nothing when the section is gone",
      "finds nothing for a section of a deck that has none",
      "finds nothing for an empty section id",
      "a section id is not read case-insensitively",
    ]) {
      expect(caseOf("findRoute", title).output, title).toBeNull();
    }
    expect(caseOf("findRoute", "finds a section route").input.index.areas).toHaveLength(3);
  });
});

describe("content vectors: the pool of a route", () => {
  const ids = (title: string) => caseOf("poolFor", title).output.map((ref: { $card: string }) => ref.$card);

  it("returns the cards of the chosen section in deck order, or all of them for the whole deck", () => {
    expect(ids("only the cards of the chosen section, in deck order")).toEqual(["aws-clf-001", "aws-clf-003"]);
    expect(ids("the other section")).toEqual(["aws-clf-002"]);
    expect(ids("every card for the whole deck")).toEqual(["aws-clf-001", "aws-clf-002", "aws-clf-003"]);
    expect(ids("an empty array for a section the deck does not have")).toEqual([]);
    expect(ids("the cards of a deck without sections are the whole deck")).toEqual(["gcp-cdl-001", "gcp-cdl-002"]);
    expect(ids("a deck without sections has no section")).toEqual([]);
    expect(ids("a section id is compared exactly")).toEqual([]);
  });

  it("writes the deck's cards as references with the full cards in the table", () => {
    const { input } = caseOf("poolFor", "every card for the whole deck");
    expect(input.deck.cards).toEqual([{ $card: "aws-clf-001" }, { $card: "aws-clf-002" }, { $card: "aws-clf-003" }]);
    expect(Object.keys(vectorsOf("poolFor").cards)).toEqual(["aws-clf-001", "aws-clf-002", "aws-clf-003", "gcp-cdl-001", "gcp-cdl-002"]);
  });
});

describe("content vectors: card text", () => {
  const parts = (title: string) => caseOf("textParts", title).output;

  it("splits a text into plain and code parts", () => {
    expect(parts("one plain part for a text without backticks")).toEqual([{ text: "AWS patches the host.", code: false }]);
    expect(parts("each pair of backticks is a code part, without the backticks")).toEqual([
      { text: "An ", code: false },
      { text: "asserts x is string", code: true },
      { text: " function narrows ", code: false },
      { text: "x", code: true },
      { text: " after a call.", code: false },
    ]);
    expect(parts("no empty plain part around a fragment at the start or the end")).toEqual([
      { text: "docker run", code: true },
      { text: " starts ", code: false },
      { text: "nginx", code: true },
    ]);
    expect(parts("no empty plain part between two fragments")).toEqual([
      { text: "a", code: true },
      { text: "b", code: true },
    ]);
    expect(parts("a backtick without a partner is a code part of its own")).toEqual([
      { text: "one ", code: false },
      { text: "`", code: true },
      { text: " two", code: false },
    ]);
    expect(parts("an empty pair is two code parts of their own")).toEqual([
      { text: "a ", code: false },
      { text: "`", code: true },
      { text: "`", code: true },
      { text: " b", code: false },
    ]);
    expect(parts("empty for an empty text")).toEqual([]);
  });

  it("shows a text as it is read: code without its backticks", () => {
    expect(caseOf("plainText", "a code fragment with a quote and a bracket").output).toBe('Before narrowing, x.indexOf("a") is accepted on x: string | string[].');
    expect(caseOf("plainText", "a backtick without a partner is a code part of its own").output).toBe("one ` two");
    expect(caseOf("plainText", "one plain part for a text without backticks").output).toBe("AWS patches the host.");
  });

  it("runs plainText on the same texts as textParts", () => {
    expect(vectorsOf("plainText").cases.map((c) => c.input.text)).toEqual(vectorsOf("textParts").cases.map((c) => c.input.text));
  });
});

describe("content vectors: the class table", () => {
  it("lists the four classes in the order of the class step, with their exact copy", () => {
    expect(vectorsOf("MODE_TABLE").cases[0]!.output.map((row: any) => [row.id, row.name, row.description, row.unit, row.offered])).toEqual([
      ["classic", "Classic", "Correct answers out of 10 cards.", "of 10", true],
      ["streak", "Streak", "Correct answers in a row, until the first wrong one.", "in a row", true],
      ["lives", "Three lives", "Cards answered until the third wrong one.", "cards", true],
      ["timed", "Timed", "Correct answers in one minute, wrong ones cost nothing.", "correct", true],
    ]);
  });

  it("gives the row of a mode and throws for a mode it does not know", () => {
    expect(caseOf("modeInfo", "the row of lives").output.name).toBe("Three lives");
    expect(caseOf("modeInfo", "throws for a class the table does not know").output).toEqual({ $throws: 'Unknown mode "blitz".' });
  });

  it("offers all four classes, and not Timed once a case closes it", () => {
    for (const mode of ["classic", "streak", "lives", "timed"]) expect(caseOf("isOffered", `${mode} is offered`).output).toBe(true);
    expect(caseOf("isOffered", "with Timed closed, timed is not offered").output).toBe(false);
    expect(caseOf("isOffered", "with Timed closed, streak is offered").output).toBe(true);
    const { input } = caseOf("isOffered", "with Timed closed, timed is not offered");
    expect(input.modeTable.map((row: any) => [row.id, row.offered])).toEqual([
      ["classic", true],
      ["streak", true],
      ["lives", true],
      ["timed", false],
    ]);
  });

  it("closes a class only while the case runs, even when the case throws", () => {
    expect(() =>
      withClosedClasses(["streak"], () => {
        throw new Error("inside");
      }),
    ).toThrow("inside");
    expect(MODE_TABLE.every((row) => row.offered)).toBe(true);
  });

  it("words the last score the way each class counts", () => {
    const text = (title: string) => caseOf("lastScoreText", title).output;
    expect(text("Classic says the score out of the round's total")).toBe("7 of 10");
    expect(text("Classic uses the total of the round, not the ten of the class card (5 of 7)")).toBe("5 of 7");
    expect(text("Classic with no correct answer (0 of 12)")).toBe("0 of 12");
    expect(text("Streak counts in a row")).toBe("13 in a row");
    expect(text("Streak says 1 in a row, with no plural")).toBe("1 in a row");
    expect(text("Streak ignores the total")).toBe("5 in a row");
    expect(text("Three lives counts cards")).toBe("21 cards");
    expect(text("Timed counts correct answers")).toBe("14 correct");
    expect(text("Timed with nothing answered")).toBe("0 correct");
  });
});
```

- [ ] **Step 8: Run it and see it fail.**

```bash
npx -y pnpm@10.34.0 vitest run tests/scripts/native/content.test.ts
```

Expected: `Error: Cannot find package '@/scripts/native/golden/content' imported from <repository root>/tests/scripts/native/content.test.ts`; `Test Files  1 failed (1)`, `Tests  no tests`.

- [ ] **Step 9: Write the deck index the content and start vectors run on.**

`scripts/native/golden/catalog-fixture.ts`:

```ts
// The small deck index the content, catalog and start-flow vectors run on: the index of the web's start-flow
// tests (tests/components/start/fixtures.ts), written out here so the producers need no test file.
//   Cloud: AWS (CLF with two sections), Google Cloud (CDL, no sections, its own pass name), Azure (no decks).
//   Frontend: Next.js (RND with one section). DevOps: no platforms at all.
import type { DeckIndex } from "@/src/content/schema";

export const CATALOG_INDEX: DeckIndex = {
  areas: [
    {
      id: "cloud",
      title: "Cloud",
      platforms: [
        {
          id: "aws",
          title: "AWS",
          decks: [
            {
              id: "aws-clf-c02",
              code: "CLF",
              title: "Cloud Practitioner",
              cardCount: 92,
              version: "2026-10-01",
              hash: "clf-1",
              sections: [
                { id: "CON", title: "Cloud concepts", cardCount: 45 },
                { id: "SEC", title: "Security and compliance", cardCount: 47 },
              ],
            },
          ],
        },
        {
          id: "gcp",
          title: "Google Cloud",
          decks: [
            {
              id: "gcp-cdl",
              code: "CDL",
              title: "Cloud Digital Leader",
              passName: "Google Cloud Digital Leader",
              cardCount: 133,
              version: "2026-10-01",
              hash: "cdl-1",
              sections: [],
            },
          ],
        },
        { id: "azure", title: "Azure", decks: [] },
      ],
    },
    {
      id: "frontend",
      title: "Frontend",
      platforms: [
        {
          id: "nextjs",
          title: "Next.js",
          decks: [
            {
              id: "nextjs-rendering",
              code: "RND",
              title: "Rendering",
              cardCount: 12,
              version: "2026-10-01",
              hash: "rnd-1",
              sections: [{ id: "RSC", title: "Server and client components", cardCount: 12 }],
            },
          ],
        },
      ],
    },
    { id: "devops", title: "DevOps", platforms: [] },
  ],
};

/** The index with `count` decks on Azure: azure-az0 to azure-az<count-1>, codes AZ0 to AZ<count-1>. */
export function indexWithAzure(count: number): DeckIndex {
  const index = structuredClone(CATALOG_INDEX);
  const azure = index.areas[0]?.platforms[2];
  if (!azure) throw new Error("the fixture has no Azure platform");
  azure.decks = Array.from({ length: count }, (_, i) => ({
    id: `azure-az${i}`,
    code: `AZ${i}`,
    title: `Azure ${i}`,
    cardCount: 10,
    version: "2026-10-01",
    hash: `az-${i}`,
    sections: [],
  }));
  return index;
}

/** The index with a second Google Cloud deck whose id begins the first one's: gcp-cdl and gcp-cdl-pro. */
export function indexWithProDeck(): DeckIndex {
  const index = structuredClone(CATALOG_INDEX);
  const gcp = index.areas[0]?.platforms[1];
  if (!gcp) throw new Error("the fixture has no Google Cloud platform");
  gcp.decks.push({ id: "gcp-cdl-pro", code: "CDP", title: "Pro", cardCount: 5, version: "2026-10-01", hash: "cdp-1", sections: [] });
  return index;
}
```

- [ ] **Step 10: Write the content producer.**

`scripts/native/golden/content.ts`:

````ts
// Golden vectors for the content helpers (src/content/schema.ts, load.ts, text.ts) and the class table
// (src/app-state/modes.ts). Outputs are computed by calling the TypeScript functions.
//
// Two projections keep the files small and the natives free of web object graphs: findRoute's answer is
// written as the ids of what it found (the area, the platform, the deck and the section, null for the whole
// deck), and a class table that a case closes a class in travels in the case's input as `modeTable`.
import { MODE_TABLE, isOffered, lastScoreText, modeInfo, type ModeInfo } from "@/src/app-state/modes";
import type { Mode } from "@/src/content/play";
import { poolFor } from "@/src/content/load";
import { WHOLE_DECK, deckPassName, findRoute, routeKey, type Card, type DeckFile, type Route } from "@/src/content/schema";
import { plainText, textParts } from "@/src/content/text";
import { CATALOG_INDEX } from "./catalog-fixture";
import { goldenFile, type GoldenCase, type GoldenFile } from "./format";

// The tests of each web file, as the registry (task 4) splits the content row of reference 3.9.
const CONTENT_TESTS = {
  schema: ["tests/content/schema.test.ts", "tests/content/schema-polish.test.ts"],
  load: ["tests/content/load.test.ts"],
  text: ["tests/content/text.test.ts"],
} as const;
const MODES_TESTS = ["tests/app-state/modes.test.ts", "tests/app-state/modes-polish.test.ts", "tests/app-state/modes-score-copy-polish.test.ts"] as const;

function contentFile(module: "schema" | "load" | "text", name: string, cases: readonly GoldenCase[]): GoldenFile {
  return goldenFile({ module: `src/content/${module}`, function: name, source: `src/content/${module}.ts`, tests: CONTENT_TESTS[module] }, cases);
}

function modesFile(name: string, cases: readonly GoldenCase[]): GoldenFile {
  return goldenFile({ module: "src/app-state/modes", function: name, source: "src/app-state/modes.ts", tests: MODES_TESTS }, cases);
}

/** The answer of a function that may throw: its value, or {"$throws": message}. */
function attempt<T>(run: () => T): T | { $throws: string } {
  try {
    return run();
  } catch (error) {
    return { $throws: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Runs `run` with these classes closed in the class table (offered: false), then opens them again. The real
 * table offers all four, so this is how a vector reaches the gate between a closed class and the player
 * (tests/components/start/unoffered.test.tsx mocks the table the same way). The table as it stood goes into
 * the case's input as `modeTable`.
 */
export function withClosedClasses<T>(closed: readonly Mode[], run: (table: readonly ModeInfo[]) => T): T {
  const rows = MODE_TABLE.filter((row) => closed.includes(row.id));
  const before = rows.map((row) => row.offered);
  for (const row of rows) row.offered = false;
  try {
    return run(MODE_TABLE.map((row) => ({ ...row })));
  } finally {
    rows.forEach((row, i) => {
      row.offered = before[i] ?? true;
    });
  }
}

// ---------- routes and names ----------

function wholeDeckFile(): GoldenFile {
  return contentFile("schema", "WHOLE_DECK", [{ name: "the section id that means the whole deck", input: null, output: WHOLE_DECK }]);
}

function routeKeyFile(): GoldenFile {
  const call = (name: string, route: Route): GoldenCase => ({ name, input: { route }, output: routeKey(route) });
  return contentFile("schema", "routeKey", [
    call("joins the deck id and the section id with a slash", { deckId: "aws-clf-c02", sectionId: "SEC" }),
    call("uses ALL for the whole deck", { deckId: "nextjs-rendering", sectionId: WHOLE_DECK }),
  ]);
}

function deckPassNameFile(): GoldenFile {
  const call = (name: string, platform: { title: string }, deck: { title: string; passName?: string }): GoldenCase => ({
    name,
    input: { platform, deck },
    output: deckPassName(platform, deck),
  });
  return contentFile("schema", "deckPassName", [
    call("joins the platform and the deck title when the deck has no pass name", { title: "AWS" }, { title: "Cloud Practitioner" }),
    call("uses the deck's pass name when it has one", { title: "Google Cloud" }, { title: "Cloud Digital Leader", passName: "Google Cloud Digital Leader" }),
    call("Next.js Rendering", { title: "Next.js" }, { title: "Rendering" }),
    call("a pass name wins over the platform even when it does not contain it", { title: "AWS" }, { title: "Fundamentals", passName: "Cloud Fundamentals" }),
  ]);
}

function findRouteFile(): GoldenFile {
  const call = (name: string, route: Route): GoldenCase => {
    const found = findRoute(CATALOG_INDEX, route);
    return {
      name,
      input: { index: CATALOG_INDEX, route },
      output: found === null ? null : { areaId: found.area.id, platformId: found.platform.id, deckId: found.deck.id, sectionId: found.section?.id ?? null },
    };
  };
  return contentFile("schema", "findRoute", [
    call("finds a section route", { deckId: "aws-clf-c02", sectionId: "SEC" }),
    call("finds the other section of the deck", { deckId: "aws-clf-c02", sectionId: "CON" }),
    call("finds a whole-deck route of a deck without sections", { deckId: "gcp-cdl", sectionId: "ALL" }),
    call("finds a whole-deck route of a deck with sections", { deckId: "aws-clf-c02", sectionId: "ALL" }),
    call("finds a section of another area", { deckId: "nextjs-rendering", sectionId: "RSC" }),
    call("finds nothing when the deck is gone", { deckId: "aws-saa-c03", sectionId: "ALL" }),
    call("finds nothing when the section is gone", { deckId: "aws-clf-c02", sectionId: "OLD" }),
    call("finds nothing for a section of a deck that has none", { deckId: "gcp-cdl", sectionId: "SEC" }),
    call("finds nothing for an empty section id", { deckId: "aws-clf-c02", sectionId: "" }),
    call("a section id is not read case-insensitively", { deckId: "aws-clf-c02", sectionId: "sec" }),
  ]);
}

// ---------- the pool of a route ----------

function card(id: string, section: string): Card {
  return {
    id,
    section,
    text: { en: { statement: `Statement ${id}`, explanation: `Explanation ${id}` } },
    answer: true,
    source: { title: "Docs", url: "https://docs.aws.amazon.com/" },
    difficulty: 1,
    appliesTo: "",
    conflictGroups: [],
  };
}

function poolForFile(): GoldenFile {
  const call = (name: string, deck: DeckFile, sectionId: string): GoldenCase => ({ name, input: { deck, sectionId }, output: poolFor(deck, sectionId) });
  const sectioned: DeckFile = {
    id: "aws-clf",
    hash: "h1",
    cards: [card("aws-clf-001", "S01"), card("aws-clf-002", "S02"), card("aws-clf-003", "S01")],
  };
  const flat: DeckFile = { id: "gcp-cdl", hash: "h1", cards: [card("gcp-cdl-001", WHOLE_DECK), card("gcp-cdl-002", WHOLE_DECK)] };
  return contentFile("load", "poolFor", [
    call("only the cards of the chosen section, in deck order", sectioned, "S01"),
    call("the other section", sectioned, "S02"),
    call("every card for the whole deck", sectioned, WHOLE_DECK),
    call("an empty array for a section the deck does not have", sectioned, "S99"),
    call("the cards of a deck without sections are the whole deck", flat, WHOLE_DECK),
    call("a deck without sections has no section", flat, "S01"),
    call("a section id is compared exactly", sectioned, "s01"),
  ]);
}

// ---------- card text ----------

const TEXTS: readonly { name: string; text: string }[] = [
  { name: "one plain part for a text without backticks", text: "AWS patches the host." },
  { name: "each pair of backticks is a code part, without the backticks", text: "An `asserts x is string` function narrows `x` after a call." },
  { name: "no empty plain part around a fragment at the start or the end", text: "`docker run` starts `nginx`" },
  { name: "no empty plain part between two fragments", text: "`a``b`" },
  { name: "a backtick without a partner is a code part of its own", text: "one ` two" },
  { name: "an empty pair is two code parts of their own", text: "a `` b" },
  { name: "empty for an empty text", text: "" },
  { name: "a code fragment with a quote and a bracket", text: 'Before narrowing, `x.indexOf("a")` is accepted on `x: string | string[]`.' },
  { name: "a text that is one backtick", text: "`" },
  { name: "three backticks in a row", text: "a ``` b" },
  { name: "four backticks in a row", text: "a ```` b" },
  { name: "an odd number of backticks leaves the last one alone", text: "`a` and `b` and `" },
  { name: "a fragment that spans a line break", text: "`line one\nline two` after" },
  { name: "a fragment of spaces", text: "x ` ` y" },
  { name: "text with accents and emoji around a fragment", text: "Käse `ß` 😀 ende" },
];

function textPartsFile(): GoldenFile {
  return contentFile(
    "text",
    "textParts",
    TEXTS.map(({ name, text }) => ({ name, input: { text }, output: textParts(text) })),
  );
}

function plainTextFile(): GoldenFile {
  return contentFile(
    "text",
    "plainText",
    TEXTS.map(({ name, text }) => ({ name, input: { text }, output: plainText(text) })),
  );
}

// ---------- the class table ----------

const MODE_IDS: readonly Mode[] = ["classic", "streak", "lives", "timed"];

function modeTableFile(): GoldenFile {
  return modesFile("MODE_TABLE", [{ name: "the four classes in the order of the class step, with their exact copy", input: null, output: MODE_TABLE }]);
}

function modeInfoFile(): GoldenFile {
  const cases: GoldenCase[] = MODE_IDS.map((mode) => ({ name: `the row of ${mode}`, input: { mode }, output: modeInfo(mode) }));
  cases.push({ name: "throws for a class the table does not know", input: { mode: "blitz" }, output: attempt(() => modeInfo("blitz" as Mode)) });
  cases.push({ name: "throws for an empty class", input: { mode: "" }, output: attempt(() => modeInfo("" as Mode)) });
  return modesFile("modeInfo", cases);
}

function isOfferedFile(): GoldenFile {
  const cases: GoldenCase[] = MODE_IDS.map((mode) => ({ name: `${mode} is offered`, input: { mode }, output: isOffered(mode) }));
  cases.push({ name: "throws for a class the table does not know", input: { mode: "blitz" }, output: attempt(() => isOffered("blitz" as Mode)) });
  for (const mode of MODE_IDS) {
    cases.push(withClosedClasses(["timed"], (modeTable) => ({ name: `with Timed closed, ${mode} is ${mode === "timed" ? "not offered" : "offered"}`, input: { mode, modeTable }, output: isOffered(mode) })));
  }
  return modesFile("isOffered", cases);
}

function lastScoreTextFile(): GoldenFile {
  const call = (name: string, mode: Mode, score: number, total: number): GoldenCase => ({ name, input: { mode, score, total }, output: lastScoreText(mode, score, total) });
  return modesFile("lastScoreText", [
    call("Classic says the score out of the round's total", "classic", 7, 10),
    call("Classic uses the total of the round, not the ten of the class card (5 of 7)", "classic", 5, 7),
    call("Classic with no correct answer (0 of 12)", "classic", 0, 12),
    call("Streak counts in a row", "streak", 13, 14),
    call("Streak says 1 in a row, with no plural", "streak", 1, 2),
    call("Streak ignores the total", "streak", 5, 7),
    call("Three lives counts cards", "lives", 21, 21),
    call("Timed counts correct answers", "timed", 14, 17),
    call("Timed with nothing answered", "timed", 0, 0),
    call("Classic with nothing answered", "classic", 0, 0),
  ]);
}

export function golden(): GoldenFile[] {
  return [
    wholeDeckFile(),
    routeKeyFile(),
    deckPassNameFile(),
    findRouteFile(),
    poolForFile(),
    textPartsFile(),
    plainTextFile(),
    modeTableFile(),
    modeInfoFile(),
    isOfferedFile(),
    lastScoreTextFile(),
  ];
}
````

- [ ] **Step 11: Run the test and the type check.**

```bash
npx -y pnpm@10.34.0 vitest run tests/scripts/native/content.test.ts
npx -y pnpm@10.34.0 typecheck
```

Expected: `Test Files  1 passed (1)`, `Tests  17 passed (17)`; `tsc --noEmit` prints nothing after the script header and exits 0.

- [ ] **Step 12: Commit.**

```bash
git add scripts/native/golden/catalog-fixture.ts scripts/native/golden/content.ts tests/scripts/native/content.test.ts
git commit -m "feat: add the golden vectors for the content helpers and the class table"
```

- [ ] **Step 13: Write the test for the two helpers the catalog vectors call.**

`deckOfCard` and `withoutRemovedCards` are private in `components/start/useCatalog.ts`. This test imports them the way the producer will.

`tests/scripts/native/catalog-exports.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { deckOfCard, withoutRemovedCards } from "@/components/start/useCatalog";
import { emptyProgress, type Progress } from "@/src/progress/progress";

// Two helpers of the start screen's catalog were private. Reference 3.9 lists them among the functions a native
// port mirrors, so the vectors call them and they are exported (nothing else about them changes).
describe("deckOfCard", () => {
  it("gives a card to the deck whose id and a dash are its longest prefix", () => {
    const decks = new Set(["gcp-cdl", "gcp-cdl-pro", "aws-clf-c02"]);
    expect(deckOfCard("gcp-cdl-pro-1", decks)).toBe("gcp-cdl-pro");
    expect(deckOfCard("gcp-cdl-7", decks)).toBe("gcp-cdl");
    expect(deckOfCard("aws-clf-c02x-1", decks)).toBeUndefined();
  });
});

describe("withoutRemovedCards", () => {
  const seen = { seen: 1, lastCorrect: true, lastSeenAt: 1 };
  const played: Progress = { ...emptyProgress(), cards: { "aws-clf-c02-1": seen, "aws-clf-c02-2": seen } };

  it("drops the history of removed cards and saves the pruned progress", () => {
    const saved: Progress[] = [];
    const store = { load: () => emptyProgress(), save: (progress: Progress) => void saved.push(progress) };
    const pruned = withoutRemovedCards(played, { "aws-clf-c02": ["aws-clf-c02-2"] }, store);
    expect(Object.keys(pruned.cards)).toEqual(["aws-clf-c02-2"]);
    expect(saved).toEqual([pruned]);
  });

  it("saves nothing when no card entry was dropped", () => {
    const saved: Progress[] = [];
    const store = { load: () => emptyProgress(), save: (progress: Progress) => void saved.push(progress) };
    withoutRemovedCards(played, { "aws-clf-c02": ["aws-clf-c02-1", "aws-clf-c02-2"] }, store);
    expect(saved).toEqual([]);
  });
});
```

- [ ] **Step 14: Run it and see it fail.**

```bash
npx -y pnpm@10.34.0 vitest run tests/scripts/native/catalog-exports.test.ts
```

Expected: `Tests  3 failed (3)`; the failures read `TypeError: deckOfCard is not a function` (once) and `TypeError: withoutRemovedCards is not a function` (twice).

- [ ] **Step 15: Export the two helpers.**

In `components/start/useCatalog.ts`, put `export` in front of two function declarations and change nothing else. The line

```ts
function deckOfCard(cardId: string, deckIds: ReadonlySet<string>): string | undefined {
```

becomes

```ts
export function deckOfCard(cardId: string, deckIds: ReadonlySet<string>): string | undefined {
```

and the line

```ts
function withoutRemovedCards(progress: Progress, cardIds: DeckCardIds, store: ProgressStore): Progress {
```

becomes

```ts
export function withoutRemovedCards(progress: Progress, cardIds: DeckCardIds, store: ProgressStore): Progress {
```

```bash
git diff --stat
```

Expected: `components/start/useCatalog.ts | 4 ++--` and `1 file changed, 2 insertions(+), 2 deletions(-)`.

- [ ] **Step 16: Run the new test and the web's own catalog test.**

```bash
npx -y pnpm@10.34.0 vitest run tests/scripts/native/catalog-exports.test.ts tests/components/start/useCatalog.test.tsx
```

Expected: `Test Files  2 passed (2)`, `Tests  31 passed (31)` (3 new, 28 of the web's own, unchanged).

- [ ] **Step 17: Commit.**

```bash
git add components/start/useCatalog.ts tests/scripts/native/catalog-exports.test.ts
git commit -m "chore: export deckOfCard and withoutRemovedCards for the golden vectors"
```

- [ ] **Step 18: Write the catalog test.**

`tests/scripts/native/start-catalog.test.ts`:

```ts
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { golden } from "@/scripts/native/golden/start";

// The catalog vectors (components/start/useCatalog.ts): the shape of every file, and the values the web's own
// tests pin, read back out of the generated files.

const root = fileURLToPath(new URL("../../../", import.meta.url));

interface Case {
  name: string;
  input: any;
  output: any;
}
interface Vectors {
  format: number;
  module: string;
  function: string;
  source: string;
  tests: string[];
  cards: Record<string, unknown>;
  cases: Case[];
}

const files = golden().filter((file) => file.path.startsWith("native-data/golden/components.start.useCatalog."));
const parsed = files.map((file) => ({ path: file.path, content: file.content, vectors: JSON.parse(file.content) as Vectors }));

function vectorsOf(name: string): Vectors {
  const found = parsed.find((file) => file.vectors.function === name);
  if (!found) throw new Error(`no vectors for ${name}`);
  return found.vectors;
}

function caseOf(name: string, title: string): Case {
  const found = vectorsOf(name).cases.find((candidate) => candidate.name === title);
  if (!found) throw new Error(`no case "${title}" in ${name}`);
  return found;
}

describe("catalog vectors: the files", () => {
  it("writes one file for each function and constant of the catalog", () => {
    expect(files.map((file) => file.path).sort()).toEqual([
      "native-data/golden/components.start.useCatalog.RECENT_LIMIT.json",
      "native-data/golden/components.start.useCatalog.continueTarget.json",
      "native-data/golden/components.start.useCatalog.deckCount.json",
      "native-data/golden/components.start.useCatalog.deckOfCard.json",
      "native-data/golden/components.start.useCatalog.decksLabel.json",
      "native-data/golden/components.start.useCatalog.recentDecks.json",
      "native-data/golden/components.start.useCatalog.seenPercent.json",
      "native-data/golden/components.start.useCatalog.withoutRemovedCards.json",
    ]);
  });

  it("names a source file and test files that exist, and the module and function in the path", () => {
    for (const { path, vectors } of parsed) {
      expect(vectors.format).toBe(1);
      expect(path).toBe(`native-data/golden/${vectors.module.replaceAll("/", ".")}.${vectors.function}.json`);
      expect(existsSync(`${root}${vectors.source}`), vectors.source).toBe(true);
      for (const test of vectors.tests) expect(existsSync(`${root}${test}`), test).toBe(true);
    }
  });

  it("gives every case a distinct name, an input and an output", () => {
    for (const { path, vectors } of parsed) {
      const names = vectors.cases.map((candidate) => candidate.name);
      expect(new Set(names).size, path).toBe(names.length);
      for (const candidate of vectors.cases) {
        expect(candidate, `${path}: ${candidate.name}`).toHaveProperty("input");
        expect(candidate, `${path}: ${candidate.name}`).toHaveProperty("output");
      }
    }
  });

  it("gives byte-identical files on a second run", () => {
    const again = golden().filter((file) => file.path.startsWith("native-data/golden/components.start.useCatalog."));
    expect(again).toEqual(files);
  });
});

describe("catalog vectors: counts and labels", () => {
  it("counts the decks of an area or a platform", () => {
    expect(caseOf("deckCount", "an area counts the decks of every platform").output).toBe(2);
    expect(caseOf("deckCount", "an area without platforms has none").output).toBe(0);
    expect(caseOf("deckCount", "a platform without decks has none").output).toBe(0);
  });

  it("says how many decks there are, or that there are none yet", () => {
    const label = (count: number) => caseOf("decksLabel", `${count} decks`).output;
    expect(label(0)).toBe("No decks yet");
    expect(label(1)).toBe("1 deck");
    expect(label(3)).toBe("3 decks");
    expect(label(54)).toBe("54 decks");
  });

  it("pins the number of recent decks", () => {
    expect(vectorsOf("RECENT_LIMIT").cases[0]).toMatchObject({ input: null, output: 4 });
  });
});

describe("catalog vectors: deckOfCard", () => {
  const owner = (title: string) => caseOf("deckOfCard", title).output;

  it("takes the longest prefix that ends before a dash", () => {
    expect(owner("the deck whose id and a dash begin the card id")).toBe("aws-clf-c02");
    expect(owner("the longest prefix wins: gcp-cdl-pro keeps its own cards")).toBe("gcp-cdl-pro");
    expect(owner("without the longer deck, gcp-cdl-pro-1 belongs to gcp-cdl")).toBe("gcp-cdl");
    expect(owner("a short deck id that begins a longer one")).toBe("aws-clf-c02");
  });

  it("gives undefined, written as the tagged undefined, when no deck owns the card", () => {
    for (const title of [
      "a deck id that only starts with the same letters is no owner",
      "a card of a deck the index does not have",
      "a card id with no dash has no deck",
      "a card id that is a deck id has no deck: the dash must follow the id",
      "a card id that starts with a dash has no deck",
      "no decks at all",
    ]) {
      expect(owner(title), title).toEqual({ $undefined: true });
    }
  });

  it("writes the deck ids as an array", () => {
    expect(caseOf("deckOfCard", "a card of gcp-cdl").input.deckIds).toEqual(["aws-clf-c02", "gcp-cdl", "gcp-cdl-pro", "nextjs-rendering"]);
  });
});

describe("catalog vectors: seenPercent", () => {
  const percent = (title: string) => caseOf("seenPercent", title).output;

  it("is 0 for not started, at least 1 once anything is seen, at most 100", () => {
    expect(percent("0 (not started) without history for the deck")).toBe(0);
    expect(percent("counts entries whose id starts with the deck id and a dash: 46 of 92 is 50")).toBe(50);
    expect(percent("never reads 0 once a card is seen")).toBe(1);
    expect(percent("never more than 100")).toBe(100);
  });

  it("counts the deck's current cards when their ids are known", () => {
    expect(percent("with the current ids known, removed cards count for nothing")).toBe(0);
    expect(percent("with the current ids known: 23 of 92 is 25")).toBe(25);
    expect(percent("with the current ids known: 1 of 500 shows 1")).toBe(1);
    expect(percent("an entry that was never seen is not counted (prefix count)")).toBe(0);
    expect(percent("an entry that was never seen is not counted (known ids)")).toBe(0);
    expect(percent("an empty list of current ids reads 0")).toBe(0);
  });

  it("rounds half up", () => {
    expect(percent("1 of 8 is 12.5 and rounds to 13")).toBe(13);
    expect(percent("3 of 8 is 37.5 and rounds to 38")).toBe(38);
    expect(percent("7 of 200 is 3.5 and rounds to 4")).toBe(4);
    expect(percent("1 of 200 is 0.5 and rounds to 1")).toBe(1);
    expect(percent("29 of 100: 0.29 times 100 is 28.999999999999996 and rounds to 29")).toBe(29);
    expect(percent("57 of 100: 0.57 times 100 is 56.99999999999999 and rounds to 57")).toBe(57);
    expect(percent("1 of 3 is 33")).toBe(33);
    expect(percent("2 of 3 is 67")).toBe(67);
  });

  it("leaves the ids out of the input when they are not known", () => {
    expect(caseOf("seenPercent", "0 (not started) without history for the deck").input).not.toHaveProperty("cardIds");
    expect(caseOf("seenPercent", "an empty list of current ids reads 0").input.cardIds).toEqual([]);
  });
});

describe("catalog vectors: continueTarget and recentDecks", () => {
  const target = (title: string) => caseOf("continueTarget", title).output;
  const recent = (title: string) => caseOf("recentDecks", title).output.map((entry: any) => entry.deckId);

  it("leads Continue to the last route and mode, only while both can be played", () => {
    expect(target("leads to the last route and mode, with the score of the last round")).toEqual({
      route: { deckId: "aws-clf-c02", sectionId: "SEC" },
      mode: "classic",
      found: { areaId: "cloud", platformId: "aws", deckId: "aws-clf-c02", sectionId: "SEC" },
      lastScore: { score: 7, total: 10 },
    });
    expect(target("nothing without a last round")).toBeNull();
    expect(target("nothing when the section is gone")).toBeNull();
    expect(target("nothing when the deck is gone")).toBeNull();
    expect(target("keeps the mode of the last round (Streak)").mode).toBe("streak");
  });

  it("brings the score only when score and total are both known", () => {
    expect(target("no score after a round that was left").lastScore).toBeNull();
    expect(target("no score when only one of score and total is known").lastScore).toBeNull();
    expect(target("a score of 0 is a score").lastScore).toEqual({ score: 0, total: 10 });
    expect(target("a whole-deck route of a deck without sections").found.sectionId).toBeNull();
  });

  it("does not continue into a class that is not offered", () => {
    expect(target("the Timed class while it is offered").mode).toBe("timed");
    expect(target("nothing when the class is not offered (Timed closed)")).toBeNull();
    expect(caseOf("continueTarget", "nothing when the class is not offered (Timed closed)").input.modeTable.map((row: any) => row.offered)).toEqual([true, true, true, false]);
    expect(target("another class is still continued while Timed is closed").mode).toBe("classic");
  });

  it("lists the decks played, newest first, four at most", () => {
    expect(recent("lists nothing without history")).toEqual([]);
    expect(caseOf("recentDecks", "gives each deck its area, platform and latest time, newest first").output).toEqual([
      { areaId: "cloud", platformId: "aws", deckId: "aws-clf-c02", lastSeenAt: 300 },
      { areaId: "cloud", platformId: "gcp", deckId: "gcp-cdl", lastSeenAt: 200 },
      { areaId: "frontend", platformId: "nextjs", deckId: "nextjs-rendering", lastSeenAt: 50 },
    ]);
    expect(recent("keeps catalog order for equal times")).toEqual(["aws-clf-c02", "gcp-cdl", "nextjs-rendering"]);
    expect(recent("leaves out a deck the index no longer has")).toEqual(["gcp-cdl"]);
    expect(recent("lists four at most")).toEqual(["azure-az4", "azure-az3", "azure-az2", "azure-az1"]);
    expect(recent("lists as many as asked: 2")).toEqual(["azure-az4", "azure-az3"]);
    expect(recent("lists as many as asked: 0")).toEqual([]);
    expect(recent("lists as many as asked: more than there are")).toHaveLength(5);
  });

  it("keeps a deck whose id begins another deck's apart, and takes the latest time of a deck", () => {
    expect(recent("an id that begins another deck's stays apart: only gcp-cdl-pro played")).toEqual(["gcp-cdl-pro"]);
    expect(recent("an id that begins another deck's stays apart: both played")).toEqual(["gcp-cdl", "gcp-cdl-pro"]);
    expect(caseOf("recentDecks", "the latest time of a deck is the maximum, whatever the order of its cards").output[0].lastSeenAt).toBe(500);
    expect(recent("a time of 0 still counts the deck as played")).toEqual(["gcp-cdl"]);
  });

  it("leaves the limit out of the input when it is not given", () => {
    expect(caseOf("recentDecks", "lists nothing without history").input).not.toHaveProperty("limit");
    expect(caseOf("recentDecks", "lists as many as asked: 2").input.limit).toBe(2);
  });
});

describe("catalog vectors: withoutRemovedCards", () => {
  const run = (title: string) => caseOf("withoutRemovedCards", title).output;

  it("drops the history of removed cards and saves only when entries were dropped", () => {
    expect(Object.keys(run("drops the history of cards that are no longer in the deck, and saves").progress.cards)).toEqual([]);
    expect(run("drops the history of cards that are no longer in the deck, and saves").saved).toBe(true);
    expect(Object.keys(run("keeps the history of cards still in the deck, and saves what was dropped").progress.cards)).toHaveLength(4);
    expect(run("keeps the history of cards still in the deck, and saves what was dropped").saved).toBe(true);
    for (const title of ["saves nothing when every card is still in the deck", "saves nothing when no deck's ids are known", "a deck with no history changes nothing", "empty progress stays empty and is not saved"]) {
      expect(run(title).saved, title).toBe(false);
    }
  });

  it("keeps the records and the last route whatever is dropped", () => {
    const { progress } = run("the records and the last route are kept whatever is dropped");
    expect(progress.records).toEqual({ "aws-clf-c02/SEC#classic": 7 });
    expect(progress.last.score).toBe(7);
  });

  it("prunes several decks in one go", () => {
    expect(Object.keys(run("prunes several decks in one go").progress.cards).sort()).toEqual(["aws-clf-c02-t1-0", "gcp-cdl-2"]);
  });
});
```

- [ ] **Step 19: Run it and see it fail.**

```bash
npx -y pnpm@10.34.0 vitest run tests/scripts/native/start-catalog.test.ts
```

Expected: `Error: Cannot find package '@/scripts/native/golden/start' imported from <repository root>/tests/scripts/native/start-catalog.test.ts`; `Test Files  1 failed (1)`, `Tests  no tests`.

- [ ] **Step 20: Write the catalog producer.**

`scripts/native/golden/catalog.ts`:

```ts
// Golden vectors for the catalog helpers of the start screen (components/start/useCatalog.ts), computed by
// calling the TypeScript functions on the index of ./catalog-fixture.
//
// Two projections keep the files small: a RecentDeck and a ContinueTarget are written with the ids of the area,
// the platform, the deck (and the section) instead of the index objects they carry, and a class table that a case
// closes a class in travels in the case's input as `modeTable` (see withClosedClasses in ./content).
import {
  RECENT_LIMIT,
  continueTarget,
  deckCount,
  decksLabel,
  deckOfCard,
  recentDecks,
  seenPercent,
  withoutRemovedCards,
  type ContinueTarget,
  type RecentDeck,
} from "@/components/start/useCatalog";
import type { DeckIndex } from "@/src/content/schema";
import { emptyProgress, type Progress } from "@/src/progress/progress";
import { CATALOG_INDEX, indexWithAzure, indexWithProDeck } from "./catalog-fixture";
import { withClosedClasses } from "./content";
import { goldenFile, type GoldenCase, type GoldenFile } from "./format";

const CATALOG_TESTS = ["tests/components/start/useCatalog.test.tsx", "tests/components/start/unoffered.test.tsx"] as const;

function catalogFile(name: string, cases: readonly GoldenCase[]): GoldenFile {
  return goldenFile({ module: "components/start/useCatalog", function: name, source: "components/start/useCatalog.ts", tests: CATALOG_TESTS }, cases);
}

// ---------- the catalog ----------

const SEEN = { seen: 1, lastCorrect: true, lastSeenAt: 1 };

function progressWith(partial: Partial<Progress>): Progress {
  return { ...emptyProgress(), ...partial };
}

/** `count` card ids `<prefix><n>`, n from `from`. */
function ids(prefix: string, count: number, from = 0): string[] {
  return Array.from({ length: count }, (_, i) => `${prefix}${from + i}`);
}

/** A history with this entry for each of these ids. */
function seenCards(cardIds: readonly string[], entry = SEEN): Progress["cards"] {
  return Object.fromEntries(cardIds.map((id) => [id, entry]));
}

function area(id: string) {
  const found = CATALOG_INDEX.areas.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`no area ${id}`);
  return found;
}

function deckCountFile(): GoldenFile {
  const cloud = area("cloud");
  const call = (name: string, place: Parameters<typeof deckCount>[0]): GoldenCase => ({ name, input: { place }, output: deckCount(place) });
  return catalogFile("deckCount", [
    call("an area counts the decks of every platform", cloud),
    call("an area without platforms has none", area("devops")),
    call("a platform without decks has none", cloud.platforms[2]!),
    call("a platform counts its decks", cloud.platforms[0]!),
    call("another area with one deck", area("frontend")),
  ]);
}

function decksLabelFile(): GoldenFile {
  return catalogFile(
    "decksLabel",
    [0, 1, 2, 3, 10, 54].map((count) => ({ name: `${count} decks`, input: { count }, output: decksLabel(count) })),
  );
}

function deckOfCardFile(): GoldenFile {
  // The web takes a Set; the vector writes the ids as an array and the case calls the function with a Set.
  const call = (name: string, cardId: string, deckIds: readonly string[]): GoldenCase => ({
    name,
    input: { cardId, deckIds },
    output: deckOfCard(cardId, new Set(deckIds)),
  });
  const decks = ["aws-clf-c02", "gcp-cdl", "gcp-cdl-pro", "nextjs-rendering"];
  return catalogFile("deckOfCard", [
    call("the deck whose id and a dash begin the card id", "aws-clf-c02-t1.1-01", decks),
    call("a card of gcp-cdl", "gcp-cdl-7", decks),
    call("the longest prefix wins: gcp-cdl-pro keeps its own cards", "gcp-cdl-pro-1", decks),
    call("without the longer deck, gcp-cdl-pro-1 belongs to gcp-cdl", "gcp-cdl-pro-1", ["gcp-cdl", "aws-clf-c02"]),
    call("a deck id that only starts with the same letters is no owner", "aws-clf-c02x-1", decks),
    call("a card of a deck the index does not have", "aws-gone-1", decks),
    call("a card id with no dash has no deck", "x", decks),
    call("a card id that is a deck id has no deck: the dash must follow the id", "gcp-cdl", decks),
    call("a card id that starts with a dash has no deck", "-abc", decks),
    call("a short deck id that begins a longer one", "aws-clf-c02-t1.1-01", ["aws", "aws-clf-c02"]),
    call("only the short deck matches", "aws-clf-c03-1", ["aws", "aws-clf-c02"]),
    call("no decks at all", "aws-clf-c02-1", []),
    call("a dash at the very end", "gcp-cdl-", decks),
  ]);
}

function seenPercentFile(): GoldenFile {
  const call = (name: string, progress: Progress, deck: { id: string; cardCount: number }, cardIds?: readonly string[]): GoldenCase => ({
    name,
    input: { progress, deck, cardIds },
    output: seenPercent(progress, deck, cardIds),
  });
  const clf = { id: "aws-clf-c02", cardCount: 92 };
  const clfIds = ids("aws-clf-c02-t1-", 92);
  const removed = seenCards(ids("aws-clf-c02-old-", 10));
  const never = { seen: 0, lastCorrect: false, lastSeenAt: 0 };
  return catalogFile("seenPercent", [
    call("0 (not started) without history for the deck", progressWith({ cards: { "gcp-cdl-01": SEEN } }), clf),
    call("counts entries whose id starts with the deck id and a dash: 46 of 92 is 50", progressWith({ cards: { ...seenCards(ids("aws-clf-c02-t1-", 46)), "aws-clf-c02x-1": SEEN } }), clf),
    call("never reads 0 once a card is seen", progressWith({ cards: { "aws-clf-c02-1": SEEN } }), { id: "aws-clf-c02", cardCount: 500 }),
    call("never more than 100", progressWith({ cards: seenCards(ids("aws-clf-c02-", 5)) }), { id: "aws-clf-c02", cardCount: 3 }),
    call("with the current ids known, removed cards count for nothing", progressWith({ cards: removed }), clf, clfIds),
    call("with the current ids known: 23 of 92 is 25", progressWith({ cards: { ...removed, ...seenCards(clfIds.slice(0, 23)) } }), clf, clfIds),
    call("with the current ids known: 1 of 500 shows 1", progressWith({ cards: seenCards(clfIds.slice(0, 1)) }), { id: "aws-clf-c02", cardCount: 500 }, [...clfIds, ...ids("x-", 408)]),
    call("an entry that was never seen is not counted (prefix count)", progressWith({ cards: { "aws-clf-c02-1": never } }), clf),
    call("an entry that was never seen is not counted (known ids)", progressWith({ cards: { "aws-clf-c02-1": never } }), clf, ["aws-clf-c02-1"]),
    call("a deck with a card count of 0 reads 0 (prefix count)", progressWith({ cards: { "aws-clf-c02-1": SEEN } }), { id: "aws-clf-c02", cardCount: 0 }),
    call("an empty list of current ids reads 0", progressWith({ cards: { "aws-clf-c02-1": SEEN } }), clf, []),
    // Rounding: the share times 100, rounded half up, at least 1 once anything is seen.
    call("1 of 8 is 12.5 and rounds to 13", progressWith({ cards: seenCards(ids("d-", 1)) }), { id: "d", cardCount: 8 }),
    call("3 of 8 is 37.5 and rounds to 38", progressWith({ cards: seenCards(ids("d-", 3)) }), { id: "d", cardCount: 8 }),
    call("7 of 200 is 3.5 and rounds to 4", progressWith({ cards: seenCards(ids("d-", 7)) }), { id: "d", cardCount: 200 }),
    call("1 of 200 is 0.5 and rounds to 1", progressWith({ cards: seenCards(ids("d-", 1)) }), { id: "d", cardCount: 200 }),
    call("29 of 100: 0.29 times 100 is 28.999999999999996 and rounds to 29", progressWith({ cards: seenCards(ids("d-", 29)) }), { id: "d", cardCount: 100 }),
    call("57 of 100: 0.57 times 100 is 56.99999999999999 and rounds to 57", progressWith({ cards: seenCards(ids("d-", 57)) }), { id: "d", cardCount: 100 }),
    call("1 of 3 is 33", progressWith({ cards: seenCards(ids("d-", 1)) }), { id: "d", cardCount: 3 }),
    call("2 of 3 is 67", progressWith({ cards: seenCards(ids("d-", 2)) }), { id: "d", cardCount: 3 }),
    call("1 of 1000 shows 1", progressWith({ cards: seenCards(ids("d-", 1)) }), { id: "d", cardCount: 1000 }),
  ]);
}

function targetIds(target: ContinueTarget | null) {
  if (target === null) return null;
  const { found } = target;
  return {
    route: target.route,
    mode: target.mode,
    found: { areaId: found.area.id, platformId: found.platform.id, deckId: found.deck.id, sectionId: found.section?.id ?? null },
    lastScore: target.lastScore,
  };
}

function continueTargetFile(): GoldenFile {
  const call = (name: string, progress: Progress, index: DeckIndex = CATALOG_INDEX): GoldenCase => ({
    name,
    input: { index, progress },
    output: targetIds(continueTarget(index, progress)),
  });
  const last = { route: { deckId: "aws-clf-c02", sectionId: "SEC" }, mode: "classic" as const, score: 7, total: 10 };
  const cases: GoldenCase[] = [
    call("leads to the last route and mode, with the score of the last round", progressWith({ last })),
    call("nothing without a last round", emptyProgress()),
    call("nothing when the section is gone", progressWith({ last: { ...last, route: { deckId: "aws-clf-c02", sectionId: "OLD" } } })),
    call("nothing when the deck is gone", progressWith({ last: { ...last, route: { deckId: "aws-saa-c03", sectionId: "ALL" } } })),
    call("keeps the mode of the last round (Streak)", progressWith({ last: { ...last, mode: "streak", score: 13, total: 14 } })),
    call("no score after a round that was left", progressWith({ last: { ...last, score: null, total: null } })),
    call("no score when only one of score and total is known", progressWith({ last: { ...last, total: null } })),
    call("a score of 0 is a score", progressWith({ last: { ...last, score: 0, total: 10 } })),
    call("a whole-deck route of a deck without sections", progressWith({ last: { route: { deckId: "gcp-cdl", sectionId: "ALL" }, mode: "lives", score: 21, total: 21 } })),
    call("the Timed class while it is offered", progressWith({ last: { ...last, mode: "timed", score: 14, total: 17 } })),
  ];
  const timed = progressWith({ last: { ...last, mode: "timed", score: null, total: null } });
  cases.push(withClosedClasses(["timed"], (modeTable) => ({ name: "nothing when the class is not offered (Timed closed)", input: { index: CATALOG_INDEX, progress: timed, modeTable }, output: targetIds(continueTarget(CATALOG_INDEX, timed)) })));
  cases.push(withClosedClasses(["timed"], (modeTable) => ({ name: "another class is still continued while Timed is closed", input: { index: CATALOG_INDEX, progress: progressWith({ last }), modeTable }, output: targetIds(continueTarget(CATALOG_INDEX, progressWith({ last }))) })));
  return catalogFile("continueTarget", cases);
}

function recentIds(played: RecentDeck[]) {
  return played.map((entry) => ({ areaId: entry.area.id, platformId: entry.platform.id, deckId: entry.deck.id, lastSeenAt: entry.lastSeenAt }));
}

function recentDecksFile(): GoldenFile {
  const at = (lastSeenAt: number) => ({ seen: 1, lastCorrect: true, lastSeenAt });
  const call = (name: string, progress: Progress, index: DeckIndex = CATALOG_INDEX, limit?: number): GoldenCase => ({
    name,
    input: { index, progress, limit },
    output: recentIds(recentDecks(index, progress, limit)),
  });
  const azure = indexWithAzure(5);
  const azureCards = Object.fromEntries([0, 1, 2, 3, 4].map((i) => [`azure-az${i}-1`, at(i)]));
  return catalogFile("recentDecks", [
    call("lists nothing without history", emptyProgress()),
    call("gives each deck its area, platform and latest time, newest first", progressWith({ cards: { "aws-clf-c02-1": at(100), "aws-clf-c02-2": at(300), "gcp-cdl-1": at(200), "nextjs-rendering-1": at(50) } })),
    call("keeps catalog order for equal times", progressWith({ cards: { "nextjs-rendering-1": at(5), "gcp-cdl-1": at(5), "aws-clf-c02-1": at(5) } })),
    call("leaves out a deck the index no longer has", progressWith({ cards: { "aws-gone-1": at(900), "gcp-cdl-1": at(1) } })),
    call("lists four at most", progressWith({ cards: azureCards }), azure),
    call("lists as many as asked: 2", progressWith({ cards: azureCards }), azure, 2),
    call("lists as many as asked: 4, the default spelled out", progressWith({ cards: azureCards }), azure, 4),
    call("lists as many as asked: 0", progressWith({ cards: azureCards }), azure, 0),
    call("lists as many as asked: more than there are", progressWith({ cards: azureCards }), azure, 10),
    call("an id that begins another deck's stays apart: only gcp-cdl-pro played", progressWith({ cards: { "gcp-cdl-pro-1": at(10) } }), indexWithProDeck()),
    call("an id that begins another deck's stays apart: both played", progressWith({ cards: { "gcp-cdl-pro-1": at(10), "gcp-cdl-7": at(20) } }), indexWithProDeck()),
    call("the latest time of a deck is the maximum, whatever the order of its cards", progressWith({ cards: { "aws-clf-c02-1": at(500), "aws-clf-c02-2": at(100), "gcp-cdl-1": at(300) } })),
    call("a card id that belongs to no deck is ignored", progressWith({ cards: { x: at(900), "gcp-cdl-1": at(1) } })),
    call("a time of 0 still counts the deck as played", progressWith({ cards: { "gcp-cdl-1": at(0) } })),
    call("fractional times are compared as they are", progressWith({ cards: { "aws-clf-c02-1": at(1.5), "gcp-cdl-1": at(1.25) } })),
    call("a real timestamp", progressWith({ cards: { "aws-clf-c02-1": at(1_790_000_000_000), "gcp-cdl-1": at(1_790_000_100_000) } })),
  ]);
}

function recentLimitFile(): GoldenFile {
  return catalogFile("RECENT_LIMIT", [{ name: "how many decks Recent lists at most", input: null, output: RECENT_LIMIT }]);
}

function withoutRemovedCardsFile(): GoldenFile {
  // The web passes a store and the function calls save when the number of card entries changed. The case
  // gives a store that records the call, and writes it as `saved`.
  const call = (name: string, progress: Progress, cardIds: Readonly<Record<string, readonly string[]>>): GoldenCase => {
    let saved = false;
    const pruned = withoutRemovedCards(progress, cardIds, {
      load: () => emptyProgress(),
      save: () => {
        saved = true;
      },
    });
    return { name, input: { progress, cardIds }, output: { progress: pruned, saved } };
  };
  const clfIds = ids("aws-clf-c02-t1-", 20);
  const played = progressWith({ cards: seenCards(clfIds.slice(0, 10)), records: { "aws-clf-c02/SEC#classic": 7 }, last: { route: { deckId: "aws-clf-c02", sectionId: "SEC" }, mode: "classic", score: 7, total: 10 } });
  return catalogFile("withoutRemovedCards", [
    call("drops the history of cards that are no longer in the deck, and saves", played, { "aws-clf-c02": [...clfIds.slice(10), "aws-clf-c02-new"] }),
    call("keeps the history of cards still in the deck, and saves what was dropped", played, { "aws-clf-c02": [...clfIds.slice(0, 4), ...clfIds.slice(10)] }),
    call("saves nothing when every card is still in the deck", played, { "aws-clf-c02": clfIds }),
    call("saves nothing when no deck's ids are known", played, {}),
    call("a deck with no history changes nothing", played, { "gcp-cdl": ["gcp-cdl-1"] }),
    call("prunes several decks in one go", progressWith({ cards: { ...seenCards(clfIds.slice(0, 3)), ...seenCards(["gcp-cdl-1", "gcp-cdl-2"]) } }), { "aws-clf-c02": [clfIds[0]!], "gcp-cdl": ["gcp-cdl-2"] }),
    call("the records and the last route are kept whatever is dropped", played, { "aws-clf-c02": [] }),
    call("empty progress stays empty and is not saved", emptyProgress(), { "aws-clf-c02": clfIds }),
  ]);
}

export function catalogFiles(): GoldenFile[] {
  return [deckCountFile(), decksLabelFile(), deckOfCardFile(), seenPercentFile(), continueTargetFile(), recentDecksFile(), recentLimitFile(), withoutRemovedCardsFile()];
}
```

- [ ] **Step 21: Write `start.ts`, for now with the catalog alone.**

`scripts/native/golden/start.ts`:

```ts
// Golden vectors for the start screen: the catalog helpers, the step helpers, the list cue and the labels.
import { catalogFiles } from "./catalog";
import type { GoldenFile } from "./format";

export function golden(): GoldenFile[] {
  return [...catalogFiles()];
}
```

- [ ] **Step 22: Run the test and the type check.**

```bash
npx -y pnpm@10.34.0 vitest run tests/scripts/native/start-catalog.test.ts
npx -y pnpm@10.34.0 typecheck
```

Expected: `Test Files  1 passed (1)`, `Tests  23 passed (23)`; `tsc --noEmit` prints nothing after the script header and exits 0.

- [ ] **Step 23: Commit.**

```bash
git add scripts/native/golden/catalog.ts scripts/native/golden/start.ts tests/scripts/native/start-catalog.test.ts
git commit -m "feat: add the golden vectors for the start screen's catalog helpers"
```

- [ ] **Step 24: Write the test for the steps, the list cue and the labels.**

`tests/scripts/native/start-flow.test.ts`:

```ts
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MODE_TABLE } from "@/src/app-state/modes";
import { golden } from "@/scripts/native/golden/start";

// The step, list cue and label vectors (components/start/StartFlow.tsx, listCue.ts, FillInPass.tsx,
// ContinueLine.tsx): the shape of every file, and the values the web's own tests pin, read back out of the
// generated files.

const root = fileURLToPath(new URL("../../../", import.meta.url));

interface Case {
  name: string;
  input: any;
  output: any;
}
interface Vectors {
  format: number;
  module: string;
  function: string;
  source: string;
  tests: string[];
  cards: Record<string, unknown>;
  cases: Case[];
}

const OWN = ["StartFlow", "listCue", "FillInPass", "ContinueLine"].map((name) => `.${name}.`);
const isOwn = (path: string) => OWN.some((marker) => path.includes(marker)) && !path.includes("useCatalog");
const files = golden().filter((file) => isOwn(file.path));
const parsed = files.map((file) => ({ path: file.path, content: file.content, vectors: JSON.parse(file.content) as Vectors }));

function vectorsOf(name: string): Vectors {
  const found = parsed.find((file) => file.vectors.function === name);
  if (!found) throw new Error(`no vectors for ${name}`);
  return found.vectors;
}

function caseOf(name: string, title: string): Case {
  const found = vectorsOf(name).cases.find((candidate) => candidate.name === title);
  if (!found) throw new Error(`no case "${title}" in ${name}`);
  return found;
}

describe("start-flow vectors: the files", () => {
  it("writes one file for each function and constant of the steps, the list cue and the two labels", () => {
    expect(files.map((file) => file.path).sort()).toEqual([
      "native-data/golden/components.FillInPass.changeLabel.json",
      "native-data/golden/components.start.ContinueLine.continueLabel.json",
      "native-data/golden/components.start.StartFlow.STEP_OF.json",
      "native-data/golden/components.start.StartFlow.canShow.json",
      "native-data/golden/components.start.StartFlow.chosenOn.json",
      "native-data/golden/components.start.StartFlow.clearFrom.json",
      "native-data/golden/components.start.StartFlow.pathTo.json",
      "native-data/golden/components.start.StartFlow.previousStep.json",
      "native-data/golden/components.start.StartFlow.stepOf.json",
      "native-data/golden/components.start.listCue.FADE_PX.json",
      "native-data/golden/components.start.listCue.listCue.json",
      "native-data/golden/components.start.listCue.revealDelta.json",
    ]);
  });

  it("names a source file and test files that exist, and the module and function in the path", () => {
    for (const { path, vectors } of parsed) {
      expect(vectors.format).toBe(1);
      expect(path).toBe(`native-data/golden/${vectors.module.replaceAll("/", ".")}.${vectors.function}.json`);
      expect(existsSync(`${root}${vectors.source}`), vectors.source).toBe(true);
      for (const test of vectors.tests) expect(existsSync(`${root}${test}`), test).toBe(true);
    }
  });

  it("gives every case a distinct name, an input and an output", () => {
    for (const { path, vectors } of parsed) {
      const names = vectors.cases.map((candidate) => candidate.name);
      expect(new Set(names).size, path).toBe(names.length);
      for (const candidate of vectors.cases) {
        expect(candidate, `${path}: ${candidate.name}`).toHaveProperty("input");
        expect(candidate, `${path}: ${candidate.name}`).toHaveProperty("output");
      }
    }
  });

  it("gives byte-identical files on a second run, and leaves the class table open as it found it", () => {
    expect(golden().filter((file) => isOwn(file.path))).toEqual(files);
    expect(MODE_TABLE.map((row) => row.offered)).toEqual([true, true, true, true]);
  });
});

describe("start-flow vectors: steps and choices", () => {
  it("pins the step of each choice, and moves the area and platform to step 3 on the recent path", () => {
    expect(vectorsOf("STEP_OF").cases[0]!.output).toEqual({ via: 1, areaId: 1, platformId: 2, deckId: 3, sectionId: 4, mode: 5 });
    expect(caseOf("stepOf", "areaId with a full recent choice").output).toBe(3);
    expect(caseOf("stepOf", "areaId with an ordinary choice").output).toBe(1);
    expect(caseOf("stepOf", "via on the recent path").output).toBe(1);
    expect(caseOf("stepOf", "platformId on the recent path").output).toBe(3);
    expect(caseOf("stepOf", "platformId on the ordinary path").output).toBe(2);
    expect(caseOf("stepOf", "mode on the recent path").output).toBe(5);
  });

  it("clears a step's choice and every later one", () => {
    const clear = (title: string) => caseOf("clearFrom", title).output;
    const all = { areaId: "cloud", platformId: "aws", deckId: "aws-clf-c02", sectionId: "SEC", mode: "classic" };
    expect(clear("a full choice, back to step 3")).toEqual({ areaId: "cloud", platformId: "aws" });
    expect(clear("a full choice, back to step 6")).toEqual(all);
    expect(clear("a full choice, back to step 1")).toEqual({});
    expect(clear("a full recent choice, back to step 3")).toEqual({ via: "recent" });
    expect(clear("a full recent choice, back to step 4")).toEqual({ via: "recent", areaId: "cloud", platformId: "aws", deckId: "aws-clf-c02" });
    expect(clear("a full recent choice, back to step 1")).toEqual({});
  });

  it("walks every step, skips the section step for a deck without sections, and the platform step on the recent path", () => {
    const path = (title: string) => caseOf("pathTo", title).output;
    expect(path("up to step 6, with sections")).toEqual([1, 2, 3, 4, 5, 6]);
    expect(path("up to step 6, without sections")).toEqual([1, 2, 3, 5, 6]);
    expect(path("up to step 6, recent path, with sections")).toEqual([1, 3, 4, 5, 6]);
    expect(path("up to step 5, recent path, without sections")).toEqual([1, 3, 5]);
    expect(path("up to step 1, with sections")).toEqual([1]);
    expect(path("up to step 2, with sections")).toEqual([1, 2]);
    expect(path("up to step 4, without sections")).toEqual([1, 2, 3]);
    expect(caseOf("pathTo", "up to step 3, recent spelled false").input.recent).toBe(false);
    expect(caseOf("pathTo", "up to step 3, with sections").input).not.toHaveProperty("recent");
  });

  it("goes back one step on the path", () => {
    const back = (title: string) => caseOf("previousStep", title).output;
    expect(back("back from step 5, without sections")).toBe(3);
    expect(back("back from step 5, with sections")).toBe(4);
    expect(back("back from step 2, with sections")).toBe(1);
    expect(back("back from step 1, with sections")).toBe(1);
    expect(back("back from step 3, recent path, with sections")).toBe(1);
    expect(back("back from step 4, recent path, with sections")).toBe(3);
    expect(back("back from step 5, recent path, without sections")).toBe(3);
  });

  it("names the card to focus on the way back, undefined as the tagged undefined", () => {
    const chosen = (title: string) => caseOf("chosenOn", title).output;
    expect(chosen("the Recent card on step 1 of the recent path")).toBe("recent");
    expect(chosen("the deck on step 3 of the recent path")).toBe("aws-clf-c02");
    expect(chosen("the area on step 1")).toBe("cloud");
    expect(chosen("the platform on step 2")).toBe("aws");
    expect(chosen("nothing on step 6")).toEqual({ $undefined: true });
    expect(chosen("nothing when the step was not chosen yet")).toEqual({ $undefined: true });
  });

  it("knows whether a remembered step can still be shown with the index", () => {
    const shown = (title: string) => caseOf("canShow", title).output;
    expect(shown("step 4 with a deck that has sections")).toBe(true);
    expect(shown("step 4 with a deck that has no sections")).toBe(false);
    expect(shown("step 3 with a platform the index does not have")).toBe(false);
    expect(shown("step 6 with a class")).toBe(true);
    expect(shown("step 6 with Streak")).toBe(true);
    expect(shown("step 3 of the recent path needs no area or platform")).toBe(true);
    expect(shown("step 3 needs the platform on the ordinary path")).toBe(false);
    expect(shown("step 2 does not exist on the recent path, even with an area")).toBe(false);
    expect(shown("step 4 of the recent path with a deck that has sections")).toBe(true);
    expect(shown("step 5 with the whole deck of a deck without sections")).toBe(true);
    expect(shown("step 5 with a section the deck does not have")).toBe(false);
    expect(shown("step 6 needs a class")).toBe(false);
  });

  it("refuses a class that is not offered at step 6, and no other step or class", () => {
    expect(caseOf("canShow", "step 6 with Timed while it is offered").output).toBe(true);
    expect(caseOf("canShow", "step 6 with timed while Timed is closed").output).toBe(false);
    expect(caseOf("canShow", "step 6 with streak while Timed is closed").output).toBe(true);
    expect(caseOf("canShow", "step 5 does not look at the class while Timed is closed").output).toBe(true);
    expect(caseOf("canShow", "step 6 with timed while Timed is closed").input.modeTable.map((row: any) => row.offered)).toEqual([true, true, true, false]);
    expect(caseOf("canShow", "step 6 with Streak").input).not.toHaveProperty("modeTable");
  });
});

describe("start-flow vectors: the list cue", () => {
  const cue = (title: string) => caseOf("listCue", title).output;

  it("pins the length of the fade", () => {
    expect(vectorsOf("FADE_PX").cases[0]).toMatchObject({ input: null, output: 28 });
  });

  it("shows no cue while the content ends inside the view, a pixel allowed for rounding", () => {
    expect(cue("no cue while the content ends inside the view")).toEqual({ more: false, lift: 0 });
    expect(cue("no cue when the content ends one pixel below the view (rounding)")).toEqual({ more: false, lift: 0 });
    expect(cue("a cue when the content ends two pixels below the view")).toEqual({ more: true, lift: 0 });
  });

  it("ends the fade at the edge when the fold cuts a card that shows at least 28 px", () => {
    expect(cue("the fade ends at the edge when the fold cuts a card that shows 65 px")).toEqual({ more: true, lift: 0 });
    expect(cue("the fade ends at the edge when the fold shows exactly 28 px")).toEqual({ more: true, lift: 0 });
  });

  it("ends the fade on the card above when the fold falls in the gap", () => {
    expect(cue("the fade ends on the card above when the fold falls in the gap")).toEqual({ more: true, lift: 8 });
    expect(cue("the fade ends on the card above when the fold shows 0 px")).toEqual({ more: true, lift: 12 });
  });

  it("lifts the fade most of the way when the fold shows only a sliver, to the exact double", () => {
    expect(cue("the fade lifts most of the way when the fold shows a 2 px sliver")).toEqual({ more: true, lift: 14 * (1 - 2 / 28) });
    expect(cue("the fade moves up when the fold shows 27 px")).toEqual({ more: true, lift: (543 - 504) * (1 - 27 / 28) });
  });

  it("follows the scroll: the cue is gone once the last card is in view", () => {
    expect(cue("nine cards scrolled by 100 px").more).toBe(true);
    expect(cue("nine cards scrolled by 390 px").more).toBe(true);
    expect(cue("nine cards scrolled by 394 px")).toEqual({ more: false, lift: 0 });
  });

  it("moves the end of the fade without a jump as the list scrolls: at most 2 px per px of scroll, as the web's test holds", () => {
    const scrolls = vectorsOf("listCue")
      .cases.filter((c) => /^nine cards scrolled by \d+ px$/.test(c.name))
      .map((c) => ({ scrollTop: Number(/\d+/.exec(c.name)![0]), end: 518 - c.output.lift }))
      .filter((c) => c.scrollTop <= 300)
      .sort((a, b) => a.scrollTop - b.scrollTop);
    expect(scrolls).toHaveLength(32);
    scrolls.slice(1).forEach((c, i) => {
      const before = scrolls[i]!;
      expect(Math.abs(c.end - before.end), `${before.scrollTop} to ${c.scrollTop}`).toBeLessThanOrEqual(2 * (c.scrollTop - before.scrollTop));
    });
  });

  it("pins the cases that have no card on the fold", () => {
    expect(cue("content below the view and no cards: a cue without a lift")).toEqual({ more: true, lift: 0 });
    expect(cue("every card inside the view but the content runs on")).toEqual({ more: true, lift: 0 });
    expect(cue("the first card starts below the fold")).toEqual({ more: true, lift: 0 });
    expect(cue("the last card in view")).toEqual({ more: false, lift: 0 });
  });
});

describe("start-flow vectors: revealDelta", () => {
  const delta = (title: string) => caseOf("revealDelta", title).output;

  it("leaves a card that shows whole, scrolls to one below or above, and shows the top of a tall one", () => {
    expect(delta("a card that shows whole needs no scroll")).toBe(0);
    expect(delta("scrolls down to a card below the view, the fade's room included")).toBe(600 + 8 + 28 - 400);
    expect(delta("scrolls up to a card above the view")).toBe(-158);
    expect(delta("shows the top of a card taller than the view")).toBe(42);
  });

  it("pins the edges of the room", () => {
    expect(delta("a card whose ring just fits at the top")).toBe(0);
    expect(delta("a card one pixel too high for its ring")).toBe(-1);
    expect(delta("a card whose fade room just fits at the bottom")).toBe(0);
    expect(delta("a card one pixel too low for the fade room")).toBe(1);
    expect(delta("no room around the card")).toBe(28);
  });
});

describe("start-flow vectors: the labels", () => {
  it("names what a filled field of the pass changes", () => {
    expect(caseOf("changeLabel", "names the deck field").output).toBe("Change deck, now CLF");
    expect(caseOf("changeLabel", "names the mode field a class").output).toBe("Change class, now Classic");
    expect(caseOf("changeLabel", "names the area field").output).toBe("Change area, now Cloud");
    expect(caseOf("changeLabel", "names the platform field").output).toBe("Change platform, now AWS");
    expect(caseOf("changeLabel", "names the section field").output).toBe("Change section, now SEC");
  });

  it("words the continue line's accessible name", () => {
    const label = (title: string) => caseOf("continueLabel", title).output;
    expect(label("names the route and the class in full")).toBe("Continue: AWS Cloud Practitioner, Security and compliance, Classic.");
    expect(label("adds the last score when it is known")).toBe("Continue: AWS Cloud Practitioner, Security and compliance, Classic. Last score 7 of 10.");
    expect(label("says a Streak score in its own words")).toBe("Continue: AWS Cloud Practitioner, Security and compliance, Streak. Last score 13 in a row.");
    expect(label("says Needs a connection when its deck cannot be played now")).toBe("Continue: AWS Cloud Practitioner, Security and compliance, Classic, needs a connection.");
    expect(label("needsConnection false is the ordinary line")).toBe("Continue: AWS Cloud Practitioner, Security and compliance, Classic. Last score 7 of 10.");
    expect(label("an empty last score is no score")).toBe("Continue: AWS Cloud Practitioner, Security and compliance, Classic.");
    expect(label("the deck named as the pass names it")).toBe("Continue: Next.js Rendering, Server and client components, Classic. Last score 7 of 10.");
    expect(label("Three lives with the score as the continue line words it")).toBe("Continue: AWS Cloud Practitioner, Security and compliance, Three lives. Last score 7 cards.");
    expect(label("Timed with the score as the continue line words it")).toBe("Continue: AWS Cloud Practitioner, Security and compliance, Timed. Last score 7 correct.");
  });

  it("names the one parameter props", () => {
    expect(Object.keys(caseOf("continueLabel", "adds the last score when it is known").input)).toEqual(["props"]);
  });
});
```

- [ ] **Step 25: Run it and see it fail.**

```bash
npx -y pnpm@10.34.0 vitest run tests/scripts/native/start-flow.test.ts
```

Expected: `Test Files  1 failed (1)`, `Tests  21 failed | 3 passed (24)`. The first failure is `AssertionError: expected [] to deeply equal [ …(12) ]` (no file of the steps yet); the others read `Error: no vectors for <name>`. The three that pass are the shape checks, which hold for an empty list.

- [ ] **Step 26: Write the steps producer.**

`scripts/native/golden/steps.ts`:

```ts
// Golden vectors for the steps of the start flow and what hangs on them: the step helpers
// (components/start/StartFlow.tsx), the list cue (components/start/listCue.ts) and the two labels
// (components/FillInPass.tsx, components/start/ContinueLine.tsx). Outputs are computed by calling the TypeScript
// functions on the index of ./catalog-fixture.
//
// A class table that a case closes a class in travels in the case's input as `modeTable` (see withClosedClasses
// in ./content).
import { changeLabel, type PassFieldName } from "@/components/FillInPass";
import { continueLabel } from "@/components/start/ContinueLine";
import { RECENT, STEP_OF, canShow, chosenOn, clearFrom, pathTo, previousStep, stepOf, type Choice, type Step } from "@/components/start/StartFlow";
import { FADE_PX, listCue, revealDelta, type ItemSpan } from "@/components/start/listCue";
import { MODE_TABLE, lastScoreText, modeInfo } from "@/src/app-state/modes";
import { CATALOG_INDEX } from "./catalog-fixture";
import { withClosedClasses } from "./content";
import { goldenFile, type GoldenCase, type GoldenFile } from "./format";

const FLOW_TESTS = ["tests/components/start/StartFlow.test.tsx", "tests/components/start/unoffered.test.tsx"] as const;
const CUE_TESTS = ["tests/components/start/listCue.test.tsx", "tests/components/start/reveal-on-return.test.tsx"] as const;
// The registry (task 4) gives each label the tests of its own web file.
const CHANGE_LABEL_TESTS = ["tests/components/FillInPass.test.tsx"] as const;
const CONTINUE_LABEL_TESTS = ["tests/components/start/ContinueLine.test.tsx", "tests/components/start/continue-line-polish.test.tsx"] as const;

function startFile(module: string, source: string, tests: readonly string[], name: string, cases: readonly GoldenCase[]): GoldenFile {
  return goldenFile({ module, function: name, source, tests }, cases);
}

const flowFile = (name: string, cases: readonly GoldenCase[]) => startFile("components/start/StartFlow", "components/start/StartFlow.tsx", FLOW_TESTS, name, cases);
const cueFile = (name: string, cases: readonly GoldenCase[]) => startFile("components/start/listCue", "components/start/listCue.ts", CUE_TESTS, name, cases);

// ---------- the steps and the choices ----------

const STEPS: readonly Step[] = [1, 2, 3, 4, 5, 6];
const CHOICE_KEYS = ["via", "areaId", "platformId", "deckId", "sectionId", "mode"] as const satisfies readonly (keyof Choice)[];

const AWS: Choice = { areaId: "cloud", platformId: "aws" };
const CLF: Choice = { ...AWS, deckId: "aws-clf-c02" };
const CLF_SEC: Choice = { ...CLF, sectionId: "SEC" };
const FULL: Choice = { ...CLF_SEC, mode: "classic" };
const GCP: Choice = { areaId: "cloud", platformId: "gcp" };
const CDL_ALL: Choice = { ...GCP, deckId: "gcp-cdl", sectionId: "ALL" };
const RECENT_CLF: Choice = { via: RECENT, ...CLF };
const RECENT_FULL: Choice = { via: RECENT, ...FULL };

function stepOfFile(): GoldenFile {
  const cases: GoldenCase[] = [];
  for (const key of CHOICE_KEYS) {
    cases.push({ name: `${key} on the ordinary path`, input: { key, choice: {} }, output: stepOf(key, {}) });
    cases.push({ name: `${key} on the recent path`, input: { key, choice: { via: RECENT } }, output: stepOf(key, { via: RECENT }) });
  }
  cases.push({ name: "areaId with a full recent choice", input: { key: "areaId", choice: RECENT_FULL }, output: stepOf("areaId", RECENT_FULL) });
  cases.push({ name: "areaId with an ordinary choice", input: { key: "areaId", choice: FULL }, output: stepOf("areaId", FULL) });
  return flowFile("stepOf", cases);
}

function stepOfTableFile(): GoldenFile {
  return flowFile("STEP_OF", [{ name: "the step on which each choice is made on the ordinary path", input: null, output: STEP_OF }]);
}

function clearFromFile(): GoldenFile {
  const call = (name: string, choice: Choice, step: Step): GoldenCase => ({ name, input: { choice, step }, output: clearFrom(choice, step) });
  const cases: GoldenCase[] = [];
  for (const step of STEPS) cases.push(call(`a full choice, back to step ${step}`, FULL, step));
  for (const step of STEPS) cases.push(call(`a full recent choice, back to step ${step}`, RECENT_FULL, step));
  cases.push(call("a partial choice keeps what was chosen before the step", AWS, 2));
  cases.push(call("a partial choice keeps nothing at step 1", AWS, 1));
  cases.push(call("an empty choice stays empty", {}, 4));
  cases.push(call("the recent path keeps via and clears the area and platform at step 2", RECENT_FULL, 2));
  cases.push(call("the section and class of a deck without sections", { ...CDL_ALL, mode: "streak" }, 5));
  return flowFile("clearFrom", cases);
}

function pathToFile(): GoldenFile {
  const cases: GoldenCase[] = [];
  for (const step of STEPS) {
    cases.push({ name: `up to step ${step}, with sections`, input: { step, hasSections: true }, output: pathTo(step, true) });
    cases.push({ name: `up to step ${step}, without sections`, input: { step, hasSections: false }, output: pathTo(step, false) });
    cases.push({ name: `up to step ${step}, recent path, with sections`, input: { step, hasSections: true, recent: true }, output: pathTo(step, true, true) });
    cases.push({ name: `up to step ${step}, recent path, without sections`, input: { step, hasSections: false, recent: true }, output: pathTo(step, false, true) });
    cases.push({ name: `up to step ${step}, recent spelled false`, input: { step, hasSections: true, recent: false }, output: pathTo(step, true, false) });
  }
  return flowFile("pathTo", cases);
}

function previousStepFile(): GoldenFile {
  const cases: GoldenCase[] = [];
  for (const step of STEPS) {
    cases.push({ name: `back from step ${step}, with sections`, input: { step, hasSections: true }, output: previousStep(step, true) });
    cases.push({ name: `back from step ${step}, without sections`, input: { step, hasSections: false }, output: previousStep(step, false) });
    cases.push({ name: `back from step ${step}, recent path, with sections`, input: { step, hasSections: true, recent: true }, output: previousStep(step, true, true) });
    cases.push({ name: `back from step ${step}, recent path, without sections`, input: { step, hasSections: false, recent: true }, output: previousStep(step, false, true) });
  }
  return flowFile("previousStep", cases);
}

function chosenOnFile(): GoldenFile {
  const call = (name: string, target: Step, choice: Choice): GoldenCase => ({ name, input: { target, choice }, output: chosenOn(target, choice) });
  return flowFile("chosenOn", [
    call("the Recent card on step 1 of the recent path", 1, RECENT_CLF),
    call("the deck on step 3 of the recent path", 3, RECENT_CLF),
    call("the area on step 1", 1, { areaId: "cloud" }),
    call("the platform on step 2", 2, AWS),
    call("the deck on step 3", 3, CLF),
    call("the section on step 4", 4, CLF_SEC),
    call("the class on step 5", 5, FULL),
    call("nothing on step 6", 6, { mode: "classic" }),
    call("nothing on step 6 of a full choice", 6, FULL),
    call("nothing when the step was not chosen yet", 3, AWS),
    call("the area is still the card of step 1 when via is not set", 1, FULL),
    call("the section of a recent choice on step 4", 4, { via: RECENT, ...CLF_SEC }),
    call("step 2 on the recent path still names the platform", 2, RECENT_CLF),
    call("step 1 of the recent path with nothing else", 1, { via: RECENT }),
  ]);
}

function canShowFile(): GoldenFile {
  const call = (name: string, step: Step, choice: Choice): GoldenCase => ({ name, input: { index: CATALOG_INDEX, step, choice }, output: canShow(CATALOG_INDEX, step, choice) });
  const cases: GoldenCase[] = [
    call("step 1 needs nothing", 1, {}),
    call("step 1 with a full choice", 1, FULL),
    call("step 2 needs the area", 2, {}),
    call("step 2 with an area", 2, { areaId: "cloud" }),
    call("step 2 with an area the index does not have", 2, { areaId: "gone" }),
    call("step 3 needs the platform", 3, { areaId: "cloud" }),
    call("step 3 with a platform", 3, AWS),
    call("step 3 with a platform the index does not have", 3, { areaId: "cloud", platformId: "gone" }),
    call("step 3 with a platform of another area", 3, { areaId: "frontend", platformId: "aws" }),
    call("step 3 with a full choice", 3, FULL),
    call("step 4 with a deck that has sections", 4, CLF),
    call("step 4 needs a deck", 4, AWS),
    call("step 4 with a deck that has no sections", 4, { ...GCP, deckId: "gcp-cdl" }),
    call("step 4 with a deck of another platform", 4, { ...AWS, deckId: "gcp-cdl" }),
    call("step 5 needs the section", 5, CLF),
    call("step 5 with a section", 5, CLF_SEC),
    call("step 5 with the whole deck of a deck with sections", 5, { ...CLF, sectionId: "ALL" }),
    call("step 5 with a section the deck does not have", 5, { ...CLF, sectionId: "OLD" }),
    call("step 5 with a section of another deck", 5, { ...CLF, sectionId: "RSC" }),
    call("step 5 with the whole deck of a deck without sections", 5, CDL_ALL),
    call("step 5 with a section of a deck that has none", 5, { ...GCP, deckId: "gcp-cdl", sectionId: "SEC" }),
    call("step 6 with a class", 6, FULL),
    call("step 6 needs a class", 6, CLF_SEC),
    call("step 6 with a class that does not exist", 6, { ...CLF_SEC, mode: "zen" as never }),
    call("step 6 needs the section", 6, { ...CLF, mode: "classic" }),
    call("step 6 of a deck without sections", 6, { ...CDL_ALL, mode: "lives" }),
    call("step 6 with Streak", 6, { ...CLF_SEC, mode: "streak" }),
    call("step 6 with Three lives", 6, { ...CLF_SEC, mode: "lives" }),
    call("step 6 with Timed while it is offered", 6, { ...CLF_SEC, mode: "timed" }),
    call("step 1 on the recent path", 1, { via: RECENT }),
    call("step 2 does not exist on the recent path", 2, { via: RECENT }),
    call("step 2 does not exist on the recent path, even with an area", 2, { via: RECENT, areaId: "cloud" }),
    call("step 3 of the recent path needs no area or platform", 3, { via: RECENT }),
    call("step 3 needs the platform on the ordinary path", 3, {}),
    call("step 4 of the recent path needs the deck", 4, { via: RECENT }),
    call("step 4 of the recent path with a deck that has sections", 4, RECENT_CLF),
    call("step 4 of the recent path with a deck that has none", 4, { via: RECENT, ...GCP, deckId: "gcp-cdl" }),
    call("step 4 of the recent path: the deck is found only inside its area and platform", 4, { via: RECENT, deckId: "aws-clf-c02" }),
    call("step 5 of the recent path with the whole deck", 5, { via: RECENT, ...CDL_ALL }),
    call("step 6 of the recent path", 6, RECENT_FULL),
  ];
  for (const mode of ["timed", "streak"] as const) {
    const choice: Choice = { ...CLF_SEC, mode };
    cases.push(withClosedClasses(["timed"], (modeTable) => ({ name: `step 6 with ${mode} while Timed is closed`, input: { index: CATALOG_INDEX, step: 6, choice, modeTable }, output: canShow(CATALOG_INDEX, 6, choice) })));
  }
  const closed: Choice = { ...CLF_SEC, mode: "timed" };
  cases.push(withClosedClasses(["timed"], (modeTable) => ({ name: "step 5 does not look at the class while Timed is closed", input: { index: CATALOG_INDEX, step: 5, choice: closed, modeTable }, output: canShow(CATALOG_INDEX, 5, closed) })));
  return flowFile("canShow", cases);
}

function flowFiles(): GoldenFile[] {
  return [stepOfTableFile(), stepOfFile(), clearFromFile(), pathToFile(), previousStepFile(), chosenOnFile(), canShowFile()];
}

// ---------- the list cue ----------

/** `count` cards of `height` with `gap` between them, the first at `first`, minus how far the list has scrolled. */
function cards(count: number, height: number, gap: number, first: number, scrollTop = 0): ItemSpan[] {
  return Array.from({ length: count }, (_, i) => {
    const top = first + i * (height + gap) - scrollTop;
    return { top, bottom: top + height };
  });
}

function bottomOf(items: ItemSpan[]): number {
  return items.at(-1)?.bottom ?? 0;
}

function listCueFile(): GoldenFile {
  const call = (name: string, viewHeight: number, contentBottom: number, items: ItemSpan[]): GoldenCase => ({
    name,
    input: { viewHeight, contentBottom, items },
    output: listCue(viewHeight, contentBottom, items),
  });
  const five = cards(5, 90, 12, 6);
  const nine = cards(9, 90, 12, 6);
  const four = cards(4, 108, 12, 0);
  const cases: GoldenCase[] = [
    call("no cue while the content ends inside the view", 518, bottomOf(five), five),
    call("no cue when the content ends one pixel below the view (rounding)", 503, 504, five),
    call("a cue when the content ends two pixels below the view", 503, 505, five),
    call("the fade ends at the edge when the fold cuts a card that shows 65 px", 581, bottomOf(nine), nine),
    call("the fade ends at the edge when the fold shows exactly 28 px", 516 + FADE_PX, bottomOf(nine), nine),
    call("the fade moves up when the fold shows 27 px", 516 + FADE_PX - 1, bottomOf(nine), nine),
    call("the fade ends on the card above when the fold falls in the gap", 236, bottomOf(four), four),
    call("the fade lifts most of the way when the fold shows a 2 px sliver", 518, bottomOf(nine), nine),
    call("the fade ends on the card above when the fold shows 0 px", 516, bottomOf(nine), nine),
    call("content below the view and no cards: a cue without a lift", 100, 300, []),
    call("every card inside the view but the content runs on", 200, 400, cards(2, 50, 10, 0)),
    call("the first card starts below the fold", 100, 400, cards(3, 90, 12, 150)),
    call("the first card starts exactly at the fold", 100, 400, cards(3, 90, 12, 100)),
    call("a view of height 0", 0, 90, cards(1, 90, 12, 0)),
    call("fractional positions", 300.5, 612.75, cards(6, 90.25, 11.5, 5.5)),
    call("the last card in view", 518, 504, cards(5, 90, 12, 6)),
    call("one very tall card", 400, 1000, [{ top: 0, bottom: 1000 }]),
  ];
  for (const scrollTop of [0, 10, 20, 30, 40, 50, 60, 63, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 210, 220, 230, 240, 250, 260, 270, 280, 290, 300, 390, 394, 400]) {
    const scrolled = cards(9, 90, 12, 6, scrollTop);
    cases.push(call(`nine cards scrolled by ${scrollTop} px`, 518, bottomOf(scrolled), scrolled));
  }
  return cueFile("listCue", cases);
}

function revealDeltaFile(): GoldenFile {
  const call = (name: string, viewHeight: number, item: ItemSpan, room: number): GoldenCase => ({
    name,
    input: { viewHeight, item, room },
    output: revealDelta(viewHeight, item, room),
  });
  return cueFile("revealDelta", [
    call("a card that shows whole needs no scroll", 400, { top: 100, bottom: 200 }, 8),
    call("scrolls down to a card below the view, the fade's room included", 400, { top: 500, bottom: 600 }, 8),
    call("scrolls up to a card above the view", 400, { top: -150, bottom: -50 }, 8),
    call("shows the top of a card taller than the view", 100, { top: 50, bottom: 300 }, 8),
    call("a card whose ring just fits at the top", 400, { top: 8, bottom: 108 }, 8),
    call("a card one pixel too high for its ring", 400, { top: 7, bottom: 107 }, 8),
    call("a card whose fade room just fits at the bottom", 400, { top: 264, bottom: 364 }, 8),
    call("a card one pixel too low for the fade room", 400, { top: 265, bottom: 365 }, 8),
    call("no room around the card", 400, { top: 300, bottom: 400 }, 0),
    call("a card taller than the view that starts above it", 100, { top: -20, bottom: 300 }, 8),
    call("a card that starts at the top and is taller than the view", 100, { top: 8, bottom: 300 }, 8),
    call("fractional positions", 400.5, { top: 301.25, bottom: 420.5 }, 8),
  ]);
}

function fadeFile(): GoldenFile {
  return cueFile("FADE_PX", [{ name: "the length of the fade", input: null, output: FADE_PX }]);
}

function listCueFiles(): GoldenFile[] {
  return [fadeFile(), listCueFile(), revealDeltaFile()];
}

// ---------- the labels ----------

function changeLabelFile(): GoldenFile {
  const call = (name: string, field: PassFieldName, value: string): GoldenCase => ({ name, input: { field, value }, output: changeLabel(field, value) });
  return startFile("components/FillInPass", "components/FillInPass.tsx", CHANGE_LABEL_TESTS, "changeLabel", [
    call("names the deck field", "deck", "CLF"),
    call("names the mode field a class", "mode", "Classic"),
    call("names the area field", "area", "Cloud"),
    call("names the platform field", "platform", "AWS"),
    call("names the section field", "section", "SEC"),
    call("the section of a whole deck", "section", "ALL"),
    call("a class with a long name", "mode", "Three lives"),
    call("an empty value", "area", ""),
  ]);
}

type ContinueProps = Parameters<typeof continueLabel>[0];

function continueLabelFile(): GoldenFile {
  // continueLabel takes one object; the vector names that parameter `props`.
  const call = (name: string, props: ContinueProps): GoldenCase => ({ name, input: { props }, output: continueLabel(props) });
  const route = { deckName: "AWS Cloud Practitioner", sectionTitle: "Security and compliance", modeLabel: "Classic" };
  const cases: GoldenCase[] = [
    call("names the route and the class in full", route),
    call("adds the last score when it is known", { ...route, lastScore: "7 of 10" }),
    call("says a Streak score in its own words", { ...route, modeLabel: "Streak", lastScore: "13 in a row" }),
    call("says Needs a connection when its deck cannot be played now", { ...route, lastScore: "7 of 10", needsConnection: true }),
    call("needs a connection without a score", { ...route, needsConnection: true }),
    call("needsConnection false is the ordinary line", { ...route, lastScore: "7 of 10", needsConnection: false }),
    call("an empty last score is no score", { ...route, lastScore: "" }),
    call("the deck named as the pass names it", { deckName: "Next.js Rendering", sectionTitle: "Server and client components", modeLabel: "Classic", lastScore: "7 of 10" }),
    call("a deck with its own pass name and the whole deck", { deckName: "Google Cloud Digital Leader", sectionTitle: "Whole deck", modeLabel: "Classic", lastScore: "7 of 10" }),
  ];
  for (const row of MODE_TABLE) {
    cases.push(call(`${row.name} with the score as the continue line words it`, { ...route, modeLabel: modeInfo(row.id).name, lastScore: lastScoreText(row.id, 7, 10) }));
  }
  return startFile("components/start/ContinueLine", "components/start/ContinueLine.tsx", CONTINUE_LABEL_TESTS, "continueLabel", cases);
}

function labelFiles(): GoldenFile[] {
  return [changeLabelFile(), continueLabelFile()];
}

export function stepFiles(): GoldenFile[] {
  return [...flowFiles(), ...listCueFiles(), ...labelFiles()];
}
```

- [ ] **Step 27: Join the two halves in `start.ts`.**

Replace the whole of `scripts/native/golden/start.ts` with:

```ts
// Golden vectors for the start screen: the catalog helpers, the step helpers, the list cue and the labels.
import { catalogFiles } from "./catalog";
import type { GoldenFile } from "./format";
import { stepFiles } from "./steps";

export function golden(): GoldenFile[] {
  return [...catalogFiles(), ...stepFiles()];
}
```

- [ ] **Step 28: Run both start tests and the type check.**

```bash
npx -y pnpm@10.34.0 vitest run tests/scripts/native/start-catalog.test.ts tests/scripts/native/start-flow.test.ts
npx -y pnpm@10.34.0 typecheck
```

Expected: `Test Files  2 passed (2)`, `Tests  47 passed (47)` (catalog 23, steps 24); `tsc --noEmit` prints nothing after the script header and exits 0.

- [ ] **Step 29: Commit.**

```bash
git add scripts/native/golden/steps.ts scripts/native/golden/start.ts tests/scripts/native/start-flow.test.ts
git commit -m "feat: add the golden vectors for the start flow's steps, the list cue and the labels"
```

- [ ] **Step 30: Write the registry test.**

`tests/scripts/native/progress-start-registry.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { golden as content } from "@/scripts/native/golden/content";
import { golden as progress } from "@/scripts/native/golden/progress";
import { golden as start } from "@/scripts/native/golden/start";
import { NATIVE_FUNCTIONS, goldenProducers } from "@/scripts/native/registry";

// The producers of progress, content and start are registered, and every file they write is a function or a
// constant of the inventory (reference 3.9) with the same source file and the same kind.
describe("registry: progress, content and start", () => {
  it("runs the three producers", () => {
    expect(goldenProducers()).toEqual(expect.arrayContaining([progress, content, start]));
  });

  it("writes each path once", () => {
    const paths = [...progress(), ...content(), ...start()].map((file) => file.path);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toHaveLength(12 + 11 + 20);
  });

  it("writes only files of the inventory, with its source file, its tests and its kind", () => {
    for (const file of [...progress(), ...content(), ...start()]) {
      const vectors = JSON.parse(file.content) as { module: string; function: string; source: string; tests: string[]; cases: { input: unknown }[] };
      const listed = NATIVE_FUNCTIONS.find((candidate) => candidate.module === vectors.module && candidate.name === vectors.function);
      expect(listed, file.path).toBeDefined();
      expect(listed?.source, file.path).toBe(vectors.source);
      expect(listed?.tests ?? [], file.path).toEqual(expect.arrayContaining(vectors.tests));
      expect(listed?.kind, file.path).toBe(vectors.cases[0]?.input === null ? "constant" : "function");
    }
  });
});
```

- [ ] **Step 31: Run it and see it fail.**

```bash
npx -y pnpm@10.34.0 vitest run tests/scripts/native/progress-start-registry.test.ts
```

Expected: `Tests  1 failed | 2 passed (3)`. The failure is "runs the three producers": `AssertionError: expected [ ... ] to deeply equal ArrayContaining{…}`, because `goldenProducers()` does not list them yet. The other two pass already: the paths are unique and each is in the inventory. If one of them fails with `expected undefined to be defined`, or on `source`, `tests` or `kind`, stop: the registry of task 4 (130 entries, pinned by `tests/scripts/native/registry.test.ts`) and reference 3.9 must be reconciled there, not patched in this task.

- [ ] **Step 32: Register the three producers.**

In `scripts/native/registry.ts`, add these imports next to the producer imports of tasks 4 to 6:

```ts
import { golden as contentGolden } from "./golden/content";
import { golden as progressGolden } from "./golden/progress";
import { golden as startGolden } from "./golden/start";
```

and append `progressGolden, contentGolden, startGolden` to the array that `goldenProducers()` returns, after the producers of tasks 4 to 6 (the list is in the order of the task numbers).

- [ ] **Step 33: Run the registry test, the whole native folder, the type check and the whole suite.**

```bash
npx -y pnpm@10.34.0 vitest run tests/scripts/native/progress-start-registry.test.ts
npx -y pnpm@10.34.0 vitest run tests/scripts/native
npx -y pnpm@10.34.0 typecheck
npx -y pnpm@10.34.0 test
```

Expected: the first shows `Tests  3 passed (3)`; the second passes every file, and this task's six files hold 104 tests (progress 34, content 17, catalog-exports 3, start-catalog 23, start-flow 24, registry 3); `tsc --noEmit` prints nothing after the script header and exits 0; `pnpm test` ends with `Test Files  169 passed (169)` and `Tests  3418 passed (3418)`: task 6's 163 and 3314 plus this task's 6 files and 104 tests (`tests/repo-hygiene.test.ts` scans the new files once they are tracked: no em dash, no absolute path, no e-mail-shaped string).

- [ ] **Step 34: Commit.**

```bash
git add scripts/native/registry.ts tests/scripts/native/progress-start-registry.test.ts
git commit -m "feat: register the progress, content and start golden producers"
```
