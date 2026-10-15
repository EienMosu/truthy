import XCTest

/// The UI tests' own helpers, checked without launching the app.
final class SupportTests: XCTestCase {
    func testPlainTextDropsTheBackticksOfEachPair() {
        XCTAssertEqual(
            plainText("Before narrowing, `x.indexOf(\"a\")` is accepted on `x: string | string[]`."),
            "Before narrowing, x.indexOf(\"a\") is accepted on x: string | string[]."
        )
        XCTAssertEqual(plainText("`a``b`"), "ab")
    }

    func testPlainTextKeepsABacktickWithoutAPartnerAndAnEmptyPair() {
        XCTAssertEqual(plainText("one ` two"), "one ` two")
        XCTAssertEqual(plainText("a `` b"), "a `` b")
        XCTAssertEqual(plainText("AWS patches the host."), "AWS patches the host.")
    }

    func testDeckFactsReadTheEmbeddedDeck() throws {
        let facts = try DeckFacts.load(DeckFacts.clf)
        XCTAssertEqual(facts.count, 214)
        let first = try XCTUnwrap(facts["Cloud agility helps teams turn new business ideas into working applications quickly."])
        XCTAssertEqual(first.id, "aws-clf-c02-t1.1-01")
        XCTAssertTrue(first.answer)
        XCTAssertFalse(first.sourceTitle.isEmpty)
        XCTAssertEqual(try DeckFacts.load(DeckFacts.cdl).count, 133)
    }

    func testFollowErrorsCompareTheCardCentreWithTheFingerAfterTheSlop() throws {
        // An earlier tap (the route choice) comes first and has no card: the drag is the last run of touches.
        var trace = [TracePoint(t: -1, touch: [100, 300], card: nil), TracePoint(t: 0, touch: nil, card: [16, 200, 398, 300])]
        // The finger comes down at x 200 and moves 2 points a frame. A display-link sample reads the newest touch but
        // the card as last drawn, for the touch before it; the card waits for 10 points of slop, then follows that
        // finger 0.5 points behind.
        for frame in 0...60 {
            let finger = 200 + 2 * Double(frame)
            let drawnFor = 200 + 2 * Double(max(frame - 1, 0))
            let offset = drawnFor - 200 < 10 ? 0 : drawnFor - 200 - 0.5
            trace.append(TracePoint(t: Double(frame + 1) / 60, touch: [finger, 500], card: [16 + offset, 200, 398, 300]))
        }
        trace.append(TracePoint(t: 2, touch: nil, card: [16, 200, 398, 300]))
        let errors = try XCTUnwrap(FollowCheck.errors(trace))
        XCTAssertEqual(errors.count, 10)
        for error in errors { XCTAssertEqual(error, 0.5, accuracy: 0.0001) }
    }

    func testFollowErrorsNeedEnoughFramesBeyondTheSlop() {
        let short = [
            TracePoint(t: 0, touch: nil, card: [16, 200, 398, 300]),
            TracePoint(t: 1, touch: [200, 500], card: [16, 200, 398, 300]),
            TracePoint(t: 2, touch: [230, 500], card: [46, 200, 398, 300]),
        ]
        XCTAssertNil(FollowCheck.errors(short))
        XCTAssertNil(FollowCheck.errors([]))
    }
}
