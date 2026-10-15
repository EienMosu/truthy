package com.eienmosu.truthy

import com.eienmosu.truthy.engine.LastRound
import com.eienmosu.truthy.engine.Mode
import com.eienmosu.truthy.engine.Phase
import com.eienmosu.truthy.engine.Route
import com.eienmosu.truthy.engine.StartChoice
import com.eienmosu.truthy.engine.Step
import com.eienmosu.truthy.engine.Theme
import com.eienmosu.truthy.engine.currentCard
import com.eienmosu.truthy.engine.emptyProgress
import com.eienmosu.truthy.engine.recordKey
import com.eienmosu.truthy.engine.scoreOf
import com.eienmosu.truthy.support.CLF
import com.eienmosu.truthy.support.FakeClock
import com.eienmosu.truthy.support.MemoryProgressStore
import com.eienmosu.truthy.support.T0
import com.eienmosu.truthy.support.ThemeBox
import com.eienmosu.truthy.support.newTempDir
import com.eienmosu.truthy.support.testDeckStore
import com.eienmosu.truthy.support.testServices
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNotNull
import kotlin.test.assertNotSame
import kotlin.test.assertNull
import kotlin.test.assertTrue

@OptIn(ExperimentalCoroutinesApi::class)
class AppControllerTest {
    private val sec = Route(CLF, "SEC")

    private class Rig(
        val scope: TestScope,
        val systemDark: Boolean = false,
        val debug: DebugLaunch? = null,
        themeFails: Boolean = false,
        gate: CompletableDeferred<Unit>? = null,
    ) {
        val io = StandardTestDispatcher(scope.testScheduler)
        val wall = FakeClock(T0)
        val monotonic = FakeClock(10_000.0)
        val progress = MemoryProgressStore()
        val journal = RoundJournal(newTempDir(), io)
        val theme = ThemeBox(fails = themeFails)
        val decks = testDeckStore(io)
        val writer = SerialWriter(scope.backgroundScope)
        val services = testServices(journal, progress, wall, monotonic, decks, theme, gate)

        /** A new launch of the app over this rig's files: its boot runs when the test next waits. */
        fun start(): AppController = AppController(scope.backgroundScope, services, writer, systemDark, debug)

        suspend fun cardIds(): List<String> = decks.deck(CLF).cards.map { it.id }
    }

    private fun entry(mode: Mode, answers: List<JournalAnswer>, decided: Boolean, recorded: Boolean = false) =
        JournalEntry(route = sec, mode = mode, seed = 7L, roundId = "killed", answers = answers, decided = decided, recorded = recorded)

    private fun coordinatorOf(app: AppController): RoundCoordinator =
        assertIs<RoundLoad.Ready>(assertIs<TopScreen.Round>(app.screen.value).load).coordinator

    private fun assertStepOne(app: AppController) {
        assertEquals(TopScreen.Start, app.screen.value)
        assertEquals(Step.ONE, app.startFlow.view.value.step)
        assertEquals(StartChoice(), app.startFlow.choice.value)
        assertIs<CatalogState.Ready>(app.startFlow.catalog.value)
    }

    @Test
    fun aKilledRoundWithAnswersIsAbandonedAtLaunchAndTheAppOpensAtStepOne() = runTest {
        val rig = Rig(this)
        val ids = rig.cardIds()
        rig.journal.record(entry(Mode.CLASSIC, listOf(JournalAnswer(ids[0], true, true, T0), JournalAnswer(ids[1], true, false, T0 + 1_000.0)), decided = false))
        val app = rig.start()
        app.booted.join()
        assertNull(rig.journal.pending())
        val stored = rig.progress.stored
        assertEquals(LastRound(sec, Mode.CLASSIC, null, null), stored.last)
        assertTrue(stored.records.isEmpty())
        assertEquals(setOf(ids[0], ids[1]), stored.cards.keys)
        assertStepOne(app)
    }

    @Test
    fun aKilledDecidedRoundIsRecordedAtLaunch() = runTest {
        val rig = Rig(this)
        val ids = rig.cardIds()
        rig.journal.record(entry(Mode.STREAK, listOf(JournalAnswer(ids[0], true, false, T0)), decided = true))
        val app = rig.start()
        app.booted.join()
        assertNull(rig.journal.pending())
        assertEquals(0, rig.progress.stored.records[recordKey(sec, Mode.STREAK)])
        assertEquals(LastRound(sec, Mode.STREAK, 0, 1), rig.progress.stored.last)
        assertStepOne(app)
    }

    @Test
    fun aKilledRoundWithNothingToSaveOnlyDeletesItsJournal() = runTest {
        val rig = Rig(this)
        rig.journal.record(entry(Mode.CLASSIC, emptyList(), decided = false))
        val app = rig.start()
        app.booted.join()
        assertNull(rig.journal.pending())
        assertEquals(0, rig.progress.saves)
        assertStepOne(app)
    }

