package com.eienmosu.truthy

import com.eienmosu.truthy.engine.Progress
import com.eienmosu.truthy.engine.createLocalStore
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.io.File

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
// the files, the single writer and the move off the main thread.
class FileProgressStore(dir: File, private val io: CoroutineDispatcher = Dispatchers.IO) : ProgressStore {
    private val local = createLocalStore(FileStorage(dir))
    private val writer = FileWriters.lockFor(File(dir, FILE_NAME))

    override suspend fun load(): Progress = withContext(io) { writer.withLock { local.load() } }

    override suspend fun save(progress: Progress) {
        withContext(io) { writer.withLock { local.save(progress) } }
    }

    override suspend fun update(change: (Progress) -> Progress): Progress =
        withContext(io) {
            writer.withLock {
                val next = change(local.load())
                local.save(next)
                next
            }
        }

    companion object {
        // Task 7's names, which the backup rules list (the progress file backed up, the side copy not).
        const val FILE_NAME = StorageNames.PROGRESS_FILE
        const val UNREADABLE_FILE_NAME = StorageNames.UNREADABLE_FILE
    }
}
