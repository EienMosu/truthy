### Task 3: One of each: the mode table, the helpers, the services

Step 1's final review left duplicates that every mode task would otherwise copy a third time or work around: two mode lists, three session-storage readers, two route lookups, three `pad2`, six copies of the easing curve, the abandon-and-save line twice, two places that decide "new best", and a `PlayServices` that repeats `AppServices` (Timed adds members to it in task 10). This task removes them and splits "the engine can play this mode" from "the class step offers this mode". Behaviour on screen does not change; one thing is added: a load failure that is not a network failure is logged.

It is seven small refactors. Do them in the order below, one commit each, running the named test files after each.

**Files:**
- Create: `src/app-state/modes.ts`, `components/format.ts`, `components/easing.ts`, `components/play/leave.ts`
- Modify: `src/app-state/pending.ts`, `src/content/schema.ts`, `src/progress/progress.ts`, `components/play/useRound.ts`, `components/play/PlayScreen.tsx`, `components/play/ResultView.tsx`, `components/play/LeaveDialog.tsx`, `components/start/StartFlow.tsx`, `components/start/useCatalog.ts`, `components/ScoreBlock.tsx`, `components/Stamp.tsx`, `components/BoardingPass.tsx`, `components/FillInPass.tsx`, `components/MissedCards.tsx`
- Test: create `tests/app-state/modes.test.ts`, `tests/components/play/leave.test.ts`; modify `tests/progress/progress.test.ts`, `tests/components/ScoreBlock.test.tsx`, `tests/components/start/useCatalog.test.tsx`, `tests/components/play/useRound.test.tsx`

**Interfaces:**
- Consumes (as in the code today):
  - `src/engine/round.ts`: `AVAILABLE_MODES: readonly Mode[]` (`["classic"]`), `reduce`, `summarise`, `type RoundState`.
  - `src/app-state/services.ts`: `interface AppServices { fetcher: Fetcher; localStorage: () => ReadWriteStorage | undefined; sessionStorage: () => ReadWriteStorage | undefined }`, `browserAppServices`, `browserSessionStorage(): Storage | undefined`, `browserBackToStart(): boolean`.
  - `components/start/StartFlow.tsx`: `interface ModeOption { id; name; description; unit }`, `MODE_OPTIONS` (lines 92 to 105), used at lines 138, 586 and 698 to 715.
  - `components/play/useRound.ts`: `MODE_LABELS`, `locateRoute(index, pending): { deck; ticket } | null`, `interface TicketInfo { deckCode; deckName; sectionCode; sectionName; modeLabel }`.
  - `components/start/useCatalog.ts`: `findRoute(index: DeckIndex, route: Route): RouteInIndex | null`, `interface RouteInIndex { area; platform; deck; section: IndexDeck["sections"][number] | null }`, `bestFor(progress, route, mode): number | null`.
  - `components/ScoreBlock.tsx`: `type Comparison`, `compareWithBest(score: number, previousBest: number | null): Comparison`.
  - `src/content/load.ts`: `class LoadError extends Error`.
  - `src/progress/local.ts`: `interface ProgressStore { load(): Progress; save(progress: Progress): void }`.
- Produces:

