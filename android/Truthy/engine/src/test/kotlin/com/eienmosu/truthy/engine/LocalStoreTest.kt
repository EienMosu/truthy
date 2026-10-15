package com.eienmosu.truthy.engine

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

// Ports of tests/progress/local.test.ts and the side-key cases of partial-read.test.ts.
private class Refused : Exception("refused")

private class MemoryStorage : KeyValueStorage {
  val items = LinkedHashMap<String, String>()
  var refuseGet = false
  var refuseSet: Set<String> = emptySet()

  override fun getItem(key: String): String? {
    if (refuseGet) throw Refused()
    return items[key]
  }

  override fun setItem(key: String, value: String) {
    if (key in refuseSet) throw Refused()
    items[key] = value
  }
}

class LocalStoreTest {
  private val played = Progress(
    version = 1,
    cards = mapOf("aws-clf-c02-t2.1-06" to CardHistory(seen = 2, lastCorrect = true, lastSeenAt = 1_790_000_000_000.0)),
    records = mapOf("aws-clf-c02/SEC#classic" to 7),
    last = LastRound(route = Route(deckId = "aws-clf-c02", sectionId = "SEC"), mode = Mode.CLASSIC, score = 7, total = 10),
  )

  private val droppedPart =
    """{"version":1,"cards":{},"records":{"a/ALL#classic":7},"last":{"route":{"deckId":"a","sectionId":"ALL"},"mode":"daily"}}"""

  @Test fun keysAreTheWebKeys() {
    assertEquals("truthy.progress.v1", PROGRESS_KEY)
    assertEquals("truthy.progress.v1.unreadable", UNREADABLE_KEY)
  }

  @Test fun roundTripsAndLoadsTheLatestSave() {
    val storage = MemoryStorage()
    val store = createLocalStore(storage)
    assertEquals(emptyProgress(), store.load())
    store.save(played)
    assertEquals(played, createLocalStore(storage).load())
    store.save(emptyProgress())
    assertEquals(emptyProgress(), store.load())
    assertNull(storage.items[UNREADABLE_KEY])
  }

  @Test fun withoutAStorageLoadIsEmptyAndSaveDoesNothing() {
    val store = createLocalStore(null)
    store.save(played)
    assertEquals(emptyProgress(), store.load())
  }

  @Test fun storageFailuresNeverReachTheCaller() {
    val storage = MemoryStorage()
    val store = createLocalStore(storage)
    store.save(played)
    storage.refuseSet = setOf(PROGRESS_KEY, UNREADABLE_KEY)
    store.save(emptyProgress())
    assertEquals(played, store.load())
    storage.refuseGet = true
    assertEquals(emptyProgress(), store.load())
    store.save(emptyProgress())
  }

  @Test fun keepsAValueThatDidNotReadWholeUnderTheSideKeyBeforeWritingOverIt() {
    val raws = listOf(droppedPart, "{not json", "null", "[]", """{"version":2}""", """{"version":1,"cards":{},"records":{}}""")
    for (raw in raws) {
      val storage = MemoryStorage()
      storage.items[PROGRESS_KEY] = raw
      val store = createLocalStore(storage)
      store.save(store.load())
      assertEquals(raw, storage.items[UNREADABLE_KEY], raw)
      assertTrue(readProgress(storage.items[PROGRESS_KEY]).whole, raw)
    }
  }

  @Test fun keepsTheValidRecordsThroughASave() {
    val storage = MemoryStorage()
    storage.items[PROGRESS_KEY] = droppedPart
    val store = createLocalStore(storage)
    store.save(store.load())
    assertEquals(mapOf("a/ALL#classic" to 7), createLocalStore(storage).load().records)
  }

  @Test fun makesTheCopyOnceAndReplacesItWithALaterUnreadableValue() {
    val storage = MemoryStorage()
    val store = createLocalStore(storage)
    storage.items[PROGRESS_KEY] = "{first"
    store.save(played)
    assertEquals("{first", storage.items[UNREADABLE_KEY])
    storage.items[UNREADABLE_KEY] = "marker"
    store.save(emptyProgress())
    assertEquals("marker", storage.items[UNREADABLE_KEY])
    storage.items[PROGRESS_KEY] = "{second"
    store.save(played)
    assertEquals("{second", storage.items[UNREADABLE_KEY])
  }

  @Test fun doesNotWriteOverAValueThatCannotBeKeptAsideFirst() {
    val storage = MemoryStorage()
    storage.items[PROGRESS_KEY] = "{not json"
    storage.refuseSet = setOf(UNREADABLE_KEY)
    createLocalStore(storage).save(played)
    assertEquals("{not json", storage.items[PROGRESS_KEY])
  }

  @Test fun writesOverWhenTheSideKeyAlreadyHoldsTheValue() {
    val storage = MemoryStorage()
    storage.items[PROGRESS_KEY] = "{not json"
    storage.items[UNREADABLE_KEY] = "{not json"
    storage.refuseSet = setOf(UNREADABLE_KEY)
    createLocalStore(storage).save(played)
    assertEquals(played, createLocalStore(storage).load())
  }

  @Test fun aSavedValueReadsBackWhole() {
    val storage = MemoryStorage()
    createLocalStore(storage).save(played)
    assertEquals(ReadResult(played, true), readProgress(storage.items.getValue(PROGRESS_KEY)))
    assertEquals(ReadResult(emptyProgress(), true), readProgress(progressJson(emptyProgress())))
  }
}
