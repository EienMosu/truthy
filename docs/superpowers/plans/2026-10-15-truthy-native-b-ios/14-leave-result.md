### Task 14: The leave sheet, back on the result, and the result with the comparison and the missed cards

The two places a round ends (spec 3, 5.2 and 5.4, reference 4.1 P4 and R1): "Leave round?" is the platform sheet for behaviour (swipe down, the scrim, VoiceOver's modality) with the web's floating card drawn inside a transparent container, its detent measured from the card; the result shows the completed route with its sentence, the class's fields, the score and the comparison with the best, the missed cards with their Why disclosures, and Play again and Choose another route. The result was recorded once when it finished (task 11); every result action and back on the result wait 1000 ms. This task replaces task 13's two stand-ins.

Builds on tasks 1 to 13: `resultCopy`, `missedCards`, `completedScale` and the comparison of tasks 4 and 6; `RoundCoordinator` (sheet state, scrim guard, result guard, outcome) of task 11; `CardTextView`, `SafariPresenter`, `RouteCanvas` of task 13; components of task 10.

**Files:**
- Modify: `ios/Truthy/Truthy/Result/LeaveSheet.swift`, `ios/Truthy/Truthy/Result/ResultView.swift` (both replaced whole)
- Create (app): `ios/Truthy/Truthy/Result/MissedCardsView.swift`
- Test: create `ios/Truthy/TruthyTests/LeaveSheetLayoutTests.swift`, `ios/Truthy/TruthyUITests/LeaveAndResultTests.swift`

**Interfaces:**
- Produces (app target):

```swift
enum LeaveSheetLayout { static func detent(cardHeight: Double, bottomInset: Double, screenHeight: Double) -> PresentationDetent }
struct LeaveCard: View { static let undecided: String; static let decidedText: String; init(decided: Bool, drawsPaper: Bool = true, onKeepPlaying: () -> Void, onLeave: () -> Void) }
extension View { func leaveSheet(coordinator: RoundCoordinator, onLeave: @escaping () -> Void) -> some View }
struct ResultView: View { init(model: AppModel, coordinator: RoundCoordinator) }
struct ScoreBlock: View { init(copy: ResultCopy, score: Int, comparison: Comparison?) }
struct MissedCardsView: View { init(missed: [MissedCard], onOpen: (Int) -> Void = { _ in }) }
```

**Rules:**

1. **The sheet** (spec 5.4): `.sheet(isPresented:onDismiss:)` bound to the coordinator's `sheetOpen`; `presentationDetents` holds one detent, `.height(card height + bottom inset)` measured from the card (it changes with the text size) or `.large` when that is taller than the screen, and the card then scrolls. The screen height and the bottom inset are measured on the presenting round, outside the sheet (a reader inside the sheet would measure the sheet the detent sizes), and the bottom inset is the larger of the system inset and 34 (`max`, as the web's spacing). `presentationDragIndicator(.hidden)`. Before iOS 26 the sheet is transparent (`presentationBackground(.clear)`) and the card draws its paper (padding 20, radius 16) inside the 16 gutter; on iOS 26 and later the sheet's background is the paper colour and the card draws none, so the inset sheet is the card and takes its corner radius, and no clear or glass strip shows around it (sheet chrome, criterion 2). The card's own arrival uses the native group of the tokens (task 8): it rises `sheetOffsetY` (24) and fades in over 360, or fades over `sheetReducedDuration` (140) with reduced motion, and is at least `sheetMinWidth` (320) wide. The sheet's own slide is the system's: SwiftUI's `.sheet` keeps UIKit's presentation motion internal, so the sheet cannot take the web's 24 and 360 (README deviation 4, sheet chrome under criterion 2). The title uses the `sheet-title` role. The app does not opt out of Liquid Glass.
2. **Keep playing or leave** (spec 5.4): swiping down and tapping outside call `onDismiss`, which a `leaving` flag tells from Leave round: anything but Leave round keeps playing. Escape inside the sheet keeps playing: Keep playing carries `keyboardShortcut(.cancelAction)`, a key command of the presented sheet that needs no focus, and the round's own Escape handler keeps playing while the sheet is open (task 13 rule 8). With the Mac keyboard through the iOS 18.4 simulator Escape closes the sheet and the round stays as it was; XCUITest cannot deliver Escape on the 18.4 or the 26.5 simulator (task 12 rule 6), so `testEscapeOnTheSheetKeepsPlaying` skips there and task 16 checks it on the device (D16). The Timed clock keeps running under the sheet (the coordinator's ticker does not stop), and the body switches to the decided text when the round becomes decided while the sheet is open, announced once.
3. **The scrim guard** (spec 5.4): the web ignores a scrim tap for 250 ms after the sheet opens. The coordinator always computes `scrimTapAccepted` (task 11, unit tested); the sheet consults it only if the double-tap UI test on the X fails (step 7), and the outcome is recorded under N7 (README, "Cross-platform agreements").
4. **The result** (reference 4.5): X "Close results"; the completed route as one image labelled with `resultCopy.label` (Streak rings the previous best, `resultCopy.ring`); the heading "Round complete", an element VoiceOver reads but nobody sees (accessibility focus lands on it; never `opacity(0)`, which leaves the accessibility tree); when a New best was set the comparison scrolls into view first (reference 4.4); the fields of the class; the score with its label and unit; the comparison ("First round on this route"; a "New best" stamp over "Previous best {best}"; "Equals your best" over "Best {best}"; "{by} short of your best" over "Best {best}"), computed from the progress before the write; "Missed cards", "{n} to review", each row's "Card {nn}", "You said {True|False}", the appliesTo line, the statement, "Answer {True|False}" with the word in ink, and "Why" labelled "Why, card {nn}", opening the explanation beside a 2 point quote rule and the source link "{title} (opens in browser)"; or "No missed cards". Play again (replay icon) and Choose another route (route icon).
5. **Guards and back** (spec 5.2): Play again, Choose another route, Close results, Escape and the leading-edge pan on the result all wait `RESULT_ARRIVES_MS` from the result's first frame, on the monotonic clock, and do nothing before; back does what Close results does; the result's root is focusable and focused on appear, so Escape can reach it after touches; Play again deals a new round on the same route and class with a new seed (the coordinator re-reads, prunes and saves, task 11); the other two show step 1 with no choices, focus on its title.
6. **Paper text** (README deviation 6): the result's header label row and its field row (Class, Cards, Wrong or the class's own) stop growing at `xxLarge` through task 12's `paperTextSize()`, as the round's do (task 13 rule 10); everything else grows to the largest size and the ticket scrolls.
7. **Recorded once** (reference 6, rule 3): the result never writes; `RoundCoordinator.showResult` recorded it through the store's `RecordedRounds` before this view appears.
8. **Motion** (reference 5.7): the Why chevron turns over 220 ms and the row grows open over 360 ms on the ease curve inside a clipped container, then scrolls into view after 380 ms (50 with reduced motion, where the rest is instant). The source links are task 13's `SourceLink` (book icon, underlined title, arrow).

