import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// REQ of Next.js Rendering keeps only one conflict group, so a Classic round may deal any two of its other cards
// together. These checks pin the explanations that once settled another REQ card's answer, so that a later rewording
// does not bring such a pair back while the cards stay ungrouped.

type ReviewedCard = {
  id: string;
  section: string;
  explanation: string;
  conflictGroups: string[];
};

const cards = (
  JSON.parse(readFileSync(new URL("../../content/reviewed/nextjs-rendering.json", import.meta.url), "utf8")).cards as ReviewedCard[]
).filter((card) => card.section === "r2");

function card(id: string): ReviewedCard {
  const found = cards.find((c) => c.id === `nextjs-rendering-${id}`);
  if (!found) throw new Error(`no REQ card ${id}`);
  return found;
}

function sharesGroup(a: ReviewedCard, b: ReviewedCard): boolean {
  return a.conflictGroups.some((group) => b.conflictGroups.includes(group));
}

describe("the REQ cards of Next.js Rendering", () => {
  // sr2-01 asks whether the RSC Payload is the HTML document. An explanation that sets the payload against HTML,
  // such as "the server sends the RSC Payload, not HTML", answers it for the player.
  it("tells no ungrouped card's reader whether the RSC Payload is HTML", () => {
    const payloadCard = card("sr2-01");
    const tellers = cards
      .filter((c) => c !== payloadCard && !sharesGroup(c, payloadCard))
      .filter((c) => /RSC Payload/i.test(c.explanation) && /\bHTML\b/.test(c.explanation))
      .map((c) => c.id);
    expect(tellers).toEqual([]);
  });

  // sr2-03 asks whether a direct visit renders a Client Component to HTML on the server. Saying that a navigation
  // skips "newly server-rendered HTML" implies the first visit had it.
  it("keeps the navigation card from implying how a direct visit renders", () => {
    expect(sharesGroup(card("sr2-04"), card("sr2-03"))).toBe(false);
    expect(card("sr2-04").explanation).not.toMatch(/\bnewly\b|server-rendered HTML/i);
  });
});
