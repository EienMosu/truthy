package com.eienmosu.truthy.engine

/** What the ticket shows about the route, taken from the deck index. */
data class TicketInfo(
    /** "CLF". */
    val deckCode: String,
    /** "AWS Cloud Practitioner": the platform title plus the deck title, or the deck's pass name. */
    val deckName: String,
    /** "SEC", or "ALL" for the whole deck. */
    val sectionCode: String,
    /** "Security and compliance", or "Whole deck". */
    val sectionName: String,
    /** "Classic". */
    val modeLabel: String,
    /** The record for this route and class when the round was dealt. */
    val best: Int?,
)

/** What the ticket shows about a route that was found in the index, for the class played. */
fun ticketFor(found: RouteInIndex, mode: Mode, best: Int?): TicketInfo = TicketInfo(
    deckCode = found.deck.code,
    deckName = deckPassName(found.platform, found.deck),
    sectionCode = found.section?.id ?: WHOLE_DECK,
    sectionName = found.section?.title ?: "Whole deck",
    modeLabel = modeInfo(mode).name,
    best = best,
)
