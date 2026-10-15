package com.eienmosu.truthy.engine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

// tests/engine/rng.test.ts, case by case.
private fun draw(seed: Double, count: Int): List<Double> {
    val rng = createRng(seed)
    return List(count) { rng() }
}

private val EIGHT = listOf("a", "b", "c", "d", "e", "f", "g", "h")

class RngTest {
    @Test
    fun producesTheReferenceMulberry32Values() {
        assertEquals(listOf(2_693_262_067.0, 11_749_833.0, 2_265_367_787.0), draw(1.0, 3).map { it * 4_294_967_296.0 })
        assertEquals(listOf(2_581_720_956.0, 1_925_393_290.0, 3_661_312_704.0), draw(42.0, 3).map { it * 4_294_967_296.0 })
        assertEquals(listOf(1_144_304_738.0, 1_416_247.0, 958_946_056.0), draw(0.0, 3).map { it * 4_294_967_296.0 })
    }

    @Test
    fun givesTheSameSequenceForTheSameSeedAndAnotherForAnotherSeed() {
        assertEquals(draw(7.0, 50), draw(7.0, 50))
        assertNotEquals(draw(7.0, 5), draw(8.0, 5))
    }

    @Test
    fun keepsTwoGeneratorsWithTheSameSeedIndependent() {
        val a = createRng(3.0)
        val b = createRng(3.0)
        a()
        a()
        assertEquals(draw(3.0, 1)[0], b(), 0.0)
    }

    @Test
    fun staysInTheUnitIntervalAndIsRoughlyUniform() {
        val buckets = IntArray(10)
        for (x in draw(99.0, 10_000)) {
            assertTrue("$x is in [0, 1)", x >= 0.0 && x < 1.0)
            buckets[(x * 10).toInt()]++
        }
        assertTrue(buckets.joinToString(), buckets.all { it in 801..1199 })
        assertTrue(draw(123.0, 10_000).all { it >= 0.0 && it < 1.0 })
    }

    @Test
    fun takesTheSeedAsAnUnsigned32BitInteger() {
        assertEquals(draw(4_294_967_295.0, 3), draw(-1.0, 3))
        assertEquals(draw(1.0, 3), draw(1.9, 3))
        assertEquals(draw(1.0, 3), draw(4_294_967_297.0, 3))
    }

    @Test
    fun shufflesToTheReferenceOrderAndLeavesTheInputAlone() {
        val items = EIGHT.toList()
        assertEquals(listOf("c", "b", "g", "h", "e", "d", "a", "f"), shuffle(items, createRng(1.0)))
        assertEquals(EIGHT, items)
        assertEquals(EIGHT, shuffle(items, createRng(5.0)).sorted())
        assertEquals(shuffle(items, createRng(11.0)), shuffle(items, createRng(11.0)))
        val orders = (0 until 10).map { seed -> shuffle(items, createRng(seed.toDouble())).joinToString("") }.toSet()
        assertTrue(orders.size > 1)
    }

    @Test
    fun shufflesAnEmptyListAndASingleItemWithoutDrawing() {
        var calls = 0
        val counting: Rng = {
            calls++
            0.5
        }
        assertEquals(emptyList<String>(), shuffle(emptyList<String>(), counting))
        assertEquals(listOf("only"), shuffle(listOf("only"), counting))
        assertEquals(0, calls)
    }

    @Test
    fun drawsExactlyCountMinusOneValues() {
        var calls = 0
        val counting: Rng = {
            calls++
            0.5
        }
        shuffle(EIGHT, counting)
        assertEquals(7, calls)
    }

    @Test
    fun canPutEveryItemInEveryPosition() {
        val seenAt = mutableMapOf<String, MutableSet<Int>>()
        for (seed in 0 until 2000) {
            shuffle(listOf("w", "x", "y", "z"), createRng(seed.toDouble())).forEachIndexed { position, item ->
                seenAt.getOrPut(item) { mutableSetOf() }.add(position)
            }
        }
        for (item in listOf("w", "x", "y", "z")) assertEquals(item, 4, seenAt[item]?.size)
    }
}
