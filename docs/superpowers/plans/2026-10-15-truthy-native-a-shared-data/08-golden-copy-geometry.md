### Task 8: Golden vectors for the play copy, leaving, the result, the ticket scroll, the flight path, the headers, the barcode and the contrast pairs

The native apps share no code with the web, so everything a player reads or sees placed on a screen is checked against vectors computed by the web functions themselves. This task writes the producers for 34 entries of reference 3.9 that are not engine, progress, content or start-flow functions:

- the play screen's words: `verdictText`, `roundStatus`, `timedStatus`, `timedCardText`, `NEXT_ARRIVES_MS`, `SPOKEN_RELEASE_MS`;
- leaving a round: `leavesSomething`, `saveLeftRound`;
- the result: `resultCopy` (the words of each class), `recordRound` (once per round), `RESULT_ARRIVES_MS`, `missedCards`;
- the ticket's route words: `ticketFor`;
- the ticket's scroll arithmetic: `statementScroll`, `slipScroll`, `keyScroll`, `ARROW_STEP`;
- the flight path: `pointAt`, `waypointT`, `flownPath`, `headingAt`, `waypointStates`, `cardList`, `flightPathLabel`, `completedLabel`, `completedScale`;
- the Streak, Three lives and Timed headers: `streakLayout`, `streakLabel`, `trailLayout`, `livesLabel`, `clockText`, `timedLabel`;
- the barcode: `barcodeBars`;
- the contrast pairs of the design system, as one constant.

The producers are two group files, `copy.ts` and `geometry.ts`, each a list of small part files, so that every part is written test first. Each part test does three things. It pins the cases of the web test files by value: the expected strings and numbers are typed from `tests/components/**` and `tests/tokens/contrast.test.ts`, not read back from the producer, so a producer that drifts from the web tests fails. It replays every recorded case through the web function after decoding it, which shows the file says what a native test will be told. And the two group tests keep the file list equal to `NATIVE_FUNCTIONS` (task 4), so a function reference 3.9 lists without a vector file, or a vector file without an entry, fails.

The cards of the copy vectors are made up (37 cards in four sections of a test deck), because these functions read card fields and fixed rules, not the dealing of a shipped deck; that stays with tasks 5 and 6. The two shipped-deck facts the copy needs (a deck's pass name, a deck without sections) are in the small index of `ticketFor`.

Some rules of the web code are written inline or in unexported functions and are not on the reference 3.9 list, so they get no vector here: the radius of the ring and the scale of the wrong square on a completed route (`CompletedMarks` in `components/FlightPath.tsx`), the whole-second rounding that `clockText` and `timedLabel` share (`wholeSeconds`), the New best condition of the live region (`PlayScreen.tsx`, `newBest`), and the rule that sets the plane of the Timed header from the time left. The vectors of the functions those rules call (`completedScale`, `pointAt`, `clockText`, `timedLabel`, `verdictText`) cover the arithmetic; the rules themselves stay prose in the reference.

Builds on task 4 only: `goldenFile` and its types (`scripts/native/golden/format.ts`) and the registry (`scripts/native/registry.ts`, `NATIVE_FUNCTIONS`, `goldenProducers`). Tasks 5 to 7 add their own groups to the same registry; nothing here depends on them.

**Files:**
- Create: `scripts/native/golden/copy-fixtures.ts`, `scripts/native/golden/copy-play.ts`, `scripts/native/golden/copy-leave.ts`, `scripts/native/golden/copy-result.ts`, `scripts/native/golden/copy-ticket.ts`, `scripts/native/golden/copy.ts`
- Create: `scripts/native/golden/geometry-scroll.ts`, `scripts/native/golden/geometry-path.ts`, `scripts/native/golden/geometry-headers.ts`, `scripts/native/golden/geometry-barcode.ts`, `scripts/native/golden/geometry-contrast.ts`, `scripts/native/golden/geometry.ts`
- Create: `src/tokens/contrast.ts` (the contrast pairs, the minimums and the luminance, moved out of `tests/tokens/contrast.test.ts` so the web test and the producer read one list)
- Modify: `tests/tokens/contrast.test.ts` (imports them from `src/tokens/contrast.ts`; its 59 tests unchanged), `scripts/native/registry.ts` (`goldenProducers` gains the two groups)
- Test (create): `tests/scripts/native/golden-view.ts` (a helper, not a test), `tests/scripts/native/golden-copy-fixtures.test.ts`, `golden-copy-play.test.ts`, `golden-copy-leave.test.ts`, `golden-copy-result.test.ts`, `golden-copy-ticket.test.ts`, `golden-copy.test.ts`, `golden-geometry-scroll.test.ts`, `golden-geometry-path.test.ts`, `golden-geometry-headers.test.ts`, `golden-geometry-barcode.test.ts`, `golden-geometry-contrast.test.ts`, `golden-geometry.test.ts`, `golden-copy-geometry-registry.test.ts` (all in `tests/scripts/native/`)

**Interfaces:**
- Consumes, from task 4, exactly these names:

```ts
// scripts/native/golden/format.ts
export interface GoldenCase { name: string; input: unknown; output: unknown }
export interface GoldenMeta { module: string; function: string; source: string; tests: readonly string[] }
export interface GoldenFile { path: string; content: string }
export function goldenFile(meta: GoldenMeta, cases: readonly GoldenCase[]): GoldenFile;

// scripts/native/registry.ts
export interface NativeFunction { module: string; name: string; source: string; tests: readonly string[]; kind: "function" | "constant" }
export const NATIVE_FUNCTIONS: readonly NativeFunction[];
export function goldenProducers(): readonly (() => GoldenFile[])[];
```

  `NATIVE_FUNCTIONS` must list the 34 entries below (reference 3.9; `module` is the web file path without its extension, `source` with it). The two group tests compare against it, and a name or source that differs is a failure to settle with task 4, not to patch here.

| module | source | functions | constants |
|---|---|---|---|
| `components/play/PlayScreen` | `components/play/PlayScreen.tsx` | `verdictText`, `roundStatus`, `timedStatus`, `timedCardText` | `NEXT_ARRIVES_MS`, `SPOKEN_RELEASE_MS` |
| `components/play/leave` | `components/play/leave.ts` | `leavesSomething`, `saveLeftRound` | |
| `components/play/resultCopy` | `components/play/resultCopy.ts` | `resultCopy` | |
| `components/play/ResultView` | `components/play/ResultView.tsx` | `recordRound` | `RESULT_ARRIVES_MS` |
| `components/MissedCards` | `components/MissedCards.tsx` | `missedCards` | |
| `components/play/useRound` | `components/play/useRound.ts` | `ticketFor` | |
| `components/play/ticketScroll` | `components/play/ticketScroll.ts` | `statementScroll`, `slipScroll`, `keyScroll` | `ARROW_STEP` |
| `components/FlightPath` | `components/FlightPath.tsx` | `pointAt`, `waypointT`, `flownPath`, `headingAt`, `waypointStates`, `cardList`, `flightPathLabel`, `completedLabel`, `completedScale` | |
| `components/StreakPath` | `components/StreakPath.tsx` | `streakLayout`, `streakLabel` | |
| `components/LivesPath` | `components/LivesPath.tsx` | `trailLayout`, `livesLabel` | |
| `components/TimedPath` | `components/TimedPath.tsx` | `clockText`, `timedLabel` | |
| `components/BoardingPass` | `components/BoardingPass.tsx` | `barcodeBars` | |
| `design/system/tokens` | `design/system/tokens.json` | | `contrastPairs` |

- Consumes, from the repository, unchanged: the exported functions and constants of the web files above; `startRound`, `reduce`, `currentCard`, `scoreOf`, `TIMED` (`src/engine/round.ts`); `poolFor` (`src/content/load.ts`); `findRoute`, `DeckFileSchema` (`src/content/schema.ts`); `createLocalStore`, `PROGRESS_KEY` (`src/progress/local.ts`); `emptyProgress` (`src/progress/progress.ts`); `tokensToCss` (`src/tokens/build.ts`).
- Produces:

```ts
// scripts/native/golden/copy.ts and scripts/native/golden/geometry.ts
export function golden(): GoldenFile[];   // 13 files and 21 files

// scripts/native/registry.ts: goldenProducers() returns, among its other groups,
//   golden as copyGolden and golden as geometryGolden

// scripts/native/golden/copy-fixtures.ts
export const DECK_ID: string;             // "test-deck"
export const ROUTE: Route;                // { deckId: "test-deck", sectionId: "SEC" }
export const SEED: number;                // 12345
export const SCOPE_TEXT: string;          // the appliesTo of the SCP section
export const FIXTURE_DECK: DeckFile;      // 37 cards: SEC 12, APP 1, SCP 12, COD 12
export function startArgs(mode: Mode, sectionId?: string, seed?: number): StartArgs;
export class Played {
  readonly start: StartArgs;
  readonly events: RoundEvent[];
  state: RoundState;
  constructor(start: StartArgs);
  send(event: RoundEvent): this;          // keeps the event and reduces the state
  card(): Card;                           // the card on screen; throws when there is none
  right(at: number): this;                // answers with the card's own answer
  wrong(at: number): this;                // answers against it
  next(): this;
  tick(now: number): this;
  ticks(from: number, to: number): this;  // one tick a second, both ends included
  trace(): { start: StartArgs; events: RoundEvent[] };
}

// the parts of the groups
export function playGolden(): GoldenFile[];       // copy-play.ts
export function leaveGolden(): GoldenFile[];      // copy-leave.ts
export function resultGolden(): GoldenFile[];     // copy-result.ts
export const BEST_SAMPLES: readonly [0, 1, 7, 9, 11, 12, 21, 100];
export function ticketGolden(): GoldenFile[];     // copy-ticket.ts
export const TICKET_INDEX: DeckIndex;
export function scrollGolden(): GoldenFile[];     // geometry-scroll.ts
export function pathGolden(): GoldenFile[];       // geometry-path.ts
export const ROUTE_LENGTHS: readonly [2, 3, 5, 10, 14, 21, 60];
export function curveParameters(): number[];
export function headersGolden(): GoldenFile[];    // geometry-headers.ts
export function barcodeGolden(): GoldenFile[];    // geometry-barcode.ts
export const BARCODE_DATA: readonly string[];
export function contrastGolden(): GoldenFile[];   // geometry-contrast.ts
export const PAIRS: readonly (readonly [string, string, "body text" | "large text" | "non-text", string])[]; // re-exported from src/tokens/contrast.ts
export const LISTED: readonly (readonly ["day" | "night", string, string])[];
export function colours(tokens: unknown): Record<"day" | "night", (role: string) => string> & { ownsNight: (role: string) => boolean };
export function luminance(hex: string): number; // re-exported from src/tokens/contrast.ts
export function ratioOf(foreground: string, background: string): number;

// tests/scripts/native/golden-view.ts (for the tests of this task; later tasks may reuse it)
export function view(file: GoldenFile): View;
export function byName(file: GoldenFile, name: string): GoldenCaseView;
export function outputFor(file: GoldenFile, input: unknown): unknown;
export function fileAt(files: readonly GoldenFile[], path: string): GoldenFile;
export function decode(file: GoldenFile, value: unknown): unknown;
export function replay(file: GoldenFile, input: unknown): RoundState;
```

  The 34 files, with the number of cases in each:

| file (`native-data/golden/` + name) | cases |
|---|---|
| `components.play.PlayScreen.verdictText.json` | 8 |
| `components.play.PlayScreen.roundStatus.json` | 12 |
| `components.play.PlayScreen.timedStatus.json` | 6 |
| `components.play.PlayScreen.timedCardText.json` | 8 |
| `components.play.PlayScreen.NEXT_ARRIVES_MS.json` | 1 |
| `components.play.PlayScreen.SPOKEN_RELEASE_MS.json` | 1 |
| `components.play.leave.leavesSomething.json` | 10 |
| `components.play.leave.saveLeftRound.json` | 10 |
| `components.play.resultCopy.resultCopy.json` | 17 |
| `components.play.ResultView.recordRound.json` | 7 |
| `components.play.ResultView.RESULT_ARRIVES_MS.json` | 1 |
| `components.MissedCards.missedCards.json` | 7 |
| `components.play.useRound.ticketFor.json` | 7 |
| `components.play.ticketScroll.statementScroll.json` | 9 |
| `components.play.ticketScroll.slipScroll.json` | 13 |
| `components.play.ticketScroll.keyScroll.json` | 96 |
| `components.play.ticketScroll.ARROW_STEP.json` | 1 |
| `components.FlightPath.pointAt.json` | 103 |
| `components.FlightPath.waypointT.json` | 117 |
| `components.FlightPath.flownPath.json` | 103 |
| `components.FlightPath.headingAt.json` | 103 |
| `components.FlightPath.waypointStates.json` | 8 |
| `components.FlightPath.cardList.json` | 6 |
| `components.FlightPath.flightPathLabel.json` | 7 |
| `components.FlightPath.completedLabel.json` | 7 |
| `components.FlightPath.completedScale.json` | 18 |
| `components.StreakPath.streakLayout.json` | 25 |
| `components.StreakPath.streakLabel.json` | 17 |
| `components.LivesPath.trailLayout.json` | 201 |
| `components.LivesPath.livesLabel.json` | 10 |
| `components.TimedPath.clockText.json` | 19 |
| `components.TimedPath.timedLabel.json` | 12 |
| `components.BoardingPass.barcodeBars.json` | 10 |
| `design.system.tokens.contrastPairs.json` | 1 |

**Rules:**

1. Every case has a name, unique within its file. The tests find cases by name; a renamed case fails loudly.
2. A function that takes a `RoundState` gets the trace that builds it: the case input is `{ "start": <StartArgs>, "events": [<RoundEvent>...] }` (README, "Where a case is a sequence"). A native test replays the events with its own engine, then calls the function. Arguments besides the round are further keys of the same input object (`progress`, `storage`, `calls`). The cards are in the file's table; the fixture deck is `FIXTURE_DECK` and every start uses seed 12345 unless the case says otherwise (`recordRound` follows the result tests and uses 7).
3. `saveLeftRound` and `recordRound` run against a progress store made with `createLocalStore` over an in-memory storage. The input key `progress` is the JSON the progress key holds before the call (`null`: nothing stored). `storage` is `"works"` or `"full"` (every write throws). The output `stored` is the JSON the key holds after (`null`: nothing was ever written). `recordRound` also takes `calls`, how many times it is called with the same round, and reports `writes` (how many times the storage was written), `sameOutcome` (whether every call returned the very same outcome object) and the first call's `outcome`; a native keeps the outcome of a round it has recorded, as the web does with a `WeakMap`.
4. `resultCopy` returns a function (`best`). Its output has the other fields as they are, with `ring` and `unit` left out when they are `undefined`, and `best` replaced by an object from each sampled record to the text `best` gives for it. The sampled records are 0, 1, 7, 9, 11, 12, 21 and 100; a native calls its `best` for each key of that object. The input is the `RoundResult` as the function takes it, with `modeName`, `dealt` and `previousBest`.
5. `streakLayout` and `trailLayout` return functions (`t`, `x`). Their outputs carry the other fields as they are and the function as an object from probe index to value; a native evaluates its function at each key. Probes of `streakLayout.t`: slots 0, 1, 2, `done - 1`, `done`, `done + 1` and the ring slot, where they exist. Probes of `trailLayout.x`: marks 0, 1, 2, the middle one, the second newest and the newest, where they exist. `trailLayout` has a case for every count of marks from 0 to 200.
6. `ticketFor` takes the route as `findRoute` returns it: `{ area, platform, deck, section }` with `section` null for the whole deck. The cases use a small index of two shipped decks (one with a pass name and no sections, one with four sections) and the test deck of the web tests. The whole deck's section code is `"ALL"`.
7. `barcodeBars` reads the first UTF-16 unit of each character of the data and uses its low seven bits. The cases include a letter beyond ASCII and a letter beyond the first plane (its high surrogate counts). A real pass draws the card's id.
8. `contrastPairs` is a constant: one case, input `null`, output `{ "pairs": [...], "listed": [...] }`. `pairs` holds the 27 pairs of the web test for the day theme and then for the night theme, each with both colours as `#rrggbb`, the WCAG 2.x ratio rounded to two decimals, the minimum of its kind (4.5 for body text, 3 for large text and non-text), `passes` (decided on the unrounded ratio) and, at night, `ownsNight` (both colours have a night value of their own). `listed` holds 27 entries with their colours: the 3 day and 22 night ratios the web test checks against DESIGN-SYSTEM.md section 2.2, and the 2 day ratios of the choices the product decisions replaced (an ink-muted tagline, an amber focus ring). The pairs, the minimums and the luminance come from `src/tokens/contrast.ts`, the module the web contrast test reads too (step 27 moves them there), so a pair added to the web test reaches the vector. The colours come from `tokensToCss` on `design/system/tokens.json`, exactly as the web test computes them: the web test is the oracle the vector copies, and it reads the raw file.
9. All numbers here are finite, so the special number tags of the format do not occur. An `undefined` output key is left out; a function that returns `null` (`slipScroll`, `keyScroll`) writes `null`.
10. Two runs give byte-identical files (the group tests check it).

**Steps:**

- [ ] **Step 1: Check the starting point.**

```bash
git branch --show-current
git status --short
ls scripts/native/golden/format.ts scripts/native/registry.ts
grep -c "contrastPairs\|ARROW_STEP\|barcodeBars\|ticketFor" scripts/native/registry.ts
npx -y pnpm@10.34.0 vitest run tests/scripts/native
```

Expected: `native`; no output from `git status`; both files listed; a count of at least 4 (the registry names the four entries searched for); every test file of tasks 2 to 7 passes. If the registry lacks the 34 entries of the table above, stop and settle it with task 4: the group tests of steps 14 and 29 compare against it.

- [ ] **Step 2: Write the read helper and the fixtures test.** The helper is what every test of this task reads a vector file with. `decode` puts the `$card` references back, `replay` runs a recorded trace with the engine.

`tests/scripts/native/golden-view.ts`:

```ts
// Reading a golden file the way a native test does: the JSON, with cases found by name or by input, the
// card references put back, and a round trace replayed with the engine.
import { isDeepStrictEqual } from "node:util";
import { decodeGoldenFile, decodeValue, type GoldenFile } from "@/scripts/native/golden/format";
import type { Card } from "@/src/content/schema";
import { reduce, startRound, type RoundEvent, type RoundState, type StartArgs } from "@/src/engine/round";

export interface GoldenCaseView {
  name: string;
  input: unknown;
  output: unknown;
}

export interface View {
  format: number;
  module: string;
  function: string;
  source: string;
  tests: string[];
  cards: Record<string, Card>;
  cases: GoldenCaseView[];
}

export function view(file: GoldenFile): View {
  return JSON.parse(file.content) as View;
}

/** The case with this name. Throws when there is none, so a renamed case fails loudly. */
export function byName(file: GoldenFile, name: string): GoldenCaseView {
  const found = view(file).cases.find((candidate) => candidate.name === name);
  if (found === undefined) throw new Error(`${file.path} has no case named "${name}"`);
  return found;
}

/** The output of the case whose (encoded) input equals `input`. Throws when there is none. */
export function outputFor(file: GoldenFile, input: unknown): unknown {
  const found = view(file).cases.find((candidate) => isDeepStrictEqual(candidate.input, input));
  if (found === undefined) throw new Error(`${file.path} has no case for ${JSON.stringify(input)}`);
  return found.output;
}

/** The file of a producer's list by its path. Throws when there is none. */
export function fileAt(files: readonly GoldenFile[], path: string): GoldenFile {
  const found = files.find((candidate) => candidate.path === path);
  if (found === undefined) throw new Error(`no file at ${path}; the list has ${files.map((file) => file.path).join(", ")}`);
  return found;
}

/**
 * A value of a case read back with the format's own decoder (task 4): every {"$card": id} is the card of the file's
 * table, tagged numbers and {"$undefined": true} are what they name. `view` stays the raw JSON, which `outputFor`
 * compares encoded inputs against.
 */
export function decode(file: GoldenFile, value: unknown): unknown {
  return decodeValue(value, decodeGoldenFile(file.content).cards);
}

/** The round a case input of the form {start, events} builds, replayed with the engine. */
export function replay(file: GoldenFile, input: unknown): RoundState {
  const { start, events } = decode(file, input) as { start: StartArgs; events: RoundEvent[] };
  return events.reduce(reduce, startRound(start));
}
```

`tests/scripts/native/golden-copy-fixtures.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DeckFileSchema } from "@/src/content/schema";
import { reduce, startRound } from "@/src/engine/round";
import { FIXTURE_DECK, Played, ROUTE, SCOPE_TEXT, startArgs } from "@/scripts/native/golden/copy-fixtures";

describe("the copy fixtures", () => {
  it("is a valid deck: 12 plain cards, 1 scoped, 12 with the same scope and 12 opening with code", () => {
    expect(DeckFileSchema.safeParse(FIXTURE_DECK).success).toBe(true);
    const count = (section: string) => FIXTURE_DECK.cards.filter((card) => card.section === section).length;
    expect([count("SEC"), count("APP"), count("SCP"), count("COD")]).toEqual([12, 1, 12, 12]);
    expect(new Set(FIXTURE_DECK.cards.map((card) => card.id)).size).toBe(37);
    expect(FIXTURE_DECK.cards.filter((card) => card.section === "SCP").every((card) => card.appliesTo === SCOPE_TEXT)).toBe(true);
    expect(FIXTURE_DECK.cards.find((card) => card.section === "COD")?.text.en.statement).toBe("`docker run` Statement COD 1.");
  });

  it("starts a round on the route's cards and keeps every event it is sent", () => {
    const args = startArgs("classic");
    expect(args.route).toEqual(ROUTE);
    expect(args.pool).toHaveLength(12);
    const played = new Played(args).right(1000).next().wrong(2000);
    expect(played.state.answers.map((answer) => answer.correct)).toEqual([true, false]);
    expect(played.trace().events).toEqual([
      { type: "answer", value: played.state.answers[0]?.given, at: 1000 },
      { type: "next" },
      { type: "answer", value: played.state.answers[1]?.given, at: 2000 },
    ]);
    const replayed = played.trace().events.reduce(reduce, startRound(args));
    expect(replayed).toEqual(played.state);
  });

  it("ticks once a second and throws when asked for the card of a finished round", () => {
    const timed = new Played(startArgs("timed")).tick(0).ticks(1000, 3000);
    expect(timed.events.map((event) => (event.type === "tick" ? event.now : -1))).toEqual([0, 1000, 2000, 3000]);
    const done = new Played(startArgs("classic")).send({ type: "abandon" });
    expect(() => done.card()).toThrow("the round has no card on screen");
  });
});
```

Run it:

```bash
npx -y pnpm@10.34.0 vitest run tests/scripts/native/golden-copy-fixtures.test.ts
```

Expected: FAIL, `Test Files  1 failed (1)`, `Tests  no tests`, with `Cannot find package '@/scripts/native/golden/copy-fixtures'`.

- [ ] **Step 3: Write the fixtures.** A deck of 37 made-up cards, the route and seed every case starts from, and `Played`, which plays a round while keeping the events it was sent, so a case input is exactly what was done.

`scripts/native/golden/copy-fixtures.ts`:

```ts
// The deck, the route and the round recorder the copy vectors are built from. The cards are small and made up
// (the copy functions read card fields, not the shipped decks), so every case of a file stays readable.
import { poolFor } from "@/src/content/load";
import type { Mode } from "@/src/content/play";
import type { Card, DeckFile, Route } from "@/src/content/schema";
import { currentCard, reduce, startRound, type RoundEvent, type RoundState, type StartArgs } from "@/src/engine/round";

export const DECK_ID = "test-deck";
export const ROUTE: Route = { deckId: DECK_ID, sectionId: "SEC" };
export const SEED = 12345;

const SCOPE = "Next.js 16 with cacheComponents: true";

function card(section: string, n: number, answer: boolean, appliesTo = "", mark = ""): Card {
  const id = `${DECK_ID}-${section.toLowerCase()}-${String(n).padStart(2, "0")}`;
  return {
    id,
    section,
    text: { en: { statement: `${mark}Statement ${section} ${n}.`, explanation: `Explanation ${section} ${n}.` } },
    answer,
    source: { title: `Source ${section} ${n}`, url: `https://example.com/${id}` },
    difficulty: 1,
    appliesTo,
    conflictGroups: [],
  };
}

