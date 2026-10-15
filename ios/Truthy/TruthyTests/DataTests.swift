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
