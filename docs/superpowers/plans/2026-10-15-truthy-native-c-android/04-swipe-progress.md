### Task 4: Swipe interpretation and the progress rules, with partial reads and the unreadable side copy

This task ports two web modules into the `:engine` module, line by line: `src/input/swipe.ts` (which turns the samples of one drag into True, False or cancel) and `src/progress/progress.ts` with its store `src/progress/local.ts` (card history, records, the last route, pruning, the seen share, reading a stored value part by part, and the rule that keeps a value that did not read back whole under a side key before writing over it). They belong together because they are the last pure rules that decide what the player's answers do. The round screen (task 13) feeds `interpret` with pointer samples. The file store (task 9) runs `createLocalStore` over two files, so the Android app keeps the web's side-copy decision exactly, including its failure rules.

Three port traps decide the shape of the code:
- **Reading.** kotlinx-serialization's `Json.parseToJsonElement` is looser than `JSON.parse` (it takes unquoted literals such as `NaN`, `undefined` or `01` as primitives), and a JSON reader that rejects `1e999` would throw away a whole stored value where the web drops only the entry that holds it. So the engine reads stored JSON with a small strict parser of its own that gives `JSON.parse`'s results.
- **Writing.** kotlinx's encoder leaves out properties that have default values, prints `1790000000000.0` as `1.79E12` and writes enum names (`CLASSIC`). The web reads a stored value with no `last` key as not whole, so a file written without it would be copied aside again on every later save. So the engine writes the stored JSON with its own writer, `progressJson`, in `JSON.stringify`'s shape: every key present, `null` for a missing `last`, `score` or `total`, whole numbers as integers.
- **Counts.** zod accepts any safe integer up to 2^53 - 1. `CardHistory.seen` is a `Long` (task 1), so every stored `seen` reads as the web reads it; the records, `score` and `total` are `Int` (README). Decision D1 under **Rules** says what the port does with a stored record, score or total it cannot hold.

**This task was not compiled during drafting.** Nothing in this file was compiled or run while the plan was written, so no line of Kotlin below went through `kotlinc` then. After the review, tasks 1 to 6 were assembled from these files and run with the Android Studio JBR against plan A's real `native-data`: this task's tests compiled and passed at its own end and in the final state of task 6 (README, Drafting record). The code was written against the current Kotlin and kotlinx-serialization APIs and mirrors plan B's task 4, whose Swift equivalent was run against plan A's draft vectors. If a step's actual output differs from the stated one, stop and find out why before going on.

