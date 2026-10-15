package com.eienmosu.truthy.engine

import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.Test

class ResultCopyGoldenTest : CopyGoldenBase() {
    private val file = Golden.load("components/play/resultCopy", "resultCopy")

    private fun plain(name: String): JsonElement = file.outputOf(name).without("best")

    private fun bestText(name: String, record: Int): String = file.outputOf(name).field("best").field(record.toString()).text()

    private fun fields(vararg pairs: Pair<String, String>) = pairs.map { mapOf("label" to it.first, "value" to it.second) }

    private fun copyJson(copy: ResultCopy, records: List<Int>): JsonElement {
        val map = mutableMapOf<String, Any?>()
        map["fields"] = copy.fields.map { mapOf("label" to it.label, "value" to it.value) }
        map["scoreLabel"] = copy.scoreLabel
        if (copy.unit != null) map["unit"] = copy.unit
        map["ended"] = copy.ended
        map["endedDetail"] = copy.endedDetail
        map["label"] = copy.label
        map["marks"] = copy.marks
        if (copy.ring != null) map["ring"] = copy.ring
        map["best"] = records.associate { it.toString() to copy.best(it) }
        return json(map)
    }

    @Test
    fun `Classic counts out of the cards dealt`() {
        assertSameJson(
            json(
                mapOf(
                    "fields" to fields("Class" to "Classic", "Cards" to "10 / 10", "Wrong" to "03"),
                    "scoreLabel" to "Your score",
                    "unit" to "of 10",
                    "ended" to "Arrived",
                    "endedDetail" to " · 10 of 10",
                    "label" to "Round complete. 10 of 10 cards. 7 correct, 3 wrong: cards 3, 6 and 9.",
                    "marks" to 10,
                ),
            ),
            plain("Classic: 7 of 10"),
            "Classic: 7 of 10",
        )
        assertEquals("9 / 10", bestText("Classic: 7 of 10", 9))
        val few = "Classic: a route with fewer cards than ten counts by its own length"
        assertEquals("01 / 01", plain(few).field("fields").list()[1].field("value").text())
        assertEquals("of 1", plain(few).field("unit").text())
        assertEquals("Round complete. 1 of 1 cards. 0 correct, 1 wrong: card 1.", plain(few).field("label").text())
        assertEquals(1, plain(few).field("marks").count())
    }

    @Test
    fun `Streak has no unit, rings the previous best only when this round reached it, and pads its fields`() {
        val name = "Streak: 13 right, then wrong, past a best of 12"
        assertSameJson(
            json(
                mapOf(
                    "fields" to fields("Class" to "Streak", "Cards" to "14", "Wrong" to "01"),
                    "scoreLabel" to "Correct in a row",
                    "ended" to "Ended",
                    "endedDetail" to " · 14 cards",
                    "label" to "Streak over on card 14. 13 correct in a row. Card 14 was wrong.",
                    "marks" to 14,
                    "ring" to 11,
                ),
            ),
            plain(name),
            name,
        )
        assertEquals("12", bestText(name, 12))
        assertNull((plain("Streak: no previous best, no ring") as JsonObject)["ring"])
        assertNull((plain("Streak: a previous best of 0, no ring") as JsonObject)["ring"])
        assertNull((plain("Streak: a previous best above the score, no ring") as JsonObject)["ring"])
        assertEquals(12, plain("Streak: a previous best equal to the score rings the last right card").field("ring").count())
        assertEquals(0, plain("Streak: a previous best of 1 rings the first card").field("ring").count())
        val first = plain("Streak: wrong on the first card")
        assertEquals(" · 1 card", first.field("endedDetail").text())
        assertEquals("Streak over on card 1. 0 correct in a row. Card 1 was wrong.", first.field("label").text())
        assertEquals(listOf("Streak", "01", "01"), first.field("fields").list().map { it.field("value").text() })
        assertEquals(1, first.field("marks").count())
    }

    @Test
    fun `Three lives says the cards answered and lists the wrong cards`() {
        val name = "Three lives: 21 cards, wrong on 6, 15 and 21"
        assertSameJson(
            json(
                mapOf(
                    "fields" to fields("Class" to "Three lives", "Correct" to "18", "Wrong" to "03"),
                    "scoreLabel" to "Your score",
                    "unit" to "cards",
                    "ended" to "Out of lives",
                    "endedDetail" to "",
                    "label" to "Out of lives after 21 cards. 18 correct, 3 wrong: cards 6, 15 and 21.",
                    "marks" to 21,
                ),
            ),
            plain(name),
            name,
        )
        assertEquals("21 cards", bestText(name, 21))
    }

    @Test
    fun `Timed says the minute, the cards answered and one card in the singular`() {
        val name = "Timed: 17 answered, wrong on 4, 9 and 15"
        assertSameJson(
            json(
                mapOf(
                    "fields" to fields("Class" to "Timed", "Time" to "60 s", "Answered" to "17"),
                    "scoreLabel" to "Correct",
                    "unit" to "of 17",
                    "ended" to "Time is up",
                    "endedDetail" to " · 17 cards",
                    "label" to "Time is up. 17 cards answered in 60 seconds. 14 correct, 3 wrong: cards 4, 9 and 15.",
                    "marks" to 17,
                ),
            ),
            plain(name),
            name,
        )
        assertEquals("11", bestText(name, 11))
        val none = plain("Timed: nothing answered")
        assertEquals(listOf("Timed", "60 s", "00"), none.field("fields").list().map { it.field("value").text() })
        assertEquals("of 0", none.field("unit").text())
        assertEquals(" · 0 cards", none.field("endedDetail").text())
        assertEquals("Time is up. 0 cards answered in 60 seconds. 0 correct, 0 wrong.", none.field("label").text())
        assertEquals(0, none.field("marks").count())
        val one = plain("Timed: one right answer")
        assertEquals(" · 1 card", one.field("endedDetail").text())
        assertEquals("Time is up. 1 card answered in 60 seconds. 1 correct, 0 wrong.", one.field("label").text())
        assertEquals("of 1", one.field("unit").text())
    }

    @Test
    fun `every case lists the text of the sampled records 0, 1, 7, 9, 11, 12, 21 and 100`() {
        assertEquals(17, file.cases.size)
        val samples = listOf("0", "1", "7", "9", "11", "12", "21", "100")
        for (case in file.cases) assertEquals(samples, case.output.field("best").jsonObject.keys.toList(), case.name)
    }

    @Test
    fun `resultCopy matches every golden case`() {
        for (case in file.cases) {
            val input = file.resolve(case.input)
            val copy = resultCopy(
                resultOf(input.field("result")),
                input.field("modeName").text(),
                input.field("dealt").count(),
                input.field("previousBest").countOrNull(),
            )
            val records = case.output.field("best").jsonObject.keys.map { it.toInt() }
            assertSameJson(case.output, copyJson(copy, records), case.name)
        }
    }
}
