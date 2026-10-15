package com.eienmosu.truthy.round

import com.eienmosu.truthy.engine.Point
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class CompletedMarksTest {
    @Test
    fun tenCardsDrawEveryMarkAtFullSizeWithTheRingThreeAndAHalfOutside() {
        val results = listOf(true, false, true, true, false, true, true, true, true, false)
        val marks = completedMarks(results, total = 10, ring = 4)
        assertEquals((0..9).toList(), marks.below.map { it.index })
        assertTrue(marks.above.isEmpty())
        assertTrue(marks.below.all { it.scale == 1.0 && !it.plain })
        assertEquals(results, marks.below.map { it.correct })
        assertEquals(RingPlacement(at = Point(123.33, 9.19), radius = 10.5), marks.ring)
    }

    @Test
    fun aLongRouteDrawsCorrectMarksPlainAndLiftsTheWrongOnesAboveTheRing() {
        val results = List(30) { it % 7 != 3 }
        val marks = completedMarks(results, total = 30, ring = 12)
        assertEquals(listOf(3, 10, 17, 24), marks.above.map { it.index })
        assertEquals(26, marks.below.size)
        assertTrue(marks.below.all { it.correct && it.plain && it.scale == 0.4551724137931034 })
        assertTrue(marks.above.all { !it.correct && !it.plain && it.scale == 0.46153846153846156 })
        assertEquals(RingPlacement(at = Point(115.24, 9.45), radius = 4.55), marks.ring)
    }

    @Test
    fun marksFollowTheDealtCountNotTheAnswers() {
        val marks = completedMarks(listOf(true, true, false), total = 12, ring = 1)
        assertEquals(3, marks.below.size)
        assertTrue(marks.below.all { it.scale == 6.0 / 7.0 })
        assertEquals(RingPlacement(at = Point(30.0, 19.04), radius = 9.5), marks.ring)
    }

    @Test
    fun aRingOutsideTheRouteIsNotDrawnAndASingleCardRingsAtTheStart() {
        assertNull(completedMarks(listOf(true, true, true), total = 3, ring = 5).ring)
        assertNull(completedMarks(listOf(true, true, true), total = 3, ring = -1).ring)
        assertNull(completedMarks(listOf(true, true, true), total = 3, ring = null).ring)
        assertEquals(RingPlacement(at = Point(6.0, 24.0), radius = 10.5), completedMarks(listOf(false), total = 1, ring = 0).ring)
    }
}