Builds on task 1 (the content and play types, the golden loader, the purity test, the `:engine` Gradle setup). It uses nothing from tasks 2 and 3. `applyResult` takes a `RoundResult` (task 1's type), and the golden cases that come from the round engine carry the summarised result as data.

**Files:**
- Create (all under `android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/`): `Swipe.kt`, `Progress.kt`, `JsonValue.kt`, `ProgressRead.kt`, `LocalStore.kt`
- Test, create (all under `android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/`): `GoldenDecode.kt`, `SwipeTest.kt`, `SwipeGoldenTest.kt`, `ProgressFixtures.kt`, `ProgressGolden.kt`, `ProgressTest.kt`, `ProgressGoldenTest.kt`, `ProgressReadTest.kt`, `ProgressReadGoldenTest.kt`, `LocalStoreTest.kt`, `LocalStoreGoldenTest.kt`
- Reads (plan A's output, never edited): 16 files in `native-data/golden/`: `src.input.swipe.intent.json`, `src.input.swipe.canStart.json`, `src.input.swipe.interpret.json`, `src.input.swipe.SWIPE.json`; `src.progress.progress.emptyProgress.json`, `.recordKey.json`, `.bestFor.json`, `.compareWithBest.json`, `.applyResult.json`, `.pruneDeck.json`, `.seenShare.json`, `.readProgress.json`, `.parseProgress.json`; `src.progress.local.PROGRESS_KEY.json`, `src.progress.local.UNREADABLE_KEY.json`, `src.progress.local.createLocalStore.json`

**Interfaces:**
- Consumes, from task 1 (`:engine`, package `com.eienmosu.truthy.engine`), as the README fixes them:
  - `Route(deckId: String, sectionId: String)`, `WHOLE_DECK`, `Mode` with `wire` (`Mode.CLASSIC.wire == "classic"`), `CardHistory(seen: Long, lastCorrect: Boolean, lastSeenAt: Double)`, `typealias History = Map<String, CardHistory>`, `Card` (`@Serializable` in the web's JSON shape), `Answered(card, given, correct, at)`, `RoundResult(mode, route, score, total, answers, missed, abandoned)`.
  - The kotlinx-serialization compiler plugin and `kotlinx-serialization-json` on the `:engine` main and test classpaths (task 1 needs them for `Card`), and `kotlin-test-junit` on the test classpath (task 1's `libs.kotlin.test.junit`), so `kotlin.test.Test` and `kotlin.test.assertEquals` run on JUnit 4.
- Consumes, from task 1's test source set (the golden loader). The README names the loader but not its API; these are the obvious names, listed again under "Assumed from other tasks" in the report:
  - `Golden.load(module: String, function: String): GoldenFile` reads `native-data/golden/<module with / replaced by .>.<function>.json` from the directory in the system property `truthy.golden`. `module` is the web path, for example `"src/input/swipe"`.
  - `GoldenFile.cases: List<GoldenCase>`; `GoldenCase.name: String`, `GoldenCase.input: JsonElement`, `GoldenCase.output: JsonElement` (kotlinx `JsonElement`, as the file holds them, tags not yet resolved).
  - `GoldenFile.card(ref: JsonElement): Card` resolves `{"$card": id}` through the file's card table.
  - Every `Golden.load` call in this task's tests is two string literals, `Golden.load("src/input/swipe", "intent")` and so on (task 1's coverage scan reads the calls; a module passed through a variable would leave all 16 files counted as untested).
  - If task 1 names these differently, change only the calls to `Golden.load` and `file.card` in this task's test files; every other decoding goes through this task's own `GoldenDecode`.
- Consumes, from plan A (task 7 of plan A writes it), the script format of `src.progress.local.createLocalStore.json`:
  - `input` is `{"storage": {"items": {key: string}} | null, "steps": [...]}`.
  - The steps are `{"op": "load"}`, `{"op": "save", "progress": P}`, `{"op": "resave"}` (that is `save(load())`), `{"op": "put", "key": k, "value": v}` (written straight into the storage), `{"op": "breakGet"}` (every later `getItem` throws) and `{"op": "breakSet", "keys": [k...] | "all"}` (every later `setItem` of those keys throws).
  - `output` is `{"loads": [P...], "items": {key: string} | null}`.
  - If plan A's committed file uses other names, stop and report: the runner in step 22 must follow the committed format.
- Produces (`:engine`, package `com.eienmosu.truthy.engine`, public; the names later tasks rely on):

```kotlin
// Swipe.kt
data class SwipeConstants(val commitPx: Double, val flingPx: Double, val flingVelocity: Double, val settleMs: Double, val edgePx: Double)
val SWIPE: SwipeConstants                                   // 90, 40, 0.5 (dp per ms), 250 (ms), 24
data class SwipeSample(val x: Double, val y: Double, val t: Double)
data class SwipeContext(val viewportWidth: Double, val cardShownAt: Double)
enum class SwipeOutcome(val wire: String) { TRUE("true"), FALSE("false"), CANCEL("cancel") }
fun intent(dx: Double): Double                              // -1 .. 1 for the drag preview
fun canStart(sample: SwipeSample, context: SwipeContext): Boolean
fun interpret(samples: List<SwipeSample>, context: SwipeContext): SwipeOutcome

// Progress.kt
@Serializable data class LastRound(val route: Route, val mode: Mode, val score: Int?, val total: Int?)
@Serializable data class Progress(val version: Int, val cards: Map<String, CardHistory>, val records: Map<String, Int>, val last: LastRound?)
fun emptyProgress(): Progress
fun recordKey(route: Route, mode: Mode): String             // "aws-clf-c02/SEC#classic"
fun bestFor(progress: Progress, route: Route, mode: Mode): Int?
sealed interface Comparison { val kind: String; data object First; data class NewBest(val previousBest: Int); data class Equal(val best: Int); data class Short(val best: Int, val by: Int) }
fun compareWithBest(score: Int, previousBest: Int?): Comparison
data class ApplyOutcome(val progress: Progress, val previousBest: Int?, val isNewBest: Boolean)
fun applyResult(progress: Progress, result: RoundResult): ApplyOutcome
fun pruneDeck(progress: Progress, deckId: String, cardIds: List<String>): Progress
fun seenShare(history: History, cardIds: List<String>): Double
fun progressJson(progress: Progress): String                // JSON.stringify(progress), the web's text

// ProgressRead.kt (JsonValue.kt holds the internal parser it uses)
data class ReadResult(val progress: Progress, val whole: Boolean)
fun readProgress(raw: String?): ReadResult
fun parseProgress(raw: String?): Progress

// LocalStore.kt
const val PROGRESS_KEY: String                              // "truthy.progress.v1"
const val UNREADABLE_KEY: String                            // "truthy.progress.v1.unreadable"
interface KeyValueStorage { fun getItem(key: String): String?; fun setItem(key: String, value: String) }
class LocalStore { fun load(): Progress; fun save(progress: Progress) }
fun createLocalStore(storage: KeyValueStorage?): LocalStore
fun keepUnreadable(storage: KeyValueStorage)                // the side-copy decision, run first by every save
```

  - Internal, used by this task's tests: `sealed interface JsonValue` (`Null`, `Bool`, `Num`, `Str`, `Arr`, `Obj`) and `fun parseJson(text: String): JsonValue?`.
  - Test helpers this task adds to the `:engine` test source set, which later tasks may use: `object GoldenDecode` (`field`, `isNull`, `number`, `int`, `long`, `optionalInt`, `string`, `bool`, `strings`), `object ProgressGolden` (`route`, `mode`, `history`, `progress`, `comparison`, `answered`, `roundResult`, `exactly`) and `object ProgressFixtures` (`card(id)`).
  - What later tasks must know:
    - Task 9's `FileProgressStore` backs a `KeyValueStorage` with files, key `K` to the file `K.json` in its directory: `truthy.progress.v1.json` and `truthy.progress.v1.unreadable.json`. The storage writes through `AtomicFile` and throws on any failure, and `getItem` returns null only when the file does not exist. Its `load` and `save` call `createLocalStore(storage).load()` and `.save(progress)` from its single writer. It needs no rule of its own for the side copy, and it never encodes `Progress` with kotlinx `Json`: `progressJson` is the only writer of stored progress.
    - Task 13 passes `interpret` the samples of one gesture: window coordinates in dp (pixels divided by the density), `t` the `PointerInputChange.uptimeMillis` of each change as a `Double`, `viewportWidth` the window width in dp. `intent`, `interpret` and the threshold haptic take dx alone, without the offset of a card caught while it springs back (spec 5.3).
    - Task 6's result copy and task 14 switch over `Comparison`. Its TypeScript kinds `first`, `new-best`, `equal`, `short` are `Comparison.First`, `NewBest`, `Equal`, `Short`, and each carries its TypeScript string in `kind`.

**Rules:**

1. **Swipe, as `swipe.ts`** (reference 3.4). The numbers are dp and milliseconds, the same as the web's CSS px and ms. `interpret` applies its rules in this order:
   1. Fewer than 2 samples: cancel.
   2. The first sample must pass `canStart`: `t - cardShownAt >= 250`, and `24 <= x <= viewportWidth - 24`, both ends inclusive.
   3. `dx == 0.0`: cancel (`-0.0` too, as `-0 === 0` on the web; a statically typed `Double` compares by IEEE 754 in Kotlin).
   4. `|dy| > |dx|`: cancel. An exact diagonal passes.
   5. `|dx| >= 90`: commit to the side of dx.
   6. Otherwise commit only when `|dx| >= 40` and the velocity towards that side is at least 0.5. The velocity is measured from the oldest earlier sample with `last.t - t <= 80` (a sample at exactly 80 ms counts), and a `dt` of 0 or less means 0.

   `INTENT_FULL_PX` (110) and `VELOCITY_WINDOW_MS` (80) stay private, as they are unexported on the web; the golden boundary tables pin them. `intent` is `min(1, max(-1, dx / 110))` with `kotlin.math.min` and `max`, which follow `Math.min` and `Math.max` on signed zeros and NaN; it is compared bit for bit with the web.
2. **Progress, as `progress.ts`** (reference 3.5):
   - A first finished round sets the record, even with score 0. Only a strictly higher score replaces a record.
   - An abandoned round writes the card history and `last` (with score and total null) and never touches the records.
   - `last` is replaced by every applied round.
   - A card answered twice in one round counts twice and keeps the later verdict and time.
   - `pruneDeck` drops a card's history when its id starts with `"<deckId>-"` (the plain prefix, so pruning `gcp-cdl` also drops an unlisted `gcp-cdl-pro-1`) and the id is not among the deck's current ids. Kotlin's `startsWith` compares UTF-16 code units, as JavaScript's does. Records and `last` are kept.
   - Every function returns new maps and never changes its inputs.
3. **The stored JSON text, `progressJson`.**
   - Keys in the web's order: `version`, `cards`, `records`, `last`; in `last`: `route` (`deckId`, `sectionId`), `mode`, `score`, `total`. A null `last`, `score` or `total` is written as `null`, never left out. The maps keep their own order.
   - A whole number of magnitude below 9.0E18 is written as an integer (`1790000000000`, and `-0.0` as `0`), as `JSON.stringify` does; any other finite number is written by Kotlin's `Double.toString` (`1.5`), which `JSON.parse` reads as the same double; a non-finite number is written `null`, as `JSON.stringify` does.
   - Strings are escaped as `JSON.stringify` escapes them: `\"`, `\\`, `\b`, `\f`, `\n`, `\r`, `\t`, other code units below U+0020 and lone surrogates as lowercase `\u00xx` or `\udxxx`; `/` and everything else as is.
   - For ordinary values the text is byte for byte the web's. The golden store test compares stored progress as a JSON value, so the rare text differences (a fractional number in exponent form, a number above 9.0E18) cannot fail it.
4. **Reading, as `readProgress`** (reference 3.5). `parseJson` gives `JSON.parse`'s results:
   - Whitespace is space, tab, LF and CR only, so a byte order mark, a lone space or a NUL fails.
   - A number must match JSON's grammar (`01`, `1.`, `.5`, `+1` and `NaN` fail) and is read with `String.toDouble()`, the nearest double: `1e999` is Infinity, `-0` stays `-0.0` and `1.0` is `1.0`.
   - A `\u` escape needs four ASCII hex digits (`\u+041` fails; `String.toInt(16)` would take the sign). A lone surrogate is kept as is, as JavaScript keeps it: a Kotlin `String` holds UTF-16 code units.
   - A later duplicate key replaces the earlier one, and `__proto__` is a plain key.

   The validation is the zod schemas':
   - `seen` and records: safe integers (at most 2^53 - 1), at least 0. `seen` is kept whole as a `Long`; for records see D1.
   - `lastSeenAt`: finite, at least 0, not necessarily whole.
   - `lastCorrect`: a boolean.
   - `last`: `null` reads as null. A missing key fails, so the read is not whole. Otherwise it needs a route object with non-empty `deckId` and `sectionId`, one of the four modes, and `score` and `total` that are missing or null (null) or counts.
   - A `cards` or `records` value that is not an object reads as empty and not whole.
   - Unknown fields are dropped.
5. **Decision D1: records, scores and totals the Kotlin types cannot hold.** `CardHistory.seen` is a `Long` (task 1), so a stored `seen` up to 2^53 - 1 is kept exactly as the web keeps it, and every golden case, "a seen count of 2^53 - 1 is kept" included, matches the web. The records, `score` and `total` stay `Int` (README): a stored safe integer above `Int.MAX_VALUE` (2147483647) there fails its part, like a negative count: the record or the last route is dropped alone and the read is not whole, so the next save keeps the raw value under the side key and nothing is lost. The web keeps such a value; no round has more than a few hundred cards, so only a hand-made value reaches it, and no golden case does. This is a deviation recorded for the owner's review in the README (Global Constraints).
6. **Decision D2: nesting.** `parseJson` reads at most 512 nested arrays and objects and fails beyond that, instead of overflowing the thread's stack (a `StackOverflowError` is not an `Exception`, so the store's `catch` would not stop it). The values the app writes nest 4 deep. The web would read a deeper unknown field and stay whole; the Kotlin read is then not whole, so the raw value goes to the side key.
7. **The store, as `local.ts`** (reference 6).
   - The TypeScript interface `ProgressStore` is `LocalStore` here: the README gives the name `ProgressStore` to the app's suspend interface (task 9). The web's `Pick<Storage, "getItem" | "setItem">` is `KeyValueStorage`, and `undefined` is null.
   - `save` runs `keepUnreadable` first. It writes the side key only when a value is stored, the value does not read back whole, and the side key does not already hold exactly that value (`String` equality, UTF-16 code units, as `===`).
   - If that side write throws, the main write is skipped.
   - Every `Exception` ends the save silently, and an `Exception` from `getItem` makes `load` return empty progress. A storage failure never reaches the player.
8. **Purity.** Nothing in these five files uses a clock, randomness, a timer, files or preferences, or imports `android` or `androidx`. Task 1's purity test scans them like every engine source. The private helpers have names of their own (`storedCount`, `StrictJsonReader` and so on), so they cannot meet a same-named helper of tasks 1 to 3 in the same package.
9. **Every load is two string literals** (task 1 coverage scan). The golden tests call `Golden.load("src/input/swipe", "X")`, `Golden.load("src/progress/progress", "X")` or `Golden.load("src/progress/local", "X")` with both arguments written out, and `ProgressGoldenTest.check` takes the loaded `GoldenFile`, never a function name.

**Review focus.** None of the README's five review focus items belongs to this task (item 5, the gesture inset and the diagonal drag, is task 13's, which feeds `interpret`). What a reviewer should check here: `interpret` against `swipe.ts` rule by rule, the side-copy condition and its order against `local.ts`, decisions D1 and D2, and that `progressJson` writes `"last":null`.

**Steps:**

- [ ] **Step 1: Write the swipe unit tests.**

`android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/SwipeTest.kt` ports the pinned cases of `tests/input/swipe.test.ts`, `swipe-polish.test.ts` and `swipe-early-touch-polish.test.ts`:

```kotlin
package com.eienmosu.truthy.engine

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

// Ports of tests/input/swipe.test.ts, swipe-polish.test.ts and swipe-early-touch-polish.test.ts.
// A 390 wide window whose card appeared at t = 0; gestures start mid-screen at (195, 400) at t = 1000.
class SwipeTest {
  private val phone = SwipeContext(viewportWidth = 390.0, cardShownAt = 0.0)

  private fun touch(x: Int, t: Int) = SwipeSample(x = x.toDouble(), y = 400.0, t = t.toDouble())

  private fun p(dx: Int, dy: Int, dt: Int) = Triple(dx, dy, dt)

  // Samples given as (dx, dy, dt) from the touch-down point.
  private fun gesture(vararg offsets: Triple<Int, Int, Int>): List<SwipeSample> =
    offsets.map { (dx, dy, dt) -> SwipeSample(x = 195.0 + dx, y = 400.0 + dy, t = 1000.0 + dt) }

  @Test fun constantsMatchTheInputTable() {
    assertEquals(SwipeConstants(commitPx = 90.0, flingPx = 40.0, flingVelocity = 0.5, settleMs = 250.0, edgePx = 24.0), SWIPE)
  }

  @Test fun intentIsProportionalInside110AndClampedBeyond() {
    assertEquals(0.0, intent(0.0))
    assertEquals(0.5, intent(55.0))
    assertEquals(-0.5, intent(-55.0))
    assertEquals(1.0, intent(110.0))
    assertEquals(-1.0, intent(-110.0))
    assertEquals(1.0, intent(500.0))
    assertEquals(-1.0, intent(-500.0))
  }

  @Test fun canStartWaitsForTheSettleTimeFromCardShownAt() {
    assertFalse(canStart(touch(195, 249), phone))
    assertTrue(canStart(touch(195, 250), phone))
    val later = SwipeContext(viewportWidth = 390.0, cardShownAt = 10_000.0)
    assertFalse(canStart(touch(195, 10_100), later))
    assertTrue(canStart(touch(195, 10_250), later))
    val shown = SwipeContext(viewportWidth = 390.0, cardShownAt = 1_000.0)
    assertFalse(canStart(touch(100, 0), shown))
    assertFalse(canStart(touch(100, 749), shown))
  }

  @Test fun canStartRejectsTheEdgeZonesBothEndsInclusive() {
    assertFalse(canStart(touch(23, 1000), phone))
    assertTrue(canStart(touch(24, 1000), phone))
    assertFalse(canStart(touch(367, 1000), phone))
    assertTrue(canStart(touch(366, 1000), phone))
    assertFalse(canStart(touch(0, 1000), phone))
    val tablet = SwipeContext(viewportWidth = 1024.0, cardShownAt = 0.0)
    assertTrue(canStart(touch(1000, 1000), tablet))
    assertFalse(canStart(touch(1001, 1000), tablet))
  }

  @Test fun interpretNeedsTwoSamplesAMoveAndAValidStart() {
    assertEquals(SwipeOutcome.CANCEL, interpret(emptyList(), phone))
    assertEquals(SwipeOutcome.CANCEL, interpret(gesture(p(0, 0, 0)), phone))
    assertEquals(SwipeOutcome.CANCEL, interpret(gesture(p(0, 0, 0), p(0, 0, 500)), phone))
    assertEquals(SwipeOutcome.CANCEL, interpret(gesture(p(0, 0, 0), p(120, 0, 300)), SwipeContext(viewportWidth = 390.0, cardShownAt = 900.0)))
    assertEquals(SwipeOutcome.CANCEL, interpret(listOf(touch(10, 1000), touch(130, 1300)), phone))
  }

  @Test fun interpretCommitsBy90AtReleaseByTheSideAtRelease() {
    assertEquals(SwipeOutcome.TRUE, interpret(gesture(p(0, 0, 0), p(45, 0, 300), p(90, 0, 600)), phone))
    assertEquals(SwipeOutcome.CANCEL, interpret(gesture(p(0, 0, 0), p(45, 0, 300), p(89, 0, 600)), phone))
    assertEquals(SwipeOutcome.FALSE, interpret(gesture(p(0, 0, 0), p(-45, 0, 300), p(-90, 0, 600)), phone))
    assertEquals(SwipeOutcome.CANCEL, interpret(gesture(p(0, 0, 0), p(150, 0, 300), p(60, 0, 900)), phone))
    assertEquals(SwipeOutcome.FALSE, interpret(gesture(p(0, 0, 0), p(120, 0, 300), p(-100, 0, 900)), phone))
  }

  @Test fun interpretCancelsMostlyVerticalAndCommitsAnExactDiagonal() {
    assertEquals(SwipeOutcome.CANCEL, interpret(gesture(p(0, 0, 0), p(50, 150, 300), p(100, 300, 600)), phone))
    assertEquals(SwipeOutcome.CANCEL, interpret(gesture(p(0, 0, 0), p(-100, -101, 600)), phone))
    assertEquals(SwipeOutcome.TRUE, interpret(gesture(p(0, 0, 0), p(100, 100, 600)), phone))
  }

  @Test fun interpretFlingsFrom40AtHalfADpPerMs() {
    assertEquals(SwipeOutcome.TRUE, interpret(gesture(p(0, 0, 0), p(20, 0, 20), p(40, 0, 40)), phone))
    assertEquals(SwipeOutcome.CANCEL, interpret(gesture(p(0, 0, 0), p(20, 0, 20), p(39, 0, 40)), phone))
    assertEquals(SwipeOutcome.FALSE, interpret(gesture(p(0, 0, 0), p(-20, 0, 20), p(-40, 0, 40)), phone))
    assertEquals(SwipeOutcome.TRUE, interpret(gesture(p(0, 0, 0), p(20, 0, 400), p(60, 0, 480)), phone))
    assertEquals(SwipeOutcome.CANCEL, interpret(gesture(p(0, 0, 0), p(20, 0, 400), p(59, 0, 480)), phone))
    assertEquals(SwipeOutcome.CANCEL, interpret(gesture(p(0, 0, 0), p(80, 0, 400), p(65, 0, 420), p(50, 0, 440)), phone))
  }

  @Test fun interpretMeasuresVelocityFromTheOldestSampleInsideThe80MsWindow() {
    assertEquals(SwipeOutcome.CANCEL, interpret(gesture(p(0, 0, 0), p(5, 0, 400), p(50, 0, 481)), phone))
    assertEquals(SwipeOutcome.TRUE, interpret(gesture(p(0, 0, 0), p(5, 0, 401), p(50, 0, 481)), phone))
    assertEquals(SwipeOutcome.TRUE, interpret(gesture(p(0, 0, 0), p(10, 0, 400), p(48, 0, 460), p(50, 0, 470)), phone))
    assertEquals(SwipeOutcome.CANCEL, interpret(gesture(p(0, 0, 0), p(30, 0, 400), p(30, 0, 460), p(50, 0, 470)), phone))
  }

  @Test fun interpretReadsNoTimeBetweenSamplesAsNoVelocity() {
    assertEquals(SwipeOutcome.CANCEL, interpret(gesture(p(0, 0, 0), p(50, 0, 0)), phone))
    assertEquals(SwipeOutcome.TRUE, interpret(gesture(p(0, 0, 0), p(100, 0, 0)), phone))
    assertEquals(SwipeOutcome.CANCEL, interpret(gesture(p(0, 0, 0), p(50, 0, 200), p(60, 0, 200)), phone))
  }
}
```

- [ ] **Step 2: Write the golden decoding helpers and the swipe golden tests.**

`android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/GoldenDecode.kt` reads plain values out of a golden `JsonElement`, including plan A's `$number` tags. Every golden test of this task decodes through it, so it is the only place that knows the tags:

```kotlin
package com.eienmosu.truthy.engine

import kotlin.math.abs
import kotlin.math.floor
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

// Plain values from golden JSON (plan A's README, "The golden vector format"). Numbers JSON cannot carry
// come tagged as {"$number": "Infinity" | "-Infinity" | "NaN" | "-0"}.
object GoldenDecode {
  fun field(value: JsonElement, key: String): JsonElement =
    value.jsonObject[key] ?: error("no field $key in $value")

  fun isNull(value: JsonElement): Boolean = value is JsonNull

  fun number(value: JsonElement): Double {
    if (value is JsonObject) {
      return when (value["\$number"]?.jsonPrimitive?.content) {
        "Infinity" -> Double.POSITIVE_INFINITY
        "-Infinity" -> Double.NEGATIVE_INFINITY
        "NaN" -> Double.NaN
        "-0" -> -0.0
        else -> error("not a number: $value")
      }
    }
    val primitive = value.jsonPrimitive
    require(!primitive.isString && primitive !is JsonNull) { "not a number: $value" }
    return primitive.content.toDouble()
  }

  fun int(value: JsonElement): Int {
    val n = number(value)
    require(n == floor(n) && abs(n) <= Int.MAX_VALUE) { "not an Int: $value" }
    return n.toInt()
  }

  // A count up to 2^53 - 1, the largest safe integer, held exactly by a Long (CardHistory.seen).
  fun long(value: JsonElement): Long {
    val n = number(value)
    require(n == floor(n) && abs(n) <= 9_007_199_254_740_991.0) { "not a safe integer: $value" }
    return n.toLong()
  }

  fun optionalInt(value: JsonElement): Int? = if (isNull(value)) null else int(value)

  fun string(value: JsonElement): String {
    val primitive = value.jsonPrimitive
    require(primitive.isString) { "not a string: $value" }
    return primitive.content
  }

  fun bool(value: JsonElement): Boolean {
    val primitive = value.jsonPrimitive
    require(!primitive.isString && primitive !is JsonNull) { "not a boolean: $value" }
    return primitive.boolean
  }

  fun strings(value: JsonElement): List<String> = value.jsonArray.map { string(it) }
}
```

`android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/SwipeGoldenTest.kt` runs every case of the four swipe vector files. `intent` is compared bit for bit, since `dx / 110` must be the same double as the web's:

```kotlin
package com.eienmosu.truthy.engine

import com.eienmosu.truthy.engine.GoldenDecode.bool
import com.eienmosu.truthy.engine.GoldenDecode.field
import com.eienmosu.truthy.engine.GoldenDecode.number
import com.eienmosu.truthy.engine.GoldenDecode.string
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.jsonArray

// native-data/golden/src.input.swipe.*.json: every case computed by src/input/swipe.ts.
class SwipeGoldenTest {
  private fun sample(value: JsonElement) =
    SwipeSample(x = number(field(value, "x")), y = number(field(value, "y")), t = number(field(value, "t")))

  private fun context(value: JsonElement) =
    SwipeContext(viewportWidth = number(field(value, "viewportWidth")), cardShownAt = number(field(value, "cardShownAt")))

  @Test fun swipeConstant() {
    val output = Golden.load("src/input/swipe", "SWIPE").cases.single().output
    val expected = SwipeConstants(
      commitPx = number(field(output, "commitPx")),
      flingPx = number(field(output, "flingPx")),
      flingVelocity = number(field(output, "flingVelocity")),
      settleMs = number(field(output, "settleMs")),
      edgePx = number(field(output, "edgePx")),
    )
    assertEquals(expected, SWIPE)
  }

  @Test fun intentCases() {
    val file = Golden.load("src/input/swipe", "intent")
    assertTrue(file.cases.isNotEmpty())
    val failures = file.cases.mapNotNull { c ->
      val got = intent(number(field(c.input, "dx")))
      val want = number(c.output)
      if (got.toRawBits() == want.toRawBits()) null else "${c.name}: got $got, want $want"
    }
    assertEquals(emptyList<String>(), failures)
  }

  @Test fun canStartCases() {
    val file = Golden.load("src/input/swipe", "canStart")
    assertTrue(file.cases.isNotEmpty())
    val failures = file.cases.mapNotNull { c ->
      val got = canStart(sample(field(c.input, "sample")), context(field(c.input, "context")))
      if (got == bool(c.output)) null else "${c.name}: got $got"
    }
    assertEquals(emptyList<String>(), failures)
  }

  @Test fun interpretCases() {
    val file = Golden.load("src/input/swipe", "interpret")
    assertTrue(file.cases.isNotEmpty())
    val failures = file.cases.mapNotNull { c ->
      val samples = field(c.input, "samples").jsonArray.map { sample(it) }
      val got = interpret(samples, context(field(c.input, "context")))
      if (got.wire == string(c.output)) null else "${c.name}: got ${got.wire}"
    }
    assertEquals(emptyList<String>(), failures)
  }
}
```

- [ ] **Step 3: Run them and watch them fail.**

```bash
(cd android/Truthy && ./gradlew :engine:test --tests 'com.eienmosu.truthy.engine.Swipe*')
```

Expected: `> Task :engine:compileTestKotlin FAILED` with `e: file://.../SwipeTest.kt:...: Unresolved reference 'SwipeContext'.` and the same error for `SwipeSample`, `SwipeConstants`, `SWIPE`, `intent`, `canStart`, `interpret` and `SwipeOutcome`, then `BUILD FAILED`. No test runs.

- [ ] **Step 4: Write the swipe port.**

`android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/Swipe.kt`:

```kotlin
package com.eienmosu.truthy.engine

import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sign

// Swipe interpretation, a line-by-line port of src/input/swipe.ts (reference 3.4).
// Pure: callers pass numbers. Positions are window coordinates in dp (the web's CSS px), times are monotonic
// milliseconds on the base of the pointer events' own uptime stamps (reference 7.3), and viewportWidth is the
// window width in dp.

data class SwipeConstants(
  val commitPx: Double,
  val flingPx: Double,
  val flingVelocity: Double, // dp per ms
  val settleMs: Double,
  val edgePx: Double,
)

val SWIPE = SwipeConstants(commitPx = 90.0, flingPx = 40.0, flingVelocity = 0.5, settleMs = 250.0, edgePx = 24.0)

// How far a drag must go for the preview to show full intent.
private const val INTENT_FULL_PX = 110.0

// The release velocity is measured over this many ms before the last sample.
private const val VELOCITY_WINDOW_MS = 80.0

data class SwipeSample(val x: Double, val y: Double, val t: Double)

data class SwipeContext(val viewportWidth: Double, val cardShownAt: Double)

enum class SwipeOutcome(val wire: String) { TRUE("true"), FALSE("false"), CANCEL("cancel") }

// -1 (fully towards False) to 1 (fully towards True), for the drag preview. clamp(value, -1, 1) on the web is
// Math.min(1, Math.max(-1, value)); kotlin.math.min and max treat signed zeros and NaN the same way.
fun intent(dx: Double): Double = min(1.0, max(-1.0, dx / INTENT_FULL_PX))

// A gesture may start only after the settle time and outside the edge zones, both ends inclusive.
fun canStart(sample: SwipeSample, context: SwipeContext): Boolean {
  val settled = sample.t - context.cardShownAt >= SWIPE.settleMs
  val awayFromEdges = sample.x >= SWIPE.edgePx && sample.x <= context.viewportWidth - SWIPE.edgePx
  return settled && awayFromEdges
}

private fun swipeSideOf(dx: Double): SwipeOutcome = if (dx > 0) SwipeOutcome.TRUE else SwipeOutcome.FALSE

// Horizontal velocity in dp per ms between the oldest earlier sample inside the window and the last one.
// No such sample, or no time between them, means 0.
private fun releaseVelocity(samples: List<SwipeSample>, last: SwipeSample): Double {
  val reference = samples.dropLast(1).firstOrNull { last.t - it.t <= VELOCITY_WINDOW_MS } ?: return 0.0
  val dt = last.t - reference.t
  if (dt <= 0) return 0.0
  return (last.x - reference.x) / dt
}

// Turns the samples of one gesture (first = touch down, last = release) into an answer or cancel.
fun interpret(samples: List<SwipeSample>, context: SwipeContext): SwipeOutcome {
  val first = samples.firstOrNull()
  val last = samples.lastOrNull()
  if (samples.size < 2 || first == null || last == null) return SwipeOutcome.CANCEL
  if (!canStart(first, context)) return SwipeOutcome.CANCEL

  val dx = last.x - first.x
  val dy = last.y - first.y
  if (dx == 0.0) return SwipeOutcome.CANCEL
  if (abs(dy) > abs(dx)) return SwipeOutcome.CANCEL

  if (abs(dx) >= SWIPE.commitPx) return swipeSideOf(dx)

  val velocityTowardsSide = releaseVelocity(samples, last) * sign(dx)
  if (abs(dx) >= SWIPE.flingPx && velocityTowardsSide >= SWIPE.flingVelocity) return swipeSideOf(dx)
  return SwipeOutcome.CANCEL
}
```

- [ ] **Step 5: Run them green.**

```bash
(cd android/Truthy && ./gradlew :engine:test --tests 'com.eienmosu.truthy.engine.Swipe*')
grep -h -o -E 'testsuite name="[^"]+" tests="[0-9]+" skipped="[0-9]+" failures="[0-9]+" errors="[0-9]+"' android/Truthy/engine/build/test-results/test/TEST-com.eienmosu.truthy.engine.Swipe*.xml
```

Expected: `BUILD SUCCESSFUL`, then:

```
testsuite name="com.eienmosu.truthy.engine.SwipeGoldenTest" tests="4" skipped="0" failures="0" errors="0"
testsuite name="com.eienmosu.truthy.engine.SwipeTest" tests="10" skipped="0" failures="0" errors="0"
```

The four golden tests cover every case of the four files (plan A's draft producer gave 16 of `intent`, 25 of `canStart`, 54 of `interpret` and 1 of `SWIPE`; the committed files are the reference).

- [ ] **Step 6: Commit.**

```bash
git add android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/Swipe.kt android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/GoldenDecode.kt android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/SwipeTest.kt android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/SwipeGoldenTest.kt
git commit -m "feat: port swipe interpretation to the Android engine"
```

- [ ] **Step 7: Write the test helpers for progress.**

`android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/ProgressFixtures.kt` builds the cards the unit tests answer, decoded from the web's JSON shape so they do not depend on how task 1 names the parts of a card's text:

```kotlin
package com.eienmosu.truthy.engine

import kotlinx.serialization.json.Json

// Cards for the progress unit tests, in the web's JSON shape.
object ProgressFixtures {
  fun card(id: String): Card = Json.decodeFromString(
    Card.serializer(),
    """{"id":"$id","section":"SEC","text":{"en":{"statement":"Statement $id","explanation":"Explanation $id"}},""" +
      """"answer":true,"source":{"title":"AWS docs","url":"https://docs.aws.amazon.com/"},"difficulty":1,"appliesTo":"","conflictGroups":[]}""",
  )
}
```

The second raw string starts with four quote characters: the opening `"""` and then the `"` that opens the key `answer`.

`android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/ProgressGolden.kt` decodes the progress types from golden JSON:

```kotlin
package com.eienmosu.truthy.engine

import com.eienmosu.truthy.engine.GoldenDecode.bool
import com.eienmosu.truthy.engine.GoldenDecode.field
import com.eienmosu.truthy.engine.GoldenDecode.int
import com.eienmosu.truthy.engine.GoldenDecode.isNull
import com.eienmosu.truthy.engine.GoldenDecode.long
import com.eienmosu.truthy.engine.GoldenDecode.number
import com.eienmosu.truthy.engine.GoldenDecode.optionalInt
import com.eienmosu.truthy.engine.GoldenDecode.string
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject

// Decoders from golden JSON to the progress types of task 4, and an exact comparison.
object ProgressGolden {
  fun route(value: JsonElement) = Route(deckId = string(field(value, "deckId")), sectionId = string(field(value, "sectionId")))

  fun mode(value: JsonElement): Mode {
    val name = string(value)
    return Mode.entries.firstOrNull { it.wire == name } ?: error("not a mode: $name")
  }

  fun history(value: JsonElement): Map<String, CardHistory> =
    value.jsonObject.mapValues { (_, entry) ->
      CardHistory(
        seen = long(field(entry, "seen")),
        lastCorrect = bool(field(entry, "lastCorrect")),
        lastSeenAt = number(field(entry, "lastSeenAt")),
      )
    }

  fun progress(value: JsonElement): Progress {
    val last = field(value, "last")
    return Progress(
      version = int(field(value, "version")),
      cards = history(field(value, "cards")),
      records = field(value, "records").jsonObject.mapValues { (_, best) -> int(best) },
      last = if (isNull(last)) {
        null
      } else {
        LastRound(
          route = route(field(last, "route")),
          mode = mode(field(last, "mode")),
          score = optionalInt(field(last, "score")),
          total = optionalInt(field(last, "total")),
        )
      },
    )
  }

  fun comparison(value: JsonElement): Comparison = when (val kind = string(field(value, "kind"))) {
    "first" -> Comparison.First
    "new-best" -> Comparison.NewBest(previousBest = int(field(value, "previousBest")))
    "equal" -> Comparison.Equal(best = int(field(value, "best")))
    "short" -> Comparison.Short(best = int(field(value, "best")), by = int(field(value, "by")))
    else -> error("unknown comparison kind $kind")
  }

  fun answered(file: GoldenFile, value: JsonElement) = Answered(
    card = file.card(field(value, "card")),
    given = bool(field(value, "given")),
    correct = bool(field(value, "correct")),
    at = number(field(value, "at")),
  )

  fun roundResult(file: GoldenFile, value: JsonElement) = RoundResult(
    mode = mode(field(value, "mode")),
    route = route(field(value, "route")),
    score = int(field(value, "score")),
    total = int(field(value, "total")),
    answers = field(value, "answers").jsonArray.map { answered(file, it) },
    missed = field(value, "missed").jsonArray.map { answered(file, it) },
    abandoned = bool(field(value, "abandoned")),
  )

  // Equal, and every lastSeenAt the same double bit for bit (so -0.0 stays -0.0).
  fun exactly(a: Progress, b: Progress): Boolean =
    a == b && a.cards.all { (id, entry) -> b.cards[id]?.lastSeenAt?.toRawBits() == entry.lastSeenAt.toRawBits() }
}
```

- [ ] **Step 8: Write the progress unit tests.**

`android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/ProgressTest.kt` ports the pinned cases of `tests/progress/progress.test.ts` and `progress-polish.test.ts`, and pins the stored JSON text (rule 3) against what `JSON.stringify` printed for the same values in Node:

```kotlin
package com.eienmosu.truthy.engine

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

// Ports of the pinned cases of tests/progress/progress.test.ts and progress-polish.test.ts.
class ProgressTest {
  private val sec = Route(deckId = "aws-clf-c02", sectionId = "SEC")
  private val con = Route(deckId = "aws-clf-c02", sectionId = "CON")
  private val seenOnce = CardHistory(seen = 1, lastCorrect = true, lastSeenAt = 1.0)

  private fun answered(id: String, correct: Boolean, at: Double) =
    Answered(card = ProgressFixtures.card(id), given = correct, correct = correct, at = at)

  private fun result(answers: List<Answered>, abandoned: Boolean = false) = RoundResult(
    mode = Mode.CLASSIC,
    route = sec,
    score = answers.count { it.correct },
    total = answers.size,
    answers = answers,
    missed = answers.filter { !it.correct },
    abandoned = abandoned,
  )

  // A Classic result with the given score out of ten, all answered at time 1.
  private fun scored(score: Int, abandoned: Boolean = false) =
    result((0 until 10).map { answered("c$it", it < score, 1.0) }, abandoned)

  private fun withRecord(best: Int) =
    Progress(version = 1, cards = emptyMap(), records = mapOf(recordKey(sec, Mode.CLASSIC) to best), last = null)

  @Test fun emptyProgressHasVersion1AndNothingElse() {
    assertEquals(Progress(version = 1, cards = emptyMap(), records = emptyMap(), last = null), emptyProgress())
  }

  @Test fun recordKeyJoinsTheRouteKeyAndTheMode() {
    assertEquals("aws-clf-c02/SEC#classic", recordKey(sec, Mode.CLASSIC))
    assertEquals("nextjs-rendering/ALL#timed", recordKey(Route(deckId = "nextjs-rendering", sectionId = WHOLE_DECK), Mode.TIMED))
  }

  @Test fun bestForReadsTheRecordOfARouteAndMode() {
    val played = Progress(version = 1, cards = emptyMap(), records = mapOf("aws-clf-c02/SEC#classic" to 9, "aws-clf-c02/CON#timed" to 0), last = null)
    assertEquals(9, bestFor(played, sec, Mode.CLASSIC))
    assertNull(bestFor(played, sec, Mode.TIMED))
    assertEquals(0, bestFor(played, con, Mode.TIMED))
  }

  @Test fun compareWithBestKindsCarryTheTypeScriptKind() {
    assertEquals(Comparison.First, compareWithBest(0, null))
    assertEquals(Comparison.NewBest(previousBest = 7), compareWithBest(8, 7))
    assertEquals(Comparison.Equal(best = 9), compareWithBest(9, 9))
    assertEquals(Comparison.Short(best = 9, by = 2), compareWithBest(7, 9))
    assertEquals(listOf("first", "new-best", "equal", "short"), listOf(compareWithBest(0, null), compareWithBest(8, 7), compareWithBest(9, 9), compareWithBest(7, 9)).map { it.kind })
  }

  @Test fun applyResultAddsToTheHistoryAndKeepsTheLaterAnswer() {
    val before = Progress(version = 1, cards = mapOf("c1" to CardHistory(seen = 4, lastCorrect = true, lastSeenAt = 500.0)), records = emptyMap(), last = null)
    val outcome = applyResult(before, result(listOf(answered("c1", true, 100.0), answered("c2", true, 150.0), answered("c1", false, 200.0))))
    assertEquals(CardHistory(seen = 6, lastCorrect = false, lastSeenAt = 200.0), outcome.progress.cards["c1"])
    assertEquals(CardHistory(seen = 1, lastCorrect = true, lastSeenAt = 150.0), outcome.progress.cards["c2"])
  }

  @Test fun applyResultSetsAFirstRecordEvenWithScore0AndReplacesOnlyOnAHigherScore() {
    val first = applyResult(emptyProgress(), scored(0))
    assertTrue(first.isNewBest)
    assertNull(first.previousBest)
    assertEquals(0, first.progress.records["aws-clf-c02/SEC#classic"])
    val equal = applyResult(withRecord(7), scored(7))
    assertFalse(equal.isNewBest)
    assertEquals(7, equal.previousBest)
    assertEquals(7, equal.progress.records["aws-clf-c02/SEC#classic"])
    val better = applyResult(withRecord(6), scored(8))
    assertTrue(better.isNewBest)
    assertEquals(8, better.progress.records["aws-clf-c02/SEC#classic"])
    assertEquals(LastRound(route = sec, mode = Mode.CLASSIC, score = 8, total = 10), better.progress.last)
  }

  @Test fun applyResultForAnAbandonedRoundKeepsTheAnswersButNeverTheRecord() {
    val outcome = applyResult(withRecord(2), scored(9, abandoned = true))
    assertFalse(outcome.isNewBest)
    assertEquals(2, outcome.progress.records["aws-clf-c02/SEC#classic"])
    assertEquals(10, outcome.progress.cards.size)
    assertEquals(LastRound(route = sec, mode = Mode.CLASSIC, score = null, total = null), outcome.progress.last)
    assertTrue(applyResult(emptyProgress(), scored(5, abandoned = true)).progress.records.isEmpty())
  }

  @Test fun applyResultAndPruneDeckLeaveTheirInputUnchanged() {
    val before = Progress(version = 1, cards = mapOf("aws-clf-c02-x" to seenOnce), records = mapOf("aws-clf-c02/SEC#classic" to 3), last = null)
    val copy = before.copy(cards = before.cards.toMap(), records = before.records.toMap())
    applyResult(before, scored(9))
    pruneDeck(before, "aws-clf-c02", emptyList())
    assertEquals(copy, before)
  }

  @Test fun pruneDeckDropsOnlyThisDecksRemovedCardsByThePlainPrefix() {
    val before = Progress(
      version = 1,
      cards = mapOf("aws-clf-c02-t1.1-01" to seenOnce, "aws-clf-c02-t1.1-02" to seenOnce, "aws-clf-c02x-1" to seenOnce, "gcp-cdl-pro-1" to seenOnce),
      records = mapOf("aws-clf-c02/SEC#classic" to 7),
      last = LastRound(route = sec, mode = Mode.CLASSIC, score = 7, total = 10),
    )
    val pruned = pruneDeck(before, "aws-clf-c02", listOf("aws-clf-c02-t1.1-01"))
    assertEquals(setOf("aws-clf-c02-t1.1-01", "aws-clf-c02x-1", "gcp-cdl-pro-1"), pruned.cards.keys)
    assertEquals(before.records, pruned.records)
    assertEquals(before.last, pruned.last)
    assertNull(pruneDeck(before, "gcp-cdl", emptyList()).cards["gcp-cdl-pro-1"])
  }

  @Test fun seenShareCountsDistinctListedCardsSeenAtLeastOnce() {
    assertEquals(0.0, seenShare(mapOf("a" to seenOnce), emptyList()))
    assertEquals(0.5, seenShare(mapOf("a" to seenOnce, "c" to seenOnce), listOf("a", "b", "c", "d")))
    assertEquals(0.0, seenShare(mapOf("a" to CardHistory(seen = 0, lastCorrect = false, lastSeenAt = 0.0)), listOf("a")))
    assertEquals(0.5, seenShare(mapOf("a" to seenOnce), listOf("a", "a", "b")))
    assertEquals(1.0 / 3.0, seenShare(mapOf("a" to seenOnce), listOf("a", "b", "c")))
  }

  @Test fun progressJsonWritesTheWebShapeWithLastAndScoresAsNull() {
    assertEquals("""{"version":1,"cards":{},"records":{},"last":null}""", progressJson(emptyProgress()))
    val abandoned = Progress(version = 1, cards = emptyMap(), records = emptyMap(), last = LastRound(route = sec, mode = Mode.LIVES, score = null, total = null))
    assertEquals(
      """{"version":1,"cards":{},"records":{},"last":{"route":{"deckId":"aws-clf-c02","sectionId":"SEC"},"mode":"lives","score":null,"total":null}}""",
      progressJson(abandoned),
    )
  }

  @Test fun progressJsonWritesWholeNumbersAsIntegersAndNonFiniteAsNull() {
    val played = Progress(
      version = 1,
      cards = mapOf(
        "a" to CardHistory(seen = 2, lastCorrect = true, lastSeenAt = 1_790_000_000_000.0),
        "b" to CardHistory(seen = 1, lastCorrect = false, lastSeenAt = -0.0),
        "c" to CardHistory(seen = 1, lastCorrect = true, lastSeenAt = 1.5),
        "d" to CardHistory(seen = 1, lastCorrect = true, lastSeenAt = Double.POSITIVE_INFINITY),
      ),
      records = mapOf("aws-clf-c02/SEC#classic" to 7),
      last = null,
    )
    assertEquals(
      """{"version":1,"cards":{"a":{"seen":2,"lastCorrect":true,"lastSeenAt":1790000000000},"b":{"seen":1,"lastCorrect":false,"lastSeenAt":0},""" +
        """"c":{"seen":1,"lastCorrect":true,"lastSeenAt":1.5},"d":{"seen":1,"lastCorrect":true,"lastSeenAt":null}},"records":{"aws-clf-c02/SEC#classic":7},"last":null}""",
      progressJson(played),
    )
  }

  @Test fun progressJsonEscapesStringsAsJsonStringifyDoes() {
    val key = "q\"b\\s/\n\t\u0001\uD800é😀"
    val progress = Progress(version = 1, cards = emptyMap(), records = mapOf(key to 3), last = null)
    assertEquals(
      "{\"version\":1,\"cards\":{},\"records\":{\"q\\\"b\\\\s/\\n\\t\\u0001\\ud800é😀\":3},\"last\":null}",
      progressJson(progress),
    )
  }
}
```

In `progressJsonWritesWholeNumbersAsIntegersAndNonFiniteAsNull`, the second raw string again starts with four quote characters: the opening `"""` and the `"` that opens the key `c`.

- [ ] **Step 9: Write the progress golden tests.**

`android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/ProgressGoldenTest.kt` runs the vector files of the seven functions that do not read stored text:

```kotlin
package com.eienmosu.truthy.engine

import com.eienmosu.truthy.engine.GoldenDecode.bool
import com.eienmosu.truthy.engine.GoldenDecode.field
import com.eienmosu.truthy.engine.GoldenDecode.int
import com.eienmosu.truthy.engine.GoldenDecode.number
import com.eienmosu.truthy.engine.GoldenDecode.optionalInt
import com.eienmosu.truthy.engine.GoldenDecode.string
import com.eienmosu.truthy.engine.GoldenDecode.strings
import com.eienmosu.truthy.engine.ProgressGolden.comparison
import com.eienmosu.truthy.engine.ProgressGolden.exactly
import com.eienmosu.truthy.engine.ProgressGolden.history
import com.eienmosu.truthy.engine.ProgressGolden.mode
import com.eienmosu.truthy.engine.ProgressGolden.progress
import com.eienmosu.truthy.engine.ProgressGolden.roundResult
import com.eienmosu.truthy.engine.ProgressGolden.route
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

// native-data/golden/src.progress.progress.*.json: every case computed by src/progress/progress.ts.
class ProgressGoldenTest {
  // Every call site loads its file with two string literals, so task 1's coverage scan sees it.
  private fun check(file: GoldenFile, mismatch: (GoldenFile, GoldenCase) -> String?) {
    val function = file.function
    assertEquals("src/progress/progress", file.module, function)
    assertTrue(file.cases.isNotEmpty(), function)
    val failures = file.cases.mapNotNull { c -> mismatch(file, c)?.let { "${c.name}: $it" } }
    assertEquals(emptyList<String>(), failures, function)
  }

  @Test fun emptyProgressCases() = check(Golden.load("src/progress/progress", "emptyProgress")) { _, c ->
    if (exactly(emptyProgress(), progress(c.output))) null else "got ${emptyProgress()}"
  }

  @Test fun recordKeyCases() = check(Golden.load("src/progress/progress", "recordKey")) { _, c ->
    val got = recordKey(route(field(c.input, "route")), mode(field(c.input, "mode")))
    if (got == string(c.output)) null else "got $got"
  }

  @Test fun bestForCases() = check(Golden.load("src/progress/progress", "bestFor")) { _, c ->
    val got = bestFor(progress(field(c.input, "progress")), route(field(c.input, "route")), mode(field(c.input, "mode")))
    if (got == optionalInt(c.output)) null else "got $got"
  }

  @Test fun compareWithBestCases() = check(Golden.load("src/progress/progress", "compareWithBest")) { _, c ->
    val got = compareWithBest(int(field(c.input, "score")), optionalInt(field(c.input, "previousBest")))
    if (got == comparison(c.output)) null else "got $got"
  }

  @Test fun applyResultCases() = check(Golden.load("src/progress/progress", "applyResult")) { file, c ->
    val got = applyResult(progress(field(c.input, "progress")), roundResult(file, field(c.input, "result")))
    when {
      !exactly(got.progress, progress(field(c.output, "progress"))) -> "progress ${got.progress}"
      got.previousBest != optionalInt(field(c.output, "previousBest")) -> "previousBest ${got.previousBest}"
      got.isNewBest != bool(field(c.output, "isNewBest")) -> "isNewBest ${got.isNewBest}"
      else -> null
    }
  }

  @Test fun pruneDeckCases() = check(Golden.load("src/progress/progress", "pruneDeck")) { _, c ->
    val got = pruneDeck(progress(field(c.input, "progress")), string(field(c.input, "deckId")), strings(field(c.input, "cardIds")))
    if (exactly(got, progress(c.output))) null else "got $got"
  }

  @Test fun seenShareCases() = check(Golden.load("src/progress/progress", "seenShare")) { _, c ->
    val got = seenShare(history(field(c.input, "history")), strings(field(c.input, "cardIds")))
    if (got.toRawBits() == number(c.output).toRawBits()) null else "got $got"
  }
}
```

- [ ] **Step 10: Run them and watch them fail.**

```bash
(cd android/Truthy && ./gradlew :engine:test --tests 'com.eienmosu.truthy.engine.ProgressTest' --tests 'com.eienmosu.truthy.engine.ProgressGoldenTest')
```

Expected: `> Task :engine:compileTestKotlin FAILED` with `Unresolved reference 'Progress'.` and the same error for `LastRound`, `emptyProgress`, `recordKey`, `bestFor`, `Comparison`, `compareWithBest`, `applyResult`, `pruneDeck`, `seenShare` and `progressJson`, then `BUILD FAILED`. No test runs.

- [ ] **Step 11: Write the progress rules and the stored text.**

`android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/Progress.kt`:

```kotlin
package com.eienmosu.truthy.engine

import kotlin.math.abs
import kotlin.math.floor
import kotlinx.serialization.Serializable

// Progress: card history, records and the last route played. A line-by-line port of src/progress/progress.ts
// (reference 3.5). Pure: every function returns new values and never changes its inputs.
// The stored text is written by progressJson only, never by kotlinx Json: that encoder leaves out properties
// with default values, prints 1790000000000.0 as 1.79E12 and writes enum names.

// The last round played. score and total are null for an abandoned round and for a last route stored before
// scores were kept.
@Serializable
data class LastRound(val route: Route, val mode: Mode, val score: Int?, val total: Int?)

@Serializable
data class Progress(
  val version: Int,
  val cards: Map<String, CardHistory>,
  val records: Map<String, Int>, // key: recordKey(route, mode)
  val last: LastRound?,
)

fun emptyProgress(): Progress = Progress(version = 1, cards = emptyMap(), records = emptyMap(), last = null)

// routeKey(route) + "#" + mode, as the web writes it ("aws-clf-c02/SEC#classic").
fun recordKey(route: Route, mode: Mode): String = "${route.deckId}/${route.sectionId}#${mode.wire}"

// The record for a route and mode, or null when it has not been played (to the end) yet.
fun bestFor(progress: Progress, route: Route, mode: Mode): Int? = progress.records[recordKey(route, mode)]

// How a finished round compares with the record that stood before it. kind is the TypeScript kind.
sealed interface Comparison {
  val kind: String

  data object First : Comparison {
    override val kind: String get() = "first"
  }

  data class NewBest(val previousBest: Int) : Comparison {
    override val kind: String get() = "new-best"
  }

  data class Equal(val best: Int) : Comparison {
    override val kind: String get() = "equal"
  }

  data class Short(val best: Int, val by: Int) : Comparison {
    override val kind: String get() = "short"
  }
}

// Compares a score with the record before the round (null when this route and mode had none).
fun compareWithBest(score: Int, previousBest: Int?): Comparison {
  if (previousBest == null) return Comparison.First
  if (score > previousBest) return Comparison.NewBest(previousBest = previousBest)
  if (score == previousBest) return Comparison.Equal(best = previousBest)
  return Comparison.Short(best = previousBest, by = previousBest - score)
}

data class ApplyOutcome(val progress: Progress, val previousBest: Int?, val isNewBest: Boolean)

// Records the answers of a round in the card history, remembers its route and mode (and its score when it was
// finished), and sets the record when a finished round beats it. A first finished round always sets the record,
// even with score 0. An abandoned round keeps its answers but never touches the record.
fun applyResult(progress: Progress, result: RoundResult): ApplyOutcome {
  val key = recordKey(result.route, result.mode)
  val previousBest = bestFor(progress, result.route, result.mode)
  val comparison = compareWithBest(result.score, previousBest)
  val isNewBest = !result.abandoned && (comparison is Comparison.First || comparison is Comparison.NewBest)
  val records = LinkedHashMap(progress.records)
  if (isNewBest) records[key] = result.score
  return ApplyOutcome(
    progress = Progress(
      version = 1,
      cards = withAnswers(progress.cards, result),
      records = records,
      last = LastRound(
        route = Route(deckId = result.route.deckId, sectionId = result.route.sectionId),
        mode = result.mode,
        score = if (result.abandoned) null else result.score,
        total = if (result.abandoned) null else result.total,
      ),
    ),
    previousBest = previousBest,
    isNewBest = isNewBest,
  )
}

// A card answered twice in one round counts twice and keeps the later verdict and time.
private fun withAnswers(cards: Map<String, CardHistory>, result: RoundResult): Map<String, CardHistory> {
  val next = LinkedHashMap(cards)
  for (answer in result.answers) {
    val id = answer.card.id
    val before = next[id]
    next[id] = CardHistory(seen = (before?.seen ?: 0L) + 1L, lastCorrect = answer.correct, lastSeenAt = answer.at)
  }
  return next
}

// Drops the history of cards of this deck that are not in the deck any more. A card belongs to the deck when its
// id starts with "<deckId>-" (the plain prefix, compared in UTF-16 code units as JavaScript does).
// Records and the last route are kept.
fun pruneDeck(progress: Progress, deckId: String, cardIds: List<String>): Progress {
  val prefix = "$deckId-"
  val current = cardIds.toSet()
  val cards = LinkedHashMap<String, CardHistory>()
  for ((id, entry) in progress.cards) {
    if (id.startsWith(prefix) && id !in current) continue
    cards[id] = entry
  }
  return Progress(version = progress.version, cards = cards, records = LinkedHashMap(progress.records), last = progress.last)
}

// The share (0 to 1) of the given cards that have been seen at least once. No cards gives 0.
fun seenShare(history: History, cardIds: List<String>): Double {
  val ids = cardIds.toSet()
  if (ids.isEmpty()) return 0.0
  var seen = 0
  for (id in ids) {
    val entry = history[id]
    if (entry != null && entry.seen > 0) seen += 1
  }
  return seen.toDouble() / ids.size
}

// JSON.stringify(progress): the web's key order, "last": null and null scores written out, whole numbers as
// integers, non-finite numbers as null, strings escaped as JSON.stringify escapes them.
fun progressJson(progress: Progress): String = buildString {
  append("{\"version\":").append(progress.version)
  append(",\"cards\":{")
  var first = true
  for ((id, entry) in progress.cards) {
    if (!first) append(',')
    first = false
    appendJsonString(id)
    append(":{\"seen\":").append(entry.seen)
    append(",\"lastCorrect\":").append(entry.lastCorrect)
    append(",\"lastSeenAt\":")
    appendJsonNumber(entry.lastSeenAt)
    append('}')
  }
  append("},\"records\":{")
  first = true
  for ((key, best) in progress.records) {
    if (!first) append(',')
    first = false
    appendJsonString(key)
    append(':').append(best)
  }
  append("},\"last\":")
  val last = progress.last
  if (last == null) {
    append("null")
  } else {
    append("{\"route\":{\"deckId\":")
    appendJsonString(last.route.deckId)
    append(",\"sectionId\":")
    appendJsonString(last.route.sectionId)
    append("},\"mode\":")
    appendJsonString(last.mode.wire)
    append(",\"score\":").append(last.score?.toString() ?: "null")
    append(",\"total\":").append(last.total?.toString() ?: "null")
    append('}')
  }
  append('}')
}

// JSON.stringify's number text: null when not finite, an integer when whole (-0 is "0"). Doubles of magnitude
// 9.0E18 and above, and fractions, use Double.toString, which JSON.parse reads back as the same double.
private fun StringBuilder.appendJsonNumber(value: Double) {
  when {
    !value.isFinite() -> append("null")
    value == floor(value) && abs(value) < 9.0E18 -> append(value.toLong())
    else -> append(value.toString())
  }
}

// JSON.stringify's string escaping, by UTF-16 code unit: a lone surrogate is written as a lowercase \u escape.
private fun StringBuilder.appendJsonString(text: String) {
  append('"')
  var i = 0
  while (i < text.length) {
    val c = text[i]
    when {
      c == '"' -> append("\\\"")
      c == '\\' -> append("\\\\")
      c == '\b' -> append("\\b")
      c == '\u000C' -> append("\\f")
      c == '\n' -> append("\\n")
      c == '\r' -> append("\\r")
      c == '\t' -> append("\\t")
      c < ' ' -> append("\\u").append(c.code.toString(16).padStart(4, '0'))
      c.isHighSurrogate() && i + 1 < text.length && text[i + 1].isLowSurrogate() -> {
        append(c).append(text[i + 1])
        i += 1
      }
      c.isSurrogate() -> append("\\u").append(c.code.toString(16).padStart(4, '0'))
      else -> append(c)
    }
    i += 1
  }
  append('"')
}
```

- [ ] **Step 12: Run them green.**

```bash
(cd android/Truthy && ./gradlew :engine:test --tests 'com.eienmosu.truthy.engine.ProgressTest' --tests 'com.eienmosu.truthy.engine.ProgressGoldenTest')
grep -h -o -E 'testsuite name="[^"]+" tests="[0-9]+" skipped="[0-9]+" failures="[0-9]+" errors="[0-9]+"' android/Truthy/engine/build/test-results/test/TEST-com.eienmosu.truthy.engine.Progress*.xml
```

Expected: `BUILD SUCCESSFUL`, then:

```
testsuite name="com.eienmosu.truthy.engine.ProgressGoldenTest" tests="7" skipped="0" failures="0" errors="0"
testsuite name="com.eienmosu.truthy.engine.ProgressTest" tests="13" skipped="0" failures="0" errors="0"
```

- [ ] **Step 13: Commit.**

```bash
git add android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/Progress.kt android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/ProgressFixtures.kt android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/ProgressGolden.kt android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/ProgressTest.kt android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/ProgressGoldenTest.kt
git commit -m "feat: port the progress rules to the Android engine"
```

- [ ] **Step 14: Write the reading tests.**

`android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/ProgressReadTest.kt` ports `tests/progress/partial-read.test.ts` and the reading rules of reference 3.5, with the numbers a lax JSON reader gets wrong and the two decisions D1 and D2:

```kotlin
package com.eienmosu.truthy.engine

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

// Ports of tests/progress/partial-read.test.ts and the reading rules of reference 3.5.
class ProgressReadTest {
  private val stored =
    """{"version":1,"cards":{"a":{"seen":3,"lastCorrect":false,"lastSeenAt":5}},"records":{"a/ALL#classic":7},""" +
      """"last":{"route":{"deckId":"a","sectionId":"ALL"},"mode":"classic","score":7,"total":10}}"""
  private val keptA = CardHistory(seen = 3, lastCorrect = false, lastSeenAt = 5.0)
  private val lastA = LastRound(route = Route(deckId = "a", sectionId = "ALL"), mode = Mode.CLASSIC, score = 7, total = 10)
  private val notWhole = ReadResult(emptyProgress(), false)

  private fun cardsOnly(cards: String) = """{"version":1,"cards":""" + cards + ""","records":{},"last":null}"""

  private fun progressOf(cards: Map<String, CardHistory> = emptyMap(), records: Map<String, Int> = emptyMap(), last: LastRound? = null) =
    Progress(version = 1, cards = cards, records = records, last = last)

  @Test fun nothingStoredIsEmptyAndWhole() {
    assertEquals(ReadResult(emptyProgress(), true), readProgress(null))
  }

  @Test fun aValidValueReadsWhole() {
    assertEquals(ReadResult(progressOf(mapOf("a" to keptA), mapOf("a/ALL#classic" to 7), lastA), true), readProgress(stored))
  }

  @Test fun valuesThatAreNotProgressReadEmptyAndNotWhole() {
    val raws = listOf(
      "{not json", "", " ", "{", "undefined", "NaN", "true", "\u0000", "null", "42", "\"progress\"", "[]", "{}",
      """{"version":2}""", """{"version":"1"}""", """{"version":true}""", "﻿{\"version\":1}", """{"version":1,}""", "01",
    )
    for (raw in raws) assertEquals(notWhole, readProgress(raw), raw)
  }

  @Test fun aVersionWritten1Point0IsVersion1() {
    assertEquals(ReadResult(emptyProgress(), true), readProgress("""{"version":1.0,"cards":{},"records":{},"last":null}"""))
  }

  @Test fun aMissingLastKeyReadsNotWholeWhileAMissingScoreIsNull() {
    assertEquals(notWhole, readProgress("""{"version":1,"cards":{},"records":{}}"""))
    val older = readProgress("""{"version":1,"cards":{},"records":{},"last":{"route":{"deckId":"a","sectionId":"ALL"},"mode":"classic"}}""")
    assertTrue(older.whole)
    assertEquals(LastRound(route = Route(deckId = "a", sectionId = "ALL"), mode = Mode.CLASSIC, score = null, total = null), older.progress.last)
  }

  @Test fun aFailingPartIsDroppedAloneAndTheRestKept() {
    val badRecord = """{"version":1,"cards":{},"records":{"x/ALL#classic":7.5,"y/ALL#classic":2},"last":null}"""
    assertEquals(ReadResult(progressOf(records = mapOf("y/ALL#classic" to 2)), false), readProgress(badRecord))
    val badMode = """{"version":1,"cards":{},"records":{},"last":{"route":{"deckId":"a","sectionId":"ALL"},"mode":"daily"}}"""
    assertEquals(notWhole, readProgress(badMode))
    val cardsArray = """{"version":1,"cards":[],"records":{"y/ALL#classic":2},"last":null}"""
    assertEquals(ReadResult(progressOf(records = mapOf("y/ALL#classic" to 2)), false), readProgress(cardsArray))
  }

  @Test fun numbersFollowJavaScriptAndZod() {
    // 1e999 parses to Infinity, so only the entry that holds it is dropped.
    val infinite = readProgress(cardsOnly("""{"a":{"seen":1,"lastCorrect":true,"lastSeenAt":1e999},"b":{"seen":1,"lastCorrect":true,"lastSeenAt":2}}"""))
    assertEquals(ReadResult(progressOf(mapOf("b" to CardHistory(seen = 1, lastCorrect = true, lastSeenAt = 2.0))), false), infinite)
    val infiniteRecord = readProgress("""{"version":1,"cards":{},"records":{"a/ALL#classic":1e999,"b/ALL#classic":2},"last":null}""")
    assertEquals(ReadResult(progressOf(records = mapOf("b/ALL#classic" to 2)), false), infiniteRecord)
    // 2^53 is not a safe integer; the largest Int is kept.
    assertFalse(readProgress(cardsOnly("""{"a":{"seen":9007199254740992,"lastCorrect":true,"lastSeenAt":1}}""")).whole)
    assertEquals(2_147_483_647L, readProgress(cardsOnly("""{"a":{"seen":2147483647,"lastCorrect":true,"lastSeenAt":1}}""")).progress.cards["a"]?.seen)
    // A fractional lastSeenAt is kept, -0 stays -0, and a score written 7.0 is 7.
    assertEquals(1.5, readProgress(cardsOnly("""{"a":{"seen":1,"lastCorrect":true,"lastSeenAt":1.5}}""")).progress.cards["a"]?.lastSeenAt)
    val negativeZero = readProgress(cardsOnly("""{"a":{"seen":1,"lastCorrect":true,"lastSeenAt":-0}}"""))
    assertTrue(negativeZero.whole)
    assertEquals((-0.0).toRawBits(), negativeZero.progress.cards.getValue("a").lastSeenAt.toRawBits())
    val sevenPointZero = readProgress("""{"version":1,"cards":{},"records":{},"last":{"route":{"deckId":"a","sectionId":"ALL"},"mode":"classic","score":7.0,"total":10}}""")
    assertEquals(ReadResult(progressOf(last = lastA), true), sevenPointZero)
  }

  @Test fun unknownFieldsAreDroppedAndProtoIsAPlainKey() {
    val raw = """{"version":1,"theme":"night","cards":{"__proto__":{"seen":1,"lastCorrect":true,"lastSeenAt":1,"flagged":true},"bad":{"seen":-1}},"records":{},"last":null}"""
    assertEquals(ReadResult(progressOf(mapOf("__proto__" to CardHistory(seen = 1, lastCorrect = true, lastSeenAt = 1.0))), false), readProgress(raw))
  }

  @Test fun aLaterDuplicateKeyWinsAsInJsonParse() {
    val raw = """{"version":1,"cards":{},"records":{"a/ALL#classic":1,"a/ALL#classic":4},"last":null}"""
    assertEquals(mapOf("a/ALL#classic" to 4), readProgress(raw).progress.records)
  }

  @Test fun escapesInStringsAreDecoded() {
    val raw = """{"version":1,"cards":{"café-\"1\"":{"seen":1,"lastCorrect":true,"lastSeenAt":1}},"records":{},"last":null}"""
    assertEquals(setOf("café-\"1\""), readProgress(raw).progress.cards.keys)
  }

  @Test fun aUnicodeEscapeNeedsFourAsciiHexDigits() {
    for (escape in listOf("""\u+041""", """\u-041""", """\u0G41""", """\u004""")) {
      val raw = """{"version":1,"cards":{"x""" + escape + """":{"seen":1,"lastCorrect":true,"lastSeenAt":1}},"records":{},"last":null}"""
      assertEquals(notWhole, readProgress(raw), escape)
    }
  }

  @Test fun aLoneSurrogateEscapeIsKeptAsJavaScriptKeepsIt() {
    val raw = """{"version":1,"cards":{"\ud800x":{"seen":1,"lastCorrect":true,"lastSeenAt":1}},"records":{},"last":null}"""
    val read = readProgress(raw)
    assertEquals(setOf("\uD800x"), read.progress.cards.keys)
    assertEquals(ReadResult(read.progress, true), readProgress(progressJson(read.progress)))
  }

  // Rule 5: a seen count is a Long and keeps every safe integer, as the web does.
  @Test fun seenCountsUpToTheLargestSafeIntegerAreKept() {
    val bigSeen = readProgress(cardsOnly("""{"a":{"seen":2147483648,"lastCorrect":true,"lastSeenAt":1}}"""))
    assertEquals(ReadResult(progressOf(mapOf("a" to CardHistory(seen = 2_147_483_648L, lastCorrect = true, lastSeenAt = 1.0))), true), bigSeen)
    val safe = readProgress(cardsOnly("""{"a":{"seen":9007199254740991,"lastCorrect":true,"lastSeenAt":1}}"""))
    assertEquals(ReadResult(progressOf(mapOf("a" to CardHistory(seen = 9_007_199_254_740_991L, lastCorrect = true, lastSeenAt = 1.0))), true), safe)
    assertEquals("""{"version":1,"cards":{"a":{"seen":9007199254740991,"lastCorrect":true,"lastSeenAt":1}},"records":{},"last":null}""", progressJson(safe.progress))
  }

  // Decision D1: a record or score above Int.MAX_VALUE is a count the Kotlin types cannot hold; it fails its part alone.
  @Test fun recordsAndScoresAboveIntMaxAreDroppedAlone() {
    assertEquals(notWhole, readProgress("""{"version":1,"cards":{},"records":{"a/ALL#classic":3000000000},"last":null}"""))
    val bigScore = """{"version":1,"cards":{},"records":{},"last":{"route":{"deckId":"a","sectionId":"ALL"},"mode":"classic","score":2147483648,"total":10}}"""
    assertEquals(notWhole, readProgress(bigScore))
  }

  // Decision D2: more than 512 nested arrays or objects fail the parse instead of overflowing the stack.
  @Test fun nestingDeeperThan512ReadsNotWholeWithoutOverflowingTheStack() {
    fun withDeep(depth: Int) = """{"version":1,"cards":{},"records":{},"last":null,"deep":""" + "[".repeat(depth) + "]".repeat(depth) + "}"
    assertEquals(ReadResult(emptyProgress(), true), readProgress(withDeep(100)))
    assertEquals(notWhole, readProgress(withDeep(600)))
    assertEquals(notWhole, readProgress("[".repeat(200_000)))
  }
}
```

Two raw strings in this file start with four quote characters (the opening `"""` and a key's opening `"`), and in `aUnicodeEscapeNeedsFourAsciiHexDigits` and the `withDeep` helper a raw string starts with `":` or `"` as content after the opening `"""`. In the raw strings, `é`, `\"`, `\ud800` and `\u+041` are the JSON text's own escapes, read by `parseJson`; in the regular strings (`"café-\"1\""`, `"\uD800x"`) they are Kotlin escapes.

- [ ] **Step 15: Write the reading golden tests.**

`android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/ProgressReadGoldenTest.kt`. The progress is compared exactly, `lastSeenAt` bit for bit, so the `-0` case must stay `-0.0`. Every case matches the web, the seen count of 2^53 - 1 included (rule 5):

```kotlin
package com.eienmosu.truthy.engine

import com.eienmosu.truthy.engine.GoldenDecode.bool
import com.eienmosu.truthy.engine.GoldenDecode.field
import com.eienmosu.truthy.engine.GoldenDecode.isNull
import com.eienmosu.truthy.engine.GoldenDecode.string
import com.eienmosu.truthy.engine.ProgressGolden.exactly
import com.eienmosu.truthy.engine.ProgressGolden.progress
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

// native-data/golden/src.progress.progress.readProgress.json and parseProgress.json, computed by the TypeScript code.
class ProgressReadGoldenTest {
  // Every case must match the web exactly; a seen count of 2^53 - 1 is a Long and is kept (rule 5).
  private fun raw(case: GoldenCase): String? = field(case.input, "raw").let { if (isNull(it)) null else string(it) }

  @Test fun readProgressCases() {
    val file = Golden.load("src/progress/progress", "readProgress")
    assertTrue(file.cases.isNotEmpty())
    val failures = file.cases.mapNotNull { c ->
      val got = readProgress(raw(c))
      when {
        !exactly(got.progress, progress(field(c.output, "progress"))) -> "${c.name}: progress ${got.progress}"
        got.whole != bool(field(c.output, "whole")) -> "${c.name}: whole ${got.whole}"
        else -> null
      }
    }
    assertEquals(emptyList<String>(), failures)
  }

  @Test fun parseProgressCases() {
    val file = Golden.load("src/progress/progress", "parseProgress")
    assertTrue(file.cases.isNotEmpty())
    val failures = file.cases.mapNotNull { c ->
      val got = parseProgress(raw(c))
      when {
        !exactly(got, progress(c.output)) -> "${c.name}: got $got"
        else -> null
      }
    }
    assertEquals(emptyList<String>(), failures)
  }
}
```

- [ ] **Step 16: Run them and watch them fail.**

```bash
(cd android/Truthy && ./gradlew :engine:test --tests 'com.eienmosu.truthy.engine.ProgressRead*')
```

Expected: `> Task :engine:compileTestKotlin FAILED` with `Unresolved reference 'readProgress'.` and the same error for `ReadResult` and `parseProgress`, then `BUILD FAILED`. No test runs.

- [ ] **Step 17: Write the JSON parser.**

`android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/JsonValue.kt`:

```kotlin
package com.eienmosu.truthy.engine

// A strict JSON parser with JavaScript's JSON.parse results, for reading stored progress (reference 3.5).
// kotlinx's parseToJsonElement takes unquoted literals such as NaN or 01, and a reader that rejects 1e999
// would lose a whole stored value where the web drops only the part that holds it. Every number is a Double,
// as in JavaScript; a later duplicate key replaces an earlier one; strings keep lone surrogates.

internal sealed interface JsonValue {
  data object Null : JsonValue
  data class Bool(val value: Boolean) : JsonValue
  data class Num(val value: Double) : JsonValue
  data class Str(val value: String) : JsonValue
  data class Arr(val items: List<JsonValue>) : JsonValue
  data class Obj(val members: Map<String, JsonValue>) : JsonValue
}

// Decision D2: deeper nesting fails the parse instead of overflowing the stack.
private const val MAX_JSON_DEPTH = 512

// The value of a whole JSON text, or null when JSON.parse would throw.
internal fun parseJson(text: String): JsonValue? {
  val reader = StrictJsonReader(text)
  reader.skipWhitespace()
  val value = reader.value(0) ?: return null
  reader.skipWhitespace()
  return if (reader.index == text.length) value else null
}

private class StrictJsonReader(private val text: String) {
  var index = 0

  private fun current(): Char? = if (index < text.length) text[index] else null

  fun skipWhitespace() {
    while (index < text.length) {
      val c = text[index]
      if (c == ' ' || c == '\t' || c == '\n' || c == '\r') index += 1 else return
    }
  }

  // depth: how many arrays and objects enclose this value.
  fun value(depth: Int): JsonValue? {
    val c = current() ?: return null
    return when (c) {
      '{' -> if (depth >= MAX_JSON_DEPTH) null else members(depth + 1)
      '[' -> if (depth >= MAX_JSON_DEPTH) null else items(depth + 1)
      '"' -> string()?.let { JsonValue.Str(it) }
      't' -> literal("true", JsonValue.Bool(true))
      'f' -> literal("false", JsonValue.Bool(false))
      'n' -> literal("null", JsonValue.Null)
      else -> number()
    }
  }

  private fun literal(word: String, result: JsonValue): JsonValue? {
    if (!text.startsWith(word, index)) return null
    index += word.length
    return result
  }

  private fun members(depth: Int): JsonValue? {
    index += 1
    val members = LinkedHashMap<String, JsonValue>()
    skipWhitespace()
    if (current() == '}') {
      index += 1
      return JsonValue.Obj(members)
    }
    while (true) {
      skipWhitespace()
      if (current() != '"') return null
      val key = string() ?: return null
      skipWhitespace()
      if (current() != ':') return null
      index += 1
      skipWhitespace()
      val member = value(depth) ?: return null
      members[key] = member
      skipWhitespace()
      when (current()) {
        ',' -> index += 1
        '}' -> {
          index += 1
          return JsonValue.Obj(members)
        }
        else -> return null
      }
    }
  }

  private fun items(depth: Int): JsonValue? {
    index += 1
    val items = ArrayList<JsonValue>()
    skipWhitespace()
    if (current() == ']') {
      index += 1
      return JsonValue.Arr(items)
    }
    while (true) {
      skipWhitespace()
      val item = value(depth) ?: return null
      items.add(item)
      skipWhitespace()
      when (current()) {
        ',' -> index += 1
        ']' -> {
          index += 1
          return JsonValue.Arr(items)
        }
        else -> return null
      }
    }
  }

  // A string's UTF-16 code units, escapes decoded. Unescaped control characters fail, as in JSON.parse.
  private fun string(): String? {
    index += 1
    val out = StringBuilder()
    while (index < text.length) {
      val c = text[index]
      index += 1
      when {
        c == '"' -> return out.toString()
        c < ' ' -> return null
        c != '\\' -> out.append(c)
        else -> {
          val escape = current() ?: return null
          index += 1
          when (escape) {
            '"', '\\', '/' -> out.append(escape)
            'b' -> out.append('\b')
            'f' -> out.append('\u000C')
            'n' -> out.append('\n')
            'r' -> out.append('\r')
            't' -> out.append('\t')
            'u' -> {
              if (index + 4 > text.length) return null
              var code = 0
              for (k in 0 until 4) {
                val digit = hexDigit(text[index + k])
                if (digit < 0) return null
                code = code * 16 + digit
              }
              out.append(code.toChar())
              index += 4
            }
            else -> return null
          }
        }
      }
    }
    return null
  }

  // ASCII hex digits only; Character.digit would also take other scripts' digits.
  private fun hexDigit(c: Char): Int = when (c) {
    in '0'..'9' -> c - '0'
    in 'a'..'f' -> c - 'a' + 10
    in 'A'..'F' -> c - 'A' + 10
    else -> -1
  }

  private fun isDigit(c: Char?): Boolean = c != null && c in '0'..'9'

  // -? (0 | [1-9][0-9]*) (. [0-9]+)? ([eE] [+-]? [0-9]+)?, read as the nearest Double (1e999 is Infinity).
  private fun number(): JsonValue? {
    val start = index
    if (current() == '-') index += 1
    if (current() == '0') {
      index += 1
    } else if (isDigit(current())) {
      while (isDigit(current())) index += 1
    } else {
      return null
    }
    if (current() == '.') {
      index += 1
      if (!isDigit(current())) return null
      while (isDigit(current())) index += 1
    }
    if (current() == 'e' || current() == 'E') {
      index += 1
      if (current() == '+' || current() == '-') index += 1
      if (!isDigit(current())) return null
      while (isDigit(current())) index += 1
    }
    return JsonValue.Num(text.substring(start, index).toDouble())
  }
}
```

- [ ] **Step 18: Write the reading port.**

`android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/ProgressRead.kt`:

```kotlin
package com.eienmosu.truthy.engine

import kotlin.math.abs
import kotlin.math.truncate

// Reading a stored progress value part by part, a port of readProgress and parseProgress in
// src/progress/progress.ts and of the zod schemas they use (reference 3.5). Each card entry, each record and the
// last route stand on their own: one that fails is dropped alone, and the read is then not whole.
// Unknown fields are dropped.

// A stored value as read: the progress kept from it, and whether all of it was kept. When whole is false the raw
// value holds something the progress does not, which the store keeps aside before it writes over it.
data class ReadResult(val progress: Progress, val whole: Boolean)

// Number.MAX_SAFE_INTEGER, 2^53 - 1, exactly representable.
private const val STORED_SAFE_INTEGER_LIMIT = 9_007_199_254_740_991.0

// zod 4: z.number() rejects Infinity and NaN; z.int() accepts safe integers only; nonnegative is >= 0 (so -0 passes).
// A seen count: every such safe integer, held exactly by a Long (rule 5).
private fun storedSafeCount(value: JsonValue?): Long? {
  if (value !is JsonValue.Num) return null
  val n = value.value
  if (!n.isFinite() || n != truncate(n) || abs(n) > STORED_SAFE_INTEGER_LIMIT) return null
  if (n < 0) return null
  return n.toLong()
}

// A record, score or total. Decision D1: above Int.MAX_VALUE it cannot be held and fails like a negative one.
private fun storedCount(value: JsonValue?): Int? {
  val n = storedSafeCount(value) ?: return null
  if (n > Int.MAX_VALUE) return null
  return n.toInt()
}

private fun storedCardHistory(value: JsonValue): CardHistory? {
  if (value !is JsonValue.Obj) return null
  val seen = storedSafeCount(value.members["seen"]) ?: return null
  val lastCorrect = (value.members["lastCorrect"] as? JsonValue.Bool)?.value ?: return null
  val lastSeenAt = (value.members["lastSeenAt"] as? JsonValue.Num)?.value ?: return null
  if (!lastSeenAt.isFinite() || lastSeenAt < 0) return null
  return CardHistory(seen = seen, lastCorrect = lastCorrect, lastSeenAt = lastSeenAt)
}

private fun storedRecord(value: JsonValue): Int? = storedCount(value)

// A score or total: missing reads as null (stored before scores were kept), null is null, otherwise a count.
private class StoredOptionalCount(val ok: Boolean, val value: Int?)

private fun storedOptionalCount(value: JsonValue?): StoredOptionalCount {
  if (value == null || value == JsonValue.Null) return StoredOptionalCount(ok = true, value = null)
  val n = storedCount(value) ?: return StoredOptionalCount(ok = false, value = null)
  return StoredOptionalCount(ok = true, value = n)
}

private fun storedNonEmptyString(value: JsonValue?): String? {
  if (value !is JsonValue.Str || value.value.isEmpty()) return null
  return value.value
}

// The last route: null reads as null and succeeds; a missing key fails (undefined is not null in zod).
private class StoredLast(val success: Boolean, val last: LastRound?)

private fun storedLast(value: JsonValue?): StoredLast {
  if (value == null) return StoredLast(success = false, last = null)
  if (value == JsonValue.Null) return StoredLast(success = true, last = null)
  val fail = StoredLast(success = false, last = null)
  if (value !is JsonValue.Obj) return fail
  val route = value.members["route"] as? JsonValue.Obj ?: return fail
  val deckId = storedNonEmptyString(route.members["deckId"]) ?: return fail
  val sectionId = storedNonEmptyString(route.members["sectionId"]) ?: return fail
  val modeName = (value.members["mode"] as? JsonValue.Str)?.value ?: return fail
  val mode = Mode.entries.firstOrNull { it.wire == modeName } ?: return fail
  val score = storedOptionalCount(value.members["score"])
  val total = storedOptionalCount(value.members["total"])
  if (!score.ok || !total.ok) return fail
  return StoredLast(
    success = true,
    last = LastRound(route = Route(deckId = deckId, sectionId = sectionId), mode = mode, score = score.value, total = total.value),
  )
}

// The entries of a stored map that pass; a value that is not an object reads as empty and not whole.
private fun <T : Any> storedEntries(value: JsonValue?, parse: (JsonValue) -> T?): Pair<Map<String, T>, Boolean> {
  if (value !is JsonValue.Obj) return Pair(emptyMap(), false)
  val kept = LinkedHashMap<String, T>()
  var whole = true
  for ((key, entry) in value.members) {
    val parsed = parse(entry)
    if (parsed != null) kept[key] = parsed else whole = false
  }
  return Pair(kept, whole)
}

// Never throws. Nothing stored reads as empty and whole. Invalid JSON, a value that is not an object and any
// version other than the number 1 read as empty and not whole. Otherwise a card entry, a record or a last route
// that fails is dropped alone (the last route becomes null), and the rest is kept.
fun readProgress(raw: String?): ReadResult {
  if (raw == null) return ReadResult(emptyProgress(), true)
  val data = parseJson(raw)
  if (data !is JsonValue.Obj || data.members["version"] != JsonValue.Num(1.0)) return ReadResult(emptyProgress(), false)
  val (cards, cardsWhole) = storedEntries(data.members["cards"], ::storedCardHistory)
  val (records, recordsWhole) = storedEntries(data.members["records"], ::storedRecord)
  val last = storedLast(data.members["last"])
  return ReadResult(
    Progress(version = 1, cards = cards, records = records, last = last.last),
    cardsWhole && recordsWhole && last.success,
  )
}

// The progress kept from a stored value (see readProgress).
fun parseProgress(raw: String?): Progress = readProgress(raw).progress
```

`data.members["version"] != JsonValue.Num(1.0)` uses the data class's `equals`, which compares the `Double` with `Double.equals`: `1.0` and `1` (both parsed to `1.0`) match, `-0`, `2` and every non-number do not, as `data["version"] !== 1` decides on the web.

- [ ] **Step 19: Run them green.**

```bash
(cd android/Truthy && ./gradlew :engine:test --tests 'com.eienmosu.truthy.engine.ProgressRead*')
grep -h -o -E 'testsuite name="[^"]+" tests="[0-9]+" skipped="[0-9]+" failures="[0-9]+" errors="[0-9]+"' android/Truthy/engine/build/test-results/test/TEST-com.eienmosu.truthy.engine.ProgressRead*.xml
```

Expected: `BUILD SUCCESSFUL`, then:

```
testsuite name="com.eienmosu.truthy.engine.ProgressReadGoldenTest" tests="2" skipped="0" failures="0" errors="0"
testsuite name="com.eienmosu.truthy.engine.ProgressReadTest" tests="15" skipped="0" failures="0" errors="0"
```

The golden tests run plan A's 63 stored values through each function. A failure list that names any case is a parity bug: stop and find it.

- [ ] **Step 20: Commit.**

```bash
git add android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/JsonValue.kt android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/ProgressRead.kt android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/ProgressReadTest.kt android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/ProgressReadGoldenTest.kt
git commit -m "feat: read stored progress part by part in the Android engine"
```

- [ ] **Step 21: Write the store unit tests.**

`android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/LocalStoreTest.kt` ports `tests/progress/local.test.ts` and the side-key cases of `partial-read.test.ts`:

```kotlin
package com.eienmosu.truthy.engine

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

// Ports of tests/progress/local.test.ts and the side-key cases of partial-read.test.ts.
private class Refused : Exception("refused")

private class MemoryStorage : KeyValueStorage {
  val items = LinkedHashMap<String, String>()
  var refuseGet = false
  var refuseSet: Set<String> = emptySet()

  override fun getItem(key: String): String? {
    if (refuseGet) throw Refused()
    return items[key]
  }

  override fun setItem(key: String, value: String) {
    if (key in refuseSet) throw Refused()
    items[key] = value
  }
}

class LocalStoreTest {
  private val played = Progress(
    version = 1,
    cards = mapOf("aws-clf-c02-t2.1-06" to CardHistory(seen = 2, lastCorrect = true, lastSeenAt = 1_790_000_000_000.0)),
    records = mapOf("aws-clf-c02/SEC#classic" to 7),
    last = LastRound(route = Route(deckId = "aws-clf-c02", sectionId = "SEC"), mode = Mode.CLASSIC, score = 7, total = 10),
  )

  private val droppedPart =
    """{"version":1,"cards":{},"records":{"a/ALL#classic":7},"last":{"route":{"deckId":"a","sectionId":"ALL"},"mode":"daily"}}"""

  @Test fun keysAreTheWebKeys() {
    assertEquals("truthy.progress.v1", PROGRESS_KEY)
    assertEquals("truthy.progress.v1.unreadable", UNREADABLE_KEY)
  }

  @Test fun roundTripsAndLoadsTheLatestSave() {
    val storage = MemoryStorage()
    val store = createLocalStore(storage)
    assertEquals(emptyProgress(), store.load())
    store.save(played)
    assertEquals(played, createLocalStore(storage).load())
    store.save(emptyProgress())
    assertEquals(emptyProgress(), store.load())
    assertNull(storage.items[UNREADABLE_KEY])
  }

  @Test fun withoutAStorageLoadIsEmptyAndSaveDoesNothing() {
    val store = createLocalStore(null)
    store.save(played)
    assertEquals(emptyProgress(), store.load())
  }

  @Test fun storageFailuresNeverReachTheCaller() {
    val storage = MemoryStorage()
    val store = createLocalStore(storage)
    store.save(played)
    storage.refuseSet = setOf(PROGRESS_KEY, UNREADABLE_KEY)
    store.save(emptyProgress())
    assertEquals(played, store.load())
    storage.refuseGet = true
    assertEquals(emptyProgress(), store.load())
    store.save(emptyProgress())
  }

  @Test fun keepsAValueThatDidNotReadWholeUnderTheSideKeyBeforeWritingOverIt() {
    val raws = listOf(droppedPart, "{not json", "null", "[]", """{"version":2}""", """{"version":1,"cards":{},"records":{}}""")
    for (raw in raws) {
      val storage = MemoryStorage()
      storage.items[PROGRESS_KEY] = raw
      val store = createLocalStore(storage)
      store.save(store.load())
      assertEquals(raw, storage.items[UNREADABLE_KEY], raw)
      assertTrue(readProgress(storage.items[PROGRESS_KEY]).whole, raw)
    }
  }

  @Test fun keepsTheValidRecordsThroughASave() {
    val storage = MemoryStorage()
    storage.items[PROGRESS_KEY] = droppedPart
    val store = createLocalStore(storage)
    store.save(store.load())
    assertEquals(mapOf("a/ALL#classic" to 7), createLocalStore(storage).load().records)
  }

  @Test fun makesTheCopyOnceAndReplacesItWithALaterUnreadableValue() {
    val storage = MemoryStorage()
    val store = createLocalStore(storage)
    storage.items[PROGRESS_KEY] = "{first"
    store.save(played)
    assertEquals("{first", storage.items[UNREADABLE_KEY])
    storage.items[UNREADABLE_KEY] = "marker"
    store.save(emptyProgress())
    assertEquals("marker", storage.items[UNREADABLE_KEY])
    storage.items[PROGRESS_KEY] = "{second"
    store.save(played)
    assertEquals("{second", storage.items[UNREADABLE_KEY])
  }

  @Test fun doesNotWriteOverAValueThatCannotBeKeptAsideFirst() {
    val storage = MemoryStorage()
    storage.items[PROGRESS_KEY] = "{not json"
    storage.refuseSet = setOf(UNREADABLE_KEY)
    createLocalStore(storage).save(played)
    assertEquals("{not json", storage.items[PROGRESS_KEY])
  }

  @Test fun writesOverWhenTheSideKeyAlreadyHoldsTheValue() {
    val storage = MemoryStorage()
    storage.items[PROGRESS_KEY] = "{not json"
    storage.items[UNREADABLE_KEY] = "{not json"
    storage.refuseSet = setOf(UNREADABLE_KEY)
    createLocalStore(storage).save(played)
    assertEquals(played, createLocalStore(storage).load())
  }

  @Test fun aSavedValueReadsBackWhole() {
    val storage = MemoryStorage()
    createLocalStore(storage).save(played)
    assertEquals(ReadResult(played, true), readProgress(storage.items.getValue(PROGRESS_KEY)))
    assertEquals(ReadResult(emptyProgress(), true), readProgress(progressJson(emptyProgress())))
  }
}
```

- [ ] **Step 22: Write the store golden tests.**

`android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/LocalStoreGoldenTest.kt` runs the scripts of `src.progress.local.createLocalStore.json` (format under **Interfaces**) over a storage that can be broken step by step. The class names `StorageBroken` and `ScriptStorage` differ from step 21's on purpose: two private top-level classes of one name in one package clash on the JVM.

```kotlin
package com.eienmosu.truthy.engine

import com.eienmosu.truthy.engine.GoldenDecode.field
import com.eienmosu.truthy.engine.GoldenDecode.isNull
import com.eienmosu.truthy.engine.GoldenDecode.string
import com.eienmosu.truthy.engine.GoldenDecode.strings
import com.eienmosu.truthy.engine.ProgressGolden.exactly
import com.eienmosu.truthy.engine.ProgressGolden.progress
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject

// native-data/golden/src.progress.local.*.json. The createLocalStore cases are scripts over a storage held as
// plain data: steps run in order, and the output is what each load returned and the storage at the end.
//   load: store.load() into loads; save: store.save(progress); resave: store.save(store.load());
//   put: the script writes a key straight into the storage; breakGet: every getItem throws from here on;
//   breakSet: setItem throws from here on for the listed keys, or for every key when keys is "all".
// "storage": null is createLocalStore(null).
private class StorageBroken : Exception("storage broken")

private class ScriptStorage(initial: Map<String, String>) : KeyValueStorage {
  val items = LinkedHashMap(initial)
  var getBroken = false
  var setBroken: Set<String> = emptySet()
  var setBrokenForAll = false

  override fun getItem(key: String): String? {
    if (getBroken) throw StorageBroken()
    return items[key]
  }

  override fun setItem(key: String, value: String) {
    if (setBrokenForAll || key in setBroken) throw StorageBroken()
    items[key] = value
  }
}

class LocalStoreGoldenTest {
  // The stored progress is compared as a JSON value (Kotlin may write a rare number differently); any other
  // value exactly.
  private fun sameStoredValue(got: String, expected: String): Boolean {
    if (got == expected) return true
    val a = parseJson(got)
    return a is JsonValue.Obj && a == parseJson(expected)
  }

  @Test fun keys() {
    assertEquals(string(Golden.load("src/progress/local", "PROGRESS_KEY").cases.single().output), PROGRESS_KEY)
    assertEquals(string(Golden.load("src/progress/local", "UNREADABLE_KEY").cases.single().output), UNREADABLE_KEY)
  }

  @Test fun createLocalStoreScripts() {
    val file = Golden.load("src/progress/local", "createLocalStore")
    assertTrue(file.cases.isNotEmpty())
    val failures = mutableListOf<String>()
    for (c in file.cases) {
      val spec = field(c.input, "storage")
      val storage = if (isNull(spec)) null else ScriptStorage(field(spec, "items").jsonObject.mapValues { (_, v) -> string(v) })
      val store = createLocalStore(storage)
      val loads = mutableListOf<Progress>()
      for (step in field(c.input, "steps").jsonArray) {
        when (val op = string(field(step, "op"))) {
          "load" -> {
            loads.add(store.load())
          }
          "save" -> {
            store.save(progress(field(step, "progress")))
          }
          "resave" -> {
            store.save(store.load())
          }
          "put" -> {
            storage?.items?.put(string(field(step, "key")), string(field(step, "value")))
          }
          "breakGet" -> {
            storage?.getBroken = true
          }
          "breakSet" -> {
            val keys = field(step, "keys")
            if (keys is JsonPrimitive && keys.isString && keys.content == "all") {
              storage?.setBrokenForAll = true
            } else {
              storage?.setBroken = strings(keys).toSet()
            }
          }
          else -> error("${c.name}: unknown op $op")
        }
      }
      val expectedLoads = field(c.output, "loads").jsonArray.map { progress(it) }
      if (loads.size != expectedLoads.size) failures.add("${c.name}: ${loads.size} loads, want ${expectedLoads.size}")
      loads.zip(expectedLoads).forEachIndexed { i, (got, want) ->
        if (!exactly(got, want)) failures.add("${c.name}: load $i is $got")
      }
      val expectedItems = field(c.output, "items")
      if (isNull(expectedItems)) {
        if (storage != null) failures.add("${c.name}: a storage where none was expected")
        continue
      }
      if (storage == null) {
        failures.add("${c.name}: no storage")
        continue
      }
      val want = expectedItems.jsonObject.mapValues { (_, v) -> string(v) }
      if (storage.items.keys != want.keys) failures.add("${c.name}: keys ${storage.items.keys}")
      for ((key, value) in want) {
        val got = storage.items[key] ?: ""
        if (!sameStoredValue(got, value)) failures.add("${c.name}: $key is $got")
      }
    }
    assertEquals(emptyList<String>(), failures)
  }
}
```

- [ ] **Step 23: Run them and watch them fail.**

```bash
(cd android/Truthy && ./gradlew :engine:test --tests 'com.eienmosu.truthy.engine.LocalStore*')
```

Expected: `> Task :engine:compileTestKotlin FAILED` with `Unresolved reference 'KeyValueStorage'.` and the same error for `createLocalStore`, `PROGRESS_KEY` and `UNREADABLE_KEY`, then `BUILD FAILED`. No test runs.

- [ ] **Step 24: Write the store port.**

`android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/LocalStore.kt`:

```kotlin
package com.eienmosu.truthy.engine

// The progress store over a key-value storage, a port of src/progress/local.ts (reference 3.5 and 6).
// The engine holds no storage of its own: the app hands it one (task 9 backs it with AtomicFile). A storage that
// throws never reaches the player: load gives the parts of the stored value that still read, and save does
// nothing when it cannot write or cannot first keep an unreadable value aside.

const val PROGRESS_KEY = "truthy.progress.v1"

// Where a stored value that did not read back whole is kept before the store writes over it, so a later version
// can still recover what this one could not read. It holds the latest such value only.
const val UNREADABLE_KEY = "truthy.progress.v1.unreadable"

// The two operations of the web's Storage that the store uses. Either may throw (blocked, full, broken).
interface KeyValueStorage {
  fun getItem(key: String): String?
  fun setItem(key: String, value: String)
}

// The TypeScript ProgressStore of local.ts. In the app that name belongs to the suspend store interface of
// task 9, so the engine's synchronous store is LocalStore.
class LocalStore internal constructor(private val storage: KeyValueStorage?) {
  fun load(): Progress {
    if (storage == null) return emptyProgress()
    return try {
      parseProgress(storage.getItem(PROGRESS_KEY))
    } catch (e: Exception) {
      emptyProgress()
    }
  }

  fun save(progress: Progress) {
    if (storage == null) return
    try {
      keepUnreadable(storage)
      storage.setItem(PROGRESS_KEY, progressJson(progress))
    } catch (e: Exception) {
      // Full or blocked storage: play goes on, this round is simply not remembered. When the stored value
      // could not be kept aside first, it is not written over either.
    }
  }
}

fun createLocalStore(storage: KeyValueStorage?): LocalStore = LocalStore(storage)

// The side-copy decision: copies the stored value to UNREADABLE_KEY when part or all of it was dropped on reading
// and the side key does not already hold exactly that value (String equality compares UTF-16 code units, as
// JavaScript's === does). Nothing stored reads as whole, so it makes no copy. The first save over such a value
// replaces it with one that reads whole, so the copy is made once per value. A throw from either key stops the
// save that called it.
fun keepUnreadable(storage: KeyValueStorage) {
  val raw = storage.getItem(PROGRESS_KEY)
  if (raw == null || readProgress(raw).whole || storage.getItem(UNREADABLE_KEY) == raw) return
  storage.setItem(UNREADABLE_KEY, raw)
}
```

- [ ] **Step 25: Run them green.**

```bash
(cd android/Truthy && ./gradlew :engine:test --tests 'com.eienmosu.truthy.engine.LocalStore*')
grep -h -o -E 'testsuite name="[^"]+" tests="[0-9]+" skipped="[0-9]+" failures="[0-9]+" errors="[0-9]+"' android/Truthy/engine/build/test-results/test/TEST-com.eienmosu.truthy.engine.LocalStore*.xml
```

Expected: `BUILD SUCCESSFUL`, then:

```
testsuite name="com.eienmosu.truthy.engine.LocalStoreGoldenTest" tests="2" skipped="0" failures="0" errors="0"
testsuite name="com.eienmosu.truthy.engine.LocalStoreTest" tests="10" skipped="0" failures="0" errors="0"
```

- [ ] **Step 26: Run the gates.**

```bash
(cd android/Truthy && ./gradlew :engine:test 2>&1 | grep -E '^(w|e): |BUILD')
grep -h -o -E 'tests="[0-9]+" skipped="[0-9]+" failures="[0-9]+" errors="[0-9]+"' android/Truthy/engine/build/test-results/test/TEST-*.xml | awk -F'"' '{t+=$2; s+=$4; f+=$6; e+=$8} END {print t, s, f, e}'
```

Expected: no `w:` or `e:` line, then `BUILD SUCCESSFUL`. The sum line reads `N 0 0 0`, where N is task 3's total plus 63 (14 swipe, 20 progress, 17 reading, 12 store), and task 1's purity test passes over the five new sources.

```bash
git add -N android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/LocalStore.kt android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/LocalStoreTest.kt android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/LocalStoreGoldenTest.kt
pnpm test
```

Expected: every test file passes. `tests/repo-hygiene.test.ts` now scans the new Kotlin files (marked intent-to-add), and its native rules find no em dash, local path or e-mail-shaped string in them.

- [ ] **Step 27: Commit.**

```bash
git add android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/LocalStore.kt android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/LocalStoreTest.kt android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/LocalStoreGoldenTest.kt
git commit -m "feat: port the progress store and its unreadable side copy to the Android engine"
```

**How this task was checked during drafting:** nothing in it was compiled or run while the plan was written. What was checked instead:
- The expected texts of `progressJsonWritesWholeNumbersAsIntegersAndNonFiniteAsNull` and `progressJsonEscapesStringsAsJsonStringifyDoes` are what Node's `JSON.stringify` printed for the same values, and Node's `JSON.parse` rejects `"\u+041"`.
- Every swipe unit case was traced by hand through `swipe.ts`; the swipe, progress, reading and store unit cases are the ones plan B's task 4 ran against the TypeScript-equivalent Swift code, except the Kotlin-only cases (D1, D2, the `\u` digits, the lone surrogate, the unchanged inputs).
- The kotlinx-serialization JSON element API (`jsonObject`, `jsonArray`, `jsonPrimitive`, `JsonPrimitive.boolean`) and Kotlin's floating-point equality (`==` on a statically typed `Double` is IEEE 754; `equals`, and so a data class, tells `-0.0` from `0.0`) were checked against kotlinlang.org.
- **What ran after the review:** the compile, every test, and the run against plan A's real `native-data/golden` (README, Drafting record).
