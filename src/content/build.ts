import { createHash } from "node:crypto";
import { z } from "zod";
import {
  CardSchema,
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

const LIMITS = { statement: 120, explanation: 240 } as const;

function describeIssue(issue: z.core.$ZodIssue | undefined): string {
  if (!issue) return "is not valid";
  const path = issue.path.map(String).join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}

function parseCatalog(raw: unknown): Catalog {
  const result = CatalogSchema.safeParse(raw);
  if (!result.success) throw new DeckBuildError(`catalog: ${describeIssue(result.error.issues[0])}`);
  const catalog = result.data;
  const areaIds = new Set<string>();
  const deckIds = new Set<string>();
  for (const area of catalog.areas) {
    if (areaIds.has(area.id)) throw new DeckBuildError(`catalog: area ${area.id} is listed twice`);
    areaIds.add(area.id);
    const platformIds = new Set<string>();
    for (const platform of area.platforms) {
      if (platformIds.has(platform.id)) throw new DeckBuildError(`catalog: area ${area.id}: platform ${platform.id} is listed twice`);
      platformIds.add(platform.id);
      for (const deck of platform.decks) {
        if (deckIds.has(deck.id)) throw new DeckBuildError(`catalog: deck ${deck.id} is listed twice`);
        deckIds.add(deck.id);
        const sectionIds = new Set<string>();
        for (const section of deck.sections) {
          if (section.id === WHOLE_DECK) {
            throw new DeckBuildError(`catalog: deck ${deck.id}: section id ${WHOLE_DECK} is reserved for the whole deck`);
          }
          if (sectionIds.has(section.id)) throw new DeckBuildError(`catalog: deck ${deck.id}: section ${section.id} is listed twice`);
          sectionIds.add(section.id);
        }
      }
    }
  }
  // A card's history belongs to the deck whose id, followed by "-", starts the card id (pruneDeck and the
  // seen bar go by it), so a deck id that starts another deck id that way would claim that deck's history.
  for (const id of deckIds) {
    const other = [...deckIds].find((candidate) => candidate.startsWith(`${id}-`));
    if (other !== undefined) throw new DeckBuildError(`catalog: deck id ${id} is a prefix of deck ${other}`);
  }
  return catalog;
}

// The id of the card at a position in a file that failed validation, or its position when it has none.
function cardLabel(raw: unknown, position: number): string {
  const cards: unknown = typeof raw === "object" && raw !== null ? (raw as { cards?: unknown }).cards : undefined;
  const card: unknown = Array.isArray(cards) ? cards[position] : undefined;
  const id: unknown = typeof card === "object" && card !== null ? (card as { id?: unknown }).id : undefined;
  return typeof id === "string" && id.length > 0 ? id : `#${position + 1}`;
}

function parseReviewed(deckId: string, raw: unknown): ReviewedDeck {
  const result = ReviewedDeckSchema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    const [first, position, ...rest] = issue?.path ?? [];
    if (issue && first === "cards" && typeof position === "number") {
      throw new DeckBuildError(`${deckId}: card ${cardLabel(raw, position)}: ${describeIssue({ ...issue, path: rest })}`);
    }
    throw new DeckBuildError(`${deckId}: ${describeIssue(issue)}`);
  }
  if (result.data.deck !== deckId) throw new DeckBuildError(`${deckId}: the reviewed file is for deck ${result.data.deck}`);
  return result.data;
}

function checkCard(deckId: string, card: ReviewedCard, seen: Set<string>): void {
  if (!card.id.startsWith(`${deckId}-`)) throw cardError(deckId, card.id, `the card id must start with ${deckId}-`);
  if (seen.has(card.id)) throw cardError(deckId, card.id, "the card id is used twice");
  seen.add(card.id);
  for (const field of ["statement", "explanation"] as const) {
    const text = card[field];
    if (text.trim().length === 0) throw cardError(deckId, card.id, `${field} is empty`);
    if (text.length > LIMITS[field]) {
      throw cardError(deckId, card.id, `${field} is ${text.length} characters, the limit is ${LIMITS[field]}`);
    }
  }
  if (![1, 2, 3].includes(card.difficulty)) {
    throw cardError(deckId, card.id, `difficulty must be 1, 2 or 3, not ${card.difficulty}`);
  }
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

// Each card lists a group once. A group that only one card uses cannot conflict with anything and is dropped.
function sharedGroups(cards: readonly ReviewedCard[]): Set<string> {
  const uses = new Map<string, number>();
  for (const card of cards) {
    for (const group of new Set(card.conflictGroups ?? [])) uses.set(group, (uses.get(group) ?? 0) + 1);
  }
  return new Set([...uses].filter(([, count]) => count > 1).map(([group]) => group));
}

function toCard(entry: CatalogDeck, card: ReviewedCard, shared: ReadonlySet<string>): Card {
  const shipped = {
    id: card.id,
    section: sectionFor(entry, card),
    text: { en: { statement: card.statement, explanation: card.explanation } },
    answer: card.answer,
    source: { title: card.source.title, url: card.source.url },
    difficulty: card.difficulty,
    appliesTo: card.appliesTo ?? "",
    conflictGroups: [...new Set(card.conflictGroups ?? [])].filter((group) => shared.has(group)),
  };
  // A last guard: whatever ships must pass the schema the client validates with.
  const result = CardSchema.safeParse(shipped);
  if (!result.success) throw cardError(entry.id, card.id, describeIssue(result.error.issues[0]));
  return result.data;
}

function buildDeck(entry: CatalogDeck, raw: unknown, version: string): { file: DeckFile; summary: IndexDeck } {
  const reviewed = parseReviewed(entry.id, raw);
  const seen = new Set<string>();
  for (const card of reviewed.cards) checkCard(entry.id, card, seen);
  const shared = sharedGroups(reviewed.cards);
  const cards = reviewed.cards.map((card) => toCard(entry, card, shared));
  const file: DeckFile = { id: entry.id, hash: hashDeck(cards), cards };
  // A section that no card falls into is not available yet and is left out, like a deck without a reviewed file.
  const sections = entry.sections
    .map((section) => ({
      id: section.id,
      title: section.title,
      cardCount: cards.filter((card) => card.section === section.id).length,
    }))
    .filter((section) => section.cardCount > 0);
  const summary: IndexDeck = {
    id: entry.id,
    code: entry.code,
    title: entry.title,
    ...(entry.passName === undefined ? {} : { passName: entry.passName }),
    cardCount: cards.length,
    version,
    hash: file.hash,
    sections,
  };
  return { file, summary };
}

export function buildDecks(input: BuildInput): BuildOutput {
  if (!z.iso.date().safeParse(input.version).success) {
    throw new DeckBuildError(`version must be an ISO date (YYYY-MM-DD), not ${input.version}`);
  }
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
