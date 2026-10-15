package com.eienmosu.truthy.engine

import kotlin.math.abs

// Every rounding goes through task 1's jsRound, the module's one port of JavaScript's Math.round.

/** Math.round(value * 100) / 100, the rounding of the flight path's coordinates and angles. */
internal fun roundToHundredth(value: Double): Double = jsRound(value * 100) / 100

/** Math.round(value * 10) / 10. */
internal fun roundToTenth(value: Double): Double = jsRound(value * 10) / 10

/**
 * A number already rounded to hundredths, printed as JavaScript's String(n) prints it: "24" and not "24.0",
 * "9.5", "-6", and never "-0". It prints from the scaled integer, so it does not depend on Double.toString.
 */
internal fun hundredthsText(value: Double): String {
    val scaled = jsRound(value * 100).toLong()
    val magnitude = abs(scaled)
    val whole = magnitude / 100
    val fraction = (magnitude % 100).toInt()
    val sign = if (scaled < 0) "-" else ""
    return when {
        fraction == 0 -> "$sign$whole"
        fraction % 10 == 0 -> "$sign$whole.${fraction / 10}"
        else -> "$sign$whole.${fraction.toString().padStart(2, '0')}"
    }
}
