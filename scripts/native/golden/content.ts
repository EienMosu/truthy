// Golden vectors for the content helpers (src/content/schema.ts, load.ts, text.ts) and the class table
// (src/app-state/modes.ts). Outputs are computed by calling the TypeScript functions.
//
// Two projections keep the files small and the natives free of web object graphs: findRoute's answer is
// written as the ids of what it found (the area, the platform, the deck and the section, null for the whole
// deck), and a class table that a case closes a class in travels in the case's input as `modeTable`.
import { MODE_TABLE, isOffered, lastScoreText, modeInfo, type ModeInfo } from "@/src/app-state/modes";
import type { Mode } from "@/src/content/play";
import { poolFor } from "@/src/content/load";
import { WHOLE_DECK, deckPassName, findRoute, routeKey, type Card, type DeckFile, type Route } from "@/src/content/schema";
import { plainText, textParts } from "@/src/content/text";
import { CATALOG_INDEX } from "./catalog-fixture";
import { goldenFile, type GoldenCase, type GoldenFile } from "./format";

// The tests of each web file, as the registry (task 4) splits the content row of reference 3.9.
const CONTENT_TESTS = {
  schema: ["tests/content/schema.test.ts", "tests/content/schema-polish.test.ts"],
  load: ["tests/content/load.test.ts"],
  text: ["tests/content/text.test.ts"],
} as const;
const MODES_TESTS = ["tests/app-state/modes.test.ts", "tests/app-state/modes-polish.test.ts", "tests/app-state/modes-score-copy-polish.test.ts"] as const;

function contentFile(module: "schema" | "load" | "text", name: string, cases: readonly GoldenCase[]): GoldenFile {
  return goldenFile({ module: `src/content/${module}`, function: name, source: `src/content/${module}.ts`, tests: CONTENT_TESTS[module] }, cases);
}

function modesFile(name: string, cases: readonly GoldenCase[]): GoldenFile {
  return goldenFile({ module: "src/app-state/modes", function: name, source: "src/app-state/modes.ts", tests: MODES_TESTS }, cases);
}

