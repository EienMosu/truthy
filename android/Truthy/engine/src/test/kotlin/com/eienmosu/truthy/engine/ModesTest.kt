package com.eienmosu.truthy.engine

import kotlin.math.floor
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotEquals
import kotlin.test.assertNotNull
import kotlin.test.assertSame
import kotlin.test.assertTrue

// tests/engine/modes.test.ts: chunkSeed, Streak, Three lives, Classic's rule, leaving, scoreOf, the seed and
// the stored history of every chunk.
class ModesTest : RoundTesting() {
    @Test
    fun chunkSeedIsTheSeedItselfForTheFirstChunkAndADifferentUnsigned32BitNumberForEachLaterOne() {
        assertEquals(12345.0, chunkSeed(12345.0, 0))
        val seeds = (0..4).map { chunkSeed(12345.0, it) }
        assertEquals(5, seeds.toSet().size)
        assertTrue(seeds.all { it == floor(it) && it >= 0.0 && it <= 4_294_967_295.0 })
        assertEquals(2_654_435_768.0, chunkSeed(4_294_967_295.0, 1))
    }

    // Reference 3.3, computed from the TypeScript: chunkSeed(12345, 1..5).
    @Test
    fun chunkSeedWrapsAsTheTypeScriptDoes() {
        assertEquals(
            listOf(2_654_448_114.0, 1_013_916_587.0, 3_668_352_356.0, 2_027_820_829.0, 387_289_302.0),
            (1..5).map { chunkSeed(12345.0, it) },
        )
    }

    @Test
    fun streakGoesOnAfterARightAnswerAndDealsASecondChunkAfterCardTen() {
        val state = rightTimes(start(Mode.STREAK), 10)
        assertEquals(Phase.QUESTION, state.phase)
        assertEquals(10, state.index)
        assertEquals(20, state.cards.size)
        assertEquals(20, ids(state.cards).toSet().size)
        assertEquals(2, state.source.chunks)
    }

    @Test
    fun streakIsDecidedByTheFirstWrongAnswerAndNextFinishesIt() {
        val wrong = give(rightTimes(start(Mode.STREAK), 3), false)
        assertEquals(Phase.ANSWERED, wrong.phase)
        assertTrue(isDecided(wrong))
        val done = play(wrong, NEXT)
        assertEquals(Phase.FINISHED, done.phase)
        assertFalse(done.abandoned)
        assertEquals(3, done.index)
        val result = summarise(done)
        assertEquals(Mode.STREAK, result.mode)
        assertEquals(listOf(3, 4), listOf(result.score, result.total))
        assertFalse(result.abandoned)
        assertEquals(listOf(wrong.cards[3].id), result.missed.map { it.card.id })
    }

    @Test
    fun streakIsNotDecidedByARightAnswer() {
        assertFalse(isDecided(give(start(Mode.STREAK), true)))
    }

    @Test
    fun streakScoresZeroWhenTheFirstAnswerIsWrong() {
        assertEquals(0, summarise(play(give(start(Mode.STREAK), false), NEXT)).score)
    }

    @Test
    fun streakIgnoresASecondAnswerToTheEndingCard() {
        val wrong = give(start(Mode.STREAK), false)
        assertSame(wrong, reduce(wrong, answer(true, 2000.0)))
    }

    @Test
    fun streakDealsTheSameRoundForTheSameSeedAndEventsAcrossChunks() {
        val a = rightTimes(start(Mode.STREAK, seed = 77.0), 25)
        val b = rightTimes(start(Mode.STREAK, seed = 77.0), 25)
        assertEquals(ids(a.cards), ids(b.cards))
        assertNotEquals(ids(a.cards), ids(rightTimes(start(Mode.STREAK, seed = 78.0), 25).cards))
    }

    @Test
    fun streakNeverRunsOutOfCardsOnAnElevenCardRoute() {
        val state = rightTimes(start(Mode.STREAK, size = 11), 30)
        assertEquals(Phase.QUESTION, state.phase)
        assertEquals(30, state.answers.size)
        assertEquals(11, ids(state.cards.subList(0, 11)).toSet().size)
        assertNotNull(currentCard(state))
    }

