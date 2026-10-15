import XCTest

/// The round seed of the visual review on both platforms and the web (README, "Cross-platform agreements"; plan C's
/// REVIEW_SEED).
let REVIEW_SEED: UInt32 = 1_234_567

/// A route through the start flow, as the leading words of each card's label (reference 4.5): an area card reads
/// "Cloud, 17 decks", a deck card "CLF, Cloud Practitioner, 214 cards, not started", a class card "Classic. ...".
struct RoutePick {
    var area = "Cloud, "
    var platform = "AWS, "
    var deck = "CLF, "
    /// Nil for a deck without sections: the flow skips the section step.
    var section: String? = "SEC, "
    var mode = "Classic. "

    static let clfSecurity = RoutePick()
    static let cdlWhole = RoutePick(platform: "Google Cloud, ", deck: "CDL, ", section: nil)

    func inClass(_ mode: String) -> RoutePick {
        var pick = self
        pick.mode = mode
        return pick
    }
}

/// One answered card of a story.
struct Played {
    let number: Int
    let statement: String
    let truth: Bool
    let given: Bool
}

/// Plays the app the way a person does: by the visible titles and accessibility labels of reference 4.5, which
/// tasks 12 to 14 take over verbatim. Every wait fails the test with what it waited for.
@MainActor
struct Player {
    /// The launch argument of task 11's `LaunchArguments` that fixes the round seed (debug builds only).
    static let seedArgument = "-seed"
    /// A little over the 250 ms settle guard (reference 3.10).
    static let settleTime: TimeInterval = 0.3
    /// A little over the 420 ms arrival of Next card and See results.
    static let arrivalTime: TimeInterval = 0.45
    /// A little over the 1000 ms arrival of the result actions.
    static let resultTime: TimeInterval = 1.05

    let app: XCUIApplication

    init(seed: UInt32? = nil, environment: [String: String] = [:], arguments: [String] = []) {
        app = XCUIApplication()
        if let seed { app.launchArguments += [Self.seedArgument, String(seed)] }
        app.launchArguments += arguments
        for (key, value) in environment { app.launchEnvironment[key] = value }
    }

    func launch() {
        app.launch()
        atHome()
    }

    func relaunch() {
        app.terminate()
        launch()
    }

    // MARK: Finding things

    /// Any element whose label is exactly `label`, whatever its type.
    func element(_ label: String) -> XCUIElement {
        app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", label)).firstMatch
    }

    func button(_ label: String) -> XCUIElement {
        app.buttons.matching(NSPredicate(format: "label == %@", label)).firstMatch
    }

    func button(startingWith prefix: String) -> XCUIElement {
        app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", prefix)).firstMatch
    }

    /// The lowest button with this label on screen: the sheet's "Leave round" rather than the X of the same name.
    func lowestButton(_ label: String) -> XCUIElement {
        let all = app.buttons.matching(NSPredicate(format: "label == %@", label)).allElementsBoundByIndex
        return all.max { $0.frame.minY < $1.frame.minY } ?? button(label)
    }

    func wait(for element: XCUIElement, _ what: String, timeout: TimeInterval = 10,
              file: StaticString = #filePath, line: UInt = #line) {
        XCTAssertTrue(element.waitForExistence(timeout: timeout), "Waited for \(what)", file: file, line: line)
    }

    func waitGone(_ element: XCUIElement, _ what: String, timeout: TimeInterval = 10,
                  file: StaticString = #filePath, line: UInt = #line) {
        XCTAssertTrue(element.waitForNonExistence(timeout: timeout), "Waited for \(what) to go", file: file, line: line)
    }

    func pause(_ seconds: TimeInterval) {
        Thread.sleep(forTimeInterval: seconds)
    }

    // MARK: Start flow

    /// The start step with this title is on screen and its settle time has passed.
    func atStep(_ title: String, file: StaticString = #filePath, line: UInt = #line) {
        wait(for: element(title), "the step \"\(title)\"", file: file, line: line)
        pause(Self.settleTime)
    }

    /// Step 1 with its areas, settled.
    func atHome(file: StaticString = #filePath, line: UInt = #line) {
        atStep("Choose an area", file: file, line: line)
        wait(for: button(startingWith: "Cloud, "), "the Cloud area", file: file, line: line)
    }

    /// Taps the card whose label starts with `prefix`.
    func choose(_ prefix: String, file: StaticString = #filePath, line: UInt = #line) {
        let card = button(startingWith: prefix)
        wait(for: card, "a card labelled \"\(prefix)...\"", file: file, line: line)
        card.tap()
    }

    /// From step 1 to "Your pass is ready", letting each step settle.
    func chooseRoute(_ pick: RoutePick, file: StaticString = #filePath, line: UInt = #line) {
        choose(pick.area, file: file, line: line)
        atStep("Choose a platform", file: file, line: line)
        choose(pick.platform, file: file, line: line)
        atStep("Choose a deck", file: file, line: line)
        choose(pick.deck, file: file, line: line)
        if let section = pick.section {
            atStep("Choose a section", file: file, line: line)
            choose(section, file: file, line: line)
        }
        atStep("Choose how to play", file: file, line: line)
        choose(pick.mode, file: file, line: line)
        atStep("Your pass is ready", file: file, line: line)
    }

