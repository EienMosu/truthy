import { describe, expect, it, vi } from "vitest";
import { WHOLE_DECK, type Card, type DeckFile, type DeckIndex } from "@/src/content/schema";
import { FETCH_TIMEOUT_MS, LoadError, createDeckCache, loadDeck, loadIndex, poolFor, type Fetcher } from "@/src/content/load";

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

describe("loadDeck", () => {
  const entry = { id: "aws-clf", hash: "h2" };
  const url = "/decks/aws-clf.json?v=h2";

  it("uses the cached copy without fetching when the hashes match", async () => {
    const cache = createDeckCache(memoryStorage());
    cache.write(deckFile("aws-clf", "h2"));
    const fetcher = fakeFetcher({});
    await expect(loadDeck(entry, cache, fetcher)).resolves.toEqual(deckFile("aws-clf", "h2"));
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("fetches the deck file, versioned by its hash, when nothing is cached", async () => {
    const cache = createDeckCache(memoryStorage());
    const fetcher = fakeFetcher({ [url]: { ok: true, body: deckFile("aws-clf", "h2") } });
    await expect(loadDeck(entry, cache, fetcher)).resolves.toEqual(deckFile("aws-clf", "h2"));
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(url);
  });

  it("stores a fetched deck so the next load needs no fetch", async () => {
    const cache = createDeckCache(memoryStorage());
    const fetcher = fakeFetcher({ [url]: { ok: true, body: deckFile("aws-clf", "h2") } });
    await loadDeck(entry, cache, fetcher);
    await loadDeck(entry, cache, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(cache.read("aws-clf")?.hash).toBe("h2");
  });

  it("fetches again and overwrites the cache when the hash in the index changed", async () => {
    const cache = createDeckCache(memoryStorage());
    cache.write(deckFile("aws-clf", "h1"));
    const fresh = deckFile("aws-clf", "h2", [card("aws-clf-009", "S01")]);
    const fetcher = fakeFetcher({ [url]: { ok: true, body: fresh } });
    await expect(loadDeck(entry, cache, fetcher)).resolves.toEqual(fresh);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(cache.read("aws-clf")).toEqual(fresh);
  });

  it("falls back to a cached copy of an older hash when the fetch fails", async () => {
    const cache = createDeckCache(memoryStorage());
    const old = deckFile("aws-clf", "h1");
    cache.write(old);
    const fetcher = fakeFetcher({ [url]: "network-error" });
    await expect(loadDeck(entry, cache, fetcher)).resolves.toEqual(old);
    expect(cache.read("aws-clf")).toEqual(old);
  });

  it("falls back to a cached copy when the server answers with an error", async () => {
    const cache = createDeckCache(memoryStorage());
    cache.write(deckFile("aws-clf", "h1"));
    const fetcher = fakeFetcher({ [url]: { ok: false, body: null } });
    await expect(loadDeck(entry, cache, fetcher)).resolves.toMatchObject({ hash: "h1" });
  });

  it("throws a LoadError naming the deck when the fetch fails and nothing is cached", async () => {
    const cache = createDeckCache(memoryStorage());
    const fetcher = fakeFetcher({ [url]: "network-error" });
    const error = await loadDeck(entry, cache, fetcher).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LoadError);
    expect((error as LoadError).message).toBe('Could not load the deck "aws-clf": the request failed (Failed to fetch).');
  });

  it("throws a LoadError when there is no storage at all and the fetch fails", async () => {
    const fetcher = fakeFetcher({ [url]: { ok: false, body: null } });
    await expect(loadDeck(entry, createDeckCache(undefined), fetcher)).rejects.toThrow(
      'Could not load the deck "aws-clf": the server did not return the file.',
    );
  });

  it("rejects a fetched deck that fails validation, names the field and does not cache it", async () => {
    const storage = memoryStorage();
    const cache = createDeckCache(storage);
    const bad = { id: "aws-clf", hash: "h2", cards: [{ ...card("aws-clf-001", "S01"), answer: "yes" }] };
    const fetcher = fakeFetcher({ [url]: { ok: true, body: bad } });
    const error = await loadDeck(entry, cache, fetcher).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LoadError);
    expect((error as LoadError).message).toMatch(/^Could not load the deck "aws-clf": the file is not valid \(cards\.0\.answer: /);
    expect(storage.data.size).toBe(0);
  });

  it("uses the cached copy when the fetched deck fails validation", async () => {
    const cache = createDeckCache(memoryStorage());
    cache.write(deckFile("aws-clf", "h1"));
    const fetcher = fakeFetcher({ [url]: { ok: true, body: { id: "aws-clf", hash: "h2", cards: [] } } });
    await expect(loadDeck(entry, cache, fetcher)).resolves.toMatchObject({ hash: "h1" });
  });

  it("still returns the fetched deck when the storage is full", async () => {
    const cache = createDeckCache({
      getItem: () => null,
      setItem: () => {
        throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
      },
    });
    const fetcher = fakeFetcher({ [url]: { ok: true, body: deckFile("aws-clf", "h2") } });
    await expect(loadDeck(entry, cache, fetcher)).resolves.toEqual(deckFile("aws-clf", "h2"));
  });

  it("accepts window.fetch as a fetcher", () => {
    const real: Fetcher = (input) => fetch(input);
    expect(typeof real).toBe("function");
  });
});

describe("files that belong to another deck", () => {
  it("reads null when the copy under a deck's key is a different deck", () => {
    const other = JSON.stringify(deckFile("gcp-cdl", "h1"));
    const cache = createDeckCache(memoryStorage({ "truthy.deck.aws-clf": other }));
    expect(cache.read("aws-clf")).toBeNull();
  });

  it("reads null and does not throw when the storage throws on read", () => {
    const cache = createDeckCache({
      getItem: () => {
        throw new DOMException("The operation is insecure.", "SecurityError");
      },
      setItem: () => undefined,
    });
    expect(cache.read("aws-clf")).toBeNull();
  });

  it("rejects a fetched file whose id is not the requested deck and does not cache it", async () => {
    const storage = memoryStorage();
    const fetcher = fakeFetcher({ "/decks/aws-clf.json?v=h2": { ok: true, body: deckFile("gcp-cdl", "h2") } });
    await expect(loadDeck({ id: "aws-clf", hash: "h2" }, createDeckCache(storage), fetcher)).rejects.toThrow(
      'Could not load the deck "aws-clf": the file is for the deck "gcp-cdl".',
    );
    expect(storage.data.size).toBe(0);
  });
});

describe("loadIndex with a cached copy", () => {
  it("stores a fetched index under truthy.index.v1", async () => {
    const storage = memoryStorage();
    await loadIndex(fakeFetcher({ "/decks/index.json": { ok: true, body: index } }), storage);
    expect(JSON.parse(storage.data.get("truthy.index.v1") ?? "null")).toEqual(index);
  });

  it("always fetches, even when a copy is cached, so new decks appear", async () => {
    const storage = memoryStorage({ "truthy.index.v1": JSON.stringify({ areas: [] }) });
    const fetcher = fakeFetcher({ "/decks/index.json": { ok: true, body: index } });
    await expect(loadIndex(fetcher, storage)).resolves.toEqual(index);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("falls back to the cached index when the fetch fails", async () => {
    const storage = memoryStorage({ "truthy.index.v1": JSON.stringify(index) });
    await expect(loadIndex(fakeFetcher({ "/decks/index.json": "network-error" }), storage)).resolves.toEqual(index);
  });

  it("falls back to the cached index when the fetched index is not valid", async () => {
    const storage = memoryStorage({ "truthy.index.v1": JSON.stringify(index) });
    const fetcher = fakeFetcher({ "/decks/index.json": { ok: true, body: { areas: "none" } } });
    await expect(loadIndex(fetcher, storage)).resolves.toEqual(index);
    expect(JSON.parse(storage.data.get("truthy.index.v1") ?? "null")).toEqual(index);
  });

  it("throws a LoadError when the fetch fails and the cached index is corrupt", async () => {
    const storage = memoryStorage({ "truthy.index.v1": "{corrupt" });
    await expect(loadIndex(fakeFetcher({}), storage)).rejects.toBeInstanceOf(LoadError);
  });
});

// A phone on a weak signal: the request is sent but no answer ever comes (no error either). Without a time
// limit the player would look at the loading state for minutes even with a good copy on the device.
describe("a network that never answers", () => {
  const hanging = vi.fn<Fetcher>(() => new Promise(() => {}));

  async function settle<T>(promise: Promise<T>): Promise<{ value?: T; error?: unknown }> {
    const outcome = promise.then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    );
    await vi.advanceTimersByTimeAsync(FETCH_TIMEOUT_MS);
    return outcome;
  }

  it("gives up after FETCH_TIMEOUT_MS, which is a few seconds", () => {
    expect(FETCH_TIMEOUT_MS).toBeGreaterThanOrEqual(3000);
    expect(FETCH_TIMEOUT_MS).toBeLessThanOrEqual(10000);
  });

  it("uses the cached index when the request hangs", async () => {
    vi.useFakeTimers();
    try {
      const storage = memoryStorage({ "truthy.index.v1": JSON.stringify(index) });
      expect(await settle(loadIndex(hanging, storage))).toEqual({ value: index });
    } finally {
      vi.useRealTimers();
    }
  });

  it("uses a cached deck of an older hash when the request hangs", async () => {
    vi.useFakeTimers();
    try {
      const cache = createDeckCache(memoryStorage());
      cache.write(deckFile("aws-clf", "h1"));
      const outcome = await settle(loadDeck({ id: "aws-clf", hash: "h2" }, cache, hanging));
      expect(outcome.value?.hash).toBe("h1");
    } finally {
      vi.useRealTimers();
    }
  });

  it("throws a LoadError when the request hangs and nothing is cached, so the player gets Try again", async () => {
    vi.useFakeTimers();
    try {
      const outcome = await settle(loadIndex(hanging, memoryStorage()));
      expect(outcome.error).toBeInstanceOf(LoadError);
      expect((outcome.error as Error).message).toContain("no answer");
    } finally {
      vi.useRealTimers();
    }
  });

  it("still waits for a slow answer that arrives inside the limit", async () => {
    vi.useFakeTimers();
    try {
      const slow = vi.fn<Fetcher>(
        () => new Promise((resolve) => setTimeout(() => resolve({ ok: true, json: async () => index }), FETCH_TIMEOUT_MS - 1)),
      );
      expect(await settle(loadIndex(slow, memoryStorage()))).toEqual({ value: index });
    } finally {
      vi.useRealTimers();
    }
  });
});
