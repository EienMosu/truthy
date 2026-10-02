### Task 8: Loading decks on the client

Two small client modules. `src/content/load.ts` fetches `public/decks/index.json` and the deck files, validates them with the task 3 schemas and keeps them in `localStorage`, so a deck is fetched again only when its hash in the index changes, and a failed fetch falls back to the cached copy (spec section 5, "Loading", and section 10). `src/app-state/pending.ts` is the hand-over from the start flow to `/play`: the chosen route and mode in `sessionStorage`.

Neither module touches `window.fetch`, `window.localStorage` or `window.sessionStorage` directly except the default argument of the pending functions: callers pass a fetcher and a storage, so every test runs in the node environment with fakes. Nothing here throws at the player except `LoadError`, which the start flow (task 10) turns into a plain message with a retry action.

The behaviour is built up in six test-first slices: the deck cache and `poolFor`, then `loadIndex`, then `loadDeck`, then the pending round, then guards against files that belong to another deck and modes this build cannot play, then the cached copy of the index.

Every command below runs from the repository root.

**Files:**
- Create: `src/content/load.ts`
- Create: `src/app-state/pending.ts`
- Test: `tests/content/load.test.ts`
- Test: `tests/app-state/pending.test.ts`

**Interfaces:**
- Consumes:
  - From task 3, `@/src/content/schema`: `DeckFileSchema`, `DeckIndexSchema`, `WHOLE_DECK` (`"ALL"`), and the types `Card`, `DeckFile`, `DeckIndex`, `Route`.
  - From task 5, `@/src/engine/round`: `type Mode` and `AVAILABLE_MODES: readonly Mode[]` (`["classic"]` in step 1).
  - From task 1: the `@/*` alias, Vitest in the node environment, zod.
- Produces (the contract names, plus the additions marked "added"):

```ts
// src/content/load.ts
export type Fetcher = (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }>;
export interface DeckCache { read(deckId: string): DeckFile | null; write(deck: DeckFile): void }
export function createDeckCache(storage: Pick<Storage, "getItem" | "setItem"> | undefined): DeckCache;   // key `truthy.deck.<id>`
export class LoadError extends Error {}                                                                   // name "LoadError"
export async function loadIndex(fetcher: Fetcher, storage?: Pick<Storage, "getItem" | "setItem">): Promise<DeckIndex>;
export async function loadDeck(entry: { id: string; hash: string }, cache: DeckCache, fetcher: Fetcher): Promise<DeckFile>;
export function poolFor(deck: DeckFile, sectionId: string): Card[];
export const INDEX_URL = "/decks/index.json";                       // added
export const INDEX_CACHE_KEY = "truthy.index.v1";                   // added
export function deckCacheKey(deckId: string): string;               // added: `truthy.deck.${deckId}`
export function deckUrl(entry: { id: string; hash: string }): string;   // added: `/decks/<id>.json?v=<hash>`
export const FETCH_TIMEOUT_MS = 8000;                               // added (step 30c): a request that has not answered by then counts as failed

// src/app-state/pending.ts
export interface PendingRound { route: Route; mode: Mode }
export const PENDING_KEY = "truthy.pending.v1";
export function savePending(pending: PendingRound, storage?: Pick<Storage, "setItem">): void;
export function readPending(storage?: Pick<Storage, "getItem">): PendingRound | null;
```

