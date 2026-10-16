package com.eienmosu.truthy.round

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.cos
import kotlin.math.sin

// Review F2 (font scale 2, timed-up): the Time is up stamp's tilted border ran through the route line's second line.
class StubStampSpotTest {
    private val turn = -6f

    private fun half(width: Int, height: Int): Float {
        val r = Math.toRadians(6.0)
        return ((height * cos(r) + width * sin(r)) / 2.0).toFloat()
    }

    // Font scale 1 at density 2.625: the route line 43 px, the stamp 630 by 146 px, the column 504 px, the hint 84 px.
    // The stamp's centre stays where the web puts it, 96 - 22 = 74 dp (194.25 px) down the column, and nothing grows.
    @Test
    fun atFontScaleOneTheStampIsWhereTheWebPutsIt() {
        val spot = stubStampSpot(194.25f, 43, 630, 146, turn, 504, 84)
        assertEquals(194.25f, spot.centreY, 0f)
        assertEquals(504, spot.height)
        assertTrue(spot.centreY - half(630, 146) > 43)
    }

    // Font scale 2: the route line wraps to two lines (153 px) and the stamp is 650 by 160 px: its outline starts at the
    // route line's foot, and the column grows so the hint row starts under it.
    @Test
    fun atFontScaleTwoTheStampClearsTheRouteLineAndTheHint() {
        val h = half(650, 160)
        val spot = stubStampSpot(194.25f, 153, 650, 160, turn, 504, 147)
        assertEquals(153f + h, spot.centreY, 1e-3f)
        assertTrue(spot.centreY - h >= 153f)
        val hintTop = spot.height - 147
        assertTrue("hint at $hintTop under the stamp's foot ${spot.centreY + h}", hintTop >= spot.centreY + h)
        assertTrue(spot.height > 504)
    }

    @Test
    fun theTurnCountsBothWays() {
        assertEquals(stubStampSpot(0f, 100, 600, 150, 6f, 0, 0), stubStampSpot(0f, 100, 600, 150, -6f, 0, 0))
    }
}
