package com.eienmosu.truthy.engine

import kotlin.math.max
import kotlin.math.min

// The header of a Three lives round (components/LivesPath.tsx): three hearts, a mini trail with one mark per
// answered card, and the sentence that names it.

class TrailLayout(
    /** x of mark i (0 is the oldest). */
    val x: (Int) -> Double,
    /** Radius of a correct dot. */
    val r: Double,
    /** Side of a wrong square. */
    val side: Double,
    /** Wrong squares carry their x (always: the side never drops below 6). */
    val cross: Boolean,
)

/** Where the marks of the answered cards sit on the line y 17. */
fun trailLayout(marks: Int): TrailLayout {
    // Up to 14 marks: 9 apart, the newest at x 219 next to the plane (14 marks start at x 102).
    if (marks <= 14) return TrailLayout(x = { i -> (219 - 9 * (marks - 1 - i)).toDouble() }, r = 2.6, side = 9.0, cross = true)
    // More: squeezed between x 100 and x 219. A wrong square keeps a side of at least 6 with its x however long the round.
    val step = 119.0 / (marks - 1)
    val side = max(6.0, min(8.0, roundToTenth(step * 1.3)))
    return TrailLayout(x = { i -> roundToTenth(100 + i * step) }, r = min(2.2, roundToTenth(step * 0.45)), side = side, cross = true)
}

/** The accessible name of the header. */
fun livesLabel(results: List<Boolean>): String {
    val wrong = results.withIndex().filter { !it.value }.map { it.index + 1 }
    val left = max(0, LIVES - wrong.size)
    val n = results.size
    val verb = if (wrong.size == 1) "was" else "were"
    if (left == 0) return "No lives left. The round is over after $n cards: ${cardList(wrong)} $verb wrong."
    val head = "$left of $LIVES lives left."
    if (n == 0) return "$head No cards answered yet."
    val answered = "$n ${if (n == 1) "card" else "cards"} answered"
    if (wrong.isEmpty()) return "$head $answered."
    return "$head $answered, ${cardList(wrong)} $verb wrong."
}