const twelve = (section: string, appliesTo = "", mark = ""): Card[] =>
  Array.from({ length: 12 }, (_, i) => card(section, i + 1, i % 2 === 0, appliesTo, mark));

/**
 * SEC: 12 plain cards, half of them true. APP: one card with an appliesTo. SCP: 12 cards that all apply to one
 * setting. COD: 12 cards whose statement opens with a code fragment between backticks.
 */
export const FIXTURE_DECK: DeckFile = {
  id: DECK_ID,
  hash: "hash-1",
  cards: [...twelve("SEC"), card("APP", 1, true, "Next.js 16"), ...twelve("SCP", SCOPE), ...twelve("COD", "", "`docker run` ")],
};

export const SCOPE_TEXT = SCOPE;

/** The arguments that start a round of the mode on the fixture deck's section (SEC unless given). */
export function startArgs(mode: Mode, sectionId = "SEC", seed = SEED): StartArgs {
  return { mode, route: { deckId: DECK_ID, sectionId }, pool: poolFor(FIXTURE_DECK, sectionId), history: {}, seed };
}

/** A round being played: every event it was sent is kept, so the case input can replay it. */
export class Played {
  readonly events: RoundEvent[] = [];
  state: RoundState;

  constructor(readonly start: StartArgs) {
    this.state = startRound(start);
  }

  send(event: RoundEvent): this {
    this.events.push(event);
    this.state = reduce(this.state, event);
    return this;
  }

  /** The card on screen. Throws when the round has none. */
  card(): Card {
    const found = currentCard(this.state);
    if (found === undefined) throw new Error("the round has no card on screen");
    return found;
  }

  right(at: number): this {
    return this.send({ type: "answer", value: this.card().answer, at });
  }

  wrong(at: number): this {
    return this.send({ type: "answer", value: !this.card().answer, at });
  }

  next(): this {
    return this.send({ type: "next" });
  }

  tick(now: number): this {
    return this.send({ type: "tick", now });
  }

  /** One tick a second from `from` up to and including `to`. */
  ticks(from: number, to: number): this {
    for (let now = from; now <= to; now += 1000) this.tick(now);
    return this;
  }

  /** The case input that rebuilds this round: its start and the events it was sent, in order. */
  trace(): { start: StartArgs; events: RoundEvent[] } {
    return { start: this.start, events: [...this.events] };
  }
}
```

Run the same command as step 2. Expected: `Test Files  1 passed (1)`, `Tests  3 passed (3)`.

- [ ] **Step 4: Commit.**

```bash
git add tests/scripts/native/golden-view.ts tests/scripts/native/golden-copy-fixtures.test.ts scripts/native/golden/copy-fixtures.ts
git commit -m "feat: add the fixtures and the read helper of the copy and geometry golden vectors"
```

- [ ] **Step 5: Write the play copy test.** It types in the strings of `round-status-voice.test.tsx`, `PlayScreenTimed.test.tsx` and `timed-applies-to-polish.test.ts`.

`tests/scripts/native/golden-copy-play.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { roundStatus, timedCardText, timedStatus } from "@/components/play/PlayScreen";
import { playGolden } from "@/scripts/native/golden/copy-play";
import { byName, fileAt, outputFor, replay, view } from "./golden-view";

const FILES = playGolden();
const at = (name: string) => fileAt(FILES, `native-data/golden/components.play.PlayScreen.${name}.json`);

describe("the play copy vectors", () => {
  it("makes one file for each function and constant of the play screen's copy", () => {
    expect(FILES.map((file) => file.path)).toEqual(
      ["verdictText", "roundStatus", "timedStatus", "timedCardText", "NEXT_ARRIVES_MS", "SPOKEN_RELEASE_MS"].map(
        (name) => `native-data/golden/components.play.PlayScreen.${name}.json`,
      ),
    );
    for (const file of FILES) {
      expect(view(file)).toMatchObject({ format: 1, module: "components/play/PlayScreen", source: "components/play/PlayScreen.tsx" });
      expect(view(file).tests).toContain("tests/components/play/round-status-voice.test.tsx");
    }
  });

  it("keeps the two timings of the screen as constants", () => {
    expect(view(at("NEXT_ARRIVES_MS")).cases).toEqual([{ name: "value", input: null, output: 420 }]);
    expect(view(at("SPOKEN_RELEASE_MS")).cases).toEqual([{ name: "value", input: null, output: 150 }]);
  });
});

describe("verdictText", () => {
  it("says the verdict and the answer, and New best. after them, for every combination", () => {
    const file = at("verdictText");
    expect(view(file).cases).toHaveLength(8);
    for (const correct of [true, false]) {
      for (const answer of [true, false]) {
        const verdict = `${correct ? "Correct" : "Not quite"}. The answer is ${answer ? "True" : "False"}.`;
        expect(outputFor(file, { correct, answer })).toBe(verdict);
        expect(outputFor(file, { correct, answer, newBest: true })).toBe(`${verdict} New best.`);
      }
    }
  });
});

describe("roundStatus (the pinned cases of round-status-voice.test.tsx)", () => {
  const file = at("roundStatus");
  const text = (name: string) => byName(file, name).output;

  it("Three lives: a lost life, the last life, the end, and nothing after a right answer", () => {
    expect(text("lives: the first wrong answer loses a life")).toBe("Life lost, 2 left.");
    expect(text("lives: a right answer after a lost life says nothing")).toBe("");
    expect(text("lives: the second wrong answer is the last life")).toBe("Last life.");
    expect(text("lives: the third wrong answer is out of lives")).toBe("Out of lives.");
  });

  it("Streak: the end with the streak it reached, and 0 for a wrong first card", () => {
    expect(text("streak: wrong after two right answers")).toBe("Streak ended at 2.");
    expect(text("streak: wrong on the first card ends at 0")).toBe("Streak ended at 0.");
    expect(text("streak: 13 right answers then a wrong one, across a chunk")).toBe("Streak ended at 13.");
  });

  it("Classic and Timed add nothing", () => {
    expect(text("classic: a wrong answer adds nothing")).toBe("");
    expect(text("timed: a wrong answer adds nothing")).toBe("");
  });

  it("every recorded output is what the function says on the round its trace replays to", () => {
    for (const recorded of view(file).cases) expect(roundStatus(replay(file, recorded.input)), recorded.name).toBe(recorded.output);
  });
});

describe("timedStatus (the pinned cases of PlayScreenTimed.test.tsx)", () => {
  const file = at("timedStatus");

  it("says nothing on a question, the verdict alone during the stamp, and that the card does not count at time up", () => {
    expect(byName(file, "a question says nothing").output).toBe("");
    expect(byName(file, "the stamp of a right answer says Correct.").output).toBe("Correct.");
    expect(byName(file, "the stamp of a wrong answer says Not quite.").output).toBe("Not quite.");
    expect(byName(file, "time is up on a question").output).toBe("Time is up. This card doesn't count.");
    expect(byName(file, "time is up after an answer").output).toBe("Time is up. This card doesn't count.");
  });

  it("every recorded output is what the function says on the round its trace replays to", () => {
    for (const recorded of view(file).cases) expect(timedStatus(replay(file, recorded.input)), recorded.name).toBe(recorded.output);
  });
});

describe("timedCardText (the pinned cases of PlayScreenTimed.test.tsx and timed-applies-to-polish.test.ts)", () => {
  const file = at("timedCardText");
  const statementOfSecond = (name: string) => replay(file, byName(file, name).input).cards[1]?.text.en.statement ?? "";

  it("says nothing on the first card, its number and statement from the second on, and nothing at time up", () => {
    expect(byName(file, "the first card is read through focus: nothing").output).toBe("");
    expect(byName(file, "the stamp on the first card: nothing").output).toBe("");
    expect(byName(file, "the second card: its number and statement").output).toBe(`Card 2. ${statementOfSecond("the second card: its number and statement")}`);
    expect(byName(file, "the second card keeps the text through its stamp").output).toBe(
      `Card 2. ${statementOfSecond("the second card keeps the text through its stamp")}`,
    );
    expect(byName(file, "time is up: nothing").output).toBe("");
  });

  it("says the Applies to line before the statement", () => {
    const name = "the second card with an appliesTo says the Applies to line first";
    expect(byName(file, name).output).toBe(`Card 2. Applies to Next.js 16 with cacheComponents: true. ${statementOfSecond(name)}`);
  });

  it("reads a code fragment as it is shown, without its backticks", () => {
    const name = "the second card opening with a code fragment is read without its backticks";
    const statement = statementOfSecond(name);
    expect(statement.startsWith("`docker run` ")).toBe(true);
    expect(byName(file, name).output).toBe(`Card 2. docker run ${statement.slice("`docker run` ".length)}`);
  });

  it("every recorded output is what the function says on the round its trace replays to", () => {
    for (const recorded of view(file).cases) expect(timedCardText(replay(file, recorded.input)), recorded.name).toBe(recorded.output);
  });
});
```

```bash
npx -y pnpm@10.34.0 vitest run tests/scripts/native/golden-copy-play.test.ts
```

Expected: FAIL, `Test Files  1 failed (1)`, `Cannot find package '@/scripts/native/golden/copy-play'`.

- [ ] **Step 6: Write the play copy producer.** Six files: the verdict for all eight combinations, the round status for Three lives, Streak (across a chunk too), Classic and Timed, the Timed status at each phase, the Timed announcer for a plain card, a card with an appliesTo and a card opening with a code fragment, and the two timings.

`scripts/native/golden/copy-play.ts`:

```ts
// Vectors for the words the play screen says: the verdict, what a wrong answer did to the round, the Timed
// status and the Timed card announcer (components/play/PlayScreen.tsx), and the two timings the screen keeps.
// A round given to a function is written as the trace that builds it: {start, events}.
import { NEXT_ARRIVES_MS, SPOKEN_RELEASE_MS, roundStatus, timedCardText, timedStatus, verdictText } from "@/components/play/PlayScreen";
import { Played, startArgs } from "./copy-fixtures";
import { goldenFile, type GoldenCase, type GoldenFile } from "./format";

const MODULE = "components/play/PlayScreen";
const SOURCE = "components/play/PlayScreen.tsx";
const TESTS = [
  "tests/components/play/PlayScreenTimed.test.tsx",
  "tests/components/play/timed-applies-to-polish.test.ts",
  "tests/components/play/round-status-voice.test.tsx",
] as const;

function file(name: string, cases: readonly GoldenCase[]): GoldenFile {
  return goldenFile({ module: MODULE, function: name, source: SOURCE, tests: TESTS }, cases);
}

/** A case whose only argument is a round: the input is the trace that builds it. */
function roundCase(name: string, played: Played, output: (round: Played["state"]) => unknown): GoldenCase {
  return { name, input: played.trace(), output: output(played.state) };
}

/** A round of the mode with the Timed clock started, as the screen starts it. */
const timed = (section = "SEC") => new Played(startArgs("timed", section)).tick(0);

function verdictFile(): GoldenFile {
  const cases: GoldenCase[] = [];
  for (const correct of [true, false]) {
    for (const answer of [true, false]) {
      const label = `${correct ? "correct" : "wrong"} answer, the answer is ${answer ? "True" : "False"}`;
      cases.push({ name: label, input: { correct, answer }, output: verdictText(correct, answer) });
      cases.push({ name: `${label}, new best`, input: { correct, answer, newBest: true }, output: verdictText(correct, answer, true) });
    }
  }
  return file("verdictText", cases);
}

function statusFile(): GoldenFile {
  const status = (round: Played["state"]) => roundStatus(round);
  const lives = () => new Played(startArgs("lives"));
  const streak = () => new Played(startArgs("streak"));
  const thirteen = streak();
  for (let i = 0; i < 13; i += 1) thirteen.right(1000 + i).next();
  thirteen.wrong(2000);
  return file("roundStatus", [
    roundCase("lives: nothing answered yet", lives(), status),
    roundCase("lives: the first wrong answer loses a life", lives().wrong(1000), status),
    roundCase("lives: the words stay while the next card is a question", lives().wrong(1000).next(), status),
    roundCase("lives: a right answer after a lost life says nothing", lives().wrong(1000).next().right(2000), status),
    roundCase("lives: the second wrong answer is the last life", lives().wrong(1000).next().right(2000).next().wrong(3000), status),
    roundCase("lives: the third wrong answer is out of lives", lives().wrong(1000).next().right(2000).next().wrong(3000).next().wrong(4000), status),
    roundCase("streak: wrong after two right answers", streak().right(1000).next().right(2000).next().wrong(3000), status),
    roundCase("streak: wrong on the first card ends at 0", streak().wrong(1000), status),
    roundCase("streak: a right answer says nothing", streak().right(1000), status),
    roundCase("streak: 13 right answers then a wrong one, across a chunk", thirteen, status),
    roundCase("classic: a wrong answer adds nothing", new Played(startArgs("classic")).wrong(1000), status),
    roundCase("timed: a wrong answer adds nothing", timed().wrong(500), status),
  ]);
}

function timedStatusFile(): GoldenFile {
  const status = (round: Played["state"]) => timedStatus(round);
  return file("timedStatus", [
    roundCase("a question says nothing", timed(), status),
    roundCase("the stamp of a right answer says Correct.", timed().right(500), status),
    roundCase("the stamp of a wrong answer says Not quite.", timed().wrong(500), status),
    roundCase("after the stamp the next question says nothing", timed().right(500).tick(1200), status),
    roundCase("time is up on a question", timed().ticks(1000, 60_000), status),
    roundCase("time is up after an answer", timed().right(500).ticks(1000, 60_000), status),
  ]);
}

function timedCardFile(): GoldenFile {
  const text = (round: Played["state"]) => timedCardText(round);
  const second = (section = "SEC") => timed(section).right(500).tick(1200);
  return file("timedCardText", [
    roundCase("the first card is read through focus: nothing", timed(), text),
    roundCase("the stamp on the first card: nothing", timed().right(500), text),
    roundCase("the second card: its number and statement", second(), text),
    roundCase("the second card keeps the text through its stamp", second().right(1500), text),
    roundCase("the third card", second().right(1500).tick(2300), text),
    roundCase("time is up: nothing", second().ticks(2000, 61_000), text),
    roundCase("the second card with an appliesTo says the Applies to line first", second("SCP"), text),
    roundCase("the second card opening with a code fragment is read without its backticks", second("COD"), text),
  ]);
}

function constants(): GoldenFile[] {
  return [
    file("NEXT_ARRIVES_MS", [{ name: "value", input: null, output: NEXT_ARRIVES_MS }]),
    file("SPOKEN_RELEASE_MS", [{ name: "value", input: null, output: SPOKEN_RELEASE_MS }]),
  ];
}

