import XCTest

/// The small driver the gesture and sheet tests of tasks 12 to 14 share (task 15 adds the full Player). It launches
/// the app with debug launch arguments (task 11) and finds controls by the labels of reference 4.5.
@MainActor
struct AppDriver {
    let app = XCUIApplication()

    init(_ arguments: [String] = []) {
        app.launchArguments += arguments
    }

    func launch() {
        app.launch()
    }

    func button(_ label: String) -> XCUIElement {
        app.buttons.matching(NSPredicate(format: "label == %@", label)).firstMatch
    }

    func button(startingWith prefix: String) -> XCUIElement {
        app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", prefix)).firstMatch
    }

    func element(_ label: String) -> XCUIElement {
        app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", label)).firstMatch
    }

    func element(containing text: String) -> XCUIElement {
        app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", text)).firstMatch
    }

    func lowestButton(_ label: String) -> XCUIElement {
        let all = app.buttons.matching(NSPredicate(format: "label == %@", label)).allElementsBoundByIndex
        return all.max { $0.frame.minY < $1.frame.minY } ?? button(label)
    }

    func waitFor(_ element: XCUIElement, _ what: String, timeout: TimeInterval = 10, file: StaticString = #filePath, line: UInt = #line) {
        XCTAssertTrue(element.waitForExistence(timeout: timeout), "Waited for \(what)", file: file, line: line)
    }

    func pause(_ seconds: TimeInterval) {
        Thread.sleep(forTimeInterval: seconds)
    }

    /// A pan from `from` to `to`, both as fractions of the window, at `velocity` points per second.
    func drag(from: CGVector, to: CGVector, velocity: XCUIGestureVelocity = .default, hold: TimeInterval = 0) {
        let start = app.coordinate(withNormalizedOffset: from)
        start.press(forDuration: 0.05, thenDragTo: app.coordinate(withNormalizedOffset: to), withVelocity: velocity, thenHoldForDuration: hold)
    }

    /// Escape and Return under XCUITest. On the iOS 18.4 and 26.5 simulators `typeKey` does not deliver either to the
    /// app: on 18.4 neither reaches `UIApplication.sendEvent` (the arrows and letters do), whatever handles them
    /// (`onKeyPress`, a `keyboardShortcut`, a first-responder `UIKeyCommand` with priority over the system,
    /// `pressesBegan`). The Mac
    /// keyboard through the simulator (I/O, Keyboard, Connect Hardware Keyboard) reaches the app's `onKeyPress`
    /// handlers, so the tests that need them skip on the simulator and task 16 checks them on the device (D16).
    static func skipEscapeAndReturnOnTheSimulator() throws {
        #if targetEnvironment(simulator)
        throw XCTSkip("XCUITest's typeKey does not deliver Escape or Return to the app on the simulator (seen on iOS 18.4 and 26.5); task 16 checks them on the device (D16)")
        #endif
    }

    /// A round opened at once by the debug arguments: CLF Security, seed 7.
    static func round(_ mode: String = "classic", screen: String = "round", extra: [String] = []) -> AppDriver {
        AppDriver(["-seed", "7", "-route", "aws-clf-c02/SEC", "-mode", mode, "-screen", screen] + extra)
    }
}
