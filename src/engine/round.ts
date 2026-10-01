// The round: a pure reducer over the dealt cards (spec section 6, "Shape" and "Modes").
// Randomness comes only from the seed given to startRound; time comes in on the events.

import type { Answered, History, Mode, RoundResult } from "@/src/content/play";
import type { Card, Route } from "@/src/content/schema";
import { deal } from "./deal";
import { createRng } from "./rng";

export type { Answered, Mode, RoundResult } from "@/src/content/play";
export const AVAILABLE_MODES: readonly Mode[] = ["classic"]; // step 1
export const CLASSIC_LENGTH = 10;

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

// Pure: returns a new state, or the very same state when the event does not apply to the phase.
export function reduce(state: RoundState, event: RoundEvent): RoundState {
  switch (event.type) {
    case "answer":
      return state.phase === "question" ? recordAnswer(state, event.value, event.at) : state;
    case "next":
      return state.phase === "answered" ? moveOn(state) : state;
    case "abandon":
      return state.phase === "finished" ? state : { ...state, phase: "finished", abandoned: true };
    default:
      return state;
  }
}

function recordAnswer(state: RoundState, given: boolean, at: number): RoundState {
  const card = currentCard(state);
  if (card === undefined) return state;
  const answered: Answered = { card, given, correct: given === card.answer, at };
  return { ...state, answers: [...state.answers, answered], phase: "answered" };
}

// To the next card, or to the end after the last one. The index stays on the last card when finished.
function moveOn(state: RoundState): RoundState {
  const nextIndex = state.index + 1;
  if (nextIndex >= state.cards.length) return { ...state, phase: "finished" };
  return { ...state, index: nextIndex, phase: "question" };
}

export function summarise(state: RoundState): RoundResult {
  return {
    mode: state.mode,
    route: state.route,
    score: state.answers.filter((a) => a.correct).length,
    total: state.answers.length,
    answers: state.answers,
    missed: state.answers.filter((a) => !a.correct),
    abandoned: state.abandoned,
  };
}