/** The files of this group: verdictText, roundStatus, timedStatus, timedCardText, NEXT_ARRIVES_MS, SPOKEN_RELEASE_MS. */
export function playGolden(): GoldenFile[] {
  return [verdictFile(), statusFile(), timedStatusFile(), timedCardFile(), ...constants()];
}
```

Run the command of step 5. Expected: `Test Files  1 passed (1)`, `Tests  13 passed (13)`.

- [ ] **Step 7: Write the leave test.** The three cases of `leave.test.ts` are pinned by value; `leavesSomething` has no web test of its own, so its table is pinned from its doc comment (answers or a decided round).

`tests/scripts/native/golden-copy-leave.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { leavesSomething } from "@/components/play/leave";
import { leaveGolden } from "@/scripts/native/golden/copy-leave";
import { byName, fileAt, replay, view } from "./golden-view";

const FILES = leaveGolden();
const at = (name: string) => fileAt(FILES, `native-data/golden/components.play.leave.${name}.json`);

type Stored = { cards: Record<string, { seen: number; lastCorrect: boolean; lastSeenAt: number }>; records: Record<string, number>; last: unknown };
const stored = (name: string) => (byName(at("saveLeftRound"), name).output as { stored: Stored | null }).stored;

describe("the leave vectors", () => {
  it("makes a file for each function of leave.ts", () => {
    expect(FILES.map((file) => file.path)).toEqual([
      "native-data/golden/components.play.leave.leavesSomething.json",
      "native-data/golden/components.play.leave.saveLeftRound.json",
    ]);
    expect(view(at("saveLeftRound")).tests).toEqual(["tests/components/play/leave.test.ts"]);
  });
});

describe("leavesSomething", () => {
  it("is true with answers or a decided round, false before both", () => {
    const file = at("leavesSomething");
    const out = (name: string) => byName(file, name).output;
    expect(out("Classic: nothing answered yet")).toBe(false);
    expect(out("Classic: one answer given")).toBe(true);
    expect(out("Classic: the last card answered, the round is decided")).toBe(true);
    expect(out("Timed: the minute is running and nothing is answered")).toBe(false);
    expect(out("Timed: the minute ran out with nothing answered")).toBe(true);
    expect(out("Classic: abandoned with nothing answered")).toBe(false);
  });

  it("every recorded output is what the function says on the round its trace replays to", () => {
    const file = at("leavesSomething");
    for (const recorded of view(file).cases) expect(leavesSomething(replay(file, recorded.input)), recorded.name).toBe(recorded.output);
  });
});

describe("saveLeftRound (the pinned cases of leave.test.ts)", () => {
  const route = { deckId: "test-deck", sectionId: "SEC" };

  it("keeps the answers in the card history, remembers the route without a score and sets no record", () => {
    const after = stored("Classic: two answers kept in the history, no record, the route without a score");
    expect(Object.values(after?.cards ?? {}).map((entry) => entry.seen)).toEqual([1, 1]);
    expect(after?.records).toEqual({});
    expect(after?.last).toEqual({ route, mode: "classic", score: null, total: null });
  });

  it("records a decided round that is left as its result would: the answers, the record and the score", () => {
    const after = stored("Streak: left after the deciding answer, recorded as its result would be");
    expect(after?.records).toEqual({ "test-deck/SEC#streak": 3 });
    expect(Object.values(after?.cards ?? {})).toHaveLength(4);
    expect(Object.values(after?.cards ?? {}).every((entry) => entry.seen === 1)).toBe(true);
    expect(after?.last).toEqual({ route, mode: "streak", score: 3, total: 4 });
  });

  it("does not throw when the store cannot save, and writes nothing", () => {
    expect(stored("the store cannot save: nothing is written and nothing throws")).toBeNull();
    expect(stored("the store cannot save over stored progress: the stored value stays")?.records).toEqual({
      "test-deck/SEC#classic": 5,
      "test-deck/SEC#streak": 9,
    });
  });

  it("records the other deciding rounds and an open round over stored progress", () => {
    expect(stored("Three lives: left after the third wrong answer")?.records).toEqual({ "test-deck/SEC#lives": 3 });
    expect(stored("Classic: left after the last card was answered, the record is set")?.records).toEqual({ "test-deck/SEC#classic": 10 });
    expect(stored("Timed: the minute ran out with nothing answered, a record of 0")?.records).toEqual({ "test-deck/SEC#timed": 0 });
    const open = stored("Classic: an open round over stored progress keeps the records and counts a card seen before once more");
    expect(open?.records).toEqual({ "test-deck/SEC#classic": 5, "test-deck/SEC#streak": 9 });
    expect(open?.cards["test-deck-sec-10"]).toEqual({ seen: 2, lastCorrect: true, lastSeenAt: 1000 });
    expect(stored("Streak: a decided round below the stored record leaves the record alone")?.records["test-deck/SEC#streak"]).toBe(9);
  });
});
```

```bash
npx -y pnpm@10.34.0 vitest run tests/scripts/native/golden-copy-leave.test.ts
```

Expected: FAIL, `Cannot find package '@/scripts/native/golden/copy-leave'`.

- [ ] **Step 8: Write the leave producer.** `saveLeftRound` runs against the real `createLocalStore`, as the web test does, so a full storage is the same throwing `setItem`.

`scripts/native/golden/copy-leave.ts`:

```ts
// Vectors for leaving a round (components/play/leave.ts): whether leaving saves anything, and what is saved.
// A round given to a function is written as the trace that builds it: {start, events}. A stored progress is
// the JSON the progress key holds before the call, and the output is the JSON it holds after.
import { leavesSomething, saveLeftRound } from "@/components/play/leave";
import { PROGRESS_KEY, createLocalStore } from "@/src/progress/local";
import { emptyProgress, type Progress } from "@/src/progress/progress";
import { Played, startArgs } from "./copy-fixtures";
import { goldenFile, type GoldenCase, type GoldenFile } from "./format";

const MODULE = "components/play/leave";
const SOURCE = "components/play/leave.ts";
const TESTS = ["tests/components/play/leave.test.ts"] as const;

const timed = () => new Played(startArgs("timed")).tick(0);

function leavesFile(): GoldenFile {
  const leaves = (name: string, played: Played): GoldenCase => ({ name, input: played.trace(), output: leavesSomething(played.state) });
  const classic = () => new Played(startArgs("classic"));
  const wholeClassic = classic();
  for (let i = 0; i < 9; i += 1) wholeClassic.right(1000 + i).next();
  wholeClassic.right(2000);
  return goldenFile({ module: MODULE, function: "leavesSomething", source: SOURCE, tests: TESTS }, [
    leaves("Classic: nothing answered yet", classic()),
    leaves("Classic: one answer given", classic().right(1000)),
    leaves("Classic: one answer given and the next card on screen", classic().right(1000).next()),
    leaves("Classic: the last card answered, the round is decided", wholeClassic),
    leaves("Three lives: one wrong answer", new Played(startArgs("lives")).wrong(1000)),
    leaves("Streak: the deciding wrong answer", new Played(startArgs("streak")).wrong(1000)),
    leaves("Timed: the minute is running and nothing is answered", timed()),
    leaves("Timed: the minute ran out with nothing answered", timed().ticks(1000, 60_000)),
    leaves("Timed: one answer stamped", timed().right(500)),
    leaves("Classic: abandoned with nothing answered", classic().send({ type: "abandon" })),
  ]);
}

/** What the progress key holds after saving the left round into a store over `progress`; `full` makes every write throw. */
function savedFrom(played: Played, progress: Progress | null, full: boolean): unknown {
  const data = new Map<string, string>();
  if (progress !== null) data.set(PROGRESS_KEY, JSON.stringify(progress));
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (full) throw new Error("quota");
      data.set(key, value);
    },
  };
  saveLeftRound(played.state, createLocalStore(storage));
  const raw = data.get(PROGRESS_KEY);
  return raw === undefined ? null : JSON.parse(raw);
}

function saveFile(): GoldenFile {
  const save = (name: string, played: Played, progress: Progress | null = null, storage: "works" | "full" = "works"): GoldenCase => ({
    name,
    input: { ...played.trace(), progress, storage },
    output: { stored: savedFrom(played, progress, storage === "full") },
  });
  const classic = () => new Played(startArgs("classic"));
  // The pinned round of leave.test.ts: the two answers are True and False whatever the cards say.
  const twoAnswers = classic().send({ type: "answer", value: true, at: 1000 }).next().send({ type: "answer", value: false, at: 2000 }).next();
  const streakDecided = new Played(startArgs("streak"));
  for (let i = 0; i < 3; i += 1) streakDecided.right(1000 * (i + 1)).next();
  streakDecided.wrong(5000);
  const livesDecided = new Played(startArgs("lives")).wrong(1000).next().wrong(2000).next().wrong(3000);
  const wholeClassic = classic();
  for (let i = 0; i < 9; i += 1) wholeClassic.right(1000 + i).next();
  wholeClassic.right(2000);
  const before: Progress = {
    ...emptyProgress(),
    cards: { "test-deck-sec-10": { seen: 1, lastCorrect: false, lastSeenAt: 500 } },
    records: { "test-deck/SEC#classic": 5, "test-deck/SEC#streak": 9 },
  };
  return goldenFile({ module: MODULE, function: "saveLeftRound", source: SOURCE, tests: TESTS }, [
    save("Classic: two answers kept in the history, no record, the route without a score", twoAnswers),
    save("Streak: left after the deciding answer, recorded as its result would be", streakDecided),
    save("the store cannot save: nothing is written and nothing throws", twoAnswers, null, "full"),
    save("the store cannot save over stored progress: the stored value stays", twoAnswers, before, "full"),
    save("Three lives: left after the third wrong answer", livesDecided),
    save("Classic: left after the last card was answered, the record is set", wholeClassic),
    save("Timed: the minute ran out with nothing answered, a record of 0", timed().ticks(1000, 60_000)),
    save("Classic: an open round over stored progress keeps the records and counts a card seen before once more", classic().right(1000), before),
    save("Streak: a decided round below the stored record leaves the record alone", new Played(startArgs("streak")).wrong(1000), before),
    save("Classic: nothing answered still remembers the route, which the screen never asks for", classic()),
  ]);
}

/** The files of this group: leavesSomething and saveLeftRound. */
export function leaveGolden(): GoldenFile[] {
  return [leavesFile(), saveFile()];
}
```

Run the command of step 7. Expected: `Test Files  1 passed (1)`, `Tests  7 passed (7)`.

- [ ] **Step 9: Commit.**

```bash
git add tests/scripts/native/golden-copy-play.test.ts tests/scripts/native/golden-copy-leave.test.ts scripts/native/golden/copy-play.ts scripts/native/golden/copy-leave.ts
git commit -m "feat: export golden vectors for the play screen's words and for leaving a round"
```

- [ ] **Step 10: Write the result test.** It types in the nine cases of `resultCopy.test.ts` (with the ring table), the two of `recordRound` in `ResultView.test.tsx`, and the cases of `MissedCards.test.tsx` and `missed-cards-applies-to-polish.test.tsx`.

`tests/scripts/native/golden-copy-result.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { resultCopy } from "@/components/play/resultCopy";
import { BEST_SAMPLES, resultGolden } from "@/scripts/native/golden/copy-result";
import { FIXTURE_DECK } from "@/scripts/native/golden/copy-fixtures";
import type { RoundResult } from "@/src/content/play";
import { byName, decode, fileAt, view } from "./golden-view";

const FILES = resultGolden();
const at = (module: string, name: string) => fileAt(FILES, `native-data/golden/${module}.${name}.json`);
const COPY = at("components.play.resultCopy", "resultCopy");

/** The output of a resultCopy case without its `best` texts, as the web test compares it. */
function plain(name: string): Record<string, unknown> {
  const { best, ...rest } = byName(COPY, name).output as { best: Record<string, string> };
  void best;
  return rest;
}
const bestText = (name: string, record: number) => (byName(COPY, name).output as { best: Record<string, string> }).best[String(record)];

describe("the result vectors", () => {
  it("makes a file for each function and constant of the result", () => {
    expect(FILES.map((file) => file.path)).toEqual([
      "native-data/golden/components.play.resultCopy.resultCopy.json",
      "native-data/golden/components.play.ResultView.recordRound.json",
      "native-data/golden/components.play.ResultView.RESULT_ARRIVES_MS.json",
      "native-data/golden/components.MissedCards.missedCards.json",
    ]);
    expect(view(at("components.MissedCards", "missedCards")).source).toBe("components/MissedCards.tsx");
    expect(view(at("components.play.ResultView", "recordRound")).tests).toEqual(["tests/components/play/ResultView.test.tsx"]);
  });

  it("keeps the result's delay before its actions take presses", () => {
    expect(view(at("components.play.ResultView", "RESULT_ARRIVES_MS")).cases).toEqual([{ name: "value", input: null, output: 1000 }]);
  });
});

describe("resultCopy (the pinned cases of resultCopy.test.ts)", () => {
  it("Classic: 7 of 10", () => {
    expect(plain("Classic: 7 of 10")).toStrictEqual({
      fields: [
        { label: "Class", value: "Classic" },
        { label: "Cards", value: "10 / 10" },
        { label: "Wrong", value: "03" },
      ],
      scoreLabel: "Your score",
      unit: "of 10",
      ended: "Arrived",
      endedDetail: " · 10 of 10",
      label: "Round complete. 10 of 10 cards. 7 correct, 3 wrong: cards 3, 6 and 9.",
      marks: 10,
    });
    expect(bestText("Classic: 7 of 10", 9)).toBe("9 / 10");
  });

  it("Classic: a route with fewer cards than ten counts by its own length", () => {
    const name = "Classic: a route with fewer cards than ten counts by its own length";
    const output = plain(name) as { fields: unknown[]; unit: string; label: string; marks: number };
    expect(output.fields[1]).toStrictEqual({ label: "Cards", value: "01 / 01" });
    expect(output.unit).toBe("of 1");
    expect(output.label).toBe("Round complete. 1 of 1 cards. 0 correct, 1 wrong: card 1.");
    expect(output.marks).toBe(1);
  });

  it("Streak: 13 right, then wrong", () => {
    const name = "Streak: 13 right, then wrong, past a best of 12";
    expect(plain(name)).toStrictEqual({
      fields: [
        { label: "Class", value: "Streak" },
        { label: "Cards", value: "14" },
        { label: "Wrong", value: "01" },
      ],
      scoreLabel: "Correct in a row",
      ended: "Ended",
      endedDetail: " · 14 cards",
      label: "Streak over on card 14. 13 correct in a row. Card 14 was wrong.",
      marks: 14,
      ring: 11,
    });
    expect(bestText(name, 12)).toBe("12");
  });

  it("Streak: the ring needs a previous best that this round reached", () => {
    const ring = (name: string) => plain(name)["ring"];
    expect(Object.hasOwn(plain("Streak: no previous best, no ring"), "ring")).toBe(false);
    expect(Object.hasOwn(plain("Streak: a previous best of 0, no ring"), "ring")).toBe(false);
    expect(Object.hasOwn(plain("Streak: a previous best above the score, no ring"), "ring")).toBe(false);
    expect(ring("Streak: a previous best equal to the score rings the last right card")).toBe(12);
    expect(ring("Streak: a previous best of 1 rings the first card")).toBe(0);
  });

  it("Streak: wrong on the first card", () => {
    const output = plain("Streak: wrong on the first card") as { fields: { value: string }[]; endedDetail: string; label: string; marks: number };
    expect(output.endedDetail).toBe(" · 1 card");
    expect(output.label).toBe("Streak over on card 1. 0 correct in a row. Card 1 was wrong.");
    expect(output.fields.map((field) => field.value)).toStrictEqual(["Streak", "01", "01"]);
    expect(output.marks).toBe(1);
  });

  it("Three lives: 21 cards, wrong on 6, 15 and 21", () => {
    const name = "Three lives: 21 cards, wrong on 6, 15 and 21";
    expect(plain(name)).toStrictEqual({
      fields: [
        { label: "Class", value: "Three lives" },
        { label: "Correct", value: "18" },
        { label: "Wrong", value: "03" },
      ],
      scoreLabel: "Your score",
      unit: "cards",
      ended: "Out of lives",
      endedDetail: "",
      label: "Out of lives after 21 cards. 18 correct, 3 wrong: cards 6, 15 and 21.",
      marks: 21,
    });
    expect(bestText(name, 21)).toBe("21 cards");
  });

  it("Timed: 17 answered, wrong on 4, 9 and 15", () => {
    const name = "Timed: 17 answered, wrong on 4, 9 and 15";
    expect(plain(name)).toStrictEqual({
      fields: [
        { label: "Class", value: "Timed" },
        { label: "Time", value: "60 s" },
        { label: "Answered", value: "17" },
      ],
      scoreLabel: "Correct",
      unit: "of 17",
      ended: "Time is up",
      endedDetail: " · 17 cards",
      label: "Time is up. 17 cards answered in 60 seconds. 14 correct, 3 wrong: cards 4, 9 and 15.",
      marks: 17,
    });
    expect(bestText(name, 11)).toBe("11");
  });

  it("Timed: nothing answered, and one right answer", () => {
    const none = plain("Timed: nothing answered") as { fields: { value: string }[]; unit: string; endedDetail: string; label: string; marks: number };
    expect(none.fields.map((field) => field.value)).toStrictEqual(["Timed", "60 s", "00"]);
    expect(none.unit).toBe("of 0");
    expect(none.endedDetail).toBe(" · 0 cards");
    expect(none.label).toBe("Time is up. 0 cards answered in 60 seconds. 0 correct, 0 wrong.");
    expect(none.marks).toBe(0);
    const one = plain("Timed: one right answer") as { endedDetail: string; label: string; unit: string };
    expect(one.endedDetail).toBe(" · 1 card");
    expect(one.label).toBe("Time is up. 1 card answered in 60 seconds. 1 correct, 0 wrong.");
    expect(one.unit).toBe("of 1");
  });

  it("lists the text of every sampled record", () => {
    for (const recorded of view(COPY).cases) {
      expect(Object.keys((recorded.output as { best: object }).best)).toEqual(BEST_SAMPLES.map(String));
    }
  });

  it("every recorded output is what the function says on the decoded input", () => {
    for (const recorded of view(COPY).cases) {
      const input = decode(COPY, recorded.input) as { result: RoundResult; modeName: string; dealt: number; previousBest: number | null };
      const { best, ...rest } = resultCopy(input.result, input.modeName, input.dealt, input.previousBest);
      const texts = Object.fromEntries(BEST_SAMPLES.map((record) => [String(record), best(record)]));
      expect(recorded.output, recorded.name).toEqual(JSON.parse(JSON.stringify({ ...rest, best: texts })));
    }
  });
});

