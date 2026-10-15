package com.eienmosu.truthy.engine

import kotlin.test.assertEquals
import kotlin.test.Test

class TimedPathGoldenTest : CopyGoldenBase() {
    private val clockFile = Golden.load("components/TimedPath", "clockText")
    private val labelFile = Golden.load("components/TimedPath", "timedLabel")

    @Test
    fun `the clock reads whole seconds rounded up and never less than 0 00`() {
        assertEquals("1:00", clockText(60_000.0))
        assertEquals("1:00", clockText(59_999.0))
        assertEquals("0:59", clockText(59_000.0))
        assertEquals("0:41", clockText(40_001.0))
        assertEquals("0:41", clockText(41_000.0))
        assertEquals("0:01", clockText(1.0))
        assertEquals("0:00", clockText(0.0))
        assertEquals("0:02", clockText(1_001.0))
        assertEquals("0:00", clockText(-5_000.0))
        assertEquals("2:05", clockText(125_000.0))
    }

    @Test
    fun `timedLabel says the seconds left, then the cards answered at time up`() {
        assertEquals("41 seconds left of 60. 9 correct, 2 wrong.", timedLabel(41_000.0, 9, 2))
        assertEquals("60 seconds left of 60. 0 correct, 0 wrong.", timedLabel(60_000.0, 0, 0))
        assertEquals("1 second left of 60. 3 correct, 0 wrong.", timedLabel(900.0, 3, 0))
        assertEquals("Time is up. 17 cards answered: 14 correct, 3 wrong.", timedLabel(0.0, 14, 3))
        assertEquals("Time is up. 1 card answered: 1 correct, 0 wrong.", timedLabel(0.0, 1, 0))
        assertEquals("Time is up. 4 cards answered: 3 correct, 1 wrong.", timedLabel(-5.0, 3, 1))
    }

    @Test
    fun `the minute is 60 seconds`() {
        assertEquals(60, TIMED_SECONDS)
    }

    @Test
    fun `clockText matches every golden case`() {
        assertEquals(19, clockFile.cases.size)
        for (case in clockFile.cases) assertEquals(case.output.text(), clockText(case.input.field("remainingMs").number()), case.name)
    }

    @Test
    fun `timedLabel matches every golden case`() {
        assertEquals(12, labelFile.cases.size)
        for (case in labelFile.cases) {
            val input = case.input
            assertEquals(case.output.text(), timedLabel(input.field("remainingMs").number(), input.field("correct").count(), input.field("wrong").count()), case.name)
        }
    }
}
