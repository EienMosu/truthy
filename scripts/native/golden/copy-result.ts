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
