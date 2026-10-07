// Deck files for the tests that put a copy of a deck on the device (truthy.deck.<id>), as a round leaves it.
import type { DeckFile } from "@/src/content/schema";

/** A valid deck file of one card. */
export function oneCardDeck(id: string, hash: string): DeckFile {
  return {
    id,
    hash,
    cards: [
      {
        id: `${id}-1`,
        section: "SEC",
        text: { en: { statement: "A statement", explanation: "An explanation" } },
        answer: true,
        source: { title: "Docs", url: "https://docs.aws.amazon.com/" },
        difficulty: 1,
        appliesTo: "",
        conflictGroups: [],
      },
    ],
  };
}
