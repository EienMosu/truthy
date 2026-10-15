package com.eienmosu.truthy

import com.eienmosu.truthy.engine.Mode
import com.eienmosu.truthy.engine.Route
import com.eienmosu.truthy.engine.Step
import com.eienmosu.truthy.engine.Theme
import com.eienmosu.truthy.engine.WHOLE_DECK
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull

class DebugLaunchTest {
    private fun parse(vararg extras: Pair<String, String>): DebugLaunch? {
        val map = mapOf(*extras)
        return parseDebugLaunch { key -> map[key] }
    }

    @Test
    fun noExtrasIsNoDebugLaunch() {
        assertNull(parse())
    }

    @Test
    fun everyExtraIsRead() {
        val launch = assertNotNull(
            parse(
                DebugLaunch.SEED to "4294967295",
                DebugLaunch.DECK to "aws-clf-c02",
                DebugLaunch.SECTION to "SEC",
                DebugLaunch.MODE to "timed",
                DebugLaunch.SCREEN to "sheet",
                DebugLaunch.THEME to "dark",
                DebugLaunch.STEP to "4",
            ),
        )
        assertEquals(DebugLaunch(4294967295L, Route("aws-clf-c02", "SEC"), Mode.TIMED, DebugScreen.LEAVE_SHEET, Theme.DARK, Step.FOUR), launch)
        assertEquals(RoundRequest(Route("aws-clf-c02", "SEC"), Mode.TIMED), launch.roundRequest())
    }

    @Test
    fun aDeckWithoutASectionIsTheWholeDeck() {
        assertEquals(Route("gcp-cdl", WHOLE_DECK), parse(DebugLaunch.DECK to "gcp-cdl")?.route)
        assertNull(parse(DebugLaunch.DECK to "gcp-cdl")?.roundRequest(), "a round needs a class too")
    }

    @Test
    fun valuesThatAreNotValidAreLeftOut() {
        val launch = assertNotNull(
            parse(
                DebugLaunch.SEED to "-1",
                DebugLaunch.MODE to "blitz",
                DebugLaunch.SCREEN to "menu",
                DebugLaunch.THEME to "sepia",
                DebugLaunch.STEP to "7",
                DebugLaunch.DECK to "aws-clf-c02",
            ),
        )
        assertNull(launch.seed)
        assertNull(launch.mode)
        assertNull(launch.screen)
        assertNull(launch.theme)
        assertNull(launch.step)
        assertNull(parse(DebugLaunch.SEED to "4294967296"), "a launch with nothing valid is no launch")
    }

    // adb's --el and Intent.putExtra(key, Long) store a Long, which getStringExtra would read as null.
    @Test
    fun aLongOrIntSeedExtraIsReadAsItsDigits() {
        assertEquals("1234567", extraText(1234567L))
        assertEquals("7", extraText(7))
        assertEquals("aws-clf-c02", extraText("aws-clf-c02"))
        assertNull(extraText(true))
        assertNull(extraText(null))
        val launch = parseDebugLaunch { key -> extraText(if (key == DebugLaunch.SEED) 1234567L else null) }
        assertEquals(1234567L, launch?.seed)
    }
}
