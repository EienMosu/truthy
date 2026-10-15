package com.eienmosu.truthy.engine

import java.util.IdentityHashMap

/** How long after the result shows its actions (Play again, Choose another route, Close results) take presses. */
const val RESULT_ARRIVES_MS: Double = 1000.0

/**
 * The progress outcome of recording a finished round: its answers into the card history, its route and score
 * as `last`, and the record when it beats the stored one. `stored` is the progress as loaded.
 */
fun recordRound(round: RoundState, stored: Progress): ApplyOutcome = applyResult(stored, summarise(round))

/** The outcome of recording a round, and whether this call is the one that must write `outcome.progress`. */
data class Recording(val outcome: ApplyOutcome, val write: Boolean)

/**
 * Records each round exactly once, as the web does with a weak map keyed by the round: the first call for a
 * round computes the outcome and says to write; later calls for the same round object return that very outcome
 * and say not to write. `preview` gives the outcome the result shows in its first frame, before the write, and
 * the remembered one afterwards. A recorder belongs to one screen and is used from one thread; the round is
 * the same object each time (identity, not equality). The caller loads `stored` before each call and, when
 * `write` is true, saves `outcome.progress`; the load and the save are the app's (task 9).
 */
class RoundRecorder {
    private val recorded = IdentityHashMap<RoundState, ApplyOutcome>()

    fun preview(round: RoundState, stored: Progress): ApplyOutcome = recorded[round] ?: recordRound(round, stored)

    fun record(round: RoundState, stored: Progress): Recording {
        val done = recorded[round]
        if (done != null) return Recording(done, write = false)
        val outcome = recordRound(round, stored)
        recorded[round] = outcome
        return Recording(outcome, write = true)
    }
}
