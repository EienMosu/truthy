package com.eienmosu.truthy

import com.eienmosu.truthy.engine.KeyValueStorage
import com.eienmosu.truthy.engine.PROGRESS_KEY
import com.eienmosu.truthy.engine.Progress
import com.eienmosu.truthy.engine.createLocalStore
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.io.File
import java.io.IOException

// Where the player's progress lives, behind an interface so a sync can be added later (spec 4.5). A storage
// failure never reaches the player: load gives what still reads, save does nothing when it cannot write.
interface ProgressStore {
    suspend fun load(): Progress

    suspend fun save(progress: Progress)

    // A whole read, modify and write (reference 6, save rule 5). A store with a writer holds it for the
    // whole turn, so no concurrent save is lost in between.
    suspend fun update(change: (Progress) -> Progress): Progress {
        val next = change(load())
        save(next)
        return next
    }
}

// truthy.progress.v1.json in dir (filesDir in the app), in the web's JSON shape, with the web's unreadable
// side copy truthy.progress.v1.unreadable.json. The rules are the engine's port of local.ts; this class adds
// the files, the single writer and the move off the main thread. A save never writes over the stored progress
// after the read it was built on failed; it waits for a load that succeeds.
class FileProgressStore(dir: File, private val io: CoroutineDispatcher = Dispatchers.IO) : ProgressStore {
    private val storage = GuardedStorage(FileStorage(dir))
    private val local = createLocalStore(storage)
    private val writer = FileWriters.lockFor(File(dir, FILE_NAME))

    override suspend fun load(): Progress = withContext(io) { writer.withLock { freshLoad() } }

    override suspend fun save(progress: Progress) {
        withContext(io) { writer.withLock { local.save(progress) } }
    }

    override suspend fun update(change: (Progress) -> Progress): Progress =
        withContext(io) {
            writer.withLock {
                val next = change(freshLoad())
                local.save(next)
                next
            }
        }

    // A load that the next save is built on: only a failure of this read holds that save back. Called with the
    // writer held.
    private fun freshLoad(): Progress {
        storage.progressReadFailed = false
        return local.load()
    }

    companion object {
        // Task 7's names, which the backup rules list (the progress file backed up, the side copy not).
        const val FILE_NAME = StorageNames.PROGRESS_FILE
        const val UNREADABLE_FILE_NAME = StorageNames.UNREADABLE_FILE
    }
}

// The files under the engine's store, remembering a failed read of the progress. On the web a throwing storage
// stays blocked; on Android a read can fail and later work, and a save built on the empty progress of the failed
// read would then write over every stored history and record. So once a read of the progress throws, writes of the
// progress throw too, until the store loads again. The side copy is never held back. Used with the writer held.
private class GuardedStorage(private val files: KeyValueStorage) : KeyValueStorage {
    var progressReadFailed = false

    override fun getItem(key: String): String? =
        try {
            files.getItem(key)
        } catch (e: Exception) {
            if (key == PROGRESS_KEY) progressReadFailed = true
            throw e
        }

    override fun setItem(key: String, value: String) {
        if (key == PROGRESS_KEY && progressReadFailed) throw IOException("the progress was not read; it is not written over")
        files.setItem(key, value)
    }
}
