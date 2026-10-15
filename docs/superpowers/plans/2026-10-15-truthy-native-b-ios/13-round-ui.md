### Task 13: The round: header indicators, the ticket, the stub and the slip, the card under the finger, springs, haptics, Timed, keys, announcements and source links

The round screen (spec 5.2, 5.3, 5.5, 5.6, reference 4.1 P0 to P3t and 4.1a): the X and each class's header as one image with a full sentence (flight path, streak, three lives, the Timed minute); the boarding pass with its band, legs, the Class, Card and Gate fields and the statement; below the perforation the stub (route line, card number, barcode, hints, and in Timed the stub stamp) or, after an answer, the slip (the answer, the stamp, the explanation, the source link). The card follows the finger through a `UIPanGestureRecognizer` subclass on a stationary container; release decides with task 4's `interpret` and springs back with the finger's velocity; a touch catches a springing card where it is. Haptics fire at the decision moments only; the arrow keys, Return and Escape work; VoiceOver hears the verdict, the custom actions answer, and source links open in the in-app browser. The leading-edge pan shrinks the round and does what the X does.

Builds on tasks 1 to 12: the engine (swipe, copy, headers, barcode), `RoundCoordinator` (task 11), components and tokens (tasks 8 and 10), `backPans` and `AppDriver` (task 12). It replaces task 11's stand-in `RoundView.swift`, and writes stand-ins for task 14's leave sheet and result.

**Files:**
- Create (app): `ios/Truthy/Truthy/Round/CardPan.swift`, `Round/CardText.swift`, `Round/Headers.swift`, `Round/BoardingPassView.swift`, `Round/Safari.swift`
- Modify: `ios/Truthy/Truthy/Round/RoundView.swift` (replaced whole: `RoundScreen` and `RoundView`)
- Create (stand-ins that task 14 replaces whole): `ios/Truthy/Truthy/Result/LeaveSheet.swift`, `ios/Truthy/Truthy/Result/ResultView.swift`
- Test: create `ios/Truthy/TruthyTests/RoundUnitTests.swift`, `ios/Truthy/TruthyUITests/RoundGestureTests.swift`

**Interfaces:**
- Produces (app target):

```swift
final class CardPanRecognizer: UIPanGestureRecognizer { var samples: [SwipeSample]; var dx: Double }   // window points, t = timestamp * 1000
struct CardDrag: Equatable { enum Phase { case moved, released, cancelled }; var phase; var dx: Double; var samples: [SwipeSample]; var velocity: Double; var windowWidth: Double }
struct CardPan: UIGestureRecognizerRepresentable { init(isEnabled: Bool, onDrag: (CardDrag) -> Void) }
struct CrossingCounter: Equatable { var count: Int; mutating func update(dx: Double); mutating func release() }
struct SpringBack: Equatable { var offset, velocity, startedAt: Double; var spring: SpringSpec; func position(atMs: Double) -> Double }
struct CardTextView: View { init(text: String, style: TypeStyle) }     // code parts in mono, one element labelled with plainText
struct RouteMark { var t: Double; var state: WaypointState; var scale: Double; var fresh: Bool; var last: Bool }
struct HeaderFrame, FlightPathHeader, StreakHeader, LivesHeader, TimedHeader: View; struct RouteCanvas: View { init(flown:plane:marks:ring:) }
struct BoardingPassView: View { init(coordinator: RoundCoordinator, intent: Double, statementFocus: AccessibilityFocusState<Bool>.Binding,
    onAnswer: (Bool) -> Bool, onSource: (URL) -> Void, onStatementFrame: (CGRect) -> Void, onSlipFrame: (CGRect) -> Void) }
struct TearOff: ViewModifier; struct LandingStamp<Content: View>: View; struct SourceLink: View { init(title: String, action: () -> Void) }
enum SafariPresenter { static func present(_ url: URL, theme: ResolvedTheme, palette: Palette) }
struct RoundScreen: View { init(model: AppModel, request: RoundRequest) }
enum TicketScrollTarget { static func afterAnswer(slip:offset:viewport:contentHeight:) -> Double?; static func newCard(statement:viewport:) -> Double }
struct RoundView: View
```

**Rules:**

1. **The card drag** (spec 5.3, reference 7.2 item 1): `CardPanRecognizer.touchesBegan` keeps the touch-down sample before any slop; moves and the end append every coalesced touch; a second touch fails or cancels it. The delegate begins it only for horizontal-dominant movement and never for a first touch within 24 of the window edge (`SWIPE.edgePx`), so the ticket's vertical scroll and the round's back pan keep theirs. It decides from its own samples, because the recognizer's translation is still zero when SwiftUI asks it to begin. It is attached to the ticket's container, inside the scroll view; the card's rotation (`dx / Tokens.Gesture.rotationDivisor` degrees) is applied before its offset, so it turns about its own moved centre as CSS `translateX(dx) rotate(...)` does. `isEnabled` never reads a clock (a value computed from `mono.nowMs()` in `body` is not observed, so a recognizer created disabled would stay so): it is the question phase with no sheet open, or a drag in progress; the 250 ms settle is `interpret`'s `canStart` on the touch-down sample and the coordinator's answer guard. No `simultaneousGesture` (task 7's source rule).
2. **Release**: `interpret(samples, SwipeContext(viewportWidth: window width, cardShownAt: coordinator.cardShownAt))`, both on the monotonic base of `UITouch.timestamp`; a commit answers through the coordinator's one answer path (guards included); the card always springs back to rest with `Tokens.Spring.snap` seeded with the release velocity divided by the distance to go, and never flies away. With reduced motion it returns at once.
3. **A caught card** (spec 5.3): a touch on a card still springing back starts from the spring's current position c (`SpringBack.position(atMs:)`, the closed form of the same damped spring); the drawn offset is c + dx, while `interpret`, the intent stamp and the threshold haptic use dx alone.
4. **Haptics only as spec 5.5, through `sensoryFeedback`**: `.impact(weight: .light)` when a drag crosses the 90 line (`CrossingCounter`: once per crossing, re-armed by moving back under it, never per move), `.success` and `.error` on the verdict, `.warning` at Timed's time up. Nothing else vibrates.
5. **Motion** (reference 5.7, spec 5.3), from `Tokens.Transition` and `Tokens.Duration`: in Classic, Streak and Three lives the stub tears off (to (-40, 360) and -18 degrees after a right answer, (40, 360) and 18 after a wrong one, 460 on the fall curve, fading), the slip's stamp lands (from scale 1.9 and -14 degrees to 1 and -6, 420 on the spring curve after 380) and the main part jolts 2 down and back over 260 after 420 (120 in Timed, 240 at time up); the Next card row rises 12 and fades in over 220 after 360. In Timed the stub stamp lands over 300 (after 120 at time up), and after the 700 ms hold the card leaves towards the answered side (x 120 percent, 8 degrees, 220 on the fall curve) while the next comes from 14 below over 280. Under reduced motion the stamps are at rest and the parts fade. The ticket scrolls as task 6's functions say: after an answer only when the slip is not in view, to `min(max, slip.top)` (`slipScroll`, animated over 360), and on a new card only as far as shows the statement above the action row (`statementScroll`); a vertical drag bounces whatever the ticket's length (no `scrollBounceBehavior(.basedOnSize)`).
6. **Timed**: the stub stays and takes its stamp ("Correct", "Not quite", "Time is up" with the clock icon at 22) with the hints of reference 4.5; True and False dim to 0.45 during the stamp; at time up the Gate reads "Closed", the statement turns ink-muted, and See results replaces the answers. The coordinator's ticker runs while the round is on screen.
7. **Copy and accessibility** (reference 4.5, 5.9): the X "Leave round"; the screen heading "{deck}, {section}: {class} round", an element VoiceOver reads but nobody sees (`Color.clear`, never `opacity(0)`, which leaves the accessibility tree); each header is one image with the full sentence of task 6 (`flightPathLabel`, `streakLabel`, `livesLabel`, `timedLabel`) and a hidden label row; the stub is hidden, the legs (code over name) are read; the statement and the slip's explanation are each one element whose label is the whole text (`plainText`); the source link (book icon, underlined title, arrow, at least 48 tall) is "{title} (opens in browser)"; the statement element takes VoiceOver focus on a new card and offers the custom actions "Answer true" and "Answer false"; after an answer focus goes to Next card or See results when it takes presses (420 ms, at once with reduced motion), at time up only from True or False, and to the X when the sheet closes (reference 4.4); announcements (`AccessibilityNotification.Announcement`) say `verdictText` plus `roundStatus`, or Timed's `timedStatus` and `timedCardText`, and are held while the leave sheet is open and released `SPOKEN_RELEASE_MS` after it closes.
8. **Keys** (spec section 2): left and right arrows answer, Return is the action after an answer, Escape is the X (Keep playing while the sheet is open); `phases: .down`, so a held key acts once. The screen's root is focusable and focused on appear, so the keys work after touches. With the Mac keyboard through the iOS 18.4 simulator (I/O, Keyboard, Connect Hardware Keyboard) all four keys reach these handlers: the right arrow answers, Return deals the next card, Escape opens the sheet and Escape again keeps playing. Under XCUITest the arrows reach them too, but `typeKey` cannot deliver Escape or Return on the simulator (on 18.4 or 26.5; on 18.4 neither reaches `UIApplication.sendEvent`; task 12 rule 6), so the tests that need them skip there (`AppDriver.skipEscapeAndReturnOnTheSimulator`) and task 16 checks them on the device (D16).
9. **Back on the round** (spec 5.2, D4): the leading-edge pan scales the round from 1 to 0.94 with its progress, pivot at the centre, and, on release past the rule, does what the X does: with no answers it leaves at once, otherwise it opens the sheet. A cancel springs back. While the deck loads the screen shows the X, an empty ticket and "Your round" for VoiceOver (the status is announced, not shown), and back leaves at once.
10. **Every height here is a minimum** (`frame(minHeight:)`, never `frame(height:)` around text): the action rows, the bands (spec 5.6, N9). The leg names wrap as on the web (no line limit). The paper's own text stops growing at `xxLarge` through task 12's `paperTextSize()` (README deviation 6): the header's label row, the ticket's band, legs and field row, the stub (its intent and Timed stamps included), the slip's answer row with its stamp, and the True and False pills, whose half-width columns break "False" and "Correct" in the middle of the word above it; the statement, its "applies to" line, the explanation, the source link and the full-width pills grow to the largest size and scroll.
11. **No selectable text** (spec section 2): nothing uses `textSelection`.
12. **Links** open in `SFSafariViewController` presented from the top view controller, in the app's theme.