```ts
// src/app-state/modes.ts
import type { Mode } from "@/src/content/play";

export interface ModeInfo {
  id: Mode;
  /** The class name: on the class card, the pass, the ticket and the continue line. */
  name: string;
  /** The rule in one sentence: on the class card and the ready pass. */
  description: string;
  /** The unit of a best on the class card: "of 10", "in a row", "cards", "correct". */
  unit: string;
  /** False: the class step shows it as "Not available yet" and it cannot be chosen or continued. */
  offered: boolean;
}

export const MODE_TABLE: readonly ModeInfo[] = [
  { id: "classic", name: "Classic", description: "10 cards, score at the end.", unit: "of 10", offered: true },
  { id: "streak", name: "Streak", description: "Keep going until the first wrong answer.", unit: "in a row", offered: false },
  { id: "lives", name: "Three lives", description: "The round ends on the third wrong answer.", unit: "cards", offered: false },
  { id: "timed", name: "Timed", description: "60 seconds, as many cards as you can.", unit: "correct", offered: false },
];

export function modeInfo(mode: Mode): ModeInfo;      // the row of the mode; throws for an unknown mode
export function isOffered(mode: Mode): boolean;      // modeInfo(mode).offered

// src/content/schema.ts (moved from components/start/useCatalog.ts, unchanged)
export interface RouteInIndex { area: IndexArea; platform: IndexPlatform; deck: IndexDeck; section: IndexDeck["sections"][number] | null }
export function findRoute(index: DeckIndex, route: Route): RouteInIndex | null;

// src/progress/progress.ts (moved from components/ScoreBlock.tsx and components/start/useCatalog.ts, unchanged)
export type Comparison =
  | { kind: "first" }
  | { kind: "new-best"; previousBest: number }
  | { kind: "equal"; best: number }
  | { kind: "short"; best: number; by: number };
export function compareWithBest(score: number, previousBest: number | null): Comparison;
export function bestFor(progress: Progress, route: Route, mode: Mode): number | null;

// components/format.ts
export function pad2(n: number): string;             // String(n).padStart(2, "0")

// components/easing.ts: the curves of tokens.json "motion.easing" as Motion wants them
export const EASE = [0.2, 0.7, 0.2, 1] as const;
export const EASE_OUT = [0, 0, 0.58, 1] as const;
export const EASE_IN = [0.42, 0, 1, 1] as const;
export const FALL = [0.5, 0, 0.9, 0.4] as const;
export const SPRING_EASE = [0.34, 1.56, 0.64, 1] as const;
/** A stamp at rest and where it lands from (design system 7, "Stamp lands"). */
export const STAMP_REST = { opacity: 1, scale: 1, rotate: -6 };
export const STAMP_LANDING = { opacity: 0, scale: 1.9, rotate: -14 };

// components/play/leave.ts
/** Saves a round the player is leaving: its answers go into the card history, it sets no record. */
export function saveLeftRound(round: RoundState, store: ProgressStore): void;

// components/play/useRound.ts
export interface PlayServices extends AppServices {
  now: () => number;
  randomSeed: () => number;
  backToStart?: () => boolean;
}
export function ticketFor(found: RouteInIndex, mode: Mode): TicketInfo;   // replaces locateRoute
```

  - Removed: `MODE_OPTIONS` and `ModeOption` (StartFlow), `MODE_LABELS` and `locateRoute` (useRound), the private `browserSessionStorage` (useRound) and `sessionStore` (pending), every private `pad2`, `EASE`, `EASE_OUT`, `REST`, `LANDING`, and `SPRING_EASE` in `components/Stamp.tsx` (now in `components/easing.ts`).
  - Unchanged and still exported from the engine: `AVAILABLE_MODES`. From this task on it means only "the engine can play it" (`startRound` and `readPending` use it). The start flow asks `isOffered`.

**Rules:**

