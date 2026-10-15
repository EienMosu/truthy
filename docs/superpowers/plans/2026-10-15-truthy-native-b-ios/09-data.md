### Task 9: The decks, the progress store, the round journal and the theme store

The app's data layer (spec 4.2 and 4.5, reference 6): `DeckStore` decodes the embedded index at launch and one deck off the main thread; `FileProgressStore` keeps `truthy.progress.v1.json` in Application Support through the engine's own `createLocalStore` (task 4) over files, so the web's unreadable side copy and its failure rules hold exactly, with one actor as the one serial writer; `RoundJournal` keeps the round on screen in `truthy.round.v1.json` (task 11 writes it after every change of the number of answers or of `isDecided`) and, at launch, applies a journal left by a killed app with the leave rules and deletes it; `ThemeStore` keeps `truthy.theme` in UserDefaults. This task tests the store side of README Review Focus line 1; task 11 tests the launch.

Builds on tasks 1 to 8: the engine's `LocalStore`, `KeyValueStorage`, `applyResult`, `pruneDeck`, `saveLeftRound`, `recordRound`, `RecordedRounds`, `scoreOf` (tasks 3, 4 and 6), `parseTheme`, `THEME_KEY` (task 1); task 7's bundled decks and `EngineNames.swift`.

**Files:**
- Create (app): `ios/Truthy/Truthy/State/Clocks.swift` (the two clocks; task 11 builds on them), `ios/Truthy/Truthy/Data/DeckStore.swift`, `ios/Truthy/Truthy/Data/FileKeyValueStorage.swift`, `ios/Truthy/Truthy/Data/FileProgressStore.swift`, `ios/Truthy/Truthy/Data/RoundJournal.swift`, `ios/Truthy/Truthy/Data/ThemeStore.swift`
- Test: create `ios/Truthy/TruthyTests/TestSupport.swift` (a fake clock and scratch folders, used by tasks 9 and 11), `ios/Truthy/TruthyTests/DataTests.swift`

