package com.eienmosu.truthy

import com.eienmosu.truthy.engine.Clock
import com.eienmosu.truthy.engine.LastRound
import com.eienmosu.truthy.engine.Mode
import com.eienmosu.truthy.engine.Phase
import com.eienmosu.truthy.engine.Route
import com.eienmosu.truthy.engine.currentCard
import com.eienmosu.truthy.engine.isDecided
import com.eienmosu.truthy.engine.recordKey
import com.eienmosu.truthy.support.CLF
import com.eienmosu.truthy.support.FakeClock
import com.eienmosu.truthy.support.MemoryProgressStore
import com.eienmosu.truthy.support.T0
import com.eienmosu.truthy.support.newTempDir
import com.eienmosu.truthy.support.testDeckStore
import com.eienmosu.truthy.support.testServices
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertSame
import kotlin.test.assertTrue

@OptIn(ExperimentalCoroutinesApi::class)
class RoundCoordinatorTest {
    private val sec = Route(CLF, "SEC")

    private class Rig(val scope: TestScope) {
        val io = StandardTestDispatcher(scope.testScheduler)
        val wall = FakeClock(T0)
        val monotonic = FakeClock(10_000.0)
        val progress = MemoryProgressStore()
        val journal = RoundJournal(newTempDir(), io)
        val writer = SerialWriter(scope.backgroundScope)
        val services = testServices(journal, progress, wall, monotonic, testDeckStore(io))

        suspend fun start(route: Route, mode: Mode, hidden: Boolean = false): RoundCoordinator =
            assertNotNull(prepareRound(RoundRequest(route, mode), services.index(), services, writer, scope.backgroundScope, hidden))

        /** Moves the wall clock by [wallMs] and lets exactly one 100 ms tick of the ticker fire. */
        fun tick(wallMs: Double) {
            wall.now += wallMs
            scope.advanceTimeBy(RoundCoordinator.TICK_MS)
            scope.runCurrent()
        }
    }

    private fun clock(round: RoundCoordinator): Clock = assertNotNull(round.state.value.clock)

    @Test
    fun anAnswerWaitsTheSettleTimeOfItsCardAndKeepsTheWallClockTime() = runTest {
        val rig = Rig(this)
        val round = rig.start(sec, Mode.CLASSIC)
        val card = assertNotNull(currentCard(round.state.value))
        rig.monotonic.now += 249.0
        assertFalse(round.answer(card.answer))
        assertTrue(round.state.value.answers.isEmpty())
        rig.monotonic.now += 1.0
        rig.wall.now = T0 + 5_000.0
        assertTrue(round.answer(card.answer))
        val state = round.state.value
        assertEquals(Phase.ANSWERED, state.phase)
        assertEquals(T0 + 5_000.0, state.answers.single().at)
        assertTrue(state.answers.single().correct)
    }

    @Test
    fun aCardTakesOneAnswerAndNextWaitsFourHundredTwentyMilliseconds() = runTest {
        val rig = Rig(this)
        val round = rig.start(sec, Mode.CLASSIC)
        rig.monotonic.now += 300.0
        assertTrue(round.answer(true))
        assertFalse(round.answer(false))
        assertEquals(1, round.state.value.answers.size)
        rig.monotonic.now += 419.0
        assertFalse(round.next())
        assertEquals(Phase.ANSWERED, round.state.value.phase)
        rig.monotonic.now += 1.0
        assertTrue(round.next())
        assertEquals(Phase.QUESTION, round.state.value.phase)
        assertEquals(1, round.state.value.index)
        assertEquals(rig.monotonic.now, round.cardShownAt)
        assertFalse(round.answer(true), "the new card has its own settle time")
        rig.monotonic.now += 250.0
        assertTrue(round.answer(true))
    }

    @Test
    fun theXLeavesAtOnceWithoutAnswersAndOtherwiseOpensTheSheet() = runTest {
        val rig = Rig(this)
        val round = rig.start(sec, Mode.CLASSIC)
        assertTrue(round.requestLeave())
        assertFalse(round.sheetOpen.value)
        rig.monotonic.now += 300.0
        round.answer(true)
        assertFalse(round.requestLeave())
        assertTrue(round.sheetOpen.value)
        assertEquals(rig.monotonic.now, round.sheetOpenedAt)
        assertFalse(round.decidedWhenSheetOpened)
        assertFalse(round.scrimTapAccepted())
        rig.monotonic.now += 1_000.0
        assertTrue(round.scrimTapAccepted())
        assertFalse(round.next(), "nothing under the sheet takes a press")
        round.keepPlaying()
        assertFalse(round.sheetOpen.value)
        assertTrue(round.next())
    }

    @Test
    fun everyAnswerIsJournalledInOrder() = runTest {
        val rig = Rig(this)
        val round = rig.start(sec, Mode.CLASSIC)
        rig.monotonic.now += 300.0
        round.answer(true)
        rig.monotonic.now += 420.0
        round.next()
        rig.monotonic.now += 250.0
        round.answer(false)
        runCurrent()
        val entry = assertNotNull(rig.journal.pending())
        assertEquals(sec, entry.route)
        assertEquals(Mode.CLASSIC, entry.mode)
        assertEquals(7L, entry.seed)
        assertEquals("round-1", entry.roundId)
        assertEquals(round.state.value.answers.map { it.card.id }, entry.answers.map { it.cardId })
        assertFalse(entry.decided)
        assertFalse(entry.recorded)
    }

