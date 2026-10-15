package com.eienmosu.truthy.round

import com.eienmosu.truthy.engine.Point
import com.eienmosu.truthy.engine.completedScale
import com.eienmosu.truthy.engine.pointAt
import com.eienmosu.truthy.engine.waypointT
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

/** One mark of a completed route, in the 276 by 34 drawing's units. */
data class MarkPlacement(val index: Int, val correct: Boolean, val at: Point, val scale: Double, val plain: Boolean)

/** The Streak ring where the previous best was reached. */
data class RingPlacement(val at: Point, val radius: Double)

/** Drawn in order: `below`, then the ring, then `above` (wrong squares enlarged past their neighbours). */
data class CompletedMarks(val below: List<MarkPlacement>, val ring: RingPlacement?, val above: List<MarkPlacement>)

// The geometry of components/FlightPath.tsx CompletedMarks: a mark is a circle of radius 7 or a square of 13 at
// scale 1; a correct mark under radius 5 loses its tick; a wrong square keeps a side of at least 6; the route is 264
// long; the ring sits 3.5 outside its dot while that leaves it clear of the next one.
private const val MARK_RADIUS = 7.0
private const val PLAIN_BELOW_RADIUS = 5.0
private const val WRONG_MIN_SCALE = 6.0 / 13.0
private const val ROUTE_LENGTH = 264.0
private const val RING_GAP = 3.5

fun completedMarks(results: List<Boolean>, total: Int, ring: Int?): CompletedMarks {
    val scale = completedScale(total)
    val plainCorrect = MARK_RADIUS * scale < PLAIN_BELOW_RADIUS
    val wrongScale = max(scale, WRONG_MIN_SCALE)
    val lifted = wrongScale > scale
    val marks = results.take(total).mapIndexed { i, correct ->
        MarkPlacement(
            index = i,
            correct = correct,
            at = pointAt(waypointT(i, total)),
            scale = if (correct) scale else wrongScale,
            plain = if (correct) plainCorrect else false,
        )
    }
    val below = if (lifted) marks.filter { it.correct } else marks
    val above = if (lifted) marks.filter { !it.correct } else emptyList()
    val ringAt = if (ring == null || ring < 0 || ring >= total) null else pointAt(waypointT(ring, total))
    val gap = if (total <= 1) Double.POSITIVE_INFINITY else ROUTE_LENGTH / (total - 1)
    val ringOffset = min(RING_GAP, (gap - 2 * MARK_RADIUS * scale) / 2)
    return CompletedMarks(
        below = below,
        ring = ringAt?.let { RingPlacement(at = it, radius = round2(MARK_RADIUS * scale + ringOffset)) },
        above = above,
    )
}

// JavaScript's Math.round(value * 100) / 100: floor(x + 0.5), not Kotlin's half-to-even rounding.
private fun round2(value: Double): Double = floor(value * 100 + 0.5) / 100
