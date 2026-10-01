### Task 5: The round keeps dealing; Streak and Three lives

The reducer gets what the two unbounded, clock-free modes need (spec section 6, "Modes"): a round that remembers what it deals from and adds a chunk when it runs out, the end rule of Streak (the first wrong answer) and of Three lives (the third wrong answer), a way to tell that the answer on screen decided the round (so the play screen can say "See results"), and the score each mode's record keeps. Leaving a round stays what it is: the `abandon` event, in every state. Classic keeps dealing exactly as it does (the first chunk is the old ten-card deal, same seed, same cards). The start flow still offers only Classic (`offered` in the mode table), so nothing changes for a player; `/play` could now run a Streak round, which task 7 and 8 dress.

**Files:**
- Modify: `src/engine/round.ts` (replaced by the code below)
- Test: create `tests/engine/modes.test.ts`; modify `tests/engine/round.test.ts`, `tests/app-state/pending.test.ts`, `tests/progress/progress.test.ts`

**Interfaces:**
- Consumes:
  - Task 4, `src/engine/deal.ts`: `CHUNK = 10`, `dealChunk(pool: readonly Card[], history: History, rng: Rng, dealt: readonly Card[]): Card[]`.
  - Task 2, `src/content/play.ts`: `Mode`, `Answered`, `History`, `RoundResult`.
  - `src/engine/rng.ts`: `createRng(seed: number): Rng`.
  - `src/progress/progress.ts`: `applyResult(progress, result): ApplyOutcome` (unchanged by this task).
- Produces (`src/engine/round.ts`; unchanged names keep their signatures):

```ts
export const AVAILABLE_MODES: readonly Mode[];            // ["classic", "streak", "lives"]: what the engine can play
export const CLASSIC_LENGTH = 10;                          // = CHUNK
export const LIVES = 3;
export interface DealSource { pool: readonly Card[]; history: History; seed: number; chunks: number }
export interface RoundState { mode; route; cards; index; answers; phase; abandoned; source: DealSource }
export function chunkSeed(seed: number, chunk: number): number;
export function wrongCount(state: RoundState): number;
export function livesLeft(state: RoundState): number;     // 3, 2, 1, 0
export function isDecided(state: RoundState): boolean;
export function scoreOf(mode: Mode, answers: readonly Answered[]): number;
```

**Rules:**

1. **State.** `cards` is every card dealt so far, in order. `source` holds the route's pool, the stored history, the round's seed and the number of chunks dealt. `startRound` deals the first chunk (`source.chunks` is 1 afterwards).
2. **Chunk seeds.** Chunk `k` (from 0) is dealt with `createRng(chunkSeed(seed, k))`, `chunkSeed(seed, k) = (seed + Math.imul(k, 0x9e3779b9)) >>> 0`. Chunk 0 uses the seed itself, so a Classic round is the same ten cards in the same order as before this task for every seed.
3. **Classic** (unchanged): ten cards, or the whole route when it has fewer. It never deals a second chunk. The answer to its last card decides it.
4. **Streak:** unbounded. A right answer leads to `next` and the next card; when `index + 1` reaches `cards.length`, `next` deals the next chunk first. The first wrong answer decides the round.
5. **Three lives:** unbounded, same dealing. `livesLeft` is `3 - wrong answers`, never below 0. The third wrong answer decides the round.
6. **Decided.** `isDecided(state)` is true when the mode's end rule is met and only the result is left: phase `answered` and (Classic) the card is the last dealt one, (Streak) the last answer is wrong, (Three lives) three answers are wrong. It is false in every other state, also once the round is `finished`. On a decided round `next` sets `phase: "finished"` (index unchanged, `abandoned` false) and `answer` is ignored (the phase is `answered`).
7. **Leaving.** The `abandon` event is unchanged: any round that is not finished becomes `finished` and `abandoned`, a decided round included. Only `next` finishes a decided round with its score. So a player who leaves after the deciding answer, without "See results", sets no record and keeps the answers in the card history, exactly as mid-round (spec section 2, "Leaving a round", and section 6: "A round that is left sets no record"). A finished round returns itself for every event.
8. **Scores** (`scoreOf`, used by `summarise`): Classic and Timed: the correct answers. Streak: the longest run of correct answers (in a finished Streak round that is every answer but the last). Three lives: the cards answered, the one that cost the last life included. `total` is the cards answered in every mode.
9. `AVAILABLE_MODES` becomes `["classic", "streak", "lives"]`; `startRound` still throws `The mode "timed" is not available.` Task 6 removes the constant.
10. `reduce` returns the very same state object for an event that does not apply; it never changes its argument (the tests freeze every state).

