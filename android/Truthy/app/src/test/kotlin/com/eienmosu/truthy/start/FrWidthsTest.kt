package com.eienmosu.truthy.start

import org.junit.Assert.assertEquals
import org.junit.Test

class FrWidthsTest {
    @Test
    fun fractionsShareTheWidthAndTheLastFlexibleColumnTakesTheRoundingRest() {
        // 300 / 3.15 = 95.238 per fr: 85.71, 138.10, 76.19, floored to 85, 138, 76 and the missing pixel to the last.
        assertEquals(listOf(85, 138, 77), frWidths(300, listOf(0.9f, 1.45f, 0.8f), listOf(0, 0, 0)))
    }

    @Test
    fun aColumnNarrowerThanItsContentKeepsItsContentAndTheOthersShareTheRest() {
        // minmax(max-content, fr): 1.1 fr of 100 is under 150, so it keeps 150; then 0.75 of 78.9 is under 60, so it keeps 60;
        // the last column takes the remaining 90.
        assertEquals(listOf(60, 150, 90), frWidths(300, listOf(0.75f, 1.1f, 1.15f), listOf(60, 150, 60)))
    }

    @Test
    fun contentWiderThanTheRowOverflowsInsteadOfShrinking() {
        assertEquals(listOf(200, 150), frWidths(300, listOf(1f, 1f), listOf(200, 150)))
    }
}
