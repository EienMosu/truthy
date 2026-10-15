import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { golden } from "@/scripts/native/golden/progress";

// The vectors of the progress module and its store: the shape of every file, and the values the web's own
// tests pin, read back out of the generated files.

const root = fileURLToPath(new URL("../../../", import.meta.url));

interface Case {
  name: string;
  input: any;
  output: any;
}
interface Vectors {
  format: number;
  module: string;
  function: string;
  source: string;
  tests: string[];
  cards: Record<string, unknown>;
  cases: Case[];
}

const files = golden();
const parsed = files.map((file) => ({ path: file.path, content: file.content, vectors: JSON.parse(file.content) as Vectors }));

function vectorsOf(name: string): Vectors {
  const found = parsed.find((file) => file.vectors.function === name);
  if (!found) throw new Error(`no vectors for ${name}`);
  return found.vectors;
}

function caseOf(name: string, title: string): Case {
  const found = vectorsOf(name).cases.find((candidate) => candidate.name === title);
  if (!found) throw new Error(`no case "${title}" in ${name}`);
  return found;
}

describe("progress vectors: the files", () => {
  it("writes one file for each function and constant of progress.ts and local.ts", () => {
    expect(files.map((file) => file.path).sort()).toEqual([
      "native-data/golden/src.progress.local.PROGRESS_KEY.json",
      "native-data/golden/src.progress.local.UNREADABLE_KEY.json",
      "native-data/golden/src.progress.local.createLocalStore.json",
      "native-data/golden/src.progress.progress.applyResult.json",
      "native-data/golden/src.progress.progress.bestFor.json",
      "native-data/golden/src.progress.progress.compareWithBest.json",
      "native-data/golden/src.progress.progress.emptyProgress.json",
      "native-data/golden/src.progress.progress.parseProgress.json",
      "native-data/golden/src.progress.progress.pruneDeck.json",
      "native-data/golden/src.progress.progress.readProgress.json",
      "native-data/golden/src.progress.progress.recordKey.json",
      "native-data/golden/src.progress.progress.seenShare.json",
    ]);
  });

  it("names a source file and test files that exist, and the module and function in the path", () => {
    for (const { path, vectors } of parsed) {
      expect(vectors.format).toBe(1);
      expect(path).toBe(`native-data/golden/${vectors.module.replaceAll("/", ".")}.${vectors.function}.json`);
      expect(existsSync(`${root}${vectors.source}`), vectors.source).toBe(true);
      for (const test of vectors.tests) expect(existsSync(`${root}${test}`), test).toBe(true);
    }
  });

  it("gives every case a distinct name, an input and an output", () => {
    for (const { path, vectors } of parsed) {
      const names = vectors.cases.map((candidate) => candidate.name);
      expect(new Set(names).size, path).toBe(names.length);
      for (const candidate of vectors.cases) {
        expect(candidate, `${path}: ${candidate.name}`).toHaveProperty("input");
        expect(candidate, `${path}: ${candidate.name}`).toHaveProperty("output");
      }
    }
  });

  it("puts every card it mentions in the file's cards table, and ends the file with a newline", () => {
    for (const { path, content, vectors } of parsed) {
      for (const [, id] of content.matchAll(/"\$card": "([^"]+)"/g)) expect(Object.keys(vectors.cards), `${path}: ${id}`).toContain(id);
      expect(content.endsWith("\n"), path).toBe(true);
    }
  });

  it("gives byte-identical files on a second run", () => {
    expect(golden()).toEqual(files);
  });
});