describe("recordRound (the pinned cases of ResultView.test.tsx)", () => {
  const file = at("components.play.ResultView", "recordRound");
  type Recorded = { writes: number; sameOutcome: boolean; stored: { cards: Record<string, { seen: number }>; records: Record<string, number>; last: unknown } };
  const recorded = (name: string) => byName(file, name).output as Recorded;

  it("writes the round once, however often it is called, and returns the same outcome", () => {
    for (const name of ["Classic 7 of 10: written once however often it is called", "Classic 7 of 10: called three times"]) {
      const output = recorded(name);
      expect(output.sameOutcome).toBe(true);
      expect(output.writes).toBe(1);
      expect(output.stored.records["test-deck/SEC#classic"]).toBe(7);
      expect(Object.values(output.stored.cards).map((entry) => entry.seen)).toEqual(Array.from({ length: 10 }, () => 1));
    }
  });

  it("remembers the route, the mode and the score for the start screen's Continue", () => {
    expect(recorded("Classic 7 of 10: called once").stored.last).toEqual({
      route: { deckId: "test-deck", sectionId: "SEC" },
      mode: "classic",
      score: 7,
      total: 10,
    });
  });

  it("sets a record only when the round beats the stored one", () => {
    expect(recorded("Classic 7 of 10 below a stored record of 9: the record stays").stored.records["test-deck/SEC#classic"]).toBe(9);
    expect(recorded("Streak 3 past a stored record of 2: a new record").stored.records["test-deck/SEC#streak"]).toBe(3);
  });
});

describe("missedCards (the pinned cases of MissedCards.test.tsx and missed-cards-applies-to-polish.test.tsx)", () => {
  const file = at("components.MissedCards", "missedCards");
  const [, b, c] = FIXTURE_DECK.cards;
  const applied = FIXTURE_DECK.cards.find((card) => card.appliesTo !== "");

  it("keeps the wrong answers in order, numbered by their place in the round", () => {
    if (!b || !c) throw new Error("the fixture deck has fewer than three cards");
    expect(byName(file, "the wrong answers in order, numbered by their place in the round").output).toEqual([
      { number: 2, given: !b.answer, answer: b.answer, statement: b.text.en.statement, explanation: b.text.en.explanation, source: b.source },
      { number: 3, given: !c.answer, answer: c.answer, statement: c.text.en.statement, explanation: c.text.en.explanation, source: c.source },
    ]);
  });

  it("carries the card's appliesTo, and none for a card without one", () => {
    const [first, second] = byName(file, "a card with an appliesTo carries it, a card without one has none").output as Record<string, unknown>[];
    expect(first?.["appliesTo"]).toBe(applied?.appliesTo);
    expect(second && Object.hasOwn(second, "appliesTo")).toBe(false);
  });

  it("is empty with no answers or only right ones, and numbers a long round by place", () => {
    expect(byName(file, "no answers").output).toEqual([]);
    expect(byName(file, "every answer right").output).toEqual([]);
    const numbers = (byName(file, "wrong on cards 1, 10 and 12 of twelve").output as { number: number }[]).map((entry) => entry.number);
    expect(numbers).toEqual([1, 10, 12]);
    expect((byName(file, "the same card missed twice").output as { number: number }[]).map((entry) => entry.number)).toEqual([1, 3]);
  });
});
```

```bash
npx -y pnpm@10.34.0 vitest run tests/scripts/native/golden-copy-result.test.ts
```

Expected: FAIL, `Cannot find package '@/scripts/native/golden/copy-result'`.

- [ ] **Step 11: Write the result producer.** `finishedRound` ports the helper of `ResultView.test.tsx` (seed 7; Timed answers 100 ms apart and ticks 700 ms after each answer, then runs the clock out and presses Next), so the recorded rounds are the ones the web test records.

`scripts/native/golden/copy-result.ts`:

```ts
// Vectors for the result of a round: the words of each class (components/play/resultCopy.ts), recording a
// finished round once (components/play/ResultView.tsx) and the list of missed cards (components/MissedCards.tsx).
// A round given to a function is written as the trace that builds it: {start, events}.
import { missedCards } from "@/components/MissedCards";
import { resultCopy } from "@/components/play/resultCopy";
import { RESULT_ARRIVES_MS, recordRound } from "@/components/play/ResultView";
import type { Answered, Mode, RoundResult } from "@/src/content/play";
import { TIMED, scoreOf } from "@/src/engine/round";
import { PROGRESS_KEY, createLocalStore } from "@/src/progress/local";
import { emptyProgress, type Progress } from "@/src/progress/progress";
import { FIXTURE_DECK, Played, ROUTE, startArgs } from "./copy-fixtures";
import { goldenFile, type GoldenCase, type GoldenFile } from "./format";


const RESULT_COPY = { module: "components/play/resultCopy", source: "components/play/resultCopy.ts", tests: ["tests/components/play/resultCopy.test.ts"] };
const RESULT_VIEW = { module: "components/play/ResultView", source: "components/play/ResultView.tsx", tests: ["tests/components/play/ResultView.test.tsx"] };
const MISSED = {
  module: "components/MissedCards",
  source: "components/MissedCards.tsx",
  tests: ["tests/components/MissedCards.test.tsx", "tests/components/missed-cards-applies-to-polish.test.tsx"],
};

/** The records whose text the vector of `best` lists. */
export const BEST_SAMPLES = [0, 1, 7, 9, 11, 12, 21, 100] as const;

/** n answers, wrong on the given 1-based numbers. */
function wrongOn(n: number, ...numbers: number[]): boolean[] {
  return Array.from({ length: n }, (_, i) => !numbers.includes(i + 1));
}

/** A finished round of the mode as a result: answer i is right when right[i] is true (the cards cycle through SEC). */
function resultOf(mode: Mode, right: readonly boolean[]): RoundResult {
  const answers: Answered[] = right.map((correct, i) => {
    const card = FIXTURE_DECK.cards[i % 12];
    if (card === undefined) throw new Error("the fixture deck has no card");
    return { card, given: correct === card.answer, correct, at: 1000 + i };
  });
  return {
    mode,
    route: ROUTE,
    score: scoreOf(mode, answers),
    total: answers.length,
    answers,
    missed: answers.filter((answer) => !answer.correct),
    abandoned: false,
  };
}

function resultCopyFile(): GoldenFile {
  const copy = (name: string, mode: Mode, right: readonly boolean[], modeName: string, dealt: number, previousBest: number | null): GoldenCase => {
    const input = { result: resultOf(mode, right), modeName, dealt, previousBest };
    const { best, ...rest } = resultCopy(input.result, modeName, dealt, previousBest);
    const texts = Object.fromEntries(BEST_SAMPLES.map((record) => [String(record), best(record)]));
    return { name, input, output: { ...rest, best: texts } };
  };
  const streak = [...wrongOn(13), false];
  return goldenFile({ ...RESULT_COPY, function: "resultCopy" }, [
    copy("Classic: 7 of 10", "classic", wrongOn(10, 3, 6, 9), "Classic", 10, null),
    copy("Classic: a route with fewer cards than ten counts by its own length", "classic", [false], "Classic", 1, 1),
    copy("Classic: 10 of 10", "classic", wrongOn(10), "Classic", 10, 7),
    copy("Classic: 0 of 10", "classic", wrongOn(10, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10), "Classic", 10, null),
    copy("Streak: 13 right, then wrong, past a best of 12", "streak", streak, "Streak", 16, 12),
    copy("Streak: no previous best, no ring", "streak", streak, "Streak", 16, null),
    copy("Streak: a previous best of 0, no ring", "streak", streak, "Streak", 16, 0),
    copy("Streak: a previous best above the score, no ring", "streak", streak, "Streak", 16, 20),
    copy("Streak: a previous best equal to the score rings the last right card", "streak", streak, "Streak", 16, 13),
    copy("Streak: a previous best of 1 rings the first card", "streak", streak, "Streak", 16, 1),
    copy("Streak: wrong on the first card", "streak", [false], "Streak", 10, null),
    copy("Three lives: 21 cards, wrong on 6, 15 and 21", "lives", wrongOn(21, 6, 15, 21), "Three lives", 30, 21),
    copy("Three lives: three wrong answers in a row", "lives", wrongOn(3, 1, 2, 3), "Three lives", 30, null),
    copy("Timed: 17 answered, wrong on 4, 9 and 15", "timed", wrongOn(17, 4, 9, 15), "Timed", 20, 11),
    copy("Timed: nothing answered", "timed", [], "Timed", 10, null),
    copy("Timed: one right answer", "timed", [true], "Timed", 10, null),
    copy("Timed: every answer right", "timed", wrongOn(12), "Timed", 12, 12),
  ]);
}

/** A finished round of the mode on SEC, played as the result tests play it (seed 7, one answer after the other). */
function finishedRound(mode: Mode, right: readonly boolean[]): Played {
  const played = new Played(startArgs(mode, "SEC", 7));
  let now = 1_000_000;
  if (mode === "timed") played.tick(now);
  right.forEach((ok, i) => {
    const card = played.card();
    if (mode === "timed") {
      now += 100;
      played.send({ type: "answer", value: ok ? card.answer : !card.answer, at: now });
      now += TIMED.holdMs;
      played.tick(now);
    } else {
      played.send({ type: "answer", value: ok ? card.answer : !card.answer, at: 1000 + i });
      played.next();
    }
  });
  while (mode === "timed" && played.state.clock !== null && played.state.clock.remainingMs > 0) {
    now += TIMED.maxStepMs;
    played.tick(now);
  }
  if (mode === "timed") played.next();
  if (played.state.phase !== "finished") throw new Error("the round did not finish");
  return played;
}

const SEVEN_OF_TEN = [true, true, false, true, true, false, true, true, false, true];

function recordFile(): GoldenFile {
  const record = (name: string, played: Played, progress: Progress | null, calls: number): GoldenCase => {
    const data = new Map<string, string>();
    if (progress !== null) data.set(PROGRESS_KEY, JSON.stringify(progress));
    let writes = 0;
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        writes += 1;
        data.set(key, value);
      },
    };
    const store = createLocalStore(storage);
    const outcomes = Array.from({ length: calls }, () => recordRound(played.state, store));
    return {
      name,
      input: { ...played.trace(), progress, calls },
      output: { writes, sameOutcome: outcomes.every((outcome) => outcome === outcomes[0]), outcome: outcomes[0], stored: JSON.parse(data.get(PROGRESS_KEY) ?? "null") },
    };
  };
  const stored: Progress = { ...emptyProgress(), records: { "test-deck/SEC#classic": 9, "test-deck/SEC#streak": 2 } };
  return goldenFile({ ...RESULT_VIEW, function: "recordRound" }, [
    record("Classic 7 of 10: written once however often it is called", finishedRound("classic", SEVEN_OF_TEN), null, 2),
    record("Classic 7 of 10: called once", finishedRound("classic", SEVEN_OF_TEN), null, 1),
    record("Classic 7 of 10: called three times", finishedRound("classic", SEVEN_OF_TEN), null, 3),
    record("Classic 7 of 10 below a stored record of 9: the record stays", finishedRound("classic", SEVEN_OF_TEN), stored, 1),
    record("Streak 3 past a stored record of 2: a new record", finishedRound("streak", [true, true, true, false]), stored, 1),
    record("Three lives: three wrong answers among five", finishedRound("lives", [true, false, true, false, false]), null, 1),
    record("Timed: three answers and the minute run out", finishedRound("timed", [true, false, true]), null, 1),
  ]);
}

function missedFile(): GoldenFile {
  const [a, b, c] = FIXTURE_DECK.cards;
  const applied = FIXTURE_DECK.cards.find((card) => card.appliesTo !== "");
  if (a === undefined || b === undefined || c === undefined || applied === undefined) throw new Error("the fixture deck is too small");
  const answered = (card: Answered["card"], correct: boolean, at: number): Answered => ({ card, given: correct === card.answer, correct, at });
  const missed = (name: string, answers: Answered[]): GoldenCase => ({ name, input: { answers }, output: missedCards(answers) });
  const twelve = FIXTURE_DECK.cards.slice(0, 12).map((card, i) => answered(card, ![0, 9, 11].includes(i), 100 + i));
  return goldenFile({ ...MISSED, function: "missedCards" }, [
    missed("the wrong answers in order, numbered by their place in the round", [answered(a, true, 1), answered(b, false, 2), answered(c, false, 3)]),
    missed("a card with an appliesTo carries it, a card without one has none", [answered(applied, false, 1), answered(b, false, 2)]),
    missed("no answers", []),
    missed("every answer right", [answered(a, true, 1), answered(b, true, 2)]),
    missed("every answer wrong", [answered(a, false, 1), answered(b, false, 2), answered(c, false, 3)]),
    missed("wrong on cards 1, 10 and 12 of twelve", twelve),
    missed("the same card missed twice", [answered(a, false, 1), answered(b, true, 2), answered(a, false, 3)]),
  ]);
}

function constantFile(): GoldenFile {
  return goldenFile({ ...RESULT_VIEW, function: "RESULT_ARRIVES_MS" }, [{ name: "value", input: null, output: RESULT_ARRIVES_MS }]);
}

/** The files of this group: resultCopy, recordRound, RESULT_ARRIVES_MS, missedCards. */
export function resultGolden(): GoldenFile[] {
  return [resultCopyFile(), recordFile(), constantFile(), missedFile()];
}
```

Run the command of step 10. Expected: `Test Files  1 passed (1)`, `Tests  18 passed (18)`.

- [ ] **Step 12: Write the ticket test.**

`tests/scripts/native/golden-copy-ticket.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ticketFor } from "@/components/play/useRound";
import { TICKET_INDEX, ticketGolden } from "@/scripts/native/golden/copy-ticket";
import { findRoute, type RouteInIndex } from "@/src/content/schema";
import { byName, fileAt, view } from "./golden-view";

const FILES = ticketGolden();
const file = fileAt(FILES, "native-data/golden/components.play.useRound.ticketFor.json");

describe("ticketFor", () => {
  it("makes one file", () => {
    expect(FILES).toHaveLength(1);
    expect(view(file)).toMatchObject({ module: "components/play/useRound", function: "ticketFor", source: "components/play/useRound.ts" });
  });

  it("names the deck by its platform and title, or by its pass name when it has one (the pinned cases of useRound.test.tsx)", () => {
    expect((byName(file, "the platform and the deck title name the deck").output as { deckName: string }).deckName).toBe("AWS Test deck");
    expect((byName(file, "the deck's pass name wins when it has one").output as { deckName: string }).deckName).toBe("Amazon Test deck");
  });

  it("gives ALL and Whole deck for the whole deck, and the section id and title for a section", () => {
    expect(byName(file, "a shipped deck with a pass name and no sections is the whole deck").output).toEqual({
      deckCode: "CDL",
      deckName: "Google Cloud Digital Leader",
      sectionCode: "ALL",
      sectionName: "Whole deck",
      modeLabel: "Classic",
      best: null,
    });
    expect(byName(file, "a section of a shipped deck").output).toEqual({
      deckCode: "CLF",
      deckName: "AWS Cloud Practitioner",
      sectionCode: "BIL",
      sectionName: "Billing, pricing and support",
      modeLabel: "Classic",
      best: null,
    });
  });

  it("names the class and keeps the best, a best of 0 included", () => {
    expect(byName(file, "the whole deck of a deck with sections").output).toMatchObject({ sectionCode: "ALL", modeLabel: "Streak", best: 12 });
    expect(byName(file, "Three lives with a best").output).toMatchObject({ modeLabel: "Three lives", best: 21 });
    expect(byName(file, "Timed with a best of 0").output).toMatchObject({ modeLabel: "Timed", best: 0 });
  });

  it("every recorded output is what the function says on the recorded route", () => {
    for (const recorded of view(file).cases) {
      const input = recorded.input as { found: RouteInIndex; mode: "classic" | "streak" | "lives" | "timed"; best: number | null };
      expect(ticketFor(input.found, input.mode, input.best), recorded.name).toEqual(recorded.output);
      const route = { deckId: input.found.deck.id, sectionId: input.found.section?.id ?? "ALL" };
      expect(findRoute(TICKET_INDEX, route), recorded.name).toEqual(input.found);
    }
  });
});
```

```bash
npx -y pnpm@10.34.0 vitest run tests/scripts/native/golden-copy-ticket.test.ts
```

Expected: FAIL, `Cannot find package '@/scripts/native/golden/copy-ticket'`.

- [ ] **Step 13: Write the ticket producer.**

`scripts/native/golden/copy-ticket.ts`:

```ts
// Vectors for the ticket's route words (components/play/useRound.ts, ticketFor): the deck code, the deck's
// name on the pass, the section code and name, and the class name, taken from a route found in the deck index.
import { ticketFor } from "@/components/play/useRound";
import type { Mode } from "@/src/content/play";
import { findRoute, type DeckIndex, type Route } from "@/src/content/schema";
import { goldenFile, type GoldenCase, type GoldenFile } from "./format";

/** A small index in the shape of public/decks/index.json: two decks of the shipped catalog and the test deck of the web tests. */
export const TICKET_INDEX: DeckIndex = {
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
              cardCount: 214,
              version: "2026-10-01",
              hash: "hash-clf",
              sections: [
                { id: "CON", title: "Cloud concepts", cardCount: 60 },
                { id: "SEC", title: "Security and compliance", cardCount: 54 },
                { id: "TEC", title: "Cloud technology and services", cardCount: 60 },
                { id: "BIL", title: "Billing, pricing and support", cardCount: 40 },
              ],
            },
            {
              id: "test-deck",
              code: "TST",
              title: "Test deck",
              cardCount: 13,
              version: "2026-10-01",
              hash: "hash-1",
              sections: [
                { id: "SEC", title: "Security and compliance", cardCount: 12 },
                { id: "APP", title: "Applies to", cardCount: 1 },
              ],
            },
            {
              id: "test-named",
              code: "NAM",
              title: "Test deck",
              passName: "Amazon Test deck",
              cardCount: 12,
              version: "2026-10-01",
              hash: "hash-2",
              sections: [{ id: "SEC", title: "Security and compliance", cardCount: 12 }],
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
              hash: "hash-cdl",
              sections: [],
            },
          ],
        },
      ],
    },
  ],
};

function ticket(name: string, route: Route, mode: Mode, best: number | null): GoldenCase {
  const found = findRoute(TICKET_INDEX, route);
  if (found === null) throw new Error(`the index has no route ${route.deckId}/${route.sectionId}`);
  return { name, input: { found, mode, best }, output: ticketFor(found, mode, best) };
}

/** The file of this group: ticketFor. */
export function ticketGolden(): GoldenFile[] {
  return [
    goldenFile({ module: "components/play/useRound", function: "ticketFor", source: "components/play/useRound.ts", tests: ["tests/components/play/useRound.test.tsx"] }, [
      ticket("the platform and the deck title name the deck", { deckId: "test-deck", sectionId: "SEC" }, "classic", null),
      ticket("the deck's pass name wins when it has one", { deckId: "test-named", sectionId: "SEC" }, "classic", null),
      ticket("a shipped deck with a pass name and no sections is the whole deck", { deckId: "gcp-cdl", sectionId: "ALL" }, "classic", null),
      ticket("a section of a shipped deck", { deckId: "aws-clf-c02", sectionId: "BIL" }, "classic", null),
      ticket("the whole deck of a deck with sections", { deckId: "aws-clf-c02", sectionId: "ALL" }, "streak", 12),
      ticket("Three lives with a best", { deckId: "aws-clf-c02", sectionId: "CON" }, "lives", 21),
      ticket("Timed with a best of 0", { deckId: "test-deck", sectionId: "APP" }, "timed", 0),
    ]),
  ];
}
```

Run the command of step 12. Expected: `Test Files  1 passed (1)`, `Tests  5 passed (5)`.

- [ ] **Step 14: Write the copy group test.** It compares the files of the group with the registry's entries for these six modules (13 entries), checks that a constant has one case with a null input and a function none, that case names are unique, that a second run gives the same bytes, and that no file holds an em dash (built from its code point so this file has none), a local path or an e-mail-shaped string.

`tests/scripts/native/golden-copy.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { golden } from "@/scripts/native/golden/copy";
import { NATIVE_FUNCTIONS } from "@/scripts/native/registry";
import { view } from "./golden-view";