**Review focus.** README line 4: `RoundGestureTests.testADiagonalDragOnALongStatementScrollsOrAnswersNeverBoth` (a long statement at the largest text size, a drag of 70 right and 140 up: the ticket scrolled or the card answered, exactly one) and `testADragFromTheEdgeIsTheBackPanAndNeverAnAnswer` (a 200 point drag starting at x = 10: no answer, and with no answers the round leaves to step 1). README line 5, the round part: `testATripleTapOnNextCardAdvancesOneCard` (a triple tap on Next card advances one card); `testAHorizontalSwipeAnswers` and `testTheRightArrowAnswers` pin that the card and the keys answer at all; the taps on the X are task 14's, once the sheet exists. N3: `testAVerticalDragScrollsAndAnswersNothing`. N6: `CrossingCounterTests`. README line 3: task 15 captures the question and the answer of all four classes at the largest size.

**Steps:**

- [ ] **Step 1: Check the starting point.**

```bash
git status --short
xcodebuild test -project ios/Truthy/Truthy.xcodeproj -scheme Truthy -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5' 2>&1 | grep -E 'Test run with|Executed [0-9]+ tests?,|TEST (SUCCEEDED|FAILED)' | tail -3
```

Expected: nothing; `Test run with 68 tests in 18 suites passed`, `Executed 5 tests, with 1 test skipped and 0 failures`, `** TEST SUCCEEDED **`.

- [ ] **Step 2: Write the unit tests and the UI tests.**

`ios/Truthy/TruthyTests/RoundUnitTests.swift`:

```swift
import SwiftUI
import Testing
import TruthyEngine
@testable import Truthy

// N6: one haptic per crossing of the 90 line, none per move; and the spring a touch catches (spec 5.3).
@Suite struct CrossingCounterTests {
    @Test func theTriggerChangesOncePerCrossing() {
        var counter = CrossingCounter()
        for dx in stride(from: 0.0, through: 95, by: 1) { counter.update(dx: dx) }
        for dx in stride(from: 95.0, through: 50, by: -1) { counter.update(dx: dx) }
        for dx in stride(from: 50.0, through: 95, by: 1) { counter.update(dx: dx) }
        #expect(counter.count == 2)
    }

    @Test func movingBeyondTheLineDoesNotTriggerAgainAndALeftwardDragCountsToo() {
        var counter = CrossingCounter()
        for dx in [0.0, 89, 90, 120, 200, 150, 91] { counter.update(dx: dx) }
        #expect(counter.count == 1)
        counter.release()
        for dx in [0.0, -60, -95] { counter.update(dx: dx) }
        #expect(counter.count == 2)
    }
}

@Suite struct SpringBackTests {
    @Test func theSpringStartsAtTheReleaseOffsetAndSettlesAtRest() {
        let spring = SpringBack(offset: 80, velocity: 0, startedAt: 0)
        #expect(spring.position(atMs: 0) == 80)
        #expect(abs(spring.position(atMs: 2000)) < 0.5)
        #expect(spring.position(atMs: 100) < 80)
    }

    @Test func aFlingCarriesTheCardOnBeforeItTurns() {
        let spring = SpringBack(offset: 60, velocity: 600, startedAt: 0)
        #expect(spring.position(atMs: 16) > 60)
    }
}

// Reference 4.4 and task 6's ticket scroll: the slip scrolls in only when it is not in view.
@Suite struct TicketScrollTargetTests {
    @Test func aSlipInViewAsksForNoScrollAndOneBelowScrollsToItsTop() {
        #expect(TicketScrollTarget.afterAnswer(slip: CGRect(x: 0, y: 300, width: 300, height: 212), offset: 0, viewport: 500, contentHeight: 800) == nil)
        #expect(TicketScrollTarget.afterAnswer(slip: CGRect(x: 0, y: 400, width: 300, height: 300), offset: 0, viewport: 500, contentHeight: 750) == 250)
        #expect(TicketScrollTarget.newCard(statement: CGRect(x: 0, y: 100, width: 300, height: 200), viewport: 400) == 0)
    }
}
```

`ios/Truthy/TruthyUITests/RoundGestureTests.swift`:

```swift
import XCTest

/// Task 13: README Review Focus lines 4 and 5 and feel item N3, with XCUITest coordinates.
final class RoundGestureTests: XCTestCase {
    override func setUp() {
        continueAfterFailure = false
    }

    @MainActor
    private func statement(_ driver: AppDriver) -> XCUIElement {
        driver.waitFor(driver.element(containing: "Card, 01"), "the first card")
        driver.pause(0.3)
        // The statement is one element whose label is the whole text; its identifier finds it whatever its type.
        return driver.app.descendants(matching: .any)["statement"]
    }

    /// Review Focus 4a: a diagonal drag that starts on a long statement scrolls the ticket or moves the card, never
    /// both. The largest text size makes every statement longer than the screen.
    @MainActor
    func testADiagonalDragOnALongStatementScrollsOrAnswersNeverBoth() {
        let driver = AppDriver.round(extra: ["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"])
        driver.launch()
        let text = statement(driver)
        let before = text.frame.minY
        // At the largest size the statement starts below the screen: drag where the ticket shows, on its scroll view.
        let centre = driver.app.scrollViews.firstMatch.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
        centre.press(forDuration: 0.05, thenDragTo: centre.withOffset(CGVector(dx: 70, dy: -140)), withVelocity: .default, thenHoldForDuration: 0)
        driver.pause(1)
        let scrolled = abs(text.frame.minY - before) > 20
        let answered = driver.button("Next card").exists
        XCTAssertTrue(scrolled != answered, "scrolled \(scrolled), answered \(answered): exactly one must happen")
    }

    /// Review Focus 4b: a drag that starts within 24 of the window edge never moves the card; on the round it is the
    /// back pan, which with no answers leaves at once.
    @MainActor
    func testADragFromTheEdgeIsTheBackPanAndNeverAnAnswer() {
        let driver = AppDriver.round()
        driver.launch()
        _ = statement(driver)
        let start = driver.app.coordinate(withNormalizedOffset: CGVector(dx: 0, dy: 0.5)).withOffset(CGVector(dx: 10, dy: 0))
        start.press(forDuration: 0.05, thenDragTo: start.withOffset(CGVector(dx: 200, dy: 0)), withVelocity: .fast, thenHoldForDuration: 0)
        driver.waitFor(driver.element("Choose an area"), "back at step 1")
        XCTAssertFalse(driver.button("Next card").exists)
    }

    /// N3: a vertical drag scrolls the ticket and answers nothing.
    @MainActor
    func testAVerticalDragScrollsAndAnswersNothing() {
        let driver = AppDriver.round(extra: ["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"])
        driver.launch()
        let text = statement(driver)
        let before = text.frame.minY
        let centre = driver.app.scrollViews.firstMatch.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
        centre.press(forDuration: 0.05, thenDragTo: centre.withOffset(CGVector(dx: 0, dy: -200)), withVelocity: .default, thenHoldForDuration: 0)
        driver.pause(1)
        XCTAssertGreaterThan(abs(text.frame.minY - before), 20, "the ticket scrolled")
        XCTAssertFalse(driver.button("Next card").exists)
    }

    /// Review Focus 5, the round part: a triple tap on Next card advances one card only (the 420 ms guard and one
    /// card per press). The X's taps are task 14's test, once the sheet exists.
    @MainActor
    func testATripleTapOnNextCardAdvancesOneCard() {
        let driver = AppDriver.round()
        driver.launch()
        _ = statement(driver)
        driver.button("True").tap()
        let next = driver.button("Next card")
        driver.waitFor(next, "Next card")
        // Next card exists as soon as the answer lands; its 420 ms guard would swallow taps that come at once.
        driver.pause(0.5)
        next.tap(withNumberOfTaps: 3, numberOfTouches: 1)
        driver.pause(1)
        XCTAssertTrue(driver.element(containing: "Card, 02").exists, "one card further")
        XCTAssertFalse(driver.element(containing: "Card, 03").exists, "not two")
    }

    /// Spec 5.3: the swipe answers once the card has settled (the recognizer is enabled by observable state).
    @MainActor
    func testAHorizontalSwipeAnswers() {
        let driver = AppDriver.round()
        driver.launch()
        _ = statement(driver)
        driver.pause(0.5)
        driver.drag(from: CGVector(dx: 0.45, dy: 0.45), to: CGVector(dx: 0.9, dy: 0.45), velocity: .fast)
        driver.waitFor(driver.button("Next card"), "the swipe answered")
    }

    /// Spec section 2: the right arrow answers True after touches (the screen's root holds keyboard focus).
    @MainActor
    func testTheRightArrowAnswers() {
        let driver = AppDriver.round()
        driver.launch()
        _ = statement(driver)
        driver.pause(0.5)
        driver.app.typeKey(.rightArrow, modifierFlags: [])
        driver.waitFor(driver.button("Next card"), "the arrow answered")
    }
}
```