**Review focus.** README line 3: `LeaveSheetLayoutTests` (the detent fits the card and is `.large` above the screen height); task 15 captures the sheet and the result of each class at the largest text size. README line 5: `testADoubleTapOnTheXLeavesTheSheetOpen` (double and triple tap), `testResultActionsWaitASecond` (after its 1000 ms Play again deals a new round; the presses inside the first second are task 11's `resultActionsWait1000AndTheResultIsRecordedOnce`, because XCUITest cannot tap inside that second: the launch and its idle waits take longer), `testTheResultIsRecorded` (Continue carries the score after a relaunch; recording once is task 11's unit test). N7: `testSwipeDownAndATapAboveKeepPlaying`, `testEscapeOnTheSheetKeepsPlaying` (skipped on the simulator), `testTheTimedClockRunsUnderTheSheet`.

**Steps:**

- [ ] **Step 1: Check the starting point.**

```bash
git status --short
xcodebuild test -project ios/Truthy/Truthy.xcodeproj -scheme Truthy -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5' 2>&1 | grep -E 'Test run with|Executed [0-9]+ tests?,|TEST (SUCCEEDED|FAILED)' | tail -3
```

Expected: nothing; `Test run with 73 tests in 21 suites passed`, `Executed 11 tests, with 1 test skipped and 0 failures`, `** TEST SUCCEEDED **`.

- [ ] **Step 2: Write the tests.**

`ios/Truthy/TruthyTests/LeaveSheetLayoutTests.swift`:

```swift
import SwiftUI
import Testing
@testable import Truthy

// README Review Focus line 3: the leave sheet's detent grows with the card and becomes .large above the screen.
@Suite struct LeaveSheetLayoutTests {
    @Test func theDetentFitsTheCardAndBecomesLargeAboveTheScreen() {
        #expect(LeaveSheetLayout.detent(cardHeight: 300, bottomInset: 34, screenHeight: 932) == .height(334))
        #expect(LeaveSheetLayout.detent(cardHeight: 950, bottomInset: 34, screenHeight: 932) == .large)
    }
}
```

