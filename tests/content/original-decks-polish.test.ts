import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The four decks that shipped first were written before the newer decks had their review for tells and
// metadata, so these checks pin what that later pass fixed in them. They read content/reviewed, the files
// the deck build turns into public/decks.
const ORIGINAL_DECKS = ["aws-clf-c02", "aws-saa-c03", "gcp-cdl", "nextjs-rendering"] as const;

type ReviewedCard = {
  id: string;
  statement: string;
  answer: boolean;
  explanation: string;
  appliesTo?: string;
  source: { title: string; url: string };
  conflictGroups: string[];
};

function reviewedCards(deck: string): ReviewedCard[] {
  const file = JSON.parse(readFileSync(new URL(`../../content/reviewed/${deck}.json`, import.meta.url), "utf8"));
  return file.cards as ReviewedCard[];
}

describe("the sources of the original decks", () => {
  it("give each link one title, so the same page reads the same on every card", () => {
    const titles = new Map<string, Set<string>>();
    for (const deck of ORIGINAL_DECKS) {
      for (const card of reviewedCards(deck)) {
        const seen = titles.get(card.source.url) ?? new Set<string>();
        seen.add(card.source.title);
        titles.set(card.source.url, seen);
      }
    }
    const several = [...titles].filter(([, seen]) => seen.size > 1).map(([url, seen]) => [url, [...seen]]);
    expect(several).toEqual([]);
  });

  it("give two different pages of one deck two different titles", () => {
    for (const deck of ORIGINAL_DECKS) {
      const links = new Map<string, Set<string>>();
      for (const card of reviewedCards(deck)) {
        const seen = links.get(card.source.title) ?? new Set<string>();
        seen.add(card.source.url);
        links.set(card.source.title, seen);
      }
      const shared = [...links].filter(([, seen]) => seen.size > 1).map(([title]) => title);
      expect(shared, deck).toEqual([]);
    }
  });

  it("cite the address a page ends up at, not one that redirects to it", () => {
    // Both answered with a permanent redirect when the decks were checked: the first to /savingsplans/faqs/,
    // the second to the pay-as-you-go pricing page.
    const redirecting = ["https://aws.amazon.com/savingsplans/faq/", "https://aws.amazon.com/directconnect/pricing/"];
    const cited = ORIGINAL_DECKS.flatMap((deck) => reviewedCards(deck)).filter((card) => redirecting.includes(card.source.url));
    expect(cited.map((card) => card.id)).toEqual([]);
  });
});
