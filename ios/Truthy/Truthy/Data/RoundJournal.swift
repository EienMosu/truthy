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
