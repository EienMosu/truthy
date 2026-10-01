### Task 6: Progress

What the device remembers between rounds (spec section 7): per card how often it was seen, whether the last answer was right and when it was last seen; per route and mode the record; and the last route and mode played, with the score of that round when it was finished, for the "Continue" line. `src/progress/progress.ts` holds the type and pure functions (no React, no DOM, no storage, no clock); `src/progress/local.ts` puts it behind a small store interface backed by `localStorage`, so a native clone can swap the storage without touching the rules. Storage that is missing, blocked, full or corrupt never reaches the player: the game runs with empty progress.

The behaviour is built in nine test-first slices: the empty value and record keys; card history and the last route; records; deck pruning and the seen share; reading stored progress; the local store; the review focus cases; reaching `window.localStorage` safely; the score of the last round (steps 38a to 38e).

Every command below runs from the repository root, `~/Desktop/workspace/truthy`.

**Files:**
- Create: `src/progress/progress.ts`
- Create: `src/progress/local.ts`
- Test: `tests/progress/progress.test.ts`
- Test: `tests/progress/local.test.ts`

**Interfaces:**
- Consumes:
  - From task 3, `src/content/schema.ts`: `interface Route { deckId: string; sectionId: string }` and `routeKey(route: Route): string` (returns `${deckId}/${sectionId}`), `type Card`, `WHOLE_DECK = "ALL"`.
  - From task 4, `src/engine/deal.ts`: `interface CardHistory { seen: number; lastCorrect: boolean; lastSeenAt: number }` and `type History = Readonly<Record<string, CardHistory>>`.
  - From task 5, `src/engine/round.ts`: `type Mode = "classic" | "streak" | "lives" | "timed"`, `interface Answered { card: Card; given: boolean; correct: boolean; at: number }`, `interface RoundResult { mode; route; score; total; answers: readonly Answered[]; missed; abandoned: boolean }`.
  - From task 1: zod, Vitest (node environment), the `@/*` alias.
- Produces (as in the contract, plus three additions marked "added"):

```ts
// src/progress/progress.ts
export interface Progress {
  version: 1;
  cards: Record<string, CardHistory>;
  records: Record<string, number>;              // key: recordKey(route, mode)
  last: { route: Route; mode: Mode; score: number | null; total: number | null } | null;   // added: score and total (step 38c)
}
export interface ApplyOutcome { progress: Progress; previousBest: number | null; isNewBest: boolean }   // added: names the contract's inline return type
export function emptyProgress(): Progress;
export function recordKey(route: Route, mode: Mode): string;      // `${routeKey(route)}#${mode}`, e.g. "aws-clf-c02/SEC#classic"
export function applyResult(progress: Progress, result: RoundResult): ApplyOutcome;
export function pruneDeck(progress: Progress, deckId: string, cardIds: readonly string[]): Progress;
export function seenShare(history: History, cardIds: readonly string[]): number;   // 0..1
export function parseProgress(raw: string | null): Progress;      // never throws

// src/progress/local.ts
export const PROGRESS_KEY = "truthy.progress.v1";
export interface ProgressStore { load(): Progress; save(progress: Progress): void }
export function createLocalStore(storage: Pick<Storage, "getItem" | "setItem"> | undefined): ProgressStore;
export function browserLocalStorage(): Storage | undefined;       // added: window.localStorage, or undefined when there is no window or reading it throws
```

Exact semantics later tasks (8, 10, 12) rely on:
- `applyResult` walks `result.answers` in order. For each answer: `seen` goes up by one (a new card starts at 1), `lastCorrect` becomes `answer.correct`, `lastSeenAt` becomes `answer.at`. A card answered twice in one result counts twice and the later answer wins. It always sets `last` to the result's route and mode (a copy, not the same object), even for an abandoned round with no answers. `last.score` and `last.total` are the result's `score` and `total` for a finished round, and `null` for an abandoned one (the continue line then shows no score).
- Records: `previousBest` is the stored record for `recordKey(result.route, result.mode)`, or `null` when there is none. `isNewBest` is true when the round is not abandoned and either there was no record (a first finished round always sets the record, even a score of 0) or `result.score > previousBest`. Equalling the record is not a new best. Only when `isNewBest` is the record written. An abandoned round never writes a record and always returns `isNewBest: false`, but still reports `previousBest`. The result screen can tell "first record" from "beaten record" by `previousBest === null`.
- `pruneDeck` removes `cards` entries whose id starts with `${deckId}-` and is not in `cardIds`. Other decks' entries, `records` and `last` are kept. It never adds entries. Call it after loading a deck file, with that file's card ids.
- `seenShare` is the number of distinct ids in `cardIds` whose entry has `seen > 0`, divided by the number of distinct ids. An empty `cardIds` gives 0.
- `parseProgress` gives `emptyProgress()` for `null`, invalid JSON, any value of the wrong shape, negative or fractional counts (scores included), an unknown mode, an empty deck or section id, or any `version` other than the number 1. Unknown extra fields are dropped and the rest is kept. A stored `last` without `score` and `total` (written before step 38c) reads with both `null`.
- `createLocalStore(storage).load()` reads `PROGRESS_KEY` through `parseProgress` and returns a fresh object each time; with `undefined` storage or a throwing `getItem` it returns empty progress. `save` writes `JSON.stringify(progress)`; with `undefined` storage or a throwing `setItem` (quota, blocked) it does nothing and does not throw, and what was stored before stays.
- Wire it up in the client as `createLocalStore(browserLocalStorage())`. Never pass `window.localStorage` directly: in Safari and Firefox with site data blocked, merely reading that property throws.
- All functions in `progress.ts` are pure: they never change their arguments.

- [ ] **Step 1: Write the failing tests for the empty progress and record keys**

Create `tests/progress/progress.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { emptyProgress, recordKey } from "@/src/progress/progress";

describe("emptyProgress", () => {
  it("has version 1, no card history, no records and no last route", () => {
    expect(emptyProgress()).toEqual({ version: 1, cards: {}, records: {}, last: null });
  });

  it("returns a fresh object on every call", () => {
    const first = emptyProgress();
    first.cards["aws-clf-c02-t1.1-01"] = { seen: 1, lastCorrect: true, lastSeenAt: 1 };
    first.records["x"] = 3;
    expect(emptyProgress()).toEqual({ version: 1, cards: {}, records: {}, last: null });
  });
});

