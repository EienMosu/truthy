import SwiftUI
import Testing
@testable import Truthy

// README Review Focus line 3: the leave sheet's detent grows with the card and becomes .large above the screen.
@Suite struct LeaveSheetLayoutTests {
    @Test func theDetentFitsTheCardAndBecomesLargeAboveTheScreen() {
        #expect(LeaveSheetLayout.detent(cardHeight: 300, bottomInset: 34, screenHeight: 932) == .height(334))
        #expect(LeaveSheetLayout.detent(cardHeight: 950, bottomInset: 34, screenHeight: 932) == .large)
    }
}
