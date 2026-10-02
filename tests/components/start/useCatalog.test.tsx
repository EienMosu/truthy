// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { continueTarget, deckCount, decksLabel, seenPercent, useCatalog, type CatalogStatus } from "@/components/start/useCatalog";
import type { AppServices } from "@/src/app-state/services";
import { INDEX_CACHE_KEY, INDEX_URL, createDeckCache, deckCacheKey, type Fetcher } from "@/src/content/load";
import { findRoute, type DeckFile, type DeckIndex } from "@/src/content/schema";
import { PROGRESS_KEY } from "@/src/progress/local";
import { bestFor, emptyProgress, parseProgress, type Progress } from "@/src/progress/progress";
import { INDEX, harness, memoryStorage, storedProgress } from "./fixtures";

afterEach(cleanup);

function area(id: string) {
  const found = INDEX.areas.find((a) => a.id === id);
  if (!found) throw new Error(id);
  return found;
}

function progressWith(partial: Partial<Progress>): Progress {
  return { ...emptyProgress(), ...partial };
}

const seen = { seen: 1, lastCorrect: true, lastSeenAt: 1 };

describe("deckCount and decksLabel", () => {
  it("counts the decks of every platform of an area, or of one platform", () => {
    expect(deckCount(area("cloud"))).toBe(2);
    expect(deckCount(area("devops"))).toBe(0);
    expect(deckCount(area("cloud").platforms[2]!)).toBe(0);
  });

  it("says how many decks there are, or that there are none yet", () => {
    expect(decksLabel(1)).toBe("1 deck");
    expect(decksLabel(3)).toBe("3 decks");
    expect(decksLabel(0)).toBe("No decks yet");
  });
});

describe("seenPercent", () => {
  const deck = { id: "aws-clf-c02", cardCount: 92 };

  it("is 0 (not started) without history for the deck", () => {
    expect(seenPercent(progressWith({ cards: { "gcp-cdl-01": seen } }), deck)).toBe(0);
  });

  it("counts history entries whose id starts with the deck id and a dash", () => {
    const cards = Object.fromEntries(Array.from({ length: 46 }, (_, i) => [`aws-clf-c02-t1-${i}`, seen]));
    expect(seenPercent(progressWith({ cards: { ...cards, "aws-clf-c02x-1": seen } }), deck)).toBe(50);
  });

  it("never reads 0 once a card is seen, and never more than 100", () => {
    expect(seenPercent(progressWith({ cards: { "aws-clf-c02-1": seen } }), { id: "aws-clf-c02", cardCount: 500 })).toBe(1);
    const many = Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`aws-clf-c02-${i}`, seen]));
    expect(seenPercent(progressWith({ cards: many }), { id: "aws-clf-c02", cardCount: 3 })).toBe(100);
  });

  // Review finding U52 (spec section 7): the share of the deck's current cards seen at least once.
  it("counts only the deck's current cards when their ids are known", () => {
    const ids = Array.from({ length: 92 }, (_, i) => `aws-clf-c02-t1-${i}`);
    const removed = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`aws-clf-c02-old-${i}`, seen]));
    expect(seenPercent(progressWith({ cards: removed }), deck, ids)).toBe(0);
    const current = Object.fromEntries(ids.slice(0, 23).map((id) => [id, seen]));
    expect(seenPercent(progressWith({ cards: { ...removed, ...current } }), deck, ids)).toBe(25);
    expect(seenPercent(progressWith({ cards: { [ids[0]!]: seen } }), { id: "aws-clf-c02", cardCount: 500 }, [...ids, ...Array.from({ length: 408 }, (_, i) => `x-${i}`)])).toBe(1);
  });

  it("does not count an entry that was never seen", () => {
    const never = { seen: 0, lastCorrect: false, lastSeenAt: 0 };
    expect(seenPercent(progressWith({ cards: { "aws-clf-c02-1": never } }), deck)).toBe(0);
    expect(seenPercent(progressWith({ cards: { "aws-clf-c02-1": never } }), deck, ["aws-clf-c02-1"])).toBe(0);
  });
});

describe("bestFor", () => {
  it("reads the record of a route and mode, or null when there is none", () => {
    const progress = progressWith({ records: { "aws-clf-c02/SEC#classic": 9 } });
    expect(bestFor(progress, { deckId: "aws-clf-c02", sectionId: "SEC" }, "classic")).toBe(9);
    expect(bestFor(progress, { deckId: "aws-clf-c02", sectionId: "ALL" }, "classic")).toBeNull();
  });
});

