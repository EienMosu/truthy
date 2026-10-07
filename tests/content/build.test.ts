import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DeckBuildError, buildDecks, hashDeck, type BuildOutput } from "@/src/content/build";
import { DeckFileSchema, DeckIndexSchema, WHOLE_DECK, deckPassName, type Card } from "@/src/content/schema";

function shippedCard(id: string, statement: string): Card {
  return {
    id,
    section: "SEC",
    text: { en: { statement, explanation: "Because." } },
    answer: true,
    source: { title: "Docs", url: "https://docs.aws.amazon.com/" },
    difficulty: 1,
    appliesTo: "",
    conflictGroups: [],
  };
}

describe("hashDeck", () => {
  const cards = [shippedCard("d-1", "One."), shippedCard("d-2", "Two.")];

  it("is the first 16 hex characters of a sha256", () => {
    expect(hashDeck(cards)).toMatch(/^[0-9a-f]{16}$/);
  });

  it("gives the same hash for the same cards", () => {
    const copy = structuredClone(cards);
    expect(hashDeck(copy)).toBe(hashDeck(cards));
  });

  it("changes when a statement changes", () => {
    const edited = [shippedCard("d-1", "One, edited."), shippedCard("d-2", "Two.")];
    expect(hashDeck(edited)).not.toBe(hashDeck(cards));
  });

  it("changes when a card is removed", () => {
    expect(hashDeck(cards.slice(0, 1))).not.toBe(hashDeck(cards));
  });

  // A changed hash is the only thing that makes a client fetch a deck again (spec section 5): a hash that ignored a
  // field would keep a corrected answer, source or explanation out of every player's cache. One field at a time.
  it.each<[string, (card: Card) => Card]>([
    ["id", (card) => ({ ...card, id: "d-2b" })],
    ["section", (card) => ({ ...card, section: "OTH" })],
    ["statement", (card) => ({ ...card, text: { en: { ...card.text.en, statement: "Two, edited." } } })],
    ["explanation", (card) => ({ ...card, text: { en: { ...card.text.en, explanation: "Because, fixed." } } })],
    ["answer", (card) => ({ ...card, answer: !card.answer })],
    ["source title", (card) => ({ ...card, source: { ...card.source, title: "Other docs" } })],
    ["source url", (card) => ({ ...card, source: { ...card.source, url: "https://aws.amazon.com/" } })],
    ["difficulty", (card) => ({ ...card, difficulty: 3 })],
    ["appliesTo", (card) => ({ ...card, appliesTo: "all regions" })],
    ["conflictGroups", (card) => ({ ...card, conflictGroups: ["topic"] })],
  ])("changes when only the %s of a card changes", (_field, edit) => {
    const first = cards[0];
    const second = cards[1];
    if (first === undefined || second === undefined) throw new Error("the fixture has two cards");
    expect(hashDeck([first, edit(second)])).not.toBe(hashDeck(cards));
  });

  it("hashes an empty list without throwing", () => {
    expect(hashDeck([])).toMatch(/^[0-9a-f]{16}$/);
  });
});

const VERSION = "2026-10-01";

function reviewedCard(id: string, mapping: { task?: string; section?: string }, overrides: Record<string, unknown> = {}) {
  return {
    id,
    ...mapping,
    statement: `Statement of ${id}.`,
    answer: true,
    explanation: `Explanation of ${id}.`,
    misconception: "",
    topic: "Topic",
    difficulty: 2,
    volatility: "stable",
    source: { title: "Docs", url: "https://docs.aws.amazon.com/" },
    revision: "original",
    conflictGroups: [],
    ...overrides,
  };
}

function reviewedDeck(deck: string, cards: object[]) {
  return { deck, block: "reviewed", cards };
}

const clfEntry = {
  id: "aws-clf-c02",
  code: "CLF",
  title: "Cloud Practitioner",
  sections: [
    { id: "CON", title: "Cloud concepts", match: ["1.1", "1.2"] },
    { id: "SEC", title: "Security and compliance", match: ["2.1"] },
  ],
};

function catalog(decks: object[]) {
  return {
    areas: [
      {
        id: "cloud",
        title: "Cloud",
        platforms: [
          { id: "aws", title: "AWS", decks },
          { id: "azure", title: "Azure", decks: [] },
        ],
      },
      { id: "devops", title: "DevOps", platforms: [] },
    ],
  };
}

function build(decks: object[], reviewed: Record<string, unknown>): BuildOutput {
  return buildDecks({ catalog: catalog(decks), reviewed, version: VERSION });
}

function firstDeck(output: BuildOutput) {
  const deck = output.index.areas[0]?.platforms[0]?.decks[0];
  if (!deck) throw new Error("the index has no deck");
  return deck;
}

function clfReviewed() {
  return reviewedDeck("aws-clf-c02", [
    reviewedCard("aws-clf-c02-t1.1-01", { task: "1.1" }),
    reviewedCard("aws-clf-c02-t1.2-01", { task: "1.2" }),
    reviewedCard("aws-clf-c02-t2.1-01", { task: "2.1" }),
  ]);
}

