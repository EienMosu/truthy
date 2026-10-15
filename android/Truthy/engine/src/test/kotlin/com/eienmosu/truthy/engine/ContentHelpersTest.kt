package com.eienmosu.truthy.engine

import com.eienmosu.truthy.engine.support.asBoolean
import com.eienmosu.truthy.engine.support.asString
import com.eienmosu.truthy.engine.support.decodeIndex
import com.eienmosu.truthy.engine.support.decodeRoute
import com.eienmosu.truthy.engine.support.expectCases
import com.eienmosu.truthy.engine.support.field
import com.eienmosu.truthy.engine.support.optionalString
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject

class ContentHelpersTest {
    @Test
    fun wholeDeckIsTheSectionIdThatMeansTheWholeDeck() {
        val golden = Golden.load("src/content/schema", "WHOLE_DECK")
        expectCases(golden.cases, 1)
        assertEquals(golden.cases.single().output.asString(), WHOLE_DECK)
    }

    @Test
    fun routeKeyIsTheVector() {
        val golden = Golden.load("src/content/schema", "routeKey")
        expectCases(golden.cases, 2)
        for (item in golden.cases) {
            assertEquals(item.output.asString(), routeKey(decodeRoute(item.input.field("route"))), item.name)
        }
    }

    @Test
    fun deckPassNameIsTheVector() {
        val golden = Golden.load("src/content/schema", "deckPassName")
        expectCases(golden.cases, 4)
        for (item in golden.cases) {
            val deck = item.input.field("deck").jsonObject
            val actual = deckPassName(item.input.field("platform").field("title").asString(), deck.getValue("title").asString(), deck.optionalString("passName"))
            assertEquals(item.output.asString(), actual, item.name)
        }
    }

    @Test
    fun findRouteIsTheVector() {
        val golden = Golden.load("src/content/schema", "findRoute")
        expectCases(golden.cases, 10)
        for (item in golden.cases) {
            val found = findRoute(decodeIndex(item.input.field("index")), decodeRoute(item.input.field("route")))
            if (item.output is JsonNull) {
                assertNull(found, item.name)
                continue
            }
            val actual = assertNotNull(found, item.name)
            val expected = item.output.jsonObject
            assertEquals(expected.getValue("areaId").asString(), actual.area.id, item.name)
            assertEquals(expected.getValue("platformId").asString(), actual.platform.id, item.name)
            assertEquals(expected.getValue("deckId").asString(), actual.deck.id, item.name)
            assertEquals(expected.optionalString("sectionId"), actual.section?.id, item.name)
        }
    }

    @Test
    fun poolForIsTheVector() {
        val golden = Golden.load("src/content/load", "poolFor")
        expectCases(golden.cases, 7)
        for (item in golden.cases) {
            val input = golden.resolved(item.input)
            val deck = Json.decodeFromJsonElement(DeckFile.serializer(), input.field("deck"))
            val actual = poolFor(deck, input.field("sectionId").asString())
            val expected = golden.resolved(item.output).jsonArray.map { it.field("id").asString() }
            assertEquals(expected, actual.map { it.id }, item.name)
        }
    }

    @Test
    fun textPartsIsTheVector() {
        val golden = Golden.load("src/content/text", "textParts")
        expectCases(golden.cases, 15)
        for (item in golden.cases) {
            val expected = item.output.jsonArray.map { TextPart(it.field("text").asString(), it.field("code").asBoolean()) }
            assertEquals(expected, textParts(item.input.field("text").asString()), item.name)
        }
    }

    @Test
    fun plainTextIsTheVector() {
        val golden = Golden.load("src/content/text", "plainText")
        expectCases(golden.cases, 15)
        for (item in golden.cases) {
            assertEquals(item.output.asString(), plainText(item.input.field("text").asString()), item.name)
        }
    }

    @Test
    fun partsAreCutOnUtf16UnitsLikeTheWeb() {
        val text = "Käse `ß` 😀 ende"
        assertEquals(
            listOf(TextPart("Käse ", false), TextPart("ß", true), TextPart(" 😀 ende", false)),
            textParts(text),
        )
        assertEquals("Käse ß 😀 ende", plainText(text))
    }
}
