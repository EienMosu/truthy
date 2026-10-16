import SwiftUI
import Testing
@testable import Truthy

// README Review Focus line 3: the leave sheet's detent grows with the card and becomes .large above the screen.
@Suite struct LeaveSheetLayoutTests {
    @Test func theDetentFitsTheCardAndBecomesLargeAboveTheScreen() {
        // A phone with a home indicator: the sheet keeps the card above the 34 inset itself.
        #expect(LeaveSheetLayout.detent(cardHeight: 300, bottomInset: 34, screenHeight: 932) == .height(300))
        // A phone without one (the SE): the detent adds the web's 34 under the card.
        #expect(LeaveSheetLayout.detent(cardHeight: 300, bottomInset: 0, screenHeight: 667) == .height(334))
        #expect(LeaveSheetLayout.detent(cardHeight: 950, bottomInset: 34, screenHeight: 932) == .large)
        #expect(LeaveSheetLayout.detent(cardHeight: 640, bottomInset: 0, screenHeight: 667) == .large)
    }
}
