package com.eienmosu.truthy.start

import kotlin.math.floor

/**
 * Column widths of a CSS grid whose tracks are `minmax(min, fr)` (FillInPass.tsx:342 and :360, BoardingPass.tsx:82):
 * the fr unit is the free width over the flexible fractions; a track whose share is under its minimum keeps the
 * minimum and leaves the sharing, and the unit is worked out again until no track is under its minimum (CSS Grid,
 * "find the size of an fr"). Whole pixels: each width is floored and the rounding rest goes to the last flexible track.
 * Minimums wider than the row overflow, as in CSS.
 */
fun frWidths(total: Int, fractions: List<Float>, mins: List<Int>): List<Int> {
    val fixed = BooleanArray(fractions.size)
    var free = total.toFloat()
    var unit = 0f
    var changed = true
    while (changed) {
        changed = false
        val share = fractions.indices.filter { !fixed[it] }.sumOf { fractions[it].toDouble() }.toFloat()
        unit = if (share > 0f) (free / share).coerceAtLeast(0f) else 0f
        for (i in fractions.indices) {
            if (!fixed[i] && fractions[i] * unit < mins[i]) {
                fixed[i] = true
                free -= mins[i]
                changed = true
            }
        }
    }
    val widths = fractions.indices.map { if (fixed[it]) mins[it] else floor(fractions[it] * unit).toInt() }.toMutableList()
    val rest = total - widths.sum()
    val last = fractions.indices.lastOrNull { !fixed[it] }
    if (last != null && rest > 0) widths[last] += rest
    return widths
}
