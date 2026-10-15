import Testing
@testable import TruthyEngine

// tests/app-state/modes.test.ts, modes-polish.test.ts and the copy of modes-score-copy-polish.test.ts.
@Suite struct ModeTableTests {
    @Test func theTableIsTheWebsWordForWord() {
        #expect(MODE_TABLE == [
            ModeInfo(id: .classic, name: "Classic", description: "Correct answers out of 10 cards.", unit: "of 10", offered: true),
            ModeInfo(id: .streak, name: "Streak", description: "Correct answers in a row, until the first wrong one.", unit: "in a row", offered: true),
            ModeInfo(id: .lives, name: "Three lives", description: "Cards answered until the third wrong one.", unit: "cards", offered: true),
            ModeInfo(id: .timed, name: "Timed", description: "Correct answers in one minute, wrong ones cost nothing.", unit: "correct", offered: true),
        ])
        #expect(MODE_TABLE.map(\.id) == MODES)
    }

    @Test func findsTheRowOfEachClassAndOffersAll() {
        for mode in Mode.allCases {
            #expect(modeInfo(mode).id == mode)
            #expect(isOffered(mode))
        }
    }

    @Test func aClosedClassIsNotOfferedInTheTableGiven() {
        let closed = MODE_TABLE.map { row in var row = row; row.offered = row.id != .timed; return row }
        #expect(!isOffered(.timed, closed))
        #expect(isOffered(.classic, closed))
        #expect(isOffered(.timed))
    }

    @Test func saysTheLastScoreAsTheContinueLineDoes() {
        #expect(lastScoreText(.classic, 7, 10) == "7 of 10")
        #expect(lastScoreText(.classic, 5, 7) == "5 of 7")
        #expect(lastScoreText(.streak, 13, 14) == "13 in a row")
        #expect(lastScoreText(.streak, 1, 2) == "1 in a row")
        #expect(lastScoreText(.lives, 21, 21) == "21 cards")
        #expect(lastScoreText(.timed, 14, 17) == "14 correct")
        #expect(lastScoreText(.timed, 0, 0) == "0 correct")
    }
}
