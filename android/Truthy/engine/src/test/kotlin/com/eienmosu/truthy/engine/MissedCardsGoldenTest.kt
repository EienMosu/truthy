package com.eienmosu.truthy.engine

import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import kotlin.test.Test

class MissedCardsGoldenTest : CopyGoldenBase() {
    private val file = Golden.load("components/MissedCards", "missedCards")

    private fun numbers(name: String): List<Int> = file.outputOf(name).list().map { it.field("number").count() }

    private fun missedJson(list: List<MissedCard>): JsonElement = json(
        list.map { card ->
            val map = mutableMapOf<String, Any?>()
            map["number"] = card.number
            map["given"] = card.given
            map["answer"] = card.answer
            if (card.appliesTo != null) map["appliesTo"] = card.appliesTo
            map["statement"] = card.statement
            map["explanation"] = card.explanation
            map["source"] = mapOf("title" to card.source.title, "url" to card.source.url)
            map
        },
    )

    @Test
    fun `the wrong answers come in order, numbered by their place in the round`() {
        assertEquals(listOf(2, 3), numbers("the wrong answers in order, numbered by their place in the round"))
        assertEquals(emptyList<Int>(), numbers("no answers"))
        assertEquals(emptyList<Int>(), numbers("every answer right"))
        assertEquals(listOf(1, 2, 3), numbers("every answer wrong"))
        assertEquals(listOf(1, 10, 12), numbers("wrong on cards 1, 10 and 12 of twelve"))
        assertEquals(listOf(1, 3), numbers("the same card missed twice"))
    }

    @Test
    fun `a card with an appliesTo carries it and a card without one has none`() {
        val name = "a card with an appliesTo carries it, a card without one has none"
        val answers = file.resolve(file.inputOf(name)).field("answers").list().map { answeredOf(it) }
        val listed = missedCards(answers)
        assertEquals(answers[0].card.appliesTo, listed[0].appliesTo)
        assertTrue(listed[0].appliesTo!!.isNotEmpty())
        assertEquals(null, listed[1].appliesTo)
        val output = file.outputOf(name).list()
        assertTrue((output[0] as JsonObject).containsKey("appliesTo"))
        assertFalse((output[1] as JsonObject).containsKey("appliesTo"))
    }

    @Test
    fun `missedCards matches every golden case`() {
        assertEquals(7, file.cases.size)
        for (case in file.cases) {
            val answers = file.resolve(case.input).field("answers").list().map { answeredOf(it) }
            assertSameJson(case.output, missedJson(missedCards(answers)), case.name)
        }
    }
}
