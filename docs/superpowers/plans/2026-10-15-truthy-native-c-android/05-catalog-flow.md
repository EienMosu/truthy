### Task 5: Content helpers, text parts, the class table, the catalog, the start-flow steps, the list cue and the labels

Everything the start screen decides before a round begins is pure logic, and each part of it decides something the player sees: which route a stored `last` still leads to, how a card's text splits into plain and code parts, what the four classes are called and whether the class step offers them, how many decks an area holds and what its card says, which decks "Recent" lists and in which order, how much of a deck has been seen, where the six steps of the start flow lead forward and back, which remembered step can still be shown, when the list below a step fades and how far it scrolls to show a card, and two accessible names. This task ports all of it to the `:engine` module, line by line from `src/content/schema.ts`, `src/content/load.ts`, `src/content/text.ts`, `src/app-state/modes.ts`, `components/start/useCatalog.ts`, `components/start/StartFlow.tsx`, `components/start/listCue.ts`, `components/FillInPass.tsx` and `components/start/ContinueLine.tsx`, and tests it against the 31 golden files plan A task 7 writes for these functions (reference 3.9 rows content, modes, catalog, start flow, list cue, pass and continue). It also defines the two names the later tasks use for the flow's state, `Step` and `StartChoice`, which the README's interfaces mention but no earlier task creates.

**This task was not compiled during drafting.** Nothing in this file was compiled or run while the plan was written, so every Kotlin line below was checked by reading against the Kotlin standard library, kotlinx.serialization and kotlin.test documentation, never by a compiler. After the review, tasks 1 to 6 were assembled from these files and run with the Android Studio JBR against plan A's real `native-data`: this task's tests compiled and passed at its own end and in the final state of task 6 (README, Drafting record). If the compiler rejects a line, fix the line, not the test, and keep the behaviour the step states.

Builds on tasks 1 to 4 only. From task 1: the content types, `Mode`, the golden loader and its support code, the purity and coverage tests. From task 4: `Progress`, `CardHistory`, `LastRound`, `emptyProgress`, `pruneDeck`, `seenShare`. The vectors come from plan A task 7 and plan A task 9 (`native-data/golden`).

**Files:**
- Create (engine, all under `android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/`): `ClassTable.kt`, `CardText.kt`, `RouteLookup.kt`, `Catalog.kt`, `StartSteps.kt`, `ListCue.kt`, `Labels.kt`
- Create (test support): `android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/support/VectorDecoding.kt`
- Test (all under `android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/`): create `ClassTableTest.kt`, `ContentHelpersTest.kt`, `CatalogTest.kt`, `StartStepsTest.kt`, `ListCueTest.kt`, `LabelsTest.kt`

**Interfaces:**
- Consumes (from tasks 1 to 4; the README fixes the first group, the second group is assumed from the plan's description of those tasks, and step 1 checks it):

```kotlin
// fixed by the README (package com.eienmosu.truthy.engine)
@Serializable data class DeckIndex(val areas: List<IndexArea>)     // IndexArea(id, title, platforms), IndexPlatform(id, title, decks),
                                                                   // IndexDeck(id, code, title, passName: String? = null, cardCount: Int, version, hash, sections),
                                                                   // IndexSection(id, title, cardCount), all @Serializable, all fields vals
@Serializable data class DeckFile(val id: String, val hash: String, val cards: List<Card>)
@Serializable data class Route(val deckId: String, val sectionId: String)
const val WHOLE_DECK = "ALL"
enum class Mode(val wire: String) { CLASSIC("classic"), STREAK("streak"), LIVES("lives"), TIMED("timed") }
@Serializable data class CardHistory(val seen: Long, val lastCorrect: Boolean, val lastSeenAt: Double)
@Serializable data class Progress(val version: Int, val cards: Map<String, CardHistory>, val records: Map<String, Int>, val last: LastRound?)

// assumed from task 4
@Serializable data class LastRound(val route: Route, val mode: Mode, val score: Int?, val total: Int?)
fun emptyProgress(): Progress
fun pruneDeck(progress: Progress, deckId: String, cardIds: List<String>): Progress
fun seenShare(history: Map<String, CardHistory>, cardIds: List<String>): Double

// assumed from task 1 (test support, package com.eienmosu.truthy.engine, test source set: the tests of this task are in that package, so `Golden` needs no import)
object Golden { fun load(module: String, function: String): GoldenFile }          // called with two string literals, the coverage test reads them
class GoldenFile { val cases: List<GoldenCase>; fun resolved(value: JsonElement): JsonElement }   // resolved: replaces $card, $deck and $number tags
class GoldenCase { val name: String; val input: JsonElement; val output: JsonElement }
// and: the :engine tests use kotlin.test (Test, assertEquals, assertNull, assertNotNull, assertTrue, assertFailsWith) on JUnit 4 (task 1's libs.kotlin.test.junit)
object Golden { val json: Json }                                                    // allowSpecialFloatingPointValues = true
internal fun jsRound(x: Double): Double                                             // task 1, main source set: JavaScript's Math.round, exactly
```

- Produces (package `com.eienmosu.truthy.engine`; later tasks rely on every name):

```kotlin
// ClassTable.kt
data class ModeInfo(val id: Mode, val name: String, val description: String, val unit: String, val offered: Boolean)
val MODE_TABLE: List<ModeInfo>
fun unknownModeMessage(wire: String): String
fun modeInfo(mode: Mode, table: List<ModeInfo> = MODE_TABLE): ModeInfo        // throws IllegalArgumentException(unknownModeMessage(mode.wire)) when the table has no row
fun modeInfo(wire: String, table: List<ModeInfo> = MODE_TABLE): ModeInfo      // the same for a class name that may not exist
fun isOffered(mode: Mode, table: List<ModeInfo> = MODE_TABLE): Boolean
fun isOffered(wire: String, table: List<ModeInfo> = MODE_TABLE): Boolean
fun lastScoreText(mode: Mode, score: Int, total: Int): String

// CardText.kt
data class TextPart(val text: String, val code: Boolean)
fun textParts(text: String): List<TextPart>
fun plainText(text: String): String

// RouteLookup.kt
data class RouteInIndex(val area: IndexArea, val platform: IndexPlatform, val deck: IndexDeck, val section: IndexSection?)
fun deckPassName(platformTitle: String, deckTitle: String, passName: String? = null): String
fun deckPassName(platform: IndexPlatform, deck: IndexDeck): String
fun routeKey(route: Route): String
fun findRoute(index: DeckIndex, route: Route): RouteInIndex?
fun poolFor(deck: DeckFile, sectionId: String): List<Card>

// Catalog.kt
const val RECENT_LIMIT: Int = 4
data class LastScore(val score: Int, val total: Int)
data class ContinueTarget(val route: Route, val mode: Mode, val found: RouteInIndex, val lastScore: LastScore?)
data class RecentDeck(val area: IndexArea, val platform: IndexPlatform, val deck: IndexDeck, val lastSeenAt: Double)
data class PrunedProgress(val progress: Progress, val changed: Boolean)
fun deckCount(area: IndexArea): Int
fun deckCount(platform: IndexPlatform): Int
fun decksLabel(count: Int): String
fun deckOfCard(cardId: String, deckIds: Set<String>): String?
fun decksWithHistory(index: DeckIndex, progress: Progress): List<IndexDeck>
fun withoutRemovedCards(progress: Progress, cardIds: Map<String, List<String>>): PrunedProgress
fun seenPercent(progress: Progress, deckId: String, cardCount: Int, cardIds: List<String>? = null): Int
fun seenPercent(progress: Progress, deck: IndexDeck, cardIds: List<String>? = null): Int
fun continueTarget(index: DeckIndex, progress: Progress, table: List<ModeInfo> = MODE_TABLE): ContinueTarget?
fun recentDecks(index: DeckIndex, progress: Progress, limit: Int = RECENT_LIMIT): List<RecentDeck>

// StartSteps.kt
enum class Step(val number: Int) { ONE(1), TWO(2), THREE(3), FOUR(4), FIVE(5), SIX(6) }   // Step.of(number: Int): Step; compares in order (step >= Step.THREE)
const val RECENT = "recent"
enum class ChoiceKey(val wire: String) { VIA("via"), AREA_ID("areaId"), PLATFORM_ID("platformId"), DECK_ID("deckId"), SECTION_ID("sectionId"), MODE("mode") }
data class StartChoice(val via: String? = null, val areaId: String? = null, val platformId: String? = null, val deckId: String? = null, val sectionId: String? = null, val mode: Mode? = null)
val STEP_OF: Map<ChoiceKey, Step>
fun stepOf(key: ChoiceKey, choice: StartChoice): Step
fun clearFrom(choice: StartChoice, step: Step): StartChoice
fun pathTo(step: Step, hasSections: Boolean, recent: Boolean = false): List<Step>
fun previousStep(step: Step, hasSections: Boolean, recent: Boolean = false): Step
fun chosenOn(target: Step, choice: StartChoice): String?
fun canShow(index: DeckIndex, step: Step, choice: StartChoice, table: List<ModeInfo> = MODE_TABLE): Boolean

// ListCue.kt
const val FADE_PX: Double = 28.0
data class ItemSpan(val top: Double, val bottom: Double)
data class ListCue(val more: Boolean, val lift: Double)
fun listCue(viewHeight: Double, contentBottom: Double, items: List<ItemSpan>): ListCue
fun revealDelta(viewHeight: Double, item: ItemSpan, room: Double): Double

// Labels.kt
enum class PassFieldName(val wire: String, val changeWord: String) { AREA("area", "area"), PLATFORM("platform", "platform"), DECK("deck", "deck"), SECTION("section", "section"), MODE("mode", "class") }
fun changeLabel(field: PassFieldName, value: String): String
fun continueLabel(deckName: String, sectionTitle: String, modeLabel: String, lastScore: String? = null, needsConnection: Boolean = false): String
```

**Rules:**

1. **Same behaviour, different spelling.** Every function below does what its TypeScript original does, branch by branch. Where Kotlin needs a different shape, the difference is on this list and nowhere else:
   - The class table is never a global that a test changes. Functions that read it (`modeInfo`, `isOffered`, `continueTarget`, `canShow`) take it as a last parameter with the real table as the default. A golden case that closes a class carries the table it ran on as `modeTable` in its input (plan A task 7, rule 5), and the test passes that table in. A case without `modeTable` runs on `MODE_TABLE`.
   - `modeInfo` and `isOffered` also take a class name as a `String`, because two vectors ask for classes that do not exist (`"blitz"` and `""`). Both answer `{"$throws": "Unknown mode \"blitz\"."}`; the Kotlin functions throw `IllegalArgumentException` with that message.
   - `StartChoice.mode` is a `Mode?`, not a string. The one vector that stores an unknown class (`"zen"` in a `canShow` case) decodes to `mode = null` in the test, which `canShow` treats exactly as the web treats a class that is not in the table: step 6 cannot be shown.
   - `deckPassName` takes the two titles and the optional pass name, because the vector's platform and deck hold only those fields; the overload on `IndexPlatform` and `IndexDeck` is what the app calls. `seenPercent` has the same pair of forms for the same reason (the vector's deck is `{id, cardCount}`).
   - `withoutRemovedCards` does not take a store. The engine owns no storage; it returns the pruned progress and whether the number of card entries changed, and the caller saves when `changed` is true. The vector's `saved` is `changed`.
   - `decksWithHistory` is private on the web and not in reference 3.9. It is public here because the start screen's prune pass (spec 4.5: "prune every played deck when the start screen loads") needs the decks that have history to know which deck files to read. It has a plain unit test, not a vector.
