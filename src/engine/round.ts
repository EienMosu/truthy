// The round: a pure reducer over the dealt cards (spec section 6, "Shape" and "Modes").
// Randomness comes only from the seed given to startRound; time comes in on the events.

import type { Card, Route } from "@/src/content/schema";
import type { Answered, History, Mode, RoundResult } from "@/src/content/play";
import { CHUNK, dealChunk } from "./deal";
import { createRng } from "./rng";

export type { Answered, Mode, RoundResult } from "@/src/content/play";

export const AVAILABLE_MODES: readonly Mode[] = ["classic", "streak", "lives"]; // the modes this engine can play; Timed follows
export const CLASSIC_LENGTH = CHUNK; // a Classic round is the first chunk
export const LIVES = 3;

export type Phase = "question" | "answered" | "finished";

// What the next chunk is dealt from: the route's cards, the stored history, the round's seed and how many
// chunks it has dealt.
export interface DealSource {
  pool: readonly Card[];
  history: History;
  seed: number;
  chunks: number;
}

export interface RoundState {
  mode: Mode;
  route: Route;
  cards: readonly Card[]; // every card dealt so far, in order; the unbounded modes add a chunk when they run out
  index: number; // index of the current card
  answers: readonly Answered[];
  phase: Phase;
  abandoned: boolean;
  source: DealSource;
}

export type RoundEvent = { type: "answer"; value: boolean; at: number } | { type: "next" } | { type: "abandon" };

export interface StartArgs {
  mode: Mode;
  route: Route;
  pool: readonly Card[];
  history: History;
  seed: number;
}

// The seed of chunk k of a round: the round's seed for the first chunk, then steps of the 32-bit golden
// ratio. Math.imul and >>> 0 keep it an unsigned 32-bit integer, as the Swift and Kotlin clones compute it.
export function chunkSeed(seed: number, chunk: number): number {
  return (seed + Math.imul(chunk, 0x9e3779b9)) >>> 0;
}

function withNextChunk(state: RoundState): RoundState {
  const { pool, history, seed, chunks } = state.source;
  const chunk = dealChunk(pool, history, createRng(chunkSeed(seed, chunks)), state.cards);
  return { ...state, cards: [...state.cards, ...chunk], source: { ...state.source, chunks: chunks + 1 } };
}

// Throws if the mode is not in AVAILABLE_MODES or the pool is empty.
export function startRound(args: StartArgs): RoundState {
  if (!AVAILABLE_MODES.includes(args.mode)) {
    throw new Error(`The mode "${args.mode}" is not available.`);
  }
  if (args.pool.length === 0) {
    throw new Error(`The route ${args.route.deckId}/${args.route.sectionId} has no cards to deal.`);
  }
  return withNextChunk({
    mode: args.mode,
    route: args.route,
    cards: [],
    index: 0,
    answers: [],
    phase: "question",
    abandoned: false,
    source: { pool: args.pool, history: args.history, seed: args.seed, chunks: 0 },
  });
}

// The card on screen; undefined once the round is finished.
export function currentCard(state: RoundState): Card | undefined {
  return state.phase === "finished" ? undefined : state.cards[state.index];
}

export function lastAnswer(state: RoundState): Answered | undefined {
  return state.answers[state.answers.length - 1];
}

export function wrongCount(state: RoundState): number {
  return state.answers.filter((answer) => !answer.correct).length;
}

export function livesLeft(state: RoundState): number {
  return Math.max(0, LIVES - wrongCount(state));
}

// Decided: the mode's end rule has been met and only the result is left to show. No answer can change the
// score any more; the next event finishes the round.
export function isDecided(state: RoundState): boolean {
  if (state.phase === "finished") return false;
  switch (state.mode) {
    case "classic":
      return state.phase === "answered" && state.index + 1 >= state.cards.length;
    case "streak":
      return state.phase === "answered" && lastAnswer(state)?.correct === false;
    case "lives":
      return state.phase === "answered" && wrongCount(state) >= LIVES;
    case "timed":
      return false; // task 6
  }
}

// Pure: returns a new state, or the very same state when the event does not apply.
export function reduce(state: RoundState, event: RoundEvent): RoundState {
  if (state.phase === "finished") return state;
  switch (event.type) {
    case "answer":
      return state.phase === "question" ? recordAnswer(state, event.value, event.at) : state;
    case "next":
      if (isDecided(state)) return { ...state, phase: "finished" };
      return state.phase === "answered" ? advance(state) : state;
    case "abandon":
      return { ...state, phase: "finished", abandoned: true };
    default:
      return state;
  }
}

// To the next card as a question. When the dealt cards run out, the next chunk is dealt first
// (dealChunk never returns an empty chunk).
function advance(state: RoundState): RoundState {
  const index = state.index + 1;
  const dealt = index < state.cards.length ? state : withNextChunk(state);
  return { ...dealt, index, phase: "question" };
}

function recordAnswer(state: RoundState, given: boolean, at: number): RoundState {
  const card = state.cards[state.index];
  if (card === undefined) return state;
  return { ...state, answers: [...state.answers, { card, given, correct: given === card.answer, at }], phase: "answered" };
}

// The number a mode's record keeps (spec section 6, "Modes").
export function scoreOf(mode: Mode, answers: readonly Answered[]): number {
  switch (mode) {
    case "classic":
    case "timed":
      return answers.filter((answer) => answer.correct).length;
    case "streak":
      return longestRun(answers);
    case "lives":
      return answers.length;
  }
}

function longestRun(answers: readonly Answered[]): number {
  let longest = 0;
  let run = 0;
  for (const answer of answers) {
    run = answer.correct ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  return longest;
}

export function summarise(state: RoundState): RoundResult {
  return {
    mode: state.mode,
    route: state.route,
    score: scoreOf(state.mode, state.answers),
    total: state.answers.length,
    answers: state.answers,
    missed: state.answers.filter((answer) => !answer.correct),
    abandoned: state.abandoned,
  };
}
