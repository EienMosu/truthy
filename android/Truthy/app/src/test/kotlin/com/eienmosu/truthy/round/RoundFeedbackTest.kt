package com.eienmosu.truthy.round

import com.eienmosu.truthy.engine.Mode
import com.eienmosu.truthy.engine.RoundEvent
import com.eienmosu.truthy.engine.currentCard
import com.eienmosu.truthy.engine.isDecided
import com.eienmosu.truthy.engine.reduce
import com.eienmosu.truthy.round.RoundFixtures.answer
import com.eienmosu.truthy.round.RoundFixtures.next
import com.eienmosu.truthy.round.RoundFixtures.start
import com.eienmosu.truthy.round.RoundFixtures.tick
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class RoundFeedbackTest {
    @Test
    fun aRightAnswerConfirms() {
        val first = start(Mode.CLASSIC)
        assertEquals(RoundHaptic.CONFIRM, verdictHaptic(first, answer(first, correct = true)))
    }

    @Test
    fun aWrongAnswerRejects() {
        val first = start(Mode.CLASSIC)
        assertEquals(RoundHaptic.REJECT, verdictHaptic(first, answer(first, correct = false)))
    }

    @Test
    fun nextCardIsSilent() {
        val answered = answer(start(Mode.CLASSIC), correct = true)
        assertNull(verdictHaptic(answered, next(answered)))
    }

    @Test
    fun theTimedClockRejectsOnceWhenItReachesZeroAndTicksAreOtherwiseSilent() {
        var round = tick(start(Mode.TIMED), 1_000.0)
        var now = 2_000.0
        val felt = mutableListOf<RoundHaptic>()
        while (!isDecided(round)) {
            val after = tick(round, now)
            verdictHaptic(round, after)?.let { felt.add(it) }
            round = after
            now += 1_000.0
        }
        assertEquals(listOf(RoundHaptic.REJECT), felt)
        assertNull(verdictHaptic(round, tick(round, now)))
    }

    @Test
    fun anAnswerThatRunsOutTheClockRejectsWithoutAVerdict() {
        var round = tick(start(Mode.TIMED), 1_000.0)
        var now = 2_000.0
        while (round.clock!!.remainingMs > 1_000.0) {
            round = tick(round, now)
            now += 1_000.0
        }
        val card = currentCard(round)!!
        val after = reduce(round, RoundEvent.Answer(card.answer, round.clock!!.lastTick!! + 1_000.0))
        assertEquals(round.answers.size, after.answers.size)
        assertTrue(isDecided(after))
        assertEquals(RoundHaptic.REJECT, verdictHaptic(round, after))
    }

    @Test
    fun theCommitLineFiresOncePerCrossing() {
        val line = CommitLine()
        val fired = listOf(0.0, 30.0, 89.9, 90.0, 120.0, 95.0, 60.0, 91.0, 130.0).map { line.crossed(it) }
        assertEquals(listOf(false, false, false, true, false, false, false, true, false), fired)
    }

    @Test
    fun theCommitLineCountsBothSides() {
        val line = CommitLine()
        val fired = listOf(-50.0, -90.0, -200.0, -10.0, 100.0).map { line.crossed(it) }
        assertEquals(listOf(false, true, false, false, true), fired)
    }
}
