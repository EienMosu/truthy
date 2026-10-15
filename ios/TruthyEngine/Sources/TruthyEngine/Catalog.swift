// What the start screen derives from the deck index and the progress (components/start/useCatalog.ts): deck
// counts, the owner of a card, the seen percentage, where Continue leads, the decks played last, and pruning the
// history of cards that left their deck. Pure: the app loads, saves and keeps the results (tasks 9 and 11).

/// The number of decks under an area (all its platforms).
public func deckCount(_ area: IndexArea) -> Int {
    area.platforms.reduce(0) { $0 + $1.decks.count }
}

/// The number of decks of a platform.
public func deckCount(_ platform: IndexPlatform) -> Int {
    platform.decks.count
}

/// "1 deck", "3 decks", or "No decks yet".
public func decksLabel(_ count: Int) -> String {
    count == 0 ? "No decks yet" : "\(count) \(count == 1 ? "deck" : "decks")"
}

private let DASH: UInt16 = 0x2D

/// The deck a card belongs to, among `deckIds`: the one whose "<id>-" is the card id's longest prefix, so "gcp-cdl"
/// never takes the cards of "gcp-cdl-pro". It tries the prefixes that end just before a "-", longest first.
public func deckOfCard(_ cardId: String, _ deckIds: Set<String>) -> String? {
    let units = Array(cardId.utf16)
    var dash = units.lastIndex(of: DASH)
    while let at = dash, at > 0 {
        let prefix = String(decoding: units[..<at], as: UTF16.self)
        if deckIds.contains(prefix) { return prefix }
        dash = units[..<at].lastIndex(of: DASH)
    }
    return nil
}

/// The seen share of a deck in whole percent. With the deck's current ids, seenShare over them; without, the history
/// entries seen at least once whose id starts with "<deck.id>-", over the card count. Anything seen shows at least 1.
public func seenPercent(_ progress: Progress, _ deck: (id: String, cardCount: Int), _ cardIds: [String]? = nil) -> Int {
    let share: Double
    if let cardIds {
        share = seenShare(progress.cards, cardIds)
    } else {
        let prefix = Array((deck.id + "-").utf16)
        let seen = progress.cards.filter { $0.key.utf16.starts(with: prefix) && $0.value.seen > 0 }.count
        share = deck.cardCount > 0 ? Double(seen) / Double(deck.cardCount) : 0
    }
    if !(share > 0) { return 0 }
    return Int(min(100, max(1, jsRound(share * 100))))
}

/// The score of the last round, when it was finished.
public struct LastScore: Equatable, Sendable {
    public let score: Int
    public let total: Int

    public init(score: Int, total: Int) {
        self.score = score
        self.total = total
    }
}

/// Where Continue leads: the last route and class, when both can still be played.
public struct ContinueTarget: Equatable, Sendable {
    public let route: Route
    public let mode: Mode
    public let found: RouteInIndex
    public let lastScore: LastScore?

    public init(route: Route, mode: Mode, found: RouteInIndex, lastScore: LastScore?) {
        self.route = route
        self.mode = mode
        self.found = found
        self.lastScore = lastScore
    }
}

public func continueTarget(_ index: DeckIndex, _ progress: Progress, _ table: [ModeInfo] = MODE_TABLE) -> ContinueTarget? {
    guard let last = progress.last, isOffered(last.mode, table) else { return nil }
    guard let found = findRoute(index, last.route) else { return nil }
    var lastScore: LastScore?
    if let score = last.score, let total = last.total { lastScore = LastScore(score: score, total: total) }
    return ContinueTarget(route: last.route, mode: last.mode, found: found, lastScore: lastScore)
}

/// A deck the player has played, where it sits in the catalog, and when one of its cards was last seen.
public struct RecentDeck: Equatable, Sendable {
    public let area: IndexArea
    public let platform: IndexPlatform
    public let deck: IndexDeck
    public let lastSeenAt: Double

    public init(area: IndexArea, platform: IndexPlatform, deck: IndexDeck, lastSeenAt: Double) {
        self.area = area
        self.platform = platform
        self.deck = deck
        self.lastSeenAt = lastSeenAt
    }
}

/// How many decks Recent lists at most.
public let RECENT_LIMIT = 4

/// Math.max of two numbers: NaN wins, and +0 is larger than -0.
private func jsMax(_ a: Double, _ b: Double) -> Double {
    if a.isNaN || b.isNaN { return .nan }
    if a == b { return a.sign == .minus && b.sign == .minus ? a : (a == 0 ? 0 : a) }
    return a > b ? a : b
}

/// The decks of the index the player has played, newest first; equal times keep catalog order; at most `limit`
/// (slice(0, limit): a negative limit counts from the end). A deck's time is the latest lastSeenAt of its cards.
public func recentDecks(_ index: DeckIndex, _ progress: Progress, _ limit: Int = RECENT_LIMIT) -> [RecentDeck] {
    let placed = index.areas.flatMap { area in
        area.platforms.flatMap { platform in platform.decks.map { (area: area, platform: platform, deck: $0) } }
    }
    let deckIds = Set(placed.map(\.deck.id))
    var latest: [String: Double] = [:]
    for (cardId, entry) in progress.cards {
        if let owner = deckOfCard(cardId, deckIds) { latest[owner] = jsMax(latest[owner] ?? -.infinity, entry.lastSeenAt) }
    }
    let played = placed.compactMap { place in
        latest[place.deck.id].map { RecentDeck(area: place.area, platform: place.platform, deck: place.deck, lastSeenAt: $0) }
    }
    // (a, b) => b.lastSeenAt - a.lastSeenAt on a stable sort: newer first, a tie (or NaN) keeps catalog order.
    let sorted = played.enumerated().sorted { a, b in
        let difference = b.element.lastSeenAt - a.element.lastSeenAt
        if difference < 0 { return true }
        if difference > 0 { return false }
        return a.offset < b.offset
    }.map(\.element)
    let end = limit < 0 ? max(0, sorted.count + limit) : min(limit, sorted.count)
    return Array(sorted[0..<end])
}

/// Drops the history of cards no longer in their deck (pruneDeck for each deck of `cardIds`), and calls `save` with
/// the result only when the number of card entries changed.
public func withoutRemovedCards(_ progress: Progress, _ cardIds: [String: [String]], _ save: (Progress) -> Void) -> Progress {
    var pruned = progress
    for (deckId, ids) in cardIds { pruned = pruneDeck(pruned, deckId, ids) }
    if pruned.cards.count != progress.cards.count { save(pruned) }
    return pruned
}
