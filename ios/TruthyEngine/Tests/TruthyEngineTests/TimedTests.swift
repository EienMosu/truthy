import Testing
@testable import TruthyEngine

// tests/engine/timed.test.ts and clock-polish.test.ts: the Timed clock, the stamp, time up, and times that
// are not numbers. Every time is wall-clock epoch ms from one clock (reference 3.3).
@Suite("Round: the Timed clock")
struct TimedTests: RoundTesting {
    @Test func hasSixtySecondsA700MsStampAndCountsAtMostOneSecondPerTick() {
        #expect(TIMED == TimedSettings(roundMs: 60_000, holdMs: 700, maxStepMs: 1_000))
    }

    @Test func startsFullAndStoppedAndTheFirstTickStartsItWithoutTakingTime() throws {
        #expect(try start(.timed).clock == Clock(remainingMs: 60_000, lastTick: nil, hidden: false, holdMs: 0))
        #expect(try timed().clock == Clock(remainingMs: 60_000, lastTick: T0, hidden: false, holdMs: 0))
    }

    @Test(arguments: [Mode.classic, .streak, .lives])
    func theOtherModesHaveNoClockAndIgnoreTicksAndVisibility(mode: Mode) throws {
        let state = try start(mode)
        #expect(state.clock == nil)
        #expect(reduce(state, .tick(now: T0)) == state)
        #expect(reduce(state, hide(T0)) == state)
    }

    @Test func countsDownByTheTimeBetweenTicks() throws {
        let state = play(try timed(), [.tick(now: T0 + 100), .tick(now: T0 + 350)])
        #expect(state.clock?.remainingMs == 59_650)
        #expect(state.phase == .question)
    }

    @Test func neverCountsBackwardsWhenTheClockSourceJumpsBack() throws {
        let state = play(try timed(), [.tick(now: T0 + 500), .tick(now: T0 + 200)])
        #expect(state.clock?.remainingMs == 59_500)
        #expect(state.clock?.lastTick == T0 + 200)
    }

    @Test func countsAGapOfMoreThanASecondAsOneSecond() throws {
        let state = play(try timed(), [.tick(now: T0 + 45_000)])
        #expect(state.clock?.remainingMs == 59_000)
    }

    @Test func countsAStepOfExactlyOneSecondInFull() throws {
        let state = play(try timed(), [.tick(now: T0 + 1_000), .tick(now: T0 + 2_001)])
        #expect(state.clock?.remainingMs == 58_000)
    }

    @Test func pausesWhileHiddenAndGoesOnFromWhereItWas() throws {
        let state = play(try timed(), [
            .tick(now: T0 + 1_000), hide(T0 + 1_400), .tick(now: T0 + 5_000), .tick(now: T0 + 9_000),
            show(T0 + 30_000), .tick(now: T0 + 30_100),
        ])
        #expect(state.clock == Clock(remainingMs: 58_500, lastTick: T0 + 30_100, hidden: false, holdMs: 0))
    }

    @Test func returnsTheSameStateForATickWhileHiddenAndForARepeatedVisibilityEvent() throws {
        let hidden = play(try timed(), [hide(T0 + 100)])
        #expect(hidden.clock == Clock(remainingMs: 59_900, lastTick: nil, hidden: true, holdMs: 0))
        #expect(reduce(hidden, .tick(now: T0 + 5_000)) == hidden)
        #expect(reduce(hidden, hide(T0 + 6_000)) == hidden)
        let shown = try timed()
        #expect(reduce(shown, show(T0 + 50)) == shown)
    }

    @Test func anAnswerIsStampedRecordedWithNoAnsweredPhaseAndA700MsHold() throws {
        let state = give(try timed(), true, at: T0 + 2_000)
        #expect(state.phase == .stamped)
        #expect(state.answers.count == 1)
        #expect(state.clock == Clock(remainingMs: 59_000, lastTick: T0 + 2_000, hidden: false, holdMs: 700))
        #expect(isDecided(state) == false)
    }

    @Test func theFirstAnswerArmsTheClockWhenNoTickCameBeforeIt() throws {
        let state = give(try start(.timed), true, at: T0)
        #expect(state.clock == Clock(remainingMs: 60_000, lastTick: T0, hidden: false, holdMs: 700))
        let next = play(state, [.tick(now: T0 + 700)])
        #expect(next.phase == .question)
        #expect(next.index == 1)
    }

    @Test func countsTheClockUpToTheMomentOfTheAnswer() throws {
        let state = give(play(try timed(), [.tick(now: T0 + 900)]), false, at: T0 + 950)
        #expect(state.clock?.remainingMs == 59_050)
    }

    @Test func ignoresAnswerAndNextWhileStamped() throws {
        let state = give(try timed(), true, at: T0 + 500)
        #expect(reduce(state, .answer(value: true, at: T0 + 600)) == state)
        #expect(reduce(state, .next) == state)
    }

