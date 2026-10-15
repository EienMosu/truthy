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
