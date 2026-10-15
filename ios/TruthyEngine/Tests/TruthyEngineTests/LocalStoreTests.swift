import Testing
@testable import TruthyEngine

// Ports of tests/progress/local.test.ts and the side-key cases of partial-read.test.ts.
private struct Refused: Error {}

private final class MemoryStorage: KeyValueStorage {
  var items: [String: String] = [:]
  var refuseGet = false
  var refuseSet: Set<String> = []

  func getItem(_ key: String) throws -> String? {
    if refuseGet { throw Refused() }
    return items[key]
  }

  func setItem(_ key: String, _ value: String) throws {
    if refuseSet.contains(key) { throw Refused() }
    items[key] = value
  }
}

private let played = Progress(
  cards: ["aws-clf-c02-t2.1-06": CardHistory(seen: 2, lastCorrect: true, lastSeenAt: 1_790_000_000_000)],
  records: ["aws-clf-c02/SEC#classic": 7],
  last: LastRound(route: Route(deckId: "aws-clf-c02", sectionId: "SEC"), mode: .classic, score: 7, total: 10))

private let droppedPart = #"{"version":1,"cards":{},"records":{"a/ALL#classic":7},"last":{"route":{"deckId":"a","sectionId":"ALL"},"mode":"daily"}}"#

@Suite struct LocalStoreTests {
  @Test func keysAreTheWebKeys() {
    #expect(PROGRESS_KEY == "truthy.progress.v1")
    #expect(UNREADABLE_KEY == "truthy.progress.v1.unreadable")
  }

  @Test func roundTripsAndLoadsTheLatestSave() {
    let storage = MemoryStorage()
    let store = createLocalStore(storage)
    #expect(store.load() == emptyProgress())
    store.save(played)
    #expect(createLocalStore(storage).load() == played)
    store.save(emptyProgress())
    #expect(store.load() == emptyProgress())
    #expect(storage.items[UNREADABLE_KEY] == nil)
  }

  @Test func withoutAStorageLoadIsEmptyAndSaveDoesNothing() {
    let store = createLocalStore(nil)
    store.save(played)
    #expect(store.load() == emptyProgress())
  }

  @Test func storageFailuresNeverReachTheCaller() {
    let storage = MemoryStorage()
    let store = createLocalStore(storage)
    store.save(played)
    storage.refuseSet = [PROGRESS_KEY, UNREADABLE_KEY]
    store.save(emptyProgress())
    #expect(store.load() == played)
    storage.refuseGet = true
    #expect(store.load() == emptyProgress())
    store.save(emptyProgress())
  }

  @Test func keepsAValueThatDidNotReadWholeUnderTheSideKeyBeforeWritingOverIt() {
    for raw in [droppedPart, "{not json", "null", "[]", #"{"version":2}"#, #"{"version":1,"cards":{},"records":{}}"#] {
      let storage = MemoryStorage()
      storage.items[PROGRESS_KEY] = raw
      let store = createLocalStore(storage)
      store.save(store.load())
      #expect(storage.items[UNREADABLE_KEY] == raw, "\(raw)")
      #expect(readProgress(storage.items[PROGRESS_KEY]).whole, "\(raw)")
    }
  }

  @Test func keepsTheValidRecordsThroughASave() {
    let storage = MemoryStorage()
    storage.items[PROGRESS_KEY] = droppedPart
    let store = createLocalStore(storage)
    store.save(store.load())
    #expect(createLocalStore(storage).load().records == ["a/ALL#classic": 7])
  }

  @Test func makesTheCopyOnceAndReplacesItWithALaterUnreadableValue() {
    let storage = MemoryStorage()
    let store = createLocalStore(storage)
    storage.items[PROGRESS_KEY] = "{first"
    store.save(played)
    #expect(storage.items[UNREADABLE_KEY] == "{first")
    storage.items[UNREADABLE_KEY] = "marker"
    store.save(emptyProgress())
    #expect(storage.items[UNREADABLE_KEY] == "marker")
    storage.items[PROGRESS_KEY] = "{second"
    store.save(played)
    #expect(storage.items[UNREADABLE_KEY] == "{second")
  }

  @Test func doesNotWriteOverAValueThatCannotBeKeptAsideFirst() {
    let storage = MemoryStorage()
    storage.items[PROGRESS_KEY] = "{not json"
    storage.refuseSet = [UNREADABLE_KEY]
    createLocalStore(storage).save(played)
    #expect(storage.items[PROGRESS_KEY] == "{not json")
  }

  @Test func writesOverWhenTheSideKeyAlreadyHoldsTheValue() {
    let storage = MemoryStorage()
    storage.items[PROGRESS_KEY] = "{not json"
    storage.items[UNREADABLE_KEY] = "{not json"
    storage.refuseSet = [UNREADABLE_KEY]
    createLocalStore(storage).save(played)
    #expect(createLocalStore(storage).load() == played)
  }

  @Test func aSavedValueReadsBackWhole() throws {
    let storage = MemoryStorage()
    createLocalStore(storage).save(played)
    let raw = try #require(storage.items[PROGRESS_KEY])
    #expect(readProgress(raw) == (progress: played, whole: true))
    #expect(readProgress(try progressJSON(emptyProgress())) == (progress: emptyProgress(), whole: true))
  }
}
