package com.eienmosu.truthy.round

/** The fr of the Class, Card and Gate columns (BoardingPass.tsx FIELD_COLUMNS), in tenths so the arithmetic stays exact. */
private const val FIRST_FR_TENTHS = 11
private const val OTHER_FR_TENTHS = 10

/**
 * The widths of the field grid's columns for the given one-line content widths: minmax(max-content, fr), so a
 * column never splits its value while the values fit; when they cannot all fit on one line (a large font scale)
 * the columns share the width by fr and the values wrap, so nothing clips. Integer pixels; the last flexible
 * column takes the rounding remainder.
 */
internal fun fieldColumnWidths(contents: List<Int>, available: Int): List<Int> {
    val n = contents.size
    if (n == 0) return emptyList()
    val fr = List(n) { if (it == 0) FIRST_FR_TENTHS else OTHER_FR_TENTHS }
    val flexible = BooleanArray(n) { true }
    fun free(): Int = available - (0 until n).filter { !flexible[it] }.sumOf { contents[it] }
    fun total(): Int = (0 until n).filter { flexible[it] }.sumOf { fr[it] }
    if (contents.sum() <= available) {
        while (flexible.any { it }) {
            val free = free()
            val total = total()
            var changed = false
            for (i in 0 until n) {
                if (flexible[i] && free.toLong() * fr[i] < contents[i].toLong() * total) {
                    flexible[i] = false
                    changed = true
                }
            }
            if (!changed) break
        }
    }
    val free = free()
    val total = total()
    val widths = IntArray(n) { if (flexible[it]) (free.toLong() * fr[it] / total).toInt() else contents[it] }
    val last = (0 until n).lastOrNull { flexible[it] }
    if (last != null) widths[last] += available - widths.sum()
    return widths.toList()
}