2. **JavaScript rounding.** `seenPercent` rounds with `Math.round`. `kotlin.math.round` rounds half to even and `roundToInt` rounds half away from zero; both give 12 for 12.5 where the web gives 13. The function uses task 1's `jsRound` (the one port of `Math.round` in the module; `floor(x + 0.5)` is wrong where `x + 0.5` is inexact, task 1 rule 8).
3. **A stable sort with the web's comparator.** `recentDecks` sorts by `b.lastSeenAt - a.lastSeenAt`, and a difference of `0` (equal times, also `0` against `-0`) keeps catalog order. `compareByDescending` on `Double` would order `-0.0` before `0.0`; the comparator is written from the difference instead. Kotlin's `sortedWith` is stable.
4. **No time, no randomness, no storage.** The seven main files use none of what `PurityTest` (task 1) rejects.
5. **Cards are compared by id** in the tests (`poolFor`'s answer is a list of cards).

**Steps:**

- [ ] **Step 1: Check the starting point.**

```bash
git status --short
cd android/Truthy
ls engine/src/main/kotlin/com/eienmosu/truthy/engine
grep -rn "const val WHOLE_DECK\|fun emptyProgress\|fun pruneDeck\|fun seenShare\|class LastRound\|class IndexDeck\|object Golden\|fun resolved\|fun jsRound" engine/src
./gradlew :engine:test
cd ../..
node -e 'const fs=require("fs");const want={"src.content.schema.WHOLE_DECK":1,"src.content.schema.routeKey":2,"src.content.schema.deckPassName":4,"src.content.schema.findRoute":10,"src.content.load.poolFor":7,"src.content.text.textParts":15,"src.content.text.plainText":15,"src.app-state.modes.MODE_TABLE":1,"src.app-state.modes.modeInfo":6,"src.app-state.modes.isOffered":9,"src.app-state.modes.lastScoreText":10,"components.start.useCatalog.deckCount":5,"components.start.useCatalog.decksLabel":6,"components.start.useCatalog.deckOfCard":13,"components.start.useCatalog.seenPercent":20,"components.start.useCatalog.continueTarget":12,"components.start.useCatalog.recentDecks":16,"components.start.useCatalog.RECENT_LIMIT":1,"components.start.useCatalog.withoutRemovedCards":8,"components.start.StartFlow.STEP_OF":1,"components.start.StartFlow.stepOf":14,"components.start.StartFlow.clearFrom":17,"components.start.StartFlow.pathTo":30,"components.start.StartFlow.previousStep":24,"components.start.StartFlow.chosenOn":14,"components.start.StartFlow.canShow":43,"components.start.listCue.FADE_PX":1,"components.start.listCue.listCue":52,"components.start.listCue.revealDelta":12,"components.FillInPass.changeLabel":8,"components.start.ContinueLine.continueLabel":13};let bad=0;for(const [n,c] of Object.entries(want)){const p="native-data/golden/"+n+".json";const got=fs.existsSync(p)?JSON.parse(fs.readFileSync(p,"utf8")).cases.length:-1;if(got!==c){bad++;console.log(n,"expected",c,"got",got)}}console.log(bad?"MISMATCH "+bad:"all 31 files present with their case counts")'
```

Expected: `git status --short` prints nothing; the `ls` lists the engine sources (the `support` folder of the tests does not exist yet: step 2 creates it); the `grep` prints one line for each of the eight names (the `Golden` object may be defined with a different signature; read it, and if it differs from the Consumes block above, adapt the import lines and the three calls `Golden.load`, `golden.cases`, `golden.resolved` in the tests below before going on); `./gradlew :engine:test` ends with `BUILD SUCCESSFUL`; the node line prints `all 31 files present with their case counts`. If a vector file is missing or has another case count, plan A task 7 or 9 is not in place or changed: stop. If the tests use another assertion library than kotlin.test, change the imports of the six test files and nothing else.

- [ ] **Step 2: Write the test support that reads the vectors.**

`android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/support/VectorDecoding.kt`:

```kotlin
package com.eienmosu.truthy.engine.support

import com.eienmosu.truthy.engine.DeckIndex
import com.eienmosu.truthy.engine.Golden
import com.eienmosu.truthy.engine.Mode
import com.eienmosu.truthy.engine.Progress
import com.eienmosu.truthy.engine.Route
import kotlin.test.assertEquals
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.double
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

// Reading the plan A vectors of the content, class table, catalog, start flow, list cue and label functions.
// A vector holds plain JSON; these helpers turn the parts a test needs into engine values.

fun JsonElement.field(name: String): JsonElement = jsonObject.getValue(name)

/** The member of an object, or null when the key is absent or holds JSON null. */
fun JsonObject.optionalField(name: String): JsonElement? = this[name]?.takeIf { it !is JsonNull }

fun JsonObject.optionalString(name: String): String? = optionalField(name)?.jsonPrimitive?.content

fun JsonElement.asString(): String = jsonPrimitive.content

fun JsonElement.asInt(): Int = jsonPrimitive.int

fun JsonElement.asDouble(): Double = jsonPrimitive.double

fun JsonElement.asBoolean(): Boolean = jsonPrimitive.boolean

/** An output of the form {"$undefined": true}: the TypeScript function answered undefined. */
fun isUndefined(output: JsonElement): Boolean = output is JsonObject && output.containsKey("\$undefined")

/** An output of the form {"$throws": "message"}: the message, or null for any other output. */
fun thrownMessage(output: JsonElement): String? = (output as? JsonObject)?.get("\$throws")?.jsonPrimitive?.content

fun modeOrNull(wire: String): Mode? = Mode.entries.firstOrNull { it.wire == wire }

fun modeOf(wire: String): Mode = modeOrNull(wire) ?: error("no class named $wire")

// Golden.json (task 1) allows Infinity, NaN and -0, which resolved {"$number": ...} tags become; the default Json would refuse them.
fun decodeIndex(value: JsonElement): DeckIndex = Golden.json.decodeFromJsonElement(DeckIndex.serializer(), value)

fun decodeProgress(value: JsonElement): Progress = Golden.json.decodeFromJsonElement(Progress.serializer(), value)

fun decodeRoute(value: JsonElement): Route = Route(value.field("deckId").asString(), value.field("sectionId").asString())

/** A vector file keeps every case it was written with: the count is part of the contract. */
fun <T> expectCases(cases: List<T>, count: Int) {
    assertEquals(count, cases.size, "the number of cases in the vector file")
}
```

- [ ] **Step 3: Write the class table test.**

`android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/ClassTableTest.kt`:

```kotlin
package com.eienmosu.truthy.engine

import com.eienmosu.truthy.engine.support.asBoolean
import com.eienmosu.truthy.engine.support.asInt
import com.eienmosu.truthy.engine.support.asString
import com.eienmosu.truthy.engine.support.expectCases
import com.eienmosu.truthy.engine.support.field
import com.eienmosu.truthy.engine.support.modeOf
import com.eienmosu.truthy.engine.support.thrownMessage
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray

/** A class row as the vectors write it. */
fun decodeModeInfo(value: JsonElement): ModeInfo =
    ModeInfo(
        id = modeOf(value.field("id").asString()),
        name = value.field("name").asString(),
        description = value.field("description").asString(),
        unit = value.field("unit").asString(),
        offered = value.field("offered").asBoolean(),
    )

/** The table a case ran on: its `modeTable` when it closed a class, else the real table. */
fun tableOf(input: JsonElement): List<ModeInfo> =
    (input as JsonObject)["modeTable"]?.jsonArray?.map(::decodeModeInfo) ?: MODE_TABLE

class ClassTableTest {
    @Test
    fun theTableIsTheVector() {
        val golden = Golden.load("src/app-state/modes", "MODE_TABLE")
        expectCases(golden.cases, 1)
        val expected = golden.cases.single().output.jsonArray.map(::decodeModeInfo)
        assertEquals(expected, MODE_TABLE)
    }

    @Test
    fun modeInfoIsTheVector() {
        val golden = Golden.load("src/app-state/modes", "modeInfo")
        expectCases(golden.cases, 6)
        for (item in golden.cases) {
            val wire = item.input.field("mode").asString()
            val message = thrownMessage(item.output)
            if (message != null) {
                val error = assertFailsWith<IllegalArgumentException>(item.name) { modeInfo(wire) }
                assertEquals(message, error.message, item.name)
            } else {
                assertEquals(decodeModeInfo(item.output), modeInfo(wire), item.name)
                assertEquals(decodeModeInfo(item.output), modeInfo(modeOf(wire)), item.name)
            }
        }
    }

    @Test
    fun isOfferedIsTheVector() {
        val golden = Golden.load("src/app-state/modes", "isOffered")
        expectCases(golden.cases, 9)
        for (item in golden.cases) {
            val wire = item.input.field("mode").asString()
            val table = tableOf(item.input)
            val message = thrownMessage(item.output)
            if (message != null) {
                val error = assertFailsWith<IllegalArgumentException>(item.name) { isOffered(wire, table) }
                assertEquals(message, error.message, item.name)
            } else {
                assertEquals(item.output.asBoolean(), isOffered(wire, table), item.name)
                assertEquals(item.output.asBoolean(), isOffered(modeOf(wire), table), item.name)
            }
        }
    }

    @Test
    fun lastScoreTextIsTheVector() {
        val golden = Golden.load("src/app-state/modes", "lastScoreText")
        expectCases(golden.cases, 10)
        for (item in golden.cases) {
            val mode = modeOf(item.input.field("mode").asString())
            val actual = lastScoreText(mode, item.input.field("score").asInt(), item.input.field("total").asInt())
            assertEquals(item.output.asString(), actual, item.name)
        }
    }

    @Test
    fun aTableWithoutTheRowThrowsTheWebsMessage() {
        val error = assertFailsWith<IllegalArgumentException> { modeInfo(Mode.STREAK, emptyList()) }
        assertEquals("Unknown mode \"streak\".", error.message)
        assertTrue(MODE_TABLE.all { it.offered }, "the real table offers all four classes")
    }
}
```

- [ ] **Step 4: Write the content helpers test.**

`android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/ContentHelpersTest.kt`:

```kotlin
package com.eienmosu.truthy.engine

import com.eienmosu.truthy.engine.support.asBoolean
import com.eienmosu.truthy.engine.support.asString
import com.eienmosu.truthy.engine.support.decodeIndex
import com.eienmosu.truthy.engine.support.decodeRoute
import com.eienmosu.truthy.engine.support.expectCases
import com.eienmosu.truthy.engine.support.field
import com.eienmosu.truthy.engine.support.optionalString
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject

class ContentHelpersTest {
    @Test
    fun wholeDeckIsTheSectionIdThatMeansTheWholeDeck() {
        val golden = Golden.load("src/content/schema", "WHOLE_DECK")
        expectCases(golden.cases, 1)
        assertEquals(golden.cases.single().output.asString(), WHOLE_DECK)
    }

    @Test
    fun routeKeyIsTheVector() {
        val golden = Golden.load("src/content/schema", "routeKey")
        expectCases(golden.cases, 2)
        for (item in golden.cases) {
            assertEquals(item.output.asString(), routeKey(decodeRoute(item.input.field("route"))), item.name)
        }
    }

    @Test
    fun deckPassNameIsTheVector() {
        val golden = Golden.load("src/content/schema", "deckPassName")
        expectCases(golden.cases, 4)
        for (item in golden.cases) {
            val deck = item.input.field("deck").jsonObject
            val actual = deckPassName(item.input.field("platform").field("title").asString(), deck.getValue("title").asString(), deck.optionalString("passName"))
            assertEquals(item.output.asString(), actual, item.name)
        }
    }

    @Test
    fun findRouteIsTheVector() {
        val golden = Golden.load("src/content/schema", "findRoute")
        expectCases(golden.cases, 10)
        for (item in golden.cases) {
            val found = findRoute(decodeIndex(item.input.field("index")), decodeRoute(item.input.field("route")))
            if (item.output is JsonNull) {
                assertNull(found, item.name)
                continue
            }
            val actual = assertNotNull(found, item.name)
            val expected = item.output.jsonObject
            assertEquals(expected.getValue("areaId").asString(), actual.area.id, item.name)
            assertEquals(expected.getValue("platformId").asString(), actual.platform.id, item.name)
            assertEquals(expected.getValue("deckId").asString(), actual.deck.id, item.name)
            assertEquals(expected.optionalString("sectionId"), actual.section?.id, item.name)
        }
    }

    @Test
    fun poolForIsTheVector() {
        val golden = Golden.load("src/content/load", "poolFor")
        expectCases(golden.cases, 7)
        for (item in golden.cases) {
            val input = golden.resolved(item.input)
            val deck = Json.decodeFromJsonElement(DeckFile.serializer(), input.field("deck"))
            val actual = poolFor(deck, input.field("sectionId").asString())
            val expected = golden.resolved(item.output).jsonArray.map { it.field("id").asString() }
            assertEquals(expected, actual.map { it.id }, item.name)
        }
    }

    @Test
    fun textPartsIsTheVector() {
        val golden = Golden.load("src/content/text", "textParts")
        expectCases(golden.cases, 15)
        for (item in golden.cases) {
            val expected = item.output.jsonArray.map { TextPart(it.field("text").asString(), it.field("code").asBoolean()) }
            assertEquals(expected, textParts(item.input.field("text").asString()), item.name)
        }
    }

    @Test
    fun plainTextIsTheVector() {
        val golden = Golden.load("src/content/text", "plainText")
        expectCases(golden.cases, 15)
        for (item in golden.cases) {
            assertEquals(item.output.asString(), plainText(item.input.field("text").asString()), item.name)
        }
    }

    @Test
    fun partsAreCutOnUtf16UnitsLikeTheWeb() {
        val text = "Käse `ß` 😀 ende"
        assertEquals(
            listOf(TextPart("Käse ", false), TextPart("ß", true), TextPart(" 😀 ende", false)),
            textParts(text),
        )
        assertEquals("Käse ß 😀 ende", plainText(text))
    }
}
```

- [ ] **Step 5: Run the two tests and see them fail.**

```bash
cd android/Truthy
./gradlew :engine:test --tests 'com.eienmosu.truthy.engine.ClassTableTest' --tests 'com.eienmosu.truthy.engine.ContentHelpersTest'
```

Expected: `> Task :engine:compileTestKotlin FAILED` with `Unresolved reference` errors for `MODE_TABLE`, `ModeInfo`, `modeInfo`, `isOffered`, `lastScoreText`, `findRoute`, `poolFor`, `textParts`, `TextPart`, `plainText`, `routeKey` and `deckPassName` (if one of the names of Consumes is missing too, fix that first), and `BUILD FAILED`.

- [ ] **Step 6: Write the class table.**

`android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/ClassTable.kt`:

```kotlin
package com.eienmosu.truthy.engine

// The one table of classes (src/app-state/modes.ts): what the class step, the ticket, the continue line and the
// result say about each, and whether the class step offers it. The engine can play more modes than are offered:
// `offered` is the only gate between a finished mode and the player.

data class ModeInfo(
    val id: Mode,
    /** The class name: on the class card, the pass, the ticket and the continue line. */
    val name: String,
    /** What the class scores, in one sentence: on the class card and the ready pass. */
    val description: String,
    /** The unit of a best on the class card: "of 10", "in a row", "cards", "correct". */
    val unit: String,
    /** False: the class step shows it as "Not available yet" and it cannot be chosen or continued. */
    val offered: Boolean,
)

val MODE_TABLE: List<ModeInfo> =
    listOf(
        ModeInfo(Mode.CLASSIC, "Classic", "Correct answers out of 10 cards.", "of 10", true),
        ModeInfo(Mode.STREAK, "Streak", "Correct answers in a row, until the first wrong one.", "in a row", true),
        ModeInfo(Mode.LIVES, "Three lives", "Cards answered until the third wrong one.", "cards", true),
        ModeInfo(Mode.TIMED, "Timed", "Correct answers in one minute, wrong ones cost nothing.", "correct", true),
    )

/** The message of the error for a class the table does not know, as the web words it. */
fun unknownModeMessage(wire: String): String = "Unknown mode \"$wire\"."

/** The row of the mode. Throws for a mode the table does not know. */
fun modeInfo(mode: Mode, table: List<ModeInfo> = MODE_TABLE): ModeInfo =
    table.firstOrNull { it.id == mode } ?: throw IllegalArgumentException(unknownModeMessage(mode.wire))

/** The row of the class with this name. Throws for a name that is no class, or that the table does not know. */
fun modeInfo(wire: String, table: List<ModeInfo> = MODE_TABLE): ModeInfo {
    val mode = Mode.entries.firstOrNull { it.wire == wire } ?: throw IllegalArgumentException(unknownModeMessage(wire))
    return modeInfo(mode, table)
}

/** Whether the class step offers the mode. */
fun isOffered(mode: Mode, table: List<ModeInfo> = MODE_TABLE): Boolean = modeInfo(mode, table).offered

fun isOffered(wire: String, table: List<ModeInfo> = MODE_TABLE): Boolean = modeInfo(wire, table).offered

/** The score of a finished round as the continue line says it: "7 of 10", "13 in a row", "21 cards", "14 correct". */
fun lastScoreText(mode: Mode, score: Int, total: Int): String =
    if (mode == Mode.CLASSIC) "$score of $total" else "$score ${modeInfo(mode).unit}"
```

- [ ] **Step 7: Write the text parts.**

`android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/CardText.kt`:

```kotlin
package com.eienmosu.truthy.engine

// How card text marks code (src/content/text.ts). A statement or an explanation writes a code fragment between
// backticks, as Markdown does: the fragment is shown in the mono face, without its backticks. Overpass draws a
// backtick as an accent with no width over the next letter, so a backtick is never left in the sans face: one
// without a partner (or of an empty pair) is a code part of its own, shown as itself.

data class TextPart(
    val text: String,
    /** Shown in the mono face. */
    val code: Boolean,
)

// A pair of backticks around at least one character that is not a backtick (a line break counts as a character).
private val FRAGMENT = Regex("`([^`]+)`")

private fun plainParts(text: String): List<TextPart> {
    val parts = ArrayList<TextPart>()
    val run = StringBuilder()
    for (unit in text) {
        if (unit == '`') {
            if (run.isNotEmpty()) {
                parts.add(TextPart(run.toString(), false))
                run.setLength(0)
            }
            parts.add(TextPart("`", true))
        } else {
            run.append(unit)
        }
    }
    if (run.isNotEmpty()) parts.add(TextPart(run.toString(), false))
    return parts
}

/** The text in order as plain and code parts. No part is empty. */
fun textParts(text: String): List<TextPart> {
    val parts = ArrayList<TextPart>()
    var from = 0
    for (match in FRAGMENT.findAll(text)) {
        parts.addAll(plainParts(text.substring(from, match.range.first)))
        parts.add(TextPart(match.groupValues[1], true))
        from = match.range.last + 1
    }
    parts.addAll(plainParts(text.substring(from)))
    return parts
}

/** The text as it is shown, for what is read rather than seen (an announcement): code without its backticks. */
fun plainText(text: String): String = textParts(text).joinToString("") { it.text }
```

- [ ] **Step 8: Write the route lookup.**

`android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/RouteLookup.kt`:

```kotlin
package com.eienmosu.truthy.engine

// Routes, names and the pool of a route (src/content/schema.ts and src/content/load.ts).

/** Everything the index says about one route. `section` is null for the whole deck. */
data class RouteInIndex(
    val area: IndexArea,
    val platform: IndexPlatform,
    val deck: IndexDeck,
    val section: IndexSection?,
)

/**
 * The deck's name on the pass and the ticket: its own pass name when the catalog gives one, else the platform and
 * the deck title ("AWS Cloud Practitioner"). A pass name that is empty is still a pass name, as on the web.
 */
fun deckPassName(platformTitle: String, deckTitle: String, passName: String? = null): String =
    passName ?: "$platformTitle $deckTitle"

fun deckPassName(platform: IndexPlatform, deck: IndexDeck): String = deckPassName(platform.title, deck.title, deck.passName)

fun routeKey(route: Route): String = "${route.deckId}/${route.sectionId}"

/**
 * Finds a route in the index, or null when its deck or section is gone. The first deck with that id decides:
 * when it lacks the section the answer is null, whatever later platforms hold.
 */
fun findRoute(index: DeckIndex, route: Route): RouteInIndex? {
    for (area in index.areas) {
        for (platform in area.platforms) {
            val deck = platform.decks.firstOrNull { it.id == route.deckId } ?: continue
            if (route.sectionId == WHOLE_DECK) return RouteInIndex(area, platform, deck, null)
            val section = deck.sections.firstOrNull { it.id == route.sectionId }
            return if (section != null) RouteInIndex(area, platform, deck, section) else null
        }
    }
    return null
}

/** The cards a round on this route deals from. WHOLE_DECK gives every card; an unknown section gives none. */
fun poolFor(deck: DeckFile, sectionId: String): List<Card> {
    if (sectionId == WHOLE_DECK) return deck.cards.toList()
    return deck.cards.filter { it.section == sectionId }
}
```

- [ ] **Step 9: Run the two tests and see them pass.**

```bash
cd android/Truthy
./gradlew :engine:test --tests 'com.eienmosu.truthy.engine.ClassTableTest' --tests 'com.eienmosu.truthy.engine.ContentHelpersTest'
grep -ho 'tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*"' engine/build/test-results/test/TEST-com.eienmosu.truthy.engine.ClassTableTest.xml engine/build/test-results/test/TEST-com.eienmosu.truthy.engine.ContentHelpersTest.xml
```

Expected: `BUILD SUCCESSFUL`; the two result lines are `tests="5" skipped="0" failures="0"` (ClassTableTest) and `tests="8" skipped="0" failures="0"` (ContentHelpersTest). A failure message names the vector case.

- [ ] **Step 10: Commit.**

```bash
git add android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/ClassTable.kt android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/CardText.kt android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/RouteLookup.kt android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/support/VectorDecoding.kt android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/ClassTableTest.kt android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/ContentHelpersTest.kt
git commit -m "feat: port the class table, text parts and route lookup to the Kotlin engine"
```

- [ ] **Step 11: Write the catalog test.**

`android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/CatalogTest.kt`:

```kotlin
package com.eienmosu.truthy.engine

import com.eienmosu.truthy.engine.support.asBoolean
import com.eienmosu.truthy.engine.support.asDouble
import com.eienmosu.truthy.engine.support.asInt
import com.eienmosu.truthy.engine.support.asString
import com.eienmosu.truthy.engine.support.decodeIndex
import com.eienmosu.truthy.engine.support.decodeProgress
import com.eienmosu.truthy.engine.support.decodeRoute
import com.eienmosu.truthy.engine.support.expectCases
import com.eienmosu.truthy.engine.support.field
import com.eienmosu.truthy.engine.support.isUndefined
import com.eienmosu.truthy.engine.support.modeOf
import com.eienmosu.truthy.engine.support.optionalField
import com.eienmosu.truthy.engine.support.optionalString
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject

private data class RecentIds(val areaId: String, val platformId: String, val deckId: String, val lastSeenAt: Double)

private fun deckOf(id: String): IndexDeck =
    IndexDeck(id = id, code = "AAA", title = id, cardCount = 10, version = "2026-10-01", hash = "h", sections = emptyList())

private fun indexOf(vararg ids: String): DeckIndex =
    DeckIndex(
        listOf(
            IndexArea(
                id = "cloud",
                title = "Cloud",
                platforms = listOf(IndexPlatform(id = "aws", title = "AWS", decks = ids.map(::deckOf))),
            ),
        ),
    )

private fun seenAt(time: Double): CardHistory = CardHistory(seen = 1, lastCorrect = true, lastSeenAt = time)

class CatalogTest {
    @Test
    fun deckCountIsTheVector() {
        val golden = Golden.load("components/start/useCatalog", "deckCount")
        expectCases(golden.cases, 5)
        for (item in golden.cases) {
            val place = item.input.field("place")
            val actual =
                if (place.jsonObject.containsKey("platforms")) {
                    deckCount(Json.decodeFromJsonElement(IndexArea.serializer(), place))
                } else {
                    deckCount(Json.decodeFromJsonElement(IndexPlatform.serializer(), place))
                }
            assertEquals(item.output.asInt(), actual, item.name)
        }
    }

    @Test
    fun decksLabelIsTheVector() {
        val golden = Golden.load("components/start/useCatalog", "decksLabel")
        expectCases(golden.cases, 6)
        for (item in golden.cases) {
            assertEquals(item.output.asString(), decksLabel(item.input.field("count").asInt()), item.name)
        }
    }

    @Test
    fun deckOfCardIsTheVector() {
        val golden = Golden.load("components/start/useCatalog", "deckOfCard")
        expectCases(golden.cases, 13)
        for (item in golden.cases) {
            val deckIds = item.input.field("deckIds").jsonArray.map { it.asString() }.toSet()
            val actual = deckOfCard(item.input.field("cardId").asString(), deckIds)
            if (isUndefined(item.output)) {
                assertNull(actual, item.name)
            } else {
                assertEquals(item.output.asString(), actual, item.name)
            }
        }
    }

    @Test
    fun seenPercentIsTheVector() {
        val golden = Golden.load("components/start/useCatalog", "seenPercent")
        expectCases(golden.cases, 20)
        for (item in golden.cases) {
            val input = item.input.jsonObject
            val deck = input.getValue("deck")
            val cardIds = input.optionalField("cardIds")?.jsonArray?.map { it.asString() }
            val actual = seenPercent(decodeProgress(input.getValue("progress")), deck.field("id").asString(), deck.field("cardCount").asInt(), cardIds)
            assertEquals(item.output.asInt(), actual, item.name)
        }
    }

    @Test
    fun continueTargetIsTheVector() {
        val golden = Golden.load("components/start/useCatalog", "continueTarget")
        expectCases(golden.cases, 12)
        for (item in golden.cases) {
            val actual = continueTarget(decodeIndex(item.input.field("index")), decodeProgress(item.input.field("progress")), tableOf(item.input))
            if (item.output is JsonNull) {
                assertNull(actual, item.name)
                continue
            }
            val target = assertNotNull(actual, item.name)
            val expected = item.output.jsonObject
            assertEquals(decodeRoute(expected.getValue("route")), target.route, item.name)
            assertEquals(modeOf(expected.getValue("mode").asString()), target.mode, item.name)
            val found = expected.getValue("found").jsonObject
            assertEquals(found.getValue("areaId").asString(), target.found.area.id, item.name)
            assertEquals(found.getValue("platformId").asString(), target.found.platform.id, item.name)
            assertEquals(found.getValue("deckId").asString(), target.found.deck.id, item.name)
            assertEquals(found.optionalString("sectionId"), target.found.section?.id, item.name)
            val score = expected.getValue("lastScore")
            if (score is JsonNull) {
                assertNull(target.lastScore, item.name)
            } else {
                assertEquals(LastScore(score.field("score").asInt(), score.field("total").asInt()), target.lastScore, item.name)
            }
        }
    }

    @Test
    fun recentDecksIsTheVector() {
        val golden = Golden.load("components/start/useCatalog", "recentDecks")
        expectCases(golden.cases, 16)
        for (item in golden.cases) {
            val input = item.input.jsonObject
            val index = decodeIndex(input.getValue("index"))
            val progress = decodeProgress(input.getValue("progress"))
            val limit = input.optionalField("limit")?.asInt()
            val actual = if (limit == null) recentDecks(index, progress) else recentDecks(index, progress, limit)
            val expected =
                item.output.jsonArray.map {
                    RecentIds(it.field("areaId").asString(), it.field("platformId").asString(), it.field("deckId").asString(), it.field("lastSeenAt").asDouble())
                }
            assertEquals(expected, actual.map { RecentIds(it.area.id, it.platform.id, it.deck.id, it.lastSeenAt) }, item.name)
        }
    }

    @Test
    fun recentLimitIsTheVector() {
        val golden = Golden.load("components/start/useCatalog", "RECENT_LIMIT")
        expectCases(golden.cases, 1)
        assertEquals(golden.cases.single().output.asInt(), RECENT_LIMIT)
    }

    @Test
    fun withoutRemovedCardsIsTheVector() {
        val golden = Golden.load("components/start/useCatalog", "withoutRemovedCards")
        expectCases(golden.cases, 8)
        for (item in golden.cases) {
            val cardIds = item.input.field("cardIds").jsonObject.mapValues { (_, ids) -> ids.jsonArray.map { it.asString() } }
            val result = withoutRemovedCards(decodeProgress(item.input.field("progress")), cardIds)
            assertEquals(decodeProgress(item.output.field("progress")), result.progress, item.name)
            assertEquals(item.output.field("saved").asBoolean(), result.changed, item.name)
        }
    }

    @Test
    fun theShareRoundsHalfUpWhereKotlinRoundsHalfToEven() {
        fun percentOf(seen: Int, of: Int): Int {
            val cards = (0 until seen).associate { "d-$it" to seenAt(1.0) }
            return seenPercent(emptyProgress().copy(cards = cards), "d", of)
        }
        assertEquals(13, percentOf(1, 8)) // 12.5
        assertEquals(38, percentOf(3, 8)) // 37.5
        assertEquals(63, percentOf(5, 8)) // 62.5, which half to even would make 62
    }

    @Test
    fun equalTimesKeepCatalogOrderEvenForZeroAgainstNegativeZero() {
        val progress = emptyProgress().copy(cards = mapOf("a-1" to seenAt(-0.0), "b-1" to seenAt(0.0)))
        assertEquals(listOf("a", "b"), recentDecks(indexOf("a", "b"), progress).map { it.deck.id })
        assertEquals(listOf("b", "a"), recentDecks(indexOf("b", "a"), progress).map { it.deck.id })
    }

    @Test
    fun decksWithHistoryAreTheOwnersOfTheStoredCardsInCatalogOrder() {
        val index = indexOf("aws", "gcp-cdl", "gcp-cdl-pro")
        val proOnly = emptyProgress().copy(cards = mapOf("gcp-cdl-pro-1" to seenAt(1.0)))
        assertEquals(listOf("gcp-cdl-pro"), decksWithHistory(index, proOnly).map { it.id })
        val two = emptyProgress().copy(cards = mapOf("gcp-cdl-pro-1" to seenAt(1.0), "aws-3" to seenAt(2.0), "unknown-1" to seenAt(3.0)))
        assertEquals(listOf("aws", "gcp-cdl-pro"), decksWithHistory(index, two).map { it.id })
        assertEquals(emptyList(), decksWithHistory(index, emptyProgress()).map { it.id })
    }
}
```

- [ ] **Step 12: Run it and see it fail.**

```bash
cd android/Truthy
./gradlew :engine:test --tests 'com.eienmosu.truthy.engine.CatalogTest'
```

Expected: `> Task :engine:compileTestKotlin FAILED` with `Unresolved reference` errors for `deckCount`, `decksLabel`, `deckOfCard`, `seenPercent`, `continueTarget`, `LastScore`, `recentDecks`, `RECENT_LIMIT`, `withoutRemovedCards` and `decksWithHistory`, and `BUILD FAILED`.

- [ ] **Step 13: Write the catalog helpers.**

`android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/Catalog.kt`:

```kotlin
package com.eienmosu.truthy.engine

// The small pure questions the start flow asks of the deck index and the progress
// (components/start/useCatalog.ts): how many decks an area has, how much of a deck has been seen, where "Continue"
// leads, which decks "Recent" lists. Loading and storage are the app's; nothing here reads a file.

/** How many decks "Recent" lists at most: the codes of four fit one line of the area card at 320 px. */
const val RECENT_LIMIT: Int = 4

/** The score of the last round; absent when it was left before the end. */
data class LastScore(val score: Int, val total: Int)

/** Where "Continue" leads: the last route and mode, when both can still be played. */
data class ContinueTarget(
    val route: Route,
    val mode: Mode,
    val found: RouteInIndex,
    val lastScore: LastScore?,
)

/** A deck the player has played, where it sits in the catalog, and when one of its cards was last seen. */
data class RecentDeck(
    val area: IndexArea,
    val platform: IndexPlatform,
    val deck: IndexDeck,
    /** The latest lastSeenAt among the history entries of its cards. */
    val lastSeenAt: Double,
)

/** The progress with the history of removed cards dropped, and whether that changed the number of card entries. */
data class PrunedProgress(val progress: Progress, val changed: Boolean)

/** The number of decks under an area (all its platforms). */
fun deckCount(area: IndexArea): Int = area.platforms.sumOf { it.decks.size }

/** The number of decks under a platform. */
fun deckCount(platform: IndexPlatform): Int = platform.decks.size

/** "1 deck", "3 decks", or "No decks yet". */
fun decksLabel(count: Int): String {
    if (count == 0) return "No decks yet"
    return "$count ${if (count == 1) "deck" else "decks"}"
}

/**
 * The id of the deck a card belongs to, among `deckIds`: the one whose id and a dash are the card id's longest
 * prefix, so a deck whose id begins another deck's ("gcp-cdl" and "gcp-cdl-pro") never takes that deck's cards. It
 * tries the card id's prefixes that end just before a dash, longest first: one look-up per dash.
 */
fun deckOfCard(cardId: String, deckIds: Set<String>): String? {
    var dash = cardId.lastIndexOf('-')
    while (dash > 0) {
        val prefix = cardId.substring(0, dash)
        if (prefix in deckIds) return prefix
        dash = cardId.lastIndexOf('-', dash - 1)
    }
    return null
}

/**
 * The decks of the index that the player has history on (they own a card with a history entry), in catalog order.
 * The start screen reads the files of these decks to prune their history (withoutRemovedCards).
 */
fun decksWithHistory(index: DeckIndex, progress: Progress): List<IndexDeck> {
    val decks = index.areas.flatMap { area -> area.platforms.flatMap { platform -> platform.decks } }
    val deckIds = decks.mapTo(HashSet()) { it.id }
    val played = HashSet<String>()
    for (cardId in progress.cards.keys) {
        val owner = deckOfCard(cardId, deckIds)
        if (owner != null) played.add(owner)
    }
    return decks.filter { it.id in played }
}

/**
 * Drops the history of cards that are no longer in their deck (pruneDeck for each deck in `cardIds`). `changed` is
 * true when that changed the number of card entries; the caller then saves `progress`.
 */
fun withoutRemovedCards(progress: Progress, cardIds: Map<String, List<String>>): PrunedProgress {
    var pruned = progress
    for ((deckId, ids) in cardIds) pruned = pruneDeck(pruned, deckId, ids)
    return PrunedProgress(pruned, pruned.cards.size != progress.cards.size)
}

/**
 * The seen share of a deck in whole percent: of the deck's current cards, `cardIds`, the share seen at least once.
 * While those ids are unknown (null), the history entries seen at least once whose card id starts with the deck id
 * and a dash, divided by the deck's card count. Anything seen shows at least 1, so it never reads "Not started" (0)
 * by rounding; never more than 100.
 */
fun seenPercent(progress: Progress, deckId: String, cardCount: Int, cardIds: List<String>? = null): Int {
    val share: Double =
        if (cardIds != null) {
            seenShare(progress.cards, cardIds)
        } else {
            val prefix = "$deckId-"
            val seen = progress.cards.count { (id, entry) -> id.startsWith(prefix) && entry.seen > 0 }
            if (cardCount > 0) seen.toDouble() / cardCount else 0.0
        }
    if (share <= 0.0) return 0
    return minOf(100.0, maxOf(1.0, jsRound(share * 100))).toInt()
}

fun seenPercent(progress: Progress, deck: IndexDeck, cardIds: List<String>? = null): Int =
    seenPercent(progress, deck.id, deck.cardCount, cardIds)

/** Where "Continue" leads: the last route and mode, when the class is offered and the route still resolves. */
fun continueTarget(index: DeckIndex, progress: Progress, table: List<ModeInfo> = MODE_TABLE): ContinueTarget? {
    val last = progress.last ?: return null
    if (!isOffered(last.mode, table)) return null
    val found = findRoute(index, last.route) ?: return null
    val score = last.score
    val total = last.total
    val lastScore = if (score != null && total != null) LastScore(score, total) else null
    return ContinueTarget(last.route, last.mode, found, lastScore)
}

private data class Placed(val area: IndexArea, val platform: IndexPlatform, val deck: IndexDeck)

// The web sorts with `b.lastSeenAt - a.lastSeenAt`: a difference of zero, also 0 against -0, is a tie that keeps
// catalog order. compareByDescending would put -0.0 before 0.0.
private fun newestFirst(a: Double, b: Double): Int {
    val difference = b - a
    return if (difference < 0) -1 else if (difference > 0) 1 else 0
}

/**
 * The decks of the index the player has played, newest first ("Recent"). A deck counts when at least one of its cards
 * has a history entry; its time is the latest lastSeenAt among them, and equal times keep catalog order. A card
 * belongs to the deck whose id and a dash are its longest prefix (deckOfCard).
 */
fun recentDecks(index: DeckIndex, progress: Progress, limit: Int = RECENT_LIMIT): List<RecentDeck> {
    val placed = index.areas.flatMap { area -> area.platforms.flatMap { platform -> platform.decks.map { deck -> Placed(area, platform, deck) } } }
    val deckIds = placed.mapTo(HashSet()) { it.deck.id }
    val latest = HashMap<String, Double>()
    for ((cardId, entry) in progress.cards) {
        val owner = deckOfCard(cardId, deckIds) ?: continue
        latest[owner] = maxOf(latest[owner] ?: Double.NEGATIVE_INFINITY, entry.lastSeenAt)
    }
    return placed
        .mapNotNull { place ->
            val time = latest[place.deck.id]
            if (time == null) null else RecentDeck(place.area, place.platform, place.deck, time)
        }
        .sortedWith(Comparator { a, b -> newestFirst(a.lastSeenAt, b.lastSeenAt) })
        .take(limit)
}
```

- [ ] **Step 14: Run the catalog test and see it pass.**

```bash
cd android/Truthy
./gradlew :engine:test --tests 'com.eienmosu.truthy.engine.CatalogTest'
grep -ho 'tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*"' engine/build/test-results/test/TEST-com.eienmosu.truthy.engine.CatalogTest.xml
```

Expected: `BUILD SUCCESSFUL`; `tests="11" skipped="0" failures="0"`.

- [ ] **Step 15: Commit.**

```bash
git add android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/Catalog.kt android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/CatalogTest.kt
git commit -m "feat: port the start screen's catalog helpers to the Kotlin engine"
```

- [ ] **Step 16: Write the start-flow steps test.**

`android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/StartStepsTest.kt`:

```kotlin
package com.eienmosu.truthy.engine

import com.eienmosu.truthy.engine.support.asBoolean
import com.eienmosu.truthy.engine.support.asInt
import com.eienmosu.truthy.engine.support.asString
import com.eienmosu.truthy.engine.support.decodeIndex
import com.eienmosu.truthy.engine.support.expectCases
import com.eienmosu.truthy.engine.support.field
import com.eienmosu.truthy.engine.support.isUndefined
import com.eienmosu.truthy.engine.support.modeOrNull
import com.eienmosu.truthy.engine.support.optionalField
import com.eienmosu.truthy.engine.support.optionalString
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject

/**
 * A choice as the vectors write it. A class that is not in the engine's four ("zen", stored by an older or a
 * broken build) decodes to no class at all: the web's canShow looks the class up in its table and finds nothing,
 * and `mode = null` is the same finding.
 */
private fun decodeChoice(value: JsonElement): StartChoice {
    val obj = value.jsonObject
    return StartChoice(
        via = obj.optionalString("via"),
        areaId = obj.optionalString("areaId"),
        platformId = obj.optionalString("platformId"),
        deckId = obj.optionalString("deckId"),
        sectionId = obj.optionalString("sectionId"),
        mode = obj.optionalString("mode")?.let(::modeOrNull),
    )
}

private fun keyOf(wire: String): ChoiceKey = ChoiceKey.entries.first { it.wire == wire }

private fun stepsOf(value: JsonElement): List<Step> = value.jsonArray.map { Step.of(it.asInt()) }

class StartStepsTest {
    @Test
    fun stepOfTableIsTheVector() {
        val golden = Golden.load("components/start/StartFlow", "STEP_OF")
        expectCases(golden.cases, 1)
        val expected = golden.cases.single().output.jsonObject.entries.associate { (wire, step) -> wire to step.asInt() }
        val actual = STEP_OF.entries.associate { (key, step) -> key.wire to step.number }
        assertEquals(expected, actual)
    }

    @Test
    fun stepOfIsTheVector() {
        val golden = Golden.load("components/start/StartFlow", "stepOf")
        expectCases(golden.cases, 14)
        for (item in golden.cases) {
            val actual = stepOf(keyOf(item.input.field("key").asString()), decodeChoice(item.input.field("choice")))
            assertEquals(Step.of(item.output.asInt()), actual, item.name)
        }
    }

    @Test
    fun clearFromIsTheVector() {
        val golden = Golden.load("components/start/StartFlow", "clearFrom")
        expectCases(golden.cases, 17)
        for (item in golden.cases) {
            val actual = clearFrom(decodeChoice(item.input.field("choice")), Step.of(item.input.field("step").asInt()))
            assertEquals(decodeChoice(item.output), actual, item.name)
        }
    }

    @Test
    fun pathToIsTheVector() {
        val golden = Golden.load("components/start/StartFlow", "pathTo")
        expectCases(golden.cases, 30)
        for (item in golden.cases) {
            val input = item.input.jsonObject
            val step = Step.of(input.getValue("step").asInt())
            val hasSections = input.getValue("hasSections").asBoolean()
            val recent = input.optionalField("recent")?.asBoolean()
            val actual = if (recent == null) pathTo(step, hasSections) else pathTo(step, hasSections, recent)
            assertEquals(stepsOf(item.output), actual, item.name)
        }
    }

    @Test
    fun previousStepIsTheVector() {
        val golden = Golden.load("components/start/StartFlow", "previousStep")
        expectCases(golden.cases, 24)
        for (item in golden.cases) {
            val input = item.input.jsonObject
            val step = Step.of(input.getValue("step").asInt())
            val hasSections = input.getValue("hasSections").asBoolean()
            val recent = input.optionalField("recent")?.asBoolean()
            val actual = if (recent == null) previousStep(step, hasSections) else previousStep(step, hasSections, recent)
            assertEquals(Step.of(item.output.asInt()), actual, item.name)
        }
    }

    @Test
    fun chosenOnIsTheVector() {
        val golden = Golden.load("components/start/StartFlow", "chosenOn")
        expectCases(golden.cases, 14)
        for (item in golden.cases) {
            val actual = chosenOn(Step.of(item.input.field("target").asInt()), decodeChoice(item.input.field("choice")))
            if (isUndefined(item.output)) {
                assertNull(actual, item.name)
            } else {
                assertEquals(item.output.asString(), actual, item.name)
            }
        }
    }

    @Test
    fun canShowIsTheVector() {
        val golden = Golden.load("components/start/StartFlow", "canShow")
        expectCases(golden.cases, 43)
        for (item in golden.cases) {
            val actual =
                canShow(
                    decodeIndex(item.input.field("index")),
                    Step.of(item.input.field("step").asInt()),
                    decodeChoice(item.input.field("choice")),
                    tableOf(item.input),
                )
            assertEquals(item.output.asBoolean(), actual, item.name)
        }
    }

    @Test
    fun aStepIsItsNumberAndNothingElse() {
        assertEquals(listOf(1, 2, 3, 4, 5, 6), Step.entries.map { it.number })
        for (step in Step.entries) assertEquals(step, Step.of(step.number))
        assertFailsWith<IllegalArgumentException> { Step.of(0) }
        assertFailsWith<IllegalArgumentException> { Step.of(7) }
        assertTrue(Step.TWO < Step.THREE && Step.FIVE >= Step.FIVE && Step.SIX > Step.ONE)
    }

    @Test
    fun aNewChoiceHasChosenNothing() {
        assertEquals(StartChoice(), clearFrom(StartChoice(via = RECENT, areaId = "cloud", mode = Mode.TIMED), Step.ONE))
    }
}
```

- [ ] **Step 17: Run it and see it fail.**

```bash
cd android/Truthy
./gradlew :engine:test --tests 'com.eienmosu.truthy.engine.StartStepsTest'
```

Expected: `> Task :engine:compileTestKotlin FAILED` with `Unresolved reference` errors for `Step`, `StartChoice`, `ChoiceKey`, `STEP_OF`, `RECENT`, `stepOf`, `clearFrom`, `pathTo`, `previousStep`, `chosenOn` and `canShow`, and `BUILD FAILED`.

- [ ] **Step 18: Write the start-flow steps.**

`android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/StartSteps.kt`:

```kotlin
package com.eienmosu.truthy.engine

// The steps and the choices of the start flow, as pure functions (components/start/StartFlow.tsx, "the steps and
// the choices"). Step 1 is the area (or Recent), 2 the platform, 3 the deck, 4 the section, 5 the class, 6 the ready
// pass. The history entries of the web (entriesBehind and the like) have no native counterpart and are not ported.

enum class Step(val number: Int) {
    ONE(1),
    TWO(2),
    THREE(3),
    FOUR(4),
    FIVE(5),
    SIX(6),
    ;

    companion object {
        fun of(number: Int): Step =
            Step.entries.firstOrNull { it.number == number } ?: throw IllegalArgumentException("There is no step $number.")
    }
}

/** The Recent card's choice on step 1: the deck step then lists the decks played last (the recent path). */
const val RECENT = "recent"

/** The fields of a choice, with the names the vectors use. */
enum class ChoiceKey(val wire: String) {
    VIA("via"),
    AREA_ID("areaId"),
    PLATFORM_ID("platformId"),
    DECK_ID("deckId"),
    SECTION_ID("sectionId"),
    MODE("mode"),
}

/** What the player has chosen so far, as ids. `sectionId` is a section id or WHOLE_DECK. */
data class StartChoice(
    /** RECENT on the recent path: step 1 chose "Recent", and the deck step fills area, platform and deck at once. */
    val via: String? = null,
    val areaId: String? = null,
    val platformId: String? = null,
    val deckId: String? = null,
    val sectionId: String? = null,
    val mode: Mode? = null,
)

/** The step on which each choice is made on the ordinary path. */
val STEP_OF: Map<ChoiceKey, Step> =
    mapOf(
        ChoiceKey.VIA to Step.ONE,
        ChoiceKey.AREA_ID to Step.ONE,
        ChoiceKey.PLATFORM_ID to Step.TWO,
        ChoiceKey.DECK_ID to Step.THREE,
        ChoiceKey.SECTION_ID to Step.FOUR,
        ChoiceKey.MODE to Step.FIVE,
    )

/** The step on which `key` is chosen in `choice`: on the recent path the area and the platform come with the deck. */
fun stepOf(key: ChoiceKey, choice: StartChoice): Step =
    if (choice.via == RECENT && (key == ChoiceKey.AREA_ID || key == ChoiceKey.PLATFORM_ID)) Step.THREE else STEP_OF.getValue(key)

/** Keeps only the choices made before `step`: going back to a step clears it and everything after it. */
fun clearFrom(choice: StartChoice, step: Step): StartChoice {
    fun before(key: ChoiceKey): Boolean = stepOf(key, choice) < step
    return StartChoice(
        via = choice.via.takeIf { before(ChoiceKey.VIA) },
        areaId = choice.areaId.takeIf { before(ChoiceKey.AREA_ID) },
        platformId = choice.platformId.takeIf { before(ChoiceKey.PLATFORM_ID) },
        deckId = choice.deckId.takeIf { before(ChoiceKey.DECK_ID) },
        sectionId = choice.sectionId.takeIf { before(ChoiceKey.SECTION_ID) },
        mode = choice.mode.takeIf { before(ChoiceKey.MODE) },
    )
}

/**
 * The steps a player passes through up to `step`. A deck without sections has no step 4; the recent path has no
 * step 2.
 */
fun pathTo(step: Step, hasSections: Boolean, recent: Boolean = false): List<Step> {
    val all = if (hasSections) listOf(Step.ONE, Step.TWO, Step.THREE, Step.FOUR, Step.FIVE, Step.SIX) else listOf(Step.ONE, Step.TWO, Step.THREE, Step.FIVE, Step.SIX)
    return all.filter { it <= step && !(recent && it == Step.TWO) }
}

/**
 * Where Back goes from `step`: one step back on its path, so from the class step of a deck without sections to the
 * deck step.
 */
fun previousStep(step: Step, hasSections: Boolean, recent: Boolean = false): Step {
    val path = pathTo(step, hasSections, recent)
    return path.getOrNull(path.size - 2) ?: Step.ONE
}

/** The id of the card chosen on `target` in `choice`; on step 1 of the recent path, the Recent card (RECENT). */
fun chosenOn(target: Step, choice: StartChoice): String? {
    if (target == Step.ONE && choice.via == RECENT) return RECENT
    return when (target) {
        Step.ONE -> choice.areaId
        Step.TWO -> choice.platformId
        Step.THREE -> choice.deckId
        Step.FOUR -> choice.sectionId
        Step.FIVE -> choice.mode?.wire
        Step.SIX -> null
    }
}

/**
 * True when every choice needed to show `step` exists in the index (a remembered choice may not). The area is looked
 * up in the index, the platform only inside that area, the deck only inside that platform, the section as WHOLE_DECK
 * or an existing section of that deck, and the class only when `table` offers it.
 */
fun canShow(index: DeckIndex, step: Step, choice: StartChoice, table: List<ModeInfo> = MODE_TABLE): Boolean {
    val area = index.areas.firstOrNull { it.id == choice.areaId }
    val platform = area?.platforms?.firstOrNull { it.id == choice.platformId }
    val deck = platform?.decks?.firstOrNull { it.id == choice.deckId }
    val hasSection = deck != null && (choice.sectionId == WHOLE_DECK || deck.sections.any { it.id == choice.sectionId })
    val hasMode = table.any { it.id == choice.mode && it.offered }
    val recent = choice.via == RECENT
    if (recent && step == Step.TWO) return false // the recent path has no platform step
    // The recent decks' step needs no area or platform: each of its decks brings its own.
    val placed = !(recent && step == Step.THREE)
    if (step >= Step.TWO && placed && area == null) return false
    if (step >= Step.THREE && placed && platform == null) return false
    if (step >= Step.FOUR && deck == null) return false
    if (step == Step.FOUR && deck != null && deck.sections.isEmpty()) return false
    if (step >= Step.FIVE && !hasSection) return false
    if (step >= Step.SIX && !hasMode) return false
    return true
}
```

- [ ] **Step 19: Run the steps test and see it pass.**

```bash
cd android/Truthy
./gradlew :engine:test --tests 'com.eienmosu.truthy.engine.StartStepsTest'
grep -ho 'tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*"' engine/build/test-results/test/TEST-com.eienmosu.truthy.engine.StartStepsTest.xml
```

Expected: `BUILD SUCCESSFUL`; `tests="9" skipped="0" failures="0"`.

- [ ] **Step 20: Commit.**

```bash
git add android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/StartSteps.kt android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/StartStepsTest.kt
git commit -m "feat: port the start flow's step helpers to the Kotlin engine"
```

- [ ] **Step 21: Write the list cue test.**

`android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/ListCueTest.kt`:

```kotlin
package com.eienmosu.truthy.engine

import com.eienmosu.truthy.engine.support.asBoolean
import com.eienmosu.truthy.engine.support.asDouble
import com.eienmosu.truthy.engine.support.expectCases
import com.eienmosu.truthy.engine.support.field
import kotlin.math.abs
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.jsonArray

private fun decodeSpan(value: JsonElement): ItemSpan = ItemSpan(value.field("top").asDouble(), value.field("bottom").asDouble())

/** `count` cards of `height` with `gap` between them, the first at `first`, minus how far the list has scrolled. */
private fun cards(count: Int, height: Double, gap: Double, first: Double, scrollTop: Double = 0.0): List<ItemSpan> =
    (0 until count).map { i ->
        val top = first + i * (height + gap) - scrollTop
        ItemSpan(top, top + height)
    }

class ListCueTest {
    @Test
    fun theFadeLengthIsTheVector() {
        val golden = Golden.load("components/start/listCue", "FADE_PX")
        expectCases(golden.cases, 1)
        assertEquals(golden.cases.single().output.asDouble(), FADE_PX)
    }

    @Test
    fun listCueIsTheVector() {
        val golden = Golden.load("components/start/listCue", "listCue")
        expectCases(golden.cases, 52)
        for (item in golden.cases) {
            val actual =
                listCue(
                    item.input.field("viewHeight").asDouble(),
                    item.input.field("contentBottom").asDouble(),
                    item.input.field("items").jsonArray.map(::decodeSpan),
                )
            assertEquals(item.output.field("more").asBoolean(), actual.more, item.name)
            assertEquals(item.output.field("lift").asDouble(), actual.lift, item.name)
        }
    }

    @Test
    fun revealDeltaIsTheVector() {
        val golden = Golden.load("components/start/listCue", "revealDelta")
        expectCases(golden.cases, 12)
        for (item in golden.cases) {
            val actual = revealDelta(item.input.field("viewHeight").asDouble(), decodeSpan(item.input.field("item")), item.input.field("room").asDouble())
            assertEquals(item.output.asDouble(), actual, item.name)
        }
    }

    @Test
    fun theEndOfTheFadeMovesWithoutAJumpAsTheListScrolls() {
        // The web's own test: nine cards scrolled one pixel at a time from 0 to 300; the end of the fade moves at most 2 px per pixel.
        var previous: Double? = null
        for (scrollTop in 0..300) {
            val nine = cards(9, 90.0, 12.0, 6.0, scrollTop.toDouble())
            val end = 518.0 - listCue(518.0, nine.last().bottom, nine).lift
            val before = previous
            if (before != null) assertTrue(abs(end - before) <= 2.0, "the fade end jumped at scroll $scrollTop")
            previous = end
        }
    }
}
```

- [ ] **Step 22: Write the labels test.**

`android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/LabelsTest.kt`:

```kotlin
package com.eienmosu.truthy.engine

import com.eienmosu.truthy.engine.support.asBoolean
import com.eienmosu.truthy.engine.support.asString
import com.eienmosu.truthy.engine.support.expectCases
import com.eienmosu.truthy.engine.support.field
import com.eienmosu.truthy.engine.support.optionalField
import com.eienmosu.truthy.engine.support.optionalString
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlinx.serialization.json.jsonObject

class LabelsTest {
    @Test
    fun changeLabelIsTheVector() {
        val golden = Golden.load("components/FillInPass", "changeLabel")
        expectCases(golden.cases, 8)
        for (item in golden.cases) {
            val wire = item.input.field("field").asString()
            val field = PassFieldName.entries.first { it.wire == wire }
            assertEquals(item.output.asString(), changeLabel(field, item.input.field("value").asString()), item.name)
        }
    }

    @Test
    fun continueLabelIsTheVector() {
        val golden = Golden.load("components/start/ContinueLine", "continueLabel")
        expectCases(golden.cases, 13)
        for (item in golden.cases) {
            val props = item.input.field("props").jsonObject
            val needsConnection = props.optionalField("needsConnection")?.asBoolean()
            val actual =
                if (needsConnection == null) {
                    continueLabel(props.getValue("deckName").asString(), props.getValue("sectionTitle").asString(), props.getValue("modeLabel").asString(), props.optionalString("lastScore"))
                } else {
                    continueLabel(props.getValue("deckName").asString(), props.getValue("sectionTitle").asString(), props.getValue("modeLabel").asString(), props.optionalString("lastScore"), needsConnection)
                }
            assertEquals(item.output.asString(), actual, item.name)
        }
    }

    @Test
    fun theClassFieldIsCalledClassOnTheLabel() {
        assertEquals("Change class, now Three lives", changeLabel(PassFieldName.MODE, "Three lives"))
        assertEquals("Change section, now Whole deck", changeLabel(PassFieldName.SECTION, "Whole deck"))
    }
}
```

- [ ] **Step 23: Run both and see them fail.**

```bash
cd android/Truthy
./gradlew :engine:test --tests 'com.eienmosu.truthy.engine.ListCueTest' --tests 'com.eienmosu.truthy.engine.LabelsTest'
```

Expected: `> Task :engine:compileTestKotlin FAILED` with `Unresolved reference` errors for `ItemSpan`, `FADE_PX`, `listCue`, `revealDelta`, `PassFieldName`, `changeLabel` and `continueLabel`, and `BUILD FAILED`.

- [ ] **Step 24: Write the list cue.**

`android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/ListCue.kt`:

```kotlin
package com.eienmosu.truthy.engine

// The cue that a step's list goes on below the fold (components/start/listCue.ts): while more content lies below
// what the list shows, its bottom edge fades out over 28. A fade only shows where it lies over a card: where the
// fold falls in the gap between two cards, or shows only a sliver of the next one, a fade at the very edge would lie
// over sky and show nothing. The fade then ends a little higher, on the card above, which dissolves into the sky.
// All lengths are in one unit (dp on Android); the functions only compare and subtract them.

/** The length of the fade, as at the bottom of the missed-cards list. */
const val FADE_PX: Double = 28.0

/** A card of the list, measured from the top of the list's view (they move up as the list scrolls). */
data class ItemSpan(val top: Double, val bottom: Double)

data class ListCue(
    /** Content runs on below the view. */
    val more: Boolean,
    /** How far above the bottom of the view the fade ends, so that it lies over a card (0: at the edge). */
    val lift: Double,
)

/**
 * The cue for a list whose view is `viewHeight` tall, whose content ends at `contentBottom` and whose cards are
 * `items`, all measured from the top of the view; one unit is allowed for rounding.
 *   - The fold cuts a card that shows 28 or more: the fade ends at the edge.
 *   - The fold lies in a gap: the fade ends at the bottom of the card above it.
 *   - The fold shows less than 28 of a card: in between, so the end of the fade moves with the scroll and never
 *     jumps (at 0 shown it is at the bottom of the card above, at 28 at the edge).
 */
fun listCue(viewHeight: Double, contentBottom: Double, items: List<ItemSpan>): ListCue {
    if (contentBottom <= viewHeight + 1) return ListCue(false, 0.0)
    val at = items.indexOfFirst { it.bottom > viewHeight + 1 }
    val cut = items.getOrNull(at) ?: return ListCue(true, 0.0)
    val above = items.getOrNull(at - 1)?.bottom ?: minOf(cut.top, viewHeight)
    val shown = viewHeight - cut.top
    if (shown <= 0) return ListCue(true, maxOf(0.0, viewHeight - above))
    if (shown >= FADE_PX) return ListCue(true, 0.0)
    return ListCue(true, maxOf(0.0, viewHeight - above) * (1 - shown / FADE_PX))
}

/**
 * How far to scroll a list so that a card at `item` (measured from the top of the list's view) shows whole in a view
 * `viewHeight` tall, with `room` around it for its focus ring and, below it, room for the fade (FADE_PX): positive
 * scrolls down, negative up, 0 when it already shows. Nearest edge first: a card taller than the view shows its top.
 */
fun revealDelta(viewHeight: Double, item: ItemSpan, room: Double): Double {
    val top = item.top - room
    val bottom = item.bottom + room + FADE_PX
    if (top < 0) return top
    if (bottom > viewHeight) return minOf(bottom - viewHeight, top)
    return 0.0
}
```

- [ ] **Step 25: Write the labels.**

`android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/Labels.kt`:

```kotlin
package com.eienmosu.truthy.engine

// The accessible names of the pass fields and the continue line (components/FillInPass.tsx and
// components/start/ContinueLine.tsx). Both read as the web words them; reference 4.5 lists the copy.

/** The five fields of the fill-in pass, with the word the "Change" label uses for each. */
enum class PassFieldName(val wire: String, val changeWord: String) {
    AREA("area", "area"),
    PLATFORM("platform", "platform"),
    DECK("deck", "deck"),
    SECTION("section", "section"),
    MODE("mode", "class"),
}

/** "Change deck, now CLF": the accessible name of a field that returns to its step. */
fun changeLabel(field: PassFieldName, value: String): String = "Change ${field.changeWord}, now $value"

/**
 * "Continue: AWS Cloud Practitioner, Security and compliance, Classic. Last score 7 of 10.", or, when the deck cannot
 * be played now, "Continue: AWS Cloud Practitioner, Security and compliance, Classic, needs a connection." An empty
 * last score counts as none. The app plays embedded decks and never passes `needsConnection`; it is here because the
 * vectors pin the sentence.
 */
fun continueLabel(
    deckName: String,
    sectionTitle: String,
    modeLabel: String,
    lastScore: String? = null,
    needsConnection: Boolean = false,
): String {
    if (needsConnection) return "Continue: ${deckName}, ${sectionTitle}, ${modeLabel}, needs a connection."
    val score = if (lastScore.isNullOrEmpty()) "" else " Last score ${lastScore}."
    return "Continue: ${deckName}, ${sectionTitle}, ${modeLabel}.${score}"
}
```

- [ ] **Step 26: Run both and see them pass.**

```bash
cd android/Truthy
./gradlew :engine:test --tests 'com.eienmosu.truthy.engine.ListCueTest' --tests 'com.eienmosu.truthy.engine.LabelsTest'
grep -ho 'tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*"' engine/build/test-results/test/TEST-com.eienmosu.truthy.engine.ListCueTest.xml engine/build/test-results/test/TEST-com.eienmosu.truthy.engine.LabelsTest.xml
```

Expected: `BUILD SUCCESSFUL`; the two result lines are `tests="4" skipped="0" failures="0"` (ListCueTest) and `tests="3" skipped="0" failures="0"` (LabelsTest).

- [ ] **Step 27: Commit.**

```bash
git add android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/ListCue.kt android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/Labels.kt android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/ListCueTest.kt android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/LabelsTest.kt
git commit -m "feat: port the list cue and the pass and continue labels to the Kotlin engine"
```

- [ ] **Step 28: Run the whole engine suite, the purity and coverage tests included.**

```bash
cd android/Truthy
./gradlew :engine:test
for t in ClassTableTest ContentHelpersTest CatalogTest StartStepsTest ListCueTest LabelsTest; do grep -ho 'tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*"' engine/build/test-results/test/TEST-com.eienmosu.truthy.engine.$t.xml; done
```

Expected: `BUILD SUCCESSFUL`, with the purity test of task 1 passing over the seven new main files (they use no clock, random generator, timer, coroutine, storage or `android` import) and the coverage test of task 1 passing: every `Golden.load` call in the six new test files names a file that exists. The six result lines show `tests="5"`, `"8"`, `"11"`, `"9"`, `"4"` and `"3"`, each with `skipped="0" failures="0"`, 40 tests in all. If the purity test names a new file, remove the construct it names (a comment that quotes a forbidden word counts) and keep the behaviour.

- [ ] **Step 29: Run the web's hygiene test over the new files.**

```bash
cd ../..
npx -y pnpm@10.34.0 vitest run tests/repo-hygiene.test.ts
```

Expected: `Test Files  1 passed (1)`. The new Kotlin files hold no absolute path, no e-mail-shaped string, no em dash. If it names a line, fix the line in the file and amend this task's last commit.

