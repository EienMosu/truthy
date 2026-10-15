package com.eienmosu.truthy.start

import androidx.compose.ui.MotionDurationScale
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ReducedMotionTest {
    @Test
    fun onlyAnAnimatorScaleOfZeroIsReducedMotion() {
        assertTrue(isReducedMotion(0f))
        assertFalse(isReducedMotion(1f))
        assertFalse(isReducedMotion(0.5f))
        assertFalse(isReducedMotion(10f))
    }

    @Test
    fun theFadesThatReducedMotionKeepsRunAtFullSpeed() {
        assertEquals(1f, motionContext(reduced = true)[MotionDurationScale]?.scaleFactor)
        assertNull(motionContext(reduced = false)[MotionDurationScale])
    }
}
