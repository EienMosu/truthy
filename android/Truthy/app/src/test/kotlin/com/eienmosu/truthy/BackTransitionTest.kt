package com.eienmosu.truthy

import com.eienmosu.truthy.engine.Step
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class BackTransitionTest {
    private val tol = 0.01f

    // ease(x) and ease-out(x) at the fractions the frames below fall on.
    private val easeOutAt85of140 = 0.791763f
    private val easeAt145of240 = 0.962277f
    private val easeAtHalf = 0.929579f
    private val easeAt70of240 = 0.783114f
    private val easeAtQuarter = 0.727373f
    private val easeAtThreeQuarters = 0.987468f
    private val easeAt90of220 = 0.884209f
    private val easeOutAt575 = 0.761353f
    private val easeOutAt25of140 = 0.277632f

    private fun assertLayer(alpha: Float, offsetY: Float, layer: BackLayer, what: String) {
        assertEquals(alpha, layer.alpha, tol, "$what: alpha")
        assertEquals(offsetY, layer.offsetY, tol, "$what: offset")
    }

    @Test
    fun theDurationCoversTheLastItemAndThePass() {
        assertEquals(360, BackTransition(Step.TWO, Step.ONE, 1).durationMs(reducedMotion = false))
        assertEquals(375, BackTransition(Step.THREE, Step.TWO, itemCount = 2).durationMs(reducedMotion = false))
        assertEquals(425, BackTransition(Step.THREE, Step.TWO, itemCount = 4).durationMs(reducedMotion = false))
        assertEquals(230, BackTransition(Step.THREE, Step.TWO, itemCount = 4).durationMs(reducedMotion = true))
    }

    @Test
    fun progressZeroIsTheStepBeingLeftAtRest() {
        for (reduced in listOf(false, true)) {
            val frame = BackTransition(Step.THREE, Step.TWO, itemCount = 4).frame(0f, reduced)
            assertLayer(1f, 0f, frame.oldPanel, "old panel, reduced $reduced")
            assertEquals(1f, frame.oldTitleAlpha, tol)
            for (i in 0 until 4) assertEquals(0f, frame.newItem(i).alpha, tol, "item $i, reduced $reduced")
            assertEquals(0f, frame.dashAlpha, tol)
        }
        assertLayer(0f, -24f, BackTransition(Step.THREE, Step.TWO, 1).frame(0f, false).newItem(0), "title above its place")
    }

    @Test
    fun progressOneIsTheNewStepAtRestTheFrameAnInstantCommitShows() {
        for (reduced in listOf(false, true)) {
            val frame = BackTransition(Step.SIX, Step.ONE, itemCount = 5).frame(1f, reduced)
            val sink = if (reduced) 0f else 10f
            val shift = if (reduced) 0f else 12f
            assertLayer(0f, sink, frame.oldPanel, "old panel, reduced $reduced")
            for (i in 0 until 5) assertLayer(1f, 0f, frame.newItem(i), "item $i, reduced $reduced")
            assertLayer(0f, shift, frame.tripOut, "pass and Back pill, reduced $reduced")
            assertLayer(1f, 0f, frame.brandIn, "logo, reduced $reduced")
            assertLayer(1f, 0f, frame.footIn, "continue line, reduced $reduced")
            assertLayer(0f, shift, frame.footOut, "Start round, reduced $reduced")
            assertEquals(1f, frame.switchShift, tol)
            assertEquals(1f, frame.dashAlpha, tol)
        }
    }

    @Test
    fun theBackMotionFollowsTheWebTimeline() {
        val transition = BackTransition(Step.THREE, Step.TWO, itemCount = 4)
        val early = transition.frame(0.2f, reducedMotion = false)
        assertEquals(85f, early.timeMs, 0.01f)
        assertLayer(1f - easeOutAt85of140, 10f * easeOutAt85of140, early.oldPanel, "old panel at 85")
        assertEquals(0f, early.oldTitleAlpha, tol)
        assertLayer(0f, -24f, early.newItem(0), "title at 85")
        val later = transition.frame(0.6f, reducedMotion = false)
        assertLayer(0f, 10f, later.oldPanel, "old panel at 255")
        assertLayer(easeAt145of240, -24f * (1f - easeAt145of240), later.newItem(0), "title at 255")
        assertLayer(easeAtHalf, -24f * (1f - easeAtHalf), later.newItem(1), "item 1 at 255")
        assertLayer(easeAt70of240, -24f * (1f - easeAt70of240), later.newItem(3), "item 3 at 255")
        assertLayer(easeAt70of240, -24f * (1f - easeAt70of240), later.newItem(9), "an index past the last item is the last item")
        assertEquals(easeAtQuarter, later.dashAlpha, tol)
        assertFalse(later.stageChange)
        assertFalse(later.topSwap)
    }

    @Test
    fun backToStepOneSwapsTheTopAndFootZonesAndMovesTheSwitch() {
        val frame = BackTransition(Step.TWO, Step.ONE, 1).frame(0.5f, reducedMotion = false)
        assertTrue(frame.topSwap)
        assertFalse(frame.stageChange)
        assertLayer(0f, 12f, frame.tripOut, "pass and Back pill at 180")
        assertLayer(easeAtQuarter, -12f * (1f - easeAtQuarter), frame.brandIn, "logo at 180")
        assertLayer(easeAtQuarter, 12f * (1f - easeAtQuarter), frame.footIn, "continue line at 180")
        assertEquals(easeAtThreeQuarters, frame.switchShift, tol)
    }

    @Test
    fun leavingTheReadyPassMorphsThePassAndDropsStartRound() {
        val transition = BackTransition(Step.SIX, Step.FIVE, 1)
        val frame = transition.frame(0.5f, reducedMotion = false)
        assertTrue(frame.stageChange)
        assertTrue(frame.valuesTravel)
        assertEquals(easeAtHalf, frame.morph, tol)
        assertEquals(0f, frame.oldBlockAlpha, tol)
        assertEquals(easeAt90of220, frame.newBlockAlpha, tol)
        assertEquals(1f / 6f, frame.oldValueAlpha, tol)
        assertEquals(1f / 6f, frame.newValueAlpha, tol)
        val start = transition.frame(55f / 360f, reducedMotion = false)
        assertLayer(1f - easeAtHalf, 12f * easeAtHalf, start.footOut, "Start round at 55")
    }

    @Test
    fun reducedMotionIsTheCrossFadeMappedOntoProgress() {
        val transition = BackTransition(Step.THREE, Step.TWO, itemCount = 4)
        val early = transition.frame(0.25f, reducedMotion = true)
        assertLayer(1f - easeOutAt575, 0f, early.oldPanel, "old panel at 57.5")
        assertEquals(1f, early.oldTitleAlpha, tol)
        for (i in 0 until 4) assertLayer(0f, 0f, early.newItem(i), "item $i at 57.5")
        assertEquals(0f, early.dashAlpha, tol)
        val mid = transition.frame(0.5f, reducedMotion = true)
        assertLayer(0f, 0f, mid.oldPanel, "old panel at 115")
        for (i in 0 until 4) assertLayer(easeOutAt25of140, 0f, mid.newItem(i), "item $i at 115")
        assertEquals(1f, mid.dashAlpha, tol)
        assertFalse(mid.valuesTravel)
        val toOne = BackTransition(Step.TWO, Step.ONE, 1)
        assertEquals(0f, toOne.frame(99f / 230f, reducedMotion = true).switchShift, tol)
        assertEquals(1f, toOne.frame(101f / 230f, reducedMotion = true).switchShift, tol)
    }

    @Test
    fun progressIsClampedAndABackMustGoBack() {
        val transition = BackTransition(Step.FOUR, Step.THREE, 1)
        assertEquals(transition.frame(0f, false), transition.frame(-0.5f, false))
        assertEquals(transition.frame(1f, false), transition.frame(1.5f, false))
        assertEquals(transition.frame(0f, false), transition.frame(Float.NaN, false))
        assertFailsWith<IllegalArgumentException> { BackTransition(Step.TWO, Step.TWO, 1) }
        assertFailsWith<IllegalArgumentException> { BackTransition(Step.TWO, Step.THREE, 1) }
        assertFailsWith<IllegalArgumentException> { BackTransition(Step.THREE, Step.TWO, itemCount = 0) }
    }
}