const COPY_MODULES = [
  "components/play/PlayScreen",
  "components/play/leave",
  "components/play/resultCopy",
  "components/play/ResultView",
  "components/MissedCards",
  "components/play/useRound",
];

const EM_DASH = String.fromCharCode(0x2014);

describe("the copy group", () => {
  const files = golden();

  it("has a vector file for every function and constant reference 3.9 lists for these modules, and no other", () => {
    const wanted = NATIVE_FUNCTIONS.filter((entry) => COPY_MODULES.includes(entry.module));
    expect(wanted).toHaveLength(13);
    const made = files.map((file) => `${view(file).module}.${view(file).function}`);
    expect([...made].sort()).toEqual(wanted.map((entry) => `${entry.module}.${entry.name}`).sort());
    for (const entry of wanted) {
      const file = files.find((candidate) => view(candidate).module === entry.module && view(candidate).function === entry.name);
      expect(file?.path, entry.name).toBe(`native-data/golden/${entry.module.replaceAll("/", ".")}.${entry.name}.json`);
      expect(view(file!).source, entry.name).toBe(entry.source);
      expect(view(file!).tests, entry.name).toEqual(expect.arrayContaining([...entry.tests]));
    }
  });

  it("gives a constant one case with a null input, and a function none", () => {
    for (const entry of NATIVE_FUNCTIONS.filter((candidate) => COPY_MODULES.includes(candidate.module))) {
      const file = files.find((candidate) => view(candidate).module === entry.module && view(candidate).function === entry.name);
      const cases = view(file!).cases;
      if (entry.kind === "constant") {
        expect(cases, entry.name).toHaveLength(1);
        expect(cases[0]?.input, entry.name).toBeNull();
      } else {
        expect(cases.length, entry.name).toBeGreaterThan(0);
        expect(cases.some((one) => one.input === null), entry.name).toBe(false);
      }
    }
  });

  it("names every case once, so a pinned case can be found by its name", () => {
    for (const file of files) {
      const names = view(file).cases.map((one) => one.name);
      expect(new Set(names).size, file.path).toBe(names.length);
    }
  });

  it("is byte-identical on a second run", () => {
    expect(golden()).toEqual(files);
  });

  it("holds no em dash, no local path and nothing shaped like an e-mail address", () => {
    for (const file of files) {
      expect(file.content, file.path).not.toContain(EM_DASH);
      expect(file.content, file.path).not.toMatch(/\/Users\/|\/home\/|[A-Za-z]:\\/);
      expect(file.content, file.path).not.toMatch(/\w@\w+\.\w/);
      expect(file.content.endsWith("}\n"), file.path).toBe(true);
    }
  });
});
```

```bash
npx -y pnpm@10.34.0 vitest run tests/scripts/native/golden-copy.test.ts
```

Expected: FAIL, `Cannot find package '@/scripts/native/golden/copy'`.

- [ ] **Step 15: Write the copy group.**

`scripts/native/golden/copy.ts`:

```ts
// The golden vectors of the copy group (reference 3.9): the play screen's words, leaving a round, the result,
// the missed cards and the ticket's route words. Each part has its own file next to this one.
import { leaveGolden } from "./copy-leave";
import { playGolden } from "./copy-play";
import { resultGolden } from "./copy-result";
import { ticketGolden } from "./copy-ticket";
import type { GoldenFile } from "./format";

export function golden(): GoldenFile[] {
  return [...playGolden(), ...leaveGolden(), ...resultGolden(), ...ticketGolden()];
}
```

Run the command of step 14. Expected: `Test Files  1 passed (1)`, `Tests  5 passed (5)`. If the first test fails on `expected [ ... ] to have a length of 13`, the registry's entries for these modules differ from the table under Interfaces; settle it with task 4.

- [ ] **Step 16: Commit.**

```bash
git add tests/scripts/native/golden-copy-result.test.ts tests/scripts/native/golden-copy-ticket.test.ts tests/scripts/native/golden-copy.test.ts scripts/native/golden/copy-result.ts scripts/native/golden/copy-ticket.ts scripts/native/golden/copy.ts
git commit -m "feat: export golden vectors for the result, the missed cards and the ticket's route words"
```

- [ ] **Step 17: Write the ticket scroll test.** It types in the cases of `ticketScroll.test.ts` and adds the boundaries around them.

`tests/scripts/native/golden-geometry-scroll.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { keyScroll, slipScroll, statementScroll } from "@/components/play/ticketScroll";
import { scrollGolden } from "@/scripts/native/golden/geometry-scroll";
import { byName, fileAt, outputFor, view } from "./golden-view";

const FILES = scrollGolden();
const at = (name: string) => fileAt(FILES, `native-data/golden/components.play.ticketScroll.${name}.json`);

describe("the ticket scroll vectors", () => {
  it("makes a file for each function and the step constant", () => {
    expect(FILES.map((file) => file.path)).toEqual(
      ["statementScroll", "slipScroll", "keyScroll", "ARROW_STEP"].map((name) => `native-data/golden/components.play.ticketScroll.${name}.json`),
    );
    expect(view(at("ARROW_STEP")).cases).toEqual([{ name: "value", input: null, output: 40 }]);
  });
});

describe("statementScroll (the pinned cases of ticketScroll.test.ts)", () => {
  const file = at("statementScroll");

  it("stays at the top when the text ends inside the visible stage, scrolls only as far as the end, starts a tall text at the top", () => {
    expect(outputFor(file, { text: { top: 230, bottom: 400 }, visible: 420 })).toBe(0);
    expect(outputFor(file, { text: { top: 230, bottom: 485 }, visible: 350 })).toBe(135);
    expect(outputFor(file, { text: { top: 230, bottom: 485 }, visible: 120 })).toBe(230);
  });
});

describe("slipScroll (the pinned cases of ticketScroll.test.ts)", () => {
  const file = at("slipScroll");
  const base = { top: 0, visible: 300, gap: 12, max: 340 };

  it("scrolls to the end of the ticket for a slip that fits, and stops at the top of a taller one", () => {
    expect(outputFor(file, { slip: { top: 500, bottom: 620 }, at: base })).toBe(340);
    expect(outputFor(file, { slip: { top: 300, bottom: 640 }, at: base })).toBe(300);
  });

  it("does not move a ticket that fits, nor one whose slip ends in the gap above the action row", () => {
    expect(outputFor(file, { slip: { top: 200, bottom: 300 }, at: { ...base, max: 0 } })).toBeNull();
    expect(outputFor(file, { slip: { top: 200, bottom: 303 }, at: { ...base, max: 3 } })).toBeNull();
    expect(outputFor(file, { slip: { top: 200, bottom: 312 }, at: base })).toBeNull();
    expect(outputFor(file, { slip: { top: 300, bottom: 452 }, at: { ...base, top: 140 } })).toBeNull();
  });

  it("scrolls once the slip runs under the action row itself, and back up to a slip above the stage", () => {
    expect(outputFor(file, { slip: { top: 200, bottom: 313 }, at: base })).toBe(200);
    expect(outputFor(file, { slip: { top: 200, bottom: 313 }, at: { ...base, max: 13 } })).toBe(13);
    expect(outputFor(file, { slip: { top: 100, bottom: 200 }, at: { ...base, top: 150 } })).toBe(100);
    expect(outputFor(file, { slip: { top: 200, bottom: 400 }, at: { ...base, max: 0 } })).toBe(0);
  });
});

describe("keyScroll (the pinned cases of ticketScroll.test.ts)", () => {
  const file = at("keyScroll");
  const middle = { top: 100, visible: 300, max: 600 };

  it("moves by a line, a page less a line, or to the ends", () => {
    const out = (key: string, shift: boolean) => outputFor(file, { key, shift, at: middle });
    expect(out("ArrowDown", false)).toBe(140);
    expect(out("ArrowUp", false)).toBe(60);
    expect(out("PageDown", false)).toBe(360);
    expect(out("PageUp", false)).toBe(0);
    expect(out(" ", false)).toBe(360);
    expect(out(" ", true)).toBe(0);
    expect(out("Home", false)).toBe(0);
    expect(out("End", false)).toBe(600);
  });

  it("stays inside the ticket", () => {
    expect(outputFor(file, { key: "ArrowDown", shift: false, at: { top: 590, visible: 300, max: 600 } })).toBe(600);
    expect(outputFor(file, { key: "ArrowUp", shift: false, at: { top: 10, visible: 300, max: 600 } })).toBe(0);
  });

  it("pages by at least a line on a tiny stage", () => {
    expect(outputFor(file, { key: "PageDown", shift: false, at: { top: 0, visible: 49, max: 600 } })).toBe(40);
  });

  it("leaves other keys, and Shift with anything but Space, alone", () => {
    expect(outputFor(file, { key: "ArrowLeft", shift: false, at: middle })).toBeNull();
    expect(outputFor(file, { key: "Enter", shift: false, at: middle })).toBeNull();
    expect(outputFor(file, { key: "ArrowDown", shift: true, at: middle })).toBeNull();
  });
});

describe("every recorded output is what the function says on the recorded input", () => {
  it("statementScroll, slipScroll and keyScroll", () => {
    for (const recorded of view(at("statementScroll")).cases) {
      const input = recorded.input as { text: { top: number; bottom: number }; visible: number };
      expect(statementScroll(input.text, input.visible), recorded.name).toBe(recorded.output);
    }
    for (const recorded of view(at("slipScroll")).cases) {
      const input = recorded.input as { slip: { top: number; bottom: number }; at: { top: number; visible: number; gap: number; max: number } };
      expect(slipScroll(input.slip, input.at), recorded.name).toBe(recorded.output);
    }
    for (const recorded of view(at("keyScroll")).cases) {
      const input = recorded.input as { key: string; shift: boolean; at: { top: number; visible: number; max: number } };
      expect(keyScroll(input.key, input.shift, input.at), recorded.name).toBe(recorded.output);
    }
    expect(byName(at("keyScroll"), "Space with Shift, in the middle").output).toBe(0);
  });
});
```

```bash
npx -y pnpm@10.34.0 vitest run tests/scripts/native/golden-geometry-scroll.test.ts
```

Expected: FAIL, `Cannot find package '@/scripts/native/golden/geometry-scroll'`.

- [ ] **Step 18: Write the ticket scroll producer.** `keyScroll` is run for twelve keys, with and without Shift, on four stages (in the middle, near the end, near the top, a tiny stage): 96 cases.

`scripts/native/golden/geometry-scroll.ts`:

```ts
// Vectors for where the play screen scrolls its ticket (components/play/ticketScroll.ts): pure arithmetic
// on numbers, with the spans and the scroll position given as objects.
import { ARROW_STEP, keyScroll, slipScroll, statementScroll } from "@/components/play/ticketScroll";
import { goldenFile, type GoldenCase, type GoldenFile } from "./format";

const MODULE = "components/play/ticketScroll";
const SOURCE = "components/play/ticketScroll.ts";
const TESTS = ["tests/components/play/ticketScroll.test.ts"] as const;

const meta = (name: string) => ({ module: MODULE, function: name, source: SOURCE, tests: TESTS });

type Span = { top: number; bottom: number };
type SlipAt = { top: number; visible: number; gap: number; max: number };

function statementFile(): GoldenFile {
  const text = (name: string, span: Span, visible: number): GoldenCase => ({ name, input: { text: span, visible }, output: statementScroll(span, visible) });
  return goldenFile(meta("statementScroll"), [
    text("the text ends inside the visible stage: nothing moves", { top: 230, bottom: 400 }, 420),
    text("scrolls only as far as lets the text end at the bottom of the visible stage", { top: 230, bottom: 485 }, 350),
    text("a text taller than the stage starts at the top of the stage", { top: 230, bottom: 485 }, 120),
    text("the text ends exactly at the bottom of the stage", { top: 230, bottom: 420 }, 420),
    text("the text ends one pixel below the stage", { top: 230, bottom: 421 }, 420),
    text("the text starts at the top of the ticket", { top: 0, bottom: 500 }, 300),
    text("the text is as tall as the stage and starts below the top", { top: 100, bottom: 400 }, 300),
    text("a stage of nothing", { top: 50, bottom: 80 }, 0),
    text("fractional pixels", { top: 230.5, bottom: 485.25 }, 350.75),
  ]);
}

function slipFile(): GoldenFile {
  const slip = (name: string, span: Span, at: SlipAt): GoldenCase => ({ name, input: { slip: span, at }, output: slipScroll(span, at) });
  // A stage 300 tall at the top of the ticket, then the 12 px gap above the action row; the ticket scrolls to 340.
  const base: SlipAt = { top: 0, visible: 300, gap: 12, max: 340 };
  return goldenFile(meta("slipScroll"), [
    slip("scrolls to the end of the ticket when the slip fits the stage", { top: 500, bottom: 620 }, base),
    slip("stops at the top of a slip taller than the stage", { top: 300, bottom: 640 }, base),
    slip("does not move a ticket that fits", { top: 200, bottom: 300 }, { ...base, max: 0 }),
    slip("does not move the ticket when the slip ends in the gap: 3 px of scroll", { top: 200, bottom: 303 }, { ...base, max: 3 }),
    slip("does not move the ticket when the slip ends exactly at the end of the gap", { top: 200, bottom: 312 }, base),
    slip("does not move the ticket when the scroll is 140 and the slip ends in the gap", { top: 300, bottom: 452 }, { ...base, top: 140 }),
    slip("scrolls once the slip runs one pixel under the action row", { top: 200, bottom: 313 }, base),
    slip("scrolls to the largest scroll when that is above the slip's top", { top: 200, bottom: 313 }, { ...base, max: 13 }),
    slip("scrolls back up to a slip that starts above the stage", { top: 100, bottom: 200 }, { ...base, top: 150 }),
    slip("stays at 0 when there is nothing to scroll", { top: 200, bottom: 400 }, { ...base, max: 0 }),
    slip("a slip that starts exactly at the top of the stage is in view", { top: 150, bottom: 300 }, { ...base, top: 150 }),
    slip("a slip that starts one pixel above the stage is scrolled to", { top: 149, bottom: 300 }, { ...base, top: 150 }),
    slip("no gap", { top: 200, bottom: 301 }, { ...base, gap: 0 }),
  ]);
}

const KEYS = [" ", "ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", "ArrowLeft", "ArrowRight", "Enter", "Tab", "a"];

function keyFile(): GoldenFile {
  const stages: { label: string; at: { top: number; visible: number; max: number } }[] = [
    { label: "in the middle", at: { top: 100, visible: 300, max: 600 } },
    { label: "near the end", at: { top: 590, visible: 300, max: 600 } },
    { label: "near the top", at: { top: 10, visible: 300, max: 600 } },
    { label: "on a tiny stage", at: { top: 0, visible: 49, max: 600 } },
  ];
  const cases: GoldenCase[] = [];
  for (const { label, at } of stages) {
    for (const key of KEYS) {
      for (const shift of [false, true]) {
        cases.push({ name: `${key === " " ? "Space" : key}${shift ? " with Shift" : ""}, ${label}`, input: { key, shift, at }, output: keyScroll(key, shift, at) });
      }
    }
  }
  return goldenFile(meta("keyScroll"), cases);
}

/** The files of this group: statementScroll, slipScroll, keyScroll, ARROW_STEP. */
export function scrollGolden(): GoldenFile[] {
  return [statementFile(), slipFile(), keyFile(), goldenFile(meta("ARROW_STEP"), [{ name: "value", input: null, output: ARROW_STEP }])];
}
```

Run the command of step 17. Expected: `Test Files  1 passed (1)`, `Tests  10 passed (10)`.

- [ ] **Step 19: Write the flight path test.** It types in the pins of `FlightPath.test.tsx`: the curve points, `flownPath`, the heading signs, the waypoint states, the labels and the radii of the completed scale.

`tests/scripts/native/golden-geometry-path.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  cardList,
  completedLabel,
  completedScale,
  flightPathLabel,
  flownPath,
  headingAt,
  pointAt,
  waypointStates,
  waypointT,
} from "@/components/FlightPath";
import { curveParameters, pathGolden } from "@/scripts/native/golden/geometry-path";
import { fileAt, outputFor, view } from "./golden-view";

const FILES = pathGolden();
const at = (name: string) => fileAt(FILES, `native-data/golden/components.FlightPath.${name}.json`);

describe("the flight path vectors", () => {
  it("makes a file for each of the nine functions", () => {
    expect(FILES.map((file) => file.path)).toEqual(
      ["pointAt", "waypointT", "flownPath", "headingAt", "waypointStates", "cardList", "flightPathLabel", "completedLabel", "completedScale"].map(
        (name) => `native-data/golden/components.FlightPath.${name}.json`,
      ),
    );
    for (const file of FILES) expect(view(file).tests).toEqual(["tests/components/FlightPath.test.tsx", "tests/components/FlightPath-polish.test.tsx"]);
  });

  it("visits the ends, the quarters, the middle and the waypoints of routes of 2 to 60 cards", () => {
    const values = curveParameters();
    expect(values[0]).toBe(0);
    expect(values.at(-1)).toBe(1);
    for (const t of [0.25, 0.5, 0.75, waypointT(3, 10), waypointT(11, 14), waypointT(59, 60)]) expect(values).toContain(t);
    expect(new Set(values).size).toBe(values.length);
    expect(view(at("pointAt")).cases).toHaveLength(values.length);
  });
});

describe("the curve (the pinned cases of FlightPath.test.tsx)", () => {
  it("runs along M6 24 Q138 -6 270 24, waypoints evenly spread in t", () => {
    expect(outputFor(at("pointAt"), { t: 0 })).toEqual({ x: 6, y: 24 });
    expect(outputFor(at("pointAt"), { t: 1 })).toEqual({ x: 270, y: 24 });
    expect(outputFor(at("pointAt"), { t: 0.5 })).toEqual({ x: 138, y: 9 });
    expect(outputFor(at("waypointT"), { i: 0, n: 10 })).toBe(0);
    expect(outputFor(at("waypointT"), { i: 9, n: 10 })).toBe(1);
    expect(outputFor(at("waypointT"), { i: 3, n: 10 })).toBeCloseTo(1 / 3);
    expect(outputFor(at("waypointT"), { i: 0, n: 1 })).toBe(0);
  });

  it("draws the flown part as the same curve cut at the plane", () => {
    expect(outputFor(at("flownPath"), { t: 1 })).toBe("M6 24 Q138 -6 270 24");
    expect(outputFor(at("flownPath"), { t: 0.5 })).toBe("M6 24 Q72 9 138 9");
  });

  it("points the plane along the curve: climbing at the start, level in the middle, descending at the end", () => {
    expect(outputFor(at("headingAt"), { t: 0 }) as number).toBeLessThan(0);
    expect(outputFor(at("headingAt"), { t: 0.5 })).toBe(0);
    expect(outputFor(at("headingAt"), { t: 1 }) as number).toBeGreaterThan(0);
  });

  it("every recorded output is what the function says for the recorded t", () => {
    for (const [name, run] of [["pointAt", pointAt], ["flownPath", flownPath], ["headingAt", headingAt]] as const) {
      for (const recorded of view(at(name)).cases) expect(run((recorded.input as { t: number }).t), `${name} ${recorded.name}`).toEqual(recorded.output);
    }
    for (const recorded of view(at("waypointT")).cases) {
      const { i, n } = recorded.input as { i: number; n: number };
      expect(waypointT(i, n), recorded.name).toBe(recorded.output);
    }
  });
});

