package com.eienmosu.truthy.engine

import com.eienmosu.truthy.engine.support.asBoolean
import com.eienmosu.truthy.engine.support.asDouble
import com.eienmosu.truthy.engine.support.asInt
import com.eienmosu.truthy.engine.support.asString
import com.eienmosu.truthy.engine.support.decodeIndex
import com.eienmosu.truthy.engine.support.decodeProgress
import com.eienmosu.truthy.engine.support.decodeRoute
import com.eienmosu.truthy.engine.support.expectCases
import com.eienmosu.truthy.engine.support.field
import com.eienmosu.truthy.engine.support.isUndefined
import com.eienmosu.truthy.engine.support.modeOf
import com.eienmosu.truthy.engine.support.optionalField
import com.eienmosu.truthy.engine.support.optionalString
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject

private data class RecentIds(val areaId: String, val platformId: String, val deckId: String, val lastSeenAt: Double)

private fun deckOf(id: String): IndexDeck =
    IndexDeck(id = id, code = "AAA", title = id, cardCount = 10, version = "2026-10-01", hash = "h", sections = emptyList())

private fun indexOf(vararg ids: String): DeckIndex =
    DeckIndex(
        listOf(
            IndexArea(
                id = "cloud",
                title = "Cloud",
                platforms = listOf(IndexPlatform(id = "aws", title = "AWS", decks = ids.map(::deckOf))),
            ),
        ),
    )

private fun seenAt(time: Double): CardHistory = CardHistory(seen = 1, lastCorrect = true, lastSeenAt = time)

class CatalogTest {
    @Test
    fun deckCountIsTheVector() {
        val golden = Golden.load("components/start/useCatalog", "deckCount")
        expectCases(golden.cases, 5)
        for (item in golden.cases) {
            val place = item.input.field("place")
            val actual =
                if (place.jsonObject.containsKey("platforms")) {
                    deckCount(Json.decodeFromJsonElement(IndexArea.serializer(), place))
                } else {
                    deckCount(Json.decodeFromJsonElement(IndexPlatform.serializer(), place))
                }
            assertEquals(item.output.asInt(), actual, item.name)
        }
    }

    @Test
    fun decksLabelIsTheVector() {
        val golden = Golden.load("components/start/useCatalog", "decksLabel")
        expectCases(golden.cases, 6)
        for (item in golden.cases) {
            assertEquals(item.output.asString(), decksLabel(item.input.field("count").asInt()), item.name)
        }
    }

    @Test
    fun deckOfCardIsTheVector() {
        val golden = Golden.load("components/start/useCatalog", "deckOfCard")
        expectCases(golden.cases, 13)
        for (item in golden.cases) {
            val deckIds = item.input.field("deckIds").jsonArray.map { it.asString() }.toSet()
            val actual = deckOfCard(item.input.field("cardId").asString(), deckIds)
            if (isUndefined(item.output)) {
                assertNull(actual, item.name)
            } else {
                assertEquals(item.output.asString(), actual, item.name)
            }
        }
    }

    @Test
    fun seenPercentIsTheVector() {
        val golden = Golden.load("components/start/useCatalog", "seenPercent")
        expectCases(golden.cases, 20)
        for (item in golden.cases) {
            val input = item.input.jsonObject
            val deck = input.getValue("deck")
            val cardIds = input.optionalField("cardIds")?.jsonArray?.map { it.asString() }
            val actual = seenPercent(decodeProgress(input.getValue("progress")), deck.field("id").asString(), deck.field("cardCount").asInt(), cardIds)
            assertEquals(item.output.asInt(), actual, item.name)
        }
    }

    @Test
    fun continueTargetIsTheVector() {
        val golden = Golden.load("components/start/useCatalog", "continueTarget")
        expectCases(golden.cases, 12)
        for (item in golden.cases) {
            val actual = continueTarget(decodeIndex(item.input.field("index")), decodeProgress(item.input.field("progress")), tableOf(item.input))
            if (item.output is JsonNull) {
                assertNull(actual, item.name)
                continue
            }
            val target = assertNotNull(actual, item.name)
            val expected = item.output.jsonObject
            assertEquals(decodeRoute(expected.getValue("route")), target.route, item.name)
            assertEquals(modeOf(expected.getValue("mode").asString()), target.mode, item.name)
            val found = expected.getValue("found").jsonObject
            assertEquals(found.getValue("areaId").asString(), target.found.area.id, item.name)
            assertEquals(found.getValue("platformId").asString(), target.found.platform.id, item.name)
            assertEquals(found.getValue("deckId").asString(), target.found.deck.id, item.name)
            assertEquals(found.optionalString("sectionId"), target.found.section?.id, item.name)
            val score = expected.getValue("lastScore")
            if (score is JsonNull) {
                assertNull(target.lastScore, item.name)
            } else {
                assertEquals(LastScore(score.field("score").asInt(), score.field("total").asInt()), target.lastScore, item.name)
            }
        }
    }