describe("buildDecks: sections and the shipped format", () => {
  it("puts each card in the section whose match list holds its task", () => {
    const output = build([clfEntry], { "aws-clf-c02": clfReviewed() });
    expect(output.decks[0]?.cards.map((card) => card.section)).toEqual(["CON", "CON", "SEC"]);
    expect(firstDeck(output).sections).toEqual([
      { id: "CON", title: "Cloud concepts", cardCount: 2 },
      { id: "SEC", title: "Security and compliance", cardCount: 1 },
    ]);
    expect(firstDeck(output).cardCount).toBe(3);
  });

  it("maps cards by their section field as well", () => {
    const entry = {
      id: "nextjs-rendering",
      code: "RND",
      title: "Rendering",
      sections: [
        { id: "RSC", title: "Server and client components", match: ["r1"] },
        { id: "REQ", title: "How a request renders", match: ["r2"] },
      ],
    };
    const reviewed = reviewedDeck("nextjs-rendering", [
      reviewedCard("nextjs-rendering-sr2-01", { section: "r2" }),
      reviewedCard("nextjs-rendering-sr1-01", { section: "r1" }),
    ]);
    const output = build([entry], { "nextjs-rendering": reviewed });
    expect(output.decks[0]?.cards.map((card) => card.section)).toEqual(["REQ", "RSC"]);
  });

  it("ships cards with text keyed by language and without pipeline-only fields", () => {
    const output = build([clfEntry], { "aws-clf-c02": clfReviewed() });
    expect(output.decks[0]?.cards[0]).toEqual({
      id: "aws-clf-c02-t1.1-01",
      section: "CON",
      text: { en: { statement: "Statement of aws-clf-c02-t1.1-01.", explanation: "Explanation of aws-clf-c02-t1.1-01." } },
      answer: true,
      source: { title: "Docs", url: "https://docs.aws.amazon.com/" },
      difficulty: 2,
      appliesTo: "",
      conflictGroups: [],
    });
  });

  it("keeps appliesTo when the reviewed card has one", () => {
    const reviewed = reviewedDeck("aws-clf-c02", [
      reviewedCard("aws-clf-c02-t1.1-01", { task: "1.1" }, { appliesTo: "Next.js 16 with cacheComponents: true" }),
    ]);
    const output = build([clfEntry], { "aws-clf-c02": reviewed });
    expect(output.decks[0]?.cards[0]?.appliesTo).toBe("Next.js 16 with cacheComponents: true");
  });

  it("puts the build version and the deck file hash in the index", () => {
    const output = build([clfEntry], { "aws-clf-c02": clfReviewed() });
    const file = output.decks[0];
    expect(file?.id).toBe("aws-clf-c02");
    expect(firstDeck(output).version).toBe(VERSION);
    expect(firstDeck(output).hash).toBe(file?.hash);
    expect(file?.hash).toBe(hashDeck(file?.cards ?? []));
  });

  it("keeps the hash when only the build date changes, so players do not refetch an unchanged deck", () => {
    const reviewed = { "aws-clf-c02": clfReviewed() };
    const monday = buildDecks({ catalog: catalog([clfEntry]), reviewed, version: "2026-10-05" });
    const tuesday = buildDecks({ catalog: catalog([clfEntry]), reviewed, version: "2026-10-06" });
    expect(firstDeck(tuesday).version).toBe("2026-10-06");
    expect(firstDeck(tuesday).hash).toBe(firstDeck(monday).hash);
  });

  it("allows the same section id in two different decks", () => {
    const saa = { id: "aws-saa-c03", code: "SAA", title: "Solutions Architect Associate", sections: [{ id: "SEC", title: "Secure architectures", match: ["1.1"] }] };
    const saaReviewed = reviewedDeck("aws-saa-c03", [reviewedCard("aws-saa-c03-t1.1-01", { task: "1.1" })]);
    const output = build([clfEntry, saa], { "aws-clf-c02": clfReviewed(), "aws-saa-c03": saaReviewed });
    const decks = output.index.areas[0]?.platforms[0]?.decks ?? [];
    expect(decks.map((deck) => [deck.id, deck.sections.map((section) => section.id)])).toEqual([
      ["aws-clf-c02", ["CON", "SEC"]],
      ["aws-saa-c03", ["SEC"]],
    ]);
  });

  it("plays a deck without sections as the whole deck", () => {
    const entry = { id: "gcp-cdl", code: "CDL", title: "Cloud Digital Leader", sections: [] };
    const reviewed = reviewedDeck("gcp-cdl", [
      reviewedCard("gcp-cdl-s1.1-01", { section: "1.1" }),
      reviewedCard("gcp-cdl-s9.9-01", {}),
    ]);
    const output = build([entry], { "gcp-cdl": reviewed });
    expect(output.decks[0]?.cards.map((card) => card.section)).toEqual([WHOLE_DECK, WHOLE_DECK]);
    expect(firstDeck(output).sections).toEqual([]);
    expect(firstDeck(output).cardCount).toBe(2);
  });

  it("carries a deck's pass name into the index, and leaves it out when the catalog has none", () => {
    const entry = { id: "gcp-cdl", code: "CDL", title: "Cloud Digital Leader", passName: "Google Cloud Digital Leader", sections: [] };
    const reviewed = reviewedDeck("gcp-cdl", [reviewedCard("gcp-cdl-s1.1-01", { section: "1.1" })]);
    expect(firstDeck(build([entry], { "gcp-cdl": reviewed })).passName).toBe("Google Cloud Digital Leader");
    expect(firstDeck(build([clfEntry], { "aws-clf-c02": clfReviewed() }))).not.toHaveProperty("passName");
  });

  it("produces output that the client schemas accept", () => {
    const output = build([clfEntry], { "aws-clf-c02": clfReviewed() });
    expect(DeckIndexSchema.safeParse(output.index).success).toBe(true);
    for (const deck of output.decks) expect(DeckFileSchema.safeParse(deck).success).toBe(true);
  });
});

