### Task 6: Golden round traces and swipe tables

The native ports translate `src/engine/round.ts` and `src/input/swipe.ts` line by line (spec 4.4), and a reducer is only proven by playing it: one mistake in the Timed clock, a phase rule or the seed of a later chunk shows up only several events into a round. This task writes the two golden producers that pin them. `scripts/native/golden/round.ts` plays 90 event traces through the TypeScript reducer (every round test of `round.test.ts`, `modes.test.ts`, `timed.test.ts` and `clock-polish.test.ts`, in all four classes, plus the Timed clock edges of reference 3.3 that no web test plays) and writes the state after every event; the state helpers are read on the same traces. `scripts/native/golden/swipe.ts` writes every gesture of the three web swipe suites and boundary tables around each threshold of `SWIPE`, including fractional times, because native touch timestamps are fractional milliseconds. Both producers are added to `goldenProducers()`, so task 9's export writes their 17 files. Nothing the player sees changes, and no web module changes.

Builds on task 4 (the golden format and the registry). It does not use task 5's code: the round deals through `startRound`, which calls `dealChunk` itself.

Commands: `pnpm` is pnpm 10.34.0. Without a global one, write `npx -y pnpm@10.34.0` in its place.

**Files:**
- Create: `scripts/native/golden/round.ts`, `scripts/native/golden/swipe.ts`
- Modify: `scripts/native/registry.ts` (two imports, two entries in `goldenProducers()`)
- Test: create `tests/scripts/native/golden-round.test.ts`, `tests/scripts/native/golden-swipe.test.ts`, `tests/scripts/native/producers-round-swipe.test.ts`

