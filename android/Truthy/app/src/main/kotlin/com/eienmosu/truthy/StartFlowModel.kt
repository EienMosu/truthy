package com.eienmosu.truthy

import com.eienmosu.truthy.engine.DeckIndex
import com.eienmosu.truthy.engine.IndexArea
import com.eienmosu.truthy.engine.IndexDeck
import com.eienmosu.truthy.engine.IndexPlatform
import com.eienmosu.truthy.engine.Mode
import com.eienmosu.truthy.engine.PassFieldName
import com.eienmosu.truthy.engine.Progress
import com.eienmosu.truthy.engine.RECENT
import com.eienmosu.truthy.engine.RecentDeck
import com.eienmosu.truthy.engine.Route
import com.eienmosu.truthy.engine.SWIPE
import com.eienmosu.truthy.engine.StartChoice
import com.eienmosu.truthy.engine.Step
import com.eienmosu.truthy.engine.WHOLE_DECK
import com.eienmosu.truthy.engine.chosenOn
import com.eienmosu.truthy.engine.clearFrom
import com.eienmosu.truthy.engine.continueTarget
import com.eienmosu.truthy.engine.pathTo
import com.eienmosu.truthy.engine.previousStep
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

enum class Direction { FORWARD, BACK }

/**
 * The start flow as the screen draws it. [focusId] names the card chosen before when the flow went back
 * (chosenOn); otherwise the step title takes focus. [travel] is the pass field the chosen name travels into.
 * [seq] counts step changes, the key of the step motion. [fromRound]: the flow was opened from the round by a
 * control, so the step 1 title takes focus once (reference 4.4).
 */
data class StartView(
    val step: Step,
    val choice: StartChoice,
    val dir: Direction,
    val focusId: String? = null,
    val travel: PassFieldName? = null,
    val seq: Int = 0,
    val fromRound: Boolean = false,
)

/** What the start flow shows: the index, the pruned progress, the card ids of the played decks, the recent decks. */
data class Catalog(
    val index: DeckIndex,
    val progress: Progress,
    val cardIds: Map<String, List<String>>,
    val recent: List<RecentDeck>,
)

sealed interface CatalogState {
    data object Loading : CatalogState
    data object Failed : CatalogState
    data class Ready(val catalog: Catalog) : CatalogState
}

/**
 * The start flow's state (StartFlow.tsx:392-700): one screen whose steps change in place, a step stack derived
 * from the path, the settle time of each step, the ways back and boarding. Pure state: the screen of task 12 draws it.
 */
class StartFlowModel(private val monotonic: MonotonicClock) {
    private val _view = MutableStateFlow(StartView(Step.ONE, StartChoice(), Direction.FORWARD))
    val view: StateFlow<StartView> = _view.asStateFlow()

    private val _stack = MutableStateFlow(listOf(Step.ONE))
    val stack: StateFlow<List<Step>> = _stack.asStateFlow()

    private val _choice = MutableStateFlow(StartChoice())
    val choice: StateFlow<StartChoice> = _choice.asStateFlow()

    private val _catalog = MutableStateFlow<CatalogState>(CatalogState.Loading)
    val catalog: StateFlow<CatalogState> = _catalog.asStateFlow()

    private val _boarding = MutableStateFlow(false)
    val boarding: StateFlow<Boolean> = _boarding.asStateFlow()

    // When the current step's options appeared, and until when the Back pill and the pass are held (monotonic).
    private var shownAt = Double.NEGATIVE_INFINITY
    private var headerHeldUntil = Double.NEGATIVE_INFINITY

    val step: Step get() = _view.value.step

    private val current: StartChoice get() = _view.value.choice
    private val onRecent: Boolean get() = current.via == RECENT
    private val ready: Catalog? get() = (_catalog.value as? CatalogState.Ready)?.catalog

    /** The catalog is loaded: step 1's options appear, so their settle time starts now. */
    fun showCatalog(catalog: Catalog) {
        _catalog.value = CatalogState.Ready(catalog)
        shownAt = monotonic.nowMs()
        _stack.value = stackOf(_view.value)
    }

    fun catalogLoading() {
        _catalog.value = CatalogState.Loading
    }

    fun catalogFailed() {
        _catalog.value = CatalogState.Failed
    }

    /** Step 1 with no choices, as after a round or a reload; the catalog is loaded again. */
    fun reset(fromRound: Boolean) {
        _catalog.value = CatalogState.Loading
        _boarding.value = false
        shownAt = Double.NEGATIVE_INFINITY
        headerHeldUntil = Double.NEGATIVE_INFINITY
        publish(StartView(Step.ONE, StartChoice(), Direction.FORWARD, fromRound = fromRound))
    }

    /** The step 1 title has taken focus after the arrival from the round. */
    fun arrivalFocusTaken() {
        val view = _view.value
        if (view.fromRound) _view.value = view.copy(fromRound = false)
    }

    /** Whether the current step's options, Continue and Start round take presses (250 ms after it appeared). */
    fun settled(): Boolean = monotonic.nowMs() - shownAt >= SWIPE.settleMs

    /** The web's forward(): to [step] with [choice]; [field] is where the chosen name travels. False while settling or boarding. */
    fun choose(step: Step, choice: StartChoice, field: PassFieldName? = null): Boolean {
        if (!settled() || _boarding.value) return false
        move(StartView(step, choice, Direction.FORWARD, travel = field, seq = _view.value.seq + 1))
        return true
    }

    fun chooseArea(area: IndexArea): Boolean = choose(Step.TWO, StartChoice(areaId = area.id), PassFieldName.AREA)

    fun chooseRecent(): Boolean = choose(Step.THREE, StartChoice(via = RECENT))

