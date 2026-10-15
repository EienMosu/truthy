### Task 11: The app's state: `AppModel`, `StartFlowModel`, `BackTransition`, `RoundCoordinator`, the Timed ticker and the debug launch arguments

Everything the screens of tasks 12 to 14 read and drive, without a view (spec 7.2): `AppModel` swaps the two top-level screens in place, holds the theme and what the start screen shows, applies a journal left by a killed app at launch and opens at step 1 (README Review Focus line 1, the launch side); `StartFlowModel` is the start flow's step stack with its guards; `BackTransition` is the web's back motion as a pure function of progress (risk 2); `RoundCoordinator` feeds the engine events on the wall clock, holds the 250, 420 and 1000 ms guards on the monotonic clock, journals every change of the number of answers or of `isDecided`, runs Timed's 100 ms ticker in the common run loop modes, pauses Timed only in the background and records a result exactly once; `LaunchArguments` opens any screen in a known state for the reviews of task 15 (spec 7.4).

Builds on tasks 1 to 10: the engine (start-flow helpers of task 5, guards and leave rules of task 6), the data layer and the clocks of task 9, tokens and components of tasks 8 and 10.

**Files:**
- Create (app): `ios/Truthy/Truthy/State/Ticker.swift`, `State/BackTransition.swift`, `State/StartFlowModel.swift`, `State/RoundCoordinator.swift`, `State/LaunchArguments.swift`, `State/AppModel.swift`, `ios/Truthy/Truthy/App/RootView.swift`
- Create (stand-ins that tasks 12 and 13 replace whole): `ios/Truthy/Truthy/Start/StartFlowView.swift`, `ios/Truthy/Truthy/Round/RoundView.swift`
- Modify: `ios/Truthy/Truthy/App/TruthyApp.swift` (replaced: the root view and the debug gallery)
- Test: create `ios/Truthy/TruthyTests/StateTests.swift`