describe("buildDecks: what is available", () => {
  it("leaves out a catalog deck that has no reviewed file but keeps its platform", () => {
    const saa = { id: "aws-saa-c03", code: "SAA", title: "Solutions Architect Associate", sections: [{ id: "SEC", title: "Secure architectures", match: ["1.1"] }] };
    const output = build([clfEntry, saa], { "aws-clf-c02": clfReviewed() });
    expect(output.index.areas[0]?.platforms[0]?.decks.map((deck) => deck.id)).toEqual(["aws-clf-c02"]);
    expect(output.decks.map((deck) => deck.id)).toEqual(["aws-clf-c02"]);
  });

  it("keeps platforms without decks and areas without platforms", () => {
    const output = build([], {});
    expect(output.index.areas.map((area) => area.id)).toEqual(["cloud", "devops"]);
    expect(output.index.areas[0]?.platforms.map((platform) => [platform.id, platform.decks.length])).toEqual([
      ["aws", 0],
      ["azure", 0],
    ]);
    expect(output.index.areas[1]?.platforms).toEqual([]);
    expect(output.decks).toEqual([]);
  });

  it("ignores a reviewed file whose deck is not in the catalog", () => {
    const stray = reviewedDeck("aws-dva-c02", [reviewedCard("aws-dva-c02-t1.1-01", { task: "1.1" })]);
    const output = build([clfEntry], { "aws-clf-c02": clfReviewed(), "aws-dva-c02": stray });
    expect(output.decks.map((deck) => deck.id)).toEqual(["aws-clf-c02"]);
  });
});

