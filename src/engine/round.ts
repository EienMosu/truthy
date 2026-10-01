// The round: a pure reducer over the dealt cards (spec section 6, "Shape" and "Modes").
// Randomness comes only from the seed given to startRound; time comes in on the events.

import type { Card, Route } from "@/src/content/schema";
import { deal, type History } from "./deal";
import { createRng } from "./rng";

export type Mode = "classic" | "streak" | "lives" | "timed";
export const AVAILABLE_MODES: readonly Mode[] = ["classic"]; // step 1
export const CLASSIC_LENGTH = 10;

export interface Answered {
  card: Card;
  given: boolean;
  correct: boolean;
  at: number;
}
export type Phase = "question" | "answered" | "finished";

export interface RoundState {
  mode: Mode;
  route: Route;
  cards: readonly Card[]; // the dealt cards
  index: number; // index of the current card
  answers: readonly Answered[];
  phase: Phase;
  abandoned: boolean;
}

export type RoundEvent = { type: "answer"; value: boolean; at: number } | { type: "next" } | { type: "abandon" };

export interface StartArgs {
  mode: Mode;
  route: Route;
  pool: readonly Card[];
  history: History;
  seed: number;
}

// Throws if the mode is not in AVAILABLE_MODES or the pool is empty.
export function startRound(args: StartArgs): RoundState {
  if (!AVAILABLE_MODES.includes(args.mode)) {
    throw new Error(`The mode "${args.mode}" is not available.`);
  }
  if (args.pool.length === 0) {
    throw new Error(`The route ${args.route.deckId}/${args.route.sectionId} has no cards to deal.`);
  }
  const cards = deal(args.pool, args.history, createRng(args.seed), { count: CLASSIC_LENGTH });
  return { mode: args.mode, route: args.route, cards, index: 0, answers: [], phase: "question", abandoned: false };
}

// The card on screen; undefined once the round is finished.
export function currentCard(state: RoundState): Card | undefined {
  return state.phase === "finished" ? undefined : state.cards[state.index];
}

export function lastAnswer(state: RoundState): Answered | undefined {
  return state.answers[state.answers.length - 1];
}