describe("waypointStates (the pinned cases of FlightPath.test.tsx)", () => {
  const file = at("waypointStates");

  it("marks answered cards correct or wrong, the card on screen current, the rest future", () => {
    expect(outputFor(file, { total: 5, results: [true, false], current: 2, answered: false })).toEqual(["correct", "wrong", "current", "future", "future"]);
  });

  it("shows the card on screen with its own mark once it is answered", () => {
    expect(outputFor(file, { total: 4, results: [true, false, false], current: 2, answered: true })).toEqual(["correct", "wrong", "wrong", "future"]);
  });

  it("every recorded output is what the function says", () => {
    for (const recorded of view(file).cases) {
      const input = recorded.input as { total: number; results: boolean[]; current: number; answered: boolean };
      expect(waypointStates(input.total, input.results, input.current, input.answered), recorded.name).toEqual(recorded.output);
    }
  });
});

describe("the labels (the pinned cases of FlightPath.test.tsx)", () => {
  it("flightPathLabel is one full sentence with the card numbers of each verdict", () => {
    const file = at("flightPathLabel");
    expect(outputFor(file, { total: 10, results: [true, true, false], current: 3 })).toBe("Card 4 of 10. Cards 1 and 2 correct, card 3 wrong.");
    expect(outputFor(file, { total: 10, results: [false, true, true, true], current: 4 })).toBe("Card 5 of 10. Cards 2, 3 and 4 correct, card 1 wrong.");
    expect(outputFor(file, { total: 10, results: [], current: 0 })).toBe("Card 1 of 10.");
    for (const recorded of view(file).cases) {
      const input = recorded.input as { total: number; results: boolean[]; current: number };
      expect(flightPathLabel(input.total, input.results, input.current), recorded.name).toBe(recorded.output);
    }
  });

  it("completedLabel names the finished round and lists the missed cards", () => {
    const file = at("completedLabel");
    const results = [true, true, false, true, true, false, true, true, false, true];
    expect(outputFor(file, { total: 10, results })).toBe("Round complete. 10 of 10 cards. 7 correct, 3 wrong: cards 3, 6 and 9.");
    expect(outputFor(file, { total: 10, results: results.map(() => true) })).toBe("Round complete. 10 of 10 cards. 10 correct, 0 wrong.");
    expect(outputFor(file, { total: 3, results: [true, false, false] })).toBe("Round complete. 3 of 3 cards. 1 correct, 2 wrong: cards 2 and 3.");
    for (const recorded of view(file).cases) {
      const input = recorded.input as { total: number; results: boolean[] };
      expect(completedLabel(input.total, input.results), recorded.name).toBe(recorded.output);
    }
  });

  it("cardList reads one, two and many cards", () => {
    const file = at("cardList");
    expect(outputFor(file, { numbers: [3] })).toBe("card 3");
    expect(outputFor(file, { numbers: [1, 2] })).toBe("cards 1 and 2");
    expect(outputFor(file, { numbers: [1, 2, 5] })).toBe("cards 1, 2 and 5");
    for (const recorded of view(file).cases) expect(cardList((recorded.input as { numbers: number[] }).numbers), recorded.name).toBe(recorded.output);
  });
});

describe("completedScale (the pinned radii of FlightPath.test.tsx)", () => {
  it("scales the marks so that they never touch", () => {
    const file = at("completedScale");
    const expected: [number, number][] = [
      [10, 7],
      [11, 6],
      [14, 6],
      [17, 6],
      [18, 5.435],
      [21, 4.62],
      [60, 1.566],
    ];
    for (const [cards, radius] of expected) expect(7 * (outputFor(file, { cards }) as number)).toBeCloseTo(radius, 2);
    for (const recorded of view(file).cases) expect(completedScale((recorded.input as { cards: number }).cards), recorded.name).toBe(recorded.output);
  });
});
```

```bash
npx -y pnpm@10.34.0 vitest run tests/scripts/native/golden-geometry-path.test.ts
```

Expected: FAIL, `Cannot find package '@/scripts/native/golden/geometry-path'`.

- [ ] **Step 20: Write the flight path producer.** The curve functions are run at every t the app uses: the waypoints of routes of 2, 3, 5, 10, 14, 21 and 60 cards, the quarters of the Timed minute, the Streak step 12/13.6 and a few clock moments (103 distinct values).

`scripts/native/golden/geometry-path.ts`:

```ts
// Vectors for the flight path (components/FlightPath.tsx): the curve and the plane on it, the state of every
// waypoint, the card lists and the two sentences that name the header, and the scale of a completed route.
import {
  cardList,
  completedLabel,
  completedScale,
  flightPathLabel,
  flownPath,
  headingAt,
  pointAt,
  waypointStates,
  waypointT,
} from "@/components/FlightPath";
import { goldenFile, type GoldenCase, type GoldenFile } from "./format";

const MODULE = "components/FlightPath";
const SOURCE = "components/FlightPath.tsx";
const TESTS = ["tests/components/FlightPath.test.tsx", "tests/components/FlightPath-polish.test.tsx"] as const;

const meta = (name: string) => ({ module: MODULE, function: name, source: SOURCE, tests: TESTS });

/** The routes whose waypoints the vectors visit: one waypoint for each card of these lengths. */
export const ROUTE_LENGTHS = [2, 3, 5, 10, 14, 21, 60] as const;

/** Every t the app uses: the waypoints of the routes above, the quarters of the Timed minute and a few clock moments. */
export function curveParameters(): number[] {
  const values = new Set<number>([0, 0.25, 0.5, 0.75, 1, 12 / 13.6]);
  for (const n of ROUTE_LENGTHS) for (let i = 0; i < n; i += 1) values.add(waypointT(i, n));
  for (const remaining of [60_000, 41_000, 40_001, 30_000, 1]) values.add(Math.min(1, Math.max(0, 1 - remaining / 60_000)));
  return [...values].sort((a, b) => a - b);
}

function onCurve(name: string, run: (t: number) => unknown): GoldenFile {
  return goldenFile(
    meta(name),
    curveParameters().map((t): GoldenCase => ({ name: `t = ${t}`, input: { t }, output: run(t) })),
  );
}

function waypointTFile(): GoldenFile {
  const cases: GoldenCase[] = [{ name: "a route of no cards", input: { i: 0, n: 0 }, output: waypointT(0, 0) }];
  for (const n of [1, ...ROUTE_LENGTHS]) {
    for (let i = 0; i < n; i += 1) cases.push({ name: `waypoint ${i} of ${n}`, input: { i, n }, output: waypointT(i, n) });
  }
  return goldenFile(meta("waypointT"), cases);
}

function statesFile(): GoldenFile {
  const states = (name: string, total: number, results: boolean[], current: number, answered: boolean): GoldenCase => ({
    name,
    input: { total, results, current, answered },
    output: waypointStates(total, results, current, answered),
  });
  return goldenFile(meta("waypointStates"), [
    states("answered cards are correct or wrong, the card on screen current, the rest future", 5, [true, false], 2, false),
    states("the card on screen shows its own mark once it is answered", 4, [true, false, false], 2, true),
    states("before the first answer", 10, [], 0, false),
    states("the last card answered", 3, [true, false, true], 2, true),
    states("a verdict missing before the card on screen reads as future", 4, [true], 2, false),
    states("more cards answered than the route has", 3, [true, true, true, true], 3, false),
    states("a route of no cards", 0, [], 0, false),
    states("a question on the last card", 10, [true, true, true, true, true, true, true, true, true], 9, false),
  ]);
}

function cardListFile(): GoldenFile {
  const list = (numbers: number[]): GoldenCase => ({ name: `cards ${numbers.join(" ")}`, input: { numbers }, output: cardList(numbers) });
  return goldenFile(meta("cardList"), [list([3]), list([1, 2]), list([1, 2, 5]), list([1, 2, 3, 4]), list([6, 15, 21]), list([10, 11, 12, 13, 14, 15])]);
}

function labelFile(): GoldenFile {
  const label = (name: string, total: number, results: boolean[], current: number): GoldenCase => ({
    name,
    input: { total, results, current },
    output: flightPathLabel(total, results, current),
  });
  const run = (length: number, ...wrongOn: number[]) => Array.from({ length }, (_, i) => !wrongOn.includes(i + 1));
  return goldenFile(meta("flightPathLabel"), [
    label("one full sentence with the card numbers of each verdict", 10, [true, true, false], 3),
    label("wrong first, then right", 10, [false, true, true, true], 4),
    label("only where the round is before the first answer", 10, [], 0),
    label("nine right answers", 10, run(9), 9),
    label("two wrong answers on a short route", 3, [false, false], 2),
    label("a route of one card", 1, [], 0),
    label("a long round with three wrong cards", 21, run(20, 6, 15), 20),
  ]);
}

function completedLabelFile(): GoldenFile {
  const label = (name: string, total: number, results: boolean[]): GoldenCase => ({ name, input: { total, results }, output: completedLabel(total, results) });
  const run = (length: number, ...wrongOn: number[]) => Array.from({ length }, (_, i) => !wrongOn.includes(i + 1));
  return goldenFile(meta("completedLabel"), [
    label("names the finished round and lists the missed cards", 10, run(10, 3, 6, 9)),
    label("every card right", 10, run(10)),
    label("three cards, two wrong", 3, [true, false, false]),
    label("a route of no cards", 0, []),
    label("one card, wrong", 1, [false]),
    label("a route not played to the end", 10, []),
    label("fourteen cards, the last one wrong", 14, run(14, 14)),
  ]);
}

function scaleFile(): GoldenFile {
  const cards = [0, 1, 9, 10, 11, 14, 16, 17, 18, 19, 21, 30, 41, 58, 60, 100, 120, 200];
  return goldenFile(
    meta("completedScale"),
    cards.map((count): GoldenCase => ({ name: `${count} cards`, input: { cards: count }, output: completedScale(count) })),
  );
}

/** The files of this group: the nine functions of FlightPath.tsx the native apps port. */
export function pathGolden(): GoldenFile[] {
  return [
    onCurve("pointAt", pointAt),
    waypointTFile(),
    onCurve("flownPath", flownPath),
    onCurve("headingAt", headingAt),
    statesFile(),
    cardListFile(),
    labelFile(),
    completedLabelFile(),
    scaleFile(),
  ];
}
```

Run the command of step 19. Expected: `Test Files  1 passed (1)`, `Tests  13 passed (13)`.

- [ ] **Step 21: Commit.**

```bash
git add tests/scripts/native/golden-geometry-scroll.test.ts tests/scripts/native/golden-geometry-path.test.ts scripts/native/golden/geometry-scroll.ts scripts/native/golden/geometry-path.ts
git commit -m "feat: export golden vectors for the ticket scroll and the flight path"
```

- [ ] **Step 22: Write the headers test.** It types in the tables of `StreakPath.test.tsx`, `StreakPath-polish.test.tsx`, `LivesPath.test.tsx` and `TimedPath.test.tsx`.

`tests/scripts/native/golden-geometry-headers.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { pointAt } from "@/components/FlightPath";
import { livesLabel, trailLayout } from "@/components/LivesPath";
import { streakLabel, streakLayout } from "@/components/StreakPath";
import { clockText, timedLabel } from "@/components/TimedPath";
import { headersGolden } from "@/scripts/native/golden/geometry-headers";
import { byName, fileAt, outputFor, view } from "./golden-view";

const FILES = headersGolden();
const at = (module: string, name: string) => fileAt(FILES, `native-data/golden/components.${module}.${name}.json`);

type Layout = { dot: number; ticks: boolean; ring: number | null; target: boolean; future: number[]; t: Record<string, number> };
type Trail = { r: number; side: number; cross: boolean; x: Record<string, number> };

describe("the header vectors", () => {
  it("makes a file for each of the six functions", () => {
    expect(FILES.map((file) => file.path)).toEqual([
      "native-data/golden/components.StreakPath.streakLayout.json",
      "native-data/golden/components.StreakPath.streakLabel.json",
      "native-data/golden/components.LivesPath.trailLayout.json",
      "native-data/golden/components.LivesPath.livesLabel.json",
      "native-data/golden/components.TimedPath.clockText.json",
      "native-data/golden/components.TimedPath.timedLabel.json",
    ]);
  });
});

describe("streakLayout (the pinned cases of StreakPath.test.tsx and StreakPath-polish.test.tsx)", () => {
  const file = at("StreakPath", "streakLayout");
  const layout = (done: number, best: number | null) => outputFor(file, { done, best }) as Layout;

  it("spaces the slots 24 px apart and ends on the ring when the best is 12", () => {
    const out = layout(8, 12);
    expect([0, 1, 8, 11].map((slot) => pointAt(out.t[String(slot)] ?? Number.NaN).x)).toEqual([6, 30, 198, 270]);
    expect(out).toMatchObject({ dot: 6, ticks: true, ring: 11, target: true, future: [9, 10] });
  });

  it("ends on the ring for any best: three slots for a best of 3", () => {
    const out = layout(1, 3);
    expect([0, 1, 2].map((slot) => out.t[String(slot)])).toEqual([0, 0.5, 1]);
    expect(out).toMatchObject({ ring: 2, target: true, future: [] });
  });

  it("keeps the plane on the ring slot while the next right answer would equal the best", () => {
    expect(layout(11, 12)).toMatchObject({ target: true, future: [] });
    expect(layout(11, 12).t["11"]).toBe(1);
  });

  it("runs on into open sky at and past the best", () => {
    expect(layout(12, 12)).toMatchObject({ ring: 11, target: false, future: [], dot: 6 });
    expect(layout(12, 12).t["12"]).toBeCloseTo(12 / 13.6, 5);
  });

  it("has no ring without a best, and a best of 1 on the first slot", () => {
    expect(layout(0, null)).toMatchObject({ ring: null, target: false, future: [], dot: 6 });
    expect(layout(0, null).t["0"]).toBe(0);
    expect(layout(0, 1)).toMatchObject({ ring: 0, target: true, future: [] });
    expect(layout(0, 1).t["0"]).toBe(0);
  });

  it("shrinks the dots of a long streak and drops their ticks", () => {
    expect(layout(40, 12)).toMatchObject({ dot: 2, ticks: false });
    expect(layout(13, 40)).toMatchObject({ dot: 2.1, ticks: false, target: true });
  });

  it("every recorded output is what the function says, at the probe points the output names", () => {
    for (const recorded of view(file).cases) {
      const { done, best } = recorded.input as { done: number; best: number | null };
      const made = streakLayout(done, best);
      const out = recorded.output as Layout;
      expect({ dot: out.dot, ticks: out.ticks, ring: out.ring, target: out.target, future: out.future }, recorded.name).toEqual({
        dot: made.dot,
        ticks: made.ticks,
        ring: made.ring,
        target: made.target,
        future: made.future,
      });
      expect(Object.keys(out.t).length, recorded.name).toBeGreaterThanOrEqual(3);
      for (const [slot, value] of Object.entries(out.t)) expect(made.t(Number(slot)), `${recorded.name} slot ${slot}`).toBe(value);
    }
  });
});

describe("streakLabel (the pinned table of StreakPath.test.tsx)", () => {
  const file = at("StreakPath", "streakLabel");

  it.each([
    [8, 12, false, "Streak of 8 correct answers. Your best on this route is 12."],
    [12, 12, false, "Streak of 12 correct answers, equal to your best on this route."],
    [13, 12, false, "Streak of 13 correct answers. New best on this route, previous best 12."],
    [1, null, false, "Streak of 1 correct answer."],
    [0, null, false, "Streak of 0 correct answers."],
    [8, 12, true, "Streak ended at 8. Your best on this route is 12."],
    [12, 12, true, "Streak ended at 12, equal to your best on this route."],
    [13, 12, true, "Streak ended at 13. New best on this route, previous best 12."],
    [3, null, true, "Streak ended at 3."],
    [0, 0, false, "Streak of 0 correct answers."],
    [1, 0, false, "Streak of 1 correct answer."],
    [0, 0, true, "Streak ended at 0."],
  ])("streak %s, best %s, ended %s", (streak, best, ended, text) => {
    expect(outputFor(file, { streak, best, ended })).toBe(text);
  });

  it("every recorded output is what the function says", () => {
    for (const recorded of view(file).cases) {
      const { streak, best, ended } = recorded.input as { streak: number; best: number | null; ended: boolean };
      expect(streakLabel(streak, best, ended), recorded.name).toBe(recorded.output);
    }
  });
});

describe("trailLayout (the pinned cases of LivesPath.test.tsx)", () => {
  const file = at("LivesPath", "trailLayout");
  const trail = (marks: number) => outputFor(file, { marks }) as Trail;

  it("has a case for every number of marks from 0 to 200", () => {
    expect(view(file).cases.map((recorded) => (recorded.input as { marks: number }).marks)).toEqual(Array.from({ length: 201 }, (_, i) => i));
  });

  it("keeps 9 px between marks and the newest at x 219, up to 14 marks", () => {
    const out = trail(14);
    expect([out.x["0"], out.x["1"], out.x["13"]]).toEqual([102, 111, 219]);
    expect(out).toMatchObject({ r: 2.6, side: 9, cross: true });
    expect(trail(1).x["0"]).toBe(219);
    expect(trail(3).x["0"]).toBe(201);
  });

  it("squeezes more marks between x 100 and x 219", () => {
    const out = trail(20);
    expect([out.x["0"], out.x["1"], out.x["19"]]).toEqual([100, 106.3, 219]);
    expect(out).toMatchObject({ r: 2.2, side: 8, cross: true });
  });

  it("keeps a wrong mark a square with its x however long the round", () => {
    expect(trail(60)).toMatchObject({ r: 0.9, side: 6, cross: true });
    for (let marks = 15; marks <= 200; marks += 1) {
      expect(trail(marks).cross, `${marks} marks`).toBe(true);
      expect(trail(marks).side, `${marks} marks`).toBeGreaterThanOrEqual(6);
    }
  });

  it("every recorded output is what the function says, at the probe points the output names", () => {
    for (const recorded of view(file).cases) {
      const { marks } = recorded.input as { marks: number };
      const made = trailLayout(marks);
      const out = recorded.output as Trail;
      expect({ r: out.r, side: out.side, cross: out.cross }, recorded.name).toEqual({ r: made.r, side: made.side, cross: made.cross });
      const probes = [...new Set([0, 1, 2, Math.floor(marks / 2), marks - 2, marks - 1])].filter((index) => index >= 0 && index < marks).sort((a, b) => a - b);
      expect(Object.keys(out.x).map(Number), recorded.name).toEqual(probes);
      for (const [index, value] of Object.entries(out.x)) expect(made.x(Number(index)), `${recorded.name} mark ${index}`).toBe(value);
    }
  });
});

describe("livesLabel (the pinned table of LivesPath.test.tsx)", () => {
  const file = at("LivesPath", "livesLabel");
  const round = (n: number, ...wrongOn: number[]) => Array.from({ length: n }, (_, i) => !wrongOn.includes(i + 1));

  it.each([
    [[], 0, "3 of 3 lives left. No cards answered yet."],
    [[], 1, "3 of 3 lives left. 1 card answered."],
    [[], 5, "3 of 3 lives left. 5 cards answered."],
    [[6], 14, "2 of 3 lives left. 14 cards answered, card 6 was wrong."],
    [[6, 15], 20, "1 of 3 lives left. 20 cards answered, cards 6 and 15 were wrong."],
    [[6, 15, 21], 21, "No lives left. The round is over after 21 cards: cards 6, 15 and 21 were wrong."],
  ])("wrong on %j of %i", (wrongAt, n, text) => {
    expect(outputFor(file, { results: round(n, ...wrongAt) })).toBe(text);
  });

  it("every recorded output is what the function says", () => {
    for (const recorded of view(file).cases) expect(livesLabel((recorded.input as { results: boolean[] }).results), recorded.name).toBe(recorded.output);
  });
});

