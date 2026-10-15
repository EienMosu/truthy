package com.eienmosu.truthy

import com.eienmosu.truthy.design.ResolvedTheme
import com.eienmosu.truthy.design.resolvedTheme
import com.eienmosu.truthy.engine.DeckIndex
import com.eienmosu.truthy.engine.Phase
import com.eienmosu.truthy.engine.StartChoice
import com.eienmosu.truthy.engine.Step
import com.eienmosu.truthy.engine.Theme
import com.eienmosu.truthy.engine.clearFrom
import com.eienmosu.truthy.engine.decksWithHistory
import com.eienmosu.truthy.engine.findRoute
import com.eienmosu.truthy.engine.recentDecks
import com.eienmosu.truthy.engine.withoutRemovedCards
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** The two top-level screens, swapped in place (spec 5.2): the start flow, or the round with its loading state. */
sealed interface TopScreen {
    data object Start : TopScreen
    data class Round(val request: RoundRequest, val load: RoundLoad) : TopScreen
}

sealed interface RoundLoad {
    data object Loading : RoundLoad
    data object Failed : RoundLoad
    class Ready(val coordinator: RoundCoordinator) : RoundLoad
}

/**
 * The app's state above the two screens: the launch (journal first, then the catalog, then step 1), the swap
 * between the start flow and the round, the ways out of a round, and the theme. AppViewModel owns one, on its
 * viewModelScope; tests own one on a test scope.
 */