    @Test
    fun threeLivesHasThreeLives() {
        assertEquals(3, LIVES)
        assertEquals(3, livesLeft(start(Mode.LIVES)))
    }

    @Test
    fun threeLivesGoesOnAfterTheFirstAndTheSecondWrongAnswer() {
        var state = play(give(start(Mode.LIVES), false), NEXT)
        assertEquals(Phase.QUESTION, state.phase)
        assertEquals(2, livesLeft(state))
        state = play(give(state, false), NEXT)
        assertEquals(Phase.QUESTION, state.phase)
        assertEquals(1, livesLeft(state))
    }

    @Test
    fun threeLivesIsDecidedByTheThirdWrongAnswerWhereverItFallsAndScoresTheCardsAnswered() {
        var state = start(Mode.LIVES)
        for (right in listOf(true, false, true, true, false, true)) state = play(give(state, right), NEXT)
        val last = give(state, false)
        assertTrue(isDecided(last))
        assertEquals(0, livesLeft(last))
        assertEquals(3, wrongCount(last))
        val done = play(last, NEXT)
        assertEquals(Phase.FINISHED, done.phase)
        val result = summarise(done)
        assertEquals(Mode.LIVES, result.mode)
        assertEquals(listOf(7, 7), listOf(result.score, result.total))
        assertFalse(result.abandoned)
        assertEquals(3, result.missed.size)
    }

    @Test
    fun threeLivesIsNotDecidedByARightAnswerOnTheLastLife() {
        var state = start(Mode.LIVES)
        repeat(2) { state = play(give(state, false), NEXT) }
        assertFalse(isDecided(give(state, true)))
    }

    @Test
    fun threeLivesPlaysPastTheFirstChunk() {
        val state = rightTimes(start(Mode.LIVES, size = 12), 12)
        assertEquals(12, state.index)
        assertTrue(state.cards.size > 12)
    }

    @Test
    fun livesLeftNeverGoesBelowZero() {
        val wrong = (0 until 4).map { Answered(card = card("w$it", true), given = false, correct = false, at = it.toDouble()) }
        val state = start(Mode.LIVES).copy(answers = wrong)
        assertEquals(4, wrongCount(state))
        assertEquals(0, livesLeft(state))
    }

    @Test
    fun classicIsDecidedByTheAnswerToItsLastCardAndFinishesOnNext() {
        val state = rightTimes(start(Mode.CLASSIC), 9)
        assertFalse(isDecided(state))
        val last = give(state, true)
        assertTrue(isDecided(last))
        assertEquals(Phase.FINISHED, play(last, NEXT).phase)
        assertEquals(10, last.cards.size)
    }

    @Test
    fun classicIsDecidedByTheLastCardOfAShortRoute() {
        assertTrue(isDecided(give(start(Mode.CLASSIC, size = 1), false)))
    }

    @Test
    fun aRoundThatIsLeftIsAbandonedAndKeepsItsAnswersInEveryMode() {
        for (mode in Mode.entries) {
            val left = play(give(start(mode), true), ABANDON)
            assertEquals(Phase.FINISHED, left.phase, mode.wire)
            assertTrue(left.abandoned, mode.wire)
            val result = summarise(left)
            assertTrue(result.abandoned, mode.wire)
            assertEquals(1, result.total, mode.wire)
        }
    }

    @Test
    fun aDecidedRoundThatIsLeftIsAbandonedOnlyNextFinishesItWithItsScore() {
        val streak = give(rightTimes(start(Mode.STREAK), 5), false)
        val classic = give(rightTimes(start(Mode.CLASSIC), 9), true)
        var lives = start(Mode.LIVES)
        repeat(2) { lives = play(give(lives, false), NEXT) }
        lives = give(lives, false)
        for (decided in listOf(streak, classic, lives)) {
            assertTrue(isDecided(decided), decided.mode.wire)
            val left = play(decided, ABANDON)
            assertEquals(Phase.FINISHED, left.phase, decided.mode.wire)
            assertTrue(left.abandoned, decided.mode.wire)
            val done = play(decided, NEXT)
            assertEquals(Phase.FINISHED, done.phase, decided.mode.wire)
            assertFalse(done.abandoned, decided.mode.wire)
        }
    }

