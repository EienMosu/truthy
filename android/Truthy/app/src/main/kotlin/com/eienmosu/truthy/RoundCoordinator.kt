package com.eienmosu.truthy

import com.eienmosu.truthy.engine.ApplyOutcome
import com.eienmosu.truthy.engine.DeckIndex
import com.eienmosu.truthy.engine.Mode
import com.eienmosu.truthy.engine.NEXT_ARRIVES_MS
import com.eienmosu.truthy.engine.Phase
import com.eienmosu.truthy.engine.RESULT_ARRIVES_MS
import com.eienmosu.truthy.engine.RoundEvent
import com.eienmosu.truthy.engine.RoundState
import com.eienmosu.truthy.engine.SWIPE
import com.eienmosu.truthy.engine.StartArgs
import com.eienmosu.truthy.engine.TIMED
import com.eienmosu.truthy.engine.TicketInfo
import com.eienmosu.truthy.engine.bestFor
import com.eienmosu.truthy.engine.currentCard
import com.eienmosu.truthy.engine.emptyProgress
import com.eienmosu.truthy.engine.findRoute
import com.eienmosu.truthy.engine.isDecided
import com.eienmosu.truthy.engine.leavesSomething
import com.eienmosu.truthy.engine.poolFor
import com.eienmosu.truthy.engine.pruneDeck
import com.eienmosu.truthy.engine.recordRound
import com.eienmosu.truthy.engine.reduce
import com.eienmosu.truthy.engine.saveLeftRound
import com.eienmosu.truthy.engine.startRound
import com.eienmosu.truthy.engine.ticketFor
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * One round on screen (PlayScreen.tsx, useRound.ts, useClock.ts, leave.ts, ResultView.tsx): the one answer path and
 * its guards, the leave sheet's state, the Timed ticker and its pause on ON_STOP, the journal after every answer,
 * the record when the result shows, and the save on leave. The reducer of the engine does the rules.
 */