    fun choosePlatform(platform: IndexPlatform): Boolean =
        choose(Step.THREE, current.copy(platformId = platform.id), PassFieldName.PLATFORM)

    /** A deck card of step 3, added to [base] (the choices before it): to its sections, or to the classes for a deck without. */
    fun chooseDeck(deck: IndexDeck, base: StartChoice = current): Boolean =
        if (deck.sections.isNotEmpty()) {
            choose(Step.FOUR, base.copy(deckId = deck.id), PassFieldName.DECK)
        } else {
            choose(Step.FIVE, base.copy(deckId = deck.id, sectionId = WHOLE_DECK), PassFieldName.DECK)
        }

    /** A deck of the recent list: it fills the area, the platform and the deck at once. */
    fun chooseRecentDeck(recent: RecentDeck): Boolean =
        chooseDeck(recent.deck, StartChoice(via = RECENT, areaId = recent.area.id, platformId = recent.platform.id))

    fun chooseSection(sectionId: String): Boolean = choose(Step.FIVE, current.copy(sectionId = sectionId), PassFieldName.SECTION)

    fun chooseMode(mode: Mode): Boolean = choose(Step.SIX, current.copy(mode = mode), PassFieldName.MODE)

    /** The continue line: the ready pass of the last round, with every step of its path behind it. */
    fun continueLast(): Boolean {
        val catalog = ready ?: return false
        if (!settled() || _boarding.value) return false
        val target = continueTarget(catalog.index, catalog.progress) ?: return false
        val choice = StartChoice(
            areaId = target.found.area.id,
            platformId = target.found.platform.id,
            deckId = target.found.deck.id,
            sectionId = target.route.sectionId,
            mode = target.mode,
        )
        move(StartView(Step.SIX, choice, Direction.FORWARD, seq = _view.value.seq + 1))
        return true
    }

    /** The web's backTo(): never waits for the settle time; clears the target step and every later choice. */
    fun back(to: Step): Boolean {
        val view = _view.value
        if (to >= view.step || _boarding.value) return false
        move(StartView(to, clearFrom(view.choice, to), Direction.BACK, focusId = chosenOn(to, view.choice), seq = view.seq + 1))
        return true
    }

    /** One step back (Escape, a completed gesture); false on step 1 and while boarding. */
    fun back(): Boolean {
        val target = previous() ?: return false
        return back(target)
    }

    /** Where one step back leads, or null on step 1 (back then belongs to the system). */
    fun previous(): Step? = if (step == Step.ONE) null else previousStep(step, hasSections(current), onRecent)

    /** The motion of one step back from here, for the predictive back gesture. */
    fun backTransition(itemCount: Int): BackTransition? = previous()?.let { target -> BackTransition(step, target, itemCount) }

    /** The Back pill: held for 250 ms after the short-screen column jumped to its top. */
    fun tapBack(): Boolean = !headerHeld() && back()

    /** A filled pass field: back to its step; on the recent path the platform opens that platform's deck step. */
    fun jump(field: PassFieldName): Boolean {
        if (headerHeld()) return false
        return if (field == PassFieldName.PLATFORM && onRecent) toPlatformDecks() else back(stepOfField(field))
    }

    /** The short-screen column jumped to its top after a step change: the Back pill and the pass wait 250 ms. */
    fun columnJumped() {
        headerHeldUntil = monotonic.nowMs() + SWIPE.settleMs
    }

    /** Start round: the request once, then boarding until reset; null while settling or without a full pass. */
    fun startRound(): RoundRequest? {
        val choice = current
        val deckId = choice.deckId ?: return null
        val sectionId = choice.sectionId ?: return null
        val mode = choice.mode ?: return null
        if (_boarding.value || !settled()) return null
        _boarding.value = true
        return RoundRequest(Route(deckId, sectionId), mode)
    }

    /** Shows [step] with [choice] at once (debug launches only). */
    fun show(step: Step, choice: StartChoice) {
        move(StartView(step, choice, Direction.FORWARD, seq = _view.value.seq + 1))
    }

    private fun toPlatformDecks(): Boolean {
        val choice = current
        val areaId = choice.areaId
        val platformId = choice.platformId
        if (_boarding.value || areaId == null || platformId == null) return false
        move(
            StartView(
                Step.THREE,
                StartChoice(areaId = areaId, platformId = platformId),
                Direction.BACK,
                focusId = choice.deckId,
                seq = _view.value.seq + 1,
            ),
        )
        return true
    }

    private fun headerHeld(): Boolean = monotonic.nowMs() < headerHeldUntil

    private fun move(next: StartView) {
        publish(next)
        shownAt = monotonic.nowMs()
    }

    private fun publish(next: StartView) {
        _view.value = next
        _choice.value = next.choice
        _stack.value = stackOf(next)
    }

    private fun stackOf(view: StartView): List<Step> = pathTo(view.step, hasSections(view.choice), view.choice.via == RECENT)

    // The web's (r.deck?.sections.length ?? 1) > 0: a deck not chosen yet counts as one with sections.
    private fun hasSections(choice: StartChoice): Boolean {
        val index = ready?.index ?: return true
        val deck = index.areas.firstOrNull { it.id == choice.areaId }
            ?.platforms?.firstOrNull { it.id == choice.platformId }
            ?.decks?.firstOrNull { it.id == choice.deckId }
            ?: return true
        return deck.sections.isNotEmpty()
    }

    private fun stepOfField(field: PassFieldName): Step = when (field) {
        PassFieldName.AREA -> Step.ONE
        PassFieldName.PLATFORM -> Step.TWO
        PassFieldName.DECK -> Step.THREE
        PassFieldName.SECTION -> Step.FOUR
        PassFieldName.MODE -> Step.FIVE
    }
}