`ios/Truthy/TruthyUITests/LeaveAndResultTests.swift`:

```swift
import XCTest

/// Task 14: feel item N7 and README Review Focus lines 3 and 5 on the leave sheet and the result.
final class LeaveAndResultTests: XCTestCase {
    override func setUp() {
        continueAfterFailure = false
    }

    @MainActor
    private func openSheet(_ driver: AppDriver) {
        driver.button("Leave round").tap()
        driver.waitFor(driver.element("Leave round?"), "the leave sheet")
        driver.pause(0.4)
    }

    @MainActor
    private func gone(_ driver: AppDriver, _ what: String) {
        XCTAssertTrue(driver.element("Leave round?").waitForNonExistence(timeout: 5), "\(what) closed the sheet")
        XCTAssertTrue(driver.button("Next card").exists, "\(what) kept the round as it was")
    }

    /// N7: swiping the sheet down and tapping above the card mean Keep playing.
    @MainActor
    func testSwipeDownAndATapAboveKeepPlaying() {
        let driver = AppDriver.round(screen: "sheet")
        driver.launch()
        driver.waitFor(driver.element("Leave round?"), "the leave sheet")
        driver.pause(0.4)
        // A swipe on the 28 point title is too short to dismiss: drag the card down from its title past the sheet.
        let title = driver.element("Leave round?").coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
        title.press(forDuration: 0.05, thenDragTo: title.withOffset(CGVector(dx: 0, dy: 300)), withVelocity: .fast, thenHoldForDuration: 0)
        gone(driver, "a swipe down")
        openSheet(driver)
        driver.app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.15)).tap()
        gone(driver, "a tap above the card")
    }

    /// N7: Escape on the sheet means Keep playing (skipped on the simulator, where XCUITest cannot deliver it).
    @MainActor
    func testEscapeOnTheSheetKeepsPlaying() throws {
        try AppDriver.skipEscapeAndReturnOnTheSimulator()
        let driver = AppDriver.round(screen: "sheet")
        driver.launch()
        driver.waitFor(driver.element("Leave round?"), "the leave sheet")
        driver.pause(0.4)
        driver.app.typeKey(.escape, modifierFlags: [])
        gone(driver, "Escape")
    }

    /// N7 and README Review Focus 5: a double tap, and a triple tap, on the X open the sheet and leave it open. If this fails, the 250 ms scrim guard of the
    /// web is added (task 14, step 8).
    @MainActor
    func testADoubleTapOnTheXLeavesTheSheetOpen() {
        let driver = AppDriver.round(screen: "answered")
        driver.launch()
        driver.waitFor(driver.button("Next card"), "the answered card")
        driver.button("Leave round").doubleTap()
        driver.pause(1)
        XCTAssertTrue(driver.element("Leave round?").exists, "a double tap leaves the sheet open")
        driver.lowestButton("Keep playing").tap()
        XCTAssertTrue(driver.element("Leave round?").waitForNonExistence(timeout: 5))
        driver.button("Leave round").tap(withNumberOfTaps: 3, numberOfTouches: 1)
        driver.pause(1)
        XCTAssertTrue(driver.element("Leave round?").exists, "a triple tap leaves it open too")
    }

    /// N7: the Timed clock keeps running under the sheet.
    @MainActor
    func testTheTimedClockRunsUnderTheSheet() throws {
        let driver = AppDriver.round("timed")
        driver.launch()
        let clock = driver.element(containing: "left of 60.")
        driver.waitFor(clock, "the Timed header")
        driver.pause(0.3)
        driver.button("True").tap()
        driver.pause(1)
        let before = try XCTUnwrap(Int(clock.label.prefix { $0.isNumber }))
        openSheet(driver)
        driver.pause(3)
        driver.lowestButton("Keep playing").tap()
        XCTAssertTrue(driver.element("Leave round?").waitForNonExistence(timeout: 5))
        let after = try XCTUnwrap(Int(driver.element(containing: "left of 60.").label.prefix { $0.isNumber }))
        XCTAssertGreaterThanOrEqual(before - after, 3, "the clock ran while the sheet was open")
    }

    /// Review Focus 5: after its 1000 ms, Play again deals a new round (and only the launch round opens on the result).
    @MainActor
    func testResultActionsWaitASecond() {
        let driver = AppDriver.round(screen: "result")
        driver.launch()
        let again = driver.button("Play again")
        driver.waitFor(again, "the result")
        // The 1000 ms guard is task 11's unit test (resultActionsReady); XCUITest cannot tap inside the first second.
        driver.pause(1.1)
        again.tap()
        driver.waitFor(driver.element(containing: "Card, 01"), "a new round")
    }

    /// The result is recorded: after Close results the continue line carries its score, and a relaunch keeps it.
    @MainActor
    func testTheResultIsRecorded() {
        let driver = AppDriver.round(screen: "result")
        driver.launch()
        driver.waitFor(driver.button("Close results"), "the result")
        driver.pause(1.1)
        driver.button("Close results").tap()
        let line = driver.button(startingWith: "Continue: AWS Cloud Practitioner, Security and compliance, Classic. Last score ")
        driver.waitFor(line, "the continue line with the score")
        let label = line.label
        driver.app.terminate()
        let plain = AppDriver()
        plain.launch()
        plain.waitFor(plain.button(label), "the same score after a relaunch")
    }
}
```

