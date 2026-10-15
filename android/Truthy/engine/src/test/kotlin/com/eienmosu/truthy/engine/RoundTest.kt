package com.eienmosu.truthy.engine

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertSame
import kotlin.test.assertTrue

// tests/engine/round.test.ts. Three web tests have no Kotlin form: "rejects a mode it does not know" (a Mode
// value is always one of the four; the startRound golden vector carries that case), "never mutates the state it
// is given" and "does not change the state it summarises" (RoundState and its lists are read-only values).
// Where the web expects the very same object (toBe), these tests use assertSame.
class RoundTest : RoundTesting() {
    @Test
    fun aClassicRoundHasTenCards() {
        assertEquals(10, CLASSIC_LENGTH)
    }

    @Test
    fun startsAClassicRoundOnTheFirstCardInTheQuestionPhaseWithNoAnswers() {
        val state = start()
        assertEquals(Mode.CLASSIC, state.mode)
        assertEquals(route, state.route)
        assertEquals(10, state.cards.size)
        assertEquals(0, state.index)
        assertTrue(state.answers.isEmpty())
        assertEquals(Phase.QUESTION, state.phase)
        assertFalse(state.abandoned)
    }

    @Test
    fun dealsTenDifferentCardsFromThePool() {
        assertEquals(10, ids(start().cards).toSet().size)
    }

    @Test
    fun dealsTheWholePoolWhenItIsSmall() {
        for (n in listOf(1, 4, 9)) assertEquals(n, start(size = n).cards.size, "pool of $n")
    }

    @Test
    fun dealsExactlyTenFromAPoolOfTenOrEleven() {
        assertEquals(10, start(size = 10).cards.size)
        assertEquals(10, start(size = 11).cards.size)
    }

    @Test
    fun dealsTheSameRoundForTheSameSeedAndADifferentOneForAnotherSeed() {
        assertEquals(ids(start(seed = 5.0).cards), ids(start(seed = 5.0).cards))
        val rounds = listOf(1.0, 2.0, 3.0, 4.0, 5.0).map { ids(start(seed = it).cards).joinToString(",") }.toSet()
        assertTrue(rounds.size > 1)
    }

    @Test
    fun passesTheHistoryToTheDealer() {
        val history: History = mapOf(
            "c1" to CardHistory(seen = 1, lastCorrect = false, lastSeenAt = 1.0),
            "c2" to CardHistory(seen = 1, lastCorrect = false, lastSeenAt = 2.0),
        )
        val dealt = ids(start(history = history).cards)
        assertTrue("c1" in dealt)
        assertTrue("c2" in dealt)
    }

    @Test
    fun doesNotChangeThePoolItIsGiven() {
        val cards = pool(20)
        start(cards = cards)
        assertEquals(ids(pool(20)), ids(cards))
    }

    // The web compares with deal(pool, {}, createRng(seed), {count: 10}). With nothing dealt, dealChunk ranks the
    // same cards and chooses them with no conflict group to avoid, no answers before and nothing overdue
    // (deal.ts), which is that deal; the deal golden vectors of task 2 pin both entry points.
    @Test
    fun dealsAClassicRoundAsTheFirstChunkOfItsSeed() {
        for (seed in 1..20) {
            val expected = dealChunk(pool(40), emptyMap(), createRng(seed.toDouble()), emptyList())
            assertEquals(ids(expected), ids(start(seed = seed.toDouble()).cards), "seed $seed")
        }
    }

    @Test
    fun keepsWhatItDealsFrom() {
        val cards = pool(40)
        val state = start(cards = cards)
        assertEquals(DealSource(pool = cards, history = emptyMap(), seed = 1.0, chunks = 1), state.source)
        assertSame(cards, state.source.pool)
    }

    @Test
    fun startsARoundInEveryMode() {
        for (mode in Mode.entries) {
            val state = start(mode)
            assertEquals(Phase.QUESTION, state.phase, mode.wire)
            assertEquals(10, state.cards.size, mode.wire)
            assertEquals(mode == Mode.TIMED, state.clock != null, mode.wire)
        }
    }

    @Test
    fun rejectsAnEmptyPool() {
        val error = assertFailsWith<IllegalArgumentException> { start(cards = emptyList()) }
        assertEquals("The route aws-clf-c02/CON has no cards to deal.", error.message)
    }