class RoundCoordinator(
    val request: RoundRequest,
    val ticket: TicketInfo,
    initial: RoundState,
    val seed: Long,
    val roundId: String,
    private val scope: CoroutineScope,
    private val writer: SerialWriter,
    private val progressStore: ProgressStore,
    private val journal: RoundJournal,
    private val wall: WallClock,
    private val monotonic: MonotonicClock,
    hidden: Boolean,
) {
    private class AnsweredAt(val index: Int, val at: Double)

    private val _state = MutableStateFlow(initial)
    val state: StateFlow<RoundState> = _state.asStateFlow()

    private val _sheetOpen = MutableStateFlow(false)
    val sheetOpen: StateFlow<Boolean> = _sheetOpen.asStateFlow()

    private val _outcome = MutableStateFlow<ApplyOutcome?>(null)

    /** What recording the result said, once it is written: the comparison and the result's guard start here. */
    val outcome: StateFlow<ApplyOutcome?> = _outcome.asStateFlow()

    /** When the card on screen appeared, on the monotonic clock: the swipe's SwipeContext.cardShownAt. */
    var cardShownAt: Double = monotonic.nowMs()
        private set

    var sheetOpenedAt: Double = Double.NEGATIVE_INFINITY
        private set

    /** Whether the round was already decided when the sheet opened (LeaveDialog.tsx decidedAtOpen). */
    var decidedWhenSheetOpened: Boolean = false
        private set

    private val timed = request.mode == Mode.TIMED
    private var answeredAt: AnsweredAt? = null
    private var timeUpAt: Double? = null
    private var resultShownAt: Double? = null
    private var stopped = hidden
    private var ticker: Job? = null
    private var recordJob: Job? = null
    private var journalled: Pair<Int, Boolean> = 0 to false

    init {
        // useClock.ts: a page already hidden pauses the clock first; the first tick arms it.
        if (timed) {
            val now = wall.nowMs()
            if (hidden) dispatch(RoundEvent.Visibility(hidden = true, at = now))
            dispatch(RoundEvent.Tick(now))
            if (!hidden) startTicker()
        }
    }

    /** True, False, the arrows and a committed swipe. False when a guard drops it. */
    fun answer(value: Boolean): Boolean {
        val round = _state.value
        if (round.phase != Phase.QUESTION || _sheetOpen.value) return false
        val at = monotonic.nowMs()
        if (at - cardShownAt < SWIPE.settleMs) return false
        if (answeredAt?.index != round.index) answeredAt = AnsweredAt(round.index, at)
        dispatch(RoundEvent.Answer(value = value, at = wall.nowMs()))
        return true
    }

    /** Next card, See results and Return: 420 ms after the answer, or after time ran out. */
    fun next(): Boolean {
        if (_sheetOpen.value) return false
        val round = _state.value
        val since = when {
            round.phase == Phase.ANSWERED -> answeredAt?.at
            timed && isDecided(round) -> timeUpAt
            else -> null
        } ?: return false
        if (monotonic.nowMs() - since < NEXT_ARRIVES_MS) return false
        dispatch(RoundEvent.Next)
        return true
    }

    /** The X and Escape: true when the round should be left at once (no answers); otherwise the sheet opens. */
    fun requestLeave(): Boolean {
        val round = _state.value
        if (round.phase == Phase.FINISHED) return false
        if (round.answers.isEmpty()) return true
        if (!_sheetOpen.value) {
            sheetOpenedAt = monotonic.nowMs()
            decidedWhenSheetOpened = isDecided(round)
            _sheetOpen.value = true
        }
        return false
    }

    fun keepPlaying() {
        _sheetOpen.value = false
    }

    /** The web's scrim ignores taps for 250 ms after the sheet opens (LeaveDialog.tsx:132-134). */
    fun scrimTapAccepted(): Boolean = monotonic.nowMs() - sheetOpenedAt >= SWIPE.settleMs

    /**
     * Leaves the round (PlayScreen.tsx leave, leave.ts): before the result it is abandoned on screen and saved with
     * the leave rules when it leaves something; on the result it waits for the record. The journal goes either way.
     */
    suspend fun leave() {
        stopTicker()
        _sheetOpen.value = false
        val round = _state.value
        if (round.phase == Phase.FINISHED) {
            recordJob?.join()
            return
        }
        _state.value = reduce(round, RoundEvent.Abandon)
        try {
            writer.run {
                if (leavesSomething(round)) progressStore.update { stored -> saveLeftRound(round, stored) }
                journal.clear()
            }
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            // A storage failure never reaches the player.
        }
    }

    /** ON_STOP: the only pause of the Timed clock (spec 5.6). */
    fun onStop() {
        if (stopped) return
        stopped = true
        if (!clockRunning()) return
        stopTicker()
        dispatch(RoundEvent.Visibility(hidden = true, at = wall.nowMs()))
    }

    /** ON_START: the Timed clock runs again from now. */
    fun onStart() {
        if (!stopped) return
        stopped = false
        if (!clockRunning()) return
        dispatch(RoundEvent.Visibility(hidden = false, at = wall.nowMs()))
        startTicker()
    }

    suspend fun awaitRecorded() {
        recordJob?.join()
    }

    /** Play again, Choose another route and Close results: 1000 ms after the result was recorded and shown. */
    fun resultActionReady(): Boolean {
        val shown = resultShownAt ?: return false
        return monotonic.nowMs() - shown >= RESULT_ARRIVES_MS
    }

    /** Stops the ticker and this round's coroutines. */
    fun close() {
        stopTicker()
        scope.cancel()
    }

    /**
     * Debug launches: drives the round to [screen] without the guards. Answers alternate right and wrong; Timed
     * answers three cards and then runs the minute out in one-second ticks.
     */
    fun debugAdvance(screen: DebugScreen) {
        var at = wall.nowMs()
        var given = 0
        fun answerCard() {
            val card = currentCard(_state.value) ?: return
            answeredAt = AnsweredAt(_state.value.index, monotonic.nowMs())
            dispatch(RoundEvent.Answer(value = if (given % 2 == 0) card.answer else !card.answer, at = at))
            given += 1
        }
        fun tickUntilQuestion() {
            while (_state.value.phase == Phase.STAMPED && !isDecided(_state.value)) {
                at += TICK_MS
                dispatch(RoundEvent.Tick(at))
            }
        }
        when (screen) {
            DebugScreen.START, DebugScreen.ROUND -> Unit
            DebugScreen.ANSWERED -> answerCard()
            DebugScreen.LEAVE_SHEET -> {
                answerCard()
                if (timed) tickUntilQuestion() else dispatch(RoundEvent.Next)
                requestLeave()
            }
            DebugScreen.RESULT -> {
                if (timed) {
                    repeat(3) {
                        answerCard()
                        tickUntilQuestion()
                    }
                    while (!isDecided(_state.value)) {
                        at += TIMED.maxStepMs
                        dispatch(RoundEvent.Tick(at))
                    }
                } else {
                    while (!isDecided(_state.value)) {
                        if (_state.value.phase == Phase.QUESTION) answerCard() else dispatch(RoundEvent.Next)
                    }
                }
                dispatch(RoundEvent.Next)
            }
        }
    }

    private fun dispatch(event: RoundEvent) {
        val before = _state.value
        val after = reduce(before, event)
        if (after === before) return
        _state.value = after
        changed(before, after)
    }

    private fun changed(before: RoundState, after: RoundState) {
        if (after.phase == Phase.QUESTION && (before.phase != Phase.QUESTION || before.index != after.index)) {
            cardShownAt = monotonic.nowMs()
        }
        if (timed && isDecided(after) && !isDecided(before)) {
            timeUpAt = monotonic.nowMs()
            stopTicker()
        }
        if (after.phase == Phase.FINISHED) {
            if (!after.abandoned) record(after)
            return
        }
        val mark = after.answers.size to isDecided(after)
        if (mark != journalled) {
            journalled = mark
            val entry = journalEntry(after, seed, roundId)
            writer.submit { journal.record(entry) }
        }
    }

    // ResultView.tsx recordRound: once per round; then the journal is marked recorded and deleted (task 9's order).
    private fun record(finished: RoundState) {
        if (recordJob != null) return
        recordJob = scope.launch {
            val outcome = try {
                writer.run {
                    var applied: ApplyOutcome? = null
                    progressStore.update { stored -> recordRound(finished, stored).also { applied = it }.progress }
                    journal.record(journalEntry(finished, seed, roundId, recorded = true))
                    journal.clear()
                    applied
                }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                null
            }
            resultShownAt = monotonic.nowMs()
            _outcome.value = outcome ?: recordRound(finished, emptyProgress())
        }
    }

    private fun clockRunning(): Boolean {
        val round = _state.value
        return timed && round.phase != Phase.FINISHED && !isDecided(round)
    }

    private fun startTicker() {
        if (ticker?.isActive == true) return
        ticker = scope.launch {
            while (true) {
                delay(TICK_MS)
                dispatch(RoundEvent.Tick(wall.nowMs()))
            }
        }
    }

    private fun stopTicker() {
        ticker?.cancel()
        ticker = null
    }

    companion object {
        /** How often the Timed clock is told the time (useRound.ts TICK_MS). */
        const val TICK_MS = 100L
    }
}

