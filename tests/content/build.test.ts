import { describe, expect, it } from "vitest";
import { hashDeck } from "@/src/content/build";
import type { Card } from "@/src/content/schema";

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
