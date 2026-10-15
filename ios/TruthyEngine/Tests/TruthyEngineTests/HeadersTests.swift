import Testing
@testable import TruthyEngine

// tests/components/StreakPath*.test.tsx, LivesPath*.test.tsx and TimedPath*.test.tsx.
@Suite struct HeadersTests {
    @Test func aStreakFliesTowardsItsBest() {
        let ahead = streakLayout(2, 5)
        #expect(ahead.ring == 4 && ahead.target && ahead.future == [3])
        #expect(ahead.t(4) == 1 && ahead.t(2) == 0.5)
        #expect(ahead.dot == 6 && ahead.ticks)
        let past = streakLayout(6, 5)
        #expect(past.ring == 4 && !past.target && past.future.isEmpty)
        #expect(streakLayout(3, nil).ring == nil && streakLayout(3, 0).ring == nil)
        #expect(streakLabel(1, nil, false) == "Streak of 1 correct answer.")
        #expect(streakLabel(3, 5, false) == "Streak of 3 correct answers. Your best on this route is 5.")
        #expect(streakLabel(5, 5, false) == "Streak of 5 correct answers, equal to your best on this route.")
        #expect(streakLabel(6, 5, true) == "Streak ended at 6. New best on this route, previous best 5.")
    }

    @Test func threeLivesPlaceTheTrailAndSayWhatIsLeft() {
        let short = trailLayout(3)
        #expect(short.x(2) == 219 && short.x(0) == 201 && short.r == 2.6 && short.side == 9)
        let long = trailLayout(120)
        #expect(long.x(0) == 100 && long.x(119) == 219 && long.side == 6 && long.r == 0.5)
        #expect(livesLabel([]) == "3 of 3 lives left. No cards answered yet.")
        #expect(livesLabel([true]) == "3 of 3 lives left. 1 card answered.")
        #expect(livesLabel([true, false]) == "2 of 3 lives left. 2 cards answered, card 2 was wrong.")
        #expect(livesLabel([false, false, true, false]) == "No lives left. The round is over after 4 cards: cards 1, 2 and 4 were wrong.")
    }

    @Test func theClockRoundsSecondsUp() {
        #expect(clockText(60_000) == "1:00")
        #expect(clockText(41_001) == "0:42")
        #expect(clockText(1) == "0:01")
        #expect(clockText(0) == "0:00")
        #expect(clockText(-5) == "0:00")
        #expect(timedLabel(41_000, 9, 2) == "41 seconds left of 60. 9 correct, 2 wrong.")
        #expect(timedLabel(1, 0, 0) == "1 second left of 60. 0 correct, 0 wrong.")
        #expect(timedLabel(0, 1, 0) == "Time is up. 1 card answered: 1 correct, 0 wrong.")
    }
}