function expectBuildError(run: () => unknown, ...fragments: string[]) {
  let caught: unknown;
  try {
    run();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(DeckBuildError);
  const message = (caught as Error).message;
  for (const fragment of fragments) expect(message).toContain(fragment);
}

function clfWith(...cards: object[]) {
  return { "aws-clf-c02": reviewedDeck("aws-clf-c02", cards) };
}

describe("buildDecks: section mapping errors", () => {
  it("fails on a card that matches no section, naming the deck, the card and its task", () => {
    expectBuildError(
      () => build([clfEntry], clfWith(reviewedCard("aws-clf-c02-t3.1-01", { task: "3.1" }))),
      "aws-clf-c02: card aws-clf-c02-t3.1-01:",
      "3.1 matches no section",
    );
  });

  it("fails on a card that matches two sections", () => {
    const overlapping = {
      ...clfEntry,
      sections: [
        { id: "CON", title: "Cloud concepts", match: ["1.1"] },
        { id: "SEC", title: "Security and compliance", match: ["1.1", "2.1"] },
      ],
    };
    expectBuildError(
      () => build([overlapping], clfWith(reviewedCard("aws-clf-c02-t1.1-01", { task: "1.1" }))),
      "aws-clf-c02: card aws-clf-c02-t1.1-01:",
      "matches more than one section (CON, SEC)",
    );
  });

  it("fails on a card with neither a task nor a section when the deck has sections", () => {
    expectBuildError(
      () => build([clfEntry], clfWith(reviewedCard("aws-clf-c02-x-01", {}))),
      "card aws-clf-c02-x-01: has neither a task nor a section",
    );
  });

  it("fails on a reviewed file that is not a deck at all", () => {
    for (const corrupt of [null, "not json", [], { cards: "none" }]) {
      expectBuildError(() => build([clfEntry], { "aws-clf-c02": corrupt }), "aws-clf-c02:");
    }
  });
});

describe("buildDecks: card and catalog errors", () => {
  it("accepts a statement of exactly 120 characters and fails on 121", () => {
    const at = (length: number) => clfWith(reviewedCard("aws-clf-c02-t1.1-01", { task: "1.1" }, { statement: "x".repeat(length) }));
    expect(build([clfEntry], at(120)).decks[0]?.cards[0]?.text.en.statement).toHaveLength(120);
    expectBuildError(() => build([clfEntry], at(121)), "card aws-clf-c02-t1.1-01: statement is 121 characters, the limit is 120");
  });

  it("accepts an explanation of exactly 240 characters and fails on 241", () => {
    const at = (length: number) => clfWith(reviewedCard("aws-clf-c02-t1.1-01", { task: "1.1" }, { explanation: "x".repeat(length) }));
    expect(build([clfEntry], at(240)).decks[0]?.cards[0]?.text.en.explanation).toHaveLength(240);
    expectBuildError(() => build([clfEntry], at(241)), "card aws-clf-c02-t1.1-01: explanation is 241 characters, the limit is 240");
  });

  it("fails on an empty or blank statement", () => {
    for (const statement of ["", "   "]) {
      expectBuildError(
        () => build([clfEntry], clfWith(reviewedCard("aws-clf-c02-t1.1-01", { task: "1.1" }, { statement }))),
        "card aws-clf-c02-t1.1-01: statement is empty",
      );
    }
  });

  it("fails on a difficulty other than 1, 2 or 3", () => {
    for (const difficulty of [0, 4, 2.5]) {
      expectBuildError(
        () => build([clfEntry], clfWith(reviewedCard("aws-clf-c02-t1.1-01", { task: "1.1" }, { difficulty }))),
        `card aws-clf-c02-t1.1-01: difficulty must be 1, 2 or 3, not ${difficulty}`,
      );
    }
  });

  it("fails on a source link that is not https and names the card", () => {
    const card = reviewedCard("aws-clf-c02-t1.1-01", { task: "1.1" }, { source: { title: "Docs", url: "http://docs.aws.amazon.com/" } });
    expectBuildError(() => build([clfEntry], clfWith(card)), "aws-clf-c02: card aws-clf-c02-t1.1-01: source.url");
  });

  it("names a card by its position when it has no id", () => {
    const { id: _omitted, ...withoutId } = reviewedCard("aws-clf-c02-t1.1-01", { task: "1.1" });
    expectBuildError(() => build([clfEntry], clfWith(reviewedCard("aws-clf-c02-t1.1-02", { task: "1.1" }), withoutId)), "aws-clf-c02: card #2: id");
  });

  it("fails on a reviewed file with no cards", () => {
    expectBuildError(() => build([clfEntry], clfWith()), "aws-clf-c02: cards");
  });

  it("fails when the reviewed file is for another deck", () => {
    const reviewed = reviewedDeck("aws-saa-c03", [reviewedCard("aws-clf-c02-t1.1-01", { task: "1.1" })]);
    expectBuildError(() => build([clfEntry], { "aws-clf-c02": reviewed }), "aws-clf-c02: the reviewed file is for deck aws-saa-c03");
  });

  it("fails on a card id used twice in one deck", () => {
    const card = reviewedCard("aws-clf-c02-t1.1-01", { task: "1.1" });
    expectBuildError(() => build([clfEntry], clfWith(card, card)), "card aws-clf-c02-t1.1-01: the card id is used twice");
  });

  it("fails on a card id that does not start with the deck id", () => {
    expectBuildError(
      () => build([clfEntry], clfWith(reviewedCard("clf-t1.1-01", { task: "1.1" }))),
      "card clf-t1.1-01: the card id must start with aws-clf-c02-",
    );
  });

  it("fails on a catalog that does not match the schema", () => {
    expectBuildError(() => buildDecks({ catalog: { areas: "none" }, reviewed: {}, version: VERSION }), "catalog: areas");
    expectBuildError(() => buildDecks({ catalog: null, reviewed: {}, version: VERSION }), "catalog:");
  });

  it("fails on a deck listed twice in the catalog", () => {
    expectBuildError(() => build([clfEntry, clfEntry], { "aws-clf-c02": clfReviewed() }), "catalog: deck aws-clf-c02 is listed twice");
  });

  it("fails on an area or a platform listed twice", () => {
    const area = { id: "cloud", title: "Cloud", platforms: [] };
    expectBuildError(() => buildDecks({ catalog: { areas: [area, area] }, reviewed: {}, version: VERSION }), "catalog: area cloud is listed twice");
    const platform = { id: "aws", title: "AWS", decks: [] };
    const twice = { areas: [{ id: "cloud", title: "Cloud", platforms: [platform, platform] }] };
    expectBuildError(() => buildDecks({ catalog: twice, reviewed: {}, version: VERSION }), "catalog: area cloud: platform aws is listed twice");
  });

  it("fails on a section id used twice in one deck", () => {
    const twice = { ...clfEntry, sections: [clfEntry.sections[0], clfEntry.sections[0]] };
    expectBuildError(() => build([twice], { "aws-clf-c02": clfReviewed() }), "catalog: deck aws-clf-c02: section CON is listed twice");
  });

  it("fails on a section whose id is the whole deck id", () => {
    const reserved = { ...clfEntry, sections: [{ id: WHOLE_DECK, title: "Everything", match: ["1.1"] }] };
    expectBuildError(() => build([reserved], { "aws-clf-c02": clfReviewed() }), `catalog: deck aws-clf-c02: section id ${WHOLE_DECK} is reserved for the whole deck`);
  });

  it("fails on a version that is not an ISO date", () => {
    expectBuildError(
      () => buildDecks({ catalog: catalog([clfEntry]), reviewed: { "aws-clf-c02": clfReviewed() }, version: "yesterday" }),
      "version must be an ISO date (YYYY-MM-DD), not yesterday",
    );
  });
});

describe("buildDecks: conflict groups and empty sections", () => {
  function groupsOf(output: BuildOutput) {
    return Object.fromEntries((output.decks[0]?.cards ?? []).map((card) => [card.id, card.conflictGroups]));
  }

  it("keeps a conflict group that two cards share", () => {
    const output = build(
      [clfEntry],
      clfWith(
        reviewedCard("aws-clf-c02-t1.1-01", { task: "1.1" }, { conflictGroups: ["shared-responsibility-split"] }),
        reviewedCard("aws-clf-c02-t2.1-01", { task: "2.1" }, { conflictGroups: ["shared-responsibility-split"] }),
      ),
    );
    expect(groupsOf(output)).toEqual({
      "aws-clf-c02-t1.1-01": ["shared-responsibility-split"],
      "aws-clf-c02-t2.1-01": ["shared-responsibility-split"],
    });
  });

  it("drops a conflict group that only one card uses", () => {
    const output = build(
      [clfEntry],
      clfWith(
        reviewedCard("aws-clf-c02-t1.1-01", { task: "1.1" }, { conflictGroups: ["lonely", "pair"] }),
        reviewedCard("aws-clf-c02-t2.1-01", { task: "2.1" }, { conflictGroups: ["pair"] }),
      ),
    );
    expect(groupsOf(output)).toEqual({ "aws-clf-c02-t1.1-01": ["pair"], "aws-clf-c02-t2.1-01": ["pair"] });
  });

  it("counts a group listed twice on one card as one use and lists it once", () => {
    const alone = build([clfEntry], clfWith(reviewedCard("aws-clf-c02-t1.1-01", { task: "1.1" }, { conflictGroups: ["echo", "echo"] })));
    expect(groupsOf(alone)).toEqual({ "aws-clf-c02-t1.1-01": [] });
    const shared = build(
      [clfEntry],
      clfWith(
        reviewedCard("aws-clf-c02-t1.1-01", { task: "1.1" }, { conflictGroups: ["echo", "echo"] }),
        reviewedCard("aws-clf-c02-t2.1-01", { task: "2.1" }, { conflictGroups: ["echo"] }),
      ),
    );
    expect(groupsOf(shared)).toEqual({ "aws-clf-c02-t1.1-01": ["echo"], "aws-clf-c02-t2.1-01": ["echo"] });
  });

  it("gives cards without a conflictGroups field an empty list", () => {
    const { conflictGroups: _omitted, ...withoutGroups } = reviewedCard("aws-clf-c02-t1.1-01", { task: "1.1" });
    expect(groupsOf(build([clfEntry], clfWith(withoutGroups)))).toEqual({ "aws-clf-c02-t1.1-01": [] });
  });

  it("hashes the cards after dropping single-use groups", () => {
    const output = build([clfEntry], clfWith(reviewedCard("aws-clf-c02-t1.1-01", { task: "1.1" }, { conflictGroups: ["lonely"] })));
    const deck = output.decks[0];
    expect(deck?.hash).toBe(hashDeck(deck?.cards ?? []));
  });

  it("leaves a section that no card falls into out of the index", () => {
    const withBilling = { ...clfEntry, sections: [...clfEntry.sections, { id: "BIL", title: "Billing, pricing and support", match: ["4.1"] }] };
    const output = build([withBilling], { "aws-clf-c02": clfReviewed() });
    expect(firstDeck(output).sections.map((section) => section.id)).toEqual(["CON", "SEC"]);
    expect(DeckIndexSchema.safeParse(output.index).success).toBe(true);
  });
});

describe("the real content", () => {
  function readContent(path: string): unknown {
    return JSON.parse(readFileSync(new URL(`../../content/${path}`, import.meta.url), "utf8"));
  }

  function buildReal(): BuildOutput {
    return buildDecks({
      catalog: readContent("catalog.json"),
      reviewed: {
        "aws-clf-c02": readContent("reviewed/aws-clf-c02.json"),
        "nextjs-rendering": readContent("reviewed/nextjs-rendering.json"),
      },
      version: VERSION,
    });
  }

  function indexDeck(output: BuildOutput, deckId: string) {
    const deck = output.index.areas.flatMap((area) => area.platforms.flatMap((platform) => platform.decks)).find((entry) => entry.id === deckId);
    if (!deck) throw new Error(`${deckId} is not in the index`);
    return deck;
  }

  it("builds Cloud Practitioner with 214 cards in four sections", () => {
    const deck = indexDeck(buildReal(), "aws-clf-c02");
    expect([deck.code, deck.title, deck.cardCount]).toEqual(["CLF", "Cloud Practitioner", 214]);
    expect(deck.sections.map((section) => [section.id, section.cardCount])).toEqual([
      ["CON", 45],
      ["SEC", 47],
      ["TEC", 88],
      ["BIL", 34],
    ]);
  });

  it("builds Next.js Rendering with 94 cards in eight sections", () => {
    const deck = indexDeck(buildReal(), "nextjs-rendering");
    expect([deck.code, deck.title, deck.cardCount]).toEqual(["RND", "Rendering", 94]);
    expect(deck.sections.map((section) => [section.id, section.cardCount])).toEqual([
      ["RSC", 12],
      ["REQ", 11],
      ["STR", 12],
      ["STA", 12],
      ["DAT", 11],
      ["CAC", 12],
      ["CCM", 12],
      ["REV", 12],
    ]);
  });

  it("keeps every area and platform of the catalog, with or without decks", () => {
    const output = buildReal();
    expect(output.index.areas.map((area) => [area.id, area.title, area.platforms.map((platform) => [platform.id, platform.title, platform.decks.map((deck) => deck.id)])])).toEqual([
      ["cloud", "Cloud", [["aws", "AWS", ["aws-clf-c02"]], ["gcp", "Google Cloud", []], ["azure", "Azure", []]]],
      [
        "frontend",
        "Frontend",
        [
          ["nextjs", "Next.js", ["nextjs-rendering"]],
          ["react", "React", []],
          ["javascript", "JavaScript", []],
          ["typescript", "TypeScript", []],
          ["web", "Web platform", []],
        ],
      ],
      [
        "devops",
        "DevOps",
        [
          ["docker", "Docker", []],
          ["kubernetes", "Kubernetes", []],
          ["terraform", "Terraform", []],
          ["git", "Git", []],
          ["github", "GitHub", []],
          ["linux", "Linux", []],
        ],
      ],
      [
        "backend",
        "Backend",
        [
          ["python", "Python", []],
          ["nodejs", "Node.js", []],
          ["sql", "SQL", []],
        ],
      ],
    ]);
  });

  it("writes deck files the client schema accepts, with a hash that matches the index", () => {
    const output = buildReal();
    expect(DeckIndexSchema.safeParse(output.index).success).toBe(true);
    for (const deck of output.decks) {
      expect(DeckFileSchema.safeParse(deck).success, deck.id).toBe(true);
      expect(indexDeck(output, deck.id).hash).toBe(hashDeck(deck.cards));
    }
  });

  it("ships only conflict groups that at least two cards share", () => {
    for (const deck of buildReal().decks) {
      const uses = new Map<string, number>();
      for (const card of deck.cards) for (const group of card.conflictGroups) uses.set(group, (uses.get(group) ?? 0) + 1);
      for (const [group, count] of uses) expect(count, `${deck.id} ${group}`).toBeGreaterThan(1);
    }
  });
});

// Spec section 3, step 1: Cloud Digital Leader ships with the first step. buildReal() above leaves its
// reviewed file out, so this pins the deck the deploy really builds.
describe("the real content: Cloud Digital Leader", () => {
  function readContent(path: string): unknown {
    return JSON.parse(readFileSync(new URL(`../../content/${path}`, import.meta.url), "utf8"));
  }

  it("builds Cloud Digital Leader as a whole deck of 133 cards next to the other two", () => {
    const output = buildDecks({
      catalog: readContent("catalog.json"),
      reviewed: {
        "aws-clf-c02": readContent("reviewed/aws-clf-c02.json"),
        "gcp-cdl": readContent("reviewed/gcp-cdl.json"),
        "nextjs-rendering": readContent("reviewed/nextjs-rendering.json"),
      },
      version: VERSION,
    });
    const gcp = output.index.areas.find((area) => area.id === "cloud")?.platforms.find((platform) => platform.id === "gcp");
    expect(gcp?.decks.map((deck) => [deck.id, deck.code, deck.title, deck.cardCount, deck.sections])).toEqual([
      ["gcp-cdl", "CDL", "Cloud Digital Leader", 133, []],
    ]);
    expect(gcp?.decks[0]?.passName).toBe("Google Cloud Digital Leader");
    const file = output.decks.find((deck) => deck.id === "gcp-cdl");
    expect(file?.cards).toHaveLength(133);
    expect(file?.cards.every((card) => card.section === WHOLE_DECK)).toBe(true);
    expect(output.decks.map((deck) => deck.id).sort()).toEqual(["aws-clf-c02", "gcp-cdl", "nextjs-rendering"]);
  });
});

// The AWS Solutions Architect Associate deck entered after step 1 shipped. This pins what the deploy builds:
// all four reviewed decks together, which the blocks above never build.
describe("the real content: Solutions Architect Associate", () => {
  function readContent(path: string): unknown {
    return JSON.parse(readFileSync(new URL(`../../content/${path}`, import.meta.url), "utf8"));
  }

  const output = buildDecks({
    catalog: readContent("catalog.json"),
    reviewed: {
      "aws-clf-c02": readContent("reviewed/aws-clf-c02.json"),
      "aws-saa-c03": readContent("reviewed/aws-saa-c03.json"),
      "gcp-cdl": readContent("reviewed/gcp-cdl.json"),
      "nextjs-rendering": readContent("reviewed/nextjs-rendering.json"),
    },
    version: VERSION,
  });
  const indexDecks = output.index.areas.flatMap((area) => area.platforms.flatMap((platform) => platform.decks));

  it("lists it under AWS, after Cloud Practitioner, with 154 cards in four sections", () => {
    const aws = output.index.areas.find((area) => area.id === "cloud")?.platforms.find((platform) => platform.id === "aws");
    expect(aws?.decks.map((deck) => [deck.id, deck.code, deck.title, deck.cardCount])).toEqual([
      ["aws-clf-c02", "CLF", "Cloud Practitioner", 214],
      ["aws-saa-c03", "SAA", "Solutions Architect Associate", 154],
    ]);
    const saa = aws?.decks.find((deck) => deck.id === "aws-saa-c03");
    expect(saa?.sections.map((section) => [section.id, section.title, section.cardCount])).toEqual([
      ["SEC", "Secure architectures", 33],
      ["RES", "Resilient architectures", 20],
      ["PRF", "High-performing architectures", 54],
      ["CST", "Cost-optimized architectures", 47],
    ]);
  });

  it("builds a deck file whose every card belongs to the deck and to one of its sections", () => {
    const file = output.decks.find((deck) => deck.id === "aws-saa-c03");
    expect(file?.cards).toHaveLength(154);
    expect(file?.cards.every((card) => card.id.startsWith("aws-saa-c03-"))).toBe(true);
    expect([...new Set(file?.cards.map((card) => card.section))].sort()).toEqual(["CST", "PRF", "RES", "SEC"]);
  });

  it("builds next to the other three decks", () => {
    expect(output.decks.map((deck) => deck.id).sort()).toEqual(["aws-clf-c02", "aws-saa-c03", "gcp-cdl", "nextjs-rendering"]);
  });

  it("writes four deck files the client schema accepts, each with the hash the index names", () => {
    expect(DeckIndexSchema.safeParse(output.index).success).toBe(true);
    for (const deck of output.decks) {
      expect(DeckFileSchema.safeParse(deck).success, deck.id).toBe(true);
      expect(indexDecks.find((entry) => entry.id === deck.id)?.hash, deck.id).toBe(hashDeck(deck.cards));
    }
  });

  it("ships only conflict groups that at least two cards of a deck share", () => {
    for (const deck of output.decks) {
      const uses = new Map<string, number>();
      for (const card of deck.cards) for (const group of card.conflictGroups) uses.set(group, (uses.get(group) ?? 0) + 1);
      for (const [group, count] of uses) expect(count, `${deck.id} ${group}`).toBeGreaterThan(1);
    }
  });
});

// Twenty decks entered after step 2 shipped: a third AWS deck, a second Google Cloud deck, two Azure decks,
// four Frontend platforms with two more Web platform decks, the DevOps platforms with a second Kubernetes deck, and
// the Backend area. This pins what the deploy builds from
// every reviewed file in the repository, which the blocks above never build all at once.
describe("the real content: the decks added after step 2", () => {
  function readContent(path: string): unknown {
    return JSON.parse(readFileSync(new URL(`../../content/${path}`, import.meta.url), "utf8"));
  }

  const OLD = ["aws-clf-c02", "aws-saa-c03", "gcp-cdl", "nextjs-rendering"];
  const NEW = [
    "aws-dva-c02",
    "gcp-ace",
    "azure-az-900",
    "react-fundamentals",
    "javascript-fundamentals",
    "typescript-fundamentals",
    "web-security",
    "web-accessibility",
    "web-performance",
    "docker-fundamentals",
    "kubernetes-kcna",
    "terraform-associate",
    "git-fundamentals",
    "github-actions",
    "linux-command-line",
    "azure-az-104",
    "kubernetes-ckad",
    "python-fundamentals",
    "nodejs-fundamentals",
    "sql-fundamentals",
  ];
  const output = buildDecks({
    catalog: readContent("catalog.json"),
    reviewed: Object.fromEntries([...OLD, ...NEW].map((id) => [id, readContent(`reviewed/${id}.json`)])),
    version: VERSION,
  });
  const placed = output.index.areas.flatMap((area) => area.platforms.flatMap((platform) => platform.decks.map((deck) => ({ platform, deck }))));

  it("lists every area and platform in the catalog's order, each with its decks", () => {
    expect(output.index.areas.map((area) => [area.id, area.title, area.platforms.map((platform) => [platform.id, platform.title, platform.decks.map((deck) => deck.id)])])).toEqual([
      [
        "cloud",
        "Cloud",
        [
          ["aws", "AWS", ["aws-clf-c02", "aws-saa-c03", "aws-dva-c02"]],
          ["gcp", "Google Cloud", ["gcp-cdl", "gcp-ace"]],
          ["azure", "Azure", ["azure-az-900", "azure-az-104"]],
        ],
      ],
      [
        "frontend",
        "Frontend",
        [
          ["nextjs", "Next.js", ["nextjs-rendering"]],
          ["react", "React", ["react-fundamentals"]],
          ["javascript", "JavaScript", ["javascript-fundamentals"]],
          ["typescript", "TypeScript", ["typescript-fundamentals"]],
          ["web", "Web platform", ["web-security", "web-accessibility", "web-performance"]],
        ],
      ],
      [
        "devops",
        "DevOps",
        [
          ["docker", "Docker", ["docker-fundamentals"]],
          ["kubernetes", "Kubernetes", ["kubernetes-kcna", "kubernetes-ckad"]],
          ["terraform", "Terraform", ["terraform-associate"]],
          ["git", "Git", ["git-fundamentals"]],
          ["github", "GitHub", ["github-actions"]],
          ["linux", "Linux", ["linux-command-line"]],
        ],
      ],
      [
        "backend",
        "Backend",
        [
          ["python", "Python", ["python-fundamentals"]],
          ["nodejs", "Node.js", ["nodejs-fundamentals"]],
          ["sql", "SQL", ["sql-fundamentals"]],
        ],
      ],
    ]);
  });

  // Each deck: code, title, the name on the pass and the ticket, card count, and its sections in order.
  const PINNED: [id: string, code: string, title: string, passName: string, cards: number, sections: [string, string, number][]][] = [
    [
      "aws-dva-c02",
      "DVA",
      "Developer Associate",
      "AWS Developer Associate",
      131,
      [
        ["DEV", "Development with AWS services", 29],
        ["SEC", "Security", 32],
        ["DEP", "Deployment", 41],
        ["TRB", "Troubleshooting and optimization", 29],
      ],
    ],
    [
      "gcp-ace",
      "ACE",
      "Associate Cloud Engineer",
      "Google Associate Cloud Engineer",
      113,
      [
        ["ENV", "Cloud solution environment", 20],
        ["PLN", "Planning and implementing", 38],
        ["OPS", "Operating the solution", 37],
        ["IAM", "Access and security", 18],
      ],
    ],
    [
      "azure-az-900",
      "AZ9",
      "Fundamentals",
      "Azure Fundamentals",
      99,
      [
        ["CON", "Cloud concepts", 27],
        ["ARC", "Architecture, compute and networking", 18],
        ["STO", "Storage", 9],
        ["IDN", "Identity, access and security", 9],
        ["GOV", "Cost and governance", 18],
        ["MGT", "Management and monitoring", 18],
      ],
    ],
    [
      "react-fundamentals",
      "RCT",
      "Fundamentals",
      "React Fundamentals",
      135,
      [
        ["CMP", "Components, props and lists", 31],
        ["STA", "Rendering and state", 29],
        ["HKS", "Context, refs and memoization", 30],
        ["EFF", "Effects and Strict Mode", 27],
        ["ACT", "Actions and Server Components", 18],
      ],
    ],
    [
      "javascript-fundamentals",
      "JSC",
      "Fundamentals",
      "JavaScript Fundamentals",
      134,
      [
        ["VAL", "Values and equality", 23],
        ["FNC", "Scope, closures and this", 23],
        ["CLS", "Classes and modules", 22],
        ["ASY", "Iteration and async", 33],
        ["ERR", "Errors and collections", 21],
        ["SYN", "Destructuring and operators", 12],
      ],
    ],
    [
      "typescript-fundamentals",
      "TSC",
      "Fundamentals",
      "TypeScript Fundamentals",
      113,
      [
        ["BAS", "Type system basics", 27],
        ["NAR", "Narrowing, unions and intersections", 20],
        ["GEN", "Generics", 10],
        ["TFT", "Types from types", 27],
        ["ENM", "Enums versus unions", 9],
        ["CFG", "Compiler options and modules", 20],
      ],
    ],
    [
      "web-security",
      "WEB",
      "Security",
      "Web Security",
      112,
      [
        ["TOP", "OWASP Top 10:2025", 28],
        ["ORG", "Origins and CORS", 18],
        ["CKS", "Cookies and CSRF", 18],
        ["XSS", "XSS and CSP", 19],
        ["FRM", "Framing, integrity and HTTPS", 29],
      ],
    ],
    [
      "web-accessibility",
      "ACC",
      "Accessibility",
      "Web Accessibility",
      121,
      [
        ["WCG", "WCAG 2.2", 20],
        ["SEM", "Semantics and names", 19],
        ["ARI", "WAI-ARIA", 19],
        ["KEY", "Keyboard and focus", 20],
        ["FRM", "Forms and images", 21],
        ["VIS", "Contrast, updates and motion", 22],
      ],
    ],
    [
      "web-performance",
      "CWV",
      "Performance",
      "Web Performance",
      122,
      [
        ["MET", "Metrics and measurement", 21],
        ["LCP", "Largest Contentful Paint", 21],
        ["RSP", "Layout shifts and responsiveness", 21],
        ["LDG", "Rendering and resource loading", 19],
        ["IMG", "Images and fonts", 19],
        ["CAC", "Caching and the bfcache", 21],
      ],
    ],
    [
      "docker-fundamentals",
      "DKR",
      "Fundamentals",
      "Docker Fundamentals",
      112,
      [
        ["CNT", "Containers and the Engine", 19],
        ["BLD", "Dockerfile and builds", 38],
        ["REG", "Images and registries", 9],
        ["STO", "Volumes and mounts", 18],
        ["NET", "Networking and Compose", 19],
        ["SEC", "Security basics", 9],
      ],
    ],
    [
      "kubernetes-kcna",
      "KCN",
      "Kubernetes and Cloud Native Associate",
      "Kubernetes and Cloud Native Associate",
      116,
      [
        ["KFN", "Kubernetes fundamentals", 36],
        ["ORC", "Container orchestration", 36],
        ["DLV", "Application delivery", 18],
        ["ARC", "Cloud native architecture", 26],
      ],
    ],
    [
      "terraform-associate",
      "TFA",
      "Associate",
      "Terraform Associate",
      144,
      [
        ["FUN", "IaC and Terraform fundamentals", 27],
        ["WFL", "Core workflow", 18],
        ["CFG", "Terraform configuration", 45],
        ["MOD", "Modules", 9],
        ["STA", "State and maintenance", 27],
        ["HCP", "HCP Terraform", 18],
      ],
    ],
    [
      "git-fundamentals",
      "GIT",
      "Fundamentals",
      "Git Fundamentals",
      122,
      [
        ["OBJ", "Objects, refs and the index", 31],
        ["BRM", "Branches and merging", 20],
        ["HIS", "Rewriting and undoing", 30],
        ["TLS", "Stash, worktrees and other tools", 21],
        ["REM", "Remotes and tags", 20],
      ],
    ],
    [
      "github-actions",
      "GHA",
      "Actions",
      "GitHub Actions",
      125,
      [
        ["WFL", "Authoring workflows", 27],
        ["RUN", "Consuming and troubleshooting", 27],
        ["ACT", "Building actions", 26],
        ["ENT", "Actions for the enterprise", 27],
        ["SEC", "Security and optimization", 18],
      ],
    ],
    [
      "linux-command-line",
      "LNX",
      "Command line",
      "Linux Command Line",
      119,
      [
        ["FIL", "Filesystem and links", 19],
        ["PRM", "Permissions and users", 19],
        ["PRC", "Processes and signals", 19],
        ["SHL", "Shell and redirection", 21],
        ["TOL", "Tools, ssh and packages", 31],
        ["SYS", "systemd and the journal", 10],
      ],
    ],
    [
      "azure-az-104",
      "104",
      "Administrator Associate",
      "Azure Administrator Associate",
      145,
      [
        ["IDN", "Identity and governance", 27],
        ["STO", "Storage", 29],
        ["CMP", "Compute resources", 40],
        ["NET", "Virtual networking", 29],
        ["MON", "Monitoring and backup", 20],
      ],
    ],
    [
      "kubernetes-ckad",
      "CKD",
      "Application Developer",
      "Kubernetes Application Developer",
      146,
      [
        ["DSN", "Design and build", 28],
        ["DEP", "Deployment", 27],
        ["OBS", "Observability and maintenance", 27],
        ["CFG", "Configuration and security", 37],
        ["NET", "Services and networking", 27],
      ],
    ],
    [
      "python-fundamentals",
      "PYT",
      "Fundamentals",
      "Python Fundamentals",
      151,
      [
        ["OBJ", "Objects and values", 21],
        ["COL", "Strings and collections", 23],
        ["FNC", "Scopes and functions", 22],
        ["FLO", "Iteration, errors and cleanup", 31],
        ["CLS", "Classes and modules", 32],
        ["TYP", "Types and matching", 22],
      ],
    ],
    [
      "nodejs-fundamentals",
      "NOD",
      "Fundamentals",
      "Node.js Fundamentals",
      137,
      [
        ["RUN", "Runtime and event loop", 29],
        ["MOD", "Modules and packages", 19],
        ["COR", "Core modules", 47],
        ["PRC", "Errors and processes", 22],
        ["DEV", "Tooling and releases", 20],
      ],
    ],
    [
      "sql-fundamentals",
      "SQL",
      "Fundamentals",
      "SQL Fundamentals",
      145,
      [
        ["QRY", "Queries and NULL logic", 20],
        ["JNS", "Joins and subqueries", 21],
        ["AGG", "Aggregates, CTEs and windows", 30],
        ["SCH", "Keys, constraints and types", 22],
        ["IDX", "Indexes and views", 21],
        ["TXN", "Transactions and writes", 31],
      ],
    ],
  ];

  it("pins every new deck", () => {
    expect(PINNED.map(([id]) => id)).toEqual(NEW);
  });

  it.each(PINNED)("builds %s as %s, %s, named %s on the pass, with %i cards in its sections", (id, code, title, passName, cards, sections) => {
    const found = placed.find((entry) => entry.deck.id === id);
    if (!found) throw new Error(`${id} is not in the index`);
    const { platform, deck } = found;
    expect([deck.code, deck.title, deckPassName(platform, deck), deck.cardCount]).toEqual([code, title, passName, cards]);
    expect(deck.sections.map((section) => [section.id, section.title, section.cardCount])).toEqual(sections);
    const file = output.decks.find((entry) => entry.id === id);
    expect(file?.cards).toHaveLength(cards);
    expect(file?.cards.every((card) => card.id.startsWith(`${id}-`))).toBe(true);
    expect([...new Set(file?.cards.map((card) => card.section))].sort()).toEqual(sections.map(([section]) => section).sort());
  });

  it("builds next to the four earlier decks", () => {
    expect(output.decks.map((deck) => deck.id).sort()).toEqual([...OLD, ...NEW].sort());
  });

  it("writes deck files the client schema accepts, each with the hash the index names", () => {
    expect(DeckIndexSchema.safeParse(output.index).success).toBe(true);
    for (const deck of output.decks) {
      expect(DeckFileSchema.safeParse(deck).success, deck.id).toBe(true);
      expect(placed.find((entry) => entry.deck.id === deck.id)?.deck.hash, deck.id).toBe(hashDeck(deck.cards));
    }
  });

  it("ships only conflict groups that at least two cards of a deck share", () => {
    for (const deck of output.decks) {
      const uses = new Map<string, number>();
      for (const card of deck.cards) for (const group of card.conflictGroups) uses.set(group, (uses.get(group) ?? 0) + 1);
      for (const [group, count] of uses) expect(count, `${deck.id} ${group}`).toBeGreaterThan(1);
    }
  });
});
