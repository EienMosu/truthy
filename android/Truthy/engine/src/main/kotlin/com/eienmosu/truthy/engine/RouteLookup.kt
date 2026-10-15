package com.eienmosu.truthy.engine

// Routes, names and the pool of a route (src/content/schema.ts and src/content/load.ts).

/** Everything the index says about one route. `section` is null for the whole deck. */
data class RouteInIndex(
    val area: IndexArea,
    val platform: IndexPlatform,
    val deck: IndexDeck,
    val section: IndexSection?,
)

/**
 * The deck's name on the pass and the ticket: its own pass name when the catalog gives one, else the platform and
 * the deck title ("AWS Cloud Practitioner"). A pass name that is empty is still a pass name, as on the web.
 */
fun deckPassName(platformTitle: String, deckTitle: String, passName: String? = null): String =
    passName ?: "$platformTitle $deckTitle"

fun deckPassName(platform: IndexPlatform, deck: IndexDeck): String = deckPassName(platform.title, deck.title, deck.passName)

fun routeKey(route: Route): String = "${route.deckId}/${route.sectionId}"

/**
 * Finds a route in the index, or null when its deck or section is gone. The first deck with that id decides:
 * when it lacks the section the answer is null, whatever later platforms hold.
 */
fun findRoute(index: DeckIndex, route: Route): RouteInIndex? {
    for (area in index.areas) {
        for (platform in area.platforms) {
            val deck = platform.decks.firstOrNull { it.id == route.deckId } ?: continue
            if (route.sectionId == WHOLE_DECK) return RouteInIndex(area, platform, deck, null)
            val section = deck.sections.firstOrNull { it.id == route.sectionId }
            return if (section != null) RouteInIndex(area, platform, deck, section) else null
        }
    }
    return null
}

/** The cards a round on this route deals from. WHOLE_DECK gives every card; an unknown section gives none. */
fun poolFor(deck: DeckFile, sectionId: String): List<Card> {
    if (sectionId == WHOLE_DECK) return deck.cards.toList()
    return deck.cards.filter { it.section == sectionId }
}
