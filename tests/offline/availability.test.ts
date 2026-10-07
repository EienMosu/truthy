import { describe, expect, it } from "vitest";
import { availableDeckIds } from "@/src/offline/availability";
import { createDeckCache, deckCacheKey, type DeckCache } from "@/src/content/load";
import type { DeckFile } from "@/src/content/schema";
import { oneCardDeck } from "@/tests/support/decks";

/** Storage in memory holding these deck files under truthy.deck.<id>, plus any raw entries. */
function cacheWith(decks: readonly DeckFile[], raw: Record<string, string> = {}): DeckCache {
  const data = new Map<string, string>(Object.entries(raw));
  for (const deck of decks) data.set(deckCacheKey(deck.id), JSON.stringify(deck));
  return createDeckCache({ getItem: (key) => data.get(key) ?? null, setItem: (key, value) => void data.set(key, value) });
}

const IDS = ["aws-clf-c02", "aws-saa-c03", "gcp-cdl"] as const;

describe("availableDeckIds", () => {
  it("offers every deck online, without reading the cache", () => {
    let reads = 0;
    const cache: DeckCache = {
      read: () => {
        reads += 1;
        return null;
      },
      write: () => {},
    };
    expect([...availableDeckIds(IDS, true, cache)]).toEqual([...IDS]);
    expect(reads).toBe(0);
  });

  it("offers offline only the decks the device holds a copy of", () => {
    const cache = cacheWith([oneCardDeck("aws-clf-c02", "clf-1"), oneCardDeck("gcp-cdl", "cdl-1")]);
    const available = availableDeckIds(IDS, false, cache);
    expect(available.has("aws-clf-c02")).toBe(true);
    expect(available.has("gcp-cdl")).toBe(true);
    expect(available.has("aws-saa-c03")).toBe(false);
    expect(available.size).toBe(2);
  });

  it("counts a copy of any hash, the rule loadDeck follows when its fetch fails", () => {
    const cache = cacheWith([oneCardDeck("aws-clf-c02", "an-older-hash")]);
    expect(availableDeckIds(["aws-clf-c02"], false, cache).has("aws-clf-c02")).toBe(true);
  });

  it("does not count a copy that is not a valid deck file, or one stored for another deck", () => {
    const cache = cacheWith([], {
      [deckCacheKey("aws-clf-c02")]: "{not json",
      [deckCacheKey("gcp-cdl")]: JSON.stringify(oneCardDeck("aws-saa-c03", "saa-1")),
    });
    expect(availableDeckIds(IDS, false, cache).size).toBe(0);
  });

  it("offers nothing offline with no storage at all", () => {
    expect(availableDeckIds(IDS, false, createDeckCache(undefined)).size).toBe(0);
  });
});