    @Test
    fun showsTheFirstDealtCardAndNoAnswerYet() {
        val state = start()
        assertSame(state.cards[0], currentCard(state))
        assertNull(lastAnswer(state))
    }

    @Test
    fun recordsARightAnswerAndShowsTheVerdict() {
        val state = start()
        val first = state.cards[0]
        val after = reduce(state, answer(first.answer, 1234.0))
        val expected = Answered(card = first, given = first.answer, correct = true, at = 1234.0)
        assertEquals(Phase.ANSWERED, after.phase)
        assertEquals(0, after.index)
        assertEquals(listOf(expected), after.answers)
        assertEquals(expected, lastAnswer(after))
    }

    @Test
    fun recordsAWrongAnswerAsNotCorrect() {
        val state = start()
        val first = state.cards[0]
        val after = reduce(state, answer(!first.answer, 50.0))
        assertEquals(listOf(Answered(card = first, given = !first.answer, correct = false, at = 50.0)), after.answers)
    }

    @Test
    fun keepsTheCardOnScreenWhileTheVerdictShows() {
        val state = start()
        assertSame(state.cards[0], currentCard(reduce(state, answer(true))))
    }

    @Test
    fun ignoresNextBeforeTheCardIsAnswered() {
        val state = start()
        assertSame(state, reduce(state, NEXT))
    }

    // The web's "ignores an event it does not know" sends a tick to a Classic round, which has no clock.
    @Test
    fun ignoresATickInAClassicRound() {
        val state = start()
        assertSame(state, reduce(state, tick(5.0)))
    }

    @Test
    fun ignoresASecondAnswerToTheSameCard() {
        val answered = play(start(), answer(true, 10.0))
        val again = reduce(answered, answer(false, 20.0))
        assertSame(answered, again)
        assertEquals(1, again.answers.size)
    }

    @Test
    fun movesToTheNextCardOnNext() {
        val state = start()
        val after = play(state, answer(true), NEXT)
        assertEquals(Phase.QUESTION, after.phase)
        assertEquals(1, after.index)
        assertSame(state.cards[1], currentCard(after))
    }

    @Test
    fun finishesAfterTheTenthCardNotBefore() {
        var state = start()
        repeat(9) { state = play(state, answerRight(state)) }
        assertEquals(Phase.QUESTION, state.phase)
        assertEquals(9, state.index)
        state = play(state, answer(true))
        assertEquals(Phase.ANSWERED, state.phase)
        state = play(state, NEXT)
        assertEquals(Phase.FINISHED, state.phase)
        assertEquals(10, state.answers.size)
        assertFalse(state.abandoned)
        assertNull(currentCard(state))
    }

    @Test
    fun finishesAfterTheLastCardWhenThePoolHasFewerThanTen() {
        var state = start(size = 3)
        repeat(3) { state = play(state, answerRight(state)) }
        assertEquals(Phase.FINISHED, state.phase)
        assertEquals(3, state.answers.size)
    }

    @Test
    fun finishesARoundOfASingleCard() {
        val state = play(start(size = 1), answer(false), NEXT)
        assertEquals(Phase.FINISHED, state.phase)
        assertEquals(1, state.answers.size)
    }

    @Test
    fun recordsEveryCardOnceInTheOrderDealt() {
        var state = start()
        for (i in 0 until 10) state = play(state, answer(i % 3 == 0, (100 + i).toDouble()), NEXT)
        assertEquals(state.cards, state.answers.map { it.card })
        assertEquals((100..109).map { it.toDouble() }, state.answers.map { it.at })
    }

    @Test
    fun ignoresAnswerAndNextOnceFinished() {
        val finished = play(start(size = 2), answer(true), NEXT, answer(true), NEXT)
        assertSame(finished, reduce(finished, answer(true)))
        assertSame(finished, reduce(finished, NEXT))
    }

    @Test
    fun endsAsAbandonedFromTheQuestionPhaseKeepingTheAnswersGiven() {
        val state = play(start(), answer(true), NEXT, ABANDON)
        assertEquals(Phase.FINISHED, state.phase)
        assertTrue(state.abandoned)
        assertEquals(1, state.answers.size)
    }

    @Test
    fun endsAsAbandonedFromTheAnsweredPhase() {
        val state = play(start(), answer(true), ABANDON)
        assertEquals(Phase.FINISHED, state.phase)
        assertTrue(state.abandoned)
        assertEquals(1, state.answers.size)
    }

