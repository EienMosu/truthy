package com.eienmosu.truthy.support

import com.eienmosu.truthy.AppServices
import com.eienmosu.truthy.DeckStore
import com.eienmosu.truthy.RoundJournal
import kotlinx.coroutines.CompletableDeferred

/** The app's services over the given fakes and the real decks. A [gate] holds every deck decode until it completes. */
fun testServices(
    journal: RoundJournal,
    progress: MemoryProgressStore,
    wall: FakeClock,
    monotonic: FakeClock,
    decks: DeckStore,
    theme: ThemeBox = ThemeBox(),
    gate: CompletableDeferred<Unit>? = null,
): AppServices = AppServices(
    index = { decks.index() },
    deck = { id ->
        gate?.await()
        decks.deck(id)
    },
    progress = progress,
    journal = journal,
    readTheme = { theme.value },
    writeTheme = { chosen ->
        if (theme.fails) throw IllegalStateException("the preferences refused the write")
        theme.value = chosen
    },
    wall = wall,
    monotonic = monotonic,
    seeds = { 7L },
    newRoundId = { "round-1" },
)