describe("progress vectors: constants and small functions", () => {
  it("pins the two storage keys", () => {
    expect(vectorsOf("PROGRESS_KEY").cases[0]).toMatchObject({ input: null, output: "truthy.progress.v1" });
    expect(vectorsOf("UNREADABLE_KEY").cases[0]).toMatchObject({ input: null, output: "truthy.progress.v1.unreadable" });
  });

  it("emptyProgress and recordKey", () => {
    expect(vectorsOf("emptyProgress").cases[0]).toMatchObject({ input: {}, output: { version: 1, cards: {}, records: {}, last: null } });
    expect(caseOf("recordKey", "joins the route key and the mode with a hash").output).toBe("aws-clf-c02/SEC#classic");
    expect(caseOf("recordKey", "whole deck route").output).toBe("nextjs-rendering/ALL#classic");
    expect(caseOf("recordKey", "same route, Timed").output).toBe("aws-clf-c02/SEC#timed");
  });

  it("bestFor reads a record of 0 as 0, not as missing", () => {
    expect(caseOf("bestFor", "the record of a route and mode").output).toBe(9);
    expect(caseOf("bestFor", "no record for another section").output).toBeNull();
    expect(caseOf("bestFor", "a record of 0 is a record, not null").output).toBe(0);
  });

  it("compareWithBest says first, new best, equal and short", () => {
    expect(caseOf("compareWithBest", "a first round when the route and mode had no record").output).toEqual({ kind: "first" });
    expect(caseOf("compareWithBest", "a new best when the score beats the record").output).toEqual({ kind: "new-best", previousBest: 7 });
    expect(caseOf("compareWithBest", "equals the best when the score matches the record").output).toEqual({ kind: "equal", best: 9 });
    expect(caseOf("compareWithBest", "short of the record by 2").output).toEqual({ kind: "short", best: 9, by: 2 });
    expect(caseOf("compareWithBest", "short of the record by 10").output).toEqual({ kind: "short", best: 10, by: 10 });
  });

  it("seenShare", () => {
    expect(caseOf("seenShare", "0 for a deck with no cards").output).toBe(0);
    expect(caseOf("seenShare", "the share of the given cards seen at least once").output).toBe(0.5);
    expect(caseOf("seenShare", "1 when every card has been seen").output).toBe(1);
    expect(caseOf("seenShare", "an entry with a seen count of 0 is not seen").output).toBe(0);
    expect(caseOf("seenShare", "a card listed twice counts once").output).toBe(0.5);
  });
});

describe("progress vectors: applyResult", () => {
  it("keeps the records the web's tests pin, with the record before and whether the round set a new best", () => {
    const expected: [string, Record<string, number>, number | null, boolean][] = [
      ["records: a first record for a route and mode that has none", { "aws-clf-c02/SEC#classic": 6 }, null, true],
      ["records: replaces a record that the score beats", { "aws-clf-c02/SEC#classic": 8 }, 6, true],
      ["records: keeps a record that the score does not reach", { "aws-clf-c02/SEC#classic": 8 }, 8, false],
      ["records: equalling the record is not a new best", { "aws-clf-c02/SEC#classic": 7 }, 7, false],
      ["records: a first finished round with no correct answer sets the record 0", { "aws-clf-c02/SEC#classic": 0 }, null, true],
      ["records: a later 0 does not replace a record of 0", { "aws-clf-c02/SEC#classic": 0 }, 0, false],
      ["abandoned: does not beat an existing record, however high its score", { "aws-clf-c02/SEC#classic": 2 }, 2, false],
      ["abandoned: does not set a first record", {}, null, false],
      ["modes: equalling a Streak record is not a new best", { "aws-clf-c02/SEC#streak": 12 }, 12, false],
      ["modes: a longer streak replaces the record", { "aws-clf-c02/SEC#streak": 13 }, 12, true],
      ["modes: a first Timed round with no correct answer sets the record 0", { "aws-clf-c02/SEC#timed": 0 }, null, true],
      ["modes: a round that was left sets no record in timed", { "aws-clf-c02/SEC#timed": 4 }, 4, false],
      ["engine: a finished Streak round (3 in a row, 4 cards answered)", { "aws-clf-c02/SEC#streak": 3 }, null, true],
      ["engine: a decided Streak round that was left sets no record", { "aws-clf-c02/SEC#streak": 4 }, 4, false],
    ];
    for (const [title, records, previousBest, isNewBest] of expected) {
      const { output } = caseOf("applyResult", title);
      expect(output.progress.records, title).toEqual(records);
      expect(output.previousBest, title).toBe(previousBest);
      expect(output.isNewBest, title).toBe(isNewBest);
    }
  });

  it("keeps one record per class on the same route, each case starting from the one before", () => {
    expect(caseOf("applyResult", "modes: one record per class on the same route, timed").output.progress.records).toEqual({
      "aws-clf-c02/SEC#classic": 7,
      "aws-clf-c02/SEC#streak": 12,
      "aws-clf-c02/SEC#lives": 21,
      "aws-clf-c02/SEC#timed": 14,
    });
  });

  it("writes the card history: counts, the later verdict, the later time", () => {
    const entry = (title: string, id: string) => caseOf("applyResult", title).output.progress.cards[id];
    expect(entry("history: an entry for a card answered for the first time", "c1")).toEqual({ seen: 1, lastCorrect: true, lastSeenAt: 1000 });
    expect(entry("history: a wrong answer is lastCorrect false", "c1")).toEqual({ seen: 1, lastCorrect: false, lastSeenAt: 1000 });
    expect(entry("history: adds to the seen count and replaces lastCorrect and lastSeenAt of a known card", "c1")).toEqual({ seen: 5, lastCorrect: false, lastSeenAt: 2000 });
    expect(entry("history: the seen count has no ceiling (150 becomes 151)", "c1")).toEqual({ seen: 151, lastCorrect: false, lastSeenAt: 9 });
    expect(entry("history: a card answered twice in one round counts twice and keeps the later answer", "c1")).toEqual({ seen: 2, lastCorrect: false, lastSeenAt: 200 });
    expect(entry("modes: a card answered twice in Three lives counts two sightings and keeps the later verdict", "A")).toEqual({ seen: 2, lastCorrect: true, lastSeenAt: 300 });
    expect(entry("modes: a card answered twice in Three lives counts two sightings and keeps the later verdict", "B")).toEqual({ seen: 1, lastCorrect: true, lastSeenAt: 200 });
    expect(entry("modes: a card answered twice, added to stored history", "A")).toEqual({ seen: 6, lastCorrect: true, lastSeenAt: 300 });
    expect(entry("modes: a card answered right, then wrong, ends wrong", "A")?.lastCorrect).toBe(false);
    expect(caseOf("applyResult", "history: cards that were not in the round are left alone").output.progress.cards.other).toEqual({ seen: 2, lastCorrect: false, lastSeenAt: 10 });
  });

  it("writes the last route with the score of a finished round and none for an abandoned one", () => {
    const last = (title: string) => caseOf("applyResult", title).output.progress.last;
    const route = { deckId: "aws-clf-c02", sectionId: "SEC" };
    expect(last("last: 7 of 10")).toEqual({ route, mode: "classic", score: 7, total: 10 });
    expect(last("last: an abandoned round has no score")).toEqual({ route, mode: "classic", score: null, total: null });
    expect(last("modes: the last round keeps the class's own score")).toEqual({ route, mode: "lives", score: 21, total: 21 });
    expect(last("last: replaces an earlier last route and its score")).toEqual({ route, mode: "classic", score: 1, total: 1 });
  });

  it("refers to cards by id: no full card in an input or an output", () => {
    const { input, output } = caseOf("applyResult", "last: 7 of 10");
    expect(input.result.answers[0].card).toEqual({ $card: "c0" });
    expect(output.progress.cards.c0).toEqual({ seen: 1, lastCorrect: true, lastSeenAt: 1 });
    expect(Object.keys(vectorsOf("applyResult").cards)).toContain("c0");
  });
});

