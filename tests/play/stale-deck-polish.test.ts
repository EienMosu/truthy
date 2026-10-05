// Review finding U62: the index names a new section, the deck with that section does not load, and the copy
// on the device is an older deck without it. The route is not gone (the deck did not load), so the round
// fails with the load message and Try again instead of sending the player home without a word.
import { describe, expect, it } from "vitest";
import { prepareRound } from "@/components/play/useRound";
import { LoadError, createDeckCache } from "@/src/content/load";
import type { DeckIndex } from "@/src/content/schema";
import { DECK, DECK_ID, INDEX, fakeNetwork, harness, memoryStorage, pendingFor } from "../components/play/fixtures";

// The index after a deploy: the deck has a new hash and a section NEW.
const NEWER: DeckIndex = structuredClone(INDEX);
const entry = NEWER.areas[0]?.platforms[0]?.decks[0];
if (!entry) throw new Error("no deck in the index");
entry.hash = "hash-2";
entry.sections.push({ id: "NEW", title: "New section", cardCount: 1 });

const base = DECK.cards[0];
if (!base) throw new Error("no card in the deck");
const NEW_CARD = { ...structuredClone(base), id: `${DECK_ID}-new-01`, section: "NEW" };

/**
 * Services whose device holds the older deck (hash-1, no NEW cards), with the newer index on the network and
 * the given deck file, or none (its request fails).
 */
function deviceWithTheOlderDeck(deckFile?: unknown) {
  const local = memoryStorage();
  createDeckCache(local).write(DECK);
  const setup = harness(pendingFor("classic", "NEW"), local);
  const files = deckFile === undefined ? { "/decks/index.json": NEWER } : { "/decks/index.json": NEWER, [`/decks/${DECK_ID}.json`]: deckFile };
  setup.services.fetcher = fakeNetwork(files).fetcher;
  return setup.services;
}

describe("a new section whose deck does not load", () => {
  it("fails to load instead of meaning the route is gone", async () => {
    // The deck file is not served: the fetch fails and loadDeck falls back to the older copy.
    const services = deviceWithTheOlderDeck();
    await expect(prepareRound(pendingFor("classic", "NEW"), services)).rejects.toBeInstanceOf(LoadError);
  });

  it("deals the new section once the newer deck loads", async () => {
    const services = deviceWithTheOlderDeck({ ...DECK, hash: "hash-2", cards: [...DECK.cards, NEW_CARD] });
    const prepared = await prepareRound(pendingFor("classic", "NEW"), services);
    expect(prepared?.round.cards.map((card) => card.id)).toEqual([NEW_CARD.id]);
  });

  it("still means the route is gone when the current deck has no cards for it", async () => {
    // The index names NEW, but the deck of that very hash has no NEW cards: there is nothing to retry.
    const services = deviceWithTheOlderDeck({ ...DECK, hash: "hash-2" });
    await expect(prepareRound(pendingFor("classic", "NEW"), services)).resolves.toBeNull();
  });
});
