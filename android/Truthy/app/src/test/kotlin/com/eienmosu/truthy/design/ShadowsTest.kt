package com.eienmosu.truthy.design

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ShadowsTest {
    // CSS: the blur radius is two standard deviations. Skia's blur radius r is a sigma of 0.57735 r + 0.5, so the mask
    // radius brings it back to the CSS sigma.
    @Test
    fun theMaskRadiusGivesTheCssSigma() {
        assertEquals(18f, ShadowMath.sigma(36f), 0f)
        for (sigma in listOf(1f, 6f, 8f, 47.25f)) {
            val radius = ShadowMath.maskRadius(sigma)
            assertEquals(sigma, ShadowMath.SKIA_SIGMA_PER_RADIUS * radius + ShadowMath.SKIA_SIGMA_OFFSET, 1e-4f)
        }
        assertEquals(0f, ShadowMath.maskRadius(0.3f), 0f)
    }

    // A wide blur is rendered small, at a sigma of 8 bitmap pixels, and never scaled up.
    @Test
    fun aWideBlurIsRenderedAtASigmaOfEightPixels() {
        assertEquals(1f, ShadowMath.scale(5f), 0f)
        assertEquals(1f, ShadowMath.scale(8f), 0f)
        assertEquals(8f, 47.25f * ShadowMath.scale(47.25f), 1e-4f)
    }

    // The ticket at density 2.625: 0 22 36 -18, sigma 47.25 px. The bitmap covers the shadow rectangle and three sigmas
    // round it, where the Gaussian edge has fallen below 0.14 % of its alpha: nothing is cut off where it still shows.
    @Test
    fun theTicketsBitmapReachesThreeSigmasPastItsRectangle() {
        val d = 2.625f
        val rect = ShadowMath.rect(379f * d, 592f * d, 16f * d, 0f, 22f * d, -18f * d)
        val plan = ShadowMath.plan(rect, 36f * d)
        val reach = 3f * 47.25f
        assertEquals(rect.left - reach, plan.left, 1e-3f)
        assertEquals(rect.top - reach, plan.top, 1e-3f)
        assertEquals(rect.right - rect.left + 2f * reach, plan.width, 1e-3f)
        assertEquals(rect.bottom - rect.top + 2f * reach, plan.height, 1e-3f)
        assertTrue(plan.bitmapWidth >= plan.width * plan.scale && plan.bitmapWidth < plan.width * plan.scale + 1f)
        assertTrue("small: ${plan.bitmapWidth} x ${plan.bitmapHeight}", plan.bitmapWidth * plan.bitmapHeight < 100_000)
        assertEquals(ShadowMath.maskRadius(8f), plan.maskRadius, 1e-4f)
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