/**
 * The web's prepareRound (useRound.ts:169-197): find the route, decode its deck, prune that deck's history and save,
 * deal with a fresh seed. Null when the route no longer resolves or has no cards; a deck that cannot be decoded throws.
 */
suspend fun prepareRound(
    request: RoundRequest,
    index: DeckIndex,
    services: AppServices,
    writer: SerialWriter,
    parent: CoroutineScope,
    hidden: Boolean,
): RoundCoordinator? {
    val found = findRoute(index, request.route) ?: return null
    val deck = services.deck(found.deck.id)
    val progress = writer.run {
        services.progress.update { stored -> pruneDeck(stored, deck.id, deck.cards.map { it.id }) }
    }
    val pool = poolFor(deck, request.route.sectionId)
    if (pool.isEmpty()) return null
    val seed = services.seeds()
    val round = startRound(
        StartArgs(mode = request.mode, route = request.route, pool = pool, history = progress.cards, seed = seed.toDouble()),
    )
    val ticket = ticketFor(found, request.mode, bestFor(progress, request.route, request.mode))
    val scope = CoroutineScope(parent.coroutineContext + SupervisorJob(parent.coroutineContext[Job]))
    return RoundCoordinator(
        request = request,
        ticket = ticket,
        initial = round,
        seed = seed,
        roundId = services.newRoundId(),
        scope = scope,
        writer = writer,
        progressStore = services.progress,
        journal = services.journal,
        wall = services.wall,
        monotonic = services.monotonic,
        hidden = hidden,
    )
}
