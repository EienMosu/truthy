package com.eienmosu.truthy.support

import com.eienmosu.truthy.DeckStore
import com.eienmosu.truthy.MonotonicClock
import com.eienmosu.truthy.ProgressStore
import com.eienmosu.truthy.WallClock
import com.eienmosu.truthy.engine.Progress
import com.eienmosu.truthy.engine.Theme
import com.eienmosu.truthy.engine.emptyProgress
import kotlinx.coroutines.CoroutineDispatcher
import java.io.File

// Two shipped decks the state tests use: one with sections (CON, SEC, TEC, BIL), one without.
const val CLF = "aws-clf-c02"
const val CDL = "gcp-cdl"

/** A clock the test sets by hand; one instance plays the wall clock, another the monotonic one. */
class FakeClock(var now: Double) : WallClock, MonotonicClock {
    override fun nowMs(): Double = now
}

/** Progress in memory; update is the interface's default (load, then save). */
class MemoryProgressStore(var stored: Progress = emptyProgress()) : ProgressStore {
    var saves = 0
        private set

    override suspend fun load(): Progress = stored

    override suspend fun save(progress: Progress) {
        stored = progress
        saves += 1
    }
}

/** The stored theme, and whether storing it fails. */
class ThemeBox(var value: Theme? = null, val fails: Boolean = false)

/** The real embedded decks, decoded on the test's own dispatcher so virtual time covers them. */
fun testDeckStore(io: CoroutineDispatcher): DeckStore =
    DeckStore(open = { name -> File(nativeDecksDir(), name).inputStream() }, io = io)
