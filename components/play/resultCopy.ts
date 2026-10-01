// What the result screen says in each mode: the three fields of the pass, the label and unit of the score,
// how a record reads, the header's label row and its accessible name, and the marks on the completed route
// (design system 5.10 "Completed", 5.14; mockups result-streak, result-lives, result-timed). The comparison
// with the record is the score block's business; this is only the part that follows the mode.
import { cardList, completedLabel } from "@/components/FlightPath";
import { pad2 } from "@/components/format";
import type { RoundResult } from "@/src/content/play";
import { TIMED } from "@/src/engine/round";

export interface ResultCopy {
  fields: readonly [{ label: string; value: string }, { label: string; value: string }, { label: string; value: string }];
  scoreLabel: string;
  unit: string | undefined;
  /** How a record reads in the comparison: "9 / 10", "21 cards", "12". */
  best: (record: number) => string;
  /** The bold word of the header's label row: "Arrived", "Ended", "Out of lives", "Time up". */
  ended: string;
  /** What follows it: " · 10 of 10", " · 14 cards", "". */
  endedDetail: string;
  /** The header's accessible name. */
  label: string;
  /** Marks on the completed route. */
  marks: number;
  /** Streak: the card (from 0) where the previous best was reached. */
  ring: number | undefined;
}

function cards(count: number): string {
  return count === 1 ? "1 card" : `${count} cards`;
}

// "18 correct, 3 wrong: cards 6, 15 and 21." and, when nothing is wrong, "18 correct, 0 wrong."
function tally(correct: number, wrong: readonly number[]): string {
  const head = `${correct} correct, ${wrong.length} wrong`;
  return wrong.length === 0 ? `${head}.` : `${head}: ${cardList(wrong)}.`;
}

/**
 * The copy of a finished round. `dealt` is the cards the round dealt (Classic counts "of 10" by it),
 * `previousBest` the record before the round (null: none), `modeName` the class name on the ticket.
 */
export function resultCopy(result: RoundResult, modeName: string, dealt: number, previousBest: number | null): ResultCopy {
  const n = result.total;
  const w = result.missed.length;
  const c = n - w;
  const wrong: number[] = [];
  result.answers.forEach((answer, i) => {
    if (!answer.correct) wrong.push(i + 1);
  });
  const klass = { label: "Class", value: modeName };
  const missed = { label: "Missed", value: pad2(w) };

  switch (result.mode) {
    case "classic":
      return {
        fields: [klass, { label: "Cards", value: `${pad2(n)} / ${pad2(dealt)}` }, missed],
        scoreLabel: "Your score",
        unit: `of ${dealt}`,
        best: (record) => `${record} / ${dealt}`,
        ended: "Arrived",
        endedDetail: ` · ${n} of ${dealt}`,
        label: completedLabel(
          dealt,
          result.answers.map((answer) => answer.correct),
        ),
        marks: dealt,
        ring: undefined,
      };
    case "streak":
      return {
        fields: [klass, { label: "Cards", value: pad2(n) }, missed],
        scoreLabel: "Correct in a row",
        unit: undefined,
        best: (record) => `${record}`,
        ended: "Ended",
        endedDetail: ` · ${cards(n)}`,
        label: `Streak over on card ${n}. ${result.score} correct in a row. Card ${n} was wrong.`,
        marks: n,
        ring: previousBest !== null && previousBest >= 1 && previousBest <= result.score ? previousBest - 1 : undefined,
      };
    case "lives":
      return {
        fields: [klass, { label: "Correct", value: pad2(c) }, missed],
        scoreLabel: "Your score",
        unit: "cards",
        best: (record) => `${record} cards`,
        ended: "Out of lives",
        endedDetail: "",
        label: `Out of lives after ${n} cards. ${tally(c, wrong)}`,
        marks: n,
        ring: undefined,
      };
    case "timed":
      return {
        fields: [klass, { label: "Time", value: `${TIMED.roundMs / 1000} s` }, { label: "Answered", value: pad2(n) }],
        scoreLabel: "Correct",
        unit: `of ${n}`,
        best: (record) => `${record}`,
        ended: "Time up",
        endedDetail: ` · ${cards(n)}`,
        label: `Time is up. ${cards(n)} answered in ${TIMED.roundMs / 1000} seconds. ${tally(c, wrong)}`,
        marks: n,
        ring: undefined,
      };
  }
}
