package com.eienmosu.truthy.design

import androidx.compose.ui.unit.dp
import kotlin.test.Test
import kotlin.test.assertEquals

class FrameInsetsTest {
    @Test
    fun aTallWindowKeepsTheWebsSafeAreasWhenTheSystemInsetsAreSmaller() {
        assertEquals(FrameInsets(52.dp, 34.dp, 16.dp, 16.dp), frameInsets(0.dp, 0.dp, 0.dp, 0.dp, 915.dp))
        assertEquals(FrameInsets(52.dp, 34.dp, 16.dp, 16.dp), frameInsets(24.dp, 16.dp, 0.dp, 0.dp, 568.dp))
    }

    @Test
    fun aLargerSystemInsetWins() {
        assertEquals(FrameInsets(60.dp, 60.dp, 16.dp, 16.dp), frameInsets(60.dp, 60.dp, 0.dp, 0.dp, 915.dp))
        assertEquals(FrameInsets(60.dp, 60.dp, 16.dp, 16.dp), frameInsets(60.dp, 60.dp, 0.dp, 0.dp, 560.dp))
    }

    @Test
    fun aShortWindowUsesEightAndTwelve() {
        assertEquals(FrameInsets(8.dp, 12.dp, 16.dp, 16.dp), frameInsets(0.dp, 0.dp, 0.dp, 0.dp, 560.dp))
        assertEquals(FrameInsets(24.dp, 12.dp, 16.dp, 16.dp), frameInsets(24.dp, 0.dp, 0.dp, 0.dp, 560.dp))
    }

    @Test
    fun theSidesAreTheGutterPlusTheSideInset() {
        assertEquals(FrameInsets(52.dp, 34.dp, 40.dp, 16.dp), frameInsets(0.dp, 0.dp, 24.dp, 0.dp, 915.dp))
        assertEquals(FrameInsets(52.dp, 34.dp, 40.dp, 40.dp), frameInsets(0.dp, 0.dp, 24.dp, 24.dp, 915.dp))
    }
}
