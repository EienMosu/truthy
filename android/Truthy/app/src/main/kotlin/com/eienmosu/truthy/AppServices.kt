package com.eienmosu.truthy

import com.eienmosu.truthy.engine.DeckFile
import com.eienmosu.truthy.engine.DeckIndex
import com.eienmosu.truthy.engine.Theme

/**
 * The app state's window on the outside world (the web's PlayServices and StartServices): the decks, the stores,
 * the theme preference, the two clocks and the dice. AppGraph builds the real one; tests pass fakes.
 */
class AppServices(
    val index: suspend () -> DeckIndex,
    val deck: suspend (String) -> DeckFile,
    val progress: ProgressStore,
    val journal: RoundJournal,
    val readTheme: () -> Theme?,
    val writeTheme: (Theme) -> Unit,
    val wall: WallClock,
    val monotonic: MonotonicClock,
    val seeds: () -> Long,
    val newRoundId: () -> String,
)
