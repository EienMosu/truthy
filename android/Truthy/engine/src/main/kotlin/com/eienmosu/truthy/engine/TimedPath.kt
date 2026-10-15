package com.eienmosu.truthy.engine

import kotlin.math.ceil
import kotlin.math.max

// The header of a Timed round (components/TimedPath.tsx): the route stands for the minute.

/** The Timed minute in whole seconds (60). */
internal val TIMED_SECONDS: Int = (TIMED.roundMs / 1000.0).toInt()

private fun wholeSeconds(remainingMs: Double): Int = ceil(max(0.0, remainingMs) / 1000).toInt()

/** The clock: "1:00", "0:41", "0:00". The seconds are rounded up, so it says "0:00" only when the time is up. */
fun clockText(remainingMs: Double): String {
    val seconds = wholeSeconds(remainingMs)
    return "${seconds / 60}:${(seconds % 60).toString().padStart(2, '0')}"
}

/** The accessible name of the header. Built from the whole seconds, so it changes at most once a second. */
fun timedLabel(remainingMs: Double, correct: Int, wrong: Int): String {
    val seconds = wholeSeconds(remainingMs)
    if (seconds == 0) {
        val n = correct + wrong
        return "Time is up. $n ${if (n == 1) "card" else "cards"} answered: $correct correct, $wrong wrong."
    }
    return "$seconds ${if (seconds == 1) "second" else "seconds"} left of $TIMED_SECONDS. $correct correct, $wrong wrong."
}