- [ ] **Step 3: Run them and see them fail.**

```bash
DEST26='platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5'
xcodebuild build-for-testing -project ios/Truthy/Truthy.xcodeproj -scheme Truthy -destination "$DEST26" 2>&1 | grep -E 'error:' | head -3
```

Expected: `cannot find 'LeaveSheetLayout' in scope` (the stand-ins have none of this task's types).

- [ ] **Step 4: Write the leave sheet.**

`ios/Truthy/Truthy/Result/LeaveSheet.swift`:

```swift
import SwiftUI
import TruthyEngine

// "Leave round?" (spec 5.4): the platform sheet for behaviour, the web's floating card for looks. The sheet is
// transparent and has no grabber; its detent is the card's measured height plus the bottom inset, and .large when
// that is taller than the screen (the card then scrolls). Swiping down and tapping outside call onDismiss, which a
// flag tells from Leave round. On iOS 18 the card keeps the 16 gutter; on iOS 26 and later the inset sheet is
// itself the card's frame (sheet chrome under criterion 2).

enum LeaveSheetLayout {
    /// The detent for a card `height` tall on a screen `screenHeight` tall with a bottom inset (before the screen is
    /// measured, the card's own height).
    static func detent(cardHeight: Double, bottomInset: Double, screenHeight: Double) -> PresentationDetent {
        let needed = cardHeight + bottomInset
        return screenHeight > 0 && needed > screenHeight ? .large : .height(needed)
    }
}

struct LeaveCard: View {
    let decided: Bool
    /// Before iOS 26 the card draws its paper; on iOS 26 and later the inset sheet is the paper (SheetPaper).
    var drawsPaper = true
    let onKeepPlaying: () -> Void
    let onLeave: () -> Void
    @Environment(\.palette) private var palette
    @Environment(\.accessibilityReduceMotion) private var reducedMotion
    @State private var arrived = false

    static let undecided = "Your answers so far stay in your history. This round won't count toward your best."
    static let decidedText = "This round is over and its score is kept. Leaving skips its result."

    var body: some View {
        VStack(alignment: .leading, spacing: Tokens.Space.s16) {
            Text("Leave round?").typeRole(Tokens.TypeRole.sheetTitle).accessibilityAddTraits(.isHeader)
            Text(decided ? Self.decidedText : Self.undecided).typeRole(Tokens.TypeRole.body).fixedSize(horizontal: false, vertical: true)
            // Escape keeps playing: a key command of the presented sheet, which needs no focus.
            PillButton(title: "Keep playing", action: onKeepPlaying).keyboardShortcut(.cancelAction)
            QuietButton(title: "Leave round", action: onLeave).frame(maxWidth: .infinity)
        }
        .foregroundStyle(palette.ink.color)
        .padding(Tokens.Space.s20)
        .frame(minWidth: Tokens.Native.sheetMinWidth)
        .background(RoundedRectangle(cornerRadius: Tokens.Radius.card).fill(drawsPaper ? palette.surfaceRaised.color : Color.clear))
        // The card's arrival (the web's sheet motion, from the native group of the tokens).
        .offset(y: arrived || reducedMotion ? 0 : Tokens.Native.sheetOffsetY)
        .opacity(arrived ? 1 : 0)
        .onAppear {
            withAnimation(reducedMotion ? .linear(duration: Tokens.Native.sheetReducedDuration)
                          : Tokens.Curve.ease.animation(Tokens.Transition.sheetOpen.duration)) { arrived = true }
        }
    }
}

/// Before iOS 26 the sheet is transparent and the card draws its paper inside the 16 gutter; on iOS 26 and later the
/// inset sheet is the paper itself and takes its corner radius, so no glass or clear strip shows around the card.
private struct SheetPaper: ViewModifier {
    @Environment(\.palette) private var palette

    func body(content: Content) -> some View {
        if #available(iOS 26, *) {
            content.presentationBackground(palette.surfaceRaised.color)
        } else {
            content.presentationBackground(.clear)
        }
    }
}

private struct LeaveSheetModifier: ViewModifier {
    @Bindable var coordinator: RoundCoordinator
    let onLeave: () -> Void
    @State private var cardHeight = 300.0
    @State private var screenHeight = 0.0
    @State private var bottomInset = 0.0
    @State private var leaving = false
    @State private var announcedDecision = false

    func body(content: Content) -> some View {
        content
            // Measured on the presenting round, outside the sheet: a reader inside would measure the sheet the detent sizes.
            .onGeometryChange(for: Double.self) { $0.safeAreaInsets.bottom } action: { bottomInset = $0 }
            .onGeometryChange(for: Double.self) { $0.size.height + $0.safeAreaInsets.top + $0.safeAreaInsets.bottom } action: { screenHeight = $0 }
            .sheet(isPresented: Binding(get: { coordinator.sheetOpen }, set: { if !$0 { coordinator.keepPlaying() } }),
                   onDismiss: {
                       if leaving { onLeave() } else { coordinator.keepPlaying() }
                       leaving = false
                   }) {
            ScrollView {
                LeaveCard(decided: coordinator.decided, drawsPaper: !Self.insetSheet, onKeepPlaying: { coordinator.keepPlaying() }, onLeave: {
                    leaving = true
                    coordinator.keepPlaying()
                })
                .onGeometryChange(for: Double.self) { $0.size.height } action: { cardHeight = $0 }
                .padding(.horizontal, sheetGutter)
            }
            .scrollBounceBehavior(.basedOnSize)
            .presentationDetents([LeaveSheetLayout.detent(cardHeight: cardHeight, bottomInset: max(bottomInset, Tokens.Size.safeBottom),
                                                          screenHeight: screenHeight)])
            .presentationDragIndicator(.hidden)
            .modifier(SheetPaper())
            .onChange(of: coordinator.decided) { _, decided in
                if decided && !coordinator.decidedWhenSheetOpened && !announcedDecision {
                    announcedDecision = true
                    AccessibilityNotification.Announcement(LeaveCard.decidedText).post()
                }
            }
        }
    }

    private static var insetSheet: Bool {
        if #available(iOS 26, *) { return true }
        return false
    }

    private var sheetGutter: Double {
        Self.insetSheet ? 0 : Tokens.Size.gutter
    }
}

extension View {
    func leaveSheet(coordinator: RoundCoordinator, onLeave: @escaping () -> Void) -> some View {
        modifier(LeaveSheetModifier(coordinator: coordinator, onLeave: onLeave))
    }
}
```

- [ ] **Step 5: Write the result and the missed cards.**

`ios/Truthy/Truthy/Result/ResultView.swift`:

```swift
import SwiftUI
import TruthyEngine

// The result (reference 4.1 R1 and 4.5): Close results, the completed route with its sentence, the ticket with the
// class's fields, the score and the comparison, the missed cards with Why, and Play again and Choose another route.
// The round was recorded once when it finished (RoundCoordinator.showResult); every action waits 1000 ms.

struct ResultView: View {
    let model: AppModel
    let coordinator: RoundCoordinator
    @Environment(\.palette) private var palette
    @Environment(\.shadows) private var shadows
    @Environment(\.accessibilityReduceMotion) private var reducedMotion
    @AccessibilityFocusState private var headingFocused: Bool
    /// The screen's root holds keyboard focus, so Escape works after touches.
    @FocusState private var keysFocused: Bool

    private var result: RoundResult { summarise(coordinator.state) }
    private var copy: ResultCopy {
        resultCopy(result, coordinator.ticket.modeLabel, coordinator.state.cards.count, coordinator.outcome?.previousBest)
    }

    var body: some View {
        AppFrame {
            VStack(spacing: Tokens.Space.s12) {
                HStack(alignment: .top, spacing: Tokens.Space.s12) {
                    RoundIconButton(icon: .cross, label: "Close results") { close() }
                    VStack(spacing: Tokens.Space.s4) {
                        RouteCanvas(flown: 1, plane: nil, marks: (0..<copy.marks).map { i in
                            RouteMark(t: waypointT(Double(i), Double(copy.marks)),
                                      state: i < result.answers.count ? (result.answers[i].correct ? .correct : .wrong) : .future,
                                      scale: completedScale(copy.marks), last: i == copy.marks - 1)
                        }, ring: copy.ring.map { waypointT(Double($0), Double(copy.marks)) })
                        .frame(height: Tokens.Size.flightPathHeight)
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel(copy.label)
                        HStack {
                            Text(copy.ended).bold() + Text(copy.endedDetail)
                            Spacer()
                            Text("\(result.total - result.missed.count) correct · \(result.missed.count) wrong")
                        }
                        .typeRole(Tokens.TypeRole.routeLabel)
                        .foregroundStyle(palette.ink.color)
                        .accessibilityHidden(true)
                        .paperTextSize()
                    }
                }
                // A heading VoiceOver reads but nobody sees (an opacity-0 view would leave the accessibility tree).
                Color.clear.frame(width: 1, height: 1)
                    .accessibilityElement()
                    .accessibilityLabel("Round complete")
                    .accessibilityAddTraits(.isHeader)
                    .accessibilityFocused($headingFocused)
                ScrollViewReader { scroller in
                    ScrollView {
                        ticket(scroller)
                    }
                    .onAppear {
                        // Reference 4.4: a New best brings the comparison into view first.
                        if case .newBest? = coordinator.comparison { scroller.scrollTo("score", anchor: .center) }
                    }
                }
                actions
            }
        }
        .backPans(isEnabled: true, anywhere: false) { event in
            if event.phase == .ended, BackTransition.completes(progress: event.progress, velocity: event.velocity) { close() }
        }
        .focusable(interactions: .edit)
        .focusEffectDisabled()
        .focused($keysFocused)
        .onKeyPress(.escape, phases: .down) { _ in
            close()
            return .handled
        }
        .onAppear {
            headingFocused = true
            keysFocused = true
        }
    }

    private func ticket(_ scroller: ScrollViewProxy) -> some View {
        VStack(alignment: .leading, spacing: Tokens.Space.s16) {
            HStack(alignment: .top) {
                ForEach(Array(copy.fields.enumerated()), id: \.offset) { _, field in
                    VStack(alignment: .leading, spacing: Tokens.Space.s2) {
                        Text(field.label).typeRole(Tokens.TypeRole.fieldLabel).foregroundStyle(palette.inkMuted.color)
                        Text(field.value).typeRole(Tokens.TypeRole.fieldValue)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .accessibilityElement(children: .combine)
                }
            }
            .paperTextSize()
            ScoreBlock(copy: copy, score: result.score, comparison: coordinator.comparison).id("score")
            Perforation(axis: .horizontal)
            MissedCardsView(missed: missedCards(result.answers)) { number in
                // The opened Why row scrolls into view after 380 ms (50 with reduced motion).
                Task {
                    try? await Task.sleep(for: .milliseconds(reducedMotion ? 50 : 380))
                    withAnimation(reducedMotion ? nil : Tokens.Curve.ease.animation(Tokens.Duration.t3)) { scroller.scrollTo("missed-\(number)") }
                }
            }
        }
        .foregroundStyle(palette.ink.color)
        .padding(Tokens.Size.ticketInset)
        .background(RoundedRectangle(cornerRadius: Tokens.Radius.card).fill(palette.surfaceRaised.color))
        .tokenShadow(shadows.ticket, RoundedRectangle(cornerRadius: Tokens.Radius.card))
    }

    private var actions: some View {
        VStack(spacing: Tokens.Space.s4) {
            PillButton(title: "Play again", leading: .replay) {
                guard coordinator.resultActionsReady else { return }
                model.playAgain(coordinator.request)
            }
            QuietButton(title: "Choose another route", leading: .routeCurve) { close() }
        }
    }

    private func close() {
        guard coordinator.resultActionsReady else { return }
        Task { await model.showStart(byControl: true) }
    }
}

/// The score and the comparison with the best (ScoreBlock.tsx).
struct ScoreBlock: View {
    let copy: ResultCopy
    let score: Int
    let comparison: Comparison?
    @Environment(\.palette) private var palette

    var body: some View {
        VStack(alignment: .leading, spacing: Tokens.Space.s6) {
            Text(copy.scoreLabel).typeRole(Tokens.TypeRole.answerLabel).foregroundStyle(palette.inkMuted.color)
            HStack(alignment: .firstTextBaseline, spacing: Tokens.Space.s6) {
                Text("\(score)").typeRole(Tokens.TypeRole.score)
                if let unit = copy.unit { Text(unit).typeRole(Tokens.TypeRole.scoreUnit).foregroundStyle(palette.inkMuted.color) }
            }
            .accessibilityElement(children: .combine)
            comparisonView
        }
    }

    @ViewBuilder private var comparisonView: some View {
        switch comparison {
        case .first?:
            Text("First round on this route").typeRole(Tokens.TypeRole.emphasis)
        case .newBest(let previous)?:
            VStack(alignment: .leading, spacing: Tokens.Space.s4) {
                HStack(spacing: Tokens.Space.s6) {
                    IconView(icon: .star, size: 18)
                    Text("New best").typeRole(Tokens.TypeRole.stampResult)
                }
                .foregroundStyle(palette.correct.color)
                .padding(.horizontal, Tokens.Space.s10)
                .padding(.vertical, Tokens.Space.s4)
                .background(StampBorder(color: palette.correct.color))
                .rotationEffect(.degrees(-6))
                Text("Previous best \(copy.best(previous))").typeRole(Tokens.TypeRole.emphasis)
            }
            .accessibilityElement(children: .combine)
        case .equal(let best)?:
            VStack(alignment: .leading) {
                Text("Equals your best").typeRole(Tokens.TypeRole.emphasis)
                Text("Best \(copy.best(best))").typeRole(Tokens.TypeRole.monoData).foregroundStyle(palette.inkMuted.color)
            }
            .accessibilityElement(children: .combine)
        case .short(let best, let by)?:
            VStack(alignment: .leading) {
                Text("\(by) short of your best").typeRole(Tokens.TypeRole.emphasis)
                Text("Best \(copy.best(best))").typeRole(Tokens.TypeRole.monoData).foregroundStyle(palette.inkMuted.color)
            }
            .accessibilityElement(children: .combine)
        case nil:
            EmptyView()
        }
    }
}
```

`ios/Truthy/Truthy/Result/MissedCardsView.swift`:

```swift
import SwiftUI
import TruthyEngine

// The missed cards (MissedCards.tsx, reference 4.5): "Missed cards" and "{n} to review", one row per wrong answer with
// its number, what was said, the statement and the right answer, and a Why disclosure (chevron 220 ms, row 360 ms,
// scrolled into view after 380 ms, 50 with reduced motion) with the explanation and the source link.

struct MissedCardsView: View {
    let missed: [MissedCard]
    /// Called with a card's number when its Why opens (the result scrolls it into view).
    var onOpen: (Int) -> Void = { _ in }
    @State private var open: Set<Int> = []
    @Environment(\.palette) private var palette
    @Environment(\.resolvedTheme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reducedMotion

    var body: some View {
        VStack(alignment: .leading, spacing: Tokens.Space.s12) {
            if missed.isEmpty {
                Text("No missed cards").typeRole(Tokens.TypeRole.listStatement)
                    .accessibilityLabel("Missed cards, No missed cards")
            } else {
                HStack {
                    Text("Missed cards").typeRole(Tokens.TypeRole.emphasis).accessibilityAddTraits(.isHeader)
                    Spacer()
                    Text("\(missed.count) to review").typeRole(Tokens.TypeRole.monoData).foregroundStyle(palette.inkMuted.color)
                }
                ForEach(missed, id: \.number) { card in row(card) }
            }
        }
    }

    private func row(_ card: MissedCard) -> some View {
        let isOpen = open.contains(card.number)
        return VStack(alignment: .leading, spacing: Tokens.Space.s6) {
            HStack {
                Text("Card \(pad2(card.number))")
                Spacer()
                Text("You said \(card.given ? "True" : "False")")
            }
            .typeRole(Tokens.TypeRole.monoCaption)
            .foregroundStyle(palette.inkMuted.color)
            if let appliesTo = card.appliesTo {
                Text(appliesTo).typeRole(Tokens.TypeRole.monoData).foregroundStyle(palette.inkMuted.color).accessibilityLabel("Applies to \(appliesTo)")
            }
            CardTextView(text: card.statement, style: Tokens.TypeRole.listStatement)
            HStack {
                (Text("Answer ") + Text(card.answer ? "True" : "False").font(Tokens.TypeRole.missedAnswer.font)).typeRole(Tokens.TypeRole.listStatement)
                Spacer()
                Button {
                    let animation = Tokens.Curve.ease.animation(Tokens.Duration.t3)
                    withAnimation(reducedMotion ? nil : animation) {
                        if isOpen { open.remove(card.number) } else { open.insert(card.number) }
                    }
                    if !isOpen { onOpen(card.number) }
                } label: {
                    HStack(spacing: Tokens.Space.s4) {
                        Text("Why").typeRole(Tokens.TypeRole.sourceLink)
                        IconView(icon: .chevronDown, size: 12)
                            .rotationEffect(.degrees(isOpen ? 180 : 0))
                            .animation(reducedMotion ? nil : Tokens.Curve.ease.animation(Tokens.Duration.t2), value: isOpen)
                    }
                    .foregroundStyle(palette.answerTrue.color)
                    .frame(minHeight: Tokens.Size.touchMin)
                }
                .buttonStyle(.quiet)
                .accessibilityLabel("Why, card \(pad2(card.number))")
                .accessibilityValue(isOpen ? "expanded" : "collapsed")
            }
            if isOpen {
                HStack(alignment: .top, spacing: Tokens.Space.s10) {
                    Rectangle().fill(palette.rule.color).frame(width: Tokens.Stroke.quote)
                    VStack(alignment: .leading, spacing: Tokens.Space.s8) {
                        CardTextView(text: card.explanation, style: Tokens.TypeRole.missedExplanation)
                        if let url = URL(string: card.source.url) {
                            SourceLink(title: card.source.title) { SafariPresenter.present(url, theme: theme, palette: palette) }
                        }
                    }
                }
                // The row grows open from its top inside the clipped card (reference 5.7).
                .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .padding(Tokens.Space.s12)
        .background(RoundedRectangle(cornerRadius: Tokens.Radius.small).fill(palette.surfaceSunk.color))
        .clipped()
        .id("missed-\(card.number)")
    }
}
```

- [ ] **Step 6: Run the tests.**

```bash
DEST26='platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5'
xcodebuild test -project ios/Truthy/Truthy.xcodeproj -scheme Truthy -destination "$DEST26" 2>&1 | grep -E 'Test run with|Executed [0-9]+ tests?,|✘|TEST (SUCCEEDED|FAILED)' | tail -6
```

Expected: `Test run with 74 tests in 22 suites passed`, `Executed 17 tests, with 2 tests skipped and 0 failures` (plus the six leave and result tests, of which `testEscapeOnTheSheetKeepsPlaying` skips on the simulator, as task 12's Escape test does) and `** TEST SUCCEEDED **`.

- [ ] **Step 7: Only if `testADoubleTapOnTheXLeavesTheSheetOpen` failed: add the scrim guard.** The web ignores a scrim tap for 250 ms after the sheet opens (reference 3.10). In `LeaveSheet.swift`, add to the sheet's content, after `.modifier(SheetPaper())`:

```swift
            .interactiveDismissDisabled(!coordinator.scrimTapAccepted)
            .task {
                try? await Task.sleep(for: .milliseconds(260))
                coordinator.keepScrimGuardFresh()
            }
```

and to `RoundCoordinator` (task 11's file), next to `scrimTapAccepted`:

```swift
    /// Read again by the sheet 260 ms after it opens, so the interactive dismissal is enabled once the guard is over.
    private(set) var scrimGuardTick = 0

    func keepScrimGuardFresh() {
        scrimGuardTick += 1
    }
```

and make `scrimTapAccepted` read `scrimGuardTick` first (`_ = scrimGuardTick`) so the view updates. Run the test again; expect it to pass, and record in task 15's feel checklist (N7) that the guard was needed. When the test passed at once, skip this step and record that no guard was needed.

- [ ] **Step 8: Look at the sheet and the result by hand.** Launch with `-seed 7 -route aws-clf-c02/SEC -mode classic -screen sheet`, then `-screen result`, in both themes (`-theme light|dark`) and at the largest text size: the paper card floats with no glass or blur around it on iOS 18.4 and fills the inset sheet on iOS 26.5, with no clear or glass strip under the card; the result's route, score, comparison and missed rows match the web's layout. Differences go to task 15's review.

- [ ] **Step 9: Run the gates and commit.**

```bash
swift test --package-path ios/TruthyEngine 2>&1 | tail -1
xcodebuild test -project ios/Truthy/Truthy.xcodeproj -scheme Truthy -destination 'platform=iOS Simulator,name=iPhone 16 Pro,OS=18.4' 2>&1 | grep -E 'TEST (SUCCEEDED|FAILED)'
git add ios/Truthy/Truthy/Result ios/Truthy/Truthy/State/RoundCoordinator.swift ios/Truthy/TruthyTests/LeaveSheetLayoutTests.swift ios/Truthy/TruthyUITests/LeaveAndResultTests.swift
pnpm test
git commit -m "feat: add the iOS leave sheet and the result with the comparison and the missed cards"
git status --short
```

Expected: the engine passes as before; `** TEST SUCCEEDED **` on iOS 18.4; `pnpm test` passes; nothing from `git status --short` (`RoundCoordinator.swift` is unchanged unless step 7 ran, and `git add` of an unchanged file adds nothing).