- [ ] **Step 3: Run the unit tests and see them fail.**

```bash
DEST26='platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5'
xcodebuild build-for-testing -project ios/Truthy/Truthy.xcodeproj -scheme Truthy -destination "$DEST26" 2>&1 | grep -E 'error:' | head -3
```

Expected: `cannot find 'CrossingCounter' in scope` and `cannot find 'SpringBack' in scope`.

- [ ] **Step 4: Write the recognizer, the haptic counter, the spring and the card text.**

`ios/Truthy/Truthy/Round/CardPan.swift`:

```swift
import SwiftUI
import TruthyEngine
import UIKit
import UIKit.UIGestureRecognizerSubclass

// The card under the finger (spec 5.3, reference 7.2 item 1): a UIPanGestureRecognizer subclass bridged with
// UIGestureRecognizerRepresentable, attached to a stationary container. touchesBegan keeps the touch-down sample
// (window point, UITouch.timestamp) before any slop; moves and the end append every coalesced touch; a second touch
// cancels. It begins only for horizontal-dominant movement, so the ticket's own vertical scroll keeps working, and
// never for a touch that starts within 24 of the window edge (the round's back pan lives there).

final class CardPanRecognizer: UIPanGestureRecognizer {
    private(set) var samples: [SwipeSample] = []

    private func sample(_ touch: UITouch) -> SwipeSample {
        let point = touch.location(in: nil)
        return SwipeSample(x: point.x, y: point.y, t: touch.timestamp * 1000)
    }

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent) {
        if !samples.isEmpty || touches.count > 1 {
            state = state == .possible ? .failed : .cancelled
            return
        }
        if let touch = touches.first { samples = [sample(touch)] }
        super.touchesBegan(touches, with: event)
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent) {
        append(touches, event)
        super.touchesMoved(touches, with: event)
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent) {
        append(touches, event)
        super.touchesEnded(touches, with: event)
    }

    private func append(_ touches: Set<UITouch>, _ event: UIEvent) {
        for touch in touches {
            for coalesced in event.coalescedTouches(for: touch) ?? [touch] { samples.append(sample(coalesced)) }
        }
    }

    override func reset() {
        super.reset()
        samples = []
    }

    /// The finger's travel from the touch-down point, slop included, so the card never lags the finger.
    var dx: Double {
        guard let first = samples.first, let last = samples.last else { return 0 }
        return last.x - first.x
    }
}

struct CardDrag: Equatable {
    enum Phase { case moved, released, cancelled }
    var phase: Phase
    var dx: Double
    var samples: [SwipeSample]
    /// Points per second, from the recognizer.
    var velocity: Double
    var windowWidth: Double
}

struct CardPan: UIGestureRecognizerRepresentable {
    var isEnabled: Bool
    var onDrag: (CardDrag) -> Void

    func makeCoordinator(converter: CoordinateSpaceConverter) -> Delegate {
        Delegate()
    }

    func makeUIGestureRecognizer(context: Context) -> CardPanRecognizer {
        let recognizer = CardPanRecognizer()
        recognizer.delegate = context.coordinator
        recognizer.maximumNumberOfTouches = 1
        return recognizer
    }

    func updateUIGestureRecognizer(_ recognizer: CardPanRecognizer, context: Context) {
        recognizer.isEnabled = isEnabled
    }

    func handleUIGestureRecognizerAction(_ recognizer: CardPanRecognizer, context: Context) {
        let width = recognizer.view?.window?.bounds.width ?? 0
        let velocity = recognizer.velocity(in: nil).x
        let drag = { (phase: CardDrag.Phase) in
            CardDrag(phase: phase, dx: recognizer.dx, samples: recognizer.samples, velocity: velocity, windowWidth: width)
        }
        switch recognizer.state {
        case .began, .changed: onDrag(drag(.moved))
        case .ended: onDrag(drag(.released))
        case .cancelled, .failed: onDrag(drag(.cancelled))
        default: break
        }
    }

    final class Delegate: NSObject, UIGestureRecognizerDelegate {
        func gestureRecognizerShouldBegin(_ recognizer: UIGestureRecognizer) -> Bool {
            guard let pan = recognizer as? CardPanRecognizer, let first = pan.samples.first, let last = pan.samples.last else { return false }
            let width = pan.view?.window?.bounds.width ?? 0
            guard first.x >= SWIPE.edgePx, first.x <= width - SWIPE.edgePx else { return false }
            // The recognizer's own translation is still zero when SwiftUI asks; the samples hold the movement so far.
            return abs(last.x - first.x) > abs(last.y - first.y)
        }

        func gestureRecognizer(_ recognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool {
            false
        }
    }
}

/// The threshold haptic (spec 5.5): one tick per crossing of the 90 commit line, re-armed by moving back under it,
/// never per move.
struct CrossingCounter: Equatable {
    private(set) var count = 0
    private var beyond = false

    mutating func update(dx: Double) {
        let over = abs(dx) >= SWIPE.commitPx
        if over && !beyond { count += 1 }
        beyond = over
    }

    mutating func release() {
        beyond = false
    }
}

/// The card's spring back, as a function of time, so a touch can catch it where it is (spec 5.3: the drawn offset is
/// c + dx while interpret and the haptic use dx alone). A damped spring from `offset` with `velocity` (points per
/// second) towards 0, with the response and damping of Tokens.Spring.snap.
struct SpringBack: Equatable {
    var offset: Double
    var velocity: Double
    var startedAt: Double
    var spring = Tokens.Spring.snap

    func position(atMs now: Double) -> Double {
        let t = max(0, (now - startedAt) / 1000)
        let omega = 2 * Double.pi / spring.response
        let zeta = spring.dampingFraction
        let decay = exp(-zeta * omega * t)
        let omegaD = omega * (1 - zeta * zeta).squareRoot()
        let b = (velocity + zeta * omega * offset) / omegaD
        return decay * (offset * cos(omegaD * t) + b * sin(omegaD * t))
    }
}
```

`ios/Truthy/Truthy/Round/CardText.swift`:

```swift
import SwiftUI
import TruthyEngine

// Card text with its code parts in the mono face at 0.92 of the size, backticks stripped (CardText.tsx), read by
// VoiceOver as task 5's plainText: one element whose label is the whole text.

struct CardTextView: View {
    let text: String
    let style: TypeStyle

    var body: some View {
        textParts(text).reduce(Text("")) { line, part in
            line + (part.code
                ? Text(part.text).font(.custom("OverpassMono-SemiBold", size: style.size * 0.92, relativeTo: style.textStyle))
                : Text(part.text))
        }
        .typeRole(style)
        .fixedSize(horizontal: false, vertical: true)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(plainText(text))
    }
}
```

- [ ] **Step 5: Write the headers, the boarding pass and the in-app browser.**

`ios/Truthy/Truthy/Round/Headers.swift`:

