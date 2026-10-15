// The shipped content, as src/content/schema.ts describes it: native-data/decks/index.json and
// native-data/decks/<deckId>.json decode into these types. Property order is the order of a shipped card's keys.

/// The section id that means "the whole deck" (schema.ts: WHOLE_DECK).
public let WHOLE_DECK = "ALL"

public struct CardTextEn: Codable, Hashable, Sendable {
    public let statement: String
    public let explanation: String

    public init(statement: String, explanation: String) {
        self.statement = statement
        self.explanation = explanation
    }
}

/// A card's text by language. Only English ships.
public struct CardText: Codable, Hashable, Sendable {
    public let en: CardTextEn

    public init(en: CardTextEn) {
        self.en = en
    }
}

public struct CardSource: Codable, Hashable, Sendable {
    public let title: String
    public let url: String

    public init(title: String, url: String) {
        self.title = title
        self.url = url
    }
}

/// One statement. Engine code compares cards by `id`, never by the whole value.
public struct Card: Codable, Hashable, Sendable {
    public let id: String
    public let section: String
    public let text: CardText
    public let answer: Bool
    public let source: CardSource
    public let difficulty: Int
    public let appliesTo: String
    public let conflictGroups: [String]

    public init(
        id: String,
        section: String,
        text: CardText,
        answer: Bool,
        source: CardSource,
        difficulty: Int,
        appliesTo: String,
        conflictGroups: [String]
    ) {
        self.id = id
        self.section = section
        self.text = text
        self.answer = answer
        self.source = source
        self.difficulty = difficulty
        self.appliesTo = appliesTo
        self.conflictGroups = conflictGroups
    }
}

public struct DeckFile: Codable, Equatable, Sendable {
    public let id: String
    public let hash: String
    public let cards: [Card]

    public init(id: String, hash: String, cards: [Card]) {
        self.id = id
        self.hash = hash
        self.cards = cards
    }
}

public struct IndexSection: Codable, Equatable, Sendable {
    public let id: String
    public let title: String
    public let cardCount: Int

    public init(id: String, title: String, cardCount: Int) {
        self.id = id
        self.title = title
        self.cardCount = cardCount
    }
}

public struct IndexDeck: Codable, Equatable, Sendable {
    public let id: String
    public let code: String
    public let title: String
    /// Absent in the file when the deck has none; encoding leaves the key out again.
    public let passName: String?
    public let cardCount: Int
    public let version: String
    public let hash: String
    public let sections: [IndexSection]

    public init(
        id: String,
        code: String,
        title: String,
        passName: String?,
        cardCount: Int,
        version: String,
        hash: String,
        sections: [IndexSection]
    ) {
        self.id = id
        self.code = code
        self.title = title
        self.passName = passName
        self.cardCount = cardCount
        self.version = version
        self.hash = hash
        self.sections = sections
    }
}

public struct IndexPlatform: Codable, Equatable, Sendable {
    public let id: String
    public let title: String
    public let decks: [IndexDeck]

    public init(id: String, title: String, decks: [IndexDeck]) {
        self.id = id
        self.title = title
        self.decks = decks
    }
}

public struct IndexArea: Codable, Equatable, Sendable {
    public let id: String
    public let title: String
    public let platforms: [IndexPlatform]

    public init(id: String, title: String, platforms: [IndexPlatform]) {
        self.id = id
        self.title = title
        self.platforms = platforms
    }
}

public struct DeckIndex: Codable, Equatable, Sendable {
    public let areas: [IndexArea]

    public init(areas: [IndexArea]) {
        self.areas = areas
    }
}

/// A deck and a section of it, or WHOLE_DECK.
public struct Route: Codable, Hashable, Sendable {
    public let deckId: String
    public let sectionId: String

    public init(deckId: String, sectionId: String) {
        self.deckId = deckId
        self.sectionId = sectionId
    }
}
