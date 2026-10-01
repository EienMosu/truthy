import { describe, expect, it } from "vitest";
import {
  CardSchema,
  CatalogSchema,
  DeckFileSchema,
  DeckIndexSchema,
  ReviewedCardSchema,
  ReviewedDeckSchema,
  SourceSchema,
  WHOLE_DECK,
  routeKey,
} from "@/src/content/schema";

const source = { title: "What is Cloud Computing?", url: "https://aws.amazon.com/what-is-cloud-computing/" };

function card(overrides: Record<string, unknown> = {}) {
  return {
    id: "aws-clf-c02-t2.1-06",
    section: "SEC",
    text: { en: { statement: "AWS patches the guest operating system on EC2.", explanation: "The customer patches the guest OS." } },
    answer: false,
    source,
    difficulty: 2,
    appliesTo: "",
    conflictGroups: ["shared-responsibility-split"],
    ...overrides,
  };
}

function withStatement(statement: string) {
  return card({ text: { en: { statement, explanation: "Because." } } });
}

function withExplanation(explanation: string) {
  return card({ text: { en: { statement: "A statement.", explanation } } });
}

describe("routeKey", () => {
  it("joins the deck id and the section id with a slash", () => {
    expect(routeKey({ deckId: "aws-clf-c02", sectionId: "SEC" })).toBe("aws-clf-c02/SEC");
  });

  it("uses ALL for the whole deck", () => {
    expect(WHOLE_DECK).toBe("ALL");
    expect(routeKey({ deckId: "nextjs-rendering", sectionId: WHOLE_DECK })).toBe("nextjs-rendering/ALL");
  });
});

describe("SourceSchema", () => {
  it("accepts an https link with a title", () => {
    expect(SourceSchema.safeParse(source).success).toBe(true);
  });

  it("rejects links that are not https", () => {
    for (const url of ["http://aws.amazon.com/", "javascript:alert(1)", "ftp://example.com/file"]) {
      expect(SourceSchema.safeParse({ ...source, url }).success, url).toBe(false);
    }
  });

  it("rejects relative links and hosts without a domain", () => {
    for (const url of ["/docs/page", "https:foo", "https://localhost/x", ""]) {
      expect(SourceSchema.safeParse({ ...source, url }).success, url).toBe(false);
    }
  });

  it("rejects an empty title", () => {
    expect(SourceSchema.safeParse({ ...source, title: "" }).success).toBe(false);
  });
});

describe("CardSchema", () => {
  it("accepts a card in the shipped format", () => {
    expect(CardSchema.parse(card())).toEqual(card());
  });

  it("accepts a statement of exactly 120 characters and rejects 121", () => {
    expect(CardSchema.safeParse(withStatement("x".repeat(120))).success).toBe(true);
    expect(CardSchema.safeParse(withStatement("x".repeat(121))).success).toBe(false);
  });

  it("accepts an explanation of exactly 240 characters and rejects 241", () => {
    expect(CardSchema.safeParse(withExplanation("x".repeat(240))).success).toBe(true);
    expect(CardSchema.safeParse(withExplanation("x".repeat(241))).success).toBe(false);
  });

  it("rejects an empty statement or explanation", () => {
    expect(CardSchema.safeParse(withStatement("")).success).toBe(false);
    expect(CardSchema.safeParse(withExplanation("")).success).toBe(false);
  });

  it("accepts only difficulty 1, 2 or 3", () => {
    for (const difficulty of [1, 2, 3]) {
      expect(CardSchema.safeParse(card({ difficulty })).success).toBe(true);
    }
    for (const difficulty of [0, 4, 1.5, "2"]) {
      expect(CardSchema.safeParse(card({ difficulty })).success, String(difficulty)).toBe(false);
    }
  });

  it("drops pipeline-only fields such as misconception", () => {
    const parsed = CardSchema.parse(card({ misconception: "Customers patch nothing.", factKey: "k" }));
    expect(parsed).not.toHaveProperty("misconception");
    expect(parsed).not.toHaveProperty("factKey");
  });
});

describe("DeckFileSchema", () => {
  it("accepts a deck with one card", () => {
    expect(DeckFileSchema.safeParse({ id: "aws-clf-c02", hash: "0123456789abcdef", cards: [card()] }).success).toBe(true);
  });

  it("rejects a deck with no cards", () => {
    expect(DeckFileSchema.safeParse({ id: "aws-clf-c02", hash: "0123456789abcdef", cards: [] }).success).toBe(false);
  });
});