    @Test func showsTheNextCardOnce700MsHaveBeenCountedSinceTheAnswer() throws {
        let stamped = give(try timed(), true, at: T0 + 500)
        let before = play(stamped, ticks(T0 + 500, T0 + 1_100))
        #expect(before.phase == .stamped)
        #expect(before.index == 0)
        #expect(before.clock?.holdMs == 100)
        let after = play(before, [.tick(now: T0 + 1_200)])
        #expect(after.phase == .question)
        #expect(after.index == 1)
        #expect(after.clock?.holdMs == 0)
        #expect(after.clock?.remainingMs == 58_800)
    }

    @Test func holdsTheStampWhileHidden() throws {
        let state = play(give(try timed(), true, at: T0 + 500), [
            .tick(now: T0 + 800), hide(T0 + 900), show(T0 + 20_000), .tick(now: T0 + 20_200),
        ])
        #expect(state.phase == .stamped)
        #expect(state.clock?.holdMs == 100)
        #expect(play(state, [.tick(now: T0 + 20_300)]).phase == .question)
    }

    @Test func anAnswerWhileHiddenIsStampedAndItsHoldWaitsForTheAppToShow() throws {
        let hidden = play(try timed(), [hide(T0 + 1_000)])
        let stamped = give(hidden, true, at: T0 + 2_000)
        #expect(stamped.answers.count == 1)
        #expect(stamped.clock == Clock(remainingMs: 59_000, lastTick: nil, hidden: true, holdMs: 700))
        #expect(reduce(stamped, .tick(now: T0 + 3_000)) == stamped)
        let shown = play(stamped, [show(T0 + 5_000)] + ticks(T0 + 5_000, T0 + 5_600))
        #expect(shown.phase == .stamped)
        #expect(play(shown, [.tick(now: T0 + 5_700)]).phase == .question)
    }

    @Test func hidingAfterTheHoldRanOutShowsTheNextCardThenPauses() throws {
        let state = play(give(try timed(), true, at: T0 + 100), [hide(T0 + 900)])
        #expect(state.phase == .question)
        #expect(state.index == 1)
        #expect(state.clock == Clock(remainingMs: 59_100, lastTick: nil, hidden: true, holdMs: 0))
    }

    @Test func dealsTheNextChunkWhenTheStampEndsOnTheLastDealtCard() throws {
        var state = try timed()
        var now = T0
        for _ in 0..<10 {
            now += 300
            state = give(state, true, at: now)
            state = play(state, ticks(now, now + 700))
            now += 700
        }
        #expect(state.phase == .question)
        #expect(state.index == 10)
        #expect(state.cards.count == 20)
    }

    @Test func stopsAtZeroOnTheQuestionDecidedStampedTheCardOnScreenNotAnswered() throws {
        let almost = try nearlyUp()
        #expect(almost.clock?.remainingMs == 100)
        let up = play(almost, [.tick(now: T0 + 60_000)])
        #expect(up.clock?.remainingMs == 0)
        #expect(up.phase == .stamped)
        #expect(isDecided(up))
        #expect(up.index == 0)
        #expect(up.answers.isEmpty)
    }

    @Test func returnsTheSameStateForEveryEventButNextAndAbandonOnceTimeIsUp() throws {
        let up = play(try nearlyUp(), [.tick(now: T0 + 60_000)])
        #expect(reduce(up, .tick(now: T0 + 60_100)) == up)
        #expect(reduce(up, .tick(now: T0 + 99_000)) == up)
        #expect(reduce(up, hide(T0 + 60_200)) == up)
        #expect(reduce(up, show(T0 + 60_300)) == up)
        #expect(reduce(up, .answer(value: true, at: T0 + 60_400)) == up)
    }

    @Test func nextAfterTimeUpFinishesTheRoundAndTheCardOnScreenIsNotCounted() throws {
        var state = give(try timed(), true, at: T0 + 1_000)
        state = play(state, ticks(T0 + 1_000, T0 + 1_700))
        state = give(state, false, at: T0 + 2_000)
        state = play(state, ticks(T0 + 2_000, T0 + 60_000))
        #expect(state.phase == .stamped)
        #expect(isDecided(state))
        #expect(state.index == 2)
        let done = play(state, [.next])
        #expect(done.phase == .finished)
        let result = summarise(done)
        #expect(result.mode == .timed)
        #expect([result.score, result.total] == [1, 2])
        #expect(result.abandoned == false)
        #expect(ids(result.answers.map(\.card)) == [state.cards[0].id, state.cards[1].id])
        #expect(!result.answers.contains { $0.card.id == state.cards[2].id })
    }

    @Test func nextDoesNothingOnATimedRoundThatIsNotDecided() throws {
        let state = try timed()
        #expect(reduce(state, .next) == state)
    }

