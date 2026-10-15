import Testing
@testable import TruthyEngine

// tests/components/play/leave.test.ts, over an in-memory storage that counts its writes (task 4's LocalStoreTests
// has a private MemoryStorage of its own, so this one has another name).
final class CountingStorage: KeyValueStorage {
    var items: [String: String] = [:]
    var full = false
    var writes = 0
    func getItem(_ key: String) throws -> String? { items[key] }
    func setItem(_ key: String, _ value: String) throws {
        if full { throw CountingStorageFull() }
        writes += 1
        items[key] = value
    }
}

struct CountingStorageFull: Error {}

@Suite struct LeaveTests: RoundTesting {
    @Test func aRoundLeftBeforeItsFirstAnswerLeavesNothingUnlessItIsDecided() throws {
        #expect(!leavesSomething(try start(.classic)))
        #expect(leavesSomething(give(try start(.classic), true)))
        let timedOut = play(try timed(), ticks(T0, T0 + 60_000, step: 1000))
        #expect(timedOut.answers.isEmpty && leavesSomething(timedOut))
    }

    @Test func anUndecidedRoundIsKeptAsAbandonedWithNoRecord() throws {
        let storage = CountingStorage()
        let round = play(give(play(give(try start(.classic), true), [.next]), false, at: 2000), [.next])
        saveLeftRound(round, createLocalStore(storage))
        let stored = parseProgress(storage.items[PROGRESS_KEY])
        #expect(stored.cards.count == 2)
        #expect(stored.records.isEmpty)
        #expect(stored.last == LastRound(route: route, mode: .classic, score: nil, total: nil))
    }

    @Test func aDecidedRoundIsRecordedAsItsResultWouldBe() throws {
        let storage = CountingStorage()
        let decided = give(play(give(play(give(try start(.streak), true), [.next]), true, at: 2000), [.next]), false, at: 3000)
        #expect(isDecided(decided))
        saveLeftRound(decided, createLocalStore(storage))
        let stored = parseProgress(storage.items[PROGRESS_KEY])
        #expect(stored.records[recordKey(route, .streak)] == 2)
        #expect(stored.last?.score == 2 && stored.last?.total == 3)
        let full = CountingStorage()
        full.full = true
        saveLeftRound(decided, createLocalStore(full))
        #expect(full.items.isEmpty)
    }
}