    @Test
    fun endsAsAbandonedBeforeAnyAnswer() {
        val state = play(start(), ABANDON)
        assertEquals(Phase.FINISHED, state.phase)
        assertTrue(state.abandoned)
        assertTrue(state.answers.isEmpty())
    }

    @Test
    fun canAbandonAtEveryPointOfARound() {
        val begin = start()
        val events = List(10) { listOf(answer(true), NEXT) }.flatten()
        for (cut in events.indices) {
            val left = play(begin, events.take(cut) + ABANDON)
            assertTrue(left.abandoned, "cut $cut")
            assertEquals(Phase.FINISHED, left.phase, "cut $cut")
            assertEquals((cut + 1) / 2, left.answers.size, "cut $cut")
        }
        assertFalse(play(begin, events).abandoned)
    }

    @Test
    fun ignoresAbandonOnceTheRoundHasFinishedNormally() {
        val finished = play(start(size = 1), answer(true), NEXT)
        assertSame(finished, reduce(finished, ABANDON))
    }

    @Test
    fun ignoresAnswerNextAndAbandonAfterAbandoning() {
        val left = play(start(), ABANDON)
        assertSame(left, reduce(left, answer(true)))
        assertSame(left, reduce(left, NEXT))
        assertSame(left, reduce(left, ABANDON))
    }

    @Test
    fun scoresAFinishedClassicRoundCorrectAnswersOutOfTenMissedCardsInOrder() {
        var state = start()
        val wrongAt = setOf(2, 5, 7)
        for (i in 0 until 10) {
            val right = currentCard(state)?.answer ?: true
            state = play(state, answer(if (i in wrongAt) !right else right, (500 + i).toDouble()), NEXT)
        }
        val result = summarise(state)
        assertEquals(Mode.CLASSIC, result.mode)
        assertEquals(route, result.route)
        assertEquals(7, result.score)
        assertEquals(10, result.total)
        assertEquals(10, result.answers.size)
        assertEquals(listOf(state.cards[2], state.cards[5], state.cards[7]), result.missed.map { it.card })
        assertTrue(result.missed.all { !it.correct })
        assertFalse(result.abandoned)
    }

    @Test
    fun scoresAPerfectRoundWithNoMissedCards() {
        var state = start()
        repeat(10) { state = play(state, answerRight(state)) }
        val result = summarise(state)
        assertEquals(listOf(10, 10), listOf(result.score, result.total))
        assertTrue(result.missed.isEmpty())
        assertFalse(result.abandoned)
    }

    @Test
    fun scoresARoundOfASmallPoolOutOfTheCardsItHad() {
        var state = start(size = 4)
        repeat(4) { state = play(state, answerRight(state)) }
        val result = summarise(state)
        assertEquals(listOf(4, 4), listOf(result.score, result.total))
        assertFalse(result.abandoned)
    }

    @Test
    fun summarisesAnAbandonedRoundWithTheAnswersGivenSoFar() {
        var state = start()
        val first = state.cards[0]
        state = play(state, answer(!first.answer, 1.0), NEXT)
        state = play(state, answerRight(state))
        state = play(state, ABANDON)
        val result = summarise(state)
        assertEquals(listOf(1, 2), listOf(result.score, result.total))
        assertTrue(result.abandoned)
        assertEquals(listOf(first), result.missed.map { it.card })
    }

    @Test
    fun summarisesARoundAbandonedBeforeAnyAnswerAsZeroOutOfZero() {
        val expected = RoundResult(
            mode = Mode.CLASSIC,
            route = route,
            score = 0,
            total = 0,
            answers = emptyList(),
            missed = emptyList(),
            abandoned = true,
        )
        assertEquals(expected, summarise(play(start(), ABANDON)))
    }

    @Test
    fun playsAPoolThatListsACardTwiceAsARoundOfItsDistinctCards() {
        var state = start(cards = pool(6) + pool(6))
        assertEquals(6, state.cards.size)
        repeat(6) { state = play(state, answerRight(state)) }
        assertEquals(Phase.FINISHED, state.phase)
        assertEquals(6, state.answers.map { it.card.id }.toSet().size)
        val result = summarise(state)
        assertEquals(listOf(6, 6), listOf(result.score, result.total))
    }
}
