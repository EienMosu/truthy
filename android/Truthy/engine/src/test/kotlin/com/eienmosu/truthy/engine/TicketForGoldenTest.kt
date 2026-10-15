package com.eienmosu.truthy.engine

import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlin.test.assertEquals
import kotlin.test.Test

class TicketForGoldenTest : CopyGoldenBase() {
    private val file = Golden.load("components/play/useRound", "ticketFor")

    private fun foundOf(element: JsonElement): RouteInIndex = RouteInIndex(
        area = wire.decodeFromJsonElement(IndexArea.serializer(), element.field("area")),
        platform = wire.decodeFromJsonElement(IndexPlatform.serializer(), element.field("platform")),
        deck = wire.decodeFromJsonElement(IndexDeck.serializer(), element.field("deck")),
        section = element.field("section").let { if (it is JsonNull) null else wire.decodeFromJsonElement(IndexSection.serializer(), it) },
    )

    private fun ticketJson(info: TicketInfo): JsonElement = json(
        mapOf(
            "deckCode" to info.deckCode,
            "deckName" to info.deckName,
            "sectionCode" to info.sectionCode,
            "sectionName" to info.sectionName,
            "modeLabel" to info.modeLabel,
            "best" to info.best,
        ),
    )

    private fun ticketOf(name: String): TicketInfo {
        val input = file.resolve(file.inputOf(name))
        return ticketFor(foundOf(input.field("found")), modeOf(input.field("mode").text()), input.field("best").countOrNull())
    }

    @Test
    fun `the deck is named by its platform and title, or by its pass name when it has one`() {
        assertEquals("AWS Test deck", ticketOf("the platform and the deck title name the deck").deckName)
        assertEquals("Amazon Test deck", ticketOf("the deck's pass name wins when it has one").deckName)
    }

    @Test
    fun `the whole deck is ALL and Whole deck, a section is its id and title`() {
        assertEquals(
            TicketInfo("CDL", "Google Cloud Digital Leader", "ALL", "Whole deck", "Classic", null),
            ticketOf("a shipped deck with a pass name and no sections is the whole deck"),
        )
        assertEquals(
            TicketInfo("CLF", "AWS Cloud Practitioner", "BIL", "Billing, pricing and support", "Classic", null),
            ticketOf("a section of a shipped deck"),
        )
    }

    @Test
    fun `the class is named and the best is kept, a best of 0 included`() {
        val streak = ticketOf("the whole deck of a deck with sections")
        assertEquals("ALL", streak.sectionCode)
        assertEquals("Streak", streak.modeLabel)
        assertEquals(12, streak.best)
        assertEquals("Three lives", ticketOf("Three lives with a best").modeLabel)
        assertEquals(21, ticketOf("Three lives with a best").best)
        assertEquals("Timed", ticketOf("Timed with a best of 0").modeLabel)
        assertEquals(0, ticketOf("Timed with a best of 0").best)
    }

    @Test
    fun `ticketFor matches every golden case`() {
        assertEquals(7, file.cases.size)
        for (case in file.cases) {
            val input = file.resolve(case.input)
            val info = ticketFor(foundOf(input.field("found")), modeOf(input.field("mode").text()), input.field("best").countOrNull())
            assertSameJson(case.output, ticketJson(info), case.name)
        }
    }
}
