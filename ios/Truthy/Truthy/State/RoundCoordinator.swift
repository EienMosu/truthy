import Foundation
import Observation
import SwiftUI
import TruthyEngine

// One round on screen (reference 4.2 to 4.3, spec 4.4 to 5.6): it feeds the engine's reducer events stamped with the
// wall clock, holds the UI guards on the monotonic clock, journals every change of the answers or of isDecided, runs Timed's ticker and
// pauses it only when the app goes to the background, and records the result exactly once.

struct RoundRequest: Equatable, Sendable, Identifiable {
    let id = UUID()
    let route: Route
    let mode: Mode
    let seed: UInt32
}

@MainActor @Observable
final class RoundCoordinator {
    enum XAction: Equatable { case leaveNow, openSheet }

    let request: RoundRequest
    let deck: DeckFile
    let ticket: TicketInfo
    private(set) var state: RoundState
    /// Monotonic ms when the card on screen appeared: answers wait SWIPE.settleMs after it.
    private(set) var cardShownAt: Double
    /// Monotonic ms of the first answer to the card on screen, or of time up: Next card and See results wait 420 after it.
    private(set) var actionShownAt: Double?
    private(set) var sheetOpen = false
    private(set) var sheetOpenedAt: Double = 0
    /// Whether the round was already decided when the sheet opened (the sheet announces a decision only once).
    private(set) var decidedWhenSheetOpened = false
    private(set) var resultShownAt: Double?
    private(set) var outcome: ApplyOutcome?
    /// Set once leave() begins: the round then takes no answer, press, tick or journal write, and a second leave() does nothing.
    private(set) var leaving = false
    /// The record before this round, read when it was dealt (the ticket's best).
    let previousBest: Int?

    private let store: FileProgressStore
    private let journal: RoundJournal
    private let wall: any WallClock
    private let mono: any MonotonicClock
    private let roundId = UUID().uuidString
    private let ticker: Ticker
    private var background = false
    private var journalWrite: Task<Void, Never>?

    init(request: RoundRequest, deck: DeckFile, found: RouteInIndex, progress: Progress, store: FileProgressStore, journal: RoundJournal,
         wall: any WallClock, mono: any MonotonicClock, ticker: Ticker = Ticker()) throws {
        self.request = request
        self.deck = deck
        self.store = store
        self.journal = journal
        self.wall = wall
        self.mono = mono
        self.ticker = ticker
        previousBest = bestFor(progress, request.route, request.mode)
        ticket = ticketFor(found, request.mode, previousBest)
        state = try startRound(StartArgs(mode: request.mode, route: request.route, pool: poolFor(deck, request.route.sectionId),
                                         history: progress.cards, seed: Double(request.seed)))
        cardShownAt = mono.nowMs()
    }

    /// Deals a round as the web does (reference 6, save rule 2): load, prune the round's deck, save, then deal from the
    /// pruned history.
    static func prepare(request: RoundRequest, index: DeckIndex, decks: DeckStore, store: FileProgressStore, journal: RoundJournal,
                        wall: any WallClock, mono: any MonotonicClock) async throws -> RoundCoordinator {
        guard let found = findRoute(index, request.route) else { throw DeckStoreError(description: "no route \(routeKey(request.route))") }
        let deck = try await decks.deck(request.route.deckId)
        let progress = await store.prunedForRound(deck)
        return try RoundCoordinator(request: request, deck: deck, found: found, progress: progress, store: store, journal: journal,
                                    wall: wall, mono: mono)
    }

    // MARK: Reading the round

    var card: Card? { currentCard(state) }
    var decided: Bool { isDecided(state) }
    var finished: Bool { state.phase == .finished }
    var showsAction: Bool { actionShownAt != nil && !finished }
    var answeredCount: Int { state.answers.count }

    // MARK: Answers and the action after them

    /// An answer is taken in the question phase, with no sheet open, 250 ms after the card appeared (reference 4.3).
    var canAnswer: Bool {
        state.phase == .question && !sheetOpen && mono.nowMs() - cardShownAt >= SWIPE.settleMs && !leaving
    }

    /// The one answer path of the swipe, the buttons, the custom actions and the arrow keys.
    @discardableResult func answer(_ value: Bool) -> Bool {
        guard canAnswer else { return false }
        let before = state
        send(.answer(value: value, at: wall.nowMs()))
        guard state != before else { return false }
        if state.phase == .answered || decided { actionShownAt = mono.nowMs() }
        return true
    }

    /// Every event reaches the reducer here: a change of the number of answers or of isDecided is journalled (a Timed
    /// minute that runs out with no answers is journalled as decided), never the finishing itself.
    private func send(_ event: RoundEvent) {
        let before = (state.answers.count, decided)
        state = reduce(state, event)
        if !finished && !leaving && (state.answers.count, decided) != before { writeJournal() }
    }

    /// Next card and See results take presses 420 ms after they came (NEXT_ARRIVES_MS).
    var actionReady: Bool {
        guard let at = actionShownAt else { return false }
        return !sheetOpen && mono.nowMs() - at >= NEXT_ARRIVES_MS && !leaving
    }

