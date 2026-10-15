package com.eienmosu.truthy.engine

import kotlinx.serialization.SerializationException
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

// A card of native-data/decks/angular-fundamentals.json, byte for byte as the web build writes it.
private const val SHIPPED_CARD =
    """{"id":"angular-fundamentals-sr2-05","section":"CMP","text":{"en":{"statement":"Angular writes two-way binding with parentheses inside square brackets, as in [(value)].","explanation":"The [(...)] form combines the property's binding with the corresponding event binding."}},"answer":true,"source":{"title":"Two-way binding","url":"https://angular.dev/guide/templates/two-way-binding"},"difficulty":1,"appliesTo":"Angular v22","conflictGroups":["two-way-binding-syntax"]}"""

// Two decks of an index: one with a pass name and no sections (gcp-cdl), one without a pass name.
private const val SHIPPED_INDEX =
    """{"areas":[{"id":"cloud","title":"Cloud","platforms":[{"id":"gcp","title":"Google Cloud","decks":[{"id":"gcp-cdl","code":"CDL","title":"Cloud Digital Leader","passName":"Google Cloud Digital Leader","cardCount":133,"version":"2026-10-15","hash":"ed6f6217a4eb6f9c","sections":[]}]},{"id":"aws","title":"AWS","decks":[{"id":"aws-clf-c02","code":"CLF","title":"Cloud Practitioner","cardCount":214,"version":"2026-10-15","hash":"63acac4acc4a6213","sections":[{"id":"CON","title":"Cloud concepts","cardCount":45}]}]}]}]}"""

class ContentTest {
    private val json = Json

    @Test
    fun decodesAShippedCard() {
        val card = json.decodeFromString<Card>(SHIPPED_CARD)
        assertEquals("angular-fundamentals-sr2-05", card.id)
        assertEquals("CMP", card.section)
        assertEquals("Angular writes two-way binding with parentheses inside square brackets, as in [(value)].", card.text.en.statement)
        assertEquals("The [(...)] form combines the property's binding with the corresponding event binding.", card.text.en.explanation)
        assertTrue(card.answer)
        assertEquals(CardSource("Two-way binding", "https://angular.dev/guide/templates/two-way-binding"), card.source)
        assertEquals(1, card.difficulty)
        assertEquals("Angular v22", card.appliesTo)
        assertEquals(listOf("two-way-binding-syntax"), card.conflictGroups)
        assertEquals(SHIPPED_CARD, json.encodeToString(card))
    }

    @Test
    fun refusesACardWithoutAnAnswer() {
        val broken = SHIPPED_CARD.replace(""""answer":true,""", "")
        assertThrows(SerializationException::class.java) { json.decodeFromString<Card>(broken) }
    }

    @Test
    fun decodesAnIndexWithAndWithoutAPassName() {
        val index = json.decodeFromString<DeckIndex>(SHIPPED_INDEX)
        val platforms = index.areas[0].platforms
        assertEquals(listOf("cloud"), index.areas.map { it.id })
        assertEquals(listOf("Google Cloud", "AWS"), platforms.map { it.title })
        val cdl = platforms[0].decks[0]
        assertEquals("Google Cloud Digital Leader", cdl.passName)
        assertTrue(cdl.sections.isEmpty())
        val clf = platforms[1].decks[0]
        assertNull(clf.passName)
        assertEquals("CLF", clf.code)
        assertEquals(214, clf.cardCount)
        assertEquals("2026-10-15", clf.version)
        assertEquals("63acac4acc4a6213", clf.hash)
        assertEquals(listOf(IndexSection("CON", "Cloud concepts", 45)), clf.sections)
        assertEquals(SHIPPED_INDEX, json.encodeToString(index))
    }

    @Test
    fun leavesAMissingPassNameOutWhenEncoding() {
        val clf = json.decodeFromString<DeckIndex>(SHIPPED_INDEX).areas[0].platforms[1].decks[0]
        assertFalse(json.encodeToString(clf).contains("passName"))
    }

    @Test
    fun decodesADeckFile() {
        val deck = json.decodeFromString<DeckFile>("""{"id":"angular-fundamentals","hash":"0123456789abcdef","cards":[$SHIPPED_CARD]}""")
        assertEquals("angular-fundamentals", deck.id)
        assertEquals("0123456789abcdef", deck.hash)
        assertEquals(listOf("angular-fundamentals-sr2-05"), deck.cards.map { it.id })
    }

    @Test
    fun namesTheWholeDeckAndTheClassesAsTheWebDoes() {
        assertEquals("ALL", WHOLE_DECK)
        assertEquals(listOf("classic", "streak", "lives", "timed"), Mode.entries.map { it.wire })
        assertEquals(Mode.entries.toList(), MODES)
        assertEquals("classic", Mode.CLASSIC.wire)
        assertEquals(Route("gcp-cdl", WHOLE_DECK), json.decodeFromString<Route>("""{"deckId":"gcp-cdl","sectionId":"ALL"}"""))
        assertEquals(Mode.LIVES, json.decodeFromString<Mode>("\"lives\""))
        assertEquals("\"timed\"", json.encodeToString(Mode.TIMED))
    }

    @Test
    fun keepsHistoryAndAnswersAsTheProgressFileWritesThem() {
        val history = json.decodeFromString<History>("""{"gcp-cdl-s1.1-01":{"seen":2,"lastCorrect":false,"lastSeenAt":1760000000000}}""")
        assertEquals(CardHistory(seen = 2, lastCorrect = false, lastSeenAt = 1_760_000_000_000.0), history["gcp-cdl-s1.1-01"])
        val card = json.decodeFromString<Card>(SHIPPED_CARD)
        val answer = Answered(card = card, given = false, correct = false, at = 1_760_000_000_500.0)
        val result = RoundResult(
            mode = Mode.CLASSIC,
            route = Route("angular-fundamentals", "CMP"),
            score = 0,
            total = 1,
            answers = listOf(answer),
            missed = listOf(answer),
            abandoned = false,
        )
        assertEquals(result, json.decodeFromString<RoundResult>(json.encodeToString(result)))
    }
}
