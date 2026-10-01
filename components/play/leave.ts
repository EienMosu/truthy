// Leaving a round for any reason but its end: the close button, the back gesture, the browser's back.
import { reduce, summarise, type RoundState } from "@/src/engine/round";
import type { ProgressStore } from "@/src/progress/local";
import { applyResult } from "@/src/progress/progress";

/** Saves a round the player is leaving: its answers go into the card history, it sets no record. */
export function saveLeftRound(round: RoundState, store: ProgressStore): void {
  store.save(applyResult(store.load(), summarise(reduce(round, { type: "abandon" }))).progress);
}
