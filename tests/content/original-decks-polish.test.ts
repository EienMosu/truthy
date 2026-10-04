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

describe("the wording of the original decks", () => {
  // A player who answers True whenever a statement says "can" must not beat a coin flip by much: before the
  // rewording that rule scored 66% on Cloud Digital Leader and 67% on Next.js Rendering.
  it.each(ORIGINAL_DECKS)("gives no edge to answering True on 'can' in %s", (deck) => {
    const cards = reviewedCards(deck);
    const right = cards.filter((card) => /\bcan\b/i.test(card.statement) === card.answer).length;
    expect(right / cards.length).toBeLessThanOrEqual(0.56);
  });

  // "automatically" marked 10 of 11 statements False and "suits" 11 of 11 True, so the word alone gave the answer.
  it.each(["automatically", "requires", "primarily", "measures", "suits", "helps", "supports"])(
    "uses '%s' on True and on False statements alike",
    (word) => {
      const pattern = new RegExp(`\\b${word}\\b`, "i");
      const cards = ORIGINAL_DECKS.flatMap((deck) => reviewedCards(deck)).filter((card) => pattern.test(card.statement));
      if (cards.length < 5) return;
      const trueShare = cards.filter((card) => card.answer).length / cards.length;
      expect(Math.max(trueShare, 1 - trueShare)).toBeLessThanOrEqual(0.8);
    },
  );
});

describe("the statements of the original decks", () => {
  it("leave the version and the setting to the Applies to line instead of repeating them first", () => {
    // The card shows "Applies to <appliesTo>" right above the statement, so a statement that opens with
    // "In Next.js 16 with cacheComponents: false, ..." says it twice and costs a line on a small phone.
    const repeated = ORIGINAL_DECKS.flatMap((deck) => reviewedCards(deck)).filter((card) => {
      if (!card.appliesTo) return false;
      const version = card.appliesTo.split(" with ")[0] ?? "";
      const opensWithVersion = card.statement.toLowerCase().startsWith(`in ${version.toLowerCase()}`);
      const repeatsSetting = card.appliesTo.includes("cacheComponents") && card.statement.includes("cacheComponents");
      return opensWithVersion || repeatsSetting;
    });
    expect(repeated.map((card) => card.id)).toEqual([]);
  });
});

// Words that carry no content of their own, left out when an explanation is compared with its statement.
const FILLER = new Set(
  "the a an of to in on for and or is are be by with as at from that this it its can will not no only into than then so such these those which when while their there they them aws amazon rather instead does do did has have".split(" "),
);

function contentWords(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? [])
    .filter((word) => word.length > 2 && !FILLER.has(word))
    .map((word) => {
      const suffix = ["ing", "ed", "es", "s"].find((end) => word.endsWith(end) && word.length - end.length >= 4);
      return suffix ? word.slice(0, -suffix.length) : word;
    });
}

// Characters the two texts have in common, found the way Python's difflib does it: the longest common run,
// then the same search to the left and to the right of it.
function matchingCharacters(a: string, b: string): number {
  if (!a || !b) return 0;
  let best = 0;
  let endA = 0;
  let endB = 0;
  let previous = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    const current = new Array<number>(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] !== b[j - 1]) continue;
      const run = (previous[j - 1] ?? 0) + 1;
      current[j] = run;
      if (run > best) [best, endA, endB] = [run, i, j];
    }
    previous = current;
  }
  if (best === 0) return 0;
  return best + matchingCharacters(a.slice(0, endA - best), b.slice(0, endB - best)) + matchingCharacters(a.slice(endA), b.slice(endB));
}

// An explanation restates its statement when most of its content words come from the statement and it adds
// four or fewer of its own, or when the two texts are mostly the same characters in the same order.
function restates(card: ReviewedCard): boolean {
  const statementWords = new Set(contentWords(card.statement));
  const explanationWords = contentWords(card.explanation);
  const overlap = explanationWords.filter((word) => statementWords.has(word)).length / Math.max(1, explanationWords.length);
  const added = new Set(explanationWords.filter((word) => !statementWords.has(word))).size;
  const statement = card.statement.toLowerCase();
  const explanation = card.explanation.toLowerCase();
  const similarity = (2 * matchingCharacters(statement, explanation)) / (statement.length + explanation.length);
  return (overlap >= 0.6 && added <= 4) || similarity >= 0.6;
}

describe("the explanations of the original decks", () => {
  it("give a True card the reason or the mechanism behind it, not the statement again", () => {
    // A False card always corrects the statement; a True card's explanation is where the player learns why.
    const restated = ORIGINAL_DECKS.flatMap((deck) => reviewedCards(deck)).filter((card) => card.answer && restates(card));
    expect(restated.map((card) => card.id)).toEqual([]);
  });

  it("flags an explanation that only rewords its statement", () => {
    const card = reviewedCards("nextjs-rendering").find((entry) => entry.id === "nextjs-rendering-sr6-03");
    if (!card) throw new Error("nextjs-rendering-sr6-03 is missing");
    expect(restates({ ...card, explanation: "A GET Route Handler can use force-static to cache its response." })).toBe(true);
    expect(restates(card)).toBe(false);
  });
});

describe("the conflict groups of the original decks", () => {
  // In each pair the True card's explanation settles the other card, so the two must never be dealt in one round.
  it.each([
    ["aws-clf-c02-t3.2-03", "aws-clf-c02-t3.2-01"],
    ["aws-clf-c02-t2.1-09", "aws-clf-c02-t2.1-10"],
    ["aws-clf-c02-t4.1-08", "aws-clf-c02-t4.1-04"],
  ])("keep %s and %s out of one round", (first, second) => {
    const cards = new Map(reviewedCards("aws-clf-c02").map((card) => [card.id, card]));
    const shared = cards.get(first)?.conflictGroups.filter((group) => cards.get(second)?.conflictGroups.includes(group));
    expect(shared?.length).toBeGreaterThan(0);
  });
});

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
