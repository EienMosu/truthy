import Testing
@testable import TruthyEngine

// tests/components/play/PlayScreenTimed.test.tsx, timed-applies-to-polish.test.ts and round-status-voice.test.tsx.
@Suite struct PlayCopyTests: RoundTesting {
    @Test func theVerdictSaysTheAnswerAndANewBest() {
        #expect(verdictText(true, false) == "Correct. The answer is False.")
        #expect(verdictText(false, true) == "Not quite. The answer is True.")
        #expect(verdictText(true, true, true) == "Correct. The answer is True. New best.")
        #expect(NEXT_ARRIVES_MS == 420)
        #expect(SPOKEN_RELEASE_MS == 150)
    }

    @Test func threeLivesSaysWhatALostLifeLeaves() throws {
        let lives = try start(.lives)
        #expect(roundStatus(lives) == "")
        let one = give(lives, false)
        #expect(roundStatus(one) == "Life lost, 2 left.")
        let two = give(play(give(play(one, [.next]), true, at: 2000), [.next]), false, at: 3000)
        #expect(roundStatus(two) == "Last life.")
        let three = give(play(two, [.next]), false, at: 4000)
        #expect(roundStatus(three) == "Out of lives.")
    }

    @Test func aStreakSaysWhereItEndedAndClassicSaysNothing() throws {
        let streak = give(play(give(play(give(try start(.streak), true), [.next]), true, at: 2000), [.next]), false, at: 3000)
        #expect(roundStatus(streak) == "Streak ended at 2.")
        #expect(roundStatus(give(try start(.streak), true)) == "")
        #expect(roundStatus(give(try start(.classic), false)) == "")
    }

    @Test func timedSaysTheStampAndTheEnd() throws {
        let round = try timed()
        #expect(timedStatus(round) == "")
        #expect(timedStatus(give(round, true, at: T0 + 500)) == "Correct.")
        #expect(timedStatus(give(round, false, at: T0 + 500)) == "Not quite.")
        #expect(timedStatus(play(round, ticks(T0, T0 + 60_000, step: 1000))) == "Time is up. This card doesn't count.")
    }

    @Test func timedAnnouncesEveryCardFromTheSecond() throws {
        let round = try timed()
        #expect(timedCardText(round) == "")
        let second = play(give(round, true, at: T0 + 500), [.tick(now: T0 + 1200)])
        let card = try #require(currentCard(second))
        #expect(timedCardText(second) == "Card 2. \(card.text.en.statement)")
        #expect(timedCardText(play(second, ticks(T0 + 1200, T0 + 61_000, step: 1000))) == "")
    }
}
