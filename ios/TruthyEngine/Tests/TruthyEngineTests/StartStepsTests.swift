import Testing
@testable import TruthyEngine

// The "steps (pure)" block of tests/components/start/StartFlow.test.tsx and unoffered.test.tsx.
private let index = DeckIndex(areas: [
    IndexArea(id: "cloud", title: "Cloud", platforms: [
        IndexPlatform(id: "aws", title: "AWS", decks: [
            IndexDeck(id: "aws-clf-c02", code: "CLF", title: "Cloud Practitioner", passName: nil, cardCount: 92, version: "v", hash: "h",
                      sections: [IndexSection(id: "CON", title: "Cloud concepts", cardCount: 45), IndexSection(id: "SEC", title: "Security and compliance", cardCount: 47)]),
        ]),
        IndexPlatform(id: "gcp", title: "Google Cloud", decks: [
            IndexDeck(id: "gcp-cdl", code: "CDL", title: "Cloud Digital Leader", passName: "Google Cloud Digital Leader", cardCount: 133, version: "v", hash: "h", sections: []),
        ]),
    ]),
])

private let full = Choice(areaId: "cloud", platformId: "aws", deckId: "aws-clf-c02", sectionId: "SEC", mode: .classic)

@Suite struct StartStepsTests {
    @Test func onTheRecentPathTheAreaAndPlatformComeWithTheDeck() {
        #expect(STEP_OF == [.via: 1, .areaId: 1, .platformId: 2, .deckId: 3, .sectionId: 4, .mode: 5])
        #expect(stepOf(.areaId, Choice()) == 1)
        #expect(stepOf(.platformId, Choice()) == 2)
        #expect(stepOf(.areaId, Choice(via: RECENT)) == 3)
        #expect(stepOf(.platformId, Choice(via: RECENT)) == 3)
        #expect(stepOf(.deckId, Choice(via: RECENT)) == 3)
        #expect(stepOf(.via, Choice(via: RECENT)) == 1)
    }

    @Test func goingBackToAStepClearsItAndEverythingAfter() {
        #expect(clearFrom(full, 6) == full)
        #expect(clearFrom(full, 4) == Choice(areaId: "cloud", platformId: "aws", deckId: "aws-clf-c02"))
        #expect(clearFrom(full, 2) == Choice(areaId: "cloud"))
        #expect(clearFrom(full, 1) == Choice())
        var recent = full
        recent.via = RECENT
        #expect(clearFrom(recent, 3) == Choice(via: RECENT))
        #expect(clearFrom(recent, 4) == Choice(via: RECENT, areaId: "cloud", platformId: "aws", deckId: "aws-clf-c02"))
    }

    @Test func thePathSkipsTheSectionStepWithoutSectionsAndThePlatformStepOnTheRecentPath() {
        #expect(pathTo(6, true) == [1, 2, 3, 4, 5, 6])
        #expect(pathTo(6, false) == [1, 2, 3, 5, 6])
        #expect(pathTo(5, true, true) == [1, 3, 4, 5])
        #expect(pathTo(1, true) == [1])
        #expect(previousStep(5, false) == 3)
        #expect(previousStep(5, true) == 4)
        #expect(previousStep(3, true, true) == 1)
        #expect(previousStep(1, true) == 1)
    }

    @Test func theCardChosenOnAStepTakesFocusOnTheWayBack() {
        #expect(chosenOn(1, full) == "cloud")
        #expect(chosenOn(3, full) == "aws-clf-c02")
        #expect(chosenOn(5, full) == "classic")
        #expect(chosenOn(6, full) == nil)
        #expect(chosenOn(1, Choice(via: RECENT, areaId: "cloud")) == RECENT)
        #expect(chosenOn(2, Choice()) == nil)
    }

    @Test func aRememberedStepShowsOnlyWhileItsChoicesExist() {
        #expect(canShow(index, 6, full))
        #expect(canShow(index, 1, Choice()))
        #expect(!canShow(index, 2, Choice()))
        #expect(!canShow(index, 2, Choice(via: RECENT, areaId: "cloud")))
        #expect(canShow(index, 3, Choice(via: RECENT)))
        #expect(!canShow(index, 4, Choice(areaId: "cloud", platformId: "gcp", deckId: "gcp-cdl")))
        #expect(canShow(index, 5, Choice(areaId: "cloud", platformId: "gcp", deckId: "gcp-cdl", sectionId: WHOLE_DECK)))
        #expect(!canShow(index, 5, Choice(areaId: "cloud", platformId: "aws", deckId: "aws-clf-c02", sectionId: "OLD")))
        #expect(!canShow(index, 3, Choice(areaId: "cloud", platformId: "gone")))
        let closed = MODE_TABLE.map { row in var row = row; row.offered = row.id != .timed; return row }
        var timed = full
        timed.mode = .timed
        #expect(!canShow(index, 6, timed, closed))
        #expect(canShow(index, 5, timed, closed))
        #expect(full[.mode] == "classic" && full[.via] == nil)
    }
}
