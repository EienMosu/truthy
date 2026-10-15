import Testing
@testable import TruthyEngine

// native-data/golden vectors of src/content/schema.ts, load.ts and text.ts.
private func required(_ value: GoldenValue, _ key: String) throws -> GoldenValue {
    guard let member = value[key] else { throw GoldenError(description: "no \(key) in \(value)") }
    return member
}

/// The projection plan A writes for a found route.
func routeProjection(_ found: RouteInIndex?) -> GoldenValue {
    guard let found else { return .null }
    return .object([
        "areaId": .string(found.area.id), "platformId": .string(found.platform.id), "deckId": .string(found.deck.id),
        "sectionId": found.section.map { .string($0.id) } ?? .null,
    ])
}

@Suite struct ContentGoldenTests {
    @Test func wholeDeck() throws {
        let file = try Golden.load("src/content/schema", "WHOLE_DECK")
        #expect(try file.cases[0].output.string() == WHOLE_DECK)
    }

    @Test func routeKeyCases() throws {
        let file = try Golden.load("src/content/schema", "routeKey")
        for c in file.cases {
            #expect(routeKey(try file.decode(Route.self, required(c.input, "route"))) == (try c.output.string()), "\(c.name)")
        }
    }

    @Test func deckPassNameCases() throws {
        let file = try Golden.load("src/content/schema", "deckPassName")
        for c in file.cases {
            let platform = try required(c.input, "platform")
            let deck = try required(c.input, "deck")
            // The web types take only the titles and the pass name; the rest of each struct is a placeholder.
            let name = deckPassName(
                IndexPlatform(id: "", title: try required(platform, "title").string(), decks: []),
                IndexDeck(id: "", code: "", title: try required(deck, "title").string(), passName: try deck["passName"]?.string(),
                          cardCount: 1, version: "", hash: "", sections: []))
            #expect(name == (try c.output.string()), "\(c.name)")
        }
    }

    @Test func findRouteCases() throws {
        let file = try Golden.load("src/content/schema", "findRoute")
        for c in file.cases {
            let found = findRoute(try file.decode(DeckIndex.self, required(c.input, "index")), try file.decode(Route.self, required(c.input, "route")))
            #expect(routeProjection(found) == c.output, "\(c.name)")
        }
    }

    @Test func poolForCases() throws {
        let file = try Golden.load("src/content/load", "poolFor")
        for c in file.cases {
            let pool = poolFor(try file.decode(DeckFile.self, required(c.input, "deck")), try required(c.input, "sectionId").string())
            #expect(pool.map(\.id) == (try file.cards(c.output).map(\.id)), "\(c.name)")
        }
    }

    @Test func textPartsCases() throws {
        let file = try Golden.load("src/content/text", "textParts")
        for c in file.cases {
            #expect(textParts(try required(c.input, "text").string()) == (try file.decode([TextPart].self, c.output)), "\(c.name)")
        }
    }

    @Test func plainTextCases() throws {
        let file = try Golden.load("src/content/text", "plainText")
        for c in file.cases {
            #expect(plainText(try required(c.input, "text").string()) == (try c.output.string()), "\(c.name)")
        }
    }
}
