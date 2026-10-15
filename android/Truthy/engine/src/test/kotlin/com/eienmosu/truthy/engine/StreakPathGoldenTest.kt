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
