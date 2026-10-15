package com.eienmosu.truthy.start

import com.eienmosu.truthy.BackTransition
import com.eienmosu.truthy.engine.Step
import org.junit.Assert.assertEquals
import org.junit.Test

class BackTransitionCommitTest {
    private val oneStepBacks = listOf(
        Step.TWO to Step.ONE,
        Step.THREE to Step.TWO,
        Step.FOUR to Step.THREE,
        Step.FIVE to Step.THREE,
        Step.FIVE to Step.FOUR,
        Step.SIX to Step.FIVE,
    )

    private fun swaps(from: Step, to: Step) = swapsFor(
        from, to,
        footContent(from, hasContinue = true),
        footContent(to, hasContinue = true),
    )

    @Test
    fun aBackWithoutProgressCommitsAtOnceWithTheArrivingStepAtRest() {
        for ((from, to) in oneStepBacks) for (reduced in listOf(false, true)) for (n in listOf(1, 5, 12)) {
            val transition = BackTransition(from, to, n)
            assertAtRest(n, backLayers(transition.frame(1f, reduced), n, swaps(from, to)), "$from to $to, reduced $reduced, $n items")
            assertEquals(0, remainingMs(lastProgress = null, totalMs = transition.durationMs(reduced)))
        }
    }

    @Test
    fun atProgressZeroTheStepBeingLeftIsUntouched() {
        for ((from, to) in oneStepBacks) for (reduced in listOf(false, true)) {
            val layers = backLayers(BackTransition(from, to, 5).frame(0f, reduced), 5, swaps(from, to))
            assertLayer(Layer(1f, 0f), layers.oldPanel, "$from to $to, reduced $reduced")
            assertEquals(1f, layers.oldTitleAlpha, EPS)
            for (i in 0 until 5) assertEquals("$from to $to, reduced $reduced, item $i", 0f, layers.item(i).alpha, EPS)
        }
    }

    @Test
    fun theForwardAndTheBackLastTheSameForTheSameItems() {
        for (n in 1..12) for (reduced in listOf(false, true)) {
            assertEquals("$n items, reduced $reduced", BackTransition(Step.SIX, Step.FIVE, n).durationMs(reduced), forwardDurationMs(n, reduced))
        }
    }

    @Test
    fun aCommitAfterProgressPlaysOnlyWhatIsLeft() {
        assertEquals(200, remainingMs(lastProgress = 0.5f, totalMs = 400))
        assertEquals(400, remainingMs(lastProgress = 0f, totalMs = 400))
        assertEquals(0, remainingMs(lastProgress = 1f, totalMs = 400))
    }
}
