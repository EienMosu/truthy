import Foundation
import Observation
import TruthyEngine

// The app as a whole (spec 5.2, 5.6, 4.5): two top-level screens swapped in place, the theme, and what the start
// screen needs (the index, the progress, Recent, Continue). At launch a journal left by a killed app is applied with
// the leave rules and deleted, every played deck is pruned (saving only when that changed the progress), and the app
// opens at start step 1 with no choices: a round is never resumed.

enum TopScreen: Equatable {
    case start
    case round(RoundRequest)
}

@MainActor @Observable
final class AppModel {
    var screen: TopScreen = .start
    private(set) var storedTheme: StoredTheme?
    /// The system appearance, kept up to date by the root view.
    var systemDark = false
    var theme: ResolvedTheme { resolveTheme(storedTheme, systemDark) }

    let index: DeckIndex
    let decks: DeckStore
    let store: FileProgressStore
    let journal: RoundJournal
    let themeStore: ThemeStore
    let wall: any WallClock
    let mono: any MonotonicClock
    let arguments: LaunchArguments
    private(set) var startFlow: StartFlowModel
    private(set) var progress = emptyProgress()
    private(set) var recent: [RecentDeck] = []
    private(set) var continueTarget: ContinueTarget?
    private(set) var launched = false
    /// The S1 title takes accessibility focus when the player comes back from a round by a control (reference 4.4).
    private(set) var returnedFromRound = false
    #if DEBUG
    private var debugScreenUsed = false
    #endif

    /// The debug screen of spec 7.4, for the first round of the process only (Play again deals an ordinary round).
    func takeDebugScreen() -> DebugScreen? {
        #if DEBUG
        guard !debugScreenUsed else { return nil }
        debugScreenUsed = true
        return arguments.screen
        #else
        return nil
        #endif
    }

    init(bundle: Bundle, directory: URL, defaults: UserDefaults, wall: any WallClock = SystemWallClock(),
         mono: any MonotonicClock = SystemMonotonicClock(), arguments: LaunchArguments = .current) throws {
        decks = DeckStore(bundle: bundle)
        index = try decks.index()
        store = FileProgressStore(directory: directory)
        journal = RoundJournal(directory: directory)
        themeStore = ThemeStore(defaults: defaults)
        self.wall = wall
        self.mono = mono
        self.arguments = arguments
        if let theme = arguments.theme { themeStore.store(theme) }
        storedTheme = themeStore.stored
        startFlow = StartFlowModel(index: index, clock: mono)
    }

    /// Launch: the journal, the start-screen prune, then step 1. A debug route and class open a round at once.
    func launch() async {
        await journal.applyPending(to: store, deck: decks.deck)
        await loadStart()
        launched = true
        #if DEBUG
        if arguments.screen == .start, let route = arguments.route {
            startFlow.openForDebug(route: route, mode: arguments.mode ?? .classic, step: arguments.step ?? 6)
        } else if let route = arguments.route, let mode = arguments.mode, let screen = arguments.screen, screen != .start, screen != .gallery {
            startRound(route: route, mode: mode)
        }
        #endif
    }

    /// Reads the progress, prunes every played deck against its current cards (saving only when an entry was
    /// dropped), and works out Recent and Continue once for this visit (reference 3.6).
    func loadStart() async {
        let loaded = await store.load()
        let deckIds = Set(index.areas.flatMap(\.platforms).flatMap(\.decks).map(\.id))
        let played = Set(loaded.cards.keys.compactMap { deckOfCard($0, deckIds) })
        var cardIds: [String: [String]] = [:]
        for id in played.sorted() {
            if let file = try? await decks.deck(id) { cardIds[id] = file.cards.map(\.id) }
        }
        var changed: Progress?
        progress = withoutRemovedCards(loaded, cardIds) { changed = $0 }
        if let changed { await store.save(changed) }
        recent = recentDecks(index, progress)
        continueTarget = TruthyEngine.continueTarget(index, progress)
    }

    /// The theme switch: flips the theme visible now and stores it; the theme flips even when storing fails.
    func switchTheme() {
        let next = TruthyEngine.switchTheme(storedTheme, systemDark)
        storedTheme = next
        themeStore.store(next)
    }

    /// Swaps in the round right after the unroll. The seed is a secure random UInt32, or the debug seed.
    func startRound(route: Route, mode: Mode) {
        returnedFromRound = false
        screen = .round(RoundRequest(route: route, mode: mode, seed: arguments.seed ?? UInt32.random(in: .min ... .max)))
    }

    /// Play again: the same route and class with a new seed.
    func playAgain(_ request: RoundRequest) {
        screen = .round(RoundRequest(route: request.route, mode: request.mode, seed: arguments.seed ?? UInt32.random(in: .min ... .max)))
    }

    /// Back to start step 1 with no choices. The start screen is loaded first and step 1 is created after it, so Recent
    /// and Continue never change under the player and the 250 ms settle starts when step 1 appears.
    func showStart(byControl: Bool) async {
        await loadStart()
        startFlow = StartFlowModel(index: index, clock: mono)
        returnedFromRound = byControl
        screen = .start
    }
}
