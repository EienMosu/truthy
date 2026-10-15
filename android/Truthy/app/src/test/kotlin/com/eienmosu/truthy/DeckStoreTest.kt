package com.eienmosu.truthy

import com.eienmosu.truthy.support.TINY_DECK_JSON
import com.eienmosu.truthy.support.nativeDecksDir
import com.eienmosu.truthy.support.repositoryDeckStore
import com.eienmosu.truthy.support.tinyDeckStore
import kotlinx.coroutines.runBlocking
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertSame

class DeckStoreTest {
    private val store = repositoryDeckStore()
    private val entries get() = store.index().areas.flatMap { it.platforms }.flatMap { it.decks }

    @Test
    fun theIndexListsEveryDeckFileOnce() {
        val ids = entries.map { it.id }
        val files = nativeDecksDir().list()!!.filter { it.endsWith(".json") && it != DeckStore.INDEX_ASSET }.map { it.removeSuffix(".json") }
        assertEquals(ids.size, ids.toSet().size, "a deck id is listed twice")
        assertEquals(files.sorted(), ids.sorted())
    }

    @Test
    fun everyDeckDecodesWithTheCountsAndTheHashOfTheIndex() {
        runBlocking {
            for (entry in entries) {
                val deck = store.deck(entry.id)
                assertEquals(entry.id, deck.id)
                assertEquals(entry.hash, deck.hash, entry.id)
                assertEquals(entry.cardCount, deck.cards.size, entry.id)
                for (section in entry.sections) {
                    assertEquals(section.cardCount, deck.cards.count { it.section == section.id }, "${entry.id} ${section.id}")
                }
            }
        }
    }

    @Test
    fun cardsKeepTheOrderOfTheDeckFile() {
        val idPattern = Regex("\"id\"\\s*:\\s*\"([^\"]*)\"")
        runBlocking {
            for (entry in entries) {
                val raw = File(nativeDecksDir(), DeckStore.deckAsset(entry.id)).readText()
                val inFile = idPattern.findAll(raw).map { it.groupValues[1] }.drop(1).toList()
                assertEquals(inFile, store.deck(entry.id).cards.map { it.id }, entry.id)
            }
        }
    }

    @Test
    fun aDeckThatIsNotEmbeddedFailsWithADeckLoadError() {
        runBlocking {
            assertFailsWith<DeckLoadError> { store.deck("no-such-deck") }
        }
    }

    @Test
    fun aFileThatHoldsAnotherDeckFails() {
        runBlocking {
            assertFailsWith<DeckLoadError> { tinyDeckStore(mapOf("copy.json" to TINY_DECK_JSON)).deck("copy") }
        }
    }

    @Test
    fun aFileThatIsNotADeckFails() {
        runBlocking {
            assertFailsWith<DeckLoadError> { tinyDeckStore(mapOf("bad.json" to "{\"id\":\"bad\"")).deck("bad") }
        }
    }

    @Test
    fun theSameDeckTwiceIsDecodedOnce() {
        runBlocking {
            val tiny = tinyDeckStore()
            assertSame(tiny.deck("tiny"), tiny.deck("tiny"))
        }
    }

    @Test
    fun theIndexIsDecodedOnce() {
        assertSame(store.index(), store.index())
    }

    @Test
    fun theFilesAreReadFromTheRootOfTheAssets() {
        assertEquals("index.json", DeckStore.INDEX_ASSET)
        assertEquals("aws-clf-c02.json", DeckStore.deckAsset("aws-clf-c02"))
    }
}