    @Test
    fun anAlreadyRecordedJournalIsDeletedWithoutTouchingProgress() = runTest {
        val rig = Rig(this)
        val ids = rig.cardIds()
        rig.journal.record(entry(Mode.CLASSIC, listOf(JournalAnswer(ids[0], true, true, T0)), decided = true, recorded = true))
        val app = rig.start()
        app.booted.join()
        assertNull(rig.journal.pending())
        assertEquals(emptyProgress(), rig.progress.stored)
        assertStepOne(app)
    }

    @Test
    fun aRoundOpensAndTheXWithoutAnswersReturnsToStepOne() = runTest {
        val rig = Rig(this)
        val app = rig.start()
        app.booted.join()
        app.openRound(RoundRequest(sec, Mode.CLASSIC))
        assertNotNull(app.roundJob).join()
        val round = coordinatorOf(app)
        assertEquals("CLF", round.ticket.deckCode)
        assertEquals(Phase.QUESTION, round.state.value.phase)
        app.requestLeave()
        assertNotNull(app.leaveJob).join()
        assertTrue(round.state.value.abandoned)
        assertEquals(TopScreen.Start, app.screen.value)
        assertTrue(app.startFlow.view.value.fromRound)
        assertIs<CatalogState.Ready>(app.startFlow.catalog.value)
    }

    @Test
    fun backWhileTheRoundLoadsLeavesAtOnce() = runTest {
        val gate = CompletableDeferred<Unit>()
        val rig = Rig(this, gate = gate)
        val app = rig.start()
        app.booted.join()
        app.openRound(RoundRequest(sec, Mode.CLASSIC))
        runCurrent()
        assertEquals(RoundLoad.Loading, assertIs<TopScreen.Round>(app.screen.value).load)
        app.roundBack()
        assertNotNull(app.leaveJob).join()
        assertEquals(TopScreen.Start, app.screen.value)
        gate.complete(Unit)
        runCurrent()
        assertEquals(TopScreen.Start, app.screen.value, "the cancelled deal opens nothing")
    }

    @Test
    fun aTimedRoundStoppedWhileLoadingOpensPaused() = runTest {
        val gate = CompletableDeferred<Unit>()
        val rig = Rig(this, gate = gate)
        val app = rig.start()
        app.booted.join()
        app.openRound(RoundRequest(sec, Mode.TIMED))
        runCurrent()
        app.onStop()
        gate.complete(Unit)
        assertNotNull(app.roundJob).join()
        val round = coordinatorOf(app)
        assertTrue(round.state.value.clock!!.hidden, "ON_STOP during the deal pauses the clock it arms")
        val remaining = round.state.value.clock!!.remainingMs
        rig.wall.now += 5_000.0
        advanceTimeBy(5_000)
        runCurrent()
        assertEquals(remaining, round.state.value.clock!!.remainingMs, "the minute does not drain in the background")
        app.onStart()
        assertFalse(round.state.value.clock!!.hidden)
        round.close()
    }

    @Test
    fun aTimedRoundStartedWhileLoadingRuns() = runTest {
        val gate = CompletableDeferred<Unit>()
        val rig = Rig(this, gate = gate)
        val app = rig.start()
        app.booted.join()
        app.onStop()
        app.openRound(RoundRequest(sec, Mode.TIMED))
        runCurrent()
        app.onStart()
        gate.complete(Unit)
        assertNotNull(app.roundJob).join()
        val round = coordinatorOf(app)
        assertFalse(round.state.value.clock!!.hidden, "ON_START during the deal leaves the clock running")
        round.close()
    }

    @Test
    fun backOnTheRoundActsLikeTheXAndOnTheResultLikeCloseResults() = runTest {
        val rig = Rig(this)
        val app = rig.start()
        app.booted.join()
        app.openRound(RoundRequest(sec, Mode.STREAK))
        assertNotNull(app.roundJob).join()
        val round = coordinatorOf(app)
        rig.monotonic.now += 300.0
        round.answer(assertNotNull(currentCard(round.state.value)).answer)
        app.roundBack()
        assertTrue(round.sheetOpen.value, "with answers, back opens the sheet")
        app.roundBack()
        assertFalse(round.sheetOpen.value, "back on the sheet keeps playing")
        rig.monotonic.now += 420.0
        assertTrue(round.next())
        rig.monotonic.now += 250.0
        round.answer(!assertNotNull(currentCard(round.state.value)).answer)
        rig.monotonic.now += 420.0
        assertTrue(round.next())
        round.awaitRecorded()
        app.roundBack()
        assertNull(app.leaveJob, "the result ignores back for its first second")
        rig.monotonic.now += 1_000.0
        app.roundBack()
        assertNotNull(app.leaveJob).join()
        assertEquals(TopScreen.Start, app.screen.value)
        assertEquals(1, rig.progress.stored.records[recordKey(sec, Mode.STREAK)])
        assertEquals(LastRound(sec, Mode.STREAK, 1, 2), rig.progress.stored.last)
    }

