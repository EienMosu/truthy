import Testing
@testable import TruthyEngine

// The pinned cases of tests/content/schema.test.ts, schema-polish.test.ts, load.test.ts and text.test.ts.
private func deck(_ id: String, _ sections: [String], passName: String? = nil) -> IndexDeck {
    IndexDeck(id: id, code: String(id.prefix(3)).uppercased(), title: "Title \(id)", passName: passName, cardCount: 10,
              version: "2026-10-01", hash: "h", sections: sections.map { IndexSection(id: $0, title: "Section \($0)", cardCount: 5) })
}

private let index = DeckIndex(areas: [
    IndexArea(id: "cloud", title: "Cloud", platforms: [
        IndexPlatform(id: "aws", title: "AWS", decks: [deck("aws-clf-c02", ["CON", "SEC"])]),
        IndexPlatform(id: "gcp", title: "Google Cloud", decks: [deck("gcp-cdl", [], passName: "Google Cloud Digital Leader")]),
    ]),
    IndexArea(id: "frontend", title: "Frontend", platforms: [
        IndexPlatform(id: "nextjs", title: "Next.js", decks: [deck("nextjs-rendering", ["RSC"])]),
    ]),
])

private func card(_ id: String, _ section: String) -> Card {
    Card(id: id, section: section, text: CardText(en: CardTextEn(statement: "S \(id)", explanation: "E \(id)")), answer: true,
         source: CardSource(title: "Docs", url: "https://docs.aws.amazon.com/"), difficulty: 1, appliesTo: "", conflictGroups: [])
}

@Suite struct ContentHelpersTests {
    @Test func namesARouteAndADeckOnThePass() {
        #expect(routeKey(Route(deckId: "aws-clf-c02", sectionId: "SEC")) == "aws-clf-c02/SEC")
        #expect(routeKey(Route(deckId: "nextjs-rendering", sectionId: WHOLE_DECK)) == "nextjs-rendering/ALL")
        let aws = index.areas[0].platforms[0]
        let gcp = index.areas[0].platforms[1]
        #expect(deckPassName(aws, aws.decks[0]) == "AWS Title aws-clf-c02")
        #expect(deckPassName(gcp, gcp.decks[0]) == "Google Cloud Digital Leader")
    }

    @Test func findsARouteByDeckThenSection() {
        let sec = findRoute(index, Route(deckId: "aws-clf-c02", sectionId: "SEC"))
        #expect(sec?.area.id == "cloud" && sec?.platform.id == "aws" && sec?.section?.id == "SEC")
        #expect(findRoute(index, Route(deckId: "gcp-cdl", sectionId: WHOLE_DECK))?.section == nil)
        #expect(findRoute(index, Route(deckId: "gcp-cdl", sectionId: WHOLE_DECK))?.deck.id == "gcp-cdl")
        #expect(findRoute(index, Route(deckId: "nextjs-rendering", sectionId: "RSC"))?.area.id == "frontend")
        #expect(findRoute(index, Route(deckId: "aws-saa-c03", sectionId: WHOLE_DECK)) == nil)
        #expect(findRoute(index, Route(deckId: "aws-clf-c02", sectionId: "OLD")) == nil)
        #expect(findRoute(index, Route(deckId: "aws-clf-c02", sectionId: "sec")) == nil)
        #expect(findRoute(index, Route(deckId: "gcp-cdl", sectionId: "SEC")) == nil)
    }

    @Test func dealsFromTheSectionInFileOrderOrTheWholeDeck() {
        let file = DeckFile(id: "aws-clf", hash: "h1", cards: [card("aws-clf-001", "S01"), card("aws-clf-002", "S02"), card("aws-clf-003", "S01")])
        #expect(poolFor(file, "S01").map(\.id) == ["aws-clf-001", "aws-clf-003"])
        #expect(poolFor(file, WHOLE_DECK).map(\.id) == ["aws-clf-001", "aws-clf-002", "aws-clf-003"])
        #expect(poolFor(file, "S99").isEmpty)
        #expect(poolFor(file, "s01").isEmpty)
    }

    @Test func splitsTextIntoPlainAndCodeParts() {
        #expect(textParts("AWS patches the host.") == [TextPart(text: "AWS patches the host.", code: false)])
        #expect(textParts("An `asserts x is string` function narrows `x` after a call.") == [
            TextPart(text: "An ", code: false), TextPart(text: "asserts x is string", code: true),
            TextPart(text: " function narrows ", code: false), TextPart(text: "x", code: true), TextPart(text: " after a call.", code: false),
        ])
        #expect(textParts("`a``b`") == [TextPart(text: "a", code: true), TextPart(text: "b", code: true)])
        #expect(textParts("one ` two") == [TextPart(text: "one ", code: false), TextPart(text: "`", code: true), TextPart(text: " two", code: false)])
        #expect(textParts("a `` b") == [
            TextPart(text: "a ", code: false), TextPart(text: "`", code: true), TextPart(text: "`", code: true), TextPart(text: " b", code: false),
        ])
        #expect(textParts("a ``` b").filter(\.code).count == 3)
        #expect(textParts("") == [])
        #expect(textParts("`") == [TextPart(text: "`", code: true)])
    }

    @Test func readsCodeWithoutItsBackticks() {
        #expect(plainText("An `asserts x is string` function narrows `x` after a call.") == "An asserts x is string function narrows x after a call.")
        #expect(plainText("one ` two") == "one ` two")
        #expect(plainText("Käse `ß` 😀 ende") == "Käse ß 😀 ende")
    }

    @Test func keepsAFragmentAcrossALineBreakAndAroundAnEmoji() {
        #expect(textParts("`line one\nline two` after") == [TextPart(text: "line one\nline two", code: true), TextPart(text: " after", code: false)])
        #expect(textParts("😀`x`😀") == [TextPart(text: "😀", code: false), TextPart(text: "x", code: true), TextPart(text: "😀", code: false)])
    }
}
