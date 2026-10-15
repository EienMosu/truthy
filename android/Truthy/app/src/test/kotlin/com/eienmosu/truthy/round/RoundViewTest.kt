package com.eienmosu.truthy.round

import com.eienmosu.truthy.engine.Mode
import com.eienmosu.truthy.engine.currentCard
import com.eienmosu.truthy.engine.isDecided
import com.eienmosu.truthy.round.RoundFixtures.answer
import com.eienmosu.truthy.round.RoundFixtures.next
import com.eienmosu.truthy.round.RoundFixtures.start
import com.eienmosu.truthy.round.RoundFixtures.tick
import com.eienmosu.truthy.round.RoundFixtures.ticket
import com.eienmosu.truthy.round.RoundFixtures.word
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class RoundViewTest {
    private val classic = ticket(Mode.CLASSIC)

    @Test
    fun aClassicQuestionShowsTheTicketWords() {
        val view = roundView(start(Mode.CLASSIC), classic)
        assertEquals("01", view.cardNumber)
        assertEquals("01 / 10", view.cardField)
        assertEquals("TST → SEC · Classic", view.routeLine)
        assertEquals("Test deck, Section: Classic round", view.heading)
        assertTrue(view.takesAnswers)
        assertTrue(view.showStub)
        assertFalse(view.answered)
        assertFalse(view.awaitsNext)
        assertNull(view.stubMark)
        assertNull(view.stubHint)
        assertNull(view.slip)
        assertEquals(Spoken("", ""), view.spoken)
        assertEquals("Next card", view.actionLabel)
    }

    @Test
    fun aCorrectClassicAnswerRevealsTheSlipAndTearsTheStubLeft() {
        val first = start(Mode.CLASSIC)
        val card = currentCard(first)!!
        val view = roundView(answer(first, correct = true), classic)
        assertTrue(view.answered)
        assertTrue(view.awaitsNext)
        assertFalse(view.showStub)
        assertFalse(view.takesAnswers)
        assertEquals(TearSide.LEFT, view.tear)
        assertEquals(card.id, view.slip!!.card.id)
        assertTrue(view.slip!!.correct)
        assertEquals("Correct. The answer is ${word(card.answer)}.", view.spoken.status)
        assertEquals("", view.spoken.card)
        assertEquals("Next card", view.actionLabel)
        assertEquals(listOf(true), view.results)
        assertEquals(1, view.correctCount)
        assertEquals(0, view.wrongCount)
    }

    @Test
    fun aWrongClassicAnswerTearsTheStubRight() {
        val first = start(Mode.CLASSIC)
        val card = currentCard(first)!!
        val view = roundView(answer(first, correct = false), classic)
        assertEquals(TearSide.RIGHT, view.tear)
        assertEquals("Not quite. The answer is ${word(card.answer)}.", view.spoken.status)
        assertEquals(listOf(false), view.results)
        assertEquals(1, view.wrongCount)
    }

    @Test
    fun nextCardCountsTheCardField() {
        val view = roundView(next(answer(start(Mode.CLASSIC), correct = true)), classic)
        assertEquals("02", view.cardNumber)
        assertEquals("02 / 10", view.cardField)
        assertTrue(view.takesAnswers)
        assertTrue(view.showStub)
        assertEquals(Spoken("", ""), view.spoken)
    }

    @Test
    fun theTenthAnswerOffersSeeResults() {
        var round = start(Mode.CLASSIC)
        repeat(10) { i ->
            round = answer(round, correct = true)
            if (i < 9) round = next(round)
        }
        val view = roundView(round, classic)
        assertTrue(view.decided)
        assertEquals("See results", view.actionLabel)
        assertEquals("10 / 10", view.cardField)
    }

    @Test
    fun aShortPoolShowsItsOwnTotal() {
        assertEquals("01 / 07", roundView(start(Mode.CLASSIC, RoundFixtures.pool(7)), classic).cardField)
    }

    @Test
    fun aStreakThatPassesABestOfAtLeastOneSaysNewBestOnce() {
        val streak = ticket(Mode.STREAK, best = 2)
        val second = answer(next(answer(start(Mode.STREAK), correct = true)), correct = true)
        assertFalse("equalling the best is not a new best", roundView(second, streak).newBest)
        var round = next(second)
        val card = currentCard(round)!!
        round = answer(round, correct = true)
        val view = roundView(round, streak)
        assertEquals(3, view.streak)
        assertTrue(view.newBest)
        assertEquals("Correct. The answer is ${word(card.answer)}. New best.", view.spoken.status)
    }

    @Test
    fun aWrongStreakAnswerSaysWhereTheStreakEnded() {
        val streak = ticket(Mode.STREAK, best = 2)
        var round = start(Mode.STREAK)
        repeat(3) { round = next(answer(round, correct = true)) }
        val card = currentCard(round)!!
        val view = roundView(answer(round, correct = false), streak)
        assertFalse(view.newBest)
        assertTrue(view.decided)
        assertEquals("See results", view.actionLabel)
        assertEquals("Not quite. The answer is ${word(card.answer)}. Streak ended at 3.", view.spoken.status)
    }

    @Test
    fun noNewBestWithoutAStoredBestOfAtLeastOne() {
        val once = answer(start(Mode.STREAK), correct = true)
        assertFalse(roundView(once, ticket(Mode.STREAK, best = null)).newBest)
        assertFalse(roundView(once, ticket(Mode.STREAK, best = 0)).newBest)
        assertFalse(roundView(once, ticket(Mode.STREAK, best = 0)).spoken.status.endsWith("New best."))
    }

    @Test
    fun aWrongThreeLivesAnswerSaysTheLivesLeft() {
        val first = start(Mode.LIVES)
        val card = currentCard(first)!!
        val view = roundView(answer(first, correct = false), ticket(Mode.LIVES))
        assertEquals("Not quite. The answer is ${word(card.answer)}. Life lost, 2 left.", view.spoken.status)
    }

    @Test
    fun aTimedQuestionShowsTheCardNumberAloneAndKeepsTheStub() {
        val view = roundView(start(Mode.TIMED), ticket(Mode.TIMED))
        assertEquals("01", view.cardField)
        assertEquals("TST → SEC · Timed", view.routeLine)
        assertTrue(view.showStub)
        assertTrue(view.takesAnswers)
        assertNull(view.stubMark)
        assertEquals(Spoken("", ""), view.spoken)
    }

    @Test
    fun aRightTimedAnswerStampsTheStub() {
        val armed = tick(start(Mode.TIMED), 1_000.0)
        val card = currentCard(armed)!!
        val view = roundView(answer(armed, correct = true, at = 1_500.0), ticket(Mode.TIMED))
        assertTrue(view.beat)
        assertFalse(view.answered)
        assertFalse(view.awaitsNext)
        assertFalse(view.takesAnswers)
        assertTrue(view.showStub)
        assertEquals(StubMark.CORRECT, view.stubMark)
        assertEquals("Next card coming up", view.stubHint)
        assertEquals("Correct.", view.spoken.status)
        assertEquals(if (card.answer) TearSide.RIGHT else TearSide.LEFT, view.leaveSide)
    }

    @Test
    fun aWrongTimedAnswerIsSavedForReview() {
        val armed = tick(start(Mode.TIMED), 1_000.0)
        val card = currentCard(armed)!!
        val view = roundView(answer(armed, correct = false, at = 1_500.0), ticket(Mode.TIMED))
        assertEquals(StubMark.WRONG, view.stubMark)
        assertEquals("Wrong, saved for review at the end", view.stubHint)
        assertEquals("Not quite.", view.spoken.status)
        assertEquals(if (card.answer) TearSide.LEFT else TearSide.RIGHT, view.leaveSide)
    }

    @Test
    fun theNextTimedCardIsAnnouncedAfterTheHold() {
        val stamped = answer(tick(start(Mode.TIMED), 1_000.0), correct = true, at = 1_500.0)
        val round = tick(stamped, 2_200.0)
        val view = roundView(round, ticket(Mode.TIMED))
        assertEquals(1, round.index)
        assertTrue(view.takesAnswers)
        assertEquals("02", view.cardField)
        assertEquals("Card 2. ${currentCard(round)!!.text.en.statement}", view.spoken.card)
    }

    @Test
    fun timeUpStampsTheStubAndOffersSeeResults() {
        var round = tick(answer(tick(start(Mode.TIMED), 1_000.0), correct = true, at = 1_500.0), 2_200.0)
        var now = 3_200.0
        while (!isDecided(round)) {
            round = tick(round, now)
            now += 1_000.0
        }
        val view = roundView(round, ticket(Mode.TIMED))
        assertTrue(view.timeUp)
        assertFalse(view.beat)
        assertTrue(view.awaitsNext)
        assertEquals(StubMark.TIME_UP, view.stubMark)
        assertEquals("This card doesn't count · 1 answered", view.stubHint)
        assertEquals("See results", view.actionLabel)
        assertEquals("Time is up. This card doesn't count.", view.spoken.status)
        assertEquals("", view.spoken.card)
    }
}
