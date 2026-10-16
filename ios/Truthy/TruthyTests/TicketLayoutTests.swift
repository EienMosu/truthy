import SwiftUI
import Testing
import TruthyEngine
import UIKit
@testable import Truthy

// Task 15's visual review (step 51): the pass and the ticket take the web's measures, which the web's review captures
// gave in CSS pixels (iPhone SE width 375, so the paper is 343 wide; 15 Pro Max width 430, paper 398).
@MainActor
@Suite struct TicketLayoutTests {
    private let clock = FakeClock()

    private func height(_ view: some View, width: Double) -> Double {
        UIHostingController(rootView: view).sizeThatFits(in: CGSize(width: width, height: 10_000)).height
    }

    private func flow(to step: Step) throws -> StartFlowModel {
        let flow = StartFlowModel(index: try DeckStore(bundle: .main).index(), clock: clock)
        let choices: [(StartFlowModel) -> Bool] = [
            { $0.chooseArea("cloud") }, { $0.choosePlatform("aws") }, { $0.chooseDeck("aws-clf-c02") },
            { $0.chooseSection("SEC") }, { $0.chooseMode(.classic) },
        ]
        for choose in choices.prefix(step - 1) {
            clock.advance(250)
            #expect(choose(flow))
        }
        return flow
    }

    @Test func theFieldColumnsAreTheWebsGrid() {
        let grid = FieldColumns(fractions: [1.1, 1, 1])
        let even = grid.widths(303, [0, 0, 0])
        #expect(abs(even[0] - 107.52) < 0.02 && abs(even[1] - 97.73) < 0.02 && abs(even[2] - 97.73) < 0.02)
        // A column whose content needs more than its share takes it; the others share the rest (minmax(max-content)).
        #expect(grid.widths(303, [120, 0, 0]) == [120, 91.5, 91.5])
    }

    @Test func theLegsAndTheFieldGridHaveTheWebsHeights() {
        let legs = TicketLegs {
            LegText(code: "CLF", name: "AWS Cloud Practitioner")
        } to: {
            LegText(code: "SEC", name: "Security and compliance", trailing: true)
        }
        #expect(abs(height(legs, width: 343) - 96) <= 1, "two-line names on the small phone")
        #expect(abs(height(legs, width: 398) - 81) <= 1, "one-line names on the large phone")
        let grid = FieldGrid(fields: [TicketField("Class", "Classic"), TicketField("Card", "01 / 10"), TicketField("Gate", "F ← → T")])
        #expect(abs(height(grid, width: 343) - 52.38) <= 1)
    }

    @Test func thePassHasTheWebsHeightAtEachStage() throws {
        func pass(_ step: Step) throws -> some View { FillInPass(flow: try flow(to: step), onBack: { _ in }) }
        #expect(abs(height(try pass(2), width: 343) - 86.33) <= 1, "destination stage")
        #expect(abs(height(try pass(4), width: 343) - 116.33) <= 1, "route stage")
        #expect(abs(height(try pass(6), width: 343) - 210.38) <= 1, "ready stage, small phone")
        #expect(abs(height(try pass(6), width: 398) - 195.03) <= 1, "ready stage, large phone")
    }

    @Test func theReadyPassNamesTheDeckByItsPassName() throws {
        #expect(FillInPass.deckName(try flow(to: 6)) == "AWS Cloud Practitioner")
    }

    /// The score block's row shrinks as the web's flex row does: on the small phone "Correct in a row" (116) and
    /// "First round on this route" (190) with 16 between them overflow 303 by 19, which they share by width.
    @Test func theScoreRowSharesTheOverflowByWidth() {
        let widths = ShrinkRow.shrink(basis: [116, 190], total: 303, gap: 16)
        #expect(abs(widths[0] - 108.80) < 0.01 && abs(widths[1] - 178.20) < 0.01)
        #expect(ShrinkRow.shrink(basis: [80, 190], total: 398, gap: 16) == [80, 190])
    }

    /// At the largest text size the comparison goes under the score: the row is as tall as both.
    @Test func atTheLargestSizeTheComparisonGoesUnderTheScore() {
        let copy = resultCopy(RoundResult(mode: .streak, route: Route(deckId: "aws-clf-c02", sectionId: "SEC"), score: 1, total: 2, answers: [], missed: [], abandoned: false), "Streak", 10, nil)
        func block(_ size: DynamicTypeSize) -> Double {
            height(ScoreBlock(copy: copy, score: 1, comparison: .first).dynamicTypeSize(size), width: 343)
        }
        #expect(block(.large) < 120, "side by side at the default size (the label on two lines, as on the web)")
        #expect(block(.accessibility5) > block(.large) + 80, "one under the other at the largest size")
    }

    @Test func theMissedCardsFillTheLowerPartTheyAreGiven() {
        let card = MissedCard(number: 2, given: true, answer: false, appliesTo: nil, statement: "A statement.",
                              explanation: "Why.", source: CardSource(title: "A source", url: "https://example.com"))
        #expect(abs(height(MissedCardsView(missed: [card], height: 300), width: 343) - 300) <= 0.5)
        #expect(abs(height(MissedCardsView(missed: [], height: 228), width: 343) - 228) <= 0.5)
    }
}