**Code:** `src/engine/round.ts`, complete:

```ts
// The round: a pure reducer over the dealt cards (spec section 6, "Shape" and "Modes").
// Randomness comes only from the seed given to startRound; time comes in on the events.

import type { Card, Route } from "@/src/content/schema";
import type { Answered, History, Mode, RoundResult } from "@/src/content/play";
import { CHUNK, dealChunk } from "./deal";
import { createRng } from "./rng";

export type { Answered, Mode, RoundResult } from "@/src/content/play";

export const AVAILABLE_MODES: readonly Mode[] = ["classic", "streak", "lives"]; // the modes this engine can play; Timed follows
export const CLASSIC_LENGTH = CHUNK; // a Classic round is the first chunk
export const LIVES = 3;

export type Phase = "question" | "answered" | "finished";

// What the next chunk is dealt from: the route's cards, the stored history, the round's seed and how many
// chunks it has dealt.
export interface DealSource {
  pool: readonly Card[];
  history: History;
  seed: number;
  chunks: number;
}

export interface RoundState {
  mode: Mode;
  route: Route;
  cards: readonly Card[]; // every card dealt so far, in order; the unbounded modes add a chunk when they run out
  index: number; // index of the current card
  answers: readonly Answered[];
  phase: Phase;
  abandoned: boolean;
  source: DealSource;
}

export type RoundEvent = { type: "answer"; value: boolean; at: number } | { type: "next" } | { type: "abandon" };

export interface StartArgs {
  mode: Mode;
  route: Route;
  pool: readonly Card[];
  history: History;
  seed: number;
}

// The seed of chunk k of a round: the round's seed for the first chunk, then steps of the 32-bit golden
// ratio. Math.imul and >>> 0 keep it an unsigned 32-bit integer, as the Swift and Kotlin clones compute it.
export function chunkSeed(seed: number, chunk: number): number {
  return (seed + Math.imul(chunk, 0x9e3779b9)) >>> 0;
}

function withNextChunk(state: RoundState): RoundState {
  const { pool, history, seed, chunks } = state.source;
  const chunk = dealChunk(pool, history, createRng(chunkSeed(seed, chunks)), state.cards);
  return { ...state, cards: [...state.cards, ...chunk], source: { ...state.source, chunks: chunks + 1 } };
}

// Throws if the mode is not in AVAILABLE_MODES or the pool is empty.
export function startRound(args: StartArgs): RoundState {
  if (!AVAILABLE_MODES.includes(args.mode)) {
    throw new Error(`The mode "${args.mode}" is not available.`);
  }
  if (args.pool.length === 0) {
    throw new Error(`The route ${args.route.deckId}/${args.route.sectionId} has no cards to deal.`);
  }
  return withNextChunk({
    mode: args.mode,
    route: args.route,
    cards: [],
    index: 0,
    answers: [],
    phase: "question",
    abandoned: false,
    source: { pool: args.pool, history: args.history, seed: args.seed, chunks: 0 },
  });
}

// The card on screen; undefined once the round is finished.
export function currentCard(state: RoundState): Card | undefined {
  return state.phase === "finished" ? undefined : state.cards[state.index];
}

export function lastAnswer(state: RoundState): Answered | undefined {
  return state.answers[state.answers.length - 1];
}

export function wrongCount(state: RoundState): number {
  return state.answers.filter((answer) => !answer.correct).length;
}

export function livesLeft(state: RoundState): number {
  return Math.max(0, LIVES - wrongCount(state));
}

// Decided: the mode's end rule has been met and only the result is left to show. No answer can change the
// score any more; the next event finishes the round.
export function isDecided(state: RoundState): boolean {
  if (state.phase === "finished") return false;
  switch (state.mode) {
    case "classic":
      return state.phase === "answered" && state.index + 1 >= state.cards.length;
    case "streak":
      return state.phase === "answered" && lastAnswer(state)?.correct === false;
    case "lives":
      return state.phase === "answered" && wrongCount(state) >= LIVES;
    case "timed":
      return false; // task 6
  }
}

// Pure: returns a new state, or the very same state when the event does not apply.
export function reduce(state: RoundState, event: RoundEvent): RoundState {
  if (state.phase === "finished") return state;
  switch (event.type) {
    case "answer":
      return state.phase === "question" ? recordAnswer(state, event.value, event.at) : state;
    case "next":
      if (isDecided(state)) return { ...state, phase: "finished" };
      return state.phase === "answered" ? advance(state) : state;
    case "abandon":
      return { ...state, phase: "finished", abandoned: true };
    default:
      return state;
  }
}

// To the next card as a question. When the dealt cards run out, the next chunk is dealt first
// (dealChunk never returns an empty chunk).
function advance(state: RoundState): RoundState {
  const index = state.index + 1;
  const dealt = index < state.cards.length ? state : withNextChunk(state);
  return { ...dealt, index, phase: "question" };
}

function recordAnswer(state: RoundState, given: boolean, at: number): RoundState {
  const card = state.cards[state.index];
  if (card === undefined) return state;
  return { ...state, answers: [...state.answers, { card, given, correct: given === card.answer, at }], phase: "answered" };
}

// The number a mode's record keeps (spec section 6, "Modes").
export function scoreOf(mode: Mode, answers: readonly Answered[]): number {
  switch (mode) {
    case "classic":
    case "timed":
      return answers.filter((answer) => answer.correct).length;
    case "streak":
      return longestRun(answers);
    case "lives":
      return answers.length;
  }
}

function longestRun(answers: readonly Answered[]): number {
  let longest = 0;
  let run = 0;
  for (const answer of answers) {
    run = answer.correct ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  return longest;
}

export function summarise(state: RoundState): RoundResult {
  return {
    mode: state.mode,
    route: state.route,
    score: scoreOf(state.mode, state.answers),
    total: state.answers.length,
    answers: state.answers,
    missed: state.answers.filter((answer) => !answer.correct),
    abandoned: state.abandoned,
  };
}
```

