// The progress store over a key-value storage, a port of src/progress/local.ts (reference 3.5 and 6).
// The engine holds no storage of its own: the app hands it one (task 9 backs it with files). A storage that
// throws never reaches the player: load gives the parts of the stored value that still read, and save does
// nothing when it cannot write or cannot first keep an unreadable value aside.
public let PROGRESS_KEY = "truthy.progress.v1"

// Where a stored value that did not read back whole is kept before the store writes over it, so a later
// version can still recover what this one could not read. It holds the latest such value only.
public let UNREADABLE_KEY = "truthy.progress.v1.unreadable"

// The two operations of the web's Storage that the store uses. Either may throw (blocked, full, broken).
public protocol KeyValueStorage {
  func getItem(_ key: String) throws -> String?
  func setItem(_ key: String, _ value: String) throws
}

// The TypeScript ProgressStore of local.ts. In Swift that name belongs to the app's async store protocol
// (task 9), so the engine's synchronous store is LocalStore.
public struct LocalStore {
  let storage: (any KeyValueStorage)?

  public func load() -> Progress {
    guard let storage else { return emptyProgress() }
    do {
      return parseProgress(try storage.getItem(PROGRESS_KEY))
    } catch {
      return emptyProgress()
    }
  }

  public func save(_ progress: Progress) {
    guard let storage else { return }
    do {
      try keepUnreadable(storage)
      try storage.setItem(PROGRESS_KEY, try progressJSON(progress))
    } catch {
      // Full or blocked storage: play goes on, this round is simply not remembered. When the stored
      // value could not be kept aside first, it is not written over either.
    }
  }
}

public func createLocalStore(_ storage: (any KeyValueStorage)?) -> LocalStore {
  LocalStore(storage: storage)
}

// The side-copy decision: copies the stored value to UNREADABLE_KEY when part or all of it was dropped on
// reading and the side key does not already hold exactly that value (compared in UTF-16 code units, as
// JavaScript's === does). Nothing stored reads as whole, so it makes no copy. A throw from either key stops
// the save that called it.
public func keepUnreadable(_ storage: any KeyValueStorage) throws {
  guard let raw = try storage.getItem(PROGRESS_KEY), !readProgress(raw).whole else { return }
  if let kept = try storage.getItem(UNREADABLE_KEY), kept.utf16.elementsEqual(raw.utf16) { return }
  try storage.setItem(UNREADABLE_KEY, raw)
}