1. `modeInfo` returns the row whose `id` is the mode and throws `Unknown mode "<mode>".` otherwise. The table order is the order of the class cards: Classic, Streak, Three lives, Timed. The four names, descriptions and units are exactly the strings above (they are the strings of `MODE_OPTIONS` today).
2. `StartFlow.tsx` reads the table: `resolve` accepts a mode only when `isOffered` (line 138); the class step (lines 698 to 715) maps `MODE_TABLE` with `available = mode.offered`; the continue line's label (line 586) is `modeInfo(returning.mode).name`. `Resolved.mode` becomes `ModeInfo`. `useCatalog.ts` `continueTarget` returns null when `!isOffered(last.mode)` (line 115). Neither file imports `AVAILABLE_MODES` any more.
3. `pending.ts` uses `browserSessionStorage` from `@/src/app-state/services` as the default argument of `savePending` and `readPending`; `useRound.ts` imports the same function. `services.ts` does not import `pending.ts`, so there is no cycle.
4. `browserPlayServices` is `{ ...browserAppServices, now: () => Date.now(), backToStart: browserBackToStart, randomSeed: () => crypto.getRandomValues(new Uint32Array(1))[0] ?? 0 }`. The comments on `now`, `randomSeed` and `backToStart` stay.
5. `findRoute` and `RouteInIndex` move to `src/content/schema.ts` with their bodies unchanged. `prepareRound` becomes: `const found = findRoute(index, pending.route); if (found === null) return null;` then `loadDeck(found.deck, ...)`, and the ticket is `ticketFor(found, pending.mode)`. `ticketFor` builds: `deckCode: found.deck.code`, `deckName: deckPassName(found.platform, found.deck)`, `sectionCode: found.section?.id ?? WHOLE_DECK`, `sectionName: found.section?.title ?? "Whole deck"`, `modeLabel: modeInfo(mode).name`.
6. `bestFor` moves to `src/progress/progress.ts` unchanged; `applyResult` uses it for `previousBest`. `compareWithBest` and `Comparison` move there too, and `applyResult` decides with it: `const comparison = compareWithBest(result.score, previousBest); const isNewBest = !result.abandoned && (comparison.kind === "first" || comparison.kind === "new-best");`. `ScoreBlock.tsx` imports `type Comparison` from the progress; `ResultView.tsx` imports `compareWithBest` from the progress; `StartFlow.tsx` imports `bestFor` from `@/src/progress/progress` (today it comes from `./useCatalog`, in the import that also brings `continueTarget`, `deckCount`, `decksLabel`, `seenPercent` and `useCatalog`, which stay). `useCatalog.ts` does not use `bestFor` itself and no longer has it.
7. `saveLeftRound(round, store)` is today's line: `store.save(applyResult(store.load(), summarise(reduce(round, { type: "abandon" }))).progress);`. `PlayScreen.tsx` calls it in the unmount cleanup (line 101) and in `leave` (line 115); the conditions around the two calls do not change.
8. Every private copy of `pad2` and of the curves is replaced by the import: `pad2` in `PlayScreen.tsx`, `ResultView.tsx`, `MissedCards.tsx`; `EASE` in `PlayScreen.tsx`, `LeaveDialog.tsx`, `StartFlow.tsx`, `FillInPass.tsx` (only its `EASE` constant: the opacity fix for Safari that came in from `main` stays as it is); `EASE_OUT` in `StartFlow.tsx`; the literals in `BoardingPass.tsx` (line 56 `EASE`, line 254 `EASE`, line 261 `FALL`, line 262 `EASE_IN`); `SPRING_EASE`, `REST`, `LANDING` in `Stamp.tsx` and `ScoreBlock.tsx` (`STAMP_REST`, `STAMP_LANDING`). `e2e/helpers.ts` keeps its own `pad2` (the specs do not import components).
9. Load failures: the rejection handler of `prepareRound` in `useRound` (line 170) receives the reason. A `LoadError` sets the message as today. Anything else is a bug in dealing or pruning, not the network: it is logged with `console.error(reason)` and the same `LOAD_FAILED_MESSAGE` is shown (the screen has no second message).

**Tests:**

`tests/app-state/modes.test.ts` (node), new:
- "lists the four classes in the order of the class step, with their exact copy": `MODE_TABLE.map((m) => [m.id, m.name, m.description, m.unit])` equals the four rows above.
- "offers only Classic until the other classes are built": `MODE_TABLE.filter((m) => m.offered).map((m) => m.id)` equals `["classic"]`; `isOffered("classic")` true, `isOffered("timed")` false.
- "modeInfo gives the row of a mode and throws for a mode it does not know": `modeInfo("lives").name` is "Three lives"; `modeInfo("blitz" as Mode)` throws `/Unknown mode/`.
- "has a row for every mode": `MODE_TABLE.map((m) => m.id)` equals `[...MODES]`.

