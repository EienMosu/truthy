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