    /// "Start round", then the round's X.
    func startRound(file: StaticString = #filePath, line: UInt = #line) {
        button("Start round").tap()
        wait(for: button("Leave round"), "the round's X", file: file, line: line)
    }

    /// A pan from the leading screen edge to `to` (a fraction of the width), at `velocity` points per second,
    /// holding the finger still for `hold` seconds before it lifts.
    func edgePan(to: CGFloat = 0.85, velocity: XCUIGestureVelocity = .fast, hold: TimeInterval = 0) {
        let start = app.coordinate(withNormalizedOffset: CGVector(dx: 0, dy: 0.5)).withOffset(CGVector(dx: 2, dy: 0))
        let end = app.coordinate(withNormalizedOffset: CGVector(dx: to, dy: 0.5))
        start.press(forDuration: 0.05, thenDragTo: end, withVelocity: velocity, thenHoldForDuration: hold)
    }

    // MARK: Round

    /// Waits until a card can be answered: True is there and Next card and See results are not, then the settle
    /// time. In every class.
    func waitForQuestion(file: StaticString = #filePath, line: UInt = #line) {
        wait(for: button("True"), "the True button", file: file, line: line)
        XCTAssertTrue(button("Next card").waitForNonExistence(timeout: 5), "Next card is gone", file: file, line: line)
        XCTAssertTrue(button("See results").waitForNonExistence(timeout: 5), "See results is gone", file: file, line: line)
        pause(Self.settleTime)
    }

    /// The statement on screen that is in `facts` and is not `previous`, with its facts, once the card has settled.
    func statement(in facts: [String: CardFacts], after previous: String? = nil,
                   file: StaticString = #filePath, line: UInt = #line) -> (statement: String, facts: CardFacts) {
        waitForQuestion(file: file, line: line)
        let query = app.descendants(matching: .any).matching(NSPredicate(format: "label IN %@", Array(facts.keys)))
        let deadline = Date().addingTimeInterval(10)
        while Date() < deadline {
            let labels = query.allElementsBoundByIndex.map(\.label).filter { $0 != previous }
            if let label = labels.first, let card = facts[label] { return (label, card) }
            pause(0.1)
        }
        XCTFail("No statement of the deck on screen", file: file, line: line)
        return ("", CardFacts(id: "", answer: true, explanation: "", sourceTitle: ""))
    }

    func answer(_ value: Bool) {
        button(value ? "True" : "False").tap()
    }

    /// Waits for the pill, then for its arrival guard, and taps it.
    func tapWhenReady(_ label: String, guardTime: TimeInterval = Self.arrivalTime, timeout: TimeInterval = 10,
                      file: StaticString = #filePath, line: UInt = #line) {
        let pill = button(label)
        wait(for: pill, "\"\(label)\"", timeout: timeout, file: file, line: line)
        pause(guardTime)
        pill.tap()
    }

    /// Answers `count` cards of a round, card `n` with `choose(n, truth)`, going on with Next card and, after the
    /// last, See results.
    func play(_ count: Int, facts: [String: CardFacts], choose: (Int, Bool) -> Bool,
              file: StaticString = #filePath, line: UInt = #line) -> [Played] {
        var played: [Played] = []
        var previous: String?
        for number in 1...count {
            let (statement, card) = self.statement(in: facts, after: previous, file: file, line: line)
            let given = choose(number, card.answer)
            answer(given)
            tapWhenReady(number == count ? "See results" : "Next card", file: file, line: line)
            played.append(Played(number: number, statement: statement, truth: card.answer, given: given))
            previous = statement
        }
        return played
    }

    /// Answers the card on screen with True, whatever it says, and waits for the action after the answer.
    func answerAnyCard(file: StaticString = #filePath, line: UInt = #line) {
        waitForQuestion(file: file, line: line)
        answer(true)
        let next = app.buttons.matching(NSPredicate(format: "label IN %@", ["Next card", "See results"])).firstMatch
        wait(for: next, "Next card or See results", file: file, line: line)
    }

    /// The X, then "Leave round?".
    func openLeaveSheet(file: StaticString = #filePath, line: UInt = #line) {
        button("Leave round").tap()
        wait(for: element("Leave round?"), "the leave sheet", file: file, line: line)
    }

    /// From a round with answers back to step 1 through the sheet's "Leave round".
    func leaveThroughTheSheet(file: StaticString = #filePath, line: UInt = #line) {
        openLeaveSheet(file: file, line: line)
        lowestButton("Leave round").tap()
        atHome(file: file, line: line)
    }

    /// The result screen with its heading.
    func atResult(file: StaticString = #filePath, line: UInt = #line) {
        wait(for: element("Round complete"), "the result", file: file, line: line)
    }
}