    @Test
    fun leavingBeforeAnyAnswerSavesNothing() = runTest {
        val rig = Rig(this)
        val round = rig.start(sec, Mode.CLASSIC)
        val savesAfterDealing = rig.progress.saves
        round.leave()
        assertEquals(savesAfterDealing, rig.progress.saves)
        assertNull(rig.journal.pending())
        assertTrue(round.state.value.abandoned)
    }

    @Test
    fun leavingAnUndecidedRoundKeepsItsAnswersWithoutARecord() = runTest {
        val rig = Rig(this)
        val round = rig.start(sec, Mode.CLASSIC)
        val card = assertNotNull(currentCard(round.state.value))
        rig.monotonic.now += 300.0
        round.answer(card.answer)
        round.leave()
        val stored = rig.progress.stored
        assertEquals(LastRound(sec, Mode.CLASSIC, null, null), stored.last)
        assertTrue(stored.records.isEmpty())
        assertEquals(1L, stored.cards.getValue(card.id).seen)
        assertNull(rig.journal.pending())
    }

    @Test
    fun leavingADecidedRoundRecordsIt() = runTest {
        val rig = Rig(this)
        val round = rig.start(sec, Mode.STREAK)
        val card = assertNotNull(currentCard(round.state.value))
        rig.monotonic.now += 300.0
        round.answer(!card.answer)
        assertTrue(isDecided(round.state.value))
        round.leave()
        assertEquals(0, rig.progress.stored.records[recordKey(sec, Mode.STREAK)])
        assertEquals(LastRound(sec, Mode.STREAK, 0, 1), rig.progress.stored.last)
        assertNull(rig.journal.pending())
    }

    @Test
    fun aFinishedRoundIsRecordedOnceAndItsActionsWaitOneSecond() = runTest {
        val rig = Rig(this)
        val round = rig.start(sec, Mode.STREAK)
        val card = assertNotNull(currentCard(round.state.value))
        rig.monotonic.now += 300.0
        round.answer(!card.answer)
        rig.monotonic.now += 420.0
        assertTrue(round.next())
        assertEquals(Phase.FINISHED, round.state.value.phase)
        round.awaitRecorded()
        val outcome = assertNotNull(round.outcome.value)
        assertTrue(outcome.isNewBest)
        assertNull(outcome.previousBest)
        assertEquals(0, rig.progress.stored.records[recordKey(sec, Mode.STREAK)])
        assertNull(rig.journal.pending())
        val saves = rig.progress.saves
        rig.monotonic.now += 999.0
        assertFalse(round.resultActionReady())
        rig.monotonic.now += 1.0
        assertTrue(round.resultActionReady())
        round.leave()
        assertEquals(saves, rig.progress.saves, "leaving the result writes nothing more")
    }

    @Test
    fun theTimedClockHearsATickEveryHundredMillisecondsAndPausesOnlyWhileStopped() = runTest {
        val rig = Rig(this)
        val round = rig.start(sec, Mode.TIMED)
        assertEquals(60_000.0, clock(round).remainingMs)
        rig.tick(100.0)
        assertEquals(59_900.0, clock(round).remainingMs)
        rig.monotonic.now += 300.0
        round.answer(true)
        assertFalse(round.requestLeave())
        rig.tick(100.0)
        assertEquals(59_800.0, clock(round).remainingMs, "the sheet does not pause the clock")
        round.keepPlaying()
        round.onStop()
        assertTrue(clock(round).hidden)
        rig.wall.now += 5_000.0
        advanceTimeBy(5_000)
        runCurrent()
        assertEquals(59_800.0, clock(round).remainingMs)
        round.onStart()
        assertFalse(clock(round).hidden)
        rig.tick(100.0)
        assertEquals(59_700.0, clock(round).remainingMs)
    }

    @Test
    fun timeUpStopsTheRoundAndSeeResultsWaitsFourHundredTwenty() = runTest {
        val rig = Rig(this)
        val round = rig.start(sec, Mode.TIMED)
        repeat(60) { rig.tick(1_000.0) }
        val upAt = rig.monotonic.now
        assertTrue(isDecided(round.state.value))
        assertEquals(0.0, clock(round).remainingMs)
        val decided = round.state.value
        rig.tick(1_000.0)
        assertSame(decided, round.state.value, "the round no longer changes")
        rig.monotonic.now = upAt + 419.0
        assertFalse(round.next())
        rig.monotonic.now = upAt + 420.0
        assertTrue(round.next())
        assertEquals(Phase.FINISHED, round.state.value.phase)
    }

    @Test
    fun aMinuteRunOutWithNoAnswersIsJournalledAndTheXRecordsAZero() = runTest {
        val rig = Rig(this)
        val round = rig.start(sec, Mode.TIMED)
        repeat(60) { rig.tick(1_000.0) }
        runCurrent()
        val entry = assertNotNull(rig.journal.pending())
        assertTrue(entry.decided)
        assertTrue(entry.answers.isEmpty())
        assertTrue(round.requestLeave(), "no answers: the X leaves without the sheet")
        round.leave()
        assertEquals(0, rig.progress.stored.records[recordKey(sec, Mode.TIMED)])
        assertEquals(LastRound(sec, Mode.TIMED, 0, 0), rig.progress.stored.last)
        assertNull(rig.journal.pending())
    }

    @Test
    fun aTimedRoundDealtWhileStoppedWaitsForTheStart() = runTest {
        val rig = Rig(this)
        val round = rig.start(sec, Mode.TIMED, hidden = true)
        assertTrue(clock(round).hidden)
        rig.tick(1_000.0)
        assertEquals(60_000.0, clock(round).remainingMs)
        round.onStart()
        assertFalse(clock(round).hidden)
        rig.tick(100.0)
        assertEquals(59_900.0, clock(round).remainingMs)
    }
}
