// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LOAD_FAILED_MESSAGE, ticketFor, useRound, type RoundStatus } from "@/components/play/useRound";
import { findRoute } from "@/src/content/schema";
import { PROGRESS_KEY } from "@/src/progress/local";
import { emptyProgress, parseProgress } from "@/src/progress/progress";
import { DECK_ID, INDEX, harness, memoryStorage, type Harness } from "./fixtures";

afterEach(cleanup);

function run(h: Harness) {
  const goHome = vi.fn();
  const hook = renderHook(() => useRound(h.services, goHome));
  return { goHome, hook, status: () => hook.result.current.status };
}

async function ready(status: () => RoundStatus) {
  await waitFor(() => expect(status().kind).toBe("ready"));
  const current = status();
  if (current.kind !== "ready") throw new Error("not ready");
  return current;
}

describe("useRound", () => {
  it("goes home without loading anything when there is no pending round", async () => {
    const h = harness(null);
    const { goHome, status } = run(h);
    await waitFor(() => expect(goHome).toHaveBeenCalledTimes(1));
    expect(status().kind).toBe("redirecting");
    expect(h.network.calls).toEqual([]);
  });

  it("goes home when the deck is no longer in the index", async () => {
    const { goHome, status } = run(harness({ route: { deckId: "gone-deck", sectionId: "SEC" }, mode: "classic" }));
    await waitFor(() => expect(goHome).toHaveBeenCalledTimes(1));
    expect(status().kind).toBe("redirecting");
  });

  it("goes home when the section is no longer in the deck", async () => {
    const { goHome } = run(harness({ route: { deckId: DECK_ID, sectionId: "OLD" }, mode: "classic" }));
    await waitFor(() => expect(goHome).toHaveBeenCalledTimes(1));
  });

  it("is loading first, then deals a Classic round of ten cards from the section", async () => {
    const h = harness();
    const { status } = run(h);
    expect(status().kind).toBe("loading");
    const { round, ticket } = await ready(status);
    expect(round.phase).toBe("question");
    expect(round.cards).toHaveLength(10);
    expect(round.cards.every((card) => card.section === "SEC")).toBe(true);
    expect(ticket).toEqual({
      deckCode: "TST",
      deckName: "AWS Test deck",
      sectionCode: "SEC",
      sectionName: "Security and compliance",
      modeLabel: "Classic",
    });
    expect(h.network.calls).toEqual(["/decks/index.json", `/decks/${DECK_ID}.json?v=hash-1`]);
  });

  it("names a whole-deck route ALL, Whole deck and deals from every card", async () => {
    const { status } = run(harness({ route: { deckId: DECK_ID, sectionId: "ALL" }, mode: "classic" }));
    const { round, ticket } = await ready(status);
    expect(ticket.sectionCode).toBe("ALL");
    expect(ticket.sectionName).toBe("Whole deck");
    expect(round.route).toEqual({ deckId: DECK_ID, sectionId: "ALL" });
  });

  it("deals the same cards for the same seed", async () => {
    const first = await ready(run(harness()).status);
    cleanup();
    const second = await ready(run(harness()).status);
    expect(second.round.cards.map((c) => c.id)).toEqual(first.round.cards.map((c) => c.id));
  });

  it("deals with the stored card history: a card missed before comes back", async () => {
    const missed = `${DECK_ID}-sec-12`;
    const stored = { ...emptyProgress(), cards: { [missed]: { seen: 1, lastCorrect: false, lastSeenAt: 5 } } };
    const { status } = run(harness(undefined, memoryStorage({ [PROGRESS_KEY]: JSON.stringify(stored) })));
    const { round } = await ready(status);
    expect(round.cards.map((c) => c.id)).toContain(missed);
  });

  it("drops stored history of this deck's cards that no longer exist, and keeps the rest", async () => {
    const stored = {
      ...emptyProgress(),
      cards: {
        [`${DECK_ID}-gone-01`]: { seen: 2, lastCorrect: true, lastSeenAt: 5 },
        "other-deck-01": { seen: 1, lastCorrect: true, lastSeenAt: 5 },
      },
    };
    const h = harness(undefined, memoryStorage({ [PROGRESS_KEY]: JSON.stringify(stored) }));
    await ready(run(h).status);
    expect(Object.keys(parseProgress(h.local.getItem(PROGRESS_KEY)).cards)).toEqual(["other-deck-01"]);
  });

  it("runs the round on the engine's reducer", async () => {
    const { hook, status } = run(harness());
    await ready(status);
    act(() => hook.result.current.dispatch({ type: "answer", value: true, at: 1 }));
    const after = status();
    expect(after.kind === "ready" && after.round.phase).toBe("answered");
  });

  it("reports a load failure and loads again on retry", async () => {
    const h = harness();
    h.network.online = false;
    const { hook, status } = run(h);
    await waitFor(() => expect(status()).toEqual({ kind: "error", message: LOAD_FAILED_MESSAGE }));
    h.network.online = true;
    act(() => hook.result.current.retry());
    expect(status().kind).toBe("loading");
    await ready(status);
  });

  it("shows the load message for a network failure without logging", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const h = harness();
      h.network.online = false;
      const { status } = run(h);
      await waitFor(() => expect(status()).toEqual({ kind: "error", message: LOAD_FAILED_MESSAGE }));
      expect(log).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });

  it("logs a failure that is not a load failure and still shows the message", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const h = harness();
      const failure = new Error("no entropy");
      h.services.randomSeed = () => {
        throw failure;
      };
      const { status } = run(h);
      await waitFor(() => expect(status()).toEqual({ kind: "error", message: LOAD_FAILED_MESSAGE }));
      expect(log).toHaveBeenCalledTimes(1);
      expect(log).toHaveBeenCalledWith(failure);
    } finally {
      log.mockRestore();
    }
  });

  it("plays from the cached index and deck when the network fails", async () => {
    const local = memoryStorage();
    await ready(run(harness(undefined, local)).status);
    cleanup();
    const offline = harness(undefined, local);
    offline.network.online = false;
    const { round } = await ready(run(offline).status);
    expect(round.cards).toHaveLength(10);
  });

  it("starts a fresh round on the same route with restart", async () => {
    const { hook, status } = run(harness());
    await ready(status);
    act(() => hook.result.current.dispatch({ type: "answer", value: true, at: 1 }));
    act(() => hook.result.current.restart());
    expect(status().kind).toBe("loading");
    const { round } = await ready(status);
    expect(round.answers).toEqual([]);
    expect(round.phase).toBe("question");
  });

  it("gives the progress store on the device", async () => {
    const h = harness();
    const { hook, status } = run(h);
    await ready(status);
    hook.result.current.progressStore().save({ ...emptyProgress(), records: { [`${DECK_ID}/SEC#classic`]: 7 } });
    expect(parseProgress(h.local.getItem(PROGRESS_KEY)).records).toEqual({ [`${DECK_ID}/SEC#classic`]: 7 });
  });
});

// Review finding F4: the ticket names the deck by its pass name when the index gives one.
describe("ticketFor: the deck name on the ticket", () => {
  const route = { deckId: DECK_ID, sectionId: "SEC" };

  function found(index: typeof INDEX) {
    const result = findRoute(index, route);
    if (result === null) throw new Error("no route");
    return result;
  }

  it("is the platform and the deck title", () => {
    expect(ticketFor(found(INDEX), "classic").deckName).toBe("AWS Test deck");
  });

  it("is the deck's pass name when it has one", () => {
    const index = structuredClone(INDEX);
    const deck = index.areas[0]?.platforms[0]?.decks[0];
    if (!deck) throw new Error("no deck");
    deck.passName = "Amazon Test deck";
    expect(ticketFor(found(index), "classic").deckName).toBe("Amazon Test deck");
  });
});