describe("findRoute and continueTarget", () => {
  it("finds a section route and a whole-deck route", () => {
    expect(findRoute(INDEX, { deckId: "aws-clf-c02", sectionId: "SEC" })?.section?.title).toBe("Security and compliance");
    const whole = findRoute(INDEX, { deckId: "gcp-cdl", sectionId: "ALL" });
    expect(whole?.platform.title).toBe("Google Cloud");
    expect(whole?.section).toBeNull();
  });

  it("finds nothing when the deck or the section is gone", () => {
    expect(findRoute(INDEX, { deckId: "aws-saa-c03", sectionId: "ALL" })).toBeNull();
    expect(findRoute(INDEX, { deckId: "aws-clf-c02", sectionId: "OLD" })).toBeNull();
  });

  it("leads Continue to the last route and mode, only while both can be played", () => {
    const last = { route: { deckId: "aws-clf-c02", sectionId: "SEC" }, mode: "classic" as const, score: 7, total: 10 };
    expect(continueTarget(INDEX, progressWith({ last }))?.found.deck.code).toBe("CLF");
    expect(continueTarget(INDEX, emptyProgress())).toBeNull();
    expect(continueTarget(INDEX, progressWith({ last: { ...last, route: { deckId: "aws-clf-c02", sectionId: "OLD" } } }))).toBeNull();
    expect(continueTarget(INDEX, progressWith({ last: { ...last, mode: "streak" } }))?.mode).toBe("streak");
  });

  it("brings the score of the last round, and none after a round that was left", () => {
    const last = { route: { deckId: "aws-clf-c02", sectionId: "SEC" }, mode: "classic" as const, score: 7, total: 10 };
    expect(continueTarget(INDEX, progressWith({ last }))?.lastScore).toEqual({ score: 7, total: 10 });
    expect(continueTarget(INDEX, progressWith({ last: { ...last, score: null, total: null } }))?.lastScore).toBeNull();
  });
});

/** A valid deck file with these card ids. */
function deckFile(id: string, hash: string, cardIds: readonly string[]): DeckFile {
  return {
    id,
    hash,
    cards: cardIds.map((cardId) => ({
      id: cardId,
      section: "SEC",
      text: { en: { statement: `Statement ${cardId}`, explanation: `Explanation ${cardId}` } },
      answer: true,
      source: { title: "Docs", url: "https://docs.aws.amazon.com/" },
      difficulty: 1 as const,
      appliesTo: "",
      conflictGroups: [],
    })),
  };
}

/** The index with the CLF deck at this hash and card count. */
function indexWithClf(hash: string, cardCount: number): DeckIndex {
  const index = structuredClone(INDEX);
  const clf = index.areas[0]!.platforms[0]!.decks[0]!;
  clf.hash = hash;
  clf.cardCount = cardCount;
  return index;
}

/** A network that serves the index and these deck files, and records what is asked of it. */
function network(index: DeckIndex, decks: readonly DeckFile[]) {
  const calls: string[] = [];
  const fetcher: Fetcher = async (url) => {
    calls.push(url);
    if (url === INDEX_URL) return { ok: true, json: async () => structuredClone(index) };
    const deck = decks.find((d) => url.startsWith(`/decks/${d.id}.json`));
    return deck ? { ok: true, json: async () => structuredClone(deck) } : { ok: false, json: async () => null };
  };
  return { calls, fetcher };
}

const CLF_IDS = Array.from({ length: 20 }, (_, i) => `aws-clf-c02-t1-${i}`);
const PLAYED = CLF_IDS.slice(0, 10);

