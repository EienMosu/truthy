package com.eienmosu.truthy

import androidx.core.util.AtomicFile
import com.eienmosu.truthy.engine.KeyValueStorage
import kotlinx.coroutines.sync.Mutex
import java.io.File
import java.io.FileNotFoundException
import java.io.IOException
import java.util.concurrent.ConcurrentHashMap

// The web's localStorage for the engine's progress store (task 4): key K is the file K.json in dir. Reads
// give null only when the file does not exist; any other failure throws, as a blocked storage does on the
// web. Writes are atomic. Callers hold the file's lock from FileWriters around every call.
internal class FileStorage(private val dir: File) : KeyValueStorage {
    override fun getItem(key: String): String? = readAtomically(atomicFile(key))

    override fun setItem(key: String, value: String) {
        writeAtomically(atomicFile(key), value.toByteArray(Charsets.UTF_8))
    }

    private fun atomicFile(key: String): AtomicFile = AtomicFile(File(dir, "$key.json"))
}

// The file's text, or null when it does not exist. A .new file left by a killed write is ignored, and a
// first write that never finished reads as nothing. Malformed UTF-8 becomes U+FFFD.
internal fun readAtomically(file: AtomicFile): String? =
    try {
        file.readFully().toString(Charsets.UTF_8)
    } catch (e: FileNotFoundException) {
        if (file.baseFile.exists()) throw e else null
    }

// Writes the bytes to file.new, then syncs and renames it over the file. AtomicFile.finishWrite only logs a
// failed rename, so a .new file still there afterwards is reported as the failure it is.
internal fun writeAtomically(file: AtomicFile, bytes: ByteArray) {
    val stream = file.startWrite()
    try {
        stream.write(bytes)
    } catch (e: IOException) {
        file.failWrite(stream)
        throw e
    }
    file.finishWrite(stream)
    if (File(file.baseFile.path + ".new").exists()) throw IOException("${file.baseFile.name} was not replaced")
}

// One lock per file path for the whole process: the single writer of spec 4.5. Reads take it too, because
// AtomicFile.openRead deletes a .new file it finds, which may be a write in progress.
internal object FileWriters {
    private val locks = ConcurrentHashMap<String, Mutex>()

    fun lockFor(file: File): Mutex = locks.computeIfAbsent(file.absolutePath) { Mutex() }
}
