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