// Review finding U52: after a deck update the start reads the seen share from the deck's current card ids, and
// drops the history of cards that are no longer in the deck once the catalog is ready.
describe("useCatalog: the seen share after a deck update", () => {
  function deviceWith(cached: DeckFile | null) {
    const local = storedProgress({ cards: Object.fromEntries(PLAYED.map((id) => [id, seen])) });
    if (cached) local.setItem(deckCacheKey(cached.id), JSON.stringify(cached));
    return local;
  }

  async function ready(services: AppServices, settled: (status: CatalogStatus & { kind: "ready" }) => boolean = () => true) {
    const { result } = renderHook(() => useCatalog(services));
    let status: CatalogStatus = result.current.status;
    await waitFor(() => {
      status = result.current.status;
      expect(status.kind === "ready" && settled(status)).toBe(true);
    });
    return status as CatalogStatus & { kind: "ready" };
  }

  it("reads the ids from the cached deck of the index's hash, and drops the history of removed cards", async () => {
    const updated = deckFile("aws-clf-c02", "clf-2", [...CLF_IDS.slice(10), "aws-clf-c02-new"]);
    const local = deviceWith(updated);
    const net = network(indexWithClf("clf-2", 11), []);
    const status = await ready({ fetcher: net.fetcher, localStorage: () => local, sessionStorage: () => undefined });
    expect(status.cardIds["aws-clf-c02"]).toEqual(updated.cards.map((c) => c.id));
    expect(Object.keys(status.progress.cards)).toEqual([]);
    expect(Object.keys(parseProgress(local.getItem(PROGRESS_KEY)).cards)).toEqual([]);
    expect(seenPercent(status.progress, { id: "aws-clf-c02", cardCount: 11 }, status.cardIds["aws-clf-c02"])).toBe(0);
    expect(net.calls).toEqual([INDEX_URL]);
  });

  it("loads a deck whose cached copy is of an older hash, then drops the history of removed cards", async () => {
    const old = deckFile("aws-clf-c02", "clf-1", CLF_IDS);
    const updated = deckFile("aws-clf-c02", "clf-2", [...CLF_IDS.slice(10), "aws-clf-c02-new"]);
    const local = deviceWith(old);
    const net = network(indexWithClf("clf-2", 11), [updated]);
    const status = await ready({ fetcher: net.fetcher, localStorage: () => local, sessionStorage: () => undefined }, (s) => "aws-clf-c02" in s.cardIds);
    expect(net.calls).toEqual([INDEX_URL, "/decks/aws-clf-c02.json?v=clf-2"]);
    expect(status.cardIds["aws-clf-c02"]).toHaveLength(11);
    expect(Object.keys(status.progress.cards)).toEqual([]);
    expect(Object.keys(parseProgress(local.getItem(PROGRESS_KEY)).cards)).toEqual([]);
    expect(createDeckCache(local).read("aws-clf-c02")?.hash).toBe("clf-2");
  });

  it("keeps the history of cards still in the deck", async () => {
    const updated = deckFile("aws-clf-c02", "clf-2", [...PLAYED.slice(0, 4), ...CLF_IDS.slice(10)]);
    const local = deviceWith(updated);
    const net = network(indexWithClf("clf-2", 14), []);
    const status = await ready({ fetcher: net.fetcher, localStorage: () => local, sessionStorage: () => undefined });
    expect(Object.keys(status.progress.cards).sort()).toEqual(PLAYED.slice(0, 4).sort());
    expect(seenPercent(status.progress, { id: "aws-clf-c02", cardCount: 14 }, status.cardIds["aws-clf-c02"])).toBe(29);
  });

  it("drops nothing while the deck's current ids are unknown, and loads no deck without history", async () => {
    const old = deckFile("aws-clf-c02", "clf-1", CLF_IDS);
    const local = deviceWith(old);
    const net = network(indexWithClf("clf-2", 11), []); // the new deck file cannot be loaded
    const services: AppServices = { fetcher: net.fetcher, localStorage: () => local, sessionStorage: () => undefined };
    const { result } = renderHook(() => useCatalog(services));
    await waitFor(() => expect(net.calls).toHaveLength(2));
    await act(async () => {});
    const status = result.current.status;
    if (status.kind !== "ready") throw new Error("not ready");
    expect(status.cardIds).toEqual({});
    expect(Object.keys(status.progress.cards)).toHaveLength(10);
    expect(Object.keys(parseProgress(local.getItem(PROGRESS_KEY)).cards)).toHaveLength(10);
    expect(net.calls).toEqual([INDEX_URL, "/decks/aws-clf-c02.json?v=clf-2"]);
  });
});

describe("useCatalog", () => {
  it("loads the index and the progress on the device", async () => {
    const h = harness(storedProgress({ records: { "gcp-cdl/ALL#classic": 7 } }));
    const { result } = renderHook(() => useCatalog(h.services));
    expect(result.current.status.kind).toBe("loading");
    await waitFor(() => expect(result.current.status.kind).toBe("ready"));
    const status = result.current.status;
    if (status.kind !== "ready") throw new Error("not ready");
    expect(status.index.areas.map((a) => a.title)).toEqual(["Cloud", "Frontend", "DevOps"]);
    expect(status.progress.records).toEqual({ "gcp-cdl/ALL#classic": 7 });
    expect(h.network.calls).toEqual(["/decks/index.json"]);
  });

  it("uses the cached index when the network fails", async () => {
    const h = harness(memoryStorage({ [INDEX_CACHE_KEY]: JSON.stringify(INDEX) }));
    h.network.online = false;
    const { result } = renderHook(() => useCatalog(h.services));
    await waitFor(() => expect(result.current.status.kind).toBe("ready"));
  });

  it("fails without a cached index, and loads again on retry", async () => {
    const h = harness();
    h.network.online = false;
    const { result } = renderHook(() => useCatalog(h.services));
    await waitFor(() => expect(result.current.status.kind).toBe("error"));
    h.network.online = true;
    act(() => result.current.retry());
    expect(result.current.status.kind).toBe("loading");
    await waitFor(() => expect(result.current.status.kind).toBe("ready"));
    expect(h.network.calls).toHaveLength(2);
  });

  it("runs with empty progress when storage is blocked", async () => {
    const h = harness();
    const services = { ...h.services, localStorage: () => undefined };
    const { result } = renderHook(() => useCatalog(services));
    await waitFor(() => expect(result.current.status.kind).toBe("ready"));
    const status = result.current.status;
    expect(status.kind === "ready" && status.progress).toEqual(emptyProgress());
  });
});