```swift
import SwiftUI
import TruthyEngine

// The header of each class (reference 4.1a): one image with a full-sentence label, and a label row that is hidden
// from VoiceOver. The geometry is task 6's (pointAt, headingAt, streakLayout, trailLayout); the drawing is a Canvas in
// the 276 by 34 box of the web, scaled to the width.

struct HeaderFrame<Picture: View>: View {
    let label: String
    let left: Text
    let right: Text?
    @ViewBuilder let picture: () -> Picture
    @Environment(\.palette) private var palette

    var body: some View {
        VStack(spacing: Tokens.Space.s4) {
            picture()
                .frame(maxWidth: .infinity)
                .frame(height: Tokens.Size.flightPathHeight)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(label)
                .accessibilityAddTraits(.isImage)
            HStack {
                left
                Spacer()
                if let right { right }
            }
            .typeRole(Tokens.TypeRole.routeLabel)
            .foregroundStyle(palette.ink.color)
            .accessibilityHidden(true)
            .paperTextSize()
        }
    }
}

/// A waypoint of the header: where it sits, its state, its scale, whether it is the card just answered right (drawn
/// in the correct colour) and whether it is the route's last (a future one is r5 there, r4 elsewhere).
struct RouteMark {
    var t: Double
    var state: WaypointState
    var scale: Double = 1
    var fresh = false
    var last = false
}

/// The route drawn in the header box (FlightPath.tsx): the dotted curve in ink, solid up to `flown`, the waypoints (a
/// circle with a tick for a right answer, a square with an x for a wrong one, reference 5.9), and the plane.
struct RouteCanvas: View {
    var flown: Double
    var plane: Double?
    var marks: [RouteMark] = []
    /// Streak's completed route: the ring at the previous best (reference 4.1 R1), as a position on the curve.
    var ring: Double?
    @Environment(\.palette) private var palette

    var body: some View {
        Canvas { context, size in
            let scale = size.width / 276
            context.scaleBy(x: scale, y: size.height / 34)
            var curve = Path()
            curve.move(to: CGPoint(x: 6, y: 24))
            curve.addQuadCurve(to: CGPoint(x: 270, y: 24), control: CGPoint(x: 138, y: -6))
            context.stroke(curve, with: .color(palette.ink.color), style: StrokeStyle(lineWidth: 1.6, lineCap: .round, dash: [2, 5]))
            if flown > 0 {
                context.stroke(SVGPath.parse(flownPath(flown)), with: .color(palette.ink.color), style: StrokeStyle(lineWidth: 2.4, lineCap: .round))
            }
            let glyph = StrokeStyle(lineWidth: 1.8, lineCap: .butt, lineJoin: .miter)
            // Under the marks, so the mark at the previous best keeps its tick inside the ring.
            if let ring {
                let p = pointAt(ring)
                let circle = Path(ellipseIn: CGRect(x: p.x - 7, y: p.y - 7, width: 14, height: 14))
                context.fill(circle, with: .color(palette.surfaceRaised.color))
                context.stroke(circle, with: .color(palette.ink.color), lineWidth: 1.6)
            }
            for mark in marks {
                let p = pointAt(mark.t)
                let r = 7 * mark.scale
                switch mark.state {
                case .correct:
                    context.fill(Path(ellipseIn: CGRect(x: p.x - r, y: p.y - r, width: 2 * r, height: 2 * r)),
                                 with: .color(mark.fresh ? palette.correct.color : palette.ink.color))
                    if r >= 5 {
                        var tick = context
                        tick.translateBy(x: p.x, y: p.y)
                        tick.scaleBy(x: mark.scale, y: mark.scale)
                        tick.stroke(SVGPath.parse("M-3 0l2 2 4-4"), with: .color(palette.surfaceRaised.color), style: glyph)
                    }
                case .wrong:
                    let side = 13 * mark.scale
                    context.fill(Path(roundedRect: CGRect(x: p.x - side / 2, y: p.y - side / 2, width: side, height: side), cornerRadius: 2), with: .color(palette.wrong.color))
                    if side >= 9 {
                        var cross = context
                        cross.translateBy(x: p.x, y: p.y)
                        cross.scaleBy(x: mark.scale, y: mark.scale)
                        cross.stroke(SVGPath.parse("M-3-3l6 6m0-6l-6 6"), with: .color(palette.surfaceRaised.color), style: glyph)
                    }
                case .current:
                    break
                case .future:
                    let open = mark.last ? 5.0 : 4.0
                    let ring = Path(ellipseIn: CGRect(x: p.x - open, y: p.y - open, width: 2 * open, height: 2 * open))
                    context.fill(ring, with: .color(palette.surfaceRaised.color))
                    context.stroke(ring, with: .color(palette.ink.color), lineWidth: 1.6)
                }
            }
            if let plane {
                let p = pointAt(plane)
                var disc = context
                disc.translateBy(x: p.x, y: p.y)
                disc.fill(Path(ellipseIn: CGRect(x: -12, y: -12, width: 24, height: 24)), with: .color(palette.accent.color))
                disc.rotate(by: .degrees(headingAt(plane)))
                disc.stroke(Icon.planeArrow.path, with: .color(palette.onAccent.color), style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
            }
        }
    }
}

struct FlightPathHeader: View {
    let round: RoundState

    var body: some View {
        let total = round.cards.count
        let results = round.answers.map(\.correct)
        let answered = round.phase == .answered
        let states = waypointStates(total, results, round.index, answered)
        let marks = states.enumerated().map { i, state in
            RouteMark(t: waypointT(Double(i), Double(total)), state: state, fresh: state == .correct && answered && i == round.index,
                      last: i == total - 1)
        }
        let correct = results.filter { $0 }.count
        HeaderFrame(
            label: flightPathLabel(total, results, round.index),
            left: Text("Card ") + Text("\(round.index + 1)").bold() + Text(" of \(total)"),
            right: Text("\(correct) correct · \(results.count - correct) wrong")
        ) {
            RouteCanvas(flown: waypointT(Double(round.index), Double(total)), plane: answered ? nil : waypointT(Double(round.index), Double(total)), marks: marks)
        }
    }
}

struct StreakHeader: View {
    let round: RoundState
    let best: Int?

    var body: some View {
        let streak = round.answers.prefix { $0.correct }.count
        let ended = isDecided(round)
        let layout = streakLayout(streak, best)
        let marks = (0..<streak).map { RouteMark(t: layout.t($0), state: .correct, scale: layout.dot / 7) }
            + layout.future.map { RouteMark(t: layout.t($0), state: .future) }
        HeaderFrame(
            label: streakLabel(streak, best, ended),
            left: ended ? Text("Streak ended at ") + Text("\(streak)").bold() : Text("Streak ") + Text("\(streak)").bold(),
            right: best.flatMap { $0 >= 1 ? (streak > $0 ? Text("Previous best ") : Text("Best ")) + Text("\($0)").bold() : nil }
        ) {
            RouteCanvas(flown: layout.t(streak), plane: ended ? nil : layout.t(streak), marks: marks)
        }
    }
}

struct LivesHeader: View {
    let round: RoundState
    @Environment(\.palette) private var palette

    var body: some View {
        let results = round.answers.map(\.correct)
        let left = livesLeft(round)
        let layout = trailLayout(results.count)
        HeaderFrame(
            label: livesLabel(results),
            left: left == 0 ? Text("No").bold() + Text(" lives left") : Text("\(left)").bold() + Text(" of 3 lives left"),
            right: Text("\(results.count)").bold() + Text(" answered")
        ) {
            Canvas { context, size in
                context.scaleBy(x: size.width / 276, y: size.height / 34)
                for (i, x) in [11.0, 39, 67].enumerated() {
                    var heart = context
                    heart.translateBy(x: x, y: 6)
                    if i < left {
                        heart.fill(Icon.heart.path, with: .color(palette.ink.color))
                    } else {
                        heart.stroke(Icon.heart.path, with: .color(palette.inkMuted.color), lineWidth: 1.6)
                        heart.stroke(Icon.heartSlash.path, with: .color(palette.inkMuted.color), style: StrokeStyle(lineWidth: 1.6, lineCap: .round))
                    }
                }
                for (i, correct) in results.enumerated() {
                    let x = layout.x(i)
                    if correct {
                        context.fill(Path(ellipseIn: CGRect(x: x - layout.r, y: 17 - layout.r, width: 2 * layout.r, height: 2 * layout.r)), with: .color(palette.ink.color))
                    } else {
                        context.fill(Path(CGRect(x: x - layout.side / 2, y: 17 - layout.side / 2, width: layout.side, height: layout.side)), with: .color(palette.wrong.color))
                    }
                }
                var plane = context
                plane.translateBy(x: 238, y: 17)
                plane.fill(Path(ellipseIn: CGRect(x: -12, y: -12, width: 24, height: 24)), with: .color(palette.accent.color))
                plane.stroke(Icon.planeArrow.path, with: .color(palette.onAccent.color), style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
            }
        }
    }
}

struct TimedHeader: View {
    let round: RoundState
    @Environment(\.accessibilityReduceMotion) private var reducedMotion

    var body: some View {
        let remaining = round.clock?.remainingMs ?? 0
        let results = round.answers.map(\.correct)
        let correct = results.filter { $0 }.count
        let shown = reducedMotion ? (remaining / 1000).rounded(.up) * 1000 : remaining
        let t = 1 - shown / TIMED.roundMs
        HeaderFrame(
            label: timedLabel(remaining, correct, results.count - correct),
            left: Text(clockText(remaining)).font(Tokens.TypeRole.timedClock.font.monospacedDigit()).bold() + Text(" left"),
            right: Text("\(correct) correct · \(results.count - correct) wrong")
        ) {
            // A start dot, the three quarter marks (filled once passed) and the r5 end dot (TimedPath.tsx).
            RouteCanvas(flown: t, plane: t, marks: [RouteMark(t: 0, state: .correct, scale: 0.5)]
                + [0.25, 0.5, 0.75].map { RouteMark(t: $0, state: t >= $0 ? .correct : .future, scale: 0.5) }
                + [RouteMark(t: 1, state: .future, last: true)])
        }
    }
}
```

`ios/Truthy/Truthy/Round/BoardingPassView.swift`:

