package com.eienmosu.truthy.engine

import kotlinx.serialization.json.JsonNull
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertSame
import kotlin.test.assertTrue
import kotlin.test.Test

class RoundRecorderGoldenTest : CopyGoldenBase() {
    private val record = Golden.load("components/play/ResultView", "recordRound")
    private val arrives = Golden.load("components/play/ResultView", "RESULT_ARRIVES_MS")

    private fun outcomeFor(name: String): ApplyOutcome {
        val input = record.resolve(record.inputOf(name))
        return recordRound(replay(record, record.inputOf(name)), progressOf(input.field("progress")))
    }

    @Test
    fun `the result delay is a second`() {
        assertEquals(1000.0, RESULT_ARRIVES_MS)
        assertEquals(1, arrives.cases.size)
        assertTrue(arrives.cases[0].output.number() == RESULT_ARRIVES_MS)
    }

    @Test
    fun `recordRound sets the record, the history and the last route as the pinned rounds of ResultView test do`() {
        val first = outcomeFor("Classic 7 of 10: called once")
        assertEquals(mapOf("test-deck/SEC#classic" to 7), first.progress.records)
        assertEquals(List(10) { 1L }, first.progress.cards.values.map { it.seen })
        val firstLast = first.progress.last!!
        assertEquals("test-deck", firstLast.route.deckId)
        assertEquals("SEC", firstLast.route.sectionId)
        assertEquals(Mode.CLASSIC, firstLast.mode)
        assertEquals(7, firstLast.score)
        assertEquals(10, firstLast.total)
        assertEquals(null, first.previousBest)
        assertTrue(first.isNewBest)

        val below = outcomeFor("Classic 7 of 10 below a stored record of 9: the record stays")
        assertEquals(9, below.progress.records["test-deck/SEC#classic"])
        assertEquals(9, below.previousBest)
        assertFalse(below.isNewBest)

        val past = outcomeFor("Streak 3 past a stored record of 2: a new record")
        assertEquals(3, past.progress.records["test-deck/SEC#streak"])
        assertEquals(2, past.previousBest)
        assertTrue(past.isNewBest)
    }

    @Test
    fun `the recorder writes a round once however often it is called and returns the same outcome`() {
        val name = "Classic 7 of 10: called once"
        val round = replay(record, record.inputOf(name))
        val recorder = RoundRecorder()
        val shown = recorder.preview(round, emptyProgress())
        assertEquals(recordRound(round, emptyProgress()), shown)

        val first = recorder.record(round, emptyProgress())
        assertTrue(first.write)
        assertEquals(shown, first.outcome)

        val again = recorder.record(round, emptyProgress())
        assertFalse(again.write)
        assertSame(first.outcome, again.outcome)
        assertSame(first.outcome, recorder.preview(round, emptyProgress()))

        val another = replay(record, record.inputOf(name))
        assertTrue(recorder.record(another, emptyProgress()).write)
    }

    @Test
    fun `recordRound through the recorder matches every golden case`() {
        assertEquals(7, record.cases.size)
        for (case in record.cases) {
            val input = record.resolve(case.input)
            val round = replay(record, case.input)
            val calls = input.field("calls").count()
            var stored: Progress? = if (input.field("progress") is JsonNull) null else progressOf(input.field("progress"))
            val recorder = RoundRecorder()
            var writes = 0
            val outcomes = mutableListOf<ApplyOutcome>()
            repeat(calls) {
                val recording = recorder.record(round, stored ?: emptyProgress())
                if (recording.write) {
                    writes += 1
                    stored = recording.outcome.progress
                }
                outcomes.add(recording.outcome)
            }
            val expected = case.output
            assertEquals(expected.field("writes").count(), writes, "${case.name}: writes")
            assertEquals(expected.field("sameOutcome").flag(), outcomes.all { it === outcomes[0] }, "${case.name}: sameOutcome")
            assertEquals(progressOf(expected.field("stored")), stored, "${case.name}: stored")
            assertEquals(expected.field("outcome").field("previousBest").countOrNull(), outcomes[0].previousBest, "${case.name}: previousBest")
            assertEquals(expected.field("outcome").field("isNewBest").flag(), outcomes[0].isNewBest, "${case.name}: isNewBest")
        }
    }
}
