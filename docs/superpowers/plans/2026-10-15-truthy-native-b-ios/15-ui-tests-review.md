### Task 15: XCUITest stories, the iOS feel checklist with recordings, the visual review script and its pairs

The tasks before this one built every screen and tested each piece on its own. This task checks the app as a whole the three ways the spec asks for. First, XCUITest plays the stories of spec 7.3 the way a person does, by the visible titles and accessibility labels of reference 4.5: a Classic round from step 1 to the result, the Recent path, Continue, leaving with and without answers, the back gesture, the theme switch, Timed, Three lives and Streak running out, a source link in the in-app browser, and the hardware keyboard keys. Second, it fills in the feel checklist of spec 5.8 for iOS, item by item with the method the spec names: UI tests for N4, N8, N11 and N13, screenshots for N9 and N12, recordings checked frame by frame for N10, and recordings for the owner to watch for N1, N3, N5 and N13. Third, it builds the visual review of spec 7.4: a Node script that captures the twenty review screens (one Classic round from step 1 to the result, then the Streak, Three lives and Timed headers and results, a missed card with Why open, Timed at time up, and step 1 and the deck step of a returning player) on a small and a large simulator, in day and night, at the default and the largest text size, captures the web at the same size in WebKit with the same round seed, compares the element frames of criterion 2 with the web's (2 points) and colours with the resolved tokens (3 per channel), checks the status bar against the system theme, and writes side-by-side pairs for an Opus reviewer and the owner.

To measure element frames the app needs a way to report them. A debug-only recorder (`ReviewFrames`) does that: the visual review names a view with `.reviewFrame(...)`, and while the app runs with the `TRUTHY_REVIEW_FRAMES` environment variable the recorder writes the window frames of every named view to that file four times a second. With `TRUTHY_REVIEW_TRACE` it also writes, once per display frame, the first finger's position and the frames of the card and the fill-in pass, which is what the N4 test and the pass morph test read. Without either variable, and in release builds, it does nothing. Accessibility frames could not do this job, because the stub is hidden from VoiceOver (reference 5.9) and the containers have no label.

This task owns two lines of the README's Review Focus. Line 2 (the stored theme is the opposite of the system appearance): `statusBarCheck` and the N12 captures check the screenshot, and the N10 launch recording checks that the launch screen alone follows the system and the first app frame is in the stored theme. Line 3 (the largest accessibility text size): the largest-text run captures every review screen of tasks 12 to 14 (start steps 1 to 6, question, answered, leave sheet, result) on both phones in both themes, for N9.

Builds on tasks 7 (the project, its `TruthyTests` and `TruthyUITests` synchronized folders, the `Truthy` scheme, `ios/.gitignore`), 9 to 14 (the whole app), 11 (`LaunchArguments` with a seed), and plan A (`native-data/decks` and `native-data/tokens/resolved.json`).

**Files:**
- Create (app, debug only): `ios/Truthy/Truthy/Debug/ReviewFrames.swift`
- Modify (one `.reviewFrame` line each, step 16): the step 1 logo of task 12, the fill-in pass of task 12, the boarding pass, the moving card and the stub of task 13, the 60 point pill of task 10, the leave sheet's card of task 14
- Test (unit): create `ios/Truthy/TruthyTests/ReviewFramesTests.swift`
- Test (UI): create `ios/Truthy/TruthyUITests/Support/DeckFacts.swift`, `ios/Truthy/TruthyUITests/Support/FollowCheck.swift`, `ios/Truthy/TruthyUITests/Support/Player.swift`, `ios/Truthy/TruthyUITests/SupportTests.swift`, `ios/Truthy/TruthyUITests/ReviewNamesTests.swift`, `ios/Truthy/TruthyUITests/StartStoryTests.swift`, `ios/Truthy/TruthyUITests/RoundStoryTests.swift`, `ios/Truthy/TruthyUITests/FeelTests.swift`, `ios/Truthy/TruthyUITests/VisualCaptureTests.swift`
- Create (visual review): `ios/Tools/visual-review/png.mjs`, `ios/Tools/visual-review/png.test.mjs`, `ios/Tools/visual-review/compare.mjs`, `ios/Tools/visual-review/compare.test.mjs`, `ios/Tools/visual-review/sim.mjs`, `ios/Tools/visual-review/web.mjs`, `ios/Tools/visual-review/review.mjs`, `ios/Tools/visual-review/record.mjs`, `ios/Tools/visual-review/frames.swift`, `ios/Tools/visual-review/approved.json`, `ios/Tools/visual-review/README.md`
- Create (records): `ios/docs/feel-checklist.md`, `ios/docs/visual-review.md`
- Modify: `ios/.gitignore` (the review output folder)

**Interfaces:**
- Consumes:
  - Task 7: the app module `Truthy` (for `@testable import Truthy`), the test targets `TruthyTests` and `TruthyUITests` as synchronized folders (a new file in the folder joins the target), the shared scheme `Truthy`, `ios/.gitignore`.
  - Task 11: `struct LaunchArguments { seed: UInt32? ... }` (DEBUG only), parsed from the launch arguments. The README fixes the spelling `-seed <uint32>`; step 1 checks it (`Player.seedArgument` is the one place to change).
  - Tasks 10 and 12 to 14: every visible title and accessibility label of reference 4.5, verbatim (README global constraint). The stories find everything by those strings; they use no accessibility identifiers.
  - Tasks 13 and 14: their UI tests for Review Focus lines 4 and 5 (N3, N7) and task 13's unit test of the haptic trigger count (N6). The checklist cites them; this task does not repeat them.
  - Plan A: `native-data/decks/aws-clf-c02.json`, `native-data/decks/gcp-cdl.json`, `native-data/tokens/resolved.json`.
- **Assumed from other tasks** (step 1 checks what it can, step 16 finds the views): task 11 parses the seed as `-seed <uint32>` (README); the statement on the card, the slip's explanation and the result's header label are each one accessibility element whose label is the whole text as it reads (`plainText` for card text); the logo, fill-in pass, boarding pass, moving card, stub, 60 point pill and leave sheet card are views that step 16 can find by the copy strings they draw; tasks 13 and 14 have UI tests for N3 and N7 and task 13 a unit test for N6; the simulator lets the app and the test runner read and write host paths (true of the iOS simulator, where both run as Mac processes).
- Produces:

```swift
// ios/Truthy/Truthy/Debug/ReviewFrames.swift (in every build)
enum ReviewName {
    static let logo: String    // "logo"
    static let pass: String    // "pass"
    static let ticket: String  // "ticket"
    static let card: String    // "card"
    static let stub: String    // "stub"
    static let sheet: String   // "sheet"
    static func pill(_ title: String) -> String   // "pill:" + title
}
extension View { func reviewFrame(_ name: String) -> some View }   // a no-op in release builds

// DEBUG only
struct TraceSample: Codable, Equatable { let t: Double; let touch: [Double]?; let card: [Double]?; var pass: [Double]? }
enum ReviewFrameFile {
    static func numbers(_ rect: CGRect) -> [Double]
    static func encode(_ frames: [String: CGRect]) -> Data
    static func traceLines(_ samples: [TraceSample]) -> Data
}
@MainActor final class ReviewFrames {
    static let shared: ReviewFrames
    init(environment: [String: String])
    var isRecording: Bool { get }
    func attach(_ view: UIView, name: String)
    func detach(_ view: UIView)
    func currentFrames() -> [String: CGRect]
}

// TruthyUITests
func plainText(_ text: String) -> String
struct CardFacts: Equatable { let id: String; let answer: Bool; let explanation: String; let sourceTitle: String }
enum DeckFacts { static let clf: String; static let cdl: String; static func load(_ deckId: String) throws -> [String: CardFacts] }
struct TracePoint: Decodable, Equatable { let t: Double; let touch: [Double]?; let card: [Double]?; var pass: [Double]? }
enum FollowCheck { static func read(_ path: String) throws -> [TracePoint]; static func errors(_ trace: [TracePoint], count: Int = 10, beyond: Double = 20) -> [Double]? }
struct RoutePick {
    var area: String, platform: String, deck: String, section: String?, mode: String
    static let clfSecurity: RoutePick   // Cloud, AWS, CLF, SEC, Classic
    static let cdlWhole: RoutePick      // Cloud, Google Cloud, CDL (no sections), Classic
    func inClass(_ mode: String) -> RoutePick
}
struct Played { let number: Int; let statement: String; let truth: Bool; let given: Bool }
@MainActor struct Player {
    static let seedArgument: String     // "-seed"
    static let settleTime: TimeInterval, arrivalTime: TimeInterval, resultTime: TimeInterval   // 0.3, 0.45, 1.05
    let app: XCUIApplication
    init(seed: UInt32? = nil, environment: [String: String] = [:], arguments: [String] = [])
    func launch(); func relaunch()
    func element(_ label: String) -> XCUIElement
    func button(_ label: String) -> XCUIElement
    func button(startingWith prefix: String) -> XCUIElement
    func lowestButton(_ label: String) -> XCUIElement
    func wait(for element: XCUIElement, _ what: String, timeout: TimeInterval = 10)
    func waitGone(_ element: XCUIElement, _ what: String, timeout: TimeInterval = 10)
    func pause(_ seconds: TimeInterval)
    func atStep(_ title: String); func atHome()
    func choose(_ prefix: String); func chooseRoute(_ pick: RoutePick); func startRound()
    func edgePan(to: CGFloat = 0.85, velocity: XCUIGestureVelocity = .fast, hold: TimeInterval = 0)
    func waitForQuestion()
    func statement(in facts: [String: CardFacts], after previous: String? = nil) -> (statement: String, facts: CardFacts)
    func answer(_ value: Bool)
    func tapWhenReady(_ label: String, guardTime: TimeInterval = Player.arrivalTime, timeout: TimeInterval = 10)
    func play(_ count: Int, facts: [String: CardFacts], choose: (Int, Bool) -> Bool) -> [Played]
    func answerAnyCard(); func openLeaveSheet(); func leaveThroughTheSheet(); func atResult()
}
@MainActor struct ReviewSettings { let directory: URL; let seed: UInt32; let largest: Bool; let flip: String?; static func read() throws -> ReviewSettings }
@MainActor struct Capture { func callAsFunction(_ name: String) throws }   // <name>.png, <name>.frames.json, <name>.meta.json
```

  Node (`ios/Tools/visual-review`): `png.mjs` exports `decodePng`, `encodePng`, `crc32`, `pixelAt`; `compare.mjs` exports `FRAME_TOLERANCE`, `SCREENSHOT_TOLERANCE`, `VIDEO_TOLERANCE`, `STATES`, `PILLS`, `SKY_PROBE_YS`, `tokenHex`, `tokenColor`, `skyHex`, `hexToRgb`, `rgbToHex`, `channelDistance`, `frameDiff`, `compareFrames`, `probesFor`, `checkColors`, `luminance`, `statusBarCheck`, `classifyFrames`, `sideBySide`; `sim.mjs` exports `DEVICES`, `ensureSimulator`, `setAppearance`, `uninstallApp`, `buildForTesting`, `runUITest`, `simctl`; `web.mjs` exports `captureWeb`. Task 16 checks the device column in its own checklist (`ios/Tools/device/DEVICE-CHECKLIST.md`) and starts from this task's checklist being done in the simulator.

**Rules:**

1. **Stories play like a person.** Every story finds controls by the strings of reference 4.5: step titles, card labels by their leading words ("Cloud, ", "AWS, ", "CLF, ", "SEC, ", "Classic. "), "Start round", "True", "False", "Next card", "See results", "Leave round", "Leave round?", "Keep playing", "Close results", "Back to classes", "Change deck, now CLF", "Switch to dark theme", "{source.title} (opens in browser)", "Why, card {nn}", and the header labels of the result ("Round complete. 10 of 10 cards. 7 correct, 3 wrong: cards 3, 6 and 9.", "Streak over on card 3. 2 correct in a row. Card 3 was wrong.", "Out of lives after 3 cards. 0 correct, 3 wrong: cards 1, 2 and 3.", "Time is up. 1 card answered in 60 seconds. 1 correct, 0 wrong."). The X and the sheet's quiet button are both "Leave round"; `lowestButton` takes the sheet's.
2. **Right and wrong on purpose.** A story knows a card's answer by its statement: `DeckFacts` reads the embedded deck file from `native-data/decks` (the simulator runs the test runner as a Mac process, so the repository is reachable from `#filePath`) and keys each card by `plainText(statement)`, which is how the statement reads to VoiceOver and so to XCUITest, as `deckAnswers` does in `e2e/helpers.ts`. Statements are unique within CLF (214) and CDL (133).
3. **Guards are waited out, not raced.** After a step or a card appears a story waits 300 ms (the 250 ms settle guard); before Next card and See results 450 ms (420); before a result action 1050 ms (1000). Rapid taps against the guards are task 13's and 14's tests.
4. **Order does not matter.** No story depends on another or on an empty install: each makes the progress it needs (a round left with an answer is enough for Continue and for a Recent deck), checks only what that progress decides (Recent lists the two decks played last first; the comparison text is not checked), and the theme story first brings the app to the day theme.
5. **The recorder is inert unless asked.** `ReviewFrames` exists only in debug builds, records only with `TRUTHY_REVIEW_FRAMES` or `TRUTHY_REVIEW_TRACE` set to a non-empty path, adds an invisible probe view behind each named view (no touches, no accessibility), and installs its touch watcher (which never recognizes, delays or cancels a touch) only for a trace. `reviewFrame` is a no-op in release builds.
6. **The names and their web twins** (`web.mjs` reads the same names; the frame is the whole element in window points on iOS and in CSS pixels on the web):

   | Name | iOS view (step 16) | Web element |
   |---|---|---|
   | `logo` | the logo with its wordmark on step 1 (the call site in the step 1 top zone, not the shared logo view, which the continue line also uses) | the `h1` "Truthy" |
   | `pass` | the fill-in pass of steps 2 to 6 | `[data-fill-in-pass]` |
   | `ticket` | the whole boarding pass on the round and the result: band, legs, fields, statement and the stub or slip below | `[data-boarding-pass]` |
   | `card` | the card the finger moves, inside its drag offset and rotation so the probe moves with it | `[data-swipe-card]` |
   | `stub` | the stub of the question phase | `[data-stub]` |
   | `sheet` | the leave sheet's paper card (not the system sheet around it) | the `dialog` |
   | `pill:<title>` | the 60 point pill, named by its visible title | the button of that name |

7. **Colour probes** (`probesFor`), the same points plan C probes (README, "Cross-platform agreements"), in points: the sky at x 4 and y 120, 300, 560 and 860 (those inside the screen), expected as the sky gradient at that height (the four sky colours mixed at `native.sky-stops` of `resolved.json`) and, on `p4`, with the theme's `scrim` laid over it; the ticket's band 4 points below its top at its horizontal centre (`accent`); the ticket's paper 6 points in from the left and 50 down, just under the 44 point band (`surface-raised`); the sheet card 10 points in from the left at half its height (`surface-raised`); a pill 14 points in from the left at half its height (`true`, `false` or `ink`). On `p4` only the sky column, the sheet and "Keep playing" are read. Each probe is read on both screenshots, so a web value outside the tolerance shows a wrong probe rather than a wrong app. Both platforms and the web deal with `REVIEW_SEED` 1234567 and play Classic on CLF / SEC with True on every card. The Timed stamp beat (reference P3t) is not captured: it lasts 700 ms and the feel recordings check it.
8. **Tolerances:** frames 2 points (criterion 2), screenshot colours 3 per channel, video colours 12 per channel (H.264 shifts colours; a recording of the launch colour `#c4e3f5` read back `#c3e1f3` during drafting).
9. **N12 and N10 in pixels.** `statusBarCheck` takes the top `statusBarPoints` (20 on the SE, 54 on the 15 Pro Max): the sky at 1 point down must be the app theme's `sky-1`, and the pixels more than 60 away from that sky (the glyphs of the fixed 9:41 status bar, at least 30 of them) must be darker than the sky by day and lighter at night, by 0.2 in relative luminance. `classifyFrames` reads the pixel at (2, 2) points in every frame: frames before the first launch or app colour (home screen, icon zoom) and after the last app colour (the app closing at the end of a test) are left out; in between, the launch colour or a straight blend from it to the app colour until the app colour first shows, and only the app colour after that.
10. **Approvals belong to the owner.** A difference outside a tolerance is either a defect (fixed in the task whose code it is, with a test, as a `fix:` commit) or a difference the owner accepts in writing. Only then does its key go into `approved.json` and its row into `ios/docs/visual-review.md`, with the owner's reason and the date. Recordings, screenshots, pairs and reports stay in `ios/Tools/visual-review/out/`, which git ignores; nothing from it is committed.
11. **Verified while this plan was written:** `ReviewFrames.swift` typechecked against the iOS simulator SDK with `-swift-version 6 -target arm64-apple-ios18.0-simulator`, in debug and in release; `ReviewFramesTests.swift` typechecked against a module built from it with Swift Testing's macro plugin; all files of `TruthyUITests` in this task typechecked together against XCTest; `frames.swift` typechecked for macOS and run on a short simulator recording (106 frames read). The encoding part of `ReviewFrames.swift` and the UI test helpers (`plainText`, `DeckFacts`, `FollowCheck`) ran on macOS with this task's test values, against a draft of `native-data/decks`; `png.test.mjs` and `compare.test.mjs` ran green (14 tests) against a draft of `native-data/tokens/resolved.json`; `decodePng` read a real simulator screenshot; `review.mjs --skip-capture` ran on fabricated captures. Nothing of this task ran in a simulator app or as a UI test, `web.mjs` was not run (WebKit was not installed), and the simulator commands of `sim.mjs` and `record.mjs` were not run, apart from one `simctl io screenshot` and one `recordVideo` of an already booted simulator. The review fix pass added `testCaptureTheOtherClassesAndStartStates`, the matching sequence in `web.mjs`, ten `STATES` and their test, the second capture run in `review.mjs`, and the `see task 16` column: the Swift test typechecked with the other UI tests, the Node tests ran green (15) against `design/system/tokens.json` standing in for `resolved.json`, and `web.mjs` and `review.mjs` passed `node --check`; none of it ran against a simulator or the web.