describe("CatalogSchema", () => {
  const deck = { id: "aws-clf-c02", code: "CLF", title: "Cloud Practitioner", sections: [] };

  it("accepts an area without platforms and a platform without decks", () => {
    const catalog = {
      areas: [
        { id: "devops", title: "DevOps", platforms: [] },
        { id: "cloud", title: "Cloud", platforms: [{ id: "azure", title: "Azure", decks: [] }] },
      ],
    };
    expect(CatalogSchema.safeParse(catalog).success).toBe(true);
  });

  it("requires a three-letter deck code", () => {
    const catalog = (code: string) => ({ areas: [{ id: "cloud", title: "Cloud", platforms: [{ id: "aws", title: "AWS", decks: [{ ...deck, code }] }] }] });
    expect(CatalogSchema.safeParse(catalog("CLF")).success).toBe(true);
    expect(CatalogSchema.safeParse(catalog("CL")).success).toBe(false);
    expect(CatalogSchema.safeParse(catalog("CLFX")).success).toBe(false);
  });

  it("requires a three-letter section id and at least one match value", () => {
    const catalog = (section: object) => ({
      areas: [{ id: "cloud", title: "Cloud", platforms: [{ id: "aws", title: "AWS", decks: [{ ...deck, sections: [section] }] }] }],
    });
    expect(CatalogSchema.safeParse(catalog({ id: "SEC", title: "Security", match: ["2.1"] })).success).toBe(true);
    expect(CatalogSchema.safeParse(catalog({ id: "SECU", title: "Security", match: ["2.1"] })).success).toBe(false);
    expect(CatalogSchema.safeParse(catalog({ id: "SEC", title: "Security", match: [] })).success).toBe(false);
  });

  it("rejects a catalog without areas", () => {
    expect(CatalogSchema.safeParse({}).success).toBe(false);
  });
});

describe("ReviewedCardSchema", () => {
  const clfCard = {
    id: "aws-clf-c02-t1.1-01",
    task: "1.1",
    statement: "Cloud agility helps teams turn new business ideas into working applications quickly.",
    answer: true,
    explanation: "On-demand resources shorten the wait for infrastructure.",
    misconception: "",
    topic: "Cloud agility",
    services: [],
    difficulty: 1,
    volatility: "stable",
    volatilityNote: "",
    source,
    revision: "original",
    conflictGroups: [],
  };
  const rndCard = {
    id: "nextjs-rendering-sr1-01",
    section: "r1",
    statement: "App Router layouts and pages are Server Components by default.",
    answer: true,
    explanation: "Route-level UI starts in the server component graph.",
    misconception: "",
    factKey: "layouts-pages-default-server-components",
    topic: "Component boundaries",
    tags: ["Server Components"],
    appliesTo: "Next.js 16",
    difficulty: 1,
    volatility: "stable",
    volatilityNote: "",
    source: { title: "Server and Client Components", url: "https://nextjs.org/docs/app/getting-started/server-and-client-components" },
    revision: "original",
    conflictGroups: [],
  };

  it("accepts a card that carries a task (the CLF format) and keeps its extra fields", () => {
    const parsed = ReviewedCardSchema.parse(clfCard);
    expect(parsed.task).toBe("1.1");
    expect(parsed).toHaveProperty("topic", "Cloud agility");
  });

  it("accepts a card that carries a section (the newer format)", () => {
    const parsed = ReviewedCardSchema.parse(rndCard);
    expect(parsed.section).toBe("r1");
    expect(parsed.appliesTo).toBe("Next.js 16");
  });

  it("rejects a card without a source", () => {
    const { source: _omitted, ...withoutSource } = clfCard;
    expect(ReviewedCardSchema.safeParse(withoutSource).success).toBe(false);
  });

  it("rejects a deck file with no cards", () => {
    expect(ReviewedDeckSchema.safeParse({ deck: "aws-clf-c02", block: "reviewed", cards: [] }).success).toBe(false);
  });

  it("accepts a deck file with a block field next to deck and cards", () => {
    expect(ReviewedDeckSchema.safeParse({ deck: "aws-clf-c02", block: "reviewed", cards: [clfCard] }).success).toBe(true);
  });
});

describe("DeckIndexSchema", () => {
  const index = (cardCount: number) => ({
    areas: [{ id: "cloud", title: "Cloud", platforms: [{ id: "aws", title: "AWS", decks: [
      { id: "aws-clf-c02", code: "CLF", title: "Cloud Practitioner", cardCount, version: "2026-10-01", hash: "0123456789abcdef", sections: [] },
    ] }] }],
  });

  it("accepts a deck with a positive card count", () => {
    expect(DeckIndexSchema.safeParse(index(214)).success).toBe(true);
  });

  it("rejects a deck with zero cards", () => {
    expect(DeckIndexSchema.safeParse(index(0)).success).toBe(false);
  });
});
