import Testing
@testable import TruthyEngine

// tests/components/play/ticketScroll.test.ts and tests/components/play/useRound.test.tsx (ticketFor).
@Suite struct TicketScrollTests {
    @Test func aNewCardShowsItsStatementAboveTheActionRow() {
        #expect(statementScroll(Span(top: 100, bottom: 300), 400) == 0)
        #expect(statementScroll(Span(top: 100, bottom: 500), 400) == 100)
        #expect(statementScroll(Span(top: 100, bottom: 450), 400) == 50)
        #expect(statementScroll(Span(top: 0, bottom: 100), 400).sign == .plus)
    }

    @Test func theSlipScrollsInOnlyWhenItIsNotInView() {
        let at = SlipScrollAt(top: 0, visible: 500, gap: 12, max: 300)
        #expect(slipScroll(Span(top: 300, bottom: 512), at) == nil)
        #expect(slipScroll(Span(top: 300, bottom: 513), at) == 300)
        #expect(slipScroll(Span(top: 400, bottom: 700), SlipScrollAt(top: 0, visible: 500, gap: 12, max: 250)) == 250)
        #expect(ARROW_STEP == 40)
        let place = KeyScrollAt(top: 100, visible: 500, max: 600)
        #expect(keyScroll("ArrowDown", false, place) == 140)
        #expect(keyScroll(" ", true, place) == 0)
        #expect(keyScroll("PageDown", false, place) == 560)
        #expect(keyScroll("End", false, place) == 600)
        #expect(keyScroll("ArrowDown", true, place) == nil)
        #expect(keyScroll("a", false, place) == nil)
    }

    @Test func theTicketNamesTheRouteFromTheIndex() {
        let deck = IndexDeck(id: "aws-clf-c02", code: "CLF", title: "Cloud Practitioner", passName: nil, cardCount: 92, version: "v", hash: "h",
                             sections: [IndexSection(id: "SEC", title: "Security and compliance", cardCount: 47)])
        let platform = IndexPlatform(id: "aws", title: "AWS", decks: [deck])
        let area = IndexArea(id: "cloud", title: "Cloud", platforms: [platform])
        let sec = ticketFor(RouteInIndex(area: area, platform: platform, deck: deck, section: deck.sections[0]), .classic, 7)
        #expect(sec == TicketInfo(deckCode: "CLF", deckName: "AWS Cloud Practitioner", sectionCode: "SEC", sectionName: "Security and compliance", modeLabel: "Classic", best: 7))
        let whole = ticketFor(RouteInIndex(area: area, platform: platform, deck: deck, section: nil), .lives, nil)
        #expect(whole.sectionCode == "ALL" && whole.sectionName == "Whole deck" && whole.modeLabel == "Three lives" && whole.best == nil)
    }
}