Exact semantics later tasks rely on:
- `loadIndex(fetcher, storage?)` always fetches `/decks/index.json` (the index is what tells the app that a deck changed). A valid index is written to `truthy.index.v1` when `storage` is given. A failed request, a non-ok response, a body that is not JSON or an index that fails `DeckIndexSchema` falls back to a valid cached index; with none it throws `LoadError` with the message `Could not load the deck index: <reason>.` The start flow should call it as `loadIndex((url) => fetch(url), window.localStorage)` inside a try/catch (reading `window.localStorage` can itself throw in some browsers: pass `undefined` then).
- `loadDeck(entry, cache, fetcher)`: with a cached copy whose `hash` equals `entry.hash` it returns that copy and makes no request. Otherwise it fetches `deckUrl(entry)`, and a valid file whose `id` is `entry.id` is written to the cache and returned. On any failure (request, non-ok, not JSON, invalid file, wrong deck id) it returns the cached copy of any hash, or throws `LoadError` with `Could not load the deck "<id>": <reason>.` A full storage never makes it fail.
- `createDeckCache(storage)`: `read` returns null for no storage, a missing key, a throwing storage, text that is not JSON, JSON that fails `DeckFileSchema` (including zero cards), or a deck whose `id` is not the one asked for. `write` never throws.
- `poolFor(deck, WHOLE_DECK)` is a copy of every card; any other id gives the cards with that `section`, in deck order; an unknown id gives `[]` (the caller must not start a round on an empty pool, since `startRound` throws).
- `savePending` and `readPending` default to `window.sessionStorage` and do nothing (or return null) on the server or where storage is blocked. Neither ever throws. `readPending` returns null for anything that is not `{ route: { deckId, sectionId }, mode }` with non-empty strings and a mode in `AVAILABLE_MODES`, and drops unknown extra fields. `/play` redirects to `/` when it gets null.

- [ ] **Step 1: Write the failing tests for the deck cache and the pool**

Create `tests/content/load.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests and watch them fail**

Run:

```bash
pnpm vitest run tests/content/load.test.ts
```

Expected: the suite fails to load because the module does not exist yet.

```
 FAIL  tests/content/load.test.ts [ tests/content/load.test.ts ]
Error: Cannot find package '@/src/content/load' imported from .../tests/content/load.test.ts

 Test Files  1 failed (1)
      Tests  no tests
```

- [ ] **Step 3: Create the module with the storage helpers, the deck cache and poolFor**

Create `src/content/load.ts`:

```ts
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
```

The import line already names `DeckIndexSchema` and `DeckIndex`, which the next slices use; the tsconfig has no unused-import check, so this compiles.

- [ ] **Step 4: Run the tests and watch them pass**

```bash
pnpm vitest run tests/content/load.test.ts
```

Expected:

```
 Test Files  1 passed (1)
      Tests  13 passed (13)
```

- [ ] **Step 5: Commit**

```bash
git add src/content/load.ts tests/content/load.test.ts
git commit -m "feat: cache deck files on the device and pick the pool for a route"
```

- [ ] **Step 6: Write the failing tests for loadIndex**

In `tests/content/load.test.ts`, replace the first three lines (the imports) with:

```ts
import { describe, expect, it, vi } from "vitest";
import { WHOLE_DECK, type Card, type DeckFile, type DeckIndex } from "@/src/content/schema";
import { LoadError, createDeckCache, loadIndex, poolFor, type Fetcher } from "@/src/content/load";
```

Then append to the end of the file:

```ts
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
```

- [ ] **Step 7: Run the tests and watch the new ones fail**

```bash
pnpm vitest run tests/content/load.test.ts
```

Expected: the seven new tests fail, the thirteen earlier ones still pass.

```
TypeError: loadIndex is not a function
      Tests  7 failed | 13 passed (20)
```

- [ ] **Step 8: Implement fetching and loadIndex**

Append to the end of `src/content/load.ts`:

```ts
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
```

- [ ] **Step 9: Run the tests and watch them pass**

```bash
pnpm vitest run tests/content/load.test.ts
```

Expected:

```
 Test Files  1 passed (1)
      Tests  20 passed (20)
