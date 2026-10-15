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
