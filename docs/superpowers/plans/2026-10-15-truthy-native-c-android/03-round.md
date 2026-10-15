### Task 3: The round reducer, the four classes and the Timed clock

This task ports `src/engine/round.ts` to the Kotlin engine line by line: the constants, the round state and its events, `startRound`, the pure `reduce` with the Classic, Streak, Three lives and Timed rules, the Timed clock with its stamp hold and its pause, the state readers (`currentCard`, `lastAnswer`, `wrongCount`, `livesLeft`, `isDecided`), `chunkSeed`, `scoreOf` and `summarise`. It is the heart of parity (spec success criterion 1): the round coordinator of task 11 only feeds this reducer events, so a Timed clock edge or a chunk seed that differs from the web here changes every round the app plays. The web's four round test files are ported first as JUnit classes, then the reducer is written, then it is checked against the golden vectors plan A exported from the same TypeScript (plan A task 6: 88 traces of the four classes, every state after every event).

Builds on task 1 (content and play types, `createRng`, the golden loader, the purity test) and task 2 (`dealChunk`, `CHUNK`). Nothing in `:app` uses it yet.

**Not compiled during drafting.** Nothing in this file was compiled or run while the plan was written. After the review, tasks 1 to 6 were assembled from these files and run with the Android Studio JBR against plan A's real `native-data`: this task's tests compiled and passed at its own end and in the final state of task 6, and step 12's planted fault failed as stated (README, Drafting record). It was written against the current API pages of `kotlin.test` and `kotlinx.serialization.json`, and its semantics match plan B's task 3 (`docs/superpowers/plans/2026-10-15-truthy-native-b-ios/03-round.md`), whose Swift port of the same tests and reducer did run. If a compile error still appears in a step's code, fix it in place, keep the behaviour the step states, and record it in the commit message.

**Files:**
- Create: `android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/Round.kt`
- Test: create, all in `android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/`: `RoundTesting.kt` (fixtures), `RoundTest.kt`, `ModesTest.kt`, `TimedTest.kt`, `RoundVectors.kt` (vector reading), `RoundGoldenTest.kt`

