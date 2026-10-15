package com.eienmosu.truthy.design

import java.nio.ByteBuffer
import java.nio.ByteOrder

/** The code points a TrueType font maps to a glyph, read from its cmap table (subtable formats 4 and 12). */
internal class CmapReader(bytes: ByteArray) {
    private val data: ByteBuffer = ByteBuffer.wrap(bytes).order(ByteOrder.BIG_ENDIAN)

    private fun u16(at: Int): Int = data.getShort(at).toInt() and 0xFFFF

    private fun u32(at: Int): Long = data.getInt(at).toLong() and 0xFFFFFFFFL

    fun sfntVersion(): Long = u32(0)

    fun codePoints(): Set<Int> {
        val tableCount = u16(4)
        var cmapOffset = -1
        for (index in 0 until tableCount) {
            val record = 12 + 16 * index
            val tag = String(ByteArray(4) { data.get(record + it) }, Charsets.US_ASCII)
            if (tag == "cmap") cmapOffset = u32(record + 8).toInt()
        }
        require(cmapOffset >= 0) { "The font has no cmap table" }
        val found = HashSet<Int>()
        val subtables = u16(cmapOffset + 2)
        for (index in 0 until subtables) {
            val offset = cmapOffset + u32(cmapOffset + 4 + 8 * index + 4).toInt()
            when (u16(offset)) {
                4 -> readFormat4(offset, found)
                12 -> readFormat12(offset, found)
            }
        }
        return found
    }

    private fun readFormat4(offset: Int, found: MutableSet<Int>) {
        val segments = u16(offset + 6) / 2
        val endCodes = offset + 14
        val startCodes = endCodes + 2 * segments + 2
        val deltas = startCodes + 2 * segments
        val rangeOffsets = deltas + 2 * segments
        for (segment in 0 until segments) {
            val end = u16(endCodes + 2 * segment)
            val start = u16(startCodes + 2 * segment)
            val delta = u16(deltas + 2 * segment)
            val rangeOffset = u16(rangeOffsets + 2 * segment)
            for (code in start..end) {
                if (code == 0xFFFF) continue
                val glyph = if (rangeOffset == 0) {
                    (code + delta) and 0xFFFF
                } else {
                    val raw = u16(rangeOffsets + 2 * segment + rangeOffset + 2 * (code - start))
                    if (raw == 0) 0 else (raw + delta) and 0xFFFF
                }
                if (glyph != 0) found.add(code)
            }
        }
    }

    private fun readFormat12(offset: Int, found: MutableSet<Int>) {
        val groups = u32(offset + 12).toInt()
        for (group in 0 until groups) {
            val at = offset + 16 + 12 * group
            val start = u32(at).toInt()
            val end = u32(at + 4).toInt()
            for (code in start..end) found.add(code)
        }
    }
}
