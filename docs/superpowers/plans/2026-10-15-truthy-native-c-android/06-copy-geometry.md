### Task 6: Play copy, leaving, result copy, missed cards, recording once, ticket words, ticket scroll, flight path, headers, barcode and contrast in the Android engine

The web app says things and places things with small pure functions that live in its component files: the words of the play screen, what leaving a round saves, what the result screen says in each class, the list of missed cards, the arithmetic that scrolls a ticket, the flight path's curve and labels, the three headers of Streak, Three lives and Timed, the barcode of the pass, the ticket's route words, and the contrast pairs of the design system. The two native apps share no code with the web, so task 6 ports all of them into `:engine` and checks every one against the golden vectors plan A computed from the TypeScript functions themselves (plan A task 8, 34 files). It also finishes the engine: from this task on the coverage test requires that every file in `native-data/golden` is read by some test.

The task is test first and goes part by part: each part writes a test class that pins the cases of the web tests by value and replays every case of the golden file against the Kotlin function, watches it fail to compile, writes the Kotlin, and commits. All code lives in `:engine` (package `com.eienmosu.truthy.engine`); nothing here touches Android.

**This task was not compiled during drafting.** Nothing in this file was compiled or run while the plan was written. After the review, tasks 1 to 6 were assembled from these files and run with the Android Studio JBR against plan A's real `native-data`: this task's tests compiled and passed at its own end and in the final state, 373 run, 373 passed, 0 skipped with the coverage flag on, and a mutation of each of the 130 golden files was caught by its own suite (README, Drafting record). The numbers pinned in the tests are the web tests' own values (read from `tests/components/**` and `tests/tokens/contrast.test.ts` and from plan A task 8), plus a few values recomputed with the web code while drafting. API signatures were written against the kotlinx.serialization JSON reference (`JsonPrimitive.isString`, `content`, and the `int`, `double`, `boolean` extensions) and `kotlin.test` (the review moved every test of this task from JUnit Jupiter to `kotlin.test` on JUnit 4, because the `:engine` test task runs `useJUnit()` and would never find a Jupiter test); if a step fails to compile for a reason other than the "Unresolved reference" the step announces, read the compiler message, fix the line, and keep the behaviour the test states.

Builds on: tasks 1 to 5. It uses the golden loader and the coverage test of task 1, the round of task 3 (`startRound`, `reduce`, `isDecided`, `scoreOf`, `summarise` and the state readers), the progress rules of task 4 (`applyResult`, `readProgress`, `emptyProgress`), and the content helpers, text parts and class table of task 5 (`findRoute`, `deckPassName`, `plainText`, `modeInfo`). The step "Check the starting point" lists the exact names and how to find them.

**Files:**
- Create (main, in `android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/`): `WebMath.kt`, `PlayCopy.kt`, `Leave.kt`, `ResultCopy.kt`, `MissedCards.kt`, `RoundRecorder.kt`, `Ticket.kt`, `TicketScroll.kt`, `FlightPath.kt`, `StreakPath.kt`, `LivesPath.kt`, `TimedPath.kt`, `Barcode.kt`, `Contrast.kt`
- Create (test support, in `android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/`): `CopyGoldenBase.kt`
- Create (tests, same folder): `WebMathTest.kt`, `CopyGoldenBaseTest.kt`, `PlayCopyGoldenTest.kt`, `LeaveGoldenTest.kt`, `ResultCopyGoldenTest.kt`, `MissedCardsGoldenTest.kt`, `RoundRecorderGoldenTest.kt`, `TicketForGoldenTest.kt`, `TicketScrollGoldenTest.kt`, `FlightPathGoldenTest.kt`, `StreakPathGoldenTest.kt`, `LivesPathGoldenTest.kt`, `TimedPathGoldenTest.kt`, `BarcodeGoldenTest.kt`, `ContrastGoldenTest.kt`
- Modify: the task 1 coverage test, `GoldenCoverageTest.kt` (one flag, step 32)

**Interfaces:**

Consumes (names from the README or mirrored from the TypeScript; the ones the README does not fix are marked "assumed" and the starting-point step looks for them):

```kotlin
// README: Card, DeckIndex, DeckFile, Route, WHOLE_DECK, Mode (with wire), CardHistory, History, Answered, RoundResult,
// Phase, Clock, RoundState, RoundEvent (Answer, Next, Tick, Visibility, Abandon), Progress, readProgress -> ReadResult(progress, whole)
// Mirrors of the TypeScript exports (assumed spelling, task 3 to 5):
fun startRound(args: StartArgs): RoundState        // data class StartArgs(mode: Mode, route: Route, pool: List<Card>, history: History, seed: Double)
fun reduce(state: RoundState, event: RoundEvent): RoundState
fun currentCard(state: RoundState): Card?
fun lastAnswer(state: RoundState): Answered?
fun livesLeft(state: RoundState): Int
fun isDecided(state: RoundState): Boolean
fun scoreOf(mode: Mode, answers: List<Answered>): Int
fun summarise(state: RoundState): RoundResult
const val LIVES: Int                               // 3
val TIMED                                          // roundMs, holdMs, maxStepMs; numeric, any of Int or Double
fun emptyProgress(): Progress
data class ApplyOutcome(val progress: Progress, val previousBest: Int?, val isNewBest: Boolean)
fun applyResult(progress: Progress, result: RoundResult): ApplyOutcome
fun pad2(n: Int): String                           // task 1
fun plainText(text: String): String                // task 5
fun modeInfo(mode: Mode): ModeInfo                 // task 5, ModeInfo.name
fun deckPassName(platform: IndexPlatform, deck: IndexDeck): String                  // task 5
data class RouteInIndex(val area: IndexArea, val platform: IndexPlatform, val deck: IndexDeck, val section: IndexSection?)   // task 5
// Card fields as the README gives them; card.text.en.statement and .explanation, card.source.title and .url (assumed)
// Index types: IndexArea, IndexPlatform, IndexDeck (id, code, title, passName), IndexSection (id, title), all @Serializable
// Progress fields cards, records, last; last has route, mode, score, total (assumed); CardHistory(seen, lastCorrect, lastSeenAt)
```

