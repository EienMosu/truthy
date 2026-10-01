import { describe, expect, it } from "vitest";
import type { Card, Route } from "@/src/content/schema";
import type { Answered, RoundResult } from "@/src/engine/round";
import {
  applyResult,
  emptyProgress,
  parseProgress,
  pruneDeck,
  recordKey,
  seenShare,
  type Progress,
} from "@/src/progress/progress";

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

// A classic result with the given score out of ten, all answered at time 1.
function scored(score: number, options: { route?: Route; abandoned?: boolean } = {}): RoundResult {
  const answers = Array.from({ length: 10 }, (_, i) => answered(`c${i}`, i < score, 1));
  return result(answers, options);
}

function withRecord(route: Route, best: number): Progress {
  return { ...emptyProgress(), records: { [recordKey(route, "classic")]: best } };
}

describe("applyResult: records", () => {
  it("sets a first record for a route and mode that has none", () => {
    const outcome = applyResult(emptyProgress(), scored(6));
    expect(outcome.progress.records).toEqual({ "aws-clf-c02/SEC#classic": 6 });
    expect(outcome.previousBest).toBeNull();
    expect(outcome.isNewBest).toBe(true);
  });

  it("replaces a record that the score beats", () => {
    const outcome = applyResult(withRecord(SEC, 6), scored(8));
    expect(outcome.progress.records["aws-clf-c02/SEC#classic"]).toBe(8);
    expect(outcome.previousBest).toBe(6);
    expect(outcome.isNewBest).toBe(true);
  });

  it("keeps a record that the score does not reach", () => {
    const outcome = applyResult(withRecord(SEC, 8), scored(5));
    expect(outcome.progress.records["aws-clf-c02/SEC#classic"]).toBe(8);
    expect(outcome.previousBest).toBe(8);
    expect(outcome.isNewBest).toBe(false);
  });

  it("does not count equalling the record as a new best", () => {
    const outcome = applyResult(withRecord(SEC, 7), scored(7));
    expect(outcome.progress.records["aws-clf-c02/SEC#classic"]).toBe(7);
    expect(outcome.previousBest).toBe(7);
    expect(outcome.isNewBest).toBe(false);
  });

  it("keeps the records of other routes and modes", () => {
    const before: Progress = {
      ...emptyProgress(),
      records: { [recordKey(CON, "classic")]: 9, [recordKey(SEC, "timed")]: 20 },
    };
    const outcome = applyResult(before, scored(4, { route: SEC }));
    expect(outcome.progress.records).toEqual({
      "aws-clf-c02/CON#classic": 9,
      "aws-clf-c02/SEC#timed": 20,
      "aws-clf-c02/SEC#classic": 4,
    });
  });

  it("does not compare against the record of another section", () => {
    const outcome = applyResult(withRecord(CON, 9), scored(3, { route: SEC }));
    expect(outcome.previousBest).toBeNull();
    expect(outcome.isNewBest).toBe(true);
  });
});

describe("applyResult: an abandoned round", () => {
  it("updates the card history", () => {
    const round = result([answered("c1", true, 100), answered("c2", false, 200)], { abandoned: true });
    const { progress } = applyResult(emptyProgress(), round);
    expect(progress.cards).toEqual({
      c1: { seen: 1, lastCorrect: true, lastSeenAt: 100 },
      c2: { seen: 1, lastCorrect: false, lastSeenAt: 200 },
    });
  });

  it("does not beat an existing record, however high its score", () => {
    const outcome = applyResult(withRecord(SEC, 2), scored(9, { abandoned: true }));
    expect(outcome.progress.records["aws-clf-c02/SEC#classic"]).toBe(2);
    expect(outcome.previousBest).toBe(2);
    expect(outcome.isNewBest).toBe(false);
  });

  it("does not set a first record", () => {
    const outcome = applyResult(emptyProgress(), scored(5, { abandoned: true }));
    expect(outcome.progress.records).toEqual({});
    expect(outcome.previousBest).toBeNull();
    expect(outcome.isNewBest).toBe(false);
  });
});

function seenOnce(at = 1) {
  return { seen: 1, lastCorrect: true, lastSeenAt: at };
}

