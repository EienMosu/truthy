import { describe, expect, it } from "vitest";
import { DeckBuildError, buildDecks } from "@/src/content/build";

function reviewedCard(id: string) {
  return {
    id,
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
  };
}

function deckEntry(id: string) {
  return { id, code: id.slice(0, 3).toUpperCase(), title: `Deck ${id}`, sections: [] };
}

function build(ids: readonly string[]) {
  return buildDecks({
    catalog: { areas: [{ id: "cloud", title: "Cloud", platforms: [{ id: "aws", title: "AWS", decks: ids.map(deckEntry) }] }] },
    reviewed: Object.fromEntries(ids.map((id) => [id, { deck: id, block: "reviewed", cards: [reviewedCard(`${id}-1`)] }])),
    version: "2026-10-01",
  });
}

function buildError(ids: readonly string[]): unknown {
  try {
    build(ids);
  } catch (error) {
    return error;
  }
  return undefined;
}

// A card's history belongs to the deck whose id, followed by "-", starts the card id (spec section 7, pruneDeck).
describe("buildDecks: a deck id that starts another deck id", () => {
  it.each([
    [["aws", "aws-clf"]],
    [["aws-clf", "aws"]],
    [["nextjs-rendering", "nextjs"]],
  ])("is refused for %j, naming both decks", (ids) => {
    const error = buildError(ids);
    expect(error).toBeInstanceOf(DeckBuildError);
    const [short, long] = [...ids].sort((a, b) => a.length - b.length);
    expect((error as Error).message).toBe(`catalog: deck id ${short} is a prefix of deck ${long}`);
  });

  it("allows deck ids that only share their first letters", () => {
    expect(build(["git-fundamentals", "github-actions", "aws-clf-c02", "aws-clf-c02x"]).decks).toHaveLength(4);
  });
});
