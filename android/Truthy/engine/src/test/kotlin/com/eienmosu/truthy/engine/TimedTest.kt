package com.eienmosu.truthy.engine

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertSame
import kotlin.test.assertTrue

// tests/engine/timed.test.ts and clock-polish.test.ts: the Timed clock, the stamp, time up, and times that are
// not numbers. Every time is wall-clock epoch ms from one clock (reference 3.3).
class TimedTest : RoundTesting() {
    @Test
    fun hasSixtySecondsA700MsStampAndCountsAtMostOneSecondPerTick() {
        assertEquals(TimedSettings(roundMs = 60_000.0, holdMs = 700.0, maxStepMs = 1_000.0), TIMED)
    }

    @Test
    fun startsFullAndStoppedAndTheFirstTickStartsItWithoutTakingTime() {
        assertEquals(Clock(remainingMs = 60_000.0, lastTick = null, hidden = false, holdMs = 0.0), start(Mode.TIMED).clock)
        assertEquals(Clock(remainingMs = 60_000.0, lastTick = T0, hidden = false, holdMs = 0.0), timed().clock)
    }

    @Test
    fun theOtherModesHaveNoClockAndIgnoreTicksAndVisibility() {
        for (mode in listOf(Mode.CLASSIC, Mode.STREAK, Mode.LIVES)) {
            val state = start(mode)
            assertNull(state.clock, mode.wire)
            assertSame(state, reduce(state, tick(T0)), mode.wire)
            assertSame(state, reduce(state, hide(T0)), mode.wire)
        }
    }

    @Test
    fun countsDownByTheTimeBetweenTicks() {
        val state = play(timed(), tick(T0 + 100), tick(T0 + 350))
        assertEquals(59_650.0, state.clock?.remainingMs)
        assertEquals(Phase.QUESTION, state.phase)
    }

    @Test
    fun neverCountsBackwardsWhenTheClockSourceJumpsBack() {
        val state = play(timed(), tick(T0 + 500), tick(T0 + 200))
        assertEquals(59_500.0, state.clock?.remainingMs)
        assertEquals(T0 + 200, state.clock?.lastTick)
    }

    @Test
    fun countsAGapOfMoreThanASecondBetweenTwoTicksAsOneSecond() {
        assertEquals(59_000.0, play(timed(), tick(T0 + 45_000)).clock?.remainingMs)
    }

    @Test
    fun countsAStepOfExactlyOneSecondInFullAndOneOfASecondAndAMillisecondAsOneSecond() {
        assertEquals(58_000.0, play(timed(), tick(T0 + 1_000), tick(T0 + 2_001)).clock?.remainingMs)
    }

    @Test
    fun pausesWhileHiddenAndGoesOnFromWhereItWas() {
        val state = play(
            timed(),
            tick(T0 + 1_000),
            hide(T0 + 1_400),
            tick(T0 + 5_000),
            tick(T0 + 9_000),
            show(T0 + 30_000),
            tick(T0 + 30_100),
        )
        assertEquals(Clock(remainingMs = 58_500.0, lastTick = T0 + 30_100, hidden = false, holdMs = 0.0), state.clock)
    }

    @Test
    fun returnsTheSameStateForATickWhileHiddenAndForARepeatedVisibilityEvent() {
        val hidden = play(timed(), hide(T0 + 100))
        assertEquals(Clock(remainingMs = 59_900.0, lastTick = null, hidden = true, holdMs = 0.0), hidden.clock)
        assertSame(hidden, reduce(hidden, tick(T0 + 5_000)))
        assertSame(hidden, reduce(hidden, hide(T0 + 6_000)))
        val shown = timed()
        assertSame(shown, reduce(shown, show(T0 + 50)))
    }

    @Test
    fun anAnswerIsStampedRecordedWithNoAnsweredPhaseAndA700MsHold() {
        val state = give(timed(), true, T0 + 2_000)
        assertEquals(Phase.STAMPED, state.phase)
        assertEquals(1, state.answers.size)
        assertEquals(Clock(remainingMs = 59_000.0, lastTick = T0 + 2_000, hidden = false, holdMs = 700.0), state.clock)
        assertFalse(isDecided(state))
    }

