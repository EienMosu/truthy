package com.eienmosu.truthy.round

import com.eienmosu.truthy.engine.Mode
import com.eienmosu.truthy.engine.RoundState
import com.eienmosu.truthy.engine.SWIPE
import com.eienmosu.truthy.engine.isDecided
import kotlin.math.abs

/** The haptics of spec 5.5. */
enum class RoundHaptic { THRESHOLD, CONFIRM, REJECT }

/**
 * The haptic a change of the round earns: a recorded answer confirms or rejects; the Timed clock reaching zero
 * rejects (also when an answer runs it out, which records no answer). Anything else is silent.
 */
fun verdictHaptic(before: RoundState, after: RoundState): RoundHaptic? {
    if (after.answers.size > before.answers.size) {
        return if (after.answers.last().correct) RoundHaptic.CONFIRM else RoundHaptic.REJECT
    }
    if (after.mode == Mode.TIMED && isDecided(after) && !isDecided(before)) return RoundHaptic.REJECT
    return null
}

/** The 90 commit line of one drag: true once for each crossing; moving back under it re-arms it silently. */
class CommitLine(private val distance: Double = SWIPE.commitPx) {
    private var beyond = false

    fun crossed(dx: Double): Boolean {
        val now = abs(dx) >= distance
        val fires = now && !beyond
        beyond = now
        return fires
    }
}