describe("pruneDeck", () => {
  const before: Progress = {
    version: 1,
    cards: {
      "aws-clf-c02-t1.1-01": seenOnce(),
      "aws-clf-c02-t1.1-02": seenOnce(),
      "aws-clf-c02-t2.1-06": seenOnce(),
      "nextjs-rendering-rsc-01": seenOnce(),
    },
    records: { "aws-clf-c02/SEC#classic": 7 },
    last: { route: SEC, mode: "classic" },
  };

  it("removes the history of that deck's cards that no longer exist", () => {
    const after = pruneDeck(before, "aws-clf-c02", ["aws-clf-c02-t1.1-01", "aws-clf-c02-t2.1-06"]);
    expect(Object.keys(after.cards).sort()).toEqual([
      "aws-clf-c02-t1.1-01",
      "aws-clf-c02-t2.1-06",
      "nextjs-rendering-rsc-01",
    ]);
  });

  it("keeps the history of other decks' cards", () => {
    const after = pruneDeck(before, "aws-clf-c02", ["aws-clf-c02-t1.1-01"]);
    expect(after.cards["nextjs-rendering-rsc-01"]).toEqual(seenOnce());
  });

  it("keeps the entries of the cards that still exist unchanged", () => {
    const after = pruneDeck(before, "aws-clf-c02", ["aws-clf-c02-t1.1-01", "aws-clf-c02-t1.1-02", "aws-clf-c02-t2.1-06"]);
    expect(after.cards).toEqual(before.cards);
  });

  it("does not add entries for current cards that were never seen", () => {
    const after = pruneDeck(before, "aws-clf-c02", ["aws-clf-c02-t1.1-01", "aws-clf-c02-t9.9-99"]);
    expect(after.cards["aws-clf-c02-t9.9-99"]).toBeUndefined();
  });

  it("keeps the records and the last route", () => {
    const after = pruneDeck(before, "aws-clf-c02", []);
    expect(after.records).toEqual(before.records);
    expect(after.last).toEqual(before.last);
  });

  it("does nothing for a deck with no history", () => {
    const after = pruneDeck(before, "gcp-cdl", ["gcp-cdl-01"]);
    expect(after).toEqual(before);
  });

  it("does not change the progress it is given", () => {
    const frozen = deepFreeze(structuredClone(before));
    const after = pruneDeck(frozen, "aws-clf-c02", []);
    expect(frozen).toEqual(before);
    expect(after).not.toBe(frozen);
  });
});

describe("seenShare", () => {
  it("is 0 for a deck with no cards", () => {
    expect(seenShare({ a: seenOnce() }, [])).toBe(0);
  });

  it("is 0 with no history", () => {
    expect(seenShare({}, ["a", "b"])).toBe(0);
  });

  it("is 0 with neither cards nor history", () => {
    expect(seenShare({}, [])).toBe(0);
  });

  it("is the share of the given cards seen at least once", () => {
    expect(seenShare({ a: seenOnce(), c: seenOnce() }, ["a", "b", "c", "d"])).toBe(0.5);
  });

  it("is 1 when every card has been seen", () => {
    expect(seenShare({ a: seenOnce(), b: seenOnce() }, ["a", "b"])).toBe(1);
  });

  it("ignores history of cards that are not in the list", () => {
    expect(seenShare({ a: seenOnce(), gone: seenOnce(), other: seenOnce() }, ["a", "b"])).toBe(0.5);
  });

  it("does not count an entry with a seen count of 0", () => {
    expect(seenShare({ a: { seen: 0, lastCorrect: false, lastSeenAt: 0 } }, ["a"])).toBe(0);
  });

  it("counts a card listed twice once", () => {
    expect(seenShare({ a: seenOnce() }, ["a", "a", "b"])).toBe(0.5);
  });
});

