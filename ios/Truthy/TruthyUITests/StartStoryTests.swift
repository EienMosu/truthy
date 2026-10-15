import Vision
import XCTest

/// Spec 7.3, the start flow stories: a Classic round from step 1 to the result, the Recent path, Continue, going
/// back a step with the gesture, the theme switch. Each story makes the progress it needs, so the order of the
/// tests does not matter.
final class StartStoryTests: XCTestCase {
    override func setUp() {
        continueAfterFailure = false
    }

    @MainActor
    func testAClassicRoundFromStepOneToTheResult() throws {
        let facts = try DeckFacts.load(DeckFacts.clf)
        let player = Player()
        player.launch()
        player.chooseRoute(.clfSecurity)
        player.startRound()

        let played = player.play(10, facts: facts) { number, truth in [3, 6, 9].contains(number) ? !truth : truth }

        player.atResult()
        player.wait(for: player.element("Round complete. 10 of 10 cards. 7 correct, 3 wrong: cards 3, 6 and 9."),
                    "the completed route's label")
        XCTAssertTrue(player.element("3 to review").exists)
        for card in played where card.given != card.truth {
            XCTAssertTrue(player.button(String(format: "Why, card %02d", card.number)).exists, "Why for card \(card.number)")
        }
        XCTAssertTrue(player.button("Play again").exists)
        XCTAssertTrue(player.button("Choose another route").exists)

        player.tapWhenReady("Close results", guardTime: Player.resultTime)
        player.atHome()
        player.wait(for: player.button("Continue: AWS Cloud Practitioner, Security and compliance, Classic. Last score 7 of 10."),
                    "the continue line with the score")
    }

    @MainActor
    func testContinueOpensTheReadyPassOfTheLastRound() {
        let player = Player()
        player.launch()
        player.chooseRoute(.clfSecurity)
        player.startRound()
        player.answerAnyCard()
        player.leaveThroughTheSheet()

        // A round left with answers is the last round, with no score (reference 6, save rule 4).
        let line = player.button("Continue: AWS Cloud Practitioner, Security and compliance, Classic.")
        player.wait(for: line, "the continue line without a score")
        player.relaunch()
        player.wait(for: line, "the continue line after a relaunch")

        player.pause(Player.settleTime)
        line.tap()
        player.atStep("Your pass is ready")
        player.button("Back to classes").tap()
        player.atStep("Choose how to play")
        player.button("Back to sections").tap()
        player.atStep("Choose a section")
    }

    /// README deviation 5 and Review Focus 3: at the largest accessibility size a returning player's continue line
    /// shows the whole deck name, wrapped, where the web ends it in an ellipsis. The line is one accessibility element
    /// whose label holds the whole name either way, so the test reads what is drawn: text recognition on the line.
    @MainActor
    func testTheContinueLineShowsTheWholeDeckNameAtTheLargestTextSize() throws {
        let player = Player()
        player.launch()
        player.chooseRoute(.cdlWhole)
        player.startRound()
        player.answerAnyCard()
        player.leaveThroughTheSheet()

        player.app.terminate()
        player.app.launchArguments += ["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"]
        player.app.launch()
        let line = player.button(startingWith: "Continue: Google Cloud Digital Leader, ")
        player.wait(for: line, "the continue line at the largest text size")
        // At the accessibility sizes the whole start column scrolls and the line follows the list (task 12 rule 9).
        let window = player.app.windows.firstMatch
        for _ in 0..<8 where !window.frame.contains(line.frame) { player.app.swipeUp() }
        player.pause(1)
        XCTAssertTrue(window.frame.contains(line.frame), "the continue line shows whole")

        let image = try XCTUnwrap(line.screenshot().image.cgImage)
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = false
        try VNImageRequestHandler(cgImage: image).perform([request])
        let drawn = (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }.joined(separator: " ")
        for word in ["Google", "Cloud", "Digital", "Leader"] {
            XCTAssertTrue(drawn.contains(word), "\"\(word)\" is drawn; the line reads \"\(drawn)\"")
        }
        XCTAssertFalse(drawn.contains("…") || drawn.contains("..."), "no ellipsis; the line reads \"\(drawn)\"")
    }