```

- [ ] **Step 10: Commit**

```bash
git add src/content/load.ts tests/content/load.test.ts
git commit -m "feat: load and validate the deck index"
```

- [ ] **Step 11: Write the failing tests for loadDeck**

In `tests/content/load.test.ts`, replace the third line (the import from `@/src/content/load`) with:

```ts
import { LoadError, createDeckCache, loadDeck, loadIndex, poolFor, type Fetcher } from "@/src/content/load";
```

Then append to the end of the file:

```ts
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
```

- [ ] **Step 12: Run the tests and watch the new ones fail**

```bash
pnpm vitest run tests/content/load.test.ts
```

Expected: eleven of the twelve new tests fail; the type-only "accepts window.fetch as a fetcher" test passes already, since `Fetcher` exists.

```
TypeError: loadDeck is not a function
      Tests  11 failed | 21 passed (32)
```

- [ ] **Step 13: Implement loadDeck**

Append to the end of `src/content/load.ts`:

```ts
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
    if (parsed.success) {
      cache.write(parsed.data);
      return parsed.data;
    }
    reason = `the file is not valid (${firstIssue(parsed.error.issues)})`;
  } else {
    reason = fetched.reason;
  }

  if (cached) return cached;
  throw new LoadError(`Could not load the deck "${entry.id}": ${reason}.`);
}
```

- [ ] **Step 14: Run the tests and watch them pass**

```bash
pnpm vitest run tests/content/load.test.ts
```

Expected:

```
 Test Files  1 passed (1)
      Tests  32 passed (32)
```

- [ ] **Step 15: Commit**

```bash
git add src/content/load.ts tests/content/load.test.ts
git commit -m "feat: load deck files, refetch on a new hash and fall back to the cached copy"
```

- [ ] **Step 16: Write the failing tests for the pending round**

Create `tests/app-state/pending.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { PENDING_KEY, readPending, savePending, type PendingRound } from "@/src/app-state/pending";

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

const pending: PendingRound = { route: { deckId: "aws-clf", sectionId: "S01" }, mode: "classic" };

describe("savePending and readPending", () => {
  it("round-trips a pending round under truthy.pending.v1", () => {
    const storage = memoryStorage();
    savePending(pending, storage);
    expect([...storage.data.keys()]).toEqual([PENDING_KEY]);
    expect(PENDING_KEY).toBe("truthy.pending.v1");
    expect(readPending(storage)).toEqual(pending);
  });

  it("round-trips the whole deck route", () => {
    const storage = memoryStorage();
    const whole: PendingRound = { route: { deckId: "gcp-cdl", sectionId: "ALL" }, mode: "classic" };
    savePending(whole, storage);
    expect(readPending(storage)).toEqual(whole);
  });

  it("replaces an earlier pending round", () => {
    const storage = memoryStorage();
    savePending(pending, storage);
    savePending({ ...pending, route: { deckId: "aws-clf", sectionId: "S02" } }, storage);
    expect(readPending(storage)?.route.sectionId).toBe("S02");
  });

  it("reads null when nothing is stored", () => {
    expect(readPending(memoryStorage())).toBeNull();
  });

  it("reads null when the stored text is not JSON", () => {
    expect(readPending(memoryStorage({ [PENDING_KEY]: "{oops" }))).toBeNull();
  });

  it("reads null when the stored JSON has the wrong shape", () => {
    const shapes = [
      null,
      42,
      "classic",
      [],
      {},
      { route: { deckId: "aws-clf" }, mode: "classic" },
      { route: { deckId: "", sectionId: "S01" }, mode: "classic" },
      { route: { deckId: "aws-clf", sectionId: "S01" } },
      { route: { deckId: "aws-clf", sectionId: "S01" }, mode: "chess" },
      { route: "aws-clf/S01", mode: "classic" },
    ];
    for (const shape of shapes) {
      expect(readPending(memoryStorage({ [PENDING_KEY]: JSON.stringify(shape) }))).toBeNull();
    }
  });

  it("drops extra fields it does not know", () => {
    const stored = JSON.stringify({ ...pending, extra: true, route: { ...pending.route, junk: 1 } });
    expect(readPending(memoryStorage({ [PENDING_KEY]: stored }))).toEqual(pending);
  });

  it("reads null and does not throw when the storage throws on read", () => {
    const storage = {
      getItem: (): string | null => {
        throw new DOMException("The operation is insecure.", "SecurityError");
      },
    };
    expect(readPending(storage)).toBeNull();
  });

  it("does not throw when the storage throws on write", () => {
    const storage = {
      setItem: () => {
        throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
      },
    };
    expect(() => savePending(pending, storage)).not.toThrow();
  });

  it("works without a browser: no storage argument and no window", () => {
    expect(typeof window).toBe("undefined");
    expect(() => savePending(pending)).not.toThrow();
    expect(readPending()).toBeNull();
  });
});
```

- [ ] **Step 17: Run the tests and watch them fail**

```bash
pnpm vitest run tests/app-state/pending.test.ts
```

Expected:

```
 FAIL  tests/app-state/pending.test.ts [ tests/app-state/pending.test.ts ]
