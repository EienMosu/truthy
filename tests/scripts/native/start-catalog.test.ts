import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { golden } from "@/scripts/native/golden/start";

// The catalog vectors (components/start/useCatalog.ts): the shape of every file, and the values the web's own
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

const files = golden().filter((file) => file.path.startsWith("native-data/golden/components.start.useCatalog."));
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

describe("catalog vectors: the files", () => {
  it("writes one file for each function and constant of the catalog", () => {
    expect(files.map((file) => file.path).sort()).toEqual([
      "native-data/golden/components.start.useCatalog.RECENT_LIMIT.json",
      "native-data/golden/components.start.useCatalog.continueTarget.json",
      "native-data/golden/components.start.useCatalog.deckCount.json",
      "native-data/golden/components.start.useCatalog.deckOfCard.json",
      "native-data/golden/components.start.useCatalog.decksLabel.json",
      "native-data/golden/components.start.useCatalog.recentDecks.json",
      "native-data/golden/components.start.useCatalog.seenPercent.json",
      "native-data/golden/components.start.useCatalog.withoutRemovedCards.json",
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

  it("gives byte-identical files on a second run", () => {
    const again = golden().filter((file) => file.path.startsWith("native-data/golden/components.start.useCatalog."));
    expect(again).toEqual(files);
  });
});

describe("catalog vectors: counts and labels", () => {
  it("counts the decks of an area or a platform", () => {
    expect(caseOf("deckCount", "an area counts the decks of every platform").output).toBe(2);
    expect(caseOf("deckCount", "an area without platforms has none").output).toBe(0);
    expect(caseOf("deckCount", "a platform without decks has none").output).toBe(0);
  });

  it("says how many decks there are, or that there are none yet", () => {
    const label = (count: number) => caseOf("decksLabel", `${count} decks`).output;
    expect(label(0)).toBe("No decks yet");
    expect(label(1)).toBe("1 deck");
    expect(label(3)).toBe("3 decks");
    expect(label(54)).toBe("54 decks");
  });

  it("pins the number of recent decks", () => {
    expect(vectorsOf("RECENT_LIMIT").cases[0]).toMatchObject({ input: null, output: 4 });
  });
});

describe("catalog vectors: deckOfCard", () => {
  const owner = (title: string) => caseOf("deckOfCard", title).output;

  it("takes the longest prefix that ends before a dash", () => {
    expect(owner("the deck whose id and a dash begin the card id")).toBe("aws-clf-c02");
    expect(owner("the longest prefix wins: gcp-cdl-pro keeps its own cards")).toBe("gcp-cdl-pro");
    expect(owner("without the longer deck, gcp-cdl-pro-1 belongs to gcp-cdl")).toBe("gcp-cdl");
    expect(owner("a short deck id that begins a longer one")).toBe("aws-clf-c02");
  });

  it("gives undefined, written as the tagged undefined, when no deck owns the card", () => {
    for (const title of [
      "a deck id that only starts with the same letters is no owner",
      "a card of a deck the index does not have",
      "a card id with no dash has no deck",
      "a card id that is a deck id has no deck: the dash must follow the id",
      "a card id that starts with a dash has no deck",
      "no decks at all",
    ]) {
      expect(owner(title), title).toEqual({ $undefined: true });
    }
  });

  it("writes the deck ids as an array", () => {
    expect(caseOf("deckOfCard", "a card of gcp-cdl").input.deckIds).toEqual(["aws-clf-c02", "gcp-cdl", "gcp-cdl-pro", "nextjs-rendering"]);
  });
});

describe("catalog vectors: seenPercent", () => {
  const percent = (title: string) => caseOf("seenPercent", title).output;

  it("is 0 for not started, at least 1 once anything is seen, at most 100", () => {
    expect(percent("0 (not started) without history for the deck")).toBe(0);
    expect(percent("counts entries whose id starts with the deck id and a dash: 46 of 92 is 50")).toBe(50);
    expect(percent("never reads 0 once a card is seen")).toBe(1);
    expect(percent("never more than 100")).toBe(100);
  });

  it("counts the deck's current cards when their ids are known", () => {
    expect(percent("with the current ids known, removed cards count for nothing")).toBe(0);
    expect(percent("with the current ids known: 23 of 92 is 25")).toBe(25);
    expect(percent("with the current ids known: 1 of 500 shows 1")).toBe(1);
    expect(percent("an entry that was never seen is not counted (prefix count)")).toBe(0);
    expect(percent("an entry that was never seen is not counted (known ids)")).toBe(0);
    expect(percent("an empty list of current ids reads 0")).toBe(0);
  });

  it("rounds half up", () => {
    expect(percent("1 of 8 is 12.5 and rounds to 13")).toBe(13);
    expect(percent("3 of 8 is 37.5 and rounds to 38")).toBe(38);
    expect(percent("7 of 200 is 3.5 and rounds to 4")).toBe(4);
    expect(percent("1 of 200 is 0.5 and rounds to 1")).toBe(1);
    expect(percent("29 of 100: 0.29 times 100 is 28.999999999999996 and rounds to 29")).toBe(29);
    expect(percent("57 of 100: 0.57 times 100 is 56.99999999999999 and rounds to 57")).toBe(57);
    expect(percent("1 of 3 is 33")).toBe(33);
    expect(percent("2 of 3 is 67")).toBe(67);
  });

  it("leaves the ids out of the input when they are not known", () => {
    expect(caseOf("seenPercent", "0 (not started) without history for the deck").input).not.toHaveProperty("cardIds");
    expect(caseOf("seenPercent", "an empty list of current ids reads 0").input.cardIds).toEqual([]);
  });
});

describe("catalog vectors: continueTarget and recentDecks", () => {
  const target = (title: string) => caseOf("continueTarget", title).output;
  const recent = (title: string) => caseOf("recentDecks", title).output.map((entry: any) => entry.deckId);

  it("leads Continue to the last route and mode, only while both can be played", () => {
    expect(target("leads to the last route and mode, with the score of the last round")).toEqual({
      route: { deckId: "aws-clf-c02", sectionId: "SEC" },
      mode: "classic",
      found: { areaId: "cloud", platformId: "aws", deckId: "aws-clf-c02", sectionId: "SEC" },
      lastScore: { score: 7, total: 10 },
    });
    expect(target("nothing without a last round")).toBeNull();
    expect(target("nothing when the section is gone")).toBeNull();
    expect(target("nothing when the deck is gone")).toBeNull();
    expect(target("keeps the mode of the last round (Streak)").mode).toBe("streak");
  });

  it("brings the score only when score and total are both known", () => {
    expect(target("no score after a round that was left").lastScore).toBeNull();
    expect(target("no score when only one of score and total is known").lastScore).toBeNull();
    expect(target("a score of 0 is a score").lastScore).toEqual({ score: 0, total: 10 });
    expect(target("a whole-deck route of a deck without sections").found.sectionId).toBeNull();
  });

  it("does not continue into a class that is not offered", () => {
    expect(target("the Timed class while it is offered").mode).toBe("timed");
    expect(target("nothing when the class is not offered (Timed closed)")).toBeNull();
    expect(caseOf("continueTarget", "nothing when the class is not offered (Timed closed)").input.modeTable.map((row: any) => row.offered)).toEqual([true, true, true, false]);
    expect(target("another class is still continued while Timed is closed").mode).toBe("classic");
  });

  it("lists the decks played, newest first, four at most", () => {
    expect(recent("lists nothing without history")).toEqual([]);
    expect(caseOf("recentDecks", "gives each deck its area, platform and latest time, newest first").output).toEqual([
      { areaId: "cloud", platformId: "aws", deckId: "aws-clf-c02", lastSeenAt: 300 },
      { areaId: "cloud", platformId: "gcp", deckId: "gcp-cdl", lastSeenAt: 200 },
      { areaId: "frontend", platformId: "nextjs", deckId: "nextjs-rendering", lastSeenAt: 50 },
    ]);
    expect(recent("keeps catalog order for equal times")).toEqual(["aws-clf-c02", "gcp-cdl", "nextjs-rendering"]);
    expect(recent("leaves out a deck the index no longer has")).toEqual(["gcp-cdl"]);
    expect(recent("lists four at most")).toEqual(["azure-az4", "azure-az3", "azure-az2", "azure-az1"]);
    expect(recent("lists as many as asked: 2")).toEqual(["azure-az4", "azure-az3"]);
    expect(recent("lists as many as asked: 0")).toEqual([]);
    expect(recent("lists as many as asked: more than there are")).toHaveLength(5);
  });

  it("keeps a deck whose id begins another deck's apart, and takes the latest time of a deck", () => {
    expect(recent("an id that begins another deck's stays apart: only gcp-cdl-pro played")).toEqual(["gcp-cdl-pro"]);
    expect(recent("an id that begins another deck's stays apart: both played")).toEqual(["gcp-cdl", "gcp-cdl-pro"]);
    expect(caseOf("recentDecks", "the latest time of a deck is the maximum, whatever the order of its cards").output[0].lastSeenAt).toBe(500);
    expect(recent("a time of 0 still counts the deck as played")).toEqual(["gcp-cdl"]);
  });

  it("leaves the limit out of the input when it is not given", () => {
    expect(caseOf("recentDecks", "lists nothing without history").input).not.toHaveProperty("limit");
    expect(caseOf("recentDecks", "lists as many as asked: 2").input.limit).toBe(2);
  });
});

describe("catalog vectors: withoutRemovedCards", () => {
  const run = (title: string) => caseOf("withoutRemovedCards", title).output;

  it("drops the history of removed cards and saves only when entries were dropped", () => {
    expect(Object.keys(run("drops the history of cards that are no longer in the deck, and saves").progress.cards)).toEqual([]);
    expect(run("drops the history of cards that are no longer in the deck, and saves").saved).toBe(true);
    expect(Object.keys(run("keeps the history of cards still in the deck, and saves what was dropped").progress.cards)).toHaveLength(4);
    expect(run("keeps the history of cards still in the deck, and saves what was dropped").saved).toBe(true);
    for (const title of ["saves nothing when every card is still in the deck", "saves nothing when no deck's ids are known", "a deck with no history changes nothing", "empty progress stays empty and is not saved"]) {
      expect(run(title).saved, title).toBe(false);
    }
  });

  it("keeps the records and the last route whatever is dropped", () => {
    const { progress } = run("the records and the last route are kept whatever is dropped");
    expect(progress.records).toEqual({ "aws-clf-c02/SEC#classic": 7 });
    expect(progress.last.score).toBe(7);
  });

  it("prunes several decks in one go", () => {
    expect(Object.keys(run("prunes several decks in one go").progress.cards).sort()).toEqual(["aws-clf-c02-t1-0", "gcp-cdl-2"]);
  });
});
