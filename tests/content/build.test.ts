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
