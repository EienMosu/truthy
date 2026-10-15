package com.eienmosu.truthy.engine

// The progress store over a key-value storage, a port of src/progress/local.ts (reference 3.5 and 6).
// The engine holds no storage of its own: the app hands it one (task 9 backs it with AtomicFile). A storage that
// throws never reaches the player: load gives the parts of the stored value that still read, and save does
// nothing when it cannot write or cannot first keep an unreadable value aside.

const val PROGRESS_KEY = "truthy.progress.v1"

// Where a stored value that did not read back whole is kept before the store writes over it, so a later version
// can still recover what this one could not read. It holds the latest such value only.
const val UNREADABLE_KEY = "truthy.progress.v1.unreadable"

// The two operations of the web's Storage that the store uses. Either may throw (blocked, full, broken).
interface KeyValueStorage {
  fun getItem(key: String): String?
  fun setItem(key: String, value: String)
}

// The TypeScript ProgressStore of local.ts. In the app that name belongs to the suspend store interface of
// task 9, so the engine's synchronous store is LocalStore.
class LocalStore internal constructor(private val storage: KeyValueStorage?) {
  fun load(): Progress {
    if (storage == null) return emptyProgress()
    return try {
      parseProgress(storage.getItem(PROGRESS_KEY))
    } catch (e: Exception) {
      emptyProgress()
    }
  }

  fun save(progress: Progress) {
    if (storage == null) return
    try {
      keepUnreadable(storage)
      storage.setItem(PROGRESS_KEY, progressJson(progress))
    } catch (e: Exception) {
      // Full or blocked storage: play goes on, this round is simply not remembered. When the stored value
      // could not be kept aside first, it is not written over either.
    }
  }
}

fun createLocalStore(storage: KeyValueStorage?): LocalStore = LocalStore(storage)

// The side-copy decision: copies the stored value to UNREADABLE_KEY when part or all of it was dropped on reading
// and the side key does not already hold exactly that value (String equality compares UTF-16 code units, as
// JavaScript's === does). Nothing stored reads as whole, so it makes no copy. The first save over such a value
// replaces it with one that reads whole, so the copy is made once per value. A throw from either key stops the
// save that called it.
fun keepUnreadable(storage: KeyValueStorage) {
  val raw = storage.getItem(PROGRESS_KEY)
  if (raw == null || readProgress(raw).whole || storage.getItem(UNREADABLE_KEY) == raw) return
  storage.setItem(UNREADABLE_KEY, raw)
}