    @Test
    fun theFirstAnswerArmsTheClockWhenNoTickCameBeforeIt() {
        val state = give(start(Mode.TIMED), true, T0)
        assertEquals(Clock(remainingMs = 60_000.0, lastTick = T0, hidden = false, holdMs = 700.0), state.clock)
        val next = play(state, tick(T0 + 700))
        assertEquals(Phase.QUESTION, next.phase)
        assertEquals(1, next.index)
        assertEquals(59_300.0, next.clock?.remainingMs)
    }

    @Test
    fun countsTheClockUpToTheMomentOfTheAnswer() {
        val state = give(play(timed(), tick(T0 + 900)), false, T0 + 950)
        assertEquals(59_050.0, state.clock?.remainingMs)
    }

    @Test
    fun ignoresAnswerAndNextWhileStamped() {
        val state = give(timed(), true, T0 + 500)
        assertSame(state, reduce(state, answer(true, T0 + 600)))
        assertSame(state, reduce(state, NEXT))
    }

    @Test
    fun showsTheNextCardOnce700MsHaveBeenCountedSinceTheAnswerNotBefore() {
        val stamped = give(timed(), true, T0 + 500)
        val before = play(stamped, ticks(T0 + 500, T0 + 1_100))
        assertEquals(Phase.STAMPED, before.phase)
        assertEquals(0, before.index)
        assertEquals(100.0, before.clock?.holdMs)
        val after = play(before, tick(T0 + 1_200))
        assertEquals(Phase.QUESTION, after.phase)
        assertEquals(1, after.index)
        assertEquals(0.0, after.clock?.holdMs)
        assertEquals(58_800.0, after.clock?.remainingMs)
    }

    @Test
    fun holdsTheStampWhileHidden() {
        val state = play(give(timed(), true, T0 + 500), tick(T0 + 800), hide(T0 + 900), show(T0 + 20_000), tick(T0 + 20_200))
        assertEquals(Phase.STAMPED, state.phase)
        assertEquals(100.0, state.clock?.holdMs)
        assertEquals(Phase.QUESTION, play(state, tick(T0 + 20_300)).phase)
    }

    @Test
    fun anAnswerWhileHiddenIsStampedAndItsHoldWaitsForTheAppToShow() {
        val hidden = play(timed(), hide(T0 + 1_000))
        val stamped = give(hidden, true, T0 + 2_000)
        assertEquals(1, stamped.answers.size)
        assertEquals(Clock(remainingMs = 59_000.0, lastTick = null, hidden = true, holdMs = 700.0), stamped.clock)
        assertSame(stamped, reduce(stamped, tick(T0 + 3_000)))
        val shown = play(stamped, listOf(show(T0 + 5_000)) + ticks(T0 + 5_000, T0 + 5_600))
        assertEquals(Phase.STAMPED, shown.phase)
        assertEquals(Phase.QUESTION, play(shown, tick(T0 + 5_700)).phase)
    }

    @Test
    fun hidingAfterTheHoldRanOutShowsTheNextCardThenPauses() {
        val state = play(give(timed(), true, T0 + 100), hide(T0 + 900))
        assertEquals(Phase.QUESTION, state.phase)
        assertEquals(1, state.index)
        assertEquals(Clock(remainingMs = 59_100.0, lastTick = null, hidden = true, holdMs = 0.0), state.clock)
    }

    @Test
    fun hidingAfterALongGapCountsAtMostASecond() {
        val state = play(timed(), hide(T0 + 45_000))
        assertEquals(Clock(remainingMs = 59_000.0, lastTick = null, hidden = true, holdMs = 0.0), state.clock)
    }

    @Test
    fun dealsTheNextChunkWhenTheStampEndsOnTheLastDealtCard() {
        var state = timed()
        var now = T0
        repeat(10) {
            now += 300.0
            state = give(state, true, now)
            state = play(state, ticks(now, now + 700))
            now += 700.0
        }
        assertEquals(Phase.QUESTION, state.phase)
        assertEquals(10, state.index)
        assertEquals(20, state.cards.size)
    }

