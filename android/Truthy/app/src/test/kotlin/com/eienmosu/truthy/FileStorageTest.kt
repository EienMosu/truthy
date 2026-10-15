package com.eienmosu.truthy

import com.eienmosu.truthy.support.newTempDir
import java.io.File
import java.io.IOException
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertFails
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.test.assertTrue

class FileStorageTest {
    private val dir = newTempDir()
    private val storage = FileStorage(dir)

    @AfterTest
    fun removeTheFolder() {
        dir.deleteRecursively()
    }

    @Test
    fun aKeyNeverWrittenReadsAsNothing() {
        assertNull(storage.getItem("truthy.progress.v1"))
    }

    @Test
    fun aValueReadsBackExactlyWithItsNonAsciiText() {
        val value = "{\"title\":\"Kubernetes \u2022 \u00a7 \u2013 \u2019 \u00e9 \u00c9 \u2192 \u00b7\"}"
        storage.setItem("k", value)
        assertEquals(value, FileStorage(dir).getItem("k"))
    }

    @Test
    fun eachKeyIsItsOwnJsonFileInUtf8() {
        storage.setItem("truthy.progress.v1", "\u00e9")
        assertContentEquals(byteArrayOf(0xC3.toByte(), 0xA9.toByte()), File(dir, "truthy.progress.v1.json").readBytes())
    }

    @Test
    fun aLaterWriteReplacesTheWholeValue() {
        storage.setItem("k", "a long first value")
        storage.setItem("k", "short")
        assertEquals("short", storage.getItem("k"))
    }

    @Test
    fun aWriteLeavesNoTemporaryFileBehind() {
        storage.setItem("k", "v")
        assertEquals(listOf("k.json"), dir.list()!!.toList())
    }

    @Test
    fun aHalfWrittenFileFromAKilledWriteIsIgnored() {
        storage.setItem("k", "complete")
        File(dir, "k.json.new").writeText("{\"half")
        assertEquals("complete", FileStorage(dir).getItem("k"))
    }

    @Test
    fun aFirstWriteThatNeverFinishedReadsAsNothing() {
        File(dir, "k.json.new").writeText("{\"half")
        assertNull(storage.getItem("k"))
    }

    @Test
    fun aMissingFolderIsCreatedByTheFirstWrite() {
        val nested = FileStorage(File(dir, "later"))
        assertNull(nested.getItem("k"))
        nested.setItem("k", "v")
        assertEquals("v", nested.getItem("k"))
    }

    @Test
    fun aFileThatCannotBeReadThrowsInsteadOfReadingAsNothing() {
        File(dir, "k.json").mkdirs()
        assertFailsWith<IOException> { storage.getItem("k") }
    }

    @Test
    fun aWriteThatCannotReplaceTheFileThrows() {
        File(dir, "k.json/inside").mkdirs()
        assertFails { storage.setItem("k", "v") }
        assertTrue(File(dir, "k.json").isDirectory)
    }
}
