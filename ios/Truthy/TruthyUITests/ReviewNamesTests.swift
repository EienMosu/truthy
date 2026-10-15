import XCTest

/// Every view the visual review measures reports its frame under its `ReviewName` (spec 7.4, criterion 2: the
/// logo, the pass, the ticket, the stub, the pills and the sheet card; the card for N4).
final class ReviewNamesTests: XCTestCase {
    override func setUp() {
        continueAfterFailure = false
    }

    @MainActor
    func testEveryMeasuredViewReportsItsFrame() throws {
        let frames = NSTemporaryDirectory() + "truthy-frames-\(UUID().uuidString).json"
        let player = Player(environment: ["TRUTHY_REVIEW_FRAMES": frames])
        let names = { () -> Set<String> in
            player.pause(1)
            guard let data = FileManager.default.contents(atPath: frames),
                  let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            else { return [] }
            return Set(object.keys)
        }

        player.launch()
        XCTAssertTrue(names().contains("logo"), "step 1: logo")
        player.choose("Cloud, ")
        player.atStep("Choose a platform")
        XCTAssertTrue(names().contains("pass"), "step 2: pass")
        player.choose("AWS, ")
        player.atStep("Choose a deck")
        player.choose("CLF, ")
        player.atStep("Choose a section")
        player.choose("SEC, ")
        player.atStep("Choose how to play")
        player.choose("Classic. ")
        player.atStep("Your pass is ready")
        XCTAssertTrue(names().isSuperset(of: ["pass", "pill:Start round"]), "step 6: pass and Start round")

        player.startRound()
        player.waitForQuestion()
        XCTAssertTrue(names().isSuperset(of: ["ticket", "card", "stub", "pill:True", "pill:False"]), "question")
        player.answer(true)
        player.wait(for: player.button("Next card"), "Next card")
        XCTAssertTrue(names().isSuperset(of: ["ticket", "pill:Next card"]), "answered")
        player.openLeaveSheet()
        XCTAssertTrue(names().isSuperset(of: ["sheet", "pill:Keep playing"]), "leave sheet")
    }
}
