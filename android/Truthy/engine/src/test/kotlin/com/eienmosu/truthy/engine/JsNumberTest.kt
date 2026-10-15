package com.eienmosu.truthy.engine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

// The expected values come from node: `x >>> 0` and `Math.round(x)`.
class JsNumberTest {
    @Test
    fun uint32LikeJavaScript() {
        val cases = listOf(
            0.5 to 0L, -1.0 to 4_294_967_295L, 1.9 to 1L, 4_294_967_297.0 to 1L, -1.5 to 4_294_967_295L,
            2_147_483_648.0 to 2_147_483_648L, Double.NaN to 0L, Double.POSITIVE_INFINITY to 0L,
            Double.NEGATIVE_INFINITY to 0L, 1e20 to 1_661_992_960L,
        )
        for ((x, expected) in cases) assertEquals("$x >>> 0", expected, jsUint32(x))
    }

    @Test
    fun roundLikeJavaScript() {
        val cases = listOf(
            0.49999999999999994 to 0.0, 0.5 to 1.0, 1.5 to 2.0, 2.5 to 3.0, -1.5 to -1.0, -2.5 to -2.0,
            4_503_599_627_370_497.0 to 4_503_599_627_370_497.0, 1772.7272727272727 to 1773.0, 1363.6363636363635 to 1364.0,
        )
        for ((x, expected) in cases) assertEquals("Math.round($x)", expected, jsRound(x), 0.0)
    }

    @Test
    fun roundKeepsNegativeZeroAsJavaScriptDoes() {
        for (x in listOf(-0.5, -0.4, -0.0)) {
            assertEquals("Math.round($x) is -0", (-0.0).toRawBits(), jsRound(x).toRawBits())
        }
        assertEquals(0.0.toRawBits(), jsRound(0.4).toRawBits())
        assertEquals(Double.POSITIVE_INFINITY, jsRound(Double.POSITIVE_INFINITY), 0.0)
        assertTrue(jsRound(Double.NaN).isNaN())
    }
}
