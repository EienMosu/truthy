import { describe, expect, it } from "vitest";
import type { Card, Route } from "@/src/content/schema";
import type { History } from "@/src/engine/deal";
import {
  AVAILABLE_MODES,
  CLASSIC_LENGTH,
  currentCard,
  lastAnswer,
  startRound,
  type Mode,
  type StartArgs,
} from "@/src/engine/round";

function card(id: string, answer: boolean): Card {
  return {
    id,
    section: "CON",
    text: { en: { statement: `Statement ${id}`, explanation: `Explanation ${id}` } },
    answer,
    source: { title: "AWS documentation", url: "https://docs.aws.amazon.com/" },
    difficulty: 1,
    appliesTo: "",
    conflictGroups: [],
  };
}

function pool(n: number): Card[] {
  return Array.from({ length: n }, (_, i) => card(`c${i + 1}`, i % 2 === 0));
}

const route: Route = { deckId: "aws-clf-c02", sectionId: "CON" };

function start(overrides: Partial<StartArgs> = {}) {
  return startRound({ mode: "classic", route, pool: pool(40), history: {}, seed: 1, ...overrides });
}

describe("round constants", () => {
  it("offers only Classic in step 1, with ten cards", () => {
    expect(AVAILABLE_MODES).toEqual(["classic"]);
    expect(CLASSIC_LENGTH).toBe(10);
  });
});

describe("startRound", () => {
  it("starts a Classic round on the first card, in the question phase, with no answers", () => {
    const state = start();
    expect(state.mode).toBe("classic");
    expect(state.route).toEqual(route);
    expect(state.cards).toHaveLength(10);
    expect(state.index).toBe(0);
    expect(state.answers).toEqual([]);
    expect(state.phase).toBe("question");
    expect(state.abandoned).toBe(false);
  });

  it("deals ten different cards from the pool", () => {
    const state = start();
    expect(new Set(state.cards.map((c) => c.id)).size).toBe(10);
  });

  it.each([1, 4, 9])("deals the whole pool when it has only %i cards", (n) => {
    expect(start({ pool: pool(n) }).cards).toHaveLength(n);
  });

  it("deals exactly ten from a pool of exactly ten or eleven", () => {
    expect(start({ pool: pool(10) }).cards).toHaveLength(10);
    expect(start({ pool: pool(11) }).cards).toHaveLength(10);
  });

  it("deals the same round for the same seed and a different one for another seed", () => {
    const ids = (seed: number) => start({ seed }).cards.map((c) => c.id);
    expect(ids(5)).toEqual(ids(5));
    expect(new Set([1, 2, 3, 4, 5].map((seed) => ids(seed).join(","))).size).toBeGreaterThan(1);
  });

  it("passes the history to the dealer: the cards answered wrong come back", () => {
    const history: History = {
      c1: { seen: 1, lastCorrect: false, lastSeenAt: 1 },
      c2: { seen: 1, lastCorrect: false, lastSeenAt: 2 },
    };
    const ids = start({ history }).cards.map((c) => c.id);
    expect(ids).toContain("c1");
    expect(ids).toContain("c2");
  });

  it("does not change the pool it is given", () => {
    const frozen = Object.freeze(pool(20));
    expect(() => start({ pool: frozen })).not.toThrow();
    expect(frozen.map((c) => c.id)).toEqual(pool(20).map((c) => c.id));
  });

  it.each(["streak", "lives", "timed"] as const)("rejects the %s mode, which is not available yet", (mode) => {
    expect(() => start({ mode })).toThrow(/not available/);
  });

  it("rejects a mode it does not know", () => {
    expect(() => start({ mode: "sudden-death" as Mode })).toThrow(/not available/);
  });

  it("rejects an empty pool", () => {
    expect(() => start({ pool: [] })).toThrow(/no cards/);
  });
});

describe("currentCard and lastAnswer at the start", () => {
  it("shows the first dealt card and no answer yet", () => {
    const state = start();
    expect(currentCard(state)).toBe(state.cards[0]);
    expect(lastAnswer(state)).toBeUndefined();
  });
});
