import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MODE_TABLE } from "@/src/app-state/modes";
import { golden, withClosedClasses } from "@/scripts/native/golden/content";

// The vectors of the content helpers and the class table: the shape of every file, and the values the web's
// own tests pin, read back out of the generated files.

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

describe("content vectors: the files", () => {
  it("writes one file for each function and constant of the content helpers and the class table", () => {
    expect(files.map((file) => file.path).sort()).toEqual([
      "native-data/golden/src.app-state.modes.MODE_TABLE.json",
      "native-data/golden/src.app-state.modes.isOffered.json",
      "native-data/golden/src.app-state.modes.lastScoreText.json",
      "native-data/golden/src.app-state.modes.modeInfo.json",
      "native-data/golden/src.content.load.poolFor.json",
      "native-data/golden/src.content.schema.WHOLE_DECK.json",
      "native-data/golden/src.content.schema.deckPassName.json",
      "native-data/golden/src.content.schema.findRoute.json",
      "native-data/golden/src.content.schema.routeKey.json",
      "native-data/golden/src.content.text.plainText.json",
      "native-data/golden/src.content.text.textParts.json",
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

  it("gives every case a distinct name, an input and an output, and puts every card it mentions in the cards table", () => {
    for (const { path, content, vectors } of parsed) {
      const names = vectors.cases.map((candidate) => candidate.name);
      expect(new Set(names).size, path).toBe(names.length);
      for (const candidate of vectors.cases) {
        expect(candidate, `${path}: ${candidate.name}`).toHaveProperty("input");
        expect(candidate, `${path}: ${candidate.name}`).toHaveProperty("output");
      }
      for (const [, id] of content.matchAll(/"\$card": "([^"]+)"/g)) expect(Object.keys(vectors.cards), `${path}: ${id}`).toContain(id);
    }
  });

  it("gives byte-identical files on a second run, and leaves the class table open as it found it", () => {
    expect(golden()).toEqual(files);
    expect(MODE_TABLE.map((row) => row.offered)).toEqual([true, true, true, true]);
  });
});

describe("content vectors: routes and names", () => {
  it("pins the whole-deck id and the route key", () => {
    expect(vectorsOf("WHOLE_DECK").cases[0]).toMatchObject({ input: null, output: "ALL" });
    expect(caseOf("routeKey", "joins the deck id and the section id with a slash").output).toBe("aws-clf-c02/SEC");
    expect(caseOf("routeKey", "uses ALL for the whole deck").output).toBe("nextjs-rendering/ALL");
  });

  it("names a deck on the pass: its own pass name, else the platform and the title", () => {
    expect(caseOf("deckPassName", "joins the platform and the deck title when the deck has no pass name").output).toBe("AWS Cloud Practitioner");
    expect(caseOf("deckPassName", "uses the deck's pass name when it has one").output).toBe("Google Cloud Digital Leader");
    expect(caseOf("deckPassName", "Next.js Rendering").output).toBe("Next.js Rendering");
  });

  it("finds a route as the ids of what it found, or null", () => {
    expect(caseOf("findRoute", "finds a section route").output).toEqual({ areaId: "cloud", platformId: "aws", deckId: "aws-clf-c02", sectionId: "SEC" });
    expect(caseOf("findRoute", "finds a whole-deck route of a deck without sections").output).toEqual({ areaId: "cloud", platformId: "gcp", deckId: "gcp-cdl", sectionId: null });
    expect(caseOf("findRoute", "finds a whole-deck route of a deck with sections").output).toEqual({ areaId: "cloud", platformId: "aws", deckId: "aws-clf-c02", sectionId: null });
    for (const title of [
      "finds nothing when the deck is gone",
      "finds nothing when the section is gone",
      "finds nothing for a section of a deck that has none",
      "finds nothing for an empty section id",
      "a section id is not read case-insensitively",
    ]) {
      expect(caseOf("findRoute", title).output, title).toBeNull();
    }
    expect(caseOf("findRoute", "finds a section route").input.index.areas).toHaveLength(3);
  });
});

describe("content vectors: the pool of a route", () => {
  const ids = (title: string) => caseOf("poolFor", title).output.map((ref: { $card: string }) => ref.$card);

  it("returns the cards of the chosen section in deck order, or all of them for the whole deck", () => {
    expect(ids("only the cards of the chosen section, in deck order")).toEqual(["aws-clf-001", "aws-clf-003"]);
    expect(ids("the other section")).toEqual(["aws-clf-002"]);
    expect(ids("every card for the whole deck")).toEqual(["aws-clf-001", "aws-clf-002", "aws-clf-003"]);
    expect(ids("an empty array for a section the deck does not have")).toEqual([]);
    expect(ids("the cards of a deck without sections are the whole deck")).toEqual(["gcp-cdl-001", "gcp-cdl-002"]);
    expect(ids("a deck without sections has no section")).toEqual([]);
    expect(ids("a section id is compared exactly")).toEqual([]);
  });

  it("writes the deck's cards as references with the full cards in the table", () => {
    const { input } = caseOf("poolFor", "every card for the whole deck");
    expect(input.deck.cards).toEqual([{ $card: "aws-clf-001" }, { $card: "aws-clf-002" }, { $card: "aws-clf-003" }]);
    expect(Object.keys(vectorsOf("poolFor").cards)).toEqual(["aws-clf-001", "aws-clf-002", "aws-clf-003", "gcp-cdl-001", "gcp-cdl-002"]);
  });
});

describe("content vectors: card text", () => {
  const parts = (title: string) => caseOf("textParts", title).output;

  it("splits a text into plain and code parts", () => {
    expect(parts("one plain part for a text without backticks")).toEqual([{ text: "AWS patches the host.", code: false }]);
    expect(parts("each pair of backticks is a code part, without the backticks")).toEqual([
      { text: "An ", code: false },
      { text: "asserts x is string", code: true },
      { text: " function narrows ", code: false },
      { text: "x", code: true },
      { text: " after a call.", code: false },
    ]);
    expect(parts("no empty plain part around a fragment at the start or the end")).toEqual([
      { text: "docker run", code: true },
      { text: " starts ", code: false },
      { text: "nginx", code: true },
    ]);
    expect(parts("no empty plain part between two fragments")).toEqual([
      { text: "a", code: true },
      { text: "b", code: true },
    ]);
    expect(parts("a backtick without a partner is a code part of its own")).toEqual([
      { text: "one ", code: false },
      { text: "`", code: true },
      { text: " two", code: false },
    ]);
    expect(parts("an empty pair is two code parts of their own")).toEqual([
      { text: "a ", code: false },
      { text: "`", code: true },
      { text: "`", code: true },
      { text: " b", code: false },
    ]);
    expect(parts("empty for an empty text")).toEqual([]);
  });

  it("shows a text as it is read: code without its backticks", () => {
    expect(caseOf("plainText", "a code fragment with a quote and a bracket").output).toBe('Before narrowing, x.indexOf("a") is accepted on x: string | string[].');
    expect(caseOf("plainText", "a backtick without a partner is a code part of its own").output).toBe("one ` two");
    expect(caseOf("plainText", "one plain part for a text without backticks").output).toBe("AWS patches the host.");
  });

  it("runs plainText on the same texts as textParts", () => {
    expect(vectorsOf("plainText").cases.map((c) => c.input.text)).toEqual(vectorsOf("textParts").cases.map((c) => c.input.text));
  });
});

describe("content vectors: the class table", () => {
  it("lists the four classes in the order of the class step, with their exact copy", () => {
    expect(vectorsOf("MODE_TABLE").cases[0]!.output.map((row: any) => [row.id, row.name, row.description, row.unit, row.offered])).toEqual([
      ["classic", "Classic", "Correct answers out of 10 cards.", "of 10", true],
      ["streak", "Streak", "Correct answers in a row, until the first wrong one.", "in a row", true],
      ["lives", "Three lives", "Cards answered until the third wrong one.", "cards", true],
      ["timed", "Timed", "Correct answers in one minute, wrong ones cost nothing.", "correct", true],
    ]);
  });

  it("gives the row of a mode and throws for a mode it does not know", () => {
    expect(caseOf("modeInfo", "the row of lives").output.name).toBe("Three lives");
    expect(caseOf("modeInfo", "throws for a class the table does not know").output).toEqual({ $throws: 'Unknown mode "blitz".' });
  });

  it("offers all four classes, and not Timed once a case closes it", () => {
    for (const mode of ["classic", "streak", "lives", "timed"]) expect(caseOf("isOffered", `${mode} is offered`).output).toBe(true);
    expect(caseOf("isOffered", "with Timed closed, timed is not offered").output).toBe(false);
    expect(caseOf("isOffered", "with Timed closed, streak is offered").output).toBe(true);
    const { input } = caseOf("isOffered", "with Timed closed, timed is not offered");
    expect(input.modeTable.map((row: any) => [row.id, row.offered])).toEqual([
      ["classic", true],
      ["streak", true],
      ["lives", true],
      ["timed", false],
    ]);
  });

  it("closes a class only while the case runs, even when the case throws", () => {
    expect(() =>
      withClosedClasses(["streak"], () => {
        throw new Error("inside");
      }),
    ).toThrow("inside");
    expect(MODE_TABLE.every((row) => row.offered)).toBe(true);
  });

  it("words the last score the way each class counts", () => {
    const text = (title: string) => caseOf("lastScoreText", title).output;
    expect(text("Classic says the score out of the round's total")).toBe("7 of 10");
    expect(text("Classic uses the total of the round, not the ten of the class card (5 of 7)")).toBe("5 of 7");
    expect(text("Classic with no correct answer (0 of 12)")).toBe("0 of 12");
    expect(text("Streak counts in a row")).toBe("13 in a row");
    expect(text("Streak says 1 in a row, with no plural")).toBe("1 in a row");
    expect(text("Streak ignores the total")).toBe("5 in a row");
    expect(text("Three lives counts cards")).toBe("21 cards");
    expect(text("Timed counts correct answers")).toBe("14 correct");
    expect(text("Timed with nothing answered")).toBe("0 correct");
  });
});
