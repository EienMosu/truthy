import XCTest

/// Task 13: README Review Focus lines 4 and 5 and feel item N3, with XCUITest coordinates.
final class RoundGestureTests: XCTestCase {
    override func setUp() {
        continueAfterFailure = false
    }

    @MainActor
    private func statement(_ driver: AppDriver) -> XCUIElement {
        driver.waitFor(driver.element(containing: "Card, 01"), "the first card")
        driver.pause(0.3)
        // The statement is one element whose label is the whole text; its identifier finds it whatever its type.
        return driver.app.descendants(matching: .any)["statement"]
    }

    /// Review Focus 4a: a diagonal drag that starts on a long statement scrolls the ticket or moves the card, never
    /// both. The largest text size makes every statement longer than the screen.
    @MainActor
    func testADiagonalDragOnALongStatementScrollsOrAnswersNeverBoth() {
        let driver = AppDriver.round(extra: ["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"])
        driver.launch()
        let text = statement(driver)
        let before = text.frame.minY
        // At the largest size the statement starts below the screen: drag where the ticket shows, on its scroll view.
        let centre = driver.app.scrollViews.firstMatch.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
        centre.press(forDuration: 0.05, thenDragTo: centre.withOffset(CGVector(dx: 70, dy: -140)), withVelocity: .default, thenHoldForDuration: 0)
        driver.pause(1)
        let scrolled = abs(text.frame.minY - before) > 20
        let answered = driver.button("Next card").exists
        XCTAssertTrue(scrolled != answered, "scrolled \(scrolled), answered \(answered): exactly one must happen")
    }

    /// Review Focus 4b: a drag that starts within 24 of the window edge never moves the card; on the round it is the
    /// back pan, which with no answers leaves at once.
    @MainActor
    func testADragFromTheEdgeIsTheBackPanAndNeverAnAnswer() {
        let driver = AppDriver.round()
        driver.launch()
        _ = statement(driver)
        let start = driver.app.coordinate(withNormalizedOffset: CGVector(dx: 0, dy: 0.5)).withOffset(CGVector(dx: 10, dy: 0))
        start.press(forDuration: 0.05, thenDragTo: start.withOffset(CGVector(dx: 200, dy: 0)), withVelocity: .fast, thenHoldForDuration: 0)
        driver.waitFor(driver.element("Choose an area"), "back at step 1")
        XCTAssertFalse(driver.button("Next card").exists)
    }

    /// N3: a vertical drag scrolls the ticket and answers nothing.
    @MainActor
    func testAVerticalDragScrollsAndAnswersNothing() {
        let driver = AppDriver.round(extra: ["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"])
        driver.launch()
        let text = statement(driver)
        let before = text.frame.minY
        let centre = driver.app.scrollViews.firstMatch.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
        centre.press(forDuration: 0.05, thenDragTo: centre.withOffset(CGVector(dx: 0, dy: -200)), withVelocity: .default, thenHoldForDuration: 0)
        driver.pause(1)
        XCTAssertGreaterThan(abs(text.frame.minY - before), 20, "the ticket scrolled")
        XCTAssertFalse(driver.button("Next card").exists)
    }

    /// Review Focus 5, the round part: a triple tap on Next card advances one card only (the 420 ms guard and one
    /// card per press). The X's taps are task 14's test, once the sheet exists.
    @MainActor
    func testATripleTapOnNextCardAdvancesOneCard() {
        let driver = AppDriver.round()
        driver.launch()
        _ = statement(driver)
        driver.button("True").tap()
        let next = driver.button("Next card")
        driver.waitFor(next, "Next card")
        // Next card exists as soon as the answer lands; its 420 ms guard would swallow taps that come at once.
        driver.pause(0.5)
        next.tap(withNumberOfTaps: 3, numberOfTouches: 1)
        driver.pause(1)
        XCTAssertTrue(driver.element(containing: "Card, 02").exists, "one card further")
        XCTAssertFalse(driver.element(containing: "Card, 03").exists, "not two")
    }

    /// Reference 4.4 (the ticket scroll after an answer): the slip comes into view above the action row, on the
    /// first card and on the next. At the largest text size every slip starts below the screen, so nothing passes
    /// without the scroll.
    @MainActor
    func testAfterAnAnswerTheTicketScrollsTheSlipIntoView() {
        let driver = AppDriver.round(extra: ["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"])
        driver.launch()
        _ = statement(driver)
        for card in ["01", "02"] {
            driver.waitFor(driver.element(containing: "Card, \(card)"), "card \(card)")
            driver.pause(0.5)
            driver.button("True").tap()
            let next = driver.button("Next card")
            driver.waitFor(next, "Next card on card \(card)")
            // The tear (460), then the scroll (t3).
            driver.pause(1.2)
            let verdict = driver.element(containing: "The answer is")
            driver.waitFor(verdict, "the slip of card \(card)")
            let stage = driver.app.scrollViews.firstMatch.frame
            XCTAssertGreaterThanOrEqual(verdict.frame.minY, stage.minY - 1, "card \(card): the verdict row is not above the stage")
            XCTAssertLessThanOrEqual(verdict.frame.maxY, next.frame.minY, "card \(card): the verdict row shows above the action row")
            next.tap()
        }
    }

    /// Spec 5.3: the swipe answers once the card has settled (the recognizer is enabled by observable state).
    @MainActor
    func testAHorizontalSwipeAnswers() {
        let driver = AppDriver.round()
        driver.launch()
        _ = statement(driver)
        driver.pause(0.5)
        driver.drag(from: CGVector(dx: 0.45, dy: 0.45), to: CGVector(dx: 0.9, dy: 0.45), velocity: .fast)
        driver.waitFor(driver.button("Next card"), "the swipe answered")
    }

    /// Spec section 2: the right arrow answers True after touches (the screen's root holds keyboard focus).
    @MainActor
    func testTheRightArrowAnswers() {
        let driver = AppDriver.round()
        driver.launch()
        _ = statement(driver)
        driver.pause(0.5)
        driver.app.typeKey(.rightArrow, modifierFlags: [])
        driver.waitFor(driver.button("Next card"), "the arrow answered")
    }
}
