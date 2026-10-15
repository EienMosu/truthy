package com.eienmosu.truthy

import com.eienmosu.truthy.engine.CardHistory
import com.eienmosu.truthy.engine.LastRound
import com.eienmosu.truthy.engine.Mode
import com.eienmosu.truthy.engine.PROGRESS_KEY
import com.eienmosu.truthy.engine.Progress
import com.eienmosu.truthy.engine.Route
import com.eienmosu.truthy.engine.UNREADABLE_KEY
import com.eienmosu.truthy.engine.emptyProgress
import com.eienmosu.truthy.engine.readProgress
import com.eienmosu.truthy.support.T0
import com.eienmosu.truthy.support.newTempDir
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.joinAll
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import java.io.File
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class FileProgressStoreTest {
    private val dir = newTempDir()
    private val main = File(dir, FileProgressStore.FILE_NAME)
    private val side = File(dir, FileProgressStore.UNREADABLE_FILE_NAME)

    private val played = Progress(
        version = 1,
        cards = mapOf("aws-clf-c02-t2.1-06" to CardHistory(seen = 2, lastCorrect = true, lastSeenAt = T0)),
        records = mapOf("aws-clf-c02/SEC#classic" to 7),
        last = LastRound(route = Route(deckId = "aws-clf-c02", sectionId = "SEC"), mode = Mode.CLASSIC, score = 7, total = 10),
    )

    @AfterTest
    fun removeTheFolder() {
        dir.deleteRecursively()
    }

    @Test
    fun theFileNamesAreTheWebKeysWithJson() {
        assertEquals("$PROGRESS_KEY.json", FileProgressStore.FILE_NAME)
        assertEquals("$UNREADABLE_KEY.json", FileProgressStore.UNREADABLE_FILE_NAME)
        assertEquals("truthy.progress.v1.json", FileProgressStore.FILE_NAME)
        assertEquals("truthy.progress.v1.unreadable.json", FileProgressStore.UNREADABLE_FILE_NAME)
    }

    @Test
    fun nothingStoredLoadsAsEmptyProgressAndWritesNothing() {
        runBlocking {
            assertEquals(emptyProgress(), FileProgressStore(dir).load())
            assertEquals(0, dir.list()!!.size)
        }
    }

    @Test
    fun aSaveIsWhatTheNextLaunchLoads() {
        runBlocking {
            FileProgressStore(dir).save(played)
            assertEquals(played, FileProgressStore(dir).load())
        }
    }

    @Test
    fun theFileHoldsTheWebShapeAndReadsBackWhole() {
        runBlocking {
            FileProgressStore(dir).save(played)
            val read = readProgress(main.readText())
            assertTrue(read.whole)
            assertEquals(played, read.progress)
            FileProgressStore(dir).save(emptyProgress())
            assertTrue(readProgress(main.readText()).whole, "empty progress is written with its last key")
        }
    }

    @Test
    fun anUnreadableValueIsKeptAsideBeforeItIsWrittenOver() {
        runBlocking {
            main.writeText("{not json")
            val store = FileProgressStore(dir)
            store.save(store.load())
            assertEquals("{not json", side.readText())
            assertTrue(readProgress(main.readText()).whole)
        }
    }

    @Test
    fun aValueWithADroppedPartIsKeptAsideAndItsValidPartsStay() {
        runBlocking {
            val raw = "{\"version\":1,\"cards\":{\"aws-clf-c02-t2.1-06\":{\"seen\":2,\"lastCorrect\":true,\"lastSeenAt\":1790000000000}}," +
                "\"records\":{\"aws-clf-c02/SEC#classic\":7,\"aws-clf-c02/APP#classic\":7.5},\"last\":null}"
            main.writeText(raw)
            val store = FileProgressStore(dir)
            val loaded = store.load()
            assertEquals(mapOf("aws-clf-c02/SEC#classic" to 7), loaded.records)
            assertEquals(played.cards, loaded.cards)
            store.save(loaded)
            assertEquals(raw, side.readText())
            assertEquals(loaded, FileProgressStore(dir).load())
        }
    }

    @Test
    fun aValueWithNoLastKeyIsKeptAside() {
        runBlocking {
            val raw = "{\"version\":1,\"cards\":{},\"records\":{\"gcp-cdl/ALL#classic\":8}}"
            main.writeText(raw)
            val store = FileProgressStore(dir)
            val loaded = store.load()
            assertEquals(mapOf("gcp-cdl/ALL#classic" to 8), loaded.records)
            store.save(loaded)
            assertEquals(raw, side.readText())
        }
    }

    @Test
    fun noSideCopyIsMadeOverAWholeValueOrOverNothing() {
        runBlocking {
            val store = FileProgressStore(dir)
            store.save(played)
            store.save(emptyProgress())
            assertFalse(side.exists())
        }
    }

    @Test
    fun theSideCopyIsMadeOnceAndReplacedByALaterUnreadableValue() {
        runBlocking {
            val store = FileProgressStore(dir)
            main.writeText("{first")
            store.save(played)
            assertEquals("{first", side.readText())
            store.save(emptyProgress())
            assertEquals("{first", side.readText())
            main.writeText("{second")
            store.save(played)
            assertEquals("{second", side.readText())
        }
    }

    @Test
    fun whenTheSideCopyCannotBeHandledTheValueIsNotWrittenOver() {
        runBlocking {
            main.writeText("{not json")
            File(side, "inside").mkdirs()
            FileProgressStore(dir).save(played)
            assertEquals("{not json", main.readText())
        }
    }

    @Test
    fun aBrokenProgressFileNeverReachesThePlayer() {
        runBlocking {
            File(main, "inside").mkdirs()
            val store = FileProgressStore(dir)
            assertEquals(emptyProgress(), store.load())
            store.save(played)
            assertTrue(main.isDirectory)
        }
    }

    @Test
    fun updateReadsChangesAndWritesInOneTurn() {
        runBlocking {
            val store = FileProgressStore(dir)
            store.save(played)
            val next = store.update { it.copy(records = it.records + ("gcp-cdl/ALL#classic" to 8)) }
            assertEquals(8, next.records["gcp-cdl/ALL#classic"])
            assertEquals(7, next.records["aws-clf-c02/SEC#classic"])
            assertEquals(next, FileProgressStore(dir).load())
        }
    }

    @Test
    fun concurrentUpdatesThroughTwoStoresOnOneFolderAreNeverLost() {
        runBlocking {
            val first = FileProgressStore(dir)
            val second = FileProgressStore(dir)
            (0 until 40).map { i ->
                launch(Dispatchers.Default) {
                    (if (i % 2 == 0) first else second).update { it.copy(records = it.records + ("deck-$i/ALL#classic" to i)) }
                }
            }.joinAll()
            assertEquals((0 until 40).map { "deck-$it/ALL#classic" }.toSet(), first.load().records.keys)
        }
    }

    @Test
    fun concurrentSavesLeaveAFileThatReadsWhole() {
        runBlocking {
            val store = FileProgressStore(dir)
            (0 until 30).map { i ->
                launch(Dispatchers.Default) { store.save(played.copy(records = mapOf("deck-$i/ALL#classic" to i))) }
            }.joinAll()
            val read = readProgress(main.readText())
            assertTrue(read.whole)
            assertEquals(1, read.progress.records.size)
            assertFalse(side.exists())
        }
    }

    @Test
    fun everyStoreUsesTheNamesTheBackupRulesList() {
        assertEquals(StorageNames.PROGRESS_FILE, FileProgressStore.FILE_NAME)
        assertEquals(StorageNames.UNREADABLE_FILE, FileProgressStore.UNREADABLE_FILE_NAME)
        assertEquals(StorageNames.JOURNAL_FILE, RoundJournal.FILE_NAME)
        assertEquals(StorageNames.PREFS_FILE, ThemeStore.PREFS_NAME)
    }
}