describe("recordKey", () => {
  it("joins the route key and the mode with a hash", () => {
    expect(recordKey({ deckId: "aws-clf-c02", sectionId: "SEC" }, "classic")).toBe("aws-clf-c02/SEC#classic");
  });

  it("uses the whole deck id for a whole deck route", () => {
    expect(recordKey({ deckId: "nextjs-rendering", sectionId: "ALL" }, "classic")).toBe("nextjs-rendering/ALL#classic");
  });

  it("gives different keys for different modes on the same route", () => {
    const route = { deckId: "aws-clf-c02", sectionId: "SEC" };
    expect(recordKey(route, "classic")).not.toBe(recordKey(route, "timed"));
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `pnpm vitest run tests/progress/progress.test.ts`

Expected: the suite fails because the module does not exist yet:

```
 FAIL  tests/progress/progress.test.ts [ tests/progress/progress.test.ts ]
Error: Cannot find package '@/src/progress/progress' imported from .../tests/progress/progress.test.ts
 Test Files  1 failed (1)
      Tests  no tests
```

- [ ] **Step 3: Create the module with the type, emptyProgress and recordKey**

Create `src/progress/progress.ts`:

```ts
// Progress: card history, records and the last route played (spec section 7).
// Pure: every function returns new objects and never changes its inputs.
// The storage side lives in ./local, behind the ProgressStore interface.

import { routeKey, type Route } from "@/src/content/schema";
import type { CardHistory, History } from "@/src/engine/deal";
import type { Mode, RoundResult } from "@/src/engine/round";

export interface Progress {
  version: 1;
  cards: Record<string, CardHistory>;
  records: Record<string, number>; // key: recordKey(route, mode)
  last: { route: Route; mode: Mode } | null;
}

export function emptyProgress(): Progress {
  return { version: 1, cards: {}, records: {}, last: null };
}

export function recordKey(route: Route, mode: Mode): string {
  return `${routeKey(route)}#${mode}`;
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `pnpm vitest run tests/progress/progress.test.ts`

Expected:

```
 Test Files  1 passed (1)
      Tests  5 passed (5)
```

- [ ] **Step 5: Commit**

```bash
git add src/progress/progress.ts tests/progress/progress.test.ts
git commit -m "feat: add the progress type, empty progress and record keys"
```

- [ ] **Step 6: Write the failing tests for card history and the last route**

In `tests/progress/progress.test.ts`, replace the two import lines at the top with:

```ts
import { describe, expect, it } from "vitest";
import type { Card, Route } from "@/src/content/schema";
import type { Answered, RoundResult } from "@/src/engine/round";
import { applyResult, emptyProgress, recordKey, type Progress } from "@/src/progress/progress";
```

Then append to the end of the file:

```ts
// Fixtures shared by the tests below.

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

function result(answers: Answered[], options: { route?: Route; abandoned?: boolean } = {}): RoundResult {
  return {
    mode: "classic",
    route: options.route ?? SEC,
    score: answers.filter((a) => a.correct).length,
    total: answers.length,
    answers,
    missed: answers.filter((a) => !a.correct),
    abandoned: options.abandoned ?? false,
  };
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const inner of Object.values(value)) deepFreeze(inner);
    Object.freeze(value);
  }
  return value;
}

describe("applyResult: card history", () => {
  it("creates an entry for a card answered for the first time", () => {
    const { progress } = applyResult(emptyProgress(), result([answered("c1", true, 1000)]));
    expect(progress.cards["c1"]).toEqual({ seen: 1, lastCorrect: true, lastSeenAt: 1000 });
  });

  it("records a wrong answer as lastCorrect false", () => {
    const { progress } = applyResult(emptyProgress(), result([answered("c1", false, 1000)]));
    expect(progress.cards["c1"]).toEqual({ seen: 1, lastCorrect: false, lastSeenAt: 1000 });
  });

  it("adds to the seen count and replaces lastCorrect and lastSeenAt of a known card", () => {
    const before: Progress = { ...emptyProgress(), cards: { c1: { seen: 4, lastCorrect: true, lastSeenAt: 500 } } };
    const { progress } = applyResult(before, result([answered("c1", false, 2000)]));
    expect(progress.cards["c1"]).toEqual({ seen: 5, lastCorrect: false, lastSeenAt: 2000 });
  });

  it("uses each answer's own time", () => {
    const { progress } = applyResult(emptyProgress(), result([answered("c1", true, 1000), answered("c2", false, 4000)]));
    expect(progress.cards["c1"]?.lastSeenAt).toBe(1000);
    expect(progress.cards["c2"]?.lastSeenAt).toBe(4000);
  });

  it("leaves the history of cards that were not in the round alone", () => {
    const other = { seen: 2, lastCorrect: false, lastSeenAt: 10 };
    const before: Progress = { ...emptyProgress(), cards: { other } };
    const { progress } = applyResult(before, result([answered("c1", true, 1000)]));
    expect(progress.cards["other"]).toEqual(other);
  });

  it("keeps the history unchanged for a round with no answers", () => {
    const before: Progress = { ...emptyProgress(), cards: { c1: { seen: 1, lastCorrect: true, lastSeenAt: 1 } } };
    const { progress } = applyResult(before, result([], { abandoned: true }));
    expect(progress.cards).toEqual(before.cards);
  });
});

describe("applyResult: last route", () => {
  it("sets the last route and mode", () => {
    const { progress } = applyResult(emptyProgress(), result([answered("c1", true, 1)]));
    expect(progress.last).toEqual({ route: SEC, mode: "classic" });
  });

  it("replaces an earlier last route", () => {
    const before: Progress = { ...emptyProgress(), last: { route: CON, mode: "classic" } };
    const { progress } = applyResult(before, result([answered("c1", true, 1)], { route: SEC }));
    expect(progress.last).toEqual({ route: SEC, mode: "classic" });
  });

  it("sets the last route even for an abandoned round", () => {
    const { progress } = applyResult(emptyProgress(), result([], { abandoned: true }));
    expect(progress.last).toEqual({ route: SEC, mode: "classic" });
  });

  it("does not share the route object with the result", () => {
    const round = result([answered("c1", true, 1)]);
    const { progress } = applyResult(emptyProgress(), round);
    expect(progress.last?.route).not.toBe(round.route);
  });
});

describe("applyResult: purity", () => {
  it("does not change the progress or the result it is given", () => {
    const before = deepFreeze<Progress>({
      version: 1,
      cards: { c1: { seen: 1, lastCorrect: false, lastSeenAt: 1 } },
      records: { [recordKey(SEC, "classic")]: 3 },
      last: { route: CON, mode: "classic" },
    });
    const round = deepFreeze(result([answered("c1", true, 9), answered("c2", true, 10)]));
    const beforeCopy = structuredClone(before);
    const roundCopy = structuredClone(round);
    applyResult(before, round);
    expect(before).toEqual(beforeCopy);
    expect(round).toEqual(roundCopy);
  });
});
```

- [ ] **Step 7: Run the tests and watch the new ones fail**

Run: `pnpm vitest run tests/progress/progress.test.ts`

Expected: the 11 new tests fail with `TypeError: applyResult is not a function`; the 5 from step 1 still pass:

```
      Tests  11 failed | 5 passed (16)
```

- [ ] **Step 8: Implement applyResult for card history and the last route**

Append to the end of `src/progress/progress.ts`:

```ts
export interface ApplyOutcome {
  progress: Progress;
  previousBest: number | null;
  isNewBest: boolean;
}

// Records the answers of a round in the card history and remembers its route and mode.
// Records are added in the next step.
export function applyResult(progress: Progress, result: RoundResult): ApplyOutcome {
  const key = recordKey(result.route, result.mode);
  const previousBest = Object.hasOwn(progress.records, key) ? (progress.records[key] ?? null) : null;
  return {
    progress: {
      version: 1,
      cards: withAnswers(progress.cards, result),
      records: { ...progress.records },
      last: { route: { deckId: result.route.deckId, sectionId: result.route.sectionId }, mode: result.mode },
    },
    previousBest,
    isNewBest: false,
  };
}

function withAnswers(cards: Readonly<Record<string, CardHistory>>, result: RoundResult): Record<string, CardHistory> {
  const next: Record<string, CardHistory> = { ...cards };
  for (const answer of result.answers) {
    const id = answer.card.id;
    const before = Object.hasOwn(next, id) ? next[id] : undefined;
    next[id] = { seen: (before?.seen ?? 0) + 1, lastCorrect: answer.correct, lastSeenAt: answer.at };
  }
  return next;
}
```

- [ ] **Step 9: Run the tests and watch them pass**

Run: `pnpm vitest run tests/progress/progress.test.ts`

Expected:

```
 Test Files  1 passed (1)
      Tests  16 passed (16)
```

- [ ] **Step 10: Commit**

```bash
git add src/progress/progress.ts tests/progress/progress.test.ts
git commit -m "feat: record answers in the card history and remember the last route"
```

- [ ] **Step 11: Write the failing tests for records and abandoned rounds**

Append to the end of `tests/progress/progress.test.ts`:

```ts
// A classic result with the given score out of ten, all answered at time 1.
function scored(score: number, options: { route?: Route; abandoned?: boolean } = {}): RoundResult {
  const answers = Array.from({ length: 10 }, (_, i) => answered(`c${i}`, i < score, 1));
  return result(answers, options);
}

function withRecord(route: Route, best: number): Progress {
  return { ...emptyProgress(), records: { [recordKey(route, "classic")]: best } };
}

describe("applyResult: records", () => {
  it("sets a first record for a route and mode that has none", () => {
    const outcome = applyResult(emptyProgress(), scored(6));
    expect(outcome.progress.records).toEqual({ "aws-clf-c02/SEC#classic": 6 });
    expect(outcome.previousBest).toBeNull();
    expect(outcome.isNewBest).toBe(true);
  });

  it("replaces a record that the score beats", () => {
    const outcome = applyResult(withRecord(SEC, 6), scored(8));
    expect(outcome.progress.records["aws-clf-c02/SEC#classic"]).toBe(8);
    expect(outcome.previousBest).toBe(6);
    expect(outcome.isNewBest).toBe(true);
  });

  it("keeps a record that the score does not reach", () => {
    const outcome = applyResult(withRecord(SEC, 8), scored(5));
    expect(outcome.progress.records["aws-clf-c02/SEC#classic"]).toBe(8);
    expect(outcome.previousBest).toBe(8);
    expect(outcome.isNewBest).toBe(false);
  });

  it("does not count equalling the record as a new best", () => {
    const outcome = applyResult(withRecord(SEC, 7), scored(7));
    expect(outcome.progress.records["aws-clf-c02/SEC#classic"]).toBe(7);
    expect(outcome.previousBest).toBe(7);
    expect(outcome.isNewBest).toBe(false);
  });

  it("keeps the records of other routes and modes", () => {
    const before: Progress = {
      ...emptyProgress(),
      records: { [recordKey(CON, "classic")]: 9, [recordKey(SEC, "timed")]: 20 },
    };
    const outcome = applyResult(before, scored(4, { route: SEC }));
    expect(outcome.progress.records).toEqual({
      "aws-clf-c02/CON#classic": 9,
      "aws-clf-c02/SEC#timed": 20,
      "aws-clf-c02/SEC#classic": 4,
    });
  });

  it("does not compare against the record of another section", () => {
    const outcome = applyResult(withRecord(CON, 9), scored(3, { route: SEC }));
    expect(outcome.previousBest).toBeNull();
    expect(outcome.isNewBest).toBe(true);
  });
});

describe("applyResult: an abandoned round", () => {
  it("updates the card history", () => {
    const round = result([answered("c1", true, 100), answered("c2", false, 200)], { abandoned: true });
    const { progress } = applyResult(emptyProgress(), round);
    expect(progress.cards).toEqual({
      c1: { seen: 1, lastCorrect: true, lastSeenAt: 100 },
      c2: { seen: 1, lastCorrect: false, lastSeenAt: 200 },
    });
  });

  it("does not beat an existing record, however high its score", () => {
    const outcome = applyResult(withRecord(SEC, 2), scored(9, { abandoned: true }));
    expect(outcome.progress.records["aws-clf-c02/SEC#classic"]).toBe(2);
    expect(outcome.previousBest).toBe(2);
    expect(outcome.isNewBest).toBe(false);
  });

  it("does not set a first record", () => {
    const outcome = applyResult(emptyProgress(), scored(5, { abandoned: true }));
    expect(outcome.progress.records).toEqual({});
    expect(outcome.previousBest).toBeNull();
    expect(outcome.isNewBest).toBe(false);
  });
});
```

- [ ] **Step 12: Run the tests and watch the record tests fail**

Run: `pnpm vitest run tests/progress/progress.test.ts`

Expected: 4 tests fail, the ones where a record must be written or a new best reported; the other 5 new tests already pass because step 8 reports `previousBest` and never claims a new best:

```
     × sets a first record for a route and mode that has none
     × replaces a record that the score beats
     × keeps the records of other routes and modes
     × does not compare against the record of another section
      Tests  4 failed | 21 passed (25)
```

- [ ] **Step 13: Implement records**

In `src/progress/progress.ts`, replace the whole `applyResult` function together with the two comment lines above it (from `// Records the answers of a round` down to the closing `}` before `function withAnswers`) with:

```ts
// Records the answers of a round in the card history, remembers its route and mode,
// and sets the record for that route and mode when a finished round beats it.
// A first finished round on a route and mode always sets the record.
// An abandoned round keeps its answers in the history but never touches the record.
export function applyResult(progress: Progress, result: RoundResult): ApplyOutcome {
  const key = recordKey(result.route, result.mode);
  const previousBest = Object.hasOwn(progress.records, key) ? (progress.records[key] ?? null) : null;
  const isNewBest = !result.abandoned && (previousBest === null || result.score > previousBest);
  const records = isNewBest ? { ...progress.records, [key]: result.score } : { ...progress.records };
  return {
    progress: {
      version: 1,
      cards: withAnswers(progress.cards, result),
      records,
      last: { route: { deckId: result.route.deckId, sectionId: result.route.sectionId }, mode: result.mode },
    },
    previousBest,
    isNewBest,
  };
}
```

- [ ] **Step 14: Run the tests and watch them pass**

Run: `pnpm vitest run tests/progress/progress.test.ts`

Expected:

```
 Test Files  1 passed (1)
      Tests  25 passed (25)
```

- [ ] **Step 15: Commit**

```bash
git add src/progress/progress.ts tests/progress/progress.test.ts
git commit -m "feat: set and beat records, never from an abandoned round"
```

- [ ] **Step 16: Write the failing tests for pruneDeck and seenShare**

In `tests/progress/progress.test.ts`, replace the import line that starts with `import { applyResult` with:

```ts
import {
  applyResult,
  emptyProgress,
  pruneDeck,
  recordKey,
  seenShare,
  type Progress,
} from "@/src/progress/progress";
```

Then append to the end of the file:

```ts
function seenOnce(at = 1) {
  return { seen: 1, lastCorrect: true, lastSeenAt: at };
}

describe("pruneDeck", () => {
  const before: Progress = {
    version: 1,
    cards: {
      "aws-clf-c02-t1.1-01": seenOnce(),
      "aws-clf-c02-t1.1-02": seenOnce(),
      "aws-clf-c02-t2.1-06": seenOnce(),
      "nextjs-rendering-rsc-01": seenOnce(),
    },
    records: { "aws-clf-c02/SEC#classic": 7 },
    last: { route: SEC, mode: "classic" },
  };

  it("removes the history of that deck's cards that no longer exist", () => {
    const after = pruneDeck(before, "aws-clf-c02", ["aws-clf-c02-t1.1-01", "aws-clf-c02-t2.1-06"]);
    expect(Object.keys(after.cards).sort()).toEqual([
      "aws-clf-c02-t1.1-01",
      "aws-clf-c02-t2.1-06",
      "nextjs-rendering-rsc-01",
    ]);
  });

  it("keeps the history of other decks' cards", () => {
    const after = pruneDeck(before, "aws-clf-c02", ["aws-clf-c02-t1.1-01"]);
    expect(after.cards["nextjs-rendering-rsc-01"]).toEqual(seenOnce());
  });

  it("keeps the entries of the cards that still exist unchanged", () => {
    const after = pruneDeck(before, "aws-clf-c02", ["aws-clf-c02-t1.1-01", "aws-clf-c02-t1.1-02", "aws-clf-c02-t2.1-06"]);
    expect(after.cards).toEqual(before.cards);
  });

  it("does not add entries for current cards that were never seen", () => {
    const after = pruneDeck(before, "aws-clf-c02", ["aws-clf-c02-t1.1-01", "aws-clf-c02-t9.9-99"]);
    expect(after.cards["aws-clf-c02-t9.9-99"]).toBeUndefined();
  });

  it("keeps the records and the last route", () => {
    const after = pruneDeck(before, "aws-clf-c02", []);
    expect(after.records).toEqual(before.records);
    expect(after.last).toEqual(before.last);
  });

  it("does nothing for a deck with no history", () => {
    const after = pruneDeck(before, "gcp-cdl", ["gcp-cdl-01"]);
    expect(after).toEqual(before);
  });

  it("does not change the progress it is given", () => {
    const frozen = deepFreeze(structuredClone(before));
    const after = pruneDeck(frozen, "aws-clf-c02", []);
    expect(frozen).toEqual(before);
    expect(after).not.toBe(frozen);
  });
});

describe("seenShare", () => {
  it("is 0 for a deck with no cards", () => {
    expect(seenShare({ a: seenOnce() }, [])).toBe(0);
  });

  it("is 0 with no history", () => {
    expect(seenShare({}, ["a", "b"])).toBe(0);
  });

  it("is 0 with neither cards nor history", () => {
    expect(seenShare({}, [])).toBe(0);
  });

  it("is the share of the given cards seen at least once", () => {
    expect(seenShare({ a: seenOnce(), c: seenOnce() }, ["a", "b", "c", "d"])).toBe(0.5);
  });

  it("is 1 when every card has been seen", () => {
    expect(seenShare({ a: seenOnce(), b: seenOnce() }, ["a", "b"])).toBe(1);
  });

  it("ignores history of cards that are not in the list", () => {
    expect(seenShare({ a: seenOnce(), gone: seenOnce(), other: seenOnce() }, ["a", "b"])).toBe(0.5);
  });

  it("does not count an entry with a seen count of 0", () => {
    expect(seenShare({ a: { seen: 0, lastCorrect: false, lastSeenAt: 0 } }, ["a"])).toBe(0);
  });

  it("counts a card listed twice once", () => {
    expect(seenShare({ a: seenOnce() }, ["a", "a", "b"])).toBe(0.5);
  });
});
```

- [ ] **Step 17: Run the tests and watch the new ones fail**

Run: `pnpm vitest run tests/progress/progress.test.ts`

Expected: 7 tests fail with `TypeError: pruneDeck is not a function` and 8 with `TypeError: seenShare is not a function`:

```
      Tests  15 failed | 25 passed (40)
```

- [ ] **Step 18: Implement pruneDeck and seenShare**

Append to the end of `src/progress/progress.ts`:

```ts
// Drops the history of cards of this deck that are not in the deck any more.
// A card belongs to the deck when its id starts with `${deckId}-`. Records and the last route are kept.
export function pruneDeck(progress: Progress, deckId: string, cardIds: readonly string[]): Progress {
  const prefix = `${deckId}-`;
  const current = new Set(cardIds);
  const cards: Record<string, CardHistory> = {};
  for (const [id, entry] of Object.entries(progress.cards)) {
    if (id.startsWith(prefix) && !current.has(id)) continue;
    cards[id] = entry;
  }
  return { ...progress, cards, records: { ...progress.records } };
}

// The share (0 to 1) of the given cards that have been seen at least once. No cards gives 0.
export function seenShare(history: History, cardIds: readonly string[]): number {
  const ids = new Set(cardIds);
  if (ids.size === 0) return 0;
  let seen = 0;
  for (const id of ids) {
    const entry = Object.hasOwn(history, id) ? history[id] : undefined;
    if (entry !== undefined && entry.seen > 0) seen += 1;
  }
  return seen / ids.size;
}
```

- [ ] **Step 19: Run the tests and watch them pass**

Run: `pnpm vitest run tests/progress/progress.test.ts`

Expected:

```
 Test Files  1 passed (1)
      Tests  40 passed (40)
```

- [ ] **Step 20: Commit**

```bash
git add src/progress/progress.ts tests/progress/progress.test.ts
git commit -m "feat: prune vanished cards of a deck and compute the seen share"
```

- [ ] **Step 21: Write the failing tests for reading stored progress**

In `tests/progress/progress.test.ts`, in the multi-line import from `@/src/progress/progress`, add `parseProgress,` on its own line between `emptyProgress,` and `pruneDeck,`, so the import reads:

```ts
import {
  applyResult,
  emptyProgress,
  parseProgress,
  pruneDeck,
  recordKey,
  seenShare,
  type Progress,
} from "@/src/progress/progress";
```

Then append to the end of the file:

```ts
describe("parseProgress", () => {
  const stored: Progress = {
    version: 1,
    cards: {
      "aws-clf-c02-t1.1-01": { seen: 3, lastCorrect: false, lastSeenAt: 1_790_000_000_000 },
      "aws-clf-c02-t2.1-06": { seen: 1, lastCorrect: true, lastSeenAt: 1_790_000_100_000 },
    },
    records: { "aws-clf-c02/SEC#classic": 8 },
    last: { route: SEC, mode: "classic" },
  };
  const empty = emptyProgress();

  it("reads back what was stored", () => {
    expect(parseProgress(JSON.stringify(stored))).toEqual(stored);
  });

  it("reads a progress with no last route", () => {
    const fresh = { ...stored, last: null };
    expect(parseProgress(JSON.stringify(fresh))).toEqual(fresh);
  });

  it("gives empty progress for null (nothing stored yet)", () => {
    expect(parseProgress(null)).toEqual(empty);
  });

  it("gives empty progress for an empty string", () => {
    expect(parseProgress("")).toEqual(empty);
  });

  it("gives empty progress for invalid JSON", () => {
    expect(parseProgress("{not json")).toEqual(empty);
    expect(parseProgress(JSON.stringify(stored).slice(0, 40))).toEqual(empty);
  });

  it("gives empty progress for valid JSON that is not an object", () => {
    expect(parseProgress("null")).toEqual(empty);
    expect(parseProgress("42")).toEqual(empty);
    expect(parseProgress('"progress"')).toEqual(empty);
    expect(parseProgress("[]")).toEqual(empty);
  });

  it("gives empty progress for an object of the wrong shape", () => {
    expect(parseProgress("{}")).toEqual(empty);
    expect(parseProgress(JSON.stringify({ ...stored, cards: [] }))).toEqual(empty);
    expect(parseProgress(JSON.stringify({ ...stored, records: { "aws-clf-c02/SEC#classic": "8" } }))).toEqual(empty);
    expect(
      parseProgress(JSON.stringify({ ...stored, cards: { a: { seen: "1", lastCorrect: true, lastSeenAt: 1 } } })),
    ).toEqual(empty);
    expect(parseProgress(JSON.stringify({ ...stored, last: { route: SEC } }))).toEqual(empty);
  });

  it("gives empty progress for impossible values", () => {
    expect(
      parseProgress(JSON.stringify({ ...stored, cards: { a: { seen: -1, lastCorrect: true, lastSeenAt: 1 } } })),
    ).toEqual(empty);
    expect(
      parseProgress(JSON.stringify({ ...stored, cards: { a: { seen: 1.5, lastCorrect: true, lastSeenAt: 1 } } })),
    ).toEqual(empty);
    expect(parseProgress(JSON.stringify({ ...stored, records: { "aws-clf-c02/SEC#classic": -3 } }))).toEqual(empty);
    expect(parseProgress(JSON.stringify({ ...stored, last: { route: SEC, mode: "zen" } }))).toEqual(empty);
    expect(parseProgress(JSON.stringify({ ...stored, last: { route: { deckId: "", sectionId: "SEC" }, mode: "classic" } }))).toEqual(empty);
  });

  it("gives empty progress for a missing version", () => {
    const { version: _version, ...withoutVersion } = stored;
    expect(parseProgress(JSON.stringify(withoutVersion))).toEqual(empty);
  });

  it("gives empty progress for a future version", () => {
    expect(parseProgress(JSON.stringify({ ...stored, version: 2 }))).toEqual(empty);
  });

  it("gives empty progress for a version stored as a string", () => {
    expect(parseProgress(JSON.stringify({ ...stored, version: "1" }))).toEqual(empty);
  });

  it("keeps the data and drops unknown fields", () => {
    const withExtras = {
      ...stored,
      theme: "night",
      cards: { "aws-clf-c02-t1.1-01": { seen: 3, lastCorrect: false, lastSeenAt: 5, flagged: true } },
      last: { route: { ...SEC, label: "Security" }, mode: "classic", at: 9 },
    };
    expect(parseProgress(JSON.stringify(withExtras))).toEqual({
      version: 1,
      cards: { "aws-clf-c02-t1.1-01": { seen: 3, lastCorrect: false, lastSeenAt: 5 } },
      records: { "aws-clf-c02/SEC#classic": 8 },
      last: { route: SEC, mode: "classic" },
    });
  });

  it("does not let a __proto__ key in stored data change any prototype", () => {
    const raw =
      '{"version":1,"cards":{"__proto__":{"seen":1,"lastCorrect":true,"lastSeenAt":1}},"records":{"__proto__":3},"last":null}';
    const parsed = parseProgress(raw);
    expect(Object.getPrototypeOf(parsed.cards)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(parsed.records)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>)["seen"]).toBeUndefined();
  });

  it("never throws, whatever it is given", () => {
    for (const raw of ["", " ", "{", "undefined", "NaN", "true", '{"version":1}', "\u0000"]) {
      expect(() => parseProgress(raw)).not.toThrow();
    }
  });

  it("returns a fresh empty progress each time", () => {
    const first = parseProgress(null);
    first.records["x"] = 1;
    expect(parseProgress(null)).toEqual(empty);
  });
});
```

- [ ] **Step 22: Run the tests and watch the new ones fail**

Run: `pnpm vitest run tests/progress/progress.test.ts`

Expected: the 15 new tests fail with `TypeError: parseProgress is not a function`:

```
      Tests  15 failed | 40 passed (55)
```

- [ ] **Step 23: Implement parseProgress**

In `src/progress/progress.ts`, add this line as the first import, above `import { routeKey, type Route } from "@/src/content/schema";`:

```ts
import { z } from "zod";
```

Then append to the end of the file:

```ts
// The stored shape. Unknown fields are dropped; any other difference makes the whole value invalid.
const MODES = ["classic", "streak", "lives", "timed"] as const satisfies readonly Mode[];

const CardHistorySchema = z.object({
  seen: z.number().int().nonnegative(),
  lastCorrect: z.boolean(),
  lastSeenAt: z.number().nonnegative(),
});

const ProgressSchema = z.object({
  version: z.literal(1),
  cards: z.record(z.string(), CardHistorySchema),
  records: z.record(z.string(), z.number().int().nonnegative()),
  last: z
    .object({
      route: z.object({ deckId: z.string().min(1), sectionId: z.string().min(1) }),
      mode: z.enum(MODES),
    })
    .nullable(),
});

// Never throws: nothing stored, invalid JSON, the wrong shape or another version all give empty progress.
export function parseProgress(raw: string | null): Progress {
  if (raw === null) return emptyProgress();
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return emptyProgress();
  }
  const parsed = ProgressSchema.safeParse(data);
  return parsed.success ? parsed.data : emptyProgress();
}
```

- [ ] **Step 24: Run the tests and the type check**

Run: `pnpm vitest run tests/progress/progress.test.ts`

Expected:

```
 Test Files  1 passed (1)
      Tests  55 passed (55)
```

Run: `pnpm typecheck`

Expected: `tsc --noEmit` prints no errors.

- [ ] **Step 25: Commit**

```bash
git add src/progress/progress.ts tests/progress/progress.test.ts
git commit -m "feat: read stored progress, falling back to empty on anything invalid"
```

- [ ] **Step 26: Write the failing tests for the local store**

Create `tests/progress/local.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createLocalStore, PROGRESS_KEY } from "@/src/progress/local";
import { emptyProgress, type Progress } from "@/src/progress/progress";

// A small stand-in for window.localStorage that behaves like the real one: strings in, strings out.
class MemoryStorage implements Pick<Storage, "getItem" | "setItem"> {
  readonly items = new Map<string, string>();
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.items.set(key, String(value));
  }
}

const played: Progress = {
  version: 1,
  cards: { "aws-clf-c02-t2.1-06": { seen: 2, lastCorrect: true, lastSeenAt: 1_790_000_000_000 } },
  records: { "aws-clf-c02/SEC#classic": 7 },
  last: { route: { deckId: "aws-clf-c02", sectionId: "SEC" }, mode: "classic" },
};

describe("PROGRESS_KEY", () => {
  it("is one versioned key", () => {
    expect(PROGRESS_KEY).toBe("truthy.progress.v1");
  });
});

describe("createLocalStore with a working storage", () => {
  it("loads empty progress when nothing has been stored", () => {
    expect(createLocalStore(new MemoryStorage()).load()).toEqual(emptyProgress());
  });

  it("saves under PROGRESS_KEY as JSON", () => {
    const storage = new MemoryStorage();
    createLocalStore(storage).save(played);
    expect(JSON.parse(storage.items.get(PROGRESS_KEY) ?? "null")).toEqual(played);
  });

  it("round-trips progress through the storage", () => {
    const storage = new MemoryStorage();
    createLocalStore(storage).save(played);
    expect(createLocalStore(storage).load()).toEqual(played);
  });

  it("loads what the latest save wrote", () => {
    const storage = new MemoryStorage();
    const store = createLocalStore(storage);
    store.save(played);
    store.save(emptyProgress());
    expect(store.load()).toEqual(emptyProgress());
  });

  it("loads empty progress when the stored value is corrupt", () => {
    const storage = new MemoryStorage();
    storage.setItem(PROGRESS_KEY, "{corrupt");
    expect(createLocalStore(storage).load()).toEqual(emptyProgress());
  });

  it("returns a copy, so changing the loaded value does not change what is stored", () => {
    const storage = new MemoryStorage();
    const store = createLocalStore(storage);
    store.save(played);
    const loaded = store.load();
    loaded.records["aws-clf-c02/SEC#classic"] = 0;
    expect(store.load()).toEqual(played);
  });

  it("does not touch other keys", () => {
    const storage = new MemoryStorage();
    storage.setItem("truthy.deck.aws-clf-c02", "deck");
    createLocalStore(storage).save(played);
    expect(storage.items.get("truthy.deck.aws-clf-c02")).toBe("deck");
  });
});

describe("createLocalStore without a usable storage", () => {
  it("loads empty progress and ignores saves when there is no storage", () => {
    const store = createLocalStore(undefined);
    expect(store.load()).toEqual(emptyProgress());
    expect(() => store.save(played)).not.toThrow();
    expect(store.load()).toEqual(emptyProgress());
  });

  it("loads empty progress when getItem throws", () => {
    const storage = new MemoryStorage();
    storage.getItem = () => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    };
    expect(() => createLocalStore(storage).load()).not.toThrow();
    expect(createLocalStore(storage).load()).toEqual(emptyProgress());
  });

  it("does not throw when setItem throws because the storage is full", () => {
    const storage = new MemoryStorage();
    storage.setItem = () => {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    };
    expect(() => createLocalStore(storage).save(played)).not.toThrow();
  });

  it("keeps the previously stored progress when a save fails", () => {
    const storage = new MemoryStorage();
    const store = createLocalStore(storage);
    store.save(played);
    storage.setItem = () => {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    };
    store.save(emptyProgress());
    expect(store.load()).toEqual(played);
  });
});
```

- [ ] **Step 27: Run the tests and watch them fail**

Run: `pnpm vitest run tests/progress/local.test.ts`

Expected:

```
 FAIL  tests/progress/local.test.ts [ tests/progress/local.test.ts ]
Error: Cannot find package '@/src/progress/local' imported from .../tests/progress/local.test.ts
 Test Files  1 failed (1)
      Tests  no tests
```

- [ ] **Step 28: Implement the local store**

Create `src/progress/local.ts`:

```ts
// The progress store on the device: one versioned key in localStorage (spec section 7).
// Storage that is missing, blocked, full or corrupt never reaches the player: load gives
// empty progress and save does nothing.

import { emptyProgress, parseProgress, type Progress } from "./progress";

export const PROGRESS_KEY = "truthy.progress.v1";

export interface ProgressStore {
  load(): Progress;
  save(progress: Progress): void;
}

export function createLocalStore(storage: Pick<Storage, "getItem" | "setItem"> | undefined): ProgressStore {
  return {
    load() {
      if (storage === undefined) return emptyProgress();
      try {
        return parseProgress(storage.getItem(PROGRESS_KEY));
      } catch {
        return emptyProgress();
      }
    },
    save(progress) {
      if (storage === undefined) return;
      try {
        storage.setItem(PROGRESS_KEY, JSON.stringify(progress));
      } catch {
        // Full or blocked storage: play goes on, this round is simply not remembered.
      }
    },
  };
}
```

- [ ] **Step 29: Run the tests and watch them pass**

Run: `pnpm vitest run tests/progress/local.test.ts`

Expected:

```
 Test Files  1 passed (1)
      Tests  12 passed (12)
```

- [ ] **Step 30: Commit**

```bash
git add src/progress/local.ts tests/progress/local.test.ts
git commit -m "feat: keep progress in localStorage without ever throwing at the player"
```

- [ ] **Step 31: Pin the review focus cases for applyResult**

These cases come from the review focus section at the end of this task: a card answered twice in one round (the unbounded modes of step 2 continue with cards already dealt), and a first finished round with no correct answers. Append to the end of `tests/progress/progress.test.ts`:

```ts
describe("applyResult: review focus", () => {
  it("counts a card answered twice in one round twice, keeping the later answer", () => {
    const round = result([answered("c1", true, 100), answered("c2", true, 150), answered("c1", false, 200)]);
    const { progress } = applyResult(emptyProgress(), round);
    expect(progress.cards["c1"]).toEqual({ seen: 2, lastCorrect: false, lastSeenAt: 200 });
  });

  it("sets a first record of 0 for a finished round with no correct answers", () => {
    const outcome = applyResult(emptyProgress(), scored(0));
    expect(outcome.progress.records).toEqual({ "aws-clf-c02/SEC#classic": 0 });
    expect(outcome.previousBest).toBeNull();
    expect(outcome.isNewBest).toBe(true);
  });

  it("does not let a later 0 replace a record of 0", () => {
    const outcome = applyResult(withRecord(SEC, 0), scored(0));
    expect(outcome.previousBest).toBe(0);
    expect(outcome.isNewBest).toBe(false);
  });
});
```

- [ ] **Step 32: Run the tests and confirm they pass as they are**

Run: `pnpm vitest run tests/progress/progress.test.ts`

Expected: these tests pin behaviour that steps 8 and 13 already implement, so they pass straight away:

```
 Test Files  1 passed (1)
      Tests  58 passed (58)
```

If one of them fails, the implementation from steps 8 or 13 was changed: restore it rather than the test.

- [ ] **Step 33: Commit**

```bash
git add tests/progress/progress.test.ts
git commit -m "test: pin repeated cards and zero scores in applyResult"
```

- [ ] **Step 34: Write the failing tests for reaching window.localStorage safely**

In `tests/progress/local.test.ts`, replace the first two import lines with:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { browserLocalStorage, createLocalStore, PROGRESS_KEY } from "@/src/progress/local";
```

Then append to the end of the file:

```ts
describe("browserLocalStorage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is undefined where there is no window, as during prerendering", () => {
    expect(typeof window).toBe("undefined");
    expect(browserLocalStorage()).toBeUndefined();
  });

  it("is the window's localStorage when it can be reached", () => {
    const storage = new MemoryStorage();
    vi.stubGlobal("window", { localStorage: storage });
    expect(browserLocalStorage()).toBe(storage);
  });

  it("is undefined when reading window.localStorage throws, as with blocked site data", () => {
    vi.stubGlobal("window", {
      get localStorage(): Storage {
        throw new DOMException("The operation is insecure.", "SecurityError");
      },
    });
    expect(() => browserLocalStorage()).not.toThrow();
    expect(browserLocalStorage()).toBeUndefined();
  });

  it("gives a store that still works when the storage is blocked", () => {
    vi.stubGlobal("window", {
      get localStorage(): Storage {
        throw new DOMException("The operation is insecure.", "SecurityError");
      },
    });
    const store = createLocalStore(browserLocalStorage());
    expect(store.load()).toEqual(emptyProgress());
    expect(() => store.save(played)).not.toThrow();
  });
});
```

- [ ] **Step 35: Run the tests and watch the new ones fail**

Run: `pnpm vitest run tests/progress/local.test.ts`

Expected: the 4 new tests fail with `TypeError: browserLocalStorage is not a function`:

```
      Tests  4 failed | 12 passed (16)
```

- [ ] **Step 36: Implement browserLocalStorage**

Append to the end of `src/progress/local.ts`:

```ts
// window.localStorage, or undefined where it cannot be used: no window (prerendering), or a
// browser that throws on reading the property because site data is blocked.
export function browserLocalStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}
```

- [ ] **Step 37: Run all progress tests and the type check**

Run: `pnpm vitest run tests/progress`

Expected:

```
 Test Files  2 passed (2)
      Tests  74 passed (74)
```

Run: `pnpm typecheck`

Expected: `tsc --noEmit` prints no errors.

- [ ] **Step 38: Commit**

```bash
git add src/progress/local.ts tests/progress/local.test.ts
git commit -m "feat: reach window.localStorage without throwing when site data is blocked"
```

- [ ] **Step 38a: Write the failing tests for the score of the last round**

The continue line of the start flow (task 10, design system 5.4a) reads "last 7 of 10", so `last` also keeps the score and the total of a finished round. A round that was left keeps its route but no score (`null`), and progress stored before this change, whose `last` has no score, still reads (as a round without a score).

In `tests/progress/progress.test.ts`, replace the whole `describe("applyResult: last route", ...)` block with:

```ts
describe("applyResult: last route", () => {
  it("sets the last route and mode, with the score of a finished round", () => {
    const { progress } = applyResult(emptyProgress(), result([answered("c1", true, 1)]));
    expect(progress.last).toEqual({ route: SEC, mode: "classic", score: 1, total: 1 });
  });

  it("keeps the score and the total of the round: 7 of 10", () => {
    const { progress } = applyResult(emptyProgress(), scored(7));
    expect(progress.last).toEqual({ route: SEC, mode: "classic", score: 7, total: 10 });
  });

  it("replaces an earlier last route and its score", () => {
    const before: Progress = { ...emptyProgress(), last: { route: CON, mode: "classic", score: 9, total: 10 } };
    const { progress } = applyResult(before, result([answered("c1", true, 1)], { route: SEC }));
    expect(progress.last).toEqual({ route: SEC, mode: "classic", score: 1, total: 1 });
  });

  it("sets the last route even for an abandoned round, without a score", () => {
    const { progress } = applyResult(emptyProgress(), result([answered("c1", true, 1)], { abandoned: true }));
    expect(progress.last).toEqual({ route: SEC, mode: "classic", score: null, total: null });
  });

  it("does not share the route object with the result", () => {
    const round = result([answered("c1", true, 1)]);
    const { progress } = applyResult(emptyProgress(), round);
    expect(progress.last?.route).not.toBe(round.route);
  });
});
```

(`scored` is the function declaration further down the file, so it can be used here.)

In the same file, give the three `Progress` fixtures that have a `last` route a score. In `describe("applyResult: purity", ...)`:

```ts
      last: { route: CON, mode: "classic", score: 3, total: 10 },
```

in place of `last: { route: CON, mode: "classic" },`; in `describe("pruneDeck", ...)`'s `before`:

```ts
    last: { route: SEC, mode: "classic", score: 7, total: 10 },
```

and in `describe("parseProgress", ...)`'s `stored`:

```ts
    last: { route: SEC, mode: "classic", score: 8, total: 10 },
```

each in place of `last: { route: SEC, mode: "classic" },`.

In `describe("parseProgress", ...)`, add two tests directly after "reads a progress with no last route":

```ts

  it("reads the last route of an abandoned round, which has no score", () => {
    const abandoned = { ...stored, last: { route: SEC, mode: "classic", score: null, total: null } };
    expect(parseProgress(JSON.stringify(abandoned))).toEqual(abandoned);
  });

  it("reads a last route stored before scores were kept as one without a score", () => {
    const older = { ...stored, last: { route: SEC, mode: "classic" } };
    expect(parseProgress(JSON.stringify(older))).toEqual({ ...stored, last: { route: SEC, mode: "classic", score: null, total: null } });
  });
```

add three lines at the end of "gives empty progress for impossible values", after the line with `deckId: ""`:

```ts
    expect(parseProgress(JSON.stringify({ ...stored, last: { route: SEC, mode: "classic", score: -1, total: 10 } }))).toEqual(empty);
    expect(parseProgress(JSON.stringify({ ...stored, last: { route: SEC, mode: "classic", score: 7, total: 9.5 } }))).toEqual(empty);
    expect(parseProgress(JSON.stringify({ ...stored, last: { route: SEC, mode: "classic", score: "7", total: 10 } }))).toEqual(empty);
```

and in "keeps the data and drops unknown fields", whose stored `last` has no score, expect it without one:

```ts
      last: { route: SEC, mode: "classic", score: null, total: null },
```

in place of the expected `last: { route: SEC, mode: "classic" },`.

In `tests/progress/local.test.ts`, the `played` fixture's last line becomes:

```ts
  last: { route: { deckId: "aws-clf-c02", sectionId: "SEC" }, mode: "classic", score: 7, total: 10 },
```

- [ ] **Step 38b: Run the tests and watch the new ones fail**

Run: `pnpm vitest run tests/progress`

Expected: `Tests  12 failed | 65 passed (77)`. The failures are the four tests of "applyResult: last route" that expect a score, "reads back what was stored", the two new parse tests, "gives empty progress for impossible values" and "keeps the data and drops unknown fields" in `progress.test.ts`, and three tests of `local.test.ts` that compare a loaded value with `played` ("round-trips progress through the storage", "returns a copy, so changing the loaded value does not change what is stored", "keeps the previously stored progress when a save fails"): the parser does not know `score` and `total` yet and drops them.

- [ ] **Step 38c: Keep the score in last**

In `src/progress/progress.ts`, the `last` field of `Progress` becomes:

```ts
  // The last round played. score and total are null for an abandoned round and for a last route stored
  // before scores were kept.
  last: { route: Route; mode: Mode; score: number | null; total: number | null } | null;
```

The first two lines of the comment above `applyResult` become:

```ts
// Records the answers of a round in the card history, remembers its route and mode (and its score
// when it was finished), and sets the record for that route and mode when a finished round beats it.
```

and the `last` it returns becomes:

```ts
      last: {
        route: { deckId: result.route.deckId, sectionId: result.route.sectionId },
        mode: result.mode,
        score: result.abandoned ? null : result.score,
        total: result.abandoned ? null : result.total,
      },
```

In `ProgressSchema`, the `last` object gains two fields after `mode`:

```ts
  last: z
    .object({
      route: z.object({ deckId: z.string().min(1), sectionId: z.string().min(1) }),
      mode: z.enum(MODES),
      // Missing in progress stored before scores were kept: it reads as a round without a score.
      score: z.number().int().nonnegative().nullable().default(null),
      total: z.number().int().nonnegative().nullable().default(null),
    })
    .nullable(),
```

`default(null)` fills a missing field; `null` itself and whole non-negative numbers pass; anything else makes the whole value invalid, as before.

- [ ] **Step 38d: Run all progress tests and the type check**

Run: `pnpm vitest run tests/progress`

Expected:

```
 Test Files  2 passed (2)
      Tests  77 passed (77)
```

Run: `pnpm typecheck`

Expected: `tsc --noEmit` prints no errors.

- [ ] **Step 38e: Commit**

```bash
git add src/progress/progress.ts tests/progress/progress.test.ts tests/progress/local.test.ts
git commit -m "feat: keep the score of the last round for the continue line"
```

#### Review focus candidates

Inputs the spec implies, that a player can hit, and that the first six slices did not cover. Each now has tests:

1. **The same card answered twice in one round.** Spec section 6: the unbounded modes, once every card of the route has been dealt, "continue with the cards seen longest ago", so one `RoundResult` can hold two answers for one card. History must count both and keep the later verdict. Covered by step 31 ("counts a card answered twice in one round twice, keeping the later answer").
2. **A first finished round that scores 0.** A player who misses all ten still finishes the round, and the next attempt needs something to compare against. The record is set to 0 with `previousBest: null` and `isNewBest: true` (the result screen should show "first record" rather than a "New best" celebration when `previousBest` is null), and a later 0 is not a new best. Covered by step 31 ("sets a first record of 0 ..." and "does not let a later 0 replace a record of 0").
3. **Site data blocked in the browser.** Spec section 10: "Storage unavailable ... play continues". In Safari and Firefox with cookies and site data blocked, reading `window.localStorage` itself throws a `SecurityError`, before `createLocalStore` can guard anything. `browserLocalStorage()` absorbs that and the store then behaves as empty. Covered by steps 34 to 37 (the `browserLocalStorage` tests, including "gives a store that still works when the storage is blocked").
