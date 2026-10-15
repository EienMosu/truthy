package com.eienmosu.truthy

import android.content.Context
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.withContext

/**
 * One of each store for the whole process (task 9: one is enough), and the one writer in a scope that outlives
 * every activity and view model, so a write handed in just before a "Don't keep activities" teardown still lands.
 */
class AppGraph private constructor(context: Context) {
    private val decks = DeckStore(context.assets)
    private val progress = FileProgressStore(context.filesDir)
    private val journal = RoundJournal(context.filesDir)
    val themeStore = ThemeStore(context.getSharedPreferences(ThemeStore.PREFS_NAME, Context.MODE_PRIVATE))
    val writer = SerialWriter(CoroutineScope(SupervisorJob() + Dispatchers.IO))

    fun services(debug: DebugLaunch?): AppServices {
        val fixedSeed = debug?.seed
        val seeds: () -> Long = if (fixedSeed != null) {
            { fixedSeed }
        } else {
            { secureSeed() }
        }
        return AppServices(
            index = { withContext(Dispatchers.IO) { decks.index() } },
            deck = { id -> decks.deck(id) },
            progress = progress,
            journal = journal,
            readTheme = { themeStore.stored },
            writeTheme = { theme -> themeStore.store(theme) },
            wall = SystemWallClock,
            monotonic = SystemMonotonicClock,
            seeds = seeds,
            newRoundId = { newRoundId() },
        )
    }

    companion object {
        @Volatile
        private var instance: AppGraph? = null

        fun get(context: Context): AppGraph =
            instance ?: synchronized(this) {
                instance ?: AppGraph(context.applicationContext).also { instance = it }
            }
    }
}
