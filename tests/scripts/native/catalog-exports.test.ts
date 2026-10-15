import { describe, expect, it } from "vitest";
import { deckOfCard, withoutRemovedCards } from "@/components/start/useCatalog";
import { emptyProgress, type Progress } from "@/src/progress/progress";

// Two helpers of the start screen's catalog were private. Reference 3.9 lists them among the functions a native
// port mirrors, so the vectors call them and they are exported (nothing else about them changes).
describe("deckOfCard", () => {
  it("gives a card to the deck whose id and a dash are its longest prefix", () => {
    const decks = new Set(["gcp-cdl", "gcp-cdl-pro", "aws-clf-c02"]);
    expect(deckOfCard("gcp-cdl-pro-1", decks)).toBe("gcp-cdl-pro");
    expect(deckOfCard("gcp-cdl-7", decks)).toBe("gcp-cdl");
    expect(deckOfCard("aws-clf-c02x-1", decks)).toBeUndefined();
  });
});

describe("withoutRemovedCards", () => {
  const seen = { seen: 1, lastCorrect: true, lastSeenAt: 1 };
  const played: Progress = { ...emptyProgress(), cards: { "aws-clf-c02-1": seen, "aws-clf-c02-2": seen } };

  it("drops the history of removed cards and saves the pruned progress", () => {
    const saved: Progress[] = [];
    const store = { load: () => emptyProgress(), save: (progress: Progress) => void saved.push(progress) };
    const pruned = withoutRemovedCards(played, { "aws-clf-c02": ["aws-clf-c02-2"] }, store);
    expect(Object.keys(pruned.cards)).toEqual(["aws-clf-c02-2"]);
    expect(saved).toEqual([pruned]);
  });

  it("saves nothing when no card entry was dropped", () => {
    const saved: Progress[] = [];
    const store = { load: () => emptyProgress(), save: (progress: Progress) => void saved.push(progress) };
    withoutRemovedCards(played, { "aws-clf-c02": ["aws-clf-c02-1", "aws-clf-c02-2"] }, store);
    expect(saved).toEqual([]);
  });
});