**Interfaces:**
- Consumes, from task 1 (engine, `com.eienmosu.truthy.engine`; the types are the README's, only the task that creates them is assumed): `@Serializable data class Card(...)` with the shipped key names (so `Card.serializer()` exists), `data class Route(val deckId: String, val sectionId: String)`, `enum class Mode(val wire: String)` with `CLASSIC`, `STREAK`, `LIVES`, `TIMED`, `data class CardHistory(val seen: Long, val lastCorrect: Boolean, val lastSeenAt: Double)`, `typealias History = Map<String, CardHistory>`, `data class Answered(val card: Card, val given: Boolean, val correct: Boolean, val at: Double)`, `data class RoundResult(val mode: Mode, val route: Route, val score: Int, val total: Int, val answers: List<Answered>, val missed: List<Answered>, val abandoned: Boolean)`, `typealias Rng = () -> Double`, `fun createRng(seed: Double): Rng`.
- Consumes, from task 2: `CHUNK` (an `Int`, 10) and `fun dealChunk(pool: List<Card>, history: History, rng: Rng, dealt: List<Card>, budget: ... = SEARCH_BUDGET): List<Card>`. This task calls it with the first four arguments only, so the budget's type does not matter here.
- Consumes, from task 1 (test support in the `:engine` test source set; names assumed, see "Assumed from task 1" below): `Golden.load(module: String, function: String): GoldenFile`, where `GoldenFile` has `val cards: Map<String, JsonElement>` (the file's card table as raw JSON) and `val cases: List<GoldenCase>`, and `GoldenCase` has `val name: String`, `val input: JsonElement`, `val output: JsonElement` (raw JSON, tags such as `{"$card": ...}` and `{"$number": ...}` kept). The test source set has `kotlin.test` (task 1's `libs.kotlin.test.junit`, on JUnit 4) and `kotlinx.serialization.json` on its classpath. Every `Golden.load` call is two string literals (task 1's coverage scan).
- Consumes, from plan A task 6: the files `native-data/golden/src.engine.round.<name>.json` for `startRound`, `reduce`, `currentCard`, `lastAnswer`, `wrongCount`, `livesLeft`, `isDecided`, `summarise`, `scoreOf`, `chunkSeed`, `CLASSIC_LENGTH`, `LIVES`, `TIMED`, in these case shapes: `startRound` has `input: {"args": <StartArgs>}` and a snapshot or `{"$throws": message}` as output; `reduce` has `input: {"start": <StartArgs>, "events": [...]}` and one snapshot per state (the start state first); the six readers have the same input as a `reduce` case and one value per state (`{"$undefined": true}` for an undefined `currentCard` or `lastAnswer`); `scoreOf` has `input: {"mode", "answers"}`; `chunkSeed` has `input: {"seed", "chunk"}`; the constants have one case with `input: null`. A snapshot is the state's own fields with `"chunks": <source.chunks>` in place of `source`, every card as `{"$card": id}`.
- Produces (later tasks rely on these exactly; the names are the README's, the members mirror `round.ts`), in `Round.kt`:

```kotlin
val CLASSIC_LENGTH: Int                               // = CHUNK, 10
const val LIVES: Int = 3
data class TimedSettings(val roundMs: Double, val holdMs: Double, val maxStepMs: Double)
val TIMED: TimedSettings                              // 60_000.0, 700.0, 1_000.0
enum class Phase(val wire: String) { QUESTION("question"), ANSWERED("answered"), STAMPED("stamped"), FINISHED("finished") }
data class Clock(val remainingMs: Double, val lastTick: Double?, val hidden: Boolean, val holdMs: Double)
data class DealSource(val pool: List<Card>, val history: History, val seed: Double, val chunks: Int)
data class RoundState(val mode: Mode, val route: Route, val cards: List<Card>, val index: Int, val answers: List<Answered>, val phase: Phase, val abandoned: Boolean, val source: DealSource, val clock: Clock?)
sealed interface RoundEvent {
    data class Answer(val value: Boolean, val at: Double) : RoundEvent
    data object Next : RoundEvent
    data class Tick(val now: Double) : RoundEvent
    data class Visibility(val hidden: Boolean, val at: Double) : RoundEvent
    data object Abandon : RoundEvent
}
data class StartArgs(val mode: Mode, val route: Route, val pool: List<Card>, val history: History, val seed: Double)
fun chunkSeed(seed: Double, chunk: Int): Double
fun startRound(args: StartArgs): RoundState           // throws IllegalArgumentException for an empty pool
fun currentCard(state: RoundState): Card?
fun lastAnswer(state: RoundState): Answered?
fun wrongCount(state: RoundState): Int
fun livesLeft(state: RoundState): Int
fun isDecided(state: RoundState): Boolean
fun reduce(state: RoundState, event: RoundEvent): RoundState
fun scoreOf(mode: Mode, answers: List<Answered>): Int
fun summarise(state: RoundState): RoundResult
```

  Task 9 stores the seed as a `Long` in the journal and task 11 passes `seed.toDouble()`; task 11 builds `StartArgs`, sends events with wall-clock epoch milliseconds as whole numbers (`System.currentTimeMillis().toDouble()`, reference 3.3, "Which clock") and reads the state through the functions above. `Clock` is this package's class: `kotlin.time.Clock` is not a default import, so it never clashes unless a file imports `kotlin.time.*`, which no file of this project does.

  **Assumed from task 1** (the README says task 1 delivers "the golden loader" without naming it): `Golden.load`, `GoldenFile.cards`, `GoldenFile.cases`, `GoldenCase.name`, `GoldenCase.input`, `GoldenCase.output`, all as above, and that task 1's coverage test finds the golden files a test consumes from `Golden.load` calls whose two arguments are string literals. `RoundVectors.kt` resolves every tag itself (`$card`, `$number`, `$undefined`, `$throws`) and needs nothing else of the loader. If task 1 named these differently, rename the uses in `RoundGoldenTest.kt` (they appear nowhere else); if its `cards` already holds decoded `Card` values, pass that map where the tests call `V.cardTable(golden.cards)`.

**Rules** (reference 3.3, read again from `src/engine/round.ts`):

1. **Start.** `startRound` throws `IllegalArgumentException("The route <deckId>/<sectionId> has no cards to deal.")` for an empty pool, and otherwise deals chunk 0 with `createRng(chunkSeed(seed, 0))`. The TypeScript also throws `The mode "<mode>" is not available.` for an unknown mode; a `Mode` value cannot be unknown, so the golden test checks that the vector holds exactly that message for a mode string that names no `Mode`. Timed starts with `Clock(remainingMs = 60_000.0, lastTick = null, hidden = false, holdMs = 0.0)`, the other classes with `clock = null`.
2. **Chunks.** Chunk k is `dealChunk(pool, history, createRng(chunkSeed(seed, k)), <cards dealt so far>)`, appended to `cards`, and `source.chunks` becomes k + 1. The stored history goes to every chunk, not only the first. `advance` deals the next chunk only when `index + 1` reaches `cards.size`. Classic never deals a second chunk, because it is decided at its last card.
3. **`chunkSeed(seed, chunk)`** is `(seed + Math.imul(chunk, 0x9e3779b9)) >>> 0`. In Kotlin: `Int` multiplication wraps exactly as `Math.imul` (`chunk * 0x9e3779b9L.toInt()`), the sum is a `Double`, and `>>> 0` is "not finite gives 0, otherwise truncate towards zero and take it modulo 2^32", with `+ 0.0` at the end so a negative zero comes out as +0 as JavaScript gives. Pinned: `chunkSeed(12345.0, 0) == 12345.0`, `chunkSeed(4294967295.0, 1) == 2654435768.0`, `chunkSeed(12345.0, 1..5) == 2654448114, 1013916587, 3668352356, 2027820829, 387289302`.
4. **`reduce` returns the very state it was given** (the same reference, which the tests check with `assertSame`, as the web's `toBe` does) when the round is finished, when the event's time is not finite (`Answer.at`, `Tick.now`, `Visibility.at`; `Next` and `Abandon` count as time 0), or when the event does not apply: an answer outside `QUESTION`, a `Next` outside `ANSWERED` on a round that is not decided, a tick or visibility event without a clock, and every case the Timed rules below return unchanged.
5. **Phases.** Classic, Streak and Three lives go `QUESTION`, `ANSWERED` (on an answer), `QUESTION` (on `Next`). Timed goes `QUESTION`, `STAMPED` (on an answer), `QUESTION` (when the hold has been counted down on ticks); it never enters `ANSWERED`. `Next` on a decided round finishes it with `abandoned` false; `Abandon` finishes any unfinished round with `abandoned` true, decided or not.
6. **Decided** (`isDecided`, false once finished): Classic in `ANSWERED` with `index + 1 >= cards.size`; Streak in `ANSWERED` with the last answer wrong; Three lives in `ANSWERED` with 3 or more wrong answers; Timed when `clock.remainingMs == 0.0`.
7. **The Timed clock**, every time on the one wall clock in epoch milliseconds:
   - `elapsed` is 0 while hidden or before the first counted moment, otherwise `min(max(0.0, now - lastTick), 1000.0)`: a step back counts nothing, a step longer than a second counts one second. `countTo` counts `elapsed` off (never below 0) and sets `lastTick = now`; it changes nothing while hidden. The first tick or the first answer arms the clock.
   - An answer counts the clock up to `at` first. If that reaches 0, the answer is not recorded and the phase becomes `STAMPED` with the hold unchanged; otherwise the answer is recorded, the phase becomes `STAMPED` and the hold is 700. An answer while hidden is recorded with its hold, which waits until the app is shown.
   - A tick does nothing at 0 or while hidden. When the clock reaches 0 the hold is set to 0, a card being stamped advances (its answer counts; the card now on screen does not) and the phase is `STAMPED`. Otherwise, while stamped, the hold drops by the same elapsed time and the next card comes when it reaches 0.
   - `Visibility` does nothing at 0 or when `hidden` already has the event's value. Showing sets `hidden = false, lastTick = at`. Hiding first runs the whole tick logic at `at`, then pauses (`hidden = true, lastTick = null`) unless the clock reached 0, which is time up and stays visible.
8. **Scores.** Classic and Timed: correct answers. Streak: the longest run of correct answers. Three lives: answers given. `total` is the number of answers; `missed` is the wrong answers in order. `livesLeft` is `max(0, 3 - wrongCount)`.
9. **Port details.** `kotlin.math.max` and `min` on `Double` are `Math.max` and `Math.min`, which give +0 for `max(0.0, -0.0)` as JavaScript's `Math.max(0, -0)` does. `==` between two non-null `Double` values is IEEE equality, as JavaScript's `===` on numbers. `currentCard` and `recordAnswer` check the index against `cards` before reading (`getOrNull`; the TypeScript reads `undefined`). The engine stays pure: `Round.kt` imports only `kotlin.math`, and task 1's purity test scans it; its comments avoid the words the purity test looks for (the TypeScript's "Randomness" and "sleep" comments are reworded).
10. **The golden comparison.** `RoundVectors` turns a state, an answer and a result into plain views (cards as their ids, numbers as `Double`, `Clock` as itself) and decodes the expected JSON into the same views, so one `assertEquals` compares a whole snapshot exactly. A trace is compared state by state and the first differing state is reported with the case name and its index. No case is skipped (spec 7.1).

No Review Focus line of the README belongs to this task (they concern back, process death, theme, text scale and drags); this task's gate is the round's golden vectors.

**Steps:**

- [ ] **Step 1: Write the round test fixtures.**

Create `android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/RoundTesting.kt`. The round test classes extend it, so its helper names (`card`, `pool`, `start`, `play`) are members and win over any top-level helper another test file of this package declares. The test cards are decoded from the shipped card shape, so they need nothing of `Card` but its serializer.

```kotlin
package com.eienmosu.truthy.engine

import kotlinx.serialization.json.Json

// The fixtures of the web's round tests (tests/engine/round.test.ts, modes.test.ts, timed.test.ts and
// clock-polish.test.ts). The round test classes extend this class, so these names never clash with the
// helpers of other test files.
abstract class RoundTesting {
    val route: Route = Route(deckId = "aws-clf-c02", sectionId = "CON")

    // The web tests' wall-clock origin, in epoch milliseconds.
    val T0: Double = 1_700_000_000_000.0

    val NEXT: RoundEvent = RoundEvent.Next
    val ABANDON: RoundEvent = RoundEvent.Abandon

    // c1, c3, c5 and so on are True, c2, c4 and so on False. Decoded from the shipped card shape.
    fun card(id: String, answer: Boolean): Card = Json.decodeFromString(
        Card.serializer(),
        """
        {"id": "$id", "section": "CON",
         "text": {"en": {"statement": "Statement $id", "explanation": "Explanation $id"}},
         "answer": $answer, "source": {"title": "AWS documentation", "url": "https://docs.aws.amazon.com/"},
         "difficulty": 1, "appliesTo": "", "conflictGroups": []}
        """,
    )

    fun pool(n: Int): List<Card> = List(n) { i -> card("c${i + 1}", i % 2 == 0) }

    fun start(
        mode: Mode = Mode.CLASSIC,
        size: Int = 40,
        seed: Double = 1.0,
        history: History = emptyMap(),
        cards: List<Card>? = null,
    ): RoundState = startRound(StartArgs(mode = mode, route = route, pool = cards ?: pool(size), history = history, seed = seed))

    fun play(state: RoundState, events: List<RoundEvent>): RoundState = events.fold(state) { s, e -> reduce(s, e) }

    fun play(state: RoundState, vararg events: RoundEvent): RoundState = play(state, events.toList())

    fun answer(value: Boolean, at: Double = 1000.0): RoundEvent = RoundEvent.Answer(value = value, at = at)

    fun tick(now: Double): RoundEvent = RoundEvent.Tick(now = now)

    fun hide(at: Double): RoundEvent = RoundEvent.Visibility(hidden = true, at = at)

    fun show(at: Double): RoundEvent = RoundEvent.Visibility(hidden = false, at = at)

    // Answers the card on screen right or wrong (no next).
    fun give(state: RoundState, right: Boolean, at: Double = 1000.0): RoundState {
        val truth = currentCard(state)?.answer ?: true
        return play(state, answer(if (right) truth else !truth, at))
    }

    // Answers the card on screen right, then next.
    fun answerRight(state: RoundState, at: Double = 1000.0): List<RoundEvent> =
        listOf(answer(currentCard(state)?.answer ?: true, at), NEXT)

    // Answers `count` cards right, pressing next after each.
    fun rightTimes(state: RoundState, count: Int): RoundState {
        var s = state
        repeat(count) { s = play(give(s, true), NEXT) }
        return s
    }

    // Ticks every `step` ms from `from` (exclusive) to `to` (inclusive).
    fun ticks(from: Double, to: Double, step: Double = 100.0): List<RoundEvent> {
        val events = mutableListOf<RoundEvent>()
        var now = from + step
        while (now <= to) {
            events += tick(now)
            now += step
        }
        return events
    }

    // A Timed round of a 40-card pool whose clock the first tick at T0 has started.
    fun timed(size: Int = 40, seed: Double = 1.0): RoundState = play(start(Mode.TIMED, size = size, seed = seed), tick(T0))

    // The clock one tick before zero, on the first card, nothing answered.
    fun nearlyUp(): RoundState = play(timed(), ticks(T0, T0 + 59_900))

    fun ids(cards: List<Card>): List<String> = cards.map { it.id }
}
```

- [ ] **Step 2: Port `tests/engine/round.test.ts`.**

Create `android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/RoundTest.kt`:

```kotlin
package com.eienmosu.truthy.engine

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertSame
import kotlin.test.assertTrue

// tests/engine/round.test.ts. Three web tests have no Kotlin form: "rejects a mode it does not know" (a Mode
// value is always one of the four; the startRound golden vector carries that case), "never mutates the state it
// is given" and "does not change the state it summarises" (RoundState and its lists are read-only values).
// Where the web expects the very same object (toBe), these tests use assertSame.
class RoundTest : RoundTesting() {
    @Test
    fun aClassicRoundHasTenCards() {
        assertEquals(10, CLASSIC_LENGTH)
    }

    @Test
    fun startsAClassicRoundOnTheFirstCardInTheQuestionPhaseWithNoAnswers() {
        val state = start()
        assertEquals(Mode.CLASSIC, state.mode)
        assertEquals(route, state.route)
        assertEquals(10, state.cards.size)
        assertEquals(0, state.index)
        assertTrue(state.answers.isEmpty())
        assertEquals(Phase.QUESTION, state.phase)
        assertFalse(state.abandoned)
    }

    @Test
    fun dealsTenDifferentCardsFromThePool() {
        assertEquals(10, ids(start().cards).toSet().size)
    }

    @Test
    fun dealsTheWholePoolWhenItIsSmall() {
        for (n in listOf(1, 4, 9)) assertEquals(n, start(size = n).cards.size, "pool of $n")
    }

    @Test
    fun dealsExactlyTenFromAPoolOfTenOrEleven() {
        assertEquals(10, start(size = 10).cards.size)
        assertEquals(10, start(size = 11).cards.size)
    }

    @Test
    fun dealsTheSameRoundForTheSameSeedAndADifferentOneForAnotherSeed() {
        assertEquals(ids(start(seed = 5.0).cards), ids(start(seed = 5.0).cards))
        val rounds = listOf(1.0, 2.0, 3.0, 4.0, 5.0).map { ids(start(seed = it).cards).joinToString(",") }.toSet()
        assertTrue(rounds.size > 1)
    }

    @Test
    fun passesTheHistoryToTheDealer() {
        val history: History = mapOf(
            "c1" to CardHistory(seen = 1, lastCorrect = false, lastSeenAt = 1.0),
            "c2" to CardHistory(seen = 1, lastCorrect = false, lastSeenAt = 2.0),
        )
        val dealt = ids(start(history = history).cards)
        assertTrue("c1" in dealt)
        assertTrue("c2" in dealt)
    }

    @Test
    fun doesNotChangeThePoolItIsGiven() {
        val cards = pool(20)
        start(cards = cards)
        assertEquals(ids(pool(20)), ids(cards))
    }

    // The web compares with deal(pool, {}, createRng(seed), {count: 10}). With nothing dealt, dealChunk ranks the
    // same cards and chooses them with no conflict group to avoid, no answers before and nothing overdue
    // (deal.ts), which is that deal; the deal golden vectors of task 2 pin both entry points.
    @Test
    fun dealsAClassicRoundAsTheFirstChunkOfItsSeed() {
        for (seed in 1..20) {
            val expected = dealChunk(pool(40), emptyMap(), createRng(seed.toDouble()), emptyList())
            assertEquals(ids(expected), ids(start(seed = seed.toDouble()).cards), "seed $seed")
        }
    }

    @Test
    fun keepsWhatItDealsFrom() {
        val cards = pool(40)
        val state = start(cards = cards)
        assertEquals(DealSource(pool = cards, history = emptyMap(), seed = 1.0, chunks = 1), state.source)
        assertSame(cards, state.source.pool)
    }

    @Test
    fun startsARoundInEveryMode() {
        for (mode in Mode.entries) {
            val state = start(mode)
            assertEquals(Phase.QUESTION, state.phase, mode.wire)
            assertEquals(10, state.cards.size, mode.wire)
            assertEquals(mode == Mode.TIMED, state.clock != null, mode.wire)
        }
    }

    @Test
    fun rejectsAnEmptyPool() {
        val error = assertFailsWith<IllegalArgumentException> { start(cards = emptyList()) }
        assertEquals("The route aws-clf-c02/CON has no cards to deal.", error.message)
    }

    @Test
    fun showsTheFirstDealtCardAndNoAnswerYet() {
        val state = start()
        assertSame(state.cards[0], currentCard(state))
        assertNull(lastAnswer(state))
    }

    @Test
    fun recordsARightAnswerAndShowsTheVerdict() {
        val state = start()
        val first = state.cards[0]
        val after = reduce(state, answer(first.answer, 1234.0))
        val expected = Answered(card = first, given = first.answer, correct = true, at = 1234.0)
        assertEquals(Phase.ANSWERED, after.phase)
        assertEquals(0, after.index)
        assertEquals(listOf(expected), after.answers)
        assertEquals(expected, lastAnswer(after))
    }

    @Test
    fun recordsAWrongAnswerAsNotCorrect() {
        val state = start()
        val first = state.cards[0]
        val after = reduce(state, answer(!first.answer, 50.0))
        assertEquals(listOf(Answered(card = first, given = !first.answer, correct = false, at = 50.0)), after.answers)
    }

    @Test
    fun keepsTheCardOnScreenWhileTheVerdictShows() {
        val state = start()
        assertSame(state.cards[0], currentCard(reduce(state, answer(true))))
    }

    @Test
    fun ignoresNextBeforeTheCardIsAnswered() {
        val state = start()
        assertSame(state, reduce(state, NEXT))
    }

    // The web's "ignores an event it does not know" sends a tick to a Classic round, which has no clock.
    @Test
    fun ignoresATickInAClassicRound() {
        val state = start()
        assertSame(state, reduce(state, tick(5.0)))
    }

    @Test
    fun ignoresASecondAnswerToTheSameCard() {
        val answered = play(start(), answer(true, 10.0))
        val again = reduce(answered, answer(false, 20.0))
        assertSame(answered, again)
        assertEquals(1, again.answers.size)
    }

    @Test
    fun movesToTheNextCardOnNext() {
        val state = start()
        val after = play(state, answer(true), NEXT)
        assertEquals(Phase.QUESTION, after.phase)
        assertEquals(1, after.index)
        assertSame(state.cards[1], currentCard(after))
    }

    @Test
    fun finishesAfterTheTenthCardNotBefore() {
        var state = start()
        repeat(9) { state = play(state, answerRight(state)) }
        assertEquals(Phase.QUESTION, state.phase)
        assertEquals(9, state.index)
        state = play(state, answer(true))
        assertEquals(Phase.ANSWERED, state.phase)
        state = play(state, NEXT)
        assertEquals(Phase.FINISHED, state.phase)
        assertEquals(10, state.answers.size)
        assertFalse(state.abandoned)
        assertNull(currentCard(state))
    }

    @Test
    fun finishesAfterTheLastCardWhenThePoolHasFewerThanTen() {
        var state = start(size = 3)
        repeat(3) { state = play(state, answerRight(state)) }
        assertEquals(Phase.FINISHED, state.phase)
        assertEquals(3, state.answers.size)
    }

    @Test
    fun finishesARoundOfASingleCard() {
        val state = play(start(size = 1), answer(false), NEXT)
        assertEquals(Phase.FINISHED, state.phase)
        assertEquals(1, state.answers.size)
    }

    @Test
    fun recordsEveryCardOnceInTheOrderDealt() {
        var state = start()
        for (i in 0 until 10) state = play(state, answer(i % 3 == 0, (100 + i).toDouble()), NEXT)
        assertEquals(state.cards, state.answers.map { it.card })
        assertEquals((100..109).map { it.toDouble() }, state.answers.map { it.at })
    }

    @Test
    fun ignoresAnswerAndNextOnceFinished() {
        val finished = play(start(size = 2), answer(true), NEXT, answer(true), NEXT)
        assertSame(finished, reduce(finished, answer(true)))
        assertSame(finished, reduce(finished, NEXT))
    }

    @Test
    fun endsAsAbandonedFromTheQuestionPhaseKeepingTheAnswersGiven() {
        val state = play(start(), answer(true), NEXT, ABANDON)
        assertEquals(Phase.FINISHED, state.phase)
        assertTrue(state.abandoned)
        assertEquals(1, state.answers.size)
    }

    @Test
    fun endsAsAbandonedFromTheAnsweredPhase() {
        val state = play(start(), answer(true), ABANDON)
        assertEquals(Phase.FINISHED, state.phase)
        assertTrue(state.abandoned)
        assertEquals(1, state.answers.size)
    }

    @Test
    fun endsAsAbandonedBeforeAnyAnswer() {
        val state = play(start(), ABANDON)
        assertEquals(Phase.FINISHED, state.phase)
        assertTrue(state.abandoned)
        assertTrue(state.answers.isEmpty())
    }

    @Test
    fun canAbandonAtEveryPointOfARound() {
        val begin = start()
        val events = List(10) { listOf(answer(true), NEXT) }.flatten()
        for (cut in events.indices) {
            val left = play(begin, events.take(cut) + ABANDON)
            assertTrue(left.abandoned, "cut $cut")
            assertEquals(Phase.FINISHED, left.phase, "cut $cut")
            assertEquals((cut + 1) / 2, left.answers.size, "cut $cut")
        }
        assertFalse(play(begin, events).abandoned)
    }

    @Test
    fun ignoresAbandonOnceTheRoundHasFinishedNormally() {
        val finished = play(start(size = 1), answer(true), NEXT)
        assertSame(finished, reduce(finished, ABANDON))
    }

    @Test
    fun ignoresAnswerNextAndAbandonAfterAbandoning() {
        val left = play(start(), ABANDON)
        assertSame(left, reduce(left, answer(true)))
        assertSame(left, reduce(left, NEXT))
        assertSame(left, reduce(left, ABANDON))
    }

    @Test
    fun scoresAFinishedClassicRoundCorrectAnswersOutOfTenMissedCardsInOrder() {
        var state = start()
        val wrongAt = setOf(2, 5, 7)
        for (i in 0 until 10) {
            val right = currentCard(state)?.answer ?: true
            state = play(state, answer(if (i in wrongAt) !right else right, (500 + i).toDouble()), NEXT)
        }
        val result = summarise(state)
        assertEquals(Mode.CLASSIC, result.mode)
        assertEquals(route, result.route)
        assertEquals(7, result.score)
        assertEquals(10, result.total)
        assertEquals(10, result.answers.size)
        assertEquals(listOf(state.cards[2], state.cards[5], state.cards[7]), result.missed.map { it.card })
        assertTrue(result.missed.all { !it.correct })
        assertFalse(result.abandoned)
    }

    @Test
    fun scoresAPerfectRoundWithNoMissedCards() {
        var state = start()
        repeat(10) { state = play(state, answerRight(state)) }
        val result = summarise(state)
        assertEquals(listOf(10, 10), listOf(result.score, result.total))
        assertTrue(result.missed.isEmpty())
        assertFalse(result.abandoned)
    }

    @Test
    fun scoresARoundOfASmallPoolOutOfTheCardsItHad() {
        var state = start(size = 4)
        repeat(4) { state = play(state, answerRight(state)) }
        val result = summarise(state)
        assertEquals(listOf(4, 4), listOf(result.score, result.total))
        assertFalse(result.abandoned)
    }

    @Test
    fun summarisesAnAbandonedRoundWithTheAnswersGivenSoFar() {
        var state = start()
        val first = state.cards[0]
        state = play(state, answer(!first.answer, 1.0), NEXT)
        state = play(state, answerRight(state))
        state = play(state, ABANDON)
        val result = summarise(state)
        assertEquals(listOf(1, 2), listOf(result.score, result.total))
        assertTrue(result.abandoned)
        assertEquals(listOf(first), result.missed.map { it.card })
    }

    @Test
    fun summarisesARoundAbandonedBeforeAnyAnswerAsZeroOutOfZero() {
        val expected = RoundResult(
            mode = Mode.CLASSIC,
            route = route,
            score = 0,
            total = 0,
            answers = emptyList(),
            missed = emptyList(),
            abandoned = true,
        )
        assertEquals(expected, summarise(play(start(), ABANDON)))
    }

    @Test
    fun playsAPoolThatListsACardTwiceAsARoundOfItsDistinctCards() {
        var state = start(cards = pool(6) + pool(6))
        assertEquals(6, state.cards.size)
        repeat(6) { state = play(state, answerRight(state)) }
        assertEquals(Phase.FINISHED, state.phase)
        assertEquals(6, state.answers.map { it.card.id }.toSet().size)
        val result = summarise(state)
        assertEquals(listOf(6, 6), listOf(result.score, result.total))
    }
}
```

- [ ] **Step 3: Port `tests/engine/modes.test.ts`.**

Create `android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/ModesTest.kt`. Two tests go beyond the web file: `chunkSeedWrapsAsTheTypeScriptDoes` pins reference 3.3's five computed seeds, and `livesLeftNeverGoesBelowZero` pins the floor of `livesLeft`, which no reachable state shows. The web's Timed hold token test belongs to task 8 (the generated `Tokens.kt` carries the 700).

```kotlin
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
```

- [ ] **Step 4: Port `tests/engine/timed.test.ts` and `tests/engine/clock-polish.test.ts`.**

Create `android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/TimedTest.kt`. Besides the web's cases it pins the Timed edges of reference 3.3 that no web test plays (plan A task 6, rule 8): a step of exactly one second, the first answer arming the clock, an answer while hidden, hiding after the hold ran out, hiding after a long gap, a last step longer than the time left, `NEXT` on an undecided Timed round, hiding at zero during a stamp, and a Timed round left while hidden.

```kotlin
package com.eienmosu.truthy.engine

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertSame
import kotlin.test.assertTrue

// tests/engine/timed.test.ts and clock-polish.test.ts: the Timed clock, the stamp, time up, and times that are
// not numbers. Every time is wall-clock epoch ms from one clock (reference 3.3).
class TimedTest : RoundTesting() {
    @Test
    fun hasSixtySecondsA700MsStampAndCountsAtMostOneSecondPerTick() {
        assertEquals(TimedSettings(roundMs = 60_000.0, holdMs = 700.0, maxStepMs = 1_000.0), TIMED)
    }

    @Test
    fun startsFullAndStoppedAndTheFirstTickStartsItWithoutTakingTime() {
        assertEquals(Clock(remainingMs = 60_000.0, lastTick = null, hidden = false, holdMs = 0.0), start(Mode.TIMED).clock)
        assertEquals(Clock(remainingMs = 60_000.0, lastTick = T0, hidden = false, holdMs = 0.0), timed().clock)
    }

    @Test
    fun theOtherModesHaveNoClockAndIgnoreTicksAndVisibility() {
        for (mode in listOf(Mode.CLASSIC, Mode.STREAK, Mode.LIVES)) {
            val state = start(mode)
            assertNull(state.clock, mode.wire)
            assertSame(state, reduce(state, tick(T0)), mode.wire)
            assertSame(state, reduce(state, hide(T0)), mode.wire)
        }
    }

    @Test
    fun countsDownByTheTimeBetweenTicks() {
        val state = play(timed(), tick(T0 + 100), tick(T0 + 350))
        assertEquals(59_650.0, state.clock?.remainingMs)
        assertEquals(Phase.QUESTION, state.phase)
    }

    @Test
    fun neverCountsBackwardsWhenTheClockSourceJumpsBack() {
        val state = play(timed(), tick(T0 + 500), tick(T0 + 200))
        assertEquals(59_500.0, state.clock?.remainingMs)
        assertEquals(T0 + 200, state.clock?.lastTick)
    }

    @Test
    fun countsAGapOfMoreThanASecondBetweenTwoTicksAsOneSecond() {
        assertEquals(59_000.0, play(timed(), tick(T0 + 45_000)).clock?.remainingMs)
    }

    @Test
    fun countsAStepOfExactlyOneSecondInFullAndOneOfASecondAndAMillisecondAsOneSecond() {
        assertEquals(58_000.0, play(timed(), tick(T0 + 1_000), tick(T0 + 2_001)).clock?.remainingMs)
    }

    @Test
    fun pausesWhileHiddenAndGoesOnFromWhereItWas() {
        val state = play(
            timed(),
            tick(T0 + 1_000),
            hide(T0 + 1_400),
            tick(T0 + 5_000),
            tick(T0 + 9_000),
            show(T0 + 30_000),
            tick(T0 + 30_100),
        )
        assertEquals(Clock(remainingMs = 58_500.0, lastTick = T0 + 30_100, hidden = false, holdMs = 0.0), state.clock)
    }

    @Test
    fun returnsTheSameStateForATickWhileHiddenAndForARepeatedVisibilityEvent() {
        val hidden = play(timed(), hide(T0 + 100))
        assertEquals(Clock(remainingMs = 59_900.0, lastTick = null, hidden = true, holdMs = 0.0), hidden.clock)
        assertSame(hidden, reduce(hidden, tick(T0 + 5_000)))
        assertSame(hidden, reduce(hidden, hide(T0 + 6_000)))
        val shown = timed()
        assertSame(shown, reduce(shown, show(T0 + 50)))
    }

    @Test
    fun anAnswerIsStampedRecordedWithNoAnsweredPhaseAndA700MsHold() {
        val state = give(timed(), true, T0 + 2_000)
        assertEquals(Phase.STAMPED, state.phase)
        assertEquals(1, state.answers.size)
        assertEquals(Clock(remainingMs = 59_000.0, lastTick = T0 + 2_000, hidden = false, holdMs = 700.0), state.clock)
        assertFalse(isDecided(state))
    }

    @Test
    fun theFirstAnswerArmsTheClockWhenNoTickCameBeforeIt() {
        val state = give(start(Mode.TIMED), true, T0)
        assertEquals(Clock(remainingMs = 60_000.0, lastTick = T0, hidden = false, holdMs = 700.0), state.clock)
        val next = play(state, tick(T0 + 700))
        assertEquals(Phase.QUESTION, next.phase)
        assertEquals(1, next.index)
        assertEquals(59_300.0, next.clock?.remainingMs)
    }

    @Test
    fun countsTheClockUpToTheMomentOfTheAnswer() {
        val state = give(play(timed(), tick(T0 + 900)), false, T0 + 950)
        assertEquals(59_050.0, state.clock?.remainingMs)
    }

    @Test
    fun ignoresAnswerAndNextWhileStamped() {
        val state = give(timed(), true, T0 + 500)
        assertSame(state, reduce(state, answer(true, T0 + 600)))
        assertSame(state, reduce(state, NEXT))
    }

    @Test
    fun showsTheNextCardOnce700MsHaveBeenCountedSinceTheAnswerNotBefore() {
        val stamped = give(timed(), true, T0 + 500)
        val before = play(stamped, ticks(T0 + 500, T0 + 1_100))
        assertEquals(Phase.STAMPED, before.phase)
        assertEquals(0, before.index)
        assertEquals(100.0, before.clock?.holdMs)
        val after = play(before, tick(T0 + 1_200))
        assertEquals(Phase.QUESTION, after.phase)
        assertEquals(1, after.index)
        assertEquals(0.0, after.clock?.holdMs)
        assertEquals(58_800.0, after.clock?.remainingMs)
    }

    @Test
    fun holdsTheStampWhileHidden() {
        val state = play(give(timed(), true, T0 + 500), tick(T0 + 800), hide(T0 + 900), show(T0 + 20_000), tick(T0 + 20_200))
        assertEquals(Phase.STAMPED, state.phase)
        assertEquals(100.0, state.clock?.holdMs)
        assertEquals(Phase.QUESTION, play(state, tick(T0 + 20_300)).phase)
    }

    @Test
    fun anAnswerWhileHiddenIsStampedAndItsHoldWaitsForTheAppToShow() {
        val hidden = play(timed(), hide(T0 + 1_000))
        val stamped = give(hidden, true, T0 + 2_000)
        assertEquals(1, stamped.answers.size)
        assertEquals(Clock(remainingMs = 59_000.0, lastTick = null, hidden = true, holdMs = 700.0), stamped.clock)
        assertSame(stamped, reduce(stamped, tick(T0 + 3_000)))
        val shown = play(stamped, listOf(show(T0 + 5_000)) + ticks(T0 + 5_000, T0 + 5_600))
        assertEquals(Phase.STAMPED, shown.phase)
        assertEquals(Phase.QUESTION, play(shown, tick(T0 + 5_700)).phase)
    }

    @Test
    fun hidingAfterTheHoldRanOutShowsTheNextCardThenPauses() {
        val state = play(give(timed(), true, T0 + 100), hide(T0 + 900))
        assertEquals(Phase.QUESTION, state.phase)
        assertEquals(1, state.index)
        assertEquals(Clock(remainingMs = 59_100.0, lastTick = null, hidden = true, holdMs = 0.0), state.clock)
    }

    @Test
    fun hidingAfterALongGapCountsAtMostASecond() {
        val state = play(timed(), hide(T0 + 45_000))
        assertEquals(Clock(remainingMs = 59_000.0, lastTick = null, hidden = true, holdMs = 0.0), state.clock)
    }

    @Test
    fun dealsTheNextChunkWhenTheStampEndsOnTheLastDealtCard() {
        var state = timed()
        var now = T0
        repeat(10) {
            now += 300.0
            state = give(state, true, now)
            state = play(state, ticks(now, now + 700))
            now += 700.0
        }
        assertEquals(Phase.QUESTION, state.phase)
        assertEquals(10, state.index)
        assertEquals(20, state.cards.size)
    }

    @Test
    fun stopsAtZeroOnTheQuestionDecidedStampedTheCardOnScreenNotAnswered() {
        val almost = nearlyUp()
        assertEquals(100.0, almost.clock?.remainingMs)
        val up = play(almost, tick(T0 + 60_000))
        assertEquals(0.0, up.clock?.remainingMs)
        assertEquals(Phase.STAMPED, up.phase)
        assertTrue(isDecided(up))
        assertEquals(0, up.index)
        assertTrue(up.answers.isEmpty())
    }

    @Test
    fun returnsTheSameStateForEveryEventButNextAndAbandonOnceTimeIsUp() {
        val up = play(nearlyUp(), tick(T0 + 60_000))
        assertSame(up, reduce(up, tick(T0 + 60_100)))
        assertSame(up, reduce(up, tick(T0 + 99_000)))
        assertSame(up, reduce(up, hide(T0 + 60_200)))
        assertSame(up, reduce(up, show(T0 + 60_300)))
        assertSame(up, reduce(up, answer(true, T0 + 60_400)))
    }

    @Test
    fun aLastStepLongerThanTheTimeLeftStopsAtZero() {
        val up = play(nearlyUp(), tick(T0 + 60_500))
        assertEquals(Clock(remainingMs = 0.0, lastTick = T0 + 60_500, hidden = false, holdMs = 0.0), up.clock)
        assertEquals(Phase.STAMPED, up.phase)
        assertEquals(0, up.index)
        assertTrue(isDecided(up))
    }

    @Test
    fun nextAfterTimeUpFinishesTheRoundAndTheCardOnScreenIsNeitherCountedNorRecorded() {
        var state = give(timed(), true, T0 + 1_000)
        state = play(state, ticks(T0 + 1_000, T0 + 1_700))
        state = give(state, false, T0 + 2_000)
        state = play(state, ticks(T0 + 2_000, T0 + 60_000))
        assertEquals(Phase.STAMPED, state.phase)
        assertTrue(isDecided(state))
        assertEquals(2, state.index)
        val onScreen = state.cards[2].id
        val done = play(state, NEXT)
        assertEquals(Phase.FINISHED, done.phase)
        val result = summarise(done)
        assertEquals(Mode.TIMED, result.mode)
        assertEquals(listOf(1, 2), listOf(result.score, result.total))
        assertFalse(result.abandoned)
        assertEquals(listOf(state.cards[0].id, state.cards[1].id), result.answers.map { it.card.id })
        assertFalse(result.answers.any { it.card.id == onScreen })
    }

    @Test
    fun nextDoesNothingOnATimedRoundThatIsNotDecided() {
        val state = timed()
        assertSame(state, reduce(state, NEXT))
    }

    @Test
    fun anAnswerThatArrivesAtOrAfterZeroDoesNotCount() {
        for (offset in listOf(60_050.0, 60_000.0)) {
            val late = play(nearlyUp(), answer(true, T0 + offset))
            assertTrue(late.answers.isEmpty(), "at T0 + $offset")
            assertEquals(Phase.STAMPED, late.phase, "at T0 + $offset")
            assertTrue(isDecided(late), "at T0 + $offset")
            assertEquals(0.0, late.clock?.remainingMs, "at T0 + $offset")
        }
    }

    @Test
    fun timeRunningOutDuringTheStampKeepsThatAnswerAndMovesOnToACardThatDoesNotCount() {
        val answered = give(nearlyUp(), true, T0 + 59_950)
        assertEquals(1, answered.answers.size)
        assertEquals(50.0, answered.clock?.remainingMs)
        val up = play(answered, tick(T0 + 60_000))
        assertEquals(Phase.STAMPED, up.phase)
        assertTrue(isDecided(up))
        assertEquals(1, up.index)
        assertEquals(1, up.answers.size)
        assertEquals(0.0, up.clock?.holdMs)
        assertSame(up.cards[1], currentCard(up))
    }

    @Test
    fun hidingThePageAtTheMomentTheTimeRunsOutIsTimeUpNotAPause() {
        val up = play(nearlyUp(), hide(T0 + 60_000))
        assertEquals(0.0, up.clock?.remainingMs)
        assertEquals(false, up.clock?.hidden)
        assertTrue(isDecided(up))
    }

    @Test
    fun hidingAtZeroDuringAStampMovesOnToACardThatDoesNotCount() {
        val up = play(give(nearlyUp(), true, T0 + 59_950), hide(T0 + 60_000))
        assertEquals(Clock(remainingMs = 0.0, lastTick = T0 + 60_000, hidden = false, holdMs = 0.0), up.clock)
        assertEquals(1, up.index)
        assertEquals(1, up.answers.size)
        assertTrue(isDecided(up))
    }

    @Test
    fun aRoundLeftAfterTimeIsUpIsAbandonedLikeAnyOtherAndNextFinishesIt() {
        val up = play(nearlyUp(), tick(T0 + 60_000))
        val left = play(up, ABANDON)
        assertEquals(Phase.FINISHED, left.phase)
        assertTrue(left.abandoned)
        val done = play(up, NEXT)
        assertEquals(Phase.FINISHED, done.phase)
        assertFalse(done.abandoned)
    }

    @Test
    fun aTimedRoundLeftWhileHiddenIsAbandoned() {
        val left = play(timed(), hide(T0 + 1_000), ABANDON)
        assertEquals(Phase.FINISHED, left.phase)
        assertTrue(left.abandoned)
        assertEquals(Clock(remainingMs = 59_000.0, lastTick = null, hidden = true, holdMs = 0.0), left.clock)
    }

    @Test
    fun ignoresEveryTickAfterTheRoundWasLeft() {
        val left = play(timed(), ABANDON)
        assertSame(left, reduce(left, tick(T0 + 100)))
        assertSame(left, reduce(left, hide(T0 + 200)))
    }

    @Test
    fun isTheSameRoundForTheSameSeedAndEvents() {
        val events = listOf(tick(T0), answer(true, T0 + 400)) + ticks(T0 + 400, T0 + 1_100) +
            listOf(hide(T0 + 1_150), show(T0 + 9_000), tick(T0 + 9_100))
        assertEquals(play(start(Mode.TIMED, seed = 5.0), events), play(start(Mode.TIMED, seed = 5.0), events))
    }

    // clock-polish.test.ts: a time that is not a number does not apply.
    @Test
    fun aTickAtANonFiniteTimeIsIgnoredAndTheMinuteStillEndsOnTime() {
        for (bad in listOf(Double.NaN, Double.POSITIVE_INFINITY, Double.NEGATIVE_INFINITY)) {
            val before = play(timed(), ticks(T0, T0 + 5_000))
            val after = reduce(before, tick(bad))
            assertSame(before, after, "tick at $bad")
            val ended = play(after, ticks(T0 + 5_000, T0 + 61_000))
            assertEquals(0.0, ended.clock?.remainingMs, "tick at $bad")
            assertTrue(isDecided(ended), "tick at $bad")
            val late = reduce(ended, answer(currentCard(ended)?.answer ?: true, T0 + 61_000))
            assertEquals(ended.answers.size, late.answers.size, "tick at $bad")
        }
    }

    @Test
    fun anAnswerAtNaNIsIgnoredItNeitherCountsNorMovesTheClock() {
        val state = play(timed(), ticks(T0, T0 + 2_000))
        val after = reduce(state, answer(currentCard(state)?.answer ?: true, Double.NaN))
        assertSame(state, after)
        assertEquals(58_000.0, after.clock?.remainingMs)
    }

    @Test
    fun aPageShownAgainAtNaNIsIgnoredSoTheClockKeepsCountingFromARealMoment() {
        val hidden = play(timed(), hide(T0 + 1_000))
        val after = reduce(hidden, show(Double.NaN))
        assertSame(hidden, after)
        val shown = play(after, listOf(show(T0 + 9_000)) + ticks(T0 + 9_000, T0 + 70_000))
        assertEquals(0.0, shown.clock?.remainingMs)
        assertTrue(isDecided(shown))
    }

    @Test
    fun aClassicAnswerAtNaNIsIgnored() {
        val state = start(Mode.CLASSIC)
        assertSame(state, reduce(state, answer(true, Double.NaN)))
        assertEquals(1, reduce(state, answer(true, T0)).answers.size)
    }
}
```

- [ ] **Step 5: Run the tests and watch them fail.**

```bash
android/Truthy/gradlew -p android/Truthy :engine:test --tests 'com.eienmosu.truthy.engine.RoundTest' --tests 'com.eienmosu.truthy.engine.ModesTest' --tests 'com.eienmosu.truthy.engine.TimedTest'
```

Expected: `> Task :engine:compileTestKotlin FAILED` before any test runs, with errors such as `Unresolved reference 'RoundState'.`, `Unresolved reference 'startRound'.` and `Unresolved reference 'reduce'.`, then `BUILD FAILED`. An error that names anything else (for example `Card`, `dealChunk` or `Json`) means a task 1 or task 2 name differs from this file's Interfaces: stop and reconcile before writing the round.

- [ ] **Step 6: Write the round.**

Create `android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/Round.kt`, the port of `src/engine/round.ts` in the same order:

```kotlin
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
```

- [ ] **Step 7: Run the round suites, then the whole engine.**

```bash
android/Truthy/gradlew -p android/Truthy :engine:test --tests 'com.eienmosu.truthy.engine.RoundTest' --tests 'com.eienmosu.truthy.engine.ModesTest' --tests 'com.eienmosu.truthy.engine.TimedTest'
grep -ho 'testsuite name="[^"]*" tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*" errors="[0-9]*"' android/Truthy/engine/build/test-results/test/TEST-com.eienmosu.truthy.engine.RoundTest.xml android/Truthy/engine/build/test-results/test/TEST-com.eienmosu.truthy.engine.ModesTest.xml android/Truthy/engine/build/test-results/test/TEST-com.eienmosu.truthy.engine.TimedTest.xml
android/Truthy/gradlew -p android/Truthy :engine:test
```

Expected: the first command ends with `BUILD SUCCESSFUL`. The `grep` prints three lines: `RoundTest` with `tests="37"`, `ModesTest` with `tests="24"`, `TimedTest` with `tests="36"`, each with `skipped="0" failures="0" errors="0"` (97 tests; a test that loops over cases counts once). The third command ends with `BUILD SUCCESSFUL`: task 1's purity test now scans `Round.kt` and finds nothing, and the tests of tasks 1 and 2 still pass. No compiler warning names `Round.kt`.

- [ ] **Step 8: Commit the round.**

```bash
git add android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/Round.kt android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/RoundTesting.kt android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/RoundTest.kt android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/ModesTest.kt android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/TimedTest.kt
pnpm vitest run tests/repo-hygiene.test.ts
git commit -m "feat: port the round reducer, the four classes and the Timed clock to the Kotlin engine, with the web's round, modes, timed and clock tests"
```

Expected: the hygiene test passes with the staged files in its scan (`git ls-files` lists staged files), then the commit is created on `native`. Where `pnpm` is not installed, run it as `npx -y pnpm@10.34.0 vitest run tests/repo-hygiene.test.ts`.

- [ ] **Step 9: Write the vector reading.**

Create `android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/RoundVectors.kt`. It reads the round's inputs from the raw JSON of a case (start arguments, events, answers, card references, tagged numbers) and turns round values and expected outputs into the same plain views, so each snapshot is compared with one `assertEquals`. In Kotlin strings the tag keys are written `"\$card"`, `"\$number"`, `"\$undefined"` and `"\$throws"`: an unescaped `$card` would be a string template.

```kotlin
package com.eienmosu.truthy.engine

import kotlin.test.fail
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

// Reads the round's golden vectors (plan A, "The golden vector format") from the raw JSON of a case, and turns
// round values and expected outputs into the same plain views, so one assertEquals compares a whole snapshot.
// Numbers become doubles and are compared exactly: an expected 59650 and an actual 59650.0 are equal views.
object RoundVectors {
    data class AnswerView(val card: String, val given: Boolean, val correct: Boolean, val at: Double)

    data class StateView(
        val mode: String,
        val route: Route,
        val cards: List<String>,
        val index: Int,
        val answers: List<AnswerView>,
        val phase: String,
        val abandoned: Boolean,
        val chunks: Int,
        val clock: Clock?,
    )

    data class ResultView(
        val mode: String,
        val route: Route,
        val score: Int,
        val total: Int,
        val answers: List<AnswerView>,
        val missed: List<AnswerView>,
        val abandoned: Boolean,
    )

    // The TypeScript's undefined, which a vector writes as {"$undefined": true}.
    data object Undefined

    fun obj(value: JsonElement): JsonObject = value as? JsonObject ?: fail("expected an object, got $value")

    fun array(value: JsonElement): JsonArray = value as? JsonArray ?: fail("expected an array, got $value")

    fun field(fields: JsonObject, key: String): JsonElement = fields[key] ?: fail("missing key $key in $fields")

    private fun primitive(value: JsonElement): JsonPrimitive =
        (value as? JsonPrimitive)?.takeIf { it !is JsonNull } ?: fail("expected a primitive, got $value")

    fun string(value: JsonElement): String =
        primitive(value).takeIf { it.isString }?.content ?: fail("expected a string, got $value")

    fun bool(value: JsonElement): Boolean =
        primitive(value).takeIf { !it.isString }?.content?.toBooleanStrictOrNull() ?: fail("expected a boolean, got $value")

    // A plain number, or one of the tagged numbers JSON cannot carry.
    fun number(value: JsonElement): Double {
        if (value is JsonObject) {
            return when (val name = string(field(value, "\$number"))) {
                "NaN" -> Double.NaN
                "Infinity" -> Double.POSITIVE_INFINITY
                "-Infinity" -> Double.NEGATIVE_INFINITY
                "-0" -> -0.0
                else -> fail("unknown tagged number $name")
            }
        }
        val p = primitive(value)
        if (p.isString) fail("expected a number, got $value")
        return p.content.toDoubleOrNull() ?: fail("expected a number, got $value")
    }

    fun int(value: JsonElement): Int {
        val n = number(value)
        val whole = n.toInt()
        if (whole.toDouble() != n) fail("expected an integer, got $n")
        return whole
    }

    // The file's card table, decoded with the engine's own serializer; every entry must hold its own id.
    fun cardTable(raw: Map<String, JsonElement>): Map<String, Card> = raw.mapValues { (id, element) ->
        val decoded = Json.decodeFromJsonElement(Card.serializer(), element)
        if (decoded.id != id) fail("the card table entry $id holds the card ${decoded.id}")
        decoded
    }

    fun ref(value: JsonElement): String = string(field(obj(value), "\$card"))

    // A {"$card": id} reference, looked up in the file's card table. Round vectors use the web tests' own cards,
    // never a whole shipped deck.
    fun card(value: JsonElement, cards: Map<String, Card>): Card {
        val id = ref(value)
        return cards[id] ?: fail("card $id is not in the card table")
    }

    fun isUndefined(value: JsonElement): Boolean = value is JsonObject && value.size == 1 && value.containsKey("\$undefined")

    fun throwsMessage(value: JsonElement): String? =
        (value as? JsonObject)?.takeIf { it.size == 1 }?.get("\$throws")?.let { string(it) }

    fun mode(name: String): Mode? = Mode.entries.firstOrNull { it.wire == name }

    fun route(value: JsonElement): Route {
        val f = obj(value)
        return Route(deckId = string(field(f, "deckId")), sectionId = string(field(f, "sectionId")))
    }

    fun history(value: JsonElement): History = obj(value).mapValues { (_, entry) ->
        val f = obj(entry)
        CardHistory(seen = int(field(f, "seen")).toLong(), lastCorrect = bool(field(f, "lastCorrect")), lastSeenAt = number(field(f, "lastSeenAt")))
    }

    fun startArgs(value: JsonElement, cards: Map<String, Card>): StartArgs {
        val f = obj(value)
        val name = string(field(f, "mode"))
        return StartArgs(
            mode = mode(name) ?: fail("unknown mode $name"),
            route = route(field(f, "route")),
            pool = array(field(f, "pool")).map { card(it, cards) },
            history = history(field(f, "history")),
            seed = number(field(f, "seed")),
        )
    }

    fun roundEvent(value: JsonElement): RoundEvent {
        val f = obj(value)
        return when (val type = string(field(f, "type"))) {
            "answer" -> RoundEvent.Answer(value = bool(field(f, "value")), at = number(field(f, "at")))
            "next" -> RoundEvent.Next
            "tick" -> RoundEvent.Tick(now = number(field(f, "now")))
            "visibility" -> RoundEvent.Visibility(hidden = bool(field(f, "hidden")), at = number(field(f, "at")))
            "abandon" -> RoundEvent.Abandon
            else -> fail("unknown event type $type")
        }
    }

    fun answered(value: JsonElement, cards: Map<String, Card>): Answered {
        val f = obj(value)
        return Answered(
            card = card(field(f, "card"), cards),
            given = bool(field(f, "given")),
            correct = bool(field(f, "correct")),
            at = number(field(f, "at")),
        )
    }

    // A trace: the state startRound returned, then the state after each event.
    fun replay(input: JsonElement, cards: Map<String, Card>): List<RoundState> {
        val f = obj(input)
        var state = startRound(startArgs(field(f, "start"), cards))
        val states = mutableListOf(state)
        for (raw in array(field(f, "events"))) {
            state = reduce(state, roundEvent(raw))
            states += state
        }
        return states
    }

    fun view(answer: Answered): AnswerView =
        AnswerView(card = answer.card.id, given = answer.given, correct = answer.correct, at = answer.at)

    fun view(state: RoundState): StateView = StateView(
        mode = state.mode.wire,
        route = state.route,
        cards = state.cards.map { it.id },
        index = state.index,
        answers = state.answers.map { view(it) },
        phase = state.phase.wire,
        abandoned = state.abandoned,
        chunks = state.source.chunks,
        clock = state.clock,
    )

    fun view(result: RoundResult): ResultView = ResultView(
        mode = result.mode.wire,
        route = result.route,
        score = result.score,
        total = result.total,
        answers = result.answers.map { view(it) },
        missed = result.missed.map { view(it) },
        abandoned = result.abandoned,
    )

    fun expectedAnswer(value: JsonElement): AnswerView {
        val f = obj(value)
        return AnswerView(
            card = ref(field(f, "card")),
            given = bool(field(f, "given")),
            correct = bool(field(f, "correct")),
            at = number(field(f, "at")),
        )
    }

    fun expectedClock(value: JsonElement): Clock? {
        if (value is JsonNull) return null
        val f = obj(value)
        val lastTick = field(f, "lastTick")
        return Clock(
            remainingMs = number(field(f, "remainingMs")),
            lastTick = if (lastTick is JsonNull) null else number(lastTick),
            hidden = bool(field(f, "hidden")),
            holdMs = number(field(f, "holdMs")),
        )
    }

    // The snapshot of plan A's format: the state's own fields, with source replaced by its chunk count.
    fun expectedState(value: JsonElement): StateView {
        val f = obj(value)
        return StateView(
            mode = string(field(f, "mode")),
            route = route(field(f, "route")),
            cards = array(field(f, "cards")).map { ref(it) },
            index = int(field(f, "index")),
            answers = array(field(f, "answers")).map { expectedAnswer(it) },
            phase = string(field(f, "phase")),
            abandoned = bool(field(f, "abandoned")),
            chunks = int(field(f, "chunks")),
            clock = expectedClock(field(f, "clock")),
        )
    }

    fun expectedResult(value: JsonElement): ResultView {
        val f = obj(value)
        return ResultView(
            mode = string(field(f, "mode")),
            route = route(field(f, "route")),
            score = int(field(f, "score")),
            total = int(field(f, "total")),
            answers = array(field(f, "answers")).map { expectedAnswer(it) },
            missed = array(field(f, "missed")).map { expectedAnswer(it) },
            abandoned = bool(field(f, "abandoned")),
        )
    }

    // What a state reader returns, as a view; Undefined is the TypeScript's undefined.
    fun read(function: String, state: RoundState): Any = when (function) {
        "currentCard" -> currentCard(state)?.id ?: Undefined
        "lastAnswer" -> lastAnswer(state)?.let { view(it) } ?: Undefined
        "wrongCount" -> wrongCount(state)
        "livesLeft" -> livesLeft(state)
        "isDecided" -> isDecided(state)
        "summarise" -> view(summarise(state))
        else -> fail("no reader named $function")
    }

    fun expectedRead(function: String, value: JsonElement): Any = when {
        isUndefined(value) -> Undefined
        function == "currentCard" -> ref(value)
        function == "lastAnswer" -> expectedAnswer(value)
        function == "wrongCount" || function == "livesLeft" -> int(value)
        function == "isDecided" -> bool(value)
        function == "summarise" -> expectedResult(value)
        else -> fail("no reader named $function")
    }
}
```

- [ ] **Step 10: Write the golden tests.**

Create `android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/RoundGoldenTest.kt`. Every case of every file is checked, a trace is compared state by state, and each `Golden.load` call names its module and function as two string literals, so task 1's coverage test sees that the thirteen round files are consumed.

```kotlin
package com.eienmosu.truthy.engine

import com.eienmosu.truthy.engine.RoundVectors as V
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue
import kotlin.test.fail

// The round against the vectors the TypeScript computed (native-data/golden/src.engine.round.*.json): every
// case of every file, every state of every trace. A trace is replayed and compared state by state; the first
// differing state fails with the case name and its index.
class RoundGoldenTest {
    @Test
    fun classicLengthLivesAndTimedAreTheWebConstants() {
        assertEquals(V.int(Golden.load("src/engine/round", "CLASSIC_LENGTH").cases.single().output), CLASSIC_LENGTH)
        assertEquals(V.int(Golden.load("src/engine/round", "LIVES").cases.single().output), LIVES)
        val timed = V.obj(Golden.load("src/engine/round", "TIMED").cases.single().output)
        assertEquals(3, timed.size)
        val expected = TimedSettings(
            roundMs = V.number(V.field(timed, "roundMs")),
            holdMs = V.number(V.field(timed, "holdMs")),
            maxStepMs = V.number(V.field(timed, "maxStepMs")),
        )
        assertEquals(expected, TIMED)
    }

    @Test
    fun chunkSeedVectors() {
        val golden = Golden.load("src/engine/round", "chunkSeed")
        assertTrue(golden.cases.isNotEmpty())
        for (item in golden.cases) {
            val input = V.obj(item.input)
            val actual = chunkSeed(V.number(V.field(input, "seed")), V.int(V.field(input, "chunk")))
            assertEquals(V.number(item.output), actual, item.name)
        }
    }

    @Test
    fun scoreOfVectors() {
        val golden = Golden.load("src/engine/round", "scoreOf")
        val cards = V.cardTable(golden.cards)
        assertTrue(golden.cases.isNotEmpty())
        for (item in golden.cases) {
            val input = V.obj(item.input)
            val name = V.string(V.field(input, "mode"))
            val mode = V.mode(name) ?: fail("${item.name}: unknown mode $name")
            val answers = V.array(V.field(input, "answers")).map { V.answered(it, cards) }
            assertEquals(V.int(item.output), scoreOf(mode, answers), item.name)
        }
    }

    @Test
    fun startRoundVectors() {
        val golden = Golden.load("src/engine/round", "startRound")
        val cards = V.cardTable(golden.cards)
        assertTrue(golden.cases.isNotEmpty())
        for (item in golden.cases) {
            val args = V.field(V.obj(item.input), "args")
            val modeName = V.string(V.field(V.obj(args), "mode"))
            val thrown = V.throwsMessage(item.output)
            if (V.mode(modeName) == null) {
                // A Mode value is always one of the four: the TypeScript's unknown-mode throw cannot be built here.
                assertEquals("The mode \"$modeName\" is not available.", thrown, item.name)
                continue
            }
            val start = V.startArgs(args, cards)
            if (thrown != null) {
                val error = assertFailsWith<IllegalArgumentException>(item.name) { startRound(start) }
                assertEquals(thrown, error.message, item.name)
            } else {
                assertEquals(V.expectedState(item.output), V.view(startRound(start)), item.name)
            }
        }
    }

    @Test
    fun reduceTraces() {
        val golden = Golden.load("src/engine/round", "reduce")
        val cards = V.cardTable(golden.cards)
        assertTrue(golden.cases.isNotEmpty())
        for (item in golden.cases) {
            val states = V.replay(item.input, cards)
            val expected = V.array(item.output)
            assertEquals(expected.size, states.size, "${item.name}: one snapshot per event plus the start")
            for (i in states.indices) {
                assertEquals(V.expectedState(expected[i]), V.view(states[i]), "${item.name}: state $i")
            }
        }
    }

    @Test
    fun currentCardVectors() = checkReader("currentCard", Golden.load("src/engine/round", "currentCard"))

    @Test
    fun lastAnswerVectors() = checkReader("lastAnswer", Golden.load("src/engine/round", "lastAnswer"))

    @Test
    fun wrongCountVectors() = checkReader("wrongCount", Golden.load("src/engine/round", "wrongCount"))

    @Test
    fun livesLeftVectors() = checkReader("livesLeft", Golden.load("src/engine/round", "livesLeft"))

    @Test
    fun isDecidedVectors() = checkReader("isDecided", Golden.load("src/engine/round", "isDecided"))

    @Test
    fun summariseVectors() = checkReader("summarise", Golden.load("src/engine/round", "summarise"))

    // A reader's file holds the input of a reduce trace and the reader's value on every state of it.
    private fun checkReader(function: String, golden: GoldenFile) {
        val cards = V.cardTable(golden.cards)
        assertTrue(golden.cases.isNotEmpty(), function)
        for (item in golden.cases) {
            val states = V.replay(item.input, cards)
            val expected = V.array(item.output)
            assertEquals(expected.size, states.size, "${item.name}: one value per state")
            for (i in states.indices) {
                assertEquals(V.expectedRead(function, expected[i]), V.read(function, states[i]), "${item.name}: $function of state $i")
            }
        }
    }
}
```

`@Test fun x() = checkReader(...)` returns `Unit`, which JUnit requires; `checkReader` is declared with no return type, so it is `Unit`.

- [ ] **Step 11: Run the golden tests.**

```bash
android/Truthy/gradlew -p android/Truthy :engine:test --tests 'com.eienmosu.truthy.engine.RoundGoldenTest'
grep -ho 'testsuite name="[^"]*" tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*" errors="[0-9]*"' android/Truthy/engine/build/test-results/test/TEST-com.eienmosu.truthy.engine.RoundGoldenTest.xml
```

Expected: `BUILD SUCCESSFUL`, and the `grep` prints `RoundGoldenTest` with `tests="11" skipped="0" failures="0" errors="0"`. A failure names the case and the first state that differs; fix `Round.kt`, never the vectors (plan A generates them and its drift test guards them). If `Golden.load` throws because a file is missing, plan A's export does not hold the round files: stop and report, do not skip.

- [ ] **Step 12: Check that the vectors bite.**

```bash
perl -pi -e 's/maxStepMs = 1_000\.0\)/maxStepMs = 999.0)/' android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/Round.kt
grep -n 'maxStepMs = 999.0' android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/Round.kt
android/Truthy/gradlew -p android/Truthy :engine:test --tests 'com.eienmosu.truthy.engine.RoundGoldenTest'
git checkout -- android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/Round.kt
git status --short android/Truthy/engine
```

Expected: the `grep` prints the one changed line (the `TIMED` value). The run fails, at least in `classicLengthLivesAndTimedAreTheWebConstants` and `reduceTraces` (a one-second tick now counts 999 ms), each reported with `FAILED`, and ends with `BUILD FAILED`. After the checkout, `git status --short android/Truthy/engine` lists only the two new test files of steps 9 and 10, as `??` lines for `RoundVectors.kt` and `RoundGoldenTest.kt`.

- [ ] **Step 13: Run the whole engine and the web tests.**

```bash
android/Truthy/gradlew -p android/Truthy :engine:test
pnpm test
```

Expected: `BUILD SUCCESSFUL` (the test results now hold 11 more tests than in step 7, all passing); then every Vitest file passes (the web code is untouched; `pnpm test` is the README's gate that the web stays green).

- [ ] **Step 14: Commit the golden tests.**

```bash
git add android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/RoundVectors.kt android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/RoundGoldenTest.kt
pnpm vitest run tests/repo-hygiene.test.ts
git commit -m "test: check the Kotlin round against the round golden vectors: every trace state by state, the readers, startRound, scoreOf, chunkSeed and the constants"
```

Expected: the hygiene test passes and the commit is created. `git status --short` shows nothing left from this task.