describe("progress vectors: pruneDeck", () => {
  const kept = (title: string) => Object.keys(caseOf("pruneDeck", title).output.cards).sort();

  it("drops the deck's cards that are not listed and keeps every other card", () => {
    expect(kept("removes the deck's cards that no longer exist")).toEqual(["aws-clf-c02-t1.1-01", "aws-clf-c02-t2.1-06", "nextjs-rendering-rsc-01"]);
    expect(kept("keeps the records and the last route when every card goes")).toEqual(["nextjs-rendering-rsc-01"]);
    expect(kept("does nothing for a deck with no history")).toEqual(["aws-clf-c02-t1.1-01", "aws-clf-c02-t1.1-02", "aws-clf-c02-t2.1-06", "nextjs-rendering-rsc-01"]);
    expect(kept("does not add entries for current cards that were never seen")).not.toContain("aws-clf-c02-t9.9-99");
  });

  it("keeps the records and the last route", () => {
    const { output } = caseOf("pruneDeck", "keeps the records and the last route when every card goes");
    expect(output.records).toEqual({ "aws-clf-c02/SEC#classic": 7 });
    expect(output.last).toEqual({ route: { deckId: "aws-clf-c02", sectionId: "SEC" }, mode: "classic", score: 7, total: 10 });
  });

  it("tests the plain prefix: look-alike ids stay, and a gcp-cdl-pro card is dropped when gcp-cdl is pruned", () => {
    expect(kept("a card id that only starts with the same letters belongs to no deck here (aws)")).toEqual(["aws-clf-c02x-1", "nextjs-renderingx-1"]);
    expect(kept("a card id that only starts with the same letters belongs to no deck here (next)")).toEqual(["aws-clf-c02-t1.1-01", "aws-clf-c02x-1", "nextjs-renderingx-1"]);
    expect(kept("the plain prefix rule: pruning gcp-cdl also drops a gcp-cdl-pro card that is not listed")).toEqual(["gcp-cdl-1"]);
  });
});

