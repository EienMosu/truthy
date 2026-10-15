package com.eienmosu.truthy.design

import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontListFontFamily
import androidx.compose.ui.text.font.FontStyle
import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

// Unit tests run with the module directory as the working directory, so the font files and the licence
// are read from their place in the source tree.
class FontsTest {
    private fun weightsOf(family: FontFamily): List<Int> =
        (family as FontListFontFamily).fonts.map { it.weight.weight }

    @Test
    fun overpassSansRequestsWeights600And800Explicitly() {
        assertEquals(listOf(600, 800), weightsOf(OverpassSans))
        assertTrue((OverpassSans as FontListFontFamily).fonts.all { it.style == FontStyle.Normal })
    }

    @Test
    fun overpassMonoRequestsWeights400And600Explicitly() {
        assertEquals(listOf(400, 600), weightsOf(OverpassMono))
        assertTrue((OverpassMono as FontListFontFamily).fonts.all { it.style == FontStyle.Normal })
    }

    // Reference 2.2: the native fonts must cover the typographic marks of the cards and the copy, the middle dot,
    // the section sign, the accented letters and the arrows U+2190 to U+2193, besides printable ASCII.
    @Test
    fun everyFontIsTrueTypeAndCoversTheCharactersTheContentUses() {
        val required = buildSet {
            addAll(0x20..0x7E)
            addAll(listOf(0xA7, 0xB7, 0xC9, 0xE9, 0x2013, 0x2022))
            addAll(0x2018..0x201D)
            addAll(0x2190..0x2193)
        }
        for (name in listOf("overpass_600", "overpass_800", "overpass_mono_400", "overpass_mono_600")) {
            val file = File("src/main/res/font/$name.ttf")
            assertTrue("$file is missing", file.isFile)
            val reader = CmapReader(file.readBytes())
            assertEquals("$name is not a TrueType font", 0x00010000L, reader.sfntVersion())
            val missing = required - reader.codePoints()
            assertTrue("$name lacks " + missing.sorted().joinToString { "U+" + it.toString(16).uppercase().padStart(4, '0') }, missing.isEmpty())
        }
    }

    @Test
    fun theFontLicenceShipsInTheAssets() {
        val licence = File("src/main/assets/licenses/OFL.txt")
        assertTrue("$licence is missing", licence.isFile)
        assertTrue(licence.readText().startsWith("Copyright 2021 The Overpass Project Authors"))
    }
}
