package com.eienmosu.truthy.start

import com.eienmosu.truthy.design.Tokens
import com.eienmosu.truthy.engine.Step
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class StepMotionTest {
    private fun ease(x: Float) = Tokens.Curves.ease.transform(x)
    private fun easeOut(x: Float) = Tokens.Curves.easeOut.transform(x)
    private fun forward(t: Int, n: Int = 3, reduced: Boolean = false, swaps: Swaps = Swaps.NONE) = forwardLayers(t.toFloat(), n, reduced, swaps)

    @Test
    fun theOldPanelRisesTenAndFadesOver140WhileItsTitleFadesIn80() {
        assertLayer(Layer(1f, 0f), forward(0).oldPanel)
        assertEquals(1f - easeOut(0.5f), forward(70).oldPanel.alpha, EPS)
        assertEquals(-10f * easeOut(0.5f), forward(70).oldPanel.offsetY, EPS)
        assertLayer(Layer(0f, -10f), forward(140).oldPanel)
        assertEquals(1f - easeOut(0.5f), forward(40).oldTitleAlpha, EPS)
        assertEquals(0f, forward(80).oldTitleAlpha, EPS)
        assertEquals(1f, forward(0).newPanelAlpha, EPS)
    }

    @Test
    fun theNewItemsRiseFrom24BelowAfter110Plus25Each() {
        assertLayer(Layer(0f, 24f), forward(110).item(0))
        assertLayer(Layer(0f, 24f), forward(135).item(1))
        assertEquals(ease(0.5f), forward(255).item(1).alpha, EPS)
        assertEquals(24f * (1f - ease(0.5f)), forward(255).item(1).offsetY, EPS)
        assertLayer(Layer.Shown, forward(350).item(0))
        assertLayer(Layer.Shown, forward(400).item(2))
    }

    @Test
    fun theDashesOfTheChosenFieldLeaveAfter120Over100() {
        assertEquals(1f, forward(120).dashOutAlpha, EPS)
        assertEquals(1f - easeOut(0.5f), forward(170).dashOutAlpha, EPS)
        assertEquals(0f, forward(220).dashOutAlpha, EPS)
        assertEquals(1f, forward(0).dashInAlpha, EPS)
    }

    @Test
    fun aNewPassLayoutCrossFadesWhileThePaperChangesShapeOver360() {
        val block = Swaps.NONE.copy(block = true)
        assertEquals(1f, forward(0, swaps = block).oldBlockAlpha, EPS)
        assertEquals(0f, forward(120, swaps = block).oldBlockAlpha, EPS)
        assertEquals(0f, forward(90, swaps = block).newBlockAlpha, EPS)
        assertEquals(ease(0.5f), forward(200, swaps = block).newBlockAlpha, EPS)
        assertEquals(1f, forward(310, swaps = block).newBlockAlpha, EPS)
        assertEquals(ease(0.5f), forward(180, swaps = block).passMorph, EPS)
        assertEquals(1f, forward(360, swaps = block).passMorph, EPS)
        assertEquals(0f, forward(0).oldBlockAlpha, EPS)
        assertEquals(1f, forward(0).newBlockAlpha, EPS)
        assertEquals(1f, forward(0).passMorph, EPS)
    }

    @Test
    fun leavingStep1TheLogoRisesAwayThePassComesUpAndTheSwitchMoves() {
        val swaps = swapsFor(Step.ONE, Step.TWO, FootContent.NONE, FootContent.NONE)
        assertEquals(ZoneSwap(outRise = -12f, inRise = 12f), swaps.top)
        assertLayer(Layer(1f, 0f), forward(0, swaps = swaps).topOut)
        assertLayer(Layer(0f, -12f), forward(110, swaps = swaps).topOut)
        assertLayer(Layer(0f, 12f), forward(120, swaps = swaps).topIn)
        assertLayer(Layer.Shown, forward(360, swaps = swaps).topIn)
        assertEquals(ease(0.5f), forward(120, swaps = swaps).switchMove, EPS)
        assertEquals(1f, forward(240, swaps = swaps).switchMove, EPS)
        assertEquals(ZoneSwap(outRise = 12f, inRise = -12f), swapsFor(Step.TWO, Step.ONE, FootContent.NONE, FootContent.NONE).top)
    }

    @Test
    fun theMotionLastsUntilTheLastItemHasArrivedAndAtLeast360() {
        assertEquals(360, forwardDurationMs(1, reduced = false))
        assertEquals(400, forwardDurationMs(3, reduced = false))
        assertEquals(575, forwardDurationMs(10, reduced = false))
        assertEquals(230, forwardDurationMs(10, reduced = true))
    }

    @Test
    fun reducedMotionFadesTheOldStepOutIn100AndTheNewInOver140After90() {
        val block = Swaps(top = ZoneSwap(-12f, 12f), foot = null, block = true, switchMoves = true)
        assertEquals(1f, forward(0, reduced = true).oldPanel.alpha, EPS)
        assertEquals(0.5f, forward(50, reduced = true).oldPanel.alpha, EPS)
        assertEquals(0f, forward(100, reduced = true).oldPanel.alpha, EPS)
        assertEquals(0f, forward(90, reduced = true).newPanelAlpha, EPS)
        assertEquals(0.5f, forward(160, reduced = true).newPanelAlpha, EPS)
        assertEquals(1f, forward(230, reduced = true).newPanelAlpha, EPS)
        assertLayer(Layer(0.5f, 0f), forward(50, reduced = true, swaps = block).topOut)
        assertLayer(Layer(0.5f, 0f), forward(160, reduced = true, swaps = block).topIn)
        assertEquals(1f, forward(0, reduced = true, swaps = block).passMorph, EPS)
        assertEquals(1f, forward(0, reduced = true, swaps = block).switchMove, EPS)
        assertEquals(0f, forward(0, reduced = true).dashOutAlpha, EPS)
        for (i in 0 until 3) assertLayer(Layer.Shown, forward(0, reduced = true).item(i))
    }

    @Test
    fun everyForwardMotionEndsAtRest() {
        val all = listOf(
            Swaps.NONE,
            swapsFor(Step.ONE, Step.TWO, FootContent.CONTINUE, FootContent.NONE),
            swapsFor(Step.THREE, Step.FOUR, FootContent.NONE, FootContent.NONE),
            swapsFor(Step.ONE, Step.SIX, FootContent.CONTINUE, FootContent.START),
        )
        for (reduced in listOf(false, true)) for (swaps in all) for (n in listOf(1, 4, 9)) {
            assertAtRest(n, forwardLayers(forwardDurationMs(n, reduced).toFloat(), n, reduced, swaps), "reduced $reduced, $swaps, $n items")
        }
    }

    @Test
    fun theSwapsFollowTheSteps() {
        assertEquals(Swaps.NONE, swapsFor(Step.TWO, Step.THREE, FootContent.NONE, FootContent.NONE))
        assertTrue(swapsFor(Step.THREE, Step.FOUR, FootContent.NONE, FootContent.NONE).block)
        assertTrue(swapsFor(Step.FIVE, Step.SIX, FootContent.NONE, FootContent.START).block)
        val continued = swapsFor(Step.ONE, Step.SIX, FootContent.CONTINUE, FootContent.START)
        assertEquals(ZoneSwap(outRise = 12f, inRise = 12f), continued.foot)
        assertEquals(false, continued.block)
        assertEquals(true, continued.switchMoves)
        assertNull(swapsFor(Step.FOUR, Step.FIVE, FootContent.NONE, FootContent.NONE).top)
        assertEquals(FootContent.CONTINUE, footContent(Step.ONE, hasContinue = true))
        assertEquals(FootContent.NONE, footContent(Step.ONE, hasContinue = false))
        assertEquals(FootContent.START, footContent(Step.SIX, hasContinue = true))
        assertEquals(FootContent.NONE, footContent(Step.THREE, hasContinue = true))
    }
}