describe("progress vectors: reading a stored value", () => {
  const whole = (title: string) => caseOf("readProgress", title).output.whole;
  const progressOf = (title: string) => caseOf("readProgress", title).output.progress;

  it("reads a value whole, or says that a part was dropped", () => {
    for (const title of [
      "a valid value",
      "nothing stored",
      "a progress with no last route",
      "the last route of an abandoned round, without a score",
      "a last route stored before scores were kept",
      "only unknown fields to drop",
      "a version written 1.0",
      "a lastSeenAt of 0 is kept",
      "a fractional lastSeenAt is kept",
      "a lastSeenAt of -0 is kept as -0",
      "a seen count of 2^53 - 1 is kept",
      "a score written 7.0 is the integer 7",
    ]) {
      expect(whole(title), title).toBe(true);
    }
    for (const title of [
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
      "a lastSeenAt of 1e999 reads as Infinity and drops that entry alone",
      "a seen count of 2^53 is not a safe integer",
    ]) {
      expect(whole(title), title).toBe(false);
    }
  });

  it("drops only the part that fails and keeps the rest", () => {
    const stored = progressOf("a valid value");
    expect(Object.keys(stored.cards)).toEqual(["aws-clf-c02-t1.1-01", "aws-clf-c02-t2.1-06"]);
    expect(progressOf("a bad record")).toEqual(stored);
    expect(progressOf("a bad card entry")).toEqual(stored);
    expect(progressOf("a last route with a mode a later version added")).toEqual({ ...stored, last: null });
    expect(progressOf("a card history that is not an object")).toEqual({ ...stored, cards: {} });
    expect(progressOf("records that are not an object")).toEqual({ ...stored, records: {} });
    expect(progressOf("a last route stored before scores were kept").last).toEqual({ route: { deckId: "aws-clf-c02", sectionId: "SEC" }, mode: "classic", score: null, total: null });
  });

  it("reads a value that cannot be read at all as empty progress", () => {
    const empty = { version: 1, cards: {}, records: {}, last: null };
    for (const title of ["unparsable JSON", "a value cut short", "an empty string", "null", "a number", "a string", "an array", "an empty object", "a future version", "a version stored as a string", "no version"]) {
      expect(progressOf(title), title).toEqual(empty);
    }
  });

  it("reads a stored value with no last key as last null and not whole", () => {
    expect(progressOf("no last key at all").last).toBeNull();
    expect(Object.keys(progressOf("no last key at all").cards)).toHaveLength(2);
  });

  it("drops a number that is not finite or not a safe integer, and only the part that holds it", () => {
    expect(Object.keys(progressOf("a lastSeenAt of 1e999 reads as Infinity and drops that entry alone").cards)).toEqual(["b"]);
    expect(progressOf("a record of 1e999 drops that record alone").records).toEqual({ "b/ALL#classic": 2 });
    expect(progressOf("a seen count of 2^53 is not a safe integer").cards).toEqual({});
    expect(progressOf("a seen count of 2^53 - 1 is kept").cards.a.seen).toBe(9007199254740991);
    expect(progressOf("a record of 2^53 is dropped").records).toEqual({});
    expect(progressOf("a score of 1e999 drops the last route").last).toBeNull();
    expect(progressOf("a score written 7.0 is the integer 7").last.score).toBe(7);
  });

  it("writes a negative zero as the tagged number", () => {
    expect(progressOf("a lastSeenAt of -0 is kept as -0").cards.a.lastSeenAt).toEqual({ $number: "-0" });
  });

  it("keeps a __proto__ key as a plain key in the file", () => {
    const { content } = parsed.find((file) => file.vectors.function === "parseProgress")!;
    expect(content).toContain('"__proto__": {');
    expect(Object.keys(caseOf("parseProgress", "a __proto__ key in cards and in records").output.cards)).toEqual(["__proto__"]);
    expect(Object.keys(caseOf("parseProgress", "a __proto__ key in cards and in records").output.records)).toEqual(["__proto__"]);
  });

  it("parseProgress is the progress of readProgress, case by case", () => {
    const reads = vectorsOf("readProgress").cases;
    const parses = vectorsOf("parseProgress").cases;
    expect(parses.map((c) => c.name)).toEqual(reads.map((c) => c.name));
    parses.forEach((parse, i) => {
      expect(parse.input, parse.name).toEqual(reads[i]!.input);
      expect(parse.output, parse.name).toEqual(reads[i]!.output.progress);
    });
  });

  it("covers the raw values of the web tests that must never throw", () => {
    const raws = vectorsOf("parseProgress").cases.map((c) => c.input.raw);
    for (const raw of ["", " ", "{", "undefined", "NaN", "true", '{"version":1}', "\u0000", "{}", "[]", "null", "42"]) expect(raws).toContain(raw);
  });
});