**Tests:**

`tests/engine/modes.test.ts`, new, complete:

```ts
import { describe, expect, it } from "vitest";
import type { Card, Route } from "@/src/content/schema";
import {
  LIVES,
  chunkSeed,
  currentCard,
  isDecided,
  livesLeft,
  reduce,
  scoreOf,
  startRound,
  summarise,
  type Mode,
  type RoundEvent,
  type RoundState,
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

function start(mode: Mode, size = 40, seed = 1): RoundState {
  return startRound({ mode, route, pool: pool(size), history: {}, seed });
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const inner of Object.values(value)) deepFreeze(inner);
  }
  return value;
}

function play(state: RoundState, events: readonly RoundEvent[]): RoundState {
  return events.reduce((s, event) => reduce(deepFreeze(s), event), state);
}

const NEXT: RoundEvent = { type: "next" };
const ABANDON: RoundEvent = { type: "abandon" };

// Answers the card on screen right or wrong (phase "answered" afterwards; no next).
function give(state: RoundState, right: boolean, at = 1000): RoundState {
  const truth = currentCard(state)?.answer ?? true;
  return play(state, [{ type: "answer", value: right ? truth : !truth, at }]);
}

// Answers `count` cards right, pressing next after each.
function rightTimes(state: RoundState, count: number): RoundState {
  let s = state;
  for (let i = 0; i < count; i++) s = play(give(s, true), [NEXT]);
  return s;
}

describe("chunkSeed", () => {
  it("is the seed itself for the first chunk and a different 32-bit number for each later one", () => {
    expect(chunkSeed(12345, 0)).toBe(12345);
    const seeds = [0, 1, 2, 3, 4].map((k) => chunkSeed(12345, k));
    expect(new Set(seeds).size).toBe(5);
    expect(seeds.every((s) => Number.isInteger(s) && s >= 0 && s <= 0xffffffff)).toBe(true);
    expect(chunkSeed(0xffffffff, 1)).toBe((0xffffffff + 0x9e3779b9) >>> 0);
  });
});

describe("Streak", () => {
  it("goes on after a right answer and deals a second chunk after card ten", () => {
    const state = rightTimes(start("streak"), 10);
    expect(state.phase).toBe("question");
    expect(state.index).toBe(10);
    expect(state.cards).toHaveLength(20);
    expect(new Set(state.cards.map((c) => c.id)).size).toBe(20);
    expect(state.source.chunks).toBe(2);
  });

  it("is decided by the first wrong answer; next then finishes it", () => {
    const wrong = give(rightTimes(start("streak"), 3), false);
    expect(wrong.phase).toBe("answered");
    expect(isDecided(wrong)).toBe(true);
    const done = play(wrong, [NEXT]);
    expect(done.phase).toBe("finished");
    expect(done.abandoned).toBe(false);
    expect(done.index).toBe(3);
    expect(summarise(done)).toMatchObject({ mode: "streak", score: 3, total: 4, abandoned: false });
    expect(summarise(done).missed.map((a) => a.card.id)).toEqual([wrong.cards[3]?.id]);
  });

  it("is not decided by a right answer", () => {
    expect(isDecided(give(start("streak"), true))).toBe(false);
  });

  it("scores zero when the first answer is wrong", () => {
    expect(summarise(play(give(start("streak"), false), [NEXT])).score).toBe(0);
  });

  it("ignores a second answer to the ending card", () => {
    const wrong = deepFreeze(give(start("streak"), false));
    expect(reduce(wrong, { type: "answer", value: true, at: 2000 })).toBe(wrong);
  });

  it("deals the same round for the same seed and events, across chunks", () => {
    const a = rightTimes(start("streak", 40, 77), 25);
    const b = rightTimes(start("streak", 40, 77), 25);
    expect(b.cards.map((c) => c.id)).toEqual(a.cards.map((c) => c.id));
    expect(rightTimes(start("streak", 40, 78), 25).cards.map((c) => c.id)).not.toEqual(a.cards.map((c) => c.id));
  });

  it("never runs out of cards on an 11 card route", () => {
    const state = rightTimes(start("streak", 11), 30);
    expect(state.phase).toBe("question");
    expect(state.answers).toHaveLength(30);
    expect(new Set(state.cards.slice(0, 11).map((c) => c.id)).size).toBe(11);
    expect(currentCard(state)).toBeDefined();
  });
});

describe("Three lives", () => {
  it("has three lives", () => {
    expect(LIVES).toBe(3);
    expect(livesLeft(start("lives"))).toBe(3);
  });

  it("goes on after the first and the second wrong answer", () => {
    let state = start("lives");
    state = play(give(state, false), [NEXT]);
    expect([state.phase, livesLeft(state)]).toEqual(["question", 2]);
    state = play(give(state, false), [NEXT]);
    expect([state.phase, livesLeft(state)]).toEqual(["question", 1]);
  });

  it("is decided by the third wrong answer, wherever it falls; the score is the cards answered", () => {
    let state = start("lives");
    for (const right of [true, false, true, true, false, true]) state = play(give(state, right), [NEXT]);
    const last = give(state, false);
    expect(isDecided(last)).toBe(true);
    expect(livesLeft(last)).toBe(0);
    const done = play(last, [NEXT]);
    expect(done.phase).toBe("finished");
    expect(summarise(done)).toMatchObject({ mode: "lives", score: 7, total: 7, abandoned: false });
    expect(summarise(done).missed).toHaveLength(3);
  });

  it("is not decided by a right answer on the last life", () => {
    let state = start("lives");
    for (const right of [false, false]) state = play(give(state, right), [NEXT]);
    expect(isDecided(give(state, true))).toBe(false);
  });

  it("plays past the first chunk", () => {
    const state = rightTimes(start("lives", 12), 12);
    expect(state.index).toBe(12);
    expect(state.cards.length).toBeGreaterThan(12);
  });
});

describe("Classic keeps its rule", () => {
  it("is decided by the answer to its last card and finishes on next", () => {
    const state = rightTimes(start("classic"), 9);
    expect(isDecided(state)).toBe(false);
    const last = give(state, true);
    expect(isDecided(last)).toBe(true);
    expect(play(last, [NEXT]).phase).toBe("finished");
    expect(last.cards).toHaveLength(10);
  });

  it("is decided by the last card of a short route", () => {
    expect(isDecided(give(start("classic", 1), false))).toBe(true);
  });
});

describe("leaving a round", () => {
  it.each(["classic", "streak", "lives"] as const)("%s: a round that is left is abandoned and keeps its answers", (mode) => {
    const left = play(give(start(mode), true), [ABANDON]);
    expect([left.phase, left.abandoned]).toEqual(["finished", true]);
    expect(summarise(left)).toMatchObject({ abandoned: true, total: 1 });
  });

  it("a decided round that is left is abandoned too: only next finishes it with its score", () => {
    const streak = give(rightTimes(start("streak"), 5), false);
    const classic = give(rightTimes(start("classic"), 9), true);
    let lives = start("lives");
    for (const right of [false, false]) lives = play(give(lives, right), [NEXT]);
    lives = give(lives, false);
    for (const decided of [streak, classic, lives]) {
      expect(isDecided(decided)).toBe(true);
      expect(play(decided, [ABANDON])).toMatchObject({ phase: "finished", abandoned: true });
      expect(play(decided, [NEXT])).toMatchObject({ phase: "finished", abandoned: false });
    }
  });

  it("returns a finished round as it is", () => {
    const done = deepFreeze(play(give(start("streak"), false), [NEXT]));
    expect(reduce(done, ABANDON)).toBe(done);
  });
});

describe("scoreOf", () => {
  const answers = [true, true, false, true].map((correct, i) => ({ card: card(`s${i}`, true), given: correct, correct, at: i }));
  it("is the number each mode's record keeps", () => {
    expect(scoreOf("classic", answers)).toBe(3);
    expect(scoreOf("timed", answers)).toBe(3);
    expect(scoreOf("streak", answers)).toBe(2);
    expect(scoreOf("lives", answers)).toBe(4);
  });
});

```

