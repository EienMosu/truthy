package com.eienmosu.truthy.engine

// The small pure questions the start flow asks of the deck index and the progress
// (components/start/useCatalog.ts): how many decks an area has, how much of a deck has been seen, where "Continue"
// leads, which decks "Recent" lists. Loading and storage are the app's; nothing here reads a file.

/** How many decks "Recent" lists at most: the codes of four fit one line of the area card at 320 px. */
const val RECENT_LIMIT: Int = 4

/** The score of the last round; absent when it was left before the end. */
data class LastScore(val score: Int, val total: Int)

/** Where "Continue" leads: the last route and mode, when both can still be played. */
data class ContinueTarget(
    val route: Route,
    val mode: Mode,
    val found: RouteInIndex,
    val lastScore: LastScore?,
)

/** A deck the player has played, where it sits in the catalog, and when one of its cards was last seen. */
data class RecentDeck(
    val area: IndexArea,
    val platform: IndexPlatform,
    val deck: IndexDeck,
    /** The latest lastSeenAt among the history entries of its cards. */
    val lastSeenAt: Double,
)

/** The progress with the history of removed cards dropped, and whether that changed the number of card entries. */
data class PrunedProgress(val progress: Progress, val changed: Boolean)

/** The number of decks under an area (all its platforms). */
fun deckCount(area: IndexArea): Int = area.platforms.sumOf { it.decks.size }

/** The number of decks under a platform. */
fun deckCount(platform: IndexPlatform): Int = platform.decks.size

/** "1 deck", "3 decks", or "No decks yet". */
fun decksLabel(count: Int): String {
    if (count == 0) return "No decks yet"
    return "$count ${if (count == 1) "deck" else "decks"}"
}

/**
 * The id of the deck a card belongs to, among `deckIds`: the one whose id and a dash are the card id's longest
 * prefix, so a deck whose id begins another deck's ("gcp-cdl" and "gcp-cdl-pro") never takes that deck's cards. It
 * tries the card id's prefixes that end just before a dash, longest first: one look-up per dash.
 */
fun deckOfCard(cardId: String, deckIds: Set<String>): String? {
    var dash = cardId.lastIndexOf('-')
    while (dash > 0) {
        val prefix = cardId.substring(0, dash)
        if (prefix in deckIds) return prefix
        dash = cardId.lastIndexOf('-', dash - 1)
    }
    return null
}

/**
 * The decks of the index that the player has history on (they own a card with a history entry), in catalog order.
 * The start screen reads the files of these decks to prune their history (withoutRemovedCards).
 */
fun decksWithHistory(index: DeckIndex, progress: Progress): List<IndexDeck> {
    val decks = index.areas.flatMap { area -> area.platforms.flatMap { platform -> platform.decks } }
    val deckIds = decks.mapTo(HashSet()) { it.id }
    val played = HashSet<String>()
    for (cardId in progress.cards.keys) {
        val owner = deckOfCard(cardId, deckIds)
        if (owner != null) played.add(owner)
    }
    return decks.filter { it.id in played }
}

/**
 * Drops the history of cards that are no longer in their deck (pruneDeck for each deck in `cardIds`). `changed` is
 * true when that changed the number of card entries; the caller then saves `progress`.
 */
fun withoutRemovedCards(progress: Progress, cardIds: Map<String, List<String>>): PrunedProgress {
    var pruned = progress
    for ((deckId, ids) in cardIds) pruned = pruneDeck(pruned, deckId, ids)
    return PrunedProgress(pruned, pruned.cards.size != progress.cards.size)
}

/**
 * The seen share of a deck in whole percent: of the deck's current cards, `cardIds`, the share seen at least once.
 * While those ids are unknown (null), the history entries seen at least once whose card id starts with the deck id
 * and a dash, divided by the deck's card count. Anything seen shows at least 1, so it never reads "Not started" (0)
 * by rounding; never more than 100.
 */
fun seenPercent(progress: Progress, deckId: String, cardCount: Int, cardIds: List<String>? = null): Int {
    val share: Double =
        if (cardIds != null) {
            seenShare(progress.cards, cardIds)
        } else {
            val prefix = "$deckId-"
            val seen = progress.cards.count { (id, entry) -> id.startsWith(prefix) && entry.seen > 0 }
            if (cardCount > 0) seen.toDouble() / cardCount else 0.0
        }
    if (share <= 0.0) return 0
    return minOf(100.0, maxOf(1.0, jsRound(share * 100))).toInt()
}

fun seenPercent(progress: Progress, deck: IndexDeck, cardIds: List<String>? = null): Int =
    seenPercent(progress, deck.id, deck.cardCount, cardIds)

/** Where "Continue" leads: the last route and mode, when the class is offered and the route still resolves. */
fun continueTarget(index: DeckIndex, progress: Progress, table: List<ModeInfo> = MODE_TABLE): ContinueTarget? {
    val last = progress.last ?: return null
    if (!isOffered(last.mode, table)) return null
    val found = findRoute(index, last.route) ?: return null
    val score = last.score
    val total = last.total
    val lastScore = if (score != null && total != null) LastScore(score, total) else null
    return ContinueTarget(last.route, last.mode, found, lastScore)
}

private data class Placed(val area: IndexArea, val platform: IndexPlatform, val deck: IndexDeck)

// The web sorts with `b.lastSeenAt - a.lastSeenAt`: a difference of zero, also 0 against -0, is a tie that keeps
// catalog order. compareByDescending would put -0.0 before 0.0.
private fun newestFirst(a: Double, b: Double): Int {
    val difference = b - a
    return if (difference < 0) -1 else if (difference > 0) 1 else 0
}

/**
 * The decks of the index the player has played, newest first ("Recent"). A deck counts when at least one of its cards
 * has a history entry; its time is the latest lastSeenAt among them, and equal times keep catalog order. A card
 * belongs to the deck whose id and a dash are its longest prefix (deckOfCard).
 */
fun recentDecks(index: DeckIndex, progress: Progress, limit: Int = RECENT_LIMIT): List<RecentDeck> {
    val placed = index.areas.flatMap { area -> area.platforms.flatMap { platform -> platform.decks.map { deck -> Placed(area, platform, deck) } } }
    val deckIds = placed.mapTo(HashSet()) { it.deck.id }
    val latest = HashMap<String, Double>()
    for ((cardId, entry) in progress.cards) {
        val owner = deckOfCard(cardId, deckIds) ?: continue
        latest[owner] = maxOf(latest[owner] ?: Double.NEGATIVE_INFINITY, entry.lastSeenAt)
    }
    return placed
        .mapNotNull { place ->
            val time = latest[place.deck.id]
            if (time == null) null else RecentDeck(place.area, place.platform, place.deck, time)
        }
        .sortedWith(Comparator { a, b -> newestFirst(a.lastSeenAt, b.lastSeenAt) })
        .take(limit)
}
