import { describe, expect, it } from "vitest";
import type { Card, Route } from "@/src/content/schema";
import type { Answered, RoundResult } from "@/src/engine/round";
import { applyResult, emptyProgress, recordKey, type Progress } from "@/src/progress/progress";

describe("emptyProgress", () => {
  it("has version 1, no card history, no records and no last route", () => {
    expect(emptyProgress()).toEqual({ version: 1, cards: {}, records: {}, last: null });
  });

  it("returns a fresh object on every call", () => {
    const first = emptyProgress();
    first.cards["aws-clf-c02-t1.1-01"] = { seen: 1, lastCorrect: true, lastSeenAt: 1 };
    first.records["x"] = 3;
    expect(emptyProgress()).toEqual({ version: 1, cards: {}, records: {}, last: null });
  });
});

describe("recordKey", () => {
  it("joins the route key and the mode with a hash", () => {
    expect(recordKey({ deckId: "aws-clf-c02", sectionId: "SEC" }, "classic")).toBe("aws-clf-c02/SEC#classic");
  });

  it("uses the whole deck id for a whole deck route", () => {
    expect(recordKey({ deckId: "nextjs-rendering", sectionId: "ALL" }, "classic")).toBe("nextjs-rendering/ALL#classic");
  });

  it("gives different keys for different modes on the same route", () => {
    const route = { deckId: "aws-clf-c02", sectionId: "SEC" };
    expect(recordKey(route, "classic")).not.toBe(recordKey(route, "timed"));
  });
});

// Fixtures shared by the tests below.

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

function result(answers: Answered[], options: { route?: Route; abandoned?: boolean } = {}): RoundResult {
  return {
    mode: "classic",
    route: options.route ?? SEC,
    score: answers.filter((a) => a.correct).length,
    total: answers.length,
    answers,
    missed: answers.filter((a) => !a.correct),
    abandoned: options.abandoned ?? false,
  };
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const inner of Object.values(value)) deepFreeze(inner);
    Object.freeze(value);
  }
  return value;
}

describe("applyResult: card history", () => {
  it("creates an entry for a card answered for the first time", () => {
    const { progress } = applyResult(emptyProgress(), result([answered("c1", true, 1000)]));
    expect(progress.cards["c1"]).toEqual({ seen: 1, lastCorrect: true, lastSeenAt: 1000 });
  });

  it("records a wrong answer as lastCorrect false", () => {
    const { progress } = applyResult(emptyProgress(), result([answered("c1", false, 1000)]));
    expect(progress.cards["c1"]).toEqual({ seen: 1, lastCorrect: false, lastSeenAt: 1000 });
  });

  it("adds to the seen count and replaces lastCorrect and lastSeenAt of a known card", () => {
    const before: Progress = { ...emptyProgress(), cards: { c1: { seen: 4, lastCorrect: true, lastSeenAt: 500 } } };
    const { progress } = applyResult(before, result([answered("c1", false, 2000)]));
    expect(progress.cards["c1"]).toEqual({ seen: 5, lastCorrect: false, lastSeenAt: 2000 });
  });

  it("uses each answer's own time", () => {
    const { progress } = applyResult(emptyProgress(), result([answered("c1", true, 1000), answered("c2", false, 4000)]));
    expect(progress.cards["c1"]?.lastSeenAt).toBe(1000);
    expect(progress.cards["c2"]?.lastSeenAt).toBe(4000);
  });

  it("leaves the history of cards that were not in the round alone", () => {
    const other = { seen: 2, lastCorrect: false, lastSeenAt: 10 };
    const before: Progress = { ...emptyProgress(), cards: { other } };
    const { progress } = applyResult(before, result([answered("c1", true, 1000)]));
    expect(progress.cards["other"]).toEqual(other);
  });

  it("keeps the history unchanged for a round with no answers", () => {
    const before: Progress = { ...emptyProgress(), cards: { c1: { seen: 1, lastCorrect: true, lastSeenAt: 1 } } };
    const { progress } = applyResult(before, result([], { abandoned: true }));
    expect(progress.cards).toEqual(before.cards);
  });
});

describe("applyResult: last route", () => {
  it("sets the last route and mode", () => {
    const { progress } = applyResult(emptyProgress(), result([answered("c1", true, 1)]));
    expect(progress.last).toEqual({ route: SEC, mode: "classic" });
  });

  it("replaces an earlier last route", () => {
    const before: Progress = { ...emptyProgress(), last: { route: CON, mode: "classic" } };
    const { progress } = applyResult(before, result([answered("c1", true, 1)], { route: SEC }));
    expect(progress.last).toEqual({ route: SEC, mode: "classic" });
  });

  it("sets the last route even for an abandoned round", () => {
    const { progress } = applyResult(emptyProgress(), result([], { abandoned: true }));
    expect(progress.last).toEqual({ route: SEC, mode: "classic" });
  });

  it("does not share the route object with the result", () => {
    const round = result([answered("c1", true, 1)]);
    const { progress } = applyResult(emptyProgress(), round);
    expect(progress.last?.route).not.toBe(round.route);
  });
});

describe("applyResult: purity", () => {
  it("does not change the progress or the result it is given", () => {
    const before = deepFreeze<Progress>({
      version: 1,
      cards: { c1: { seen: 1, lastCorrect: false, lastSeenAt: 1 } },
      records: { [recordKey(SEC, "classic")]: 3 },
      last: { route: CON, mode: "classic" },
    });
    const round = deepFreeze(result([answered("c1", true, 9), answered("c2", true, 10)]));
    const beforeCopy = structuredClone(before);
    const roundCopy = structuredClone(round);
    applyResult(before, round);
    expect(before).toEqual(beforeCopy);
    expect(round).toEqual(roundCopy);
  });
});
