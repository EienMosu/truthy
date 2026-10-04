import { describe, expect, it } from "vitest";
import { timedCardText } from "@/components/play/PlayScreen";
import { reduce, startRound } from "@/src/engine/round";
import { DECK, DECK_ID } from "./fixtures";

// In Timed the second and later cards are announced by a live region, not read through focus, so the
// announcement has to carry the Applies to line the card shows above the statement: some statements are only
// right under that version or setting.
describe("timedCardText for a card with an appliesTo", () => {
  it("says the Applies to line before the statement", () => {
    const pool = DECK.cards
      .filter((card) => card.section === "SEC")
      .map((card) => ({ ...card, appliesTo: "Next.js 16 with cacheComponents: true" }));
    const question = reduce(startRound({ mode: "timed", route: { deckId: DECK_ID, sectionId: "SEC" }, pool, history: {}, seed: 1 }), { type: "tick", now: 0 });
    const first = question.cards[0];
    if (!first) throw new Error("no card");
    const second = reduce(reduce(question, { type: "answer", value: first.answer, at: 500 }), { type: "tick", now: 1200 });
    const card = second.cards[second.index];
    if (second.index !== 1 || !card) throw new Error("the second card was not dealt");
    expect(timedCardText(second)).toBe(`Card 2. Applies to Next.js 16 with cacheComponents: true. ${card.text.en.statement}`);
  });
});
