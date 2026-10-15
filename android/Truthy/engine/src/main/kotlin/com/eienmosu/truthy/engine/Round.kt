package com.eienmosu.truthy.engine

import kotlin.math.max
import kotlin.math.min
import kotlin.math.truncate

// The round: a pure reducer over the dealt cards, a line-by-line port of src/engine/round.ts.
// The only source of chance is the seed given to startRound; time comes in on the events.

val CLASSIC_LENGTH: Int = CHUNK // a Classic round is the first chunk
const val LIVES: Int = 3

// Timed: the length of the round, how long the stamp stays before the next card, and the most time one tick
// may count (a longer gap is time the app did not report).
data class TimedSettings(val roundMs: Double, val holdMs: Double, val maxStepMs: Double)

val TIMED: TimedSettings = TimedSettings(roundMs = 60_000.0, holdMs = 700.0, maxStepMs = 1_000.0)

enum class Phase(val wire: String) {
    QUESTION("question"),
    ANSWERED("answered"),
    STAMPED("stamped"),
    FINISHED("finished"),
}

// The Timed clock. It only moves on events: lastTick is the moment up to which time has been counted (null
// before the first tick and while hidden); holdMs is what is left of the stamp.
data class Clock(val remainingMs: Double, val lastTick: Double?, val hidden: Boolean, val holdMs: Double)

// What the next chunk is dealt from: the route's cards, the stored history, the round's seed and how many
// chunks it has dealt.
data class DealSource(val pool: List<Card>, val history: History, val seed: Double, val chunks: Int)

data class RoundState(
    val mode: Mode,
    val route: Route,
    val cards: List<Card>, // every card dealt so far, in order; the unbounded modes add a chunk when they run out
    val index: Int, // index of the current card
    val answers: List<Answered>,
    val phase: Phase,
    val abandoned: Boolean,
    val source: DealSource,
    val clock: Clock?, // Timed only
)

sealed interface RoundEvent {
    data class Answer(val value: Boolean, val at: Double) : RoundEvent
    data object Next : RoundEvent
    data class Tick(val now: Double) : RoundEvent
    data class Visibility(val hidden: Boolean, val at: Double) : RoundEvent
    data object Abandon : RoundEvent
}

data class StartArgs(val mode: Mode, val route: Route, val pool: List<Card>, val history: History, val seed: Double)

// The seed of chunk k of a round: the round's seed for the first chunk, then steps of the 32-bit golden ratio.
// (seed + Math.imul(chunk, 0x9e3779b9)) >>> 0: Int multiplication wraps as Math.imul does, the sum is a double,
// and >>> 0 takes it modulo 2^32.
fun chunkSeed(seed: Double, chunk: Int): Double = unsigned32(seed + (chunk * GOLDEN_STEP).toDouble())

private val GOLDEN_STEP: Int = 0x9e3779b9L.toInt()

private const val TWO_TO_THE_32: Double = 4_294_967_296.0

// JavaScript's x >>> 0 for a double: not finite gives 0, otherwise truncate towards zero and take it modulo
// 2^32. The + 0.0 turns a negative zero into +0, as JavaScript gives.
private fun unsigned32(value: Double): Double {
    if (!value.isFinite()) return 0.0
    val wrapped = truncate(value) % TWO_TO_THE_32
    return (if (wrapped < 0.0) wrapped + TWO_TO_THE_32 else wrapped) + 0.0
}

private fun withNextChunk(state: RoundState): RoundState {
    val source = state.source
    val chunk = dealChunk(source.pool, source.history, createRng(chunkSeed(source.seed, source.chunks)), state.cards)
    return state.copy(cards = state.cards + chunk, source = source.copy(chunks = source.chunks + 1))
}

// Throws for an empty pool. The TypeScript also throws for a mode it does not know; a Mode value is always one
// of the four, so that case cannot be built here (the golden test checks the vector says so).
fun startRound(args: StartArgs): RoundState {
    if (args.pool.isEmpty()) {
        throw IllegalArgumentException("The route ${args.route.deckId}/${args.route.sectionId} has no cards to deal.")
    }
    return withNextChunk(
        RoundState(
            mode = args.mode,
            route = args.route,
            cards = emptyList(),
            index = 0,
            answers = emptyList(),
            phase = Phase.QUESTION,
            abandoned = false,
            source = DealSource(pool = args.pool, history = args.history, seed = args.seed, chunks = 0),
            clock = if (args.mode == Mode.TIMED) Clock(remainingMs = TIMED.roundMs, lastTick = null, hidden = false, holdMs = 0.0) else null,
        ),
    )
}

// The card on screen; null once the round is finished.
fun currentCard(state: RoundState): Card? =
    if (state.phase == Phase.FINISHED) null else state.cards.getOrNull(state.index)

fun lastAnswer(state: RoundState): Answered? = state.answers.lastOrNull()

fun wrongCount(state: RoundState): Int = state.answers.count { !it.correct }

fun livesLeft(state: RoundState): Int = max(0, LIVES - wrongCount(state))

// Decided: the mode's end rule has been met and only the result is left to show. No answer can change the score
// any more; the next event finishes the round.
fun isDecided(state: RoundState): Boolean {
    if (state.phase == Phase.FINISHED) return false
    return when (state.mode) {
        Mode.CLASSIC -> state.phase == Phase.ANSWERED && state.index + 1 >= state.cards.size
        Mode.STREAK -> state.phase == Phase.ANSWERED && lastAnswer(state)?.correct == false
        Mode.LIVES -> state.phase == Phase.ANSWERED && wrongCount(state) >= LIVES
        Mode.TIMED -> {
            val clock = state.clock
            clock != null && clock.remainingMs == 0.0
        }
    }
}

