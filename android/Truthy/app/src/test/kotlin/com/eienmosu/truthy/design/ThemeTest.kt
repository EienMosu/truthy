package com.eienmosu.truthy.design

import android.app.UiModeManager
import android.content.res.Configuration
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import com.eienmosu.truthy.engine.Theme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

class ThemeTest {
    private fun rgb(hex: Long): Color = Color(0xFF000000L or hex)

    private fun rgba(hex: Long, alpha: Float): Color = Color(0xFF000000L or hex).copy(alpha = alpha)

    private fun roles(c: TruthyColors): Map<String, Color> = linkedMapOf(
        "sky1" to c.sky1, "sky2" to c.sky2, "sky3" to c.sky3, "sky4" to c.sky4,
        "surface" to c.surface, "surfaceRaised" to c.surfaceRaised, "surfaceSunk" to c.surfaceSunk,
        "surfaceSunkClear" to c.surfaceSunkClear, "ink" to c.ink, "inkMuted" to c.inkMuted, "rule" to c.rule,
        "accent" to c.accent, "onAccent" to c.onAccent, "trueColor" to c.trueColor, "falseColor" to c.falseColor,
        "correct" to c.correct, "wrong" to c.wrong, "onDark" to c.onDark, "cloud" to c.cloud, "scrim" to c.scrim,
        "press" to c.press, "focus" to c.focus, "focusOnFill" to c.focusOnFill,
    )

    // Reference 5.1, role by role.
    @Test
    fun dayAndNightColoursMatchReference51() {
        val day = linkedMapOf(
            "sky1" to rgb(0xA9D6F0), "sky2" to rgb(0xC4E3F5), "sky3" to rgb(0xDDEFF8), "sky4" to rgb(0xF3F0E6),
            "surface" to rgb(0xC4E3F5), "surfaceRaised" to rgb(0xFDFBF5), "surfaceSunk" to rgb(0xEEF3F5),
            "surfaceSunkClear" to rgba(0xEEF3F5, 0f), "ink" to rgb(0x10233F), "inkMuted" to rgb(0x56667C),
            "rule" to rgb(0xC9D3DC), "accent" to rgb(0xF5B400), "onAccent" to rgb(0x10233F),
            "trueColor" to rgb(0x1D5CC0), "falseColor" to rgb(0xB3321C), "correct" to rgb(0x0D7250),
            "wrong" to rgb(0xB3321C), "onDark" to rgb(0xFDFBF5), "cloud" to rgb(0xFFFFFF),
            "scrim" to rgba(0x10233F, 0.32f), "press" to rgba(0x10233F, 0.05f), "focus" to rgb(0x10233F),
            "focusOnFill" to rgb(0x10233F), // plan A override: the ink ring, as color.focus (reference 5.6)
        )
        val night = linkedMapOf(
            "sky1" to rgb(0x0B1528), "sky2" to rgb(0x101C33), "sky3" to rgb(0x15233D), "sky4" to rgb(0x1C2538),
            "surface" to rgb(0x101C33), "surfaceRaised" to rgb(0x252F41), "surfaceSunk" to rgb(0x1D2636),
            "surfaceSunkClear" to rgba(0x1D2636, 0f), "ink" to rgb(0xE6E3DA), "inkMuted" to rgb(0x9BA4B3),
            "rule" to rgb(0x3C4759), "accent" to rgb(0xE0A52C), "onAccent" to rgb(0x141C2B),
            "trueColor" to rgb(0x6F9AE0), "falseColor" to rgb(0xE2836F), "correct" to rgb(0x55B88E),
            "wrong" to rgb(0xE2836F), "onDark" to rgb(0x0F1A2C), "cloud" to rgb(0x2C3A55),
            "scrim" to rgba(0x000000, 0.6f), "press" to rgba(0xE6E3DA, 0.06f), "focus" to rgb(0xE6E3DA),
            "focusOnFill" to rgb(0xE6E3DA), // plan A override: the ink ring, as color.focus
        )
        assertEquals(23, day.size)
        assertEquals(day, roles(Tokens.Colors.day))
        assertEquals(night, roles(Tokens.Colors.night))
    }

    @Test
    fun withNothingStoredTheSystemDecides() {
        val light = resolvedTheme(null, false)
        val dark = resolvedTheme(null, true)
        assertEquals(Theme.LIGHT, light.theme)
        assertEquals(Theme.DARK, dark.theme)
        assertFalse(light.isDark)
        assertTrue(dark.isDark)
        assertSame(Tokens.Colors.day, light.colors)
        assertSame(Tokens.Colors.night, dark.colors)
    }

    // Review Focus 3: the stored theme is the opposite of the system theme. The choice wins, in both directions.
    @Test
    fun aStoredThemeBeatsTheSystemTheme() {
        val darkOnALightSystem = resolvedTheme(Theme.DARK, false)
        assertEquals(Theme.DARK, darkOnALightSystem.theme)
        assertSame(Tokens.Colors.night, darkOnALightSystem.colors)
        assertSame(Tokens.Shadows.night, darkOnALightSystem.shadows)

        val lightOnADarkSystem = resolvedTheme(Theme.LIGHT, true)
        assertEquals(Theme.LIGHT, lightOnADarkSystem.theme)
        assertSame(Tokens.Colors.day, lightOnADarkSystem.colors)
        assertSame(Tokens.Shadows.day, lightOnADarkSystem.shadows)

        assertEquals(Theme.DARK, resolvedTheme(Theme.DARK, true).theme)
        assertEquals(Theme.LIGHT, resolvedTheme(Theme.LIGHT, false).theme)
    }

    // The window background and the launch screen use the surface colour of the theme: #c4e3f5 by day, #101c33 at night.
    @Test
    fun theWindowBackgroundIsTheSurfaceColourOfTheTheme() {
        assertEquals(0xFFC4E3F5L.toInt(), resolvedTheme(Theme.LIGHT).colors.surface.toArgb())
        assertEquals(0xFF101C33L.toInt(), resolvedTheme(Theme.DARK).colors.surface.toArgb())
    }

    @Test
    fun theThemeCarriesItsOwnShadows() {
        assertSame(Tokens.Shadows.day, resolvedTheme(Theme.LIGHT).shadows)
        assertSame(Tokens.Shadows.night, resolvedTheme(Theme.DARK).shadows)
        assertEquals(2, Tokens.Shadows.day.ticket.layers.size)
        assertEquals(1, Tokens.Shadows.day.press.layers.size)
    }

    @Test
    fun theNightModeHandedToTheSystemFollowsTheStoredTheme() {
        assertEquals(UiModeManager.MODE_NIGHT_YES, nightModeFor(Theme.DARK))
        assertEquals(UiModeManager.MODE_NIGHT_NO, nightModeFor(Theme.LIGHT))
        assertEquals(2, nightModeFor(Theme.DARK))
        assertEquals(1, nightModeFor(Theme.LIGHT))
    }

    @Test
    fun theSystemsNightBitIsReadFromTheUiMode() {
        assertTrue(isNightUiMode(Configuration.UI_MODE_NIGHT_YES))
        assertTrue(isNightUiMode(Configuration.UI_MODE_NIGHT_YES or Configuration.UI_MODE_TYPE_NORMAL))
        assertFalse(isNightUiMode(Configuration.UI_MODE_NIGHT_NO))
        assertFalse(isNightUiMode(Configuration.UI_MODE_NIGHT_UNDEFINED))
        assertFalse(isNightUiMode(Configuration.UI_MODE_TYPE_NORMAL))
    }
}
