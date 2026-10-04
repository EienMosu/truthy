// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MissedCards, missedCards } from "@/components/MissedCards";
import type { Answered } from "@/src/engine/round";
import { DECK } from "./play/fixtures";

afterEach(cleanup);

// Some statements are only right under the version or setting of their card: "the revalidate export remains
// supported" is False with cacheComponents on and True with it off. The play card says which above the
// statement, so the missed list has to say it too, or it shows a statement and an answer that read wrong.
describe("the missed list of a card with an appliesTo", () => {
  const applied = DECK.cards.find((card) => card.appliesTo !== "");
  const plain = DECK.cards.find((card) => card.appliesTo === "");
  if (!applied || !plain) throw new Error("the fixture deck needs a card with an appliesTo and one without");

  it("carries the card's appliesTo, and none for a card without one", () => {
    const answers: Answered[] = [
      { card: applied, given: !applied.answer, correct: false, at: 1 },
      { card: plain, given: !plain.answer, correct: false, at: 2 },
    ];
    const [first, second] = missedCards(answers);
    expect(first?.appliesTo).toBe(applied.appliesTo);
    expect(second?.appliesTo).toBeUndefined();
  });

  it("shows the Applies to line above the statement, as the play card does", () => {
    const answers: Answered[] = [
      { card: applied, given: !applied.answer, correct: false, at: 1 },
      { card: plain, given: !plain.answer, correct: false, at: 2 },
    ];
    const { container } = render(<MissedCards missed={missedCards(answers)} />);
    const [withScope, without] = Array.from(container.querySelectorAll<HTMLElement>("[data-missed-card]"));
    if (!withScope || !without) throw new Error("the list has fewer than two cards");
    const line = within(withScope).getByText(`Applies to ${applied.appliesTo}`);
    const statement = within(withScope).getByText(applied.text.en.statement);
    expect(line.compareDocumentPosition(statement) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(without).queryByText(/^Applies to/)).toBeNull();
    expect(screen.getAllByText(/^Applies to/)).toHaveLength(1);
  });
});
