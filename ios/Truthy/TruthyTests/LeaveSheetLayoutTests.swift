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

    /// Final review, finding 1: before iOS 26 the detent carries a clear band above the card, as tall as the sheet
    /// shadow reaches up (0 -18 36 -18: 36), so the shadow is drawn inside the sheet instead of cut at its top edge.
    @Test func theDetentCarriesTheSheetShadowsBandAboveTheCard() {
        #expect(LeaveSheetLayout.reachAbove(Tokens.dayShadows.sheet) == 36)
        #expect(LeaveSheetLayout.reachAbove(Tokens.nightShadows.sheet) == 36)
        #expect(LeaveSheetLayout.reachAbove(Tokens.dayShadows.small) == 0, "a shadow cast downwards reaches nothing above")
        #expect(LeaveSheetLayout.detent(cardHeight: 300, bottomInset: 34, screenHeight: 932, shadowBand: 36) == .height(336))
        #expect(LeaveSheetLayout.detent(cardHeight: 300, bottomInset: 0, screenHeight: 667, shadowBand: 36) == .height(370))
        // The band counts towards the screen: 600 + 34 fits the SE's 667, with the band's 36 it does not.
        #expect(LeaveSheetLayout.detent(cardHeight: 600, bottomInset: 0, screenHeight: 667) == .height(634))
        #expect(LeaveSheetLayout.detent(cardHeight: 600, bottomInset: 0, screenHeight: 667, shadowBand: 36) == .large)
    }
}
