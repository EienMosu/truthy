// The round: a pure reducer over the dealt cards (spec section 6, "Shape" and "Modes").
// Randomness comes only from the seed given to startRound; time comes in on the events.

import type { Card, Route } from "@/src/content/schema";
import { MODES, type Answered, type History, type Mode, type RoundResult } from "@/src/content/play";
import { CHUNK, dealChunk } from "./deal";
import { createRng } from "./rng";

export type { Answered, Mode, RoundResult } from "@/src/content/play";

export const CLASSIC_LENGTH = CHUNK; // a Classic round is the first chunk
export const LIVES = 3;
// Timed: the length of the round, how long the stamp stays before the next card, and the most time one
// tick may count (a longer gap is a sleep the page did not report).
export const TIMED = { roundMs: 60_000, holdMs: 700, maxStepMs: 1_000 } as const;

export type Phase = "question" | "answered" | "stamped" | "finished";

// The Timed clock. It only moves on events: lastTick is the moment up to which time has been counted
// (null before the first tick and while hidden); holdMs is what is left of the stamp.
export interface Clock {
  remainingMs: number;
  lastTick: number | null;
  hidden: boolean;
  holdMs: number;
}

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
  clock: Clock | null; // Timed only
}

export type RoundEvent =
  | { type: "answer"; value: boolean; at: number }
  | { type: "next" }
  | { type: "tick"; now: number }
  | { type: "visibility"; hidden: boolean; at: number }
  | { type: "abandon" };

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

// Throws for a mode it does not know or an empty pool.
export function startRound(args: StartArgs): RoundState {
  if (!(MODES as readonly string[]).includes(args.mode)) {
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
    clock: args.mode === "timed" ? { remainingMs: TIMED.roundMs, lastTick: null, hidden: false, holdMs: 0 } : null,
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
      return state.clock !== null && state.clock.remainingMs === 0;
  }
}

// Pure: returns a new state, or the very same state when the event does not apply.
// An event whose time is not a finite number does not apply: one NaN would make the Timed clock NaN for good,
// and a clock that is never 0 never ends the round.
export function reduce(state: RoundState, event: RoundEvent): RoundState {
  if (state.phase === "finished") return state;
  if (!Number.isFinite(timeOf(event))) return state;
  switch (event.type) {
    case "answer":
      return state.phase === "question" ? recordAnswer(state, event.value, event.at) : state;
    case "next":
      if (isDecided(state)) return { ...state, phase: "finished" };
      return state.phase === "answered" ? advance(state) : state;
    case "tick":
      return state.clock === null ? state : onTick(state, state.clock, event.now);
    case "visibility":
      return state.clock === null ? state : onVisibility(state, state.clock, event.hidden, event.at);
    case "abandon":
      return { ...state, phase: "finished", abandoned: true };
    default:
      return state;
  }
}

// The moment an event happened; 0 for the events that carry no time.
function timeOf(event: RoundEvent): number {
  switch (event.type) {
    case "answer":
    case "visibility":
      return event.at;
    case "tick":
      return event.now;
    default:
      return 0;
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
  const answers = [...state.answers, { card, given, correct: given === card.answer, at }];
  if (state.clock === null) return { ...state, answers, phase: "answered" };
  // Timed: the clock runs up to the answer first. An answer at or after zero does not count.
  const clock = countTo(state.clock, at);
  if (clock.remainingMs === 0) return { ...state, clock, phase: "stamped" };
  return { ...state, answers, phase: "stamped", clock: { ...clock, holdMs: TIMED.holdMs } };
}

// The time to count between the last counted moment and `now`: none while hidden or before the first
// tick, never negative (a clock source may jump back), at most maxStepMs.
function elapsed(clock: Clock, now: number): number {
  if (clock.hidden || clock.lastTick === null) return 0;
  return Math.min(Math.max(0, now - clock.lastTick), TIMED.maxStepMs);
}

function countTo(clock: Clock, now: number): Clock {
  if (clock.hidden) return clock;
  return { ...clock, remainingMs: Math.max(0, clock.remainingMs - elapsed(clock, now)), lastTick: now };
}

function onTick(state: RoundState, clock: Clock, now: number): RoundState {
  if (clock.remainingMs === 0 || clock.hidden) return state;
  const passed = elapsed(clock, now);
  const counted = countTo(clock, now);
  if (counted.remainingMs === 0) {
    // Time is up. A card that was being stamped has been answered in time: it leaves, and the card that
    // does not count is the next one.
    const stopped = { ...counted, holdMs: 0 };
    const onCard = state.phase === "stamped" ? advance({ ...state, clock: stopped }) : { ...state, clock: stopped };
    return { ...onCard, phase: "stamped" };
  }
  if (state.phase !== "stamped") return { ...state, clock: counted };
  const holdMs = Math.max(0, clock.holdMs - passed);
  if (holdMs > 0) return { ...state, clock: { ...counted, holdMs } };
  return advance({ ...state, clock: { ...counted, holdMs: 0 } });
}

function onVisibility(state: RoundState, clock: Clock, hidden: boolean, at: number): RoundState {
  if (clock.remainingMs === 0 || clock.hidden === hidden) return state;
  if (!hidden) return { ...state, clock: { ...clock, hidden: false, lastTick: at } };
  // Hiding counts the time up to this moment, as a tick does, then pauses.
  const counted = onTick(state, clock, at);
  if (counted.clock === null || counted.clock.remainingMs === 0) return counted;
  return { ...counted, clock: { ...counted.clock, hidden: true, lastTick: null } };
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