```swift
import SwiftUI
import TruthyEngine

// The ticket of the round (BoardingPass.tsx, reference 4.1 P2 to P3t, 5.7): the band, the legs, the Class, Card and
// Gate fields, the statement (with its appliesTo line), and below the perforation the stub of the question (route
// line and card number, barcode, hints, the intent stamps while dragging, Timed's stub stamp) or the slip of the
// answer. The stub tears away when the slip comes (Classic, Streak, Three lives), the stamp lands after it, and the
// main part jolts; in Timed the stub stays and takes its stamp. The stub is hidden from VoiceOver as a whole (5.9).

struct BoardingPassView: View {
    let coordinator: RoundCoordinator
    /// The drag's intent from -1 to 1: the stub's pull and the intent stamps.
    var intent: Double = 0
    /// VoiceOver focus of the statement (reference 4.4).
    let statementFocus: AccessibilityFocusState<Bool>.Binding
    /// The one answer path, for the custom actions "Answer true" and "Answer false" (reference 5.9).
    let onAnswer: (Bool) -> Bool
    var onSource: (URL) -> Void
    /// Frames in the ticket's scroll content ("ticketContent"), for the ticket scroll of task 6.
    var onStatementFrame: (CGRect) -> Void = { _ in }
    var onSlipFrame: (CGRect) -> Void = { _ in }
    @Environment(\.palette) private var palette
    @Environment(\.shadows) private var shadows
    @Environment(\.accessibilityReduceMotion) private var reducedMotion

    private var round: RoundState { coordinator.state }
    private var ticket: TicketInfo { coordinator.ticket }

    var body: some View {
        VStack(spacing: 0) {
            main
                .keyframeAnimator(initialValue: 0.0, trigger: reducedMotion ? 0 : round.answers.count) { content, y in
                    content.offset(y: y)
                } keyframes: { _ in
                    // The jolt (reference 5.7): 2 down at 40 percent and back, after 420 (120 in Timed, 240 at time up).
                    KeyframeTrack {
                        LinearKeyframe(0.0, duration: joltDelay)
                        CubicKeyframe(2.0, duration: Tokens.Transition.jolt.duration * 0.4)
                        CubicKeyframe(0.0, duration: Tokens.Transition.jolt.duration * 0.6)
                    }
                }
            lower
        }
        .tokenShadow(shadows.ticket, RoundedRectangle(cornerRadius: Tokens.Radius.card))
    }

    private var joltDelay: Double {
        guard round.mode == .timed else { return Tokens.Transition.jolt.delay }
        return coordinator.decided ? 0.24 : 0.12
    }

    private var main: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: Tokens.Space.s8) {
                IconShape(icon: .carrierCloud).fill(palette.onAccent.color).frame(width: 22, height: 16)
                Text("Truthy").typeRole(Tokens.TypeRole.carrierTitle)
                Spacer()
                Text("BOARDING PASS").typeRole(Tokens.TypeRole.carrierLabel)
            }
            .foregroundStyle(palette.onAccent.color)
            .padding(.horizontal, Tokens.Size.ticketInset)
            .frame(minHeight: Tokens.Size.carrier)
            .background(palette.accent.color)
            .accessibilityHidden(true)
            .paperTextSize()
            HStack {
                leg(ticket.deckCode, ticket.deckName)
                Spacer()
                leg(ticket.sectionCode, ticket.sectionName)
            }
            .padding(Tokens.Size.ticketInset)
            .paperTextSize()
            HStack(alignment: .top) {
                field("Class", ticket.modeLabel)
                field("Card", round.mode == .classic ? "\(pad2(round.index + 1)) / \(pad2(round.cards.count))" : pad2(round.index + 1))
                field("Gate", coordinator.decided && round.mode == .timed ? "Closed" : "F ← → T",
                      label: coordinator.decided && round.mode == .timed ? "Gate, Closed" : "Gate, False left, true right")
            }
            .padding(.horizontal, Tokens.Size.ticketInset)
            .paperTextSize()
            VStack(alignment: .leading, spacing: Tokens.Space.s8) {
                if let card = coordinator.card, !card.appliesTo.isEmpty {
                    Text(card.appliesTo).typeRole(Tokens.TypeRole.monoDataStrong).foregroundStyle(palette.inkMuted.color)
                        .accessibilityLabel("Applies to \(card.appliesTo)")
                }
                if let card = coordinator.card {
                    CardTextView(text: card.text.en.statement, style: Tokens.TypeRole.cardStatement)
                        .foregroundStyle(coordinator.decided && round.mode == .timed ? palette.inkMuted.color : palette.ink.color)
                        .accessibilityIdentifier("statement")
                        .accessibilityFocused(statementFocus)
                        .accessibilityAction(named: "Answer true") { _ = onAnswer(true) }
                        .accessibilityAction(named: "Answer false") { _ = onAnswer(false) }
                        .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("ticketContent")) } action: { onStatementFrame($0) }
                }
            }
            .frame(maxWidth: .infinity, minHeight: Tokens.Size.statementMin, alignment: .topLeading)
            .padding(Tokens.Size.ticketInset)
        }
        .foregroundStyle(palette.ink.color)
        .background(NotchedPaper(edge: .bottom).fill(palette.surfaceRaised.color))
        .clipShape(NotchedPaper(edge: .bottom))
    }

    /// A leg (code over name) is content; only the empty arrow column between the legs is decoration (reference 5.9).
    private func leg(_ code: String, _ name: String) -> some View {
        VStack(alignment: .leading, spacing: Tokens.Space.s2) {
            Text(code).typeRole(Tokens.TypeRole.legCode)
            Text(name).typeRole(Tokens.TypeRole.legName).foregroundStyle(palette.inkMuted.color)
        }
        .accessibilityElement(children: .combine)
    }

    private func field(_ label: String, _ value: String, label spoken: String? = nil) -> some View {
        VStack(alignment: .leading, spacing: Tokens.Space.s2) {
            Text(label).typeRole(Tokens.TypeRole.fieldLabel).foregroundStyle(palette.inkMuted.color)
            Text(value).typeRole(Tokens.TypeRole.fieldValue)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(spoken ?? "\(label), \(value)")
    }

    /// The side the stub tears to: left after a right answer, right after a wrong one.
    private var tearSide: Double { lastAnswer(round)?.correct == true ? -1 : 1 }

    @ViewBuilder private var lower: some View {
        if round.phase == .answered || (round.phase == .finished && round.mode != .timed), let answered = lastAnswer(round) {
            slip(answered)
                .transition(.opacity.animation(Tokens.Curve.ease.animation(reducedMotion ? Tokens.Duration.reducedIn : Tokens.Duration.t2)))
        } else {
            stub
                .transition(reducedMotion
                    ? .opacity.animation(Tokens.Curve.ease.animation(Tokens.Duration.reducedOut))
                    : .asymmetric(
                        insertion: .offset(y: 12).combined(with: .opacity).animation(Tokens.Curve.ease.animation(Tokens.Duration.t2)),
                        removal: .modifier(active: TearOff(side: tearSide, p: 1), identity: TearOff(side: tearSide, p: 0))
                            .animation(Tokens.Curve.fall.animation(Tokens.Transition.tear.duration))))
        }
    }

    private var stub: some View {
        VStack(spacing: Tokens.Space.s8) {
            Perforation(axis: .horizontal).padding(.horizontal, Tokens.Size.notch + 6)
            HStack(alignment: .firstTextBaseline) {
                Text("\(ticket.deckCode) → \(ticket.sectionCode) · \(ticket.modeLabel)").typeRole(Tokens.TypeRole.monoData)
                    .foregroundStyle(palette.inkMuted.color)
                Spacer()
                Text("Card \(pad2(round.index + 1))").typeRole(Tokens.TypeRole.monoDataStrong)
            }
            BarcodeView(data: coordinator.card?.id ?? "")
            if round.mode == .timed {
                Text(timedHint ?? "swipe to board").typeRole(Self.monoRegular).foregroundStyle(palette.inkMuted.color)
                    .frame(maxWidth: .infinity)
            } else {
                HStack {
                    Text("← False").typeRole(Tokens.TypeRole.monoDataStrong).foregroundStyle(palette.answerFalse.color)
                    Spacer()
                    Text("swipe to board").typeRole(Self.monoRegular).foregroundStyle(palette.inkMuted.color)
                    Spacer()
                    Text("True →").typeRole(Tokens.TypeRole.monoDataStrong).foregroundStyle(palette.answerTrue.color)
                }
            }
        }
        .foregroundStyle(palette.ink.color)
        .padding(.horizontal, Tokens.Size.ticketInset)
        .padding(.vertical, Tokens.Space.s12)
        .frame(maxWidth: .infinity, minHeight: Tokens.Size.lower)
        .overlay(alignment: .topLeading) {
            if round.mode != .timed { intentStamp(true).padding(.leading, Tokens.Space.s16).padding(.top, 64) }
        }
        .overlay(alignment: .topTrailing) {
            if round.mode != .timed { intentStamp(false).padding(.trailing, Tokens.Space.s16).padding(.top, 64) }
        }
        .overlay(alignment: .top) {
            // Timed's stub stamp, centred 96 from the stub's top.
            if round.mode == .timed, round.phase == .stamped { timedStamp.frame(height: 0).offset(y: 96) }
        }
        .background(NotchedPaper(edge: .top).fill(palette.surfaceRaised.color))
        .offset(y: abs(intent) * Tokens.Gesture.stubPull)
        .rotationEffect(.degrees(intent * 2), anchor: UnitPoint(x: 0.2, y: 0))
        .accessibilityHidden(true)
        .paperTextSize()
    }

    /// "swipe to board": the mono face at the strong data size, regular weight.
    private static let monoRegular = TypeStyle(family: .mono, weight: 400, size: Tokens.TypeRole.monoDataStrong.size,
                                               lineHeight: Tokens.TypeRole.monoDataStrong.lineHeight, letterSpacing: 0)

    /// The intent stamp of a side, inside the stub (PassStub): True at the left rotated -7, False at the right at +7.
    private func intentStamp(_ isTrue: Bool) -> some View {
        let value = isTrue ? intent : -intent
        let colour = isTrue ? palette.answerTrue.color : palette.answerFalse.color
        return HStack(spacing: Tokens.Space.s8) {
            IconView(icon: isTrue ? .check : .cross, size: isTrue ? 18 : 16, strokeWidth: 3)
            Text(isTrue ? "True" : "False").typeRole(Tokens.TypeRole.intentStamp)
        }
        .foregroundStyle(colour)
        .padding(.horizontal, Tokens.Space.s12)
        .padding(.vertical, Tokens.Space.s6)
        .background(RoundedRectangle(cornerRadius: Tokens.Radius.small).fill(palette.surfaceRaised.color))
        .overlay(RoundedRectangle(cornerRadius: Tokens.Radius.small).strokeBorder(colour, lineWidth: Tokens.Stroke.stamp))
        .rotationEffect(.degrees(isTrue ? -7 : 7))
        .opacity(min(1, max(0, value * Tokens.Gesture.intentOpacityGain)))
    }

    private var timedHint: String? {
        guard round.mode == .timed, round.phase == .stamped else { return nil }
        if coordinator.decided { return "This card doesn't count · \(round.answers.count) answered" }
        return lastAnswer(round)?.correct == true ? "Next card coming up" : "Wrong, saved for review at the end"
    }

    private var timedStamp: some View {
        let timeUp = coordinator.decided
        let correct = lastAnswer(round)?.correct == true
        let colour = timeUp ? palette.ink.color : (correct ? palette.correct.color : palette.wrong.color)
        return LandingStamp(duration: Tokens.Duration.stampTimed, delay: timeUp ? 0.12 : 0, reducedMotion: reducedMotion) {
            HStack(spacing: Tokens.Space.s6) {
                if timeUp {
                    IconView(icon: .clockHands, size: 22)
                } else {
                    IconView(icon: correct ? .check : .cross, size: correct ? 24 : 20, strokeWidth: 3)
                }
                Text(timeUp ? "Time is up" : (correct ? "Correct" : "Not quite")).typeRole(Tokens.TypeRole.stampStub)
            }
            .foregroundStyle(colour)
            .padding(.horizontal, Tokens.Space.s12)
            .padding(.vertical, Tokens.Space.s6)
            .background(StampBorder(color: colour))
        }
        .id(round.answers.count * 2 + (timeUp ? 1 : 0))
    }

    private func slip(_ answered: Answered) -> some View {
        let card = answered.card
        let newBest = coordinator.request.mode == .streak && answered.correct && (coordinator.previousBest ?? 0) >= 1
            && round.answers.prefix { $0.correct }.count == (coordinator.previousBest ?? 0) + 1
        let colour = answered.correct ? palette.correct.color : palette.wrong.color
        return VStack(alignment: .leading, spacing: Tokens.Space.s12) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: Tokens.Space.s2) {
                    Text("The answer is").typeRole(Tokens.TypeRole.answerLabel).foregroundStyle(palette.inkMuted.color)
                    Text(card.answer ? "True" : "False").typeRole(Tokens.TypeRole.answerValue)
                }
                .accessibilityElement(children: .combine)
                Spacer()
                LandingStamp(duration: Tokens.Transition.stamp.duration, delay: Tokens.Transition.stamp.delay, reducedMotion: reducedMotion) {
                    HStack(spacing: Tokens.Space.s6) {
                        IconView(icon: newBest ? .star : (answered.correct ? .check : .cross), size: newBest ? 20 : (answered.correct ? 22 : 18), strokeWidth: 3)
                        Text(newBest ? "New best" : (answered.correct ? "Correct" : "Not quite")).typeRole(Tokens.TypeRole.stamp)
                    }
                    .foregroundStyle(colour)
                    .padding(.horizontal, Tokens.Space.s10)
                    .padding(.vertical, Tokens.Space.s4)
                    .background(StampBorder(color: colour))
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(newBest ? "Correct. New best" : (answered.correct ? "Correct" : "Not quite"))
            }
            .paperTextSize()
            CardTextView(text: card.text.en.explanation, style: Tokens.TypeRole.body)
            if let url = URL(string: card.source.url) {
                SourceLink(title: card.source.title) { onSource(url) }
            }
        }
        .foregroundStyle(palette.ink.color)
        .padding(Tokens.Size.ticketInset)
        .frame(maxWidth: .infinity, minHeight: Tokens.Size.lower, alignment: .topLeading)
        .background(NotchedPaper(edge: .top).fill(palette.surfaceSunk.color))
        .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("ticketContent")) } action: { onSlipFrame($0) }
    }
}

/// The stub tearing off (reference 5.7): to (-40, 360) and -18 degrees after a right answer, (40, 360) and 18 after a
/// wrong one, fading as it falls.
struct TearOff: ViewModifier {
    let side: Double
    let p: Double

    func body(content: Content) -> some View {
        content
            .rotationEffect(.degrees(side * 18 * p))
            .offset(x: side * 40 * p, y: 360 * p)
            .opacity(1 - p)
    }
}

/// A stamp landing (reference 5.7): from scale 1.9, -14 degrees and transparent to scale 1, -6 degrees, on the spring
/// curve; shown at rest under reduced motion.
struct LandingStamp<Content: View>: View {
    let duration: Double
    let delay: Double
    let reducedMotion: Bool
    @ViewBuilder let content: () -> Content
    @State private var landed = false

    var body: some View {
        let rest = landed || reducedMotion
        content()
            .scaleEffect(rest ? 1 : 1.9)
            .rotationEffect(.degrees(rest ? -6 : -14))
            .opacity(rest ? 1 : 0)
            .onAppear {
                guard !reducedMotion, !landed else { return }
                withAnimation(Tokens.Curve.spring.animation(duration, delay: delay)) { landed = true }
            }
    }
}

/// A source link (slip and Why): the book icon, the underlined title and an arrow, at least 48 tall; read as
/// "{title} (opens in browser)".
struct SourceLink: View {
    let title: String
    let action: () -> Void
    @Environment(\.palette) private var palette

    var body: some View {
        Button(action: action) {
            HStack(spacing: Tokens.Space.s6) {
                IconView(icon: .book, size: 18)
                Text(title).underline().multilineTextAlignment(.leading)
                Text("→").accessibilityHidden(true)
            }
            .typeRole(Tokens.TypeRole.sourceLink)
            .foregroundStyle(palette.answerTrue.color)
            .frame(minHeight: Tokens.Size.touchMin, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.quiet)
        .keyboardFocusRing(RoundedRectangle(cornerRadius: Tokens.Radius.small))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(title) (opens in browser)")
        .accessibilityAddTraits(.isButton)
    }
}
```

