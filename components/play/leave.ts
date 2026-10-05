// Leaving a round for any reason but its end: the close button, the back gesture, the browser's back.
import { isDecided, reduce, summarise, type RoundState } from "@/src/engine/round";
import type { ProgressStore } from "@/src/progress/local";
import { applyResult } from "@/src/progress/progress";

/**
 * Whether leaving this round leaves anything to save: answers to keep, or a decided round (the Timed minute
 * can run out with nothing answered). A round left before both saves nothing.
 */
export function leavesSomething(round: RoundState): boolean {
  return round.answers.length > 0 || isDecided(round);
}

/**
 * Saves a round the player is leaving. Before its deciding answer its answers go into the card history and it
 * sets no record. After it (the Streak ended, the third life was lost, the Timed minute ran out, the last
 * Classic card was answered) only the result was left to open, so the round is recorded as its result would
 * record it: card history, record and score.
 */
export function saveLeftRound(round: RoundState, store: ProgressStore): void {
  const ended = reduce(round, { type: isDecided(round) ? "next" : "abandon" });
  store.save(applyResult(store.load(), summarise(ended)).progress);
}
