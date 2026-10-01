import { describe, expect, it, vi } from "vitest";
import { WHOLE_DECK, type Card, type DeckFile, type DeckIndex } from "@/src/content/schema";
import { LoadError, createDeckCache, loadIndex, poolFor, type Fetcher } from "@/src/content/load";

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

// A fake network. Each url maps to a reply; a url with no reply fails like a dropped connection.
type Reply = { ok: boolean; body: unknown } | "network-error" | "not-json";
function fakeFetcher(replies: Record<string, Reply>) {
  return vi.fn<Fetcher>(async (url) => {
    const reply = replies[url];
    if (reply === undefined || reply === "network-error") throw new TypeError("Failed to fetch");
    if (reply === "not-json") {
      return {
        ok: true,
        json: async () => {
          throw new SyntaxError("Unexpected token '<'");
        },
      };
    }
    return { ok: reply.ok, json: async () => reply.body };
  });
}

const index: DeckIndex = {
  areas: [
    {
      id: "cloud",
      title: "Cloud",
      platforms: [
        {
          id: "aws",
          title: "AWS",
          decks: [
            {
              id: "aws-clf",
              code: "CLF",
              title: "Cloud Practitioner",
              cardCount: 2,
              version: "2026-10-01",
              hash: "h1",
              sections: [{ id: "S01", title: "Cloud concepts", cardCount: 1 }],
            },
          ],
        },
        { id: "azure", title: "Azure", decks: [] },
      ],
    },
  ],
};

describe("loadIndex", () => {
  it("fetches /decks/index.json and returns the validated index", async () => {
    const fetcher = fakeFetcher({ "/decks/index.json": { ok: true, body: index } });
    await expect(loadIndex(fetcher)).resolves.toEqual(index);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith("/decks/index.json");
  });

  it("accepts an index with no areas", async () => {
    const fetcher = fakeFetcher({ "/decks/index.json": { ok: true, body: { areas: [] } } });
    await expect(loadIndex(fetcher)).resolves.toEqual({ areas: [] });
  });

  it("throws a LoadError naming the index when the response is not ok", async () => {
    const fetcher = fakeFetcher({ "/decks/index.json": { ok: false, body: "Not found" } });
    const error = await loadIndex(fetcher).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LoadError);
    expect((error as LoadError).message).toBe("Could not load the deck index: the server did not return the file.");
  });

  it("throws a LoadError when the network request fails", async () => {
    const fetcher = fakeFetcher({ "/decks/index.json": "network-error" });
    await expect(loadIndex(fetcher)).rejects.toThrow("Could not load the deck index: the request failed (Failed to fetch).");
  });

  it("throws a LoadError when the response is not JSON", async () => {
    const fetcher = fakeFetcher({ "/decks/index.json": "not-json" });
    await expect(loadIndex(fetcher)).rejects.toThrow("Could not load the deck index: the response is not JSON.");
  });

  it("throws a LoadError naming the invalid field when the JSON has the wrong shape", async () => {
    const broken = { areas: [{ id: "cloud", title: "Cloud", platforms: "aws" }] };
    const fetcher = fakeFetcher({ "/decks/index.json": { ok: true, body: broken } });
    const error = await loadIndex(fetcher).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LoadError);
    expect((error as LoadError).message).toMatch(/^Could not load the deck index: the file is not valid \(areas\.0\.platforms: /);
  });

  it("throws a LoadError when a deck in the index has zero cards", async () => {
    const zero = structuredClone(index);
    zero.areas[0]!.platforms[0]!.decks[0]!.cardCount = 0;
    const fetcher = fakeFetcher({ "/decks/index.json": { ok: true, body: zero } });
    await expect(loadIndex(fetcher)).rejects.toThrow(/cardCount/);
  });
});
