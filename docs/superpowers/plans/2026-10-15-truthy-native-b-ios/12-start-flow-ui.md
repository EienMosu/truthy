### Task 12: The start flow: steps 1 to 6, the fill-in pass, Recent, Continue, the theme switch, forward motion and the gesture-driven back

The first screen (spec 3 and 5.1, reference 4.1 S1 to S6, 4.2, 4.4 and 4.5): one screen whose steps change in place. Step 1 has the logo as its heading, the tagline, the Recent card (two or more decks played), the area cards and the Continue line; steps 2 to 6 have the Back pill and the fill-in pass in its three stages (compact, route, ready), whose filled fields are ways back; step 6 has the class's line and Start round, which unrolls the empty paper and swaps in the round. Forward plays the web's forward motion with name travel; every way back (the leading-edge pan, the anywhere pan on iOS 26 and later, the Back pill, a pass field, Escape) plays task 11's `BackTransition`, scrubbed by the finger or played over its duration, and a released gesture finishes with a spring seeded with the finger's speed. Lists are announced as lists and fade at the bottom while more lies below.

Builds on tasks 1 to 11: the start-flow helpers and labels of task 5, `StartFlowModel` and `BackTransition` of task 11, the components of task 10 and the tokens of task 8. It replaces task 11's stand-in `StartFlowView.swift`.

**Files:**
- Create (app): `ios/Truthy/Truthy/Start/BackPans.swift`, `Start/DestinationCard.swift`, `Start/ContinueLine.swift`, `Start/ThemeSwitch.swift`, `Start/FillInPass.swift`, `Start/StepContent.swift`
- Modify: `ios/Truthy/Truthy/Start/StartFlowView.swift` (replaced whole)
- Test (unit): create `ios/Truthy/TruthyTests/PassMorphTests.swift`
- Test (UI): create `ios/Truthy/TruthyUITests/AppDriver.swift` (a small driver tasks 13 and 14 share), `ios/Truthy/TruthyUITests/StartFlowGestureTests.swift`, `ios/Truthy/TruthyUITests/StartFlowLargeTextTests.swift`

**Interfaces:**
- Produces (app target):

```swift
struct BackPanEvent: Equatable { enum Phase { case changed, ended, cancelled }; var phase: Phase; var progress: Double; var velocity: Double; var windowWidth: Double }
final class EdgePanRecognizer: UIPanGestureRecognizer         // begins for a touch down within SWIPE.edgePx of the leading edge
struct EdgeBackPan: UIGestureRecognizerRepresentable          // an EdgePanRecognizer (UIScreenEdgePanGestureRecognizer's region is narrower than 24)
struct AnywhereBackPan: UIGestureRecognizerRepresentable      // iOS 26 and later: a rightward horizontal pan anywhere
extension View { func backPans(isEnabled: Bool, anywhere: Bool, onEvent: (BackPanEvent) -> Void) -> some View }   // task 13 reuses it
struct BackMotion: ViewModifier, Animatable { var progress: Double; let transition: BackTransition; let role: Role; let reducedMotion: Bool }
    // Role: oldPanel, oldTitle, newItem(i), dashes, tripOut, brandIn, footIn, footOut
struct EnteringItem: ViewModifier   // a forward arrival's staggered item
struct DestinationCard: View        // name, detail, status, stub; one button with the label of reference 4.5, or a disabled group
struct ContinueLine: View { init(target: ContinueTarget, action: () -> Void) }
struct ThemeSwitch: View { init(theme: ResolvedTheme, action: () -> Void) }
struct PassBack: Equatable { let from: Step; let transition: BackTransition; var progress: Double; let reducedMotion: Bool; var frame: BackFrame; var changesStage: Bool }
struct PassMorph: Equatable { let frame: BackFrame; func height(from:to:) -> Double; func copies(from: CGRect, to: CGRect, right: Bool) -> (old: Copy, new: Copy) }
struct PassBodyLayout: Layout { var morph: Double }   // the new block and the old one at the top, the height morphed
extension View { func paperTextSize() -> some View }   // the paper's own text stops growing at xxLarge (README deviation 6); tasks 13 and 14 reuse it
struct FillInPass: View, Animatable { init(flow: StartFlowModel, showing: Step? = nil, back: PassBack? = nil, onBack: (Step) -> Void,
    onChangePlatform: () -> Void = {}, onFieldFrame: (PassFieldName, CGRect) -> Void)   // animates back.progress itself
    static func bandHeight(_:) -> Double; static func travelling(from: Stage, to: Stage, kept: Set<PassFieldName>) -> [PassFieldName] }
@MainActor struct StepContent { static let titles: [Step: String]; static let backTo: [Step: String]; var title: String; var options: [StepOption] }
struct StartFlowView: View { init(model: AppModel) }
// UI tests: @MainActor struct AppDriver { init(_ arguments: [String]); func launch(); func button(_:); func button(startingWith:); func element(_:);
//   func element(containing:); func lowestButton(_:); func waitFor(_:_:timeout:); func pause(_:); func drag(from:to:velocity:hold:);
//   static func skipEscapeAndReturnOnTheSimulator() throws;
//   static func round(_ mode: String = "classic", screen: String = "round", extra: [String] = []) -> AppDriver }
```

**Rules:**

