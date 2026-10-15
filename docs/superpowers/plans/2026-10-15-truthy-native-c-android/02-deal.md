### Task 2: Dealing: `deal`, `dealChunk` and every internal of `deal.ts`, against all dealing vectors

This task ports `src/engine/deal.ts` to the Kotlin engine line by line: the two entry points `deal` and `dealChunk`, the constants `DEAL`, `CHUNK`, `SEARCH_BUDGET` and `OVERDUE_AFTER_PASSES`, and every internal step reference 3.9 lists as ported (`dealRanked`, `uniqueById`, `dealSize`, `wasSeen`, `wasMissed`, `lastSeenAt`, `oldestFirst`, `rankByPriority`, `balanceFor`, `choose`, `searchOverCap`, `searchWithAllRules` with `canStillFinish`, `relaxStepByStep`, `sharesGroup`, `trueCount`, `balanceAllows`, `arrange`, `joinOf`, `runLimit`, `placementCheck`, `pickAnswer`). Dealing is the first parity risk of the spec (section 11, risk 1): one rng draw out of order or one unstable sort changes every card dealt after it, silently. So the port is checked twice. A reference suite writes out the exact vectors of the web's own tests (`tests/engine/deal-pins-polish.test.ts`, `tests/engine/overdue-boundary.test.ts`, the edges of `tests/engine/deal.test.ts`), the exact number of rng draws of a first chunk, and the two Kotlin-specific traps of the sort and of `lastSeenAt`; it needs no golden file. A golden suite then reads every `native-data/golden/src.engine.deal.*.json` file that plan A task 5 wrote and runs each case through the Kotlin function of the same name, internals included, so a wrong step shows up at that step and not only in the cards it deals at the end. The round reducer of task 3 is the only caller in the app: it calls `dealChunk`.

The shapes of the tests, the guards and the decoding rules match plan B's task 2 (`docs/superpowers/plans/2026-10-15-truthy-native-b-ios/02-deal.md`), so both platforms read the same vectors the same way.

Builds on task 1: the Gradle project `android/Truthy` with the `:engine` module, the content types, `createRng`, `shuffle`, the golden loader and the purity test (which scans the new `Deal.kt` like every engine source).

**Not compiled while drafting.** Nothing in this file was compiled or run while the plan was written, so the Kotlin below was written against the current Kotlin and kotlinx.serialization APIs. After the review, tasks 1 to 6 were assembled from these files and run with the Android Studio JBR against plan A's real `native-data`: this task's tests compiled and passed at its own end and in the final state of task 6, and step 8's planted fault failed as stated (README, Drafting record). The TypeScript facts it states (the reference vectors, the draw counts 31, 31 and 32, the empty deals before any draw, the fractional count and the duplicated pool) were run against the repository's own `src/engine/deal.ts` while drafting. If a step's output differs from the one stated, stop and find out why before going on.

**Files:**
- Create: `android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/Deal.kt`
- Test: create `android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/DealReferenceTest.kt`, `android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/DealGoldenTest.kt`

**Interfaces:**
- Consumes (task 1). The README fixes `Card` (`@Serializable`, decoded from the shipped card JSON), `CardHistory(val seen: Long, val lastCorrect: Boolean, val lastSeenAt: Double)`, `typealias History = Map<String, CardHistory>`, `typealias Rng = () -> Double` and `fun createRng(seed: Double): Rng`. Task 1 also defines, under these names (see "Assumed from other tasks" at the end):

