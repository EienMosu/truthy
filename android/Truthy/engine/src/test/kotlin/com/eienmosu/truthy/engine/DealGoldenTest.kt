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
