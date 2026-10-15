package com.eienmosu.truthy.engine

import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

// pad2 (tests/components/format.test.ts), the logo mark's height (tests/components/Logo.test.tsx) and the theme
// rules (tests/app-state/theme.test.ts), first as the web tests pin them, then against the golden vectors.
class SmallHelpersTest {
    @Test
    fun pad2PadsToTwoDigitsAndLeavesLongerNumbersAlone() {
        assertEquals("00", pad2(0))
        assertEquals("07", pad2(7))
        assertEquals("14", pad2(14))
        assertEquals("120", pad2(120))
        assertEquals("-5", pad2(-5))
    }

    @Test
    fun logoMarkKeepsThe44By30Proportion() {
        assertEquals(30.0, logoMarkHeight(), 0.0)
        assertEquals(30.0, logoMarkHeight(44.0), 0.0)
        assertEquals(17.73, logoMarkHeight(26.0), 0.0)
        assertEquals(13.64, logoMarkHeight(20.0), 0.0)
        assertEquals(0.23, logoMarkHeight(0.33), 0.0)
    }

    @Test
    fun parsesOnlyLightAndDark() {
        assertEquals(Theme.LIGHT, parseTheme("light"))
        assertEquals(Theme.DARK, parseTheme("dark"))
        for (value in listOf(null, "", "Dark", " dark", "system", "auto", "1", "\"dark\"", "purple")) {
            assertNull("$value", parseTheme(value))
        }
        assertEquals("truthy.theme", THEME_KEY)
        assertEquals(listOf("light", "dark"), Theme.entries.map { it.wire })
    }

    @Test
    fun letsAChoiceWinOverTheSystemAndFlipsTheVisibleTheme() {
        assertEquals(Theme.DARK, oppositeTheme(Theme.LIGHT))
        assertEquals(Theme.LIGHT, oppositeTheme(Theme.DARK))
        assertEquals(Theme.LIGHT, resolveTheme(null, false))
        assertEquals(Theme.DARK, resolveTheme(null, true))
        assertEquals(Theme.LIGHT, resolveTheme(Theme.LIGHT, true))
        assertEquals(Theme.DARK, resolveTheme(Theme.DARK, false))
        assertEquals(Theme.LIGHT, switchTheme(null, true))
        assertEquals(Theme.DARK, switchTheme(null, false))
        assertEquals(Theme.LIGHT, switchTheme(Theme.DARK, false))
        assertEquals(Theme.DARK, switchTheme(Theme.LIGHT, true))
    }

    @Test
    fun pad2MatchesTheWeb() {
        val golden = Golden.load("components/format", "pad2")
        for (case in golden.cases) {
            assertEquals(case.name, golden.decode<String>(case.output), pad2(golden.decode<Int>(case.arg("n")!!)))
        }
    }

    @Test
    fun logoMarkHeightMatchesTheWeb() {
        val golden = Golden.load("components/Logo", "LogoMark")
        for (case in golden.cases) {
            val expected = golden.decode<Double>(case.output)
            val width = case.arg("width")
            val height = if (width == null) logoMarkHeight() else logoMarkHeight(golden.decode<Double>(width))
            assertEquals(case.name, expected.toRawBits(), height.toRawBits())
        }
    }

    @Test
    fun themeKeyMatchesTheWeb() {
        val golden = Golden.load("src/app-state/theme", "THEME_KEY")
        assertEquals(1, golden.cases.size)
        assertEquals(JsonNull, golden.cases[0].input)
        assertEquals(THEME_KEY, golden.decode<String>(golden.cases[0].output))
    }

    @Test
    fun parseThemeMatchesTheWeb() {
        val golden = Golden.load("src/app-state/theme", "parseTheme")
        for (case in golden.cases) {
            // A stored value that is not a string (a number, an object, an array) reaches the native store as no
            // string at all, so it is read as null; the web gives null for all of them too.
            val value = (case.arg("value") as? JsonPrimitive)?.takeIf { it.isString }?.content
            assertEquals(case.name, golden.decode<Theme?>(case.output), parseTheme(value))
        }
    }

    @Test
    fun oppositeThemeMatchesTheWeb() {
        val golden = Golden.load("src/app-state/theme", "oppositeTheme")
        for (case in golden.cases) {
            assertEquals(case.name, golden.decode<Theme>(case.output), oppositeTheme(golden.decode<Theme>(case.arg("theme")!!)))
        }
    }

    @Test
    fun resolveThemeMatchesTheWeb() {
        val golden = Golden.load("src/app-state/theme", "resolveTheme")
        for (case in golden.cases) {
            val choice = golden.decode<Theme?>(case.arg("choice")!!)
            val systemDark = golden.decode<Boolean>(case.arg("systemDark")!!)
            assertEquals(case.name, golden.decode<Theme>(case.output), resolveTheme(choice, systemDark))
        }
    }

    @Test
    fun switchThemeMatchesTheWeb() {
        val golden = Golden.load("src/app-state/theme", "switchTheme")
        for (case in golden.cases) {
            val choice = golden.decode<Theme?>(case.arg("choice")!!)
            val systemDark = golden.decode<Boolean>(case.arg("systemDark")!!)
            val output = case.output as JsonObject
            val shown = golden.decode<Theme>(output.getValue("theme"))
            val stored = golden.decode<String?>(output.getValue("stored"))
            assertEquals(case.name, shown, switchTheme(choice, systemDark))
            assertEquals("${case.name}: the stored value", stored, switchTheme(choice, systemDark).wire)
        }
    }
}
