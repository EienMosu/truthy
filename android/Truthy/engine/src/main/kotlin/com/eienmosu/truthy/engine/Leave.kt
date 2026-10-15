package com.eienmosu.truthy.engine

/**
 * Whether leaving this round leaves anything to save: answers to keep, or a decided round (the Timed minute
 * can run out with nothing answered). A round left before both saves nothing: the caller asks this first.
 */
fun leavesSomething(round: RoundState): Boolean = round.answers.isNotEmpty() || isDecided(round)

/**
 * The progress after a round the player is leaving. Before its deciding answer its answers go into the card
 * history and it sets no record (the round is abandoned). After it (the Streak ended, the third life was lost,
 * the Timed minute ran out, the last Classic card was answered) only the result was left to open, so the round
 * is recorded as its result would record it: card history, record and score. `stored` is the progress as
 * loaded; saving the result is the caller's.
 */
fun saveLeftRound(round: RoundState, stored: Progress): Progress {
    val ended = reduce(round, if (isDecided(round)) RoundEvent.Next else RoundEvent.Abandon)
    return applyResult(stored, summarise(ended)).progress
}