**Interfaces:**
- Produces (app target; the README's names, plus the members marked):

```swift
protocol WallClock: Sendable { func nowMs() -> Double }         // whole epoch milliseconds
protocol MonotonicClock: Sendable { func nowMs() -> Double }    // CACurrentMediaTime in ms, the base of UITouch.timestamp
struct SystemWallClock: WallClock; struct SystemMonotonicClock: MonotonicClock
struct DeckStoreError: Error, CustomStringConvertible { let description: String }
final class DeckStore: Sendable { let folder: URL; init(bundle: Bundle); func index() throws -> DeckIndex; func deck(_ id: String) async throws -> DeckFile }
struct FileKeyValueStorage: KeyValueStorage { let directory: URL }                       // key K is the file K.json
protocol ProgressStore: Sendable { func load() async -> Progress; func save(_ progress: Progress) async }   // Progress: task 7's alias
actor FileProgressStore: ProgressStore {
    init(directory: URL); static func applicationSupport() -> URL
    func saveLeftRound(_ round: RoundState)                // extra: task 6's leave rules, inside the one writer
    func record(_ round: RoundState) -> ApplyOutcome       // extra: task 6's recordRound, once per round
    func apply(_ result: RoundResult)                      // extra: a journal's result, as the leave rules apply it
    func prunedForRound(_ deck: DeckFile) -> Progress      // extra: reference 6, save rule 2
}
struct JournalAnswer: Codable, Equatable, Sendable { let cardId: String; let given: Bool; let correct: Bool; let at: Double }
struct JournalEntry: Codable, Equatable, Sendable { let route: Route; let mode: Mode; let seed: UInt32; let roundId: String; var answers: [JournalAnswer];
    var decided: Bool; var recorded: Bool; func leftResult(_ deck: DeckFile) -> RoundResult? }
actor RoundJournal { static let fileName: String; init(directory: URL); func record(_ entry: JournalEntry); func clear(); func pending() -> JournalEntry?;
    func applyPending(to store: FileProgressStore, deck: (String) async throws -> DeckFile) async }
struct ThemeStore { init(defaults: UserDefaults); var stored: StoredTheme? { get }; func store(_ theme: StoredTheme) }
```

**Rules:**

1. **The engine decides, the files keep.** `FileProgressStore` runs `createLocalStore` over `FileKeyValueStorage(directory:)`: the side copy is written whenever a read is not whole, skipped when the stored copy is identical, and the main write is skipped if that write fails (reference 6). `FileKeyValueStorage` writes atomically (`Data.write(options: .atomic)`), throws on any failure, and returns nil only for a missing file, so a file that cannot be read is a throwing read and the engine loads empty progress. A save never writes over the stored progress after the read it was built on failed; it waits for a load that succeeds. On the web a throwing `localStorage` stays blocked, but on iOS a read can fail and later work (a file still locked by data protection before the first unlock), so the store keeps its storage in a private `GuardedStorage` that remembers a failed read of the progress and refuses to write the progress until a load succeeds; the side copy is never held back. A storage failure never reaches the player.
2. **One serial writer.** Every read and write of the progress goes through the one `FileProgressStore` actor, off the main thread; every save is a whole read, modify and write (reference 6, rule 5).
3. **The journal applies the leave rules** without a `RoundState`: `JournalEntry.leftResult` rebuilds the round's result from its answers and the deck (a recorded round or one with no answers that is not decided leaves nothing; an undecided round with answers is abandoned; a decided round is finished), and `FileProgressStore.apply` writes `applyResult` over the stored progress. The test compares this with task 6's `saveLeftRound` on the same round played with the reducer: both leave the same progress. The journal is deleted after it is applied, and also when it is unreadable. A kill between the apply and the delete applies it once more at the next launch (one more `seen` per card; the record and `last` do not change): accepted, as plan C accepts it (README, "Cross-platform agreements").
4. **Backups stay on** (spec 4.5): Application Support is backed up, and nothing sets `isExcludedFromBackup`.
5. **The theme** is read with task 1's `parseTheme`: anything but `light` or `dark` is no choice. Nothing removes the key.
6. **Test files** that use the engine's `Progress` write `TruthyEngine.Progress`: a test file imports Foundation, and Foundation's `Progress` makes the bare name ambiguous there (task 4, rule 4; the app's alias is visible to the tests but does not shadow Foundation's in another module).

**Review focus.** README line 1, the store side: `RoundJournalTests` covers the four journal cases (no answers and undecided; undecided with answers; decided and not recorded; recorded), each ending with the journal deleted, and checks the abandoned and the decided case against `saveLeftRound`.

**Steps:**

- [ ] **Step 1: Check the starting point.**

```bash
git status --short
xcodebuild test -project ios/Truthy/Truthy.xcodeproj -scheme Truthy -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5' 2>&1 | grep -E 'Test run with|TEST (SUCCEEDED|FAILED)' | tail -2
```

Expected: nothing; `Test run with 13 tests in 6 suites passed` and `** TEST SUCCEEDED **`.

- [ ] **Step 2: Write the tests.**

`ios/Truthy/TruthyTests/TestSupport.swift`:

```swift
import Foundation
@testable import Truthy

// Fakes and fixtures the app's unit tests share: a clock the test moves by hand, a scratch directory per test, and
// the embedded decks (the test host is the app, so Bundle.main holds them).

final class FakeClock: WallClock, MonotonicClock, @unchecked Sendable {
    var now: Double

    init(_ now: Double = 1_700_000_000_000) {
        self.now = now
    }

    func nowMs() -> Double { now }

    func advance(_ ms: Double) {
        now += ms
    }
}

enum Scratch {
    /// A new empty directory under the test host's temporary directory.
    static func directory() -> URL {
        let url = FileManager.default.temporaryDirectory.appending(path: "truthy-tests-\(UUID().uuidString)")
        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }

    static func defaults() -> UserDefaults {
        let name = "truthy-tests-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: name)!
        defaults.removePersistentDomain(forName: name)
        return defaults
    }
}
```

`ios/Truthy/TruthyTests/DataTests.swift`:

```swift
import Foundation
import Testing
import TruthyEngine
@testable import Truthy

// Spec 7.2: the decks, the progress store (atomic write, the unreadable side copy, partial and failing reads), the
// round journal (write, apply with each leave rule, delete) and the theme store.

@Suite struct DeckStoreTests {
    @Test func theIndexAndEveryDeckDecodeInFileOrder() async throws {
        let decks = DeckStore(bundle: .main)
        let index = try decks.index()
        let ids = index.areas.flatMap(\.platforms).flatMap(\.decks).map(\.id)
        #expect(ids.count == 54)
        let clf = try await decks.deck("aws-clf-c02")
        let raw = try JSONSerialization.jsonObject(with: Data(contentsOf: decks.folder.appending(path: "aws-clf-c02.json"))) as? [String: Any]
        let fileOrder = (raw?["cards"] as? [[String: Any]])?.compactMap { $0["id"] as? String }
        #expect(clf.cards.map(\.id) == fileOrder)
        await #expect(throws: (any Error).self) { try await decks.deck("no-such-deck") }
    }
}

@Suite struct ProgressStoreTests {
    private let played = TruthyEngine.Progress(version: 1, cards: ["aws-clf-c02-t1.1-01": CardHistory(seen: 2, lastCorrect: true, lastSeenAt: 1_790_000_000_000)],
                                  records: ["aws-clf-c02/SEC#classic": 7], last: nil)

    @Test func aSavedProgressLoadsBack() async {
        let directory = Scratch.directory()
        let store = FileProgressStore(directory: directory)
        await store.save(played)
        #expect(await store.load() == played)
        #expect(await FileProgressStore(directory: directory).load() == played)
        #expect(FileManager.default.fileExists(atPath: directory.appending(path: "truthy.progress.v1.json").path(percentEncoded: false)))
    }

    @Test func aPartlyUnreadableFileIsKeptAsideOnceBeforeItIsOverwritten() async throws {
        let directory = Scratch.directory()
        let main = directory.appending(path: "truthy.progress.v1.json")
        let side = directory.appending(path: "truthy.progress.v1.unreadable.json")
        let partial = #"{"version":1,"cards":{"a":{"seen":-1}},"records":{},"last":null}"#
        try Data(partial.utf8).write(to: main)
        let store = FileProgressStore(directory: directory)
        await store.save(played)
        #expect(try String(contentsOf: side, encoding: .utf8) == partial)
        let modified = try FileManager.default.attributesOfItem(atPath: side.path(percentEncoded: false))[.modificationDate] as? Date
        try Data(partial.utf8).write(to: main)
        await store.save(played)
        let again = try FileManager.default.attributesOfItem(atPath: side.path(percentEncoded: false))[.modificationDate] as? Date
        #expect(modified == again, "an identical side copy is not written again")
    }

    @Test func aFailingSideWriteSkipsTheMainWrite() async throws {
        let directory = Scratch.directory()
        let main = directory.appending(path: "truthy.progress.v1.json")
        try Data("{not json".utf8).write(to: main)
        // A folder where the side copy should go makes its write fail.
        try FileManager.default.createDirectory(at: directory.appending(path: "truthy.progress.v1.unreadable.json"), withIntermediateDirectories: true)
        await FileProgressStore(directory: directory).save(played)
        #expect(try String(contentsOf: main, encoding: .utf8) == "{not json")
    }

    @Test func aFailingReadIsEmptyProgressAndNeverReachesThePlayer() async throws {
        let directory = Scratch.directory()
        let main = directory.appending(path: "truthy.progress.v1.json")
        try FileManager.default.createDirectory(at: main, withIntermediateDirectories: true)
        let store = FileProgressStore(directory: directory)
        #expect(await store.load() == emptyProgress())
        await store.save(played)
        var isFolder: ObjCBool = false
        #expect(FileManager.default.fileExists(atPath: main.path(percentEncoded: false), isDirectory: &isFolder) && isFolder.boolValue,
                "nothing is written over a progress that cannot be read")
        #expect(!FileManager.default.fileExists(atPath: directory.appending(path: "truthy.progress.v1.unreadable.json").path(percentEncoded: false)))
    }

    @Test func aSaveAfterAFailedReadWaitsForALoadThatSucceeds() async throws {
        let directory = Scratch.directory()
        let main = directory.appending(path: "truthy.progress.v1.json")
        let store = FileProgressStore(directory: directory)
        await store.save(played)
        let saved = try Data(contentsOf: main)
        // A read that fails: bytes that are not UTF-8 here, on a device a file still locked before the first unlock.
        try Data([0xFF, 0xFE]).write(to: main)
        #expect(await store.load() == emptyProgress())
        // The read works again, but this save was built on the failed one: the stored progress stays.
        try saved.write(to: main)
        await store.save(emptyProgress())
        #expect(await FileProgressStore(directory: directory).load() == played)
        // A load that succeeds lets the next save through.
        #expect(await store.load() == played)
        let next = TruthyEngine.Progress(version: 1, cards: [:], records: ["aws-clf-c02/SEC#streak": 3], last: nil)
        await store.save(next)
        #expect(await FileProgressStore(directory: directory).load() == next)
    }

    @Test func theProgressIsBackedUp() async throws {
        let directory = Scratch.directory()
        await FileProgressStore(directory: directory).save(played)
        let values = try directory.appending(path: "truthy.progress.v1.json").resourceValues(forKeys: [.isExcludedFromBackupKey])
        #expect(values.isExcludedFromBackup == false)
    }
}

@Suite struct RoundJournalTests {
    private let route = Route(deckId: "aws-clf-c02", sectionId: WHOLE_DECK)

    private func deck() async throws -> DeckFile {
        try await DeckStore(bundle: .main).deck("aws-clf-c02")
    }

    /// A real round of the deck, played with the reducer, and its journal entry.
    private func played(_ mode: Mode, answers count: Int, deck: DeckFile) throws -> (state: RoundState, entry: JournalEntry) {
        var state = try startRound(StartArgs(mode: mode, route: route, pool: deck.cards, history: [:], seed: 7))
        var at = 1_790_000_000_000.0
        for i in 0..<count {
            guard let card = currentCard(state) else { break }
            at += 1000
            state = reduce(state, .answer(value: i % 3 == 2 ? !card.answer : card.answer, at: at))
            if i < count - 1 && !isDecided(state) { state = reduce(state, .next) }
        }
        let entry = JournalEntry(route: route, mode: mode, seed: 7, roundId: "r",
                                 answers: state.answers.map { JournalAnswer(cardId: $0.card.id, given: $0.given, correct: $0.correct, at: $0.at) },
                                 decided: isDecided(state), recorded: false)
        return (state, entry)
    }

    private func applied(_ entry: JournalEntry, over start: TruthyEngine.Progress, deck: DeckFile) async -> (progress: TruthyEngine.Progress, journalLeft: Bool) {
        let directory = Scratch.directory()
        let store = FileProgressStore(directory: directory)
        await store.save(start)
        let journal = RoundJournal(directory: directory)
        await journal.record(entry)
        await journal.applyPending(to: store) { _ in deck }
        return (await store.load(), await journal.pending() != nil)
    }

    /// What task 6's saveLeftRound writes for the same round, over the same progress.
    private func leftByTheEngine(_ state: RoundState, over start: TruthyEngine.Progress) async -> TruthyEngine.Progress {
        let store = FileProgressStore(directory: Scratch.directory())
        await store.save(start)
        await store.saveLeftRound(state)
        return await store.load()
    }

    @Test func noAnswersAndUndecidedSavesNothing() async throws {
        let deck = try await deck()
        let (_, entry) = try played(.classic, answers: 0, deck: deck)
        let result = await applied(entry, over: emptyProgress(), deck: deck)
        #expect(result.progress == emptyProgress())
        #expect(!result.journalLeft)
    }

    @Test func undecidedWithAnswersKeepsTheAnswersAndSetsNoRecord() async throws {
        let deck = try await deck()
        let (state, entry) = try played(.classic, answers: 4, deck: deck)
        #expect(!entry.decided)
        let result = await applied(entry, over: emptyProgress(), deck: deck)
        #expect(result.progress.cards.count == 4)
        #expect(result.progress.records.isEmpty)
        #expect(result.progress.last == LastRound(route: route, mode: .classic, score: nil, total: nil))
        #expect(result.progress == (await leftByTheEngine(state, over: emptyProgress())))
        #expect(!result.journalLeft)
    }

    @Test func decidedAndNotRecordedIsRecorded() async throws {
        let deck = try await deck()
        let (state, entry) = try played(.streak, answers: 3, deck: deck)
        #expect(entry.decided)
        let result = await applied(entry, over: emptyProgress(), deck: deck)
        #expect(result.progress.records[recordKey(route, .streak)] == 2)
        #expect(result.progress == (await leftByTheEngine(state, over: emptyProgress())))
        #expect(!result.journalLeft)
    }

    @Test func aRecordedRoundChangesNothing() async throws {
        let deck = try await deck()
        var (_, entry) = try played(.streak, answers: 3, deck: deck)
        entry.recorded = true
        let before = TruthyEngine.Progress(version: 1, cards: [:], records: [recordKey(route, .streak): 9], last: nil)
        let result = await applied(entry, over: before, deck: deck)
        #expect(result.progress == before)
        #expect(!result.journalLeft)
    }

    @Test func anUnreadableJournalIsDeleted() async throws {
        let directory = Scratch.directory()
        try Data("{broken".utf8).write(to: directory.appending(path: RoundJournal.fileName))
        let journal = RoundJournal(directory: directory)
        await journal.applyPending(to: FileProgressStore(directory: directory)) { _ in throw DeckStoreError(description: "unused") }
        #expect(!FileManager.default.fileExists(atPath: directory.appending(path: RoundJournal.fileName).path(percentEncoded: false)))
    }
}

@Suite struct ThemeStoreTests {
    @Test func storesAndReadsTheChoiceUnderTheWebKey() {
        let defaults = Scratch.defaults()
        let store = ThemeStore(defaults: defaults)
        #expect(store.stored == nil)
        store.store(.dark)
        #expect(store.stored == .dark)
        #expect(defaults.string(forKey: "truthy.theme") == "dark")
        defaults.set("purple", forKey: THEME_KEY)
        #expect(store.stored == nil)
    }
}
```

- [ ] **Step 3: Run them and see them fail.**

```bash
DEST26='platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5'
xcodebuild build-for-testing -project ios/Truthy/Truthy.xcodeproj -scheme Truthy -destination "$DEST26" 2>&1 | grep -E 'error:' | head -4
```

Expected: errors such as `cannot find type 'WallClock' in scope`, `cannot find 'DeckStore' in scope`, `cannot find 'FileProgressStore' in scope` and `cannot find type 'JournalEntry' in scope`.

- [ ] **Step 4: Write the clocks and the data layer.** The clocks are spec 4.4's two time bases; the tests' fake clock stands in for both, and task 11's state uses them.

`ios/Truthy/Truthy/State/Clocks.swift`:

```swift
import Foundation
import QuartzCore

// The two clocks of spec 4.4 and reference 7.3, never mixed: engine events (answers, Timed ticks and visibility) and
// lastSeenAt use the wall clock in whole epoch milliseconds, as Date.now() does on the web; the UI guards (250, 420,
// 1000 ms) and swipe samples use the monotonic clock UITouch.timestamp is stamped with.

protocol WallClock: Sendable {
    func nowMs() -> Double
}

protocol MonotonicClock: Sendable {
    func nowMs() -> Double
}

struct SystemWallClock: WallClock {
    func nowMs() -> Double {
        (Date().timeIntervalSince1970 * 1000).rounded(.down)
    }
}

struct SystemMonotonicClock: MonotonicClock {
    func nowMs() -> Double {
        CACurrentMediaTime() * 1000
    }
}
```

`ios/Truthy/Truthy/Data/DeckStore.swift`:

```swift
import Foundation
import TruthyEngine

// The embedded decks (spec D3, 4.2): the index is decoded at launch, on the caller's thread; a deck is decoded off
// the main thread when a route is chosen. The folder "decks" is task 7's folder reference to native-data/decks.

struct DeckStoreError: Error, CustomStringConvertible {
    let description: String
}

final class DeckStore: Sendable {
    let folder: URL

    init(bundle: Bundle) {
        folder = bundle.url(forResource: "decks", withExtension: nil) ?? bundle.bundleURL.appending(path: "decks")
    }

    func index() throws -> DeckIndex {
        try JSONDecoder().decode(DeckIndex.self, from: Data(contentsOf: folder.appending(path: "index.json")))
    }

    func deck(_ id: String) async throws -> DeckFile {
        let url = folder.appending(path: "\(id).json")
        return try await Task.detached(priority: .userInitiated) {
            let deck = try JSONDecoder().decode(DeckFile.self, from: Data(contentsOf: url))
            guard deck.id == id else { throw DeckStoreError(description: "\(id).json holds the deck \(deck.id)") }
            return deck
        }.value
    }
}
```

`ios/Truthy/Truthy/Data/FileKeyValueStorage.swift`:

```swift
import Foundation
import TruthyEngine

// The engine's KeyValueStorage (task 4) over files: key K is the file K.json in `directory`. Writes are atomic and
// throw on any failure; a read returns nil only when the file does not exist and throws when it cannot be read, so
// the engine's store sees the same failures the web's storage reports (reference 6).

struct FileKeyValueStorage: KeyValueStorage {
    let directory: URL

    func url(_ key: String) -> URL {
        directory.appending(path: "\(key).json")
    }

    func getItem(_ key: String) throws -> String? {
        let file = url(key)
        guard FileManager.default.fileExists(atPath: file.path(percentEncoded: false)) else { return nil }
        return try String(contentsOf: file, encoding: .utf8)
    }

    func setItem(_ key: String, _ value: String) throws {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try Data(value.utf8).write(to: url(key), options: .atomic)
    }
}
```

`ios/Truthy/Truthy/Data/FileProgressStore.swift`:

```swift
import Foundation
import TruthyEngine

// Progress on the device (spec 4.5): truthy.progress.v1.json in Application Support, with the unreadable side copy
// truthy.progress.v1.unreadable.json, written by the engine's createLocalStore (task 4) so the web's rules hold
// exactly. One actor is the one serial writer, off the main thread; every save is a whole read, modify and write,
// and a storage failure never reaches the player. A save never writes over the stored progress after the read it was
// built on failed; it waits for a load that succeeds.

protocol ProgressStore: Sendable {
    func load() async -> Progress
    func save(_ progress: Progress) async
}

private struct ProgressReadFailed: Error {}

/// The files under the engine's store, remembering a failed read of the progress. On the web a throwing storage stays
/// blocked; on iOS a read can fail and later work (a file still locked before the first unlock), and a save built on
/// the empty progress of the failed read would then write over every stored history and record. So once a read of
/// the progress throws, writes of the progress throw too, until the store loads again. The side copy is never held
/// back.
private final class GuardedStorage: KeyValueStorage {
    let files: FileKeyValueStorage
    var progressReadFailed = false

    init(_ files: FileKeyValueStorage) {
        self.files = files
    }

    func getItem(_ key: String) throws -> String? {
        do {
            return try files.getItem(key)
        } catch {
            if key == PROGRESS_KEY { progressReadFailed = true }
            throw error
        }
    }

    func setItem(_ key: String, _ value: String) throws {
        if key == PROGRESS_KEY && progressReadFailed { throw ProgressReadFailed() }
        try files.setItem(key, value)
    }
}

actor FileProgressStore: ProgressStore {
    let directory: URL
    private let storage: GuardedStorage
    private let local: LocalStore
    private let recorded = RecordedRounds()

    init(directory: URL) {
        self.directory = directory
        let storage = GuardedStorage(FileKeyValueStorage(directory: directory))
        self.storage = storage
        local = createLocalStore(storage)
    }

    /// The app's own directory: Application Support, which iOS backs up (spec 4.5: backups stay on).
    static func applicationSupport() -> URL {
        URL.applicationSupportDirectory
    }

    func load() -> Progress {
        freshLoad()
    }

    func save(_ progress: Progress) {
        local.save(progress)
    }

    /// Leaving a round (task 6's saveLeftRound): abandoned before its deciding answer, recorded after it. The engine
    /// loads before it saves, so the guard starts clean here.
    func saveLeftRound(_ round: RoundState) {
        storage.progressReadFailed = false
        TruthyEngine.saveLeftRound(round, local)
    }

    /// Recording a finished round, exactly once however often it is asked (task 6's recordRound). The engine loads
    /// before it saves, so the guard starts clean here.
    func record(_ round: RoundState) -> ApplyOutcome {
        storage.progressReadFailed = false
        return recordRound(round, local, recorded)
    }

    /// A round result applied as the leave rules apply it (task 9's journal): history, `last`, and a record unless it
    /// is abandoned.
    func apply(_ result: RoundResult) {
        local.save(applyResult(freshLoad(), result).progress)
    }

    /// Start of a round (reference 6, save rule 2): load, prune the round's deck, save, and hand back the pruned
    /// progress to deal from.
    func prunedForRound(_ deck: DeckFile) -> Progress {
        let pruned = pruneDeck(freshLoad(), deck.id, deck.cards.map(\.id))
        local.save(pruned)
        return pruned
    }

    /// A load that the next save is built on: only a failure of this read holds that save back.
    private func freshLoad() -> Progress {
        storage.progressReadFailed = false
        return local.load()
    }
}
```

`ios/Truthy/Truthy/Data/RoundJournal.swift`:

```swift
import Foundation
import TruthyEngine

// The round journal (spec 4.5, native only): the round on screen is also written to truthy.round.v1.json after every
// change of the number of answers or of isDecided (task 11), so a round killed with the app still counts. A journal found at launch is applied with the leave rules and deleted; rounds are never
// resumed.

struct JournalAnswer: Codable, Equatable, Sendable {
    let cardId: String
    let given: Bool
    let correct: Bool
    /// Wall-clock epoch milliseconds, as the engine's Answered.at.
    let at: Double
}

struct JournalEntry: Codable, Equatable, Sendable {
    let route: Route
    let mode: Mode
    let seed: UInt32
    let roundId: String
    var answers: [JournalAnswer]
    /// isDecided(state) when the entry was written.
    var decided: Bool
    /// The result has been recorded: nothing is left to apply.
    var recorded: Bool

    /// The result the leave rules give this round (task 6's saveLeftRound): abandoned while undecided, finished once
    /// decided; nil when it leaves nothing (no answers and undecided) or was already recorded. Cards missing from
    /// `deck` are skipped.
    func leftResult(_ deck: DeckFile) -> RoundResult? {
        if recorded || (answers.isEmpty && !decided) { return nil }
        let cards = Dictionary(deck.cards.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        let answered = answers.compactMap { answer in
            cards[answer.cardId].map { Answered(card: $0, given: answer.given, correct: answer.correct, at: answer.at) }
        }
        return RoundResult(
            mode: mode, route: route, score: scoreOf(mode, answered), total: answered.count, answers: answered,
            missed: answered.filter { !$0.correct }, abandoned: !decided)
    }
}

actor RoundJournal {
    static let fileName = "truthy.round.v1.json"
    let file: URL

    init(directory: URL) {
        file = directory.appending(path: Self.fileName)
    }

    func record(_ entry: JournalEntry) {
        do {
            try FileManager.default.createDirectory(at: file.deletingLastPathComponent(), withIntermediateDirectories: true)
            try JSONEncoder().encode(entry).write(to: file, options: .atomic)
        } catch {
            // A journal that cannot be written loses only what a killed app would lose; play goes on.
        }
    }

    func clear() {
        try? FileManager.default.removeItem(at: file)
    }

    func pending() -> JournalEntry? {
        guard let data = try? Data(contentsOf: file) else { return nil }
        return try? JSONDecoder().decode(JournalEntry.self, from: data)
    }

    /// At launch: applies a journal left by a killed app with the leave rules, then deletes it (also when it is
    /// unreadable or leaves nothing). `deck` loads the deck of the journal's route.
    func applyPending(to store: FileProgressStore, deck: (String) async throws -> DeckFile) async {
        guard let entry = pending() else {
            clear()
            return
        }
        if let file = try? await deck(entry.route.deckId), let result = entry.leftResult(file) {
            await store.apply(result)
        }
        clear()
    }
}
```

`ios/Truthy/Truthy/Data/ThemeStore.swift`:

```swift
import Foundation
import TruthyEngine

// The stored theme (reference 6): "light" or "dark" under truthy.theme in UserDefaults, read before the first frame.
// Nothing removes it: there is no way back to following the system, as on the web.

struct ThemeStore {
    let defaults: UserDefaults

    init(defaults: UserDefaults) {
        self.defaults = defaults
    }

    var stored: StoredTheme? {
        parseTheme(defaults.string(forKey: THEME_KEY))
    }

    func store(_ theme: StoredTheme) {
        defaults.set(theme.rawValue, forKey: THEME_KEY)
    }
}
```

- [ ] **Step 5: Run the tests.**

```bash
DEST26='platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5'
xcodebuild test -project ios/Truthy/Truthy.xcodeproj -scheme Truthy -destination "$DEST26" -only-testing:TruthyTests 2>&1 | grep -E 'Test run with|✘|TEST (SUCCEEDED|FAILED)' | tail -4
```

Expected: `Test run with 26 tests in 10 suites passed` (13 in 6 before, plus 13 in 4: decks 1, store 6, journal 5, theme 1) and `** TEST SUCCEEDED **`. If `aFailingSideWriteSkipsTheMainWrite` fails, the side write did not throw: check that `FileKeyValueStorage.setItem` lets the error of `Data.write` through.

- [ ] **Step 6: Check that the journal tests bite.** In `RoundJournal.swift` change `abandoned: !decided` to `abandoned: decided`, run `-only-testing:TruthyTests/RoundJournalTests`, and put it back:

```bash
DEST26='platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5'
sed -i '' 's/abandoned: !decided)/abandoned: decided)/' ios/Truthy/Truthy/Data/RoundJournal.swift
xcodebuild test -project ios/Truthy/Truthy.xcodeproj -scheme Truthy -destination "$DEST26" -only-testing:TruthyTests/RoundJournalTests 2>&1 | grep -E '✘ Test|TEST (SUCCEEDED|FAILED)' | tail -4
sed -i '' 's/abandoned: decided)/abandoned: !decided)/' ios/Truthy/Truthy/Data/RoundJournal.swift
grep -c 'abandoned: !decided)' ios/Truthy/Truthy/Data/RoundJournal.swift
```

Expected: `✘ Test undecidedWithAnswersKeepsTheAnswersAndSetsNoRecord()` and `✘ Test decidedAndNotRecordedIsRecorded()`, `** TEST FAILED **`; then `1`.

- [ ] **Step 7: Run the gates and commit.**

```bash
DEST26='platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5'
swift test --package-path ios/TruthyEngine 2>&1 | tail -1
xcodebuild test -project ios/Truthy/Truthy.xcodeproj -scheme Truthy -destination "$DEST26" 2>&1 | grep -E 'TEST (SUCCEEDED|FAILED)'
git add ios/Truthy/Truthy/Data ios/Truthy/Truthy/State/Clocks.swift ios/Truthy/TruthyTests/TestSupport.swift ios/Truthy/TruthyTests/DataTests.swift
pnpm test
git commit -m "feat: keep iOS progress through the engine's store over files, journal every answer and store the theme"
git status --short
```

Expected: the engine's run passes as before (355 tests in 50 suites, 1 known issue); `** TEST SUCCEEDED **`; `pnpm test` passes; the commit is created; nothing from `git status --short`.
