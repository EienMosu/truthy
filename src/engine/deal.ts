// Dealing: which cards a round gets, and in which order (spec section 6, "Dealing").
// Pure: the only source of randomness is the rng passed in.

import type { Card } from "@/src/content/schema";
import { shuffle, type Rng } from "./rng";

export interface CardHistory {
  seen: number;
  lastCorrect: boolean;
  lastSeenAt: number;
}
export type History = Readonly<Record<string, CardHistory>>; // by card id

export const DEAL = { missedPerTen: 3, minTrue: 4, maxTrue: 6, maxRun: 3 } as const;

export interface DealOptions {
  count: number; // how many cards to deal
  avoid?: readonly Card[]; // cards whose conflict groups must not be repeated (unbounded modes pass the last ten; Classic passes nothing)
}

export function deal(pool: readonly Card[], history: History, rng: Rng, options: DealOptions): Card[] {
  const cards = uniqueById(pool);
  const size = dealSize(options.count, cards.length);
  if (size === 0) return [];
  const ranking = rankByPriority(cards, history, rng, size);
  return [...ranking.withinCap, ...ranking.overCap].slice(0, size);
}

// The first card with each id wins, so a card can never be dealt twice.
function uniqueById(pool: readonly Card[]): Card[] {
  const seen = new Set<string>();
  return pool.filter((card) => {
    if (seen.has(card.id)) return false;
    seen.add(card.id);
    return true;
  });
}

function dealSize(count: number, available: number): number {
  if (Number.isNaN(count) || count <= 0) return 0;
  return Math.min(Math.floor(count), available);
}

function wasSeen(card: Card, history: History): boolean {
  const entry = history[card.id];
  return entry !== undefined && entry.seen > 0;
}

function wasMissed(card: Card, history: History): boolean {
  return wasSeen(card, history) && history[card.id]?.lastCorrect === false;
}

function lastSeenAt(card: Card, history: History): number {
  const at = history[card.id]?.lastSeenAt;
  return at !== undefined && Number.isFinite(at) ? at : 0;
}

// Oldest first. Array.prototype.sort is stable, so equal times keep their (shuffled) order.
function oldestFirst(cards: readonly Card[], history: History): Card[] {
  return [...cards].sort((a, b) => lastSeenAt(a, history) - lastSeenAt(b, history));
}

// The pool in the order cards should be considered: missed cards up to the cap (oldest miss first),
// never seen (random), seen longest ago. The missed cards over the cap are kept apart, to be used only
// when a deal cannot be made without them. Shuffling first makes every tie random but reproducible.
interface Ranking {
  withinCap: Card[];
  overCap: Card[];
}

function rankByPriority(cards: readonly Card[], history: History, rng: Rng, size: number): Ranking {
  const shuffled = shuffle(cards, rng);
  const missed = oldestFirst(shuffled.filter((card) => wasMissed(card, history)), history);
  const unseen = shuffled.filter((card) => !wasSeen(card, history));
  const seenRight = oldestFirst(shuffled.filter((card) => wasSeen(card, history) && !wasMissed(card, history)), history);
  const missedCap = Math.floor((size * DEAL.missedPerTen) / 10);
  return {
    withinCap: [...missed.slice(0, missedCap), ...unseen, ...seenRight],
    overCap: missed.slice(missedCap),
  };
}
