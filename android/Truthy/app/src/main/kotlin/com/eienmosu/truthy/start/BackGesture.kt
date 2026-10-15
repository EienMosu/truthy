package com.eienmosu.truthy.start

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.Flow

/** How a back gesture ended: committed (with the last progress reported, or none at all), or cancelled. */
sealed interface BackEnd {
    data class Committed(val lastProgress: Float?) : BackEnd
    data object Cancelled : BackEnd
}

/**
 * Follows one back gesture the way PredictiveBackHandler hands it over: each progress value scrubs the back motion;
 * the flow completing is a commit; a CancellationException is a cancel, reported and then rethrown so the
 * handler's coroutine still ends cancelled. Below Android 14 (and for `onBackPressed`) the flow completes with no
 * value, which `Committed(null)` reports: an instant commit.
 */
suspend fun followBack(progress: Flow<Float>, onProgress: (Float) -> Unit, onEnd: (BackEnd) -> Unit) {
    var last: Float? = null
    try {
        progress.collect { value ->
            last = value
            onProgress(value)
        }
    } catch (cancelled: CancellationException) {
        onEnd(BackEnd.Cancelled)
        throw cancelled
    }
    onEnd(BackEnd.Committed(last))
}
