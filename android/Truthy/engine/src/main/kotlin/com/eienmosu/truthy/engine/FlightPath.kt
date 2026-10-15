package com.eienmosu.truthy.engine

import kotlin.math.PI
import kotlin.math.min

// The flight-path header (components/FlightPath.tsx): the route as a curve with one waypoint per card, the plane
// on the card on screen, and the sentences that name the header. The curve is M6 24 Q138 -6 270 24 in a 276 by
// 34 box. These are the functions; drawing them is the app's.

/** A point of the 276 by 34 box. */
data class Point(val x: Double, val y: Double)

enum class WaypointState(val wire: String) { CORRECT("correct"), WRONG("wrong"), CURRENT("current"), FUTURE("future") }

private val P0 = Point(6.0, 24.0)
private val P1 = Point(138.0, -6.0)
private val P2 = Point(270.0, 24.0)

private fun lerp(a: Point, b: Point, t: Double): Point = Point(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)

/** The point of the curve at t (0 to 1), rounded to hundredths. */
fun pointAt(t: Double): Point {
    val p = lerp(lerp(P0, P1, t), lerp(P1, P2, t), t)
    return Point(roundToHundredth(p.x), roundToHundredth(p.y))
}

/** Where waypoint i of n sits on the curve: evenly spread in t, the first at the start, the last at the end. */
fun waypointT(i: Int, n: Int): Double = if (n <= 1) 0.0 else i.toDouble() / (n - 1)

/** The flown part of the curve, from the start to t, as an SVG path (the curve split at t). */
fun flownPath(t: Double): String {
    val control = lerp(P0, P1, t)
    val end = pointAt(t)
    val cx = hundredthsText(roundToHundredth(control.x))
    val cy = hundredthsText(roundToHundredth(control.y))
    return "M${hundredthsText(P0.x)} ${hundredthsText(P0.y)} Q$cx $cy ${hundredthsText(end.x)} ${hundredthsText(end.y)}"
}

/** The plane's heading at t, in degrees (the direction of the curve), rounded to hundredths. */
fun headingAt(t: Double): Double {
    val dx = 2 * (1 - t) * (P1.x - P0.x) + 2 * t * (P2.x - P1.x)
    val dy = 2 * (1 - t) * (P1.y - P0.y) + 2 * t * (P2.y - P1.y)
    return roundToHundredth(StrictMath.atan2(dy, dx) * 180 / PI)
}

/** The state of every waypoint. */
fun waypointStates(total: Int, results: List<Boolean>, current: Int, answered: Boolean): List<WaypointState> =
    List(total) { i ->
        val result = results.getOrNull(i)
        when {
            result != null && (i < current || answered) -> if (result) WaypointState.CORRECT else WaypointState.WRONG
            i == current -> WaypointState.CURRENT
            else -> WaypointState.FUTURE
        }
    }

/** "card 3", "cards 1 and 2", "cards 1, 2 and 5". The list is never empty where this is called. */
fun cardList(numbers: List<Int>): String {
    if (numbers.size == 1) return "card ${numbers[0]}"
    val head = numbers.dropLast(1).joinToString(", ")
    return "cards $head and ${numbers.last()}"
}

/** The accessible label: "Card 4 of 10. Cards 1 and 2 correct, card 3 wrong." */
fun flightPathLabel(total: Int, results: List<Boolean>, current: Int): String {
    val correct = mutableListOf<Int>()
    val wrong = mutableListOf<Int>()
    results.forEachIndexed { i, result -> (if (result) correct else wrong).add(i + 1) }
    val parts = mutableListOf<String>()
    if (correct.isNotEmpty()) parts.add("${cardList(correct)} correct")
    if (wrong.isNotEmpty()) parts.add("${cardList(wrong)} wrong")
    val head = "Card ${current + 1} of $total."
    if (parts.isEmpty()) return head
    val tally = parts.joinToString(", ")
    return "$head ${tally.substring(0, 1).uppercase()}${tally.substring(1)}."
}

/** The accessible label of a finished round: "Round complete. 10 of 10 cards. 7 correct, 3 wrong: cards 3, 6 and 9." */
fun completedLabel(total: Int, results: List<Boolean>): String {
    val wrong = results.withIndex().filter { !it.value }.map { it.index + 1 }
    val correct = results.size - wrong.size
    val head = "Round complete. ${results.size} of $total cards. $correct correct, ${wrong.size} wrong"
    return if (wrong.isEmpty()) "$head." else "$head: ${cardList(wrong)}."
}

/**
 * The scale of the marks on a completed route (1 is a circle of radius 7 and a square of 13): full size up to
 * 10 cards, 6/7 up to 17, then as large as keeps neighbours apart (35% of the 264 wide route per gap).
 */
fun completedScale(cards: Int): Double {
    if (cards <= 10) return 1.0
    if (cards <= 17) return 6.0 / 7.0
    return min(6.0, (0.35 * 264) / (cards - 1)) / 7
}
