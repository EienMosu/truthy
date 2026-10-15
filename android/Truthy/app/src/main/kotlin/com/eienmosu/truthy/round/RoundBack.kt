package com.eienmosu.truthy.round

import kotlin.coroutines.cancellation.CancellationException
import kotlinx.coroutines.flow.Flow

/** The round surface's scale at back progress p (spec 5.2): 1 at rest, 0.94 at the end, clamped. */
fun roundBackScale(progress: Float): Float {
    val p = if (progress.isNaN()) 0f else progress.coerceIn(0f, 1f)
    return 1f - (1f - LeaveResultConstants.ROUND_BACK_MIN_SCALE) * p
}

// What the X, Escape and back do is task 11's (AppController.requestLeave and roundBack, rule 1); this file only
// turns the system's back progress into the round surface's scale.

/**
 * Follows one back gesture: every progress value becomes a scale for `show`. Returning normally is a commit (below
 * API 34 the flow ends at once with no value, so the surface never leaves 1); a cancelled gesture calls `onCancel`
 * and rethrows, as PredictiveBackHandler requires.
 */
suspend fun followRoundBack(progress: Flow<Float>, show: suspend (Float) -> Unit, onCancel: () -> Unit) {
    try {
        progress.collect { show(roundBackScale(it)) }
    } catch (cancelled: CancellationException) {
        onCancel()
        throw cancelled
    }
}
