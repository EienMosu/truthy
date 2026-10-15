package com.eienmosu.truthy.design

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ShadowsTest {
    @Test
    fun theNormalCdfMatchesTheTable() {
        assertEquals(0.5, ShadowMath.normalCdf(0.0), 1e-6)
        assertEquals(0.8413447, ShadowMath.normalCdf(1.0), 1e-6)
        assertEquals(0.0227501, ShadowMath.normalCdf(-2.0), 1e-6)
        assertEquals(0.9772499, ShadowMath.normalCdf(2.0), 1e-6)
    }

    @Test
    fun noBlurIsOneRectangleOfTheColoursAlpha() {
        assertEquals(listOf(ShadowPass(0f, 0.1f)), ShadowMath.passes(0f, 0.1f))
    }

    // The ticket's second layer: blur 36, so sigma 18 and the passes run from +36 down to -36.
    @Test
    fun thePassesRunFromTwoSigmaOutsideToTwoSigmaInsideAndNeverGoNegative() {
        val passes = ShadowMath.passes(36f, 0.45f)
        assertEquals(14, passes.size)
        assertEquals(36f, passes.first().expand, 1e-3f)
        assertEquals(-36f, passes.last().expand, 1e-3f)
        for (i in 1 until passes.size) assertTrue("pass $i is inside pass ${i - 1}", passes[i].expand < passes[i - 1].expand)
        assertTrue(passes.all { it.alpha in 0f..1f })
    }

    @Test
    fun theStackedAlphaReachesTheColoursAlphaInTheMiddle() {
        val passes = ShadowMath.passes(36f, 0.45f)
        val uncovered = passes.fold(1.0) { acc, pass -> acc * (1.0 - pass.alpha) }
        assertEquals(0.45, 1.0 - uncovered, 1e-5)
    }

    // At the edge of the shadow rectangle (distance 0) a Gaussian edge is half of the full alpha: after the 7 outer passes
    // the band that contains distance 0 is covered by exactly those.
    @Test
    fun theStackedAlphaAtTheEdgeIsHalfOfTheColoursAlpha() {
        val passes = ShadowMath.passes(36f, 0.45f)
        val uncovered = passes.take(7).fold(1.0) { acc, pass -> acc * (1.0 - pass.alpha) }
        assertEquals(0.225, 1.0 - uncovered, 1e-4)
    }

    // Reference 5.5, ticket, day: 0 22 36 -18 in ink at 0.45. The rectangle shrinks by 18 on each side, moves down 22,
    // and its corner radius 16 shrinks to 0.
    @Test
    fun theTicketShadowRectangleIsInsetByTheNegativeSpread() {
        val layer = Tokens.Shadows.day.ticket.layers[1]
        assertEquals(22f, layer.offsetY.value, 0.001f)
        assertEquals(36f, layer.blur.value, 0.001f)
        assertEquals(-18f, layer.spread.value, 0.001f)
        assertEquals(0.45f, layer.color.alpha, 0.005f)
        val rect = ShadowMath.rect(358f, 300f, 16f, layer.offsetX.value, layer.offsetY.value, layer.spread.value)
        assertEquals(ShadowRect(18f, 40f, 340f, 304f, 0f), rect)
    }
}
