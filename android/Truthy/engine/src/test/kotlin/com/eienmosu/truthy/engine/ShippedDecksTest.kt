package com.eienmosu.truthy.engine

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

// The shipped content of native-data/decks decodes into the content types (reference 2.2: 4 areas, 54 decks,
// 285 sections, 7378 cards; gcp-cdl is the one deck without sections), and native-data/manifest.json agrees with it.
class ShippedDecksTest {
    /** plan A's Manifest (scripts/native/decks.ts). Strict decoding: a new or missing key fails the test. */
    @Serializable
    private data class Manifest(val format: Int, val generator: Int, val deckIndexVersion: String, val deckHashes: Map<String, String>)

    @Test
    fun theIndexAndEveryDeckFileDecode() {
        val index = Json.decodeFromString<DeckIndex>(Golden.decksDirectory.resolve("index.json").readText())
        val decks = index.areas.flatMap { it.platforms }.flatMap { it.decks }
        assertEquals(listOf("cloud", "frontend", "devops", "backend"), index.areas.map { it.id })
        assertEquals(54, decks.size)
        assertEquals(285, decks.sumOf { it.sections.size })
        assertEquals(listOf("gcp-cdl"), decks.filter { it.sections.isEmpty() }.map { it.id })
        assertEquals(7378, decks.sumOf { it.cardCount })
        var cards = 0
        for (deck in decks) {
            val file = Json.decodeFromString<DeckFile>(Golden.decksDirectory.resolve("${deck.id}.json").readText())
            assertEquals(deck.id, file.id)
            assertEquals(deck.hash, file.hash)
            assertEquals(deck.id, deck.cardCount, file.cards.size)
            assertTrue("${deck.id}: card id prefix", file.cards.all { it.id.startsWith(deck.id + "-") })
            val sections = if (deck.sections.isEmpty()) listOf(WHOLE_DECK) else deck.sections.map { it.id }
            assertTrue("${deck.id}: card sections", file.cards.all { it.section in sections })
            cards += file.cards.size
        }
        assertEquals(7378, cards)
    }

    // The app never reads the manifest; this is the one check that plan A's layout is the one this plan was written
    // for. A failure means plan A changed native-data: update this plan first.
    @Test
    fun theManifestIsFormatOneAndMatchesTheDecks() {
        val manifest = Json.decodeFromString<Manifest>(Golden.directory.parentFile.resolve("manifest.json").readText())
        assertEquals(1, manifest.format)
        assertEquals(1, manifest.generator)
        val deckFiles = Golden.decksDirectory.listFiles()!!.map { it.name }.filter { it != "index.json" }
        assertEquals(deckFiles.sorted(), manifest.deckHashes.keys.map { "$it.json" }.sorted())
        val index = Json.decodeFromString<DeckIndex>(Golden.decksDirectory.resolve("index.json").readText())
        val decks = index.areas.flatMap { it.platforms }.flatMap { it.decks }
        assertEquals(manifest.deckHashes.keys.sorted(), decks.map { it.id }.sorted())
        for (deck in decks) {
            val file = Json.decodeFromString<DeckFile>(Golden.decksDirectory.resolve("${deck.id}.json").readText())
            assertEquals(deck.id, manifest.deckHashes.getValue(deck.id), file.hash)
            assertEquals(deck.id, manifest.deckHashes.getValue(deck.id), deck.hash)
            assertEquals(deck.id, manifest.deckIndexVersion, deck.version)
        }
    }
}