`ios/Truthy/Truthy/Round/Safari.swift`:

```swift
import SafariServices
import SwiftUI
import UIKit

// Source links open in the in-app browser (spec 5.6): SFSafariViewController presented from the top view controller,
// in the app's theme (its bar tint is honoured only before iOS 26).

enum SafariPresenter {
    @MainActor static func present(_ url: URL, theme: ResolvedTheme, palette: Palette) {
        guard let scene = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }).first,
              var top = scene.keyWindow?.rootViewController else { return }
        while let presented = top.presentedViewController { top = presented }
        let safari = SFSafariViewController(url: url)
        safari.overrideUserInterfaceStyle = theme == .dark ? .dark : .light
        safari.preferredControlTintColor = UIColor(palette.ink.color)
        safari.preferredBarTintColor = UIColor(palette.surfaceRaised.color)
        top.present(safari, animated: true)
    }
}
```

- [ ] **Step 6: Write the round screen and task 14's two stand-ins.**

`ios/Truthy/Truthy/Round/RoundView.swift`:

```swift
import SwiftUI
import TruthyEngine

// The round screen (spec 5.2 to 5.6, reference 4.1 P0 to P3t): the X and the class's header, the ticket in its own
// vertical scroll with the card drag on a stationary container, the answer row or the action after an answer,
// haptics at the decision moments, the hardware keys, announcements, the leading-edge back pan and, once finished,
// the result (task 14).

struct RoundScreen: View {
    let model: AppModel
    let request: RoundRequest
    @State private var coordinator: RoundCoordinator?
    @State private var failed = false
    @Environment(\.palette) private var palette

    var body: some View {
        ZStack {
            SkyBackdrop()
            if let coordinator {
                if coordinator.finished {
                    ResultView(model: model, coordinator: coordinator)
                } else {
                    RoundView(model: model, coordinator: coordinator)
                }
            } else if failed {
                VStack(spacing: Tokens.Space.s16) {
                    Text("This deck didn't load").typeRole(Tokens.TypeRole.stepTitle).accessibilityAddTraits(.isHeader)
                    Text("Check your connection and try again.").typeRole(Tokens.TypeRole.body)
                    PillButton(title: "Try again") { failed = false }
                }
                .foregroundStyle(palette.ink.color)
                .padding(Tokens.Size.gutter)
            } else {
                loading
            }
        }
        .task(id: failed) {
            guard coordinator == nil, !failed else { return }
            do {
                let prepared = try await RoundCoordinator.prepare(request: request, index: model.index, decks: model.decks, store: model.store,
                                                                  journal: model.journal, wall: model.wall, mono: model.mono)
                coordinator = prepared
                #if DEBUG
                if let screen = model.takeDebugScreen() { await prepared.applyDebug(screen) }
                #endif
            } catch {
                failed = true
            }
        }
    }

    /// While the deck decodes (reference 4.1 P0): the X, an empty ticket, "Your round" for VoiceOver and the status
    /// read but not shown. Back here leaves at once (spec 5.2).
    private var loading: some View {
        AppFrame {
            VStack(alignment: .leading, spacing: Tokens.Space.s12) {
                RoundIconButton(icon: .cross, label: "Leave round") { leaveNow() }
                NotchedPaper(edge: .bottom)
                    .fill(palette.surfaceRaised.color)
                    .frame(maxWidth: .infinity, minHeight: Tokens.Size.statementMin)
                    .accessibilityHidden(true)
                Spacer(minLength: 0)
            }
        }
        .overlay(alignment: .topLeading) {
            Color.clear.frame(width: 1, height: 1)
                .accessibilityElement()
                .accessibilityLabel("Your round")
                .accessibilityAddTraits(.isHeader)
        }
        .backPans(isEnabled: true, anywhere: false) { event in
            if event.phase == .ended && BackTransition.completes(progress: event.progress, velocity: event.velocity) { leaveNow() }
        }
        .onAppear { AccessibilityNotification.Announcement("Loading your round").post() }
    }

    private func leaveNow() {
        Task { await model.showStart(byControl: true) }
    }
}

/// Where the ticket scrolls (task 6's ticket scroll, reference 4.4): after an answer only when the slip is not in view,
/// to min(max, slip.top); on a new card only as far as shows the statement above the action row.
enum TicketScrollTarget {
    static func afterAnswer(slip: CGRect, offset: Double, viewport: Double, contentHeight: Double) -> Double? {
        slipScroll(Span(top: slip.minY, bottom: slip.maxY),
                   SlipScrollAt(top: offset, visible: viewport, gap: Tokens.Space.s12, max: max(0, contentHeight - viewport)))
    }

    static func newCard(statement: CGRect, viewport: Double) -> Double {
        statementScroll(Span(top: statement.minY, bottom: statement.maxY), viewport)
    }
}

struct RoundView: View {
    let model: AppModel
    @Bindable var coordinator: RoundCoordinator
    @Environment(\.palette) private var palette
    @Environment(\.resolvedTheme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reducedMotion
    @Environment(\.scenePhase) private var scenePhase
    @State private var dragDx = 0.0
    @State private var caught = 0.0
    @State private var springBack: SpringBack?
    @State private var crossing = CrossingCounter()
    @State private var verdicts = 0
    @State private var lastCorrect = true
    @State private var timeUps = 0
    @State private var roundBack = 1.0
    @State private var leaving = false
    @State private var heldAnnouncement: String?
    @State private var scroll = ScrollPosition(edge: .top)
    @State private var scrollGeometry: [Double] = [0, 0, 0]   // offset, viewport, content height
    @State private var statementFrame = CGRect.zero
    @State private var slipFrame = CGRect.zero
    @State private var slipScrolled = false
    @State private var ticketWidth = 0.0
    @AccessibilityFocusState private var statementFocused: Bool
    @AccessibilityFocusState private var actionFocused: Bool
    @AccessibilityFocusState private var xFocused: Bool
    /// The screen's root holds keyboard focus, so the keys work after touches (spec section 2).
    @FocusState private var keysFocused: Bool

    private var round: RoundState { coordinator.state }

    var body: some View {
        AppFrame {
            VStack(spacing: Tokens.Space.s12) {
                header
                ScrollView {
                    ticket.coordinateSpace(name: "ticketContent")
                }
                .scrollPosition($scroll)
                .onScrollGeometryChange(for: [Double].self) { [$0.contentOffset.y, $0.containerSize.height, $0.contentSize.height] } action: { _, g in
                    scrollGeometry = g
                }
                .onChange(of: slipFrame) { _, frame in
                    guard round.phase == .answered, !slipScrolled, frame.height > 0 else { return }
                    slipScrolled = true
                    if let y = TicketScrollTarget.afterAnswer(slip: frame, offset: scrollGeometry[0], viewport: scrollGeometry[1], contentHeight: scrollGeometry[2]) {
                        withAnimation(Tokens.Curve.ease.animation(Tokens.Duration.t3)) { scroll.scrollTo(y: y) }
                    }
                }
                .onChange(of: round.index) { _, _ in
                    slipScrolled = false
                    // After the new card's layout: only as far as shows its statement above the action row.
                    Task {
                        await Task.yield()
                        scroll.scrollTo(y: TicketScrollTarget.newCard(statement: statementFrame, viewport: scrollGeometry[1]))
                    }
                }
                actions
            }
        }
        .scaleEffect(roundBack)
        .backPans(isEnabled: !coordinator.sheetOpen && !leaving, anywhere: false, onEvent: handleBack)
        .sensoryFeedback(.impact(weight: .light), trigger: crossing.count)
        .sensoryFeedback(trigger: verdicts) { _, _ in lastCorrect ? .success : .error }
        .sensoryFeedback(.warning, trigger: timeUps)
        .focusable(interactions: .edit)
        .focusEffectDisabled()
        .focused($keysFocused)
        .onKeyPress(.leftArrow, phases: .down) { _ in answer(false) ? .handled : .ignored }
        .onKeyPress(.rightArrow, phases: .down) { _ in answer(true) ? .handled : .ignored }
        .onKeyPress(.return, phases: .down) { _ in
            Task { await coordinator.next() }
            return .handled
        }
        .onKeyPress(.escape, phases: .down) { _ in
            pressX()
            return .handled
        }
        .onAppear {
            coordinator.startTicker()
            statementFocused = true
            keysFocused = true
        }
        .onDisappear { coordinator.stopTicker() }
        .onChange(of: scenePhase) { _, phase in coordinator.scenePhaseChanged(phase) }
        .onChange(of: coordinator.decided) { _, decided in
            if decided && round.mode == .timed {
                timeUps += 1
                announce("Time is up. This card doesn't count.")
            }
        }
        .onChange(of: round.index) { _, _ in
            if round.mode == .timed { announce(timedCardText(round)) }
        }
        .onChange(of: coordinator.showsAction) { _, shows in
            // Reference 4.4: after an answer focus goes to Next card or See results when it takes presses (at once with
            // reduced motion); at time up only from True or False, which then leave the screen.
            guard shows else { return }
            Task {
                try? await Task.sleep(for: .milliseconds(reducedMotion ? 0 : Int(NEXT_ARRIVES_MS)))
                actionFocused = true
            }
        }
        .leaveSheet(coordinator: coordinator, onLeave: leave)
        .onChange(of: coordinator.sheetOpen) { _, open in
            if !open && !leaving { xFocused = true }
            guard !open, let held = heldAnnouncement else { return }
            heldAnnouncement = nil
            Task {
                try? await Task.sleep(for: .milliseconds(Int(SPOKEN_RELEASE_MS)))
                AccessibilityNotification.Announcement(held).post()
            }
        }
    }

    // MARK: Header and ticket

    private var header: some View {
        HStack(alignment: .top, spacing: Tokens.Space.s12) {
            RoundIconButton(icon: .cross, label: "Leave round") { pressX() }
                .accessibilityFocused($xFocused)
            Group {
                switch round.mode {
                case .classic: FlightPathHeader(round: round)
                case .streak: StreakHeader(round: round, best: coordinator.previousBest)
                case .lives: LivesHeader(round: round)
                case .timed: TimedHeader(round: round)
                }
            }
            .frame(maxWidth: .infinity)
        }
        .frame(minHeight: Tokens.Size.header)
        .overlay(alignment: .topLeading) {
            // A heading VoiceOver reads but nobody sees (an opacity-0 view would leave the accessibility tree).
            Color.clear.frame(width: 1, height: 1)
                .accessibilityElement()
                .accessibilityLabel("\(coordinator.ticket.deckName), \(coordinator.ticket.sectionName): \(coordinator.ticket.modeLabel) round")
                .accessibilityAddTraits(.isHeader)
        }
    }

    private var ticket: some View {
        let dx = caught + dragDx
        return BoardingPassView(coordinator: coordinator, intent: intent(dragDx), statementFocus: $statementFocused,
                                onAnswer: { answer($0) },
                                onSource: { url in SafariPresenter.present(url, theme: theme, palette: palette) },
                                onStatementFrame: { statementFrame = $0 }, onSlipFrame: { slipFrame = $0 })
            // CSS translateX(dx) rotate(dx/18deg): the card turns about its own moved centre.
            .rotationEffect(.degrees(dx / Tokens.Gesture.rotationDivisor))
            .offset(x: dx)
            .id(round.mode == .timed ? round.index : 0)
            .transition(timedCardTransition)
            .onGeometryChange(for: Double.self) { $0.size.width } action: { ticketWidth = $0 }
            .contentShape(Rectangle())
            // Enabled by observable state only: canAnswer depends on the clock and would leave the recognizer disabled.
            // The 250 ms settle still holds: interpret gets cardShownAt and coordinator.answer checks canAnswer.
            .gesture(CardPan(isEnabled: (round.phase == .question && !coordinator.sheetOpen) || dragDx != 0, onDrag: handleDrag))
    }

    /// Timed (reference 5.7): after the 700 ms hold the card leaves towards the answered side (x 120 percent, 8 degrees,
    /// 220 on the fall curve) and the next one comes from 14 below (280). The other classes keep one ticket.
    private var timedCardTransition: AnyTransition {
        guard round.mode == .timed, !reducedMotion else { return .identity }
        let side: Double = lastAnswer(round)?.given == false ? -1 : 1
        return .asymmetric(
            insertion: .offset(y: 14).combined(with: .opacity).animation(Tokens.Curve.ease.animation(Tokens.Transition.timedDeal.duration)),
            removal: .offset(x: side * 1.2 * ticketWidth).combined(with: .rotation(side))
                .combined(with: .opacity).animation(Tokens.Curve.fall.animation(Tokens.Transition.timedLeave.duration)))
    }

    // MARK: Actions

    @ViewBuilder private var actions: some View {
        let timedStamped = round.mode == .timed && round.phase == .stamped && !coordinator.decided
        if coordinator.showsAction {
            PillButton(title: coordinator.decided ? "See results" : "Next card", trailingArrow: true) {
                Task { await coordinator.next() }
            }
            .accessibilityFocused($actionFocused)
            .frame(minHeight: Tokens.Size.actions)
            .transition(reducedMotion ? .opacity : .offset(y: 12).combined(with: .opacity).animation(
                Tokens.Curve.ease.animation(Tokens.Transition.answerRow.duration, delay: Tokens.Transition.answerRow.delay)))
        } else {
            HStack(spacing: Tokens.Space.s12) {
                PillButton(title: "False", fill: .answerFalse, leading: .cross, leadingSize: 16, leadingStroke: 3, dimmed: timedStamped) { _ = answer(false) }
                PillButton(title: "True", fill: .answerTrue, leading: .check, leadingStroke: 3, dimmed: timedStamped) { _ = answer(true) }
            }
            // Two half-width pills: past xxLarge "False" breaks in the middle of the word (README deviation 6).
            .paperTextSize()
            .frame(minHeight: Tokens.Size.actions)
            .transition(.opacity.animation(Tokens.Curve.ease.animation(Tokens.Duration.t2)))
        }
    }

    private func intent(_ dx: Double) -> Double {
        TruthyEngine.intent(dx)
    }

    // MARK: Answering

    @discardableResult private func answer(_ value: Bool) -> Bool {
        guard coordinator.answer(value), let answered = lastAnswer(round) else { return false }
        lastCorrect = answered.correct
        verdicts += 1
        if round.mode == .timed {
            announce(timedStatus(round))
        } else {
            let best = coordinator.previousBest ?? 0
            let newBest = round.mode == .streak && answered.correct && best >= 1 && round.answers.prefix { $0.correct }.count == best + 1
            let status = roundStatus(round)
            announce(verdictText(answered.correct, answered.card.answer, newBest) + (status.isEmpty ? "" : " \(status)"))
        }
        return true
    }

    private func announce(_ text: String) {
        guard !text.isEmpty else { return }
        if coordinator.sheetOpen {
            heldAnnouncement = text
        } else {
            AccessibilityNotification.Announcement(text).post()
        }
    }

    /// The finger: the drawn offset is the catch offset plus dx; interpret and the haptic read dx alone. Release
    /// answers through the one answer path and springs the card back with the finger's speed (spec 5.3).
    private func handleDrag(_ drag: CardDrag) {
        switch drag.phase {
        case .moved:
            if dragDx == 0, let spring = springBack {
                caught = spring.position(atMs: model.mono.nowMs())
                springBack = nil
            }
            dragDx = drag.dx
            crossing.update(dx: drag.dx)
        case .released, .cancelled:
            crossing.release()
            if drag.phase == .released {
                let outcome = interpret(drag.samples, SwipeContext(viewportWidth: drag.windowWidth, cardShownAt: coordinator.cardShownAt))
                if outcome != .cancel { answer(outcome == .true) }
            }
            let offset = caught + dragDx
            caught = 0
            dragDx = offset
            if reducedMotion {
                dragDx = 0
                return
            }
            springBack = SpringBack(offset: offset, velocity: drag.velocity, startedAt: model.mono.nowMs())
            let unitVelocity = offset == 0 ? 0 : -drag.velocity / offset
            withAnimation(Tokens.Spring.snap.animation(initialVelocity: unitVelocity)) {
                dragDx = 0
            } completion: {
                springBack = nil
            }
        }
    }

    // MARK: Leaving

    /// The X, Escape and back on the round: with no answers leave at once, otherwise ask; on the sheet, keep playing.
    private func pressX() {
        if coordinator.sheetOpen {
            coordinator.keepPlaying()
            return
        }
        switch coordinator.xAction {
        case .leaveNow: leave()
        case .openSheet: coordinator.openSheet()
        }
    }

    private func leave() {
        guard !leaving else { return }
        leaving = true
        Task {
            await coordinator.leave()
            await model.showStart(byControl: true)
        }
    }

    /// The leading-edge pan on the round scales the surface from 1 to 0.94 with the progress, pivot at the centre, and,
    /// on release past the rule, does what the X does; a cancel springs back (spec 5.2).
    private func handleBack(_ event: BackPanEvent) {
        switch event.phase {
        case .changed:
            roundBack = 1 - 0.06 * event.progress
        case .ended, .cancelled:
            let complete = event.phase == .ended && BackTransition.completes(progress: event.progress, velocity: event.velocity)
            withAnimation(Tokens.Spring.snap.animation) { roundBack = 1 }
            if complete { pressX() }
        }
    }
}

private extension AnyTransition {
    /// The leaving Timed card turns 8 degrees towards its side.
    static func rotation(_ side: Double) -> AnyTransition {
        .modifier(active: TurnModifier(degrees: side * 8), identity: TurnModifier(degrees: 0))
    }
}

private struct TurnModifier: ViewModifier {
    let degrees: Double

    func body(content: Content) -> some View {
        content.rotationEffect(.degrees(degrees))
    }
}
```