**Interfaces:**
- Consumes (task 4, `scripts/native/golden/format.ts`): `goldenFile(meta: GoldenMeta, cases: readonly GoldenCase[]): GoldenFile`, `snapshotRound(state: RoundState): unknown`, and the types `GoldenCase`, `GoldenFile`, `GoldenMeta`. `goldenFile` replaces every `Card` in an input or output by `{"$card": id}` and fills the file's `cards` table, tags non-finite numbers as `{"$number": ...}`, and names the file `native-data/golden/<module with / as .>.<function>.json`.
- Consumes (task 4, `scripts/native/registry.ts`): `NATIVE_FUNCTIONS` (the tests compare each file's `module`, `function`, `source` and `tests` with its entry) and `goldenProducers()` (this task appends two producers).
- Consumes (web): every export of `src/engine/round.ts` and `src/input/swipe.ts` listed in reference 3.9, unchanged.
- Produces:

```ts
// scripts/native/golden/round.ts
export const T0 = 1_700_000_000_000;              // the web tests' wall-clock origin, epoch ms
export interface Trace { name: string; start: StartArgs; events: readonly RoundEvent[]; states: readonly RoundState[]; read: boolean }
export function roundTraces(): Trace[];          // the 90 traces, in file order
export function golden(): GoldenFile[];          // 13 files, src.engine.round.*.json

// scripts/native/golden/swipe.ts
export function golden(): GoldenFile[];          // 4 files, src.input.swipe.*.json
```

  - The 17 files: `native-data/golden/src.engine.round.{startRound,reduce,currentCard,lastAnswer,wrongCount,livesLeft,isDecided,summarise,scoreOf,chunkSeed,CLASSIC_LENGTH,LIVES,TIMED}.json` and `native-data/golden/src.input.swipe.{intent,canStart,interpret,SWIPE}.json`. Together about 4.6 MB, of which `reduce` is 3.0 MB (measured with the 90 traces): the README's format writes every state of a trace in full, two-space indented.
  - Task 8 (play copy, leave rules) also reads functions of a `RoundState`. It can use the input form of rule 3 below and `roundTraces()`, so that every state-taking vector of the native suites replays the same traces.

**Rules:**

1. **A trace** (the `reduce` file). `input` is `{"start": <StartArgs>, "events": [<RoundEvent>...]}`, `output` the snapshot (`snapshotRound`) of every state: `output[0]` is what `startRound(start)` returned, `output[i]` the state after `events[i - 1]`, so `output.length == events.length + 1`. `StartArgs` keeps its keys (`mode`, `route`, `pool`, `history`, `seed`); `pool` is a list of card references; event times that are not finite are tagged (`{"$number": "NaN"}`). A native suite starts the round, applies each event with its own `reduce` and compares every state with the snapshot. An event that does not apply shows as a state equal to the one before it; snapshots cannot show the web's "the very same object", and value types need not.
2. **The snapshot** is the README's: `mode`, `route`, `cards`, `index`, `answers` (each `{card, given, correct, at}`), `phase`, `abandoned`, `chunks` (in place of `source`), `clock` (`null` outside Timed, else `{remainingMs, lastTick, hidden, holdMs}` with `lastTick` null before the first tick and while hidden).
3. **The state helpers** (`currentCard`, `lastAnswer`, `wrongCount`, `livesLeft`, `isDecided`, `summarise`) are written on 37 of the traces (those with `read: true`). Each case has the same `name` and the same `input` as the `reduce` case it reads, and `output` is the helper's value on every state, in the same order. An `undefined` value (`currentCard` once finished, `lastAnswer` before an answer) is `{"$undefined": true}` in the list; the producer writes that tag itself, so it does not rely on how the encoder treats `undefined` inside an array.
4. **`startRound`** cases have `input: {"args": <StartArgs>}` (the parameter is called `args`) and output the snapshot, or `{"$throws": <message>}`: `The mode "sudden-death" is not available.` and `The route aws-clf-c02/CON has no cards to deal.` A native `Mode` type cannot hold `"sudden-death"`; its suite passes that case when decoding the mode fails, and never skips it (spec 7.1).
5. **`scoreOf`** cases have `input: {"mode", "answers"}` (answers on cards `s0`, `s1`, ... whose answer is true; `given` equals `correct`, `at` is the index), **`chunkSeed`** cases `input: {"seed", "chunk"}`. The constants have one case named after the constant, with `input: null`.
6. **The cards** are the web round tests' own: `c1` to `c40`, section `CON`, odd numbers true and even numbers false, on the route `aws-clf-c02` / `CON`; the pool is the first n of them. Times are the web tests': answers at 1000 (and other small numbers) in Classic, Streak and Three lives, `T0 + ...` in Timed.
7. **Where a trace differs from its web test**, to keep the files small; each difference counts exactly what the web test counts, and no web test is left out (README, "Deviations from the spec": a loop inside a test is sampled, a test is never dropped):
   - Long Timed stretches tick once a second (`ticks(from, to, 1_000)`) where the web ticks every 100 ms. A step of at most `TIMED.maxStepMs` counts in full, so the clock reads the same at every second; the 100 ms ticks stay wherever the stamp's hold is counted down (`shows the next card once 700 ms ...`, `holds the stamp while the page is hidden`).
   - "nearly up" (100 ms left on the first card) is `tick(T0)`, then one tick a second to `T0 + 59_000`, then `tick(T0 + 59_900)`: 61 events.
   - `modes.test`'s Timed `playRight` and `timed.test`'s "deals the next chunk when the stamp ends on the last dealt card" end each hold with one tick of 700 ms instead of seven of 100.
   - "can abandon at every point" keeps the cuts 0, 1, 2, 3 and 19 of the web's 20 (0, 1 and 2 are also the three plain abandon tests).
   - The stored-history test runs seed 1 of the web's 40 in each of Streak, Three lives and Timed; `dealChunk` with a history over many seeds is task 5's.
   - "never runs out of cards on an 11 card route" answers 21 cards (into the third chunk) where the web answers 30.
   - Three time-up tests of `timed.test.ts` (stops at zero, ignores every event, next finishes) are one trace, and the three bad tick values of `clock-polish.test.ts` are one trace (NaN, then Infinity, then -Infinity).
8. **The Timed edges** (cases named `edge: ...`) are the rules of reference 3.3 that no web test plays: the first answer arms the clock; a step of exactly 1000 counts in full and 1001 counts 1000; a tick at the same moment and a step back count nothing but move `lastTick`; an answer while hidden is stamped and its hold waits; hiding after the hold ran out shows the next card, then pauses; hiding after a long gap counts at most a second; a last step longer than the time left stops at 0; hiding at zero during a stamp moves on to a card that does not count; `next` does nothing on an undecided Timed round; a Timed round left while hidden is abandoned.
9. **Swipe.** `intent` cases have `input: {"dx"}`, `canStart` cases `{"sample", "context"}`, `interpret` cases `{"samples", "context"}`, exactly as the functions take them; outputs are the returned number, boolean or string (`"true"`, `"false"`, `"cancel"`). The web suites' gestures are written in absolute samples (start `{x: 195, y: 400, t: 1000}` on a 390 wide window whose card appeared at 0). Numbers are exact doubles (`intent(33)` is `0.3`, `intent(1)` is `0.00909090909090909`); natives compare them exactly. The coordinates are window coordinates (reference 3.4): the boundary rows with a 430 and a 1024 wide window pin that the edge zone is measured from the window, not the card.
10. The producers are deterministic: no clock, no randomness, no file reads. Running them twice gives the same bytes.

**Steps:**

- [ ] **Step 1: Write the failing test of the round producer.**

`tests/scripts/native/golden-round.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { NATIVE_FUNCTIONS } from "@/scripts/native/registry";
import { T0, golden } from "@/scripts/native/golden/round";

interface Case {
  name: string;
  input: unknown;
  output: unknown;
}
interface Parsed {
  format: number;
  module: string;
  function: string;
  source: string;
  tests: string[];
  cards: Record<string, { id: string; answer: boolean }>;
  cases: Case[];
}
interface Ref {
  $card: string;
}
interface Clock {
  remainingMs: number;
  lastTick: number | null;
  hidden: boolean;
  holdMs: number;
}
interface Snapshot {
  mode: string;
  cards: Ref[];
  index: number;
  answers: { card: Ref; given: boolean; correct: boolean; at: number }[];
  phase: string;
  abandoned: boolean;
  chunks: number;
  clock: Clock | null;
}
interface TraceInput {
  start: { mode: string; pool: Ref[]; seed: number };
  events: { type: string }[];
}

const files = golden();
const parsed = new Map(files.map((f) => [f.path, JSON.parse(f.content) as Parsed]));

function file(name: string): Parsed {
  const found = parsed.get(`native-data/golden/src.engine.round.${name}.json`);
  if (found === undefined) throw new Error(`No golden file for ${name}.`);
  return found;
}

function caseOf(name: string, caseName: string): Case {
  const found = file(name).cases.find((c) => c.name === caseName);
  if (found === undefined) throw new Error(`No case "${caseName}" in ${name}.`);
  return found;
}

function states(caseName: string): Snapshot[] {
  return caseOf("reduce", caseName).output as Snapshot[];
}

function at<T>(list: readonly T[], index: number): T {
  const value = list.at(index);
  if (value === undefined) throw new Error(`Nothing at ${index}.`);
  return value;
}

// Every {"$card": id} in a value, depth first.
function refs(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(refs);
  if (value === null || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  if (typeof record.$card === "string") return [record.$card];
  return Object.values(record).flatMap(refs);
}

const ROUND_NAMES = [
  "CLASSIC_LENGTH",
  "LIVES",
  "TIMED",
  "chunkSeed",
  "currentCard",
  "isDecided",
  "lastAnswer",
  "livesLeft",
  "reduce",
  "scoreOf",
  "startRound",
  "summarise",
  "wrongCount",
];

describe("golden round: the files", () => {
  it("writes one file per function and constant of the round in reference 3.9", () => {
    expect(files.map((f) => f.path).sort()).toEqual(ROUND_NAMES.map((n) => `native-data/golden/src.engine.round.${n}.json`).sort());
    const registered = NATIVE_FUNCTIONS.filter((f) => f.module === "src/engine/round").map((f) => f.name);
    expect([...registered].sort()).toEqual([...ROUND_NAMES].sort());
  });

  it("takes each file's source and tests from the registry, and resolves every card reference", () => {
    for (const entry of NATIVE_FUNCTIONS.filter((f) => f.module === "src/engine/round")) {
      const golden = file(entry.name);
      expect([golden.format, golden.module, golden.function, golden.source, golden.tests]).toEqual([
        1,
        entry.module,
        entry.name,
        entry.source,
        [...entry.tests],
      ]);
      for (const id of refs(golden.cases)) expect(golden.cards[id]?.id, `${entry.name}: ${id}`).toBe(id);
    }
  });

  it("is the same on every run", () => {
    expect(golden().map((f) => f.content)).toEqual(files.map((f) => f.content));
  });
});

describe("golden round: the traces of reduce", () => {
  const cases = file("reduce").cases;

  it("has one state more than events in every trace, the first being the start of the round", () => {
    expect(cases.length).toBe(90);
    for (const c of cases) {
      const input = c.input as TraceInput;
      const output = c.output as Snapshot[];
      expect(output.length, c.name).toBe(input.events.length + 1);
      expect([at(output, 0).index, at(output, 0).phase, at(output, 0).answers], c.name).toEqual([0, "question", []]);
    }
  });

  it("plays all four classes, and every event type", () => {
    const inputs = cases.map((c) => c.input as TraceInput);
    expect(new Set(inputs.map((i) => i.start.mode))).toEqual(new Set(["classic", "streak", "lives", "timed"]));
    expect(new Set(inputs.flatMap((i) => i.events.map((e) => e.type)))).toEqual(
      new Set(["answer", "next", "tick", "visibility", "abandon"]),
    );
  });

  it("holds a trace for every round test of the four web suites", () => {
    const names = cases.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names.filter((n) => n.startsWith("round.test: ")).length).toBe(23);
    expect(names.filter((n) => n.startsWith("modes.test: ")).length).toBe(29);
    expect(names.filter((n) => n.startsWith("timed.test: ")).length).toBe(24);
    expect(names.filter((n) => n.startsWith("clock-polish.test: ")).length).toBe(4);
    expect(names.filter((n) => n.startsWith("edge: ")).length).toBe(10);
  });

  it("Classic: ten cards, then finished on next (round.test.ts)", () => {
    const s = states("round.test: finishes after the tenth card, not before");
    expect([at(s, -3).phase, at(s, -3).index]).toEqual(["question", 9]);
    expect([at(s, -2).phase, at(s, -1).phase, at(s, -1).answers.length, at(s, -1).abandoned]).toEqual([
      "answered",
      "finished",
      10,
      false,
    ]);
  });

  it("abandon keeps the answers given at every cut (round.test.ts)", () => {
    for (const cut of [0, 1, 2, 3, 19]) {
      const last = at(states(`round.test: can abandon at every point of a round (left after ${cut} events)`), -1);
      expect([last.phase, last.abandoned, last.answers.length]).toEqual(["finished", true, Math.ceil(cut / 2)]);
    }
  });

  it("Streak deals a second chunk after card ten (modes.test.ts)", () => {
    const last = at(states("modes.test: Streak goes on after a right answer and deals a second chunk after card ten"), -1);
    expect([last.phase, last.index, last.cards.length, new Set(last.cards.map((c) => c.$card)).size, last.chunks]).toEqual([
      "question",
      10,
      20,
      20,
      2,
    ]);
  });

  it("deals chunk k with chunkSeed(seed, k), after the cards already dealt (modes.test.ts)", () => {
    const last = at(states("modes.test: deals chunk 1 and chunk 2 of a round with chunkSeed(seed, 1) and chunkSeed(seed, 2)"), -1);
    expect([last.cards.length, last.chunks, last.index]).toEqual([30, 3, 20]);
    const seed77 = at(states("modes.test: deals the same round for the same seed and events, across chunks (seed 77)"), -1);
    const seed78 = at(states("modes.test: deals the same round for the same seed and events, across chunks (seed 78)"), -1);
    expect([seed77.cards.length, seed77.chunks, seed77.index, seed77.phase]).toEqual([30, 3, 25, "question"]);
    expect(seed77.cards.slice(0, 5).map((c) => c.$card)).toEqual(["c8", "c21", "c38", "c35", "c13"]);
    expect(seed78.cards.slice(0, 5).map((c) => c.$card)).toEqual(["c30", "c1", "c21", "c26", "c9"]);
  });

  it("the stored history gives three missed cards to each of the first three chunks, in every unbounded class (modes.test.ts)", () => {
    const missed = new Set(["c1", "c4", "c9", "c12", "c17", "c20", "c25", "c28", "c33"]);
    for (const mode of ["streak", "lives", "timed"]) {
      const last = at(states(`modes.test: ${mode}: deals three missed cards in each of the first three chunks (seed 1)`), -1);
      const per = [0, 10, 20].map((from) => last.cards.slice(from, from + 10).filter((c) => missed.has(c.$card)).length);
      expect(per, mode).toEqual([3, 3, 3]);
      expect(last.answers.length, mode).toBe(21);
    }
  });

  it("Timed: the clock counts between ticks, never backwards, at most a second per tick (timed.test.ts)", () => {
    expect(at(states("timed.test: counts down by the time between ticks"), -1).clock?.remainingMs).toBe(59_650);
    expect(at(states("timed.test: never counts backwards when the clock source jumps back"), -1).clock).toMatchObject({
      remainingMs: 59_500,
      lastTick: T0 + 200,
    });
    expect(at(states("timed.test: counts a gap of more than a second between two ticks as one second"), -1).clock?.remainingMs).toBe(59_000);
    expect(at(states("timed.test: pauses while the page is hidden and goes on from where it was"), -1).clock).toEqual({
      remainingMs: 58_500,
      lastTick: T0 + 30_100,
      hidden: false,
      holdMs: 0,
    });
  });

  it("Timed: the stamp holds 700 ms, also while the page is hidden (timed.test.ts)", () => {
    const stamped = at(states("timed.test: an answer is stamped: recorded, no answered phase, 700 ms hold"), -1);
    expect([stamped.phase, stamped.answers.length, stamped.clock]).toEqual([
      "stamped",
      1,
      { remainingMs: 59_000, lastTick: T0 + 2_000, hidden: false, holdMs: 700 },
    ]);
    const s = states("timed.test: shows the next card once 700 ms have been counted since the answer, not before");
    expect([at(s, -2).phase, at(s, -2).index, at(s, -2).clock?.holdMs]).toEqual(["stamped", 0, 100]);
    expect([at(s, -1).phase, at(s, -1).index, at(s, -1).clock?.holdMs, at(s, -1).clock?.remainingMs]).toEqual([
      "question",
      1,
      0,
      58_800,
    ]);
    const hidden = states("timed.test: holds the stamp while the page is hidden");
    expect([at(hidden, -2).phase, at(hidden, -2).clock?.holdMs, at(hidden, -1).phase]).toEqual(["stamped", 100, "question"]);
  });

  it("Timed: time up on the question stops on the card, ignores events, and next finishes (timed.test.ts)", () => {
    const s = states("timed.test: stops at zero on the question, ignores every event but next and abandon, and finishes on next");
    expect(at(s, 61).clock?.remainingMs).toBe(100);
    const up = at(s, 62);
    expect([up.clock?.remainingMs, up.phase, up.index, up.answers.length]).toEqual([0, "stamped", 0, 0]);
    for (let i = 63; i <= 67; i++) expect(at(s, i), `state ${i}`).toEqual(up);
    expect([at(s, -1).phase, at(s, -1).abandoned]).toEqual(["finished", false]);
  });

  it("Timed: the card on screen at zero is not counted; a stamp running into zero keeps its answer (timed.test.ts)", () => {
    const done = at(states("timed.test: next after time up finishes the round; the card on screen is neither counted nor recorded"), -1);
    expect([done.phase, done.index, done.answers.length]).toEqual(["finished", 2, 2]);
    const during = at(states("timed.test: time running out during the stamp keeps that answer and moves on to a card that does not count"), -1);
    expect([during.phase, during.index, during.answers.length, during.clock?.holdMs, during.clock?.remainingMs]).toEqual([
      "stamped",
      1,
      1,
      0,
      0,
    ]);
    const late = at(states("timed.test: an answer that arrives at or after zero does not count (at 60050)"), -1);
    expect([late.answers.length, late.phase, late.clock?.remainingMs]).toEqual([0, "stamped", 0]);
    const hidden = at(states("timed.test: hiding the page at the moment the time runs out is time up, not a pause"), -1);
    expect([hidden.clock?.remainingMs, hidden.clock?.hidden]).toEqual([0, false]);
  });

  it("times that are not numbers are written as tagged numbers and change nothing (clock-polish.test.ts)", () => {
    const c = caseOf("reduce", "clock-polish.test: a tick at NaN, Infinity or -Infinity is ignored, and the minute still ends on time");
    const events = (c.input as { events: { now?: unknown }[] }).events;
    const bad = events.findIndex((e) => JSON.stringify(e.now) === JSON.stringify({ $number: "NaN" }));
    expect(bad).toBeGreaterThan(0);
    expect(events.slice(bad, bad + 3).map((e) => e.now)).toEqual([
      { $number: "NaN" },
      { $number: "Infinity" },
      { $number: "-Infinity" },
    ]);
    const s = c.output as Snapshot[];
    for (let i = bad + 1; i <= bad + 3; i++) expect(at(s, i)).toEqual(at(s, bad));
    expect([at(s, -2).clock?.remainingMs, at(s, -1).answers.length]).toEqual([0, at(s, -2).answers.length]);
    const shown = at(states("clock-polish.test: a page shown again at NaN is ignored, so the clock keeps counting from a real moment"), -1);
    expect(shown.clock?.remainingMs).toBe(0);
  });

  it("the first answer arms the Timed clock when no tick came before it (reference 3.3)", () => {
    const s = states("edge: the first answer arms the clock when no tick came before it");
    expect(at(s, 1).clock).toEqual({ remainingMs: 60_000, lastTick: T0, hidden: false, holdMs: 700 });
    expect([at(s, 2).phase, at(s, 2).index, at(s, 2).clock?.remainingMs]).toEqual(["question", 1, 59_300]);
  });
});

describe("golden round: the state helpers on the traces", () => {
  it("read the states of traces of reduce, with the same inputs", () => {
    for (const name of ["currentCard", "lastAnswer", "wrongCount", "livesLeft", "isDecided", "summarise"]) {
      const cases = file(name).cases;
      expect(cases.length, name).toBe(37);
      for (const c of cases) {
        expect(c.input, `${name}: ${c.name}`).toEqual(caseOf("reduce", c.name).input);
        expect((c.output as unknown[]).length).toBe((caseOf("reduce", c.name).output as unknown[]).length);
      }
    }
  });

  it("isDecided: a Streak is decided by its first wrong answer, and no longer once finished", () => {
    expect(caseOf("isDecided", "modes.test: Streak is decided by the first wrong answer; next then finishes it").output).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      true,
      false,
    ]);
  });

  it("livesLeft and wrongCount: two wrong answers leave one life", () => {
    const name = "modes.test: Three lives goes on after the first and the second wrong answer";
    expect(caseOf("livesLeft", name).output).toEqual([3, 2, 2, 1, 1]);
    expect(caseOf("wrongCount", name).output).toEqual([0, 1, 1, 2, 2]);
  });

  it("currentCard and lastAnswer: undefined is written as a tag", () => {
    const left = caseOf("currentCard", "round.test: ignores answer and next after abandoning").output as unknown[];
    expect(left.slice(1)).toEqual([1, 2, 3, 4].map(() => ({ $undefined: true })));
    const first = caseOf("lastAnswer", "round.test: records a right answer and shows the verdict").output as unknown[];
    expect(at(first, 0)).toEqual({ $undefined: true });
    expect(at(first, 1)).toMatchObject({ correct: true, at: 1234 });
  });

  it("summarise: the scores of the web tests", () => {
    const last = (name: string) => at(caseOf("summarise", name).output as { score: number; total: number; missed: unknown[]; abandoned: boolean }[], -1);
    expect(last("round.test: scores a finished Classic round: correct answers out of ten, missed cards in order")).toMatchObject({
      score: 7,
      total: 10,
      abandoned: false,
    });
    expect(last("round.test: summarises an abandoned round with the answers given so far")).toMatchObject({ score: 1, total: 2, abandoned: true });
    expect(last("modes.test: Streak is decided by the first wrong answer; next then finishes it")).toMatchObject({ score: 3, total: 4 });
    const lives = last("modes.test: Three lives is decided by the third wrong answer, wherever it falls; the score is the cards answered");
    expect([lives.score, lives.total, lives.missed.length]).toEqual([7, 7, 3]);
    expect(last("timed.test: next after time up finishes the round; the card on screen is neither counted nor recorded")).toMatchObject({
      mode: "timed",
      score: 1,
      total: 2,
      abandoned: false,
    });
  });
});

describe("golden round: startRound, scoreOf, chunkSeed and the constants", () => {
  it("startRound: deals ten cards, the whole of a small pool, a clock only for Timed, and throws as the web does", () => {
    const out = (name: string) => caseOf("startRound", name).output as Snapshot;
    for (let seed = 1; seed <= 20; seed++) {
      const cards = out(`round.test: a Classic round of a 40-card pool, seed ${seed}`).cards.map((c) => c.$card);
      expect(new Set(cards).size).toBe(10);
    }
    expect([1, 4, 9, 10, 11].map((n) => out(`round.test: a Classic round of a ${n}-card pool`).cards.length)).toEqual([1, 4, 9, 10, 10]);
    expect(out("round.test: starts a round in every mode: timed").clock).toEqual({ remainingMs: 60_000, lastTick: null, hidden: false, holdMs: 0 });
    expect(out("round.test: starts a round in every mode: lives").clock).toBeNull();
    const back = out("round.test: passes the history to the dealer: the cards answered wrong come back").cards.map((c) => c.$card);
    expect(back).toEqual(expect.arrayContaining(["c1", "c2"]));
    expect(caseOf("startRound", "round.test: rejects a mode it does not know").output).toEqual({
      $throws: 'The mode "sudden-death" is not available.',
    });
    expect(caseOf("startRound", "round.test: rejects an empty pool").output).toEqual({
      $throws: "The route aws-clf-c02/CON has no cards to deal.",
    });
  });

  it("scoreOf: right, right, wrong, right scores 3, 2, 4 and 3 (modes.test.ts)", () => {
    const score = (mode: string) => caseOf("scoreOf", `${mode}: right, right, wrong, right (modes.test)`).output;
    expect(["classic", "streak", "lives", "timed"].map(score)).toEqual([3, 2, 4, 3]);
  });

  it("chunkSeed: the pinned values of modes.test.ts and reference 3.3", () => {
    const seed = (s: number, k: number) => caseOf("chunkSeed", `seed ${s}, chunk ${k}`).output;
    expect(seed(12345, 0)).toBe(12345);
    expect(seed(0xffffffff, 1)).toBe(2654435768);
    expect([1, 2, 3, 4, 5].map((k) => seed(12345, k))).toEqual([2654448114, 1013916587, 3668352356, 2027820829, 387289302]);
  });

  it("writes the constants with a null input", () => {
    expect(file("CLASSIC_LENGTH").cases).toEqual([{ name: "CLASSIC_LENGTH", input: null, output: 10 }]);
    expect(file("LIVES").cases).toEqual([{ name: "LIVES", input: null, output: 3 }]);
    expect(file("TIMED").cases).toEqual([{ name: "TIMED", input: null, output: { roundMs: 60_000, holdMs: 700, maxStepMs: 1_000 } }]);
  });
});
```

- [ ] **Step 2: Run it and see it fail.**

```bash
pnpm vitest run tests/scripts/native/golden-round.test.ts
```

Expected: the file fails to load, `Error: Cannot find package '@/scripts/native/golden/round' imported from .../tests/scripts/native/golden-round.test.ts`, `Test Files  1 failed (1)`, `Tests  no tests`.

- [ ] **Step 3: Write the round producer.**

`scripts/native/golden/round.ts`:

```ts
// Golden vectors of the round (reference 3.3 and 3.9), computed by running src/engine/round.ts.
// A trace is a start and a list of events; its output is the state after each event, the first entry being
// the state startRound returned. The state helpers (currentCard, isDecided, summarise...) are read on the
// states of the same traces, so a native port replays a trace once and checks every helper on it.
import type { Card, Route } from "@/src/content/schema";
import type { History } from "@/src/content/play";
import {
  CLASSIC_LENGTH,
  LIVES,
  TIMED,
  chunkSeed,
  currentCard,
  isDecided,
  lastAnswer,
  livesLeft,
  reduce,
  scoreOf,
  startRound,
  summarise,
  wrongCount,
  type Answered,
  type Mode,
  type RoundEvent,
  type RoundState,
  type StartArgs,
} from "@/src/engine/round";
import { goldenFile, snapshotRound, type GoldenCase, type GoldenFile, type GoldenMeta } from "./format";

const TESTS = [
  "tests/engine/round.test.ts",
  "tests/engine/modes.test.ts",
  "tests/engine/timed.test.ts",
  "tests/engine/clock-polish.test.ts",
] as const;

function meta(name: string): GoldenMeta {
  return { module: "src/engine/round", function: name, source: "src/engine/round.ts", tests: TESTS };
}

// The cards of the web's round tests: c1, c3, c5 and so on are true, c2, c4 and so on false.
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

const CARDS: readonly Card[] = Array.from({ length: 40 }, (_, i) => card(`c${i + 1}`, i % 2 === 0));
const ROUTE: Route = { deckId: "aws-clf-c02", sectionId: "CON" };
export const T0 = 1_700_000_000_000; // the web tests' wall-clock origin, in epoch ms

function pool(size: number): Card[] {
  return CARDS.slice(0, size);
}

interface StartOptions {
  size?: number;
  seed?: number;
  history?: History;
  pool?: readonly Card[];
}

function args(mode: Mode, options: StartOptions = {}): StartArgs {
  return {
    mode,
    route: ROUTE,
    pool: options.pool ?? pool(options.size ?? 40),
    history: options.history ?? {},
    seed: options.seed ?? 1,
  };
}

// Nine cards missed before the round, three per chunk of a forty-card pool (modes.test.ts, the stored history).
const MISSED_IDS = ["c1", "c4", "c9", "c12", "c17", "c20", "c25", "c28", "c33"] as const;
const MISSED_HISTORY: History = Object.fromEntries(
  MISSED_IDS.map((id, i) => [id, { seen: 2, lastCorrect: false, lastSeenAt: 100 + i }]),
);

// Plays a round event by event and keeps every state.
class Player {
  readonly events: RoundEvent[] = [];
  readonly states: RoundState[];

  constructor(readonly start: StartArgs) {
    this.states = [startRound(start)];
  }

  get state(): RoundState {
    const last = this.states[this.states.length - 1];
    if (last === undefined) throw new Error("A trace always holds its start state.");
    return last;
  }

  send(...events: RoundEvent[]): this {
    for (const event of events) {
      this.events.push(event);
      this.states.push(reduce(this.state, event));
    }
    return this;
  }

  answer(value: boolean, at: number): this {
    return this.send({ type: "answer", value, at });
  }

  // Answers the card on screen right or wrong, as the web tests' give() does.
  give(right: boolean, at = 1000): this {
    const truth = currentCard(this.state)?.answer ?? true;
    return this.answer(right ? truth : !truth, at);
  }

  next(): this {
    return this.send({ type: "next" });
  }

  tick(now: number): this {
    return this.send({ type: "tick", now });
  }

  // Ticks every `step` ms from `from` (exclusive) to `to` (inclusive), as the web tests' ticks() does.
  ticks(from: number, to: number, step = 100): this {
    for (let now = from + step; now <= to; now += step) this.tick(now);
    return this;
  }

  hide(at: number): this {
    return this.send({ type: "visibility", hidden: true, at });
  }

  show(at: number): this {
    return this.send({ type: "visibility", hidden: false, at });
  }

  abandon(): this {
    return this.send({ type: "abandon" });
  }

  // Answers `count` cards right, pressing next after each.
  rightTimes(count: number, at = 1000): this {
    for (let i = 0; i < count; i++) this.give(true, at).next();
    return this;
  }

  // Timed: the clock counted down to 100 ms left on the first card, in one-second ticks.
  nearlyUp(): this {
    return this.tick(T0).ticks(T0, T0 + 59_000, 1_000).tick(T0 + 59_900);
  }
}

export interface Trace {
  name: string;
  start: StartArgs;
  events: readonly RoundEvent[];
  states: readonly RoundState[];
  read: boolean; // also a case of the state helpers (currentCard, lastAnswer, wrongCount, livesLeft, isDecided, summarise)
}

function trace(name: string, start: StartArgs, play: (player: Player) => void, read = false): Trace {
  const player = new Player(start);
  play(player);
  return { name, start, events: player.events, states: player.states, read };
}

// Plays every card right until `count` are answered: Next card in between, or for Timed one tick of the
// whole hold (modes.test.ts, playRight, which ticks every 100 ms to the same end).
function playRight(player: Player, mode: Mode, count: number): void {
  let now = T0;
  while (player.state.answers.length < count) {
    player.give(true, now);
    if (mode === "timed") {
      const answered = player.state.answers.length;
      while (player.state.answers.length === answered && player.state.phase === "stamped") player.tick((now += TIMED.holdMs));
    } else {
      player.next();
    }
  }
}

export function roundTraces(): Trace[] {
  const traces: Trace[] = [];
  const add = (name: string, start: StartArgs, play: (player: Player) => void, read = false) => {
    traces.push(trace(name, start, play, read));
  };

  // tests/engine/round.test.ts: Classic.
  add("round.test: records a right answer and shows the verdict", args("classic"), (p) => p.give(true, 1234), true);
  add("round.test: records a wrong answer as not correct", args("classic"), (p) => p.give(false, 50));
  add("round.test: ignores next before the card is answered", args("classic"), (p) => p.next());
  add("round.test: a Classic round ignores a tick", args("classic"), (p) => p.tick(5));
  add(
    "round.test: ignores a second answer to the same card (a double tap)",
    args("classic"),
    (p) => p.answer(true, 10).answer(false, 20),
    true,
  );
  add("round.test: moves to the next card on next", args("classic"), (p) => p.answer(true, 1000).next());
  add("round.test: finishes after the tenth card, not before", args("classic"), (p) => p.rightTimes(9).answer(true, 1000).next());
  add("round.test: finishes after the last card when the pool has fewer than ten", args("classic", { size: 3 }), (p) => p.rightTimes(3));
  add("round.test: finishes a round of a single card", args("classic", { size: 1 }), (p) => p.answer(false, 1000).next(), true);
  add("round.test: records every card once, in the order dealt", args("classic"), (p) => {
    for (let i = 0; i < 10; i++) p.answer(i % 3 === 0, 100 + i).next();
  });
  add("round.test: ignores answer and next once finished", args("classic", { size: 2 }), (p) =>
    p.answer(true, 1000).next().answer(true, 1000).next().answer(true, 1000).next(),
  );
  // The web test leaves the round after each of 20 events (answer, next, answer, ...); these are its first and
  // last cuts. Cuts 0, 1 and 2 are also the three abandon tests (before any answer, answered, question).
  for (const cut of [0, 1, 2, 3, 19]) {
    add(`round.test: can abandon at every point of a round (left after ${cut} events)`, args("classic"), (p) => {
      for (let i = 0; i < cut; i++) {
        if (i % 2 === 0) p.answer(true, 1000);
        else p.next();
      }
      p.abandon();
    });
  }
  add("round.test: ignores abandon once the round has finished normally", args("classic", { size: 1 }), (p) =>
    p.answer(true, 1000).next().abandon(),
  );
  add("round.test: ignores answer and next after abandoning", args("classic"), (p) => p.abandon().answer(true, 1000).next().abandon(), true);
  add(
    "round.test: scores a finished Classic round: correct answers out of ten, missed cards in order",
    args("classic"),
    (p) => {
      const wrongAt = new Set([2, 5, 7]);
      for (let i = 0; i < 10; i++) p.give(!wrongAt.has(i), 500 + i).next();
    },
    true,
  );
  add("round.test: scores a perfect round with no missed cards", args("classic"), (p) => p.rightTimes(10));
  add("round.test: scores a round of a small pool out of the cards it had", args("classic", { size: 4 }), (p) => p.rightTimes(4), true);
  add(
    "round.test: summarises an abandoned round with the answers given so far",
    args("classic"),
    (p) => p.give(false, 1).next().give(true, 1000).next().abandon(),
    true,
  );
  add(
    "round.test: plays a pool that lists a card twice as a round of its distinct cards, each answered once",
    args("classic", { pool: [...pool(6), ...pool(6)] }),
    (p) => p.rightTimes(6),
    true,
  );

  // tests/engine/modes.test.ts: Streak, Three lives, Classic, leaving, the seed and the history of each chunk.
  add("modes.test: Streak goes on after a right answer and deals a second chunk after card ten", args("streak"), (p) =>
    p.rightTimes(10),
  true);
  add("modes.test: Streak is decided by the first wrong answer; next then finishes it", args("streak"), (p) =>
    p.rightTimes(3).give(false).next(),
  true);
  add("modes.test: Streak is not decided by a right answer", args("streak"), (p) => p.give(true), true);
  add("modes.test: Streak scores zero when the first answer is wrong", args("streak"), (p) => p.give(false).next(), true);
  add("modes.test: Streak ignores a second answer to the ending card", args("streak"), (p) => p.give(false).answer(true, 2000));
  add("modes.test: Streak never runs out of cards on an 11 card route (21 answers, into the third chunk)", args("streak", { size: 11 }), (p) =>
    p.rightTimes(21),
  );
  add("modes.test: Three lives goes on after the first and the second wrong answer", args("lives"), (p) =>
    p.give(false).next().give(false).next(),
  true);
  add(
    "modes.test: Three lives is decided by the third wrong answer, wherever it falls; the score is the cards answered",
    args("lives"),
    (p) => {
      for (const right of [true, false, true, true, false, true]) p.give(right).next();
      p.give(false).next();
    },
    true,
  );
  add("modes.test: Three lives is not decided by a right answer on the last life", args("lives"), (p) =>
    p.give(false).next().give(false).next().give(true),
  true);
  add("modes.test: Three lives plays past the first chunk", args("lives", { size: 12 }), (p) => p.rightTimes(12));
  add("modes.test: Classic is decided by the answer to its last card and finishes on next", args("classic"), (p) =>
    p.rightTimes(9).give(true).next(),
  );
  add("modes.test: Classic is decided by the last card of a short route", args("classic", { size: 1 }), (p) => p.give(false), true);
  for (const mode of ["classic", "streak", "lives", "timed"] as const) {
    add(`modes.test: ${mode}: a round that is left is abandoned and keeps its answers`, args(mode), (p) => p.give(true).abandon(), true);
  }
  const decided: readonly [string, Mode, (p: Player) => Player][] = [
    ["Streak", "streak", (p) => p.rightTimes(5).give(false)],
    ["Classic", "classic", (p) => p.rightTimes(9).give(true)],
    ["Three lives", "lives", (p) => p.give(false).next().give(false).next().give(false)],
  ];
  for (const [label, mode, decide] of decided) {
    add(`modes.test: a decided ${label} round that is left is abandoned`, args(mode), (p) => decide(p).abandon(), true);
    add(`modes.test: a decided ${label} round finishes with its score on next`, args(mode), (p) => decide(p).next(), true);
  }
  add("modes.test: returns a finished round as it is", args("streak"), (p) => p.give(false).next().abandon());
  add(
    "modes.test: deals chunk 1 and chunk 2 of a round with chunkSeed(seed, 1) and chunkSeed(seed, 2)",
    args("streak", { seed: 4242 }),
    (p) => p.rightTimes(20),
  );
  // modes.test.ts plays seed 77 twice and seed 78 once, 25 cards each: replaying the seed 77 trace is the "same seed"
  // half of the test, and the seed 78 trace deals other cards.
  for (const seed of [77, 78]) {
    add(`modes.test: deals the same round for the same seed and events, across chunks (seed ${seed})`, args("streak", { seed }), (p) =>
      p.rightTimes(25),
    );
  }
  for (const mode of ["streak", "lives", "timed"] as const) {
    add(
      `modes.test: ${mode}: deals three missed cards in each of the first three chunks (seed 1)`,
      args(mode, { history: MISSED_HISTORY }),
      (p) => playRight(p, mode, 21),
    );
  }

  // tests/engine/timed.test.ts: the clock, the stamp, time up. Long stretches tick once a second, which
  // counts exactly as the web tests' 100 ms ticks do (a step of at most TIMED.maxStepMs counts in full).
  add("timed.test: starts full and stopped; the first tick starts it without taking time", args("timed"), (p) => p.tick(T0));
  for (const mode of ["classic", "streak", "lives"] as const) {
    add(`timed.test: ${mode} has no clock and ignores ticks and visibility`, args(mode), (p) => p.tick(T0).hide(T0));
  }
  add("timed.test: counts down by the time between ticks", args("timed"), (p) => p.tick(T0).tick(T0 + 100).tick(T0 + 350));
  add("timed.test: never counts backwards when the clock source jumps back", args("timed"), (p) =>
    p.tick(T0).tick(T0 + 500).tick(T0 + 200),
  );
  add("timed.test: counts a gap of more than a second between two ticks as one second", args("timed"), (p) =>
    p.tick(T0).tick(T0 + 45_000),
  );
  add("timed.test: pauses while the page is hidden and goes on from where it was", args("timed"), (p) =>
    p.tick(T0).tick(T0 + 1_000).hide(T0 + 1_400).tick(T0 + 5_000).tick(T0 + 9_000).show(T0 + 30_000).tick(T0 + 30_100),
  );
  add("timed.test: returns the same state for a tick while hidden, and for a repeated visibility event", args("timed"), (p) =>
    p.tick(T0).hide(T0 + 100).tick(T0 + 5_000).hide(T0 + 6_000),
  );
  add("timed.test: returns the same state for showing a page that is shown", args("timed"), (p) => p.tick(T0).show(T0 + 50));
  add(
    "timed.test: an answer is stamped: recorded, no answered phase, 700 ms hold",
    args("timed"),
    (p) => p.tick(T0).give(true, T0 + 2_000),
    true,
  );
  add("timed.test: counts the clock up to the moment of the answer", args("timed"), (p) => p.tick(T0).tick(T0 + 900).give(false, T0 + 950));
  add(
    "timed.test: ignores answer and next while stamped",
    args("timed"),
    (p) => p.tick(T0).give(true, T0 + 500).answer(true, T0 + 600).next(),
    true,
  );
  add(
    "timed.test: shows the next card once 700 ms have been counted since the answer, not before",
    args("timed"),
    (p) => p.tick(T0).give(true, T0 + 500).ticks(T0 + 500, T0 + 1_100).tick(T0 + 1_200),
    true,
  );
  add("timed.test: holds the stamp while the page is hidden", args("timed"), (p) =>
    p.tick(T0).give(true, T0 + 500).tick(T0 + 800).hide(T0 + 900).show(T0 + 20_000).tick(T0 + 20_200).tick(T0 + 20_300),
  );
  add("timed.test: deals the next chunk when the stamp ends on the last dealt card", args("timed"), (p) => {
    p.tick(T0);
    let now = T0;
    for (let i = 0; i < 10; i++) {
      now += 300;
      p.give(true, now).tick(now + 700);
      now += 700;
    }
  });
  // One trace for three tests: time up on the question, every later event but next ignored, next finishes it.
  add(
    "timed.test: stops at zero on the question, ignores every event but next and abandon, and finishes on next",
    args("timed"),
    (p) =>
      p
        .nearlyUp()
        .tick(T0 + 60_000)
        .tick(T0 + 60_100)
        .tick(T0 + 99_000)
        .hide(T0 + 60_200)
        .show(T0 + 60_300)
        .answer(true, T0 + 60_400)
        .next(),
    true,
  );
  add(
    "timed.test: next after time up finishes the round; the card on screen is neither counted nor recorded",
    args("timed"),
    (p) =>
      p
        .tick(T0)
        .give(true, T0 + 1_000)
        .ticks(T0 + 1_000, T0 + 1_700)
        .give(false, T0 + 2_000)
        .ticks(T0 + 2_000, T0 + 60_000, 1_000)
        .next(),
    true,
  );
  add("timed.test: an answer that arrives at or after zero does not count (at 60050)", args("timed"), (p) =>
    p.nearlyUp().answer(true, T0 + 60_050),
  );
  add(
    "timed.test: time running out during the stamp keeps that answer and moves on to a card that does not count",
    args("timed"),
    (p) => p.nearlyUp().give(true, T0 + 59_950).tick(T0 + 60_000),
    true,
  );
  add("timed.test: hiding the page at the moment the time runs out is time up, not a pause", args("timed"), (p) =>
    p.nearlyUp().hide(T0 + 60_000),
  );
  add("timed.test: a round left after time is up is abandoned like any other", args("timed"), (p) =>
    p.nearlyUp().tick(T0 + 60_000).abandon(),
  true);
  add("timed.test: ignores every tick after the round was left", args("timed"), (p) => p.tick(T0).abandon().tick(T0 + 100).hide(T0 + 200));
  add("timed.test: is the same round for the same seed and events (seed 5)", args("timed", { seed: 5 }), (p) =>
    p
      .tick(T0)
      .answer(true, T0 + 400)
      .ticks(T0 + 400, T0 + 1_100)
      .hide(T0 + 1_150)
      .show(T0 + 9_000)
      .tick(T0 + 9_100),
  );

  // tests/engine/clock-polish.test.ts: times that are not numbers.
  add("clock-polish.test: a tick at NaN, Infinity or -Infinity is ignored, and the minute still ends on time", args("timed"), (p) =>
    p
      .tick(T0)
      .ticks(T0, T0 + 5_000, 1_000)
      .tick(Number.NaN)
      .tick(Number.POSITIVE_INFINITY)
      .tick(Number.NEGATIVE_INFINITY)
      .ticks(T0 + 5_000, T0 + 61_000, 1_000)
      .give(true, T0 + 61_000),
  );
  add("clock-polish.test: an answer at NaN is ignored: it neither counts nor moves the clock", args("timed"), (p) =>
    p.tick(T0).ticks(T0, T0 + 2_000).give(true, Number.NaN),
  );
  add("clock-polish.test: a page shown again at NaN is ignored, so the clock keeps counting from a real moment", args("timed"), (p) =>
    p
      .tick(T0)
      .hide(T0 + 1_000)
      .show(Number.NaN)
      .show(T0 + 9_000)
      .ticks(T0 + 9_000, T0 + 70_000, 1_000),
  );
  add("clock-polish.test: a Classic answer at NaN is ignored", args("classic"), (p) => p.give(true, Number.NaN).give(true, T0));

  // Edges of the Timed clock that reference 3.3 states and no web test plays as a trace.
  add("edge: the first answer arms the clock when no tick came before it", args("timed"), (p) => p.give(true, T0).tick(T0 + 700), true);
  add("edge: a step of exactly one second counts in full, a longer one counts one second", args("timed"), (p) =>
    p.tick(T0).tick(T0 + 1_000).tick(T0 + 2_001),
  );
  add("edge: a tick at the same moment counts nothing, a step back counts nothing and moves lastTick", args("timed"), (p) =>
    p.tick(T0).tick(T0).tick(T0 + 500).tick(T0 + 200).tick(T0 + 300),
  );
  add("edge: an answer while hidden is stamped and its hold waits for the page to show", args("timed"), (p) =>
    p
      .tick(T0)
      .hide(T0 + 1_000)
      .give(true, T0 + 2_000)
      .tick(T0 + 3_000)
      .show(T0 + 5_000)
      .ticks(T0 + 5_000, T0 + 5_700),
  true);
  add("edge: hiding after the hold ran out shows the next card, then pauses", args("timed"), (p) => p.tick(T0).give(true, T0 + 100).hide(T0 + 900), true);
  add("edge: hiding after a long gap counts at most one second", args("timed"), (p) => p.tick(T0).hide(T0 + 5_000));
  add("edge: a last step longer than the time left stops the clock at zero", args("timed"), (p) => p.nearlyUp().tick(T0 + 61_000));
  add("edge: hiding at zero during a stamp moves on to a card that does not count", args("timed"), (p) =>
    p.nearlyUp().give(true, T0 + 59_950).hide(T0 + 60_000),
  );
  add("edge: next does nothing on a Timed round that is not decided", args("timed"), (p) => p.tick(T0).next());
  add("edge: a Timed round left while hidden is abandoned", args("timed"), (p) => p.tick(T0).hide(T0 + 100).abandon(), true);

  return traces;
}

function orUndefined(value: unknown): unknown {
  return value === undefined ? { $undefined: true } : value;
}

function thrown(run: () => unknown): unknown {
  try {
    return run();
  } catch (error) {
    return { $throws: error instanceof Error ? error.message : String(error) };
  }
}

function traceCases(traces: readonly Trace[], read: (state: RoundState) => unknown): GoldenCase[] {
  return traces.map((t) => ({
    name: t.name,
    input: { start: t.start, events: t.events },
    output: t.states.map((state) => orUndefined(read(state))),
  }));
}

function startRoundCases(): GoldenCase[] {
  const cases: { name: string; args: StartArgs }[] = [];
  for (let seed = 1; seed <= 20; seed++) cases.push({ name: `round.test: a Classic round of a 40-card pool, seed ${seed}`, args: args("classic", { seed }) });
  for (const size of [1, 4, 9, 10, 11]) cases.push({ name: `round.test: a Classic round of a ${size}-card pool`, args: args("classic", { size }) });
  for (const mode of ["classic", "streak", "lives", "timed"] as const) cases.push({ name: `round.test: starts a round in every mode: ${mode}`, args: args(mode) });
  cases.push({
    name: "round.test: passes the history to the dealer: the cards answered wrong come back",
    args: args("classic", {
      history: { c1: { seen: 1, lastCorrect: false, lastSeenAt: 1 }, c2: { seen: 1, lastCorrect: false, lastSeenAt: 2 } },
    }),
  });
  cases.push({ name: "modes.test: deals three missed cards in the first chunk (stored history)", args: args("streak", { history: MISSED_HISTORY }) });
  cases.push({ name: "round.test: a pool that lists a card twice deals its distinct cards", args: args("classic", { pool: [...pool(6), ...pool(6)] }) });
  cases.push({ name: "round.test: rejects a mode it does not know", args: args("sudden-death" as Mode) });
  cases.push({ name: "round.test: rejects an empty pool", args: args("classic", { pool: [] }) });
  return cases.map((c) => ({ name: c.name, input: { args: c.args }, output: thrown(() => snapshotRound(startRound(c.args))) }));
}

function answered(pattern: readonly boolean[]): Answered[] {
  return pattern.map((correct, i) => ({ card: card(`s${i}`, true), given: correct, correct, at: i }));
}

function scoreOfCases(): GoldenCase[] {
  const patterns: readonly [string, readonly boolean[]][] = [
    ["no answers", []],
    ["right, right, wrong, right (modes.test)", [true, true, false, true]],
    ["one wrong", [false]],
    ["one right", [true]],
    ["all right", [true, true, true, true, true]],
    ["all wrong", [false, false, false]],
    ["the longest run comes last", [true, false, true, true, true, false, true, true, true, true]],
    ["the longest run comes first", [true, true, true, false, true, false, true, true]],
  ];
  const cases: GoldenCase[] = [];
  for (const [label, pattern] of patterns) {
    for (const mode of ["classic", "streak", "lives", "timed"] as const) {
      const answers = answered(pattern);
      cases.push({ name: `${mode}: ${label}`, input: { mode, answers }, output: scoreOf(mode, answers) });
    }
  }
  return cases;
}

function chunkSeedCases(): GoldenCase[] {
  const pairs: readonly [number, number][] = [
    [12345, 0],
    [12345, 1],
    [12345, 2],
    [12345, 3],
    [12345, 4],
    [12345, 5],
    [0xffffffff, 1],
    [0, 0],
    [0, 1],
    [1, 2],
    [4242, 1],
    [4242, 2],
    [0xffffffff, 0],
    [0x80000000, 7],
    [1, 1000],
    [3_000_000_000, 100_000],
  ];
  return pairs.map(([seed, chunk]) => ({ name: `seed ${seed}, chunk ${chunk}`, input: { seed, chunk }, output: chunkSeed(seed, chunk) }));
}

function constant(name: string, value: unknown): GoldenFile {
  return goldenFile(meta(name), [{ name, input: null, output: value }]);
}

export function golden(): GoldenFile[] {
  const traces = roundTraces();
  const read = traces.filter((t) => t.read);
  return [
    goldenFile(meta("startRound"), startRoundCases()),
    goldenFile(meta("reduce"), traceCases(traces, snapshotRound)),
    goldenFile(meta("currentCard"), traceCases(read, currentCard)),
    goldenFile(meta("lastAnswer"), traceCases(read, lastAnswer)),
    goldenFile(meta("wrongCount"), traceCases(read, wrongCount)),
    goldenFile(meta("livesLeft"), traceCases(read, livesLeft)),
    goldenFile(meta("isDecided"), traceCases(read, isDecided)),
    goldenFile(meta("summarise"), traceCases(read, summarise)),
    goldenFile(meta("scoreOf"), scoreOfCases()),
    goldenFile(meta("chunkSeed"), chunkSeedCases()),
    constant("CLASSIC_LENGTH", CLASSIC_LENGTH),
    constant("LIVES", LIVES),
    constant("TIMED", TIMED),
  ];
}
```

- [ ] **Step 4: Run the round test and the typecheck.**

```bash
pnpm vitest run tests/scripts/native/golden-round.test.ts
pnpm typecheck
```

Expected: `Test Files  1 passed (1)`, `Tests  26 passed (26)`, and `tsc --noEmit` with no output. The test checks the web suites' own values on the traces: the paused clock reads `{remainingMs: 58500, lastTick: T0 + 30100, hidden: false, holdMs: 0}`, the stamp ends at `holdMs` 100 then 0 with 58 800 ms left, time running out during a stamp leaves index 1 with one answer, the three missed cards per chunk come out `[3, 3, 3]` in Streak, Three lives and Timed, `chunkSeed(12345, 1..5)` is `2654448114, 1013916587, 3668352356, 2027820829, 387289302`, and `scoreOf` over right, right, wrong, right gives 3, 2, 4 and 3. If a count differs (90 traces, 37 read by the helpers, 23, 29, 24, 4 and 10 by prefix), compare the trace list with rule 7 before changing a number.

- [ ] **Step 5: Commit.**

```bash
git add scripts/native/golden/round.ts tests/scripts/native/golden-round.test.ts
git commit -m "feat: golden round traces of the four classes and the Timed clock"
```

- [ ] **Step 6: Write the failing test of the swipe producer.**

`tests/scripts/native/golden-swipe.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { NATIVE_FUNCTIONS } from "@/scripts/native/registry";
import { golden } from "@/scripts/native/golden/swipe";

interface Case {
  name: string;
  input: unknown;
  output: unknown;
}
interface Parsed {
  format: number;
  module: string;
  function: string;
  source: string;
  tests: string[];
  cards: Record<string, unknown>;
  cases: Case[];
}

const files = golden();
const parsed = new Map(files.map((f) => [f.path, JSON.parse(f.content) as Parsed]));

function file(name: string): Parsed {
  const found = parsed.get(`native-data/golden/src.input.swipe.${name}.json`);
  if (found === undefined) throw new Error(`No golden file for ${name}.`);
  return found;
}

// The output of every case, by case name.
function outputs(name: string): Map<string, unknown> {
  return new Map(file(name).cases.map((c) => [c.name, c.output]));
}

describe("golden swipe: the files", () => {
  it("writes one file per function and constant of swipe in reference 3.9, with the registry's meta and no cards", () => {
    expect(files.map((f) => f.path).sort()).toEqual(
      ["SWIPE", "canStart", "intent", "interpret"].map((n) => `native-data/golden/src.input.swipe.${n}.json`),
    );
    const entries = NATIVE_FUNCTIONS.filter((f) => f.module === "src/input/swipe");
    expect(entries.map((e) => e.name).sort()).toEqual(["SWIPE", "canStart", "intent", "interpret"]);
    for (const entry of entries) {
      const golden = file(entry.name);
      expect([golden.format, golden.module, golden.function, golden.source, golden.tests, golden.cards]).toEqual([
        1,
        entry.module,
        entry.name,
        entry.source,
        [...entry.tests],
        {},
      ]);
    }
  });

  it("is the same on every run, with case names unique in each file", () => {
    expect(golden().map((f) => f.content)).toEqual(files.map((f) => f.content));
    for (const f of parsed.values()) expect(new Set(f.cases.map((c) => c.name)).size).toBe(f.cases.length);
  });
});

describe("golden swipe: the web tests' values", () => {
  it("SWIPE: the input table of the spec", () => {
    expect(file("SWIPE").cases).toEqual([
      { name: "SWIPE", input: null, output: { commitPx: 90, flingPx: 40, flingVelocity: 0.5, settleMs: 250, edgePx: 24 } },
    ]);
  });

  it("intent: proportional inside 110 px and clamped beyond", () => {
    const out = outputs("intent");
    expect(file("intent").cases).toHaveLength(16);
    expect(out.get("swipe.test: zero when the card has not moved")).toBe(0);
    expect(out.get("swipe.test: proportional inside 110 px (55)")).toBe(0.5);
    expect(out.get("swipe.test: exactly -1 at -110 px")).toBe(-1);
    expect(out.get("swipe.test: clamped beyond 110 px (500)")).toBe(1);
    expect(out.get("boundary: 33 px (0.3, which has no exact binary form)")).toBe(33 / 110);
  });

  it("canStart: the settle time and the edge zones, both ends inclusive", () => {
    const out = outputs("canStart");
    expect(file("canStart").cases).toHaveLength(25);
    expect(out.get("swipe.test: ignores a touch 249 ms after the card appeared")).toBe(false);
    expect(out.get("swipe.test: accepts a touch exactly 250 ms after the card appeared")).toBe(true);
    expect(out.get("swipe.test: ignores a touch at x 23 (inside the left edge zone)")).toBe(false);
    expect(out.get("swipe.test: accepts a touch at viewportWidth minus 24")).toBe(true);
    expect(out.get("swipe-early-touch-polish.test: ignores a touch a whole second before the card appeared")).toBe(false);
    expect(out.get("boundary: fractional times, exactly 250 ms apart")).toBe(true);
    expect(out.get("boundary: fractional times, just under 250 ms apart")).toBe(false);
    expect(out.get("boundary: a 1024 wide window (tablet), x 1000")).toBe(true);
    expect(out.get("boundary: a 1024 wide window (tablet), x 1001")).toBe(false);
  });

  it("interpret: every gesture of the three web suites, with the web's verdict", () => {
    const cases = file("interpret").cases;
    expect(cases.filter((c) => c.name.startsWith("swipe.test: "))).toHaveLength(33);
    expect(cases.filter((c) => c.name.startsWith("swipe-polish.test: "))).toHaveLength(4);
    expect(cases.filter((c) => c.name.startsWith("boundary: "))).toHaveLength(17);
    const out = outputs("interpret");
    const expected: readonly [string, string][] = [
      ["swipe.test: commits at exactly 90 px", "true"],
      ["swipe.test: cancels at 89 px", "cancel"],
      ["swipe.test: commits at exactly 90 px to the left", "false"],
      ["swipe.test: commits an exactly diagonal gesture", "true"],
      ["swipe.test: cancels a mostly vertical gesture upwards", "cancel"],
      ["swipe.test: commits a fast fling that travelled 40 px", "true"],
      ["swipe.test: cancels a fast fling that travelled 39 px", "cancel"],
      ["swipe.test: commits at exactly 0.5 px/ms measured over exactly 80 ms", "true"],
      ["swipe.test: cancels just below 0.5 px/ms", "cancel"],
      ["swipe.test: cancels a 120 px swipe that started in the left edge zone", "cancel"],
      ["swipe-polish.test: does not count a reference sample 81 ms before the release", "cancel"],
      ["swipe-polish.test: counts a reference sample exactly 80 ms before the release", "true"],
      ["swipe-polish.test: takes the oldest sample inside the window, so a fast stretch followed by a pause still flings", "true"],
      ["swipe-polish.test: takes the oldest sample inside the window, so a slow drag that ends in a one-frame jerk does not fling", "cancel"],
      ["boundary: exactly 0.5 px/ms to the left over 80 ms is false", "false"],
      ["boundary: a fractional reference 80.5 ms before the release is outside the window", "cancel"],
      ["boundary: a start 249 ms after the card cancels", "cancel"],
      ["boundary: a tablet window measures the edge zone from the window, not the card", "false"],
    ];
    for (const [name, verdict] of expected) expect(out.get(name), name).toBe(verdict);
  });

  it("interpret: writes the samples and the context as the function takes them", () => {
    const first = file("interpret").cases.find((c) => c.name === "swipe.test: commits at exactly 90 px");
    expect(first?.input).toEqual({
      samples: [
        { x: 195, y: 400, t: 1000 },
        { x: 240, y: 400, t: 1300 },
        { x: 285, y: 400, t: 1600 },
      ],
      context: { viewportWidth: 390, cardShownAt: 0 },
    });
  });
});
```

- [ ] **Step 7: Run it and see it fail.**

```bash
pnpm vitest run tests/scripts/native/golden-swipe.test.ts
```

Expected: `Error: Cannot find package '@/scripts/native/golden/swipe' imported from .../tests/scripts/native/golden-swipe.test.ts`, `Test Files  1 failed (1)`, `Tests  no tests`.

- [ ] **Step 8: Write the swipe producer.**

`scripts/native/golden/swipe.ts`:

```ts
// Golden vectors of swipe interpretation (reference 3.4 and 3.9), computed by running src/input/swipe.ts:
// every gesture of the web's swipe tests, and boundary tables around each threshold (settle time, edge
// zones, commit distance, fling distance and velocity, the 80 ms window), also with fractional times.
import { SWIPE, canStart, intent, interpret, type SwipeContext, type SwipeSample } from "@/src/input/swipe";
import { goldenFile, type GoldenCase, type GoldenFile, type GoldenMeta } from "./format";

const TESTS = [
  "tests/input/swipe.test.ts",
  "tests/input/swipe-polish.test.ts",
  "tests/input/swipe-early-touch-polish.test.ts",
] as const;

function meta(name: string): GoldenMeta {
  return { module: "src/input/swipe", function: name, source: "src/input/swipe.ts", tests: TESTS };
}

// The web tests' phone: a 390 wide window whose card appeared at t = 0; gestures start mid-screen at t = 1000.
const PHONE: SwipeContext = { viewportWidth: 390, cardShownAt: 0 };
const START = { x: 195, y: 400, t: 1000 };

// Samples from offsets relative to START, each one [dx, dy, dt], as the web tests' gesture() builds them.
function gesture(...offsets: [number, number, number][]): SwipeSample[] {
  return offsets.map(([dx, dy, dt]) => ({ x: START.x + dx, y: START.y + dy, t: START.t + dt }));
}

function intentCases(): GoldenCase[] {
  const table: readonly [string, number][] = [
    ["swipe.test: zero when the card has not moved", 0],
    ["swipe.test: proportional inside 110 px (55)", 55],
    ["swipe.test: proportional inside 110 px (-55)", -55],
    ["swipe.test: exactly 1 at 110 px", 110],
    ["swipe.test: exactly -1 at -110 px", -110],
    ["swipe.test: clamped beyond 110 px (500)", 500],
    ["swipe.test: clamped beyond 110 px (-500)", -500],
    ["boundary: 1 px", 1],
    ["boundary: -1 px", -1],
    ["boundary: 33 px (0.3, which has no exact binary form)", 33],
    ["boundary: just inside 110 px", 109.99],
    ["boundary: just past 110 px", 110.01],
    ["boundary: just inside -110 px", -109.99],
    ["boundary: a fractional drag", 12.345],
    ["boundary: the commit line", 90],
    ["boundary: the fling line to the left", -40],
  ];
  return table.map(([name, dx]) => ({ name, input: { dx }, output: intent(dx) }));
}

function canStartCases(): GoldenCase[] {
  const at = (x: number, t: number, viewportWidth = 390, cardShownAt = 0) => ({
    sample: { x, y: 400, t },
    context: { viewportWidth, cardShownAt },
  });
  const table: readonly [string, ReturnType<typeof at>][] = [
    ["swipe.test: ignores a touch 249 ms after the card appeared", at(195, 249)],
    ["swipe.test: accepts a touch exactly 250 ms after the card appeared", at(195, 250)],
    ["swipe.test: measures from cardShownAt, not from zero (100 ms after)", at(195, 10_100, 390, 10_000)],
    ["swipe.test: measures from cardShownAt, not from zero (250 ms after)", at(195, 10_250, 390, 10_000)],
    ["swipe.test: ignores a touch at x 23 (inside the left edge zone)", at(23, 1000)],
    ["swipe.test: accepts a touch at x 24", at(24, 1000)],
    ["swipe.test: ignores a touch at viewportWidth minus 23", at(367, 1000)],
    ["swipe.test: accepts a touch at viewportWidth minus 24", at(366, 1000)],
    ["swipe.test: ignores a touch at x 0", at(0, 1000)],
    ["swipe.test: ignores a touch that began before the card appeared", at(195, 4990, 390, 5000)],
    ["swipe-early-touch-polish.test: ignores a touch a whole second before the card appeared", at(100, 0, 390, 1000)],
    ["swipe-early-touch-polish.test: ignores a touch more than the settle time before the card", at(100, 749, 390, 1000)],
    ["boundary: 251 ms after the card appeared", at(195, 251)],
    ["boundary: a touch at the card's own moment", at(195, 0)],
    ["boundary: fractional times, exactly 250 ms apart", at(195, 350.25, 390, 100.25)],
    ["boundary: fractional times, just under 250 ms apart", at(195, 350.24, 390, 100.25)],
    ["boundary: x 23.5, inside the left edge zone", at(23.5, 1000)],
    ["boundary: x 366.5, inside the right edge zone", at(366.5, 1000)],
    ["boundary: x at the window's right edge", at(390, 1000)],
    ["boundary: x left of the window", at(-1, 1000)],
    ["boundary: a 430 wide window, x 406 (its last allowed x)", at(406, 1000, 430)],
    ["boundary: a 430 wide window, x 407", at(407, 1000, 430)],
    ["boundary: a 1024 wide window (tablet), x 1000", at(1000, 1000, 1024)],
    ["boundary: a 1024 wide window (tablet), x 1001", at(1001, 1000, 1024)],
    ["boundary: too early and inside the edge zone", at(10, 100)],
  ];
  return table.map(([name, input]) => ({ name, input, output: canStart(input.sample, input.context) }));
}

function interpretCases(): GoldenCase[] {
  const slow = Array.from({ length: 31 }, (_, i): [number, number, number] => [2 * i, 0, 16 * i]);
  const table: readonly [string, readonly SwipeSample[], SwipeContext][] = [
    // tests/input/swipe.test.ts
    ["swipe.test: cancels with no samples", [], PHONE],
    ["swipe.test: cancels with a single sample", gesture([0, 0, 0]), PHONE],
    ["swipe.test: cancels when the card did not move", gesture([0, 0, 0], [0, 0, 500]), PHONE],
    ["swipe.test: commits at exactly 90 px", gesture([0, 0, 0], [45, 0, 300], [90, 0, 600]), PHONE],
    ["swipe.test: cancels at 89 px", gesture([0, 0, 0], [45, 0, 300], [89, 0, 600]), PHONE],
    ["swipe.test: commits at exactly 90 px to the left", gesture([0, 0, 0], [-45, 0, 300], [-90, 0, 600]), PHONE],
    ["swipe.test: cancels when dragged past 90 px and back inside before release", gesture([0, 0, 0], [150, 0, 300], [60, 0, 900]), PHONE],
    ["swipe.test: cancels when dragged past 90 px and released exactly at the start", gesture([0, 0, 0], [150, 0, 300], [0, 0, 900]), PHONE],
    ["swipe.test: a release 120 px to the right is true", gesture([0, 0, 0], [120, 5, 600]), PHONE],
    ["swipe.test: a release 120 px to the left is false", gesture([0, 0, 0], [-120, 5, 600]), PHONE],
    ["swipe.test: the side at release wins, not the side first visited", gesture([0, 0, 0], [120, 0, 300], [-100, 0, 900]), PHONE],
    ["swipe.test: cancels a mostly vertical gesture even when it ends 100 px to the side", gesture([0, 0, 0], [50, 150, 300], [100, 300, 600]), PHONE],
    ["swipe.test: cancels a mostly vertical gesture upwards", gesture([0, 0, 0], [-100, -101, 600]), PHONE],
    ["swipe.test: commits an exactly diagonal gesture", gesture([0, 0, 0], [100, 100, 600]), PHONE],
    ["swipe.test: commits a horizontal swipe with some vertical drift", gesture([0, 0, 0], [60, 20, 300], [120, 40, 600]), PHONE],
    ["swipe.test: commits a fast fling that travelled 40 px", gesture([0, 0, 0], [20, 0, 20], [40, 0, 40]), PHONE],
    ["swipe.test: cancels a fast fling that travelled 39 px", gesture([0, 0, 0], [20, 0, 20], [39, 0, 40]), PHONE],
    ["swipe.test: commits a fast fling of 40 px to the left as false", gesture([0, 0, 0], [-20, 0, 20], [-40, 0, 40]), PHONE],
    ["swipe.test: cancels a slow release at 60 px (pointer moves sampled every 16 ms)", gesture(...slow), PHONE],
    ["swipe.test: cancels a slow release at 60 px with sparse samples", gesture([0, 0, 0], [30, 0, 200], [60, 0, 400]), PHONE],
    ["swipe.test: uses only the last 80 ms: a fast start followed by a slow finish cancels", gesture([0, 0, 0], [50, 0, 50], [55, 0, 100], [60, 0, 150]), PHONE],
    ["swipe.test: cancels a fast flick back towards the start", gesture([0, 0, 0], [80, 0, 400], [65, 0, 420], [50, 0, 440]), PHONE],
    ["swipe.test: cancels two samples with the same timestamp below the fling distance", gesture([0, 0, 0], [50, 0, 0]), PHONE],
    ["swipe.test: commits two samples with the same timestamp at 100 px by distance", gesture([0, 0, 0], [100, 0, 0]), PHONE],
    ["swipe.test: cancels when every sample in the last 80 ms shares the release timestamp", gesture([0, 0, 0], [50, 0, 200], [60, 0, 200]), PHONE],
    ["swipe.test: commits a zig-zag that is released 95 px to the right", gesture([0, 0, 0], [40, 0, 20], [-40, 0, 40], [40, 0, 60], [-40, 0, 80], [95, 0, 100]), PHONE],
    ["swipe.test: cancels a fast zig-zag released near the start", gesture([0, 0, 0], [60, 0, 20], [-60, 0, 40], [60, 0, 60], [-60, 0, 80], [10, 0, 100]), PHONE],
    ["swipe.test: cancels a zig-zag released at 50 px while moving back towards the start", gesture([0, 0, 0], [100, 0, 100], [20, 0, 200], [90, 0, 300], [50, 0, 340]), PHONE],
    ["swipe.test: commits a zig-zag released at 50 px while moving fast away from the start", gesture([0, 0, 0], [100, 0, 100], [-20, 0, 200], [10, 0, 300], [50, 0, 340]), PHONE],
    ["swipe.test: cancels a 120 px swipe that started inside the settle time", gesture([0, 0, 0], [120, 0, 300]), { viewportWidth: 390, cardShownAt: 900 }],
    ["swipe.test: cancels a 120 px swipe that started in the left edge zone", [{ x: 10, y: 400, t: 1000 }, { x: 130, y: 400, t: 1300 }], PHONE],
    ["swipe.test: commits at exactly 0.5 px/ms measured over exactly 80 ms", gesture([0, 0, 0], [20, 0, 400], [60, 0, 480]), PHONE],
    ["swipe.test: cancels just below 0.5 px/ms", gesture([0, 0, 0], [20, 0, 400], [59, 0, 480]), PHONE],
    // tests/input/swipe-polish.test.ts
    ["swipe-polish.test: does not count a reference sample 81 ms before the release", gesture([0, 0, 0], [5, 0, 400], [50, 0, 481]), PHONE],
    ["swipe-polish.test: counts a reference sample exactly 80 ms before the release", gesture([0, 0, 0], [5, 0, 401], [50, 0, 481]), PHONE],
    ["swipe-polish.test: takes the oldest sample inside the window, so a fast stretch followed by a pause still flings", gesture([0, 0, 0], [10, 0, 400], [48, 0, 460], [50, 0, 470]), PHONE],
    ["swipe-polish.test: takes the oldest sample inside the window, so a slow drag that ends in a one-frame jerk does not fling", gesture([0, 0, 0], [30, 0, 400], [30, 0, 460], [50, 0, 470]), PHONE],
    // Boundary tables
    ["boundary: commits at exactly -90 px with no speed", gesture([0, 0, 0], [-90, 0, 600]), PHONE],
    ["boundary: cancels at -89 px with no speed", gesture([0, 0, 0], [-89, 0, 600]), PHONE],
    ["boundary: cancels at 89.5 px with no speed", gesture([0, 0, 0], [89.5, 0, 600]), PHONE],
    ["boundary: an exact diagonal to the upper left is false", gesture([0, 0, 0], [-100, -100, 600]), PHONE],
    ["boundary: vertical travel one more than horizontal cancels", gesture([0, 0, 0], [100, 101, 600]), PHONE],
    ["boundary: a purely vertical move cancels (dx is 0)", gesture([0, 0, 0], [0, 50, 300]), PHONE],
    ["boundary: exactly 0.5 px/ms to the left over 80 ms is false", gesture([0, 0, 0], [-20, 0, 400], [-60, 0, 480]), PHONE],
    ["boundary: a fast release towards the side under 40 px cancels", gesture([0, 0, 0], [39.9, 0, 10]), PHONE],
    ["boundary: fractional times inside the window fling", gesture([0, 0, 0], [5, 0, 400.5], [50, 0, 480.5]), PHONE],
    ["boundary: a fractional reference 80.5 ms before the release is outside the window", gesture([0, 0, 0], [5, 0, 400], [50, 0, 480.5]), PHONE],
    ["boundary: a start at x 24 commits", [{ x: 24, y: 400, t: 1000 }, { x: 144, y: 400, t: 1600 }], PHONE],
    ["boundary: a start at x 366 commits to the left", [{ x: 366, y: 400, t: 1000 }, { x: 246, y: 400, t: 1600 }], PHONE],
    ["boundary: a start at x 367 cancels", [{ x: 367, y: 400, t: 1000 }, { x: 247, y: 400, t: 1600 }], PHONE],
    ["boundary: a start exactly 250 ms after the card commits", gesture([0, 0, 0], [120, 0, 300]), { viewportWidth: 390, cardShownAt: 750 }],
    ["boundary: a start 249 ms after the card cancels", gesture([0, 0, 0], [120, 0, 300]), { viewportWidth: 390, cardShownAt: 751 }],
    ["boundary: a release beyond the window edge still commits (only the start is checked)", [{ x: 300, y: 400, t: 1000 }, { x: 400, y: 400, t: 1600 }], PHONE],
    ["boundary: a tablet window measures the edge zone from the window, not the card", [{ x: 1000, y: 400, t: 1000 }, { x: 880, y: 400, t: 1600 }], { viewportWidth: 1024, cardShownAt: 0 }],
  ];
  return table.map(([name, samples, context]) => ({ name, input: { samples, context }, output: interpret(samples, context) }));
}

export function golden(): GoldenFile[] {
  return [
    goldenFile(meta("intent"), intentCases()),
    goldenFile(meta("canStart"), canStartCases()),
    goldenFile(meta("interpret"), interpretCases()),
    goldenFile(meta("SWIPE"), [{ name: "SWIPE", input: null, output: SWIPE }]),
  ];
}
```

- [ ] **Step 9: Run the swipe test.**

```bash
pnpm vitest run tests/scripts/native/golden-swipe.test.ts
```

Expected: `Test Files  1 passed (1)`, `Tests  7 passed (7)`. Every verdict equals the web test it is named after (33 gestures of `swipe.test.ts`, 4 of `swipe-polish.test.ts`, 17 boundary rows; 25 `canStart` rows, 16 `intent` rows).

- [ ] **Step 10: Write the failing test of the registration.**

`tests/scripts/native/producers-round-swipe.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { goldenProducers } from "@/scripts/native/registry";
import { golden as roundGolden } from "@/scripts/native/golden/round";
import { golden as swipeGolden } from "@/scripts/native/golden/swipe";

describe("goldenProducers", () => {
  it("runs the round and swipe producers of task 6", () => {
    expect(goldenProducers()).toEqual(expect.arrayContaining([roundGolden, swipeGolden]));
  });
});
```

```bash
pnpm vitest run tests/scripts/native/producers-round-swipe.test.ts
```

Expected: `AssertionError: expected [ ... ] to deeply equal ArrayContaining{…}` (the list holds task 4's and task 5's producers, not these two), `Tests  1 failed (1)`.

- [ ] **Step 11: Register the two producers.**

In `scripts/native/registry.ts`, add these imports below the other `./golden/...` imports:

```ts
import { golden as roundGolden } from "./golden/round";
import { golden as swipeGolden } from "./golden/swipe";
```

and append `roundGolden, swipeGolden` to the array `goldenProducers()` returns, after the producer task 5 added. If task 5 left `return [rngGolden, smallGolden, dealGolden];`, it becomes:

```ts
  return [rngGolden, smallGolden, dealGolden, roundGolden, swipeGolden];
```

Neither producer file imports the registry, so the two imports make no import cycle.

- [ ] **Step 12: Run every native producer test, the typecheck and the whole suite.**

```bash
pnpm vitest run tests/scripts/native
pnpm typecheck
pnpm test
```

Expected: every file under `tests/scripts/native` passes, among them `golden-round.test.ts` (26), `golden-swipe.test.ts` (7) and `producers-round-swipe.test.ts` (1); `tsc --noEmit` prints nothing; `pnpm test` ends with `Test Files  163 passed (163)` and `Tests  3314 passed (3314)`: task 5's 160 and 3280 plus this task's 3 files and 34 tests. The three files of this task take under half a second together (the 90 traces play in well under a second).

- [ ] **Step 13: Commit.**

```bash
git add scripts/native/golden/swipe.ts scripts/native/registry.ts tests/scripts/native/golden-swipe.test.ts tests/scripts/native/producers-round-swipe.test.ts
git commit -m "feat: golden swipe tables, and the round and swipe producers in the registry"
```
