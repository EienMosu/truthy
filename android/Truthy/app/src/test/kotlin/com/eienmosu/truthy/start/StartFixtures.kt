package com.eienmosu.truthy.start

import com.eienmosu.truthy.engine.CardHistory
import com.eienmosu.truthy.engine.DeckIndex
import com.eienmosu.truthy.engine.IndexArea
import com.eienmosu.truthy.engine.IndexDeck
import com.eienmosu.truthy.engine.IndexPlatform
import com.eienmosu.truthy.engine.IndexSection
import com.eienmosu.truthy.engine.LastRound
import com.eienmosu.truthy.engine.Progress
import com.eienmosu.truthy.engine.RecentDeck

/**
 * The web's start-flow test index (tests/components/start/fixtures.ts): Cloud with AWS (CLF, two sections),
 * Google Cloud (CDL, no sections) and Azure (no decks); Frontend with Next.js (RND); DevOps with no platforms.
 */
object StartFixtures {
    val CLF = IndexDeck(
        id = "aws-clf-c02", code = "CLF", title = "Cloud Practitioner", passName = null, cardCount = 92,
        version = "2026-10-01", hash = "clf-1",
        sections = listOf(
            IndexSection(id = "CON", title = "Cloud concepts", cardCount = 45),
            IndexSection(id = "SEC", title = "Security and compliance", cardCount = 47),
        ),
    )
    val CDL = IndexDeck(
        id = "gcp-cdl", code = "CDL", title = "Cloud Digital Leader", passName = "Google Cloud Digital Leader", cardCount = 133,
        version = "2026-10-01", hash = "cdl-1", sections = emptyList(),
    )
    val RND = IndexDeck(
        id = "nextjs-rendering", code = "RND", title = "Rendering", passName = null, cardCount = 12,
        version = "2026-10-01", hash = "rnd-1",
        sections = listOf(IndexSection(id = "RSC", title = "Server and client components", cardCount = 12)),
    )
    val AWS = IndexPlatform(id = "aws", title = "AWS", decks = listOf(CLF))
    val GCP = IndexPlatform(id = "gcp", title = "Google Cloud", decks = listOf(CDL))
    val AZURE = IndexPlatform(id = "azure", title = "Azure", decks = emptyList())
    val NEXTJS = IndexPlatform(id = "nextjs", title = "Next.js", decks = listOf(RND))
    val CLOUD = IndexArea(id = "cloud", title = "Cloud", platforms = listOf(AWS, GCP, AZURE))
    val FRONTEND = IndexArea(id = "frontend", title = "Frontend", platforms = listOf(NEXTJS))
    val DEVOPS = IndexArea(id = "devops", title = "DevOps", platforms = emptyList())
    val INDEX = DeckIndex(areas = listOf(CLOUD, FRONTEND, DEVOPS))

    /** Two decks played: CLF last, CDL before it (useCatalog's recentDecks order). */
    val RECENT_TWO = listOf(
        RecentDeck(area = CLOUD, platform = AWS, deck = CLF, lastSeenAt = 2000.0),
        RecentDeck(area = CLOUD, platform = GCP, deck = CDL, lastSeenAt = 1000.0),
    )

    fun progressOf(
        cards: Map<String, CardHistory> = emptyMap(),
        records: Map<String, Int> = emptyMap(),
        last: LastRound? = null,
    ): Progress = Progress(version = 1, cards = cards, records = records, last = last)

    fun data(
        progress: Progress = progressOf(),
        recent: List<RecentDeck> = emptyList(),
        cardIds: Map<String, List<String>> = emptyMap(),
    ): StartData = StartData(index = INDEX, progress = progress, cardIds = cardIds, recent = recent)
}