describe("progress vectors: the store", () => {
  const run = (title: string) => caseOf("createLocalStore", title).output as { loads: any[]; items: Record<string, string> | null };
  const KEY = "truthy.progress.v1";
  const SIDE = "truthy.progress.v1.unreadable";
  const empty = { version: 1, cards: {}, records: {}, last: null };

  it("loads empty progress when nothing is stored, the value is corrupt, or the storage throws or is missing", () => {
    expect(run("loads empty progress when nothing has been stored").loads).toEqual([empty]);
    expect(run("loads empty progress when the stored value is corrupt").loads).toEqual([empty]);
    expect(run("loads empty progress when getItem throws").loads).toEqual([empty]);
    expect(run("without a storage: load is empty, save does nothing").loads).toEqual([empty, empty]);
    expect(run("without a storage: load is empty, save does nothing").items).toBeNull();
  });

  it("saves under the key as JSON and reads it back", () => {
    const saved = run("saves under the progress key as JSON");
    expect(JSON.parse(saved.items![KEY]!).records).toEqual({ "aws-clf-c02/SEC#classic": 7 });
    expect(run("round-trips progress through the storage").loads[0].records).toEqual({ "aws-clf-c02/SEC#classic": 7 });
    expect(run("loads what the latest save wrote").loads).toEqual([empty]);
    expect(run("does not touch other keys").items!["truthy.deck.aws-clf-c02"]).toBe("deck");
  });

  it("does not throw and keeps the old value when a save cannot write", () => {
    expect(run("a save does not throw when setItem throws because the storage is full").items).toEqual({});
    expect(run("a save does not throw and writes nothing when getItem throws").items).toEqual({});
    expect(run("keeps the previously stored progress when a save fails").loads[0].records).toEqual({ "aws-clf-c02/SEC#classic": 7 });
  });

  it("keeps the raw value of a value that did not read whole under the side key, before writing over it", () => {
    const names = vectorsOf("createLocalStore").cases.map((c) => c.name).filter((name) => name.startsWith("keeps the raw value of "));
    expect(names).toHaveLength(14);
    for (const name of names) {
      const { input, output } = caseOf("createLocalStore", name);
      const put = input.steps.find((step: any) => step.op === "put");
      expect(output.items[SIDE], name).toBe(put.value);
      expect(JSON.parse(output.items[KEY]).version, name).toBe(1);
    }
  });

  it("loads the valid parts, and keeps the valid records through a save", () => {
    expect(run("loads the valid parts of a value with a dropped part").loads[0].last).toBeNull();
    expect(Object.keys(run("loads the valid parts of a value with a dropped part").loads[0].records)).toEqual(["aws-clf-c02/SEC#classic", "gcp-cdl/ALL#classic"]);
    expect(Object.keys(run("the valid records go through a save, as at the start of a round").loads[0].records)).toEqual(["aws-clf-c02/SEC#classic", "gcp-cdl/ALL#classic"]);
  });

  it("makes the copy once, replaces it with a later unreadable value, and writes none for a whole value", () => {
    expect(run("makes the copy once: later saves over the clean value leave the side key alone").items![SIDE]).toBe("marker");
    expect(run("replaces the side key with a later unreadable value").items![SIDE]).toBe("{second");
    expect(SIDE in run("writes no side key over a value that reads whole, or when nothing is stored").items!).toBe(false);
  });

  it("does not write over a value it could not keep aside, but does when the side key already holds it", () => {
    expect(run("does not write over the value when it cannot be kept aside first").items).toEqual({ [KEY]: "{not json" });
    const written = run("writes over the value when the side key already holds it, though the side key cannot be written").items!;
    expect(written[SIDE]).toBe("{not json");
    expect(JSON.parse(written[KEY]!).version).toBe(1);
  });
});