**Steps:**

The test commands use the iOS 26.5 simulator of task 7, with these two destinations; every block that uses one defines it again, because a later shell does not keep a variable:

```bash
DEST26='platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5'
DEST18='platform=iOS Simulator,name=iPhone 16 Pro,OS=18.4'
```

Every `xcodebuild` command below is `xcodebuild test -project ios/Truthy/Truthy.xcodeproj -scheme Truthy -destination "$DEST26"` plus the options shown.

- [ ] **Step 1: Check what this task builds on.**

```bash
grep -rn '"-seed"' ios/Truthy/Truthy
for s in "Switch to dark theme" "Leave round?" "Keep playing" "(opens in browser)" "Why, card" "Change " "Back to " "swipe to board" "YOUR PASS" "BOARDING PASS" "Close results" "Choose another route" "Start round"; do printf '%s: %s\n' "$s" "$(grep -rlF -- "$s" ios/Truthy/Truthy | wc -l | tr -d ' ')"; done
ls ios/Truthy/TruthyUITests
test -f native-data/tokens/resolved.json && test -f native-data/decks/aws-clf-c02.json && test -f native-data/decks/gcp-cdl.json && test -f ios/.gitignore && echo inputs-present
```

Expected: the `grep` prints at least one line, in the file of task 11 that declares `struct LaunchArguments`; every string has a count of 1 or more; the folder lists task 7's `LaunchTests.swift` and the UI tests of tasks 13 and 14; the last line is `inputs-present`. If the seed argument has another spelling, use that spelling for `Player.seedArgument` in step 11. If a string has a count of 0, stop: a screen of tasks 12 to 14 does not carry reference 4.5's copy.

- [ ] **Step 2: Write the failing unit test of the recorder's files.**

`ios/Truthy/TruthyTests/ReviewFramesTests.swift`:

```swift
import CoreGraphics
import Foundation
import Testing
@testable import Truthy

/// The files the debug recorder writes for the visual review (frames) and the N4 test (trace).
@Suite struct ReviewFramesTests {
    @Test func framesAreWindowPointsRoundedToHundredthsUnderSortedNames() throws {
        let data = ReviewFrameFile.encode([
            "ticket": CGRect(x: 16.004, y: 120.5, width: 398, height: 512.126),
            "pill:True": CGRect(x: 223, y: 838, width: 191, height: 60),
        ])
        let text = try #require(String(data: data, encoding: .utf8))
        let pill = try #require(text.range(of: "pill:True"))
        let ticket = try #require(text.range(of: "ticket"))
        #expect(pill.lowerBound < ticket.lowerBound)
        let decoded = try JSONDecoder().decode([String: [Double]].self, from: data)
        #expect(decoded == ["ticket": [16, 120.5, 398, 512.13], "pill:True": [223, 838, 191, 60]])
    }

    @Test func noFramesIsAnEmptyObject() {
        #expect(String(decoding: ReviewFrameFile.encode([:]), as: UTF8.self) == "{}")
    }

    @Test func theTraceIsOneObjectPerLine() throws {
        let samples = [
            TraceSample(t: 1.5, touch: [210, 400], card: [16, 100, 398, 300]),
            TraceSample(t: 1.5167, touch: nil, card: nil),
            TraceSample(t: 1.5333, touch: [12, 400], card: nil, pass: [16, 120, 398, 96.5]),
        ]
        let text = String(decoding: ReviewFrameFile.traceLines(samples), as: UTF8.self)
        #expect(text.hasSuffix("\n"))
        let lines = text.split(separator: "\n")
        #expect(lines.count == 3)
        let decoded = try lines.map { try JSONDecoder().decode(TraceSample.self, from: Data($0.utf8)) }
        #expect(decoded == samples)
    }

    @Test @MainActor func recordsOnlyWithAPathInTheEnvironment() {
        #expect(ReviewFrames(environment: [:]).isRecording == false)
        #expect(ReviewFrames(environment: ["TRUTHY_REVIEW_FRAMES": ""]).isRecording == false)
        #expect(ReviewFrames(environment: ["TRUTHY_REVIEW_FRAMES": "frames.json"]).isRecording)
        #expect(ReviewFrames(environment: ["TRUTHY_REVIEW_TRACE": "trace.jsonl"]).isRecording)
    }

    @Test func pillNamesCarryTheVisibleTitle() {
        #expect(ReviewName.pill("Next card") == "pill:Next card")
        #expect([ReviewName.logo, ReviewName.pass, ReviewName.ticket, ReviewName.card, ReviewName.stub, ReviewName.sheet]
            == ["logo", "pass", "ticket", "card", "stub", "sheet"])
    }
}
```

- [ ] **Step 3: Run it and see it fail.**

```bash
DEST26='platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5'
xcodebuild test -project ios/Truthy/Truthy.xcodeproj -scheme Truthy -destination "$DEST26" -only-testing:TruthyTests/ReviewFramesTests 2>&1 | grep -E "error:|TEST (SUCCEEDED|FAILED)" | head -5
```

Expected: `error: cannot find 'ReviewFrameFile' in scope` (and the same for `TraceSample`, `ReviewFrames`, `ReviewName`), then `** TEST FAILED **`.

- [ ] **Step 4: Write the recorder.**

`ios/Truthy/Truthy/Debug/ReviewFrames.swift`:

```swift
import SwiftUI
import UIKit

/// The names of the views the visual review measures (spec 7.4, criterion 2). The web side of
/// `ios/Tools/visual-review` reads the same names from the web page, so a name here is a contract with `web.mjs`.
enum ReviewName {
    static let logo = "logo"
    static let pass = "pass"
    static let ticket = "ticket"
    static let card = "card"
    static let stub = "stub"
    static let sheet = "sheet"

    /// A pill is named after its visible title: "pill:True", "pill:Next card", "pill:Start round".
    static func pill(_ title: String) -> String { "pill:" + title }
}

extension View {
    /// Debug builds: reports this view's frame in window points while the app runs with the
    /// `TRUTHY_REVIEW_FRAMES` or `TRUTHY_REVIEW_TRACE` environment variable (the visual review and the N4 test).
    /// Without them, and in release builds, it does nothing.
    func reviewFrame(_ name: String) -> some View {
        #if DEBUG
        background(ReviewProbe(name: name))
        #else
        self
        #endif
    }
}

#if DEBUG

/// One display frame of the trace: the time (`CACurrentMediaTime` base), the first touch in window points (nil when
/// no finger is down) and the frames of the "card" view (N4) and of the fill-in pass (its morph during a back), each
/// as [x, y, width, height].
struct TraceSample: Codable, Equatable {
    let t: Double
    let touch: [Double]?
    let card: [Double]?
    var pass: [Double]? = nil
}

/// The two file formats, kept pure so a unit test pins them.
enum ReviewFrameFile {
    /// [x, y, width, height] rounded to hundredths of a point.
    static func numbers(_ rect: CGRect) -> [Double] {
        [rect.minX, rect.minY, rect.width, rect.height].map { (Double($0) * 100).rounded() / 100 }
    }

    /// One JSON object, name to [x, y, width, height], names sorted.
    static func encode(_ frames: [String: CGRect]) -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        return (try? encoder.encode(frames.mapValues(numbers))) ?? Data("{}".utf8)
    }

    /// One JSON object per line, each line ending in a newline.
    static func traceLines(_ samples: [TraceSample]) -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        var data = Data()
        for sample in samples {
            guard let line = try? encoder.encode(sample) else { continue }
            data.append(line)
            data.append(0x0A)
        }
        return data
    }
}

/// Debug-only recorder. With `TRUTHY_REVIEW_FRAMES` it rewrites that file with the frames of every probe in a
/// window, four times a second, when they changed. With `TRUTHY_REVIEW_TRACE` it appends one `TraceSample` per
/// display frame to that file. Paths are host paths: the simulator runs the app as a Mac process.
@MainActor
final class ReviewFrames {
    static let shared = ReviewFrames(environment: ProcessInfo.processInfo.environment)

    private struct Probe {
        let name: String
        weak var view: UIView?
    }

    private let framesURL: URL?
    private let traceURL: URL?
    private var probes: [ObjectIdentifier: Probe] = [:]
    private var timer: Timer?
    private var link: CADisplayLink?
    private var linkTarget: DisplayLinkTarget?
    private var watcher: TouchWatcher?
    private var lastFrames: Data?
    private var pending: [TraceSample] = []
    private var touch: CGPoint?

    init(environment: [String: String]) {
        framesURL = Self.fileURL(environment["TRUTHY_REVIEW_FRAMES"])
        traceURL = Self.fileURL(environment["TRUTHY_REVIEW_TRACE"])
    }

    private static func fileURL(_ path: String?) -> URL? {
        guard let path, !path.isEmpty else { return nil }
        return URL(fileURLWithPath: path)
    }

    var isRecording: Bool { framesURL != nil || traceURL != nil }

    func attach(_ view: UIView, name: String) {
        guard isRecording else { return }
        probes[ObjectIdentifier(view)] = Probe(name: name, view: view)
        if traceURL != nil, watcher == nil, let window = view.window {
            let watcher = TouchWatcher { [weak self] point in self?.touch = point }
            window.addGestureRecognizer(watcher)
            self.watcher = watcher
        }
        start()
    }

    func detach(_ view: UIView) {
        probes[ObjectIdentifier(view)] = nil
    }

    /// The frame of every probe that is in a window, in that window's points.
    func currentFrames() -> [String: CGRect] {
        var frames: [String: CGRect] = [:]
        for probe in probes.values {
            guard let view = probe.view, let window = view.window else { continue }
            frames[probe.name] = view.convert(view.bounds, to: window)
        }
        return frames
    }

    private func start() {
        if framesURL != nil, timer == nil {
            let timer = Timer(timeInterval: 0.25, repeats: true) { _ in
                MainActor.assumeIsolated { ReviewFrames.shared.flushFrames() }
            }
            RunLoop.main.add(timer, forMode: .common)
            self.timer = timer
        }
        if traceURL != nil, link == nil {
            let target = DisplayLinkTarget()
            let link = CADisplayLink(target: target, selector: #selector(DisplayLinkTarget.tick(_:)))
            link.add(to: .main, forMode: .common)
            self.link = link
            linkTarget = target
        }
    }

    func flushFrames() {
        guard let framesURL else { return }
        let data = ReviewFrameFile.encode(currentFrames())
        guard data != lastFrames else { return }
        lastFrames = data
        try? data.write(to: framesURL, options: .atomic)
    }

    func traceTick(time: Double) {
        guard traceURL != nil else { return }
        let frames = currentFrames()
        let finger = touch.map { [Double($0.x), Double($0.y)] }
        pending.append(TraceSample(t: time, touch: finger, card: frames[ReviewName.card].map(ReviewFrameFile.numbers),
                                   pass: frames[ReviewName.pass].map(ReviewFrameFile.numbers)))
        if pending.count >= 30 { flushTrace() }
    }

    private func flushTrace() {
        guard let traceURL, !pending.isEmpty else { return }
        let data = ReviewFrameFile.traceLines(pending)
        pending.removeAll()
        if let handle = try? FileHandle(forWritingTo: traceURL) {
            handle.seekToEndOfFile()
            handle.write(data)
            try? handle.close()
        } else {
            try? data.write(to: traceURL, options: .atomic)
        }
    }
}

/// The display link's target: `CADisplayLink` needs an Objective-C selector.
@MainActor
private final class DisplayLinkTarget: NSObject {
    @objc func tick(_ link: CADisplayLink) {
        ReviewFrames.shared.traceTick(time: link.timestamp)
    }
}

/// A recognizer on the window that never recognizes and never delays or cancels a touch: it only reports where
/// the first finger is, for the N4 trace.
private final class TouchWatcher: UIGestureRecognizer, UIGestureRecognizerDelegate {
    private let report: (CGPoint?) -> Void

    init(report: @escaping (CGPoint?) -> Void) {
        self.report = report
        super.init(target: nil, action: nil)
        cancelsTouchesInView = false
        delaysTouchesBegan = false
        delaysTouchesEnded = false
        delegate = self
    }

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent) {
        report(location(of: touches))
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent) {
        report(location(of: touches))
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent) {
        report(nil)
        state = .failed
    }

    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent) {
        report(nil)
        state = .failed
    }

    private func location(of touches: Set<UITouch>) -> CGPoint? {
        guard let touch = touches.first else { return nil }
        return touch.location(in: view)
    }

    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool {
        true
    }
}

/// The view `reviewFrame` puts behind the measured view: invisible, untouchable, hidden from accessibility.
private struct ReviewProbe: UIViewRepresentable {
    let name: String

    func makeUIView(context: Context) -> ReviewProbeView {
        let view = ReviewProbeView()
        view.name = name
        return view
    }

    func updateUIView(_ view: ReviewProbeView, context: Context) {
        view.name = name
    }
}

private final class ReviewProbeView: UIView {
    var name = "" {
        didSet {
            if window != nil { ReviewFrames.shared.attach(self, name: name) }
        }
    }

    override init(frame: CGRect) {
        super.init(frame: frame)
        isUserInteractionEnabled = false
        isAccessibilityElement = false
        accessibilityElementsHidden = true
        backgroundColor = .clear
    }

    required init?(coder: NSCoder) {
        nil
    }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        if window == nil {
            ReviewFrames.shared.detach(self)
        } else {
            ReviewFrames.shared.attach(self, name: name)
        }
    }
}

#endif
```

- [ ] **Step 5: Run the test and a release build.**

```bash
DEST26='platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5'
xcodebuild test -project ios/Truthy/Truthy.xcodeproj -scheme Truthy -destination "$DEST26" -only-testing:TruthyTests/ReviewFramesTests 2>&1 | grep -E "ReviewFramesTests.*(passed|failed)|TEST (SUCCEEDED|FAILED)"
xcodebuild build -project ios/Truthy/Truthy.xcodeproj -scheme Truthy -configuration Release -destination "generic/platform=iOS Simulator" -quiet && echo release-builds
```

Expected: five `ReviewFramesTests` tests reported as passed, `** TEST SUCCEEDED **`, then `release-builds` (in release `reviewFrame` returns the view itself and nothing else of the file exists).

- [ ] **Step 6: Commit.**

```bash
git add ios/Truthy/Truthy/Debug/ReviewFrames.swift ios/Truthy/TruthyTests/ReviewFramesTests.swift
git commit -m "test: record the frames of the reviewed views in debug builds"
```

- [ ] **Step 7: Write the failing checks of the UI test helpers.**

These run in the UI test target without launching the app. `ios/Truthy/TruthyUITests/SupportTests.swift`:

```swift
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
```

- [ ] **Step 8: Run them and see them fail.**

```bash
DEST26='platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5'
xcodebuild test -project ios/Truthy/Truthy.xcodeproj -scheme Truthy -destination "$DEST26" -only-testing:TruthyUITests/SupportTests 2>&1 | grep -E "error:|TEST (SUCCEEDED|FAILED)" | head -5
```

