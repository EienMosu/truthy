// The shipped content, as src/content/schema.ts describes it: native-data/decks/index.json and
// native-data/decks/<deckId>.json decode into these types. Property order is the order of a shipped card's keys.
package com.eienmosu.truthy.engine

import kotlinx.serialization.Serializable

/** The section id that means "the whole deck" (schema.ts: WHOLE_DECK). */
const val WHOLE_DECK = "ALL"

@Serializable
data class CardTextEn(val statement: String, val explanation: String)

/** A card's text by language. Only English ships. */
@Serializable
data class CardText(val en: CardTextEn)

@Serializable
data class CardSource(val title: String, val url: String)

/** One statement. Engine code compares cards by `id`, never by the whole value. */
@Serializable
data class Card(
    val id: String,
    val section: String,
    val text: CardText,
    val answer: Boolean,
    val source: CardSource,
    val difficulty: Int,
    val appliesTo: String,
    val conflictGroups: List<String>,
)

@Serializable
data class DeckFile(val id: String, val hash: String, val cards: List<Card>)

@Serializable
data class IndexSection(val id: String, val title: String, val cardCount: Int)

@Serializable
data class IndexDeck(
    val id: String,
    val code: String,
    val title: String,
    /** Absent in the file when the deck has none; encoding leaves the key out again. */
    val passName: String? = null,
    val cardCount: Int,
    val version: String,
    val hash: String,
    val sections: List<IndexSection>,
)

@Serializable
data class IndexPlatform(val id: String, val title: String, val decks: List<IndexDeck>)

@Serializable
data class IndexArea(val id: String, val title: String, val platforms: List<IndexPlatform>)

@Serializable
data class DeckIndex(val areas: List<IndexArea>)

/** A deck and a section of it, or WHOLE_DECK. */
@Serializable
data class Route(val deckId: String, val sectionId: String)
