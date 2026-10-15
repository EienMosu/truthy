import XCTest

/// Feel checklist items with a UI test as their method (spec 5.8): N1 (the pass morphs with a back that changes its
/// stage), N4 (the card follows the finger), N8 (no menu or selection on a long press) and N13 (back on the round
/// and on the result).
final class FeelTests: XCTestCase {
    override func setUp() {
        continueAfterFailure = false
    }

    /// N4: the card offset equals the finger travel within 1 point at 10 sampled frames.
    @MainActor
    func testTheCardFollowsTheFingerWithinOnePoint() throws {
        let facts = try DeckFacts.load(DeckFacts.clf)
        let trace = NSTemporaryDirectory() + "truthy-trace-\(UUID().uuidString).jsonl"
        let player = Player(environment: ["TRUTHY_REVIEW_TRACE": trace])
        player.launch()
        player.chooseRoute(.clfSecurity)
        player.startRound()
        let (statement, _) = player.statement(in: facts)

        // 80 points at 40 points a second, held still before the finger lifts: under the 90 commit line and with no
        // fling, so the card springs back and nothing is answered.
        let start = player.element(statement).coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
        start.press(forDuration: 0.2, thenDragTo: start.withOffset(CGVector(dx: 80, dy: 0)),
                    withVelocity: XCUIGestureVelocity(40), thenHoldForDuration: 0.5)
        player.pause(1.5)

        let errors = try XCTUnwrap(FollowCheck.errors(try FollowCheck.read(trace)), "the trace has 10 frames of the drag")
        XCTAssertEqual(errors.count, 10)
        for (i, error) in errors.enumerated() {
            XCTAssertLessThanOrEqual(error, 1, "frame \(i + 1) of 10: the card is \(error) points off the finger")
        }
        XCTAssertFalse(player.button("Next card").exists, "the drag answered nothing")
    }

    /// N1 and README "Cross-platform agreements" (the pass stage morph): a back from the section step to the deck step
    /// changes the pass from the route stage (the pass line over the fields) to the destination stage; its height
    /// follows the finger and the spring, and never jumps (two stacked stages would hold the taller height, then drop).
    @MainActor
    func testABackBetweenStagesKeepsThePassHeightContinuous() throws {
        let trace = NSTemporaryDirectory() + "truthy-trace-\(UUID().uuidString).jsonl"
        let player = Player(environment: ["TRUTHY_REVIEW_TRACE": trace],
                            arguments: ["-route", "aws-clf-c02/SEC", "-screen", "start", "-step", "4"])
        player.app.launch()
        player.atStep("Choose a section")
        player.pause(0.5)
        // A slow pan to 70 percent, held, then released: it completes (past one half) with the spring.
        player.edgePan(to: 0.7, velocity: XCUIGestureVelocity(200), hold: 0.5)
        player.atStep("Choose a deck")
        player.pause(1)

        let heights = try FollowCheck.read(trace).sorted { $0.t < $1.t }.compactMap { $0.pass?[3] }
        let route = try XCTUnwrap(heights.first, "the trace has the pass")
        let destination = try XCTUnwrap(heights.last)
        XCTAssertGreaterThan(route - destination, 20, "the route stage is taller than the destination stage")
        let steps = zip(heights, heights.dropFirst()).map { abs($1 - $0) }
        XCTAssertLessThan(steps.max() ?? 0, (route - destination) / 3, "no frame jumps by a third of the change")
        XCTAssertTrue(heights.contains { $0 < route - 2 && $0 > destination + 2 }, "the height passes through the values between")
    }