class AppController(
    private val scope: CoroutineScope,
    private val services: AppServices,
    private val writer: SerialWriter,
    systemDark: Boolean,
    private val debug: DebugLaunch? = null,
) {
    val startFlow = StartFlowModel(services.monotonic)

    private val _screen = MutableStateFlow<TopScreen>(TopScreen.Start)
    val screen: StateFlow<TopScreen> = _screen.asStateFlow()

    private var stored: Theme? = readStoredTheme()
    private var systemDark: Boolean = systemDark
    private val _theme = MutableStateFlow(resolvedTheme(stored, systemDark))
    val theme: StateFlow<ResolvedTheme> = _theme.asStateFlow()
    val storedTheme: Theme? get() = stored

    private var foreground = true
    private var index: DeckIndex? = null
    private var round: RoundCoordinator? = null

    internal var roundJob: Job? = null
        private set
    internal var leaveJob: Job? = null
        private set

    /** The launch. Declared last: on Main.immediate it starts running inside the constructor. */
    val booted: Job = scope.launch { boot() }

    /** After the unroll of Start round: the round replaces the start flow. */
    fun openRound(request: RoundRequest) {
        if (roundJob?.isActive == true || leaveJob?.isActive == true) return
        roundJob = scope.launch { open(request) }
    }

    /** Try again after a load failure. */
    fun retryRound() {
        val shown = _screen.value as? TopScreen.Round ?: return
        if (shown.load == RoundLoad.Failed) openRound(shown.request)
    }

    /** The X and Escape on the round (PlayScreen.tsx requestLeave); Escape on the sheet keeps playing. */
    fun requestLeave() {
        val shown = _screen.value as? TopScreen.Round ?: return
        val current = (shown.load as? RoundLoad.Ready)?.coordinator
        if (current == null) {
            leaveRound()
            return
        }
        if (current.state.value.phase == Phase.FINISHED) return
        if (current.sheetOpen.value) {
            // The second tap of a double tap on the X lands here, not on the sheet: 80 ms after the first the sheet's
            // window is not up yet. On the web the scrim covers the X and ignores taps for 250 ms (LeaveDialog.tsx:132-134).
            if (current.scrimTapAccepted()) current.keepPlaying()
            return
        }
        if (current.requestLeave()) leaveRound()
    }

    /** Android back on the round (spec D4 and 5.2): the X, or Close results on the result. */
    fun roundBack() {
        val shown = _screen.value as? TopScreen.Round ?: return
        val current = (shown.load as? RoundLoad.Ready)?.coordinator
        if (current != null && current.state.value.phase == Phase.FINISHED) {
            closeResult()
            return
        }
        // Back on the sheet keeps playing at once; backs never wait.
        if (current != null && current.sheetOpen.value) {
            current.keepPlaying()
            return
        }
        requestLeave()
    }

    /** Leave round, and every way out of a round: save with the leave rules, then step 1 with no choices. */
    fun leaveRound() {
        if (leaveJob?.isActive == true) return
        val loading = roundJob
        leaveJob = scope.launch {
            loading?.cancelAndJoin()
            round?.leave()
            showStart(fromRound = true)
        }
    }

    /** Close results and Choose another route: ignored for the result's first 1000 ms. */
    fun closeResult(): Boolean {
        val current = round ?: return false
        if (current.state.value.phase != Phase.FINISHED || !current.resultActionReady()) return false
        leaveRound()
        return true
    }

    /** Play again: the same route and class, progress read and pruned again, a new seed. */
    fun playAgain(): Boolean {
        val current = round ?: return false
        if (current.state.value.phase != Phase.FINISHED || !current.resultActionReady()) return false
        if (roundJob?.isActive == true || leaveJob?.isActive == true) return false
        roundJob = scope.launch {
            current.awaitRecorded()
            current.close()
            round = null
            open(current.request)
        }
        return true
    }

    /** The theme switch: flips the theme on screen, stores it, and flips even when storing fails. */
    fun switchTheme(): Theme {
        val next = com.eienmosu.truthy.engine.switchTheme(stored, systemDark)
        try {
            services.writeTheme(next)
        } catch (e: Exception) {
            // The page flips even when the store fails (theme.ts switchTheme).
        }
        stored = next
        _theme.value = resolvedTheme(next)
        return next
    }

    /** The configuration's night bit changed: followed only while nothing is stored. */
    fun onSystemDarkChanged(dark: Boolean) {
        systemDark = dark
        _theme.value = resolvedTheme(stored, dark)
    }

    fun onStart() {
        foreground = true
        round?.onStart()
    }

    fun onStop() {
        foreground = false
        round?.onStop()
    }

    /** Try again on step 1 after the index failed to load. */
    fun retryCatalog() {
        startFlow.catalogLoading()
        scope.launch { loadCatalog() }
    }

    private suspend fun boot() {
        recoverJournal()
        val launch = debug
        val request = launch?.roundRequest()
        val screen = launch?.screen
        loadCatalog()
        if (request == null || screen == null) return
        if (screen == DebugScreen.START) {
            showDebugStep(launch.step ?: Step.SIX, request)
        } else {
            open(request)?.debugAdvance(screen)
        }
    }

    // Spec 4.5: a journal found at launch is applied with the leave rules and deleted, before anything reads progress.
    private suspend fun recoverJournal() {
        try {
            writer.run { applyJournal(services.journal, services.progress, services.deck) }
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            // The start opens all the same.
        }
    }

    private suspend fun open(request: RoundRequest): RoundCoordinator? {
        _screen.value = TopScreen.Round(request, RoundLoad.Loading)
        val prepared = try {
            prepareRound(request, loadIndex(), services, writer, scope, hidden = !foreground)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            _screen.value = TopScreen.Round(request, RoundLoad.Failed)
            return null
        }
        if (prepared == null) {
            showStart(fromRound = false)
            return null
        }
        round = prepared
        _screen.value = TopScreen.Round(request, RoundLoad.Ready(prepared))
        return prepared
    }

    private suspend fun showStart(fromRound: Boolean) {
        round?.close()
        round = null
        _screen.value = TopScreen.Start
        startFlow.reset(fromRound)
        loadCatalog()
    }

    // useCatalog.ts: the index, the progress, the start-screen prune of every played deck (saved only when the number
    // of card entries changed) and the recent decks, worked out once per visit.
    private suspend fun loadCatalog() {
        val catalog = try {
            val index = loadIndex()
            val cardIds = mutableMapOf<String, List<String>>()
            for (deck in decksWithHistory(index, services.progress.load())) {
                val file = try {
                    services.deck(deck.id)
                } catch (e: CancellationException) {
                    throw e
                } catch (e: Exception) {
                    null
                }
                if (file != null) cardIds[deck.id] = file.cards.map { it.id }
            }
            // One turn of the one writer reads, prunes and writes, and writes only when the number of entries changed.
            writer.run {
                val loaded = services.progress.load()
                val pruned = withoutRemovedCards(loaded, cardIds)
                if (pruned.changed) services.progress.save(pruned.progress)
                Catalog(index, pruned.progress, cardIds, recentDecks(index, pruned.progress))
            }
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            startFlow.catalogFailed()
            return
        }
        startFlow.showCatalog(catalog)
    }

    private suspend fun loadIndex(): DeckIndex = index ?: services.index().also { index = it }

    private suspend fun showDebugStep(step: Step, request: RoundRequest) {
        val found = findRoute(loadIndex(), request.route) ?: return
        val full = StartChoice(
            areaId = found.area.id,
            platformId = found.platform.id,
            deckId = found.deck.id,
            sectionId = request.route.sectionId,
            mode = request.mode,
        )
        startFlow.show(step, clearFrom(full, step))
    }

    private fun readStoredTheme(): Theme? =
        try {
            services.readTheme()
        } catch (e: Exception) {
            null
        }
}