Expected: `error: cannot find 'plainText' in scope` (and `DeckFacts`, `TracePoint`, `FollowCheck`), then `** TEST FAILED **`.

- [ ] **Step 9: Write the deck facts and `plainText`.**

`ios/Truthy/TruthyUITests/Support/DeckFacts.swift`:

```swift
import Foundation

/// `plainText` of `src/content/text.ts`: every pair of backticks around at least one character that is not a
/// backtick is replaced by what it holds; any other backtick stays. It is how a statement reads to VoiceOver and
/// so how XCUITest sees its label.
func plainText(_ text: String) -> String {
    text.replacing(/`([^`]+)`/) { match in match.output.1 }
}

/// What a UI test needs to know about a card it sees on screen.
struct CardFacts: Equatable {
    let id: String
    let answer: Bool
    let explanation: String
    let sourceTitle: String
}

/// Reads a deck from `native-data/decks`, the folder the app embeds, keyed by the statement as it reads
/// (`plainText`), the way `deckAnswers` in `e2e/helpers.ts` does on the web. The simulator runs the test runner as
/// a Mac process, so the repository is reachable from this file's path.
enum DeckFacts {
    static let clf = "aws-clf-c02"
    static let cdl = "gcp-cdl"

    /// The repository root: this file is `ios/Truthy/TruthyUITests/Support/DeckFacts.swift`.
    static func repositoryRoot(file: StaticString = #filePath) -> URL {
        var url = URL(fileURLWithPath: "\(file)")
        for _ in 0..<5 { url.deleteLastPathComponent() }
        return url
    }

    static func load(_ deckId: String) throws -> [String: CardFacts] {
        let url = repositoryRoot().appending(path: "native-data/decks/\(deckId).json")
        let deck = try JSONDecoder().decode(DeckJSON.self, from: Data(contentsOf: url))
        var facts: [String: CardFacts] = [:]
        for card in deck.cards {
            facts[plainText(card.text.en.statement)] = CardFacts(
                id: card.id,
                answer: card.answer,
                explanation: plainText(card.text.en.explanation),
                sourceTitle: card.source.title
            )
        }
        return facts
    }

    private struct DeckJSON: Decodable { let cards: [CardJSON] }
    private struct CardJSON: Decodable {
        let id: String
        let answer: Bool
        let text: TextJSON
        let source: SourceJSON
    }
    private struct TextJSON: Decodable { let en: EnglishJSON }
    private struct EnglishJSON: Decodable {
        let statement: String
        let explanation: String
    }
    private struct SourceJSON: Decodable { let title: String }
}
```

- [ ] **Step 10: Write the N4 trace check.**

`ios/Truthy/TruthyUITests/Support/FollowCheck.swift`:

```swift
import Foundation

/// One line of the trace the app writes with `TRUTHY_REVIEW_TRACE` (`TraceSample` in the app's
/// `Debug/ReviewFrames.swift`): time, the first touch in window points, the card's and the pass's frames
/// [x, y, width, height].
struct TracePoint: Decodable, Equatable {
    let t: Double
    let touch: [Double]?
    let card: [Double]?
    var pass: [Double]? = nil
}

/// Feel item N4: the card's drawn offset equals the finger's travel since touch-down (spec 5.3, "slop included").
enum FollowCheck {
    /// Reads a trace file, one JSON object per line.
    static func read(_ path: String) throws -> [TracePoint] {
        let text = try String(contentsOfFile: path, encoding: .utf8)
        return try text.split(separator: "\n").map { try JSONDecoder().decode(TracePoint.self, from: Data($0.utf8)) }
    }

    /// The error |card offset - finger travel| at `count` frames spread evenly over the drag, in points. The drag is
    /// the last run of frames with a finger down (the taps of the route choice came before it). The card's offset is
    /// the move of its centre (a rotation about the centre keeps the centre), measured from the last frame before the
    /// finger came down. A display-link sample reads the newest touch but the card as last drawn, so each card is
    /// compared with the touch of the frame before it. Only frames where that finger is at least `beyond` points from
    /// where it came down count, so the recognizer's slop is behind. Nil when the trace has fewer such frames than `count`.
    static func errors(_ trace: [TracePoint], count: Int = 10, beyond: Double = 20) -> [Double]? {
        let points = trace.sorted { $0.t < $1.t }
        guard let lastTouch = points.lastIndex(where: { $0.touch != nil }) else { return nil }
        let down = (points[..<lastTouch].lastIndex(where: { $0.touch == nil }) ?? -1) + 1
        guard down > 0,
              let rest = points[..<down].last(where: { $0.card != nil })?.card,
              let downX = points[down].touch?.first
        else { return nil }
        let restCentre = rest[0] + rest[2] / 2
        var travelled: [(finger: Double, card: Double)] = []
        var drawnFor: Double?
        for point in points[down...] {
            guard let touch = point.touch else { break }
            defer { drawnFor = touch[0] }
            guard let card = point.card, let x = drawnFor else { continue }
            let finger = x - downX
            if abs(finger) >= beyond { travelled.append((finger, card[0] + card[2] / 2 - restCentre)) }
        }
        guard travelled.count >= count, count > 0 else { return nil }
        return (0..<count).map { i in
            let pick = travelled[i * (travelled.count - 1) / max(count - 1, 1)]
            return abs(pick.card - pick.finger)
        }
    }
}
```

- [ ] **Step 11: Write the player.**

`Player` is the stories' only way into the app. If step 1 found another spelling of the seed argument, put it in `seedArgument`. `ios/Truthy/TruthyUITests/Support/Player.swift`:

```swift
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
```

- [ ] **Step 12: Run the helper checks.**

```bash
DEST26='platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5'
xcodebuild test -project ios/Truthy/Truthy.xcodeproj -scheme Truthy -destination "$DEST26" -only-testing:TruthyUITests/SupportTests 2>&1 | grep -E "Executed|TEST (SUCCEEDED|FAILED)" | tail -2
```

Expected: `Executed 5 tests, with 0 failures (0 unexpected)` and `** TEST SUCCEEDED **`. A failure of `testDeckFactsReadTheEmbeddedDeck` with "no such file" means the runner cannot read the repository from `#filePath`; stop and find out why before going on, since every story relies on it.

- [ ] **Step 13: Commit.**

```bash
git add ios/Truthy/TruthyUITests/Support/DeckFacts.swift ios/Truthy/TruthyUITests/Support/FollowCheck.swift ios/Truthy/TruthyUITests/Support/Player.swift ios/Truthy/TruthyUITests/SupportTests.swift
git commit -m "test: add the UI test player, the deck facts and the N4 trace check"
```

- [ ] **Step 14: Write the failing test of the review names.**

`ios/Truthy/TruthyUITests/ReviewNamesTests.swift`:

```swift
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
```

- [ ] **Step 15: Run it and see it fail.**

```bash
DEST26='platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5'
xcodebuild test -project ios/Truthy/Truthy.xcodeproj -scheme Truthy -destination "$DEST26" -only-testing:TruthyUITests/ReviewNamesTests 2>&1 | grep -E "error|TEST (SUCCEEDED|FAILED)" | head -3
```

Expected: `XCTAssertTrue failed - step 1: logo` and `** TEST FAILED **`: no view is named yet, so the recorder never starts and writes no file.

- [ ] **Step 16: Name the measured views.**

Add one modifier to each view below, as the last modifier of the view the table of rule 6 describes. Find each with the `grep` shown (copy strings are fixed by reference 4.5, so they locate the views whatever their type names). Add nothing else.

| Name | Find it | Add |
|---|---|---|
| `logo` | `grep -rn '"Truthy"' ios/Truthy/Truthy`: the step 1 top zone where the logo with its wordmark is the heading | `.reviewFrame(ReviewName.logo)` at that call site |
| `pass` | `grep -rln 'YOUR PASS' ios/Truthy/Truthy`: the fill-in pass view (it draws the compact band, and the "BOARDING PASS" band on step 6) | `.reviewFrame(ReviewName.pass)` on the body's outermost view |
| `ticket` | `grep -rln 'BOARDING PASS' ios/Truthy/Truthy`: the round's boarding pass view (the other match is the pass above) | `.reviewFrame(ReviewName.ticket)` on the view that holds the band, legs, fields, statement and the stub or slip |
| `card` | the view in task 13's round screen that the swipe recognizer's rotation and offset move (`grep -rn 'rotationDivisor' ios/Truthy/Truthy/Round/RoundView.swift`) | `.reviewFrame(ReviewName.card)` right after the `BoardingPassView(...)` call, before its `.rotationEffect` and `.offset` modifiers, so the probe moves with the card |
| `stub` | `grep -rln 'swipe to board' ios/Truthy/Truthy`: the stub view | `.reviewFrame(ReviewName.stub)` on the body's outermost view |
| `pill:<title>` | `grep -rn 'Start round' ios/Truthy/Truthy`: the call site names task 10's 60 point pill view | `.reviewFrame(ReviewName.pill(title))` inside the pill view, where `title` is the visible title string it already holds |
| `sheet` | `grep -rln 'Leave round?' ios/Truthy/Truthy`: the sheet's paper card | `.reviewFrame(ReviewName.sheet)` on the card, inside the sheet's content |

Then check that each name is attached exactly once (the pill once, in the pill view):

```bash
for n in logo pass ticket card stub sheet; do printf '%s: %s\n' "$n" "$(grep -rn "reviewFrame(ReviewName.$n)" ios/Truthy/Truthy | wc -l | tr -d ' ')"; done
grep -rn 'reviewFrame(ReviewName.pill(' ios/Truthy/Truthy | wc -l | tr -d ' '
```

Expected: `logo: 1` to `sheet: 1`, then `1`.

- [ ] **Step 17: Run the names test.**

```bash
DEST26='platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5'
xcodebuild test -project ios/Truthy/Truthy.xcodeproj -scheme Truthy -destination "$DEST26" -only-testing:TruthyUITests/ReviewNamesTests 2>&1 | grep -E "Executed|TEST (SUCCEEDED|FAILED)" | tail -2
```

Expected: `Executed 1 test, with 0 failures (0 unexpected)` and `** TEST SUCCEEDED **`. If a name is missing, the failure message names the screen; move that modifier onto the view the table means.

- [ ] **Step 18: Commit.**

```bash
git add -u ios/Truthy/Truthy
git add ios/Truthy/TruthyUITests/ReviewNamesTests.swift
git commit -m "test: name the views the visual review measures"
```

- [ ] **Step 19: Write the start flow stories.**

`ios/Truthy/TruthyUITests/StartStoryTests.swift`:

```swift
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
```

- [ ] **Step 20: Run them.**

```bash
DEST26='platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5'
xcodebuild test -project ios/Truthy/Truthy.xcodeproj -scheme Truthy -destination "$DEST26" -only-testing:TruthyUITests/StartStoryTests 2>&1 | grep -E "Executed|TEST (SUCCEEDED|FAILED)" | tail -2
```

Expected: `Executed 7 tests, with 0 failures (0 unexpected)` and `** TEST SUCCEEDED **`, in about four and a half minutes. If `testTheContinueLineShowsTheWholeDeckNameAtTheLargestTextSize` reads "Google C..." the continue line cuts its name (task 12, README deviation 5); if a word is missing without an ellipsis, look at the screen at the largest size: something is drawn over the line. These stories test behaviour that tasks 12 to 14 built, so they pass on first run; a failing story is a defect of the task that owns that screen. Stop, find the cause with superpowers:systematic-debugging, fix it there with a unit test, commit the fix as `fix: ...`, then run the stories again.

- [ ] **Step 21: Commit.**

```bash
git add ios/Truthy/TruthyUITests/StartStoryTests.swift
git commit -m "test: play the start flow stories of spec 7.3"
```

- [ ] **Step 22: Write the round stories.**

`ios/Truthy/TruthyUITests/RoundStoryTests.swift`:

```swift
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
```

- [ ] **Step 23: Run them.**

```bash
DEST26='platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5'
xcodebuild test -project ios/Truthy/Truthy.xcodeproj -scheme Truthy -destination "$DEST26" -only-testing:TruthyUITests/RoundStoryTests 2>&1 | grep -E "Executed|TEST (SUCCEEDED|FAILED)" | tail -2
```

Expected: `Executed 8 tests, with 1 test skipped and 0 failures (0 unexpected)` and `** TEST SUCCEEDED **`, in about five minutes (the Timed story waits out its minute). `testReturnAndEscape` skips on the simulator, where XCUITest cannot deliver Escape or Return (task 12 rule 6); with the Mac keyboard through the simulator both reach the app, and task 16 checks them on the device (D16). The browser story closes the in-app browser with a tap at Done's frame through the app's coordinates: `close.tap()` on the button itself, which belongs to the browser's own process, landed nowhere on 18.4, twice in a row, while the coordinate tap closes it and the browser reports that it finished (the app keeps no state for it, so this is no app defect). A failure is handled as in step 20.

- [ ] **Step 24: Commit.**

```bash
git add ios/Truthy/TruthyUITests/RoundStoryTests.swift
git commit -m "test: play the round stories of spec 7.3"
```

- [ ] **Step 25: Write the feel tests.**

`ios/Truthy/TruthyUITests/FeelTests.swift`:

```swift
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
```

- [ ] **Step 26: Run them.**

```bash
DEST26='platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5'
xcodebuild test -project ios/Truthy/Truthy.xcodeproj -scheme Truthy -destination "$DEST26" -only-testing:TruthyUITests/FeelTests 2>&1 | grep -E "Executed|error|TEST (SUCCEEDED|FAILED)" | tail -4
```

Expected: `Executed 6 tests, with 0 failures (0 unexpected)` and `** TEST SUCCEEDED **`. If `testABackBetweenStagesKeepsThePassHeightContinuous` fails on a jump, the pass draws the two stages stacked instead of morphing its height (task 12 rule 4); a trace without the pass means the `pass` probe of step 16 is missing. If `testTheCardFollowsTheFingerWithinOnePoint` fails with "the trace has 10 frames of the drag", the `card` probe is outside the card's transforms or the trace file was not written (check that the file named in `TRUTHY_REVIEW_TRACE` exists); if it fails on a frame's error, the card lags the finger: a defect of task 13 (spec 5.3: the drawn offset is the current x minus the touch-down x, slop included). Handle it as in step 20.

- [ ] **Step 27: Commit.**

```bash
git add ios/Truthy/TruthyUITests/FeelTests.swift
git commit -m "test: check the feel items N4, N8 and N13 and script the N3 drags"
```

- [ ] **Step 28: Write the visual capture runs.**

`ios/Truthy/TruthyUITests/VisualCaptureTests.swift`:

```swift
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
```

- [ ] **Step 29: Run them without the review's settings.**

```bash
DEST26='platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5'
xcodebuild test -project ios/Truthy/Truthy.xcodeproj -scheme Truthy -destination "$DEST26" -only-testing:TruthyUITests/VisualCaptureTests 2>&1 | grep -E "Executed|TEST (SUCCEEDED|FAILED)" | tail -2
```

Expected: `Executed 4 tests, with 4 tests skipped and 0 failures (0 unexpected)` and `** TEST SUCCEEDED **`: outside the review scripts they skip, so the scheme's test run stays short.

- [ ] **Step 30: Commit.**

```bash
git add ios/Truthy/TruthyUITests/VisualCaptureTests.swift
git commit -m "test: capture the review screens and the stored theme for the visual review"
```

- [ ] **Step 31: Write the failing tests of the PNG reader and writer.**

`ios/Tools/visual-review/png.test.mjs`:

