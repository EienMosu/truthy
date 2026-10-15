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