describe("parseProgress", () => {
  const stored: Progress = {
    version: 1,
    cards: {
      "aws-clf-c02-t1.1-01": { seen: 3, lastCorrect: false, lastSeenAt: 1_790_000_000_000 },
      "aws-clf-c02-t2.1-06": { seen: 1, lastCorrect: true, lastSeenAt: 1_790_000_100_000 },
    },
    records: { "aws-clf-c02/SEC#classic": 8 },
    last: { route: SEC, mode: "classic" },
  };
  const empty = emptyProgress();

  it("reads back what was stored", () => {
    expect(parseProgress(JSON.stringify(stored))).toEqual(stored);
  });

  it("reads a progress with no last route", () => {
    const fresh = { ...stored, last: null };
    expect(parseProgress(JSON.stringify(fresh))).toEqual(fresh);
  });

  it("gives empty progress for null (nothing stored yet)", () => {
    expect(parseProgress(null)).toEqual(empty);
  });

  it("gives empty progress for an empty string", () => {
    expect(parseProgress("")).toEqual(empty);
  });

  it("gives empty progress for invalid JSON", () => {
    expect(parseProgress("{not json")).toEqual(empty);
    expect(parseProgress(JSON.stringify(stored).slice(0, 40))).toEqual(empty);
  });

  it("gives empty progress for valid JSON that is not an object", () => {
    expect(parseProgress("null")).toEqual(empty);
    expect(parseProgress("42")).toEqual(empty);
    expect(parseProgress('"progress"')).toEqual(empty);
    expect(parseProgress("[]")).toEqual(empty);
  });

  it("gives empty progress for an object of the wrong shape", () => {
    expect(parseProgress("{}")).toEqual(empty);
    expect(parseProgress(JSON.stringify({ ...stored, cards: [] }))).toEqual(empty);
    expect(parseProgress(JSON.stringify({ ...stored, records: { "aws-clf-c02/SEC#classic": "8" } }))).toEqual(empty);
    expect(
      parseProgress(JSON.stringify({ ...stored, cards: { a: { seen: "1", lastCorrect: true, lastSeenAt: 1 } } })),
    ).toEqual(empty);
    expect(parseProgress(JSON.stringify({ ...stored, last: { route: SEC } }))).toEqual(empty);
  });

  it("gives empty progress for impossible values", () => {
    expect(
      parseProgress(JSON.stringify({ ...stored, cards: { a: { seen: -1, lastCorrect: true, lastSeenAt: 1 } } })),
    ).toEqual(empty);
    expect(
      parseProgress(JSON.stringify({ ...stored, cards: { a: { seen: 1.5, lastCorrect: true, lastSeenAt: 1 } } })),
    ).toEqual(empty);
    expect(parseProgress(JSON.stringify({ ...stored, records: { "aws-clf-c02/SEC#classic": -3 } }))).toEqual(empty);
    expect(parseProgress(JSON.stringify({ ...stored, last: { route: SEC, mode: "zen" } }))).toEqual(empty);
    expect(parseProgress(JSON.stringify({ ...stored, last: { route: { deckId: "", sectionId: "SEC" }, mode: "classic" } }))).toEqual(empty);
  });

  it("gives empty progress for a missing version", () => {
    const { version: _version, ...withoutVersion } = stored;
    expect(parseProgress(JSON.stringify(withoutVersion))).toEqual(empty);
  });

  it("gives empty progress for a future version", () => {
    expect(parseProgress(JSON.stringify({ ...stored, version: 2 }))).toEqual(empty);
  });

  it("gives empty progress for a version stored as a string", () => {
    expect(parseProgress(JSON.stringify({ ...stored, version: "1" }))).toEqual(empty);
  });

  it("keeps the data and drops unknown fields", () => {
    const withExtras = {
      ...stored,
      theme: "night",
      cards: { "aws-clf-c02-t1.1-01": { seen: 3, lastCorrect: false, lastSeenAt: 5, flagged: true } },
      last: { route: { ...SEC, label: "Security" }, mode: "classic", at: 9 },
    };
    expect(parseProgress(JSON.stringify(withExtras))).toEqual({
      version: 1,
      cards: { "aws-clf-c02-t1.1-01": { seen: 3, lastCorrect: false, lastSeenAt: 5 } },
      records: { "aws-clf-c02/SEC#classic": 8 },
      last: { route: SEC, mode: "classic" },
    });
  });

  it("does not let a __proto__ key in stored data change any prototype", () => {
    const raw =
      '{"version":1,"cards":{"__proto__":{"seen":1,"lastCorrect":true,"lastSeenAt":1}},"records":{"__proto__":3},"last":null}';
    const parsed = parseProgress(raw);
    expect(Object.getPrototypeOf(parsed.cards)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(parsed.records)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>)["seen"]).toBeUndefined();
  });

  it("never throws, whatever it is given", () => {
    for (const raw of ["", " ", "{", "undefined", "NaN", "true", '{"version":1}', "\u0000"]) {
      expect(() => parseProgress(raw)).not.toThrow();
    }
  });

  it("returns a fresh empty progress each time", () => {
    const first = parseProgress(null);
    first.records["x"] = 1;
    expect(parseProgress(null)).toEqual(empty);
  });
});

describe("applyResult: review focus", () => {
  it("counts a card answered twice in one round twice, keeping the later answer", () => {
    const round = result([answered("c1", true, 100), answered("c2", true, 150), answered("c1", false, 200)]);
    const { progress } = applyResult(emptyProgress(), round);
    expect(progress.cards["c1"]).toEqual({ seen: 2, lastCorrect: false, lastSeenAt: 200 });
  });

  it("sets a first record of 0 for a finished round with no correct answers", () => {
    const outcome = applyResult(emptyProgress(), scored(0));
    expect(outcome.progress.records).toEqual({ "aws-clf-c02/SEC#classic": 0 });
    expect(outcome.previousBest).toBeNull();
    expect(outcome.isNewBest).toBe(true);
  });

  it("does not let a later 0 replace a record of 0", () => {
    const outcome = applyResult(withRecord(SEC, 0), scored(0));
    expect(outcome.previousBest).toBe(0);
    expect(outcome.isNewBest).toBe(false);
  });
});