    @Test(arguments: [60_050.0, 60_000.0])
    func anAnswerThatArrivesAtOrAfterZeroDoesNotCount(offset: Double) throws {
        let late = play(try nearlyUp(), [.answer(value: true, at: T0 + offset)])
        #expect(late.answers.isEmpty)
        #expect(late.phase == .stamped)
        #expect(isDecided(late))
        #expect(late.clock?.remainingMs == 0)
    }

    @Test func timeRunningOutDuringTheStampKeepsThatAnswerAndMovesOnToACardThatDoesNotCount() throws {
        let answered = give(try nearlyUp(), true, at: T0 + 59_950)
        #expect(answered.answers.count == 1)
        #expect(answered.clock?.remainingMs == 50)
        let up = play(answered, [.tick(now: T0 + 60_000)])
        #expect(up.phase == .stamped)
        #expect(isDecided(up))
        #expect(up.index == 1)
        #expect(up.answers.count == 1)
        #expect(up.clock?.holdMs == 0)
        #expect(currentCard(up) == up.cards[1])
    }

    @Test func hidingAtTheMomentTheTimeRunsOutIsTimeUpNotAPause() throws {
        let up = play(try nearlyUp(), [hide(T0 + 60_000)])
        #expect(up.clock?.remainingMs == 0)
        #expect(up.clock?.hidden == false)
        #expect(isDecided(up))
    }

    @Test func hidingAtZeroDuringAStampMovesOnToACardThatDoesNotCount() throws {
        let up = play(give(try nearlyUp(), true, at: T0 + 59_950), [hide(T0 + 60_000)])
        #expect(up.clock == Clock(remainingMs: 0, lastTick: T0 + 60_000, hidden: false, holdMs: 0))
        #expect(up.index == 1)
        #expect(up.answers.count == 1)
        #expect(isDecided(up))
    }

    @Test func aRoundLeftAfterTimeIsUpIsAbandonedLikeAnyOtherAndNextFinishesIt() throws {
        let up = play(try nearlyUp(), [.tick(now: T0 + 60_000)])
        let left = play(up, [.abandon])
        #expect(left.phase == .finished)
        #expect(left.abandoned)
        let done = play(up, [.next])
        #expect(done.phase == .finished)
        #expect(done.abandoned == false)
    }

    @Test func ignoresEveryTickAfterTheRoundWasLeft() throws {
        let left = play(try timed(), [.abandon])
        #expect(reduce(left, .tick(now: T0 + 100)) == left)
        #expect(reduce(left, hide(T0 + 200)) == left)
    }

    @Test func isTheSameRoundForTheSameSeedAndEvents() throws {
        let events: [RoundEvent] = [.tick(now: T0), .answer(value: true, at: T0 + 400)] + ticks(T0 + 400, T0 + 1_100)
            + [hide(T0 + 1_150), show(T0 + 9_000), .tick(now: T0 + 9_100)]
        #expect(play(try start(.timed, seed: 5), events) == play(try start(.timed, seed: 5), events))
    }

    // clock-polish.test.ts: a time that is not a number does not apply.
    @Test(arguments: [Double.nan, .infinity, -.infinity])
    func aTickAtANonFiniteTimeIsIgnoredAndTheMinuteStillEndsOnTime(bad: Double) throws {
        let before = play(try timed(), ticks(T0, T0 + 5_000))
        let after = reduce(before, .tick(now: bad))
        #expect(after == before)
        let ended = play(after, ticks(T0 + 5_000, T0 + 61_000))
        #expect(ended.clock?.remainingMs == 0)
        #expect(isDecided(ended))
        let late = reduce(ended, .answer(value: currentCard(ended)?.answer ?? true, at: T0 + 61_000))
        #expect(late.answers.count == ended.answers.count)
    }

    @Test func anAnswerAtNaNIsIgnoredItNeitherCountsNorMovesTheClock() throws {
        let state = play(try timed(), ticks(T0, T0 + 2_000))
        let after = reduce(state, .answer(value: currentCard(state)?.answer ?? true, at: .nan))
        #expect(after == state)
        #expect(after.clock?.remainingMs == 58_000)
    }

    @Test func aShowAtNaNIsIgnoredSoTheClockKeepsCountingFromARealMoment() throws {
        let hidden = play(try timed(), [hide(T0 + 1_000)])
        let after = reduce(hidden, show(.nan))
        #expect(after == hidden)
        let shown = play(after, [show(T0 + 9_000)] + ticks(T0 + 9_000, T0 + 70_000))
        #expect(shown.clock?.remainingMs == 0)
        #expect(isDecided(shown))
    }

    @Test func aClassicAnswerAtNaNIsIgnored() throws {
        let state = try start(.classic)
        #expect(reduce(state, .answer(value: true, at: .nan)) == state)
        #expect(reduce(state, .answer(value: true, at: T0)).answers.count == 1)
    }
}