**Interfaces:**
- Consumes: task 9's `WallClock`, `MonotonicClock`, `DeckStore`, `FileProgressStore`, `RoundJournal`, `ThemeStore`, `JournalEntry`; task 5's `Step`, `Choice` (`StartChoice`), `pathTo`, `previousStep`, `clearFrom`, `chosenOn`, `continueTarget`, `recentDecks`, `withoutRemovedCards`, `deckOfCard`; task 6's `NEXT_ARRIVES_MS`, `RESULT_ARRIVES_MS`, `leavesSomething`, `ticketFor`; task 4's `SWIPE.settleMs`, `compareWithBest`, `bestFor`; task 3's `startRound`, `reduce`, `isDecided`, `summarise`; task 8's `Tokens` and `CubicCurve.value(at:)`.
- Produces (app target; the README's names, plus the members marked):

```swift
@MainActor final class Ticker { static let intervalMs: Double; let mode: RunLoop.Mode; init(mode: RunLoop.Mode = .common); func start(_ tick: @MainActor () -> Void); func stop() }
struct BackLayer: Equatable { var opacity, offsetY: Double }
struct BackFrame: Equatable { var oldOpacity, oldOffsetY, oldTitleOpacity: Double; var newItems: [ItemFrame]; var dashesOpacity: Double
    var topSwap: Bool; var tripOut, brandIn, footIn, footOut: BackLayer; var switchShift: Double
    var stageChange: Bool; var oldBlockOpacity, newBlockOpacity, morph: Double; var valuesTravel: Bool; var oldValueOpacity, newValueOpacity: Double }
struct BackTransition { let from: Step; let to: Step; let itemCount: Int; init(from:to:itemCount:); func frame(at p: Double, reducedMotion: Bool) -> BackFrame;
    func durationMs(reducedMotion: Bool) -> Double; static func completes(progress: Double, velocity: Double) -> Bool }
@MainActor @Observable final class StartFlowModel { let index: DeckIndex; var stack: [Step]; var choice: StartChoice; var backProgress: Double?;
    var step: Step; var previous: Step; var settled: Bool; var canGoBack: Bool; var unrolling: Bool; var focusAfterBack: String?
    func chooseArea(_:) / chooseRecent() / choosePlatform(_:) / chooseDeck(_:) / chooseRecentDeck(_:) / chooseSection(_:) / chooseMode(_:) -> Bool
    func continueTo(_ target: ContinueTarget) -> Bool; func back(to: Step) -> Bool; func escape() -> Bool
    func changePlatformOnRecentPath() -> Bool; func beginUnroll() -> Bool; var readyRoute: (route: Route, mode: Mode)?
    func openForDebug(route: Route, mode: Mode, step: Step) -> Bool }   // DEBUG only
struct RoundRequest: Equatable, Sendable, Identifiable { let id: UUID; let route: Route; let mode: Mode; let seed: UInt32 }
@MainActor @Observable final class RoundCoordinator { let request; let deck; let ticket: TicketInfo; let previousBest: Int?; var state: RoundState
    var cardShownAt: Double; var canAnswer: Bool; func answer(_ value: Bool) -> Bool; var actionReady: Bool; func next() async -> Bool
    func tick(); func startTicker(); func stopTicker(); func scenePhaseChanged(_ phase: ScenePhase)
    var xAction: XAction; func openSheet(); func keepPlaying(); var sheetOpen: Bool; var scrimTapAccepted: Bool; func leave() async
    func showResult() async; var resultActionsReady: Bool; var outcome: ApplyOutcome?; var comparison: Comparison?; var journalEntry: JournalEntry }
enum DebugScreen: String, CaseIterable { case start, round, answered, sheet, result, gallery }
struct LaunchArguments { var seed: UInt32?; var route: Route?; var mode: Mode?; var screen: DebugScreen?; var step: Step?; var theme: StoredTheme?;
    static func parse(_ arguments: [String]) -> LaunchArguments; static var current: LaunchArguments }   // -seed -route -mode -screen -step -theme
enum TopScreen: Equatable { case start; case round(RoundRequest) }
@MainActor @Observable final class AppModel { var screen: TopScreen; var theme: ResolvedTheme; var storedTheme: StoredTheme?; var systemDark: Bool
    let index, decks, store, journal, themeStore, wall, mono, arguments; var startFlow: StartFlowModel; var progress: Progress
    var recent: [RecentDeck]; var continueTarget: ContinueTarget?; var returnedFromRound: Bool
    var launched: Bool; init(bundle:directory:defaults:wall:mono:arguments:) throws; func launch() async; func loadStart() async; func switchTheme()
    func startRound(route: Route, mode: Mode); func playAgain(_ request: RoundRequest); func showStart(byControl: Bool) async
    func takeDebugScreen() -> DebugScreen? }   // the -screen argument, for the first round of the process only
```

**Rules:**

1. **Two clocks** (spec 4.4, risk 5): engine events (answers, ticks, visibility) carry `WallClock.nowMs()`; the guards and swipe samples use `MonotonicClock.nowMs()`. Nothing mixes them; the tests move each fake clock on its own.
2. **Guards** (reference 4.3): an answer needs the question phase, a closed sheet and 250 ms (`SWIPE.settleMs`) since the card appeared; Next card and See results take presses 420 ms (`NEXT_ARRIVES_MS`) after they came; the result's actions 1000 ms (`RESULT_ARRIVES_MS`) after it appeared; the sheet's scrim 250 ms after it opened. Start options, Continue and Start round wait 250 ms after a step appears; backs never wait, and every back is consumed during the unroll. The same with reduced motion.
3. **Timed** (spec 5.6): the ticker is a `Timer` added to `RunLoop.main` in `.common` modes, so it keeps firing while a scroll or a drag is tracking (a test runs the run loop in `.tracking` mode). Visibility is sent only when the scene phase becomes `.background` (hidden) and when it comes back to `.active` from there (shown); `.inactive` (Control Center, the notification shade, the app's own sheet) sends nothing.
4. **Saves** (reference 6): a round starts with load, prune of its deck, save, then the deal from the pruned history; every change of the number of answers or of `isDecided` is journalled through one serial chain of writes (a Timed minute that runs out with no answers is journalled as decided, so a launch after a kill records it); leaving runs task 6's leave rules in the store and deletes the journal; a result is recorded once through the store's `RecordedRounds` and the journal deleted.
5. **The seed** is `UInt32.random(in: .min ... .max)` (the system's secure generator), or the debug `-seed`.
6. **Launch** (spec 5.6): the journal is applied first, then every played deck is pruned against its current cards (saving only when an entry was dropped), then Recent and Continue are worked out once; until then the root shows only the sky, so the Recent card and the Continue line never pop in after the first frame (smell 5, N10); the app shows step 1 with no choices. A round is never resumed and no state is restored from the system. Back from a round loads the start screen before it shows it, and the new step 1 is created after the load, so its 250 ms settle starts when it appears.
7. **Debug arguments** are parsed in every build and read only in debug builds (`LaunchArguments.current`), so the phone's release build (task 16) has none. They are the keys plan C's extras carry (README, "Cross-platform agreements"): `-seed` (0 to 4294967295), `-route <deckId>/<sectionId>` (`ALL` for the whole deck), `-mode`, `-screen` (`start`, `round`, `answered`, `sheet`, `result`, and `gallery` for task 10's gallery), `-step` (1 to 6, with `-screen start`) and `-theme`. With `-route`, `-mode` and a round screen the app opens that round at once with the seed given; the screen applies to the first round of the process only (`takeDebugScreen`), so Play again deals an ordinary round. With `-screen start` and `-route` the start flow opens at `-step` (6 when none is given; 5 for step 4 of a deck without sections) with the route's choices up to it (the class is `-mode`, Classic when none). `-theme` stores a theme before the first frame. The `.result` screen plays Classic, Streak and Three lives to their end with True and runs the Timed minute out with one tick per second, each with a bound, so a debug launch never hangs.
8. **Stand-ins.** `StartFlowView` and `RoundScreen` are written here as stand-ins so the app builds; tasks 12 and 13 replace the two files whole.

**Review focus.** README line 1, the launch side: `LaunchTestsOfTheModel.aKilledRoundIsAppliedAndTheAppOpensAtStepOne` seeds a journal for each case (no answers and undecided; undecided with answers; decided and not recorded), constructs `AppModel`, launches it, and checks step 1 with no choices, the journal deleted and the stored progress. README line 5 rests on the guards tested here (`answersWait250AndNextWaits420OnTheMonotonicClock`, `resultActionsWait1000AndTheResultIsRecordedOnce`); tasks 13 and 14 test them with taps.

**Steps:**

- [ ] **Step 1: Check the starting point.**

```bash
git status --short
xcodebuild test -project ios/Truthy/Truthy.xcodeproj -scheme Truthy -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5' -only-testing:TruthyTests 2>&1 | grep -E 'Test run with|TEST (SUCCEEDED|FAILED)' | tail -2
```

Expected: nothing; `Test run with 30 tests in 12 suites passed` and `** TEST SUCCEEDED **`.

- [ ] **Step 2: Write the tests.**

`ios/Truthy/TruthyTests/StateTests.swift`:

```swift
import Foundation
import SwiftUI
import Testing
import TruthyEngine
@testable import Truthy

// Spec 7.2 and risk 2: the back motion at fixed progress, the release rule, the start flow's stack and guards. The
// eased values are CSS cubic-bezier values at the fractions the frames fall on (the same as plan C's test).
@Suite struct BackTransitionTests {
    private let back = BackTransition(from: 3, to: 2, itemCount: 4)
    private let easeOutAt85of140 = 0.791763
    private let easeAt145of240 = 0.962277
    private let easeAtHalf = 0.929579
    private let easeAt70of240 = 0.783114
    private let easeAtQuarter = 0.727373
    private let easeAtThreeQuarters = 0.987468
    private let easeAt90of220 = 0.884209
    private let easeOutAt575of100 = 0.761353
    private let easeOutAt25of140 = 0.277632

    private func near(_ a: Double, _ b: Double) -> Bool { abs(a - b) < 0.01 }
    private func layer(_ l: BackLayer, _ opacity: Double, _ offsetY: Double) -> Bool { near(l.opacity, opacity) && near(l.offsetY, offsetY) }
    private func item(_ i: BackFrame.ItemFrame, _ opacity: Double, _ offsetY: Double) -> Bool { near(i.opacity, opacity) && near(i.offsetY, offsetY) }

    @Test func theDurationCoversTheLastItemAndThePass() {
        #expect(BackTransition(from: 2, to: 1, itemCount: 1).durationMs(reducedMotion: false) == 360)
        #expect(BackTransition(from: 3, to: 2, itemCount: 2).durationMs(reducedMotion: false) == 375)
        #expect(back.durationMs(reducedMotion: false) == 425)
        #expect(back.durationMs(reducedMotion: true) == 230)
    }

    @Test func progressZeroIsTheStepBeingLeftAtRest() {
        for reduced in [false, true] {
            let start = back.frame(at: 0, reducedMotion: reduced)
            #expect(start.oldOpacity == 1 && start.oldOffsetY == 0 && start.oldTitleOpacity == 1)
            #expect(start.newItems.allSatisfy { $0.opacity == 0 })
            #expect(start.dashesOpacity == 0)
        }
        #expect(back.frame(at: 0, reducedMotion: false).newItems.allSatisfy { $0.offsetY == -24 })
    }

    @Test func progressOneIsTheNewStepAtRest() {
        for reduced in [false, true] {
            let end = BackTransition(from: 6, to: 1, itemCount: 5).frame(at: 1, reducedMotion: reduced)
            let sink = reduced ? 0.0 : 10
            let shift = reduced ? 0.0 : 12
            #expect(end.oldOpacity == 0 && end.oldOffsetY == sink)
            #expect(end.newItems.allSatisfy { item($0, 1, 0) })
            #expect(layer(end.tripOut, 0, shift) && layer(end.footOut, 0, shift), "reduced \(reduced)")
            #expect(layer(end.brandIn, 1, 0) && layer(end.footIn, 1, 0), "reduced \(reduced)")
            #expect(end.switchShift == 1 && end.dashesOpacity == 1)
        }
    }

    @Test func theBackMotionFollowsTheWebTimeline() {
        let early = back.frame(at: 0.2, reducedMotion: false)
        #expect(near(early.oldOpacity, 1 - easeOutAt85of140) && near(early.oldOffsetY, 10 * easeOutAt85of140))
        #expect(early.oldTitleOpacity == 0, "the title has faded by 80")
        #expect(item(early.newItems[0], 0, -24))
        let later = back.frame(at: 0.6, reducedMotion: false)
        #expect(later.oldOpacity == 0 && later.oldOffsetY == 10)
        #expect(item(later.newItems[0], easeAt145of240, -24 * (1 - easeAt145of240)))
        #expect(item(later.newItems[1], easeAtHalf, -24 * (1 - easeAtHalf)))
        #expect(item(later.newItems[3], easeAt70of240, -24 * (1 - easeAt70of240)))
        #expect(near(later.dashesOpacity, easeAtQuarter))
        #expect(!later.stageChange && !later.topSwap)
        for p in [0.25, 0.5, 0.75] {
            let frame = back.frame(at: p, reducedMotion: false)
            #expect(zip(frame.newItems, frame.newItems.dropFirst()).allSatisfy { $0.opacity >= $1.opacity }, "p \(p)")
        }
    }

    @Test func backToStepOneSwapsTheTopAndFootZonesAndMovesTheSwitch() {
        let toOne = BackTransition(from: 2, to: 1, itemCount: 1)
        let start = toOne.frame(at: 0, reducedMotion: false)
        #expect(start.topSwap && layer(start.tripOut, 1, 0) && layer(start.brandIn, 0, -12) && layer(start.footIn, 0, 12))
        #expect(start.switchShift == 0)
        let mid = toOne.frame(at: 0.5, reducedMotion: false)
        #expect(!mid.stageChange)
        #expect(layer(mid.tripOut, 0, 12))
        #expect(layer(mid.brandIn, easeAtQuarter, -12 * (1 - easeAtQuarter)))
        #expect(layer(mid.footIn, easeAtQuarter, 12 * (1 - easeAtQuarter)))
        #expect(near(mid.switchShift, easeAtThreeQuarters))
        let end = toOne.frame(at: 1, reducedMotion: false)
        #expect(layer(end.tripOut, 0, 12) && layer(end.brandIn, 1, 0) && end.switchShift == 1)
    }

    @Test func leavingTheReadyPassMorphsThePassAndDropsStartRound() {
        let fromSix = BackTransition(from: 6, to: 5, itemCount: 1)
        let mid = fromSix.frame(at: 0.5, reducedMotion: false)
        #expect(mid.stageChange && mid.valuesTravel)
        #expect(near(mid.morph, easeAtHalf))
        #expect(mid.oldBlockOpacity == 0 && near(mid.newBlockOpacity, easeAt90of220))
        #expect(near(mid.oldValueOpacity, 1.0 / 6) && near(mid.newValueOpacity, 1.0 / 6))
        #expect(layer(fromSix.frame(at: 55.0 / 360, reducedMotion: false).footOut, 1 - easeAtHalf, 12 * easeAtHalf))
        #expect(!BackTransition(from: 5, to: 4, itemCount: 1).frame(at: 0.5, reducedMotion: false).stageChange)
    }

    @Test func reducedMotionIsTheCrossFadeMappedOntoProgress() {
        let early = back.frame(at: 0.25, reducedMotion: true)
        #expect(near(early.oldOpacity, 1 - easeOutAt575of100) && early.oldOffsetY == 0 && early.oldTitleOpacity == 1)
        #expect(early.newItems.allSatisfy { $0.opacity == 0 && $0.offsetY == 0 })
        #expect(early.dashesOpacity == 0)
        let mid = back.frame(at: 0.5, reducedMotion: true)
        #expect(mid.oldOpacity == 0)
        #expect(mid.newItems.allSatisfy { near($0.opacity, easeOutAt25of140) && $0.offsetY == 0 })
        #expect(mid.dashesOpacity == 1 && !mid.valuesTravel)
        // The parts the web switches at once switch when the old step has faded out, at t = 100 of 230.
        let toOne = BackTransition(from: 2, to: 1, itemCount: 1)
        #expect(toOne.frame(at: 99.0 / 230, reducedMotion: true).switchShift == 0)
        #expect(toOne.frame(at: 101.0 / 230, reducedMotion: true).switchShift == 1)
        #expect(BackTransition(from: 6, to: 5, itemCount: 1).frame(at: 101.0 / 230, reducedMotion: true).morph == 1)
        for p in [0.0, 0.25, 0.5, 0.75, 1.0] { #expect(back.frame(at: p, reducedMotion: true).oldOffsetY == 0) }
    }

    @Test func progressIsClamped() {
        let one = BackTransition(from: 4, to: 3, itemCount: 1)
        #expect(one.frame(at: -0.5, reducedMotion: false) == one.frame(at: 0, reducedMotion: false))
        #expect(one.frame(at: 1.5, reducedMotion: false) == one.frame(at: 1, reducedMotion: false))
        #expect(one.frame(at: .nan, reducedMotion: false) == one.frame(at: 0, reducedMotion: false))
    }

    @Test func releaseCompletesPastHalfOrOnAFastFlingAndCancelsOnAFlingBack() {
        #expect(BackTransition.completes(progress: 0.51, velocity: 0))
        #expect(!BackTransition.completes(progress: 0.5, velocity: 0))
        #expect(BackTransition.completes(progress: 0.1, velocity: 501))
        #expect(!BackTransition.completes(progress: 0.1, velocity: 500))
        #expect(!BackTransition.completes(progress: 0.9, velocity: -501))
        #expect(BackTransition.completes(progress: 0.9, velocity: -500))
    }
}

@MainActor
@Suite struct StartFlowModelTests {
    private let clock = FakeClock()
    private func model() throws -> StartFlowModel {
        StartFlowModel(index: try DeckStore(bundle: .main).index(), clock: clock)
    }

    @Test func choicesWaitForTheSettleTimeAndPushThePath() throws {
        let flow = try model()
        #expect(!flow.chooseArea("cloud"))
        clock.advance(250)
        #expect(flow.chooseArea("cloud") && flow.stack == [1, 2])
        clock.advance(249)
        #expect(!flow.choosePlatform("aws"))
        clock.advance(1)
        #expect(flow.choosePlatform("aws"))
        clock.advance(250)
        #expect(flow.chooseDeck("aws-clf-c02") && flow.step == 4)
        clock.advance(250)
        #expect(flow.chooseSection("SEC") && flow.step == 5)
        clock.advance(250)
        #expect(flow.chooseMode(.classic) && flow.stack == [1, 2, 3, 4, 5, 6])
        #expect(flow.readyRoute?.route == Route(deckId: "aws-clf-c02", sectionId: "SEC"))
    }

    @Test func aDeckWithoutSectionsSkipsTheSectionStep() throws {
        let flow = try model()
        clock.advance(250)
        flow.chooseArea("cloud")
        clock.advance(250)
        flow.choosePlatform("gcp")
        clock.advance(250)
        #expect(flow.chooseDeck("gcp-cdl") && flow.step == 5 && flow.choice.sectionId == WHOLE_DECK)
        #expect(flow.previous == 3)
    }

    @Test func aBackClearsTheChoicesOnlyWhenItCompletes() throws {
        let flow = try model()
        clock.advance(250)
        flow.chooseArea("cloud")
        clock.advance(250)
        flow.choosePlatform("aws")
        flow.backProgress = 0.4
        flow.backProgress = nil
        #expect(flow.step == 3 && flow.choice.platformId == "aws", "a cancelled gesture changes nothing")
        #expect(flow.back(to: 2))
        #expect(flow.stack == [1, 2] && flow.choice.platformId == nil && flow.choice.areaId == "cloud")
        #expect(flow.focusAfterBack == "aws")
    }

    @Test func escapeGoesBackOneStepAndIsConsumedOnStepOne() throws {
        let flow = try model()
        #expect(flow.escape() && flow.step == 1)
        clock.advance(250)
        flow.chooseArea("cloud")
        #expect(flow.escape() && flow.step == 1 && flow.choice == StartChoice())
    }

    @Test func continuePushesTheWholePathAndTheUnrollConsumesBacks() throws {
        let flow = try model()
        let index = try DeckStore(bundle: .main).index()
        let progress = TruthyEngine.Progress(version: 1, cards: [:], records: [:],
                                last: LastRound(route: Route(deckId: "aws-clf-c02", sectionId: "SEC"), mode: .streak, score: 3, total: 4))
        let target = try #require(continueTarget(index, progress))
        clock.advance(250)
        #expect(flow.continueTo(target) && flow.stack == [1, 2, 3, 4, 5, 6])
        clock.advance(250)
        #expect(flow.beginUnroll())
        #expect(!flow.back(to: 5) && flow.step == 6)
        #expect(!flow.canGoBack)
    }

    @Test func theRecentPathSkipsThePlatformStepAndChangePlatformRewritesTheStack() throws {
        let flow = try model()
        let index = try DeckStore(bundle: .main).index()
        let recent = recentDecks(index, TruthyEngine.Progress(version: 1, cards: ["aws-clf-c02-x": CardHistory(seen: 1, lastCorrect: true, lastSeenAt: 1)], records: [:], last: nil))
        clock.advance(250)
        #expect(flow.chooseRecent() && flow.stack == [1, 3])
        clock.advance(250)
        #expect(flow.chooseRecentDeck(try #require(recent.first)) && flow.step == 4)
        #expect(flow.previous == 3)
        #expect(flow.changePlatformOnRecentPath() && flow.stack == [1, 2, 3] && !flow.recent)
        #expect(flow.choice == StartChoice(areaId: "cloud", platformId: "aws") && flow.step == 3)
        #expect(flow.focusAfterBack == "aws-clf-c02")
    }
}

@MainActor
@Suite struct RoundCoordinatorTests {
    private let wall = FakeClock(1_790_000_000_000)
    private let mono = FakeClock(1_000)

    private func coordinator(_ mode: Mode, directory: URL = Scratch.directory()) async throws -> RoundCoordinator {
        let decks = DeckStore(bundle: .main)
        let index = try decks.index()
        let route = Route(deckId: "aws-clf-c02", sectionId: "SEC")
        return try RoundCoordinator(request: RoundRequest(route: route, mode: mode, seed: 7), deck: try await decks.deck("aws-clf-c02"),
                                    found: try #require(findRoute(index, route)), progress: emptyProgress(),
                                    store: FileProgressStore(directory: directory), journal: RoundJournal(directory: directory),
                                    wall: wall, mono: mono)
    }

    @Test func answersWait250AndNextWaits420OnTheMonotonicClock() async throws {
        let round = try await coordinator(.classic)
        #expect(!round.answer(true))
        mono.advance(250)
        #expect(round.answer(true))
        #expect(!round.answer(false), "one answer per card")
        mono.advance(419)
        #expect(!(await round.next()))
        mono.advance(1)
        #expect(await round.next())
        #expect(round.state.index == 1 && round.state.phase == .question)
        #expect(!round.answer(true), "the next card settles again")
    }

    @Test func theWallClockStampsTheAnswers() async throws {
        let round = try await coordinator(.classic)
        mono.advance(250)
        wall.advance(1234)
        round.answer(true)
        #expect(round.state.answers.first?.at == 1_790_000_001_234)
    }

    @Test func noAnswerWhileTheSheetIsOpen() async throws {
        let round = try await coordinator(.classic)
        mono.advance(250)
        round.answer(true)
        round.openSheet()
        #expect(!round.scrimTapAccepted, "the scrim ignores taps for 250 ms")
        mono.advance(500)
        #expect(round.scrimTapAccepted)
        #expect(!(await round.next()))
        round.keepPlaying()
        #expect(await round.next())
    }

    @Test func timedPausesOnlyInTheBackground() async throws {
        let round = try await coordinator(.timed)
        round.tick()
        wall.advance(1000)
        round.tick()
        let before = try #require(round.state.clock).remainingMs
        round.scenePhaseChanged(.inactive)
        wall.advance(1000)
        round.tick()
        #expect(try #require(round.state.clock).remainingMs == before - 1000, "inactive (Control Center, the sheet) keeps counting")
        round.scenePhaseChanged(.background)
        #expect(try #require(round.state.clock).hidden)
        wall.advance(5000)
        round.tick()
        round.scenePhaseChanged(.inactive)
        round.scenePhaseChanged(.active)
        #expect(try #require(round.state.clock).hidden == false)
        #expect(try #require(round.state.clock).remainingMs == before - 1000, "nothing counted while away")
    }

    @Test func theTickerKeepsFiringWhileAScrollIsTracking() {
        let ticker = Ticker()
        var ticks = 0
        ticker.start { ticks += 1 }
        RunLoop.main.run(mode: .tracking, before: Date().addingTimeInterval(0.35))
        ticker.stop()
        #expect(ticks >= 2, "a timer in the common modes fires in the tracking mode")
        #expect(ticker.mode == .common)
    }

    @Test func everyAnswerIsJournalledAndARecordedRoundDeletesTheJournal() async throws {
        let directory = Scratch.directory()
        let round = try await coordinator(.streak, directory: directory)
        let journal = RoundJournal(directory: directory)
        mono.advance(250)
        round.answer(true)
        await round.journalSettled()
        #expect(await journal.pending()?.answers.count == 1)
        var guardRounds = 0
        while !round.decided && guardRounds < 30 {
            guardRounds += 1
            mono.advance(420)
            _ = await round.next()
            mono.advance(250)
            round.answer(!(round.card?.answer ?? true))
        }
        mono.advance(420)
        #expect(await round.next())
        #expect(round.finished && round.outcome != nil)
        #expect(await journal.pending() == nil)
        let stored = await FileProgressStore(directory: directory).load()
        #expect(stored.records[recordKey(round.request.route, .streak)] != nil)
    }

    @Test func resultActionsWait1000AndTheResultIsRecordedOnce() async throws {
        let directory = Scratch.directory()
        let round = try await coordinator(.streak, directory: directory)
        mono.advance(250)
        round.answer(!(round.card?.answer ?? true))
        mono.advance(420)
        await round.next()
        #expect(round.finished)
        #expect(!round.resultActionsReady)
        mono.advance(999)
        #expect(!round.resultActionsReady)
        mono.advance(1)
        #expect(round.resultActionsReady)
        await round.showResult()
        let first = round.outcome
        await round.showResult()
        #expect(round.outcome == first)
    }

    @Test func theDebugResultEndsATimedRoundToo() async throws {
        let round = try await coordinator(.timed)
        await round.applyDebug(.result)
        #expect(round.finished && round.outcome != nil)
    }

    @Test func theXLeavesAtOnceWithoutAnswersAndAsksWithThem() async throws {
        let round = try await coordinator(.classic)
        #expect(round.xAction == .leaveNow)
        mono.advance(250)
        round.answer(true)
        #expect(round.xAction == .openSheet)
    }
}

@MainActor
@Suite struct LaunchTestsOfTheModel {
    // README Review Focus line 1, the launch half: a journal of each leave case is applied and deleted, and the app
    // opens at step 1 with no choices.
    private let route = Route(deckId: "aws-clf-c02", sectionId: WHOLE_DECK)

    private func launch(with entry: JournalEntry?) async throws -> (model: AppModel, directory: URL) {
        let directory = Scratch.directory()
        if let entry { await RoundJournal(directory: directory).record(entry) }
        let model = try AppModel(bundle: .main, directory: directory, defaults: Scratch.defaults(), wall: FakeClock(), mono: FakeClock(),
                                 arguments: LaunchArguments())
        await model.launch()
        return (model, directory)
    }

    private func entry(answers: Int, decided: Bool) async throws -> JournalEntry {
        let deck = try await DeckStore(bundle: .main).deck("aws-clf-c02")
        return JournalEntry(route: route, mode: .streak, seed: 1, roundId: "r",
                            answers: deck.cards.prefix(answers).enumerated().map { i, card in
                                JournalAnswer(cardId: card.id, given: i == answers - 1 && decided ? !card.answer : card.answer,
                                              correct: !(i == answers - 1 && decided), at: Double(1_790_000_000_000 + i))
                            },
                            decided: decided, recorded: false)
    }

    @Test(arguments: [(0, false), (2, false), (3, true)])
    func aKilledRoundIsAppliedAndTheAppOpensAtStepOne(answers: Int, decided: Bool) async throws {
        let (model, directory) = try await launch(with: try await entry(answers: answers, decided: decided))
        #expect(model.screen == .start)
        #expect(model.startFlow.step == 1 && model.startFlow.choice == StartChoice())
        #expect(await RoundJournal(directory: directory).pending() == nil)
        let stored = await model.store.load()
        switch (answers, decided) {
        case (0, false):
            #expect(stored == emptyProgress())
        case (_, false):
            #expect(stored.cards.count == answers && stored.records.isEmpty)
            #expect(stored.last?.score == nil && stored.last?.route == route)
        default:
            #expect(stored.records[recordKey(route, .streak)] == answers - 1)
            #expect(stored.last?.score == answers - 1)
        }
    }

    @Test func theStartScreenPrunesRemovedCardsAndSavesOnlyThen() async throws {
        let directory = Scratch.directory()
        let store = FileProgressStore(directory: directory)
        let kept = try await DeckStore(bundle: .main).deck("aws-clf-c02").cards[0].id
        await store.save(TruthyEngine.Progress(version: 1, cards: [kept: CardHistory(seen: 1, lastCorrect: true, lastSeenAt: 1),
                                                      "aws-clf-c02-removed": CardHistory(seen: 1, lastCorrect: true, lastSeenAt: 1)],
                                  records: [:], last: nil))
        let model = try AppModel(bundle: .main, directory: directory, defaults: Scratch.defaults(), wall: FakeClock(), mono: FakeClock(), arguments: LaunchArguments())
        await model.launch()
        #expect(Set((await store.load()).cards.keys) == [kept])
        #expect(model.recent.map(\.deck.id) == ["aws-clf-c02"])
    }

    @Test func aTimedMinuteThatRanOutWithNoAnswersIsJournalledAsDecidedAndRecordedAtLaunch() async throws {
        let directory = Scratch.directory()
        let wall = FakeClock(1_790_000_000_000)
        let decks = DeckStore(bundle: .main)
        let sec = Route(deckId: "aws-clf-c02", sectionId: "SEC")
        let round = try RoundCoordinator(request: RoundRequest(route: sec, mode: .timed, seed: 7), deck: try await decks.deck("aws-clf-c02"),
                                         found: try #require(findRoute(try decks.index(), sec)), progress: emptyProgress(),
                                         store: FileProgressStore(directory: directory), journal: RoundJournal(directory: directory),
                                         wall: wall, mono: FakeClock(1_000))
        round.tick()
        for _ in 0..<61 {
            wall.advance(1000)
            round.tick()
        }
        #expect(round.decided && round.state.answers.isEmpty)
        await round.journalSettled()
        let pending = try #require(await RoundJournal(directory: directory).pending())
        #expect(pending.decided && pending.answers.isEmpty)
        let model = try AppModel(bundle: .main, directory: directory, defaults: Scratch.defaults(), wall: FakeClock(), mono: FakeClock(),
                                 arguments: LaunchArguments())
        await model.launch()
        #expect(await model.store.load().records[recordKey(sec, .timed)] == 0)
        #expect(await RoundJournal(directory: directory).pending() == nil)
    }

    @Test func aDebugStartStepOpensWithTheRouteChoices() async throws {
        let sec = Route(deckId: "aws-clf-c02", sectionId: "SEC")
        func opened(_ step: Step?) async throws -> StartFlowModel {
            let model = try AppModel(bundle: .main, directory: Scratch.directory(), defaults: Scratch.defaults(), wall: FakeClock(),
                                     mono: FakeClock(), arguments: LaunchArguments(route: sec, screen: .start, step: step))
            await model.launch()
            #expect(model.screen == .start)
            return model.startFlow
        }
        let four = try await opened(4)
        #expect(four.stack == [1, 2, 3, 4] && four.choice == StartChoice(areaId: "cloud", platformId: "aws", deckId: "aws-clf-c02"))
        let ready = try await opened(nil)
        #expect(ready.step == 6 && ready.choice.mode == .classic && ready.choice.sectionId == "SEC")
    }

    @Test func theDebugScreenAppliesToTheFirstRoundOnly() throws {
        let model = try AppModel(bundle: .main, directory: Scratch.directory(), defaults: Scratch.defaults(), wall: FakeClock(), mono: FakeClock(),
                                 arguments: LaunchArguments(route: Route(deckId: "aws-clf-c02", sectionId: "SEC"), mode: .classic, screen: .result))
        #expect(model.takeDebugScreen() == .result)
        #expect(model.takeDebugScreen() == nil, "Play again deals an ordinary round")
    }
}

@Suite struct LaunchArgumentsTests {
    @Test func readsEveryDebugArgument() {
        let parsed = LaunchArguments.parse(["Truthy", "-seed", "7", "-route", "aws-clf-c02/SEC", "-mode", "timed", "-screen", "sheet", "-theme", "dark"])
        #expect(parsed == LaunchArguments(seed: 7, route: Route(deckId: "aws-clf-c02", sectionId: "SEC"), mode: .timed, screen: .sheet, theme: .dark))
        #expect(LaunchArguments.parse(["Truthy", "-screen", "start", "-step", "4"]) == LaunchArguments(screen: .start, step: 4))
    }

    @Test func ignoresWhatItCannotRead() {
        let parsed = LaunchArguments.parse(["Truthy", "-seed", "-1", "-route", "nosection", "-mode", "blitz", "-screen", "x", "-step", "9", "-theme", "auto"])
        #expect(parsed == LaunchArguments())
        #expect(LaunchArguments.parse(["Truthy", "-seed", "4294967295"]).seed == UInt32.max)
        #expect(DebugScreen.allCases.map(\.rawValue) == ["start", "round", "answered", "sheet", "result", "gallery"])
    }
}
```

- [ ] **Step 3: Run them and see them fail.**

```bash
DEST26='platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5'
xcodebuild build-for-testing -project ios/Truthy/Truthy.xcodeproj -scheme Truthy -destination "$DEST26" 2>&1 | grep -E 'error:' | head -4
```

Expected: errors such as `cannot find 'BackTransition' in scope`, `cannot find 'StartFlowModel' in scope`, `cannot find 'RoundCoordinator' in scope` and `cannot find 'AppModel' in scope`.

- [ ] **Step 4: Write the ticker and the back motion.**

`ios/Truthy/Truthy/State/Ticker.swift`:

```swift
import Foundation

// Timed's 100 ms ticker (reference 7.3): a Timer in the common run loop modes, so it keeps firing while a scroll or a
// drag is tracking (a default-mode timer pauses then, and each tick may count at most one second, so the clock would
// lose time).

@MainActor
final class Ticker {
    static let intervalMs: Double = 100
    private var timer: Timer?
    let mode: RunLoop.Mode

    init(mode: RunLoop.Mode = .common) {
        self.mode = mode
    }

    var isRunning: Bool { timer != nil }

    func start(_ tick: @escaping @MainActor () -> Void) {
        stop()
        let timer = Timer(timeInterval: Self.intervalMs / 1000, repeats: true) { _ in
            MainActor.assumeIsolated { tick() }
        }
        RunLoop.main.add(timer, forMode: mode)
        self.timer = timer
    }

    func stop() {
        timer?.invalidate()
        timer = nil
    }
}
```

`ios/Truthy/Truthy/State/BackTransition.swift`:

```swift
import Foundation
import TruthyEngine

// The web's back motion of the start flow (reference 5.7 "Start: step forward and back", dir = -1; StartFlow.tsx:230-267,
// 815-822, FillInPass.tsx:131-132, 379-385, passValueTravel.ts:104-113) written as a function of progress p from 0 to 1,
// so a finger can drive it (spec 5.1, risk 2). Every way back plays it: the gestures, the Back pill, a pass field,
// Escape, "Change platform". Time is p times durationMs, linear; each part runs its own easing inside its window and is
// exactly at rest outside it (plan C task 11 rule 4 is the same motion).
//   Full motion: the old panel sinks 10 and fades over 140 (ease-out), its title over 80; the new step's items come in
//   from 24 above over 240 (ease), the first after 110 and each next 25 later. Back to step 1: the pass and the Back pill
//   leave (+12 over 110), the logo (from -12) and the continue line (from +12) come in over 240 after 120, and the theme
//   switch moves to the logo row over 240. From step 6: Start round leaves (+12 over 110). The cleared pass fields
//   return to dashes over 140 after 220. A change of pass stage: the old block fades over 120 (ease-out), the new one
//   over 220 after 90, the paper and the band morph over 360, the old value copy is gone by 60 percent and the new one
//   comes in from 40 percent (linear).
//   Reduced motion, 230 = 90 + 140 ms: nothing moves; what leaves fades over 100, what comes fades in over 140 after 90
//   (ease-out, the web's default opacity easing); the parts the web switches at once (the dashes, the theme switch, the
//   pass morph) switch at t = 100, so p = 0 is still the old step at rest. No value copy travels.

/// A layer's opacity and vertical offset in points (positive is down).
struct BackLayer: Equatable, Sendable {
    var opacity: Double
    var offsetY: Double
}

struct BackFrame: Equatable, Sendable {
    /// The step being left: it fades and sinks.
    var oldOpacity: Double
    var oldOffsetY: Double
    /// The old title's own faster fade, applied on top of the panel's (1 under reduced motion).
    var oldTitleOpacity: Double
    /// Offset and opacity of the new step's item i (0 is the title).
    var newItems: [ItemFrame]
    /// The dashes of the pass fields this back clears.
    var dashesOpacity: Double
    /// Back to step 1: the pass and the Back pill leave (tripOut), the logo (brandIn) and the continue line (footIn)
    /// come in, and the theme switch moves to the logo row (switchShift, 0 to 1).
    var topSwap: Bool
    var tripOut: BackLayer
    var brandIn: BackLayer
    var footIn: BackLayer
    var switchShift: Double
    /// Start round leaving, on a back from step 6.
    var footOut: BackLayer
    /// The pass changes stage (destination for steps 2 and 3, route for 4 and 5, ready for 6) and stays on screen.
    var stageChange: Bool
    var oldBlockOpacity: Double
    var newBlockOpacity: Double
    /// The paper's and the band's height, from the old stage (0) to the new one (1).
    var morph: Double
    /// Whether the values travel as two cross-fading copies; under reduced motion the blocks carry them.
    var valuesTravel: Bool
    var oldValueOpacity: Double
    var newValueOpacity: Double

    struct ItemFrame: Equatable, Sendable {
        var offsetY: Double
        var opacity: Double
    }
}

struct BackTransition: Equatable, Sendable {
    let from: Step
    let to: Step
    /// The new step's title plus its rendered options. No default: every caller passes it (at least 1, the title).
    let itemCount: Int

    init(from: Step, to: Step, itemCount: Int) {
        self.from = from
        self.to = to
        self.itemCount = max(1, itemCount)
    }

    private static func ms(_ seconds: Double) -> Double { (seconds * 1000).rounded() }

    /// The length of the whole motion in milliseconds: max(360, 110 + 25 (itemCount - 1) + 240), or 230 reduced.
    func durationMs(reducedMotion: Bool) -> Double {
        if reducedMotion { return 90 + Self.ms(Tokens.Duration.reducedIn) }
        let lastItem = Self.ms(Tokens.Duration.stepEnterDelay) + Double(itemCount - 1) * Self.ms(Tokens.Duration.stepStagger)
            + Self.ms(Tokens.Duration.stepEnter)
        return max(Self.ms(Tokens.Duration.t3), lastItem)
    }

    func frame(at p: Double, reducedMotion reduced: Bool) -> BackFrame {
        let progress = p.isNaN ? 0 : min(1, max(0, p))
        let t = progress * durationMs(reducedMotion: reduced)
        let ms = Self.ms
        func window(_ start: Double, _ length: Double, _ curve: CubicCurve?) -> Double {
            let f = (t - start) / length
            if f <= 0 { return 0 }
            if f >= 1 { return 1 }
            return curve?.value(at: f) ?? f
        }
        let reducedOut = window(0, ms(Tokens.Duration.reducedOut), Tokens.Curve.easeOut)
        let reducedIn = window(90, ms(Tokens.Duration.reducedIn), Tokens.Curve.easeOut)
        let snap: Double = t >= ms(Tokens.Duration.reducedOut) ? 1 : 0
        let topSwap = to == 1
        func zoneOut() -> BackLayer {
            if reduced { return BackLayer(opacity: 1 - reducedOut, offsetY: 0) }
            let f = window(0, ms(Tokens.Duration.topExit), Tokens.Curve.ease)
            return BackLayer(opacity: 1 - f, offsetY: 12 * f)
        }
        func zoneIn(_ from: Double) -> BackLayer {
            if reduced { return BackLayer(opacity: reducedIn, offsetY: 0) }
            let f = window(ms(Tokens.Duration.topEnterDelay), ms(Tokens.Duration.stepEnter), Tokens.Curve.ease)
            return BackLayer(opacity: f, offsetY: from * (1 - f))
        }
        func stage(_ step: Step) -> Int { step <= 1 ? 0 : step <= 3 ? 1 : step <= 5 ? 2 : 3 }
        let old = reduced ? 0 : window(0, ms(Tokens.Duration.stepExit), Tokens.Curve.easeOut)
        let items = (0..<itemCount).map { i -> BackFrame.ItemFrame in
            if reduced { return .init(offsetY: 0, opacity: reducedIn) }
            let f = window(ms(Tokens.Duration.stepEnterDelay) + Double(i) * ms(Tokens.Duration.stepStagger), ms(Tokens.Duration.stepEnter),
                           Tokens.Curve.ease)
            return .init(offsetY: -24 * (1 - f), opacity: f)
        }
        let t3 = ms(Tokens.Duration.t3)
        return BackFrame(
            oldOpacity: reduced ? 1 - reducedOut : 1 - old,
            oldOffsetY: 10 * old,
            oldTitleOpacity: reduced ? 1 : 1 - window(0, ms(Tokens.Duration.stepExitTitle), Tokens.Curve.easeOut),
            newItems: items,
            dashesOpacity: reduced ? snap : window(t3 - ms(Tokens.Duration.dashIn), ms(Tokens.Duration.dashIn), Tokens.Curve.ease),
            topSwap: topSwap,
            tripOut: zoneOut(),
            brandIn: zoneIn(-12),
            footIn: zoneIn(12),
            switchShift: !topSwap ? 0 : reduced ? snap : window(0, ms(Tokens.Duration.stepEnter), Tokens.Curve.ease),
            footOut: zoneOut(),
            stageChange: !topSwap && stage(from) != stage(to),
            oldBlockOpacity: 1 - (reduced ? reducedOut : window(0, ms(Tokens.Duration.t1), Tokens.Curve.easeOut)),
            newBlockOpacity: reduced ? reducedIn : window(90, ms(Tokens.Duration.t2), Tokens.Curve.ease),
            morph: reduced ? snap : window(0, t3, Tokens.Curve.ease),
            valuesTravel: !reduced,
            oldValueOpacity: reduced ? 0 : 1 - window(0, t3 * 0.6, nil),
            newValueOpacity: reduced ? 1 : window(t3 * 0.4, t3 * 0.6, nil))
    }

    /// The release rule of the back gesture (spec 5.1): a fling towards the leading edge above 500 points a second
    /// cancels; one towards the trailing edge above 500, or a progress above one half, completes.
    static func completes(progress: Double, velocity: Double) -> Bool {
        if velocity < -500 { return false }
        return velocity > 500 || progress > 0.5
    }
}
```

- [ ] **Step 5: Write the start flow's model.**

`ios/Truthy/Truthy/State/StartFlowModel.swift`:

```swift
import Foundation
import Observation
import TruthyEngine

// The start flow's state (spec 5.1, reference 4.2): one screen with a step stack, never a navigation push. Forward
// choices push the next step of the path; every way back goes through back(to:), which clears the choices made on
// and after the target only when the back completes (a cancelled gesture changes nothing). The guards of reference
// 4.3 are here: options, Continue and Start round wait 250 ms after a step appears; backs never wait, and every back
// is consumed while the paper unrolls.

@MainActor @Observable
final class StartFlowModel {
    let index: DeckIndex
    private(set) var stack: [Step] = [1]
    private(set) var choice = StartChoice()
    /// The progress of a back that is running (a gesture or a played back motion), nil when none runs.
    var backProgress: Double?
    /// The card that takes focus after a back (reference 4.4): its id, or RECENT.
    private(set) var focusAfterBack: String?
    private(set) var unrolling = false
    private(set) var stepShownAt: Double
    private let clock: any MonotonicClock

    init(index: DeckIndex, clock: any MonotonicClock) {
        self.index = index
        self.clock = clock
        stepShownAt = clock.nowMs()
    }

    var step: Step { stack.last ?? 1 }
    var recent: Bool { choice.via == RECENT }

    var area: IndexArea? { choice.areaId.flatMap { id in index.areas.first { $0.id == id } } }
    var platform: IndexPlatform? { choice.platformId.flatMap { id in area?.platforms.first { $0.id == id } } }
    var deck: IndexDeck? {
        choice.deckId.flatMap { id in index.areas.lazy.flatMap(\.platforms).flatMap(\.decks).first { $0.id == id } }
    }
    var hasSections: Bool { !(deck?.sections.isEmpty ?? true) }

    /// Where Back goes from the step on screen.
    var previous: Step { previousStep(step, hasSections, recent) }

    /// Options, Continue and Start round take presses 250 ms after a step appears.
    var settled: Bool { clock.nowMs() - stepShownAt >= SWIPE.settleMs }

    private var accepting: Bool { settled && !unrolling && backProgress == nil }

    private func push(_ next: Step) {
        stack.append(next)
        stepShownAt = clock.nowMs()
        focusAfterBack = nil
    }

    @discardableResult func chooseArea(_ id: String) -> Bool {
        guard accepting, step == 1 else { return false }
        choice = StartChoice(areaId: id)
        push(2)
        return true
    }

    @discardableResult func chooseRecent() -> Bool {
        guard accepting, step == 1 else { return false }
        choice = StartChoice(via: RECENT)
        push(3)
        return true
    }

    @discardableResult func choosePlatform(_ id: String) -> Bool {
        guard accepting, step == 2 else { return false }
        choice.platformId = id
        push(3)
        return true
    }

    @discardableResult func chooseDeck(_ id: String) -> Bool {
        guard accepting, step == 3 else { return false }
        choice.deckId = id
        afterDeck()
        return true
    }

    /// A deck of the Recent list fills area, platform and deck at once.
    @discardableResult func chooseRecentDeck(_ recentDeck: RecentDeck) -> Bool {
        guard accepting, step == 3, recent else { return false }
        choice.areaId = recentDeck.area.id
        choice.platformId = recentDeck.platform.id
        choice.deckId = recentDeck.deck.id
        afterDeck()
        return true
    }

    private func afterDeck() {
        if hasSections {
            push(4)
        } else {
            choice.sectionId = WHOLE_DECK
            push(5)
        }
    }

    @discardableResult func chooseSection(_ id: String) -> Bool {
        guard accepting, step == 4 else { return false }
        choice.sectionId = id
        push(5)
        return true
    }

    @discardableResult func chooseMode(_ mode: Mode) -> Bool {
        guard accepting, step == 5, isOffered(mode) else { return false }
        choice.mode = mode
        push(6)
        return true
    }

    /// Continue: the whole path to the ready pass is pushed, so Back retraces it.
    @discardableResult func continueTo(_ target: ContinueTarget) -> Bool {
        guard accepting, step == 1 else { return false }
        choice = StartChoice(areaId: target.found.area.id, platformId: target.found.platform.id, deckId: target.found.deck.id,
                             sectionId: target.route.sectionId, mode: target.mode)
        stack = pathTo(6, hasSections)
        stepShownAt = clock.nowMs()
        return true
    }

    /// Whether a back may start now: not on step 1, not while the paper unrolls.
    var canGoBack: Bool { step > 1 && !unrolling }

    /// Completes a back to `target`: clears the choices made on and after it and shows it. Returns false when the
    /// back is consumed (step 1, during the unroll, or a target that is not earlier).
    @discardableResult func back(to target: Step) -> Bool {
        guard canGoBack, target < step else { return false }
        let before = choice
        choice = clearFrom(choice, target)
        if let at = stack.firstIndex(of: target) {
            stack = Array(stack[...at])
        } else {
            stack = pathTo(target, hasSections, recent)
        }
        focusAfterBack = chosenOn(target, before)
        stepShownAt = clock.nowMs()
        backProgress = nil
        return true
    }

    /// Escape: one step back; on step 1 it is consumed and does nothing.
    @discardableResult func escape() -> Bool {
        if step == 1 { return true }
        return back(to: previous)
    }

    /// "Change platform, now {title}" on the recent path (StartFlow.tsx toPlatformDecks): that platform's own deck
    /// step on the ordinary path, [1, 2, 3] with area and platform kept, focus on the deck chosen before.
    @discardableResult func changePlatformOnRecentPath() -> Bool {
        guard canGoBack, recent, let areaId = choice.areaId, let platformId = choice.platformId else { return false }
        let deckId = choice.deckId
        choice = StartChoice(areaId: areaId, platformId: platformId)
        stack = [1, 2, 3]
        focusAfterBack = deckId
        stepShownAt = clock.nowMs()
        backProgress = nil
        return true
    }

    /// Start round: the paper unrolls for 360 ms, during which every back is consumed.
    @discardableResult func beginUnroll() -> Bool {
        guard accepting, step == 6, choice.mode != nil else { return false }
        unrolling = true
        return true
    }

    /// The route and class of the ready pass.
    var readyRoute: (route: Route, mode: Mode)? {
        guard let deckId = choice.deckId, let sectionId = choice.sectionId, let mode = choice.mode else { return nil }
        return (Route(deckId: deckId, sectionId: sectionId), mode)
    }

    #if DEBUG
    /// A debug launch (spec 7.4): opens `target` with the route's choices up to it, as the player would have made them.
    /// A deck without sections has no step 4, so 4 opens 5.
    @discardableResult func openForDebug(route: Route, mode: Mode, step target: Step) -> Bool {
        guard let found = findRoute(index, route), (1...6).contains(target) else { return false }
        let full = StartChoice(areaId: found.area.id, platformId: found.platform.id, deckId: found.deck.id, sectionId: route.sectionId, mode: mode)
        let sections = !found.deck.sections.isEmpty
        let step = !sections && target == 4 ? 5 : target
        choice = clearFrom(full, step)
        stack = pathTo(step, sections)
        stepShownAt = clock.nowMs()
        return true
    }
    #endif
}
```

- [ ] **Step 6: Write the round coordinator and the launch arguments.**

`ios/Truthy/Truthy/State/RoundCoordinator.swift`:

```swift
import Foundation
import Observation
import SwiftUI
import TruthyEngine

// One round on screen (reference 4.2 to 4.3, spec 4.4 to 5.6): it feeds the engine's reducer events stamped with the
// wall clock, holds the UI guards on the monotonic clock, journals every change of the answers or of isDecided, runs Timed's ticker and
// pauses it only when the app goes to the background, and records the result exactly once.

struct RoundRequest: Equatable, Sendable, Identifiable {
    let id = UUID()
    let route: Route
    let mode: Mode
    let seed: UInt32
}

@MainActor @Observable
final class RoundCoordinator {
    enum XAction: Equatable { case leaveNow, openSheet }

    let request: RoundRequest
    let deck: DeckFile
    let ticket: TicketInfo
    private(set) var state: RoundState
    /// Monotonic ms when the card on screen appeared: answers wait SWIPE.settleMs after it.
    private(set) var cardShownAt: Double
    /// Monotonic ms of the first answer to the card on screen, or of time up: Next card and See results wait 420 after it.
    private(set) var actionShownAt: Double?
    private(set) var sheetOpen = false
    private(set) var sheetOpenedAt: Double = 0
    /// Whether the round was already decided when the sheet opened (the sheet announces a decision only once).
    private(set) var decidedWhenSheetOpened = false
    private(set) var resultShownAt: Double?
    private(set) var outcome: ApplyOutcome?
    /// The record before this round, read when it was dealt (the ticket's best).
    let previousBest: Int?

    private let store: FileProgressStore
    private let journal: RoundJournal
    private let wall: any WallClock
    private let mono: any MonotonicClock
    private let roundId = UUID().uuidString
    private let ticker: Ticker
    private var background = false
    private var journalWrite: Task<Void, Never>?

    init(request: RoundRequest, deck: DeckFile, found: RouteInIndex, progress: Progress, store: FileProgressStore, journal: RoundJournal,
         wall: any WallClock, mono: any MonotonicClock, ticker: Ticker = Ticker()) throws {
        self.request = request
        self.deck = deck
        self.store = store
        self.journal = journal
        self.wall = wall
        self.mono = mono
        self.ticker = ticker
        previousBest = bestFor(progress, request.route, request.mode)
        ticket = ticketFor(found, request.mode, previousBest)
        state = try startRound(StartArgs(mode: request.mode, route: request.route, pool: poolFor(deck, request.route.sectionId),
                                         history: progress.cards, seed: Double(request.seed)))
        cardShownAt = mono.nowMs()
    }

    /// Deals a round as the web does (reference 6, save rule 2): load, prune the round's deck, save, then deal from the
    /// pruned history.
    static func prepare(request: RoundRequest, index: DeckIndex, decks: DeckStore, store: FileProgressStore, journal: RoundJournal,
                        wall: any WallClock, mono: any MonotonicClock) async throws -> RoundCoordinator {
        guard let found = findRoute(index, request.route) else { throw DeckStoreError(description: "no route \(routeKey(request.route))") }
        let deck = try await decks.deck(request.route.deckId)
        let progress = await store.prunedForRound(deck)
        return try RoundCoordinator(request: request, deck: deck, found: found, progress: progress, store: store, journal: journal,
                                    wall: wall, mono: mono)
    }

    // MARK: Reading the round

    var card: Card? { currentCard(state) }
    var decided: Bool { isDecided(state) }
    var finished: Bool { state.phase == .finished }
    var showsAction: Bool { actionShownAt != nil && !finished }
    var answeredCount: Int { state.answers.count }

    // MARK: Answers and the action after them

    /// An answer is taken in the question phase, with no sheet open, 250 ms after the card appeared (reference 4.3).
    var canAnswer: Bool {
        state.phase == .question && !sheetOpen && mono.nowMs() - cardShownAt >= SWIPE.settleMs
    }

    /// The one answer path of the swipe, the buttons, the custom actions and the arrow keys.
    @discardableResult func answer(_ value: Bool) -> Bool {
        guard canAnswer else { return false }
        let before = state
        send(.answer(value: value, at: wall.nowMs()))
        guard state != before else { return false }
        if state.phase == .answered || decided { actionShownAt = mono.nowMs() }
        return true
    }

    /// Every event reaches the reducer here: a change of the number of answers or of isDecided is journalled (a Timed
    /// minute that runs out with no answers is journalled as decided), never the finishing itself.
    private func send(_ event: RoundEvent) {
        let before = (state.answers.count, decided)
        state = reduce(state, event)
        if !finished && (state.answers.count, decided) != before { writeJournal() }
    }

    /// Next card and See results take presses 420 ms after they came (NEXT_ARRIVES_MS).
    var actionReady: Bool {
        guard let at = actionShownAt else { return false }
        return !sheetOpen && mono.nowMs() - at >= NEXT_ARRIVES_MS
    }

    /// Next card, or See results on a decided round. Returns false when the press is too early or does nothing.
    @discardableResult func next() async -> Bool {
        guard actionReady else { return false }
        if decided {
            await showResult()
            return true
        }
        let before = state
        send(.next)
        guard state != before else { return false }
        cardShownAt = mono.nowMs()
        actionShownAt = nil
        return true
    }

    // MARK: Timed

    func startTicker() {
        guard request.mode == .timed else { return }
        ticker.start { [weak self] in self?.tick() }
    }

    func stopTicker() {
        ticker.stop()
    }

    func tick() {
        guard request.mode == .timed, !finished else { return }
        let before = state
        send(.tick(now: wall.nowMs()))
        if state.index != before.index { cardShownAt = mono.nowMs() }
        if decided && actionShownAt == nil { actionShownAt = mono.nowMs() }
    }

    /// The Timed clock pauses only when the app goes to the background and resumes when it returns (spec 5.6):
    /// Control Center, the notification shade and the app's own sheet make the scene inactive, which changes nothing.
    func scenePhaseChanged(_ phase: ScenePhase) {
        switch phase {
        case .background where !background:
            background = true
            visibility(hidden: true)
        case .active where background:
            background = false
            visibility(hidden: false)
        default:
            break
        }
    }

    private func visibility(hidden: Bool) {
        guard request.mode == .timed, !finished else { return }
        send(.visibility(hidden: hidden, at: wall.nowMs()))
        if decided && actionShownAt == nil { actionShownAt = mono.nowMs() }
    }

    // MARK: Leaving

    /// The X and back on the round (spec D4): with no answers the round leaves at once, otherwise the sheet opens.
    var xAction: XAction { state.answers.isEmpty ? .leaveNow : .openSheet }

    func openSheet() {
        sheetOpen = true
        sheetOpenedAt = mono.nowMs()
        decidedWhenSheetOpened = decided
    }

    func keepPlaying() {
        sheetOpen = false
    }

    /// The web ignores a scrim tap for 250 ms after the sheet opens (reference 3.10).
    var scrimTapAccepted: Bool { mono.nowMs() - sheetOpenedAt >= 250 }

    /// Leaves the round: saves what leaving leaves (task 6: leavesSomething, saveLeftRound) and deletes the journal.
    func leave() async {
        stopTicker()
        if leavesSomething(state) && !finished { await store.saveLeftRound(state) }
        await journalWrite?.value
        await journal.clear()
    }

    // MARK: The result

    /// Finishes the round and records it exactly once (task 6's recordRound in the store).
    func showResult() async {
        guard !finished else { return }
        stopTicker()
        state = reduce(state, .next)
        resultShownAt = mono.nowMs()
        outcome = await store.record(state)
        await journalWrite?.value
        await journal.clear()
    }

    /// Play again, Choose another route and Close results take presses 1000 ms after the result appeared.
    var resultActionsReady: Bool {
        guard let at = resultShownAt else { return false }
        return mono.nowMs() - at >= RESULT_ARRIVES_MS
    }

    /// The comparison with the best before this round (ScoreBlock.tsx).
    var comparison: Comparison? {
        guard let outcome, finished else { return nil }
        return compareWithBest(summarise(state).score, outcome.previousBest)
    }

    // MARK: The journal

    var journalEntry: JournalEntry {
        JournalEntry(route: request.route, mode: request.mode, seed: request.seed, roundId: roundId,
                     answers: state.answers.map { JournalAnswer(cardId: $0.card.id, given: $0.given, correct: $0.correct, at: $0.at) },
                     decided: decided, recorded: false)
    }

    private func writeJournal() {
        let entry = journalEntry
        let previous = journalWrite
        let journal = journal
        journalWrite = Task {
            await previous?.value
            await journal.record(entry)
        }
    }

    /// Waits for the journal writes sent so far (tests and leaving).
    func journalSettled() async {
        await journalWrite?.value
    }

    #if DEBUG
    /// Brings the round to a debug screen of spec 7.4 at once, without the guards.
    func applyDebug(_ screen: DebugScreen) async {
        switch screen {
        case .answered, .sheet:
            send(.answer(value: true, at: wall.nowMs()))
            actionShownAt = mono.nowMs() - NEXT_ARRIVES_MS
            if screen == .sheet { openSheet() }
        case .result:
            if request.mode == .timed {
                // In Timed an answer only stamps and next does nothing: run the minute out, one tick per second (a tick
                // counts at most TIMED.maxStepMs).
                var now = wall.nowMs()
                send(.tick(now: now))
                for _ in 0..<(Int(TIMED.roundMs / 1000) + 2) where !decided {
                    now += 1000
                    send(.tick(now: now))
                }
            } else {
                for _ in 0..<(state.cards.count * 2 + 2) where !decided && state.phase != .finished {
                    send(.answer(value: true, at: wall.nowMs()))
                    if !decided { send(.next) }
                }
            }
            await showResult()
        default:
            break
        }
    }
    #endif
}
```

`ios/Truthy/Truthy/State/LaunchArguments.swift`:

```swift
import Foundation
import TruthyEngine

// Debug launch arguments (spec 7.4): open any screen in a known state. Parsed in every build, read only in debug
// builds, so the phone's release build has none.
//   -seed <uint32>  -route <deckId>/<sectionId>  -mode <classic|streak|lives|timed>  -screen <name>  -step <1..6>
//   -theme light|dark (plan C's extras carry the same keys and values)

enum DebugScreen: String, CaseIterable, Sendable {
    case start, round, answered, sheet, result, gallery
}

struct LaunchArguments: Equatable, Sendable {
    var seed: UInt32?
    var route: Route?
    var mode: Mode?
    var screen: DebugScreen?
    /// The start step `-screen start` opens (1 to 6).
    var step: Step?
    var theme: StoredTheme?

    static func parse(_ arguments: [String]) -> LaunchArguments {
        var parsed = LaunchArguments()
        func value(_ name: String) -> String? {
            guard let at = arguments.firstIndex(of: name), at + 1 < arguments.count else { return nil }
            return arguments[at + 1]
        }
        parsed.seed = value("-seed").flatMap { UInt32($0) }
        parsed.route = value("-route").flatMap { text in
            let parts = text.split(separator: "/", maxSplits: 1).map(String.init)
            return parts.count == 2 && !parts[0].isEmpty && !parts[1].isEmpty ? Route(deckId: parts[0], sectionId: parts[1]) : nil
        }
        parsed.mode = value("-mode").flatMap { Mode(rawValue: $0) }
        parsed.screen = value("-screen").flatMap { DebugScreen(rawValue: $0) }
        parsed.step = value("-step").flatMap { Int($0) }.flatMap { (1...6).contains($0) ? $0 : nil }
        parsed.theme = parseTheme(value("-theme"))
        return parsed
    }

    /// The process's arguments in a debug build; none in a release build.
    static var current: LaunchArguments {
        #if DEBUG
        parse(ProcessInfo.processInfo.arguments)
        #else
        LaunchArguments()
        #endif
    }
}
```

- [ ] **Step 7: Write the app model, the root, the entry and the two stand-ins.**

`ios/Truthy/Truthy/State/AppModel.swift`:

```swift
import Foundation
import Observation
import TruthyEngine

// The app as a whole (spec 5.2, 5.6, 4.5): two top-level screens swapped in place, the theme, and what the start
// screen needs (the index, the progress, Recent, Continue). At launch a journal left by a killed app is applied with
// the leave rules and deleted, every played deck is pruned (saving only when that changed the progress), and the app
// opens at start step 1 with no choices: a round is never resumed.

enum TopScreen: Equatable {
    case start
    case round(RoundRequest)
}

@MainActor @Observable
final class AppModel {
    var screen: TopScreen = .start
    private(set) var storedTheme: StoredTheme?
    /// The system appearance, kept up to date by the root view.
    var systemDark = false
    var theme: ResolvedTheme { resolveTheme(storedTheme, systemDark) }

    let index: DeckIndex
    let decks: DeckStore
    let store: FileProgressStore
    let journal: RoundJournal
    let themeStore: ThemeStore
    let wall: any WallClock
    let mono: any MonotonicClock
    let arguments: LaunchArguments
    private(set) var startFlow: StartFlowModel
    private(set) var progress = emptyProgress()
    private(set) var recent: [RecentDeck] = []
    private(set) var continueTarget: ContinueTarget?
    private(set) var launched = false
    /// The S1 title takes accessibility focus when the player comes back from a round by a control (reference 4.4).
    private(set) var returnedFromRound = false
    #if DEBUG
    private var debugScreenUsed = false
    #endif

    /// The debug screen of spec 7.4, for the first round of the process only (Play again deals an ordinary round).
    func takeDebugScreen() -> DebugScreen? {
        #if DEBUG
        guard !debugScreenUsed else { return nil }
        debugScreenUsed = true
        return arguments.screen
        #else
        return nil
        #endif
    }

    init(bundle: Bundle, directory: URL, defaults: UserDefaults, wall: any WallClock = SystemWallClock(),
         mono: any MonotonicClock = SystemMonotonicClock(), arguments: LaunchArguments = .current) throws {
        decks = DeckStore(bundle: bundle)
        index = try decks.index()
        store = FileProgressStore(directory: directory)
        journal = RoundJournal(directory: directory)
        themeStore = ThemeStore(defaults: defaults)
        self.wall = wall
        self.mono = mono
        self.arguments = arguments
        if let theme = arguments.theme { themeStore.store(theme) }
        storedTheme = themeStore.stored
        startFlow = StartFlowModel(index: index, clock: mono)
    }

    /// Launch: the journal, the start-screen prune, then step 1. A debug route and class open a round at once.
    func launch() async {
        await journal.applyPending(to: store, deck: decks.deck)
        await loadStart()
        launched = true
        #if DEBUG
        if arguments.screen == .start, let route = arguments.route {
            startFlow.openForDebug(route: route, mode: arguments.mode ?? .classic, step: arguments.step ?? 6)
        } else if let route = arguments.route, let mode = arguments.mode, let screen = arguments.screen, screen != .start, screen != .gallery {
            startRound(route: route, mode: mode)
        }
        #endif
    }

    /// Reads the progress, prunes every played deck against its current cards (saving only when an entry was
    /// dropped), and works out Recent and Continue once for this visit (reference 3.6).
    func loadStart() async {
        let loaded = await store.load()
        let deckIds = Set(index.areas.flatMap(\.platforms).flatMap(\.decks).map(\.id))
        let played = Set(loaded.cards.keys.compactMap { deckOfCard($0, deckIds) })
        var cardIds: [String: [String]] = [:]
        for id in played.sorted() {
            if let file = try? await decks.deck(id) { cardIds[id] = file.cards.map(\.id) }
        }
        var changed: Progress?
        progress = withoutRemovedCards(loaded, cardIds) { changed = $0 }
        if let changed { await store.save(changed) }
        recent = recentDecks(index, progress)
        continueTarget = TruthyEngine.continueTarget(index, progress)
    }

    /// The theme switch: flips the theme visible now and stores it; the theme flips even when storing fails.
    func switchTheme() {
        let next = TruthyEngine.switchTheme(storedTheme, systemDark)
        storedTheme = next
        themeStore.store(next)
    }

    /// Swaps in the round right after the unroll. The seed is a secure random UInt32, or the debug seed.
    func startRound(route: Route, mode: Mode) {
        returnedFromRound = false
        screen = .round(RoundRequest(route: route, mode: mode, seed: arguments.seed ?? UInt32.random(in: .min ... .max)))
    }

    /// Play again: the same route and class with a new seed.
    func playAgain(_ request: RoundRequest) {
        screen = .round(RoundRequest(route: request.route, mode: request.mode, seed: arguments.seed ?? UInt32.random(in: .min ... .max)))
    }

    /// Back to start step 1 with no choices. The start screen is loaded first and step 1 is created after it, so Recent
    /// and Continue never change under the player and the 250 ms settle starts when step 1 appears.
    func showStart(byControl: Bool) async {
        await loadStart()
        startFlow = StartFlowModel(index: index, clock: mono)
        returnedFromRound = byControl
        screen = .start
    }
}
```

`ios/Truthy/Truthy/App/RootView.swift`:

```swift
import SwiftUI

// The root: the theme from the first frame, the two top-level screens swapped in place (no navigation, no modal
// presentation), and the app's life cycle handed to the round (spec 5.2, 5.6).

struct RootView: View {
    @Bindable var model: AppModel
    @Environment(\.colorScheme) private var system

    var body: some View {
        ThemedRoot(stored: model.storedTheme) { _ in
            ZStack {
                if !model.launched {
                    // Until the journal is applied and the start screen is loaded: only the sky, so the Recent card and
                    // the Continue line never pop in after the first frame (smell 5, N10).
                    SkyBackdrop(lowerCloud: .start)
                } else {
                    switch model.screen {
                    case .start:
                        StartFlowView(model: model)
                            .transition(.identity)
                    case .round(let request):
                        RoundScreen(model: model, request: request)
                            .id(request.id)
                            .transition(.identity)
                    }
                }
            }
        }
        .onAppear { model.systemDark = system == .dark }
        .onChange(of: system) { _, value in model.systemDark = value == .dark }
        .task { await model.launch() }
    }
}
```

`ios/Truthy/Truthy/App/TruthyApp.swift`:

```swift
import SwiftUI

@main
struct TruthyApp: App {
    @State private var model: AppModel?

    init() {
        _model = State(initialValue: try? AppModel(bundle: .main, directory: FileProgressStore.applicationSupport(), defaults: .standard))
    }

    var body: some Scene {
        WindowGroup {
            if let model {
                #if DEBUG
                if model.arguments.screen == .gallery {
                    ThemedRoot(stored: model.storedTheme) { _ in GalleryView() }
                } else {
                    RootView(model: model)
                }
                #else
                RootView(model: model)
                #endif
            } else {
                // The decks are embedded, so this shows only on a corrupt bundle (reference 4.1, P1).
                Color("LaunchSurface").ignoresSafeArea().accessibilityLabel("The decks didn't load")
            }
        }
    }
}
```

`ios/Truthy/Truthy/Start/StartFlowView.swift`:

```swift
import SwiftUI

// A stand-in until task 12 writes the start flow: the title of step 1, so the app opens on something.
struct StartFlowView: View {
    let model: AppModel
    @Environment(\.palette) private var palette

    var body: some View {
        ZStack {
            SkyBackdrop(lowerCloud: .start)
            Text("Choose an area").typeRole(Tokens.TypeRole.stepTitle).foregroundStyle(palette.ink.color)
        }
    }
}
```

`ios/Truthy/Truthy/Round/RoundView.swift`:

```swift
import SwiftUI

// A stand-in until task 13 writes the round screen.
struct RoundScreen: View {
    let model: AppModel
    let request: RoundRequest

    var body: some View {
        SkyBackdrop()
    }
}
```

- [ ] **Step 8: Run the tests.**

```bash
DEST26='platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5'
xcodebuild test -project ios/Truthy/Truthy.xcodeproj -scheme Truthy -destination "$DEST26" -only-testing:TruthyTests 2>&1 | grep -E 'Test run with|✘|TEST (SUCCEEDED|FAILED)' | tail -4
```

Expected: `Test run with 61 tests in 17 suites passed` (30 in 12 before, plus back motion 9, start flow 6, round 9, launch 5 of which one parameterised over the three journal cases, launch arguments 2) and `** TEST SUCCEEDED **`. A failing `theTickerKeepsFiringWhileAScrollIsTracking` means the timer is in the default mode only: rule 3.

- [ ] **Step 9: Look at the app and the gallery.**

```bash
DEST26='platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5'
xcrun simctl boot 'iPhone 17 Pro' 2>/dev/null || true
xcodebuild build -project ios/Truthy/Truthy.xcodeproj -scheme Truthy -destination "$DEST26" -derivedDataPath "${TMPDIR:-/tmp}/truthy-derived" 2>&1 | grep -E 'BUILD (SUCCEEDED|FAILED)'
xcrun simctl install booted "${TMPDIR:-/tmp}/truthy-derived/Build/Products/Debug-iphonesimulator/Truthy.app"
xcrun simctl launch booted com.eienmosu.Truthy -screen gallery -theme dark
```

Expected: `** BUILD SUCCEEDED **`, then the gallery of task 10 in the night theme: the logo, the 19 icons, the notched paper and card, a perforation, a barcode, a stamp border, pills and the round X. Launch again with `-theme light` for the day theme. Compare by eye with the web's components; differences go to task 15's review, not here.

- [ ] **Step 10: Run the gates and commit.**

```bash
DEST26='platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5'
swift test --package-path ios/TruthyEngine 2>&1 | tail -1
xcodebuild test -project ios/Truthy/Truthy.xcodeproj -scheme Truthy -destination "$DEST26" 2>&1 | grep -E 'TEST (SUCCEEDED|FAILED)'
git add ios/Truthy/Truthy/State ios/Truthy/Truthy/App ios/Truthy/Truthy/Start/StartFlowView.swift ios/Truthy/Truthy/Round/RoundView.swift ios/Truthy/TruthyTests/StateTests.swift
pnpm test
git commit -m "feat: add the iOS app state: the start flow stack, the back motion as a function of progress, the round coordinator and the launch"
git status --short
```

Expected: the engine passes as before; `** TEST SUCCEEDED **`; `pnpm test` passes; nothing from `git status --short`.