`tests/components/start/useCatalog.test.tsx`: the cases stay where they are (they use the start fixtures' `INDEX`); only the imports change: `findRoute` from `@/src/content/schema`, `bestFor` from `@/src/progress/progress`.

`tests/progress/progress.test.ts`: move the `describe("compareWithBest")` block of `tests/components/ScoreBlock.test.tsx` (lines 12 to 29) here unchanged. Add: "applyResult and compareWithBest agree: a new best exactly when the comparison is first or new-best", for scores 0, 6, 7, 8 against a stored record of 7 and against no record.

`tests/components/play/leave.test.ts` (node), new, with the play fixtures `DECK`, `memoryStorage` and a Classic round of `startRound` with two answers given:
- "keeps the answers in the card history, remembers the route without a score and sets no record": after `saveLeftRound`, the stored progress has `seen: 1` for the two answered cards, `records` is `{}`, `last` is `{ route, mode: "classic", score: null, total: null }`.
- "does not throw when the store cannot save": a storage whose `setItem` throws.

`tests/components/play/useRound.test.tsx`:
- Replace `describe("locateRoute: ...")` by `describe("ticketFor: the deck name on the ticket")` with the same two cases on `ticketFor(found, "classic")`, where `found` is `findRoute(INDEX, { deckId: DECK_ID, sectionId: "SEC" })`.
- "shows the load message for a network failure without logging": network offline, no cache; status is `{ kind: "error", message: LOAD_FAILED_MESSAGE }` and a `vi.spyOn(console, "error")` was not called.
- "logs a failure that is not a load failure and still shows the message": `harness()` with `services.randomSeed = () => { throw new Error("no entropy"); }`; status becomes the same error, and `console.error` was called once with that error. Silence the spy with `mockImplementation(() => {})` and restore it.

`tests/components/play/fixtures.ts`: no change needed (its `services` object already has both storage methods and fits `PlayServices extends AppServices`).

Everything else is covered by the existing suites, which must pass unchanged: `tests/components/start/StartFlow.test.tsx`, `tests/components/play/*.test.tsx`, `tests/app-state/pending*.test.ts`, `tests/components/Stamp.test.tsx`, `tests/components/BoardingPass.test.tsx`.

**Steps:**

- [ ] **Step 1: The mode table.** Write `tests/app-state/modes.test.ts`; run it; it fails with `Cannot find package '@/src/app-state/modes'`. Create `src/app-state/modes.ts`; run it green. Then apply rule 2 to `StartFlow.tsx` and `useCatalog.ts` and rule 5's `modeLabel` to `useRound.ts` (delete `MODE_LABELS`). Run `pnpm vitest run tests/app-state tests/components/start tests/components/play`: all pass. Commit: `refactor: one mode table for the start flow and the ticket`.
- [ ] **Step 2: One session-storage reader and one services base** (rules 3 and 4). Run `pnpm vitest run tests/app-state tests/components/play` and `pnpm typecheck`: green. Commit: `refactor: PlayServices extends AppServices and shares the session-storage reader`.
- [ ] **Step 3: One route lookup** (rule 5). Change the tests first (they fail on the missing export `findRoute` in `@/src/content/schema` and `ticketFor` in `useRound`), then move the code. Run `pnpm vitest run tests/components/start tests/components/play`: green. Commit: `refactor: one route lookup for the start flow and the ticket`.
- [ ] **Step 4: One record comparison** (rule 6). Move the tests first (they fail on the missing exports of `@/src/progress/progress`), then the code. Run `pnpm vitest run tests/progress tests/components/ScoreBlock.test.tsx tests/components/play tests/components/start`: green. Commit: `refactor: the progress module decides what a new best is`.
- [ ] **Step 5: One helper for a left round** (rule 7). Write `tests/components/play/leave.test.ts`, see it fail on the missing module, create `components/play/leave.ts`, use it in `PlayScreen.tsx`. Run `pnpm vitest run tests/components/play`: green. Commit: `refactor: one helper saves a round that is left`.
- [ ] **Step 6: Shared `pad2` and curves** (rule 8). Create `components/format.ts` and `components/easing.ts`, replace the copies, then check that none is left: `grep -rn "function pad2\|0.2, 0.7, 0.2, 1\|0.34, 1.56, 0.64, 1\|0.5, 0, 0.9, 0.4" components` prints only `components/format.ts` and `components/easing.ts`. Run `pnpm vitest run tests/components`: green. Commit: `refactor: share pad2 and the easing curves`.
- [ ] **Step 7: Logged load failures** (rule 9). Add the two tests to `useRound.test.tsx`; the second fails ("expected "error" to be called 1 times, but got 0 times"). Implement; run the file green. Commit: `fix: log a round that fails to start for a reason other than loading`.
- [ ] **Step 8: Run the gates.** `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm e2e` (port 3100 free). All green; no e2e spec changed.