```js
import assert from "node:assert/strict";
import { test } from "node:test";
import { deflateSync } from "node:zlib";
import { crc32, decodePng, encodePng, pixelAt } from "./png.mjs";

/** A 3 by 2 RGBA image whose every byte differs. */
function sample() {
  const data = new Uint8Array(3 * 2 * 4);
  for (let i = 0; i < data.length; i += 1) data[i] = (i * 37 + 11) & 0xff;
  return { width: 3, height: 2, data };
}

test("crc32 is the PNG checksum", () => {
  assert.equal(crc32(Buffer.from("IEND", "latin1")), 0xae426082);
});

test("an encoded image decodes to the same pixels, untagged", () => {
  const image = sample();
  const decoded = decodePng(encodePng(image));
  assert.equal(decoded.width, 3);
  assert.equal(decoded.height, 2);
  assert.equal(decoded.profile, "none");
  assert.deepEqual([...decoded.data], [...image.data]);
});

test("the encoder writes only IHDR, IDAT and IEND", () => {
  const png = encodePng(sample());
  const types = [];
  for (let offset = 8; offset < png.length; offset += 12 + png.readUInt32BE(offset)) {
    types.push(png.toString("latin1", offset + 4, offset + 8));
  }
  assert.deepEqual(types, ["IHDR", "IDAT", "IEND"]);
});

/** Builds a PNG by hand from RGB rows, each row with its own filter type. */
function filteredRgbPng(rows, filters, tags = []) {
  const width = rows[0].length / 3;
  const lines = [];
  rows.forEach((row, y) => {
    const filter = filters[y];
    const previous = y > 0 ? rows[y - 1] : new Array(row.length).fill(0);
    const out = [filter];
    for (let x = 0; x < row.length; x += 1) {
      const left = x >= 3 ? row[x - 3] : 0;
      const up = previous[x];
      const upLeft = x >= 3 ? previous[x - 3] : 0;
      let predicted = 0;
      if (filter === 1) predicted = left;
      if (filter === 2) predicted = up;
      if (filter === 3) predicted = (left + up) >> 1;
      if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        predicted = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      }
      out.push((row[x] - predicted) & 0xff);
    }
    lines.push(...out);
  });
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(rows.length, 4);
  header[8] = 8;
  header[9] = 2;
  const chunk = (type, body) => {
    const out = Buffer.alloc(12 + body.length);
    out.writeUInt32BE(body.length, 0);
    out.write(type, 4, "latin1");
    body.copy(out, 8);
    out.writeUInt32BE(crc32(out.subarray(4, 8 + body.length)), 8 + body.length);
    return out;
  };
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    ...tags.map((type) => chunk(type, Buffer.from([0]))),
    chunk("IDAT", deflateSync(Buffer.from(lines))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

test("RGB rows with the Sub, Up, Average and Paeth filters decode to RGBA", () => {
  const rows = [
    [10, 20, 30, 200, 100, 50],
    [11, 22, 33, 199, 98, 47],
    [250, 5, 128, 3, 255, 64],
    [0, 0, 0, 255, 255, 255],
    [17, 34, 51, 68, 85, 102],
  ];
  const image = decodePng(filteredRgbPng(rows, [1, 2, 3, 4, 0]));
  assert.equal(image.width, 2);
  assert.equal(image.height, 5);
  rows.forEach((row, y) => {
    assert.deepEqual(pixelAt(image, 0, y), row.slice(0, 3));
    assert.deepEqual(pixelAt(image, 1, y), row.slice(3, 6));
  });
  assert.equal(image.data[3], 255);
});

test("the colour tag is read: an sRGB chunk, an ICC profile", () => {
  const rows = [[1, 2, 3]];
  assert.equal(decodePng(filteredRgbPng(rows, [0], ["sRGB"])).profile, "srgb");
  assert.equal(decodePng(filteredRgbPng(rows, [0], ["iCCP"])).profile, "icc");
});

test("pixelAt clamps to the image", () => {
  const image = decodePng(encodePng(sample()));
  assert.deepEqual(pixelAt(image, -5, -5), pixelAt(image, 0, 0));
  assert.deepEqual(pixelAt(image, 99, 99), pixelAt(image, 2, 1));
});
```

- [ ] **Step 32: Run them and see them fail.**

```bash
node --test "ios/Tools/visual-review/*.test.mjs" 2>&1 | grep -E "ERR_MODULE_NOT_FOUND|^ℹ (tests|pass|fail)"
```

Expected: `ERR_MODULE_NOT_FOUND` for `png.mjs`, then `ℹ tests 1`, `ℹ pass 0`, `ℹ fail 1`.

- [ ] **Step 33: Write the PNG reader and writer.**

`ios/Tools/visual-review/png.mjs`:

```js
// A small PNG reader and writer for the visual review: 8-bit RGB or RGBA, not interlaced, which is what the
// simulator, XCUITest and Playwright write. The writer emits only IHDR, IDAT and IEND (no text or EXIF chunk).
import { deflateSync, inflateSync } from "node:zlib";

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** @typedef {{ width: number, height: number, data: Uint8Array, profile: "srgb" | "icc" | "none" }} Image */

/**
 * Decodes a PNG into RGBA pixels. `profile` says how the file tags its colours: an sRGB chunk, an ICC profile
 * (which review.mjs converts to sRGB with sips before reading), or nothing (sRGB by convention).
 * @param {Uint8Array} bytes
 * @returns {Image}
 */
export function decodePng(bytes) {
  const buffer = Buffer.from(bytes);
  if (!buffer.subarray(0, 8).equals(SIGNATURE)) throw new Error("not a PNG");
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = -1;
  let profile = /** @type {"srgb" | "icc" | "none"} */ ("none");
  const idat = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("latin1", offset + 4, offset + 8);
    const body = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      const depth = body[8];
      colorType = body[9] ?? -1;
      const interlace = body[12];
      if (depth !== 8 || (colorType !== 2 && colorType !== 6) || interlace !== 0) {
        throw new Error(`unsupported PNG: depth ${depth}, colour type ${colorType}, interlace ${interlace}`);
      }
    } else if (type === "sRGB") {
      profile = "srgb";
    } else if (type === "iCCP") {
      profile = "icc";
    } else if (type === "IDAT") {
      idat.push(body);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }
  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(idat));
  const pixels = new Uint8Array(width * height * channels);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x += 1) {
      const left = x >= channels ? pixels[y * stride + x - channels] ?? 0 : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] ?? 0 : 0;
      const upLeft = y > 0 && x >= channels ? pixels[(y - 1) * stride + x - channels] ?? 0 : 0;
      const value = line[x] ?? 0;
      let predicted = 0;
      if (filter === 1) predicted = left;
      else if (filter === 2) predicted = up;
      else if (filter === 3) predicted = (left + up) >> 1;
      else if (filter === 4) predicted = paeth(left, up, upLeft);
      else if (filter !== 0) throw new Error(`unknown PNG filter ${filter}`);
      pixels[y * stride + x] = (value + predicted) & 0xff;
    }
  }
  if (channels === 4) return { width, height, data: pixels, profile };
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    rgba[i * 4] = pixels[i * 3] ?? 0;
    rgba[i * 4 + 1] = pixels[i * 3 + 1] ?? 0;
    rgba[i * 4 + 2] = pixels[i * 3 + 2] ?? 0;
    rgba[i * 4 + 3] = 255;
  }
  return { width, height, data: rgba, profile };
}

/** @param {number} a @param {number} b @param {number} c */
function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/**
 * Encodes RGBA pixels as a PNG with filter 0 on every row.
 * @param {{ width: number, height: number, data: Uint8Array }} image
 * @returns {Buffer}
 */
export function encodePng(image) {
  const { width, height, data } = image;
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    Buffer.from(data.buffer, data.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([SIGNATURE, chunk("IHDR", header), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

/** @param {string} type @param {Buffer} body */
function chunk(type, body) {
  const out = Buffer.alloc(12 + body.length);
  out.writeUInt32BE(body.length, 0);
  out.write(type, 4, "latin1");
  body.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + body.length)), 8 + body.length);
  return out;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

/** @param {Uint8Array} bytes */
export function crc32(bytes) {
  let c = 0xffffffff;
  for (const byte of bytes) c = (CRC_TABLE[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * The RGB of the pixel at (x, y), clamped to the image.
 * @param {Image} image @param {number} x @param {number} y
 * @returns {[number, number, number]}
 */
export function pixelAt(image, x, y) {
  const cx = Math.min(image.width - 1, Math.max(0, Math.round(x)));
  const cy = Math.min(image.height - 1, Math.max(0, Math.round(y)));
  const i = (cy * image.width + cx) * 4;
  return [image.data[i] ?? 0, image.data[i + 1] ?? 0, image.data[i + 2] ?? 0];
}
```

- [ ] **Step 34: Run the tests.**

```bash
node --test "ios/Tools/visual-review/*.test.mjs" 2>&1 | grep -E "^ℹ (tests|pass|fail)"
```

Expected: `ℹ tests 6`, `ℹ pass 6`, `ℹ fail 0`.

- [ ] **Step 35: Write the failing tests of the comparisons.**

They read the real `native-data/tokens/resolved.json`, so they also pin the colours of reference 5.1. `ios/Tools/visual-review/compare.test.mjs`:

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  STATES,
  checkColors,
  classifyFrames,
  compareFrames,
  frameDiff,
  hexToRgb,
  probesFor,
  sideBySide,
  skyHex,
  statusBarCheck,
  tokenHex,
} from "./compare.mjs";

const TOKENS = JSON.parse(readFileSync(new URL("../../../native-data/tokens/resolved.json", import.meta.url), "utf8"));

/** A plain image of one colour, with optional rectangles painted over it (in pixels). */
function canvas(width, height, hex, rects = []) {
  const data = new Uint8Array(width * height * 4);
  const fill = (x0, y0, x1, y1, rgb) => {
    for (let y = y0; y < y1; y += 1) for (let x = x0; x < x1; x += 1) data.set([...rgb, 255], (y * width + x) * 4);
  };
  fill(0, 0, width, height, hexToRgb(hex));
  for (const [x0, y0, x1, y1, color] of rects) fill(x0, y0, x1, y1, hexToRgb(color));
  return { width, height, data, profile: "none" };
}

test("tokens resolve through their references to the values of reference 5.1", () => {
  assert.equal(tokenHex(TOKENS, "day", "sky-1"), "#a9d6f0");
  assert.equal(tokenHex(TOKENS, "night", "sky-1"), "#0b1528");
  assert.equal(tokenHex(TOKENS, "day", "surface-raised"), "#fdfbf5");
  assert.equal(tokenHex(TOKENS, "night", "accent"), "#e0a52c");
  assert.equal(tokenHex(TOKENS, "day", "true"), "#1d5cc0");
  assert.equal(tokenHex(TOKENS, "night", "ink"), "#e6e3da");
  assert.throws(() => tokenHex(TOKENS, "day", "no-such-role"), /does not resolve/);
});

test("a frame difference is the largest of x, y, width and height", () => {
  assert.equal(frameDiff([16, 100, 398, 300], [17.5, 99, 398, 302.25]), 2.25);
});

test("frames compare within 2 points, report what one side lacks and honour approvals", () => {
  const web = { ticket: [16, 100, 398, 300], "pill:True": [223, 838, 191, 60], logo: [16, 88, 160, 36] };
  const ios = { ticket: [16, 101.5, 398, 300], "pill:True": [223, 841, 191, 60], stub: [16, 420, 398, 228] };
  const results = compareFrames(web, ios, "large-day-p2", { "large-day-p2:stub": "the web has no stub frame here" });
  assert.deepEqual(
    results.map((r) => [r.name, r.diff, r.ok, r.missing]),
    [
      ["logo", null, false, "ios"],
      ["pill:True", 3, false, null],
      ["stub", null, true, "web"],
      ["ticket", 1.5, true, null],
    ],
  );
});

test("the probes of a screen follow its frames; the leave sheet reads the sky under the scrim, the sheet and its pill", () => {
  const frames = { ticket: [16, 100, 398, 600], "pill:True": [223, 838, 191, 60], sheet: [16, 600, 398, 250], "pill:Keep playing": [36, 700, 358, 60] };
  const sky = (y, scrim) => ({ name: `sky-${y}`, x: 4, y, role: "sky", fraction: y / 932, scrim });
  assert.deepEqual(
    probesFor("p2", { ticket: frames.ticket, "pill:True": frames["pill:True"] }, { width: 430, height: 932 }),
    [
      sky(120, false), sky(300, false), sky(560, false), sky(860, false),
      { name: "ticket band", x: 215, y: 104, role: "accent" },
      { name: "ticket paper", x: 22, y: 150, role: "surface-raised" },
      { name: "pill:True", x: 237, y: 868, role: "true" },
    ],
  );
  const p4 = probesFor("p4", frames, { width: 430, height: 932 });
  assert.deepEqual(p4.map((p) => p.name), ["sky-120", "sky-300", "sky-560", "sky-860", "sheet", "pill:Keep playing"]);
  assert.ok(p4.filter((p) => p.role === "sky").every((p) => p.scrim === true));
  assert.deepEqual(probesFor("s1", {}, { width: 375, height: 667 }).map((p) => p.name), ["sky-120", "sky-300", "sky-560"]);
});

test("the sky is the gradient of the four sky colours at the native stops, the scrim over it under the sheet", () => {
  assert.equal(skyHex(TOKENS, "day", 0), tokenHex(TOKENS, "day", "sky-1"));
  assert.equal(skyHex(TOKENS, "day", 0.35), tokenHex(TOKENS, "day", "sky-2"));
  assert.equal(skyHex(TOKENS, "night", 1), tokenHex(TOKENS, "night", "sky-4"));
  const [a, b] = [hexToRgb(tokenHex(TOKENS, "day", "sky-2")), hexToRgb(tokenHex(TOKENS, "day", "sky-3"))];
  const mid = hexToRgb(skyHex(TOKENS, "day", (0.35 + 0.62) / 2));
  mid.forEach((c, i) => assert.ok(Math.abs(c - (a[i] + b[i]) / 2) <= 1));
  const under = hexToRgb(skyHex(TOKENS, "day", 0, true));
  const plain = hexToRgb(skyHex(TOKENS, "day", 0));
  assert.ok(under.every((c, i) => c < plain[i]), "the day scrim darkens the sky");
});

test("colours are read at the probe times the scale and compared with the theme's token", () => {
  const image = canvas(20, 20, "#a9d6f0", [[10, 10, 20, 20, "#1d5cd0"]]);
  const results = checkColors(image, 2, [
    { name: "sky", x: 1, y: 1, role: "sky-1" },
    { name: "pill:True", x: 7, y: 7, role: "true" },
  ], TOKENS, "day");
  assert.deepEqual(results.map((r) => [r.name, r.actual, r.distance, r.ok]), [
    ["sky", "#a9d6f0", 0, true],
    ["pill:True", "#1d5cd0", 16, false],
  ]);
});

test("N12: dark glyphs on the day sky pass, light glyphs on the day sky fail", () => {
  const darkGlyphs = canvas(100, 60, "#a9d6f0", [[10, 10, 40, 20, "#000000"]]);
  const lightGlyphs = canvas(100, 60, "#a9d6f0", [[10, 10, 40, 20, "#ffffff"]]);
  const options = { scale: 2, statusBarPoints: 20, theme: "day", tokens: TOKENS };
  assert.equal(statusBarCheck(darkGlyphs, options).ok, true);
  assert.equal(statusBarCheck(lightGlyphs, options).ok, false);
  const nightSky = canvas(100, 60, "#0b1528", [[10, 10, 40, 20, "#ffffff"]]);
  assert.equal(statusBarCheck(nightSky, { ...options, theme: "night" }).ok, true);
  assert.equal(statusBarCheck(nightSky, options).ok, false, "a night sky is not the day theme");
});

test("N10: home screen, launch colour, a blend, then the app colour pass; a white frame fails", () => {
  const home = [40, 40, 40];
  const launch = [196, 227, 245];
  const app = [11, 21, 40];
  const blend = [104, 124, 143];
  const good = [home, home, launch, launch, blend, app, app, home];
  assert.deepEqual(classifyFrames(good, launch, app), { ok: true, firstApp: 5, problems: [] });
  const flash = [home, launch, [255, 255, 255], app, app];
  assert.deepEqual(classifyFrames(flash, launch, app).problems, [{ frame: 2, color: "#ffffff" }]);
  const backToLaunch = [launch, app, launch, app];
  assert.equal(classifyFrames(backToLaunch, launch, app).ok, false);
  assert.equal(classifyFrames([home, home], launch, app).ok, false);
});

test("the review captures twenty states on each side, the Classic round's ten first", () => {
  assert.equal(STATES.length, 20);
  assert.deepEqual(STATES.slice(0, 10), ["s1", "s2", "s3", "s4", "s5", "s6", "p2", "p3", "p4", "r1"]);
  assert.equal(new Set(STATES).size, STATES.length);
});

