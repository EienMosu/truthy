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

// Fetches one JSON file. Never throws: every failure comes back as a reason a person can read.
async function fetchJson(fetcher: Fetcher, url: string): Promise<Fetched> {
  let response: Awaited<ReturnType<Fetcher>>;
  try {
    response = await fetcher(url);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, reason: `the request failed (${detail})` };
  }
  if (!response.ok) return { ok: false, reason: "the server did not return the file" };
  try {
    return { ok: true, value: await response.json() };
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

// GET /decks/index.json and validate it. Throws LoadError when it cannot be fetched or is not a valid index.
export async function loadIndex(fetcher: Fetcher): Promise<DeckIndex> {
  const fetched = await fetchJson(fetcher, INDEX_URL);
  if (!fetched.ok) throw new LoadError(`Could not load the deck index: ${fetched.reason}.`);
  const parsed = DeckIndexSchema.safeParse(fetched.value);
  if (!parsed.success) {
    throw new LoadError(`Could not load the deck index: the file is not valid (${firstIssue(parsed.error.issues)}).`);
  }
  return parsed.data;
}
