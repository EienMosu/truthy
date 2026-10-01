import { createHash } from "node:crypto";
import {
  CatalogSchema,
  ReviewedDeckSchema,
  WHOLE_DECK,
  type Card,
  type Catalog,
  type DeckFile,
  type DeckIndex,
  type IndexDeck,
  type ReviewedDeck,
} from "./schema";

export interface BuildInput {
  catalog: unknown;
  reviewed: Record<string, unknown>; // keyed by deck id
  version: string; // ISO date of this build
}

export interface BuildOutput {
  index: DeckIndex;
  decks: DeckFile[];
}

// The message names the deck, the card id and the reason, so a failed build says what to fix.
export class DeckBuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeckBuildError";
  }
}

type CatalogDeck = Catalog["areas"][number]["platforms"][number]["decks"][number];
type ReviewedCard = ReviewedDeck["cards"][number];

// First 16 hex characters of the sha256 of the cards as JSON. The client refetches a deck when this changes.
export function hashDeck(cards: Card[]): string {
  return createHash("sha256").update(JSON.stringify(cards)).digest("hex").slice(0, 16);
}

function cardError(deckId: string, cardId: string, reason: string): DeckBuildError {
  return new DeckBuildError(`${deckId}: card ${cardId}: ${reason}`);
}

function parseCatalog(raw: unknown): Catalog {
  const result = CatalogSchema.safeParse(raw);
  if (!result.success) throw new DeckBuildError(`catalog: ${result.error.message}`);
  return result.data;
}

function parseReviewed(deckId: string, raw: unknown): ReviewedDeck {
  const result = ReviewedDeckSchema.safeParse(raw);
  if (!result.success) throw new DeckBuildError(`${deckId}: ${result.error.message}`);
  return result.data;
}

function sectionFor(entry: CatalogDeck, card: ReviewedCard): string {
  if (entry.sections.length === 0) return WHOLE_DECK;
  const values = [card.task, card.section].filter((value): value is string => value !== undefined);
  if (values.length === 0) throw cardError(entry.id, card.id, "has neither a task nor a section to place it in a section");
  const matched = entry.sections.filter((section) => values.some((value) => section.match.includes(value)));
  const [only] = matched;
  if (!only) throw cardError(entry.id, card.id, `${values.join(" / ")} matches no section`);
  if (matched.length > 1) {
    throw cardError(entry.id, card.id, `${values.join(" / ")} matches more than one section (${matched.map((section) => section.id).join(", ")})`);
  }
  return only.id;
}

function toCard(entry: CatalogDeck, card: ReviewedCard): Card {
  return {
    id: card.id,
    section: sectionFor(entry, card),
    text: { en: { statement: card.statement, explanation: card.explanation } },
    answer: card.answer,
    source: { title: card.source.title, url: card.source.url },
    difficulty: card.difficulty as Card["difficulty"],
    appliesTo: card.appliesTo ?? "",
    conflictGroups: card.conflictGroups ?? [],
  };
}

function buildDeck(entry: CatalogDeck, raw: unknown, version: string): { file: DeckFile; summary: IndexDeck } {
  const reviewed = parseReviewed(entry.id, raw);
  const cards = reviewed.cards.map((card) => toCard(entry, card));
  const file: DeckFile = { id: entry.id, hash: hashDeck(cards), cards };
  const sections = entry.sections.map((section) => ({
    id: section.id,
    title: section.title,
    cardCount: cards.filter((card) => card.section === section.id).length,
  }));
  const summary: IndexDeck = {
    id: entry.id,
    code: entry.code,
    title: entry.title,
    cardCount: cards.length,
    version,
    hash: file.hash,
    sections,
  };
  return { file, summary };
}

export function buildDecks(input: BuildInput): BuildOutput {
  const catalog = parseCatalog(input.catalog);
  const decks: DeckFile[] = [];
  const index: DeckIndex = {
    areas: catalog.areas.map((area) => ({
      id: area.id,
      title: area.title,
      platforms: area.platforms.map((platform) => ({
        id: platform.id,
        title: platform.title,
        decks: platform.decks.flatMap((entry) => {
          // A catalog deck without a reviewed file is not available yet and is left out.
          if (!Object.hasOwn(input.reviewed, entry.id)) return [];
          const { file, summary } = buildDeck(entry, input.reviewed[entry.id], input.version);
          decks.push(file);
          return [summary];
        }),
      })),
    })),
  };
  return { index, decks };
}
