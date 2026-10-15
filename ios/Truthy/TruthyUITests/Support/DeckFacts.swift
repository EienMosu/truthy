import Foundation

/// `plainText` of `src/content/text.ts`: every pair of backticks around at least one character that is not a
/// backtick is replaced by what it holds; any other backtick stays. It is how a statement reads to VoiceOver and
/// so how XCUITest sees its label.
func plainText(_ text: String) -> String {
    text.replacing(/`([^`]+)`/) { match in match.output.1 }
}

/// What a UI test needs to know about a card it sees on screen.
struct CardFacts: Equatable {
    let id: String
    let answer: Bool
    let explanation: String
    let sourceTitle: String
}

/// Reads a deck from `native-data/decks`, the folder the app embeds, keyed by the statement as it reads
/// (`plainText`), the way `deckAnswers` in `e2e/helpers.ts` does on the web. The simulator runs the test runner as
/// a Mac process, so the repository is reachable from this file's path.
enum DeckFacts {
    static let clf = "aws-clf-c02"
    static let cdl = "gcp-cdl"

    /// The repository root: this file is `ios/Truthy/TruthyUITests/Support/DeckFacts.swift`.
    static func repositoryRoot(file: StaticString = #filePath) -> URL {
        var url = URL(fileURLWithPath: "\(file)")
        for _ in 0..<5 { url.deleteLastPathComponent() }
        return url
    }

    static func load(_ deckId: String) throws -> [String: CardFacts] {
        let url = repositoryRoot().appending(path: "native-data/decks/\(deckId).json")
        let deck = try JSONDecoder().decode(DeckJSON.self, from: Data(contentsOf: url))
        var facts: [String: CardFacts] = [:]
        for card in deck.cards {
            facts[plainText(card.text.en.statement)] = CardFacts(
                id: card.id,
                answer: card.answer,
                explanation: plainText(card.text.en.explanation),
                sourceTitle: card.source.title
            )
        }
        return facts
    }

    private struct DeckJSON: Decodable { let cards: [CardJSON] }
    private struct CardJSON: Decodable {
        let id: String
        let answer: Bool
        let text: TextJSON
        let source: SourceJSON
    }
    private struct TextJSON: Decodable { let en: EnglishJSON }
    private struct EnglishJSON: Decodable {
        let statement: String
        let explanation: String
    }
    private struct SourceJSON: Decodable { let title: String }
}
