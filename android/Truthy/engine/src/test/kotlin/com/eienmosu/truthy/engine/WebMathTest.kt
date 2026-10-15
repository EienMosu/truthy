package com.eienmosu.truthy.engine

import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.test.Test

class WebMathTest {
    @Test
    fun `the hundredths and tenths round as Math round does, a half going up for negative numbers too`() {
        assertTrue(roundToHundredth(0.025) == 0.03)
        assertTrue(roundToHundredth(-0.025) == -0.02)
        assertTrue(roundToHundredth(1.005) == 1.0)
        assertTrue(roundToTenth(2.25) == 2.3)
        assertTrue(roundToTenth(-2.25) == -2.2)
    }

    @Test
    fun `hundredthsText prints a rounded number the way JavaScript prints it`() {
        assertEquals("24", hundredthsText(24.0))
        assertEquals("-6", hundredthsText(-6.0))
        assertEquals("9.5", hundredthsText(9.5))
        assertEquals("106.3", hundredthsText(106.3))
        assertEquals("-12.8", hundredthsText(-12.8))
        assertEquals("0.07", hundredthsText(0.07))
        assertEquals("5.43", hundredthsText(5.43))
        assertEquals("72.51", hundredthsText(72.51))
        assertEquals("0", hundredthsText(0.0))
        assertEquals("0", hundredthsText(-0.001))
        assertEquals("100", hundredthsText(100.0))
    }
}
