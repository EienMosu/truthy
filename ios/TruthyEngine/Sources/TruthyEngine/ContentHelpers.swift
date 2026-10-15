// Routes, deck names, the pool of a route and card text: src/content/schema.ts, src/content/load.ts and
// src/content/text.ts, line by line.

/// The deck's name on the pass and the ticket: its own pass name when the catalog gives one, else the platform and
/// the deck title ("AWS Cloud Practitioner").
public func deckPassName(_ platform: IndexPlatform, _ deck: IndexDeck) -> String {
    deck.passName ?? "\(platform.title) \(deck.title)"
}

/// "aws-clf-c02/SEC"; the record key adds "#<mode>" (task 4's recordKey).
public func routeKey(_ route: Route) -> String {
    "\(route.deckId)/\(route.sectionId)"
}

/// Everything the index says about one route. `section` is nil for the whole deck.
public struct RouteInIndex: Equatable, Sendable {
    public let area: IndexArea
    public let platform: IndexPlatform
    public let deck: IndexDeck
    public let section: IndexSection?

    public init(area: IndexArea, platform: IndexPlatform, deck: IndexDeck, section: IndexSection?) {
        self.area = area
        self.platform = platform
        self.deck = deck
        self.section = section
    }
}

/// Finds a route in the index, or nil when its deck or section is gone. The first deck with the id decides: a
/// missing section is nil even if another platform had a deck of the same id.
public func findRoute(_ index: DeckIndex, _ route: Route) -> RouteInIndex? {
    for area in index.areas {
        for platform in area.platforms {
            guard let deck = platform.decks.first(where: { $0.id == route.deckId }) else { continue }
            if route.sectionId == WHOLE_DECK { return RouteInIndex(area: area, platform: platform, deck: deck, section: nil) }
            guard let section = deck.sections.first(where: { $0.id == route.sectionId }) else { return nil }
            return RouteInIndex(area: area, platform: platform, deck: deck, section: section)
        }
    }
    return nil
}

/// The cards a round on this route deals from, in file order. WHOLE_DECK gives every card; an unknown section none.
public func poolFor(_ deck: DeckFile, _ sectionId: String) -> [Card] {
    sectionId == WHOLE_DECK ? deck.cards : deck.cards.filter { $0.section == sectionId }
}

/// A run of card text, shown in the mono face when `code` is true.
public struct TextPart: Codable, Equatable, Sendable {
    public let text: String
    public let code: Bool

    public init(text: String, code: Bool) {
        self.text = text
        self.code = code
    }
}

private let BACKTICK: UInt16 = 0x60

/// text.split(/(`)/) without its empty pieces: every backtick is a code part of its own.
private func plainParts(_ units: ArraySlice<UInt16>) -> [TextPart] {
    var parts: [TextPart] = []
    var piece: [UInt16] = []
    func flush() {
        guard !piece.isEmpty else { return }
        parts.append(TextPart(text: String(decoding: piece, as: UTF16.self), code: false))
        piece = []
    }
    for unit in units {
        if unit == BACKTICK {
            flush()
            parts.append(TextPart(text: "`", code: true))
        } else {
            piece.append(unit)
        }
    }
    flush()
    return parts
}

/// The text in order as plain and code parts; no part is empty. A pair of backticks around at least one other unit is
/// a code part without its backticks (`/`([^`]+)`/g`, scanned as matchAll does); any other backtick is its own part.
public func textParts(_ text: String) -> [TextPart] {
    let units = Array(text.utf16)
    var parts: [TextPart] = []
    var from = 0
    var at = 0
    while at < units.count {
        if units[at] == BACKTICK {
            var end = at + 1
            while end < units.count && units[end] != BACKTICK { end += 1 }
            if end < units.count && end > at + 1 {
                parts += plainParts(units[from..<at])
                parts.append(TextPart(text: String(decoding: units[(at + 1)..<end], as: UTF16.self), code: true))
                at = end + 1
                from = at
                continue
            }
        }
        at += 1
    }
    parts += plainParts(units[from...])
    return parts
}

/// The text as it is read rather than seen (announcements, accessibility labels): code without its backticks.
public func plainText(_ text: String) -> String {
    textParts(text).map(\.text).joined()
}
