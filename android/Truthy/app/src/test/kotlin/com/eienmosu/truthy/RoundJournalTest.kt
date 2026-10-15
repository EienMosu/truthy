package com.eienmosu.truthy

import com.eienmosu.truthy.engine.Card
import com.eienmosu.truthy.engine.Mode
import com.eienmosu.truthy.engine.Phase
import com.eienmosu.truthy.engine.RoundEvent
import com.eienmosu.truthy.engine.RoundState
import com.eienmosu.truthy.engine.Route
import com.eienmosu.truthy.engine.StartArgs
import com.eienmosu.truthy.engine.WHOLE_DECK
import com.eienmosu.truthy.engine.currentCard
import com.eienmosu.truthy.engine.isDecided
import com.eienmosu.truthy.engine.reduce
import com.eienmosu.truthy.engine.startRound
import com.eienmosu.truthy.support.T0
import com.eienmosu.truthy.support.newTempDir
import com.eienmosu.truthy.support.tinyDeckStore
import kotlinx.coroutines.runBlocking
import java.io.File
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class RoundJournalTest {
    private val dir = newTempDir()
    private val route = Route(deckId = "tiny", sectionId = WHOLE_DECK)
    private val deck = runBlocking { tinyDeckStore().deck("tiny") }

    @AfterTest
    fun removeTheFolder() {
        dir.deleteRecursively()
    }

    private fun entry(mode: Mode, answers: List<JournalAnswer>, decided: Boolean, recorded: Boolean = false) =
        JournalEntry(route = route, mode = mode, seed = 7L, roundId = "round-1", answers = answers, decided = decided, recorded = recorded)

    private fun start(mode: Mode, pool: List<Card> = deck.cards): RoundState =
        startRound(StartArgs(mode = mode, route = route, pool = pool, history = emptyMap(), seed = 7.0))

    private fun answerCurrent(state: RoundState, correct: Boolean, at: Double): RoundState {
        val card = assertNotNull(currentCard(state))
        return reduce(state, RoundEvent.Answer(value = if (correct) card.answer else !card.answer, at = at))
    }

    @Test
    fun nothingRecordedIsNothingPending() {
        runBlocking { assertNull(RoundJournal(dir).pending()) }
    }

    @Test
    fun anEntryOutlivesTheProcessThatWroteIt() {
        runBlocking {
            val written = entry(Mode.TIMED, listOf(JournalAnswer("tiny-01", given = true, correct = true, at = T0)), decided = false)
                .copy(seed = 4_294_967_295L)
            RoundJournal(dir).record(written)
            assertEquals(written, RoundJournal(dir).pending())
        }
    }

    @Test
    fun aLaterRecordReplacesTheEarlierOne() {
        runBlocking {
            val journal = RoundJournal(dir)
            journal.record(entry(Mode.CLASSIC, emptyList(), decided = false))
            val later = entry(Mode.CLASSIC, listOf(JournalAnswer("tiny-02", given = false, correct = true, at = T0)), decided = false)
            journal.record(later)
            assertEquals(later, journal.pending())
        }
    }

    @Test
    fun clearDeletesTheJournal() {
        runBlocking {
            val journal = RoundJournal(dir)
            journal.record(entry(Mode.CLASSIC, emptyList(), decided = false))
            journal.clear()
            assertNull(journal.pending())
            assertEquals(0, dir.list()!!.size)
        }
    }

    @Test
    fun anUnreadableJournalIsNothingPending() {
        runBlocking {
            File(dir, RoundJournal.FILE_NAME).writeText("{\"route\":")
            assertNull(RoundJournal(dir).pending())
        }
    }

    @Test
    fun theJournalIsOneFileNamedForItsVersion() {
        runBlocking {
            assertEquals("truthy.round.v1.json", RoundJournal.FILE_NAME)
            RoundJournal(dir).record(entry(Mode.LIVES, emptyList(), decided = false))
            assertEquals(listOf(RoundJournal.FILE_NAME), dir.list()!!.toList())
        }
    }

    @Test
    fun aFreshRoundIsUndecidedWithNoAnswers() {
        val journalled = journalEntry(start(Mode.CLASSIC), seed = 7L, roundId = "round-1")
        assertEquals(entry(Mode.CLASSIC, emptyList(), decided = false), journalled)
    }

    @Test
    fun eachAnswerIsJournalledWithItsCardAndTime() {
        val started = start(Mode.CLASSIC)
        val card = assertNotNull(currentCard(started))
        val answered = answerCurrent(started, correct = true, at = T0)
        val journalled = journalEntry(answered, seed = 7L, roundId = "round-1")
        assertEquals(listOf(JournalAnswer(cardId = card.id, given = card.answer, correct = true, at = T0)), journalled.answers)
        assertFalse(journalled.decided)
        assertFalse(journalled.recorded)
    }

    @Test
    fun theLastClassicAnswerDecidesTheRoundAndNextKeepsItDecided() {
        var state = start(Mode.CLASSIC)
        var at = T0
        while (!isDecided(state)) {
            state = answerCurrent(state, correct = true, at = at)
            at += 1000.0
            if (!isDecided(state)) state = reduce(state, RoundEvent.Next)
        }
        assertEquals(deck.cards.size, journalEntry(state, 7L, "round-1").answers.size)
        assertTrue(journalEntry(state, 7L, "round-1").decided)
        val finished = reduce(state, RoundEvent.Next)
        assertEquals(Phase.FINISHED, finished.phase)
        assertTrue(journalEntry(finished, 7L, "round-1").decided)
        assertTrue(journalEntry(finished, 7L, "round-1", recorded = true).recorded)
    }

    @Test
    fun anAbandonedRoundIsNotDecided() {
        val left = reduce(answerCurrent(start(Mode.CLASSIC), correct = false, at = T0), RoundEvent.Abandon)
        val journalled = journalEntry(left, 7L, "round-1")
        assertEquals(1, journalled.answers.size)
        assertFalse(journalled.answers.single().correct)
        assertFalse(journalled.decided)
    }

    @Test
    fun aTimedMinuteThatRunsOutIsDecidedWithoutAnswers() {
        var state = start(Mode.TIMED)
        for (second in 0..60) state = reduce(state, RoundEvent.Tick(now = T0 + second * 1000.0))
        assertTrue(isDecided(state))
        val journalled = journalEntry(state, 7L, "round-1")
        assertTrue(journalled.answers.isEmpty())
        assertTrue(journalled.decided)
    }

    @Test
    fun aJournalWithNothingToSaveHasNoResult() {
        val answers = listOf(JournalAnswer("tiny-01", given = true, correct = true, at = T0))
        assertNull(journalResult(entry(Mode.CLASSIC, emptyList(), decided = false), deck))
        assertNull(journalResult(entry(Mode.CLASSIC, answers, decided = true, recorded = true), deck))
        assertNull(journalResult(entry(Mode.TIMED, emptyList(), decided = true, recorded = true), deck))
    }

    @Test
    fun anUndecidedJournalGivesAnAbandonedResult() {
        val result = assertNotNull(journalResult(entry(Mode.CLASSIC, listOf(JournalAnswer("tiny-01", given = true, correct = true, at = T0)), decided = false), deck))
        assertTrue(result.abandoned)
        assertEquals(Mode.CLASSIC, result.mode)
        assertEquals(route, result.route)
        assertEquals(1, result.score)
        assertEquals(1, result.total)
        assertEquals(listOf("tiny-01"), result.answers.map { it.card.id })
        assertTrue(result.missed.isEmpty())
    }

    @Test
    fun aDecidedJournalGivesTheResultTheRoundWouldHave() {
        val answers = listOf(
            JournalAnswer("tiny-01", given = true, correct = true, at = T0),
            JournalAnswer("tiny-02", given = false, correct = true, at = T0 + 1000.0),
            JournalAnswer("gone-99", given = true, correct = true, at = T0 + 1500.0),
            JournalAnswer("tiny-01", given = false, correct = false, at = T0 + 2000.0),
        )
        val result = assertNotNull(journalResult(entry(Mode.STREAK, answers, decided = true), deck))
        assertFalse(result.abandoned)
        assertEquals(listOf("tiny-01", "tiny-02", "tiny-01"), result.answers.map { it.card.id })
        assertEquals(2, result.score)
        assertEquals(3, result.total)
        assertEquals(listOf(T0 + 2000.0), result.missed.map { it.at })
    }
}
