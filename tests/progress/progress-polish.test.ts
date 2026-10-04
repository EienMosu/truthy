import { describe, expect, it } from "vitest";
import type { Card, Route } from "@/src/content/schema";
import type { Answered, RoundResult } from "@/src/engine/round";
import { applyResult, emptyProgress, parseProgress, pruneDeck, type Progress } from "@/src/progress/progress";

const SEC: Route = { deckId: "aws-clf-c02", sectionId: "SEC" };

function card(id: string): Card {
  return {
    id,
    section: "SEC",
    text: { en: { statement: `Statement ${id}`, explanation: `Explanation ${id}` } },
    answer: true,
    source: { title: "AWS docs", url: "https://docs.aws.amazon.com/" },
    difficulty: 1,
    appliesTo: "",
    conflictGroups: [],
  };
}

function answered(id: string, correct: boolean, at: number): Answered {
  return { card: card(id), given: correct, correct, at };
}

function result(answers: Answered[], options: { abandoned?: boolean; score?: number } = {}): RoundResult {
  return {
    mode: "classic",
    route: SEC,
    score: options.score ?? answers.filter((a) => a.correct).length,
    total: answers.length,
    answers,
    missed: answers.filter((a) => !a.correct),
    abandoned: options.abandoned ?? false,
  };
}

const seenOnce = () => ({ seen: 1, lastCorrect: true, lastSeenAt: 1 });

// Spec section 7: a card's history belongs to the deck whose id, followed by "-", starts the card id.
describe("pruneDeck: which cards belong to the deck", () => {
  it("keeps a card of another deck whose id only starts with the same letters", () => {
    const before: Progress = {
      ...emptyProgress(),
      cards: { "aws-clf-c02-t1.1-01": seenOnce(), "aws-clf-c02x-1": seenOnce(), "nextjs-renderingx-1": seenOnce() },
    };
    expect(Object.keys(pruneDeck(before, "aws-clf-c02", []).cards).sort()).toEqual(["aws-clf-c02x-1", "nextjs-renderingx-1"]);
    expect(Object.keys(pruneDeck(before, "nextjs-rendering", []).cards).sort()).toEqual(Object.keys(before.cards).sort());
  });
});

// The module's header: every function returns new objects and never changes its inputs.
describe("progress: new objects, never the ones given", () => {
  const before: Progress = {
    version: 1,
    cards: { "aws-clf-c02-t1.1-01": seenOnce() },
    records: { "aws-clf-c02/SEC#classic": 7 },
    last: { route: SEC, mode: "classic", score: 7, total: 10 },
  };

  it("pruneDeck returns records of its own", () => {
    const after = pruneDeck(before, "aws-clf-c02", []);
    expect(after.records).not.toBe(before.records);
    after.records["aws-clf-c02/SEC#classic"] = 0;
    expect(before.records["aws-clf-c02/SEC#classic"]).toBe(7);
  });

  it("applyResult returns records of its own when the round sets no new best", () => {
    for (const round of [result([answered("c1", true, 5)]), result([answered("c1", true, 5)], { abandoned: true, score: 10 })]) {
      const { progress, isNewBest } = applyResult(before, round);
      expect(isNewBest).toBe(false);
      expect(progress.records).not.toBe(before.records);
      progress.records["aws-clf-c02/SEC#classic"] = 0;
      expect(before.records["aws-clf-c02/SEC#classic"]).toBe(7);
    }
  });
});

describe("applyResult: the seen count has no ceiling", () => {
  it("counts a card seen 150 times as seen 151 times after one more answer", () => {
    const before: Progress = { ...emptyProgress(), cards: { c1: { seen: 150, lastCorrect: true, lastSeenAt: 1 } } };
    expect(applyResult(before, result([answered("c1", false, 9)])).progress.cards["c1"]).toEqual({
      seen: 151,
      lastCorrect: false,
      lastSeenAt: 9,
    });
  });
});

// The stored shape: a value no code of the app writes makes the whole stored progress invalid (spec section 7).
describe("parseProgress: the refinements of the stored shape", () => {
  const stored: Progress = {
    version: 1,
    cards: { "aws-clf-c02-t1.1-01": { seen: 3, lastCorrect: false, lastSeenAt: 1_790_000_000_000 } },
    records: { "aws-clf-c02/SEC#classic": 8 },
    last: { route: SEC, mode: "classic", score: 8, total: 10 },
  };

  it("reads the stored value back, so each case below fails for its one change", () => {
    expect(parseProgress(JSON.stringify(stored))).toEqual(stored);
  });

  it("gives empty progress for a negative lastSeenAt", () => {
    const cards = { "aws-clf-c02-t1.1-01": { seen: 3, lastCorrect: false, lastSeenAt: -1 } };
    expect(parseProgress(JSON.stringify({ ...stored, cards }))).toEqual(emptyProgress());
  });

  it("gives empty progress for a record that is not a whole number", () => {
    expect(parseProgress(JSON.stringify({ ...stored, records: { "aws-clf-c02/SEC#classic": 3.5 } }))).toEqual(emptyProgress());
  });

  it("gives empty progress for a last route with an empty section id", () => {
    const last = { route: { deckId: "aws-clf-c02", sectionId: "" }, mode: "classic", score: 8, total: 10 };
    expect(parseProgress(JSON.stringify({ ...stored, last }))).toEqual(emptyProgress());
  });
});
