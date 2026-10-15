import XCTest

/// The native half of the visual review (spec 7.4). These tests run only from `ios/Tools/visual-review/review.mjs`
/// and `record.mjs`, which pass their settings through `TEST_RUNNER_` environment variables; in a plain
/// `xcodebuild test` they skip.
///
/// - `TRUTHY_REVIEW_OUT`: the folder to write into (a host path).
/// - `TRUTHY_REVIEW_SEED`: the round seed, the same one the web capture uses.
/// - `TRUTHY_REVIEW_TEXT`: `largest` for the largest accessibility text size (N9).
/// - `TRUTHY_REVIEW_FLIP`: `light` or `dark`, the theme to store against the opposite system appearance (N12).
final class VisualCaptureTests: XCTestCase {
    override func setUp() {
        continueAfterFailure = false
    }

    /// The ten screens of the review in one theme: start steps 1 to 6, the question, the answered card, the leave
    /// sheet and the result of a Classic round on CLF / SEC answered True on every card.
    @MainActor
    func testCaptureEveryScreen() throws {
        let settings = try ReviewSettings.read()
        guard settings.flip == nil else { throw XCTSkip("This run captures the stored theme only") }
        let player = settings.player()
        let capture = try settings.capture()

        player.launch()
        try capture("s1")
        player.choose("Cloud, ")
        player.atStep("Choose a platform")
        try capture("s2")
        player.choose("AWS, ")
        player.atStep("Choose a deck")
        try capture("s3")
        player.choose("CLF, ")
        player.atStep("Choose a section")
        try capture("s4")
        player.choose("SEC, ")
        player.atStep("Choose how to play")
        try capture("s5")
        player.choose("Classic. ")
        player.atStep("Your pass is ready")
        try capture("s6")

        player.startRound()
        player.waitForQuestion()
        try capture("p2")
        player.answer(true)
        player.wait(for: player.button("Next card"), "Next card")
        try capture("p3")
        player.openLeaveSheet()
        try capture("p4")
        player.lowestButton("Keep playing").tap()
        player.waitGone(player.element("Leave round?"), "the sheet")
        player.tapWhenReady("Next card")
        for number in 2...10 {
            player.waitForQuestion()
            player.answer(true)
            player.tapWhenReady(number == 10 ? "See results" : "Next card")
        }
        player.atResult()
        try capture("r1")
    }

    /// Criterion 2 for the screens one Classic round does not reach: the Streak, Three lives and Timed headers and
    /// results, a missed card with Why open, Timed at time up, step 1 with the Recent card and the Continue line, and
    /// the Recent deck list. `review.mjs` runs it right after `testCaptureEveryScreen` on the same install, and
    /// `web.mjs` plays the same sequence after its Classic round, so both sides carry the same progress. Every
    /// answer is True, as in the Classic round, so the same seed deals and decides the same cards on both sides.
    @MainActor
    func testCaptureTheOtherClassesAndStartStates() throws {
        let settings = try ReviewSettings.read()
        guard settings.flip == nil else { throw XCTSkip("This run captures the stored theme only") }
        let player = settings.player()
        let capture = try settings.capture()

        player.launch()
        for (mode, name) in [("Streak. ", "streak"), ("Three lives. ", "lives")] {
            player.chooseRoute(RoutePick.clfSecurity.inClass(mode))
            player.startRound()
            player.waitForQuestion()
            try capture("\(name)-p2")
            while true {
                player.waitForQuestion()
                player.answer(true)
                if player.button("See results").waitForExistence(timeout: 1.5) { break }
                player.tapWhenReady("Next card")
            }
            player.tapWhenReady("See results")
            player.atResult()
            try capture("\(name)-r1")
            if name == "lives" {
                // Three wrong answers end the round, so a missed card is always there.
                player.button(startingWith: "Why, card").tap()
                try capture("lives-r1-why")
            }
            player.tapWhenReady("Close results", guardTime: Player.resultTime)
            player.atHome()
        }

        player.chooseRoute(RoutePick.clfSecurity.inClass("Timed. "))
        player.startRound()
        player.waitForQuestion()
        try capture("timed-p2")
        player.answer(true)
        player.wait(for: player.button("See results"), "the end of the Timed minute", timeout: 75)
        try capture("timed-up")
        player.tapWhenReady("See results")
        player.atResult()
        try capture("timed-r1")
        player.tapWhenReady("Close results", guardTime: Player.resultTime)
        player.atHome()

        // A second deck played and left with one answer: step 1 then shows Recent (two decks) and Continue.
        player.chooseRoute(.cdlWhole)
        player.startRound()
        player.answerAnyCard()
        player.leaveThroughTheSheet()
        try capture("s1-returning")
        player.choose("Recent, ")
        player.atStep("Choose a deck")
        try capture("s3-recent")
    }