```kotlin
// engine/src/main/kotlin/com/eienmosu/truthy/engine (task 1)
fun <T> shuffle(items: List<T>, rng: Rng): List<T>     // Fisher-Yates from the end, items.size - 1 draws, a new list

// engine/src/test/kotlin/com/eienmosu/truthy/engine, the golden loader (task 1), on kotlinx.serialization.json
class GoldenCase(val name: String, val input: JsonElement, val output: JsonElement)
class GoldenFile(val module: String, val function: String, val cases: List<GoldenCase> /* and the card table */) {
  fun card(value: JsonElement, decks: File = Golden.decksDirectory): Card            // {"$card": id} through the file's card table
  fun cards(value: JsonElement, decks: File = Golden.decksDirectory): List<Card>     // an array of card references, or {"$deck": id} (native-data/decks/<id>.json, file order)
  fun rng(value: JsonElement): Rng              // {"$rng": {"seed": n}} is createRng(n); {"$rng": {"values": [...]}} returns them in order and throws when they run out
}
object Golden {
  val directory: File                                         // native-data/golden, from the system property truthy.golden
  fun load(module: String, function: String): GoldenFile      // "<module with / as .>.<function>.json"; DEAL is "src.engine.deal.DEAL.constant.json"
}
```

  The `:engine` test source set has `kotlin-test-junit` (task 1's catalog alias `libs.kotlin.test.junit`: the `kotlin.test` annotations and assertions, on JUnit 4) and `kotlinx-serialization-json`.

- Produces. Public, under the naming rule of the README (task 3 and the app use only these):

```kotlin
data class DealConstants(val missedPerTen: Int, val minTrue: Int, val maxTrue: Int, val maxRun: Int)
val DEAL: DealConstants                 // missedPerTen 3, minTrue 4, maxTrue 6, maxRun 3
const val CHUNK: Int = 10
const val SEARCH_BUDGET: Double = 20_000.0
data class DealOptions(val count: Double, val avoid: List<Card>? = null, val before: List<Boolean>? = null, val budget: Double? = null)
fun deal(pool: List<Card>, history: History, rng: Rng, options: DealOptions): List<Card>
fun dealChunk(pool: List<Card>, history: History, rng: Rng, dealt: List<Card>, budget: Double = SEARCH_BUDGET): List<Card>
```

  Internal (`internal`, read by the module's own tests; the TypeScript names and parameter order):

```kotlin
internal data class Setting(val avoid: List<Card>? = null, val before: List<Boolean>? = null, val budget: Double? = null, val overdue: Boolean? = null)
internal data class Join(val last: Boolean?, val run: Int)
internal data class Ranking(val withinCap: List<Card>, val overCap: List<Card>, val comeBack: List<Card>, val missed: Set<String>, val missedCap: Int)
internal data class Balance(val minTrue: Int, val maxTrue: Int)
internal data class Limits(val budget: Double? = null, val missed: Set<String>? = null, val missedLimit: Int? = null)
internal data class Rules(val conflicts: Boolean, val balance: Boolean)
internal const val OVERDUE_AFTER_PASSES: Int = 2
internal fun dealRanked(ranking: Ranking, size: Int, rng: Rng, setting: Setting): List<Card>
internal fun joinOf(before: List<Boolean>): Join
internal fun uniqueById(pool: List<Card>): List<Card>
internal fun dealSize(count: Double, available: Int): Int
internal fun wasSeen(card: Card, history: History): Boolean
internal fun wasMissed(card: Card, history: History): Boolean
internal fun lastSeenAt(card: Card, history: History): Double
internal fun stableSorted(cards: List<Card>, key: (Card) -> Double): List<Card>   // the port's sort, no TypeScript twin
internal fun oldestFirst(cards: List<Card>, history: History): List<Card>
internal fun rankByPriority(cards: List<Card>, history: History, rng: Rng, size: Int): Ranking
internal fun balanceFor(size: Int): Balance
internal fun choose(ranking: Ranking, size: Int, avoid: List<Card>, budget: Double, overdue: Boolean): List<Card>
internal fun searchOverCap(ranking: Ranking, unshown: List<Card>, search: (List<Card>, Limits) -> List<Card>?): List<Card>?
internal fun searchWithAllRules(ranked: List<Card>, size: Int, avoid: List<Card>, balance: Balance, limits: Limits = Limits()): List<Card>?
internal fun relaxStepByStep(ranked: List<Card>, size: Int, avoid: List<Card>, balance: Balance, first: List<Card> = emptyList()): List<Card>
internal fun sharesGroup(card: Card, others: List<Card>): Boolean
internal fun trueCount(cards: List<Card>): Int
internal fun balanceAllows(answer: Boolean, trues: Int, falses: Int, size: Int, balance: Balance): Boolean
internal fun arrange(chosen: List<Card>, rng: Rng, join: Join): List<Card>
internal fun runLimit(trues: Int, falses: Int, join: Join): Int
internal fun placementCheck(limit: Int): (Int, Int, Boolean?, Int) -> Boolean
internal fun pickAnswer(allowed: List<Boolean>, trues: Int, falses: Int, rng: Rng): Boolean
```

**Rules:**

1. **Order of the draws.** Exactly as reference 3.2, "RNG draws, in order": `dealChunk` shuffles only the unshown cards (never the whole pool, never `comeBack`), the search draws nothing, `arrange` shuffles the chosen True cards and then the chosen False cards, and `pickAnswer` draws only when both answers are allowed. `deal` with a size of 0 (a count that is NaN or at most 0, or an empty pool) returns an empty list before any draw. In `dealChunk`, `rankByPriority` runs (and draws) while the arguments of `dealRanked` are evaluated, before `arrange` draws, as in the TypeScript. The reference suite pins the draw count of three first chunks (31, 31 and 32, counted with the TypeScript on the same pool); the golden suite hands `rankByPriority`, `dealRanked`, `arrange` and `pickAnswer` their rng as a list of values and fails unless each uses all of them.
2. **Numbers the TypeScript lets through.** `DealOptions.count` and every budget are `Double`, as the web's tests pass `count: 4.7`, `count: -3` and a budget of `Infinity` (`dealChunk(..., dealt, Infinity)` in `tests/content/shipped-dealing-polish.test.ts`); `Infinity - 1` stays `Infinity`, so the search never runs out. `dealSize` floors the count and caps it at the cards there are. `Limits.missedLimit` is `Int?`: null is the TypeScript's `Infinity`, read as `Int.MAX_VALUE` inside the search, where no expression with it can overflow (`missedTaken` is never negative, so `missedLimit - missedTaken` stays in range, and `missedLeft - (Int.MAX_VALUE - missedTaken)` stays above `Int.MIN_VALUE`). The floors and the ceiling of `balanceFor` and the missed cap use `kotlin.math.floor` and `kotlin.math.ceil` on a `Double` divided by `10.0`, as `Math.floor` and `Math.ceil`.
3. **Stable sorts, `-0` and identity.** `oldestFirst` sorts through `stableSorted`, which breaks ties by position (spec 4.4): equal `lastSeenAt` keep their shuffled order. Never sort `Double` keys with `compareBy`, `sortedBy` or `Double.compareTo`: those use the total order, where `-0.0` is less than `0.0` (kotlinlang.org, "Numbers", floating-point comparison), while the TypeScript's `a - b` is 0 for them. `stableSorted` subtracts the keys and compares the difference with `0.0` through `<` and `>` on statically typed `Double`, which is IEEE 754 comparison. A non-finite or missing `lastSeenAt` counts as 0; a `-0` entry is finite and comes back as `-0.0`. The `comeBack` order sorts distinct `Int` positions with `sortedBy`, which is stable and has no such trap. Cards are compared by `id` everywhere: `choose` asks whether the chosen deal holds an unshown card through a set of ids, where the TypeScript uses `includes` on the same objects. `unshown[0]` in the overdue rule is the first card of the ranked list (`withinCap` then `overCap`), not of the deck.
4. **Memo and recursion.** `placementCheck(limit)` returns a lambda over a recursive local function and a `HashMap<String, Boolean>` memo keyed exactly as the TypeScript's `"t,f,last,run"` (Kotlin prints a null `last` as `null`, as JavaScript does). `visit` decrements the budget after the full-deal check and before `canStillFinish`, exactly as `budget-- <= 0` (reference 3.2, step 7). The recursion of `visit` is at most one level per ranked card (a few hundred for a whole shipped deck), well inside the default stack of the test worker.
5. **No labels and no labelled `this`.** The code uses `if` and `else` expressions instead of `return@label`, and no labelled `this`, so nothing in these files looks like an e-mail address to the hygiene rules (README, global constraints).
6. **Purity.** `Deal.kt` imports only `kotlin.math.ceil` and `kotlin.math.floor` and names no clock, generator, timer, storage or UI type. Its comments avoid those words too (no "random", "time", "clock", "file", "thread"), in case task 1's purity scan reads comments.
7. **Golden inputs, as plan A task 5 writes them.** Every argument is a key of `input`, named after the TypeScript parameter; an argument left `undefined` has no key and becomes null or the Kotlin default. Card ids carry their scenario's name (`pins:c3`), which changes nothing in a deal. The shapes that are not plain values:

| File (`src.engine.deal.<function>.json`) | `input` keys | Note |
|---|---|---|
| `deal` | `pool`, `history`, `rng`, `options` (`count`, `avoid`?, `before`?, `budget`?) | `pool` may be `{"$deck": id}`; `count` may be a `$number` tag |
| `dealChunk` | `pool`, `history`, `rng`, `dealt`, `budget`? | no `budget` key: the default `SEARCH_BUDGET`; `budget` may be `{"$number": "Infinity"}` |
| `rankByPriority` | `cards`, `history`, `rng`, `size` | output is a ranking: `withinCap`, `overCap`, `comeBack`, `missed` (the ids, an array), `missedCap` |
| `dealRanked` | `ranking`, `size`, `rng` (values), `setting` (`avoid`?, `before`?, `budget`?, `overdue`?) | |
| `choose` | `ranking`, `size`, `avoid`, `budget`, `overdue` | |
| `searchOverCap` | `ranking`, `unshown`, `search` (`size`, `avoid`, `budget`) | the test builds the search `choose` hands over |
| `searchWithAllRules` | `ranked`, `size`, `avoid`, `balance`, `limits` (`budget`?, `missed`? as ids, `missedLimit`?) | output `null` is no deal |
| `relaxStepByStep` | `ranked`, `size`, `avoid`, `balance`, `first` | |
| `arrange` | `chosen`, `rng` (values), `join` (`last`: `true`, `false` or `null`; `run`) | |
| `joinOf`, `runLimit`, `placementCheck` | `before`; `trues`, `falses`, `join`; `limit`, `t`, `f`, `last`, `run` | |
| `pickAnswer` | `allowed`, `trues`, `falses`, `rng` (values) | an empty list of values proves the call draws nothing |
| `wasSeen`, `wasMissed`, `lastSeenAt`, `oldestFirst` | `card` or `cards`, `history` | the history kinds include NaN, infinite and `-0` values |
| `uniqueById`, `dealSize`, `balanceFor`, `balanceAllows`, `sharesGroup`, `trueCount` | the parameter names | |
| `DEAL`, `CHUNK`, `SEARCH_BUDGET`, `OVERDUE_AFTER_PASSES` | `null` | output is the value |

   If plan A's files differ from this table, the decoding in `DealGoldenTest.kt` follows the files; `Deal.kt` does not change.
8. **A `seen` that is not a whole number.** `CardHistory.seen` is a `Long` (task 1), and every stored entry is a non-negative safe integer (`readProgress` keeps only those). The web pins dealing over a corrupt history (`deal.test.ts`, "still deals a full, valid round from a history with corrupt numbers": `seen: NaN`, `seen: -4`), and plan A writes those cases. Dealing asks one thing of `seen`, `seen > 0`, so the golden suite reads histories with its own decoder: a `seen` that is a whole number of at most 2^53 in size is that number, any other `seen` becomes 1 when it is above 0 and 0 otherwise (NaN is not above 0). The case is read and checked, not skipped (spec 7.1). Plan B reads them the same way.
9. **The constant `DEAL` and the function `deal`.** Plan A names the constant DEAL `src.engine.deal.DEAL.constant.json` (plan A README, "The golden vector format", and task 4 rule 1), because `DEAL.json` and `deal.json` are one file on a disk that ignores case; task 1's `Golden.fileName` maps it, and the suite's `checked` still asserts that each file holds the function it was asked for. The `coverage` test strips `.constant` as well as `.json` before it compares the folder with the list of 27 names.
10. **Test helpers stay inside the test classes.** The JSON helpers of the golden suite are private members of `DealGoldenTest`, and the card builders private members of `DealReferenceTest`, so they never clash with a same-named helper of task 1's loader or of a later task's tests in the same package (a member wins over a top-level declaration).
11. **Every load is two string literals** (task 1's coverage scan). Each test calls `Golden.load("src/engine/deal", "<name>")` with both arguments written out and hands the file to `checked`; a load through a variable would leave its file counted as untested, and task 1's `everyLoadCallNamesItsFileWithTwoLiterals` fails on it.

**Steps:**

- [ ] **Step 1: Write the reference tests.**

`android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/DealReferenceTest.kt`:

```kotlin
// The exact reference vectors of the web's dealing tests, written out here so that they hold even before
// a golden vector is read: tests/engine/deal-pins-polish.test.ts and tests/engine/overdue-boundary.test.ts,
// the edges of tests/engine/deal.test.ts that decide whether the rng is touched at all, and the two traps
// a Kotlin port meets on its own: -0.0 against 0.0 in a sort, and a lastSeenAt that is not finite.
package com.eienmosu.truthy.engine

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.add
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.putJsonObject
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class DealReferenceTest {
    // A card as the web tests build it (section "SEC", difficulty 2, an AWS source), decoded from its JSON so
    // that the test depends only on the shipped card shape.
    private fun card(id: String, answer: Boolean, conflictGroups: List<String> = emptyList()): Card =
        Json.decodeFromJsonElement(
            Card.serializer(),
            buildJsonObject {
                put("id", id)
                put("section", "SEC")
                putJsonObject("text") {
                    putJsonObject("en") {
                        put("statement", "Statement $id")
                        put("explanation", "Explanation $id")
                    }
                }
                put("answer", answer)
                putJsonObject("source") {
                    put("title", "AWS documentation")
                    put("url", "https://docs.aws.amazon.com/")
                }
                put("difficulty", 2)
                put("appliesTo", "")
                putJsonArray("conflictGroups") { conflictGroups.forEach { add(it) } }
            },
        )

    private fun cards(prefix: String, n: Int, answer: (Int) -> Boolean = { it % 2 == 0 }): List<Card> =
        (0 until n).map { card("$prefix${it + 1}", answer(it)) }

    private fun missed(lastSeenAt: Double) = CardHistory(seen = 1, lastCorrect = false, lastSeenAt = lastSeenAt)

    private fun right(lastSeenAt: Double) = CardHistory(seen = 1, lastCorrect = true, lastSeenAt = lastSeenAt)

    private fun ids(dealt: List<Card>): List<String> = dealt.map { it.id }

    // An rng that counts its draws.
    private class Draws(private val source: Rng) {
        var count = 0
        val rng: Rng = {
            count += 1
            source()
        }
    }

    // 16 cards with answers True, False, True, ...; c3 and c8 share group a, c5 and c12 share group b; c1 and c6
    // were missed, c2 was answered right.
    private val pinsPool: List<Card> = (0 until 16).map { i ->
        val groups = if (i == 2 || i == 7) listOf("a") else if (i == 4 || i == 11) listOf("b") else emptyList()
        card("c${i + 1}", i % 2 == 0, groups)
    }
    private val pinsHistory: History = mapOf(
        "c1" to missed(5.0),
        "c2" to CardHistory(seen = 2, lastCorrect = true, lastSeenAt = 9.0),
        "c6" to missed(3.0),
    )

    // c1 to c3 (True) and c4 to c8 (False) were missed, oldest first; c9 to c15 (True) were never seen; c16 (False)
    // was answered right. c5 and c10 share group b.
    private val overCapPool: List<Card> = (0 until 16).map { i ->
        card("c${i + 1}", i < 3 || (i >= 8 && i < 15), if (i == 4 || i == 9) listOf("b") else emptyList())
    }
    private val overCapHistory: History =
        overCapPool.take(8).mapIndexed { i, c -> c.id to missed((i + 1).toDouble()) }.toMap() + ("c16" to right(9.0))

    @Test
    fun constants() {
        assertEquals(DealConstants(missedPerTen = 3, minTrue = 4, maxTrue = 6, maxRun = 3), DEAL)
        assertEquals(10, CHUNK)
        assertEquals(20_000.0, SEARCH_BUDGET)
        assertEquals(2, OVERDUE_AFTER_PASSES)
    }

    @Test
    fun referencePool() {
        val vectors = listOf(
            1.0 to listOf("c3", "c10", "c16", "c9", "c5", "c6", "c7", "c14", "c15", "c1"),
            2.0 to listOf("c11", "c13", "c8", "c10", "c14", "c9", "c16", "c15", "c1", "c6"),
            3.0 to listOf("c9", "c6", "c1", "c16", "c4", "c13", "c14", "c11", "c5", "c8"),
        )
        for ((seed, expected) in vectors) {
            assertEquals(expected, ids(deal(pinsPool, pinsHistory, createRng(seed), DealOptions(count = 10.0))), "deal, seed $seed")
            // dealChunk with nothing dealt takes the same path as deal with a count of ten (chunks.test.ts).
            assertEquals(expected, ids(dealChunk(pinsPool, pinsHistory, createRng(seed), emptyList())), "dealChunk, seed $seed")
        }
    }

    @Test
    fun threeChunks() {
        val dealt = mutableListOf<Card>()
        for (k in 0 until 3) dealt += dealChunk(pinsPool, pinsHistory, createRng(100.0 + k), dealt.toList())
        assertEquals(
            listOf(
                "c11", "c6", "c14", "c9", "c13", "c10", "c3", "c16", "c1", "c15",
                "c7", "c4", "c12", "c8", "c5", "c2",
                "c6", "c14", "c11", "c10", "c9", "c13",
            ),
            ids(dealt),
        )
    }

    @Test
    fun overCap() {
        val vectors = listOf(
            1.0 to listOf("c10", "c7", "c6", "c12", "c15", "c16", "c13", "c4", "c9", "c14"),
            2.0 to listOf("c13", "c11", "c4", "c14", "c6", "c16", "c10", "c15", "c9", "c7"),
            3.0 to listOf("c9", "c16", "c10", "c4", "c7", "c14", "c13", "c6", "c11", "c15"),
        )
        for ((seed, expected) in vectors) {
            assertEquals(expected, ids(deal(overCapPool, overCapHistory, createRng(seed), DealOptions(count = 10.0))), "seed $seed")
        }
    }

    @Test
    fun overdue() {
        // 21 cards with answers True, False, True, ...; k1 and k12 share group pair. k1 is overdue in the sixth chunk.
        val route = (0 until 21).map { i -> card("k${i + 1}", i % 2 == 0, if (i == 0 || i == 11) listOf("pair") else emptyList()) }
        val dealt = mutableListOf<Card>()
        for (k in 0 until 6) dealt += dealChunk(route, emptyMap(), createRng(210.0 + k), dealt.toList())
        assertEquals(
            listOf(
                "k7", "k3", "k15", "k8", "k12", "k19", "k4", "k14", "k17", "k11",
                "k9", "k10", "k16", "k6", "k21", "k5", "k18", "k2", "k20", "k13",
                "k7", "k11", "k12", "k19", "k3", "k17", "k14", "k4", "k15", "k8",
                "k6", "k13", "k9", "k20", "k5", "k2", "k16", "k21", "k10", "k18",
                "k15", "k7", "k14", "k17", "k4", "k3", "k19", "k8", "k11", "k12",
                "k20", "k1", "k9", "k21", "k2", "k5", "k13", "k10", "k16", "k6",
            ),
            ids(dealt),
        )
    }

    @Test
    fun overdueBoundary() {
        // 25 cards; each of k1 to k5 shares a group with the card eleven places later. k1 is overdue at exactly 50.
        val route = (0 until 25).map { i ->
            val pair = if (i < 5) i else i - (CHUNK + 1)
            card("k${i + 1}", i % 2 == 0, if (pair in 0 until 5) listOf("pair${pair + 1}") else emptyList())
        }
        val dealt = mutableListOf<Card>()
        for (k in 0 until 6) dealt += dealChunk(route, emptyMap(), createRng(150.0 + k), dealt.toList())
        assertFalse("k1" in ids(dealt.take(50)))
        assertEquals(
            listOf(
                "k15", "k23", "k2", "k6", "k10", "k11", "k22", "k5", "k24", "k14",
                "k12", "k7", "k25", "k21", "k18", "k17", "k20", "k8", "k9", "k19",
                "k3", "k10", "k16", "k6", "k13", "k4", "k22", "k11", "k23", "k24",
                "k12", "k21", "k17", "k19", "k18", "k8", "k25", "k20", "k9", "k7",
                "k10", "k5", "k15", "k23", "k24", "k6", "k22", "k11", "k14", "k2",
                "k25", "k1", "k20", "k9", "k19", "k8", "k21", "k17", "k16", "k18",
            ),
            ids(dealt),
        )
    }

    @Test
    fun nothingToDeal() {
        for (count in listOf(0.0, -3.0, Double.NaN)) {
            val draws = Draws(createRng(1.0))
            assertTrue(deal(cards("c", 12), emptyMap(), draws.rng, DealOptions(count = count)).isEmpty(), "count $count")
            assertTrue(deal(emptyList(), emptyMap(), draws.rng, DealOptions(count = 10.0)).isEmpty(), "empty pool")
            assertEquals(0, draws.count, "count $count")
        }
    }

    @Test
    fun countsAndDuplicates() {
        assertEquals(4, deal(cards("c", 40), emptyMap(), createRng(1.0), DealOptions(count = 4.7)).size)
        val twice = deal(cards("c", 6) + cards("c", 6), emptyMap(), createRng(1.0), DealOptions(count = 10.0))
        assertEquals(6, twice.size)
        assertEquals(6, ids(twice).toSet().size)
    }

    // 16 unshown cards: 15 draws to rank them; t - 1 and f - 1 to shuffle the chosen True and False cards; then one
    // draw at each position where both answers are allowed. Counted with the TypeScript on the same pool.
    @Test
    fun drawCount() {
        for ((seed, expected) in listOf(1.0 to 31, 2.0 to 31, 3.0 to 32)) {
            val draws = Draws(createRng(seed))
            assertEquals(10, dealChunk(pinsPool, pinsHistory, draws.rng, emptyList()).size, "seed $seed")
            assertEquals(expected, draws.count, "seed $seed")
        }
    }

    // -0 and 0 are equal keys, as a - b is 0 for them in the TypeScript, so they keep their order; a NaN time counts
    // as 0. A compareBy or sortedBy on the Double key would put e2 (-0.0) before e1 (0.0).
    @Test
    fun equalKeysKeepTheirOrder() {
        val four = cards("e", 4)
        val history = mapOf("e1" to right(0.0), "e2" to right(-0.0), "e3" to right(Double.NaN), "e4" to right(-5.0))
        assertEquals(listOf("e4", "e1", "e2", "e3"), ids(oldestFirst(four, history)))
    }

    // lastSeenAt reads a missing or non-finite entry as 0 and keeps -0 (it is finite); a seen of 0 is never seen,
    // whatever lastCorrect says (deal-pins-polish.test.ts, "a history entry with seen 0").
    @Test
    fun historyReadsLikeTheTypeScript() {
        val c = card("x", true)
        assertEquals(0.0, lastSeenAt(c, emptyMap()))
        for (at in listOf(Double.NaN, Double.POSITIVE_INFINITY, Double.NEGATIVE_INFINITY)) {
            assertEquals(0.0, lastSeenAt(c, mapOf("x" to right(at))), "lastSeenAt $at")
        }
        assertEquals(12.5, lastSeenAt(c, mapOf("x" to right(12.5))))
        // Boxed Doubles are equal only when their bits are, so this tells -0.0 from 0.0.
        assertEquals(-0.0, lastSeenAt(c, mapOf("x" to right(-0.0))))
        val never = mapOf("x" to CardHistory(seen = 0, lastCorrect = false, lastSeenAt = 0.0))
        assertFalse(wasSeen(c, never))
        assertFalse(wasMissed(c, never))
        assertTrue(wasMissed(c, mapOf("x" to missed(1.0))))
    }
}
```

- [ ] **Step 2: Run them and watch them fail.**

```bash
cd android/Truthy && ./gradlew :engine:test --tests 'com.eienmosu.truthy.engine.DealReferenceTest'
```

Expected: `> Task :engine:compileTestKotlin FAILED` and `BUILD FAILED`, with errors such as `e: file:///<repository root>/android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/DealReferenceTest.kt:...: Unresolved reference 'DealConstants'.`, `Unresolved reference 'dealChunk'.`, `Unresolved reference 'DealOptions'.` and `Unresolved reference 'oldestFirst'.`

- [ ] **Step 3: Write the golden tests.**

`android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/DealGoldenTest.kt`:

```kotlin
// The golden vectors of the dealing (native-data/golden/src.engine.deal.*.json, plan A task 5): every case of
// deal and dealChunk, the constants, and each internal step of deal.ts, run through the Kotlin port.
// Cards are compared by id; a step that is given its rng as a list of values must use every value, no more.
package com.eienmosu.truthy.engine

import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.math.abs
import kotlin.math.floor
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class DealGoldenTest {
    // Every golden file of the module, by function name. The coverage test fails when plan A writes one that is not
    // in this list, so that no dealing vector goes unread (spec 7.1).
    private val functions = listOf(
        "deal", "dealChunk", "DEAL", "CHUNK", "SEARCH_BUDGET", "OVERDUE_AFTER_PASSES",
        "dealRanked", "uniqueById", "dealSize", "wasSeen", "wasMissed", "lastSeenAt", "oldestFirst", "rankByPriority",
        "balanceFor", "choose", "searchOverCap", "searchWithAllRules", "relaxStepByStep", "sharesGroup", "trueCount",
        "balanceAllows", "arrange", "joinOf", "runLimit", "placementCheck", "pickAnswer",
    )

    // Checks that the vectors a test loaded are those of `function` (Rule 9). Every call site loads with two string
    // literals, so task 1's coverage scan sees the file (Rule 11).
    private fun checked(file: GoldenFile, function: String): GoldenFile {
        assertEquals("src/engine/deal", file.module)
        assertEquals(function, file.function, "the vectors read for $function are those of ${file.function}")
        assertTrue(file.cases.isNotEmpty(), "$function has no cases")
        return file
    }

    // The JSON helpers, members so that they never clash with the loader's own (Rule 10).

    private fun JsonElement.member(key: String): JsonElement =
        jsonObject[key] ?: throw AssertionError("no $key in $this")

    // A member the TypeScript left undefined (written by leaving the key out) is null.
    private fun JsonElement.optional(key: String): JsonElement? =
        jsonObject[key]?.takeUnless { it is JsonNull }

    // A JSON number or a {"$number": ...} tag.
    private fun JsonElement.number(): Double {
        if (this is JsonObject) {
            return when (val tag = member("\$number").jsonPrimitive.content) {
                "Infinity" -> Double.POSITIVE_INFINITY
                "-Infinity" -> Double.NEGATIVE_INFINITY
                "NaN" -> Double.NaN
                "-0" -> -0.0
                else -> throw AssertionError("unknown number tag $tag")
            }
        }
        val primitive = jsonPrimitive
        if (primitive.isString) throw AssertionError("not a number: $this")
        return primitive.content.toDouble()
    }

    private fun JsonElement.int(): Int {
        val value = number()
        if (!(value.isFinite() && value == floor(value) && abs(value) <= Int.MAX_VALUE.toDouble())) {
            throw AssertionError("not a whole number: $this")
        }
        return value.toInt()
    }

    private fun JsonElement.bool(): Boolean = jsonPrimitive.boolean

    private fun JsonElement.text(): String {
        val primitive = jsonPrimitive
        if (!primitive.isString) throw AssertionError("not a string: $this")
        return primitive.content
    }

    private fun JsonElement.bools(): List<Boolean> = jsonArray.map { it.bool() }

    private fun ids(cards: List<Card>): List<String> = cards.map { it.id }

    private fun expectedIds(file: GoldenFile, value: JsonElement): List<String> = ids(file.cards(value))

    // A deal or no deal (null).
    private fun expectedDeal(file: GoldenFile, value: JsonElement): List<String>? =
        if (value is JsonNull) null else expectedIds(file, value)

    // Exact equality of numbers: -0 is not 0, NaN equals NaN.
    private fun same(a: Double, b: Double): Boolean =
        (a.isNaN() && b.isNaN()) || a.toRawBits() == b.toRawBits()

    // The rng of a case, wrapped to count its draws; `expected` is the number of values when the rng is a list.
    private class Draws(private val source: Rng, val expected: Int?) {
        var count = 0
        val rng: Rng = {
            count += 1
            source()
        }
    }

    private fun draws(file: GoldenFile, value: JsonElement): Draws =
        Draws(file.rng(value), value.jsonObject["\$rng"]?.jsonObject?.get("values")?.jsonArray?.size)

    private fun expectAllDrawn(draws: Draws, name: String) {
        val expected = draws.expected ?: return
        assertEquals(expected, draws.count, "$name: ${draws.count} draws of $expected")
    }

    // A history of a case. CardHistory.seen is a Long (task 1), as every stored entry is a safe integer. Dealing asks
    // one thing of seen, seen > 0, so a seen that is not a whole number of at most 2^53 reads as 1 when it is above 0 and 0
    // otherwise (NaN is not above 0), which gives every comparison dealing makes the same answer (Rule 8).
    private fun history(value: JsonElement): History =
        value.jsonObject.mapValues { (_, entry) ->
            val seen = entry.member("seen").number()
            val whole = seen.isFinite() && seen == floor(seen) && abs(seen) <= 9007199254740992.0
            CardHistory(
                seen = if (whole) seen.toLong() else if (seen > 0.0) 1L else 0L,
                lastCorrect = entry.member("lastCorrect").bool(),
                lastSeenAt = entry.member("lastSeenAt").number(),
            )
        }

    private fun ranking(file: GoldenFile, value: JsonElement): Ranking =
        Ranking(
            withinCap = file.cards(value.member("withinCap")),
            overCap = file.cards(value.member("overCap")),
            comeBack = file.cards(value.member("comeBack")),
            missed = value.member("missed").jsonArray.map { it.text() }.toSet(),
            missedCap = value.member("missedCap").int(),
        )

    // A ranking with its cards as ids, so that a failure prints readably.
    private data class RankingIds(val withinCap: List<String>, val overCap: List<String>, val comeBack: List<String>, val missed: Set<String>, val missedCap: Int)

    private fun idsOf(ranking: Ranking): RankingIds =
        RankingIds(ids(ranking.withinCap), ids(ranking.overCap), ids(ranking.comeBack), ranking.missed, ranking.missedCap)

    private fun balance(value: JsonElement): Balance =
        Balance(minTrue = value.member("minTrue").int(), maxTrue = value.member("maxTrue").int())

    private fun lastAnswer(value: JsonElement): Boolean? = if (value is JsonNull) null else value.bool()

    private fun join(value: JsonElement): Join = Join(last = lastAnswer(value.member("last")), run = value.member("run").int())

    private fun setting(file: GoldenFile, value: JsonElement): Setting =
        Setting(
            avoid = value.optional("avoid")?.let { file.cards(it) },
            before = value.optional("before")?.bools(),
            budget = value.optional("budget")?.number(),
            overdue = value.optional("overdue")?.bool(),
        )

    // A missedLimit of Infinity, should one be written, is no limit: null.
    private fun limits(value: JsonElement): Limits =
        Limits(
            budget = value.optional("budget")?.number(),
            missed = value.optional("missed")?.jsonArray?.map { it.text() }?.toSet(),
            missedLimit = value.optional("missedLimit")?.let { if (it.number() == Double.POSITIVE_INFINITY) null else it.int() },
        )

    @Test
    fun coverage() {
        val prefix = "src.engine.deal."
        val names = Golden.directory.listFiles().orEmpty()
            .map { it.name }
            .filter { it.startsWith(prefix) && it.endsWith(".json") }
            .map { it.removePrefix(prefix).removeSuffix(".json").removeSuffix(".constant") }
        assertEquals(functions.toSet(), names.toSet())
    }

    @Test
    fun dealVectors() {
        val file = checked(Golden.load("src/engine/deal", "deal"), "deal")
        for (c in file.cases) {
            val options = c.input.member("options")
            val counted = draws(file, c.input.member("rng"))
            val dealt = deal(
                file.cards(c.input.member("pool")),
                history(c.input.member("history")),
                counted.rng,
                DealOptions(
                    count = options.member("count").number(),
                    avoid = options.optional("avoid")?.let { file.cards(it) },
                    before = options.optional("before")?.bools(),
                    budget = options.optional("budget")?.number(),
                ),
            )
            assertEquals(expectedIds(file, c.output), ids(dealt), c.name)
        }
    }

    @Test
    fun dealChunkVectors() {
        val file = checked(Golden.load("src/engine/deal", "dealChunk"), "dealChunk")
        for (c in file.cases) {
            val pool = file.cards(c.input.member("pool"))
            val past = history(c.input.member("history"))
            val counted = draws(file, c.input.member("rng"))
            val dealt = file.cards(c.input.member("dealt"))
            val budget = c.input.optional("budget")
            val output = if (budget == null) {
                dealChunk(pool, past, counted.rng, dealt)
            } else {
                dealChunk(pool, past, counted.rng, dealt, budget.number())
            }
            assertEquals(expectedIds(file, c.output), ids(output), c.name)
        }
    }

    @Test
    fun constants() {
        for (c in checked(Golden.load("src/engine/deal", "DEAL"), "DEAL").cases) {
            assertEquals(JsonNull, c.input)
            assertEquals(
                DealConstants(
                    missedPerTen = c.output.member("missedPerTen").int(),
                    minTrue = c.output.member("minTrue").int(),
                    maxTrue = c.output.member("maxTrue").int(),
                    maxRun = c.output.member("maxRun").int(),
                ),
                DEAL,
            )
        }
        for (c in checked(Golden.load("src/engine/deal", "CHUNK"), "CHUNK").cases) assertEquals(c.output.int(), CHUNK)
        for (c in checked(Golden.load("src/engine/deal", "SEARCH_BUDGET"), "SEARCH_BUDGET").cases) assertTrue(same(SEARCH_BUDGET, c.output.number()), "SEARCH_BUDGET")
        for (c in checked(Golden.load("src/engine/deal", "OVERDUE_AFTER_PASSES"), "OVERDUE_AFTER_PASSES").cases) assertEquals(c.output.int(), OVERDUE_AFTER_PASSES)
    }

    @Test
    fun uniqueByIdVectors() {
        val file = checked(Golden.load("src/engine/deal", "uniqueById"), "uniqueById")
        for (c in file.cases) {
            assertEquals(expectedIds(file, c.output), ids(uniqueById(file.cards(c.input.member("pool")))), c.name)
        }
    }

    @Test
    fun dealSizeVectors() {
        val file = checked(Golden.load("src/engine/deal", "dealSize"), "dealSize")
        for (c in file.cases) {
            val size = dealSize(c.input.member("count").number(), c.input.member("available").int())
            assertEquals(c.output.int(), size, c.name)
        }
    }

    @Test
    fun historyVectors() {
        val files = listOf(
            "wasSeen" to checked(Golden.load("src/engine/deal", "wasSeen"), "wasSeen"),
            "wasMissed" to checked(Golden.load("src/engine/deal", "wasMissed"), "wasMissed"),
        )
        for ((function, file) in files) {
            for (c in file.cases) {
                val card = file.card(c.input.member("card"))
                val past = history(c.input.member("history"))
                val output = if (function == "wasSeen") wasSeen(card, past) else wasMissed(card, past)
                assertEquals(c.output.bool(), output, "$function: ${c.name}")
            }
        }
        val file = checked(Golden.load("src/engine/deal", "lastSeenAt"), "lastSeenAt")
        for (c in file.cases) {
            val at = lastSeenAt(file.card(c.input.member("card")), history(c.input.member("history")))
            val expected = c.output.number()
            assertTrue(same(expected, at), "lastSeenAt: ${c.name}: $at, expected $expected")
        }
    }

    @Test
    fun oldestFirstVectors() {
        val file = checked(Golden.load("src/engine/deal", "oldestFirst"), "oldestFirst")
        for (c in file.cases) {
            val sorted = oldestFirst(file.cards(c.input.member("cards")), history(c.input.member("history")))
            assertEquals(expectedIds(file, c.output), ids(sorted), c.name)
        }
    }

    @Test
    fun rankByPriorityVectors() {
        val file = checked(Golden.load("src/engine/deal", "rankByPriority"), "rankByPriority")
        for (c in file.cases) {
            val counted = draws(file, c.input.member("rng"))
            val ranked = rankByPriority(
                file.cards(c.input.member("cards")),
                history(c.input.member("history")),
                counted.rng,
                c.input.member("size").int(),
            )
            assertEquals(idsOf(ranking(file, c.output)), idsOf(ranked), c.name)
            expectAllDrawn(counted, c.name)
        }
    }

    @Test
    fun dealRankedVectors() {
        val file = checked(Golden.load("src/engine/deal", "dealRanked"), "dealRanked")
        for (c in file.cases) {
            val counted = draws(file, c.input.member("rng"))
            val dealt = dealRanked(
                ranking(file, c.input.member("ranking")),
                c.input.member("size").int(),
                counted.rng,
                setting(file, c.input.member("setting")),
            )
            assertEquals(expectedIds(file, c.output), ids(dealt), c.name)
            expectAllDrawn(counted, c.name)
        }
    }

    @Test
    fun chooseVectors() {
        val file = checked(Golden.load("src/engine/deal", "choose"), "choose")
        for (c in file.cases) {
            val chosen = choose(
                ranking(file, c.input.member("ranking")),
                c.input.member("size").int(),
                file.cards(c.input.member("avoid")),
                c.input.member("budget").number(),
                c.input.member("overdue").bool(),
            )
            assertEquals(expectedIds(file, c.output), ids(chosen), c.name)
        }
    }

    @Test
    fun searchOverCapVectors() {
        val file = checked(Golden.load("src/engine/deal", "searchOverCap"), "searchOverCap")
        for (c in file.cases) {
            val ranked = ranking(file, c.input.member("ranking"))
            val unshown = file.cards(c.input.member("unshown"))
            val spec = c.input.member("search")
            val size = spec.member("size").int()
            val avoid = file.cards(spec.member("avoid"))
            val budget = spec.member("budget").number()
            // The search choose hands over: its own budget and the ranking's missed cards, then the limits given.
            val search: (List<Card>, Limits) -> List<Card>? = { cards, given ->
                searchWithAllRules(
                    cards, size, avoid, balanceFor(size),
                    Limits(budget = given.budget ?: budget, missed = given.missed ?: ranked.missed, missedLimit = given.missedLimit),
                )
            }
            val found = searchOverCap(ranked, unshown, search)
            assertEquals(expectedDeal(file, c.output), found?.let { ids(it) }, c.name)
        }
    }

    @Test
    fun searchWithAllRulesVectors() {
        val file = checked(Golden.load("src/engine/deal", "searchWithAllRules"), "searchWithAllRules")
        for (c in file.cases) {
            val found = searchWithAllRules(
                file.cards(c.input.member("ranked")),
                c.input.member("size").int(),
                file.cards(c.input.member("avoid")),
                balance(c.input.member("balance")),
                limits(c.input.member("limits")),
            )
            assertEquals(expectedDeal(file, c.output), found?.let { ids(it) }, c.name)
        }
    }

    @Test
    fun relaxStepByStepVectors() {
        val file = checked(Golden.load("src/engine/deal", "relaxStepByStep"), "relaxStepByStep")
        for (c in file.cases) {
            val picked = relaxStepByStep(
                file.cards(c.input.member("ranked")),
                c.input.member("size").int(),
                file.cards(c.input.member("avoid")),
                balance(c.input.member("balance")),
                file.cards(c.input.member("first")),
            )
            assertEquals(expectedIds(file, c.output), ids(picked), c.name)
        }
    }

    @Test
    fun groupsAndCountsVectors() {
        val shares = checked(Golden.load("src/engine/deal", "sharesGroup"), "sharesGroup")
        for (c in shares.cases) {
            val output = sharesGroup(shares.card(c.input.member("card")), shares.cards(c.input.member("others")))
            assertEquals(c.output.bool(), output, "sharesGroup: ${c.name}")
        }
        val counts = checked(Golden.load("src/engine/deal", "trueCount"), "trueCount")
        for (c in counts.cases) {
            assertEquals(c.output.int(), trueCount(counts.cards(c.input.member("cards"))), "trueCount: ${c.name}")
        }
    }

    @Test
    fun balanceVectors() {
        val file = checked(Golden.load("src/engine/deal", "balanceFor"), "balanceFor")
        for (c in file.cases) {
            assertEquals(balance(c.output), balanceFor(c.input.member("size").int()), "balanceFor: ${c.name}")
        }
        val allows = checked(Golden.load("src/engine/deal", "balanceAllows"), "balanceAllows")
        for (c in allows.cases) {
            val output = balanceAllows(
                c.input.member("answer").bool(),
                c.input.member("trues").int(),
                c.input.member("falses").int(),
                c.input.member("size").int(),
                balance(c.input.member("balance")),
            )
            assertEquals(c.output.bool(), output, "balanceAllows: ${c.name}")
        }
    }

    @Test
    fun arrangeVectors() {
        val file = checked(Golden.load("src/engine/deal", "arrange"), "arrange")
        for (c in file.cases) {
            val counted = draws(file, c.input.member("rng"))
            val order = arrange(file.cards(c.input.member("chosen")), counted.rng, join(c.input.member("join")))
            assertEquals(expectedIds(file, c.output), ids(order), c.name)
            expectAllDrawn(counted, c.name)
        }
    }

    @Test
    fun runVectors() {
        val joins = checked(Golden.load("src/engine/deal", "joinOf"), "joinOf")
        for (c in joins.cases) {
            assertEquals(join(c.output), joinOf(c.input.member("before").bools()), "joinOf: ${c.name}")
        }
        val runLimits = checked(Golden.load("src/engine/deal", "runLimit"), "runLimit")
        for (c in runLimits.cases) {
            val limit = runLimit(c.input.member("trues").int(), c.input.member("falses").int(), join(c.input.member("join")))
            assertEquals(c.output.int(), limit, "runLimit: ${c.name}")
        }
        val places = checked(Golden.load("src/engine/deal", "placementCheck"), "placementCheck")
        for (c in places.cases) {
            val canPlace = placementCheck(c.input.member("limit").int())
            val output = canPlace(
                c.input.member("t").int(),
                c.input.member("f").int(),
                lastAnswer(c.input.member("last")),
                c.input.member("run").int(),
            )
            assertEquals(c.output.bool(), output, "placementCheck: ${c.name}")
        }
    }

    @Test
    fun pickAnswerVectors() {
        val file = checked(Golden.load("src/engine/deal", "pickAnswer"), "pickAnswer")
        for (c in file.cases) {
            val counted = draws(file, c.input.member("rng"))
            val output = pickAnswer(
                c.input.member("allowed").bools(),
                c.input.member("trues").int(),
                c.input.member("falses").int(),
                counted.rng,
            )
            assertEquals(c.output.bool(), output, c.name)
            expectAllDrawn(counted, c.name)
        }
    }
}
```

- [ ] **Step 4: Build them and watch them fail.**

```bash
cd android/Truthy && ./gradlew :engine:compileTestKotlin
```

Expected: `BUILD FAILED`, with the errors of step 2 and, from `DealGoldenTest.kt`, among others `Unresolved reference 'Ranking'.`, `Unresolved reference 'Setting'.`, `Unresolved reference 'Limits'.` and `Unresolved reference 'placementCheck'.`

- [ ] **Step 5: Write the port.**

`android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/Deal.kt`:

```kotlin
// Dealing: which cards a round gets, and in which order (spec section 6, "Dealing").
// A line-by-line port of src/engine/deal.ts. The only source of chance is the rng passed in.
package com.eienmosu.truthy.engine

import kotlin.math.ceil
import kotlin.math.floor

/** The rules of a deal, per ten cards: at most three missed cards, four to six True cards, runs of at most three. */
data class DealConstants(val missedPerTen: Int, val minTrue: Int, val maxTrue: Int, val maxRun: Int)

val DEAL: DealConstants = DealConstants(missedPerTen = 3, minTrue = 4, maxTrue = 6, maxRun = 3)

data class DealOptions(
    val count: Double, // how many cards to deal (a Double, as in the TypeScript: NaN, 4.7 and -3 have pinned results)
    val avoid: List<Card>? = null, // cards whose conflict groups must not be repeated
    val before: List<Boolean>? = null, // the answers of the cards dealt just before this deal, oldest first
    val budget: Double? = null, // the steps one search may take, SEARCH_BUDGET unless a test sets another
)

fun deal(pool: List<Card>, history: History, rng: Rng, options: DealOptions): List<Card> {
    val cards = uniqueById(pool)
    val size = dealSize(options.count, cards.size)
    if (size == 0) return emptyList()
    return dealRanked(
        rankByPriority(cards, history, rng, size),
        size,
        rng,
        Setting(avoid = options.avoid, before = options.before, budget = options.budget),
    )
}

// How a deal is chosen beyond its cards: the conflict groups to keep clear of, the answers just before it,
// the bound on the search and whether an unshown card is overdue (dealChunk only).
internal data class Setting(
    val avoid: List<Card>? = null,
    val before: List<Boolean>? = null,
    val budget: Double? = null,
    val overdue: Boolean? = null,
)

// Chooses `size` cards from a ranking and puts them in order.
internal fun dealRanked(ranking: Ranking, size: Int, rng: Rng, setting: Setting): List<Card> {
    val chosen = choose(ranking, size, setting.avoid ?: emptyList(), setting.budget ?: SEARCH_BUDGET, setting.overdue ?: false)
    return arrange(chosen, rng, joinOf(setting.before ?: emptyList()))
}

// Where a deal joins the cards before it: their last answer and the length of the run of equal answers
// that ends them. Nothing before: no last answer, no run.
internal data class Join(val last: Boolean?, val run: Int)

internal fun joinOf(before: List<Boolean>): Join {
    val last = before.lastOrNull()
    var run = 0
    var i = before.size - 1
    while (i >= 0 && before[i] == last) {
        run += 1
        i -= 1
    }
    return Join(last = last, run = run)
}

const val CHUNK: Int = 10

// The next cards of a round, given every card the round has dealt so far (in order): ten, or as many as
// may be dealt. First in line are the cards the round has not shown, ranked by the stored history. Behind
// them stand the cards it may bring back: every card outside the last min(CHUNK, route size - 1) dealt,
// the one shown longest ago first. A card still unshown once the round has dealt the route twice over is
// overdue: the chunk then takes one unshown card even if a rule has to give way for it (see choose).
fun dealChunk(pool: List<Card>, history: History, rng: Rng, dealt: List<Card>, budget: Double = SEARCH_BUDGET): List<Card> {
    val cards = uniqueById(pool)
    val lastDealtAt = HashMap<String, Int>()
    dealt.forEachIndexed { position, card -> lastDealtAt[card.id] = position }
    val unshown = cards.filter { it.id !in lastDealtAt }
    val gap = minOf(CHUNK, cards.size - 1)
    val comeBack = cards
        .filter { (lastDealtAt[it.id] ?: dealt.size) < dealt.size - gap }
        .sortedBy { lastDealtAt[it.id] ?: 0 } // distinct Int positions: no ties, no -0
    val size = minOf(CHUNK, unshown.size + comeBack.size)
    val lastTen = dealt.takeLast(CHUNK)
    return dealRanked(
        rankByPriority(unshown, history, rng, size).copy(comeBack = comeBack),
        size,
        rng,
        Setting(
            avoid = lastTen,
            before = lastTen.map { it.answer },
            budget = budget,
            overdue = unshown.isNotEmpty() && dealt.size >= OVERDUE_AFTER_PASSES * cards.size,
        ),
    )
}

// How many times a round deals the whole route before a card it has not shown is overdue.
internal const val OVERDUE_AFTER_PASSES: Int = 2

// The first card with each id wins, so a card can never be dealt twice.
internal fun uniqueById(pool: List<Card>): List<Card> {
    val seen = HashSet<String>()
    return pool.filter { seen.add(it.id) }
}

internal fun dealSize(count: Double, available: Int): Int {
    if (count.isNaN() || count <= 0.0) return 0
    return minOf(floor(count), available.toDouble()).toInt()
}

internal fun wasSeen(card: Card, history: History): Boolean {
    val entry = history[card.id] ?: return false
    return entry.seen > 0
}

internal fun wasMissed(card: Card, history: History): Boolean =
    wasSeen(card, history) && history[card.id]?.lastCorrect == false

internal fun lastSeenAt(card: Card, history: History): Double {
    val at = history[card.id]?.lastSeenAt
    return if (at != null && at.isFinite()) at else 0.0
}

// Ascending by key; equal keys keep their order through a position tiebreak (spec 4.4). The keys are subtracted
// and the difference compared with 0.0 on Double, IEEE style, so -0.0 and 0.0 are equal keys, as `a - b` is 0
// for them in the TypeScript. Double.compareTo would put -0.0 first.
internal fun stableSorted(cards: List<Card>, key: (Card) -> Double): List<Card> {
    val keys: List<Double> = cards.map(key)
    val order = cards.indices.sortedWith(
        Comparator { a: Int, b: Int ->
            val difference: Double = keys[a] - keys[b]
            when {
                difference < 0.0 -> -1
                difference > 0.0 -> 1
                else -> a.compareTo(b)
            }
        },
    )
    return order.map { cards[it] }
}

// Oldest first; equal keys keep their (shuffled) order.
internal fun oldestFirst(cards: List<Card>, history: History): List<Card> =
    stableSorted(cards) { lastSeenAt(it, history) }

// The pool in the order cards should be considered: missed cards up to the cap (oldest miss first),
// never seen (shuffled), seen longest ago. The missed cards over the cap are kept apart.
internal data class Ranking(
    val withinCap: List<Card>,
    val overCap: List<Card>,
    val comeBack: List<Card>, // dealChunk only: cards the round has shown and may bring back, the one shown longest ago first
    val missed: Set<String>, // the ids of the missed cards among withinCap and overCap
    val missedCap: Int, // how many missed cards a deal of this size holds at most, unless the rules need more
)

internal fun rankByPriority(cards: List<Card>, history: History, rng: Rng, size: Int): Ranking {
    val shuffled = shuffle(cards, rng)
    val missed = oldestFirst(shuffled.filter { wasMissed(it, history) }, history)
    val unseen = shuffled.filter { !wasSeen(it, history) }
    val seenRight = oldestFirst(shuffled.filter { wasSeen(it, history) && !wasMissed(it, history) }, history)
    val missedCap = floor(size * DEAL.missedPerTen / 10.0).toInt()
    return Ranking(
        withinCap = missed.take(missedCap) + unseen + seenRight,
        overCap = missed.drop(missedCap),
        comeBack = emptyList(),
        missed = missed.mapTo(LinkedHashSet()) { it.id },
        missedCap = missedCap,
    )
}

// How many True cards a deal of `size` may have: 4 to 6 per ten, scaled (floor of 40%, ceiling of 60%).
internal data class Balance(val minTrue: Int, val maxTrue: Int)

internal fun balanceFor(size: Int): Balance =
    Balance(
        minTrue = floor(size * DEAL.minTrue / 10.0).toInt(),
        maxTrue = ceil(size * DEAL.maxTrue / 10.0).toInt(),
    )

// Picks `size` cards, relaxing the rules in the order of the spec only as far as needed:
// 1. every rule, without the missed cards over the cap; 2. the missed cards over the cap (searchOverCap);
// 3. a card the round has shown may come back; 4. conflict groups, then 5. answer balance (relaxStepByStep).
// When an unshown card is overdue and the chunk holds none, the first unshown card goes in and the
// fallback relaxes the rest of the chunk around it.
internal fun choose(ranking: Ranking, size: Int, avoid: List<Card>, budget: Double, overdue: Boolean): List<Card> {
    val balance = balanceFor(size)
    val unshown = ranking.withinCap + ranking.overCap
    val everyCard = unshown + ranking.comeBack
    val search: (List<Card>, Limits) -> List<Card>? = { ranked, limits ->
        searchWithAllRules(
            ranked, size, avoid, balance,
            Limits(
                budget = limits.budget ?: budget,
                missed = limits.missed ?: ranking.missed,
                missedLimit = limits.missedLimit,
            ),
        )
    }
    val chosen = search(ranking.withinCap, Limits())
        ?: searchOverCap(ranking, unshown, search)
        ?: (if (ranking.comeBack.isNotEmpty()) search(everyCard, Limits()) else null)
        ?: relaxStepByStep(everyCard, size, avoid, balance)
    val unshownIds = unshown.mapTo(HashSet()) { it.id }
    if (!overdue || chosen.any { it.id in unshownIds }) return chosen
    return relaxStepByStep(everyCard, size, avoid, balance, unshown.take(1))
}

// Step 2. A deal that keeps the missed cards within the cap comes before a deal over it; over the cap, the
// fewer missed cards the better. The limits tried run from the cap up to one below what the loosest deal holds.
internal fun searchOverCap(ranking: Ranking, unshown: List<Card>, search: (List<Card>, Limits) -> List<Card>?): List<Card>? {
    if (ranking.overCap.isEmpty()) return null // the same cards as step 1, which found nothing
    val loosest = search(unshown, Limits()) ?: return null
    val held = loosest.count { it.id in ranking.missed }
    for (limit in ranking.missedCap until held) {
        val found = search(unshown, Limits(missedLimit = limit))
        if (found != null) return found
    }
    return loosest
}

// A bound on the work one search may do (a Double, so that a test can pass Infinity as the web's does).
const val SEARCH_BUDGET: Double = 20_000.0

// What else a search must keep to: the steps it may take, and at most `missedLimit` of the `missed` cards.
// A null missedLimit is the TypeScript's Infinity.
internal data class Limits(val budget: Double? = null, val missed: Set<String>? = null, val missedLimit: Int? = null)

// Depth-first over the ranked cards: at each card, first try to take it, then try to leave it out.
// Returns null when no deal keeps both the conflict groups and the balance (or the search ran out of steps).
internal fun searchWithAllRules(
    ranked: List<Card>,
    size: Int,
    avoid: List<Card>,
    balance: Balance,
    limits: Limits = Limits(),
): List<Card>? {
    val usedGroups = HashSet<String>()
    for (card in avoid) usedGroups.addAll(card.conflictGroups)
    val picked = ArrayList<Card>()
    val missed = limits.missed ?: emptySet()
    val missedLimit = limits.missedLimit ?: Int.MAX_VALUE // Int.MAX_VALUE stands for Infinity: nothing below overflows with it
    var trues = 0
    var missedTaken = 0
    var budget = limits.budget ?: SEARCH_BUDGET

    fun isMissed(card: Card): Boolean = card.id in missed

    fun canTake(card: Card): Boolean =
        card.conflictGroups.none { it in usedGroups } &&
            !(isMissed(card) && missedTaken >= missedLimit) &&
            balanceAllows(card.answer, trues, picked.size - trues, size, balance)

    fun take(card: Card) {
        picked.add(card)
        if (card.answer) trues += 1
        if (isMissed(card)) missedTaken += 1
        usedGroups.addAll(card.conflictGroups)
    }

    // A card is only taken when none of its groups is in use, so removing them on the way back is safe.
    fun putBack(card: Card) {
        picked.removeAt(picked.size - 1)
        if (card.answer) trues -= 1
        if (isMissed(card)) missedTaken -= 1
        usedGroups.removeAll(card.conflictGroups.toSet())
    }

    // Whether ranked[from..] can still fill the deal: an upper bound on what those cards can add.
    fun canStillFinish(from: Int): Boolean {
        val loose = IntArray(2) // cards with no group, by answer (0 False, 1 True)
        val grouped = IntArray(2) // cards with groups, by answer
        val groupsOf = arrayOf(HashSet<String>(), HashSet<String>())
        val allGroups = HashSet<String>()
        var takeable = 0
        var missedLeft = 0
        for (i in from until ranked.size) {
            val card = ranked[i]
            if (card.conflictGroups.any { it in usedGroups }) continue
            val answer = if (card.answer) 1 else 0
            takeable += 1
            if (isMissed(card)) missedLeft += 1
            if (card.conflictGroups.isEmpty()) {
                loose[answer] += 1
                continue
            }
            grouped[answer] += 1
            for (group in card.conflictGroups) {
                groupsOf[answer].add(group)
                allGroups.add(group)
            }
        }
        val need = size - picked.size
        val falses = picked.size - trues
        val cardsLeft = loose[0] + loose[1] + minOf(grouped[0] + grouped[1], allGroups.size)
        val withinMissedLimit = takeable - maxOf(0, missedLeft - (missedLimit - missedTaken))
        val truesLeft = minOf(loose[1] + minOf(grouped[1], groupsOf[1].size), balance.maxTrue - trues)
        val falsesLeft = minOf(loose[0] + minOf(grouped[0], groupsOf[0].size), size - balance.minTrue - falses)
        return minOf(cardsLeft, withinMissedLimit, truesLeft + falsesLeft) >= need
    }

    fun visit(from: Int): Boolean {
        if (picked.size == size) return true
        val left = budget
        budget -= 1.0
        if (left <= 0.0 || !canStillFinish(from)) return false
        val card = ranked.getOrNull(from) ?: return false
        if (canTake(card)) {
            take(card)
            if (visit(from + 1)) return true
            putBack(card)
        }
        return visit(from + 1)
    }

    return if (visit(0)) picked.toList() else null
}

internal data class Rules(
    val conflicts: Boolean, // keep conflict groups apart (within the deal and against `avoid`)
    val balance: Boolean, // keep the number of True cards inside the balance
)

// The fallback when no deal keeps every rule. Three passes over the ranked cards, each adding to the cards
// already picked (`first`, if given): all rules, then without conflict groups, then without the balance.
internal fun relaxStepByStep(
    ranked: List<Card>,
    size: Int,
    avoid: List<Card>,
    balance: Balance,
    first: List<Card> = emptyList(),
): List<Card> {
    val picked = ArrayList(first)
    val pickedIds = first.mapTo(HashSet()) { it.id }

    fun breaks(card: Card, rules: Rules): Boolean {
        if (rules.conflicts && sharesGroup(card, avoid + picked)) return true
        if (!rules.balance) return false
        val trues = trueCount(picked)
        return !balanceAllows(card.answer, trues, picked.size - trues, size, balance)
    }

    fun fill(rules: Rules) {
        for (card in ranked) {
            if (picked.size == size) return
            if (card.id in pickedIds || breaks(card, rules)) continue
            picked.add(card)
            pickedIds.add(card.id)
        }
    }

    fill(Rules(conflicts = true, balance = true))
    fill(Rules(conflicts = false, balance = true))
    fill(Rules(conflicts = false, balance = false))
    return picked.toList()
}

internal fun sharesGroup(card: Card, others: List<Card>): Boolean =
    card.conflictGroups.any { group -> others.any { other -> group in other.conflictGroups } }

internal fun trueCount(cards: List<Card>): Int = cards.count { it.answer }

// True cards may not pass maxTrue, and False cards may not pass size - minTrue,
// so a full deal picked under this rule always lands inside the balance.
internal fun balanceAllows(answer: Boolean, trues: Int, falses: Int, size: Int, balance: Balance): Boolean =
    if (answer) trues < balance.maxTrue else falses < size - balance.minTrue

// Puts the chosen cards in an order drawn from the rng with no run of equal answers longer than the run limit.
// Position by position, it draws True or False in proportion to how many of each are left, among the answers
// that still allow the rest to be placed; then it takes the next card of that answer.
internal fun arrange(chosen: List<Card>, rng: Rng, join: Join): List<Card> {
    val trues = shuffle(chosen.filter { it.answer }, rng).toMutableList()
    val falses = shuffle(chosen.filter { !it.answer }, rng).toMutableList()
    val limit = runLimit(trues.size, falses.size, join)
    val canPlace = placementCheck(limit)
    val order = ArrayList<Card>()
    var last: Boolean? = join.last
    var run = join.run

    while (trues.size + falses.size > 0) {
        val allowed = listOf(true, false).filter { answer ->
            val left = if (answer) trues.size else falses.size
            if (left == 0 || (answer == last && run >= limit)) {
                false
            } else {
                val nextRun = if (answer == last) run + 1 else 1
                canPlace(trues.size - (if (answer) 1 else 0), falses.size - (if (answer) 0 else 1), answer, nextRun)
            }
        }
        val answer = pickAnswer(allowed, trues.size, falses.size, rng)
        val pile = if (answer) trues else falses
        if (pile.isEmpty()) break
        order.add(pile.removeAt(0))
        run = if (answer == last) run + 1 else 1
        last = answer
    }
    return order.toList()
}

// The run limit is DEAL.maxRun, unless no order of these answers after the cards before them can keep it;
// then it is the smallest limit some order can keep.
internal fun runLimit(trues: Int, falses: Int, join: Join): Int {
    var limit = DEAL.maxRun
    while (!placementCheck(limit)(trues, falses, join.last, join.run)) limit += 1
    return limit
}

// canPlace(t, f, last, run): can t True and f False cards still be placed after a run of `run` cards
// with answer `last`, without any run passing the limit? Memoised, so a whole deal costs little.
internal fun placementCheck(limit: Int): (Int, Int, Boolean?, Int) -> Boolean {
    val memo = HashMap<String, Boolean>()
    fun canPlace(t: Int, f: Int, last: Boolean?, run: Int): Boolean {
        if (t == 0 && f == 0) return true
        val key = "$t,$f,$last,$run"
        val known = memo[key]
        if (known != null) return known
        val result =
            (t > 0 && (last != true || run < limit) && canPlace(t - 1, f, true, if (last == true) run + 1 else 1)) ||
                (f > 0 && (last != false || run < limit) && canPlace(t, f - 1, false, if (last == false) run + 1 else 1))
        memo[key] = result
        return result
    }
    return { t, f, last, run -> canPlace(t, f, last, run) }
}

// Chooses between the allowed answers in proportion to the cards left of each.
// The run limit always leaves at least one allowed answer; the empty case is only a guard.
internal fun pickAnswer(allowed: List<Boolean>, trues: Int, falses: Int, rng: Rng): Boolean {
    if (allowed.isEmpty()) return trues > 0
    if (allowed.size == 1) return allowed[0]
    return rng() * (trues + falses).toDouble() < trues.toDouble()
}
```

  Two lines differ in form from the TypeScript and nowhere else: `usedGroups` starts from a loop over `avoid` instead of `flatMap` (the same set), and `putBack` removes the card's groups with `removeAll` (the same groups `take` added; the comment above `putBack` says why that is safe). The return values are copies (`toList()`), which no caller can tell apart from the TypeScript's arrays.

- [ ] **Step 6: Run the reference tests.**

```bash
cd android/Truthy && ./gradlew :engine:test --tests 'com.eienmosu.truthy.engine.DealReferenceTest'
grep -o 'tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*" errors="[0-9]*"' engine/build/test-results/test/TEST-com.eienmosu.truthy.engine.DealReferenceTest.xml
```

Expected: `BUILD SUCCESSFUL`, then `tests="11" skipped="0" failures="0" errors="0"`. If a reference vector differs, look at `drawCount` first: it tells a draw in the wrong place from a rule ported wrong. If only `equalKeysKeepTheirOrder` fails, the sort compares `Double` keys with `compareTo` (Rule 3).

- [ ] **Step 7: Run the golden tests.**

```bash
cd android/Truthy && ./gradlew :engine:test --tests 'com.eienmosu.truthy.engine.DealGoldenTest'
grep -o 'tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*" errors="[0-9]*"' engine/build/test-results/test/TEST-com.eienmosu.truthy.engine.DealGoldenTest.xml
```

Expected: `BUILD SUCCESSFUL`, then `tests="19" skipped="0" failures="0" errors="0"` (the `dealChunk` test reads every shipped deck and takes a few seconds). A failure names the case (each assertion carries the case name). A failure in `checked` that names another function, or a `coverage` failure that lacks `deal` or `DEAL`, means a golden file name does not map as Rule 9 says: compare `ls native-data/golden | grep src.engine.deal.` with the 27 names and task 1's `Golden.fileName`. A `coverage` failure that lists another name means plan A wrote a vector this task does not read: stop and find out which function it belongs to.

- [ ] **Step 8: Check that the tests catch an unstable sort.**

Break the tie rule of `stableSorted` on purpose, run, and put it back:

```bash
cd android/Truthy && sed -i '' 's/                else -> a.compareTo(b)$/                else -> b.compareTo(a)/' engine/src/main/kotlin/com/eienmosu/truthy/engine/Deal.kt && ./gradlew :engine:test --tests 'com.eienmosu.truthy.engine.Deal*'; sed -i '' 's/                else -> b.compareTo(a)$/                else -> a.compareTo(b)/' engine/src/main/kotlin/com/eienmosu/truthy/engine/Deal.kt && grep -c '                else -> a.compareTo(b)$' engine/src/main/kotlin/com/eienmosu/truthy/engine/Deal.kt
```

Expected: the Gradle run ends with `BUILD FAILED`, and the failed tests it lists include `DealReferenceTest > equalKeysKeepTheirOrder`, `DealGoldenTest > oldestFirstVectors` and `DealGoldenTest > dealVectors` (the web's reference vectors have no equal keys, so only these see it); the final `grep` prints `1`. The README's port trap "sorts the TypeScript relies on being stable" is pinned by these tests.

- [ ] **Step 9: Run the whole engine suite.**

```bash
cd android/Truthy && ./gradlew :engine:test
grep -ho '<testsuite [^>]*' engine/build/test-results/test/*.xml | grep -o 'tests="[0-9]*"' | tr -dc '0-9\n' | paste -sd+ - | bc
grep -l 'failures="[1-9]' engine/build/test-results/test/*.xml; grep -l 'errors="[1-9]' engine/build/test-results/test/*.xml
```

Expected: `BUILD SUCCESSFUL`; the sum is 30 more than after task 1 (11 reference tests, 19 golden tests); the two `grep -l` print nothing. Task 1's purity test now scans `Deal.kt` too and passes.

- [ ] **Step 10: Check the hygiene and commit.**

```bash
git add android/Truthy/engine/src/main/kotlin/com/eienmosu/truthy/engine/Deal.kt android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/DealReferenceTest.kt android/Truthy/engine/src/test/kotlin/com/eienmosu/truthy/engine/DealGoldenTest.kt
npx -y pnpm@10.34.0 vitest run tests/repo-hygiene.test.ts
git commit -m "feat: port the dealing to the Kotlin engine, deal and dealChunk with every step of deal.ts, checked against the golden vectors"
```

Expected: the hygiene test passes (it reads the tracked and staged files: no local path, no e-mail-shaped string, no em dash), and the commit holds the three files.

**Assumed from other tasks** (names the README does not fix): from task 1, `shuffle(items: List<T>, rng: Rng): List<T>` in `com.eienmosu.truthy.engine`; the golden loader `Golden.load(module, function)` (always called with two string literals), `Golden.directory`, `GoldenFile` with `module`, `function`, `cases`, `card`, `cards` and `rng` (values lists throw when they run out), `GoldenCase(name, input, output)` on `kotlinx.serialization.json.JsonElement`; `Card.serializer()` (from `@Serializable`); and `kotlin-test-junit` (task 1's `libs.kotlin.test.junit`) plus `kotlinx-serialization-json` on the `:engine` test classpath. If task 1 named any of these differently, rename the calls in the two test files; `Deal.kt` uses only `shuffle`, `Card`, `CardHistory`, `History` and `Rng`.
