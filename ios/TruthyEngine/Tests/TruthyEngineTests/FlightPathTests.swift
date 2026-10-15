import Testing
@testable import TruthyEngine

// tests/components/FlightPath.test.tsx and FlightPath-polish.test.tsx.
@Suite struct FlightPathTests {
    @Test func theCurveRunsFromStartToEndThroughItsTop() {
        #expect(pointAt(0) == Point(x: 6, y: 24))
        #expect(pointAt(1) == Point(x: 270, y: 24))
        #expect(pointAt(0.5) == Point(x: 138, y: 9))
        #expect(headingAt(0.5) == 0)
        #expect(headingAt(0) == -12.8)
        #expect(flownPath(0) == "M6 24 Q6 24 6 24")
        #expect(flownPath(1) == "M6 24 Q138 -6 270 24")
    }

    @Test func waypointsSpreadEvenlyAndTakeTheirStates() {
        #expect(waypointT(0, 0) == 0)
        #expect(waypointT(0, 1) == 0)
        #expect(waypointT(2, 5) == 0.5)
        #expect(waypointStates(4, [true, false], 2, false) == [.correct, .wrong, .current, .future])
        #expect(waypointStates(4, [true, false, true], 2, true) == [.correct, .wrong, .correct, .future])
    }

    @Test func theLabelsListTheCards() {
        #expect(cardList([3]) == "card 3")
        #expect(cardList([1, 2]) == "cards 1 and 2")
        #expect(cardList([1, 2, 5]) == "cards 1, 2 and 5")
        #expect(flightPathLabel(10, [], 0) == "Card 1 of 10.")
        #expect(flightPathLabel(10, [true, true, false], 3) == "Card 4 of 10. Cards 1 and 2 correct, card 3 wrong.")
        #expect(flightPathLabel(10, [false], 1) == "Card 2 of 10. Card 1 wrong.")
        #expect(completedLabel(10, [true, true, true]) == "Round complete. 3 of 10 cards. 3 correct, 0 wrong.")
    }

    @Test func marksShrinkOnLongRoutes() {
        #expect(completedScale(10) == 1)
        #expect(completedScale(17) == 6.0 / 7)
        #expect(completedScale(18) == min(6, 0.35 * 264 / 17) / 7)
        #expect(completedScale(60) == min(6, 0.35 * 264 / 59) / 7)
    }
}
