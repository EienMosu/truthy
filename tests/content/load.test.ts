import { describe, expect, it } from "vitest";
import { WHOLE_DECK, type Card, type DeckFile } from "@/src/content/schema";
import { createDeckCache, poolFor } from "@/src/content/load";

// A storage stand-in backed by a Map, with the same string-only contract as localStorage.
function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map<string, string>(Object.entries(initial));
  return {
    data,
    getItem: (key: string): string | null => data.get(key) ?? null,
    setItem: (key: string, value: string): void => {
      data.set(key, String(value));
    },
  };
}

function card(id: string, section: string): Card {
  return {
    id,
    section,
    text: { en: { statement: `Statement ${id}`, explanation: `Explanation ${id}` } },
    answer: true,
    source: { title: "Docs", url: "https://docs.aws.amazon.com/" },
    difficulty: 1,
    appliesTo: "",
    conflictGroups: [],
  };
}

function deckFile(id: string, hash: string, cards: Card[] = [card(`${id}-001`, "S01"), card(`${id}-002`, "S02")]): DeckFile {
  return { id, hash, cards };
}

describe("poolFor", () => {
  const deck = deckFile("aws-clf", "h1", [card("aws-clf-001", "S01"), card("aws-clf-002", "S02"), card("aws-clf-003", "S01")]);

  it("returns only the cards of the chosen section, in deck order", () => {
    expect(poolFor(deck, "S01").map((c) => c.id)).toEqual(["aws-clf-001", "aws-clf-003"]);
  });

  it("returns every card for the whole deck", () => {
    expect(poolFor(deck, WHOLE_DECK).map((c) => c.id)).toEqual(["aws-clf-001", "aws-clf-002", "aws-clf-003"]);
  });

  it("returns an empty array for a section the deck does not have", () => {
    expect(poolFor(deck, "S99")).toEqual([]);
  });

  it("returns a new array, so the caller cannot change the deck by changing the pool", () => {
    const pool = poolFor(deck, WHOLE_DECK);
    pool.pop();
    expect(deck.cards).toHaveLength(3);
  });

  it("treats the cards of a deck without sections as the whole deck", () => {
    const flat = deckFile("gcp-cdl", "h1", [card("gcp-cdl-001", WHOLE_DECK), card("gcp-cdl-002", WHOLE_DECK)]);
    expect(poolFor(flat, WHOLE_DECK)).toHaveLength(2);
  });
});

describe("createDeckCache", () => {
  it("writes a deck under truthy.deck.<id> and reads it back", () => {
    const storage = memoryStorage();
    const cache = createDeckCache(storage);
    const deck = deckFile("aws-clf", "h1");
    cache.write(deck);
    expect([...storage.data.keys()]).toEqual(["truthy.deck.aws-clf"]);
    expect(cache.read("aws-clf")).toEqual(deck);
  });

  it("reads null for a deck that was never cached", () => {
    expect(createDeckCache(memoryStorage()).read("aws-clf")).toBeNull();
  });

  it("works without storage: reads are null and writes do nothing", () => {
    const cache = createDeckCache(undefined);
    expect(() => cache.write(deckFile("aws-clf", "h1"))).not.toThrow();
    expect(cache.read("aws-clf")).toBeNull();
  });

  it("reads null when the cached text is not JSON", () => {
    const cache = createDeckCache(memoryStorage({ "truthy.deck.aws-clf": "{not json" }));
    expect(cache.read("aws-clf")).toBeNull();
  });

  it("reads null when the cached JSON is not a valid deck file", () => {
    const broken = JSON.stringify({ id: "aws-clf", hash: "h1", cards: [{ id: "aws-clf-001" }] });
    const cache = createDeckCache(memoryStorage({ "truthy.deck.aws-clf": broken }));
    expect(cache.read("aws-clf")).toBeNull();
  });

  it("reads null when the cached deck has no cards", () => {
    const empty = JSON.stringify({ id: "aws-clf", hash: "h1", cards: [] });
    const cache = createDeckCache(memoryStorage({ "truthy.deck.aws-clf": empty }));
    expect(cache.read("aws-clf")).toBeNull();
  });

  it("does not throw when the storage throws on write (quota exceeded)", () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
      },
    };
    const cache = createDeckCache(storage);
    expect(() => cache.write(deckFile("aws-clf", "h1"))).not.toThrow();
    expect(cache.read("aws-clf")).toBeNull();
  });

  it("overwrites an older copy of the same deck", () => {
    const storage = memoryStorage();
    const cache = createDeckCache(storage);
    cache.write(deckFile("aws-clf", "old"));
    cache.write(deckFile("aws-clf", "new"));
    expect(cache.read("aws-clf")?.hash).toBe("new");
    expect(storage.data.size).toBe(1);
  });
});
