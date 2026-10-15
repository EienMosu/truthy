package com.eienmosu.truthy.design

import androidx.compose.animation.core.SnapSpec
import androidx.compose.animation.core.TweenSpec
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

class MotionTest {
    // Reference 5.7, Press: round button 0.92, Back pill 0.96, pills 0.98 (and 2 down), cards, quiet button and continue
    // line 0.98.
    @Test
    fun theWebsPressScalesAreKept() {
        assertEquals(0.92f, PressFeedback.ROUND_SCALE, 0f)
        assertEquals(0.96f, PressFeedback.BACK_PILL_SCALE, 0f)
        assertEquals(0.98f, PressFeedback.PILL_SCALE, 0f)
        assertEquals(0.98f, PressFeedback.CARD_SCALE, 0f)
        assertEquals(0.98f, PressFeedback.QUIET_SCALE, 0f)
        assertEquals(0.98f, PressFeedback.CONTINUE_SCALE, 0f)
        assertEquals(2f, Tokens.Space.s2.value, 0f)
    }

    @Test
    fun aPressRunsOverTheTokenDurationOnTheTokenCurve() {
        val spec = pressSpec(false)
        assertTrue(spec is TweenSpec<*>)
        val tween = spec as TweenSpec<*>
        assertEquals(120, tween.durationMillis)
        assertEquals(0, tween.delay)
        assertSame(Tokens.Transitions.press.easing, tween.easing)
    }

    @Test
    fun withReducedMotionAPressIsInstant() {
        assertTrue(pressSpec(true) is SnapSpec<*>)
    }

    @Test
    fun theDisabledOpacityIsTheTokens() {
        assertEquals(0.45f, Tokens.Opacity.disabled, 0f)
    }
}
