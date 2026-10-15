package com.eienmosu.truthy.round

import org.junit.Assert.assertEquals
import org.junit.Test

class FieldColumnsTest {
    @Test
    fun valuesThatFitShareTheWidth11To1To1() {
        assertEquals(listOf(110, 100, 100), fieldColumnWidths(listOf(50, 40, 40), 310))
    }

    @Test
    fun aValueWiderThanItsShareKeepsItsWidthAndTheOthersShareTheRest() {
        assertEquals(listOf(150, 80, 80), fieldColumnWidths(listOf(150, 40, 40), 310))
    }

    @Test
    fun theLastFlexibleColumnTakesTheRoundingRemainder() {
        assertEquals(listOf(110, 100, 101), fieldColumnWidths(listOf(50, 40, 40), 311))
    }

    @Test
    fun valuesThatCannotAllFitOnOneLineShareTheWidthAndWrap() {
        assertEquals(listOf(106, 96, 98), fieldColumnWidths(listOf(200, 150, 100), 300))
    }
}