/** The answer of a function that may throw: its value, or {"$throws": message}. */
function attempt<T>(run: () => T): T | { $throws: string } {
  try {
    return run();
  } catch (error) {
    return { $throws: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Runs `run` with these classes closed in the class table (offered: false), then opens them again. The real
 * table offers all four, so this is how a vector reaches the gate between a closed class and the player
 * (tests/components/start/unoffered.test.tsx mocks the table the same way). The table as it stood goes into
 * the case's input as `modeTable`.
 */
export function withClosedClasses<T>(closed: readonly Mode[], run: (table: readonly ModeInfo[]) => T): T {
  const rows = MODE_TABLE.filter((row) => closed.includes(row.id));
  const before = rows.map((row) => row.offered);
  for (const row of rows) row.offered = false;
  try {
    return run(MODE_TABLE.map((row) => ({ ...row })));
  } finally {
    rows.forEach((row, i) => {
      row.offered = before[i] ?? true;
    });
  }
}

// ---------- routes and names ----------

function wholeDeckFile(): GoldenFile {
  return contentFile("schema", "WHOLE_DECK", [{ name: "the section id that means the whole deck", input: null, output: WHOLE_DECK }]);
}

function routeKeyFile(): GoldenFile {
  const call = (name: string, route: Route): GoldenCase => ({ name, input: { route }, output: routeKey(route) });
  return contentFile("schema", "routeKey", [
    call("joins the deck id and the section id with a slash", { deckId: "aws-clf-c02", sectionId: "SEC" }),
    call("uses ALL for the whole deck", { deckId: "nextjs-rendering", sectionId: WHOLE_DECK }),
  ]);
}

function deckPassNameFile(): GoldenFile {
  const call = (name: string, platform: { title: string }, deck: { title: string; passName?: string }): GoldenCase => ({
    name,
    input: { platform, deck },
    output: deckPassName(platform, deck),
  });
  return contentFile("schema", "deckPassName", [
    call("joins the platform and the deck title when the deck has no pass name", { title: "AWS" }, { title: "Cloud Practitioner" }),
    call("uses the deck's pass name when it has one", { title: "Google Cloud" }, { title: "Cloud Digital Leader", passName: "Google Cloud Digital Leader" }),
    call("Next.js Rendering", { title: "Next.js" }, { title: "Rendering" }),
    call("a pass name wins over the platform even when it does not contain it", { title: "AWS" }, { title: "Fundamentals", passName: "Cloud Fundamentals" }),
  ]);
}

function findRouteFile(): GoldenFile {
  const call = (name: string, route: Route): GoldenCase => {
    const found = findRoute(CATALOG_INDEX, route);
    return {
      name,
      input: { index: CATALOG_INDEX, route },
      output: found === null ? null : { areaId: found.area.id, platformId: found.platform.id, deckId: found.deck.id, sectionId: found.section?.id ?? null },
    };
  };
  return contentFile("schema", "findRoute", [
    call("finds a section route", { deckId: "aws-clf-c02", sectionId: "SEC" }),
    call("finds the other section of the deck", { deckId: "aws-clf-c02", sectionId: "CON" }),
    call("finds a whole-deck route of a deck without sections", { deckId: "gcp-cdl", sectionId: "ALL" }),
    call("finds a whole-deck route of a deck with sections", { deckId: "aws-clf-c02", sectionId: "ALL" }),
    call("finds a section of another area", { deckId: "nextjs-rendering", sectionId: "RSC" }),
    call("finds nothing when the deck is gone", { deckId: "aws-saa-c03", sectionId: "ALL" }),
    call("finds nothing when the section is gone", { deckId: "aws-clf-c02", sectionId: "OLD" }),
    call("finds nothing for a section of a deck that has none", { deckId: "gcp-cdl", sectionId: "SEC" }),
    call("finds nothing for an empty section id", { deckId: "aws-clf-c02", sectionId: "" }),
    call("a section id is not read case-insensitively", { deckId: "aws-clf-c02", sectionId: "sec" }),
  ]);
}

// ---------- the pool of a route ----------

function card(id: string, section: string): Card {
  return {
    id,
    section,
    text: { en: { statement: `Statement ${id}`, explanation: `Explanation ${id}` } },
    answer: true,
    source: { title: "Docs", url: "https://docs.aws.amazon.com/" },
    difficulty: 1,
    appliesTo: "",
    conflictGroups: [],
  };
}

function poolForFile(): GoldenFile {
  const call = (name: string, deck: DeckFile, sectionId: string): GoldenCase => ({ name, input: { deck, sectionId }, output: poolFor(deck, sectionId) });
  const sectioned: DeckFile = {
    id: "aws-clf",
    hash: "h1",
    cards: [card("aws-clf-001", "S01"), card("aws-clf-002", "S02"), card("aws-clf-003", "S01")],
  };
  const flat: DeckFile = { id: "gcp-cdl", hash: "h1", cards: [card("gcp-cdl-001", WHOLE_DECK), card("gcp-cdl-002", WHOLE_DECK)] };
  return contentFile("load", "poolFor", [
    call("only the cards of the chosen section, in deck order", sectioned, "S01"),
    call("the other section", sectioned, "S02"),
    call("every card for the whole deck", sectioned, WHOLE_DECK),
    call("an empty array for a section the deck does not have", sectioned, "S99"),
    call("the cards of a deck without sections are the whole deck", flat, WHOLE_DECK),
    call("a deck without sections has no section", flat, "S01"),
    call("a section id is compared exactly", sectioned, "s01"),
  ]);
}

// ---------- card text ----------

const TEXTS: readonly { name: string; text: string }[] = [
  { name: "one plain part for a text without backticks", text: "AWS patches the host." },
  { name: "each pair of backticks is a code part, without the backticks", text: "An `asserts x is string` function narrows `x` after a call." },
  { name: "no empty plain part around a fragment at the start or the end", text: "`docker run` starts `nginx`" },
  { name: "no empty plain part between two fragments", text: "`a``b`" },
  { name: "a backtick without a partner is a code part of its own", text: "one ` two" },
  { name: "an empty pair is two code parts of their own", text: "a `` b" },
  { name: "empty for an empty text", text: "" },
  { name: "a code fragment with a quote and a bracket", text: 'Before narrowing, `x.indexOf("a")` is accepted on `x: string | string[]`.' },
  { name: "a text that is one backtick", text: "`" },
  { name: "three backticks in a row", text: "a ``` b" },
  { name: "four backticks in a row", text: "a ```` b" },
  { name: "an odd number of backticks leaves the last one alone", text: "`a` and `b` and `" },
  { name: "a fragment that spans a line break", text: "`line one\nline two` after" },
  { name: "a fragment of spaces", text: "x ` ` y" },
  { name: "text with accents and emoji around a fragment", text: "Käse `ß` 😀 ende" },
];

function textPartsFile(): GoldenFile {
  return contentFile(
    "text",
    "textParts",
    TEXTS.map(({ name, text }) => ({ name, input: { text }, output: textParts(text) })),
  );
}

function plainTextFile(): GoldenFile {
  return contentFile(
    "text",
    "plainText",
    TEXTS.map(({ name, text }) => ({ name, input: { text }, output: plainText(text) })),
  );
}

// ---------- the class table ----------

const MODE_IDS: readonly Mode[] = ["classic", "streak", "lives", "timed"];

function modeTableFile(): GoldenFile {
  return modesFile("MODE_TABLE", [{ name: "the four classes in the order of the class step, with their exact copy", input: null, output: MODE_TABLE }]);
}

function modeInfoFile(): GoldenFile {
  const cases: GoldenCase[] = MODE_IDS.map((mode) => ({ name: `the row of ${mode}`, input: { mode }, output: modeInfo(mode) }));
  cases.push({ name: "throws for a class the table does not know", input: { mode: "blitz" }, output: attempt(() => modeInfo("blitz" as Mode)) });
  cases.push({ name: "throws for an empty class", input: { mode: "" }, output: attempt(() => modeInfo("" as Mode)) });
  return modesFile("modeInfo", cases);
}

function isOfferedFile(): GoldenFile {
  const cases: GoldenCase[] = MODE_IDS.map((mode) => ({ name: `${mode} is offered`, input: { mode }, output: isOffered(mode) }));
  cases.push({ name: "throws for a class the table does not know", input: { mode: "blitz" }, output: attempt(() => isOffered("blitz" as Mode)) });
  for (const mode of MODE_IDS) {
    cases.push(withClosedClasses(["timed"], (modeTable) => ({ name: `with Timed closed, ${mode} is ${mode === "timed" ? "not offered" : "offered"}`, input: { mode, modeTable }, output: isOffered(mode) })));
  }
  return modesFile("isOffered", cases);
}

function lastScoreTextFile(): GoldenFile {
  const call = (name: string, mode: Mode, score: number, total: number): GoldenCase => ({ name, input: { mode, score, total }, output: lastScoreText(mode, score, total) });
  return modesFile("lastScoreText", [
    call("Classic says the score out of the round's total", "classic", 7, 10),
    call("Classic uses the total of the round, not the ten of the class card (5 of 7)", "classic", 5, 7),
    call("Classic with no correct answer (0 of 12)", "classic", 0, 12),
    call("Streak counts in a row", "streak", 13, 14),
    call("Streak says 1 in a row, with no plural", "streak", 1, 2),
    call("Streak ignores the total", "streak", 5, 7),
    call("Three lives counts cards", "lives", 21, 21),
    call("Timed counts correct answers", "timed", 14, 17),
    call("Timed with nothing answered", "timed", 0, 0),
    call("Classic with nothing answered", "classic", 0, 0),
  ]);
}

export function golden(): GoldenFile[] {
  return [
    wholeDeckFile(),
    routeKeyFile(),
    deckPassNameFile(),
    findRouteFile(),
    poolForFile(),
    textPartsFile(),
    plainTextFile(),
    modeTableFile(),
    modeInfoFile(),
    isOfferedFile(),
    lastScoreTextFile(),
  ];
}
