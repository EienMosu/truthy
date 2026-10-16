package com.eienmosu.truthy.round

import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.eienmosu.truthy.AppServices
import com.eienmosu.truthy.AppViewModel
import com.eienmosu.truthy.DeckStore
import com.eienmosu.truthy.FileProgressStore
import com.eienmosu.truthy.MonotonicClock
import com.eienmosu.truthy.ProgressStore
import com.eienmosu.truthy.RoundCoordinator
import com.eienmosu.truthy.RoundJournal
import com.eienmosu.truthy.RoundLoad
import com.eienmosu.truthy.SerialWriter
import com.eienmosu.truthy.SystemWallClock
import com.eienmosu.truthy.TopScreen
import com.eienmosu.truthy.engine.Progress
import com.eienmosu.truthy.engine.Theme
import com.eienmosu.truthy.support.Device
import java.io.File
import java.io.IOException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.withContext

/** The progress store with a hold: while [hold] is set, every read, modify and write waits for it, as a slow phone does. */
internal class HeldProgressStore(private val inner: ProgressStore) : ProgressStore {
    @Volatile
    var hold: CompletableDeferred<Unit>? = null

    override suspend fun load(): Progress = inner.load()

    override suspend fun save(progress: Progress) = inner.save(progress)

    override suspend fun update(change: (Progress) -> Progress): Progress {
        hold?.await()
        return inner.update(change)
    }
}

/**
 * Task 11's AppViewModel over test services, for host tests of TruthyRoot: the real decks, the stores in a scratch
 * folder, a deck decode that can fail (spec P1), a progress write that can be held, and a monotonic clock the test
 * moves past the guards. The view model lives in its own store; [close] clears it and deletes the folder.
 */
internal class AppHostRig {
    private val dir = File(Device.app.cacheDir, "host-rig-${System.nanoTime()}").apply { mkdirs() }
    private val decks = DeckStore(Device.app.assets)
    private val writerScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val store = ViewModelStore()

    /** Every deck decode throws while this is true, as a corrupt bundle would. */
    @Volatile
    var deckFails = false

    @Volatile
    var monotonic = 1_000_000.0

    val progress = HeldProgressStore(FileProgressStore(dir))

    private val services = AppServices(
        index = { withContext(Dispatchers.IO) { decks.index() } },
        deck = { id ->
            if (deckFails) throw IOException("the deck did not decode")
            decks.deck(id)
        },
        progress = progress,
        journal = RoundJournal(dir),
        readTheme = { Theme.LIGHT },
        writeTheme = {},
        wall = SystemWallClock,
        monotonic = MonotonicClock { monotonic },
        seeds = { 7L },
        newRoundId = { "host-round" },
    )

    val app: AppViewModel = ViewModelProvider(
        store,
        viewModelFactory { initializer { AppViewModel(services, SerialWriter(writerScope), false, null) } },
    )[AppViewModel::class.java]

    val load: RoundLoad? get() = (app.screen.value as? TopScreen.Round)?.load

    val coordinator: RoundCoordinator get() = (load as RoundLoad.Ready).coordinator

    fun close() {
        store.clear()
        writerScope.cancel()
        dir.deleteRecursively()
    }
}
