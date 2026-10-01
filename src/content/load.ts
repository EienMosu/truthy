// Loading the deck index and the deck files on the client, with a cache on the device
// (spec section 5, "Loading", and section 10, "Error handling").
// Network and storage come in as parameters, so everything here runs in tests without a browser.

import { DeckFileSchema, DeckIndexSchema, WHOLE_DECK, type Card, type DeckFile, type DeckIndex } from "./schema";

type ReadStorage = Pick<Storage, "getItem">;
type ReadWriteStorage = Pick<Storage, "getItem" | "setItem">;

// Reads and parses one JSON value from storage. Missing, unreadable or unparsable text gives undefined.
function readJson(storage: ReadStorage | undefined, key: string): unknown {
  if (!storage) return undefined;
  try {
    const text = storage.getItem(key);
    return text === null ? undefined : (JSON.parse(text) as unknown);
  } catch {
    return undefined;
  }
}

// Writes one JSON value. A full or blocked storage is not an error: the app works without the cache.
function writeJson(storage: ReadWriteStorage | undefined, key: string, value: unknown): void {
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded or storage disabled: keep playing without caching.
  }
}

export interface DeckCache {
  read(deckId: string): DeckFile | null;
  write(deck: DeckFile): void;
}

export function deckCacheKey(deckId: string): string {
  return `truthy.deck.${deckId}`;
}

// A cache of deck files in storage, one key per deck. Anything that is not a valid deck file reads as null.
export function createDeckCache(storage: ReadWriteStorage | undefined): DeckCache {
  return {
    read(deckId) {
      const parsed = DeckFileSchema.safeParse(readJson(storage, deckCacheKey(deckId)));
      return parsed.success ? parsed.data : null;
    },
    write(deck) {
      writeJson(storage, deckCacheKey(deck.id), deck);
    },
  };
}

// The cards a round on this route deals from. WHOLE_DECK gives every card; an unknown section gives none.
export function poolFor(deck: DeckFile, sectionId: string): Card[] {
  if (sectionId === WHOLE_DECK) return [...deck.cards];
  return deck.cards.filter((card) => card.section === sectionId);
}
