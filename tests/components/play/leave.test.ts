import { describe, expect, it } from "vitest";
import { saveLeftRound } from "@/components/play/leave";
import { poolFor } from "@/src/content/load";
import { currentCard, isDecided, reduce, startRound, type RoundState } from "@/src/engine/round";
import { PROGRESS_KEY, createLocalStore } from "@/src/progress/local";
import { parseProgress } from "@/src/progress/progress";
import { DECK, DECK_ID, memoryStorage } from "./fixtures";

const ROUTE = { deckId: DECK_ID, sectionId: "SEC" };

// A Classic round with two answers given and the third card still open.
function roundWithTwoAnswers(): RoundState {
  let round = startRound({ mode: "classic", route: ROUTE, pool: poolFor(DECK, "SEC"), history: {}, seed: 12345 });
  round = reduce(round, { type: "answer", value: true, at: 1000 });
  round = reduce(round, { type: "next" });
  round = reduce(round, { type: "answer", value: false, at: 2000 });
  return reduce(round, { type: "next" });
}

describe("saveLeftRound", () => {
  it("keeps the answers in the card history, remembers the route without a score and sets no record", () => {
    const storage = memoryStorage();
    const round = roundWithTwoAnswers();
    saveLeftRound(round, createLocalStore(storage));
    const progress = parseProgress(storage.getItem(PROGRESS_KEY));
    for (const answer of round.answers) expect(progress.cards[answer.card.id]?.seen).toBe(1);
    expect(Object.keys(progress.cards)).toHaveLength(2);
    expect(progress.records).toEqual({});
    expect(progress.last).toEqual({ route: ROUTE, mode: "classic", score: null, total: null });
  });

  it("saves a decided round that is left as abandoned: the answers are kept, no record is set", () => {
    const storage = memoryStorage();
    let round = startRound({ mode: "streak", route: ROUTE, pool: poolFor(DECK, "SEC"), history: {}, seed: 12345 });
    for (let i = 0; i < 3; i += 1) {
      const answer = currentCard(round)?.answer ?? true;
      round = reduce(round, { type: "answer", value: answer, at: 1000 * (i + 1) });
      round = reduce(round, { type: "next" });
    }
    round = reduce(round, { type: "answer", value: !(currentCard(round)?.answer ?? true), at: 5000 });
    expect(isDecided(round)).toBe(true);
    saveLeftRound(round, createLocalStore(storage));
    const progress = parseProgress(storage.getItem(PROGRESS_KEY));
    expect(progress.records).toEqual({});
    expect(Object.values(progress.cards)).toHaveLength(4);
    for (const answer of round.answers) expect(progress.cards[answer.card.id]?.seen).toBe(1);
    expect(progress.last).toEqual({ route: ROUTE, mode: "streak", score: null, total: null });
  });

  it("does not throw when the store cannot save", () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    };
    expect(() => saveLeftRound(roundWithTwoAnswers(), createLocalStore(storage))).not.toThrow();
  });
});
