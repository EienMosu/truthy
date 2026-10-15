package com.eienmosu.truthy.support

import com.eienmosu.truthy.DeckStore
import java.io.ByteArrayInputStream
import java.io.File
import java.io.FileNotFoundException
import java.nio.file.Files

// A wall-clock time in epoch milliseconds, as answers carry it.
const val T0 = 1_790_000_000_000.0

// The repository's native-data/decks, found by walking up from the working directory of the test (Gradle
// runs unit tests in the module folder, android/Truthy/app), so no path is written into a committed file.
fun nativeDecksDir(): File {
    var dir: File? = File(checkNotNull(System.getProperty("user.dir"))).absoluteFile
    while (dir != null) {
        val decks = File(dir, "native-data/decks")
        if (File(decks, "index.json").isFile) return decks
        dir = dir.parentFile
    }
    error("native-data/decks/index.json was not found above the working directory of the test")
}

// The repository root: the folder that holds native-data.
fun repositoryRoot(): File = checkNotNull(nativeDecksDir().parentFile?.parentFile)

// A deck store over the real embedded decks, read from the repository instead of the APK's assets.
fun repositoryDeckStore(): DeckStore = DeckStore(open = { name -> File(nativeDecksDir(), name).inputStream() })

fun newTempDir(): File = Files.createTempDirectory("truthy-data").toFile()

// A two-card deck in the shipped deck file's shape: tiny-01 is true, tiny-02 is false.
const val TINY_DECK_JSON =
    "{\"id\":\"tiny\",\"hash\":\"0000000000000000\",\"cards\":[" +
        "{\"id\":\"tiny-01\",\"section\":\"S01\",\"text\":{\"en\":{\"statement\":\"A `pod` is the smallest unit Kubernetes schedules.\"," +
        "\"explanation\":\"Kubernetes schedules pods, not containers.\"}},\"answer\":true," +
        "\"source\":{\"title\":\"Pods\",\"url\":\"https://example.com/pods\"},\"difficulty\":1,\"appliesTo\":\"\",\"conflictGroups\":[]}," +
        "{\"id\":\"tiny-02\",\"section\":\"S01\",\"text\":{\"en\":{\"statement\":\"A Service stores container images.\"," +
        "\"explanation\":\"A registry stores images; a Service routes traffic.\"}},\"answer\":false," +
        "\"source\":{\"title\":\"Services\",\"url\":\"https://example.com/services\"},\"difficulty\":1,\"appliesTo\":\"\",\"conflictGroups\":[]}" +
        "]}"

// A deck store that serves the tiny deck as tiny.json, the extra files given, and nothing else.
fun tinyDeckStore(extra: Map<String, String> = emptyMap()): DeckStore {
    val files = mapOf("tiny.json" to TINY_DECK_JSON) + extra
    return DeckStore(open = { name -> ByteArrayInputStream((files[name] ?: throw FileNotFoundException(name)).toByteArray()) })
}
