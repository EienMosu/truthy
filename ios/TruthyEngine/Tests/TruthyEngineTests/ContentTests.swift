import Foundation
import Testing
import TruthyEngine

// A card of native-data/decks/angular-fundamentals.json, byte for byte as the web build writes it.
private let shippedCard = #"{"id":"angular-fundamentals-sr2-05","section":"CMP","text":{"en":{"statement":"Angular writes two-way binding with parentheses inside square brackets, as in [(value)].","explanation":"The [(...)] form combines the property's binding with the corresponding event binding."}},"answer":true,"source":{"title":"Two-way binding","url":"https://angular.dev/guide/templates/two-way-binding"},"difficulty":1,"appliesTo":"Angular v22","conflictGroups":["two-way-binding-syntax"]}"#

// Two decks of an index: one with a pass name and no sections (gcp-cdl), one without a pass name.
private let shippedIndex = #"{"areas":[{"id":"cloud","title":"Cloud","platforms":[{"id":"gcp","title":"Google Cloud","decks":[{"id":"gcp-cdl","code":"CDL","title":"Cloud Digital Leader","passName":"Google Cloud Digital Leader","cardCount":133,"version":"2026-10-15","hash":"ed6f6217a4eb6f9c","sections":[]}]},{"id":"aws","title":"AWS","decks":[{"id":"aws-clf-c02","code":"CLF","title":"Cloud Practitioner","cardCount":214,"version":"2026-10-15","hash":"63acac4acc4a6213","sections":[{"id":"CON","title":"Cloud concepts","cardCount":45}]}]}]}]}"#

private func decode<T: Decodable>(_ type: T.Type, _ json: String) throws -> T {
    try JSONDecoder().decode(type, from: Data(json.utf8))
}

private func roundTrip<T: Codable>(_ value: T) throws -> T {
    try JSONDecoder().decode(T.self, from: JSONEncoder().encode(value))
}

@Suite struct ContentTests {
    @Test func decodesAShippedCard() throws {
        let card = try decode(Card.self, shippedCard)
        #expect(card.id == "angular-fundamentals-sr2-05")
        #expect(card.section == "CMP")
        #expect(card.text.en.statement == "Angular writes two-way binding with parentheses inside square brackets, as in [(value)].")
        #expect(card.text.en.explanation == "The [(...)] form combines the property's binding with the corresponding event binding.")
        #expect(card.answer == true)
        #expect(card.source == CardSource(title: "Two-way binding", url: "https://angular.dev/guide/templates/two-way-binding"))
        #expect(card.difficulty == 1)
        #expect(card.appliesTo == "Angular v22")
        #expect(card.conflictGroups == ["two-way-binding-syntax"])
        #expect(try roundTrip(card) == card)
    }

    @Test func refusesACardWithoutAnAnswer() {
        let broken = shippedCard.replacingOccurrences(of: #""answer":true,"#, with: "")
        #expect(throws: DecodingError.self) { try decode(Card.self, broken) }
    }

    @Test func decodesAnIndexWithAndWithoutAPassName() throws {
        let index = try decode(DeckIndex.self, shippedIndex)
        let platforms = index.areas[0].platforms
        #expect(index.areas.map(\.id) == ["cloud"])
        #expect(platforms.map(\.title) == ["Google Cloud", "AWS"])
        let cdl = platforms[0].decks[0]
        #expect(cdl.passName == "Google Cloud Digital Leader")
        #expect(cdl.sections.isEmpty)
        let clf = platforms[1].decks[0]
        #expect(clf.passName == nil)
        #expect(clf.code == "CLF")
        #expect(clf.cardCount == 214)
        #expect(clf.version == "2026-10-15")
        #expect(clf.hash == "63acac4acc4a6213")
        #expect(clf.sections == [IndexSection(id: "CON", title: "Cloud concepts", cardCount: 45)])
        #expect(try roundTrip(index) == index)
    }

    @Test func leavesAMissingPassNameOutWhenEncoding() throws {
        let clf = try decode(DeckIndex.self, shippedIndex).areas[0].platforms[1].decks[0]
        let text = String(decoding: try JSONEncoder().encode(clf), as: UTF8.self)
        #expect(!text.contains("passName"))
    }

    @Test func decodesADeckFile() throws {
        let deck = try decode(DeckFile.self, #"{"id":"angular-fundamentals","hash":"0123456789abcdef","cards":[\#(shippedCard)]}"#)
        #expect(deck.id == "angular-fundamentals")
        #expect(deck.hash == "0123456789abcdef")
        #expect(deck.cards.map(\.id) == ["angular-fundamentals-sr2-05"])
    }

    @Test func namesTheWholeDeckAndTheClassesAsTheWebDoes() throws {
        #expect(WHOLE_DECK == "ALL")
        #expect(Mode.allCases.map(\.rawValue) == ["classic", "streak", "lives", "timed"])
        #expect(MODES == Mode.allCases)
        #expect(try decode(Route.self, #"{"deckId":"gcp-cdl","sectionId":"ALL"}"#) == Route(deckId: "gcp-cdl", sectionId: WHOLE_DECK))
        #expect(try decode(Mode.self, #""lives""#) == .lives)
    }

    @Test func keepsHistoryAndAnswersAsTheProgressFileWritesThem() throws {
        let history = try decode(History.self, #"{"gcp-cdl-s1.1-01":{"seen":2,"lastCorrect":false,"lastSeenAt":1760000000000}}"#)
        #expect(history["gcp-cdl-s1.1-01"] == CardHistory(seen: 2, lastCorrect: false, lastSeenAt: 1_760_000_000_000))
        let card = try decode(Card.self, shippedCard)
        let answer = Answered(card: card, given: false, correct: false, at: 1_760_000_000_500)
        let result = RoundResult(
            mode: .classic,
            route: Route(deckId: "angular-fundamentals", sectionId: "CMP"),
            score: 0,
            total: 1,
            answers: [answer],
            missed: [answer],
            abandoned: false
        )
        #expect(try roundTrip(result) == result)
    }
}