    @Test
    fun playAgainDealsANewRoundOnTheSameRoute() = runTest {
        val rig = Rig(this)
        val app = rig.start()
        app.booted.join()
        app.openRound(RoundRequest(sec, Mode.STREAK))
        assertNotNull(app.roundJob).join()
        val first = coordinatorOf(app)
        rig.monotonic.now += 300.0
        first.answer(!assertNotNull(currentCard(first.state.value)).answer)
        rig.monotonic.now += 420.0
        first.next()
        first.awaitRecorded()
        assertFalse(app.playAgain(), "Play again waits one second")
        rig.monotonic.now += 1_000.0
        assertTrue(app.playAgain())
        assertNotNull(app.roundJob).join()
        val second = coordinatorOf(app)
        assertNotSame(first, second)
        assertEquals(first.request, second.request)
        assertEquals(Phase.QUESTION, second.state.value.phase)
        assertTrue(second.state.value.answers.isEmpty())
    }

    @Test
    fun theSwitchFlipsTheVisibleThemeAndAStoredChoiceBeatsTheSystem() = runTest {
        val rig = Rig(this, systemDark = true)
        val app = rig.start()
        assertEquals(Theme.DARK, app.theme.value.theme, "nothing stored: the system decides")
        assertEquals(Theme.LIGHT, app.switchTheme())
        assertEquals(Theme.LIGHT, app.theme.value.theme)
        assertEquals(Theme.LIGHT, rig.theme.value)
        assertEquals(Theme.LIGHT, app.storedTheme)
        app.onSystemDarkChanged(true)
        assertEquals(Theme.LIGHT, app.theme.value.theme)
    }

    @Test
    fun theSystemThemeIsFollowedWhileNothingIsStored() = runTest {
        val rig = Rig(this, systemDark = false)
        val app = rig.start()
        assertEquals(Theme.LIGHT, app.theme.value.theme)
        app.onSystemDarkChanged(true)
        assertEquals(Theme.DARK, app.theme.value.theme)
        assertNull(app.storedTheme)
    }

    @Test
    fun theThemeFlipsEvenWhenItCannotBeStored() = runTest {
        val rig = Rig(this, systemDark = false, themeFails = true)
        val app = rig.start()
        assertEquals(Theme.DARK, app.switchTheme())
        assertEquals(Theme.DARK, app.theme.value.theme)
        assertNull(rig.theme.value)
    }

    @Test
    fun aDebugLaunchOpensTheRoundAnswered() = runTest {
        val rig = Rig(this, debug = DebugLaunch(seed = 7L, route = sec, mode = Mode.CLASSIC, screen = DebugScreen.ANSWERED, theme = null))
        val app = rig.start()
        app.booted.join()
        val round = coordinatorOf(app)
        assertEquals(Phase.ANSWERED, round.state.value.phase)
        runCurrent()
        assertEquals(1, assertNotNull(rig.journal.pending()).answers.size)
    }

    @Test
    fun aDebugLaunchOpensTheResultRecorded() = runTest {
        val rig = Rig(this, debug = DebugLaunch(seed = 7L, route = sec, mode = Mode.CLASSIC, screen = DebugScreen.RESULT, theme = null))
        val app = rig.start()
        app.booted.join()
        val round = coordinatorOf(app)
        val state = round.state.value
        assertEquals(Phase.FINISHED, state.phase)
        assertEquals(state.cards.size, state.answers.size)
        round.awaitRecorded()
        assertNotNull(round.outcome.value)
        assertEquals(scoreOf(Mode.CLASSIC, state.answers), rig.progress.stored.last?.score)
    }

    @Test
    fun aDebugLaunchOpensAStartStepWithTheRouteChosenUpToIt() = runTest {
        val rig = Rig(this, debug = DebugLaunch(seed = null, route = sec, mode = Mode.CLASSIC, screen = DebugScreen.START, theme = null, step = Step.FIVE))
        val app = rig.start()
        app.booted.join()
        assertEquals(TopScreen.Start, app.screen.value)
        assertEquals(Step.FIVE, app.startFlow.step)
        assertEquals(StartChoice(areaId = "cloud", platformId = "aws", deckId = CLF, sectionId = "SEC"), app.startFlow.choice.value)
    }
}