Error: Cannot find package '@/src/app-state/pending' imported from .../tests/app-state/pending.test.ts
      Tests  no tests
```

- [ ] **Step 18: Implement the pending round**

Create `src/app-state/pending.ts`:

```ts
// The round the start flow hands to /play: the chosen route and mode, kept in sessionStorage
// so that a reload of /play keeps it and a new tab starts clean (spec section 4, "Routes").

import { z } from "zod";
import type { Route } from "@/src/content/schema";
import type { Mode } from "@/src/engine/round";

export interface PendingRound {
  route: Route;
  mode: Mode;
}

export const PENDING_KEY = "truthy.pending.v1";

const MODES = ["classic", "streak", "lives", "timed"] as const satisfies readonly Mode[];

const PendingSchema = z.object({
  route: z.object({ deckId: z.string().min(1), sectionId: z.string().min(1) }),
  mode: z.enum(MODES),
});

// window.sessionStorage, or undefined on the server and where the browser blocks storage.
function sessionStore(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.sessionStorage;
  } catch {
    return undefined;
  }
}

// Never throws: without storage the round is simply not handed over, and /play sends the player back to /.
export function savePending(pending: PendingRound, storage: Pick<Storage, "setItem"> | undefined = sessionStore()): void {
  if (!storage) return;
  try {
    storage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch {
    // Storage full or blocked.
  }
}

// The stored pending round, or null when there is none or it is not valid. Never throws.
export function readPending(storage: Pick<Storage, "getItem"> | undefined = sessionStore()): PendingRound | null {
  if (!storage) return null;
  let value: unknown;
  try {
    const text = storage.getItem(PENDING_KEY);
    if (text === null) return null;
    value = JSON.parse(text);
  } catch {
    return null;
  }
  const parsed = PendingSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
```

- [ ] **Step 19: Run the tests and watch them pass**

```bash
pnpm vitest run tests/app-state/pending.test.ts
```

Expected:

```
 Test Files  1 passed (1)
      Tests  10 passed (10)
```

- [ ] **Step 20: Commit**

```bash
git add src/app-state/pending.ts tests/app-state/pending.test.ts
git commit -m "feat: hand the chosen route and mode to /play through sessionStorage"
```

- [ ] **Step 21: Write the failing tests for files of another deck and modes this build cannot play**

These come from the review focus candidates at the end of this task. Append to the end of `tests/content/load.test.ts`:

```ts
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
```

Append to the end of `tests/app-state/pending.test.ts`:

```ts
describe("modes this build cannot play", () => {
  it("reads null for a mode that exists but is not available yet", () => {
    const stored = JSON.stringify({ route: pending.route, mode: "streak" });
    expect(readPending(memoryStorage({ [PENDING_KEY]: stored }))).toBeNull();
  });
});
```

- [ ] **Step 22: Run the tests and watch the new ones fail**

```bash
pnpm vitest run tests/content/load.test.ts tests/app-state/pending.test.ts
```

Expected: three failures. The "storage throws on read" test already passes, because `readJson` catches.

```
     × reads null for a mode that exists but is not available yet
     × reads null when the copy under a deck's key is a different deck
     × rejects a fetched file whose id is not the requested deck and does not cache it
AssertionError: expected { …(2) } to be null
AssertionError: expected { id: 'gcp-cdl', hash: 'h1', …(1) } to be null
AssertionError: promise resolved "{ id: 'gcp-cdl', hash: 'h2', …(1) }" instead of rejecting
      Tests  3 failed | 43 passed (46)
```

- [ ] **Step 23: Check the deck id in the cache and in fetched files**

In `src/content/load.ts`, inside `createDeckCache`, replace:

```ts
      return parsed.success ? parsed.data : null;
```

with:

```ts
      return parsed.success && parsed.data.id === deckId ? parsed.data : null;
```

Then replace the whole `deckUrl` and `loadDeck` part (from `export function deckUrl` to the end of the file) with:

```ts
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
```

- [ ] **Step 24: Accept only available modes in the pending round**

Replace the whole of `src/app-state/pending.ts` with:

```ts
// The round the start flow hands to /play: the chosen route and mode, kept in sessionStorage
// so that a reload of /play keeps it and a new tab starts clean (spec section 4, "Routes").

import { z } from "zod";
import type { Route } from "@/src/content/schema";
import { AVAILABLE_MODES, type Mode } from "@/src/engine/round";

export interface PendingRound {
  route: Route;
  mode: Mode;
}

export const PENDING_KEY = "truthy.pending.v1";

// Only modes this build can play: a stored "streak" from a newer build must not reach startRound, which would throw.
const PendingSchema = z.object({
  route: z.object({ deckId: z.string().min(1), sectionId: z.string().min(1) }),
  mode: z.custom<Mode>((value) => typeof value === "string" && (AVAILABLE_MODES as readonly string[]).includes(value)),
});

// window.sessionStorage, or undefined on the server and where the browser blocks storage.
function sessionStore(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.sessionStorage;
  } catch {
    return undefined;
  }
}

// Never throws: without storage the round is simply not handed over, and /play sends the player back to /.
export function savePending(pending: PendingRound, storage: Pick<Storage, "setItem"> | undefined = sessionStore()): void {
  if (!storage) return;
  try {
    storage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch {
    // Storage full or blocked.
  }
}

// The stored pending round, or null when there is none or it is not valid. Never throws.
export function readPending(storage: Pick<Storage, "getItem"> | undefined = sessionStore()): PendingRound | null {
  if (!storage) return null;
  let value: unknown;
  try {
    const text = storage.getItem(PENDING_KEY);
    if (text === null) return null;
    value = JSON.parse(text);
  } catch {
    return null;
  }
  const parsed = PendingSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
```

- [ ] **Step 25: Run the tests and watch them pass**

```bash
pnpm vitest run tests/content/load.test.ts tests/app-state/pending.test.ts
```

Expected:

```
 Test Files  2 passed (2)
      Tests  46 passed (46)
```

- [ ] **Step 26: Commit**

```bash
git add src/content/load.ts src/app-state/pending.ts tests/content/load.test.ts tests/app-state/pending.test.ts
git commit -m "fix: ignore deck files of another deck and pending rounds of unavailable modes"
```

- [ ] **Step 27: Write the failing tests for the cached index**

The spec caches `index.json` on the device too ("Both are cached on the device"; section 10: use the cached copy when `index.json` cannot be fetched). Append to the end of `tests/content/load.test.ts`:

```ts
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
```

- [ ] **Step 28: Run the tests and watch the new ones fail**

```bash
pnpm vitest run tests/content/load.test.ts
```

Expected: the write and the two fallbacks fail; "always fetches" and "corrupt cache" already pass, because the current `loadIndex` ignores the second argument.

```
     × stores a fetched index under truthy.index.v1
     × falls back to the cached index when the fetch fails
     × falls back to the cached index when the fetched index is not valid
      Tests  3 failed | 37 passed (40)
```

- [ ] **Step 29: Cache the index and fall back to it**

In `src/content/load.ts`, replace the whole `loadIndex` function together with the comment line above it (from `// GET /decks/index.json and validate it.` to the closing brace of `loadIndex`) with:

```ts
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
```

- [ ] **Step 30: Run the task's tests and the typecheck**

```bash
pnpm vitest run tests/content/load.test.ts tests/app-state/pending.test.ts
pnpm typecheck
```

Expected:

```
 Test Files  2 passed (2)
      Tests  51 passed (51)
```

and `pnpm typecheck` prints no error for `src/content/load.ts`, `src/app-state/pending.ts` or their tests.

- [ ] **Step 30a: Write the failing tests for a network that never answers**

On a weak phone signal a request is often sent and never answered, with no error: `fetch` then hangs for minutes. The cached index and deck from step 29 only help when the fetch *fails*, so without a time limit a returning player on a train looks at "Loading the decks" (task 10) or the ticket placeholder (task 11) although good copies are on the device (spec sections 5 and 10: a failed fetch with a cached copy uses the copy, otherwise a message and a retry action).

In `tests/content/load.test.ts`, replace the import line from `@/src/content/load` with:

```ts
import { FETCH_TIMEOUT_MS, LoadError, createDeckCache, loadDeck, loadIndex, poolFor, type Fetcher } from "@/src/content/load";
```

Then append to the end of the file:

```ts
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
```

- [ ] **Step 30b: Run the tests and watch the new ones fail**

```bash
pnpm vitest run tests/content/load.test.ts
```

Expected: `Tests  4 failed | 41 passed (45)`, after about 15 seconds. "gives up after FETCH_TIMEOUT_MS" fails because the constant does not exist (`expected undefined to be greater than or equal to 3000`), and the three hanging tests each fail with `Error: Test timed out in 5000ms.`: nothing ever settles. "still waits for a slow answer" already passes.

- [ ] **Step 30c: Give every request a time limit**

In `src/content/load.ts`, replace the whole `fetchJson` function and the comment line above it (from `// Fetches one JSON file. Never throws` to its closing brace) with:

```ts
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
```

The timer is cleared as soon as the request settles, so a fast answer leaves no timer behind. The component tests of tasks 10 to 12 hold the fake network for a few milliseconds only, far inside the limit.

- [ ] **Step 30d: Run the task's tests and the typecheck**

```bash
pnpm vitest run tests/content/load.test.ts tests/app-state/pending.test.ts
pnpm typecheck
```

Expected: `Test Files  2 passed (2)` and `Tests  56 passed (56)`; `tsc --noEmit` prints nothing. Every later part that quotes a `pnpm test` total counts five tests more from here on. `FETCH_TIMEOUT_MS` (8000) joins the exports listed under Produces.

- [ ] **Step 31: Commit**

```bash
git add src/content/load.ts tests/content/load.test.ts
git commit -m "feat: cache the deck index, use the copy when it cannot be fetched, and give up on a request after 8 seconds"
```

#### Review focus candidates

1. A deck file under the right URL or the right cache key that belongs to another deck (a misnamed file in `public/decks`, or a stale key after a deck was renamed). Without a check the player would get the cards of the wrong deck, and the wrong deck would be cached under the requested key. Covered by step 21 ("files that belong to another deck"), fixed in step 23.
2. A pending round stored with a mode that exists in the `Mode` type but is not playable in this build (`"streak"`, for example written by a newer build in the same tab after a rollback). `startRound` throws for it, so `/play` would crash instead of redirecting. Covered by step 21 ("modes this build cannot play"), fixed in step 24.
3. Starting the app offline or while the deploy serves a broken `index.json`, after it has worked once. The spec says to use the cached copy; the contract's `loadIndex(fetcher)` had no cache. Covered by step 27, implemented in step 29 with an optional second argument.