    @Test
    fun returnsAFinishedRoundAsItIs() {
        val done = play(give(start(Mode.STREAK), false), NEXT)
        assertSame(done, reduce(done, ABANDON))
    }

    @Test
    fun isDecidedIsFalseOnceFinished() {
        assertFalse(isDecided(play(give(start(Mode.STREAK), false), NEXT)))
    }

    @Test
    fun scoreOfIsTheNumberEachModesRecordKeeps() {
        val answers = listOf(true, true, false, true).mapIndexed { i, correct ->
            Answered(card = card("s$i", true), given = correct, correct = correct, at = i.toDouble())
        }
        assertEquals(3, scoreOf(Mode.CLASSIC, answers))
        assertEquals(3, scoreOf(Mode.TIMED, answers))
        assertEquals(2, scoreOf(Mode.STREAK, answers))
        assertEquals(4, scoreOf(Mode.LIVES, answers))
        assertEquals(listOf(0, 0, 0, 0), Mode.entries.map { scoreOf(it, emptyList()) })
    }

    // Chunk k of a round is dealt with createRng(chunkSeed(seed, k)), after the cards already dealt.
    @Test
    fun dealsChunkOneAndChunkTwoWithChunkSeedOneAndTwo() {
        val seed = 4242.0
        val state = rightTimes(start(Mode.STREAK, seed = seed), 20)
        val first10 = state.cards.subList(0, 10)
        assertEquals(ids(dealChunk(pool(40), emptyMap(), createRng(chunkSeed(seed, 0)), emptyList())), ids(first10))
        val chunk1 = dealChunk(pool(40), emptyMap(), createRng(chunkSeed(seed, 1)), first10)
        assertEquals(ids(chunk1), ids(state.cards.subList(10, 20)))
        val chunk2 = dealChunk(pool(40), emptyMap(), createRng(chunkSeed(seed, 2)), first10 + chunk1)
        assertEquals(ids(chunk2), ids(state.cards.subList(20, 30)))
    }

    // Every chunk of an unbounded round is dealt from the stored history, not only the first: nine missed cards
    // of both answers over a pool of forty, three per chunk.
    @Test
    fun dealsThreeMissedCardsInEachOfTheFirstThreeChunksInEveryUnboundedClass() {
        val missedIds = listOf("c1", "c4", "c9", "c12", "c17", "c20", "c25", "c28", "c33")
        val history: History = missedIds.withIndex().associate { (i, id) ->
            id to CardHistory(seen = 2, lastCorrect = false, lastSeenAt = (100 + i).toDouble())
        }
        for (mode in listOf(Mode.STREAK, Mode.LIVES, Mode.TIMED)) {
            for (seed in 1..40) {
                var state = start(mode, seed = seed.toDouble(), history = history)
                var now = T0
                while (state.answers.size < 21) {
                    state = reduce(state, answer(currentCard(state)?.answer ?: true, now))
                    if (mode == Mode.TIMED) {
                        val answeredSoFar = state.answers.size
                        while (state.answers.size == answeredSoFar && state.phase == Phase.STAMPED) {
                            now += 100.0
                            state = reduce(state, tick(now))
                        }
                    } else {
                        state = reduce(state, NEXT)
                    }
                }
                val dealt = state.cards
                val missedIn = listOf(0, 10, 20).map { from -> dealt.subList(from, from + 10).count { it.id in missedIds } }
                assertEquals(listOf(3, 3, 3), missedIn, "${mode.wire}, seed $seed")
            }
        }
    }
}