    @Test
    fun recentDecksIsTheVector() {
        val golden = Golden.load("components/start/useCatalog", "recentDecks")
        expectCases(golden.cases, 16)
        for (item in golden.cases) {
            val input = item.input.jsonObject
            val index = decodeIndex(input.getValue("index"))
            val progress = decodeProgress(input.getValue("progress"))
            val limit = input.optionalField("limit")?.asInt()
            val actual = if (limit == null) recentDecks(index, progress) else recentDecks(index, progress, limit)
            val expected =
                item.output.jsonArray.map {
                    RecentIds(it.field("areaId").asString(), it.field("platformId").asString(), it.field("deckId").asString(), it.field("lastSeenAt").asDouble())
                }
            assertEquals(expected, actual.map { RecentIds(it.area.id, it.platform.id, it.deck.id, it.lastSeenAt) }, item.name)
        }
    }

    @Test
    fun recentLimitIsTheVector() {
        val golden = Golden.load("components/start/useCatalog", "RECENT_LIMIT")
        expectCases(golden.cases, 1)
        assertEquals(golden.cases.single().output.asInt(), RECENT_LIMIT)
    }

    @Test
    fun withoutRemovedCardsIsTheVector() {
        val golden = Golden.load("components/start/useCatalog", "withoutRemovedCards")
        expectCases(golden.cases, 8)
        for (item in golden.cases) {
            val cardIds = item.input.field("cardIds").jsonObject.mapValues { (_, ids) -> ids.jsonArray.map { it.asString() } }
            val result = withoutRemovedCards(decodeProgress(item.input.field("progress")), cardIds)
            assertEquals(decodeProgress(item.output.field("progress")), result.progress, item.name)
            assertEquals(item.output.field("saved").asBoolean(), result.changed, item.name)
        }
    }

    @Test
    fun theShareRoundsHalfUpWhereKotlinRoundsHalfToEven() {
        fun percentOf(seen: Int, of: Int): Int {
            val cards = (0 until seen).associate { "d-$it" to seenAt(1.0) }
            return seenPercent(emptyProgress().copy(cards = cards), "d", of)
        }
        assertEquals(13, percentOf(1, 8)) // 12.5
        assertEquals(38, percentOf(3, 8)) // 37.5
        assertEquals(63, percentOf(5, 8)) // 62.5, which half to even would make 62
    }

    @Test
    fun equalTimesKeepCatalogOrderEvenForZeroAgainstNegativeZero() {
        val progress = emptyProgress().copy(cards = mapOf("a-1" to seenAt(-0.0), "b-1" to seenAt(0.0)))
        assertEquals(listOf("a", "b"), recentDecks(indexOf("a", "b"), progress).map { it.deck.id })
        assertEquals(listOf("b", "a"), recentDecks(indexOf("b", "a"), progress).map { it.deck.id })
    }

    @Test
    fun decksWithHistoryAreTheOwnersOfTheStoredCardsInCatalogOrder() {
        val index = indexOf("aws", "gcp-cdl", "gcp-cdl-pro")
        val proOnly = emptyProgress().copy(cards = mapOf("gcp-cdl-pro-1" to seenAt(1.0)))
        assertEquals(listOf("gcp-cdl-pro"), decksWithHistory(index, proOnly).map { it.id })
        val two = emptyProgress().copy(cards = mapOf("gcp-cdl-pro-1" to seenAt(1.0), "aws-3" to seenAt(2.0), "unknown-1" to seenAt(3.0)))
        assertEquals(listOf("aws", "gcp-cdl-pro"), decksWithHistory(index, two).map { it.id })
        assertEquals(emptyList(), decksWithHistory(index, emptyProgress()).map { it.id })
    }
}