// Pure: returns a new state, or the very state it was given when the event does not apply.
// An event whose time is not a finite number does not apply: one NaN would make the Timed clock NaN for good, and
// a clock that is never 0 never ends the round.
fun reduce(state: RoundState, event: RoundEvent): RoundState {
    if (state.phase == Phase.FINISHED) return state
    if (!timeOf(event).isFinite()) return state
    return when (event) {
        is RoundEvent.Answer -> if (state.phase == Phase.QUESTION) recordAnswer(state, event.value, event.at) else state
        is RoundEvent.Next -> when {
            isDecided(state) -> state.copy(phase = Phase.FINISHED)
            state.phase == Phase.ANSWERED -> advance(state)
            else -> state
        }
        is RoundEvent.Tick -> {
            val clock = state.clock
            if (clock == null) state else onTick(state, clock, event.now)
        }
        is RoundEvent.Visibility -> {
            val clock = state.clock
            if (clock == null) state else onVisibility(state, clock, event.hidden, event.at)
        }
        is RoundEvent.Abandon -> state.copy(phase = Phase.FINISHED, abandoned = true)
    }
}

// The moment an event happened; 0 for the events that carry no time.
private fun timeOf(event: RoundEvent): Double = when (event) {
    is RoundEvent.Answer -> event.at
    is RoundEvent.Visibility -> event.at
    is RoundEvent.Tick -> event.now
    is RoundEvent.Next, is RoundEvent.Abandon -> 0.0
}

// To the next card as a question. When the dealt cards run out, the next chunk is dealt first (dealChunk never
// returns an empty chunk).
private fun advance(state: RoundState): RoundState {
    val index = state.index + 1
    val dealt = if (index < state.cards.size) state else withNextChunk(state)
    return dealt.copy(index = index, phase = Phase.QUESTION)
}

private fun recordAnswer(state: RoundState, given: Boolean, at: Double): RoundState {
    val card = state.cards.getOrNull(state.index) ?: return state
    val answers = state.answers + Answered(card = card, given = given, correct = given == card.answer, at = at)
    val running = state.clock ?: return state.copy(answers = answers, phase = Phase.ANSWERED)
    // Timed: the clock runs up to the answer first. An answer at or after zero does not count.
    val clock = countTo(running, at)
    if (clock.remainingMs == 0.0) return state.copy(clock = clock, phase = Phase.STAMPED)
    return state.copy(answers = answers, phase = Phase.STAMPED, clock = clock.copy(holdMs = TIMED.holdMs))
}

// The time to count between the last counted moment and `now`: none while hidden or before the first tick,
// never negative (a clock source may jump back), at most maxStepMs.
private fun elapsed(clock: Clock, now: Double): Double {
    val lastTick = clock.lastTick
    if (clock.hidden || lastTick == null) return 0.0
    return min(max(0.0, now - lastTick), TIMED.maxStepMs)
}

private fun countTo(clock: Clock, now: Double): Clock {
    if (clock.hidden) return clock
    return clock.copy(remainingMs = max(0.0, clock.remainingMs - elapsed(clock, now)), lastTick = now)
}

private fun onTick(state: RoundState, clock: Clock, now: Double): RoundState {
    if (clock.remainingMs == 0.0 || clock.hidden) return state
    val passed = elapsed(clock, now)
    val counted = countTo(clock, now)
    if (counted.remainingMs == 0.0) {
        // Time is up. A card that was being stamped has been answered in time: it leaves, and the card that does
        // not count is the next one.
        val stopped = counted.copy(holdMs = 0.0)
        val onCard = if (state.phase == Phase.STAMPED) advance(state.copy(clock = stopped)) else state.copy(clock = stopped)
        return onCard.copy(phase = Phase.STAMPED)
    }
    if (state.phase != Phase.STAMPED) return state.copy(clock = counted)
    val holdMs = max(0.0, clock.holdMs - passed)
    if (holdMs > 0.0) return state.copy(clock = counted.copy(holdMs = holdMs))
    return advance(state.copy(clock = counted.copy(holdMs = 0.0)))
}

private fun onVisibility(state: RoundState, clock: Clock, hidden: Boolean, at: Double): RoundState {
    if (clock.remainingMs == 0.0 || clock.hidden == hidden) return state
    if (!hidden) return state.copy(clock = clock.copy(hidden = false, lastTick = at))
    // Hiding counts the time up to this moment, as a tick does, then pauses.
    val counted = onTick(state, clock, at)
    val countedClock = counted.clock
    if (countedClock == null || countedClock.remainingMs == 0.0) return counted
    return counted.copy(clock = countedClock.copy(hidden = true, lastTick = null))
}

// The number a mode's record keeps (spec section 6, "Modes").
fun scoreOf(mode: Mode, answers: List<Answered>): Int = when (mode) {
    Mode.CLASSIC, Mode.TIMED -> answers.count { it.correct }
    Mode.STREAK -> longestRun(answers)
    Mode.LIVES -> answers.size
}

private fun longestRun(answers: List<Answered>): Int {
    var longest = 0
    var run = 0
    for (answer in answers) {
        run = if (answer.correct) run + 1 else 0
        longest = max(longest, run)
    }
    return longest
}

fun summarise(state: RoundState): RoundResult = RoundResult(
    mode = state.mode,
    route = state.route,
    score = scoreOf(state.mode, state.answers),
    total = state.answers.size,
    answers = state.answers,
    missed = state.answers.filter { !it.correct },
    abandoned = state.abandoned,
)
