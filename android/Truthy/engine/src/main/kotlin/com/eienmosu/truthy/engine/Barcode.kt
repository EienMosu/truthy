package com.eienmosu.truthy.engine

/** One bar of a barcode: x and width in barcode units (the bars are 56 tall). */
data class BarcodeBar(val x: Int, val width: Int)

/** The bars that are on, and the width of the whole code. */
data class Barcode(val bars: List<BarcodeBar>, val width: Int)

/**
 * The barcode algorithm of the design system, the same on every platform: start bars 2/1/1/2 (on, off, on,
 * off); for each character 7 bits, least significant first, bit 1 gives width 2 and bit 0 width 1, bars
 * alternating on and off starting with on, then a 1-wide gap; end bars 1/1/2 (on, off, on). The bits are
 * those of the first UTF-16 unit of the character (a letter beyond the first plane counts by its high
 * surrogate), as `charCodeAt(0)` reads it. A real pass draws the card's id.
 */
fun barcodeBars(data: String): Barcode {
    val bars = ArrayList<BarcodeBar>()
    var x = 0
    fun bar(width: Int, on: Boolean) {
        if (on) bars.add(BarcodeBar(x, width))
        x += width
    }
    bar(2, true)
    bar(1, false)
    bar(1, true)
    bar(2, false)
    var i = 0
    while (i < data.length) {
        val code = data[i].code
        for (bit in 0 until 7) bar(if (((code shr bit) and 1) == 1) 2 else 1, bit % 2 == 0)
        bar(1, false)
        i += Character.charCount(data.codePointAt(i))
    }
    bar(1, true)
    bar(1, false)
    bar(2, true)
    return Barcode(bars, x)
}
