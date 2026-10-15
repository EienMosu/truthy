package com.eienmosu.truthy.engine

import kotlin.math.max
import kotlin.math.min

private val OPAQUE_COLOUR = Regex("^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})\$")

/** Relative luminance of an opaque #rrggbb colour (WCAG 2). Throws IllegalArgumentException for any other text. */
fun luminance(hex: String): Double {
    val match = OPAQUE_COLOUR.matchEntire(hex) ?: throw IllegalArgumentException("$hex is not an opaque #rrggbb colour")
    val (r, g, b) = match.groupValues.drop(1).map { part ->
        val c = part.toInt(16) / 255.0
        if (c <= 0.04045) c / 12.92 else StrictMath.pow((c + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** The WCAG 2 contrast ratio of two opaque colours, 1 to 21. */
fun contrastRatio(foreground: String, background: String): Double {
    val a = luminance(foreground)
    val b = luminance(background)
    return (max(a, b) + 0.05) / (min(a, b) + 0.05)
}