    @Test
    fun stopsAtZeroOnTheQuestionDecidedStampedTheCardOnScreenNotAnswered() {
        val almost = nearlyUp()
        assertEquals(100.0, almost.clock?.remainingMs)
        val up = play(almost, tick(T0 + 60_000))
        assertEquals(0.0, up.clock?.remainingMs)
        assertEquals(Phase.STAMPED, up.phase)
        assertTrue(isDecided(up))
        assertEquals(0, up.index)
        assertTrue(up.answers.isEmpty())
    }

    @Test
    fun returnsTheSameStateForEveryEventButNextAndAbandonOnceTimeIsUp() {
        val up = play(nearlyUp(), tick(T0 + 60_000))
        assertSame(up, reduce(up, tick(T0 + 60_100)))
        assertSame(up, reduce(up, tick(T0 + 99_000)))
        assertSame(up, reduce(up, hide(T0 + 60_200)))
        assertSame(up, reduce(up, show(T0 + 60_300)))
        assertSame(up, reduce(up, answer(true, T0 + 60_400)))
    }

    @Test
    fun aLastStepLongerThanTheTimeLeftStopsAtZero() {
        val up = play(nearlyUp(), tick(T0 + 60_500))
        assertEquals(Clock(remainingMs = 0.0, lastTick = T0 + 60_500, hidden = false, holdMs = 0.0), up.clock)
        assertEquals(Phase.STAMPED, up.phase)
        assertEquals(0, up.index)
        assertTrue(isDecided(up))
    }

    @Test
    fun nextAfterTimeUpFinishesTheRoundAndTheCardOnScreenIsNeitherCountedNorRecorded() {
        var state = give(timed(), true, T0 + 1_000)
        state = play(state, ticks(T0 + 1_000, T0 + 1_700))
        state = give(state, false, T0 + 2_000)
        state = play(state, ticks(T0 + 2_000, T0 + 60_000))
        assertEquals(Phase.STAMPED, state.phase)
        assertTrue(isDecided(state))
        assertEquals(2, state.index)
        val onScreen = state.cards[2].id
        val done = play(state, NEXT)
        assertEquals(Phase.FINISHED, done.phase)
        val result = summarise(done)
        assertEquals(Mode.TIMED, result.mode)
        assertEquals(listOf(1, 2), listOf(result.score, result.total))
        assertFalse(result.abandoned)
        assertEquals(listOf(state.cards[0].id, state.cards[1].id), result.answers.map { it.card.id })
        assertFalse(result.answers.any { it.card.id == onScreen })
    }

    @Test
    fun nextDoesNothingOnATimedRoundThatIsNotDecided() {
        val state = timed()
        assertSame(state, reduce(state, NEXT))
    }

    @Test
    fun anAnswerThatArrivesAtOrAfterZeroDoesNotCount() {
        for (offset in listOf(60_050.0, 60_000.0)) {
            val late = play(nearlyUp(), answer(true, T0 + offset))
            assertTrue(late.answers.isEmpty(), "at T0 + $offset")
            assertEquals(Phase.STAMPED, late.phase, "at T0 + $offset")
            assertTrue(isDecided(late), "at T0 + $offset")
            assertEquals(0.0, late.clock?.remainingMs, "at T0 + $offset")
        }
    }

    @Test
    fun timeRunningOutDuringTheStampKeepsThatAnswerAndMovesOnToACardThatDoesNotCount() {
        val answered = give(nearlyUp(), true, T0 + 59_950)
        assertEquals(1, answered.answers.size)
        assertEquals(50.0, answered.clock?.remainingMs)
        val up = play(answered, tick(T0 + 60_000))
        assertEquals(Phase.STAMPED, up.phase)
        assertTrue(isDecided(up))
        assertEquals(1, up.index)
        assertEquals(1, up.answers.size)
        assertEquals(0.0, up.clock?.holdMs)
        assertSame(up.cards[1], currentCard(up))
    }

    @Test
    fun hidingThePageAtTheMomentTheTimeRunsOutIsTimeUpNotAPause() {
        val up = play(nearlyUp(), hide(T0 + 60_000))
        assertEquals(0.0, up.clock?.remainingMs)
        assertEquals(false, up.clock?.hidden)
        assertTrue(isDecided(up))
    }

