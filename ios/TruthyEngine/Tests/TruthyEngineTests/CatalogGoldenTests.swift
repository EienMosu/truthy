import Testing
@testable import TruthyEngine

// native-data/golden vectors of components/start/useCatalog.ts.
private typealias G = ProgressGolden

private func table(_ file: GoldenFile, _ input: GoldenValue) throws -> [ModeInfo] {
    try input["modeTable"].map { try file.decode([ModeInfo].self, $0) } ?? MODE_TABLE
}

@Suite struct CatalogGoldenTests {
    @Test func deckCountCases() throws {
        let file = try Golden.load("components/start/useCatalog", "deckCount")
        for c in file.cases {
            let place = try G.required(c.input, "place")
            let count = place["platforms"] != nil
                ? deckCount(try file.decode(IndexArea.self, place))
                : deckCount(try file.decode(IndexPlatform.self, place))
            #expect(count == (try c.output.int()), "\(c.name)")
        }
    }

    @Test func decksLabelCases() throws {
        let file = try Golden.load("components/start/useCatalog", "decksLabel")
        for c in file.cases {
            #expect(decksLabel(try G.required(c.input, "count").int()) == (try c.output.string()), "\(c.name)")
        }
    }

    @Test func deckOfCardCases() throws {
        let file = try Golden.load("components/start/useCatalog", "deckOfCard")
        for c in file.cases {
            let ids = Set(try G.strings(G.required(c.input, "deckIds")))
            let owner = deckOfCard(try G.required(c.input, "cardId").string(), ids)
            #expect(owner == (try file.decode(String?.self, c.output)), "\(c.name)")
        }
    }

    @Test func seenPercentCases() throws {
        let file = try Golden.load("components/start/useCatalog", "seenPercent")
        for c in file.cases {
            let deck = try G.required(c.input, "deck")
            let percent = seenPercent(
                try G.progress(G.required(c.input, "progress")),
                (id: try G.required(deck, "id").string(), cardCount: try G.required(deck, "cardCount").int()),
                try c.input["cardIds"].map(G.strings))
            #expect(percent == (try c.output.int()), "\(c.name)")
        }
    }

    @Test func continueTargetCases() throws {
        let file = try Golden.load("components/start/useCatalog", "continueTarget")
        for c in file.cases {
            let target = continueTarget(
                try file.decode(DeckIndex.self, G.required(c.input, "index")), try G.progress(G.required(c.input, "progress")),
                try table(file, c.input))
            guard let target else {
                #expect(c.output == .null, "\(c.name)")
                continue
            }
            let expected = try G.required(c.output, "lastScore")
            #expect(try G.route(G.required(c.output, "route")) == target.route, "\(c.name): route")
            #expect(try G.mode(G.required(c.output, "mode")) == target.mode, "\(c.name): mode")
            #expect(routeProjection(target.found) == (try G.required(c.output, "found")), "\(c.name): found")
            let lastScore: LastScore? = expected == .null ? nil
                : LastScore(score: try G.required(expected, "score").int(), total: try G.required(expected, "total").int())
            #expect(target.lastScore == lastScore, "\(c.name): lastScore")
        }
    }

    @Test func recentDecksCases() throws {
        let file = try Golden.load("components/start/useCatalog", "recentDecks")
        for c in file.cases {
            let index = try file.decode(DeckIndex.self, G.required(c.input, "index"))
            let progress = try G.progress(G.required(c.input, "progress"))
            let decks = if let limit = c.input["limit"] { recentDecks(index, progress, try limit.int()) } else { recentDecks(index, progress) }
            let got: [GoldenValue] = decks.map {
                .object(["areaId": .string($0.area.id), "platformId": .string($0.platform.id), "deckId": .string($0.deck.id), "lastSeenAt": .number($0.lastSeenAt)])
            }
            #expect(got == (try c.output.array()), "\(c.name)")
        }
    }

    @Test func recentLimit() throws {
        let file = try Golden.load("components/start/useCatalog", "RECENT_LIMIT")
        #expect(try file.cases[0].output.int() == RECENT_LIMIT)
    }

    @Test func withoutRemovedCardsCases() throws {
        let file = try Golden.load("components/start/useCatalog", "withoutRemovedCards")
        for c in file.cases {
            guard case .object(let byDeck) = try G.required(c.input, "cardIds") else { throw GoldenError(description: "\(c.name): cardIds") }
            var saved = false
            let pruned = withoutRemovedCards(try G.progress(G.required(c.input, "progress")), try byDeck.mapValues(G.strings)) { _ in saved = true }
            #expect(G.exactly(pruned, try G.progress(G.required(c.output, "progress"))), "\(c.name): progress")
            #expect(saved == (try G.required(c.output, "saved").bool()), "\(c.name): saved")
        }
    }
}
