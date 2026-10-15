package com.eienmosu.truthy

import com.eienmosu.truthy.engine.CardHistory
import com.eienmosu.truthy.engine.LastRound
import com.eienmosu.truthy.engine.Mode
import com.eienmosu.truthy.engine.Route
import com.eienmosu.truthy.engine.WHOLE_DECK
import com.eienmosu.truthy.engine.emptyProgress
import com.eienmosu.truthy.engine.recordKey
import com.eienmosu.truthy.support.T0
import com.eienmosu.truthy.support.newTempDir
import com.eienmosu.truthy.support.tinyDeckStore
import kotlinx.coroutines.runBlocking
import java.io.File
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

// The app is killed in the middle of a round: the next launch applies the journal with the leave rules
// (spec 4.5, reference 6 save rule 4) and deletes it. Every launch here uses new store and journal objects
// on the same folder, as a new process would.
class ApplyJournalTest {
    private val dir = newTempDir()
    private val decks = tinyDeckStore()
    private val route = Route(deckId = "tiny", sectionId = WHOLE_DECK)
    private val progressFile = File(dir, FileProgressStore.FILE_NAME)
    private val journalFile = File(dir, RoundJournal.FILE_NAME)

    @AfterTest
    fun removeTheFolder() {
        dir.deleteRecursively()
    }

    private fun entry(mode: Mode, answers: List<JournalAnswer>, decided: Boolean, recorded: Boolean = false, on: Route = route) =
        JournalEntry(route = on, mode = mode, seed = 7L, roundId = "round-1", answers = answers, decided = decided, recorded = recorded)

    private suspend fun killedDuring(entry: JournalEntry) = RoundJournal(dir).record(entry)

    private suspend fun nextLaunch(): JournalOutcome = applyJournal(RoundJournal(dir), FileProgressStore(dir)) { id -> decks.deck(id) }

    private suspend fun stored() = FileProgressStore(dir).load()

    @Test
    fun noJournalChangesNothing() {
        runBlocking {
            assertEquals(JournalOutcome.NONE, nextLaunch())
            assertFalse(progressFile.exists())
        }
    }

    @Test
    fun aRoundWithNoAnswersThatIsNotDecidedSavesNothing() {
        runBlocking {
            killedDuring(entry(Mode.CLASSIC, emptyList(), decided = false))
            assertEquals(JournalOutcome.DISCARDED, nextLaunch())
            assertFalse(progressFile.exists())
            assertFalse(journalFile.exists())
        }
    }

    @Test
    fun anUndecidedRoundWithAnswersIsAppliedAsAbandoned() {
        runBlocking {
            killedDuring(entry(Mode.CLASSIC, listOf(JournalAnswer("tiny-01", given = true, correct = true, at = T0)), decided = false))
            assertEquals(JournalOutcome.ABANDONED, nextLaunch())
            val progress = stored()
            assertEquals(mapOf("tiny-01" to CardHistory(seen = 1, lastCorrect = true, lastSeenAt = T0)), progress.cards)
            assertTrue(progress.records.isEmpty())
            assertEquals(LastRound(route = route, mode = Mode.CLASSIC, score = null, total = null), progress.last)
            assertFalse(journalFile.exists())
        }
    }

    @Test
    fun aDecidedRoundIsRecordedAsItsResultWouldBe() {
        runBlocking {
            killedDuring(
                entry(
                    Mode.STREAK,
                    listOf(
                        JournalAnswer("tiny-01", given = true, correct = true, at = T0),
                        JournalAnswer("tiny-02", given = false, correct = true, at = T0 + 1000.0),
                        JournalAnswer("tiny-01", given = false, correct = false, at = T0 + 2000.0),
                    ),
                    decided = true,
                ),
            )
            assertEquals(JournalOutcome.RECORDED, nextLaunch())
            val progress = stored()
            assertEquals(2, progress.records[recordKey(route, Mode.STREAK)])
            assertEquals(LastRound(route = route, mode = Mode.STREAK, score = 2, total = 3), progress.last)
            assertEquals(CardHistory(seen = 2, lastCorrect = false, lastSeenAt = T0 + 2000.0), progress.cards["tiny-01"])
            assertEquals(CardHistory(seen = 1, lastCorrect = true, lastSeenAt = T0 + 1000.0), progress.cards["tiny-02"])
            assertFalse(journalFile.exists())
        }
    }

