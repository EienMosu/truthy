import { describe, expect, it } from "vitest";
import { CardSchema, DeckFileSchema, DeckIndexSchema, SourceSchema } from "@/src/content/schema";

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
    conflictGroups: [],
    ...overrides,
  };
}

// Review finding U132: the protocol pattern is anchored at both ends. A scheme that merely starts or ends like
// "https" would open in a new tab as a source link.
describe("SourceSchema: the protocol is exactly https", () => {
  it.each(["httpsx://aws.amazon.com/", "xhttps://aws.amazon.com/", "https-x://aws.amazon.com/", "HTTP://aws.amazon.com/"])(
    "rejects %s",
    (url) => {
      expect(SourceSchema.safeParse({ ...source, url }).success).toBe(false);
    },
  );
});

// Review finding U133: the client trusts files the build wrote, but a stale cached or tampered file must still
// fail loudly instead of offering an empty section or a card without an id.
describe("DeckFileSchema: the minimums a cached file must keep", () => {
  const deck = (overrides: Record<string, unknown>) => ({ id: "aws-clf-c02", hash: "0123456789abcdef", cards: [card()], ...overrides });

  it("accepts the deck these cases start from", () => {
    expect(DeckFileSchema.safeParse(deck({})).success).toBe(true);
  });

  it("rejects an empty hash", () => {
    expect(DeckFileSchema.safeParse(deck({ hash: "" })).success).toBe(false);
  });

  it("rejects a card with an empty id", () => {
    expect(CardSchema.safeParse(card({ id: "" })).success).toBe(false);
    expect(DeckFileSchema.safeParse(deck({ cards: [card({ id: "" })] })).success).toBe(false);
  });

  it("rejects a card with an empty section", () => {
    expect(CardSchema.safeParse(card({ section: "" })).success).toBe(false);
    expect(DeckFileSchema.safeParse(deck({ cards: [card({ section: "" })] })).success).toBe(false);
  });
});

describe("DeckIndexSchema: card counts are whole numbers above zero", () => {
  const index = (deckCount: number, sectionCount: number) => ({
    areas: [
      {
        id: "cloud",
        title: "Cloud",
        platforms: [
          {
            id: "aws",
            title: "AWS",
            decks: [
              {
                id: "aws-clf-c02",
                code: "CLF",
                title: "Cloud Practitioner",
                cardCount: deckCount,
                version: "2026-10-01",
                hash: "0123456789abcdef",
                sections: [{ id: "SEC", title: "Security", cardCount: sectionCount }],
              },
            ],
          },
        ],
      },
    ],
  });

  it("accepts positive whole counts", () => {
    expect(DeckIndexSchema.safeParse(index(214, 40)).success).toBe(true);
  });

  it.each([1.5, 0, -1])("rejects a deck count of %s", (count) => {
    expect(DeckIndexSchema.safeParse(index(count, 40)).success).toBe(false);
  });

  it.each([1.5, 0, -1])("rejects a section count of %s, so an empty section is never offered", (count) => {
    expect(DeckIndexSchema.safeParse(index(214, count)).success).toBe(false);
  });
});