`ios/Truthy/Truthy/Result/LeaveSheet.swift`:

```swift
import SwiftUI

// A stand-in until task 14 writes the leave sheet: the round screen already calls it.
extension View {
    func leaveSheet(coordinator: RoundCoordinator, onLeave: @escaping () -> Void) -> some View {
        self
    }
}
```

`ios/Truthy/Truthy/Result/ResultView.swift`:

```swift
import SwiftUI

// A stand-in until task 14 writes the result: the round screen already shows it once the round is finished.
struct ResultView: View {
    let model: AppModel
    let coordinator: RoundCoordinator

    var body: some View {
        Text("Round complete").accessibilityAddTraits(.isHeader)
    }
}
```

- [ ] **Step 7: Run the tests.**

```bash
DEST26='platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5'
xcodebuild test -project ios/Truthy/Truthy.xcodeproj -scheme Truthy -destination "$DEST26" 2>&1 | grep -E 'Test run with|Executed [0-9]+ tests?,|✘|TEST (SUCCEEDED|FAILED)' | tail -6
```

Expected: `Test run with 73 tests in 21 suites passed` (plus `CrossingCounterTests` 2, `SpringBackTests` 2 and `TicketScrollTargetTests` 1), `Executed 11 tests, with 1 test skipped and 0 failures` (plus the six round gesture tests; task 12's Escape test skips on the simulator) and `** TEST SUCCEEDED **`. If `testADiagonalDragOnALongStatementScrollsOrAnswersNeverBoth` reports both, the card recognizer began on a steep drag: check the delegate's horizontal rule; if it reports neither, the scroll view did not get the vertical part: check that nothing else on the ticket claims vertical pans.

- [ ] **Step 8: Play by hand once.** Launch with `-seed 7 -route aws-clf-c02/SEC -mode classic -screen round` (task 11, step 9) and play: a drag under 90 springs back carrying its speed; a drag over 90 answers, the stub tears off to the side of the verdict, the slip comes, the stamp lands after 380 and the ticket jolts; the ticket scrolls only when the slip is not in view; Next card rises after 360 and waits its 420 ms; a vertical drag scrolls with bounce, also on a short ticket; the source link opens the in-app browser; the edge pan shrinks the round. Then `-mode timed`: the clock runs, the stub takes its stamp for 700 ms, the card leaves towards the answered side and the next comes from below; at the end Time is up and See results (task 14's stand-in result shows "Round complete"). Then Streak and Three lives headers. Note differences from the web for task 15.

- [ ] **Step 9: Run the gates and commit.**

```bash
swift test --package-path ios/TruthyEngine 2>&1 | tail -1
xcodebuild test -project ios/Truthy/Truthy.xcodeproj -scheme Truthy -destination 'platform=iOS Simulator,name=iPhone 16 Pro,OS=18.4' 2>&1 | grep -E 'TEST (SUCCEEDED|FAILED)'
git add ios/Truthy/Truthy/Round ios/Truthy/Truthy/Result ios/Truthy/TruthyTests/RoundUnitTests.swift ios/Truthy/TruthyUITests/RoundGestureTests.swift
pnpm test
git commit -m "feat: add the iOS round with the native card drag, springs with velocity, haptics, Timed, keys and announcements"
git status --short
```

Expected: the engine passes as before; `** TEST SUCCEEDED **` on iOS 18.4; `pnpm test` passes; nothing from `git status --short`.