Consumes, test support from task 1 (assumed spelling, mirrors plan B's loader; all of it in package `com.eienmosu.truthy.engine` of the `:engine` test source set; only `CopyGoldenBase` touches these names except the `Golden.load` calls and the `cases`, `name`, `input`, `output` members, so a different spelling is a one-line fix in a handful of places):

```kotlin
object Golden { fun load(module: String, function: String): GoldenFile }
class GoldenFile { val cases: List<GoldenCase>; fun resolved(value: JsonElement): JsonElement }   // resolved: every {"$card": id} replaced by the card object of the file's table
class GoldenCase { val name: String; val input: JsonElement; val output: JsonElement }
// the coverage test of task 1 scans test sources for  Golden.load("<module>", "<function>")  with two string literals,
// and has one flag, off until task 6: private const val EVERY_FILE_REQUIRED = false
// kotlin.test (Test, assertEquals, assertTrue, assertFalse, assertNull, assertNotEquals, assertSame, assertFailsWith) on JUnit 4,
// task 1's libs.kotlin.test.junit; kotlinx.serialization.json is on the test class path
internal fun jsRound(x: Double): Double   // task 1, main source set: JavaScript's Math.round, exactly
```

Produces (all `public` in package `com.eienmosu.truthy.engine`, the TypeScript names kept):

```kotlin
// PlayCopy.kt
const val NEXT_ARRIVES_MS: Double = 420.0
const val SPOKEN_RELEASE_MS: Double = 150.0
fun verdictText(correct: Boolean, answer: Boolean, newBest: Boolean = false): String
fun roundStatus(round: RoundState): String
fun timedStatus(round: RoundState): String
fun timedCardText(round: RoundState): String
// Leave.kt
fun leavesSomething(round: RoundState): Boolean
fun saveLeftRound(round: RoundState, stored: Progress): Progress      // the web's saveLeftRound without the store: the store is the app's (task 9)
// ResultCopy.kt
data class LabelledValue(val label: String, val value: String)
class ResultCopy(val fields: List<LabelledValue>, val scoreLabel: String, val unit: String?, val best: (Int) -> String,
                 val ended: String, val endedDetail: String, val label: String, val marks: Int, val ring: Int?)
fun resultCopy(result: RoundResult, modeName: String, dealt: Int, previousBest: Int?): ResultCopy
// MissedCards.kt
data class MissedCard(val number: Int, val given: Boolean, val answer: Boolean, val appliesTo: String?, val statement: String, val explanation: String, val source: CardSource)
fun missedCards(answers: List<Answered>): List<MissedCard>
// RoundRecorder.kt
const val RESULT_ARRIVES_MS: Double = 1000.0
fun recordRound(round: RoundState, stored: Progress): ApplyOutcome   // applyResult(stored, summarise(round)): no store, no memory
data class Recording(val outcome: ApplyOutcome, val write: Boolean)
class RoundRecorder { fun preview(round: RoundState, stored: Progress): ApplyOutcome; fun record(round: RoundState, stored: Progress): Recording }
// Ticket.kt
data class TicketInfo(val deckCode: String, val deckName: String, val sectionCode: String, val sectionName: String, val modeLabel: String, val best: Int?)
fun ticketFor(found: RouteInIndex, mode: Mode, best: Int?): TicketInfo
// TicketScroll.kt
data class Span(val top: Double, val bottom: Double)
data class SlipAt(val top: Double, val visible: Double, val gap: Double, val max: Double)
data class KeyAt(val top: Double, val visible: Double, val max: Double)
const val ARROW_STEP: Double = 40.0
fun statementScroll(text: Span, visible: Double): Double
fun slipScroll(slip: Span, at: SlipAt): Double?
fun keyScroll(key: String, shift: Boolean, at: KeyAt): Double?
// FlightPath.kt
data class Point(val x: Double, val y: Double)
enum class WaypointState(val wire: String) { CORRECT("correct"), WRONG("wrong"), CURRENT("current"), FUTURE("future") }
fun pointAt(t: Double): Point;  fun waypointT(i: Int, n: Int): Double;  fun flownPath(t: Double): String;  fun headingAt(t: Double): Double
fun waypointStates(total: Int, results: List<Boolean>, current: Int, answered: Boolean): List<WaypointState>
fun cardList(numbers: List<Int>): String;  fun flightPathLabel(total: Int, results: List<Boolean>, current: Int): String
fun completedLabel(total: Int, results: List<Boolean>): String;  fun completedScale(cards: Int): Double
// StreakPath.kt, LivesPath.kt, TimedPath.kt
class StreakLayout(val t: (Int) -> Double, val dot: Double, val ticks: Boolean, val ring: Int?, val target: Boolean, val future: List<Int>)
fun streakLayout(done: Int, best: Int?): StreakLayout;  fun streakLabel(streak: Int, best: Int?, ended: Boolean): String
class TrailLayout(val x: (Int) -> Double, val r: Double, val side: Double, val cross: Boolean)
fun trailLayout(marks: Int): TrailLayout;  fun livesLabel(results: List<Boolean>): String
fun clockText(remainingMs: Double): String;  fun timedLabel(remainingMs: Double, correct: Int, wrong: Int): String
// Barcode.kt
data class BarcodeBar(val x: Int, val width: Int);  data class Barcode(val bars: List<BarcodeBar>, val width: Int)
fun barcodeBars(data: String): Barcode
// Contrast.kt
fun luminance(hex: String): Double;  fun contrastRatio(foreground: String, background: String): Double
// WebMath.kt (internal), every rounding through task 1's jsRound
internal fun roundToHundredth(value: Double): Double; internal fun roundToTenth(value: Double): Double; internal fun hundredthsText(value: Double): String
```

**Rules:**

1. **`Math.round` is task 1's `jsRound`**, the module's one port of it (task 1 rule 8: half toward +infinity, `-0` kept, exact where `floor(x + 0.5)` is not). Every rounding in these functions (`round1`, `round2` of the flight path, `Math.round(ratio * 100) / 100` of the contrast) goes through it, by way of `roundToHundredth` and `roundToTenth` where they apply. `kotlin.math.round` rounds half to even and `roundToInt` rounds half away from zero for negatives; neither is used, and no second `floor(x + 0.5)` helper is written.
2. **Numbers in strings.** The flight path prints coordinates into an SVG path string (`flownPath`), and JavaScript prints `6` for 6.0 and `-6` for -6.0. Every number printed there was rounded to hundredths first, so `hundredthsText` prints from the scaled integer and does not use `Double.toString`.
3. **Trigonometry and powers use `StrictMath`** (`atan2` in `headingAt`, `pow` in `luminance`): `StrictMath` is the fdlibm algorithm V8 uses, so the last bit agrees with the vectors. The vectors' rounding margins were measured while drafting: the nearest value of any contrast ratio times 100 to a half is 0.0029 away and the nearest heading times 100 is 0.0048 away, many orders of magnitude above double noise.
4. **The engine has no store.** The web's `saveLeftRound(round, store)` and `recordRound(round, store)` read and write a `ProgressStore`; the store is the app's (task 9, asynchronous). The engine ports the part between load and save: `saveLeftRound(round, stored): Progress` and `recordRound(round, stored): ApplyOutcome`, and the "once per round" memory (a `WeakMap` on the web) as `RoundRecorder`, which answers "is this round already recorded, and should the caller write" and leaves the load and the write to the caller. The golden vectors for these two files model the store with the engine's `readProgress` and a variable (`storage: "full"` means every write was swallowed, as `createLocalStore` swallows a throwing `setItem`).
5. **Leaving** (Review Focus 2 reads the leave rules from here): `leavesSomething` is true with answers or a decided round; `saveLeftRound` sends `next` to a decided round (it is recorded as its result would be, record and score) and `abandon` to any other (answers into the history, `last` with a null score and total, no record). The caller (task 9's journal apply, task 11's coordinator) calls `saveLeftRound` only when `leavesSomething` is true; the vectors show that `saveLeftRound` itself saves even a round with nothing in it.
6. **Comparisons with the vectors** use `assertSameJson` from `CopyGoldenBase`: numbers compare by value (`6` equals `6.0`, `0` equals `-0`), objects by key set, strings exactly. A Kotlin value is turned into JSON by `json(...)` (null, String, Boolean, Number, List, Map). An optional field that is `undefined` in TypeScript is left out of the map, not written as null (`ring` and `unit` of the result copy, `appliesTo` of a missed card).
7. **The vectors are read through the cases' names.** A pin finds its case by name and fails loudly when plan A renames it. Every case of every file is replayed too.

**Steps:**

- [ ] **Step 1: Check the starting point.**

```bash
git branch --show-current
git status --short
for name in components.play.PlayScreen.verdictText components.play.PlayScreen.roundStatus components.play.PlayScreen.timedStatus components.play.PlayScreen.timedCardText components.play.PlayScreen.NEXT_ARRIVES_MS components.play.PlayScreen.SPOKEN_RELEASE_MS components.play.leave.leavesSomething components.play.leave.saveLeftRound components.play.resultCopy.resultCopy components.play.ResultView.recordRound components.play.ResultView.RESULT_ARRIVES_MS components.MissedCards.missedCards components.play.useRound.ticketFor components.play.ticketScroll.statementScroll components.play.ticketScroll.slipScroll components.play.ticketScroll.keyScroll components.play.ticketScroll.ARROW_STEP components.FlightPath.pointAt components.FlightPath.waypointT components.FlightPath.flownPath components.FlightPath.headingAt components.FlightPath.waypointStates components.FlightPath.cardList components.FlightPath.flightPathLabel components.FlightPath.completedLabel components.FlightPath.completedScale components.StreakPath.streakLayout components.StreakPath.streakLabel components.LivesPath.trailLayout components.LivesPath.livesLabel components.TimedPath.clockText components.TimedPath.timedLabel components.BoardingPass.barcodeBars design.system.tokens.contrastPairs; do test -f native-data/golden/$name.json || echo "MISSING $name"; done
test -f native-data/tokens/resolved.json && echo "resolved tokens present"
grep -rn "fun load\|fun resolved\|EVERY_FILE_REQUIRED" android/Truthy/engine/src/test/kotlin | head
grep -rln "fun startRound\|fun applyResult\|fun readProgress\|fun findRoute\|fun deckPassName\|fun plainText\|fun modeInfo\|fun pad2" android/Truthy/engine/src/main/kotlin
(cd android/Truthy && ./gradlew :engine:test)
```

Expected: `native`; no output from `git status`; no line starting with `MISSING` and the line `resolved tokens present`; the `grep` for the loader prints the lines declaring `fun load`, `fun resolved` and the flag `EVERY_FILE_REQUIRED` (set to `false`); the second `grep` lists the engine files that hold those eight functions; the build ends with `BUILD SUCCESSFUL`. If a name differs from the Interfaces above (the loader, the flag, a function, a field), do not guess: fix the one place the name is used (the loader names only in `CopyGoldenBase.kt` of step 2, the others where the code below uses them) and keep going. If a golden file is missing, plan A task 8 is not done: stop.

- [ ] **Step 2: Write the web rounding test, the comparison support and the support's own test, then run them.** The support is a base class for this task's tests; its own test proves the comparison is not vacuous (a difference is reported) and that a recorded round trace replays.

`android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/WebMathTest.kt`:

```kotlin
package com.eienmosu.truthy.engine

import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.test.Test

class WebMathTest {
    @Test
    fun `the hundredths and tenths round as Math round does, a half going up for negative numbers too`() {
        assertTrue(roundToHundredth(0.025) == 0.03)
        assertTrue(roundToHundredth(-0.025) == -0.02)
        assertTrue(roundToHundredth(1.005) == 1.0)
        assertTrue(roundToTenth(2.25) == 2.3)
        assertTrue(roundToTenth(-2.25) == -2.2)
    }

    @Test
    fun `hundredthsText prints a rounded number the way JavaScript prints it`() {
        assertEquals("24", hundredthsText(24.0))
        assertEquals("-6", hundredthsText(-6.0))
        assertEquals("9.5", hundredthsText(9.5))
        assertEquals("106.3", hundredthsText(106.3))
        assertEquals("-12.8", hundredthsText(-12.8))
        assertEquals("0.07", hundredthsText(0.07))
        assertEquals("5.43", hundredthsText(5.43))
        assertEquals("72.51", hundredthsText(72.51))
        assertEquals("0", hundredthsText(0.0))
        assertEquals("0", hundredthsText(-0.001))
        assertEquals("100", hundredthsText(100.0))
    }
}
```

`android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/CopyGoldenBase.kt`:

```kotlin
package com.eienmosu.truthy.engine

import kotlinx.serialization.builtins.MapSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.double
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * What the tests of task 6 share: reading a golden value, decoding the round and the result a case describes,
 * and comparing an engine result with a recorded output as JSON (numbers by value, objects by key set).
 * The names of the golden loader (`resolved`, `cases`, `name`, `input`, `output`) appear in this file and in
 * the `Golden.load` calls of the tests, nowhere else.
 */
abstract class CopyGoldenBase {
    protected val wire = Json { ignoreUnknownKeys = true }

    protected fun GoldenFile.resolve(value: JsonElement): JsonElement = resolved(value)

    protected fun GoldenFile.inputOf(name: String): JsonElement =
        (cases.firstOrNull { it.name == name } ?: throw AssertionError("no case named \"$name\"")).input

    protected fun GoldenFile.outputOf(name: String): JsonElement =
        (cases.firstOrNull { it.name == name } ?: throw AssertionError("no case named \"$name\"")).output

    protected fun JsonElement.field(name: String): JsonElement =
        (this as? JsonObject)?.get(name) ?: throw AssertionError("no field \"$name\" in $this")

    protected fun JsonElement.optional(name: String): JsonElement? = (this as? JsonObject)?.get(name)

    protected fun JsonElement.text(): String = jsonPrimitive.content
    protected fun JsonElement.number(): Double = jsonPrimitive.double
    protected fun JsonElement.count(): Int = jsonPrimitive.int
    protected fun JsonElement.flag(): Boolean = jsonPrimitive.boolean
    protected fun JsonElement.countOrNull(): Int? = if (this is JsonNull) null else jsonPrimitive.int
    protected fun JsonElement.list(): List<JsonElement> = jsonArray

    /** This object without the named fields. */
    protected fun JsonElement.without(vararg names: String): JsonElement =
        JsonObject((this as JsonObject).filterKeys { it !in names })

    protected fun cardOf(element: JsonElement): Card = wire.decodeFromJsonElement(Card.serializer(), element)

    protected fun routeOf(element: JsonElement): Route = Route(element.field("deckId").text(), element.field("sectionId").text())

    protected fun modeOf(name: String): Mode = Mode.entries.first { it.wire == name }

    protected fun historyOf(element: JsonElement): History =
        wire.decodeFromJsonElement(MapSerializer(String.serializer(), CardHistory.serializer()), element)

    protected fun startArgsOf(element: JsonElement): StartArgs = StartArgs(
        mode = modeOf(element.field("mode").text()),
        route = routeOf(element.field("route")),
        pool = element.field("pool").list().map { cardOf(it) },
        history = historyOf(element.field("history")),
        seed = element.field("seed").number(),
    )

    protected fun eventOf(element: JsonElement): RoundEvent = when (val type = element.field("type").text()) {
        "answer" -> RoundEvent.Answer(element.field("value").flag(), element.field("at").number())
        "next" -> RoundEvent.Next
        "tick" -> RoundEvent.Tick(element.field("now").number())
        "visibility" -> RoundEvent.Visibility(element.field("hidden").flag(), element.field("at").number())
        "abandon" -> RoundEvent.Abandon
        else -> throw AssertionError("unknown event type $type")
    }

    protected fun answeredOf(element: JsonElement): Answered = Answered(
        card = cardOf(element.field("card")),
        given = element.field("given").flag(),
        correct = element.field("correct").flag(),
        at = element.field("at").number(),
    )

    protected fun resultOf(element: JsonElement): RoundResult = RoundResult(
        mode = modeOf(element.field("mode").text()),
        route = routeOf(element.field("route")),
        score = element.field("score").count(),
        total = element.field("total").count(),
        answers = element.field("answers").list().map { answeredOf(it) },
        missed = element.field("missed").list().map { answeredOf(it) },
        abandoned = element.field("abandoned").flag(),
    )

    /** The round a case input of the form {start, events} builds: startRound, then every event in order. */
    protected fun replay(file: GoldenFile, input: JsonElement): RoundState {
        val trace = file.resolve(input)
        var state = startRound(startArgsOf(trace.field("start")))
        for (item in trace.field("events").list()) state = reduce(state, eventOf(item))
        return state
    }

    /** Stored progress as the vectors write it: the JSON the progress key holds; null means nothing stored. */
    protected fun progressOf(element: JsonElement): Progress =
        if (element is JsonNull) emptyProgress() else readProgress(element.toString()).progress

    /** A Kotlin value as JSON: null, String, Boolean, Number, List, Map with String keys, or a JsonElement. */
    protected fun json(value: Any?): JsonElement = when (value) {
        null -> JsonNull
        is JsonElement -> value
        is String -> JsonPrimitive(value)
        is Boolean -> JsonPrimitive(value)
        is Number -> JsonPrimitive(value)
        is List<*> -> JsonArray(value.map { json(it) })
        is Map<*, *> -> JsonObject(value.entries.associate { (key, item) -> (key as String) to json(item) })
        else -> throw IllegalArgumentException("cannot write ${value::class} as JSON")
    }

    protected fun assertSameJson(expected: JsonElement, actual: JsonElement, where: String) {
        when {
            expected is JsonNull || actual is JsonNull ->
                assertTrue(expected is JsonNull && actual is JsonNull, "$where: expected $expected but was $actual")
            expected is JsonObject && actual is JsonObject -> {
                assertEquals(expected.keys, actual.keys, "$where: keys")
                for ((key, item) in expected) assertSameJson(item, actual.getValue(key), "$where.$key")
            }
            expected is JsonArray && actual is JsonArray -> {
                assertEquals(expected.size, actual.size, "$where: length")
                for (i in expected.indices) assertSameJson(expected[i], actual[i], "$where[$i]")
            }
            expected is JsonPrimitive && actual is JsonPrimitive -> samePrimitive(expected, actual, where)
            else -> throw AssertionError("$where: expected $expected but was $actual")
        }
    }

    private fun samePrimitive(expected: JsonPrimitive, actual: JsonPrimitive, where: String) {
        assertEquals(expected.isString, actual.isString, "$where: a string against a non-string ($expected and $actual)")
        if (expected.isString) {
            assertEquals(expected.content, actual.content, where)
            return
        }
        val e = expected.content
        val a = actual.content
        if (e == "true" || e == "false" || a == "true" || a == "false") {
            assertEquals(e, a, where)
            return
        }
        val x = e.toDouble()
        val y = a.toDouble()
        assertTrue(x == y, "$where: expected $e but was $a")
    }
}
```

`android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/CopyGoldenBaseTest.kt`:

```kotlin
package com.eienmosu.truthy.engine

import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.Test

class CopyGoldenBaseTest : CopyGoldenBase() {
    private val status = Golden.load("components/play/PlayScreen", "roundStatus")

    @Test
    fun `numbers compare by value and not by how they are written`() {
        assertSameJson(json(6), json(6.0), "an int against a double")
        assertSameJson(
            json(mapOf("a" to listOf(1, 2.5, null, "x", true))),
            json(mapOf("a" to listOf(1.0, 2.5, null, "x", true))),
            "nested",
        )
    }

    @Test
    fun `a difference is reported`() {
        val differing = listOf(
            json(1) to json(2),
            json("1") to json(1),
            json(null) to json(0),
            json(listOf(1)) to json(listOf(1, 2)),
            json(mapOf("a" to 1)) to json(mapOf("b" to 1)),
            json(true) to json(false),
        )
        for ((expected, actual) in differing) {
            assertFailsWith<AssertionError> { assertSameJson(expected, actual, "x") }
        }
    }

    @Test
    fun `replay builds the round a trace describes`() {
        val round = replay(status, status.inputOf("lives: the first wrong answer loses a life"))
        assertEquals(Mode.LIVES, round.mode)
        assertEquals(1, round.answers.size)
        assertEquals(false, round.answers[0].correct)
        assertEquals(Phase.ANSWERED, round.phase)
    }
}
```

Run:

```bash
(cd android/Truthy && ./gradlew :engine:test --tests 'com.eienmosu.truthy.engine.WebMathTest' --tests 'com.eienmosu.truthy.engine.CopyGoldenBaseTest')
```

Expected: FAIL. `e: ... WebMathTest.kt ... Unresolved reference 'roundToHundredth'` (also `roundToTenth`, `hundredthsText`) and `Execution failed for task ':engine:compileTestKotlin'`. Nothing else is unresolved; if `Golden`, `GoldenFile`, `Mode.entries`, `StartArgs` or `emptyProgress` are reported, the starting-point step found a name that differs: settle it now.

- [ ] **Step 3: Write `WebMath.kt`, then run the tests of step 2.** It rounds through task 1's `jsRound`; it does not port `Math.round` again.

`android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/WebMath.kt`:

```kotlin
package com.eienmosu.truthy.engine

import kotlin.math.abs

// Every rounding goes through task 1's jsRound, the module's one port of JavaScript's Math.round.

/** Math.round(value * 100) / 100, the rounding of the flight path's coordinates and angles. */
internal fun roundToHundredth(value: Double): Double = jsRound(value * 100) / 100

/** Math.round(value * 10) / 10. */
internal fun roundToTenth(value: Double): Double = jsRound(value * 10) / 10

/**
 * A number already rounded to hundredths, printed as JavaScript's String(n) prints it: "24" and not "24.0",
 * "9.5", "-6", and never "-0". It prints from the scaled integer, so it does not depend on Double.toString.
 */
internal fun hundredthsText(value: Double): String {
    val scaled = jsRound(value * 100).toLong()
    val magnitude = abs(scaled)
    val whole = magnitude / 100
    val fraction = (magnitude % 100).toInt()
    val sign = if (scaled < 0) "-" else ""
    return when {
        fraction == 0 -> "$sign$whole"
        fraction % 10 == 0 -> "$sign$whole.${fraction / 10}"
        else -> "$sign$whole.${fraction.toString().padStart(2, '0')}"
    }
}
```

Run the command of step 2. Expected: `BUILD SUCCESSFUL`. Then:

```bash
grep -o 'tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*" errors="[0-9]*"' android/Truthy/engine/build/test-results/test/TEST-com.eienmosu.truthy.engine.WebMathTest.xml android/Truthy/engine/build/test-results/test/TEST-com.eienmosu.truthy.engine.CopyGoldenBaseTest.xml
```

Expected: `...WebMathTest.xml:tests="2" skipped="0" failures="0" errors="0"` and `...CopyGoldenBaseTest.xml:tests="3" skipped="0" failures="0" errors="0"`.

- [ ] **Step 4: Commit.**

```bash
git add android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/WebMath.kt android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/WebMathTest.kt android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/CopyGoldenBase.kt android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/CopyGoldenBaseTest.kt
git commit -m "feat: add the web rounding and the golden comparison support to the Android engine"
```

- [ ] **Step 5: Write the play copy test and run it.** It pins the cases of `round-status-voice.test.tsx`, `PlayScreenTimed.test.tsx` and `timed-applies-to-polish.test.ts` by value, and replays every case of the six files.

`android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/PlayCopyGoldenTest.kt`:

```kotlin
package com.eienmosu.truthy.engine

import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.test.Test

class PlayCopyGoldenTest : CopyGoldenBase() {
    private val verdict = Golden.load("components/play/PlayScreen", "verdictText")
    private val status = Golden.load("components/play/PlayScreen", "roundStatus")
    private val timedStatusFile = Golden.load("components/play/PlayScreen", "timedStatus")
    private val timedCard = Golden.load("components/play/PlayScreen", "timedCardText")
    private val nextArrives = Golden.load("components/play/PlayScreen", "NEXT_ARRIVES_MS")
    private val spokenRelease = Golden.load("components/play/PlayScreen", "SPOKEN_RELEASE_MS")

    @Test
    fun `verdictText says the verdict, the answer and New best for every combination`() {
        for (correct in listOf(true, false)) {
            for (answer in listOf(true, false)) {
                val text = "${if (correct) "Correct" else "Not quite"}. The answer is ${if (answer) "True" else "False"}."
                assertEquals(text, verdictText(correct, answer))
                assertEquals("$text New best.", verdictText(correct, answer, true))
            }
        }
    }

    @Test
    fun `verdictText matches every golden case`() {
        assertEquals(8, verdict.cases.size)
        for (case in verdict.cases) {
            val input = verdict.resolve(case.input)
            val newBest = input.optional("newBest")?.flag() ?: false
            assertEquals(case.output.text(), verdictText(input.field("correct").flag(), input.field("answer").flag(), newBest), case.name)
        }
    }

    @Test
    fun `roundStatus pins the Three lives and Streak words and the silence of the other classes`() {
        fun said(name: String) = status.outputOf(name).text()
        assertEquals("Life lost, 2 left.", said("lives: the first wrong answer loses a life"))
        assertEquals("", said("lives: a right answer after a lost life says nothing"))
        assertEquals("Last life.", said("lives: the second wrong answer is the last life"))
        assertEquals("Out of lives.", said("lives: the third wrong answer is out of lives"))
        assertEquals("Streak ended at 2.", said("streak: wrong after two right answers"))
        assertEquals("Streak ended at 0.", said("streak: wrong on the first card ends at 0"))
        assertEquals("Streak ended at 13.", said("streak: 13 right answers then a wrong one, across a chunk"))
        assertEquals("", said("classic: a wrong answer adds nothing"))
        assertEquals("", said("timed: a wrong answer adds nothing"))
    }

    @Test
    fun `roundStatus matches every golden case`() {
        assertEquals(12, status.cases.size)
        for (case in status.cases) assertEquals(case.output.text(), roundStatus(replay(status, case.input)), case.name)
    }

    @Test
    fun `timedStatus pins nothing on a question, the verdict during the stamp and the end of the card`() {
        fun said(name: String) = timedStatusFile.outputOf(name).text()
        assertEquals("", said("a question says nothing"))
        assertEquals("Correct.", said("the stamp of a right answer says Correct."))
        assertEquals("Not quite.", said("the stamp of a wrong answer says Not quite."))
        assertEquals("Time is up. This card doesn't count.", said("time is up on a question"))
        assertEquals("Time is up. This card doesn't count.", said("time is up after an answer"))
    }

    @Test
    fun `timedStatus matches every golden case`() {
        assertEquals(6, timedStatusFile.cases.size)
        for (case in timedStatusFile.cases) assertEquals(case.output.text(), timedStatus(replay(timedStatusFile, case.input)), case.name)
    }

    @Test
    fun `timedCardText pins the number, the Applies to line and the code fragment without backticks`() {
        fun statement(name: String) = replay(timedCard, timedCard.inputOf(name)).cards[1].text.en.statement
        fun said(name: String) = timedCard.outputOf(name).text()
        assertEquals("", said("the first card is read through focus: nothing"))
        assertEquals("", said("the stamp on the first card: nothing"))
        assertEquals("", said("time is up: nothing"))
        val second = "the second card: its number and statement"
        assertEquals("Card 2. ${statement(second)}", said(second))
        val kept = "the second card keeps the text through its stamp"
        assertEquals("Card 2. ${statement(kept)}", said(kept))
        val scoped = "the second card with an appliesTo says the Applies to line first"
        assertEquals("Card 2. Applies to Next.js 16 with cacheComponents: true. ${statement(scoped)}", said(scoped))
        val code = "the second card opening with a code fragment is read without its backticks"
        assertTrue(statement(code).startsWith("`docker run` "))
        assertEquals("Card 2. docker run ${statement(code).removePrefix("`docker run` ")}", said(code))
    }

    @Test
    fun `timedCardText matches every golden case`() {
        assertEquals(8, timedCard.cases.size)
        for (case in timedCard.cases) assertEquals(case.output.text(), timedCardText(replay(timedCard, case.input)), case.name)
    }

    @Test
    fun `the two timings are 420 and 150 milliseconds`() {
        assertEquals(420.0, NEXT_ARRIVES_MS)
        assertEquals(150.0, SPOKEN_RELEASE_MS)
        assertEquals(1, nextArrives.cases.size)
        assertEquals(1, spokenRelease.cases.size)
        assertTrue(nextArrives.cases[0].output.number() == NEXT_ARRIVES_MS)
        assertTrue(spokenRelease.cases[0].output.number() == SPOKEN_RELEASE_MS)
    }
}
```

```bash
(cd android/Truthy && ./gradlew :engine:test --tests 'com.eienmosu.truthy.engine.PlayCopyGoldenTest')
```

Expected: FAIL, `Unresolved reference 'verdictText'` (and `roundStatus`, `timedStatus`, `timedCardText`, `NEXT_ARRIVES_MS`, `SPOKEN_RELEASE_MS`), `Execution failed for task ':engine:compileTestKotlin'`.

- [ ] **Step 6: Write `PlayCopy.kt`, then run the test of step 5.** Each function is its TypeScript twin in `components/play/PlayScreen.tsx`.

`android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/PlayCopy.kt`:

```kotlin
package com.eienmosu.truthy.engine

/**
 * How long after an answer the action ("Next card", or "See results" after a deciding answer) takes presses
 * (monotonic clock, the same with reduced motion).
 */
const val NEXT_ARRIVES_MS: Double = 420.0

/** How long after the leave sheet has closed the live regions keep what they said when it opened. */
const val SPOKEN_RELEASE_MS: Double = 150.0

/** What the live region says after an answer: "Correct. The answer is False." and, past the record, " New best." */
fun verdictText(correct: Boolean, answer: Boolean, newBest: Boolean = false): String =
    "${if (correct) "Correct" else "Not quite"}. The answer is ${if (answer) "True" else "False"}.${if (newBest) " New best." else ""}"

/**
 * What the live region says after the verdict when a wrong answer changes the round: in Three lives "Life lost,
 * 2 left.", "Last life." or "Out of lives.", in Streak "Streak ended at 3.". Empty after a right answer, in
 * Classic and in Timed.
 */
fun roundStatus(round: RoundState): String {
    if (lastAnswer(round)?.correct != false) return ""
    if (round.mode == Mode.STREAK) return "Streak ended at ${scoreOf(Mode.STREAK, round.answers)}."
    if (round.mode != Mode.LIVES) return ""
    val left = livesLeft(round)
    if (left == 0) return "Out of lives."
    return if (left == 1) "Last life." else "Life lost, $left left."
}

/**
 * What the live region says in Timed: "Correct." or "Not quite." during the stamp, "Time is up. This card
 * doesn't count." at time up, nothing on a question.
 */
fun timedStatus(round: RoundState): String {
    if (isDecided(round)) return "Time is up. This card doesn't count."
    if (round.phase != Phase.STAMPED) return ""
    return if (lastAnswer(round)?.correct == true) "Correct." else "Not quite."
}

/**
 * What the Timed card announcer says: "Card 2. <statement>" from the second card on, until time is up, with
 * "Applies to <appliesTo>." before the statement when the card has one. The statement is plain text (code
 * without its backticks). The first card is read through focus.
 */
fun timedCardText(round: RoundState): String {
    val card = currentCard(round)
    if (round.index == 0 || isDecided(round) || card == null) return ""
    val appliesTo = if (card.appliesTo.isNotEmpty()) "Applies to ${card.appliesTo}. " else ""
    return "Card ${round.index + 1}. $appliesTo${plainText(card.text.en.statement)}"
}
```

Run the command of step 5. Expected: `BUILD SUCCESSFUL`, then

```bash
grep -o 'tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*" errors="[0-9]*"' android/Truthy/engine/build/test-results/test/TEST-com.eienmosu.truthy.engine.PlayCopyGoldenTest.xml
```

prints `tests="9" skipped="0" failures="0" errors="0"`.

- [ ] **Step 7: Commit.**

```bash
git add android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/PlayCopy.kt android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/PlayCopyGoldenTest.kt
git commit -m "feat: port the play screen's words to the Android engine"
```

- [ ] **Step 8: Write the leave test and run it.** `leavesSomething` is pinned for all ten of its cases; `saveLeftRound` is pinned by the engine's own result on the recorded rounds (the leave rules of Review Focus 2) and every case is replayed against the store model of rule 4.

`android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/LeaveGoldenTest.kt`:

```kotlin
package com.eienmosu.truthy.engine

import kotlinx.serialization.json.JsonNull
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.Test

class LeaveGoldenTest : CopyGoldenBase() {
    private val leaves = Golden.load("components/play/leave", "leavesSomething")
    private val save = Golden.load("components/play/leave", "saveLeftRound")

    private fun saved(name: String): Progress {
        val input = save.resolve(save.inputOf(name))
        return saveLeftRound(replay(save, save.inputOf(name)), progressOf(input.field("progress")))
    }

    @Test
    fun `leavesSomething is true with answers or a decided round and false before both`() {
        val expected = mapOf(
            "Classic: nothing answered yet" to false,
            "Classic: one answer given" to true,
            "Classic: one answer given and the next card on screen" to true,
            "Classic: the last card answered, the round is decided" to true,
            "Three lives: one wrong answer" to true,
            "Streak: the deciding wrong answer" to true,
            "Timed: the minute is running and nothing is answered" to false,
            "Timed: the minute ran out with nothing answered" to true,
            "Timed: one answer stamped" to true,
            "Classic: abandoned with nothing answered" to false,
        )
        assertEquals(expected.keys, leaves.cases.map { it.name }.toSet())
        for ((name, value) in expected) {
            assertEquals(value, leaves.outputOf(name).flag(), name)
            assertEquals(value, leavesSomething(replay(leaves, leaves.inputOf(name))), name)
        }
    }

    @Test
    fun `leavesSomething matches every golden case`() {
        for (case in leaves.cases) assertEquals(case.output.flag(), leavesSomething(replay(leaves, case.input)), case.name)
    }

    @Test
    fun `saveLeftRound keeps the answers of an undecided round without a record and records a decided round as its result would`() {
        val open = saved("Classic: two answers kept in the history, no record, the route without a score")
        assertEquals(listOf(1L, 1L), open.cards.values.map { it.seen })
        assertEquals(emptyMap<String, Int>(), open.records)
        val openLast = open.last!!
        assertEquals("test-deck", openLast.route.deckId)
        assertEquals("SEC", openLast.route.sectionId)
        assertEquals(Mode.CLASSIC, openLast.mode)
        assertNull(openLast.score)
        assertNull(openLast.total)

        val streak = saved("Streak: left after the deciding answer, recorded as its result would be")
        assertEquals(mapOf("test-deck/SEC#streak" to 3), streak.records)
        assertEquals(4, streak.cards.size)
        assertEquals(true, streak.cards.values.all { it.seen == 1L })
        val streakLast = streak.last!!
        assertEquals(Mode.STREAK, streakLast.mode)
        assertEquals(3, streakLast.score)
        assertEquals(4, streakLast.total)

        assertEquals(mapOf("test-deck/SEC#lives" to 3), saved("Three lives: left after the third wrong answer").records)
        assertEquals(mapOf("test-deck/SEC#classic" to 10), saved("Classic: left after the last card was answered, the record is set").records)
        assertEquals(mapOf("test-deck/SEC#timed" to 0), saved("Timed: the minute ran out with nothing answered, a record of 0").records)
    }

    @Test
    fun `saveLeftRound over stored progress keeps the records and counts a card seen before once more`() {
        val open = saved("Classic: an open round over stored progress keeps the records and counts a card seen before once more")
        assertEquals(mapOf("test-deck/SEC#classic" to 5, "test-deck/SEC#streak" to 9), open.records)
        assertEquals(CardHistory(seen = 2, lastCorrect = true, lastSeenAt = 1000.0), open.cards["test-deck-sec-10"])
        val below = saved("Streak: a decided round below the stored record leaves the record alone")
        assertEquals(9, below.records["test-deck/SEC#streak"])
        assertEquals(5, below.records["test-deck/SEC#classic"])
    }

    @Test
    fun `saveLeftRound matches every golden case, a full store leaving the stored value as it was`() {
        assertEquals(10, save.cases.size)
        for (case in save.cases) {
            val input = save.resolve(case.input)
            val given = input.field("progress") !is JsonNull
            val before = progressOf(input.field("progress"))
            val after = saveLeftRound(replay(save, case.input), before)
            val full = input.field("storage").text() == "full"
            val stored: Progress? = if (full) (if (given) before else null) else after
            val expected = case.output.field("stored")
            if (expected is JsonNull) assertNull(stored, case.name) else assertEquals(progressOf(expected), stored, case.name)
        }
    }
}
```

That is 5 tests.

```bash
(cd android/Truthy && ./gradlew :engine:test --tests 'com.eienmosu.truthy.engine.LeaveGoldenTest')
```

Expected: FAIL, `Unresolved reference 'leavesSomething'` and `Unresolved reference 'saveLeftRound'`, `Execution failed for task ':engine:compileTestKotlin'`.

- [ ] **Step 9: Write `Leave.kt`, then run the test of step 8.**

`android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/Leave.kt`:

```kotlin
package com.eienmosu.truthy.engine

/**
 * Whether leaving this round leaves anything to save: answers to keep, or a decided round (the Timed minute
 * can run out with nothing answered). A round left before both saves nothing: the caller asks this first.
 */
fun leavesSomething(round: RoundState): Boolean = round.answers.isNotEmpty() || isDecided(round)

/**
 * The progress after a round the player is leaving. Before its deciding answer its answers go into the card
 * history and it sets no record (the round is abandoned). After it (the Streak ended, the third life was lost,
 * the Timed minute ran out, the last Classic card was answered) only the result was left to open, so the round
 * is recorded as its result would record it: card history, record and score. `stored` is the progress as
 * loaded; saving the result is the caller's.
 */
fun saveLeftRound(round: RoundState, stored: Progress): Progress {
    val ended = reduce(round, if (isDecided(round)) RoundEvent.Next else RoundEvent.Abandon)
    return applyResult(stored, summarise(ended)).progress
}
```

Run the command of step 8. Expected: `BUILD SUCCESSFUL`, then the same `grep` on `TEST-com.eienmosu.truthy.engine.LeaveGoldenTest.xml` prints `tests="5" skipped="0" failures="0" errors="0"`.

- [ ] **Step 10: Commit.**

```bash
git add android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/Leave.kt android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/LeaveGoldenTest.kt
git commit -m "feat: port leaving a round to the Android engine"
```

- [ ] **Step 11: Write the result copy and missed cards tests and run them.** They type in the cases of `resultCopy.test.ts` and `MissedCards.test.tsx`.

`android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/ResultCopyGoldenTest.kt`:

```kotlin
package com.eienmosu.truthy.engine

import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.Test

class ResultCopyGoldenTest : CopyGoldenBase() {
    private val file = Golden.load("components/play/resultCopy", "resultCopy")

    private fun plain(name: String): JsonElement = file.outputOf(name).without("best")

    private fun bestText(name: String, record: Int): String = file.outputOf(name).field("best").field(record.toString()).text()

    private fun fields(vararg pairs: Pair<String, String>) = pairs.map { mapOf("label" to it.first, "value" to it.second) }

    private fun copyJson(copy: ResultCopy, records: List<Int>): JsonElement {
        val map = mutableMapOf<String, Any?>()
        map["fields"] = copy.fields.map { mapOf("label" to it.label, "value" to it.value) }
        map["scoreLabel"] = copy.scoreLabel
        if (copy.unit != null) map["unit"] = copy.unit
        map["ended"] = copy.ended
        map["endedDetail"] = copy.endedDetail
        map["label"] = copy.label
        map["marks"] = copy.marks
        if (copy.ring != null) map["ring"] = copy.ring
        map["best"] = records.associate { it.toString() to copy.best(it) }
        return json(map)
    }

    @Test
    fun `Classic counts out of the cards dealt`() {
        assertSameJson(
            json(
                mapOf(
                    "fields" to fields("Class" to "Classic", "Cards" to "10 / 10", "Wrong" to "03"),
                    "scoreLabel" to "Your score",
                    "unit" to "of 10",
                    "ended" to "Arrived",
                    "endedDetail" to " · 10 of 10",
                    "label" to "Round complete. 10 of 10 cards. 7 correct, 3 wrong: cards 3, 6 and 9.",
                    "marks" to 10,
                ),
            ),
            plain("Classic: 7 of 10"),
            "Classic: 7 of 10",
        )
        assertEquals("9 / 10", bestText("Classic: 7 of 10", 9))
        val few = "Classic: a route with fewer cards than ten counts by its own length"
        assertEquals("01 / 01", plain(few).field("fields").list()[1].field("value").text())
        assertEquals("of 1", plain(few).field("unit").text())
        assertEquals("Round complete. 1 of 1 cards. 0 correct, 1 wrong: card 1.", plain(few).field("label").text())
        assertEquals(1, plain(few).field("marks").count())
    }

    @Test
    fun `Streak has no unit, rings the previous best only when this round reached it, and pads its fields`() {
        val name = "Streak: 13 right, then wrong, past a best of 12"
        assertSameJson(
            json(
                mapOf(
                    "fields" to fields("Class" to "Streak", "Cards" to "14", "Wrong" to "01"),
                    "scoreLabel" to "Correct in a row",
                    "ended" to "Ended",
                    "endedDetail" to " · 14 cards",
                    "label" to "Streak over on card 14. 13 correct in a row. Card 14 was wrong.",
                    "marks" to 14,
                    "ring" to 11,
                ),
            ),
            plain(name),
            name,
        )
        assertEquals("12", bestText(name, 12))
        assertNull((plain("Streak: no previous best, no ring") as JsonObject)["ring"])
        assertNull((plain("Streak: a previous best of 0, no ring") as JsonObject)["ring"])
        assertNull((plain("Streak: a previous best above the score, no ring") as JsonObject)["ring"])
        assertEquals(12, plain("Streak: a previous best equal to the score rings the last right card").field("ring").count())
        assertEquals(0, plain("Streak: a previous best of 1 rings the first card").field("ring").count())
        val first = plain("Streak: wrong on the first card")
        assertEquals(" · 1 card", first.field("endedDetail").text())
        assertEquals("Streak over on card 1. 0 correct in a row. Card 1 was wrong.", first.field("label").text())
        assertEquals(listOf("Streak", "01", "01"), first.field("fields").list().map { it.field("value").text() })
        assertEquals(1, first.field("marks").count())
    }

    @Test
    fun `Three lives says the cards answered and lists the wrong cards`() {
        val name = "Three lives: 21 cards, wrong on 6, 15 and 21"
        assertSameJson(
            json(
                mapOf(
                    "fields" to fields("Class" to "Three lives", "Correct" to "18", "Wrong" to "03"),
                    "scoreLabel" to "Your score",
                    "unit" to "cards",
                    "ended" to "Out of lives",
                    "endedDetail" to "",
                    "label" to "Out of lives after 21 cards. 18 correct, 3 wrong: cards 6, 15 and 21.",
                    "marks" to 21,
                ),
            ),
            plain(name),
            name,
        )
        assertEquals("21 cards", bestText(name, 21))
    }

    @Test
    fun `Timed says the minute, the cards answered and one card in the singular`() {
        val name = "Timed: 17 answered, wrong on 4, 9 and 15"
        assertSameJson(
            json(
                mapOf(
                    "fields" to fields("Class" to "Timed", "Time" to "60 s", "Answered" to "17"),
                    "scoreLabel" to "Correct",
                    "unit" to "of 17",
                    "ended" to "Time is up",
                    "endedDetail" to " · 17 cards",
                    "label" to "Time is up. 17 cards answered in 60 seconds. 14 correct, 3 wrong: cards 4, 9 and 15.",
                    "marks" to 17,
                ),
            ),
            plain(name),
            name,
        )
        assertEquals("11", bestText(name, 11))
        val none = plain("Timed: nothing answered")
        assertEquals(listOf("Timed", "60 s", "00"), none.field("fields").list().map { it.field("value").text() })
        assertEquals("of 0", none.field("unit").text())
        assertEquals(" · 0 cards", none.field("endedDetail").text())
        assertEquals("Time is up. 0 cards answered in 60 seconds. 0 correct, 0 wrong.", none.field("label").text())
        assertEquals(0, none.field("marks").count())
        val one = plain("Timed: one right answer")
        assertEquals(" · 1 card", one.field("endedDetail").text())
        assertEquals("Time is up. 1 card answered in 60 seconds. 1 correct, 0 wrong.", one.field("label").text())
        assertEquals("of 1", one.field("unit").text())
    }

    @Test
    fun `every case lists the text of the sampled records 0, 1, 7, 9, 11, 12, 21 and 100`() {
        assertEquals(17, file.cases.size)
        val samples = listOf("0", "1", "7", "9", "11", "12", "21", "100")
        for (case in file.cases) assertEquals(samples, case.output.field("best").jsonObject.keys.toList(), case.name)
    }

    @Test
    fun `resultCopy matches every golden case`() {
        for (case in file.cases) {
            val input = file.resolve(case.input)
            val copy = resultCopy(
                resultOf(input.field("result")),
                input.field("modeName").text(),
                input.field("dealt").count(),
                input.field("previousBest").countOrNull(),
            )
            val records = case.output.field("best").jsonObject.keys.map { it.toInt() }
            assertSameJson(case.output, copyJson(copy, records), case.name)
        }
    }
}
```

That is 6 tests.

`android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/MissedCardsGoldenTest.kt`:

```kotlin
package com.eienmosu.truthy.engine

import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import kotlin.test.Test

class MissedCardsGoldenTest : CopyGoldenBase() {
    private val file = Golden.load("components/MissedCards", "missedCards")

    private fun numbers(name: String): List<Int> = file.outputOf(name).list().map { it.field("number").count() }

    private fun missedJson(list: List<MissedCard>): JsonElement = json(
        list.map { card ->
            val map = mutableMapOf<String, Any?>()
            map["number"] = card.number
            map["given"] = card.given
            map["answer"] = card.answer
            if (card.appliesTo != null) map["appliesTo"] = card.appliesTo
            map["statement"] = card.statement
            map["explanation"] = card.explanation
            map["source"] = mapOf("title" to card.source.title, "url" to card.source.url)
            map
        },
    )

    @Test
    fun `the wrong answers come in order, numbered by their place in the round`() {
        assertEquals(listOf(2, 3), numbers("the wrong answers in order, numbered by their place in the round"))
        assertEquals(emptyList<Int>(), numbers("no answers"))
        assertEquals(emptyList<Int>(), numbers("every answer right"))
        assertEquals(listOf(1, 2, 3), numbers("every answer wrong"))
        assertEquals(listOf(1, 10, 12), numbers("wrong on cards 1, 10 and 12 of twelve"))
        assertEquals(listOf(1, 3), numbers("the same card missed twice"))
    }

    @Test
    fun `a card with an appliesTo carries it and a card without one has none`() {
        val name = "a card with an appliesTo carries it, a card without one has none"
        val answers = file.resolve(file.inputOf(name)).field("answers").list().map { answeredOf(it) }
        val listed = missedCards(answers)
        assertEquals(answers[0].card.appliesTo, listed[0].appliesTo)
        assertTrue(listed[0].appliesTo!!.isNotEmpty())
        assertEquals(null, listed[1].appliesTo)
        val output = file.outputOf(name).list()
        assertTrue((output[0] as JsonObject).containsKey("appliesTo"))
        assertFalse((output[1] as JsonObject).containsKey("appliesTo"))
    }

    @Test
    fun `missedCards matches every golden case`() {
        assertEquals(7, file.cases.size)
        for (case in file.cases) {
            val answers = file.resolve(case.input).field("answers").list().map { answeredOf(it) }
            assertSameJson(case.output, missedJson(missedCards(answers)), case.name)
        }
    }
}
```

That is 3 tests.

```bash
(cd android/Truthy && ./gradlew :engine:test --tests 'com.eienmosu.truthy.engine.ResultCopyGoldenTest' --tests 'com.eienmosu.truthy.engine.MissedCardsGoldenTest')
```

Expected: FAIL, `Unresolved reference 'resultCopy'` (also `ResultCopy`, `missedCards`, `MissedCard`), `Execution failed for task ':engine:compileTestKotlin'`.

- [ ] **Step 12: Write `ResultCopy.kt` and `MissedCards.kt`, the two label functions of `FlightPath.kt` that `resultCopy` calls, and the minute constant, then run the tests of step 11.** `cardList` and `completedLabel` go into `FlightPath.kt` now in their final form, and step 24 adds the rest of that file; `TIMED_SECONDS` goes into `TimedPath.kt` now and step 27 completes that file.

`android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/FlightPath.kt` (first part; step 24 appends the curve, the states, the other labels and the scale to this file):

```kotlin
package com.eienmosu.truthy.engine

// The flight-path header (components/FlightPath.tsx): the labels first, because the result copy uses them.

/** "card 3", "cards 1 and 2", "cards 1, 2 and 5". The list is never empty where this is called. */
fun cardList(numbers: List<Int>): String {
    if (numbers.size == 1) return "card ${numbers[0]}"
    val head = numbers.dropLast(1).joinToString(", ")
    return "cards $head and ${numbers.last()}"
}

/** The accessible label of a finished round: "Round complete. 10 of 10 cards. 7 correct, 3 wrong: cards 3, 6 and 9." */
fun completedLabel(total: Int, results: List<Boolean>): String {
    val wrong = results.withIndex().filter { !it.value }.map { it.index + 1 }
    val correct = results.size - wrong.size
    val head = "Round complete. ${results.size} of $total cards. $correct correct, ${wrong.size} wrong"
    return if (wrong.isEmpty()) "$head." else "$head: ${cardList(wrong)}."
}
```

`android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/ResultCopy.kt`:

```kotlin
package com.eienmosu.truthy.engine

/** One field of the pass: its label and value. */
data class LabelledValue(val label: String, val value: String)

/**
 * What the result screen says in a class: the three fields of the pass, the label and unit of the score, how a
 * record reads, the header's label row and its accessible name, and the marks on the completed route.
 */
class ResultCopy(
    val fields: List<LabelledValue>,
    val scoreLabel: String,
    /** Null where the score has no unit (Streak). */
    val unit: String?,
    /** How a record reads in the comparison: "9 / 10", "21 cards", "12". */
    val best: (Int) -> String,
    /** The bold word of the header's label row: "Arrived", "Ended", "Out of lives", "Time is up". */
    val ended: String,
    /** What follows it: " · 10 of 10", " · 14 cards", "". */
    val endedDetail: String,
    /** The header's accessible name. */
    val label: String,
    /** Marks on the completed route. */
    val marks: Int,
    /** Streak: the card (from 0) where the previous best was reached. */
    val ring: Int?,
)

private fun cards(count: Int): String = if (count == 1) "1 card" else "$count cards"

// "18 correct, 3 wrong: cards 6, 15 and 21." and, when nothing is wrong, "18 correct, 0 wrong."
private fun tally(correct: Int, wrong: List<Int>): String {
    val head = "$correct correct, ${wrong.size} wrong"
    return if (wrong.isEmpty()) "$head." else "$head: ${cardList(wrong)}."
}

/**
 * The copy of a finished round. `dealt` is the cards the round dealt (Classic counts "of 10" by it),
 * `previousBest` the record before the round (null: none), `modeName` the class name on the ticket.
 */
fun resultCopy(result: RoundResult, modeName: String, dealt: Int, previousBest: Int?): ResultCopy {
    val n = result.total
    val w = result.missed.size
    val c = n - w
    val wrong = result.answers.withIndex().filter { !it.value.correct }.map { it.index + 1 }
    val klass = LabelledValue("Class", modeName)
    val wrongField = LabelledValue("Wrong", pad2(w))
    return when (result.mode) {
        Mode.CLASSIC -> ResultCopy(
            fields = listOf(klass, LabelledValue("Cards", "${pad2(n)} / ${pad2(dealt)}"), wrongField),
            scoreLabel = "Your score",
            unit = "of $dealt",
            best = { record -> "$record / $dealt" },
            ended = "Arrived",
            endedDetail = " · $n of $dealt",
            label = completedLabel(dealt, result.answers.map { it.correct }),
            marks = dealt,
            ring = null,
        )
        Mode.STREAK -> ResultCopy(
            fields = listOf(klass, LabelledValue("Cards", pad2(n)), wrongField),
            scoreLabel = "Correct in a row",
            unit = null,
            best = { record -> "$record" },
            ended = "Ended",
            endedDetail = " · ${cards(n)}",
            label = "Streak over on card $n. ${result.score} correct in a row. Card $n was wrong.",
            marks = n,
            ring = if (previousBest != null && previousBest >= 1 && previousBest <= result.score) previousBest - 1 else null,
        )
        Mode.LIVES -> ResultCopy(
            fields = listOf(klass, LabelledValue("Correct", pad2(c)), wrongField),
            scoreLabel = "Your score",
            unit = "cards",
            best = { record -> "$record cards" },
            ended = "Out of lives",
            endedDetail = "",
            label = "Out of lives after $n cards. ${tally(c, wrong)}",
            marks = n,
            ring = null,
        )
        Mode.TIMED -> ResultCopy(
            fields = listOf(klass, LabelledValue("Time", "$TIMED_SECONDS s"), LabelledValue("Answered", pad2(n))),
            scoreLabel = "Correct",
            unit = "of $n",
            best = { record -> "$record" },
            ended = "Time is up",
            endedDetail = " · ${cards(n)}",
            label = "Time is up. ${cards(n)} answered in $TIMED_SECONDS seconds. ${tally(c, wrong)}",
            marks = n,
            ring = null,
        )
    }
}
```

`TIMED_SECONDS` is the minute in seconds; it is declared in `TimedPath.kt` (step 27) and used here, so add its declaration to a file that already compiles now. Create `android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/TimedPath.kt` with only this for now:

```kotlin
package com.eienmosu.truthy.engine

/** The Timed minute in whole seconds (60). The rest of this file is written in step 27. */
internal val TIMED_SECONDS: Int = (TIMED.roundMs / 1000.0).toInt()
```

`android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/MissedCards.kt`:

```kotlin
package com.eienmosu.truthy.engine

/** One missed card, as the list shows it. */
data class MissedCard(
    /** The card's place in the round, from 1. */
    val number: Int,
    /** What the player answered. */
    val given: Boolean,
    /** The right answer. */
    val answer: Boolean,
    /** The card's appliesTo, when it has one. */
    val appliesTo: String?,
    val statement: String,
    val explanation: String,
    val source: CardSource,
)

/** The wrong answers of a round, in order, with their card numbers. */
fun missedCards(answers: List<Answered>): List<MissedCard> =
    answers.withIndex().filter { !it.value.correct }.map { (index, answered) ->
        MissedCard(
            number = index + 1,
            given = answered.given,
            answer = answered.card.answer,
            appliesTo = if (answered.card.appliesTo.isEmpty()) null else answered.card.appliesTo,
            statement = answered.card.text.en.statement,
            explanation = answered.card.text.en.explanation,
            source = answered.card.source,
        )
    }
```

Run the command of step 11. Expected: `BUILD SUCCESSFUL`; then the `grep` on `TEST-com.eienmosu.truthy.engine.ResultCopyGoldenTest.xml` prints `tests="6" skipped="0" failures="0" errors="0"` and on `MissedCardsGoldenTest.xml` prints `tests="3" skipped="0" failures="0" errors="0"`.

- [ ] **Step 13: Commit.**

```bash
git add android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/ResultCopy.kt android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/MissedCards.kt android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/FlightPath.kt android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/TimedPath.kt android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/ResultCopyGoldenTest.kt android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/MissedCardsGoldenTest.kt
git commit -m "feat: port the result copy and the missed cards to the Android engine"
```

- [ ] **Step 14: Write the recording test and run it.** Rule 4: `recordRound` is the compute, `RoundRecorder` is the once-per-round memory, and the vectors count the writes.

`android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/RoundRecorderGoldenTest.kt`:

```kotlin
package com.eienmosu.truthy.engine

import kotlinx.serialization.json.JsonNull
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertSame
import kotlin.test.assertTrue
import kotlin.test.Test

class RoundRecorderGoldenTest : CopyGoldenBase() {
    private val record = Golden.load("components/play/ResultView", "recordRound")
    private val arrives = Golden.load("components/play/ResultView", "RESULT_ARRIVES_MS")

    private fun outcomeFor(name: String): ApplyOutcome {
        val input = record.resolve(record.inputOf(name))
        return recordRound(replay(record, record.inputOf(name)), progressOf(input.field("progress")))
    }

    @Test
    fun `the result delay is a second`() {
        assertEquals(1000.0, RESULT_ARRIVES_MS)
        assertEquals(1, arrives.cases.size)
        assertTrue(arrives.cases[0].output.number() == RESULT_ARRIVES_MS)
    }

    @Test
    fun `recordRound sets the record, the history and the last route as the pinned rounds of ResultView test do`() {
        val first = outcomeFor("Classic 7 of 10: called once")
        assertEquals(mapOf("test-deck/SEC#classic" to 7), first.progress.records)
        assertEquals(List(10) { 1L }, first.progress.cards.values.map { it.seen })
        val firstLast = first.progress.last!!
        assertEquals("test-deck", firstLast.route.deckId)
        assertEquals("SEC", firstLast.route.sectionId)
        assertEquals(Mode.CLASSIC, firstLast.mode)
        assertEquals(7, firstLast.score)
        assertEquals(10, firstLast.total)
        assertEquals(null, first.previousBest)
        assertTrue(first.isNewBest)

        val below = outcomeFor("Classic 7 of 10 below a stored record of 9: the record stays")
        assertEquals(9, below.progress.records["test-deck/SEC#classic"])
        assertEquals(9, below.previousBest)
        assertFalse(below.isNewBest)

        val past = outcomeFor("Streak 3 past a stored record of 2: a new record")
        assertEquals(3, past.progress.records["test-deck/SEC#streak"])
        assertEquals(2, past.previousBest)
        assertTrue(past.isNewBest)
    }

    @Test
    fun `the recorder writes a round once however often it is called and returns the same outcome`() {
        val name = "Classic 7 of 10: called once"
        val round = replay(record, record.inputOf(name))
        val recorder = RoundRecorder()
        val shown = recorder.preview(round, emptyProgress())
        assertEquals(recordRound(round, emptyProgress()), shown)

        val first = recorder.record(round, emptyProgress())
        assertTrue(first.write)
        assertEquals(shown, first.outcome)

        val again = recorder.record(round, emptyProgress())
        assertFalse(again.write)
        assertSame(first.outcome, again.outcome)
        assertSame(first.outcome, recorder.preview(round, emptyProgress()))

        val another = replay(record, record.inputOf(name))
        assertTrue(recorder.record(another, emptyProgress()).write)
    }

    @Test
    fun `recordRound through the recorder matches every golden case`() {
        assertEquals(7, record.cases.size)
        for (case in record.cases) {
            val input = record.resolve(case.input)
            val round = replay(record, case.input)
            val calls = input.field("calls").count()
            var stored: Progress? = if (input.field("progress") is JsonNull) null else progressOf(input.field("progress"))
            val recorder = RoundRecorder()
            var writes = 0
            val outcomes = mutableListOf<ApplyOutcome>()
            repeat(calls) {
                val recording = recorder.record(round, stored ?: emptyProgress())
                if (recording.write) {
                    writes += 1
                    stored = recording.outcome.progress
                }
                outcomes.add(recording.outcome)
            }
            val expected = case.output
            assertEquals(expected.field("writes").count(), writes, "${case.name}: writes")
            assertEquals(expected.field("sameOutcome").flag(), outcomes.all { it === outcomes[0] }, "${case.name}: sameOutcome")
            assertEquals(progressOf(expected.field("stored")), stored, "${case.name}: stored")
            assertEquals(expected.field("outcome").field("previousBest").countOrNull(), outcomes[0].previousBest, "${case.name}: previousBest")
            assertEquals(expected.field("outcome").field("isNewBest").flag(), outcomes[0].isNewBest, "${case.name}: isNewBest")
        }
    }
}
```

That is 4 tests.

```bash
(cd android/Truthy && ./gradlew :engine:test --tests 'com.eienmosu.truthy.engine.RoundRecorderGoldenTest')
```

Expected: FAIL, `Unresolved reference 'recordRound'` (also `RoundRecorder`, `RESULT_ARRIVES_MS`), `Execution failed for task ':engine:compileTestKotlin'`.

- [ ] **Step 15: Write `RoundRecorder.kt`, then run the test of step 14.**

`android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/RoundRecorder.kt`:

```kotlin
package com.eienmosu.truthy.engine

import java.util.IdentityHashMap

/** How long after the result shows its actions (Play again, Choose another route, Close results) take presses. */
const val RESULT_ARRIVES_MS: Double = 1000.0

/**
 * The progress outcome of recording a finished round: its answers into the card history, its route and score
 * as `last`, and the record when it beats the stored one. `stored` is the progress as loaded.
 */
fun recordRound(round: RoundState, stored: Progress): ApplyOutcome = applyResult(stored, summarise(round))

/** The outcome of recording a round, and whether this call is the one that must write `outcome.progress`. */
data class Recording(val outcome: ApplyOutcome, val write: Boolean)

/**
 * Records each round exactly once, as the web does with a weak map keyed by the round: the first call for a
 * round computes the outcome and says to write; later calls for the same round object return that very outcome
 * and say not to write. `preview` gives the outcome the result shows in its first frame, before the write, and
 * the remembered one afterwards. A recorder belongs to one screen and is used from one thread; the round is
 * the same object each time (identity, not equality). The caller loads `stored` before each call and, when
 * `write` is true, saves `outcome.progress`; the load and the save are the app's (task 9).
 */
class RoundRecorder {
    private val recorded = IdentityHashMap<RoundState, ApplyOutcome>()

    fun preview(round: RoundState, stored: Progress): ApplyOutcome = recorded[round] ?: recordRound(round, stored)

    fun record(round: RoundState, stored: Progress): Recording {
        val done = recorded[round]
        if (done != null) return Recording(done, write = false)
        val outcome = recordRound(round, stored)
        recorded[round] = outcome
        return Recording(outcome, write = true)
    }
}
```

Run the command of step 14. Expected: `BUILD SUCCESSFUL`; the `grep` on `TEST-com.eienmosu.truthy.engine.RoundRecorderGoldenTest.xml` prints `tests="4" skipped="0" failures="0" errors="0"`.

- [ ] **Step 16: Commit.**

```bash
git add android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/RoundRecorder.kt android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/RoundRecorderGoldenTest.kt
git commit -m "feat: port recording a round once to the Android engine"
```

- [ ] **Step 17: Write the ticket test and run it.** The input of a case is the route as `findRoute` returns it: the whole area, the platform, the deck and the section (null for the whole deck).

`android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/TicketForGoldenTest.kt`:

```kotlin
package com.eienmosu.truthy.engine

import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlin.test.assertEquals
import kotlin.test.Test

class TicketForGoldenTest : CopyGoldenBase() {
    private val file = Golden.load("components/play/useRound", "ticketFor")

    private fun foundOf(element: JsonElement): RouteInIndex = RouteInIndex(
        area = wire.decodeFromJsonElement(IndexArea.serializer(), element.field("area")),
        platform = wire.decodeFromJsonElement(IndexPlatform.serializer(), element.field("platform")),
        deck = wire.decodeFromJsonElement(IndexDeck.serializer(), element.field("deck")),
        section = element.field("section").let { if (it is JsonNull) null else wire.decodeFromJsonElement(IndexSection.serializer(), it) },
    )

    private fun ticketJson(info: TicketInfo): JsonElement = json(
        mapOf(
            "deckCode" to info.deckCode,
            "deckName" to info.deckName,
            "sectionCode" to info.sectionCode,
            "sectionName" to info.sectionName,
            "modeLabel" to info.modeLabel,
            "best" to info.best,
        ),
    )

    private fun ticketOf(name: String): TicketInfo {
        val input = file.resolve(file.inputOf(name))
        return ticketFor(foundOf(input.field("found")), modeOf(input.field("mode").text()), input.field("best").countOrNull())
    }

    @Test
    fun `the deck is named by its platform and title, or by its pass name when it has one`() {
        assertEquals("AWS Test deck", ticketOf("the platform and the deck title name the deck").deckName)
        assertEquals("Amazon Test deck", ticketOf("the deck's pass name wins when it has one").deckName)
    }

    @Test
    fun `the whole deck is ALL and Whole deck, a section is its id and title`() {
        assertEquals(
            TicketInfo("CDL", "Google Cloud Digital Leader", "ALL", "Whole deck", "Classic", null),
            ticketOf("a shipped deck with a pass name and no sections is the whole deck"),
        )
        assertEquals(
            TicketInfo("CLF", "AWS Cloud Practitioner", "BIL", "Billing, pricing and support", "Classic", null),
            ticketOf("a section of a shipped deck"),
        )
    }

    @Test
    fun `the class is named and the best is kept, a best of 0 included`() {
        val streak = ticketOf("the whole deck of a deck with sections")
        assertEquals("ALL", streak.sectionCode)
        assertEquals("Streak", streak.modeLabel)
        assertEquals(12, streak.best)
        assertEquals("Three lives", ticketOf("Three lives with a best").modeLabel)
        assertEquals(21, ticketOf("Three lives with a best").best)
        assertEquals("Timed", ticketOf("Timed with a best of 0").modeLabel)
        assertEquals(0, ticketOf("Timed with a best of 0").best)
    }

    @Test
    fun `ticketFor matches every golden case`() {
        assertEquals(7, file.cases.size)
        for (case in file.cases) {
            val input = file.resolve(case.input)
            val info = ticketFor(foundOf(input.field("found")), modeOf(input.field("mode").text()), input.field("best").countOrNull())
            assertSameJson(case.output, ticketJson(info), case.name)
        }
    }
}
```

That is 4 tests.

```bash
(cd android/Truthy && ./gradlew :engine:test --tests 'com.eienmosu.truthy.engine.TicketForGoldenTest')
```

Expected: FAIL, `Unresolved reference 'ticketFor'` and `Unresolved reference 'TicketInfo'`, `Execution failed for task ':engine:compileTestKotlin'`.

- [ ] **Step 18: Write `Ticket.kt`, then run the test of step 17.**

`android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/Ticket.kt`:

```kotlin
package com.eienmosu.truthy.engine

/** What the ticket shows about the route, taken from the deck index. */
data class TicketInfo(
    /** "CLF". */
    val deckCode: String,
    /** "AWS Cloud Practitioner": the platform title plus the deck title, or the deck's pass name. */
    val deckName: String,
    /** "SEC", or "ALL" for the whole deck. */
    val sectionCode: String,
    /** "Security and compliance", or "Whole deck". */
    val sectionName: String,
    /** "Classic". */
    val modeLabel: String,
    /** The record for this route and class when the round was dealt. */
    val best: Int?,
)

/** What the ticket shows about a route that was found in the index, for the class played. */
fun ticketFor(found: RouteInIndex, mode: Mode, best: Int?): TicketInfo = TicketInfo(
    deckCode = found.deck.code,
    deckName = deckPassName(found.platform, found.deck),
    sectionCode = found.section?.id ?: WHOLE_DECK,
    sectionName = found.section?.title ?: "Whole deck",
    modeLabel = modeInfo(mode).name,
    best = best,
)
```

Run the command of step 17. Expected: `BUILD SUCCESSFUL`; the `grep` on `TEST-com.eienmosu.truthy.engine.TicketForGoldenTest.xml` prints `tests="4" skipped="0" failures="0" errors="0"`.

- [ ] **Step 19: Commit.**

```bash
git add android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/Ticket.kt android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/TicketForGoldenTest.kt
git commit -m "feat: port the ticket's route words to the Android engine"
```

- [ ] **Step 20: Write the ticket scroll test and run it.** The pins are the values of `ticketScroll.test.ts`, called directly on the Kotlin functions; the golden files add the boundaries around them (13 slip cases and 96 key cases).

`android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/TicketScrollGoldenTest.kt`:

```kotlin
package com.eienmosu.truthy.engine

import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.Test

class TicketScrollGoldenTest : CopyGoldenBase() {
    private val statement = Golden.load("components/play/ticketScroll", "statementScroll")
    private val slip = Golden.load("components/play/ticketScroll", "slipScroll")
    private val key = Golden.load("components/play/ticketScroll", "keyScroll")
    private val step = Golden.load("components/play/ticketScroll", "ARROW_STEP")

    private val base = SlipAt(top = 0.0, visible = 300.0, gap = 12.0, max = 340.0)
    private val middle = KeyAt(top = 100.0, visible = 300.0, max = 600.0)

    @Test
    fun `statementScroll stays at the top when the text fits, scrolls only to its end, starts a tall text at the top`() {
        assertEquals(0.0, statementScroll(Span(230.0, 400.0), 420.0))
        assertEquals(135.0, statementScroll(Span(230.0, 485.0), 350.0))
        assertEquals(230.0, statementScroll(Span(230.0, 485.0), 120.0))
    }

    @Test
    fun `slipScroll scrolls to the end of the ticket, stops at a tall slip, and leaves a slip in view alone`() {
        assertEquals(340.0, slipScroll(Span(500.0, 620.0), base))
        assertEquals(300.0, slipScroll(Span(300.0, 640.0), base))
        assertNull(slipScroll(Span(200.0, 300.0), base.copy(max = 0.0)))
        assertNull(slipScroll(Span(200.0, 303.0), base.copy(max = 3.0)))
        assertNull(slipScroll(Span(200.0, 312.0), base))
        assertNull(slipScroll(Span(300.0, 452.0), base.copy(top = 140.0)))
        assertEquals(200.0, slipScroll(Span(200.0, 313.0), base))
        assertEquals(13.0, slipScroll(Span(200.0, 313.0), base.copy(max = 13.0)))
        assertEquals(100.0, slipScroll(Span(100.0, 200.0), base.copy(top = 150.0)))
        assertEquals(0.0, slipScroll(Span(200.0, 400.0), base.copy(max = 0.0)))
    }

    @Test
    fun `keyScroll moves by a line, a page less a line or to the ends, stays inside the ticket and ignores other keys`() {
        assertEquals(140.0, keyScroll("ArrowDown", false, middle))
        assertEquals(60.0, keyScroll("ArrowUp", false, middle))
        assertEquals(360.0, keyScroll("PageDown", false, middle))
        assertEquals(0.0, keyScroll("PageUp", false, middle))
        assertEquals(360.0, keyScroll(" ", false, middle))
        assertEquals(0.0, keyScroll(" ", true, middle))
        assertEquals(0.0, keyScroll("Home", false, middle))
        assertEquals(600.0, keyScroll("End", false, middle))
        assertEquals(600.0, keyScroll("ArrowDown", false, KeyAt(590.0, 300.0, 600.0)))
        assertEquals(0.0, keyScroll("ArrowUp", false, KeyAt(10.0, 300.0, 600.0)))
        assertEquals(40.0, keyScroll("PageDown", false, KeyAt(0.0, 49.0, 600.0)))
        assertNull(keyScroll("ArrowLeft", false, middle))
        assertNull(keyScroll("Enter", false, middle))
        assertNull(keyScroll("ArrowDown", true, middle))
    }

    @Test
    fun `statementScroll matches every golden case`() {
        assertEquals(9, statement.cases.size)
        for (case in statement.cases) {
            val input = statement.resolve(case.input)
            val text = input.field("text")
            val result = statementScroll(Span(text.field("top").number(), text.field("bottom").number()), input.field("visible").number())
            assertSameJson(case.output, json(result), case.name)
        }
    }

    @Test
    fun `slipScroll matches every golden case`() {
        assertEquals(13, slip.cases.size)
        for (case in slip.cases) {
            val input = slip.resolve(case.input)
            val span = input.field("slip")
            val at = input.field("at")
            val result = slipScroll(
                Span(span.field("top").number(), span.field("bottom").number()),
                SlipAt(at.field("top").number(), at.field("visible").number(), at.field("gap").number(), at.field("max").number()),
            )
            assertSameJson(case.output, json(result), case.name)
        }
    }

    @Test
    fun `keyScroll matches every golden case`() {
        assertEquals(96, key.cases.size)
        for (case in key.cases) {
            val input = key.resolve(case.input)
            val at = input.field("at")
            val result = keyScroll(
                input.field("key").text(),
                input.field("shift").flag(),
                KeyAt(at.field("top").number(), at.field("visible").number(), at.field("max").number()),
            )
            assertSameJson(case.output, json(result), case.name)
        }
    }

    @Test
    fun `one arrow press scrolls forty`() {
        assertEquals(40.0, ARROW_STEP)
        assertEquals(1, step.cases.size)
        assertEquals(true, step.cases[0].output.number() == ARROW_STEP)
    }
}
```

That is 7 tests.

```bash
(cd android/Truthy && ./gradlew :engine:test --tests 'com.eienmosu.truthy.engine.TicketScrollGoldenTest')
```

Expected: FAIL, `Unresolved reference 'statementScroll'` (also `Span`, `SlipAt`, `KeyAt`, `slipScroll`, `keyScroll`, `ARROW_STEP`), `Execution failed for task ':engine:compileTestKotlin'`.

- [ ] **Step 21: Write `TicketScroll.kt`, then run the test of step 20.**

`android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/TicketScroll.kt`:

```kotlin
package com.eienmosu.truthy.engine

import kotlin.math.max
import kotlin.math.min

// Where the play screen scrolls its ticket (components/play/ticketScroll.ts): pure arithmetic on numbers. The
// native ticket scrolls inside the stage like the web's, and the stage's scroller runs on under the action row
// (its bottom padding is the row plus the gap above it).

/** A part of the ticket, from its top to its bottom, in the ticket's own coordinates. */
data class Span(val top: Double, val bottom: Double)

/** The scroll now, the visible stage (above the gap), the gap above the action row and the largest scroll. */
data class SlipAt(val top: Double, val visible: Double, val gap: Double, val max: Double)

/** The scroll now, the visible stage and the largest scroll. */
data class KeyAt(val top: Double, val visible: Double, val max: Double)

/**
 * A new card: the scroll that shows the statement's text in the visible stage, ending above the action row.
 * Where the text fits nothing moves (0). A text taller than the stage starts at the top of the stage.
 */
fun statementScroll(text: Span, visible: Double): Double = max(0.0, min(text.bottom - visible, text.top))

/**
 * After an answer: the scroll that brings the slip in, or null when the slip is in view already. In view means
 * it starts inside the stage and ends no lower than the top of the action row (the gap above the row hides
 * nothing). Otherwise the scroll goes to the end of the ticket, which is the slip; a slip taller than the stage
 * starts at the top of the stage, so its verdict row stays in view.
 */
fun slipScroll(slip: Span, at: SlipAt): Double? {
    if (slip.top >= at.top && slip.bottom <= at.top + at.visible + at.gap) return null
    return max(0.0, min(at.max, slip.top))
}

/** One arrow press scrolls this far, as a page does. */
const val ARROW_STEP: Double = 40.0

/**
 * Where a key that scrolls a page takes the ticket, or null for any other key: the arrows by a line, Page Up
 * and Page Down and Space (Shift+Space up) by the visible stage less a line, Home and End to the ends.
 */
fun keyScroll(key: String, shift: Boolean, at: KeyAt): Double? {
    val page = max(ARROW_STEP, at.visible - ARROW_STEP)
    val top: Double = when {
        key == " " -> at.top + (if (shift) -page else page)
        shift -> return null
        key == "ArrowDown" -> at.top + ARROW_STEP
        key == "ArrowUp" -> at.top - ARROW_STEP
        key == "PageDown" -> at.top + page
        key == "PageUp" -> at.top - page
        key == "Home" -> 0.0
        key == "End" -> at.max
        else -> return null
    }
    return max(0.0, min(at.max, top))
}
```

Run the command of step 20. Expected: `BUILD SUCCESSFUL`; the `grep` on `TEST-com.eienmosu.truthy.engine.TicketScrollGoldenTest.xml` prints `tests="7" skipped="0" failures="0" errors="0"`.

- [ ] **Step 22: Commit.**

```bash
git add android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/TicketScroll.kt android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/TicketScrollGoldenTest.kt
git commit -m "feat: port the ticket scroll arithmetic to the Android engine"
```

- [ ] **Step 23: Write the flight path test and run it.** The curve functions are replayed at every parameter plan A recorded (the waypoints of routes of 2 to 60 cards, the quarters, the Timed clock moments).

`android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/FlightPathGoldenTest.kt`:

```kotlin
package com.eienmosu.truthy.engine

import kotlinx.serialization.json.JsonElement
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.test.Test
import kotlin.math.abs

class FlightPathGoldenTest : CopyGoldenBase() {
    private val point = Golden.load("components/FlightPath", "pointAt")
    private val waypoint = Golden.load("components/FlightPath", "waypointT")
    private val flown = Golden.load("components/FlightPath", "flownPath")
    private val heading = Golden.load("components/FlightPath", "headingAt")
    private val states = Golden.load("components/FlightPath", "waypointStates")
    private val list = Golden.load("components/FlightPath", "cardList")
    private val label = Golden.load("components/FlightPath", "flightPathLabel")
    private val completed = Golden.load("components/FlightPath", "completedLabel")
    private val scale = Golden.load("components/FlightPath", "completedScale")

    private fun results(element: JsonElement): List<Boolean> = element.list().map { it.flag() }

    @Test
    fun `the curve runs along M6 24 Q138 -6 270 24 with the waypoints evenly spread`() {
        assertEquals(Point(6.0, 24.0), pointAt(0.0))
        assertEquals(Point(270.0, 24.0), pointAt(1.0))
        assertEquals(Point(138.0, 9.0), pointAt(0.5))
        assertTrue(waypointT(0, 10) == 0.0)
        assertTrue(waypointT(9, 10) == 1.0)
        assertTrue(abs(waypointT(3, 10) - 1.0 / 3.0) < 1e-12)
        assertTrue(waypointT(0, 1) == 0.0)
        assertTrue(waypointT(0, 0) == 0.0)
        assertEquals("M6 24 Q138 -6 270 24", flownPath(1.0))
        assertEquals("M6 24 Q72 9 138 9", flownPath(0.5))
        assertTrue(headingAt(0.0) < 0.0)
        assertTrue(headingAt(0.5) == 0.0)
        assertTrue(headingAt(1.0) > 0.0)
        assertTrue(headingAt(0.0) == -headingAt(1.0))
    }

    @Test
    fun `waypointStates marks answered cards, the card on screen and the rest`() {
        assertEquals(
            listOf(WaypointState.CORRECT, WaypointState.WRONG, WaypointState.CURRENT, WaypointState.FUTURE, WaypointState.FUTURE),
            waypointStates(5, listOf(true, false), 2, false),
        )
        assertEquals(
            listOf(WaypointState.CORRECT, WaypointState.WRONG, WaypointState.WRONG, WaypointState.FUTURE),
            waypointStates(4, listOf(true, false, false), 2, true),
        )
    }

    @Test
    fun `the labels are one full sentence with the card numbers of each verdict`() {
        assertEquals("Card 4 of 10. Cards 1 and 2 correct, card 3 wrong.", flightPathLabel(10, listOf(true, true, false), 3))
        assertEquals("Card 5 of 10. Cards 2, 3 and 4 correct, card 1 wrong.", flightPathLabel(10, listOf(false, true, true, true), 4))
        assertEquals("Card 1 of 10.", flightPathLabel(10, emptyList(), 0))
        val seven = listOf(true, true, false, true, true, false, true, true, false, true)
        assertEquals("Round complete. 10 of 10 cards. 7 correct, 3 wrong: cards 3, 6 and 9.", completedLabel(10, seven))
        assertEquals("Round complete. 10 of 10 cards. 10 correct, 0 wrong.", completedLabel(10, List(10) { true }))
        assertEquals("Round complete. 3 of 3 cards. 1 correct, 2 wrong: cards 2 and 3.", completedLabel(3, listOf(true, false, false)))
        assertEquals("card 3", cardList(listOf(3)))
        assertEquals("cards 1 and 2", cardList(listOf(1, 2)))
        assertEquals("cards 1, 2 and 5", cardList(listOf(1, 2, 5)))
    }

    @Test
    fun `completedScale keeps the marks from touching`() {
        val radii = listOf(10 to 7.0, 11 to 6.0, 14 to 6.0, 17 to 6.0, 18 to 5.435, 21 to 4.62, 60 to 1.566)
        for ((cards, radius) in radii) assertTrue(abs(7 * completedScale(cards) - radius) < 0.005, "$cards cards")
        assertTrue(completedScale(0) == 1.0)
        assertTrue(completedScale(10) == 1.0)
        assertTrue(completedScale(11) == 6.0 / 7.0)
    }

    @Test
    fun `the curve functions match every golden case at every parameter`() {
        val parameters = point.cases.map { it.input.field("t").number() }
        assertTrue(parameters.size > 90)
        for (t in listOf(0.0, 0.25, 0.5, 0.75, 1.0, waypointT(3, 10), waypointT(11, 14), waypointT(59, 60))) {
            assertTrue(parameters.any { it == t }, "no case at t = $t")
        }
        assertEquals(parameters, flown.cases.map { it.input.field("t").number() })
        assertEquals(parameters, heading.cases.map { it.input.field("t").number() })
        for (case in point.cases) {
            val p = pointAt(case.input.field("t").number())
            assertSameJson(case.output, json(mapOf("x" to p.x, "y" to p.y)), "pointAt ${case.name}")
        }
        for (case in flown.cases) assertEquals(case.output.text(), flownPath(case.input.field("t").number()), "flownPath ${case.name}")
        for (case in heading.cases) assertSameJson(case.output, json(headingAt(case.input.field("t").number())), "headingAt ${case.name}")
        assertEquals(117, waypoint.cases.size)
        for (case in waypoint.cases) {
            val input = case.input
            assertSameJson(case.output, json(waypointT(input.field("i").count(), input.field("n").count())), "waypointT ${case.name}")
        }
    }

    @Test
    fun `waypointStates and the labels match every golden case`() {
        assertEquals(8, states.cases.size)
        for (case in states.cases) {
            val input = case.input
            val made = waypointStates(input.field("total").count(), results(input.field("results")), input.field("current").count(), input.field("answered").flag())
            assertSameJson(case.output, json(made.map { it.wire }), "waypointStates ${case.name}")
        }
        assertEquals(6, list.cases.size)
        for (case in list.cases) {
            assertEquals(case.output.text(), cardList(case.input.field("numbers").list().map { it.count() }), "cardList ${case.name}")
        }
        assertEquals(7, label.cases.size)
        for (case in label.cases) {
            val input = case.input
            assertEquals(
                case.output.text(),
                flightPathLabel(input.field("total").count(), results(input.field("results")), input.field("current").count()),
                "flightPathLabel ${case.name}",
            )
        }
        assertEquals(7, completed.cases.size)
        for (case in completed.cases) {
            val input = case.input
            assertEquals(case.output.text(), completedLabel(input.field("total").count(), results(input.field("results"))), "completedLabel ${case.name}")
        }
    }

    @Test
    fun `completedScale matches every golden case`() {
        assertEquals(18, scale.cases.size)
        for (case in scale.cases) assertSameJson(case.output, json(completedScale(case.input.field("cards").count())), case.name)
    }
}
```

That is 7 tests.

```bash
(cd android/Truthy && ./gradlew :engine:test --tests 'com.eienmosu.truthy.engine.FlightPathGoldenTest')
```

Expected: FAIL, `Unresolved reference 'pointAt'` (also `Point`, `waypointT`, `flownPath`, `headingAt`, `WaypointState`, `waypointStates`, `flightPathLabel`, `completedScale`), `Execution failed for task ':engine:compileTestKotlin'`.

- [ ] **Step 24: Complete `FlightPath.kt`, then run the test of step 23.** Replace the whole file with this (it keeps `cardList` and `completedLabel` exactly as step 12 wrote them and adds the rest).

`android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/FlightPath.kt`:

```kotlin
package com.eienmosu.truthy.engine

import kotlin.math.PI
import kotlin.math.min

// The flight-path header (components/FlightPath.tsx): the route as a curve with one waypoint per card, the plane
// on the card on screen, and the sentences that name the header. The curve is M6 24 Q138 -6 270 24 in a 276 by
// 34 box. These are the functions; drawing them is the app's.

/** A point of the 276 by 34 box. */
data class Point(val x: Double, val y: Double)

enum class WaypointState(val wire: String) { CORRECT("correct"), WRONG("wrong"), CURRENT("current"), FUTURE("future") }

private val P0 = Point(6.0, 24.0)
private val P1 = Point(138.0, -6.0)
private val P2 = Point(270.0, 24.0)

private fun lerp(a: Point, b: Point, t: Double): Point = Point(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)

/** The point of the curve at t (0 to 1), rounded to hundredths. */
fun pointAt(t: Double): Point {
    val p = lerp(lerp(P0, P1, t), lerp(P1, P2, t), t)
    return Point(roundToHundredth(p.x), roundToHundredth(p.y))
}

/** Where waypoint i of n sits on the curve: evenly spread in t, the first at the start, the last at the end. */
fun waypointT(i: Int, n: Int): Double = if (n <= 1) 0.0 else i.toDouble() / (n - 1)

/** The flown part of the curve, from the start to t, as an SVG path (the curve split at t). */
fun flownPath(t: Double): String {
    val control = lerp(P0, P1, t)
    val end = pointAt(t)
    val cx = hundredthsText(roundToHundredth(control.x))
    val cy = hundredthsText(roundToHundredth(control.y))
    return "M${hundredthsText(P0.x)} ${hundredthsText(P0.y)} Q$cx $cy ${hundredthsText(end.x)} ${hundredthsText(end.y)}"
}

/** The plane's heading at t, in degrees (the direction of the curve), rounded to hundredths. */
fun headingAt(t: Double): Double {
    val dx = 2 * (1 - t) * (P1.x - P0.x) + 2 * t * (P2.x - P1.x)
    val dy = 2 * (1 - t) * (P1.y - P0.y) + 2 * t * (P2.y - P1.y)
    return roundToHundredth(StrictMath.atan2(dy, dx) * 180 / PI)
}

/** The state of every waypoint. */
fun waypointStates(total: Int, results: List<Boolean>, current: Int, answered: Boolean): List<WaypointState> =
    List(total) { i ->
        val result = results.getOrNull(i)
        when {
            result != null && (i < current || answered) -> if (result) WaypointState.CORRECT else WaypointState.WRONG
            i == current -> WaypointState.CURRENT
            else -> WaypointState.FUTURE
        }
    }

/** "card 3", "cards 1 and 2", "cards 1, 2 and 5". The list is never empty where this is called. */
fun cardList(numbers: List<Int>): String {
    if (numbers.size == 1) return "card ${numbers[0]}"
    val head = numbers.dropLast(1).joinToString(", ")
    return "cards $head and ${numbers.last()}"
}

/** The accessible label: "Card 4 of 10. Cards 1 and 2 correct, card 3 wrong." */
fun flightPathLabel(total: Int, results: List<Boolean>, current: Int): String {
    val correct = mutableListOf<Int>()
    val wrong = mutableListOf<Int>()
    results.forEachIndexed { i, result -> (if (result) correct else wrong).add(i + 1) }
    val parts = mutableListOf<String>()
    if (correct.isNotEmpty()) parts.add("${cardList(correct)} correct")
    if (wrong.isNotEmpty()) parts.add("${cardList(wrong)} wrong")
    val head = "Card ${current + 1} of $total."
    if (parts.isEmpty()) return head
    val tally = parts.joinToString(", ")
    return "$head ${tally.substring(0, 1).uppercase()}${tally.substring(1)}."
}

/** The accessible label of a finished round: "Round complete. 10 of 10 cards. 7 correct, 3 wrong: cards 3, 6 and 9." */
fun completedLabel(total: Int, results: List<Boolean>): String {
    val wrong = results.withIndex().filter { !it.value }.map { it.index + 1 }
    val correct = results.size - wrong.size
    val head = "Round complete. ${results.size} of $total cards. $correct correct, ${wrong.size} wrong"
    return if (wrong.isEmpty()) "$head." else "$head: ${cardList(wrong)}."
}

/**
 * The scale of the marks on a completed route (1 is a circle of radius 7 and a square of 13): full size up to
 * 10 cards, 6/7 up to 17, then as large as keeps neighbours apart (35% of the 264 wide route per gap).
 */
fun completedScale(cards: Int): Double {
    if (cards <= 10) return 1.0
    if (cards <= 17) return 6.0 / 7.0
    return min(6.0, (0.35 * 264) / (cards - 1)) / 7
}
```

Run the command of step 23. Expected: `BUILD SUCCESSFUL`; the `grep` on `TEST-com.eienmosu.truthy.engine.FlightPathGoldenTest.xml` prints `tests="7" skipped="0" failures="0" errors="0"`. Because step 12's tests use `cardList` and `completedLabel`, also run `(cd android/Truthy && ./gradlew :engine:test --tests 'com.eienmosu.truthy.engine.ResultCopyGoldenTest')` and expect `BUILD SUCCESSFUL`.

- [ ] **Step 25: Commit.**

```bash
git add android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/FlightPath.kt android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/FlightPathGoldenTest.kt
git commit -m "feat: port the flight path to the Android engine"
```

- [ ] **Step 26: Write the header tests and run them.** The pins are the tables of `StreakPath.test.tsx`, `StreakPath-polish.test.tsx`, `LivesPath.test.tsx` and `TimedPath.test.tsx`. A layout is a function in both languages, so a vector lists its values at probe points; the test evaluates the Kotlin function at the probes the vector names, and also checks that the probes are the ones the producer chose.

`android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/StreakPathGoldenTest.kt`:

```kotlin
package com.eienmosu.truthy.engine

import kotlinx.serialization.json.jsonObject
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.test.Test
import kotlin.math.abs

class StreakPathGoldenTest : CopyGoldenBase() {
    private val layoutFile = Golden.load("components/StreakPath", "streakLayout")
    private val labelFile = Golden.load("components/StreakPath", "streakLabel")

    @Test
    fun `the slots are 24 apart and the route ends on the ring when the best is 12`() {
        val layout = streakLayout(8, 12)
        assertEquals(listOf(6.0, 30.0, 198.0, 270.0), listOf(0, 1, 8, 11).map { pointAt(layout.t(it)).x })
        assertTrue(layout.dot == 6.0)
        assertTrue(layout.ticks)
        assertEquals(11, layout.ring)
        assertTrue(layout.target)
        assertEquals(listOf(9, 10), layout.future)

        val three = streakLayout(1, 3)
        assertEquals(listOf(0.0, 0.5, 1.0), listOf(0, 1, 2).map { three.t(it) })
        assertEquals(2, three.ring)
        assertTrue(three.target)
        assertEquals(emptyList<Int>(), three.future)
    }

    @Test
    fun `the ring slot holds the plane, and past the best the route runs on into open sky`() {
        val next = streakLayout(11, 12)
        assertTrue(next.target)
        assertEquals(emptyList<Int>(), next.future)
        assertTrue(next.t(11) == 1.0)

        val past = streakLayout(12, 12)
        assertEquals(11, past.ring)
        assertTrue(!past.target)
        assertEquals(emptyList<Int>(), past.future)
        assertTrue(past.dot == 6.0)
        assertTrue(abs(past.t(12) - 12.0 / 13.6) < 1e-5)

        val none = streakLayout(0, null)
        assertNull(none.ring)
        assertTrue(!none.target)
        assertTrue(none.dot == 6.0)
        assertTrue(none.t(0) == 0.0)
        val one = streakLayout(0, 1)
        assertEquals(0, one.ring)
        assertTrue(one.target)
        assertTrue(one.t(0) == 0.0)

        val long = streakLayout(40, 12)
        assertTrue(long.dot == 2.0)
        assertTrue(!long.ticks)
        val far = streakLayout(13, 40)
        assertTrue(far.dot == 2.1)
        assertTrue(!far.ticks)
        assertTrue(far.target)
    }

    @Test
    fun `streakLabel pins the table of StreakPath test`() {
        assertEquals("Streak of 8 correct answers. Your best on this route is 12.", streakLabel(8, 12, false))
        assertEquals("Streak of 12 correct answers, equal to your best on this route.", streakLabel(12, 12, false))
        assertEquals("Streak of 13 correct answers. New best on this route, previous best 12.", streakLabel(13, 12, false))
        assertEquals("Streak of 1 correct answer.", streakLabel(1, null, false))
        assertEquals("Streak of 0 correct answers.", streakLabel(0, null, false))
        assertEquals("Streak ended at 8. Your best on this route is 12.", streakLabel(8, 12, true))
        assertEquals("Streak ended at 12, equal to your best on this route.", streakLabel(12, 12, true))
        assertEquals("Streak ended at 13. New best on this route, previous best 12.", streakLabel(13, 12, true))
        assertEquals("Streak ended at 3.", streakLabel(3, null, true))
        assertEquals("Streak of 0 correct answers.", streakLabel(0, 0, false))
        assertEquals("Streak of 1 correct answer.", streakLabel(1, 0, false))
        assertEquals("Streak ended at 0.", streakLabel(0, 0, true))
    }

    @Test
    fun `streakLayout matches every golden case at the probe slots the vector names`() {
        assertEquals(25, layoutFile.cases.size)
        for (case in layoutFile.cases) {
            val done = case.input.field("done").count()
            val best = case.input.field("best").countOrNull()
            val layout = streakLayout(done, best)
            val slots = case.output.field("t").jsonObject.keys.map { it.toInt() }
            assertTrue(slots.size >= 3, "${case.name}: probes")
            val expectedSlots = listOf(0, 1, 2, done - 1, done, done + 1, layout.ring ?: -1).filter { it >= 0 }.distinct().sorted()
            assertEquals(expectedSlots, slots, "${case.name}: probe slots")
            val made = json(
                mapOf(
                    "dot" to layout.dot,
                    "ticks" to layout.ticks,
                    "ring" to layout.ring,
                    "target" to layout.target,
                    "future" to layout.future,
                    "t" to slots.associate { it.toString() to layout.t(it) },
                ),
            )
            assertSameJson(case.output, made, case.name)
        }
    }

    @Test
    fun `streakLabel matches every golden case`() {
        assertEquals(17, labelFile.cases.size)
        for (case in labelFile.cases) {
            val input = case.input
            assertEquals(case.output.text(), streakLabel(input.field("streak").count(), input.field("best").countOrNull(), input.field("ended").flag()), case.name)
        }
    }
}
```

That is 5 tests.

`android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/LivesPathGoldenTest.kt`:

```kotlin
package com.eienmosu.truthy.engine

import kotlinx.serialization.json.jsonObject
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.test.Test

class LivesPathGoldenTest : CopyGoldenBase() {
    private val trailFile = Golden.load("components/LivesPath", "trailLayout")
    private val labelFile = Golden.load("components/LivesPath", "livesLabel")

    private fun round(n: Int, vararg wrongOn: Int): List<Boolean> = List(n) { (it + 1) !in wrongOn }

    @Test
    fun `up to 14 marks sit 9 apart with the newest at x 219`() {
        val trail = trailLayout(14)
        assertEquals(listOf(102.0, 111.0, 219.0), listOf(0, 1, 13).map { trail.x(it) })
        assertTrue(trail.r == 2.6)
        assertTrue(trail.side == 9.0)
        assertTrue(trail.cross)
        assertTrue(trailLayout(1).x(0) == 219.0)
        assertTrue(trailLayout(3).x(0) == 201.0)
    }

    @Test
    fun `more marks are squeezed between x 100 and x 219 and a wrong square keeps its side and its x`() {
        val trail = trailLayout(20)
        assertEquals(listOf(100.0, 106.3, 219.0), listOf(0, 1, 19).map { trail.x(it) })
        assertTrue(trail.r == 2.2)
        assertTrue(trail.side == 8.0)
        assertTrue(trail.cross)
        val sixty = trailLayout(60)
        assertTrue(sixty.r == 0.9)
        assertTrue(sixty.side == 6.0)
        assertTrue(sixty.cross)
        for (marks in 15..200) {
            assertTrue(trailLayout(marks).cross, "$marks marks")
            assertTrue(trailLayout(marks).side >= 6.0, "$marks marks")
        }
    }

    @Test
    fun `livesLabel pins the table of LivesPath test`() {
        assertEquals("3 of 3 lives left. No cards answered yet.", livesLabel(round(0)))
        assertEquals("3 of 3 lives left. 1 card answered.", livesLabel(round(1)))
        assertEquals("3 of 3 lives left. 5 cards answered.", livesLabel(round(5)))
        assertEquals("2 of 3 lives left. 14 cards answered, card 6 was wrong.", livesLabel(round(14, 6)))
        assertEquals("1 of 3 lives left. 20 cards answered, cards 6 and 15 were wrong.", livesLabel(round(20, 6, 15)))
        assertEquals("No lives left. The round is over after 21 cards: cards 6, 15 and 21 were wrong.", livesLabel(round(21, 6, 15, 21)))
    }

    @Test
    fun `trailLayout matches every golden case, one for every count of marks from 0 to 200`() {
        assertEquals((0..200).toList(), trailFile.cases.map { it.input.field("marks").count() })
        for (case in trailFile.cases) {
            val marks = case.input.field("marks").count()
            val trail = trailLayout(marks)
            val probes = listOf(0, 1, 2, marks / 2, marks - 2, marks - 1).filter { it in 0 until marks }.distinct().sorted()
            val named = case.output.field("x").jsonObject.keys.map { it.toInt() }
            assertEquals(probes, named, "${case.name}: probe marks")
            val made = json(
                mapOf(
                    "r" to trail.r,
                    "side" to trail.side,
                    "cross" to trail.cross,
                    "x" to named.associate { it.toString() to trail.x(it) },
                ),
            )
            assertSameJson(case.output, made, case.name)
        }
    }

    @Test
    fun `livesLabel matches every golden case`() {
        assertEquals(10, labelFile.cases.size)
        for (case in labelFile.cases) {
            assertEquals(case.output.text(), livesLabel(case.input.field("results").list().map { it.flag() }), case.name)
        }
    }
}
```

That is 5 tests.

`android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/TimedPathGoldenTest.kt`:

```kotlin
package com.eienmosu.truthy.engine

import kotlin.test.assertEquals
import kotlin.test.Test

class TimedPathGoldenTest : CopyGoldenBase() {
    private val clockFile = Golden.load("components/TimedPath", "clockText")
    private val labelFile = Golden.load("components/TimedPath", "timedLabel")

    @Test
    fun `the clock reads whole seconds rounded up and never less than 0 00`() {
        assertEquals("1:00", clockText(60_000.0))
        assertEquals("1:00", clockText(59_999.0))
        assertEquals("0:59", clockText(59_000.0))
        assertEquals("0:41", clockText(40_001.0))
        assertEquals("0:41", clockText(41_000.0))
        assertEquals("0:01", clockText(1.0))
        assertEquals("0:00", clockText(0.0))
        assertEquals("0:02", clockText(1_001.0))
        assertEquals("0:00", clockText(-5_000.0))
        assertEquals("2:05", clockText(125_000.0))
    }

    @Test
    fun `timedLabel says the seconds left, then the cards answered at time up`() {
        assertEquals("41 seconds left of 60. 9 correct, 2 wrong.", timedLabel(41_000.0, 9, 2))
        assertEquals("60 seconds left of 60. 0 correct, 0 wrong.", timedLabel(60_000.0, 0, 0))
        assertEquals("1 second left of 60. 3 correct, 0 wrong.", timedLabel(900.0, 3, 0))
        assertEquals("Time is up. 17 cards answered: 14 correct, 3 wrong.", timedLabel(0.0, 14, 3))
        assertEquals("Time is up. 1 card answered: 1 correct, 0 wrong.", timedLabel(0.0, 1, 0))
        assertEquals("Time is up. 4 cards answered: 3 correct, 1 wrong.", timedLabel(-5.0, 3, 1))
    }

    @Test
    fun `the minute is 60 seconds`() {
        assertEquals(60, TIMED_SECONDS)
    }

    @Test
    fun `clockText matches every golden case`() {
        assertEquals(19, clockFile.cases.size)
        for (case in clockFile.cases) assertEquals(case.output.text(), clockText(case.input.field("remainingMs").number()), case.name)
    }

    @Test
    fun `timedLabel matches every golden case`() {
        assertEquals(12, labelFile.cases.size)
        for (case in labelFile.cases) {
            val input = case.input
            assertEquals(case.output.text(), timedLabel(input.field("remainingMs").number(), input.field("correct").count(), input.field("wrong").count()), case.name)
        }
    }
}
```

That is 5 tests.

```bash
(cd android/Truthy && ./gradlew :engine:test --tests 'com.eienmosu.truthy.engine.StreakPathGoldenTest' --tests 'com.eienmosu.truthy.engine.LivesPathGoldenTest' --tests 'com.eienmosu.truthy.engine.TimedPathGoldenTest')
```

Expected: FAIL, `Unresolved reference 'streakLayout'` (also `streakLabel`, `trailLayout`, `livesLabel`, `clockText`, `timedLabel`), `Execution failed for task ':engine:compileTestKotlin'`.

- [ ] **Step 27: Write the three header files, then run the tests of step 26.**

`android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/StreakPath.kt`:

```kotlin
package com.eienmosu.truthy.engine

import kotlin.math.max
import kotlin.math.min

// The header of a Streak round (components/StreakPath.tsx): one dot per correct answer along the route, the plane
// on the card on screen, and a ring where the best is.

class StreakLayout(
    /** Where slot i sits on the curve, 0 to 1. */
    val t: (Int) -> Double,
    /** Radius of a done dot. */
    val dot: Double,
    /** Done dots carry a tick (dot >= 5). */
    val ticks: Boolean,
    /** The slot of the best (best - 1), or null without a best (null or 0). */
    val ring: Int?,
    /** The ring is at or ahead of the card on screen: the route ends on it. */
    val target: Boolean,
    /** The open slots between the card on screen and the ring. */
    val future: List<Int>,
)

/** The layout for `done` dots (the card on screen is slot `done`) and the best on the route. */
fun streakLayout(done: Int, best: Int?): StreakLayout {
    val ring = if (best == null || best < 1) null else best - 1
    // The ring while the best is still ahead: the slots spread over the whole curve and the ring ends it.
    val ahead: Int? = if (ring != null && done <= ring) ring else null
    // At or past the best, or without one, the route runs on into open sky, a little short of the end.
    val step = if (ahead != null) 1.0 / max(ahead, 1) else 1.0 / (done + 1.6)
    val dot = min(6.0, roundToTenth(264 * step * 0.31))
    val future = if (ahead != null) List(max(0, ahead - done - 1)) { done + 1 + it } else emptyList()
    return StreakLayout(t = { slot -> min(1.0, slot * step) }, dot = dot, ticks = dot >= 5, ring = ring, target = ahead != null, future = future)
}

/** The accessible name of the header. A best of 0 counts as no best. */
fun streakLabel(streak: Int, best: Int?, ended: Boolean): String {
    val start = if (ended) "Streak ended at $streak" else "Streak of $streak correct ${if (streak == 1) "answer" else "answers"}"
    if (best == null || best < 1) return "$start."
    if (streak < best) return "$start. Your best on this route is $best."
    if (streak == best) return "$start, equal to your best on this route."
    return "$start. New best on this route, previous best $best."
}
```

`android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/LivesPath.kt`:

```kotlin
package com.eienmosu.truthy.engine

import kotlin.math.max
import kotlin.math.min

// The header of a Three lives round (components/LivesPath.tsx): three hearts, a mini trail with one mark per
// answered card, and the sentence that names it.

class TrailLayout(
    /** x of mark i (0 is the oldest). */
    val x: (Int) -> Double,
    /** Radius of a correct dot. */
    val r: Double,
    /** Side of a wrong square. */
    val side: Double,
    /** Wrong squares carry their x (always: the side never drops below 6). */
    val cross: Boolean,
)

/** Where the marks of the answered cards sit on the line y 17. */
fun trailLayout(marks: Int): TrailLayout {
    // Up to 14 marks: 9 apart, the newest at x 219 next to the plane (14 marks start at x 102).
    if (marks <= 14) return TrailLayout(x = { i -> (219 - 9 * (marks - 1 - i)).toDouble() }, r = 2.6, side = 9.0, cross = true)
    // More: squeezed between x 100 and x 219. A wrong square keeps a side of at least 6 with its x however long the round.
    val step = 119.0 / (marks - 1)
    val side = max(6.0, min(8.0, roundToTenth(step * 1.3)))
    return TrailLayout(x = { i -> roundToTenth(100 + i * step) }, r = min(2.2, roundToTenth(step * 0.45)), side = side, cross = true)
}

/** The accessible name of the header. */
fun livesLabel(results: List<Boolean>): String {
    val wrong = results.withIndex().filter { !it.value }.map { it.index + 1 }
    val left = max(0, LIVES - wrong.size)
    val n = results.size
    val verb = if (wrong.size == 1) "was" else "were"
    if (left == 0) return "No lives left. The round is over after $n cards: ${cardList(wrong)} $verb wrong."
    val head = "$left of $LIVES lives left."
    if (n == 0) return "$head No cards answered yet."
    val answered = "$n ${if (n == 1) "card" else "cards"} answered"
    if (wrong.isEmpty()) return "$head $answered."
    return "$head $answered, ${cardList(wrong)} $verb wrong."
}
```

`android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/TimedPath.kt` (replaces the file step 12 started):

```kotlin
package com.eienmosu.truthy.engine

import kotlin.math.ceil
import kotlin.math.max

// The header of a Timed round (components/TimedPath.tsx): the route stands for the minute.

/** The Timed minute in whole seconds (60). */
internal val TIMED_SECONDS: Int = (TIMED.roundMs / 1000.0).toInt()

private fun wholeSeconds(remainingMs: Double): Int = ceil(max(0.0, remainingMs) / 1000).toInt()

/** The clock: "1:00", "0:41", "0:00". The seconds are rounded up, so it says "0:00" only when the time is up. */
fun clockText(remainingMs: Double): String {
    val seconds = wholeSeconds(remainingMs)
    return "${seconds / 60}:${(seconds % 60).toString().padStart(2, '0')}"
}

/** The accessible name of the header. Built from the whole seconds, so it changes at most once a second. */
fun timedLabel(remainingMs: Double, correct: Int, wrong: Int): String {
    val seconds = wholeSeconds(remainingMs)
    if (seconds == 0) {
        val n = correct + wrong
        return "Time is up. $n ${if (n == 1) "card" else "cards"} answered: $correct correct, $wrong wrong."
    }
    return "$seconds ${if (seconds == 1) "second" else "seconds"} left of $TIMED_SECONDS. $correct correct, $wrong wrong."
}
```

Run the command of step 26. Expected: `BUILD SUCCESSFUL`. Then:

```bash
for name in StreakPathGoldenTest LivesPathGoldenTest TimedPathGoldenTest; do grep -o 'tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*" errors="[0-9]*"' android/Truthy/engine/build/test-results/test/TEST-com.eienmosu.truthy.engine.$name.xml; done
```

Expected three lines, each with `skipped="0" failures="0" errors="0"`, and `tests="5"`, `tests="5"`, `tests="5"` in that order.

- [ ] **Step 28: Commit.**

```bash
git add android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/StreakPath.kt android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/LivesPath.kt android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/TimedPath.kt android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/StreakPathGoldenTest.kt android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/LivesPathGoldenTest.kt android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/TimedPathGoldenTest.kt
git commit -m "feat: port the Streak, Three lives and Timed headers to the Android engine"
```

- [ ] **Step 29: Write the barcode and contrast tests and run them.** The barcode pins are those of `BoardingPass.test.tsx`. The contrast test recomputes every recorded ratio from the recorded colours, types in the ratios of DESIGN-SYSTEM.md section 2.2, and checks that the recorded colours are the colours of `native-data/tokens/resolved.json`, which is what `:tokengen` (task 8) turns into the committed `Tokens.kt`.

`android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/BarcodeGoldenTest.kt`:

```kotlin
package com.eienmosu.truthy.engine

import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.Test

class BarcodeGoldenTest : CopyGoldenBase() {
    private val file = Golden.load("components/BoardingPass", "barcodeBars")

    @Test
    fun `it starts with bars 2, 1, 1, 2 and ends with 1, 1, 2`() {
        val code = barcodeBars("A")
        assertEquals(BarcodeBar(0, 2), code.bars[0])
        assertEquals(BarcodeBar(3, 1), code.bars[1])
        assertEquals(BarcodeBar(code.width - 2, 2), code.bars.last())
        assertEquals(BarcodeBar(code.width - 4, 1), code.bars[code.bars.size - 2])
    }

    @Test
    fun `each character takes 7 bars and a gap, 2 wide for a 1 bit and 1 wide for a 0 bit`() {
        assertEquals(6 + 10 + 4, barcodeBars("A").width)
        assertEquals(6 + 20 + 4, barcodeBars("AA").width)
    }

    @Test
    fun `it is the same for the same data and different for different data`() {
        assertEquals(barcodeBars("aws-clf-c02-t2.1-06"), barcodeBars("aws-clf-c02-t2.1-06"))
        assertNotEquals(barcodeBars("aws-clf-c02-t2.1-06"), barcodeBars("aws-clf-c02-t2.1-07"))
    }

    @Test
    fun `the empty string draws the end bars right after the start bars, and only the low seven bits of the first UTF-16 unit count`() {
        assertEquals(
            Barcode(listOf(BarcodeBar(0, 2), BarcodeBar(3, 1), BarcodeBar(6, 1), BarcodeBar(8, 2)), 10),
            barcodeBars(""),
        )
        assertEquals(barcodeBars("i"), barcodeBars("é"))
        assertEquals(barcodeBars("\uD834"), barcodeBars("𝄞"))
        assertNotEquals(barcodeBars("\u0000"), barcodeBars("𝄞"))
    }

    @Test
    fun `barcodeBars matches every golden case`() {
        assertEquals(10, file.cases.size)
        for (case in file.cases) {
            val code = barcodeBars(case.input.field("data").text())
            val made = json(mapOf("bars" to code.bars.map { mapOf("x" to it.x, "width" to it.width) }, "width" to code.width))
            assertSameJson(case.output, made, case.name)
        }
    }
}
```

That is 5 tests.

`android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/ContrastGoldenTest.kt`:

```kotlin
package com.eienmosu.truthy.engine

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue
import kotlin.test.Test
import java.io.File
import kotlin.math.abs

class ContrastGoldenTest : CopyGoldenBase() {
    private val file = Golden.load("design/system/tokens", "contrastPairs")
    private val output = file.cases[0].output
    private val pairs = output.field("pairs").list()
    private val listed = output.field("listed").list()

    private val tokens: JsonObject by lazy {
        val golden = File(System.getProperty("truthy.golden") ?: throw AssertionError("the truthy.golden property is not set"))
        Json.parseToJsonElement(golden.parentFile.resolve("tokens/resolved.json").readText()).jsonObject
    }

    private fun tokenAt(path: String): JsonObject? {
        var node: JsonElement = tokens
        for (part in path.split(".")) node = (node as? JsonObject)?.get(part) ?: return null
        return node as? JsonObject
    }

    private fun hexOf(path: String, depth: Int = 0): String {
        if (depth > 8) throw AssertionError("a reference cycle at $path")
        val token = tokenAt(path) ?: throw AssertionError("the token $path does not exist")
        val value = token.getValue("\$value")
        if (value is JsonObject) return value.getValue("hex").jsonPrimitive.content
        val reference = Regex("^\\{([^{}]+)\\}\$").matchEntire(value.jsonPrimitive.content)
            ?: throw AssertionError("$path is neither a colour nor a reference")
        return hexOf(reference.groupValues[1], depth + 1)
    }

    private fun ownsNight(role: String): Boolean = tokenAt("color.night.$role") != null

    private fun colourOf(theme: String, role: String): String =
        if (theme == "night" && ownsNight(role)) hexOf("color.night.$role") else hexOf("color.day.$role")

    private fun listedRatio(theme: String, foreground: String, background: String): Double =
        listed.first {
            it.field("theme").text() == theme && it.field("foreground").text() == foreground && it.field("background").text() == background
        }.field("ratio").number()

    @Test
    fun `luminance and the contrast ratio follow WCAG 2`() {
        assertTrue(luminance("#000000") == 0.0)
        assertTrue(abs(luminance("#ffffff") - 1.0) < 1e-12)
        assertTrue(abs(contrastRatio("#000000", "#ffffff") - 21.0) < 1e-9)
        assertTrue(contrastRatio("#10233f", "#fdfbf5") == contrastRatio("#fdfbf5", "#10233f"))
        assertTrue(contrastRatio("#336699", "#336699") == 1.0)
        for (bad in listOf("#fff", "red", "#12345g", "10233f")) {
            assertFailsWith<IllegalArgumentException> { luminance(bad) }
        }
    }

    @Test
    fun `the vector holds the 27 pairs of the web test in both themes, day first, and all of them pass`() {
        assertEquals(54, pairs.size)
        assertTrue(pairs.take(27).all { it.field("theme").text() == "day" })
        assertTrue(pairs.drop(27).all { it.field("theme").text() == "night" })
        for (i in 0 until 27) {
            for (key in listOf("foreground", "background", "kind")) {
                assertEquals(pairs[i].field(key).text(), pairs[i + 27].field(key).text(), "pair $i $key")
            }
        }
        for (pair in pairs) {
            val where = "${pair.field("theme").text()} ${pair.field("foreground").text()} on ${pair.field("background").text()}"
            val minimum = pair.field("minimum").number()
            assertTrue(minimum == (if (pair.field("kind").text() == "body text") 4.5 else 3.0), "$where: minimum")
            assertTrue(pair.field("passes").flag(), "$where: passes")
            assertTrue(pair.field("ratio").number() >= minimum, "$where: ratio")
        }
        for (pair in pairs.take(27)) assertNull(pair.optional("ownsNight"), "a day pair has no ownsNight")
        for (pair in pairs.drop(27)) assertTrue(pair.field("ownsNight").flag(), "${pair.field("foreground").text()} on ${pair.field("background").text()}: ownsNight")
        val night = pairs.drop(27)
        val ink = night.first { it.field("foreground").text() == "ink" }.field("foregroundHex").text()
        val focus = night.first { it.field("foreground").text() == "focus" }.field("foregroundHex").text()
        assertEquals(ink, focus)
    }

    @Test
    fun `every recorded ratio is the WCAG ratio of its two recorded colours`() {
        for (entry in pairs + listed) {
            val where = "${entry.field("theme").text()} ${entry.field("foreground").text()} on ${entry.field("background").text()}"
            val ratio = contrastRatio(entry.field("foregroundHex").text(), entry.field("backgroundHex").text())
            assertTrue(entry.field("ratio").number() == roundToHundredth(ratio), "$where: ratio")
            val minimum = entry.optional("minimum")?.number()
            if (minimum != null) assertEquals(ratio >= minimum, entry.field("passes").flag(), "$where: passes")
        }
    }

    @Test
    fun `the ratios DESIGN-SYSTEM section 2 2 lists, and the two choices the decisions replaced`() {
        assertTrue(listedRatio("day", "ink", "surface-raised") == 15.21)
        assertTrue(listedRatio("day", "ink-muted", "sky-4") == 5.13)
        assertTrue(listedRatio("day", "on-accent", "accent") == 8.55)
        assertTrue(listedRatio("day", "ink-muted", "sky-1") == 3.78)
        assertTrue(listedRatio("day", "accent", "sky-3") == 1.56)
        val night = listOf(
            Triple("ink", "surface-raised", 10.48), Triple("ink", "surface-sunk", 11.83),
            Triple("ink-muted", "surface-raised", 5.35), Triple("ink-muted", "surface-sunk", 6.04),
            Triple("true", "surface-raised", 4.72), Triple("true", "surface-sunk", 5.33),
            Triple("false", "surface-raised", 4.94), Triple("correct", "surface-sunk", 6.24),
            Triple("correct", "surface-raised", 5.53), Triple("wrong", "surface-sunk", 5.58),
            Triple("on-dark", "true", 6.12), Triple("on-dark", "false", 6.4),
            Triple("on-dark", "ink", 13.59), Triple("on-accent", "accent", 7.79),
            Triple("ink", "sky-1", 14.2), Triple("ink-muted", "sky-1", 7.25),
            Triple("ink-muted", "sky-2", 6.76), Triple("accent", "sky-3", 7.16),
            Triple("accent", "sky-4", 6.99), Triple("ink-muted", "sky-3", 6.24),
            Triple("ink-muted", "sky-4", 6.09), Triple("rule", "surface-raised", 1.43),
        )
        assertEquals(22, night.size)
        for ((foreground, background, expected) in night) {
            assertTrue(listedRatio("night", foreground, background) == expected, "night $foreground on $background")
        }
        assertEquals(27, listed.size)
    }

    @Test
    fun `the recorded colours are the colours of the resolved tokens the generator reads`() {
        for (entry in pairs + listed) {
            val theme = entry.field("theme").text()
            for ((roleKey, hexKey) in listOf("foreground" to "foregroundHex", "background" to "backgroundHex")) {
                val role = entry.field(roleKey).text()
                assertEquals(colourOf(theme, role), entry.field(hexKey).text().lowercase(), "$theme $role")
            }
        }
        for (pair in pairs.drop(27)) {
            val expected = ownsNight(pair.field("foreground").text()) && ownsNight(pair.field("background").text())
            assertEquals(expected, pair.field("ownsNight").flag(), "${pair.field("foreground").text()} on ${pair.field("background").text()}")
        }
    }
}
```

That is 5 tests.

```bash
(cd android/Truthy && ./gradlew :engine:test --tests 'com.eienmosu.truthy.engine.BarcodeGoldenTest' --tests 'com.eienmosu.truthy.engine.ContrastGoldenTest')
```

Expected: FAIL, `Unresolved reference 'barcodeBars'` (also `Barcode`, `BarcodeBar`, `luminance`, `contrastRatio`), `Execution failed for task ':engine:compileTestKotlin'`.

- [ ] **Step 30: Write `Barcode.kt` and `Contrast.kt`, then run the tests of step 29.**

`android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/Barcode.kt`:

```kotlin
package com.eienmosu.truthy.engine

/** One bar of a barcode: x and width in barcode units (the bars are 56 tall). */
data class BarcodeBar(val x: Int, val width: Int)

/** The bars that are on, and the width of the whole code. */
data class Barcode(val bars: List<BarcodeBar>, val width: Int)

/**
 * The barcode algorithm of the design system, the same on every platform: start bars 2/1/1/2 (on, off, on,
 * off); for each character 7 bits, least significant first, bit 1 gives width 2 and bit 0 width 1, bars
 * alternating on and off starting with on, then a 1-wide gap; end bars 1/1/2 (on, off, on). The bits are
 * those of the first UTF-16 unit of the character (a letter beyond the first plane counts by its high
 * surrogate), as `charCodeAt(0)` reads it. A real pass draws the card's id.
 */
fun barcodeBars(data: String): Barcode {
    val bars = ArrayList<BarcodeBar>()
    var x = 0
    fun bar(width: Int, on: Boolean) {
        if (on) bars.add(BarcodeBar(x, width))
        x += width
    }
    bar(2, true)
    bar(1, false)
    bar(1, true)
    bar(2, false)
    var i = 0
    while (i < data.length) {
        val code = data[i].code
        for (bit in 0 until 7) bar(if (((code shr bit) and 1) == 1) 2 else 1, bit % 2 == 0)
        bar(1, false)
        i += Character.charCount(data.codePointAt(i))
    }
    bar(1, true)
    bar(1, false)
    bar(2, true)
    return Barcode(bars, x)
}
```

`android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/Contrast.kt`:

```kotlin
package com.eienmosu.truthy.engine

import kotlin.math.max
import kotlin.math.min

private val OPAQUE_COLOUR = Regex("^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})\$")

/** Relative luminance of an opaque #rrggbb colour (WCAG 2). Throws IllegalArgumentException for any other text. */
fun luminance(hex: String): Double {
    val match = OPAQUE_COLOUR.matchEntire(hex) ?: throw IllegalArgumentException("$hex is not an opaque #rrggbb colour")
    val (r, g, b) = match.groupValues.drop(1).map { part ->
        val c = part.toInt(16) / 255.0
        if (c <= 0.04045) c / 12.92 else StrictMath.pow((c + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** The WCAG 2 contrast ratio of two opaque colours, 1 to 21. */
fun contrastRatio(foreground: String, background: String): Double {
    val a = luminance(foreground)
    val b = luminance(background)
    return (max(a, b) + 0.05) / (min(a, b) + 0.05)
}
```

Run the command of step 29. Expected: `BUILD SUCCESSFUL`. Then:

```bash
for name in BarcodeGoldenTest ContrastGoldenTest; do grep -o 'tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*" errors="[0-9]*"' android/Truthy/engine/build/test-results/test/TEST-com.eienmosu.truthy.engine.$name.xml; done
```

Expected: `tests="5" skipped="0" failures="0" errors="0"` twice. If `the recorded colours are the colours of the resolved tokens` fails with a hex that differs only in case, the lowercase call is already there; a real difference means the token override file changed a colour, which reference 5.0 says it does not: stop and ask.

- [ ] **Step 31: Commit.**

```bash
git add android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/Barcode.kt android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/Contrast.kt android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/BarcodeGoldenTest.kt android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/ContrastGoldenTest.kt
git commit -m "feat: port the barcode and the contrast ratio to the Android engine"
```

- [ ] **Step 32: Make the coverage test require every golden file.** In the coverage test of task 1 change the flag from false to true. The test file is the one named `GoldenCoverageTest.kt`; the line is the one the starting-point step printed.

```bash
grep -rn "EVERY_FILE_REQUIRED" android/Truthy/engine/src/test/kotlin
```

Edit that file so the line reads exactly

```kotlin
private const val EVERY_FILE_REQUIRED = true
```

(keep whatever modifier and name the file already uses and change only `false` to `true`). Then run the coverage test:

```bash
(cd android/Truthy && ./gradlew :engine:test --tests '*GoldenCoverageTest')
```

Expected: `BUILD SUCCESSFUL`, and the report of `GoldenCoverageTest` shows the check "every golden file has a test" now enabled (`skipped="0"`). If it fails with a list of golden file names, those files have no `Golden.load("<module>", "<function>")` call with two string literals in the test sources: the list is the files that tasks 1 to 6 missed; the 34 of this task are loaded in the test classes above, so a name from this task in the list means a typo in a module or function string. Fix the string and run again. Then commit:

```bash
git add android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/GoldenCoverageTest.kt
git commit -m "test: require every golden file in the Android engine suite"
```

- [ ] **Step 33: Run the gates.**

```bash
(cd android/Truthy && ./gradlew :engine:test)
for f in android/Truthy/engine/build/test-results/test/TEST-*.xml; do grep -o 'testsuite name="[^"]*" tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*" errors="[0-9]*"' $f; done | grep -v 'failures="0" errors="0"' || echo "no failing suite"
grep -rn 'org.junit.jupiter' android/Truthy/engine/src
npx -y pnpm@10.34.0 vitest run
```

Expected: `BUILD SUCCESSFUL` for the engine tests; `no failing suite`; the `grep` for `org.junit.jupiter` prints nothing (the `:engine` tests run on JUnit 4 through `useJUnit()`, so a Jupiter test would never run while the coverage scan still counted its file as consumed); the web run passes, with the same totals as before this task (this task changes no web file). The 75 tests of this task are the 2, 3, 9, 5, 6, 3, 4, 4, 7, 7, 5, 5, 5, 5 and 5 of the fifteen test classes of steps 2 to 29, among those of tasks 1 to 5: to see this task's own total, sum `tests=` over the classes `WebMathTest`, `CopyGoldenBaseTest` and the thirteen `*GoldenTest` classes of this task.

- [ ] **Step 34: Check the hygiene scan over the tracked files.**

```bash
npx -y pnpm@10.34.0 vitest run tests/repo-hygiene.test.ts
git status --short
```

Expected: the hygiene test passes (no em dash, local path or e-mail-shaped string in any file this task wrote: Kotlin strings use `·` for the middle dot, and a labelled this or return followed by a member does not occur); `git status` prints nothing.
