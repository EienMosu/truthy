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
