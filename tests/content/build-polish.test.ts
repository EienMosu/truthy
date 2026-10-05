import { describe, expect, it } from "vitest";
import { DeckBuildError, buildDecks } from "@/src/content/build";

const VERSION = "2026-10-01";

function reviewedCard(id: string, mapping: { task?: string; section?: string }, overrides: Record<string, unknown> = {}) {
  return {
    id,
    ...mapping,
    statement: `Statement of ${id}.`,
    answer: true,
    explanation: `Explanation of ${id}.`,
    difficulty: 2,
    source: { title: "Docs", url: "https://docs.aws.amazon.com/" },
    conflictGroups: [],
    ...overrides,
  };
}

const clfEntry = {
  id: "aws-clf-c02",
  code: "CLF",
  title: "Cloud Practitioner",
  sections: [
    { id: "CON", title: "Cloud concepts", match: ["1.1", "1.2"] },
    { id: "SEC", title: "Security and compliance", match: ["2.1"] },
  ],
};

function build(...cards: unknown[]) {
  const catalog = { areas: [{ id: "cloud", title: "Cloud", platforms: [{ id: "aws", title: "AWS", decks: [clfEntry] }] }] };
  const reviewed = { "aws-clf-c02": { deck: "aws-clf-c02", block: "reviewed", cards } };
  return buildDecks({ catalog, reviewed, version: VERSION });
}

function buildError(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(DeckBuildError);
    return (error as Error).message;
  }
  throw new Error("the build did not fail");
}

const valid = reviewedCard("aws-clf-c02-t1.1-01", { task: "1.1" });

// Review finding U135: the card id prefix includes the dash, so a deck cannot adopt another deck's cards.
describe("buildDecks: the card id prefix", () => {
  it("fails on an id that only starts like the deck id, without the dash", () => {
    const message = buildError(() => build(reviewedCard("aws-clf-c02x-01", { task: "1.1" })));
    expect(message).toContain("card aws-clf-c02x-01: the card id must start with aws-clf-c02-");
  });
});

// Review finding U135: a card may carry both a task and a section; either one may place it, and two sections
// that both match are ambiguous. No shipped card has both today, so only these tests hold the rule.
describe("buildDecks: a card with both a task and a section", () => {
  function sectionOf(mapping: { task?: string; section?: string }): string | undefined {
    return build(reviewedCard("aws-clf-c02-t1.1-01", mapping)).decks[0]?.cards[0]?.section;
  }

  it("is placed by its section when its task matches nothing", () => {
    expect(sectionOf({ task: "x", section: "2.1" })).toBe("SEC");
  });

  it("is placed by its task when its section matches nothing", () => {
    expect(sectionOf({ task: "1.1", section: "x" })).toBe("CON");
  });

  it("fails when the task and the section match different sections", () => {
    const message = buildError(() => build(reviewedCard("aws-clf-c02-t1.1-01", { task: "1.1", section: "2.1" })));
    expect(message).toContain("card aws-clf-c02-t1.1-01: 1.1 / 2.1 matches more than one section (CON, SEC)");
  });

  it("is placed once when the task and the section match the same section", () => {
    expect(sectionOf({ task: "1.1", section: "1.2" })).toBe("CON");
  });
});

// Review finding U136: a card that cannot even be read is named by its position, never by an empty label.
describe("buildDecks: naming a card that has no usable id", () => {
  it("names a null card by its position", () => {
    const message = buildError(() => build(valid, null));
    expect(message).toContain("aws-clf-c02: card #2:");
  });

  it("names a card with an empty id by its position", () => {
    const message = buildError(() => build(valid, reviewedCard("", { task: "1.1" })));
    expect(message).toContain("aws-clf-c02: card #2:");
    expect(message).not.toContain("card :");
  });

  it("names a card with an id that is not text by its position", () => {
    const message = buildError(() => build(valid, reviewedCard("x", { task: "1.1" }, { id: 7 })));
    expect(message).toContain("aws-clf-c02: card #2:");
  });
});