test("a pair puts the web left and iOS right, 16 pixels apart, frames outlined", () => {
  const web = canvas(10, 10, "#ffffff");
  const ios = canvas(10, 10, "#000000");
  const pair = sideBySide(web, ios, [{ name: "ticket", web: [2, 2, 4, 4], ios: [2, 2, 4, 4], ok: false }], 1);
  assert.equal(pair.width, 36);
  assert.equal(pair.height, 10);
  const at = (x, y) => [...pair.data.subarray((y * pair.width + x) * 4, (y * pair.width + x) * 4 + 3)];
  assert.deepEqual(at(0, 0), [255, 255, 255]);
  assert.deepEqual(at(26, 0), [0, 0, 0]);
  assert.deepEqual(at(2, 2), [220, 30, 30]);
  assert.deepEqual(at(28, 2), [220, 30, 30]);
});
```

- [ ] **Step 36: Run them and see them fail.**

```bash
node --test "ios/Tools/visual-review/*.test.mjs" 2>&1 | grep -E "ERR_MODULE_NOT_FOUND|^ℹ (tests|pass|fail)"
```

Expected: `ERR_MODULE_NOT_FOUND` for `compare.mjs`, then `ℹ tests 7`, `ℹ pass 6`, `ℹ fail 1`.

- [ ] **Step 37: Write the comparisons.**

`ios/Tools/visual-review/compare.mjs`:

```js
// The pure part of the visual review (spec 7.4): frame differences against the web, colour probes against the
// resolved tokens, the status bar check of N12, the launch frame check of N10 and the side-by-side pairs.
import { pixelAt } from "./png.mjs";

/** @typedef {[number, number, number, number]} Frame  x, y, width, height in points */
/** @typedef {Record<string, Frame>} Frames */
/** @typedef {[number, number, number]} Rgb */

/** Element frames may differ from the web's by this much, in points (criterion 2). */
export const FRAME_TOLERANCE = 2;
/** A screenshot colour may differ from its token by this much per channel. */
export const SCREENSHOT_TOLERANCE = 3;
/** A video frame colour may differ by this much per channel (H.264 changes colours a little). */
export const VIDEO_TOLERANCE = 12;

/**
 * The capture order of the review: one Classic round (start steps 1 to 6, question, answered, leave sheet, result),
 * then the screens it does not reach (testCaptureTheOtherClassesAndStartStates and the end of captureWeb).
 */
export const STATES = [
  "s1", "s2", "s3", "s4", "s5", "s6", "p2", "p3", "p4", "r1",
  "streak-p2", "streak-r1", "lives-p2", "lives-r1", "lives-r1-why", "timed-p2", "timed-up", "timed-r1",
  "s1-returning", "s3-recent",
];

/** The pills the review measures, by visible title, and the colour role of their fill. */
export const PILLS = {
  True: "true",
  False: "false",
  "Next card": "ink",
  "See results": "ink",
  "Start round": "ink",
  "Play again": "ink",
  "Keep playing": "ink",
};

/**
 * A colour role of a theme ("day" or "night") in native-data/tokens/resolved.json, references followed.
 * @param {any} tokens @param {"day" | "night"} theme @param {string} role
 * @returns {string} "#rrggbb"
 */
export function tokenHex(tokens, theme, role) {
  let value = tokens?.color?.[theme]?.[role]?.$value;
  for (let hops = 0; typeof value === "string" && hops < 8; hops += 1) {
    const match = /^\{color\.([a-z]+)\.([a-z0-9-]+)\}$/.exec(value);
    value = match === null ? undefined : tokens.color[match[1] ?? ""]?.[match[2] ?? ""]?.$value;
  }
  if (value === undefined || typeof value !== "object" || typeof value.hex !== "string") {
    throw new Error(`color.${theme}.${role} does not resolve`);
  }
  return value.hex.toLowerCase();
}