`tests/engine/round.test.ts`, changes to existing cases:
- "offers only Classic in step 1, with ten cards" becomes "plays Classic, Streak and Three lives; a Classic round has ten cards": `expect(AVAILABLE_MODES).toEqual(["classic", "streak", "lives"]); expect(CLASSIC_LENGTH).toBe(10);`.
- `it.each(["streak", "lives", "timed"])("rejects the %s mode, ...")` becomes one case: "rejects the timed mode, which is not available yet".
- Add to `describe("startRound")`: "deals a Classic round exactly as the ten-card deal of the same seed": for seeds 1 to 20, `start({ seed }).cards.map(id)` equals `deal(pool(40), {}, createRng(seed), { count: 10 }).map(id)`; and "keeps what it deals from": `start().source` equals `{ pool, history: {}, seed: 1, chunks: 1 }` (the same pool array it was given).
- Every other case in the file stays as it is and must pass.

`tests/app-state/pending.test.ts` (lines 95 to 100): the case "reads null for a mode that exists but is not available yet" stores `mode: "timed"` instead of `"streak"`. Add: "reads a Streak or Three lives round now that the engine can play them" (`readPending` returns the stored round for both).

`tests/progress/progress.test.ts`, new `describe("applyResult: records of the other modes")`. Give the file's `result` helper an optional `mode` and `score` (`options.mode ?? "classic"`, `options.score ?? correct answers`):
- "keeps one record per mode on the same route": apply a Classic 7, a Streak 12, a Three lives 21 and a Timed 14 result on SEC; `records` equals `{ "aws-clf-c02/SEC#classic": 7, "aws-clf-c02/SEC#streak": 12, "aws-clf-c02/SEC#lives": 21, "aws-clf-c02/SEC#timed": 14 }`.
- "equalling a Streak record is not a new best": stored 12, score 12: `isNewBest` false, `previousBest` 12, record still 12.
- "a longer streak replaces the record": stored 12, score 13: `isNewBest` true, record 13.
- "a first Timed round with no correct answer sets the record 0": no record, score 0, total 3: `isNewBest` true, `previousBest` null, record 0.
- "a round that was left sets no record in any mode": `abandoned: true` for streak, lives, timed (`it.each`): records unchanged, `last.score` null.
- "remembers the last round with the mode's own score": a Three lives result of 21 answers gives `last` `{ route: SEC, mode: "lives", score: 21, total: 21 }`.
- "records what the engine summarises": a Streak round played with `startRound` and `reduce` (three right answers, one wrong, `next`) through `summarise` and `applyResult` stores the record 3 and four card history entries.
- "a card answered twice in one round counts two sightings and keeps the later verdict": an unbounded round can show a card again once its route is used up. A Three lives result whose answers are card A wrong at 100, card B right at 200 and card A right at 300 gives `cards[A]` `{ seen: 2, lastCorrect: true, lastSeenAt: 300 }` and `cards[B]` `{ seen: 1, lastCorrect: true, lastSeenAt: 200 }`; with a stored entry `{ seen: 4, lastCorrect: true, lastSeenAt: 50 }` for A the result is `seen: 6`. And the other way round (A right, then A wrong) leaves `lastCorrect: false`, so the card is dealt as missed next time.
- "a decided round that was left sets no record": the `summarise` of a Streak round abandoned after its wrong answer (five right, one wrong, `abandon`) has `abandoned: true`; `applyResult` keeps `records` unchanged, adds six card history entries and sets `last.score` null.