describe("clockText (the pinned table of TimedPath.test.tsx)", () => {
  const file = at("TimedPath", "clockText");

  it.each([
    [60_000, "1:00"],
    [59_999, "1:00"],
    [59_000, "0:59"],
    [40_001, "0:41"],
    [41_000, "0:41"],
    [1, "0:01"],
    [0, "0:00"],
  ])("%i ms reads %s", (remainingMs, text) => {
    expect(outputFor(file, { remainingMs })).toBe(text);
  });

  it("reads whole seconds rounded up, and never less than 0:00", () => {
    expect(outputFor(file, { remainingMs: 1_001 })).toBe("0:02");
    expect(outputFor(file, { remainingMs: -5_000 })).toBe("0:00");
    expect(outputFor(file, { remainingMs: 125_000 })).toBe("2:05");
    for (const recorded of view(file).cases) expect(clockText((recorded.input as { remainingMs: number }).remainingMs), recorded.name).toBe(recorded.output);
  });
});

describe("timedLabel (the pinned table of TimedPath.test.tsx)", () => {
  const file = at("TimedPath", "timedLabel");

  it.each([
    [41_000, 9, 2, "41 seconds left of 60. 9 correct, 2 wrong."],
    [60_000, 0, 0, "60 seconds left of 60. 0 correct, 0 wrong."],
    [900, 3, 0, "1 second left of 60. 3 correct, 0 wrong."],
    [0, 14, 3, "Time is up. 17 cards answered: 14 correct, 3 wrong."],
    [0, 1, 0, "Time is up. 1 card answered: 1 correct, 0 wrong."],
  ])("%i ms, %i correct, %i wrong", (remainingMs, correct, wrong, text) => {
    expect(outputFor(file, { remainingMs, correct, wrong })).toBe(text);
  });

  it("every recorded output is what the function says", () => {
    for (const recorded of view(file).cases) {
      const { remainingMs, correct, wrong } = recorded.input as { remainingMs: number; correct: number; wrong: number };
      expect(timedLabel(remainingMs, correct, wrong), recorded.name).toBe(recorded.output);
    }
    expect(byName(file, "-5 ms, 3 correct, 1 wrong").output).toBe("Time is up. 4 cards answered: 3 correct, 1 wrong.");
  });
});
```

```bash
npx -y pnpm@10.34.0 vitest run tests/scripts/native/golden-geometry-headers.test.ts
```

Expected: FAIL, `Cannot find package '@/scripts/native/golden/geometry-headers'`.

- [ ] **Step 23: Write the headers producer.** The layout functions are functions in the web code; their vectors list the values at the probe points named in Rule 5.

`scripts/native/golden/geometry-headers.ts`:

```ts
// Vectors for the headers of the unbounded modes and Timed: where the Streak dots sit and how the header is
// named (components/StreakPath.tsx), where the Three lives trail sits and how it is named
// (components/LivesPath.tsx), and the Timed clock and its name (components/TimedPath.tsx).
// A layout is a function in the web code, so its vector lists the values of the function at the probe
// points named in the output: a native layout is checked at the same points.
import { livesLabel, trailLayout } from "@/components/LivesPath";
import { streakLabel, streakLayout } from "@/components/StreakPath";
import { clockText, timedLabel } from "@/components/TimedPath";
import { goldenFile, type GoldenCase, type GoldenFile } from "./format";

const STREAK = { module: "components/StreakPath", source: "components/StreakPath.tsx", tests: ["tests/components/StreakPath.test.tsx", "tests/components/StreakPath-polish.test.tsx"] };
const LIVES = { module: "components/LivesPath", source: "components/LivesPath.tsx", tests: ["tests/components/LivesPath.test.tsx", "tests/components/LivesPath-polish.test.tsx"] };
const TIMED = { module: "components/TimedPath", source: "components/TimedPath.tsx", tests: ["tests/components/TimedPath.test.tsx", "tests/components/TimedPath-polish.test.tsx"] };

/** The values of `at` at the given indexes, as an object keyed by index (ascending), indexes outside 0 to limit - 1 left out. */
function probed(indexes: readonly number[], limit: number, at: (index: number) => number): Record<string, number> {
  const kept = [...new Set(indexes)].filter((index) => Number.isInteger(index) && index >= 0 && index < limit).sort((a, b) => a - b);
  return Object.fromEntries(kept.map((index) => [String(index), at(index)]));
}

/** [done, best] pairs: the pinned ones of StreakPath.test.tsx and StreakPath-polish.test.tsx, then the edges around them. */
const LAYOUTS: readonly (readonly [number, number | null])[] = [
  [8, 12], [1, 3], [11, 12], [12, 12], [0, null], [40, 12], [13, 40], [0, 1],
  [3, 60], [3, 28], [3, 29], [60, null], [300, null], [300, 12], [66, 67],
  [0, 0], [5, 0], [0, 2], [1, 2], [2, 2], [3, 2], [5, 5], [6, 5], [10, 12], [0, 12],
];

function streakLayoutFile(): GoldenFile {
  const cases = LAYOUTS.map(([done, best]): GoldenCase => {
    const layout = streakLayout(done, best);
    const slots = [0, 1, 2, done - 1, done, done + 1, layout.ring ?? -1];
    return {
      name: `${done} done, best ${best === null ? "none" : best}`,
      input: { done, best },
      output: {
        dot: layout.dot,
        ticks: layout.ticks,
        ring: layout.ring,
        target: layout.target,
        future: layout.future,
        t: probed(slots, Number.MAX_SAFE_INTEGER, layout.t),
      },
    };
  });
  return goldenFile({ ...STREAK, function: "streakLayout" }, cases);
}

function streakLabelFile(): GoldenFile {
  const label = (streak: number, best: number | null, ended: boolean): GoldenCase => ({
    name: `streak ${streak}, best ${best === null ? "none" : best}, ${ended ? "ended" : "running"}`,
    input: { streak, best, ended },
    output: streakLabel(streak, best, ended),
  });
  const pinned: [number, number | null, boolean][] = [
    [8, 12, false], [12, 12, false], [13, 12, false], [1, null, false], [0, null, false],
    [8, 12, true], [12, 12, true], [13, 12, true], [3, null, true], [0, 0, false], [1, 0, false], [0, 0, true],
  ];
  const more: [number, number | null, boolean][] = [[0, 5, false], [1, 1, false], [2, 1, true], [1, 2, true], [100, 99, false]];
  return goldenFile({ ...STREAK, function: "streakLabel" }, [...pinned, ...more].map(([streak, best, ended]) => label(streak, best, ended)));
}

function trailLayoutFile(): GoldenFile {
  const cases: GoldenCase[] = [];
  for (let marks = 0; marks <= 200; marks += 1) {
    const layout = trailLayout(marks);
    const indexes = [0, 1, 2, Math.floor(marks / 2), marks - 2, marks - 1];
    cases.push({
      name: `${marks} marks`,
      input: { marks },
      output: { r: layout.r, side: layout.side, cross: layout.cross, x: probed(indexes, marks, layout.x) },
    });
  }
  return goldenFile({ ...LIVES, function: "trailLayout" }, cases);
}

function livesLabelFile(): GoldenFile {
  const round = (n: number, ...wrongOn: number[]) => Array.from({ length: n }, (_, i) => !wrongOn.includes(i + 1));
  const label = (name: string, results: boolean[]): GoldenCase => ({ name, input: { results }, output: livesLabel(results) });
  return goldenFile({ ...LIVES, function: "livesLabel" }, [
    label("no cards answered yet", round(0)),
    label("one card answered", round(1)),
    label("five cards answered", round(5)),
    label("one wrong card among 14", round(14, 6)),
    label("two wrong cards among 20", round(20, 6, 15)),
    label("no lives left after 21 cards", round(21, 6, 15, 21)),
    label("one wrong card, the only one answered", round(1, 1)),
    label("two wrong cards, the only ones answered", round(2, 1, 2)),
    label("three wrong cards in a row", round(3, 1, 2, 3)),
    label("four wrong cards: no lives left, whatever the count", round(4, 1, 2, 3, 4)),
  ]);
}

function clockFile(): GoldenFile {
  const values = [60_000, 59_999, 59_000, 41_000, 40_001, 1_001, 1_000, 999, 1, 0, 60_001, 61_000, 125_000, 599_000, -1, -5_000, 0.5, 29_999.9, 60_000.5];
  return goldenFile(
    { ...TIMED, function: "clockText" },
    values.map((remainingMs): GoldenCase => ({ name: `${remainingMs} ms`, input: { remainingMs }, output: clockText(remainingMs) })),
  );
}

function timedLabelFile(): GoldenFile {
  const label = (remainingMs: number, correct: number, wrong: number): GoldenCase => ({
    name: `${remainingMs} ms, ${correct} correct, ${wrong} wrong`,
    input: { remainingMs, correct, wrong },
    output: timedLabel(remainingMs, correct, wrong),
  });
  return goldenFile({ ...TIMED, function: "timedLabel" }, [
    label(41_000, 9, 2),
    label(60_000, 0, 0),
    label(900, 3, 0),
    label(0, 14, 3),
    label(0, 1, 0),
    label(1_000, 0, 0),
    label(1_001, 5, 1),
    label(59_999.5, 0, 0),
    label(90_000, 1, 1),
    label(-5, 3, 1),
    label(0, 0, 0),
    label(0, 0, 1),
  ]);
}

/** The files of this group: streakLayout, streakLabel, trailLayout, livesLabel, clockText, timedLabel. */
export function headersGolden(): GoldenFile[] {
  return [streakLayoutFile(), streakLabelFile(), trailLayoutFile(), livesLabelFile(), clockFile(), timedLabelFile()];
}
```

Run the command of step 22. Expected: `Test Files  1 passed (1)`, `Tests  47 passed (47)`.

- [ ] **Step 24: Write the barcode test.**

`tests/scripts/native/golden-geometry-barcode.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { barcodeBars } from "@/components/BoardingPass";
import { BARCODE_DATA, barcodeGolden } from "@/scripts/native/golden/geometry-barcode";
import { fileAt, outputFor, view } from "./golden-view";

const FILES = barcodeGolden();
const file = fileAt(FILES, "native-data/golden/components.BoardingPass.barcodeBars.json");
type Bars = { bars: { x: number; width: number }[]; width: number };
const bars = (data: string) => outputFor(file, { data }) as Bars;

describe("barcodeBars (the pinned cases of BoardingPass.test.tsx)", () => {
  it("makes one file", () => {
    expect(FILES).toHaveLength(1);
    expect(view(file)).toMatchObject({ module: "components/BoardingPass", function: "barcodeBars", source: "components/BoardingPass.tsx" });
    expect(view(file).cases).toHaveLength(BARCODE_DATA.length);
  });

  it("starts with bars 2/1/1/2 and ends with 1/1/2", () => {
    const { bars: drawn, width } = bars("A");
    expect(drawn[0]).toEqual({ x: 0, width: 2 });
    expect(drawn[1]).toEqual({ x: 3, width: 1 });
    expect(drawn.at(-1)).toEqual({ x: width - 2, width: 2 });
    expect(drawn.at(-2)).toEqual({ x: width - 4, width: 1 });
  });

  it("gives each character 7 bars and a gap, 2 wide for a 1 bit and 1 wide for a 0 bit", () => {
    expect(bars("A").width).toBe(6 + 10 + 4);
    expect(bars("AA").width).toBe(6 + 20 + 4);
  });

  it("is the same for the same data and different for different data", () => {
    expect(bars("aws-clf-c02-t2.1-06")).toEqual(barcodeBars("aws-clf-c02-t2.1-06"));
    expect(bars("aws-clf-c02-t2.1-06")).not.toEqual(bars("aws-clf-c02-t2.1-07"));
  });

  it("draws the end bars of the empty string right after the start bars", () => {
    expect(bars("")).toEqual({ bars: [{ x: 0, width: 2 }, { x: 3, width: 1 }, { x: 6, width: 1 }, { x: 8, width: 2 }], width: 10 });
  });

  it("counts the low seven bits of the first UTF-16 unit: e with an acute is 0x69, the G clef is its high surrogate", () => {
    expect(bars("\u{e9}")).toEqual(barcodeBars("i"));
    expect(bars("\u{1d11e}")).toEqual(barcodeBars(String.fromCharCode(0xd834)));
    expect(bars("\u{1d11e}")).not.toEqual(bars("\u{0}"));
  });

  it("every recorded output is what the function says", () => {
    for (const recorded of view(file).cases) expect(barcodeBars((recorded.input as { data: string }).data), recorded.name).toEqual(recorded.output);
  });
});
```

```bash
npx -y pnpm@10.34.0 vitest run tests/scripts/native/golden-geometry-barcode.test.ts
```

Expected: FAIL, `Cannot find package '@/scripts/native/golden/geometry-barcode'`.

- [ ] **Step 25: Write the barcode producer.** The characters beyond ASCII are written as code point escapes, so the source holds only ASCII.

`scripts/native/golden/geometry-barcode.ts`:

```ts
// Vectors for the barcode of the boarding pass (components/BoardingPass.tsx, barcodeBars): the start bars,
// seven bits of every character least significant first, a gap, the end bars. Only the low seven bits of the
// first UTF-16 unit of each character count, which the cases with a letter beyond ASCII and one beyond the
// first plane pin. The data of a real pass is the card's id.
import { barcodeBars } from "@/components/BoardingPass";
import { goldenFile, type GoldenCase, type GoldenFile } from "./format";

/** The data the cases draw: edge strings, the sample of the web test, and ids of shipped decks. */
export const BARCODE_DATA: readonly string[] = [
  "",
  "A",
  "AA",
  "~",
  "\u{0}",
  "\u{e9}",
  "\u{1d11e}",
  "aws-clf-c02-t2.1-06",
  "aws-clf-c02-t2.1-07",
  "gcp-cdl-s1.1-01",
];

/** The file of this group: barcodeBars. */
export function barcodeGolden(): GoldenFile[] {
  const cases = BARCODE_DATA.map((data): GoldenCase => ({ name: JSON.stringify(data), input: { data }, output: barcodeBars(data) }));
  return [
    goldenFile({ module: "components/BoardingPass", function: "barcodeBars", source: "components/BoardingPass.tsx", tests: ["tests/components/BoardingPass.test.tsx"] }, cases),
  ];
}
```

Run the command of step 24. Expected: `Test Files  1 passed (1)`, `Tests  7 passed (7)`.

- [ ] **Step 26: Write the contrast test.** It types in the minimums, the day ratios and the 22 night ratios `contrast.test.ts` lists, and recomputes every recorded ratio from the recorded colours.

`tests/scripts/native/golden-geometry-contrast.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LISTED, PAIRS, colours, contrastGolden, luminance, ratioOf } from "@/scripts/native/golden/geometry-contrast";
import { fileAt, view } from "./golden-view";

const FILES = contrastGolden();
const file = fileAt(FILES, "native-data/golden/design.system.tokens.contrastPairs.json");

type Pair = {
  theme: "day" | "night";
  foreground: string;
  background: string;
  kind: string;
  foregroundHex: string;
  backgroundHex: string;
  ratio: number;
  minimum: number;
  passes: boolean;
  ownsNight?: boolean;
};
type Listed = { theme: "day" | "night"; foreground: string; background: string; foregroundHex: string; backgroundHex: string; ratio: number };
const output = view(file).cases[0]?.output as { pairs: Pair[]; listed: Listed[] };
const listedRatio = (theme: string, foreground: string, background: string) =>
  output.listed.find((entry) => entry.theme === theme && entry.foreground === foreground && entry.background === background)?.ratio;

describe("the contrast vector", () => {
  it("is one constant with a null input", () => {
    expect(FILES).toHaveLength(1);
    expect(view(file)).toMatchObject({ module: "design/system/tokens", function: "contrastPairs", source: "design/system/tokens.json", tests: ["tests/tokens/contrast.test.ts"] });
    expect(view(file).cases).toHaveLength(1);
    expect(view(file).cases[0]?.input).toBeNull();
  });

  it("holds the 27 pairs of the web test in both themes, day first", () => {
    expect(PAIRS).toHaveLength(27);
    expect(output.pairs).toHaveLength(54);
    expect(output.pairs.slice(0, 27).every((pair) => pair.theme === "day")).toBe(true);
    expect(output.pairs.slice(27).every((pair) => pair.theme === "night")).toBe(true);
    expect(output.pairs.slice(0, 27).map((pair) => [pair.foreground, pair.background, pair.kind])).toEqual(PAIRS.map(([f, b, k]) => [f, b, k]));
  });

  it("reaches the minimum of its kind in both themes: 4.5 for body text, 3 for large text and non-text", () => {
    for (const pair of output.pairs) {
      expect(pair.minimum, `${pair.theme} ${pair.foreground} on ${pair.background}`).toBe(pair.kind === "body text" ? 4.5 : 3);
      expect(pair.ratio, `${pair.theme} ${pair.foreground} on ${pair.background}`).toBeGreaterThanOrEqual(pair.minimum);
      expect(pair.passes, `${pair.theme} ${pair.foreground} on ${pair.background}`).toBe(true);
    }
  });

  it("gives every colour of the night pairs its own night value, and keeps the focus ring ink", () => {
    for (const pair of output.pairs.filter((candidate) => candidate.theme === "night")) expect(pair.ownsNight, `${pair.foreground} on ${pair.background}`).toBe(true);
    for (const pair of output.pairs.filter((candidate) => candidate.theme === "day")) expect(pair.ownsNight).toBeUndefined();
    const night = output.pairs.filter((pair) => pair.theme === "night");
    const ink = night.find((pair) => pair.foreground === "ink");
    const focus = night.find((pair) => pair.foreground === "focus");
    expect(focus?.foregroundHex).toBe(ink?.foregroundHex);
    expect(luminance(focus?.foregroundHex ?? "#000000")).toBeGreaterThan(luminance(night.find((pair) => pair.background === "surface-raised")?.backgroundHex ?? "#ffffff"));
  });

  it("matches the day ratios DESIGN-SYSTEM.md section 2.2 lists, so the two computations agree", () => {
    expect(listedRatio("day", "ink", "surface-raised")).toBe(15.21);
    expect(listedRatio("day", "ink-muted", "sky-4")).toBe(5.13);
    expect(listedRatio("day", "on-accent", "accent")).toBe(8.55);
  });

  it("would fail the two choices the decisions replaced: an ink-muted tagline and an amber focus ring", () => {
    expect(listedRatio("day", "ink-muted", "sky-1")).toBe(3.78);
    expect(listedRatio("day", "ink-muted", "sky-1") ?? 0).toBeLessThan(4.5);
    expect(listedRatio("day", "accent", "sky-3")).toBe(1.56);
    expect(listedRatio("day", "accent", "sky-3") ?? 0).toBeLessThan(3);
  });

  it("matches the night ratios DESIGN-SYSTEM.md section 2.2 lists", () => {
    const listed: readonly [string, string, number][] = [
      ["ink", "surface-raised", 10.48],
      ["ink", "surface-sunk", 11.83],
      ["ink-muted", "surface-raised", 5.35],
      ["ink-muted", "surface-sunk", 6.04],
      ["true", "surface-raised", 4.72],
      ["true", "surface-sunk", 5.33],
      ["false", "surface-raised", 4.94],
      ["correct", "surface-sunk", 6.24],
      ["correct", "surface-raised", 5.53],
      ["wrong", "surface-sunk", 5.58],
      ["on-dark", "true", 6.12],
      ["on-dark", "false", 6.4],
      ["on-dark", "ink", 13.59],
      ["on-accent", "accent", 7.79],
      ["ink", "sky-1", 14.2],
      ["ink-muted", "sky-1", 7.25],
      ["ink-muted", "sky-2", 6.76],
      ["accent", "sky-3", 7.16],
      ["accent", "sky-4", 6.99],
      ["ink-muted", "sky-3", 6.24],
      ["ink-muted", "sky-4", 6.09],
      ["rule", "surface-raised", 1.43],
    ];
    expect(LISTED.filter(([theme]) => theme === "night")).toHaveLength(listed.length);
    for (const [foreground, background, expected] of listed) expect(listedRatio("night", foreground, background), `${foreground} / ${background}`).toBe(expected);
  });

  it("every recorded ratio is the WCAG ratio of the two recorded colours, and the colours are the tokens'", () => {
    const themes = colours(JSON.parse(readFileSync("design/system/tokens.json", "utf8")));
    for (const entry of [...output.pairs, ...output.listed]) {
      const where = `${entry.theme} ${entry.foreground} on ${entry.background}`;
      expect(entry.foregroundHex, where).toBe(themes[entry.theme](entry.foreground));
      expect(entry.backgroundHex, where).toBe(themes[entry.theme](entry.background));
      expect(entry.ratio, where).toBe(Math.round(ratioOf(entry.foregroundHex, entry.backgroundHex) * 100) / 100);
    }
  });
});
```

```bash
npx -y pnpm@10.34.0 vitest run tests/scripts/native/golden-geometry-contrast.test.ts
```

Expected: FAIL, `Cannot find package '@/scripts/native/golden/geometry-contrast'`.

- [ ] **Step 27: Move the pairs into a shared module, then write the contrast producer.** The producer must not keep its own copy of the web test's pairs: a pair added to the web test would leave the vector stale with the drift gate green. So the pairs, the minimums and the luminance move to `src/tokens/contrast.ts`, and both the web test and the producer import them. The producer runs from the repository root, where Vitest runs, and reads `design/system/tokens.json` the way the web test does.

Create `src/tokens/contrast.ts` (the arrays and the function are the web test's own lines, moved unchanged apart from `export`):

```ts
// The contrast pairs of the design system: DESIGN-SYSTEM.md section 2.2 as corrected by two product owner decisions
// (the start-flow tagline and the "Your pass is ready" line are ink, and the focus ring is ink everywhere), the
// minimum of each kind and the WCAG 2.x relative luminance. tests/tokens/contrast.test.ts checks every pair against
// the CSS the app ships; the native golden vectors (scripts/native/golden/geometry-contrast.ts) read the same list,
// so a pair added here reaches both.