    /// N3 and N5, recorded by `record.mjs test`: a vertical drag on the ticket, a short horizontal drag released
    /// with speed (it springs back with that speed and answers nothing), a steep diagonal drag (it scrolls and
    /// answers nothing), then a long horizontal drag that answers.
    @MainActor
    func testDragDirectionsForTheRecording() throws {
        let facts = try DeckFacts.load(DeckFacts.clf)
        let player = Player()
        player.launch()
        player.chooseRoute(.clfSecurity)
        player.startRound()
        let (statement, _) = player.statement(in: facts)
        let centre = player.element(statement).coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
        let pause = { player.pause(1) }

        centre.press(forDuration: 0.05, thenDragTo: centre.withOffset(CGVector(dx: 0, dy: -160)),
                     withVelocity: .default, thenHoldForDuration: 0)
        pause()
        XCTAssertFalse(player.button("Next card").exists, "a vertical drag answers nothing")

        centre.press(forDuration: 0.05, thenDragTo: centre.withOffset(CGVector(dx: 60, dy: 0)),
                     withVelocity: XCUIGestureVelocity(300), thenHoldForDuration: 0)
        pause()
        XCTAssertFalse(player.button("Next card").exists, "60 points under fling speed answer nothing")

        centre.press(forDuration: 0.05, thenDragTo: centre.withOffset(CGVector(dx: 70, dy: -140)),
                     withVelocity: .default, thenHoldForDuration: 0)
        pause()
        XCTAssertFalse(player.button("Next card").exists, "a steep diagonal drag answers nothing")

        centre.press(forDuration: 0.05, thenDragTo: centre.withOffset(CGVector(dx: 200, dy: 0)),
                     withVelocity: .fast, thenHoldForDuration: 0)
        player.wait(for: player.button("Next card"), "the answer of a long horizontal drag")
    }

    /// N8: a long press shows no menu and selects nothing, on the statement and on the slip's explanation. The
    /// screenshot after a tap on True is kept for the focus ring check by eye.
    @MainActor
    func testALongPressShowsNoMenuAndSelectsNothing() throws {
        let facts = try DeckFacts.load(DeckFacts.clf)
        let player = Player()
        player.launch()
        player.chooseRoute(.clfSecurity)
        player.startRound()
        let (statement, card) = player.statement(in: facts)

        player.element(statement).press(forDuration: 1.2)
        player.pause(0.5)
        XCTAssertFalse(player.app.menuItems.firstMatch.exists, "no edit menu on the statement")
        XCTAssertFalse(player.button("Copy").exists)
        XCTAssertFalse(player.button("Next card").exists, "a long press answers nothing")

        player.answer(card.answer)
        player.wait(for: player.button("Next card"), "the slip")
        let shot = XCTAttachment(screenshot: player.app.screenshot())
        shot.name = "N8 after a tap on an answer"
        shot.lifetime = .keepAlways
        add(shot)

        let explanation = player.element(card.explanation)
        player.wait(for: explanation, "the explanation on the slip")
        explanation.press(forDuration: 1.2)
        player.pause(0.5)
        XCTAssertFalse(player.app.menuItems.firstMatch.exists, "no edit menu on the explanation")
        XCTAssertFalse(player.button("Copy").exists)
    }

    /// N13: back on the round does what the X does.
    @MainActor
    func testBackOnTheRoundActsLikeTheX() {
        let player = Player()
        player.launch()
        player.chooseRoute(.clfSecurity)
        player.startRound()
        player.waitForQuestion()
        player.edgePan()
        player.atHome()

        player.chooseRoute(.clfSecurity)
        player.startRound()
        player.answerAnyCard()
        player.edgePan()
        player.wait(for: player.element("Leave round?"), "the leave sheet after back with an answer")
        player.lowestButton("Keep playing").tap()
        player.waitGone(player.element("Leave round?"), "the sheet")
    }

    /// N13: back on the result does what Close results does once its 1000 ms have passed.
    @MainActor
    func testBackOnTheResultActsLikeCloseResults() throws {
        let facts = try DeckFacts.load(DeckFacts.clf)
        let player = Player()
        player.launch()
        player.chooseRoute(RoutePick.clfSecurity.inClass("Three lives. "))
        player.startRound()
        _ = player.play(3, facts: facts) { _, truth in !truth }
        player.atResult()
        player.pause(Player.resultTime)
        player.edgePan()
        player.atHome()
    }
}