1. **Copy and labels, verbatim** (reference 4.5): step titles; "Back" with the label "Back to {areas|platforms|decks|sections|classes}" naming the step it returns to; area and platform cards "{title}, {n} decks" (or "no decks yet", a disabled group); the Recent card "Recent, {decksLabel}" with the codes joined by " · "; deck cards "{code}, {title}, {n} cards, {p} percent seen" or "..., not started"; "Whole deck, all {k} sections, {n} cards"; section cards "{id}, {title}, {n} cards"; class cards "{name}. {description} Your best: {best} {unit}." or "... Not played yet." with the stub "Best", "–" and "not played"; the step 6 line "{description} Swipe right for true, left for false."; "Start round" with a trailing arrow; the pass's "YOUR PASS" and "BOARDING PASS" bands, its blank field "---" read "not chosen", its ways back from task 5's `changeLabel` (the route stage's pass line "area · platform" says "Change area, now {title}" and "Change platform, now {title}", 48 by 48 hit areas), the Gate "F ← → T" read "False left, true right"; the Continue line's label from task 5's `continueLabel`; the theme switch "Switch to dark theme" while day shows and "Switch to light theme" at night.
2. **One screen, a step stack** (spec 5.1, reference 7.1): no navigation push. The panel of the step changes in place; the top zone (logo and tagline, or Back pill and pass) and the foot zone (Continue or Start round) change with it.
3. **Forward motion** (reference 5.7): the new step's items (its title first) come from 24 below with opacity over 240 ms on the ease curve, the first after 110 and each next 25 later; the old panel leaves at once, 10 up over 140 on ease-out. The top zone (logo and tagline, or Back pill and pass) and the foot zone (Continue or Start round) swap with a 12 point offset and opacity: in over 240 after 120, out over 110. The theme switch moves between the logo row and the Back pill row over 240; at Start round the Back pill, the pass zone and the switch fade over 110. Step 6's title sits `ready-offset` (112) lower, 88 under 600 tall, none below the short-screen height. Continue plays the same forward motion. Name travel moves a scaled copy of the chosen name from its card to its pass field over 300 ms after 60 (translate and scale only; skipped for the class and with reduced motion). With reduced motion the panels cross-fade (140 after 90). A view that animates from its first frame (the travelling name, the unrolling paper, the two panels of a played back) is inserted at its start value and starts its animation from its own `onAppear`: a value a view is inserted with is not interpolated.
4. **Back** (spec 5.1): a pan that starts within 24 points of the leading edge on every step after the first and, on iOS 26 and later, a rightward horizontal pan anywhere drive `StartFlowModel.backProgress`; the views draw the step being left and the step coming back at once through `BackMotion`, which reads one `BackTransition(from:to:itemCount:)` per back (`itemCount` the target step's title plus its rendered options), so every part runs on the same time base: the old panel and its faster title, the new items, the cleared pass fields returning to dashes, the top and foot zones on a back to step 1 or from step 6, the theme switch's row, and on a change of pass stage the pass stage morph and the value copies (README, "Cross-platform agreements"; plan C task 11 rule 4 and task 12): the band takes the new stage's look at once while its height and the body's height morph with `morph`, the old block fades out over the new one (`oldBlockOpacity`, `newBlockOpacity`), and each value that is on both layouts and stays chosen travels as two copies on the eased path, the old look fading by 60 percent and the new one from 40 (`oldValueOpacity`, `newValueOpacity`), while the values themselves are hidden; under reduced motion the heights switch at t = 100 and no copy travels. `FillInPass` animates the back's progress itself (`PassBack`), so a played back and a spring draw the frame's values at every frame, and the pass keeps its identity through the back, so nothing is inserted when it completes. Release completes when `BackTransition.completes(progress:velocity:)` says so, with the snap spring seeded with the finger's speed divided by the window width times the distance still to go; a cancel springs back and changes nothing. The Back pill, a pass field, Escape and "Change platform" on the recent path play the same motion over its duration (the last one then rewrites the stack to [1, 2, 3], task 11). Choices are cleared only when the back completes (`StartFlowModel.back(to:)`). A jump of several steps (a pass field) plays the motion once. The recognizers' `isEnabled` never changes while a pan runs (disabling a UIKit recognizer mid-gesture cancels it): the pans are off only while a played back runs. The whole frame takes the pans (`contentShape`), because the gutter and the sky draw nothing a touch could hit.
5. **Guards** (reference 4.3): options, Continue and Start round wait 250 ms after a step appears (the model refuses earlier presses); backs never wait, except one: where the whole column scrolls (rule 9), a step that arrives while the column was scrolled jumps it to its top, and then a press on the Back pill or a pass field (and "Change platform") waits out the step's 250 ms settle time, because they now lie where the finger just was (StartFlow.tsx:489-501 and 589-598, plan C's `columnJumped`); the pans and Escape never wait. During the 360 ms unroll the screen takes no input and every back is consumed.
6. **Keyboard**: Escape goes back one step and is consumed on step 1; `onKeyPress` with `phases: .down` acts once per press, never on repeat. The screen's root is focusable (`focusable(interactions: .edit)`, no focus effect) and focused on appear, so the keys work after touches: `onKeyPress` reaches only a focused view or its ancestors, and a touch never moves focus on iOS. With the Mac keyboard through the iOS 18.4 simulator (I/O, Keyboard, Connect Hardware Keyboard) Escape reaches this handler and goes back as the web does. XCUITest's `typeKey` cannot deliver Escape or Return on the simulator, on 18.4 and on 26.5 alike (the three Escape and Return tests fail the same way on both with the skip removed): on 18.4 neither reaches `UIApplication.sendEvent` (the arrows and letters do), so no handler can see them (a `keyboardShortcut`, a first-responder `UIKeyCommand` with `wantsPriorityOverSystemBehavior` and `pressesBegan` were tried too). `testEscapeGoesBackAndIsConsumedOnStepOne` therefore skips on the simulator (`AppDriver.skipEscapeAndReturnOnTheSimulator`), and task 16 checks Escape on the device (D16).
7. **Accessibility focus** (reference 4.4): forward, the new step's title; back, the card chosen before (`focusAfterBack`); arriving from the round by a control, the step 1 title. Lists are announced as lists; the pass body is a container.
8. **The list cue** (reference 3.7, task 5): the list's bottom edge fades over `FADE_PX` while more content lies below, ending `listCue(...).lift` above the edge so the fade lies over a card. After a back the list first scrolls the chosen card into view with task 5's `revealDelta`, room 8 (the web's FOCUS_ROOM), so it shows whole above the fade (reference 4.4). Where the whole column scrolls (rule 9) the list takes its own height, never fades and reveals nothing: as on the web after a press, the column stays at its top, and VoiceOver brings the focused card into view itself (iOS moves no keyboard focus onto the card, so the web's keyboard reveal has nothing to show).
9. **The short column** (spec 5.6, the web's `short` rule, globals.css:31-34, StartFlow.tsx:765-837; plan C task 12's `short`): under `Tokens.Native.shortScreenBelow` (568) tall, and at every accessibility text size (`dynamicTypeSize.isAccessibilitySize`, where the fixed layout cuts step 1's tagline and the step titles), the whole column (top zone, panel, foot zone) scrolls as one `ScrollView`: the top zone takes its own height instead of `startTopZone`, step 6's title has no ready offset, the list does not scroll on its own and the foot zone follows the list. A step that arrives starts at the column's top, at once (rule 5's hold follows when it moved). At every other size the layout is the fixed one, unchanged. The pass, a destination card's stub and, in tasks 13 and 14, the ticket's and the result's paper text stop growing at `xxLarge` (`paperTextSize()`, README deviation 6): in their fixed columns a larger size breaks "Platform" into "Platfor m" and ends values in an ellipsis.

**Review focus.** README line 3 (largest text): every fixed height here is a minimum and text wraps, a destination card's name and the continue line's deck name included where the web ends them in an ellipsis (README deviation 5); at the accessibility sizes the whole column scrolls (rule 9), so step 1's tagline and every step title show whole (`StartFlowLargeTextTests` reads them drawn, with text recognition), and the pass stops growing at `xxLarge` (README deviation 6); the continue line stops growing at the second accessibility size (task 15's `testTheContinueLineShowsTheWholeDeckNameAtTheLargestTextSize` reads the drawn line); task 15 captures steps 1 to 6 at the largest size, including step 1 with Recent and Continue and the Recent deck list (its `testCaptureTheOtherClassesAndStartStates`). README line 2: the theme switch flips the theme and stores it (task 11's `AppModel.switchTheme`).

**Steps:**

- [ ] **Step 1: Check the starting point.**

```bash
git status --short
xcodebuild test -project ios/Truthy/Truthy.xcodeproj -scheme Truthy -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5' 2>&1 | grep -E 'Test run with|Executed [0-9]+ tests?,|TEST (SUCCEEDED|FAILED)' | tail -3
```

Expected: nothing; `Test run with 62 tests in 17 suites passed`, `Executed 1 test, with 0 failures` and `** TEST SUCCEEDED **`.

- [ ] **Step 2: Write the UI tests.**

`ios/Truthy/TruthyUITests/AppDriver.swift`:

```swift
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
```

`ios/Truthy/TruthyUITests/StartFlowGestureTests.swift`:

```swift
import XCTest

/// Task 12: the start flow's back gestures and Escape (spec 5.1). Task 15's stories cover the rest.
final class StartFlowGestureTests: XCTestCase {
    override func setUp() {
        continueAfterFailure = false
    }

    @MainActor
    private func toTheDeckStep(_ driver: AppDriver) {
        driver.waitFor(driver.element("Choose an area"), "step 1")
        driver.pause(0.3)
        driver.button(startingWith: "Cloud, ").tap()
        driver.waitFor(driver.element("Choose a platform"), "step 2")
        driver.pause(0.3)
        driver.button(startingWith: "AWS, ").tap()
        driver.waitFor(driver.element("Choose a deck"), "step 3")
        driver.pause(0.3)
    }

    @MainActor
    func testAnEdgePanCompletesOneStepBackAndASlowShortOneCancels() {
        let driver = AppDriver()
        driver.launch()
        toTheDeckStep(driver)
        driver.drag(from: CGVector(dx: 0.005, dy: 0.5), to: CGVector(dx: 0.25, dy: 0.5), velocity: XCUIGestureVelocity(60), hold: 0.4)
        driver.pause(1)
        XCTAssertTrue(driver.element("Choose a deck").exists, "a cancelled pan changes nothing")
        driver.drag(from: CGVector(dx: 0.005, dy: 0.5), to: CGVector(dx: 0.85, dy: 0.5), velocity: .fast)
        driver.waitFor(driver.element("Choose a platform"), "one step back")
        XCTAssertFalse(driver.element("Choose an area").exists)
    }

    @MainActor
    func testEscapeGoesBackAndIsConsumedOnStepOne() throws {
        try AppDriver.skipEscapeAndReturnOnTheSimulator()
        let driver = AppDriver()
        driver.launch()
        toTheDeckStep(driver)
        driver.app.typeKey(.escape, modifierFlags: [])
        driver.waitFor(driver.element("Choose a platform"), "Escape went back one step")
        driver.app.typeKey(.escape, modifierFlags: [])
        driver.waitFor(driver.element("Choose an area"), "Escape went back to step 1")
        driver.app.typeKey(.escape, modifierFlags: [])
        driver.pause(1)
        XCTAssertTrue(driver.element("Choose an area").exists, "Escape on step 1 does nothing")
        XCTAssertEqual(driver.app.state, .runningForeground)
    }

    /// Reference 4.4: after a back, the card chosen before shows whole (the list scrolls it into view first).
    @MainActor
    func testABackScrollsTheCardChosenBeforeIntoView() {
        let driver = AppDriver()
        driver.launch()
        driver.waitFor(driver.element("Choose an area"), "step 1")
        driver.pause(0.3)
        driver.button(startingWith: "DevOps, ").tap()
        driver.waitFor(driver.element("Choose a platform"), "step 2")
        driver.pause(0.3)
        let last = driver.button(startingWith: "Networking, ")
        for _ in 0..<6 where !last.isHittable { driver.app.swipeUp() }
        last.tap()
        driver.waitFor(driver.element("Choose a deck"), "step 3")
        driver.pause(0.3)
        driver.button("Back to platforms").tap()
        driver.waitFor(driver.element("Choose a platform"), "back on step 2")
        driver.pause(1)
        let card = driver.button(startingWith: "Networking, ")
        XCTAssertTrue(driver.app.windows.firstMatch.frame.contains(card.frame), "the chosen platform shows whole after the back")
    }
}
```

`ios/Truthy/TruthyUITests/StartFlowLargeTextTests.swift`:

```swift
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
```

- [ ] **Step 3: Run them and see them fail.**

```bash
DEST26='platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5'
xcodebuild test -project ios/Truthy/Truthy.xcodeproj -scheme Truthy -destination "$DEST26" -only-testing:TruthyUITests/StartFlowGestureTests -only-testing:TruthyUITests/StartFlowLargeTextTests 2>&1 | grep -E 'Executed|error:|TEST (SUCCEEDED|FAILED)' | tail -3
```

Expected: `Executed 4 tests, with 1 test skipped and 3 failures` (the Escape test skips on the simulator, rule 6; task 11's stand-in shows the step 1 title but no area cards, so the first tap finds no "Cloud, " or "DevOps, " card, and no tagline for the large text test to read) and `** TEST FAILED **`.

- [ ] **Step 4: Write the back gestures and the back motion.**

`ios/Truthy/Truthy/Start/BackPans.swift`:

```swift
import SwiftUI
import TruthyEngine
import UIKit

// The native back gestures (spec 5.1, 5.2): a pan that starts within 24 points of the leading window edge, bridged
// with UIGestureRecognizerRepresentable (iOS 18), and on iOS 26 and later a rightward horizontal pan anywhere on a
// step. Each reports the progress across the window, the horizontal velocity and the window's width; the caller
// decides on release with BackTransition.completes. The recognizers' isEnabled never changes while a pan runs:
// disabling a UIKit recognizer mid-gesture cancels it.

struct BackPanEvent: Equatable {
    enum Phase { case changed, ended, cancelled }
    var phase: Phase
    /// The finger's travel as a share of the window width, 0 to 1.
    var progress: Double
    /// Points per second, positive towards the trailing edge.
    var velocity: Double
    /// The window's width in points (a released spring turns the velocity into progress per second with it).
    var windowWidth: Double
}

/// A pan that begins only for a touch that went down within SWIPE.edgePx (24) of the leading window edge and moves
/// rightward more than vertically. UIScreenEdgePanGestureRecognizer's own edge region is narrower than 24, so a touch
/// at 10 would be neither the card (it refuses the 24 edge band) nor the back.
final class EdgePanRecognizer: UIPanGestureRecognizer {
    private(set) var down: CGPoint?
    private(set) var latest: CGPoint?

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent) {
        if down == nil, let touch = touches.first {
            down = touch.location(in: nil)
            latest = down
        }
        super.touchesBegan(touches, with: event)
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent) {
        if let touch = touches.first { latest = touch.location(in: nil) }
        super.touchesMoved(touches, with: event)
    }

    override func reset() {
        super.reset()
        down = nil
        latest = nil
    }
}

struct EdgeBackPan: UIGestureRecognizerRepresentable {
    var isEnabled: Bool
    var onEvent: (BackPanEvent) -> Void

    func makeCoordinator(converter: CoordinateSpaceConverter) -> Delegate {
        Delegate()
    }

    func makeUIGestureRecognizer(context: Context) -> EdgePanRecognizer {
        let recognizer = EdgePanRecognizer()
        recognizer.delegate = context.coordinator
        recognizer.maximumNumberOfTouches = 1
        return recognizer
    }

    func updateUIGestureRecognizer(_ recognizer: EdgePanRecognizer, context: Context) {
        recognizer.isEnabled = isEnabled
    }

    func handleUIGestureRecognizerAction(_ recognizer: EdgePanRecognizer, context: Context) {
        BackPanReport.report(recognizer, onEvent)
    }

    final class Delegate: NSObject, UIGestureRecognizerDelegate {
        func gestureRecognizerShouldBegin(_ recognizer: UIGestureRecognizer) -> Bool {
            guard let pan = recognizer as? EdgePanRecognizer, let down = pan.down, let latest = pan.latest else { return false }
            let dx = latest.x - down.x
            return down.x <= SWIPE.edgePx && dx > 0 && dx > abs(latest.y - down.y)
        }
    }
}

/// iOS 26 and later: a rightward pan anywhere on a step goes back, as the system's pushed screens do. It begins only
/// for a horizontal, rightward movement, so vertical scrolls and leftward pans stay with the lists.
struct AnywhereBackPan: UIGestureRecognizerRepresentable {
    var isEnabled: Bool
    var onEvent: (BackPanEvent) -> Void

    func makeCoordinator(converter: CoordinateSpaceConverter) -> Delegate {
        Delegate()
    }

    func makeUIGestureRecognizer(context: Context) -> UIPanGestureRecognizer {
        let recognizer = UIPanGestureRecognizer()
        recognizer.delegate = context.coordinator
        return recognizer
    }

    func updateUIGestureRecognizer(_ recognizer: UIPanGestureRecognizer, context: Context) {
        recognizer.isEnabled = isEnabled
    }

    func handleUIGestureRecognizerAction(_ recognizer: UIPanGestureRecognizer, context: Context) {
        BackPanReport.report(recognizer, onEvent)
    }

    final class Delegate: NSObject, UIGestureRecognizerDelegate {
        func gestureRecognizerShouldBegin(_ recognizer: UIGestureRecognizer) -> Bool {
            guard let pan = recognizer as? UIPanGestureRecognizer else { return false }
            let velocity = pan.velocity(in: pan.view)
            return velocity.x > 0 && abs(velocity.x) > abs(velocity.y)
        }
    }
}

enum BackPanReport {
    @MainActor static func report(_ recognizer: UIPanGestureRecognizer, _ onEvent: (BackPanEvent) -> Void) {
        let width = max(1, recognizer.view?.window?.bounds.width ?? recognizer.view?.bounds.width ?? 1)
        let progress = min(1, max(0, recognizer.translation(in: recognizer.view).x / width))
        let velocity = recognizer.velocity(in: recognizer.view).x
        switch recognizer.state {
        case .began, .changed: onEvent(BackPanEvent(phase: .changed, progress: progress, velocity: velocity, windowWidth: width))
        case .ended: onEvent(BackPanEvent(phase: .ended, progress: progress, velocity: velocity, windowWidth: width))
        case .cancelled, .failed: onEvent(BackPanEvent(phase: .cancelled, progress: progress, velocity: velocity, windowWidth: width))
        default: break
        }
    }
}

extension View {
    /// The back gestures of a start step or the round: the edge pan everywhere, the anywhere pan on iOS 26 and later.
    /// The whole frame takes the pans: the 16 gutter and the sky behind it draw nothing hit-testable, and a touch that
    /// hits nothing never reaches a gesture of this view. (contentShape covers the layout frame only: the leading
    /// safe-area inset in landscape is checked on 26.5 and on the device, task 16.)
    @ViewBuilder func backPans(isEnabled: Bool, anywhere: Bool, onEvent: @escaping (BackPanEvent) -> Void) -> some View {
        if anywhere, #available(iOS 26, *) {
            self.contentShape(Rectangle())
                .gesture(EdgeBackPan(isEnabled: isEnabled, onEvent: onEvent))
                .gesture(AnywhereBackPan(isEnabled: isEnabled, onEvent: onEvent))
        } else {
            self.contentShape(Rectangle()).gesture(EdgeBackPan(isEnabled: isEnabled, onEvent: onEvent))
        }
    }
}

/// Drives a part of the back motion as a function of progress, so SwiftUI can animate the progress itself (a played
/// back, a spring after release) and every frame is BackTransition's.
struct BackMotion: ViewModifier, @preconcurrency Animatable {
    var progress: Double
    let transition: BackTransition
    let role: Role
    let reducedMotion: Bool

    enum Role: Equatable { case oldPanel, oldTitle, newItem(Int), dashes, tripOut, brandIn, footIn, footOut }

    var animatableData: Double {
        get { progress }
        set { progress = newValue }
    }

    func body(content: Content) -> some View {
        let frame = transition.frame(at: progress, reducedMotion: reducedMotion)
        switch role {
        case .oldPanel:
            content.opacity(frame.oldOpacity).offset(y: frame.oldOffsetY)
        case .oldTitle:
            content.opacity(frame.oldTitleOpacity)
        case .newItem(let i):
            let item = frame.newItems[min(i, frame.newItems.count - 1)]
            content.opacity(item.opacity).offset(y: item.offsetY)
        case .dashes:
            content.opacity(frame.dashesOpacity)
        case .tripOut:
            content.opacity(frame.tripOut.opacity).offset(y: frame.tripOut.offsetY)
        case .brandIn:
            content.opacity(frame.brandIn.opacity).offset(y: frame.brandIn.offsetY)
        case .footIn:
            content.opacity(frame.footIn.opacity).offset(y: frame.footIn.offsetY)
        case .footOut:
            content.opacity(frame.footOut.opacity).offset(y: frame.footOut.offsetY)
        }
    }
}
```

- [ ] **Step 5: Write the cards, the continue line, the theme switch and the pass.**

`ios/Truthy/Truthy/Start/DestinationCard.swift`:

```swift
import SwiftUI
import TruthyEngine

// A destination card of the start flow (DestinationCard.tsx): name, detail, an optional status, and a stub with a
// label over a value, behind a notched paper with a dashed perforation. One button whose accessible name is the
// sentence of reference 4.5; an unavailable card is a labelled, disabled group instead.

struct DestinationCard: View {
    enum NameStyle { case title, code }
    let name: String
    var nameStyle: NameStyle = .title
    var detail: String?
    var detailMuted = false
    var status: String?
    var stubLabel: String?
    var stubValue: String?
    var stubUnit: String?
    var stubValueMuted = false
    var stubWidth: Double = Tokens.Size.cardStub
    var minHeight: Double = Tokens.Size.cardMin
    var chevron = true
    var enabled = true
    let label: String
    let action: () -> Void
    @Environment(\.palette) private var palette
    @Environment(\.shadows) private var shadows

    var body: some View {
        let shape = DestinationCardShape(stub: stubWidth)
        let content = HStack(spacing: 0) {
            VStack(alignment: .leading, spacing: Tokens.Space.s4) {
                // The name wraps where the web cuts it (README deviation 5): text never clips at the largest size.
                Text(name).typeRole(nameStyle == .code ? Tokens.TypeRole.deckCode : Tokens.TypeRole.cardName)
                    .fixedSize(horizontal: false, vertical: true)
                if let detail {
                    Text(detail).typeRole(Tokens.TypeRole.listTitle).foregroundStyle(detailMuted ? palette.inkMuted.color : palette.ink.color)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if let status {
                    Text(status).typeRole(Tokens.TypeRole.monoData).foregroundStyle(palette.inkMuted.color)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, Tokens.Space.s16)
            .padding(.leading, Tokens.Space.s18)
            if chevron {
                IconView(icon: .chevronRight, size: 16).foregroundStyle(palette.inkMuted.color).padding(.trailing, Tokens.Space.s12)
            }
            Perforation(axis: .vertical).padding(.vertical, Tokens.Size.cardNotch + 4)
            VStack(spacing: Tokens.Space.s2) {
                if let stubLabel { Text(stubLabel).typeRole(Tokens.TypeRole.fieldLabel).foregroundStyle(palette.inkMuted.color) }
                if let stubValue {
                    Text(stubValue).typeRole(Tokens.TypeRole.cardStubValue).foregroundStyle(stubValueMuted ? palette.inkMuted.color : palette.ink.color)
                }
                if let stubUnit { Text(stubUnit).typeRole(Tokens.TypeRole.monoCaption).foregroundStyle(palette.inkMuted.color) }
            }
            // The stub is a fixed column of paper (README deviation 6).
            .paperTextSize()
            .frame(width: stubWidth)
        }
        .foregroundStyle(palette.ink.color)
        .frame(maxWidth: .infinity, minHeight: minHeight)
        .background(shape.fill(enabled ? palette.surfaceRaised.color : palette.surfaceSunk.color))
        .tokenShadow(enabled ? shadows.small : [], shape)
        .contentShape(shape)

        if enabled {
            Button(action: action) { content }
                .buttonStyle(.card)
                .keyboardFocusRing(RoundedRectangle(cornerRadius: Tokens.Radius.card))
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(label)
                .accessibilityAddTraits(.isButton)
        } else {
            content
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(label)
        }
    }
}
```

`ios/Truthy/Truthy/Start/ContinueLine.swift`:

```swift
import SwiftUI
import TruthyEngine

// The continue line of start step 1 (ContinueLine.tsx): the deck's pass name, then "CLF → SEC · Classic · last 7 of
// 10", one tap back into the last route. Its accessible name is task 5's continueLabel.

struct ContinueLine: View {
    let target: ContinueTarget
    let action: () -> Void
    @Environment(\.palette) private var palette

    var deckName: String { deckPassName(target.found.platform, target.found.deck) }
    var sectionCode: String { target.found.section?.id ?? WHOLE_DECK }
    var sectionTitle: String { target.found.section?.title ?? "Whole deck" }
    var className: String { modeInfo(target.mode).name }
    var score: String? { target.lastScore.map { lastScoreText(target.mode, $0.score, $0.total) } }

    var label: String {
        continueLabel(ContinueLabelProps(deckName: deckName, sectionTitle: sectionTitle, modeLabel: className, lastScore: score))
    }

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: Tokens.Radius.card)
        Button(action: action) {
            HStack(spacing: Tokens.Space.s12) {
                LogoMark(width: 26)
                    .frame(width: Tokens.Size.continueIcon, height: Tokens.Size.continueIcon)
                    .background(Circle().fill(palette.surfaceRaised.color))
                VStack(alignment: .leading, spacing: Tokens.Space.s2) {
                    // The web ends a long name in an ellipsis (ContinueLine.tsx); here it wraps (README deviation 5): at the
                    // largest text size "Google Cloud Digital Leader" no longer fits one line, and text never clips.
                    Text(deckName).typeRole(Tokens.TypeRole.continueDeckName).fixedSize(horizontal: false, vertical: true)
                    Text("\(target.found.deck.code) → \(sectionCode) · \(className)\(score.map { " · last \($0)" } ?? "")")
                        .typeRole(Tokens.TypeRole.routeLabel)
                        .foregroundStyle(palette.inkMuted.color)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
                IconView(icon: .chevronRight, size: 16).foregroundStyle(palette.inkMuted.color)
            }
            .foregroundStyle(palette.ink.color)
            .padding(.horizontal, Tokens.Space.s8)
            .frame(minHeight: Tokens.Size.pill)
            .contentShape(shape)
        }
        // The line sits under step 1's list: above the second accessibility size its wrapped name would push the list
        // off the screen (six lines at the largest), so it stops growing there, still wrapped and never cut.
        .dynamicTypeSize(...DynamicTypeSize.accessibility2)
        .buttonStyle(PressTintButtonStyle(shape: shape, scale: 0.98))
        .keyboardFocusRing(shape)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
        .accessibilityAddTraits(.isButton)
    }
}
```

`ios/Truthy/Truthy/Start/ThemeSwitch.swift`:

```swift
import SwiftUI

// The theme switch on every start step (ThemeSwitch.tsx): a moon while the day theme shows, a sun at night.

struct ThemeSwitch: View {
    let theme: ResolvedTheme
    let action: () -> Void
    @Environment(\.palette) private var palette
    @Environment(\.shadows) private var shadows

    var body: some View {
        Button(action: action) {
            Group {
                if theme == .dark {
                    IconView(icon: .sunRays, size: 18)   // task 10's sun draws its r3.3 disc with the rays
                } else {
                    IconView(icon: .moon, size: 18)
                }
            }
            .foregroundStyle(palette.ink.color)
            .frame(width: Tokens.Size.roundButton, height: Tokens.Size.roundButton)
            .background(Circle().fill(palette.surfaceRaised.color))
            .tokenShadow(shadows.small, Circle())
        }
        .buttonStyle(.round)
        .keyboardFocusRing(Circle())
        .accessibilityLabel(theme == .dark ? "Switch to light theme" : "Switch to dark theme")
    }
}
```

`ios/Truthy/Truthy/Start/FillInPass.swift`:

```swift
import SwiftUI
import TruthyEngine

// The fill-in pass (FillInPass.tsx, reference 4.5): compact "YOUR PASS" with Area, Platform and Deck on steps 2 and 3;
// the route stage with Deck, Section and Class on steps 4 and 5; the full "BOARDING PASS" on step 6. A filled field
// of an earlier step is a way back ("Change deck, now CLF"); a blank field is three dashes, read "not chosen".
// A back that changes the stage draws what BackTransition's frame holds (FillInPass.tsx:379-460, passValueTravel.ts;
// plan C task 12 does the same): the band takes the new stage's look at once and its height morphs, the old block
// fades out over the new one while the body's height morphs from the old block's to the new one's, and every value
// that is on both layouts and stays chosen travels as two copies on one eased path, the old look and the new,
// cross-fading on a linear clock while the values themselves are hidden. The pass animates the back's progress
// itself, so every frame of a played back or a spring is the frame's.

extension View {
    /// The paper's own text (README deviation 6): the pass, and in tasks 13 and 14 the ticket's band, legs, fields,
    /// stub and stamps, the headers' label rows and the result's fields, grow with Dynamic Type up to `xxLarge`, one
    /// below the largest standard size, and no further: in their fixed columns a larger size breaks words
    /// ("Platfor m") and ends values in an ellipsis. Reading text (titles, cards, statements, explanations, the
    /// sheet) grows to the largest accessibility size.
    func paperTextSize() -> some View {
        dynamicTypeSize(...DynamicTypeSize.xxLarge)
    }
}

struct PassField: Identifiable {
    let id: PassFieldName
    let label: String
    let value: String?
    let mono: Bool
    /// The step the field returns to, nil when it is no way back.
    let backTo: Step?
}

/// A back running over the pass: the step it leaves, the one transition every part of that back reads, and the
/// progress the finger or a played back drives.
struct PassBack: Equatable {
    let from: Step
    let transition: BackTransition
    var progress: Double
    let reducedMotion: Bool

    var frame: BackFrame { transition.frame(at: progress, reducedMotion: reducedMotion) }
    /// Whether this back changes the pass's stage (it does not depend on the progress).
    var changesStage: Bool { transition.frame(at: 0, reducedMotion: reducedMotion).stageChange }
}

/// Where a value sits on one layout of the pass, in the pass body's space, and how it looks there.
struct PassValueSpot: Equatable, Sendable {
    let text: String
    let style: TypeStyle
    let rect: CGRect
}

/// The pass's change of stage at one frame of a back: the heights of the band and the body, and the two copies of a
/// travelling value (passValueTravel.ts: one eased path, the old copy gone by 60 percent, the new one in from 40).
struct PassMorph: Equatable {
    let frame: BackFrame

    /// A height that goes from the old stage's to the new one's with the paper (`morph`, 360 on the ease curve).
    func height(from old: Double, to new: Double) -> Double {
        old + (new - old) * frame.morph
    }

    /// Where a copy is drawn: moved by dx and dy from its own value's place, scaled about its top leading corner (or
    /// top trailing, for a value that keeps to the right), at an opacity.
    struct Copy: Equatable {
        var dx: Double
        var dy: Double
        var scale: Double
        var opacity: Double
    }

    /// The copies of a value at `old` on the layout being left and at `new` on the layout coming back. Their tops
    /// meet, and so do the edges the text keeps to; the scale is the change of text height, so the two copies cover
    /// each other all the way and only their opacities differ.
    func copies(from old: CGRect, to new: CGRect, right: Bool) -> (old: Copy, new: Copy) {
        let e = frame.morph
        let scale = old.height > 0 && new.height > 0 ? new.height / old.height : 1
        let dx = right ? new.maxX - old.maxX : new.minX - old.minX
        let dy = new.minY - old.minY
        return (Copy(dx: dx * e, dy: dy * e, scale: 1 + (scale - 1) * e, opacity: frame.oldValueOpacity),
                Copy(dx: -dx * (1 - e), dy: -dy * (1 - e), scale: 1 / scale + (1 - 1 / scale) * e, opacity: frame.newValueOpacity))
    }
}

/// The pass body: the block on screen and, during a change of stage, the block being left laid over it at the top.
/// The body is as tall as the old block morphed into the new one (`morph`), measured in the same layout pass, so the
/// first frame of a back is already the old stage's height.
struct PassBodyLayout: Layout {
    var morph: Double

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let sizes = subviews.map { $0.sizeThatFits(ProposedViewSize(width: proposal.width, height: nil)) }
        guard let current = sizes.first else { return .zero }
        let width = proposal.width ?? sizes.map(\.width).max() ?? 0
        guard sizes.count > 1 else { return CGSize(width: width, height: current.height) }
        let old = sizes[1].height
        return CGSize(width: width, height: old + (current.height - old) * morph)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        for subview in subviews {
            subview.place(at: bounds.origin, anchor: .topLeading, proposal: ProposedViewSize(width: bounds.width, height: nil))
        }
    }
}

/// The body clips only while its height morphs (at rest a focus ring may reach past it).
private struct MorphClip: Shape {
    let active: Bool

    func path(in rect: CGRect) -> Path {
        Path(active ? rect : rect.insetBy(dx: -1000, dy: -1000))
    }
}

struct FillInPass: View, @preconcurrency Animatable {
    let flow: StartFlowModel
    /// The step whose stage the pass shows (the step on screen, or the step a back that changes the stage returns to).
    var showing: Step?
    /// The back running now: the dashes of the fields it clears and, on a change of stage, the morph. Nil at rest.
    var back: PassBack?
    let onBack: (Step) -> Void
    /// "Change platform, now {title}" on the recent path (the pass line of the route stage).
    var onChangePlatform: () -> Void = {}
    var onFieldFrame: (PassFieldName, CGRect) -> Void = { _, _ in }
    @Environment(\.palette) private var palette
    @Environment(\.shadows) private var shadows
    /// Where each value sits on each layout, in the body's space: the copies of a change of stage start and end there.
    @State private var spots: [SpotKey: PassValueSpot] = [:]

    var animatableData: Double {
        get { back?.progress ?? 0 }
        set { back?.progress = newValue }
    }

    private struct SpotKey: Hashable {
        let stage: Stage
        let field: PassFieldName
    }

    private nonisolated static let bodySpace = "passBody"

    private var step: Step { showing ?? flow.step }
    var stage: Stage { Self.stage(of: step) }
    enum Stage { case destination, route, ready }

    nonisolated static func stage(of step: Step) -> Stage {
        step >= 6 ? .ready : (step >= 4 ? .route : .destination)
    }

    /// The band's height token: 44 for the ready pass, 30 for the compact one (text at large sizes grows it further).
    nonisolated static func bandHeight(_ stage: Stage) -> Double {
        stage == .ready ? Tokens.Size.carrier : Tokens.Size.carrierCompact
    }

    /// The fields whose values a layout shows: the route stage's pass line carries the area and the platform.
    nonisolated static func shows(_ stage: Stage) -> [PassFieldName] {
        switch stage {
        case .destination: [.area, .platform, .deck]
        case .route: [.area, .platform, .deck, .section, .mode]
        case .ready: [.deck, .section, .mode]
        }
    }

    /// The values a change of stage carries across: on both layouts and still chosen after the back (`kept`); a field
    /// the back clears turns back into dashes instead (passValueTravel.ts matches values by field, never by text).
    nonisolated static func travelling(from old: Stage, to new: Stage, kept: Set<PassFieldName>) -> [PassFieldName] {
        PassFieldName.allCases.filter { kept.contains($0) && shows(old).contains($0) && shows(new).contains($0) }
    }

    private func field(_ name: PassFieldName, _ label: String, _ value: String?, mono: Bool = false, on step: Step) -> PassField {
        let fieldStep = stepOf(name.choiceKey, flow.choice)
        let canReturn = value != nil && fieldStep < step && !(name == .section && !flow.hasSections)
        return PassField(id: name, label: label, value: value, mono: mono, backTo: canReturn ? fieldStep : nil)
    }

    private var sectionValue: String? { flow.choice.sectionId.map { $0 == WHOLE_DECK ? "Whole deck" : $0 } }
    private var modeName: String? { flow.choice.mode.map { modeInfo($0).name } }

    func fields(_ stage: Stage, on step: Step) -> [PassField] {
        switch stage {
        case .destination:
            return [field(.area, "Area", flow.area?.title, on: step), field(.platform, "Platform", flow.platform?.title, on: step),
                    field(.deck, "Deck", flow.deck?.code, mono: true, on: step)]
        case .route, .ready:
            return [field(.deck, "Deck", flow.deck?.code, mono: true, on: step), field(.section, "Section", sectionValue, mono: true, on: step),
                    field(.mode, "Class", modeName, on: step)]
        }
    }

    var fields: [PassField] { fields(stage, on: step) }

    /// The stage the running back leaves, when it is not the one shown: the pass morphs from it.
    private var leavingStage: Stage? {
        guard let back, back.changesStage else { return nil }
        let old = Self.stage(of: back.from)
        return old == stage ? nil : old
    }

    /// The fields still chosen once the running back completes (it clears its target step and the later ones).
    private var kept: Set<PassFieldName> {
        let target = back?.transition.to ?? step
        let chosen: [PassFieldName: Bool] = [.area: flow.area != nil, .platform: flow.platform != nil, .deck: flow.deck != nil,
                                             .section: sectionValue != nil, .mode: modeName != nil]
        return Set(PassFieldName.allCases.filter { chosen[$0] == true && stepOf($0.choiceKey, flow.choice) < target })
    }

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: Tokens.Radius.card)
        let frame = back?.frame
        let leaving = leavingStage
        let morph = frame.map { PassMorph(frame: $0) }
        // A value travels only once both of its places are known, so a value is never hidden without its copies.
        let copied: [PassFieldName] = leaving.map { old in
            guard frame?.valuesTravel == true else { return [] }
            return Self.travelling(from: old, to: stage, kept: kept).filter {
                spots[SpotKey(stage: old, field: $0)] != nil && spots[SpotKey(stage: stage, field: $0)] != nil
            }
        } ?? []
        let hidden = Set(copied)
        VStack(spacing: 0) {
            band(minHeight: leaving.flatMap { old in morph?.height(from: Self.bandHeight(old), to: Self.bandHeight(stage)) }
                 ?? Self.bandHeight(stage))
            PassBodyLayout(morph: leaving == nil ? 1 : frame?.morph ?? 1) {
                block(stage, on: step, current: true, hidden: hidden)
                    .opacity(leaving == nil ? 1 : frame?.newBlockOpacity ?? 1)
                if let leaving, let back {
                    block(leaving, on: back.from, current: false, hidden: hidden)
                        .opacity(frame?.oldBlockOpacity ?? 0)
                        .allowsHitTesting(false)
                        .accessibilityHidden(true)
                }
            }
            .clipShape(MorphClip(active: leaving != nil && (frame?.morph ?? 1) < 1))
            .overlay(alignment: .topLeading) {
                if let leaving, let morph {
                    copies(copied, from: leaving, morph: morph)
                }
            }
            .coordinateSpace(name: Self.bodySpace)
        }
        .background(shape.fill(palette.surfaceRaised.color))
        .clipShape(shape)
        .tokenShadow(stage == .ready ? shadows.ticket : shadows.small, shape)
        .paperTextSize()
        .accessibilityElement(children: .contain)
    }

    /// The band of the stage shown: its look changes at once, its height with the paper (FillInPass.tsx: the band's
    /// height transition).
    private func band(minHeight: Double) -> some View {
        HStack(spacing: Tokens.Space.s8) {
            if stage == .ready {
                IconShape(icon: .carrierCloud).fill(palette.onAccent.color).frame(width: 22, height: 16)
                Text("Truthy").typeRole(Tokens.TypeRole.carrierTitle)
                Spacer()
                Text("BOARDING PASS").typeRole(Tokens.TypeRole.carrierLabel)
            } else {
                LogoMark(width: 20, variant: .compact)
                Text("Truthy").typeRole(Tokens.TypeRole.carrierTitleCompact)
                Spacer()
                Text("YOUR PASS").typeRole(Tokens.TypeRole.carrierLabelCompact)
            }
        }
        .foregroundStyle(palette.onAccent.color)
        .padding(.horizontal, Tokens.Space.s16)
        .frame(minHeight: minHeight)
        .background(palette.accent.color)
        .clipped()
        .accessibilityHidden(true)
    }

    /// What the paper holds under its band in one layout. `current` is the block on screen; the block a change of
    /// stage leaves is drawn with its own step, clears nothing and reports no field frames.
    @ViewBuilder private func block(_ stage: Stage, on step: Step, current: Bool, hidden: Set<PassFieldName>) -> some View {
        switch stage {
        case .ready:
            readyBody(hidden: hidden)
        case .route:
            VStack(spacing: 0) {
                passLine(hidden: hidden)
                fieldRow(fields(stage, on: step), stage: stage, current: current, hidden: hidden)
            }
        case .destination:
            fieldRow(fields(stage, on: step), stage: stage, current: current, hidden: hidden)
        }
    }

    /// A pass value: it reports where it sits on its layout (text and look included, so a new value is never drawn
    /// with an old copy's words) and hides while its copies travel.
    private func value(_ text: String, _ style: TypeStyle, _ stage: Stage, _ field: PassFieldName, hidden: Set<PassFieldName>) -> some View {
        Text(text).typeRole(style).lineLimit(1)
            .onGeometryChange(for: PassValueSpot.self) { PassValueSpot(text: text, style: style, rect: $0.frame(in: .named(Self.bodySpace))) } action: {
                spots[SpotKey(stage: stage, field: field)] = $0
            }
            .opacity(hidden.contains(field) ? 0 : 1)
    }

    /// The two copies of each travelling value, over the body, out of the reading order and taking no presses.
    private func copies(_ fields: [PassFieldName], from old: Stage, morph: PassMorph) -> some View {
        ZStack(alignment: .topLeading) {
            ForEach(fields, id: \.self) { field in
                if let a = spots[SpotKey(stage: old, field: field)], let b = spots[SpotKey(stage: stage, field: field)] {
                    // The ready pass's section leg keeps to the right: there the right edges meet.
                    let right = field == .section && (old == .ready || stage == .ready)
                    let pair = morph.copies(from: a.rect, to: b.rect, right: right)
                    copy(a, pair.old, right: right)
                    copy(b, pair.new, right: right)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    private func copy(_ spot: PassValueSpot, _ copy: PassMorph.Copy, right: Bool) -> some View {
        Text(spot.text).typeRole(spot.style).lineLimit(1)
            .foregroundStyle(palette.ink.color)
            .frame(width: spot.rect.width, height: spot.rect.height, alignment: .leading)
            .scaleEffect(copy.scale, anchor: right ? .topTrailing : .topLeading)
            .offset(x: spot.rect.minX + copy.dx, y: spot.rect.minY + copy.dy)
            .opacity(copy.opacity)
    }

    /// The route stage's pass line (FillInPass.tsx): "area · platform", each word a way back. On the recent path the
    /// platform word is the change-platform rewrite (task 11).
    private func passLine(hidden: Set<PassFieldName>) -> some View {
        HStack(spacing: Tokens.Space.s2) {
            if let area = flow.area {
                lineWord(changeLabel(.area, area.title), area.title, .area, hidden: hidden) { onBack(1) }
            }
            Text("·").typeRole(Tokens.TypeRole.passLine).foregroundStyle(palette.rule.color).accessibilityHidden(true)
            if let platform = flow.platform {
                lineWord(changeLabel(.platform, platform.title), platform.title, .platform, hidden: hidden) {
                    flow.recent ? onChangePlatform() : onBack(2)
                }
            }
        }
        .padding(.horizontal, Tokens.Space.s10)
        .padding(.top, Tokens.Space.s8)
        .frame(maxWidth: .infinity, minHeight: Tokens.Size.passLine, alignment: .leading)
    }

    private func lineWord(_ label: String, _ text: String, _ field: PassFieldName, hidden: Set<PassFieldName>,
                          _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            value(text, Tokens.TypeRole.passLine, .route, field, hidden: hidden).foregroundStyle(palette.ink.color)
                .frame(minWidth: Tokens.Size.touchMin, minHeight: Tokens.Size.touchMin).contentShape(Rectangle())
        }
        .buttonStyle(PressTintButtonStyle(shape: RoundedRectangle(cornerRadius: Tokens.Radius.small)))
        .keyboardFocusRing(RoundedRectangle(cornerRadius: Tokens.Radius.small))
        .accessibilityLabel(label)
    }

    private func fieldRow(_ fields: [PassField], stage: Stage, current: Bool, hidden: Set<PassFieldName>) -> some View {
        HStack(alignment: .top, spacing: Tokens.Space.s8) {
            ForEach(fields) { field in
                fieldView(field, stage: stage, current: current, hidden: hidden).frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(.horizontal, Tokens.Space.s16)
        .padding(.vertical, Tokens.Space.s10)
    }

    @ViewBuilder private func fieldView(_ field: PassField, stage: Stage, current: Bool, hidden: Set<PassFieldName>) -> some View {
        let content = VStack(alignment: .leading, spacing: Tokens.Space.s2) {
            Text(field.label).typeRole(Tokens.TypeRole.fieldLabel).foregroundStyle(palette.inkMuted.color)
            if let text = field.value {
                // A field a running back clears turns back into dashes (BackTransition's dashes part).
                let clearing = current && back.map { stepOf(field.id.choiceKey, flow.choice) >= $0.transition.to } ?? false
                let dashes = back?.frame.dashesOpacity ?? 1
                ZStack(alignment: .topLeading) {
                    value(text, field.mono ? Tokens.TypeRole.fieldValue : Tokens.TypeRole.fieldValuePass, stage, field.id, hidden: hidden)
                        .opacity(clearing ? 1 - dashes : 1)
                    if clearing { Text("---").typeRole(Tokens.TypeRole.fieldValue).opacity(dashes).accessibilityHidden(true) }
                }
            } else {
                Text("---").typeRole(Tokens.TypeRole.fieldValue).accessibilityLabel("not chosen")
            }
        }
        .foregroundStyle(palette.ink.color)
        .frame(minHeight: 43, alignment: .topLeading)
        .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("flow")) } action: { if current { onFieldFrame(field.id, $0) } }
        if let step = field.backTo, let text = field.value {
            Button { onBack(step) } label: { content.contentShape(Rectangle()) }
                .buttonStyle(PressTintButtonStyle(shape: RoundedRectangle(cornerRadius: Tokens.Radius.small)))
                .keyboardFocusRing(RoundedRectangle(cornerRadius: Tokens.Radius.small))
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(changeLabel(field.id, text))
                .accessibilityAddTraits(.isButton)
        } else {
            content.accessibilityElement(children: .combine)
        }
    }

    private func readyBody(hidden: Set<PassFieldName>) -> some View {
        let section = flow.deck?.sections.first { $0.id == flow.choice.sectionId }
        let cards = section?.cardCount ?? flow.deck?.cardCount ?? 0
        return VStack(spacing: 0) {
            HStack {
                legButton(.deck, code: flow.deck?.code ?? "", name: flow.deck?.title ?? "", hidden: hidden)
                Spacer()
                legButton(.section, code: flow.choice.sectionId ?? "", name: section?.title ?? "Whole deck", hidden: hidden)
            }
            .padding(Tokens.Space.s16)
            Perforation(axis: .horizontal)
            HStack(alignment: .top) {
                readyField("Class", modeName ?? "", backTo: 5, name: .mode, hidden: hidden)
                readyField("Cards", "\(cards)", backTo: nil, name: nil, hidden: hidden)
                VStack(alignment: .leading, spacing: Tokens.Space.s2) {
                    Text("Gate").typeRole(Tokens.TypeRole.fieldLabel).foregroundStyle(palette.inkMuted.color)
                    Text("F ← → T").typeRole(Tokens.TypeRole.fieldValue).accessibilityHidden(true)
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("Gate, False left, true right")
            }
            .foregroundStyle(palette.ink.color)
            .padding(Tokens.Space.s16)
        }
    }

    private func legButton(_ name: PassFieldName, code: String, name title: String, hidden: Set<PassFieldName>) -> some View {
        let label = name == .section && code == WHOLE_DECK ? "Whole deck" : code
        let canReturn = !(name == .section && !flow.hasSections)
        return Button { onBack(name == .deck ? 3 : 4) } label: {
            VStack(alignment: .leading, spacing: Tokens.Space.s2) {
                value(code, Tokens.TypeRole.legCode, .ready, name, hidden: hidden)
                Text(title).typeRole(Tokens.TypeRole.legName).foregroundStyle(palette.inkMuted.color)
            }
            .foregroundStyle(palette.ink.color)
            .contentShape(Rectangle())
        }
        .buttonStyle(PressTintButtonStyle(shape: RoundedRectangle(cornerRadius: Tokens.Radius.small)))
        .disabled(!canReturn)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(canReturn ? changeLabel(name, label) : "\(label), \(title)")
    }

    private func readyField(_ label: String, _ text: String, backTo: Step?, name: PassFieldName?, hidden: Set<PassFieldName>) -> some View {
        let content = VStack(alignment: .leading, spacing: Tokens.Space.s2) {
            Text(label).typeRole(Tokens.TypeRole.fieldLabel).foregroundStyle(palette.inkMuted.color)
            if let name {
                value(text, Tokens.TypeRole.fieldValue, .ready, name, hidden: hidden)
            } else {
                Text(text).typeRole(Tokens.TypeRole.fieldValue)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        return Group {
            if let backTo, let name {
                Button { onBack(backTo) } label: { content.contentShape(Rectangle()) }
                    .buttonStyle(PressTintButtonStyle(shape: RoundedRectangle(cornerRadius: Tokens.Radius.small)))
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel(changeLabel(name, text))
            } else {
                content.accessibilityElement(children: .combine)
            }
        }
    }
}

extension PassFieldName {
    var choiceKey: ChoiceKey {
        switch self {
        case .area: .areaId
        case .platform: .platformId
        case .deck: .deckId
        case .section: .sectionId
        case .mode: .mode
        }
    }
}
```

`ios/Truthy/TruthyTests/PassMorphTests.swift`, the values the pass reads at each frame of a back that changes its stage:

```swift
import CoreGraphics
import Testing
import TruthyEngine
@testable import Truthy

// README "Cross-platform agreements", the start back motion: on a change of stage the pass draws what BackTransition's
// frame holds (plan C task 11 rule 4): the band's and the body's heights morph, the two blocks cross-fade and each
// value kept on both layouts travels as two copies. These are the values FillInPass reads at each frame.
@Suite struct PassMorphTests {
    /// Ready to route (6 to 5) and route to destination (4 to 3, four items: 425 ms, the morph is over by 360).
    private let fromSix = BackTransition(from: 6, to: 5, itemCount: 1)
    private let fromFour = BackTransition(from: 4, to: 3, itemCount: 4)
    /// The deck code as the ready pass's leg (Mono 34) and as the route stage's Deck field (Mono 16), in body points.
    private let leg = CGRect(x: 16, y: 16, width: 66, height: 43)
    private let field = CGRect(x: 16, y: 66, width: 31, height: 20)

    private func near(_ copy: PassMorph.Copy, _ dx: Double, _ dy: Double, _ scale: Double, _ opacity: Double) -> Bool {
        abs(copy.dx - dx) < 1e-9 && abs(copy.dy - dy) < 1e-9 && abs(copy.scale - scale) < 1e-9 && abs(copy.opacity - opacity) < 1e-9
    }

    private func morph(_ back: BackTransition, _ p: Double, reduced: Bool = false) -> PassMorph {
        PassMorph(frame: back.frame(at: p, reducedMotion: reduced))
    }

    @Test func progressZeroIsThePassBeingLeftAtRest() {
        let start = morph(fromSix, 0)
        #expect(start.height(from: FillInPass.bandHeight(.ready), to: FillInPass.bandHeight(.route)) == Tokens.Size.carrier)
        #expect(start.height(from: 120, to: 72) == 120)
        #expect(start.frame.oldBlockOpacity == 1 && start.frame.newBlockOpacity == 0)
        let copies = start.copies(from: leg, to: field, right: false)
        #expect(near(copies.old, 0, 0, 1, 1), "the old copy covers the old value")
        #expect(copies.new.opacity == 0)
    }

    @Test func progressOneIsThePassComingBackAtRest() {
        let end = morph(fromSix, 1)
        #expect(end.height(from: FillInPass.bandHeight(.ready), to: FillInPass.bandHeight(.route)) == Tokens.Size.carrierCompact)
        #expect(end.height(from: 120, to: 72) == 72)
        #expect(end.frame.oldBlockOpacity == 0 && end.frame.newBlockOpacity == 1)
        let copies = end.copies(from: leg, to: field, right: false)
        #expect(copies.old.opacity == 0)
        #expect(near(copies.new, 0, 0, 1, 1), "the new copy covers the new value")
    }

    @Test func theHeightFollowsTheProgressWithoutAJump() {
        // Each hundredth of the progress moves the height by a few points at most, never the whole 48 at once.
        var last = 120.0
        for i in 1...100 {
            let height = morph(fromFour, Double(i) / 100).height(from: 120, to: 72)
            #expect(height <= last && height >= 72, "p \(i)")
            #expect(last - height < 3, "no jump at p \(i)")
            last = height
        }
        #expect(last == 72)
        #expect(morph(fromFour, 0.5).height(from: 120, to: 72) < 120 && morph(fromFour, 0.5).height(from: 120, to: 72) > 72)
    }

    @Test func theTwoCopiesCoverEachOtherAllTheWay() {
        for i in 0...20 {
            let p = Double(i) / 20
            for right in [false, true] {
                let copies = morph(fromSix, p).copies(from: leg, to: field, right: right)
                let oldEdge = (right ? leg.maxX : leg.minX) + copies.old.dx
                let newEdge = (right ? field.maxX : field.minX) + copies.new.dx
                #expect(abs(oldEdge - newEdge) < 1e-9, "p \(p), right \(right)")
                #expect(abs(leg.minY + copies.old.dy - (field.minY + copies.new.dy)) < 1e-9)
                #expect(abs(leg.height * copies.old.scale - field.height * copies.new.scale) < 1e-9)
            }
        }
    }

    @Test func theCopiesCrossFadeOnALinearClock() {
        // passValueTravel.ts: the old copy is gone by 60 percent of the 360, the new one comes in from 40 percent.
        let ms = { (t: Double) in self.fromSix.frame(at: t / 360, reducedMotion: false) }
        #expect(abs(ms(108).oldValueOpacity - 0.5) < 1e-9)
        #expect(ms(216).oldValueOpacity == 0)
        #expect(ms(144).newValueOpacity == 0)
        #expect(abs(ms(252).newValueOpacity - 0.5) < 1e-9)
    }

    @Test func reducedMotionSwitchesTheHeightWhenTheOldStepHasFadedAndCopiesNothing() {
        #expect(morph(fromSix, 99.0 / 230, reduced: true).height(from: 120, to: 72) == 120)
        #expect(morph(fromSix, 101.0 / 230, reduced: true).height(from: 120, to: 72) == 72)
        #expect(!fromSix.frame(at: 0.5, reducedMotion: true).valuesTravel)
    }

    @Test func theValuesKeptOnBothLayoutsTravelAndTheClearedOnesDoNot() {
        // 6 to 5 clears the class: the deck and the section travel from the legs to the fields.
        #expect(FillInPass.travelling(from: .ready, to: .route, kept: [.area, .platform, .deck, .section]) == [.deck, .section])
        // 4 to 3 clears the deck: the area and the platform travel from the pass line to their fields.
        #expect(FillInPass.travelling(from: .route, to: .destination, kept: [.area, .platform]) == [.area, .platform])
        // 6 to 3 (the deck leg) clears the deck: no value is on both layouts and kept.
        #expect(FillInPass.travelling(from: .ready, to: .destination, kept: [.area, .platform]).isEmpty)
    }
}
```

- [ ] **Step 6: Write the steps and the screen.**

`ios/Truthy/Truthy/Start/StepContent.swift`:

```swift
import SwiftUI
import TruthyEngine

// What each start step lists (reference 4.1 and 4.5): its title and its cards, built from the index, the progress
// and the choices. A pure description, so the back motion can draw the step being left and the step coming back at
// once.

struct StepOption: Identifiable {
    let id: String
    let card: DestinationCard
}

@MainActor
struct StepContent {
    let flow: StartFlowModel
    let app: AppModel
    let step: Step
    let choose: (StepChoice) -> Void

    enum StepChoice {
        case area(String), recent, platform(String), deck(String), recentDeck(RecentDeck), section(String), mode(Mode)
    }

    static let titles: [Step: String] = [
        1: "Choose an area", 2: "Choose a platform", 3: "Choose a deck", 4: "Choose a section", 5: "Choose how to play",
        6: "Your pass is ready",
    ]
    static let backTo: [Step: String] = [1: "areas", 2: "platforms", 3: "decks", 4: "sections", 5: "classes"]

    var title: String { Self.titles[step] ?? "" }

    var options: [StepOption] {
        switch step {
        case 1: areaOptions
        case 2: platformOptions
        case 3: flow.recent ? recentOptions : deckOptions
        case 4: sectionOptions
        case 5: classOptions
        default: []
        }
    }

    private var areaOptions: [StepOption] {
        var options: [StepOption] = []
        if app.recent.count >= 2 {
            options.append(StepOption(id: RECENT, card: DestinationCard(
                name: "Recent", detail: app.recent.map(\.deck.code).joined(separator: " · "),
                label: "Recent, \(decksLabel(app.recent.count))") { choose(.recent) }))
        }
        for area in flow.index.areas {
            let count = deckCount(area)
            options.append(StepOption(id: area.id, card: DestinationCard(
                name: area.title, detail: decksLabel(count), enabled: count > 0,
                label: count > 0 ? "\(area.title), \(decksLabel(count))" : "\(area.title), no decks yet") { choose(.area(area.id)) }))
        }
        return options
    }

    private var platformOptions: [StepOption] {
        (flow.area?.platforms ?? []).map { platform in
            let count = deckCount(platform)
            return StepOption(id: platform.id, card: DestinationCard(
                name: platform.title, detail: decksLabel(count), enabled: count > 0,
                label: count > 0 ? "\(platform.title), \(decksLabel(count))" : "\(platform.title), no decks yet") { choose(.platform(platform.id)) })
        }
    }

    private func deckCard(_ deck: IndexDeck, _ action: @escaping () -> Void) -> DestinationCard {
        let percent = seenPercent(app.progress, (id: deck.id, cardCount: deck.cardCount))
        let status = percent == 0 ? "Not started" : "\(percent)% seen"
        let label = percent == 0
            ? "\(deck.code), \(deck.title), \(deck.cardCount) cards, not started"
            : "\(deck.code), \(deck.title), \(deck.cardCount) cards, \(percent) percent seen"
        return DestinationCard(name: deck.code, nameStyle: .code, detail: deck.title, status: status, stubLabel: "Cards",
                               stubValue: "\(deck.cardCount)", stubWidth: Tokens.Size.cardStubDeck, minHeight: Tokens.Size.cardMinDeck,
                               label: label, action: action)
    }

    private var deckOptions: [StepOption] {
        (flow.platform?.decks ?? []).map { deck in StepOption(id: deck.id, card: deckCard(deck) { choose(.deck(deck.id)) }) }
    }

    private var recentOptions: [StepOption] {
        app.recent.map { recent in StepOption(id: recent.deck.id, card: deckCard(recent.deck) { choose(.recentDeck(recent)) }) }
    }

    private var sectionOptions: [StepOption] {
        guard let deck = flow.deck else { return [] }
        let whole = StepOption(id: WHOLE_DECK, card: DestinationCard(
            name: "Whole deck", detail: "All \(deck.sections.count) sections", stubLabel: "Cards", stubValue: "\(deck.cardCount)",
            stubWidth: Tokens.Size.cardStubDeck, minHeight: Tokens.Size.cardMinSection,
            label: "Whole deck, all \(deck.sections.count) sections, \(deck.cardCount) cards") { choose(.section(WHOLE_DECK)) })
        return [whole] + deck.sections.map { section in
            StepOption(id: section.id, card: DestinationCard(
                name: section.id, nameStyle: .code, detail: section.title, stubLabel: "Cards", stubValue: "\(section.cardCount)",
                stubWidth: Tokens.Size.cardStubDeck, minHeight: Tokens.Size.cardMinSection,
                label: "\(section.id), \(section.title), \(section.cardCount) cards") { choose(.section(section.id)) })
        }
    }

    private var classOptions: [StepOption] {
        guard let route = flow.choice.deckId.flatMap({ deckId in flow.choice.sectionId.map { Route(deckId: deckId, sectionId: $0) } }) else { return [] }
        return MODE_TABLE.map { row in
            let best = bestFor(app.progress, route, row.id)
            if !row.offered {
                return StepOption(id: row.id.rawValue, card: DestinationCard(
                    name: row.name, detail: "Not available yet", chevron: false, enabled: false, label: "\(row.name), not available yet") {})
            }
            let label = best.map { "\(row.name). \(row.description) Your best: \($0) \(row.unit)." } ?? "\(row.name). \(row.description) Not played yet."
            return StepOption(id: row.id.rawValue, card: DestinationCard(
                name: row.name, detail: row.description, detailMuted: true, stubLabel: "Best", stubValue: best.map(String.init) ?? "–",
                stubUnit: best == nil ? "not played" : row.unit, stubValueMuted: best == nil, stubWidth: Tokens.Size.cardStubDeck,
                minHeight: Tokens.Size.cardMinClass, chevron: false, label: label) { choose(.mode(row.id)) })
        }
    }
}
```

`ios/Truthy/Truthy/Start/StartFlowView.swift`:

```swift
import SwiftUI
import TruthyEngine

// The start flow (spec 3 and 5.1, reference 4.1 to 4.5): one screen whose steps change in place. Forward plays the
// web's forward motion; every way back (the edge pan, the anywhere pan on iOS 26, the Back pill, a pass field,
// Escape, "Change platform") plays BackTransition, driven by the finger or over its own duration. Lists are announced
// as lists and fade at the bottom while more lies below (task 5's listCue).

struct StartFlowView: View {
    let model: AppModel
    @Environment(\.palette) private var palette
    @Environment(\.accessibilityReduceMotion) private var reducedMotion
    @AccessibilityFocusState private var titleFocused: Bool
    @AccessibilityFocusState private var focusedCard: String?
    /// The screen's root holds keyboard focus, so Escape works after touches (a touch never moves focus on iOS).
    @FocusState private var keysFocused: Bool
    @State private var unrollScale = 0.0
    @State private var unrollRoute: Route?
    @State private var unrollMode: Mode?
    @State private var backTarget: Step?
    /// True while a played back runs (the Back pill, a pass field, Escape, Change platform): the pans are off then.
    @State private var playingBack = false
    /// What the played back does when it completes.
    @State private var playedBack: PlayedBack = .back
    /// True while this view's own pan drives the back: its recognizer stays enabled (disabling it would cancel it).
    @State private var panning = false
    /// The panel on screen arrived forward (its items drop in, staggered) or at rest (launch, after a back).
    @State private var arrivedForward = false
    @State private var cardFrames: [String: CGRect] = [:]
    @State private var fieldFrames: [PassFieldName: CGRect] = [:]
    @State private var travel: NameTravel?
    @State private var windowHeight = 0.0
    @Environment(\.dynamicTypeSize) private var typeSize
    /// The whole column's scroll on a short screen or at an accessibility text size (rule 9).
    @State private var columnPosition = ScrollPosition(edge: .top)
    @State private var columnOffset = 0.0
    /// The column was scrolled when the step on screen arrived and jumped to its top (StartFlow.tsx:489-501).
    @State private var columnJumped = false

    private enum PlayedBack { case back, changePlatform }

    private var flow: StartFlowModel { model.startFlow }
    private var backRuns: Bool { backTarget != nil && flow.backProgress != nil }

    /// Rule 9: under 568 tall (the web's `short`) or at an accessibility text size the fixed layout does not fit, so
    /// the whole column scrolls: the zones take their own heights and the foot zone follows the list.
    private var short: Bool {
        (windowHeight > 0 && windowHeight < FrameLayout.shortScreen) || typeSize.isAccessibilitySize
    }

    /// Rule 5: right after the column jumped to its top, the Back pill and the pass fields lie where the finger just
    /// was, so a press on them waits out the step's settle time (a double tap must not take a way back unseen).
    private var headerHeld: Bool { columnJumped && !flow.settled }

    var body: some View {
        ZStack {
            SkyBackdrop(lowerCloud: .start)
            AppFrame {
                if short {
                    ScrollView {
                        column
                    }
                    .scrollPosition($columnPosition)
                    .onScrollGeometryChange(for: Double.self) { $0.contentOffset.y + $0.contentInsets.top } action: { _, y in columnOffset = y }
                } else {
                    column
                }
            }
            if flow.unrolling {
                RoundedRectangle(cornerRadius: Tokens.Radius.card)
                    .fill(palette.surfaceRaised.color)
                    .scaleEffect(x: 1, y: unrollScale, anchor: .top)
                    .padding(Tokens.Size.gutter)
                    .accessibilityHidden(true)
                    .onAppear {
                        guard let route = unrollRoute, let mode = unrollMode else { return }
                        withAnimation(Tokens.Curve.ease.animation(Tokens.Duration.t3)) {
                            unrollScale = 1
                        } completion: {
                            model.startRound(route: route, mode: mode)
                        }
                    }
            }
            if let travel {
                NameTravelView(travel: travel).onAppear {
                    withAnimation(Tokens.Curve.ease.animation(Tokens.Duration.travel, delay: Tokens.Duration.travelHold)) {
                        self.travel?.progress = 1
                    } completion: {
                        self.travel = nil
                    }
                }
            }
        }
        .onGeometryChange(for: Double.self) { $0.size.height } action: { windowHeight = $0 }
        .coordinateSpace(name: "flow")
        .allowsHitTesting(!flow.unrolling)
        .backPans(isEnabled: flow.canGoBack && !playingBack, anywhere: true, onEvent: handlePan)
        .focusable(interactions: .edit)
        .focusEffectDisabled()
        .focused($keysFocused)
        .onKeyPress(.escape, phases: .down) { _ in
            playBack(to: flow.step == 1 ? nil : flow.previous)
            return .handled
        }
        .onChange(of: flow.step) { old, new in
            // Rule 9: a step that arrives starts at the column's top, with the pass and its title in view.
            columnJumped = short && columnOffset > 0
            if columnJumped {
                var jump = Transaction()
                jump.disablesAnimations = true
                withTransaction(jump) { columnPosition.scrollTo(edge: .top) }
            }
            if new > old { titleFocused = true } else { focusedCard = flow.focusAfterBack }
        }
        .onAppear {
            keysFocused = true
            if model.returnedFromRound { titleFocused = true }
        }
    }

    /// The top zone, the step's panel and the foot zone, in a column that fills the frame, or that scrolls as one
    /// on a short screen (rule 9).
    private var column: some View {
        VStack(spacing: 0) {
            topZones
            ZStack(alignment: .top) {
                if let target = backTarget, flow.backProgress != nil {
                    ZStack(alignment: .top) {
                        stepPanel(target, leaving: false)
                        stepPanel(flow.step, leaving: true)
                    }
                    // Inserted at progress 0; a played back animates it from here (a value a view is inserted
                    // with would not be interpolated).
                    .onAppear { if playingBack { runPlayedBack(target) } }
                } else {
                    stepPanel(flow.step, leaving: nil)
                        .id(flow.step)
                        .transition(.asymmetric(
                            insertion: .identity,
                            removal: reducedMotion
                                ? .opacity.animation(Tokens.Curve.easeOut.animation(Tokens.Duration.reducedOut))
                                : .offset(y: -10).combined(with: .opacity).animation(Tokens.Curve.easeOut.animation(Tokens.Duration.stepExit))))
                }
            }
            .padding(.top, Tokens.Space.s20)
            footZones
        }
    }

    // MARK: Back motion

    /// The one transition of the back running now, or of a back to `target`: every part reads the same time base.
    private func backMotion(_ target: Step) -> BackTransition {
        BackTransition(from: flow.step, to: target, itemCount: StepContent(flow: flow, app: model, step: target, choose: choose).options.count + 1)
    }

    private func motion(_ role: BackMotion.Role) -> BackMotion {
        BackMotion(progress: flow.backProgress ?? 0, transition: backMotion(backTarget ?? flow.previous), role: role, reducedMotion: reducedMotion)
    }

    /// The back running now as the pass reads it: the pass animates the progress itself, so its dashes, its morph and
    /// its value copies are the frame's at every frame of a played back or a spring. Nil at rest.
    private var passBack: PassBack? {
        guard let target = backTarget, let progress = flow.backProgress else { return nil }
        return PassBack(from: flow.step, transition: backMotion(target), progress: progress, reducedMotion: reducedMotion)
    }

    // MARK: Zones

    @ViewBuilder private var topZones: some View {
        HStack(alignment: .top) {
            ZStack(alignment: .topLeading) {
                if let target = backTarget, backRuns, target == 1 {
                    topZone(1).modifier(motion(.brandIn))
                    topZone(flow.step).modifier(motion(.tripOut))
                } else {
                    // The same view at rest and during a back that changes the pass's stage, so the pass keeps its
                    // identity (and its measured values) and nothing is inserted when the back completes.
                    topZone(flow.step)
                        .id(flow.step == 1)
                        .transition(.asymmetric(
                            insertion: .offset(y: flow.step == 1 ? -12 : 12).combined(with: .opacity)
                                .animation(Tokens.Curve.ease.animation(Tokens.Duration.stepEnter, delay: Tokens.Duration.topEnterDelay)),
                            removal: .offset(y: 12).combined(with: .opacity).animation(Tokens.Curve.ease.animation(Tokens.Duration.topExit))))
                }
            }
            .opacity(flow.unrolling ? 0 : 1)
            .animation(Tokens.Curve.ease.animation(Tokens.Duration.topExit), value: flow.unrolling)
            Spacer(minLength: Tokens.Space.s8)
            Group {
                if backRuns {
                    ThemeSwitch(theme: model.theme) { model.switchTheme() }
                        .modifier(SwitchShift(progress: flow.backProgress ?? 0, transition: backMotion(backTarget ?? flow.previous),
                                              reducedMotion: reducedMotion, onStepOne: false))
                } else {
                    ThemeSwitch(theme: model.theme) { model.switchTheme() }
                        .modifier(SwitchShift(progress: 0, transition: nil, reducedMotion: reducedMotion, onStepOne: flow.step == 1))
                        .animation(Tokens.Curve.ease.animation(Tokens.Duration.stepEnter), value: flow.step == 1)
                }
            }
            .opacity(flow.unrolling ? 0 : 1)
            .animation(Tokens.Curve.ease.animation(Tokens.Duration.topExit), value: flow.unrolling)
        }
        .foregroundStyle(palette.ink.color)
        .frame(minHeight: !short && (flow.step == 1 || backTarget == 1) ? Tokens.Size.startTopZone : nil, alignment: .top)
    }

    /// The top zone of `step`: the logo and the tagline on step 1, the Back pill and the pass on the others.
    @ViewBuilder private func topZone(_ step: Step) -> some View {
        if step == 1 {
            VStack(alignment: .leading, spacing: Tokens.Space.s14) {
                HStack(spacing: Tokens.Space.s10) {
                    LogoMark()
                    Text("Truthy").typeRole(Tokens.TypeRole.logo)
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("Truthy")
                .accessibilityAddTraits(.isHeader)
                Text("True or false cards that teach you IT, one swipe at a time.")
                    .typeRole(Tokens.TypeRole.tagline)
                    .frame(maxWidth: 300, alignment: .leading)
            }
            .padding(.top, 36)
        } else {
            tripZone(step)
        }
    }

    /// The Back pill over the pass. During a back that changes the pass's stage the pass shows the stage it returns
    /// to and morphs from the one it leaves (FillInPass reads the frame).
    private func tripZone(_ step: Step) -> some View {
        let back = passBack
        let showing = back.map { $0.changesStage ? $0.transition.to : step } ?? step
        return VStack(alignment: .leading, spacing: Tokens.Space.s12) {
            Button { if !headerHeld { playBack(to: flow.previous) } } label: {
                HStack(spacing: Tokens.Space.s6) {
                    IconView(icon: .backPill, size: 18)
                    Text("Back").typeRole(Tokens.TypeRole.buttonBack)
                }
                .padding(.horizontal, Tokens.Space.s16)
                .frame(minHeight: Tokens.Size.pillSmall)
                .background(Capsule().fill(palette.surfaceRaised.color))
            }
            .buttonStyle(.backPill)
            .keyboardFocusRing(Capsule())
            .accessibilityLabel("Back to \(StepContent.backTo[flow.previous] ?? "areas")")
            FillInPass(flow: flow, showing: showing, back: back,
                       onBack: { target in if !headerHeld { playBack(to: target) } },
                       onChangePlatform: { if !headerHeld { playBackToPlatform() } },
                       onFieldFrame: { name, frame in fieldFrames[name] = frame })
        }
    }

    @ViewBuilder private var footZones: some View {
        ZStack(alignment: .bottom) {
            if let target = backTarget, backRuns {
                if target == 1, let continueTarget = model.continueTarget { continueLine(continueTarget).modifier(motion(.footIn)) }
                if flow.step == 6 { startRoundButton.modifier(motion(.footOut)) }
            } else if flow.step == 1, let target = model.continueTarget {
                continueLine(target)
                    .transition(.offset(y: 12).combined(with: .opacity)
                        .animation(Tokens.Curve.ease.animation(Tokens.Duration.stepEnter, delay: Tokens.Duration.topEnterDelay)))
            } else if flow.step == 6 {
                startRoundButton
                    .transition(.asymmetric(
                        insertion: .offset(y: 12).combined(with: .opacity)
                            .animation(Tokens.Curve.ease.animation(Tokens.Duration.stepEnter, delay: Tokens.Duration.topEnterDelay)),
                        removal: .offset(y: 12).combined(with: .opacity).animation(Tokens.Curve.ease.animation(Tokens.Duration.topExit))))
            }
        }
    }

    private func continueLine(_ target: ContinueTarget) -> some View {
        ContinueLine(target: target) {
            withAnimation(Tokens.Curve.ease.animation(Tokens.Duration.stepEnter, delay: Tokens.Duration.stepEnterDelay)) {
                if flow.continueTo(target) { arrivedForward = true }
            }
        }
        .padding(.bottom, 4)
    }

    private var startRoundButton: some View {
        PillButton(title: "Start round", trailingArrow: true) { startRound() }
            .padding(.bottom, 4)
    }

    // MARK: A step

    /// A step's panel: `leaving` true is the step a back leaves, false the step it comes back to, nil a step at rest or
    /// arriving forward.
    private func stepPanel(_ step: Step, leaving: Bool?) -> some View {
        let content = StepContent(flow: flow, app: model, step: step, choose: choose)
        // Reference 4.1 S6: 112 above the title, 88 under 600 tall, none where the column scrolls (rule 9).
        let readyOffset = short ? 0
            : windowHeight < 600 ? Tokens.Size.readyOffset - 24 : Tokens.Size.readyOffset
        return VStack(alignment: .leading, spacing: Tokens.Space.s8) {
            Text(content.title)
                .typeRole(Tokens.TypeRole.stepTitle)
                .frame(minHeight: Tokens.Native.stepTitleRow)
                .padding(.top, step == 6 ? readyOffset : 0)
                .accessibilityAddTraits(.isHeader)
                .accessibilityFocused($titleFocused)
                .modifier(OptionalMotion(motion: leaving == true ? motion(.oldTitle) : leaving == false ? motion(.newItem(0)) : nil))
                .modifier(EnteringItem(index: 0, animate: leaving == nil && arrivedForward, reducedMotion: reducedMotion))
            if step == 6, let mode = flow.choice.mode {
                Text("\(modeInfo(mode).description) Swipe right for true, left for false.")
                    .typeRole(Tokens.TypeRole.tagline)
                    .frame(maxWidth: 320, alignment: .leading)
                    .modifier(OptionalMotion(motion: leaving == false ? motion(.newItem(1)) : nil))
                    .modifier(EnteringItem(index: 1, animate: leaving == nil && arrivedForward, reducedMotion: reducedMotion))
            } else {
                FadingList(options: content.options, step: step, scrolls: !short, focusedCard: $focusedCard,
                           revealId: leaving == nil && !arrivedForward ? flow.focusAfterBack : nil,
                           motion: { i in leaving == false ? motion(.newItem(i + 1)) : nil },
                           entering: { i in EnteringItem(index: i + 1, animate: leaving == nil && arrivedForward, reducedMotion: reducedMotion) },
                           onCardFrame: { id, frame in cardFrames[id] = frame })
            }
        }
        .foregroundStyle(palette.ink.color)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        // The panel a back leaves sinks and fades as one; its title also fades faster on its own (oldTitle above).
        .modifier(OptionalMotion(motion: leaving == true ? motion(.oldPanel) : nil))
    }

    // MARK: Actions

    private func choose(_ choice: StepContent.StepChoice) {
        startTravel(choice)
        withAnimation(Tokens.Curve.ease.animation(Tokens.Duration.stepEnter, delay: Tokens.Duration.stepEnterDelay)) {
            let moved: Bool
            switch choice {
            case .area(let id): moved = flow.chooseArea(id)
            case .recent: moved = flow.chooseRecent()
            case .platform(let id): moved = flow.choosePlatform(id)
            case .deck(let id): moved = flow.chooseDeck(id)
            case .recentDeck(let deck): moved = flow.chooseRecentDeck(deck)
            case .section(let id): moved = flow.chooseSection(id)
            case .mode(let mode): moved = flow.chooseMode(mode)
            }
            if moved { arrivedForward = true }
        }
    }

    /// Name travel (reference 5.7): a scaled copy of the chosen name moves from its card into its pass field, 300 ms
    /// on the ease curve after 60 ms. Skipped for the class, whose pass value changes typeface, and with reduced
    /// motion; every back clears it. The copy is inserted at progress 0 and animates from its own onAppear.
    private func startTravel(_ choice: StepContent.StepChoice) {
        guard !reducedMotion, flow.settled else { return }
        let source: (id: String, field: PassFieldName, text: String, style: TypeStyle)?
        switch choice {
        case .area(let id): source = flow.index.areas.first { $0.id == id }.map { (id, .area, $0.title, Tokens.TypeRole.cardName) }
        case .platform(let id): source = flow.area?.platforms.first { $0.id == id }.map { (id, .platform, $0.title, Tokens.TypeRole.cardName) }
        case .deck(let id): source = flow.platform?.decks.first { $0.id == id }.map { (id, .deck, $0.code, Tokens.TypeRole.deckCode) }
        case .recentDeck(let recent): source = (recent.deck.id, .deck, recent.deck.code, Tokens.TypeRole.deckCode)
        case .section(let id): source = (id, .section, id == WHOLE_DECK ? "Whole deck" : id, id == WHOLE_DECK ? Tokens.TypeRole.cardName : Tokens.TypeRole.deckCode)
        case .recent, .mode: source = nil
        }
        guard let source, let from = cardFrames[source.id], let to = fieldFrames[source.field] else { return }
        travel = NameTravel(text: source.text, style: source.style, from: from, to: to, progress: 0)
    }

    /// A back played over its own duration: the Back pill, a pass field, Escape. Nil does nothing (step 1). The two
    /// panels are inserted at progress 0 here; runPlayedBack starts the motion from their onAppear.
    private func playBack(to target: Step?, then completion: PlayedBack = .back) {
        guard let target, flow.canGoBack, backTarget == nil, !playingBack else { return }
        travel = nil
        playingBack = true
        playedBack = completion
        backTarget = target
        flow.backProgress = 0
    }

    private func runPlayedBack(_ target: Step) {
        withAnimation(.linear(duration: backMotion(target).durationMs(reducedMotion: reducedMotion) / 1000)) {
            flow.backProgress = 1
        } completion: {
            switch playedBack {
            case .back: flow.back(to: target)
            case .changePlatform: flow.changePlatformOnRecentPath()
            }
            arrivedForward = false
            backTarget = nil
            playingBack = false
        }
    }

    /// "Change platform, now {title}" on the recent path: B from the step on screen to the platform's deck step, then
    /// the stack becomes the ordinary path [1, 2, 3] (task 11).
    private func playBackToPlatform() {
        guard flow.recent, flow.step > 3 else { return }
        playBack(to: 3, then: .changePlatform)
    }

    /// The back gestures: the finger drives the progress; release completes or cancels with a spring seeded with the
    /// finger's speed (spec 5.1). A gesture always goes back exactly one step.
    private func handlePan(_ event: BackPanEvent) {
        guard flow.canGoBack, !playingBack else { return }
        switch event.phase {
        case .changed:
            if backTarget == nil {
                travel = nil
                backTarget = flow.previous
                panning = true
            }
            guard panning else { return }
            flow.backProgress = event.progress
        case .ended, .cancelled:
            guard panning, let target = backTarget else { return }
            panning = false
            let complete = event.phase == .ended && BackTransition.completes(progress: event.progress, velocity: event.velocity)
            let remaining = max(0.05, complete ? 1 - event.progress : event.progress)
            let spring = Tokens.Spring.snap.animation(initialVelocity: abs(event.velocity) / (event.windowWidth * remaining))
            withAnimation(spring) {
                flow.backProgress = complete ? 1 : 0
            } completion: {
                if complete {
                    flow.back(to: target)
                    arrivedForward = false
                } else {
                    flow.backProgress = nil
                }
                backTarget = nil
            }
        }
    }

    /// Start round: the Back pill and the switch fade, the empty paper unrolls over 360 ms from its own onAppear (at
    /// once with reduced motion), then the round replaces the start flow.
    private func startRound() {
        guard let ready = flow.readyRoute, flow.beginUnroll() else { return }
        if reducedMotion {
            model.startRound(route: ready.route, mode: ready.mode)
            return
        }
        unrollScale = 0
        unrollRoute = ready.route
        unrollMode = ready.mode
    }
}

/// The theme switch's row: on step 1 it sits 32 lower, beside the logo; a back to step 1 moves it there with
/// BackTransition's switchShift.
private struct SwitchShift: ViewModifier, @preconcurrency Animatable {
    var progress: Double
    let transition: BackTransition?
    let reducedMotion: Bool
    let onStepOne: Bool

    var animatableData: Double {
        get { progress }
        set { progress = newValue }
    }

    func body(content: Content) -> some View {
        let shift = transition.map { $0.frame(at: progress, reducedMotion: reducedMotion).switchShift } ?? (onStepOne ? 1 : 0)
        content.padding(.top, 32 * shift)
    }
}

/// A step's item arriving forward (reference 5.7): from 24 below with opacity over 240 after 110, each next 25 later;
/// with reduced motion an opacity fade over 140 after 90. Items of a step at rest (launch, after a back) show at once.
struct EnteringItem: ViewModifier {
    let index: Int
    let animate: Bool
    let reducedMotion: Bool
    @State private var shown = false

    func body(content: Content) -> some View {
        let visible = shown || !animate
        content
            .opacity(visible ? 1 : 0)
            .offset(y: visible || reducedMotion ? 0 : 24)
            .onAppear {
                guard animate, !shown else { return }
                let delay = reducedMotion ? 0.09 : Tokens.Duration.stepEnterDelay + Double(index) * Tokens.Duration.stepStagger
                withAnimation(Tokens.Curve.ease.animation(reducedMotion ? Tokens.Duration.reducedIn : Tokens.Duration.stepEnter, delay: delay)) {
                    shown = true
                }
            }
    }
}

/// A step's list: native scrolling, announced as a list, its bottom edge fading over 28 points while more lies below,
/// the fade ending over a card (task 5's listCue). After a back it first scrolls the card chosen before into view
/// with task 5's revealDelta and the web's FOCUS_ROOM of 8 (reference 4.4). Where the whole column scrolls (rule 9)
/// the list takes its own height, does not scroll on its own and does not fade.
struct FadingList: View {
    let options: [StepOption]
    let step: Step
    let scrolls: Bool
    @AccessibilityFocusState.Binding var focusedCard: String?
    let revealId: String?
    let motion: (Int) -> BackMotion?
    let entering: (Int) -> EnteringItem
    let onCardFrame: (String, CGRect) -> Void
    @State private var frames: [Int: CGRect] = [:]
    @State private var viewHeight: Double = 0
    @State private var contentBottom: Double = 0
    @State private var position = ScrollPosition(edge: .top)
    @State private var offsetY = 0.0
    @State private var revealed = false

    var body: some View {
        if scrolls {
            scrollingList
        } else {
            cards
                .coordinateSpace(name: "list")
                .padding(.horizontal, -8)
                .accessibilityElement(children: .contain)
        }
    }

    private var cards: some View {
        VStack(spacing: Tokens.Space.s8) {
            ForEach(Array(options.enumerated()), id: \.element.id) { i, option in
                option.card
                    .accessibilityFocused($focusedCard, equals: option.id)
                    .modifier(OptionalMotion(motion: motion(i)))
                    .modifier(entering(i))
                    .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("list")) } action: { frames[i] = $0 }
                    .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("flow")) } action: { onCardFrame(option.id, $0) }
            }
        }
        .padding(EdgeInsets(top: 6, leading: 8, bottom: 24, trailing: 8))
    }

    private var scrollingList: some View {
        let cue = listCue(viewHeight, contentBottom, frames.sorted { $0.key < $1.key }.map { ItemSpan(top: $0.value.minY, bottom: $0.value.maxY) })
        return ScrollView {
            cards
                .onGeometryChange(for: Double.self) { $0.frame(in: .named("list")).maxY } action: { contentBottom = $0 }
        }
        .scrollPosition($position)
        .onScrollGeometryChange(for: Double.self) { $0.contentOffset.y } action: { _, y in offsetY = y }
        .onChange(of: frames) { _, frames in
            // The frames are in the list view's space: their minY is where the card shows now.
            guard !revealed, viewHeight > 0, let id = revealId, let i = options.firstIndex(where: { $0.id == id }), let f = frames[i] else { return }
            revealed = true
            let delta = revealDelta(viewHeight, ItemSpan(top: f.minY, bottom: f.maxY), 8)
            if delta != 0 { position.scrollTo(y: offsetY + delta) }
        }
        .coordinateSpace(name: "list")
        .padding(.horizontal, -8)
        .onGeometryChange(for: Double.self) { $0.size.height } action: { viewHeight = $0 }
        .mask {
            VStack(spacing: 0) {
                Rectangle()
                LinearGradient(colors: [.black, .black.opacity(cue.more ? 0 : 1)], startPoint: .top, endPoint: .bottom)
                    .frame(height: FADE_PX)
                Rectangle().frame(height: cue.lift).opacity(cue.more ? 0 : 1)
            }
        }
        .accessibilityElement(children: .contain)
    }
}

private struct OptionalMotion: ViewModifier {
    let motion: BackMotion?

    func body(content: Content) -> some View {
        if let motion { content.modifier(motion) } else { content }
    }
}

/// A name on its way from a card into the pass.
struct NameTravel: Equatable {
    let text: String
    let style: TypeStyle
    let from: CGRect
    let to: CGRect
    var progress: Double
}

/// The travelling copy: it starts at the card's name (18 in, 16 down, at the card's type size) and ends on the pass
/// field's value, scaled to the field's size (translate and scale only, as the web does).
struct NameTravelView: View, @preconcurrency Animatable {
    var travel: NameTravel
    @Environment(\.palette) private var palette

    var animatableData: Double {
        get { travel.progress }
        set { travel.progress = newValue }
    }

    var body: some View {
        let p = travel.progress
        let start = CGPoint(x: travel.from.minX + Tokens.Space.s18, y: travel.from.minY + Tokens.Space.s16)
        let end = CGPoint(x: travel.to.minX, y: travel.to.minY + 14)
        let scale = 1 + (Tokens.TypeRole.fieldValue.size / travel.style.size - 1) * p
        Text(travel.text)
            .typeRole(travel.style)
            .foregroundStyle(palette.ink.color)
            .fixedSize()
            .scaleEffect(scale, anchor: .topLeading)
            .offset(x: start.x + (end.x - start.x) * p, y: start.y + (end.y - start.y) * p)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .allowsHitTesting(false)
            .accessibilityHidden(true)
    }
}
```

- [ ] **Step 7: Run the UI tests and the whole scheme.**

```bash
DEST26='platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5'
xcodebuild test -project ios/Truthy/Truthy.xcodeproj -scheme Truthy -destination "$DEST26" 2>&1 | grep -E 'Test run with|Executed [0-9]+ tests?,|✘|TEST (SUCCEEDED|FAILED)' | tail -5
```

Expected: `Test run with 69 tests in 18 suites passed` (62 in 17 before, plus `PassMorphTests` 7), `Executed 5 tests, with 1 test skipped and 0 failures` (the launch test, the three gesture tests and the large text test, the Escape test skipped on the simulator) and `** TEST SUCCEEDED **`. If the large text test reads "True or false cards that teach you I..." or "Your pass is...", the column does not scroll at the accessibility sizes (rule 9). If the cancelled pan completes, check `BackTransition.completes` against the release values the recognizer reports (log `event` once): a slow pan released at rest must stay under 0.5.

- [ ] **Step 8: Walk the flow by hand once.** Launch the app in the simulator (task 11, step 9, without arguments) and go Cloud, AWS, CLF, SEC, Classic: each step's title, the pass filling in, name travel into the pass, the ready pass with its line and Start round; the Back pill and each pass field going back with the web's back motion; an edge pan scrubbing and cancelling; Start round unrolling the paper into task 11's stand-in round. Record the Back pill, a pass field and Escape (the Mac keyboard, rule 6) at 60 fps (`xcrun simctl io booted recordVideo`) and see the old panel sink and the items drop in, the cleared fields turn to dashes, on a back from step 6 or step 4 the band and the paper change height while CLF and SEC (or the area and the platform) travel into their new fields, and on a back to step 1 the logo, the continue line and the switch come back; see the name travel and the paper unroll. Take the recent path (Recent, a deck) and the pass line's platform word: B plays to that platform's deck step. A debug launch with `-route aws-clf-c02/SEC -screen start -step 4` opens the section step directly. Then System Settings, Accessibility, Display & Text Size, Larger Text at the largest size: nothing clips, the whole column scrolls (rule 9), a step chosen from a scrolled column arrives at the column's top, and a quick second tap on the Back pill right after it does nothing (rule 5); turn the phone sideways at the default size: the column scrolls there too. Note anything that differs from the web for task 15's review.

- [ ] **Step 9: Run the gates and commit.**

```bash
swift test --package-path ios/TruthyEngine 2>&1 | tail -1
xcodebuild test -project ios/Truthy/Truthy.xcodeproj -scheme Truthy -destination 'platform=iOS Simulator,name=iPhone 16 Pro,OS=18.4' 2>&1 | grep -E 'TEST (SUCCEEDED|FAILED)'
git add ios/Truthy/Truthy/Start ios/Truthy/TruthyTests/PassMorphTests.swift ios/Truthy/TruthyUITests/AppDriver.swift ios/Truthy/TruthyUITests/StartFlowGestureTests.swift ios/Truthy/TruthyUITests/StartFlowLargeTextTests.swift
pnpm test
git commit -m "feat: add the iOS start flow with the fill-in pass, Recent, Continue and a back gesture that scrubs the web's back motion"
git status --short
```

Expected: the engine passes as before; `** TEST SUCCEEDED **` on iOS 18.4 too (the anywhere pan is off there); `pnpm test` passes; nothing from `git status --short`.
