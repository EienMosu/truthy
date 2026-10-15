import XCTest

/// Spec 7.3, the round stories: leaving with and without answers, Timed running out, Three lives running out, a
/// Streak ending, a source link in the in-app browser, the hardware keyboard keys.
final class RoundStoryTests: XCTestCase {
    override func setUp() {
        continueAfterFailure = false
    }

    @MainActor
    func testLeavingWithoutAnswersGoesStraightBackToStepOne() {
        let player = Player()
        player.launch()
        player.chooseRoute(.clfSecurity)
        player.startRound()
        player.waitForQuestion()
        player.button("Leave round").tap()
        player.atHome()
        XCTAssertFalse(player.element("Leave round?").exists)
    }

    @MainActor
    func testLeavingWithAnswersAsksFirstAndKeepPlayingStays() {
        let player = Player()
        player.launch()
        player.chooseRoute(.clfSecurity)
        player.startRound()
        player.answerAnyCard()

        player.openLeaveSheet()
        player.wait(for: player.element("Your answers so far stay in your history. This round won't count toward your best."),
                    "the sheet's body before the round is decided")
        player.lowestButton("Keep playing").tap()
        player.waitGone(player.element("Leave round?"), "the sheet")
        XCTAssertTrue(player.button("Next card").exists, "the round is where it was")

        player.leaveThroughTheSheet()
        player.wait(for: player.button("Continue: AWS Cloud Practitioner, Security and compliance, Classic."),
                    "the left round as the last round")
    }

    @MainActor
    func testAStreakEndsAtTheFirstWrongAnswer() throws {
        let facts = try DeckFacts.load(DeckFacts.clf)
        let player = Player()
        player.launch()
        player.chooseRoute(RoutePick.clfSecurity.inClass("Streak. "))
        player.startRound()
        _ = player.play(3, facts: facts) { number, truth in number == 3 ? !truth : truth }
        player.atResult()
        player.wait(for: player.element("Streak over on card 3. 2 correct in a row. Card 3 was wrong."), "the Streak result")
    }

    @MainActor
    func testThreeLivesRunOutAtTheThirdWrongAnswer() throws {
        let facts = try DeckFacts.load(DeckFacts.clf)
        let player = Player()
        player.launch()
        player.chooseRoute(RoutePick.clfSecurity.inClass("Three lives. "))
        player.startRound()
        _ = player.play(3, facts: facts) { _, truth in !truth }
        player.atResult()
        player.wait(for: player.element("Out of lives after 3 cards. 0 correct, 3 wrong: cards 1, 2 and 3."),
                    "the Three lives result")
    }

    @MainActor
    func testTimedRunsOutAfterOneMinute() throws {
        let facts = try DeckFacts.load(DeckFacts.clf)
        let player = Player()
        player.launch()
        player.chooseRoute(RoutePick.clfSecurity.inClass("Timed. "))
        player.startRound()
        let (_, card) = player.statement(in: facts)
        player.answer(card.answer)
        // Nothing more is answered: the minute runs out and See results takes the place of the answers.
        player.tapWhenReady("See results", timeout: 75)
        player.atResult()
        player.wait(for: player.element("Time is up. 1 card answered in 60 seconds. 1 correct, 0 wrong."), "the Timed result")
    }

    @MainActor
    func testTheSourceLinkOpensInTheInAppBrowser() throws {
        let facts = try DeckFacts.load(DeckFacts.clf)
        let player = Player()
        player.launch()
        player.chooseRoute(.clfSecurity)
        player.startRound()
        let (_, card) = player.statement(in: facts)
        player.answer(card.answer)
        let link = player.button("\(card.sourceTitle) (opens in browser)")
        player.wait(for: link, "the source link")
        link.tap()

        let close = player.app.buttons.matching(NSPredicate(format: "label IN %@", ["Done", "Close"])).firstMatch
        player.wait(for: close, "the in-app browser's close button")
        XCTAssertEqual(player.app.state, .runningForeground, "the app stays in front")
        XCTAssertNotEqual(XCUIApplication(bundleIdentifier: "com.apple.mobilesafari").state, .runningForeground)
        // The browser's bar belongs to another process (the in-app browser's view service): on the iOS 18.4 simulator
        // close.tap() lands nowhere, twice in a row, and the browser stays open. A tap at the button's frame through
        // the app's own coordinates reaches it, the browser reports that it finished and closes itself, and the card
        // is back as it was (the app keeps no state for the browser).
        player.app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: close.frame.midX, dy: close.frame.midY)).tap()
        player.waitGone(close, "the in-app browser")
        player.wait(for: player.button("Next card"), "the slip again")
    }

    @MainActor
    func testTheArrowKeysAnswer() throws {
        let facts = try DeckFacts.load(DeckFacts.clf)
        let player = Player()
        player.launch()
        player.chooseRoute(.clfSecurity)
        player.startRound()

        let (first, _) = player.statement(in: facts)
        player.app.typeKey(.rightArrow, modifierFlags: [])
        player.wait(for: player.button("Next card"), "Next card after the right arrow")
        player.tapWhenReady("Next card")
        _ = player.statement(in: facts, after: first)
        player.app.typeKey(.leftArrow, modifierFlags: [])
        player.wait(for: player.button("Next card"), "Next card after the left arrow")
    }

    /// Return and Escape (skipped on the simulator, where XCUITest cannot deliver them; task 16, D16).
    @MainActor
    func testReturnAndEscape() throws {
        try AppDriver.skipEscapeAndReturnOnTheSimulator()
        let facts = try DeckFacts.load(DeckFacts.clf)
        let player = Player()
        player.launch()
        player.chooseRoute(.clfSecurity)
        player.startRound()

        let (first, _) = player.statement(in: facts)
        player.app.typeKey(.rightArrow, modifierFlags: [])
        player.wait(for: player.button("Next card"), "Next card after the right arrow")
        player.pause(Player.arrivalTime)
        player.app.typeKey(.return, modifierFlags: [])
        _ = player.statement(in: facts, after: first)
        player.app.typeKey(.leftArrow, modifierFlags: [])
        player.wait(for: player.button("Next card"), "Next card after the left arrow")

        player.app.typeKey(.escape, modifierFlags: [])
        player.wait(for: player.element("Leave round?"), "the sheet after Escape")
        player.app.typeKey(.escape, modifierFlags: [])
        player.waitGone(player.element("Leave round?"), "the sheet after a second Escape")
        player.leaveThroughTheSheet()

        player.choose("Cloud, ")
        player.atStep("Choose a platform")
        player.app.typeKey(.escape, modifierFlags: [])
        player.atHome()
        player.app.typeKey(.escape, modifierFlags: [])
        player.pause(1)
        XCTAssertTrue(player.element("Choose an area").exists, "Escape on step 1 does nothing")
        XCTAssertTrue(player.button(startingWith: "Cloud, ").isHittable)
    }
}
