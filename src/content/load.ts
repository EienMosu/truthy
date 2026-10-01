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
      return parsed.success && parsed.data.id === deckId ? parsed.data : null;
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

// The network as the loader sees it: window.fetch fits this type, and so does a fake in tests.
export type Fetcher = (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

// Thrown when a file cannot be loaded and there is no cached copy. The message names what failed.
export class LoadError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "LoadError";
  }
}

export const INDEX_URL = "/decks/index.json";

type Fetched = { ok: true; value: unknown } | { ok: false; reason: string };

// How long a request may take before it counts as failed. On a weak phone signal a request can hang for
// minutes without an error; after this time the cached copy is used, or the player gets Try again.
export const FETCH_TIMEOUT_MS = 8000;

// Resolves or rejects like `promise`, or rejects after `ms` when it has not settled by then.
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`no answer within ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Fetches one JSON file. Never throws: every failure comes back as a reason a person can read.
async function fetchJson(fetcher: Fetcher, url: string): Promise<Fetched> {
  let response: Awaited<ReturnType<Fetcher>>;
  try {
    response = await withTimeout(fetcher(url), FETCH_TIMEOUT_MS);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, reason: `the request failed (${detail})` };
  }
  if (!response.ok) return { ok: false, reason: "the server did not return the file" };
  try {
    return { ok: true, value: await withTimeout(response.json(), FETCH_TIMEOUT_MS) };
  } catch {
    return { ok: false, reason: "the response is not JSON" };
  }
}

// The first validation problem, as "path: message", for error messages.
function firstIssue(issues: readonly { path: readonly PropertyKey[]; message: string }[]): string {
  const issue = issues[0];
  if (!issue) return "unknown problem";
  const path = issue.path.map(String).join(".");
  return path === "" ? issue.message : `${path}: ${issue.message}`;
}

export const INDEX_CACHE_KEY = "truthy.index.v1";

// GET /decks/index.json and validate it. The index is always fetched so new decks and new hashes show up.
// With storage, a valid index is cached, and a failed fetch or an invalid file falls back to that copy.
// Throws LoadError when the index cannot be loaded and there is no valid cached copy.
export async function loadIndex(fetcher: Fetcher, storage?: ReadWriteStorage): Promise<DeckIndex> {
  const fetched = await fetchJson(fetcher, INDEX_URL);
  let reason: string;
  if (fetched.ok) {
    const parsed = DeckIndexSchema.safeParse(fetched.value);
    if (parsed.success) {
      writeJson(storage, INDEX_CACHE_KEY, parsed.data);
      return parsed.data;
    }
    reason = `the file is not valid (${firstIssue(parsed.error.issues)})`;
  } else {
    reason = fetched.reason;
  }
  const cached = DeckIndexSchema.safeParse(readJson(storage, INDEX_CACHE_KEY));
  if (cached.success) return cached.data;
  throw new LoadError(`Could not load the deck index: ${reason}.`);
}

export function deckUrl(entry: { id: string; hash: string }): string {
  // The hash in the query makes a changed deck a new URL, so no HTTP cache can serve the old file.
  return `/decks/${encodeURIComponent(entry.id)}.json?v=${encodeURIComponent(entry.hash)}`;
}

// Loads one deck. A cached copy with the hash from the index is used without fetching.
// Otherwise the deck is fetched, validated and cached. When that fails, any cached copy is used,
// even one of an older hash; with no copy at all it throws LoadError.
export async function loadDeck(entry: { id: string; hash: string }, cache: DeckCache, fetcher: Fetcher): Promise<DeckFile> {
  const cached = cache.read(entry.id);
  if (cached && cached.hash === entry.hash) return cached;

  const fetched = await fetchJson(fetcher, deckUrl(entry));
  let reason: string;
  if (fetched.ok) {
    const parsed = DeckFileSchema.safeParse(fetched.value);
    if (!parsed.success) {
      reason = `the file is not valid (${firstIssue(parsed.error.issues)})`;
    } else if (parsed.data.id !== entry.id) {
      reason = `the file is for the deck "${parsed.data.id}"`;
    } else {
      cache.write(parsed.data);
      return parsed.data;
    }
  } else {
    reason = fetched.reason;
  }

  if (cached) return cached;
  throw new LoadError(`Could not load the deck "${entry.id}": ${reason}.`);
}
