// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PassStatement } from "@/components/BoardingPass";
import { MissedCards, type MissedCard } from "@/components/MissedCards";

afterEach(cleanup);

const QUALIFIER = "Next.js 16 with cacheComponents: false";

const ITEM: MissedCard = {
  number: 3,
  given: true,
  answer: false,
  appliesTo: QUALIFIER,
  statement: "A route's revalidate export remains supported.",
  explanation: "With cacheComponents off, the route segment config still applies.",
  source: { title: "Route Segment Config", url: "https://nextjs.org/docs" },
};

// The play card shows the qualifier alone and keeps "Applies to" for screen readers, because the whole phrase
// wrapped on a phone (review finding U95). The missed list sits in a narrower column, so it does the same.
describe("the Applies to line of a missed card", () => {
  it("shows the qualifier alone, hidden from screen readers, and gives them the whole phrase", () => {
    const { container } = render(<MissedCards missed={[ITEM]} />);
    const card = container.querySelector<HTMLElement>("[data-missed-card]");
    if (!card) throw new Error("the list has no card");
    const spoken = within(card).getByText(`Applies to ${QUALIFIER}`);
    expect(spoken.className).toContain("sr-only");
    const shown = within(card).getByText(QUALIFIER);
    expect(shown.getAttribute("aria-hidden")).toBe("true");
    expect(shown.parentElement).toBe(spoken.parentElement);
  });

  it("wraps a long qualifier into lines of even length, as the play card does", () => {
    render(<PassStatement appliesTo={QUALIFIER}>{ITEM.statement}</PassStatement>);
    expect(screen.getByText(QUALIFIER).parentElement?.className).toContain("text-balance");
    cleanup();
    render(<MissedCards missed={[ITEM]} />);
    expect(screen.getByText(QUALIFIER).parentElement?.className).toContain("text-balance");
  });
});
