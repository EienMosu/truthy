import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DeckBuildError, buildDecks, hashDeck, type BuildOutput } from "@/src/content/build";
import { DeckFileSchema, DeckIndexSchema, WHOLE_DECK, type Card } from "@/src/content/schema";

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
      ["frontend", "Frontend", [["nextjs", "Next.js", ["nextjs-rendering"]]]],
      ["devops", "DevOps", []],
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
