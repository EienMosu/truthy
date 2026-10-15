package com.eienmosu.truthy.engine

import kotlin.math.max
import kotlin.math.min

// The header of a Streak round (components/StreakPath.tsx): one dot per correct answer along the route, the plane
// on the card on screen, and a ring where the best is.

class StreakLayout(
    /** Where slot i sits on the curve, 0 to 1. */
    val t: (Int) -> Double,
    /** Radius of a done dot. */
    val dot: Double,
    /** Done dots carry a tick (dot >= 5). */
    val ticks: Boolean,
    /** The slot of the best (best - 1), or null without a best (null or 0). */
    val ring: Int?,
    /** The ring is at or ahead of the card on screen: the route ends on it. */
    val target: Boolean,
    /** The open slots between the card on screen and the ring. */
    val future: List<Int>,
)

/** The layout for `done` dots (the card on screen is slot `done`) and the best on the route. */
fun streakLayout(done: Int, best: Int?): StreakLayout {
    val ring = if (best == null || best < 1) null else best - 1
    // The ring while the best is still ahead: the slots spread over the whole curve and the ring ends it.
    val ahead: Int? = if (ring != null && done <= ring) ring else null
    // At or past the best, or without one, the route runs on into open sky, a little short of the end.
    val step = if (ahead != null) 1.0 / max(ahead, 1) else 1.0 / (done + 1.6)
    val dot = min(6.0, roundToTenth(264 * step * 0.31))
    val future = if (ahead != null) List(max(0, ahead - done - 1)) { done + 1 + it } else emptyList()
    return StreakLayout(t = { slot -> min(1.0, slot * step) }, dot = dot, ticks = dot >= 5, ring = ring, target = ahead != null, future = future)
}

/** The accessible name of the header. A best of 0 counts as no best. */
fun streakLabel(streak: Int, best: Int?, ended: Boolean): String {
    val start = if (ended) "Streak ended at $streak" else "Streak of $streak correct ${if (streak == 1) "answer" else "answers"}"
    if (best == null || best < 1) return "$start."
    if (streak < best) return "$start. Your best on this route is $best."
    if (streak == best) return "$start, equal to your best on this route."
    return "$start. New best on this route, previous best $best."
}