export type Kind = "body text" | "large text" | "non-text";
export const MINIMUM: Readonly<Record<Kind, number>> = { "body text": 4.5, "large text": 3, "non-text": 3 };

// [foreground, background, kind, where the screens use it]. Large text is 24px, or 18.66px bold, and up.
export const PAIRS: readonly (readonly [string, string, Kind, string])[] = [
  ["ink", "surface-raised", "body text", "ticket, cards, fill-in pass, Back pill"],
  ["ink", "surface-sunk", "body text", "answer slip, missed-cards slip"],
  ["ink-muted", "surface-raised", "body text", "field labels, leg names, card details"],
  ["ink-muted", "surface-sunk", "body text", "missed-card heads, unavailable card"],
  ["true", "surface-raised", "body text", "True hint"],
  ["true", "surface-sunk", "body text", "source link, Why link"],
  ["false", "surface-raised", "body text", "False hint"],
  ["on-dark", "true", "body text", "True pill label"],
  ["on-dark", "false", "body text", "False pill label"],
  ["on-dark", "ink", "body text", "Next card, Play again, Start round"],
  ["on-accent", "accent", "body text", "carrier band"],
  ["ink", "sky-1", "body text", "start-flow tagline (decision: ink)"],
  ["ink", "sky-2", "body text", "the tagline where it crosses into sky-2, step titles"],
  ["ink", "sky-3", "body text", "the ready line (decision: ink)"],
  ["ink", "sky-4", "body text", "continue line, quiet buttons"],
  ["ink-muted", "sky-4", "body text", "continue line route"],
  ["correct", "surface-sunk", "large text", "Correct stamp on the slip, 24px ExtraBold"],
  ["correct", "surface-raised", "large text", "New best stamp, 22px ExtraBold"],
  ["wrong", "surface-sunk", "large text", "Not quite stamp, 24px ExtraBold"],
  ["wrong", "surface-raised", "large text", "Not quite stamp on the stub, 28px ExtraBold"],
  ["false", "surface-raised", "large text", "False intent stamp, 26px"],
  ["focus", "sky-1", "non-text", "focus ring on the sky"],
  ["focus", "sky-2", "non-text", "focus ring on the sky"],
  ["focus", "sky-3", "non-text", "focus ring on the sky (filled pills)"],
  ["focus", "sky-4", "non-text", "focus ring on the sky (filled pills)"],
  ["focus", "surface-raised", "non-text", "focus ring inside the pass and the ticket"],
  ["focus", "surface-sunk", "non-text", "focus ring on the slip"],
];

/** Relative luminance of an opaque #rrggbb colour (WCAG 2.x). */
export function luminance(hex: string): number {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) throw new Error(`${hex} is not an opaque #rrggbb colour`);
  const [r, g, b] = match.slice(1).map((part) => {
    const c = parseInt(part, 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
```

Then edit `tests/tokens/contrast.test.ts`, changing no test:
- below `import { tokensToCss } from "@/src/tokens/build";` add `import { MINIMUM, PAIRS, luminance } from "@/src/tokens/contrast";`;
- delete its own `luminance` function (from the comment `/** Relative luminance of an opaque #rrggbb colour (WCAG 2.x). */` to the function's closing brace);
- delete the two lines `type Kind = "body text" | "large text" | "non-text";` and `const MINIMUM: Record<Kind, number> = { "body text": 4.5, "large text": 3, "non-text": 3 };`;
- delete the `PAIRS` declaration with the comment line above it (from `// [foreground, background, kind, where the screens use it].` to its closing `];`).

```bash
npx -y pnpm@10.34.0 vitest run tests/tokens/contrast.test.ts tests/purity.test.ts
npx -y pnpm@10.34.0 typecheck
```

Expected: `tests/tokens/contrast.test.ts` passes with `Tests  59 passed (59)`, the same count as before the move, and the purity test passes; the typecheck prints `> tsc --noEmit` and nothing after it.

`scripts/native/golden/geometry-contrast.ts`:

```ts
// The contrast pairs of the design system (src/tokens/contrast.ts, which tests/tokens/contrast.test.ts checks) as a
// vector: for every pair and both themes, the two colours as hex, the WCAG 2.x contrast ratio rounded to two
// decimals, the minimum the pair must reach and whether it does. The colours come from the CSS the web ships:
// tokensToCss on design/system/tokens.json, with var() references resolved and the night values laid over the day
// ones as a browser cascades them; a night pair also says whether both its colours have a night value of their
// own, so that no pair is checked with a day value. The web test reads the raw file, and no colour of a pair is
// among the values the token overrides change (they change focus-on-fill, which no pair uses). A native app
// computes the ratio from its own colour constants and compares.
import { readFileSync } from "node:fs";
import { tokensToCss } from "@/src/tokens/build";
import { MINIMUM, PAIRS, luminance } from "@/src/tokens/contrast";
import { goldenFile, type GoldenFile } from "./format";

export { PAIRS, luminance };

type Theme = "day" | "night";

/** The ratios DESIGN-SYSTEM.md section 2.2 lists, and the two choices the product owner decisions replaced: [theme, foreground, background]. */
export const LISTED: readonly (readonly [Theme, string, string])[] = [
  ["day", "ink", "surface-raised"],
  ["day", "ink-muted", "sky-4"],
  ["day", "on-accent", "accent"],
  ["day", "ink-muted", "sky-1"],
  ["day", "accent", "sky-3"],
  ["night", "ink", "surface-raised"],
  ["night", "ink", "surface-sunk"],
  ["night", "ink-muted", "surface-raised"],
  ["night", "ink-muted", "surface-sunk"],
  ["night", "true", "surface-raised"],
  ["night", "true", "surface-sunk"],
  ["night", "false", "surface-raised"],
  ["night", "correct", "surface-sunk"],
  ["night", "correct", "surface-raised"],
  ["night", "wrong", "surface-sunk"],
  ["night", "on-dark", "true"],
  ["night", "on-dark", "false"],
  ["night", "on-dark", "ink"],
  ["night", "on-accent", "accent"],
  ["night", "ink", "sky-1"],
  ["night", "ink-muted", "sky-1"],
  ["night", "ink-muted", "sky-2"],
  ["night", "accent", "sky-3"],
  ["night", "accent", "sky-4"],
  ["night", "ink-muted", "sky-3"],
  ["night", "ink-muted", "sky-4"],
  ["night", "rule", "surface-raised"],
];

function declarations(css: string): Map<string, string> {
  return new Map([...css.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1] ?? "", (m[2] ?? "").trim()]));
}

/** The colour roles of both themes as `#rrggbb`, from the generated CSS, and whether a role has a night value of its own. */
export function colours(tokens: unknown): Record<Theme, (role: string) => string> & { ownsNight: (role: string) => boolean } {
  const css = tokensToCss(tokens);
  const dark = css.indexOf("@media (prefers-color-scheme: dark)");
  const day = declarations(dark === -1 ? css : css.slice(0, dark));
  const overrides = declarations(dark === -1 ? "" : css.slice(dark));
  const night = new Map([...day, ...overrides]);
  const resolver = (variables: ReadonlyMap<string, string>) => {
    const resolve = (name: string, seen: readonly string[]): string => {
      if (seen.includes(name)) throw new Error(`var() cycle: ${[...seen, name].join(" -> ")}`);
      const value = variables.get(name);
      if (value === undefined) throw new Error(`${name} is not in the generated CSS`);
      return value.replace(/var\((--[\w-]+)\)/g, (_, inner: string) => resolve(inner, [...seen, name]));
    };
    return (role: string) => resolve(`--color-${role}`, []);
  };
  return { day: resolver(day), night: resolver(night), ownsNight: (role) => overrides.has(`--color-${role}`) };
}

/** The contrast ratio of two opaque colours. */
export function ratioOf(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/** The file of this group: contrastPairs, one constant. */
export function contrastGolden(): GoldenFile[] {
  const themes = colours(JSON.parse(readFileSync("design/system/tokens.json", "utf8")));
  const pairs = (["day", "night"] as const).flatMap((theme) =>
    PAIRS.map(([foreground, background, kind, where]) => {
      const foregroundHex = themes[theme](foreground);
      const backgroundHex = themes[theme](background);
      const ratio = ratioOf(foregroundHex, backgroundHex);
      const ownsNight = theme === "night" ? { ownsNight: themes.ownsNight(foreground) && themes.ownsNight(background) } : {};
      return { theme, foreground, background, kind, where, foregroundHex, backgroundHex, ratio: round2(ratio), minimum: MINIMUM[kind], passes: ratio >= MINIMUM[kind], ...ownsNight };
    }),
  );
  const listed = LISTED.map(([theme, foreground, background]) => {
    const foregroundHex = themes[theme](foreground);
    const backgroundHex = themes[theme](background);
    return { theme, foreground, background, foregroundHex, backgroundHex, ratio: round2(ratioOf(foregroundHex, backgroundHex)) };
  });
  return [
    goldenFile(
      { module: "design/system/tokens", function: "contrastPairs", source: "design/system/tokens.json", tests: ["tests/tokens/contrast.test.ts"] },
      [{ name: "value", input: null, output: { pairs, listed } }],
    ),
  ];
}
```

Run the command of step 26. Expected: `Test Files  1 passed (1)`, `Tests  8 passed (8)`.

- [ ] **Step 28: Commit.**

```bash
git add src/tokens/contrast.ts tests/tokens/contrast.test.ts tests/scripts/native/golden-geometry-headers.test.ts tests/scripts/native/golden-geometry-barcode.test.ts tests/scripts/native/golden-geometry-contrast.test.ts scripts/native/golden/geometry-headers.ts scripts/native/golden/geometry-barcode.ts scripts/native/golden/geometry-contrast.ts
git commit -m "feat: export golden vectors for the Streak, Three lives and Timed headers, the barcode and the contrast pairs"
```

- [ ] **Step 29: Write the geometry group test.** It is the twin of step 14 for the seven geometry modules (21 entries).

`tests/scripts/native/golden-geometry.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { golden } from "@/scripts/native/golden/geometry";
import { NATIVE_FUNCTIONS } from "@/scripts/native/registry";
import { view } from "./golden-view";

const GEOMETRY_MODULES = [
  "components/play/ticketScroll",
  "components/FlightPath",
  "components/StreakPath",
  "components/LivesPath",
  "components/TimedPath",
  "components/BoardingPass",
  "design/system/tokens",
];

const EM_DASH = String.fromCharCode(0x2014);

describe("the geometry group", () => {
  const files = golden();
  const wanted = NATIVE_FUNCTIONS.filter((entry) => GEOMETRY_MODULES.includes(entry.module));

  it("has a vector file for every function and constant reference 3.9 lists for these modules, and no other", () => {
    expect(wanted).toHaveLength(21);
    const made = files.map((file) => `${view(file).module}.${view(file).function}`);
    expect([...made].sort()).toEqual(wanted.map((entry) => `${entry.module}.${entry.name}`).sort());
    for (const entry of wanted) {
      const file = files.find((candidate) => view(candidate).module === entry.module && view(candidate).function === entry.name);
      expect(file?.path, entry.name).toBe(`native-data/golden/${entry.module.replaceAll("/", ".")}.${entry.name}.json`);
      expect(view(file!).source, entry.name).toBe(entry.source);
      expect(view(file!).tests, entry.name).toEqual(expect.arrayContaining([...entry.tests]));
    }
  });

  it("gives a constant one case with a null input, and a function none", () => {
    for (const entry of wanted) {
      const file = files.find((candidate) => view(candidate).module === entry.module && view(candidate).function === entry.name);
      const cases = view(file!).cases;
      if (entry.kind === "constant") {
        expect(cases, entry.name).toHaveLength(1);
        expect(cases[0]?.input, entry.name).toBeNull();
      } else {
        expect(cases.length, entry.name).toBeGreaterThan(0);
        expect(cases.some((one) => one.input === null), entry.name).toBe(false);
      }
    }
  });

  it("names every case once, so a pinned case can be found by its name", () => {
    for (const file of files) {
      const names = view(file).cases.map((one) => one.name);
      expect(new Set(names).size, file.path).toBe(names.length);
    }
  });

  it("is byte-identical on a second run", () => {
    expect(golden()).toEqual(files);
  });

  it("holds no em dash, no local path and nothing shaped like an e-mail address", () => {
    for (const file of files) {
      expect(file.content, file.path).not.toContain(EM_DASH);
      expect(file.content, file.path).not.toMatch(/\/Users\/|\/home\/|[A-Za-z]:\\/);
      expect(file.content, file.path).not.toMatch(/\w@\w+\.\w/);
      expect(file.content.endsWith("}\n"), file.path).toBe(true);
    }
  });
});
```

```bash
npx -y pnpm@10.34.0 vitest run tests/scripts/native/golden-geometry.test.ts
```

Expected: FAIL, `Cannot find package '@/scripts/native/golden/geometry'`.

- [ ] **Step 30: Write the geometry group.**

`scripts/native/golden/geometry.ts`:

```ts
// The golden vectors of the geometry group (reference 3.9): the ticket's scroll arithmetic, the flight path,
// the Streak, Three lives and Timed headers, the barcode and the contrast pairs. Each part has its own file
// next to this one.
import { barcodeGolden } from "./geometry-barcode";
import { contrastGolden } from "./geometry-contrast";
import { headersGolden } from "./geometry-headers";
import { pathGolden } from "./geometry-path";
import { scrollGolden } from "./geometry-scroll";
import type { GoldenFile } from "./format";

export function golden(): GoldenFile[] {
  return [...scrollGolden(), ...pathGolden(), ...headersGolden(), ...barcodeGolden(), ...contrastGolden()];
}
```

Run the command of step 29. Expected: `Test Files  1 passed (1)`, `Tests  5 passed (5)`.

- [ ] **Step 31: Write the registry test.** `goldenProducers()` is what the export (task 9) runs; the test fails until both groups are in it.

`tests/scripts/native/golden-copy-geometry-registry.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { golden as copy } from "@/scripts/native/golden/copy";
import { golden as geometry } from "@/scripts/native/golden/geometry";
import { goldenProducers } from "@/scripts/native/registry";

describe("goldenProducers", () => {
  it("includes the copy group and the geometry group, with all 34 of their files", () => {
    const produced = goldenProducers().flatMap((produce) => produce().map((file) => file.path));
    const mine = [...copy(), ...geometry()].map((file) => file.path);
    expect(mine).toHaveLength(34);
    expect(new Set(mine).size).toBe(34);
    for (const path of mine) expect(produced, path).toContain(path);
  });
});
```

```bash
npx -y pnpm@10.34.0 vitest run tests/scripts/native/golden-copy-geometry-registry.test.ts
```

Expected: FAIL, `Tests  1 failed (1)`, with an `AssertionError` naming `native-data/golden/components.play.PlayScreen.verdictText.json` (the first of the 34 paths) and `to include`.

- [ ] **Step 32: Add the two groups to the registry.** In `scripts/native/registry.ts`, add these two imports with the file's other imports:

```ts
import { golden as copyGolden } from "./golden/copy";
import { golden as geometryGolden } from "./golden/geometry";
```

and append `copyGolden` and `geometryGolden` to the array `goldenProducers()` returns, after the producers already in it. For example, were the array empty, the function would read:

```ts
export function goldenProducers(): readonly (() => GoldenFile[])[] {
  return [copyGolden, geometryGolden];
}
```

Run the command of step 31. Expected: `Test Files  1 passed (1)`, `Tests  1 passed (1)`.

- [ ] **Step 33: Run the gates.**

```bash
npx -y pnpm@10.34.0 vitest run tests/scripts/native
npx -y pnpm@10.34.0 typecheck
npx -y pnpm@10.34.0 vitest run
```

Expected: the first run passes, with this task's 13 test files and 142 tests among those of tasks 2 to 7; the typecheck prints `> tsc --noEmit` and nothing after it; the full run ends with `Test Files  182 passed (182)` and `Tests  3560 passed (3560)`: task 7's 169 and 3418 plus this task's 13 files and 142 tests (moving the pairs changes no count of `tests/tokens/contrast.test.ts`).

- [ ] **Step 34: Commit, then check the hygiene scan over the tracked files.**

```bash
git add tests/scripts/native/golden-geometry.test.ts tests/scripts/native/golden-copy-geometry-registry.test.ts scripts/native/golden/geometry.ts scripts/native/registry.ts
git commit -m "feat: add the copy and geometry golden groups to the export"
npx -y pnpm@10.34.0 vitest run tests/repo-hygiene.test.ts
```

Expected: the commit succeeds with the four files; the hygiene test passes (no em dash, local path or e-mail-shaped string in any file this task wrote).
