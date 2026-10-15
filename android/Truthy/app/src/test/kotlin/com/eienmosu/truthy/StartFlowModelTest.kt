package com.eienmosu.truthy

import com.eienmosu.truthy.engine.CardHistory
import com.eienmosu.truthy.engine.LastRound
import com.eienmosu.truthy.engine.Mode
import com.eienmosu.truthy.engine.PassFieldName
import com.eienmosu.truthy.engine.Progress
import com.eienmosu.truthy.engine.RECENT
import com.eienmosu.truthy.engine.Route
import com.eienmosu.truthy.engine.StartChoice
import com.eienmosu.truthy.engine.Step
import com.eienmosu.truthy.engine.WHOLE_DECK
import com.eienmosu.truthy.engine.chosenOn
import com.eienmosu.truthy.engine.emptyProgress
import com.eienmosu.truthy.engine.recentDecks
import com.eienmosu.truthy.support.CDL
import com.eienmosu.truthy.support.CLF
import com.eienmosu.truthy.support.FakeClock
import com.eienmosu.truthy.support.T0
import com.eienmosu.truthy.support.repositoryDeckStore
import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class StartFlowModelTest {
    private val decks = repositoryDeckStore()
    private val index = decks.index()
    private val clock = FakeClock(10_000.0)
    private val flow = StartFlowModel(clock)

    private val cloud get() = index.areas.first { it.id == "cloud" }
    private fun platform(id: String) = cloud.platforms.first { it.id == id }
    private fun deck(platformId: String, deckId: String) = platform(platformId).decks.first { it.id == deckId }

    private fun show(progress: Progress = emptyProgress()) {
        flow.showCatalog(Catalog(index, progress, emptyMap(), recentDecks(index, progress)))
    }

    private fun settle() {
        clock.now += 250.0
    }

    private val all = listOf(Step.ONE, Step.TWO, Step.THREE, Step.FOUR, Step.FIVE, Step.SIX)

    @Test
    fun optionsWaitTheSettleTimeOfTheirStep() {
        clock.now = 20_000.0
        show()
        clock.now += 249.0
        assertFalse(flow.chooseArea(cloud))
        assertFalse(flow.continueLast())
        assertEquals(Step.ONE, flow.step)
        clock.now += 1.0
        assertTrue(flow.chooseArea(cloud))
        assertFalse(flow.choosePlatform(platform("aws")), "the new step's options wait their own settle time")
        assertEquals(Step.TWO, flow.step)
        assertEquals(StartChoice(areaId = "cloud"), flow.choice.value)
        assertEquals(PassFieldName.AREA, flow.view.value.travel)
        assertEquals(Direction.FORWARD, flow.view.value.dir)
    }

    @Test
    fun aDeckWithSectionsWalksAllSixStepsAndBackRetracesThemWithoutWaiting() {
        show(); settle()
        assertTrue(flow.chooseArea(cloud)); settle()
        assertTrue(flow.choosePlatform(platform("aws"))); settle()
        assertTrue(flow.chooseDeck(deck("aws", CLF))); settle()
        assertEquals(Step.FOUR, flow.step)
        assertTrue(flow.chooseSection("SEC")); settle()
        assertTrue(flow.chooseMode(Mode.CLASSIC))
        assertEquals(all, flow.stack.value)
        val before = flow.choice.value
        assertEquals(StartChoice(areaId = "cloud", platformId = "aws", deckId = CLF, sectionId = "SEC", mode = Mode.CLASSIC), before)
        assertEquals(PassFieldName.MODE, flow.view.value.travel)
        assertEquals(Step.FIVE, flow.previous())
        assertTrue(flow.back(), "a back does not wait for the settle time")
        assertEquals(Step.FIVE, flow.step)
        assertEquals(before.copy(mode = null), flow.choice.value)
        assertEquals(Direction.BACK, flow.view.value.dir)
        assertEquals(chosenOn(Step.FIVE, before), flow.view.value.focusId)
        assertNull(flow.view.value.travel)
        assertEquals(all.take(5), flow.stack.value)
        assertTrue(flow.back(Step.TWO))
        assertEquals(StartChoice(areaId = "cloud"), flow.choice.value)
        assertEquals(listOf(Step.ONE, Step.TWO), flow.stack.value)
    }

    @Test
    fun aDeckWithoutSectionsSkipsTheSectionStep() {
        show(); settle()
        flow.chooseArea(cloud); settle()
        flow.choosePlatform(platform("gcp")); settle()
        assertTrue(flow.chooseDeck(deck("gcp", CDL)))
        assertEquals(Step.FIVE, flow.step)
        assertEquals(WHOLE_DECK, flow.choice.value.sectionId)
        assertEquals(listOf(Step.ONE, Step.TWO, Step.THREE, Step.FIVE), flow.stack.value)
        assertEquals(Step.THREE, flow.previous())
    }

    @Test
    fun stepOneHasNoWayBackSoBackGoesToTheSystem() {
        show()
        assertNull(flow.previous())
        assertFalse(flow.back())
        assertNull(flow.backTransition(1))
        assertEquals(listOf(Step.ONE), flow.stack.value)
    }

    @Test
    fun aBackThatHasNotCompletedChangesNothing() {
        show(); settle()
        flow.chooseArea(cloud); settle()
        flow.choosePlatform(platform("aws"))
        val view = flow.view.value
        val transition = assertNotNull(flow.backTransition(itemCount = 3))
        assertEquals(BackTransition(Step.THREE, Step.TWO, 3), transition)
        for (p in listOf(0f, 0.4f, 0.99f)) transition.frame(p, reducedMotion = false)
        assertEquals(view, flow.view.value)
        assertTrue(flow.back(transition.to))
        assertEquals(StartChoice(areaId = "cloud"), flow.choice.value)
    }

    @Test
    fun theRecentPathSkipsThePlatformAndChangePlatformOpensItsDeckStep() {
        val clfCard = runBlocking { decks.deck(CLF) }.cards.first().id
        val cdlCard = runBlocking { decks.deck(CDL) }.cards.first().id
        val progress = emptyProgress().copy(
            cards = mapOf(clfCard to CardHistory(1, true, T0), cdlCard to CardHistory(1, false, T0 + 1_000.0)),
        )
        show(progress); settle()
        assertTrue(flow.chooseRecent()); settle()
        assertEquals(StartChoice(via = RECENT), flow.choice.value)
        assertEquals(listOf(Step.ONE, Step.THREE), flow.stack.value)
        val recent = assertIs<CatalogState.Ready>(flow.catalog.value).catalog.recent
        assertEquals(listOf(CDL, CLF), recent.map { it.deck.id })
        assertTrue(flow.chooseRecentDeck(recent.first { it.deck.id == CLF }))
        assertEquals(StartChoice(via = RECENT, areaId = "cloud", platformId = "aws", deckId = CLF), flow.choice.value)
        assertEquals(listOf(Step.ONE, Step.THREE, Step.FOUR), flow.stack.value)
        assertEquals(Step.THREE, flow.previous())
        assertTrue(flow.jump(PassFieldName.PLATFORM))
        assertEquals(Step.THREE, flow.step)
        assertEquals(StartChoice(areaId = "cloud", platformId = "aws"), flow.choice.value)
        assertEquals(listOf(Step.ONE, Step.TWO, Step.THREE), flow.stack.value)
        assertEquals(CLF, flow.view.value.focusId)
        assertEquals(Direction.BACK, flow.view.value.dir)
    }

    @Test
    fun theHeaderHoldStopsTheBackPillAndThePassButNotEscape() {
        show(); settle()
        flow.chooseArea(cloud); settle()
        flow.choosePlatform(platform("aws"))
        flow.columnJumped()
        assertFalse(flow.tapBack())
        assertFalse(flow.jump(PassFieldName.AREA))
        assertEquals(Step.THREE, flow.step)
        clock.now += 250.0
        assertTrue(flow.tapBack())
        assertEquals(Step.TWO, flow.step)
        settle()
        flow.choosePlatform(platform("aws"))
        flow.columnJumped()
        assertTrue(flow.back(), "Escape and the gesture skip the hold")
        assertEquals(Step.TWO, flow.step)
    }

    @Test
    fun continueOpensTheReadyPassWithTheWholePathBehindIt() {
        val progress = emptyProgress().copy(last = LastRound(Route(CLF, "SEC"), Mode.STREAK, 4, 5))
        show(progress); settle()
        assertTrue(flow.continueLast())
        assertEquals(Step.SIX, flow.step)
        assertEquals(all, flow.stack.value)
        assertEquals(StartChoice(areaId = "cloud", platformId = "aws", deckId = CLF, sectionId = "SEC", mode = Mode.STREAK), flow.choice.value)
    }

    @Test
    fun startRoundBoardsOnceAndThenEveryWayBackIsConsumed() {
        show(emptyProgress().copy(last = LastRound(Route(CLF, "SEC"), Mode.STREAK, 4, 5))); settle()
        flow.continueLast()
        assertNull(flow.startRound(), "Start round waits the settle time too")
        settle()
        assertEquals(RoundRequest(Route(CLF, "SEC"), Mode.STREAK), flow.startRound())
        assertTrue(flow.boarding.value)
        assertNull(flow.startRound())
        assertFalse(flow.back())
        assertFalse(flow.jump(PassFieldName.DECK))
        settle()
        assertFalse(flow.chooseMode(Mode.CLASSIC))
        assertEquals(Step.SIX, flow.step)
    }

    @Test
    fun resetOpensStepOneWithNoChoices() {
        show(); settle()
        flow.chooseArea(cloud)
        flow.reset(fromRound = true)
        assertEquals(Step.ONE, flow.step)
        assertEquals(StartChoice(), flow.choice.value)
        assertEquals(listOf(Step.ONE), flow.stack.value)
        assertTrue(flow.view.value.fromRound)
        assertFalse(flow.boarding.value)
        assertEquals(CatalogState.Loading, flow.catalog.value)
        flow.arrivalFocusTaken()
        assertFalse(flow.view.value.fromRound)
    }
}
