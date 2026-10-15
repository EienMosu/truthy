import Testing
@testable import TruthyEngine

// tests/components/start/useCatalog.test.tsx and unoffered.test.tsx, the pure helpers.
private func deck(_ id: String, _ cardCount: Int = 10) -> IndexDeck {
    IndexDeck(id: id, code: String(id.prefix(3)).uppercased(), title: id, passName: nil, cardCount: cardCount, version: "v", hash: "h", sections: [])
}

private let index = DeckIndex(areas: [
    IndexArea(id: "cloud", title: "Cloud", platforms: [
        IndexPlatform(id: "aws", title: "AWS", decks: [deck("aws-clf-c02"), deck("aws-saa-c03")]),
        IndexPlatform(id: "gcp", title: "Google Cloud", decks: [deck("gcp-cdl"), deck("gcp-cdl-pro")]),
        IndexPlatform(id: "azure", title: "Azure", decks: []),
    ]),
    IndexArea(id: "devops", title: "DevOps", platforms: []),
])

private func seen(_ ids: [String: Double]) -> Progress {
    Progress(version: 1, cards: ids.mapValues { CardHistory(seen: 1, lastCorrect: true, lastSeenAt: $0) }, records: [:], last: nil)
}

@Suite struct CatalogTests {
    @Test func countsDecksAndSaysHowMany() {
        #expect(deckCount(index.areas[0]) == 4)
        #expect(deckCount(index.areas[0].platforms[2]) == 0)
        #expect(deckCount(index.areas[1]) == 0)
        #expect(decksLabel(0) == "No decks yet")
        #expect(decksLabel(1) == "1 deck")
        #expect(decksLabel(54) == "54 decks")
    }

    @Test func aCardBelongsToTheDeckOfItsLongestPrefix() {
        let ids: Set<String> = ["gcp-cdl", "gcp-cdl-pro", "aws-clf-c02"]
        #expect(deckOfCard("gcp-cdl-s1.1-01", ids) == "gcp-cdl")
        #expect(deckOfCard("gcp-cdl-pro-1", ids) == "gcp-cdl-pro")
        #expect(deckOfCard("aws-clf-c02-t1.1-01", ids) == "aws-clf-c02")
        #expect(deckOfCard("azure-1", ids) == nil)
        #expect(deckOfCard("gcp", ids) == nil)
        #expect(deckOfCard("-gcp-cdl", ids) == nil)
    }

    @Test func seenPercentRoundsHalfUpAndNeverReadsZeroWhenSomethingWasSeen() {
        let ids = (1...100).map { "d-\($0)" }
        let some = seen(Dictionary(uniqueKeysWithValues: ids.prefix(29).map { ($0, 1.0) }))
        #expect(seenPercent(some, (id: "d", cardCount: 100), ids) == 29)
        #expect(seenPercent(seen(["d-1": 1]), (id: "d", cardCount: 1000), (1...1000).map { "d-\($0)" }) == 1)
        #expect(seenPercent(emptyProgress(), (id: "d", cardCount: 100), ids) == 0)
        #expect(seenPercent(seen(Dictionary(uniqueKeysWithValues: ids.map { ($0, 1.0) })), (id: "d", cardCount: 100), ids) == 100)
        // Without the deck's ids: the prefix count over the card count, capped at 100.
        #expect(seenPercent(seen(["d-1": 1, "d-2": 1, "dx-1": 1]), (id: "d", cardCount: 4)) == 50)
        #expect(seenPercent(seen(["d-1": 1, "d-2": 1]), (id: "d", cardCount: 1)) == 100)
        #expect(seenPercent(seen(["d-1": 1]), (id: "d", cardCount: 0)) == 0)
    }

    @Test func continueLeadsToTheLastRouteWhileItCanBePlayed() {
        let last = LastRound(route: Route(deckId: "aws-clf-c02", sectionId: WHOLE_DECK), mode: .classic, score: 7, total: 10)
        let progress = Progress(version: 1, cards: [:], records: [:], last: last)
        let target = continueTarget(index, progress)
        #expect(target?.route == last.route && target?.mode == .classic && target?.lastScore == LastScore(score: 7, total: 10))
        #expect(target?.found.platform.id == "aws")
        let left = Progress(version: 1, cards: [:], records: [:], last: LastRound(route: last.route, mode: .timed, score: nil, total: nil))
        #expect(continueTarget(index, left)?.lastScore == nil)
        let closed = MODE_TABLE.map { row in var row = row; row.offered = row.id != .timed; return row }
        #expect(continueTarget(index, left, closed) == nil)
        #expect(continueTarget(index, emptyProgress()) == nil)
        let gone = Progress(version: 1, cards: [:], records: [:], last: LastRound(route: Route(deckId: "gone", sectionId: "ALL"), mode: .classic, score: 1, total: 2))
        #expect(continueTarget(index, gone) == nil)
    }

    @Test func recentListsTheDecksPlayedLastNewestFirstAndKeepsCatalogOrderOnTies() {
        let progress = seen([
            "aws-clf-c02-1": 100, "aws-clf-c02-2": 300, "gcp-cdl-1": 200, "gcp-cdl-pro-1": 300, "aws-saa-c03-1": 50, "unknown-1": 999,
        ])
        #expect(recentDecks(index, progress).map(\.deck.id) == ["aws-clf-c02", "gcp-cdl-pro", "gcp-cdl", "aws-saa-c03"])
        #expect(recentDecks(index, progress).first?.lastSeenAt == 300)
        #expect(recentDecks(index, progress, 2).map(\.deck.id) == ["aws-clf-c02", "gcp-cdl-pro"])
        #expect(recentDecks(index, emptyProgress()).isEmpty)
        #expect(RECENT_LIMIT == 4)
    }

    @Test func pruningSavesOnlyWhenACardWasDropped() {
        let progress = seen(["aws-clf-c02-1": 1, "aws-clf-c02-old": 1, "gcp-cdl-1": 1])
        var saved: [Progress] = []
        let pruned = withoutRemovedCards(progress, ["aws-clf-c02": ["aws-clf-c02-1"]]) { saved.append($0) }
        #expect(Set(pruned.cards.keys) == ["aws-clf-c02-1", "gcp-cdl-1"])
        #expect(saved == [pruned])
        saved = []
        #expect(withoutRemovedCards(pruned, ["aws-clf-c02": ["aws-clf-c02-1"]]) { saved.append($0) } == pruned)
        #expect(saved.isEmpty)
    }
}
