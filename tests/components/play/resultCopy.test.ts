import { describe, expect, it } from "vitest";
import { resultCopy } from "@/components/play/resultCopy";
import type { Answered, Mode, RoundResult } from "@/src/content/play";
import { scoreOf } from "@/src/engine/round";
import { DECK, DECK_ID } from "./fixtures";

const ROUTE = { deckId: DECK_ID, sectionId: "SEC" };

/** A finished round of the mode: answer i is right when right[i] is true. */
function resultOf(mode: Mode, right: readonly boolean[]): RoundResult {
  const answers: Answered[] = right.map((correct, i) => {
    const card = DECK.cards[i % 12];
    if (!card) throw new Error("the fixture deck has no card");
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

/** n answers, wrong on the given 1-based numbers. */
function wrongOn(n: number, ...numbers: number[]): boolean[] {
  return Array.from({ length: n }, (_, i) => !numbers.includes(i + 1));
}

/** The copy without its function, which the caller tests with sample calls. */
function plain(copy: ReturnType<typeof resultCopy>) {
  const { best, ...rest } = copy;
  void best;
  return rest;
}

describe("resultCopy", () => {
  it("Classic: 7 of 10", () => {
    const copy = resultCopy(resultOf("classic", wrongOn(10, 3, 6, 9)), "Classic", 10, null);
    expect(plain(copy)).toStrictEqual({
      fields: [
        { label: "Class", value: "Classic" },
        { label: "Cards", value: "10 / 10" },
        { label: "Missed", value: "03" },
      ],
      scoreLabel: "Your score",
      unit: "of 10",
      ended: "Arrived",
      endedDetail: " · 10 of 10",
      label: "Round complete. 10 of 10 cards. 7 correct, 3 wrong: cards 3, 6 and 9.",
      marks: 10,
      ring: undefined,
    });
    expect(copy.best(9)).toBe("9 / 10");
  });

  it("Classic: a route with fewer cards than ten counts by its own length", () => {
    const copy = resultCopy(resultOf("classic", [false]), "Classic", 1, 1);
    expect(copy.fields[1]).toStrictEqual({ label: "Cards", value: "01 / 01" });
    expect(copy.unit).toBe("of 1");
    expect(copy.label).toBe("Round complete. 1 of 1 cards. 0 correct, 1 wrong: card 1.");
    expect(copy.marks).toBe(1);
  });

  it("Streak: 13 right, then wrong", () => {
    const copy = resultCopy(resultOf("streak", [...wrongOn(13), false]), "Streak", 16, 12);
    expect(plain(copy)).toStrictEqual({
      fields: [
        { label: "Class", value: "Streak" },
        { label: "Cards", value: "14" },
        { label: "Missed", value: "01" },
      ],
      scoreLabel: "Correct in a row",
      unit: undefined,
      ended: "Ended",
      endedDetail: " · 14 cards",
      label: "Streak over on card 14. 13 correct in a row. Card 14 was wrong.",
      marks: 14,
      ring: 11,
    });
    expect(copy.best(12)).toBe("12");
  });

  it("Streak: the ring needs a previous best that this round reached", () => {
    const result = resultOf("streak", [...wrongOn(13), false]);
    const ringFor = (previousBest: number | null) => resultCopy(result, "Streak", 16, previousBest).ring;
    expect(ringFor(null)).toBeUndefined();
    expect(ringFor(0)).toBeUndefined();
    expect(ringFor(20)).toBeUndefined();
    expect(ringFor(13)).toBe(12);
    expect(ringFor(1)).toBe(0);
  });

  it("Streak: wrong on the first card", () => {
    const copy = resultCopy(resultOf("streak", [false]), "Streak", 10, null);
    expect(copy.endedDetail).toBe(" · 1 card");
    expect(copy.label).toBe("Streak over on card 1. 0 correct in a row. Card 1 was wrong.");
    expect(copy.fields.map((field) => field.value)).toStrictEqual(["Streak", "01", "01"]);
    expect(copy.marks).toBe(1);
  });

  it("Three lives: 21 cards, wrong on 6, 15 and 21", () => {
    const copy = resultCopy(resultOf("lives", wrongOn(21, 6, 15, 21)), "Three lives", 30, 21);
    expect(plain(copy)).toStrictEqual({
      fields: [
        { label: "Class", value: "Three lives" },
        { label: "Correct", value: "18" },
        { label: "Missed", value: "03" },
      ],
      scoreLabel: "Your score",
      unit: "cards",
      ended: "Out of lives",
      endedDetail: "",
      label: "Out of lives after 21 cards. 18 correct, 3 wrong: cards 6, 15 and 21.",
      marks: 21,
      ring: undefined,
    });
    expect(copy.best(21)).toBe("21 cards");
  });

  it("Timed: 17 answered, wrong on 4, 9 and 15", () => {
    const copy = resultCopy(resultOf("timed", wrongOn(17, 4, 9, 15)), "Timed", 20, 11);
    expect(plain(copy)).toStrictEqual({
      fields: [
        { label: "Class", value: "Timed" },
        { label: "Time", value: "60 s" },
        { label: "Answered", value: "17" },
      ],
      scoreLabel: "Correct",
      unit: "of 17",
      ended: "Time up",
      endedDetail: " · 17 cards",
      label: "Time is up. 17 cards answered in 60 seconds. 14 correct, 3 wrong: cards 4, 9 and 15.",
      marks: 17,
      ring: undefined,
    });
    expect(copy.best(11)).toBe("11");
  });

  it("Timed: nothing answered", () => {
    const copy = resultCopy(resultOf("timed", []), "Timed", 10, null);
    expect(copy.fields.map((field) => field.value)).toStrictEqual(["Timed", "60 s", "00"]);
    expect(copy.unit).toBe("of 0");
    expect(copy.endedDetail).toBe(" · 0 cards");
    expect(copy.label).toBe("Time is up. 0 cards answered in 60 seconds. 0 correct, 0 wrong.");
    expect(copy.marks).toBe(0);
  });

  it("Timed: one right answer", () => {
    const copy = resultCopy(resultOf("timed", [true]), "Timed", 10, null);
    expect(copy.endedDetail).toBe(" · 1 card");
    expect(copy.label).toBe("Time is up. 1 card answered in 60 seconds. 1 correct, 0 wrong.");
    expect(copy.unit).toBe("of 1");
  });
});
