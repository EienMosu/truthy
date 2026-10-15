import Vision
import XCTest

/// Spec 5.6 and README Review Focus 3: at the largest accessibility text size the start flow's column scrolls as one
/// (rule 9), so step 1's tagline and every step's title are drawn whole, with no ellipsis and no line cut off. Their
/// labels hold the whole copy either way, so the test reads what is drawn: text recognition on each element.
final class StartFlowLargeTextTests: XCTestCase {
    override func setUp() {
        continueAfterFailure = false
    }

    private static let largest = ["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"]
    private static let tagline = "True or false cards that teach you IT, one swipe at a time."
    private static let titles: [(step: Int, title: String)] = [
        (1, "Choose an area"), (2, "Choose a platform"), (3, "Choose a deck"), (4, "Choose a section"),
        (5, "Choose how to play"), (6, "Your pass is ready"),
    ]

    /// The text drawn inside `element`, its lines joined by spaces.
    @MainActor
    private func drawnText(_ element: XCUIElement) throws -> String {
        let image = try XCTUnwrap(element.screenshot().image.cgImage)
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = false
        try VNImageRequestHandler(cgImage: image).perform([request])
        return (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }.joined(separator: " ")
    }

    @MainActor
    func testTheTaglineAndEveryStepTitleShowWholeAtTheLargestTextSize() throws {
        for (step, title) in Self.titles {
            let driver = AppDriver(["-route", "aws-clf-c02/SEC", "-mode", "classic", "-screen", "start", "-step", "\(step)"] + Self.largest)
            driver.launch()
            let heading = driver.element(title)
            driver.waitFor(heading, "step \(step)'s title")
            driver.pause(1)
            if step == 1 {
                let drawn = try drawnText(driver.element(Self.tagline))
                XCTAssertEqual(drawn, Self.tagline, "step 1's tagline is drawn whole, without an ellipsis")
            }
            let drawn = try drawnText(heading)
            XCTAssertEqual(drawn, title, "step \(step)'s title is drawn whole, without an ellipsis")
            driver.app.terminate()
        }
    }
}