**Steps:**

- [ ] **Step 1: Write `tests/engine/modes.test.ts`** and change `tests/engine/round.test.ts` and `tests/app-state/pending.test.ts` as described.
- [ ] **Step 2: Run them and watch them fail.** `pnpm vitest run tests/engine tests/app-state/pending.test.ts`. Expected: `modes.test.ts` fails as a whole (`chunkSeed`, `isDecided`, `livesLeft`, `scoreOf`, `LIVES` are not exported: "is not a function" / `undefined`); in `round.test.ts` the constants case fails with `expected [ 'classic' ] to deeply equal [ 'classic', 'streak', 'lives' ]` and "keeps what it deals from" with `expected undefined to deeply equal ...`; in `pending.test.ts` the new case fails with `expected null to deeply equal ...`.
- [ ] **Step 3: Replace `src/engine/round.ts`** with the code above.
- [ ] **Step 4: Run them green.** `pnpm vitest run tests/engine tests/app-state tests/purity.test.ts`. Expected: all pass (`modes.test.ts`: 21 tests).
- [ ] **Step 5: Write the progress tests** and run `pnpm vitest run tests/progress`. They pass at once: `applyResult` already keys records by mode and takes the score from the result. Prove the first one bites by changing `#streak` to `#classic` in its expectation (it fails), then put it back.
- [ ] **Step 6: Run the gates.** `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm e2e` (port 3100 free). All green. The play screen compiles unchanged: it reads `round.cards`, `round.index`, `round.answers`, `round.phase` and `round.abandoned` only.
- [ ] **Step 7: Commit.**

```bash
git add src/engine/round.ts tests/engine/modes.test.ts tests/engine/round.test.ts tests/app-state/pending.test.ts tests/progress/progress.test.ts
git commit -m "feat: Streak and Three lives in the engine, on rounds that deal chunk by chunk"
```
