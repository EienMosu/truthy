### Task 6: Timed in the engine

Timed is the one mode with a clock (spec section 6): "60 seconds", "the clock starts when the first card is shown, pauses while the page is hidden and stops at zero. The card on screen at zero is neither counted nor recorded", and after an answer "stamp only, next card at once" through the phase `stamped` ("about 700 ms, then the next question"). The engine stays pure: it never reads a clock. Time arrives on three events, `answer` (`at`), `tick` (`now`) and `visibility` (`at`), and the reducer does the arithmetic. The same seed and the same events give the same round, which is what the tests replay. After this task the engine plays all four modes, so its `AVAILABLE_MODES` list goes; the class step still offers only Classic.

**Files:**
- Modify: `src/engine/round.ts`, `src/app-state/pending.ts` (its import of `AVAILABLE_MODES` and `Mode` from the engine, and the `mode: z.custom<Mode>(...)` line of its schema with the comment above it; task 3 has moved the line numbers)
- Test: create `tests/engine/timed.test.ts`; modify `tests/engine/round.test.ts`, `tests/engine/modes.test.ts`, `tests/app-state/pending.test.ts`

**Interfaces:**
- Consumes (task 5, `src/engine/round.ts`): `RoundState` with `source`, `startRound`, `reduce`, `advance` (private: to the next card as a question, dealing a chunk when needed), `isDecided`, `summarise`, `scoreOf`; `MODES` from `@/src/content/play`.
- Produces:

```ts
export const TIMED = { roundMs: 60_000, holdMs: 700, maxStepMs: 1_000 } as const;
export type Phase = "question" | "answered" | "stamped" | "finished";
export interface Clock { remainingMs: number; lastTick: number | null; hidden: boolean; holdMs: number }
export interface RoundState { /* as task 5 */ clock: Clock | null }   // null except in Timed
export type RoundEvent =
  | { type: "answer"; value: boolean; at: number }
  | { type: "next" }
  | { type: "tick"; now: number }
  | { type: "visibility"; hidden: boolean; at: number }
  | { type: "abandon" };
```

  - Removed: `AVAILABLE_MODES` (engine). `startRound` throws `The mode "<mode>" is not available.` only for a mode that is not in `MODES`. `src/app-state/pending.ts` validates the mode with `z.enum(MODES)`.
  - How later tasks read the state: Timed time up is `isDecided(state)` (phase `stamped`, `clock.remainingMs === 0`); the stamp beat is phase `stamped` with `!isDecided(state)`; the seconds to show are `Math.ceil(clock.remainingMs / 1000)`.

**Rules** (all times in ms on the clock the component passes in):

