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
