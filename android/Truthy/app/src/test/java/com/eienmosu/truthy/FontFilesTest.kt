package com.eienmosu.truthy

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** The four static cuts of spec 6 (Fonts) and reference 5.2, with the coverage reference 2.2 requires. */
class FontFilesTest {
    private data class Cut(val weight: Int, val postScriptName: String)

    private val fonts = RepoFiles.resDir.resolve("font")
    private val cuts = mapOf(
        "overpass_600.ttf" to Cut(600, "OverpassRoman-SemiBold"),
        "overpass_800.ttf" to Cut(800, "OverpassRoman-ExtraBold"),
        "overpass_mono_400.ttf" to Cut(400, "OverpassMono-Regular"),
        "overpass_mono_600.ttf" to Cut(600, "OverpassMono-SemiBold"),
    )

    // Reference 2.2, font consequence: bullet, section sign, en dash, typographic quotes, é and É, the four arrows,
    // the middle dot.
    private val needed = listOf(
        0x2022, 0x00A7, 0x2013, 0x2018, 0x2019, 0x201A, 0x201B, 0x201C, 0x201D,
        0x00E9, 0x00C9, 0x2190, 0x2191, 0x2192, 0x2193, 0x00B7,
    )

    private fun font(file: String) = TrueType(fonts.resolve(file).readBytes())

    @Test
    fun theFourStaticCutsAreThere() {
        assertEquals(cuts.keys, fonts.list().orEmpty().toSet())
    }

    @Test
    fun eachCutHasItsWeightAndNameAndNoVariationTable() {
        for ((file, cut) in cuts) {
            val font = font(file)
            assertEquals(file, cut.weight, font.weightClass)
            assertEquals(file, listOf(cut.postScriptName), font.names().filter { it.id == 6 }.map { it.text }.distinct())
            assertFalse(file, "fvar" in font.tables)
            assertFalse(file, "gvar" in font.tables)
        }
    }

    @Test
    fun eachCutCoversTheCharactersTheContentUses() {
        for (file in cuts.keys) {
            val font = font(file)
            val missing = needed.filterNot(font::covers).map { "U+%04X".format(it) }
            assertEquals(file, emptyList<String>(), missing)
        }
        // The lookup can say no: Overpass has no CJK.
        assertFalse(font("overpass_600.ttf").covers(0x4E00))
    }

    @Test
    fun nameTablesArePlainAscii() {
        val email = Regex("""[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}""")
        for (file in cuts.keys) {
            for (name in font(file).names()) {
                assertNotEquals("$file has the sample text record", 19, name.id)
                assertTrue("$file name ${name.id}: ${name.text}", name.text.all { it in ' '..'~' })
                assertNull("$file name ${name.id}", email.find(name.text))
            }
        }
    }
}