1. **The clock** exists only in Timed (`clock: null` elsewhere; the other modes return the same state for `tick` and `visibility`). It starts as `{ remainingMs: 60000, lastTick: null, hidden: false, holdMs: 0 }`.
2. **Counting.** `tick(now)` counts the time since `lastTick` off `remainingMs` and sets `lastTick = now`. The time counted is `min(max(0, now - lastTick), 1000)`: 0 for the first tick (it only starts the clock, "when the first card is shown"), never negative when the clock source jumps back, and at most one second per tick, so a wake-up after a sleep that sent no visibility event costs a second, not the round. `remainingMs` never goes below 0.
3. **Hidden.** `visibility(hidden: true, at)` counts the time up to `at` like a tick, then pauses: `hidden: true`, `lastTick: null`. While hidden, `tick` returns the same state. `visibility(hidden: false, at)` resumes: `hidden: false`, `lastTick: at`, nothing counted. A repeated event (hidden while hidden, visible while visible) returns the same state.
4. **An answer** in Timed first counts the clock up to `at`. If that leaves time, the answer is recorded, the phase becomes `stamped` and `holdMs` becomes 700. There is no `answered` phase and no `next` in Timed play; `answer` and `next` are ignored while stamped.
5. **The stamp** runs on the same counting: each tick takes the time it counts off `holdMs` as well, so the hold pauses while hidden. When `holdMs` reaches 0 the round moves to the next card as a `question` (dealing the next chunk when the dealt cards have run out), `holdMs: 0`. The clock keeps running during the stamp.
6. **Time up.** When counting brings `remainingMs` to 0 (by a tick, by hiding, or by an answer's `at`): the phase becomes `stamped` with `holdMs: 0`, and `isDecided` is true. The card on screen is not answered and never reaches `answers`, so it is neither counted nor recorded.
   - On a question: the same card stays on screen.
   - During a stamp: the stamped answer was given in time and counts; the round moves to the next card first, which then is the card that does not count.
   - By an answer whose `at` is at or after zero: the answer is not recorded.
7. **After time up** every `tick`, `visibility` and `answer` returns the very same state. `next` finishes the round (`finished`, not abandoned). `abandon` abandons it like any other round: a round that is left sets no record, at time up too (spec sections 2 and 6).
8. **After the round is finished or left** every event returns the same state (the first line of `reduce`).
9. Score: the correct answers (`scoreOf`, task 5). `total`: the cards answered.

**Code.** In `src/engine/round.ts`: delete `AVAILABLE_MODES`; import `MODES` (`import { MODES, type Answered, type History, type Mode, type RoundResult } from "@/src/content/play";`); add `clock: Clock | null; // Timed only` as the last field of `RoundState`; in `isDecided` the Timed case becomes `return state.clock !== null && state.clock.remainingMs === 0;`. Replace the constants, the event type, `startRound`, `reduce` and `recordAnswer` with the following and add the rest:

```ts
export const CLASSIC_LENGTH = CHUNK; // a Classic round is the first chunk
export const LIVES = 3;
// Timed: the length of the round, how long the stamp stays before the next card, and the most time one
// tick may count (a longer gap is a sleep the page did not report).
export const TIMED = { roundMs: 60_000, holdMs: 700, maxStepMs: 1_000 } as const;

export type Phase = "question" | "answered" | "stamped" | "finished";

// The Timed clock. It only moves on events: lastTick is the moment up to which time has been counted
// (null before the first tick and while hidden); holdMs is what is left of the stamp.
export interface Clock {
  remainingMs: number;
  lastTick: number | null;
  hidden: boolean;
  holdMs: number;
}

export type RoundEvent =
  | { type: "answer"; value: boolean; at: number }
  | { type: "next" }
  | { type: "tick"; now: number }
  | { type: "visibility"; hidden: boolean; at: number }
  | { type: "abandon" };

// Throws for a mode it does not know or an empty pool.
export function startRound(args: StartArgs): RoundState {
  if (!(MODES as readonly string[]).includes(args.mode)) {
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
    clock: args.mode === "timed" ? { remainingMs: TIMED.roundMs, lastTick: null, hidden: false, holdMs: 0 } : null,
  });
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
    case "tick":
      return state.clock === null ? state : onTick(state, state.clock, event.now);
    case "visibility":
      return state.clock === null ? state : onVisibility(state, state.clock, event.hidden, event.at);
    case "abandon":
      return { ...state, phase: "finished", abandoned: true };
    default:
      return state;
  }
}

function recordAnswer(state: RoundState, given: boolean, at: number): RoundState {
  const card = state.cards[state.index];
  if (card === undefined) return state;
  const answers = [...state.answers, { card, given, correct: given === card.answer, at }];
  if (state.clock === null) return { ...state, answers, phase: "answered" };
  // Timed: the clock runs up to the answer first. An answer at or after zero does not count.
  const clock = countTo(state.clock, at);
  if (clock.remainingMs === 0) return { ...state, clock, phase: "stamped" };
  return { ...state, answers, phase: "stamped", clock: { ...clock, holdMs: TIMED.holdMs } };
}

// The time to count between the last counted moment and `now`: none while hidden or before the first
// tick, never negative (a clock source may jump back), at most maxStepMs.
function elapsed(clock: Clock, now: number): number {
  if (clock.hidden || clock.lastTick === null) return 0;
  return Math.min(Math.max(0, now - clock.lastTick), TIMED.maxStepMs);
}

function countTo(clock: Clock, now: number): Clock {
  if (clock.hidden) return clock;
  return { ...clock, remainingMs: Math.max(0, clock.remainingMs - elapsed(clock, now)), lastTick: now };
}

function onTick(state: RoundState, clock: Clock, now: number): RoundState {
  if (clock.remainingMs === 0 || clock.hidden) return state;
  const passed = elapsed(clock, now);
  const counted = countTo(clock, now);
  if (counted.remainingMs === 0) {
    // Time is up. A card that was being stamped has been answered in time: it leaves, and the card that
    // does not count is the next one.
    const stopped = { ...counted, holdMs: 0 };
    const onCard = state.phase === "stamped" ? advance({ ...state, clock: stopped }) : { ...state, clock: stopped };
    return { ...onCard, phase: "stamped" };
  }
  if (state.phase !== "stamped") return { ...state, clock: counted };
  const holdMs = Math.max(0, clock.holdMs - passed);
  if (holdMs > 0) return { ...state, clock: { ...counted, holdMs } };
  return advance({ ...state, clock: { ...counted, holdMs: 0 } });
}

function onVisibility(state: RoundState, clock: Clock, hidden: boolean, at: number): RoundState {
  if (clock.remainingMs === 0 || clock.hidden === hidden) return state;
  if (!hidden) return { ...state, clock: { ...clock, hidden: false, lastTick: at } };
  // Hiding counts the time up to this moment, as a tick does, then pauses.
  const counted = onTick(state, clock, at);
  if (counted.clock === null || counted.clock.remainingMs === 0) return counted;
  return { ...counted, clock: { ...counted.clock, hidden: true, lastTick: null } };
}
```

In `src/app-state/pending.ts`: import `MODES` and `type Mode` from `@/src/content/play` instead of the engine, and the schema's mode becomes `mode: z.enum(MODES)`; the comment above it becomes "Only a mode the game knows: anything else reads as no pending round."

**Tests:**

`tests/engine/timed.test.ts`, new, complete. `ticks(from, to)` is a tick every 100 ms; `T0` is the time of the first tick.

```ts
import { describe, expect, it } from "vitest";
import type { Card, Route } from "@/src/content/schema";
import { TIMED, currentCard, isDecided, reduce, startRound, summarise, type Mode, type RoundEvent, type RoundState } from "@/src/engine/round";

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

const T0 = 1_700_000_000_000;
const tick = (now: number): RoundEvent => ({ type: "tick", now });
const hide = (at: number): RoundEvent => ({ type: "visibility", hidden: true, at });
const show = (at: number): RoundEvent => ({ type: "visibility", hidden: false, at });

// Ticks every 100 ms from `from` (exclusive) to `to` (inclusive).
function ticks(from: number, to: number): RoundEvent[] {
  const events: RoundEvent[] = [];
  for (let now = from + 100; now <= to; now += 100) events.push(tick(now));
  return events;
}

function timed(size = 40): RoundState {
  return play(start("timed", size), [tick(T0)]);
}

describe("Timed: the clock", () => {
  it("has sixty seconds, a 700 ms stamp and counts at most one second per tick", () => {
    expect(TIMED).toEqual({ roundMs: 60_000, holdMs: 700, maxStepMs: 1_000 });
  });

  it("starts full and stopped; the first tick starts it without taking time", () => {
    expect(start("timed").clock).toEqual({ remainingMs: 60_000, lastTick: null, hidden: false, holdMs: 0 });
    expect(timed().clock).toEqual({ remainingMs: 60_000, lastTick: T0, hidden: false, holdMs: 0 });
  });

  it("the other modes have no clock and ignore ticks and visibility", () => {
    for (const mode of ["classic", "streak", "lives"] as const) {
      const state = deepFreeze(start(mode));
      expect(state.clock).toBeNull();
      expect(reduce(state, tick(T0))).toBe(state);
      expect(reduce(state, hide(T0))).toBe(state);
    }
  });

  it("counts down by the time between ticks", () => {
    const state = play(timed(), [tick(T0 + 100), tick(T0 + 350)]);
    expect(state.clock?.remainingMs).toBe(59_650);
    expect(state.phase).toBe("question");
  });

  it("never counts backwards when the clock source jumps back", () => {
    const state = play(timed(), [tick(T0 + 500), tick(T0 + 200)]);
    expect(state.clock?.remainingMs).toBe(59_500);
    expect(state.clock?.lastTick).toBe(T0 + 200);
  });

  it("counts a gap of more than a second between two ticks as one second (a sleep without a visibility event)", () => {
    const state = play(timed(), [tick(T0 + 45_000)]);
    expect(state.clock?.remainingMs).toBe(59_000);
  });

  it("pauses while the page is hidden and goes on from where it was", () => {
    const state = play(timed(), [tick(T0 + 1_000), hide(T0 + 1_400), tick(T0 + 5_000), tick(T0 + 9_000), show(T0 + 30_000), tick(T0 + 30_100)]);
    expect(state.clock).toEqual({ remainingMs: 58_500, lastTick: T0 + 30_100, hidden: false, holdMs: 0 });
  });

  it("returns the same state for a tick while hidden, and for a repeated visibility event", () => {
    const hidden = deepFreeze(play(timed(), [hide(T0 + 100)]));
    expect(hidden.clock).toMatchObject({ remainingMs: 59_900, hidden: true, lastTick: null });
    expect(reduce(hidden, tick(T0 + 5_000))).toBe(hidden);
    expect(reduce(hidden, hide(T0 + 6_000))).toBe(hidden);
    const shown = deepFreeze(timed());
    expect(reduce(shown, show(T0 + 50))).toBe(shown);
  });
});

describe("Timed: answers and the stamp", () => {
  it("an answer is stamped: recorded, no answered phase, 700 ms hold", () => {
    const state = give(timed(), true, T0 + 2_000);
    expect(state.phase).toBe("stamped");
    expect(state.answers).toHaveLength(1);
    expect(state.clock).toMatchObject({ remainingMs: 59_000, holdMs: 700, lastTick: T0 + 2_000 });
    expect(isDecided(state)).toBe(false);
  });

  it("counts the clock up to the moment of the answer", () => {
    const state = give(play(timed(), [tick(T0 + 900)]), false, T0 + 950);
    expect(state.clock?.remainingMs).toBe(59_050);
  });

  it("ignores answer and next while stamped", () => {
    const state = deepFreeze(give(timed(), true, T0 + 500));
    expect(reduce(state, { type: "answer", value: true, at: T0 + 600 })).toBe(state);
    expect(reduce(state, NEXT)).toBe(state);
  });

  it("shows the next card once 700 ms have been counted since the answer, not before", () => {
    const stamped = give(timed(), true, T0 + 500);
    const before = play(stamped, ticks(T0 + 500, T0 + 1_100));
    expect([before.phase, before.index, before.clock?.holdMs]).toEqual(["stamped", 0, 100]);
    const after = play(before, [tick(T0 + 1_200)]);
    expect([after.phase, after.index, after.clock?.holdMs]).toEqual(["question", 1, 0]);
    expect(after.clock?.remainingMs).toBe(58_800);
  });

  it("holds the stamp while the page is hidden", () => {
    const state = play(give(timed(), true, T0 + 500), [tick(T0 + 800), hide(T0 + 900), show(T0 + 20_000), tick(T0 + 20_200)]);
    expect([state.phase, state.clock?.holdMs]).toEqual(["stamped", 100]);
    expect(play(state, [tick(T0 + 20_300)]).phase).toBe("question");
  });

  it("deals the next chunk when the stamp ends on the last dealt card", () => {
    let state = timed();
    let now = T0;
    for (let i = 0; i < 10; i++) {
      now += 300;
      state = give(state, true, now);
      state = play(state, ticks(now, now + 700));
      now += 700;
    }
    expect([state.phase, state.index, state.cards.length]).toEqual(["question", 10, 20]);
  });
});

describe("Timed: time up", () => {
  // The clock one tick before zero, on the first card, nothing answered.
  function nearlyUp(): RoundState {
    return play(timed(), ticks(T0, T0 + 59_900));
  }

  it("stops at zero on the question: decided, stamped, the card on screen not answered", () => {
    const almost = nearlyUp();
    expect(almost.clock?.remainingMs).toBe(100);
    const up = play(almost, [tick(T0 + 60_000)]);
    expect(up.clock?.remainingMs).toBe(0);
    expect([up.phase, isDecided(up), up.index, up.answers.length]).toEqual(["stamped", true, 0, 0]);
  });

  it("returns the same state for every event but next and abandon once time is up", () => {
    const up = deepFreeze(play(nearlyUp(), [tick(T0 + 60_000)]));
    expect(reduce(up, tick(T0 + 60_100))).toBe(up);
    expect(reduce(up, tick(T0 + 99_000))).toBe(up);
    expect(reduce(up, hide(T0 + 60_200))).toBe(up);
    expect(reduce(up, show(T0 + 60_300))).toBe(up);
    expect(reduce(up, { type: "answer", value: true, at: T0 + 60_400 })).toBe(up);
  });

  it("next after time up finishes the round; the card on screen is neither counted nor recorded", () => {
    let state = timed();
    state = give(state, true, T0 + 1_000);
    state = play(state, ticks(T0 + 1_000, T0 + 1_700));
    state = give(state, false, T0 + 2_000);
    state = play(state, ticks(T0 + 2_000, T0 + 60_000));
    expect([state.phase, isDecided(state), state.index]).toEqual(["stamped", true, 2]);
    const done = play(state, [NEXT]);
    expect(done.phase).toBe("finished");
    const result = summarise(done);
    expect(result).toMatchObject({ mode: "timed", score: 1, total: 2, abandoned: false });
    expect(result.answers.map((a) => a.card.id)).toEqual([state.cards[0]?.id, state.cards[1]?.id]);
    expect(result.answers.some((a) => a.card.id === state.cards[2]?.id)).toBe(false);
  });

  it("an answer that arrives at or after zero does not count", () => {
    const late = play(nearlyUp(), [{ type: "answer", value: true, at: T0 + 60_050 }]);
    expect(late.answers).toEqual([]);
    expect([late.phase, isDecided(late), late.clock?.remainingMs]).toEqual(["stamped", true, 0]);
  });

  it("time running out during the stamp keeps that answer and moves on to a card that does not count", () => {
    const answered = give(nearlyUp(), true, T0 + 59_950);
    expect([answered.answers.length, answered.clock?.remainingMs]).toEqual([1, 50]);
    const up = play(answered, [tick(T0 + 60_000)]);
    expect([up.phase, isDecided(up), up.index, up.answers.length, up.clock?.holdMs]).toEqual(["stamped", true, 1, 1, 0]);
    expect(currentCard(up)).toBe(up.cards[1]);
  });

  it("hiding the page at the moment the time runs out is time up, not a pause", () => {
    const up = play(nearlyUp(), [hide(T0 + 60_000)]);
    expect([up.clock?.remainingMs, up.clock?.hidden, isDecided(up)]).toEqual([0, false, true]);
  });

  it("a round left after time is up is abandoned like any other; next finishes it", () => {
    const up = play(nearlyUp(), [tick(T0 + 60_000)]);
    expect(play(up, [ABANDON])).toMatchObject({ phase: "finished", abandoned: true });
    expect(play(up, [NEXT])).toMatchObject({ phase: "finished", abandoned: false });
  });

  it("ignores every tick after the round was left", () => {
    const left = deepFreeze(play(timed(), [ABANDON]));
    expect(reduce(left, tick(T0 + 100))).toBe(left);
    expect(reduce(left, hide(T0 + 200))).toBe(left);
  });

  it("is the same round for the same seed and events", () => {
    const events: RoundEvent[] = [tick(T0), { type: "answer", value: true, at: T0 + 400 }, ...ticks(T0 + 400, T0 + 1_100), hide(T0 + 1_150), show(T0 + 9_000), tick(T0 + 9_100)];
    expect(play(start("timed", 40, 5), events)).toEqual(play(start("timed", 40, 5), events));
  });
});
```

`tests/engine/round.test.ts`:
- Remove `AVAILABLE_MODES` from the import. The constants case becomes "a Classic round has ten cards" (`CLASSIC_LENGTH` only).
- Remove "rejects the timed mode, which is not available yet". Keep "rejects a mode it does not know" (`"sudden-death" as Mode`, `/not available/`).
- Add: "starts a round in every mode" (`it.each(MODES)`): `start({ mode })` has phase `question`, ten cards, and `clock` null except for `"timed"`.

`tests/engine/modes.test.ts`: in "leaving a round", the case list `["classic", "streak", "lives"]` of "a round that is left is abandoned and keeps its answers" becomes `["classic", "streak", "lives", "timed"]` (22 tests in the file).

`tests/app-state/pending.test.ts` (the block "modes this build cannot play"): the stored mode becomes `"sudden-death"` and the title "reads null for a mode the game does not know"; the positive case of task 5 is extended to Timed ("reads a round of every mode").

**Steps:**

- [ ] **Step 1: Write `tests/engine/timed.test.ts`** and make the changes to the three existing test files.
- [ ] **Step 2: Run them and watch them fail.** `pnpm vitest run tests/engine tests/app-state/pending.test.ts`. Expected: `timed.test.ts` fails on its first use of the engine (`TIMED` is `undefined`, and `startRound` throws `The mode "timed" is not available.`); "starts a round in every mode" fails for `timed` with the same error; the pending case for Timed fails with `expected null to deeply equal ...`.
- [ ] **Step 3: Change `src/engine/round.ts`** as above.
- [ ] **Step 4: Change `src/app-state/pending.ts`.**
- [ ] **Step 5: Run them green.** `pnpm vitest run tests/engine tests/app-state tests/purity.test.ts`. Expected: all pass (`timed.test.ts`: 23 tests). The purity test proves the clock arithmetic reads no clock.
- [ ] **Step 6: Check that nothing else used the removed constant.** `grep -rn "AVAILABLE_MODES" src components app tests e2e` prints nothing.
- [ ] **Step 7: Run the gates.** `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm e2e` (port 3100 free). All green.
- [ ] **Step 8: Commit.**

```bash
git add src/engine/round.ts src/app-state/pending.ts tests/engine tests/app-state/pending.test.ts
git commit -m "feat: Timed in the engine: a clock moved by tick and visibility events, the stamp and time up"
```