    @MainActor
    func testTheRecentPathListsTheDecksPlayedLast() {
        let player = Player()
        player.launch()
        player.chooseRoute(.clfSecurity)
        player.startRound()
        player.answerAnyCard()
        player.leaveThroughTheSheet()
        player.chooseRoute(.cdlWhole)
        player.startRound()
        player.answerAnyCard()
        player.leaveThroughTheSheet()

        let recent = player.button(startingWith: "Recent, ")
        player.wait(for: recent, "the Recent card")
        recent.tap()
        player.atStep("Choose a deck")
        let cdl = player.button(startingWith: "CDL, ")
        let clf = player.button(startingWith: "CLF, ")
        player.wait(for: cdl, "CDL on the Recent list")
        player.wait(for: clf, "CLF on the Recent list")
        XCTAssertLessThan(cdl.frame.minY, clf.frame.minY, "the deck played last comes first")

        clf.tap()
        player.atStep("Choose a section")
        let deckField = player.button("Change deck, now CLF")
        player.wait(for: deckField, "the pass's deck field")
        deckField.tap()
        player.atStep("Choose a deck")
        player.wait(for: player.button(startingWith: "CDL, "), "the Recent list again")
    }

    @MainActor
    func testTheEdgeSwipeGoesBackOneStepAndACancelledSwipeChangesNothing() {
        let player = Player()
        player.launch()
        player.choose("Cloud, ")
        player.atStep("Choose a platform")
        player.choose("AWS, ")
        player.atStep("Choose a deck")

        // A short, slow pan released at rest stays under p = 0.5: it springs back.
        player.edgePan(to: 0.25, velocity: XCUIGestureVelocity(60), hold: 0.4)
        player.pause(1)
        XCTAssertTrue(player.element("Choose a deck").exists)
        XCTAssertTrue(player.button(startingWith: "CLF, ").isHittable)

        // A long, fast pan completes: exactly one step back, and the platform choice is cleared.
        player.edgePan(to: 0.85, velocity: .fast)
        player.atStep("Choose a platform")
        XCTAssertTrue(player.button(startingWith: "AWS, ").isHittable)
        XCTAssertFalse(player.element("Choose an area").exists)
    }

    @MainActor
    func testOnIOS26ARightwardPanAnywhereGoesBackOneStep() throws {
        guard #available(iOS 26, *) else { throw XCTSkip("The anywhere back pan is for iOS 26 and later (spec 5.1)") }
        let player = Player()
        player.launch()
        player.choose("Cloud, ")
        player.atStep("Choose a platform")
        let start = player.app.coordinate(withNormalizedOffset: CGVector(dx: 0.3, dy: 0.6))
        let end = player.app.coordinate(withNormalizedOffset: CGVector(dx: 0.95, dy: 0.6))
        start.press(forDuration: 0.05, thenDragTo: end, withVelocity: .fast, thenHoldForDuration: 0)
        player.atHome()
    }

    @MainActor
    func testTheThemeSwitchFlipsTheThemeAndKeepsItAfterARelaunch() {
        let player = Player()
        player.launch()
        let toDark = player.button("Switch to dark theme")
        let toLight = player.button("Switch to light theme")
        if toLight.exists {
            toLight.tap()
            player.wait(for: toDark, "the day theme")
        }
        toDark.tap()
        player.wait(for: toLight, "the switch offering the light theme")

        player.choose("Cloud, ")
        player.atStep("Choose a platform")
        XCTAssertTrue(toLight.exists, "the switch is on every start step")

        player.relaunch()
        player.wait(for: toLight, "the night theme after a relaunch")
        toLight.tap()
        player.wait(for: toDark, "the day theme again")
    }
}
