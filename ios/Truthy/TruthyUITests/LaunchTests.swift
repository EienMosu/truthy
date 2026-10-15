import XCTest

/// The app launches and stays in front. Later tasks' UI tests build on this target.
final class LaunchTests: XCTestCase {
    @MainActor
    func testTheAppLaunches() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.wait(for: .runningForeground, timeout: 10))
    }
}
