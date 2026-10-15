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
