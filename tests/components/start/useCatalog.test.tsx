// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { bestFor, continueTarget, deckCount, decksLabel, seenPercent, useCatalog } from "@/components/start/useCatalog";
import { INDEX_CACHE_KEY } from "@/src/content/load";
import { findRoute } from "@/src/content/schema";
import { emptyProgress, type Progress } from "@/src/progress/progress";
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
    expect(continueTarget(INDEX, progressWith({ last: { ...last, mode: "streak" } }))).toBeNull();
  });

  it("brings the score of the last round, and none after a round that was left", () => {
    const last = { route: { deckId: "aws-clf-c02", sectionId: "SEC" }, mode: "classic" as const, score: 7, total: 10 };
    expect(continueTarget(INDEX, progressWith({ last }))?.lastScore).toEqual({ score: 7, total: 10 });
    expect(continueTarget(INDEX, progressWith({ last: { ...last, score: null, total: null } }))?.lastScore).toBeNull();
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