    @Test
    fun hidingAtZeroDuringAStampMovesOnToACardThatDoesNotCount() {
        val up = play(give(nearlyUp(), true, T0 + 59_950), hide(T0 + 60_000))
        assertEquals(Clock(remainingMs = 0.0, lastTick = T0 + 60_000, hidden = false, holdMs = 0.0), up.clock)
        assertEquals(1, up.index)
        assertEquals(1, up.answers.size)
        assertTrue(isDecided(up))
    }

    @Test
    fun aRoundLeftAfterTimeIsUpIsAbandonedLikeAnyOtherAndNextFinishesIt() {
        val up = play(nearlyUp(), tick(T0 + 60_000))
        val left = play(up, ABANDON)
        assertEquals(Phase.FINISHED, left.phase)
        assertTrue(left.abandoned)
        val done = play(up, NEXT)
        assertEquals(Phase.FINISHED, done.phase)
        assertFalse(done.abandoned)
    }

    @Test
    fun aTimedRoundLeftWhileHiddenIsAbandoned() {
        val left = play(timed(), hide(T0 + 1_000), ABANDON)
        assertEquals(Phase.FINISHED, left.phase)
        assertTrue(left.abandoned)
        assertEquals(Clock(remainingMs = 59_000.0, lastTick = null, hidden = true, holdMs = 0.0), left.clock)
    }

    @Test
    fun ignoresEveryTickAfterTheRoundWasLeft() {
        val left = play(timed(), ABANDON)
        assertSame(left, reduce(left, tick(T0 + 100)))
        assertSame(left, reduce(left, hide(T0 + 200)))
    }

    @Test
    fun isTheSameRoundForTheSameSeedAndEvents() {
        val events = listOf(tick(T0), answer(true, T0 + 400)) + ticks(T0 + 400, T0 + 1_100) +
            listOf(hide(T0 + 1_150), show(T0 + 9_000), tick(T0 + 9_100))
        assertEquals(play(start(Mode.TIMED, seed = 5.0), events), play(start(Mode.TIMED, seed = 5.0), events))
    }

    // clock-polish.test.ts: a time that is not a number does not apply.
    @Test
    fun aTickAtANonFiniteTimeIsIgnoredAndTheMinuteStillEndsOnTime() {
        for (bad in listOf(Double.NaN, Double.POSITIVE_INFINITY, Double.NEGATIVE_INFINITY)) {
            val before = play(timed(), ticks(T0, T0 + 5_000))
            val after = reduce(before, tick(bad))
            assertSame(before, after, "tick at $bad")
            val ended = play(after, ticks(T0 + 5_000, T0 + 61_000))
            assertEquals(0.0, ended.clock?.remainingMs, "tick at $bad")
            assertTrue(isDecided(ended), "tick at $bad")
            val late = reduce(ended, answer(currentCard(ended)?.answer ?: true, T0 + 61_000))
            assertEquals(ended.answers.size, late.answers.size, "tick at $bad")
        }
    }

    @Test
    fun anAnswerAtNaNIsIgnoredItNeitherCountsNorMovesTheClock() {
        val state = play(timed(), ticks(T0, T0 + 2_000))
        val after = reduce(state, answer(currentCard(state)?.answer ?: true, Double.NaN))
        assertSame(state, after)
        assertEquals(58_000.0, after.clock?.remainingMs)
    }

    @Test
    fun aPageShownAgainAtNaNIsIgnoredSoTheClockKeepsCountingFromARealMoment() {
        val hidden = play(timed(), hide(T0 + 1_000))
        val after = reduce(hidden, show(Double.NaN))
        assertSame(hidden, after)
        val shown = play(after, listOf(show(T0 + 9_000)) + ticks(T0 + 9_000, T0 + 70_000))
        assertEquals(0.0, shown.clock?.remainingMs)
        assertTrue(isDecided(shown))
    }

    @Test
    fun aClassicAnswerAtNaNIsIgnored() {
        val state = start(Mode.CLASSIC)
        assertSame(state, reduce(state, answer(true, Double.NaN)))
        assertEquals(1, reduce(state, answer(true, T0)).answers.size)
    }
}
