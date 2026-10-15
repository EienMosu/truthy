import XCTest

/// Task 12: the start flow's back gestures and Escape (spec 5.1). Task 15's stories cover the rest.
final class StartFlowGestureTests: XCTestCase {
    override func setUp() {
        continueAfterFailure = false
    }

    @MainActor
    private func toTheDeckStep(_ driver: AppDriver) {
        driver.waitFor(driver.element("Choose an area"), "step 1")
        driver.pause(0.3)
        driver.button(startingWith: "Cloud, ").tap()
        driver.waitFor(driver.element("Choose a platform"), "step 2")
        driver.pause(0.3)
        driver.button(startingWith: "AWS, ").tap()
        driver.waitFor(driver.element("Choose a deck"), "step 3")
        driver.pause(0.3)
    }

    @MainActor
    func testAnEdgePanCompletesOneStepBackAndASlowShortOneCancels() {
        let driver = AppDriver()
        driver.launch()
        toTheDeckStep(driver)
        driver.drag(from: CGVector(dx: 0.005, dy: 0.5), to: CGVector(dx: 0.25, dy: 0.5), velocity: XCUIGestureVelocity(60), hold: 0.4)
        driver.pause(1)
        XCTAssertTrue(driver.element("Choose a deck").exists, "a cancelled pan changes nothing")
        driver.drag(from: CGVector(dx: 0.005, dy: 0.5), to: CGVector(dx: 0.85, dy: 0.5), velocity: .fast)
        driver.waitFor(driver.element("Choose a platform"), "one step back")
        XCTAssertFalse(driver.element("Choose an area").exists)
    }

    @MainActor
    func testEscapeGoesBackAndIsConsumedOnStepOne() throws {
        try AppDriver.skipEscapeAndReturnOnTheSimulator()
        let driver = AppDriver()
        driver.launch()
        toTheDeckStep(driver)
        driver.app.typeKey(.escape, modifierFlags: [])
        driver.waitFor(driver.element("Choose a platform"), "Escape went back one step")
        driver.app.typeKey(.escape, modifierFlags: [])
        driver.waitFor(driver.element("Choose an area"), "Escape went back to step 1")
        driver.app.typeKey(.escape, modifierFlags: [])
        driver.pause(1)
        XCTAssertTrue(driver.element("Choose an area").exists, "Escape on step 1 does nothing")
        XCTAssertEqual(driver.app.state, .runningForeground)
    }

    /// Reference 4.4: after a back, the card chosen before shows whole (the list scrolls it into view first).
    @MainActor
    func testABackScrollsTheCardChosenBeforeIntoView() {
        let driver = AppDriver()
        driver.launch()
        driver.waitFor(driver.element("Choose an area"), "step 1")
        driver.pause(0.3)
        driver.button(startingWith: "DevOps, ").tap()
        driver.waitFor(driver.element("Choose a platform"), "step 2")
        driver.pause(0.3)
        let last = driver.button(startingWith: "Networking, ")
        for _ in 0..<6 where !last.isHittable { driver.app.swipeUp() }
        last.tap()
        driver.waitFor(driver.element("Choose a deck"), "step 3")
        driver.pause(0.3)
        driver.button("Back to platforms").tap()
        driver.waitFor(driver.element("Choose a platform"), "back on step 2")
        driver.pause(1)
        let card = driver.button(startingWith: "Networking, ")
        XCTAssertTrue(driver.app.windows.firstMatch.frame.contains(card.frame), "the chosen platform shows whole after the back")
    }
}
