package com.eienmosu.truthy.engine

import kotlinx.serialization.json.JsonNull
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.Test

class LeaveGoldenTest : CopyGoldenBase() {
    private val leaves = Golden.load("components/play/leave", "leavesSomething")
    private val save = Golden.load("components/play/leave", "saveLeftRound")

    private fun saved(name: String): Progress {
        val input = save.resolve(save.inputOf(name))
        return saveLeftRound(replay(save, save.inputOf(name)), progressOf(input.field("progress")))
    }

    @Test
    fun `leavesSomething is true with answers or a decided round and false before both`() {
        val expected = mapOf(
            "Classic: nothing answered yet" to false,
            "Classic: one answer given" to true,
            "Classic: one answer given and the next card on screen" to true,
            "Classic: the last card answered, the round is decided" to true,
            "Three lives: one wrong answer" to true,
            "Streak: the deciding wrong answer" to true,
            "Timed: the minute is running and nothing is answered" to false,
            "Timed: the minute ran out with nothing answered" to true,
            "Timed: one answer stamped" to true,
            "Classic: abandoned with nothing answered" to false,
        )
        assertEquals(expected.keys, leaves.cases.map { it.name }.toSet())
        for ((name, value) in expected) {
            assertEquals(value, leaves.outputOf(name).flag(), name)
            assertEquals(value, leavesSomething(replay(leaves, leaves.inputOf(name))), name)
        }
    }

    @Test
    fun `leavesSomething matches every golden case`() {
        for (case in leaves.cases) assertEquals(case.output.flag(), leavesSomething(replay(leaves, case.input)), case.name)
    }

    @Test
    fun `saveLeftRound keeps the answers of an undecided round without a record and records a decided round as its result would`() {
        val open = saved("Classic: two answers kept in the history, no record, the route without a score")
        assertEquals(listOf(1L, 1L), open.cards.values.map { it.seen })
        assertEquals(emptyMap<String, Int>(), open.records)
        val openLast = open.last!!
        assertEquals("test-deck", openLast.route.deckId)
        assertEquals("SEC", openLast.route.sectionId)
        assertEquals(Mode.CLASSIC, openLast.mode)
        assertNull(openLast.score)
        assertNull(openLast.total)

        val streak = saved("Streak: left after the deciding answer, recorded as its result would be")
        assertEquals(mapOf("test-deck/SEC#streak" to 3), streak.records)
        assertEquals(4, streak.cards.size)
        assertEquals(true, streak.cards.values.all { it.seen == 1L })
        val streakLast = streak.last!!
        assertEquals(Mode.STREAK, streakLast.mode)
        assertEquals(3, streakLast.score)
        assertEquals(4, streakLast.total)

        assertEquals(mapOf("test-deck/SEC#lives" to 3), saved("Three lives: left after the third wrong answer").records)
        assertEquals(mapOf("test-deck/SEC#classic" to 10), saved("Classic: left after the last card was answered, the record is set").records)
        assertEquals(mapOf("test-deck/SEC#timed" to 0), saved("Timed: the minute ran out with nothing answered, a record of 0").records)
    }

    @Test
    fun `saveLeftRound over stored progress keeps the records and counts a card seen before once more`() {
        val open = saved("Classic: an open round over stored progress keeps the records and counts a card seen before once more")
        assertEquals(mapOf("test-deck/SEC#classic" to 5, "test-deck/SEC#streak" to 9), open.records)
        assertEquals(CardHistory(seen = 2, lastCorrect = true, lastSeenAt = 1000.0), open.cards["test-deck-sec-10"])
        val below = saved("Streak: a decided round below the stored record leaves the record alone")
        assertEquals(9, below.records["test-deck/SEC#streak"])
        assertEquals(5, below.records["test-deck/SEC#classic"])
    }

    @Test
    fun `saveLeftRound matches every golden case, a full store leaving the stored value as it was`() {
        assertEquals(10, save.cases.size)
        for (case in save.cases) {
            val input = save.resolve(case.input)
            val given = input.field("progress") !is JsonNull
            val before = progressOf(input.field("progress"))
            val after = saveLeftRound(replay(save, case.input), before)
            val full = input.field("storage").text() == "full"
            val stored: Progress? = if (full) (if (given) before else null) else after
            val expected = case.output.field("stored")
            if (expected is JsonNull) assertNull(stored, case.name) else assertEquals(progressOf(expected), stored, case.name)
        }
    }
}