    @Test
    fun aDecidedRoundBelowTheRecordKeepsTheRecord() {
        runBlocking {
            FileProgressStore(dir).save(emptyProgress().copy(records = mapOf(recordKey(route, Mode.CLASSIC) to 5)))
            killedDuring(
                entry(
                    Mode.CLASSIC,
                    listOf(
                        JournalAnswer("tiny-01", given = true, correct = true, at = T0),
                        JournalAnswer("tiny-02", given = true, correct = false, at = T0 + 1000.0),
                    ),
                    decided = true,
                ),
            )
            assertEquals(JournalOutcome.RECORDED, nextLaunch())
            val progress = stored()
            assertEquals(5, progress.records[recordKey(route, Mode.CLASSIC)])
            assertEquals(LastRound(route = route, mode = Mode.CLASSIC, score = 1, total = 2), progress.last)
        }
    }

    @Test
    fun aTimedMinuteThatRanOutWithNoAnswersIsRecordedAtZero() {
        runBlocking {
            killedDuring(entry(Mode.TIMED, emptyList(), decided = true))
            assertEquals(JournalOutcome.RECORDED, nextLaunch())
            val progress = stored()
            assertEquals(0, progress.records[recordKey(route, Mode.TIMED)])
            assertEquals(LastRound(route = route, mode = Mode.TIMED, score = 0, total = 0), progress.last)
            assertTrue(progress.cards.isEmpty())
        }
    }

    @Test
    fun aRoundAlreadyRecordedIsOnlyDeleted() {
        runBlocking {
            val before = emptyProgress().copy(records = mapOf(recordKey(route, Mode.CLASSIC) to 2))
            FileProgressStore(dir).save(before)
            killedDuring(entry(Mode.CLASSIC, listOf(JournalAnswer("tiny-01", given = true, correct = true, at = T0)), decided = true, recorded = true))
            assertEquals(JournalOutcome.DISCARDED, nextLaunch())
            assertEquals(before, stored())
            assertFalse(journalFile.exists())
        }
    }

    @Test
    fun aJournalWhoseDeckCannotLoadIsDeletedWithoutSaving() {
        runBlocking {
            val gone = Route(deckId = "gone", sectionId = WHOLE_DECK)
            killedDuring(entry(Mode.CLASSIC, listOf(JournalAnswer("gone-01", given = true, correct = true, at = T0)), decided = false, on = gone))
            assertEquals(JournalOutcome.DISCARDED, nextLaunch())
            assertFalse(progressFile.exists())
            assertFalse(journalFile.exists())
        }
    }

    @Test
    fun anUnreadableJournalIsDeleted() {
        runBlocking {
            journalFile.writeText("{\"route\":")
            assertEquals(JournalOutcome.NONE, nextLaunch())
            assertFalse(journalFile.exists())
            assertFalse(progressFile.exists())
        }
    }

    @Test
    fun theRoundOfAKilledProcessIsAppliedOnlyOnce() {
        runBlocking {
            killedDuring(entry(Mode.LIVES, listOf(JournalAnswer("tiny-02", given = true, correct = false, at = T0)), decided = false))
            assertEquals(JournalOutcome.ABANDONED, nextLaunch())
            assertEquals(JournalOutcome.NONE, nextLaunch())
            assertEquals(CardHistory(seen = 1, lastCorrect = false, lastSeenAt = T0), stored().cards["tiny-02"])
        }
    }
}