    /// N12: the app's stored theme against the opposite system appearance, from a fresh launch.
    @MainActor
    func testCaptureTheStoredThemeAgainstTheSystem() throws {
        let settings = try ReviewSettings.read()
        guard let flip = settings.flip else { throw XCTSkip("Runs only with TRUTHY_REVIEW_FLIP") }
        let player = settings.player()
        let capture = try settings.capture()
        let showing = player.button(flip == "dark" ? "Switch to light theme" : "Switch to dark theme")
        let other = player.button(flip == "dark" ? "Switch to dark theme" : "Switch to light theme")

        player.launch()
        if !showing.exists {
            other.tap()
            player.wait(for: showing, "the \(flip) theme")
        }
        player.relaunch()
        player.wait(for: showing, "the stored \(flip) theme after a relaunch")
        try capture("flip-\(flip)")
    }

    /// N10, between screens: start flow, round, back to step 1, recorded by `record.mjs between`.
    @MainActor
    func testSwapScreensForTheRecording() throws {
        let settings = try ReviewSettings.read()
        guard settings.flip == nil else { throw XCTSkip("This run captures the stored theme only") }
        let player = settings.player()
        player.launch()
        player.chooseRoute(.clfSecurity)
        player.startRound()
        player.waitForQuestion()
        player.button("Leave round").tap()
        player.atHome()
        player.pause(1)
    }
}

/// The review's settings, read from the environment the review scripts set.
@MainActor
struct ReviewSettings {
    let directory: URL
    let seed: UInt32
    let largest: Bool
    let flip: String?

    static func read() throws -> ReviewSettings {
        let environment = ProcessInfo.processInfo.environment
        guard let out = environment["TRUTHY_REVIEW_OUT"], !out.isEmpty else {
            throw XCTSkip("Runs only from ios/Tools/visual-review")
        }
        let flip = environment["TRUTHY_REVIEW_FLIP"].flatMap { ["light", "dark"].contains($0) ? $0 : nil }
        return ReviewSettings(
            directory: URL(fileURLWithPath: out),
            seed: UInt32(environment["TRUTHY_REVIEW_SEED"] ?? "") ?? REVIEW_SEED,
            largest: environment["TRUTHY_REVIEW_TEXT"] == "largest",
            flip: flip
        )
    }

    var liveFrames: URL { directory.appending(path: "live-frames.json") }

    func player() -> Player {
        let text = largest ? ["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"] : []
        return Player(seed: seed, environment: ["TRUTHY_REVIEW_FRAMES": liveFrames.path], arguments: text)
    }

    func capture() throws -> Capture {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return Capture(directory: directory, liveFrames: liveFrames)
    }
}

/// Writes `<name>.png` (the screen), `<name>.frames.json` (the recorder's frames) and `<name>.meta.json` (the
/// screen size in points and its scale) once the motion has ended.
@MainActor
struct Capture {
    let directory: URL
    let liveFrames: URL

    func callAsFunction(_ name: String) throws {
        // The longest motion of a screen ends within a second, and the recorder writes four times a second.
        Thread.sleep(forTimeInterval: 1.5)
        let shot = XCUIScreen.main.screenshot()
        try shot.pngRepresentation.write(to: directory.appending(path: "\(name).png"))
        let frames = (try? Data(contentsOf: liveFrames)) ?? Data("{}".utf8)
        try frames.write(to: directory.appending(path: "\(name).frames.json"))
        let meta: [String: Double] = [
            "width": Double(shot.image.size.width),
            "height": Double(shot.image.size.height),
            "scale": Double(shot.image.scale),
        ]
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        try encoder.encode(meta).write(to: directory.appending(path: "\(name).meta.json"))
    }
}