/** @param {string} hex @returns {Rgb} */
export function hexToRgb(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

/** The largest per-channel difference. @param {Rgb} a @param {Rgb} b */
export function channelDistance(a, b) {
  return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
}

/** The largest difference of x, y, width and height. @param {Frame} a @param {Frame} b */
export function frameDiff(a, b) {
  return Math.max(...a.map((value, i) => Math.abs(value - (b[i] ?? 0))));
}

/**
 * Compares the frames present on both sides; a name on one side only is reported as missing on the other.
 * `approved` is the set of "<device>-<theme>-<state>:<name>" keys the owner approved (approved.json).
 * @param {Frames} web @param {Frames} ios @param {string} key @param {Record<string, string>} approved
 */
export function compareFrames(web, ios, key, approved = {}) {
  const names = [...new Set([...Object.keys(web), ...Object.keys(ios)])].sort();
  return names.map((name) => {
    const w = web[name];
    const n = ios[name];
    const approval = approved[`${key}:${name}`];
    if (w === undefined || n === undefined) {
      return { name, web: w ?? null, ios: n ?? null, diff: null, ok: approval !== undefined, missing: w === undefined ? "web" : "ios", approval: approval ?? null };
    }
    const diff = Math.round(frameDiff(w, n) * 100) / 100;
    return { name, web: w, ios: n, diff, ok: diff <= FRAME_TOLERANCE || approval !== undefined, missing: null, approval: approval ?? null };
  });
}

/**
 * Where to sample which colour role on a screen, in points (the points plan C probes). The sky column at x 4 and
 * y 120, 300, 560 and 860 (those inside the screen), each expected as the sky gradient at that height, with the scrim
 * over it on the leave sheet (p4); the ticket's band 4 points below its top at its centre; its paper 6 points in from
 * the left and 50 down, just under the band; the sheet card 10 points in from its left edge (inside its 20 padding)
 * at half its height; a pill 14 points in at half its height. On p4 only the sky column, the sheet and its pill.
 * @param {string} state @param {Frames} frames @param {{ width: number, height: number }} screen
 * @returns {{ name: string, x: number, y: number, role: string, fraction?: number, scrim?: boolean }[]}
 */
export function probesFor(state, frames, screen) {
  const probes = [];
  for (const y of SKY_PROBE_YS) {
    if (y >= screen.height) continue;
    probes.push({ name: `sky-${y}`, x: 4, y, role: "sky", fraction: y / screen.height, scrim: state === "p4" });
  }
  if (state !== "p4") {
    const ticket = frames.ticket;
    if (ticket !== undefined) {
      probes.push({ name: "ticket band", x: ticket[0] + ticket[2] / 2, y: ticket[1] + 4, role: "accent" });
      probes.push({ name: "ticket paper", x: ticket[0] + 6, y: ticket[1] + 50, role: "surface-raised" });
    }
  }
  const sheet = frames.sheet;
  if (sheet !== undefined) probes.push({ name: "sheet", x: sheet[0] + 10, y: sheet[1] + sheet[3] / 2, role: "surface-raised" });
  for (const [title, role] of Object.entries(PILLS)) {
    const pill = frames[`pill:${title}`];
    if (pill === undefined) continue;
    if (state === "p4" && title !== "Keep playing") continue;
    probes.push({ name: `pill:${title}`, x: pill[0] + 14, y: pill[1] + pill[3] / 2, role });
  }
  return probes;
}

/** The heights of the sky column, in points. */
export const SKY_PROBE_YS = [120, 300, 560, 860];

/**
 * A colour role with its alpha, references followed: { hex, alpha }.
 * @param {any} tokens @param {"day" | "night"} theme @param {string} role
 */
export function tokenColor(tokens, theme, role) {
  let value = tokens?.color?.[theme]?.[role]?.$value;
  for (let hops = 0; typeof value === "string" && hops < 8; hops += 1) {
    const match = /^\{color\.([a-z]+)\.([a-z0-9-]+)\}$/.exec(value);
    value = match === null ? undefined : tokens.color[match[1] ?? ""]?.[match[2] ?? ""]?.$value;
  }
  if (value === undefined || typeof value !== "object" || typeof value.hex !== "string") {
    throw new Error(`color.${theme}.${role} does not resolve`);
  }
  return { hex: value.hex.toLowerCase(), alpha: typeof value.alpha === "number" ? value.alpha : 1 };
}

/**
 * The sky at a fraction of the screen height: the four sky colours mixed per channel in sRGB at the stops of
 * native.sky-stops, as the gradient draws them; with `scrim`, the theme's scrim laid over it.
 * @param {any} tokens @param {"day" | "night"} theme @param {number} fraction @param {boolean} scrim
 * @returns {string} "#rrggbb"
 */
export function skyHex(tokens, theme, fraction, scrim = false) {
  const stops = tokens?.native?.["sky-stops"];
  if (!Array.isArray(stops) || stops.length !== 4) throw new Error("no native.sky-stops in the tokens");
  const sky = ["sky-1", "sky-2", "sky-3", "sky-4"].map((role) => hexToRgb(tokenHex(tokens, theme, role)));
  const f = Math.min(1, Math.max(0, fraction));
  let i = 0;
  while (i < 2 && f > stops[i + 1]) i += 1;
  const span = stops[i + 1] - stops[i];
  const t = span === 0 ? 0 : (f - stops[i]) / span;
  /** @type {Rgb} */
  let rgb = [0, 1, 2].map((c) => Math.round(sky[i][c] + (sky[i + 1][c] - sky[i][c]) * t));
  if (scrim) {
    const over = tokenColor(tokens, theme, "scrim");
    const top = hexToRgb(over.hex);
    rgb = [0, 1, 2].map((c) => Math.round(rgb[c] * (1 - over.alpha) + top[c] * over.alpha));
  }
  return rgbToHex(rgb);
}

/**
 * Samples each probe in a screenshot of the given scale and compares it with the token (the sky with its gradient).
 * @param {import("./png.mjs").Image} image @param {number} scale
 * @param {ReturnType<typeof probesFor>} probes @param {any} tokens @param {"day" | "night"} theme
 */
export function checkColors(image, scale, probes, tokens, theme, tolerance = SCREENSHOT_TOLERANCE) {
  return probes.map((probe) => {
    const expected = probe.role === "sky" ? skyHex(tokens, theme, probe.fraction ?? 0, probe.scrim === true) : tokenHex(tokens, theme, probe.role);
    const actual = pixelAt(image, probe.x * scale, probe.y * scale);
    const distance = channelDistance(actual, hexToRgb(expected));
    return { ...probe, expected, actual: rgbToHex(actual), distance, ok: distance <= tolerance };
  });
}

/** @param {Rgb} rgb */
export function rgbToHex(rgb) {
  return `#${rgb.map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

/** Relative luminance from 0 to 1. @param {Rgb} rgb */
export function luminance(rgb) {
  const [r, g, b] = rgb.map((n) => {
    const c = n / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

/**
 * N12: in the status bar band the sky is the app theme's sky-1 and the glyphs contrast with it the way the app
 * theme asks: dark glyphs on the day sky, light glyphs on the night sky.
 * @param {import("./png.mjs").Image} image
 * @param {{ scale: number, statusBarPoints: number, theme: "day" | "night", tokens: any }} options
 */
export function statusBarCheck(image, { scale, statusBarPoints, theme, tokens }) {
  const sky = hexToRgb(tokenHex(tokens, theme, "sky-1"));
  const top = pixelAt(image, image.width * 0.3, scale);
  const rows = Math.min(image.height, Math.round(statusBarPoints * scale));
  let count = 0;
  let sum = 0;
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const rgb = pixelAt(image, x, y);
      if (channelDistance(rgb, sky) > 60) {
        count += 1;
        sum += luminance(rgb);
      }
    }
  }
  const glyphs = count === 0 ? null : sum / count;
  const background = luminance(sky);
  const skyOk = channelDistance(top, sky) <= SCREENSHOT_TOLERANCE;
  const glyphsOk = glyphs !== null && count >= 30 && (theme === "day" ? glyphs < background - 0.2 : glyphs > background + 0.2);
  return { ok: skyOk && glyphsOk, sky: rgbToHex(top), expectedSky: tokenHex(tokens, theme, "sky-1"), glyphPixels: count, glyphLuminance: glyphs, skyLuminance: background };
}

/**
 * N10: the colour of one point in every frame of a recording. Frames before the first launch or app colour (the
 * home screen, the icon zooming open) and after the last app colour (the app closing at the end of a test) are
 * left out. In between, a frame must be the launch colour or a blend from it to the app colour until the app
 * colour first shows, and the app colour from then on. Anything else is a white or mismatched frame.
 * @param {Rgb[]} colors @param {Rgb} launch @param {Rgb} app
 */
export function classifyFrames(colors, launch, app, tolerance = VIDEO_TOLERANCE) {
  const isLaunch = (/** @type {Rgb} */ c) => channelDistance(c, launch) <= tolerance;
  const isApp = (/** @type {Rgb} */ c) => channelDistance(c, app) <= tolerance;
  const first = colors.findIndex((c) => isLaunch(c) || isApp(c));
  let last = -1;
  colors.forEach((c, i) => {
    if (isApp(c)) last = i;
  });
  const firstApp = colors.findIndex(isApp);
  const problems = [];
  if (first === -1 || firstApp === -1) return { ok: false, firstApp, problems: [{ frame: -1, color: "no launch or app colour" }] };
  for (let i = first; i <= last; i += 1) {
    const c = colors[i] ?? [0, 0, 0];
    const fine = i < firstApp ? isLaunch(c) || onBlend(c, launch, app, tolerance) : isApp(c);
    if (!fine) problems.push({ frame: i, color: rgbToHex(c) });
  }
  return { ok: problems.length === 0, firstApp, problems };
}

/** Whether c lies on the straight blend from a to b, within the tolerance. @param {Rgb} c @param {Rgb} a @param {Rgb} b */
function onBlend(c, a, b, tolerance) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const length = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
  if (length === 0) return false;
  const t = Math.min(1, Math.max(0, ((c[0] - a[0]) * d[0] + (c[1] - a[1]) * d[1] + (c[2] - a[2]) * d[2]) / length));
  /** @type {Rgb} */
  const point = [a[0] + d[0] * t, a[1] + d[1] * t, a[2] + d[2] * t];
  return channelDistance(c, point) <= tolerance;
}

/**
 * The web screenshot on the left and the iOS one on the right, 16 pixels apart, each with its element frames
 * outlined: green within the tolerance, red outside it.
 * @param {import("./png.mjs").Image} web @param {import("./png.mjs").Image} ios
 * @param {ReturnType<typeof compareFrames>} frames @param {number} scale
 */
export function sideBySide(web, ios, frames, scale) {
  const gap = 16;
  const width = web.width + gap + ios.width;
  const height = Math.max(web.height, ios.height);
  const data = new Uint8Array(width * height * 4).fill(255);
  blit(data, width, web, 0);
  blit(data, width, ios, web.width + gap);
  for (const result of frames) {
    /** @type {Rgb} */
    const color = result.ok ? [0, 170, 80] : [220, 30, 30];
    if (result.web !== null) outline(data, width, height, result.web, scale, 0, color);
    if (result.ios !== null) outline(data, width, height, result.ios, scale, web.width + gap, color);
  }
  return { width, height, data };
}

/** @param {Uint8Array} data @param {number} width @param {import("./png.mjs").Image} image @param {number} left */
function blit(data, width, image, left) {
  for (let y = 0; y < image.height; y += 1) {
    data.set(image.data.subarray(y * image.width * 4, (y + 1) * image.width * 4), (y * width + left) * 4);
  }
}

/** @param {Uint8Array} data @param {number} width @param {number} height @param {Frame} frame @param {number} scale @param {number} left @param {Rgb} color */
function outline(data, width, height, frame, scale, left, color) {
  const x0 = Math.round(frame[0] * scale) + left;
  const y0 = Math.round(frame[1] * scale);
  const x1 = Math.round((frame[0] + frame[2]) * scale) + left;
  const y1 = Math.round((frame[1] + frame[3]) * scale);
  const paint = (/** @type {number} */ x, /** @type {number} */ y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    data.set([...color, 255], (y * width + x) * 4);
  };
  for (let t = 0; t < 2; t += 1) {
    for (let x = x0; x <= x1; x += 1) {
      paint(x, y0 + t);
      paint(x, y1 - t);
    }
    for (let y = y0; y <= y1; y += 1) {
      paint(x0 + t, y);
      paint(x1 - t, y);
    }
  }
}
```

- [ ] **Step 38: Run the tests.**

```bash
node --test "ios/Tools/visual-review/*.test.mjs" 2>&1 | grep -E "^ℹ (tests|pass|fail)"
```

Expected: `ℹ tests 16`, `ℹ pass 16`, `ℹ fail 0`.

- [ ] **Step 39: Keep the review's output out of git.**

Append one line to `ios/.gitignore`:

```gitignore
Tools/visual-review/out/
```

Check it:

```bash
mkdir -p ios/Tools/visual-review/out && touch ios/Tools/visual-review/out/probe
git check-ignore ios/Tools/visual-review/out/probe
rm ios/Tools/visual-review/out/probe
```

Expected: `ios/Tools/visual-review/out/probe`.

- [ ] **Step 40: Commit.**

```bash
git add ios/.gitignore ios/Tools/visual-review/png.mjs ios/Tools/visual-review/png.test.mjs ios/Tools/visual-review/compare.mjs ios/Tools/visual-review/compare.test.mjs
git commit -m "chore: add the PNG reader and the comparisons of the iOS visual review"
```

- [ ] **Step 41: Write the simulator helpers.**

`ios/Tools/visual-review/sim.mjs`:

```js
// Simulator and xcodebuild helpers shared by review.mjs and record.mjs.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

export const HERE = import.meta.dirname;
export const ROOT = resolve(HERE, "../../..");
export const OUT = join(HERE, "out");
export const BUNDLE_ID = "com.eienmosu.Truthy";
export const PROJECT = join(ROOT, "ios/Truthy/Truthy.xcodeproj");
export const DERIVED = join(OUT, "build");

/** The two review phones of spec 7.4, created on the runtime given to review.mjs. */
export const DEVICES = {
  small: {
    name: "Truthy Review SE",
    type: "com.apple.CoreSimulator.SimDeviceType.iPhone-SE-3rd-generation",
    width: 375,
    height: 667,
    scale: 2,
    statusBarPoints: 20,
  },
  large: {
    name: "Truthy Review 15 Pro Max",
    type: "com.apple.CoreSimulator.SimDeviceType.iPhone-15-Pro-Max",
    width: 430,
    height: 932,
    scale: 3,
    statusBarPoints: 54,
  },
};

/** @param {string[]} args */
export function simctl(args, { allowFailure = false } = {}) {
  const result = spawnSync("xcrun", ["simctl", ...args], { encoding: "utf8" });
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`simctl ${args.join(" ")} failed: ${result.stderr.trim()}`);
  }
  return result.stdout.trim();
}

/**
 * The UDID of the review simulator for this device on this runtime ("iOS-26-5"), created and booted when needed,
 * with a fixed status bar so screenshots compare.
 * @param {keyof typeof DEVICES} key @param {string} runtime
 */
export function ensureSimulator(key, runtime) {
  const device = DEVICES[key];
  const runtimeId = `com.apple.CoreSimulator.SimRuntime.${runtime}`;
  const list = JSON.parse(simctl(["list", "devices", "--json"]));
  const existing = (list.devices[runtimeId] ?? []).find((/** @type {{ name: string }} */ d) => d.name === device.name);
  const udid = existing?.udid ?? simctl(["create", device.name, device.type, runtimeId]);
  simctl(["boot", udid], { allowFailure: true });
  simctl(["bootstatus", udid, "-b"]);
  simctl([
    "status_bar", udid, "override", "--time", "9:41", "--dataNetwork", "wifi", "--wifiMode", "active", "--wifiBars", "3",
    "--cellularMode", "active", "--cellularBars", "4", "--batteryState", "charged", "--batteryLevel", "100",
  ]);
  return udid;
}

/** @param {string} udid @param {"light" | "dark"} appearance */
export function setAppearance(udid, appearance) {
  simctl(["ui", udid, "appearance", appearance]);
}

/** A fresh app: no progress, no theme, no journal. */
export function uninstallApp(udid) {
  simctl(["terminate", udid, BUNDLE_ID], { allowFailure: true });
  simctl(["uninstall", udid, BUNDLE_ID], { allowFailure: true });
}

/** Builds the app and its tests once for the simulator. */
export function buildForTesting() {
  execFileSync("xcodebuild", [
    "build-for-testing", "-project", PROJECT, "-scheme", "Truthy",
    "-destination", "generic/platform=iOS Simulator", "-derivedDataPath", DERIVED, "-quiet",
  ], { stdio: "inherit" });
}

/**
 * Runs one UI test of the built products on a simulator. `environment` reaches the test runner through
 * xcodebuild's TEST_RUNNER_ prefix.
 * @param {string} udid @param {string} test e.g. "TruthyUITests/VisualCaptureTests/testCaptureEveryScreen"
 * @param {Record<string, string>} environment
 */
export function runUITest(udid, test, environment) {
  const env = { ...process.env };
  for (const [key, value] of Object.entries(environment)) env[`TEST_RUNNER_${key}`] = value;
  const result = spawnSync("xcodebuild", [
    "test-without-building", "-project", PROJECT, "-scheme", "Truthy",
    "-destination", `platform=iOS Simulator,id=${udid}`, "-derivedDataPath", DERIVED,
    "-only-testing:" + test, "-quiet",
  ], { stdio: "inherit", env });
  if (result.status !== 0) throw new Error(`${test} failed on ${udid}`);
}

/** The path of the built app, for simctl install. */
export function builtApp() {
  const app = join(DERIVED, "Build/Products/Debug-iphonesimulator/Truthy.app");
  if (!existsSync(app)) throw new Error("Build the app first (review.mjs builds it)");
  return app;
}
```

- [ ] **Step 42: Write the web capture.**

It plays the same screens as `testCaptureEveryScreen` and then `testCaptureTheOtherClassesAndStartStates`, in that order on one browser context, with the web's seed fixed the way the web draws it (`crypto.getRandomValues(new Uint32Array(1))`, `components/play/useRound.ts`). `ios/Tools/visual-review/web.mjs`:

```js
// The web half of the visual review: the same twenty screens as VisualCaptureTests, in WebKit at the simulator's
// size and scale, with the round's seed fixed through crypto.getRandomValues (the web's only seed source,
// components/play/useRound.ts). Writes <state>.png and <state>.frames.json, frames in CSS pixels.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { webkit } from "@playwright/test";
import { PILLS } from "./compare.mjs";

const SETTLE_MS = 300;
const ARRIVAL_MS = 450;
const RESULT_MS = 1050;
const MOTION_MS = 1500;

/**
 * @param {{ baseUrl: string, device: { width: number, height: number, scale: number }, theme: "day" | "night",
 *   seed: number, outDir: string }} options
 */
export async function captureWeb({ baseUrl, device, theme, seed, outDir }) {
  mkdirSync(outDir, { recursive: true });
  const browser = await webkit.launch();
  try {
    const context = await browser.newContext({
      baseURL: baseUrl,
      viewport: { width: device.width, height: device.height },
      deviceScaleFactor: device.scale,
      isMobile: true,
      hasTouch: true,
      colorScheme: theme === "day" ? "light" : "dark",
      reducedMotion: "no-preference",
      serviceWorkers: "block",
    });
    await context.addInitScript((fixed) => {
      const original = crypto.getRandomValues.bind(crypto);
      crypto.getRandomValues = (array) => {
        if (array instanceof Uint32Array && array.length === 1) {
          array[0] = fixed;
          return array;
        }
        return original(array);
      };
    }, seed);
    const page = await context.newPage();
    const capture = async (/** @type {string} */ state) => {
      await page.waitForTimeout(MOTION_MS);
      await page.screenshot({ path: join(outDir, `${state}.png`) });
      writeFileSync(join(outDir, `${state}.frames.json`), `${JSON.stringify(await webFrames(page), null, 2)}\n`);
    };
    const atStep = async (/** @type {string} */ title) => {
      await page.locator("[data-step]:not([inert]) h2", { hasText: title }).waitFor();
      await page.waitForTimeout(SETTLE_MS);
    };
    const choose = async (/** @type {string} */ prefix) => {
      await page.getByRole("button", { name: new RegExp("^" + escapeRegExp(prefix)) }).first().click();
    };
    const button = (/** @type {string} */ name) => page.getByRole("button", { name, exact: true }).first();
    const tapWhenReady = async (/** @type {string} */ name) => {
      await button(name).waitFor();
      await page.waitForTimeout(ARRIVAL_MS);
      await button(name).click();
    };
    const waitForQuestion = async () => {
      await button("True").waitFor();
      await page.getByRole("button", { name: /^(Next card|See results)$/ }).waitFor({ state: "detached" });
      await page.waitForTimeout(SETTLE_MS);
    };

    await page.goto("/");
    await atStep("Choose an area");
    await capture("s1");
    await choose("Cloud, ");
    await atStep("Choose a platform");
    await capture("s2");
    await choose("AWS, ");
    await atStep("Choose a deck");
    await capture("s3");
    await choose("CLF, ");
    await atStep("Choose a section");
    await capture("s4");
    await choose("SEC, ");
    await atStep("Choose how to play");
    await capture("s5");
    await choose("Classic. ");
    await atStep("Your pass is ready");
    await capture("s6");

    await button("Start round").click();
    await page.waitForURL(/\/play$/);
    await waitForQuestion();
    await capture("p2");
    await button("True").click();
    await button("Next card").waitFor();
    await capture("p3");
    await button("Leave round").click();
    await page.getByRole("dialog").waitFor();
    await capture("p4");
    await page.getByRole("dialog").getByRole("button", { name: "Keep playing" }).click();
    await page.getByRole("dialog").waitFor({ state: "detached" });
    await tapWhenReady("Next card");
    for (let number = 2; number <= 10; number += 1) {
      await waitForQuestion();
      await button("True").click();
      await tapWhenReady(number === 10 ? "See results" : "Next card");
    }
    await page.getByRole("heading", { name: "Round complete" }).waitFor();
    await capture("r1");

    // The screens one Classic round does not reach, as testCaptureTheOtherClassesAndStartStates plays them.
    const atResult = () => page.getByRole("heading", { name: "Round complete" }).waitFor();
    const closeResults = async () => {
      await page.waitForTimeout(RESULT_MS);
      await button("Close results").click();
      await atStep("Choose an area");
    };
    const chooseClf = async (/** @type {string} */ mode) => {
      await choose("Cloud, ");
      await atStep("Choose a platform");
      await choose("AWS, ");
      await atStep("Choose a deck");
      await choose("CLF, ");
      await atStep("Choose a section");
      await choose("SEC, ");
      await atStep("Choose how to play");
      await choose(mode);
      await atStep("Your pass is ready");
      await button("Start round").click();
      await page.waitForURL(/\/play$/);
    };

    await closeResults();
    for (const [mode, name] of [["Streak. ", "streak"], ["Three lives. ", "lives"]]) {
      await chooseClf(mode);
      await waitForQuestion();
      await capture(`${name}-p2`);
      for (;;) {
        await waitForQuestion();
        await button("True").click();
        await page.getByRole("button", { name: /^(Next card|See results)$/ }).waitFor();
        if ((await page.getByRole("button", { name: "See results", exact: true }).count()) > 0) break;
        await tapWhenReady("Next card");
      }
      await tapWhenReady("See results");
      await atResult();
      await capture(`${name}-r1`);
      if (name === "lives") {
        await page.getByRole("button", { name: /^Why, card / }).first().click();
        await capture("lives-r1-why");
      }
      await closeResults();
    }

    await chooseClf("Timed. ");
    await waitForQuestion();
    await capture("timed-p2");
    await button("True").click();
    await button("See results").waitFor({ timeout: 75_000 });
    await capture("timed-up");
    await tapWhenReady("See results");
    await atResult();
    await capture("timed-r1");
    await closeResults();

    // A second deck played and left with one answer: step 1 then shows Recent (two decks) and Continue.
    await choose("Cloud, ");
    await atStep("Choose a platform");
    await choose("Google Cloud, ");
    await atStep("Choose a deck");
    await choose("CDL, ");
    await atStep("Choose how to play");
    await choose("Classic. ");
    await atStep("Your pass is ready");
    await button("Start round").click();
    await page.waitForURL(/\/play$/);
    await waitForQuestion();
    await button("True").click();
    await page.getByRole("button", { name: /^(Next card|See results)$/ }).waitFor();
    await button("Leave round").click();
    await page.getByRole("dialog").getByRole("button", { name: "Leave round" }).click();
    await atStep("Choose an area");
    await capture("s1-returning");
    await choose("Recent, ");
    await atStep("Choose a deck");
    await capture("s3-recent");
  } finally {
    await browser.close();
  }
}

/** @param {string} text */
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The web's element rectangles under the names of ReviewName in the app (ios/Truthy/Truthy/Debug/ReviewFrames.swift).
 * @param {import("@playwright/test").Page} page
 */
async function webFrames(page) {
  /** @type {[string, import("@playwright/test").Locator][]} */
  const named = [
    ["logo", page.getByRole("heading", { level: 1, name: "Truthy" })],
    ["pass", page.locator("[data-fill-in-pass]")],
    ["ticket", page.locator("[data-boarding-pass]")],
    ["card", page.locator("[data-swipe-card]")],
    ["stub", page.locator("[data-stub]")],
    ["sheet", page.getByRole("dialog")],
    ...Object.keys(PILLS).map((title) => /** @type {[string, import("@playwright/test").Locator]} */ ([`pill:${title}`, page.getByRole("button", { name: title, exact: true })])),
  ];
  /** @type {Record<string, number[]>} */
  const frames = {};
  for (const [name, locator] of named) {
    const first = locator.first();
    if ((await locator.count()) === 0 || !(await first.isVisible())) continue;
    const box = await first.boundingBox();
    if (box === null) continue;
    frames[name] = [box.x, box.y, box.width, box.height].map((n) => Math.round(n * 100) / 100);
  }
  return Object.fromEntries(Object.entries(frames).sort(([a], [b]) => (a < b ? -1 : 1)));
}
```

- [ ] **Step 43: Write the review script and the empty approval list.**

`ios/Tools/visual-review/review.mjs`:

```js
// The visual review of spec 7.4. Captures every review screen on the iOS simulator (small and large phone, day and
// night, default and largest text) and on the web in WebKit at the same size, compares element frames with the
// web's and colours with the resolved tokens, checks the status bar against the system theme (N12), and writes
// side-by-side pairs and a report under ios/Tools/visual-review/out/<runtime>/ (ignored by git).
//
// Usage, from the repository root, with the web app running (pnpm build && pnpm start --port 3100):
//   node ios/Tools/visual-review/review.mjs [--web http://localhost:3100] [--seed 1234567] [--runtime iOS-26-5]
//                                          [--skip-build] [--skip-capture]
// Exits 1 when a frame or colour is outside its tolerance and not in approved.json.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { STATES, checkColors, compareFrames, probesFor, sideBySide, statusBarCheck } from "./compare.mjs";
import { decodePng, encodePng } from "./png.mjs";
import { DEVICES, HERE, OUT, ROOT, buildForTesting, ensureSimulator, runUITest, setAppearance, uninstallApp } from "./sim.mjs";
import { captureWeb } from "./web.mjs";

const { values } = parseArgs({
  options: {
    web: { type: "string", default: "http://localhost:3100" },
    seed: { type: "string", default: "1234567" },
    runtime: { type: "string", default: "iOS-26-5" },
    "skip-build": { type: "boolean", default: false },
    "skip-capture": { type: "boolean", default: false },
  },
});
const seed = Number(values.seed);
const tokens = JSON.parse(readFileSync(join(ROOT, "native-data/tokens/resolved.json"), "utf8"));
const approved = JSON.parse(readFileSync(join(HERE, "approved.json"), "utf8"));
const THEMES = /** @type {const} */ (["day", "night"]);
const RUN = join(OUT, values.runtime);
const appearanceOf = (/** @type {"day" | "night"} */ theme) => (theme === "day" ? "light" : "dark");

/** Reads a screenshot as sRGB pixels: a file with an ICC profile is converted with sips first. */
function readScreenshot(/** @type {string} */ path) {
  let image = decodePng(readFileSync(path));
  if (image.profile === "icc") {
    const converted = path.replace(/\.png$/, ".srgb.png");
    const result = spawnSync("sips", ["--matchTo", "/System/Library/ColorSync/Profiles/sRGB Profile.icc", path, "--out", converted]);
    if (result.status !== 0) throw new Error(`sips could not convert ${path}`);
    image = decodePng(readFileSync(converted));
  }
  return image;
}

function readJson(/** @type {string} */ path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

if (!values["skip-capture"]) {
  rmSync(join(RUN, "ios"), { recursive: true, force: true });
  rmSync(join(RUN, "web"), { recursive: true, force: true });
  if (!values["skip-build"]) buildForTesting();
  for (const [key, device] of Object.entries(DEVICES)) {
    const udid = ensureSimulator(/** @type {keyof typeof DEVICES} */ (key), values.runtime);
    for (const theme of THEMES) {
      for (const text of ["default", "largest"]) {
        uninstallApp(udid);
        setAppearance(udid, appearanceOf(theme));
        const settings = {
          TRUTHY_REVIEW_OUT: join(RUN, "ios", key, `${theme}-${text}`),
          TRUTHY_REVIEW_SEED: String(seed),
          TRUTHY_REVIEW_TEXT: text,
        };
        runUITest(udid, "TruthyUITests/VisualCaptureTests/testCaptureEveryScreen", settings);
        // The same install goes on with the other classes and a returning player's start, as web.mjs does.
        runUITest(udid, "TruthyUITests/VisualCaptureTests/testCaptureTheOtherClassesAndStartStates", settings);
      }
      // N12: the stored theme is this one, the system the other.
      uninstallApp(udid);
      setAppearance(udid, theme === "day" ? "dark" : "light");
      runUITest(udid, "TruthyUITests/VisualCaptureTests/testCaptureTheStoredThemeAgainstTheSystem", {
        TRUTHY_REVIEW_OUT: join(RUN, "ios", key, "flip"),
        TRUTHY_REVIEW_SEED: String(seed),
        TRUTHY_REVIEW_FLIP: appearanceOf(theme),
      });
      await captureWeb({ baseUrl: values.web, device, theme, seed, outDir: join(RUN, "web", key, theme) });
    }
  }
}

mkdirSync(join(RUN, "pairs"), { recursive: true });
const report = { frames: [], colors: [], flips: [], largest: [] };
let failures = 0;
for (const [key, device] of Object.entries(DEVICES)) {
  for (const theme of THEMES) {
    for (const state of STATES) {
      const iosDir = join(RUN, "ios", key, `${theme}-default`);
      const webDir = join(RUN, "web", key, theme);
      const pairKey = `${key}-${theme}-${state}`;
      if (!existsSync(join(iosDir, `${state}.png`)) || !existsSync(join(webDir, `${state}.png`))) {
        report.frames.push({ pair: pairKey, name: "(screen)", ok: false, missing: "capture" });
        failures += 1;
        continue;
      }
      const iosImage = readScreenshot(join(iosDir, `${state}.png`));
      const webImage = readScreenshot(join(webDir, `${state}.png`));
      const iosFrames = readJson(join(iosDir, `${state}.frames.json`));
      const webFrames = readJson(join(webDir, `${state}.frames.json`));
      const frames = compareFrames(webFrames, iosFrames, pairKey, approved);
      const screen = { width: device.width, height: device.height };
      const colors = [
        ...checkColors(iosImage, device.scale, probesFor(state, iosFrames, screen), tokens, theme).map((c) => ({ side: "ios", ...c })),
        ...checkColors(webImage, device.scale, probesFor(state, webFrames, screen), tokens, theme).map((c) => ({ side: "web", ...c })),
      ].map((c) => ({ ...c, ok: c.ok || approved[`${pairKey}:color:${c.side}:${c.name}`] !== undefined }));
      for (const f of frames) report.frames.push({ pair: pairKey, ...f });
      for (const c of colors) report.colors.push({ pair: pairKey, ...c });
      failures += frames.filter((f) => !f.ok).length + colors.filter((c) => !c.ok).length;
      writeFileSync(join(RUN, "pairs", `${pairKey}.png`), encodePng(sideBySide(webImage, iosImage, frames, device.scale)));
      report.largest.push(join("ios", key, `${theme}-largest`, `${state}.png`));
    }
    const flipPath = join(RUN, "ios", key, "flip", `flip-${appearanceOf(theme)}.png`);
    const flip = existsSync(flipPath)
      ? statusBarCheck(readScreenshot(flipPath), { scale: device.scale, statusBarPoints: device.statusBarPoints, theme, tokens })
      : { ok: false, missing: "capture" };
    report.flips.push({ device: key, theme, ...flip });
    if (!flip.ok) failures += 1;
  }
}

writeFileSync(join(RUN, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(join(RUN, "report.md"), markdown(report));
console.log(`${report.frames.length} frames, ${report.colors.length} colours, ${report.flips.length} theme checks: ${failures} outside tolerance`);
console.log(`Pairs in ios/Tools/visual-review/out/${values.runtime}/pairs, report in ios/Tools/visual-review/out/${values.runtime}/report.md`);
process.exitCode = failures === 0 ? 0 : 1;

function markdown(/** @type {typeof report} */ r) {
  const lines = ["# Visual review", "", "## Frames (points, tolerance 2)", "", "| Pair | Element | Web | iOS | Diff | OK |", "|---|---|---|---|---|---|"];
  for (const f of r.frames) {
    lines.push(`| ${f.pair} | ${f.name} | ${JSON.stringify(f.web ?? null)} | ${JSON.stringify(f.ios ?? null)} | ${f.diff ?? f.missing ?? ""} | ${f.ok ? "yes" : "NO"} |`);
  }
  lines.push("", "## Colours (tolerance 3 per channel)", "", "| Pair | Side | Probe | Token | Expected | Actual | OK |", "|---|---|---|---|---|---|---|");
  for (const c of r.colors) lines.push(`| ${c.pair} | ${c.side} | ${c.name} | ${c.role} | ${c.expected} | ${c.actual} | ${c.ok ? "yes" : "NO"} |`);
  lines.push("", "## N12: stored theme against the opposite system appearance", "", "| Device | App theme | Sky | Glyph pixels | OK |", "|---|---|---|---|---|");
  for (const f of r.flips) lines.push(`| ${f.device} | ${f.theme} | ${f.sky ?? ""} | ${f.glyphPixels ?? ""} | ${f.ok ? "yes" : "NO"} |`);
  lines.push("", "## N9: largest text size (review by eye)", "");
  for (const path of r.largest) lines.push(`- ${path}`);
  return `${lines.join("\n")}\n`;
}
```

`ios/Tools/visual-review/approved.json`:

```json
{}
```

- [ ] **Step 44: Write the frame sampler and the recording script.**

`ios/Tools/visual-review/frames.swift`:

```swift
// Prints the colour of one pixel in every frame of a simulator recording, 60 frames a second, one JSON array
// [r, g, b] per line, in sRGB. Feel item N10 reads it (record.mjs).
// Usage: swift ios/Tools/visual-review/frames.swift <video> <x pixels> <y pixels>
import AVFoundation
import CoreGraphics
import Foundation

let arguments = CommandLine.arguments
guard arguments.count == 4, let x = Int(arguments[2]), let y = Int(arguments[3]) else {
    FileHandle.standardError.write(Data("usage: swift frames.swift <video> <x pixels> <y pixels>\n".utf8))
    exit(2)
}

let asset = AVURLAsset(url: URL(fileURLWithPath: arguments[1]))
let generator = AVAssetImageGenerator(asset: asset)
generator.requestedTimeToleranceBefore = .zero
generator.requestedTimeToleranceAfter = .zero
generator.appliesPreferredTrackTransform = true
guard let space = CGColorSpace(name: CGColorSpace.sRGB) else { exit(1) }

let duration = try await asset.load(.duration)
let step = CMTime(value: 1, timescale: 60)
var time = CMTime.zero
while time < duration {
    let image = try await generator.image(at: time).image
    var pixel: [UInt8] = [0, 0, 0, 0]
    pixel.withUnsafeMutableBytes { bytes in
        guard let context = CGContext(
            data: bytes.baseAddress, width: 1, height: 1, bitsPerComponent: 8, bytesPerRow: 4, space: space,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { return }
        // Core Graphics counts rows from the bottom: row y from the top lands on the context's only row.
        context.draw(image, in: CGRect(x: -x, y: y - image.height + 1, width: image.width, height: image.height))
    }
    print("[\(pixel[0]),\(pixel[1]),\(pixel[2])]")
    time = CMTimeAdd(time, step)
}
```

`ios/Tools/visual-review/record.mjs`:

```js
// Screen recordings for the feel checklist (spec 5.8), written to ios/Tools/visual-review/out/recordings/.
//
//   node ios/Tools/visual-review/record.mjs test --device large --test <TruthyUITests/Class/method> --name <file>
//       records the simulator while one UI test runs (N1, N3, N5, N13)
//   node ios/Tools/visual-review/record.mjs launch --device large --system light --app dark
//       N10 at launch: stores the app theme against the system appearance, then records a cold launch and checks
//       every frame: the launch screen in the system's surface colour, then the app in its stored theme's sky
//   node ios/Tools/visual-review/record.mjs between --device large --theme day
//       N10 between screens: records start flow, round and back, and checks that no frame leaves the sky colour
//
// test needs the app built (review.mjs builds it, or pass --build). Every command takes --runtime (iOS-26-5).
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { classifyFrames, hexToRgb, tokenHex } from "./compare.mjs";
import { BUNDLE_ID, DEVICES, HERE, OUT, ROOT, buildForTesting, ensureSimulator, runUITest, setAppearance, simctl, uninstallApp } from "./sim.mjs";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    device: { type: "string", default: "large" },
    runtime: { type: "string", default: "iOS-26-5" },
    test: { type: "string" },
    name: { type: "string" },
    system: { type: "string", default: "light" },
    app: { type: "string", default: "dark" },
    theme: { type: "string", default: "day" },
    build: { type: "boolean", default: false },
  },
});
const mode = positionals[0];
const key = /** @type {keyof typeof DEVICES} */ (values.device);
const device = DEVICES[key];
if (device === undefined) throw new Error(`--device is small or large, not ${values.device}`);
const recordings = join(OUT, "recordings");
mkdirSync(recordings, { recursive: true });
if (values.build) buildForTesting();
const udid = ensureSimulator(key, values.runtime);
const tokens = JSON.parse(readFileSync(join(ROOT, "native-data/tokens/resolved.json"), "utf8"));

/** Starts a recording and resolves once simctl reports its first frame; the returned function stops it. */
async function startRecording(/** @type {string} */ file) {
  const child = spawn("xcrun", ["simctl", "io", udid, "recordVideo", "--codec=h264", "--mask=ignored", "--force", file]);
  await new Promise((resolve, reject) => {
    child.stderr.on("data", (chunk) => {
      if (String(chunk).includes("Recording started")) resolve(undefined);
    });
    child.on("exit", (code) => reject(new Error(`recordVideo ended early (${code})`)));
  });
  return () =>
    new Promise((resolve) => {
      child.removeAllListeners("exit");
      child.on("exit", () => resolve(undefined));
      child.kill("SIGINT");
    });
}

/** The colour of the pixel at (2, 2) points in every frame of a recording. */
function frameColors(/** @type {string} */ file) {
  const px = String(2 * device.scale);
  const result = spawnSync("xcrun", ["swift", join(HERE, "frames.swift"), file, px, px], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`frames.swift failed: ${result.stderr}`);
  return result.stdout.trim().split("\n").map((line) => /** @type {[number, number, number]} */ (JSON.parse(line)));
}

const sleep = (/** @type {number} */ ms) => new Promise((resolve) => setTimeout(resolve, ms));
const asTheme = (/** @type {string} */ appearance) => (appearance === "light" ? "day" : "night");

function check(/** @type {string} */ file, /** @type {string} */ launchHex, /** @type {string} */ appHex) {
  const result = classifyFrames(frameColors(file), hexToRgb(launchHex), hexToRgb(appHex));
  writeFileSync(file.replace(/\.mov$/, ".json"), `${JSON.stringify({ launch: launchHex, app: appHex, ...result }, null, 2)}\n`);
  console.log(`${file}: ${result.ok ? "no white or mismatched frame" : `${result.problems.length} bad frames`} (app from frame ${result.firstApp})`);
  process.exitCode = result.ok ? 0 : 1;
}

if (mode === "test") {
  if (values.test === undefined || values.name === undefined) throw new Error("test needs --test and --name");
  const file = join(recordings, `${values.name}.mov`);
  const stop = await startRecording(file);
  try {
    runUITest(udid, values.test, {});
  } finally {
    await stop();
  }
  console.log(`Recorded ${file}`);
} else if (mode === "launch") {
  const system = values.system === "dark" ? "dark" : "light";
  const app = values.app === "dark" ? "dark" : "light";
  uninstallApp(udid);
  setAppearance(udid, app === "dark" ? "light" : "dark");
  runUITest(udid, "TruthyUITests/VisualCaptureTests/testCaptureTheStoredThemeAgainstTheSystem", {
    TRUTHY_REVIEW_OUT: join(OUT, "ios", key, "flip"),
    TRUTHY_REVIEW_FLIP: app,
  });
  simctl(["terminate", udid, BUNDLE_ID], { allowFailure: true });
  setAppearance(udid, system);
  await sleep(1000);
  const file = join(recordings, `N10-launch-${key}-system-${system}-app-${app}.mov`);
  const stop = await startRecording(file);
  await sleep(500);
  simctl(["launch", udid, BUNDLE_ID]);
  await sleep(4000);
  await stop();
  check(file, tokenHex(tokens, asTheme(system), "surface"), tokenHex(tokens, asTheme(app), "sky-1"));
} else if (mode === "between") {
  const theme = values.theme === "night" ? "night" : "day";
  uninstallApp(udid);
  setAppearance(udid, theme === "day" ? "light" : "dark");
  const file = join(recordings, `N10-between-${key}-${theme}.mov`);
  const stop = await startRecording(file);
  try {
    runUITest(udid, "TruthyUITests/VisualCaptureTests/testSwapScreensForTheRecording", {
      TRUTHY_REVIEW_OUT: join(OUT, "ios", key, "between"),
    });
  } finally {
    await stop();
  }
  check(file, tokenHex(tokens, theme, "surface"), tokenHex(tokens, theme, "sky-1"));
} else {
  throw new Error("record.mjs test | launch | between");
}
```

- [ ] **Step 45: Write the scripts' README.**

`ios/Tools/visual-review/README.md`:

````markdown
# Visual review and feel recordings (iOS)

The scripts of spec 7.4 and 5.8 for the iOS app. They need Node 24, Xcode 26.6 with the iOS 26.5 (and 18.4) simulator runtime, the repository's `node_modules` (`pnpm install`) and Playwright's WebKit (`pnpm exec playwright install webkit`). Everything they write goes to `out/`, which git ignores.

## Visual review

Start the web app in one terminal, the production build as the e2e specs use it:

```bash
pnpm build && pnpm start --port 3100
```

Then, from the repository root:

```bash
node ios/Tools/visual-review/review.mjs --runtime iOS-26-5
```

It builds the app for testing once, creates and boots two simulators on that runtime ("Truthy Review SE", 375 by 667 at 2x, and "Truthy Review 15 Pro Max", 430 by 932 at 3x) with a fixed status bar, and for each phone and theme:

1. installs the app fresh and runs `VisualCaptureTests/testCaptureEveryScreen`: start steps 1 to 6, the question, the answered card, the leave sheet and the result of a Classic round on CLF / SEC, every card answered True, with the round seed fixed (`--seed`, default 1234567, the seed plan C's review uses too); once at the default text size and once at the largest accessibility size;
2. runs `VisualCaptureTests/testCaptureTheStoredThemeAgainstTheSystem` with the system appearance opposite to the theme (N12);
3. captures the same ten screens of the web in WebKit at the same size and scale, with the same seed.

It then compares, for each pair:

- element frames (`logo`, `pass`, `ticket`, `card`, `stub`, `sheet` and the pills `pill:<title>`), which must be within 2 points of the web's;
- colours at fixed points (the sky column at x 4, the ticket's band and paper, the sheet card, each pill) against `native-data/tokens/resolved.json` (the sky as its gradient at that height, under the scrim on the leave sheet), within 3 per channel, on both sides;
- the status bar of the N12 captures: the sky is the app theme's `sky-1` and the glyphs are dark on the day sky and light on the night sky.

Output in `out/<runtime>/`: `pairs/<phone>-<theme>-<screen>.png` (the web left, iOS right, frames outlined green within tolerance and red outside it), `report.md`, `report.json`, and the largest-text screenshots under `ios/<phone>/<theme>-largest/` for N9. The script exits 1 while anything is outside its tolerance and not approved.

`--skip-build` reuses the last build, `--skip-capture` only compares what `out/<runtime>/` already holds.

### Approved differences

A difference the owner accepts (criterion 2: system insets, sheet chrome, the in-app browser) is recorded in `approved.json`, keyed `<phone>-<theme>-<screen>:<element>` for a frame and `<phone>-<theme>-<screen>:color:<ios|web>:<probe>` for a colour, with the owner's reason and the date as the value. Only the owner approves; the same decisions are listed in `ios/docs/visual-review.md`.

## Recordings

```bash
node ios/Tools/visual-review/record.mjs test --device large --test TruthyUITests/FeelTests/testBackOnTheRoundActsLikeTheX --name N13-back-26
node ios/Tools/visual-review/record.mjs launch --device large --system light --app dark
node ios/Tools/visual-review/record.mjs between --device large --theme night
```

`test` records the simulator while one UI test runs. `launch` stores one app theme against a system appearance, then records a cold launch; `between` records a start flow, a round and the way back. Both check every frame at 2 points from the top left corner (`frames.swift`): first the launch screen in the system's `surface` colour or a blend from it, then only the app's `sky-1`; a white or mismatched frame fails and is listed in the `.json` next to the recording. All recordings go to `out/recordings/`. `--runtime` picks the simulator runtime, `--build` builds first.

## Tests

```bash
node --test "ios/Tools/visual-review/*.test.mjs"
```
````

- [ ] **Step 46: Check the scripts.**

```bash
for f in sim web review record; do node --check "ios/Tools/visual-review/$f.mjs" && echo "$f ok"; done
xcrun swiftc -typecheck -swift-version 6 ios/Tools/visual-review/frames.swift && echo "frames ok"
node --test "ios/Tools/visual-review/*.test.mjs" 2>&1 | grep -E "^ℹ (pass|fail)"
```

Expected: `sim ok`, `web ok`, `review ok`, `record ok`, `frames ok`, `ℹ pass 16`, `ℹ fail 0`.

- [ ] **Step 47: Commit.**

```bash
git add ios/Tools/visual-review/sim.mjs ios/Tools/visual-review/web.mjs ios/Tools/visual-review/review.mjs ios/Tools/visual-review/approved.json ios/Tools/visual-review/frames.swift ios/Tools/visual-review/record.mjs ios/Tools/visual-review/README.md
git commit -m "chore: add the iOS visual review and the feel recording scripts"
pnpm vitest run tests/repo-hygiene.test.ts 2>&1 | tail -3
```

Expected: the commit, then the hygiene test passing over the committed files (it scans tracked files only; the new files hold no local path, no e-mail-shaped string and no em dash).

- [ ] **Step 48: Get the web ready.**

```bash
pnpm exec playwright install webkit
pnpm build && pnpm start --port 3100
```

Run the second line in its own terminal (or in the background) and leave it running. Expected: `pnpm start` prints that it is ready on `http://localhost:3100`; `curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3100/` prints `200`.

- [ ] **Step 49: Write the review record.**

`ios/docs/visual-review.md`, filled in by the steps that follow:

```markdown
# iOS visual review

The result of `ios/Tools/visual-review/review.mjs` (spec 7.4, success criterion 2) and the owner's decision on every difference outside the tolerances. The pairs and the full report are in `ios/Tools/visual-review/out/<runtime>/` (ignored by git); `approved.json` in the same folder as the script holds the approved keys.

## Runs

| Runtime | Commit | Frames | Colours | Theme checks | Outside tolerance | Approved |
|---|---|---|---|---|---|---|
| iOS 26.5 | not run yet | | | | | |
| iOS 18.4 | not run yet | | | | | |

## Differences

| Key | Web | iOS | What it is | Decision |
|---|---|---|---|---|

## Reviews

- Opus reviewer: not run yet.
- Owner: not run yet.
```

- [ ] **Step 50: Run the visual review on iOS 26.5.**

```bash
node ios/Tools/visual-review/review.mjs --runtime iOS-26-5; echo "exit $?"
ls ios/Tools/visual-review/out/iOS-26-5/pairs | wc -l
```

Expected, after about 60 minutes (each Timed capture waits out its minute): the build, twenty UI test runs (two phones, two themes, two text sizes, the two capture tests each, and the two N12 runs per phone), four web captures, then a line of the form `<f> frames, <c> colours, 4 theme checks: <n> outside tolerance` (one frame row per name seen on either side of a pair, one colour row per probe and side), the pairs line, `exit 0` or `exit 1`, and `80` pairs (20 states, 2 phones, 2 themes). A UI test that fails stops the run with its name: that is a defect of the screen it was on, handled as in step 20.

- [ ] **Step 51: Sort every difference.**

Open `ios/Tools/visual-review/out/iOS-26-5/report.md` and the pairs it names. For each row marked `NO`:

1. A web colour outside the tolerance means the probe sits on something else on that screen (text, a notch, a shadow): move that probe in `probesFor` (and its test in `compare.test.mjs`), commit as `fix: ...`, rerun with `--skip-capture`.
2. An iOS frame or colour that differs from a correct web value, or an N12 check that fails, is a defect of the task that owns the view: fix it there with a test, commit as `fix: ...`, rerun `review.mjs --skip-build` (the app changed, so capture again).
3. What remains is a difference the spec expects the owner to judge (criterion 2: system insets, sheet chrome, the in-app browser) or one you cannot settle. List each in the "Differences" table of `ios/docs/visual-review.md` with its key, both values and what it is; leave the decision cell empty.

Expected: every `NO` row is either fixed or listed.

- [ ] **Step 52: Have the pairs reviewed by an Opus reviewer.**

Dispatch a reviewer subagent (most capable tier) with: spec sections 5.6, 6 and 7.4, reference sections 4.5, 5.1 to 5.6, the folder `ios/Tools/visual-review/out/iOS-26-5/pairs`, the largest-text screenshots under `ios/Tools/visual-review/out/iOS-26-5/ios/*/*-largest/`, and the report. Ask for every visible difference between the web (left) and iOS (right) beyond the outlined frames (type, weight, line breaks, icons, shadows, spacing), every clipped or overlapping text in the largest-text screenshots (N9), and anything that looks like a web page in a frame (spec 5.7). Treat each finding as in step 51 (fix, or list for the owner) and write the reviewer's summary under "Reviews" in `ios/docs/visual-review.md`.

- [ ] **Step 53: Get the owner's decisions.**

Send the owner the pairs, the largest-text screenshots and the "Differences" table, and wait for an answer on every row. For each difference the owner accepts, add its key to `ios/Tools/visual-review/approved.json` with the owner's reason and the date as the value, and fill in its decision cell; fix each one the owner rejects as in step 51. Then:

```bash
node ios/Tools/visual-review/review.mjs --runtime iOS-26-5 --skip-capture; echo "exit $?"
```

Expected: `... 0 outside tolerance` and `exit 0`. Fill in the iOS 26.5 row of the "Runs" table (commit, counts, approved count) and the owner's line under "Reviews".

- [ ] **Step 54: Run the visual review on iOS 18.4.**

```bash
node ios/Tools/visual-review/review.mjs --runtime iOS-18-4 --skip-build; echo "exit $?"
```

Expected: the same shape of output for the 18.4 simulators. Handle its `NO` rows as in steps 51 and 53 (the sheet and the status bar differ most between 18 and 26) until it prints `0 outside tolerance` and `exit 0`, and fill in the iOS 18.4 row.

- [ ] **Step 55: Write the feel checklist.**

`ios/docs/feel-checklist.md`:

```markdown
# iOS feel checklist

The feel checklist of the design spec (`docs/superpowers/specs/2026-10-14-truthy-native-apps-design.md`, section 5.8), checked on iOS by the method the spec names for each item. Every result names the OS version and the simulator or device it was checked on, and the evidence: a UI test, a screenshot or a recording.

Recordings and screenshots live in `ios/Tools/visual-review/out/` (ignored by git) and go to the owner with the review; the file names below are relative to that folder. The last column will name the item of task 16's device checklist (`ios/Tools/device/DEVICE-CHECKLIST.md`) that checks the same thing on the owner's iPhone 15 Pro Max; task 16 fills it in when it writes that checklist, and records the result there.

How to produce the evidence:

- UI tests: `xcodebuild test -project ios/Truthy/Truthy.xcodeproj -scheme Truthy -destination "platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5"` and the same with `name=iPhone 16 Pro,OS=18.4`.
- Recordings of a UI test: `node ios/Tools/visual-review/record.mjs test --runtime <runtime> --device large --test <TruthyUITests/Class/method> --name <name>`.
- N10: `node ios/Tools/visual-review/record.mjs launch` and `record.mjs between` (each writes a `.json` verdict next to its recording).
- N9 and N12: `node ios/Tools/visual-review/review.mjs --runtime iOS-18-4` and `--runtime iOS-26-5` (the last two sections of `out/<runtime>/report.md`).

| # | Check | Method on iOS | iOS 18.4 simulator | iOS 26.5 simulator | Device item (task 16) |
|---|---|---|---|---|---|
| N1 | The edge swipe (and the anywhere swipe on iOS 26 and later) scrubs every one-step back and cancels cleanly | `StartStoryTests` edge and anywhere tests, `FeelTests/testABackBetweenStagesKeepsThePassHeightContinuous` (the pass morph follows the finger), recordings `recordings/N1-edge-18.mov`, `recordings/N1-edge-26.mov`, `recordings/N1-anywhere-26.mov` | not checked | not checked | see task 16 |
| N2 | Back on step 1 plays the system back-to-home animation | Android only | not applicable | not applicable | not applicable |
| N3 | A vertical drag scrolls the ticket with bounce, a horizontal drag moves the card, a diagonal drag does one or the other, never both | task 13's UI tests, `FeelTests/testDragDirectionsForTheRecording`, recording `recordings/N3-N5-drags-26.mov` | not checked | not checked | see task 16 |
| N4 | The card offset equals the finger travel within 1 pt at 10 sampled frames | `FeelTests/testTheCardFollowsTheFingerWithinOnePoint` | not checked | not checked | see task 16 |
| N5 | Release springs with the finger's velocity; a touch catches a springing card | recording `recordings/N3-N5-drags-26.mov` (release); the catch needs a real finger | not checked | not checked | see task 16 |
| N6 | One haptic per crossing of the 90 line, none per move | task 13's unit test on the trigger count; the simulator plays no haptics | not checked | not checked | see task 16 |
| N7 | Swipe down, scrim and back on the leave sheet keep playing; the Timed clock keeps running under it; a double tap on the X leaves the sheet open | task 14's UI tests | not checked | not checked | see task 16 |
| N8 | No tap highlight, no selection or menu on long press, no focus ring after a tap | `FeelTests/testALongPressShowsNoMenuAndSelectsNothing` and its kept screenshot | not checked | not checked | not applicable |
| N9 | Text at the largest accessibility size never clips, on every screen | `StartFlowLargeTextTests` (task 12), `StartStoryTests/testTheContinueLineShowsTheWholeDeckNameAtTheLargestTextSize`, `review.mjs` largest text screenshots, every screen by eye | not checked | not checked | see task 16 |
| N10 | No white or mismatched frame at launch or between screens, day and night | `record.mjs launch` (system light and dark, each with the app light and dark) and `record.mjs between` (day and night), every frame checked | not checked | not checked | see task 16 |
| N11 | Source links open in the in-app browser | `RoundStoryTests/testTheSourceLinkOpensInTheInAppBrowser` | not checked | not checked | see task 16 |
| N12 | Bars follow the app theme, not the system theme | `review.mjs` status bar check with the app and system themes opposite | not checked | not checked | see task 16 |
| N13 | Back on the round shrinks the surface and acts like the X; on the result it acts like Close results after 1000 ms | `FeelTests` back tests, recording `recordings/N13-back-26.mov` | not checked | not checked | see task 16 |

A cell reads `pass`, or `fail:` with what was seen, followed by the date and the evidence. A failing item names the task whose code it concerns and is fixed there before this checklist is marked done.
```

- [ ] **Step 56: Run the whole test scheme on both runtimes.**

```bash
DEST26='platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5'
DEST18='platform=iOS Simulator,name=iPhone 16 Pro,OS=18.4'
xcodebuild test -project ios/Truthy/Truthy.xcodeproj -scheme Truthy -destination "$DEST26" 2>&1 | grep -E "Executed .* tests|TEST (SUCCEEDED|FAILED)" | tail -2
xcodebuild test -project ios/Truthy/Truthy.xcodeproj -scheme Truthy -destination "$DEST18" 2>&1 | grep -E "Executed .* tests|TEST (SUCCEEDED|FAILED)" | tail -2
```

Expected: `** TEST SUCCEEDED **` on both, with 0 failures: on iOS 18.4 `Test run with 80 tests in 23 suites passed` and `Executed 48 tests, with 8 tests skipped and 0 failures`, on 26.5 the same with 7 skipped (both measured, README drafting record, plus task 9's guarded save test added after that run). Both skip the four `VisualCaptureTests` and the three Escape and Return tests (`testEscapeGoesBackAndIsConsumedOnStepOne`, `testEscapeOnTheSheetKeepsPlaying`, `testReturnAndEscape`; task 16, D16); the iOS 18.4 run also skips `testOnIOS26ARightwardPanAnywhereGoesBackOneStep`. Note in the checklist, for N3, N6 and N7, the test files of tasks 13 and 14 that ran green (`ls ios/Truthy/TruthyUITests ios/Truthy/TruthyTests`), and fill in N4, N8, N11 and N13 from this run; open the kept N8 screenshot in the result bundle (`xcodebuild` prints the `.xcresult` path) and check by eye that no focus ring or highlight shows after the tap.

- [ ] **Step 57: Record N1, N3 with N5, and N13.**

```bash
node ios/Tools/visual-review/record.mjs test --build --runtime iOS-18-4 --device large --test TruthyUITests/StartStoryTests/testTheEdgeSwipeGoesBackOneStepAndACancelledSwipeChangesNothing --name N1-edge-18
node ios/Tools/visual-review/record.mjs test --runtime iOS-26-5 --device large --test TruthyUITests/StartStoryTests/testTheEdgeSwipeGoesBackOneStepAndACancelledSwipeChangesNothing --name N1-edge-26
node ios/Tools/visual-review/record.mjs test --runtime iOS-26-5 --device large --test TruthyUITests/StartStoryTests/testOnIOS26ARightwardPanAnywhereGoesBackOneStep --name N1-anywhere-26
node ios/Tools/visual-review/record.mjs test --runtime iOS-26-5 --device large --test TruthyUITests/FeelTests/testDragDirectionsForTheRecording --name N3-N5-drags-26
node ios/Tools/visual-review/record.mjs test --runtime iOS-26-5 --device large --test TruthyUITests/FeelTests/testBackOnTheRoundActsLikeTheX --name N13-back-26
ls ios/Tools/visual-review/out/recordings
```

Expected: each prints `Recorded .../<name>.mov`, and the folder lists the five `.mov` files. Watch each: N1, the step's panel sinks and the new items drop in with the finger, the cancelled pan springs back with no state change; N3 and N5, the vertical and steep diagonal drags scroll and never move the card, the short drag springs back carrying the release speed, the long drag answers; N13, the round surface shrinks with the pan and the sheet opens on release. Fill in N1, N3 (recording part), N5 (release) and N13 (recording part) with what you saw.

- [ ] **Step 58: Record and check N10.**

```bash
for system in light dark; do for app in light dark; do node ios/Tools/visual-review/record.mjs launch --runtime iOS-26-5 --device large --system $system --app $app; done; done
node ios/Tools/visual-review/record.mjs between --runtime iOS-26-5 --device large --theme day
node ios/Tools/visual-review/record.mjs between --runtime iOS-26-5 --device large --theme night
```

Expected: six lines ending `no white or mismatched frame (app from frame <n>)`, each with exit code 0, and a `.json` verdict next to each recording. The launch with the system and app themes opposite is Review Focus line 2: the launch screen in the system's surface colour, then the app in its stored theme from its first frame. A `bad frames` line lists the frames in its `.json`; open the recording at those frames, and treat it as a defect of task 7 (launch colour), 8 (theme before the first frame) or 11 (the screen swap). Repeat the six commands with `--runtime iOS-18-4` and fill in N10 for both runtimes.

- [ ] **Step 59: Fill in N9 and N12 and close the checklist.**

N12: the "N12" section of both reports (`out/iOS-26-5/report.md`, `out/iOS-18-4/report.md`), all `yes`. N9: the largest-text screenshots of both runtimes, every screen checked by eye (and by the reviewer of step 52): no clipped or overlapping text, lists and the ticket scrolled where content is taller than the screen. Every cell of the iOS 18.4 and 26.5 columns now reads `pass` or `not applicable`, with the date and the evidence; the last column reads `see task 16` until task 16 names its device items there.

- [ ] **Step 60: Run the gates.**

```bash
DEST26='platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5'
(cd ios/TruthyEngine && swift test 2>&1 | tail -2)
xcodebuild test -project ios/Truthy/Truthy.xcodeproj -scheme Truthy -destination "$DEST26" 2>&1 | grep -E "TEST (SUCCEEDED|FAILED)"
node --test "ios/Tools/visual-review/*.test.mjs" 2>&1 | grep -E "^ℹ (pass|fail)"
pnpm test 2>&1 | tail -4
```

Expected: the engine tests passing, `** TEST SUCCEEDED **`, `ℹ pass 16` and `ℹ fail 0`, and the web tests passing (the hygiene test reads the two documents too: no em dash, no local path).

- [ ] **Step 61: Commit the records.**

```bash
git add ios/docs/feel-checklist.md ios/docs/visual-review.md ios/Tools/visual-review/approved.json
git commit -m "docs: record the iOS visual review and the feel checklist"
git status --short
```

Expected: the commit, and an empty `git status` (recordings, screenshots, pairs and reports are under the ignored `out/`).
