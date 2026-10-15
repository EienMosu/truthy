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
