import XCTest

/// Task 14: feel item N7 and README Review Focus lines 3 and 5 on the leave sheet and the result.
final class LeaveAndResultTests: XCTestCase {
    override func setUp() {
        continueAfterFailure = false
    }

    @MainActor
    private func openSheet(_ driver: AppDriver) {
        driver.button("Leave round").tap()
        driver.waitFor(driver.element("Leave round?"), "the leave sheet")
        driver.pause(0.4)
    }

    @MainActor
    private func gone(_ driver: AppDriver, _ what: String) {
        XCTAssertTrue(driver.element("Leave round?").waitForNonExistence(timeout: 5), "\(what) closed the sheet")
        XCTAssertTrue(driver.button("Next card").exists, "\(what) kept the round as it was")
    }

    /// N7: swiping the sheet down and tapping above the card mean Keep playing.
    @MainActor
    func testSwipeDownAndATapAboveKeepPlaying() {
        let driver = AppDriver.round(screen: "sheet")
        driver.launch()
        driver.waitFor(driver.element("Leave round?"), "the leave sheet")
        driver.pause(0.4)
        // A swipe on the 28 point title is too short to dismiss: drag the card down from its title past the sheet.
        let title = driver.element("Leave round?").coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
        title.press(forDuration: 0.05, thenDragTo: title.withOffset(CGVector(dx: 0, dy: 300)), withVelocity: .fast, thenHoldForDuration: 0)
        gone(driver, "a swipe down")
        openSheet(driver)
        driver.app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.15)).tap()
        gone(driver, "a tap above the card")
    }

    /// N7: Escape on the sheet means Keep playing (skipped on the simulator, where XCUITest cannot deliver it).
    @MainActor
    func testEscapeOnTheSheetKeepsPlaying() throws {
        try AppDriver.skipEscapeAndReturnOnTheSimulator()
        let driver = AppDriver.round(screen: "sheet")
        driver.launch()
        driver.waitFor(driver.element("Leave round?"), "the leave sheet")
        driver.pause(0.4)
        driver.app.typeKey(.escape, modifierFlags: [])
        gone(driver, "Escape")
    }

    /// N7 and README Review Focus 5: a double tap, and a triple tap, on the X open the sheet and leave it open. If this fails, the 250 ms scrim guard of the
    /// web is added (task 14, step 7).
    @MainActor
    func testADoubleTapOnTheXLeavesTheSheetOpen() {
        let driver = AppDriver.round(screen: "answered")
        driver.launch()
        driver.waitFor(driver.button("Next card"), "the answered card")
        driver.button("Leave round").doubleTap()
        driver.pause(1)
        XCTAssertTrue(driver.element("Leave round?").exists, "a double tap leaves the sheet open")
        driver.lowestButton("Keep playing").tap()
        XCTAssertTrue(driver.element("Leave round?").waitForNonExistence(timeout: 5))
        driver.button("Leave round").tap(withNumberOfTaps: 3, numberOfTouches: 1)
        driver.pause(1)
        XCTAssertTrue(driver.element("Leave round?").exists, "a triple tap leaves it open too")
    }

    /// N7: the Timed clock keeps running under the sheet.
    @MainActor
    func testTheTimedClockRunsUnderTheSheet() throws {
        let driver = AppDriver.round("timed")
        driver.launch()
        let clock = driver.element(containing: "left of 60.")
        driver.waitFor(clock, "the Timed header")
        driver.pause(0.3)
        driver.button("True").tap()
        driver.pause(1)
        let before = try XCTUnwrap(Int(clock.label.prefix { $0.isNumber }))
        openSheet(driver)
        driver.pause(3)
        driver.lowestButton("Keep playing").tap()
        XCTAssertTrue(driver.element("Leave round?").waitForNonExistence(timeout: 5))
        let after = try XCTUnwrap(Int(driver.element(containing: "left of 60.").label.prefix { $0.isNumber }))
        XCTAssertGreaterThanOrEqual(before - after, 3, "the clock ran while the sheet was open")
    }

    /// Review Focus 5: after its 1000 ms, Play again deals a new round (and only the launch round opens on the result).
    @MainActor
    func testResultActionsWaitASecond() {
        let driver = AppDriver.round(screen: "result")
        driver.launch()
        let again = driver.button("Play again")
        driver.waitFor(again, "the result")
        // The 1000 ms guard is task 11's unit test (resultActionsReady); XCUITest cannot tap inside the first second.
        driver.pause(1.1)
        again.tap()
        driver.waitFor(driver.element(containing: "Card, 01"), "a new round")
    }

    /// The result is recorded: after Close results the continue line carries its score, and a relaunch keeps it.
    @MainActor
    func testTheResultIsRecorded() {
        let driver = AppDriver.round(screen: "result")
        driver.launch()
        driver.waitFor(driver.button("Close results"), "the result")
        driver.pause(1.1)
        driver.button("Close results").tap()
        let line = driver.button(startingWith: "Continue: AWS Cloud Practitioner, Security and compliance, Classic. Last score ")
        driver.waitFor(line, "the continue line with the score")
        let label = line.label
        driver.app.terminate()
        let plain = AppDriver()
        plain.launch()
        plain.waitFor(plain.button(label), "the same score after a relaunch")
    }
}
