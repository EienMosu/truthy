package com.eienmosu.truthy

/** Just enough of a TrueType reader for the font tests: the table directory, OS/2, name and the format 4 cmap. */
class TrueType(private val bytes: ByteArray) {
    data class Name(val platform: Int, val id: Int, val text: String)

    val tables: Map<String, Int>

    init {
        require(u32(0) == 0x00010000L) { "not a TrueType font" }
        tables = (0 until u16(4)).associate { i ->
            val record = 12 + 16 * i
            String(bytes, record, 4, Charsets.ISO_8859_1) to u32(record + 8).toInt()
        }
    }

    val weightClass: Int get() = u16(table("OS/2") + 4)

    fun names(): List<Name> {
        val name = table("name")
        val strings = name + u16(name + 4)
        return (0 until u16(name + 2)).map { i ->
            val record = name + 6 + 12 * i
            val platform = u16(record)
            val start = strings + u16(record + 10)
            val charset = if (platform == 1) Charsets.ISO_8859_1 else Charsets.UTF_16BE
            Name(platform, u16(record + 6), String(bytes, start, u16(record + 8), charset))
        }
    }

    /** True when the Windows BMP cmap (platform 3, encoding 1, format 4) maps the code point to a glyph. */
    fun covers(codePoint: Int): Boolean {
        val cmap = table("cmap")
        val record = (0 until u16(cmap + 2)).map { cmap + 4 + 8 * it }
            .first { u16(it) == 3 && u16(it + 2) == 1 }
        val sub = cmap + u32(record + 4).toInt()
        require(u16(sub) == 4) { "the Windows BMP cmap is not format 4" }
        val segCountX2 = u16(sub + 6)
        val ends = sub + 14
        val starts = ends + segCountX2 + 2
        val deltas = starts + segCountX2
        val ranges = deltas + segCountX2
        for (segment in 0 until segCountX2 / 2) {
            if (u16(ends + 2 * segment) < codePoint) continue
            val start = u16(starts + 2 * segment)
            if (start > codePoint) return false
            val delta = u16(deltas + 2 * segment)
            val rangeOffset = u16(ranges + 2 * segment)
            val glyph = if (rangeOffset == 0) {
                (codePoint + delta) and 0xFFFF
            } else {
                val raw = u16(ranges + 2 * segment + rangeOffset + 2 * (codePoint - start))
                if (raw == 0) 0 else (raw + delta) and 0xFFFF
            }
            return glyph != 0
        }
        return false
    }

    private fun table(tag: String): Int = tables[tag] ?: error("no $tag table")

    private fun u16(at: Int): Int = ((bytes[at].toInt() and 0xFF) shl 8) or (bytes[at + 1].toInt() and 0xFF)

    private fun u32(at: Int): Long = (u16(at).toLong() shl 16) or u16(at + 2).toLong()
}