    /// Next card, or See results on a decided round. Returns false when the press is too early or does nothing.
    @discardableResult func next() async -> Bool {
        guard actionReady else { return false }
        if decided {
            await showResult()
            return true
        }
        let before = state
        send(.next)
        guard state != before else { return false }
        cardShownAt = mono.nowMs()
        actionShownAt = nil
        return true
    }

    // MARK: Timed

    func startTicker() {
        guard request.mode == .timed else { return }
        ticker.start { [weak self] in self?.tick() }
    }

    func stopTicker() {
        ticker.stop()
    }

    func tick() {
        guard request.mode == .timed, !finished, !leaving else { return }
        let before = state
        send(.tick(now: wall.nowMs()))
        if state.index != before.index { cardShownAt = mono.nowMs() }
        if decided && actionShownAt == nil { actionShownAt = mono.nowMs() }
    }

    /// The Timed clock pauses only when the app goes to the background and resumes when it returns (spec 5.6):
    /// Control Center, the notification shade and the app's own sheet make the scene inactive, which changes nothing.
    func scenePhaseChanged(_ phase: ScenePhase) {
        switch phase {
        case .background where !background:
            background = true
            visibility(hidden: true)
        case .active where background:
            background = false
            visibility(hidden: false)
        default:
            break
        }
    }

    private func visibility(hidden: Bool) {
        guard request.mode == .timed, !finished, !leaving else { return }
        send(.visibility(hidden: hidden, at: wall.nowMs()))
        if decided && actionShownAt == nil { actionShownAt = mono.nowMs() }
    }

    // MARK: Leaving

    /// The X and back on the round (spec D4): with no answers the round leaves at once, otherwise the sheet opens.
    var xAction: XAction { state.answers.isEmpty ? .leaveNow : .openSheet }

    func openSheet() {
        sheetOpen = true
        sheetOpenedAt = mono.nowMs()
        decidedWhenSheetOpened = decided
    }

    func keepPlaying() {
        sheetOpen = false
    }

    /// The web ignores a scrim tap for 250 ms after the sheet opens (reference 3.10).
    var scrimTapAccepted: Bool { mono.nowMs() - sheetOpenedAt >= 250 }

    /// Leaves the round: saves what leaving leaves (task 6: leavesSomething, saveLeftRound) and deletes the journal.
    func leave() async {
        guard !leaving else { return }
        leaving = true
        stopTicker()
        if leavesSomething(state) && !finished { await store.saveLeftRound(state) }
        await journalWrite?.value
        await journal.clear()
    }

    // MARK: The result

    /// Finishes the round and records it exactly once (task 6's recordRound in the store).
    func showResult() async {
        guard !finished, !leaving else { return }
        stopTicker()
        state = reduce(state, .next)
        resultShownAt = mono.nowMs()
        outcome = await store.record(state)
        await journalWrite?.value
        await journal.clear()
    }

    /// Play again, Choose another route and Close results take presses 1000 ms after the result appeared.
    var resultActionsReady: Bool {
        guard let at = resultShownAt else { return false }
        return mono.nowMs() - at >= RESULT_ARRIVES_MS
    }

    /// The comparison with the best before this round (ScoreBlock.tsx).
    var comparison: Comparison? {
        guard let outcome, finished else { return nil }
        return compareWithBest(summarise(state).score, outcome.previousBest)
    }

    // MARK: The journal

    var journalEntry: JournalEntry {
        JournalEntry(route: request.route, mode: request.mode, seed: request.seed, roundId: roundId,
                     answers: state.answers.map { JournalAnswer(cardId: $0.card.id, given: $0.given, correct: $0.correct, at: $0.at) },
                     decided: decided, recorded: false)
    }

    private func writeJournal() {
        guard !leaving else { return }
        let entry = journalEntry
        let previous = journalWrite
        let journal = journal
        journalWrite = Task {
            await previous?.value
            await journal.record(entry)
        }
    }

    /// Waits for the journal writes sent so far (tests and leaving).
    func journalSettled() async {
        await journalWrite?.value
    }

    #if DEBUG
    /// Brings the round to a debug screen of spec 7.4 at once, without the guards.
    func applyDebug(_ screen: DebugScreen) async {
        switch screen {
        case .answered, .sheet:
            send(.answer(value: true, at: wall.nowMs()))
            actionShownAt = mono.nowMs() - NEXT_ARRIVES_MS
            if screen == .sheet { openSheet() }
        case .result:
            if request.mode == .timed {
                // In Timed an answer only stamps and next does nothing: run the minute out, one tick per second (a tick
                // counts at most TIMED.maxStepMs).
                var now = wall.nowMs()
                send(.tick(now: now))
                for _ in 0..<(Int(TIMED.roundMs / 1000) + 2) where !decided {
                    now += 1000
                    send(.tick(now: now))
                }
            } else {
                for _ in 0..<(state.cards.count * 2 + 2) where !decided && state.phase != .finished {
                    send(.answer(value: true, at: wall.nowMs()))
                    if !decided { send(.next) }
                }
            }
            await showResult()
        default:
            break
        }
    }
    #endif
}
