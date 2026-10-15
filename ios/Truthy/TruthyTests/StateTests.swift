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

    @Test func aSecondLeaveSavesNothingMore() async throws {
        let directory = Scratch.directory()
        let round = try await coordinator(.classic, directory: directory)
        let journal = RoundJournal(directory: directory)
        mono.advance(250)
        #expect(round.answer(true))
        let cardId = try #require(round.state.answers.first).card.id
        await round.leave()
        await round.leave()
        let stored = await FileProgressStore(directory: directory).load()
        #expect(stored.cards[cardId]?.seen == 1, "a double Leave saves the left round once")
        let last = try #require(stored.last)
        #expect(last.score == nil)
        #expect(await journal.pending() == nil)
    }

    @Test func noAnswerIsTakenWhileLeaving() async throws {
        let directory = Scratch.directory()
        let round = try await coordinator(.classic, directory: directory)
        let journal = RoundJournal(directory: directory)
        mono.advance(250)
        #expect(round.canAnswer)
        let leaving = Task { await round.leave() }
        // A Task made on the main actor begins only when this test suspends: wait until the leave has begun.
        var spins = 0
        while round.canAnswer && spins < 100 {
            spins += 1
            await Task.yield()
        }
        #expect(round.canAnswer == false)
        #expect(round.answer(true) == false)
        await leaving.value
        await round.journalSettled()
        #expect(await journal.pending() == nil)
        let stored = await FileProgressStore(directory: directory).load()
        let ids = Set(round.deck.cards.map(\.id))
        #expect(stored.cards.keys.filter { ids.contains($0) }.isEmpty)
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
