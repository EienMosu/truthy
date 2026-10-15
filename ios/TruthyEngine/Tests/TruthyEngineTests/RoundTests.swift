import Testing
@testable import TruthyEngine

// tests/engine/round.test.ts. The web freezes every state before reduce to catch mutation; Swift states are
// values, so "the very same state" is an equal state here.
@Suite("Round: start, Classic, abandon, summarise")
struct RoundTests: RoundTesting {
    @Test func aClassicRoundHasTenCards() {
        #expect(CLASSIC_LENGTH == 10)
    }

    @Test func startsAClassicRoundOnTheFirstCardInTheQuestionPhase() throws {
        let state = try start()
        #expect(state.mode == .classic)
        #expect(state.route == route)
        #expect(state.cards.count == 10)
        #expect(state.index == 0)
        #expect(state.answers.isEmpty)
        #expect(state.phase == .question)
        #expect(state.abandoned == false)
    }

    @Test func dealsTenDifferentCards() throws {
        #expect(Set(ids(try start().cards)).count == 10)
    }

    @Test(arguments: [1, 4, 9])
    func dealsTheWholePoolWhenItIsSmall(n: Int) throws {
        #expect(try start(size: n).cards.count == n)
    }

    @Test func dealsExactlyTenFromAPoolOfTenOrEleven() throws {
        #expect(try start(size: 10).cards.count == 10)
        #expect(try start(size: 11).cards.count == 10)
    }

    @Test func dealsTheSameRoundForTheSameSeed() throws {
        #expect(ids(try start(seed: 5).cards) == ids(try start(seed: 5).cards))
        let rounds = try Set([1.0, 2, 3, 4, 5].map { ids(try start(seed: $0).cards).joined(separator: ",") })
        #expect(rounds.count > 1)
    }

    @Test func passesTheHistoryToTheDealer() throws {
        let history: History = [
            "c1": CardHistory(seen: 1, lastCorrect: false, lastSeenAt: 1),
            "c2": CardHistory(seen: 1, lastCorrect: false, lastSeenAt: 2),
        ]
        let dealt = ids(try start(history: history).cards)
        #expect(dealt.contains("c1"))
        #expect(dealt.contains("c2"))
    }

    // The web compares with deal(..., {count: 10}); task 2 pins that this equals dealChunk with nothing dealt.
    @Test func dealsTheFirstChunkOfItsSeed() throws {
        for seed in 1...20 {
            let expected = dealChunk(pool(40), [:], createRng(Double(seed)), [])
            #expect(ids(try start(seed: Double(seed)).cards) == ids(expected), "seed \(seed)")
        }
    }

    @Test func keepsWhatItDealsFrom() throws {
        let cards = pool(40)
        #expect(try start(pool: cards).source == DealSource(pool: cards, history: [:], seed: 1, chunks: 1))
    }

    @Test(arguments: Mode.allCases)
    func startsARoundInEveryMode(mode: Mode) throws {
        let state = try start(mode)
        #expect(state.phase == .question)
        #expect(state.cards.count == 10)
        #expect((state.clock != nil) == (mode == .timed))
    }

    @Test func rejectsAnEmptyPool() {
        #expect(throws: RoundError(message: "The route aws-clf-c02/CON has no cards to deal.")) {
            try start(pool: [])
        }
    }

    @Test func showsTheFirstCardAndNoAnswerAtTheStart() throws {
        let state = try start()
        #expect(currentCard(state) == state.cards[0])
        #expect(lastAnswer(state) == nil)
    }

    @Test func recordsARightAnswerAndShowsTheVerdict() throws {
        let state = try start()
        let first = state.cards[0]
        let after = reduce(state, .answer(value: first.answer, at: 1234))
        let expected = Answered(card: first, given: first.answer, correct: true, at: 1234)
        #expect(after.phase == .answered)
        #expect(after.index == 0)
        #expect(after.answers == [expected])
        #expect(lastAnswer(after) == expected)
    }

    @Test func recordsAWrongAnswerAsNotCorrect() throws {
        let state = try start()
        let first = state.cards[0]
        let after = reduce(state, .answer(value: !first.answer, at: 50))
        #expect(after.answers == [Answered(card: first, given: !first.answer, correct: false, at: 50)])
    }

    @Test func keepsTheCardOnScreenWhileTheVerdictShows() throws {
        let state = try start()
        #expect(currentCard(reduce(state, .answer(value: true, at: 1000))) == state.cards[0])
    }

    @Test func ignoresNextBeforeTheCardIsAnswered() throws {
        let state = try start()
        #expect(reduce(state, .next) == state)
    }

    @Test func aClassicRoundIgnoresATick() throws {
        let state = try start()
        #expect(reduce(state, .tick(now: 5)) == state)
    }

    @Test func ignoresASecondAnswerToTheSameCard() throws {
        let answered = play(try start(), [.answer(value: true, at: 10)])
        let again = reduce(answered, .answer(value: false, at: 20))
        #expect(again == answered)
        #expect(again.answers.count == 1)
    }

    @Test func movesToTheNextCardOnNext() throws {
        let state = try start()
        let after = play(state, [.answer(value: true, at: 1000), .next])
        #expect(after.phase == .question)
        #expect(after.index == 1)
        #expect(currentCard(after) == state.cards[1])
    }

    @Test func finishesAfterTheTenthCardNotBefore() throws {
        var state = try start()
        for _ in 0..<9 { state = play(state, answerRight(state)) }
        #expect(state.phase == .question)
        #expect(state.index == 9)
        state = play(state, [.answer(value: true, at: 1000)])
        #expect(state.phase == .answered)
        state = play(state, [.next])
        #expect(state.phase == .finished)
        #expect(state.answers.count == 10)
        #expect(state.abandoned == false)
        #expect(currentCard(state) == nil)
    }

    @Test func finishesAfterTheLastCardWhenThePoolHasFewerThanTen() throws {
        var state = try start(size: 3)
        for _ in 0..<3 { state = play(state, answerRight(state)) }
        #expect(state.phase == .finished)
        #expect(state.answers.count == 3)
    }

    @Test func finishesARoundOfASingleCard() throws {
        let state = play(try start(size: 1), [.answer(value: false, at: 1000), .next])
        #expect(state.phase == .finished)
        #expect(state.answers.count == 1)
    }

    @Test func recordsEveryCardOnceInTheOrderDealt() throws {
        var state = try start()
        for i in 0..<10 { state = play(state, [.answer(value: i % 3 == 0, at: Double(100 + i)), .next]) }
        #expect(ids(state.answers.map(\.card)) == ids(state.cards))
        #expect(state.answers.map(\.at) == [100, 101, 102, 103, 104, 105, 106, 107, 108, 109])
    }

    @Test func ignoresAnswerAndNextOnceFinished() throws {
        let finished = play(try start(size: 2), [.answer(value: true, at: 1000), .next, .answer(value: true, at: 1000), .next])
        #expect(reduce(finished, .answer(value: true, at: 1000)) == finished)
        #expect(reduce(finished, .next) == finished)
    }

    @Test func endsAsAbandonedFromTheQuestionPhaseKeepingTheAnswers() throws {
        let state = play(try start(), [.answer(value: true, at: 1000), .next, .abandon])
        #expect(state.phase == .finished)
        #expect(state.abandoned)
        #expect(state.answers.count == 1)
    }

    @Test func endsAsAbandonedFromTheAnsweredPhase() throws {
        let state = play(try start(), [.answer(value: true, at: 1000), .abandon])
        #expect(state.phase == .finished)
        #expect(state.abandoned)
        #expect(state.answers.count == 1)
    }

    @Test func endsAsAbandonedBeforeAnyAnswer() throws {
        let state = play(try start(), [.abandon])
        #expect(state.phase == .finished)
        #expect(state.abandoned)
        #expect(state.answers.isEmpty)
    }

    @Test func canAbandonAtEveryPointOfARound() throws {
        let begin = try start()
        let events = Array(repeating: [RoundEvent.answer(value: true, at: 1000), .next], count: 10).flatMap { $0 }
        for cut in 0..<events.count {
            let left = play(begin, Array(events.prefix(cut)) + [.abandon])
            #expect(left.abandoned, "cut \(cut)")
            #expect(left.phase == .finished, "cut \(cut)")
            #expect(left.answers.count == (cut + 1) / 2, "cut \(cut)")
        }
        #expect(play(begin, events).abandoned == false)
    }

    @Test func ignoresAbandonOnceTheRoundHasFinishedNormally() throws {
        let finished = play(try start(size: 1), [.answer(value: true, at: 1000), .next])
        #expect(reduce(finished, .abandon) == finished)
    }

    @Test func ignoresAnswerNextAndAbandonAfterAbandoning() throws {
        let left = play(try start(), [.abandon])
        #expect(reduce(left, .answer(value: true, at: 1000)) == left)
        #expect(reduce(left, .next) == left)
        #expect(reduce(left, .abandon) == left)
    }

    @Test func summarisesAFinishedClassicRound() throws {
        var state = try start()
        let wrongAt: Set<Int> = [2, 5, 7]
        for i in 0..<10 {
            let right = currentCard(state)?.answer ?? true
            state = play(state, [.answer(value: wrongAt.contains(i) ? !right : right, at: Double(500 + i)), .next])
        }
        let result = summarise(state)
        #expect(result.mode == .classic)
        #expect(result.route == route)
        #expect(result.score == 7)
        #expect(result.total == 10)
        #expect(result.answers.count == 10)
        #expect(ids(result.missed.map(\.card)) == ids([state.cards[2], state.cards[5], state.cards[7]]))
        #expect(result.missed.allSatisfy { !$0.correct })
        #expect(result.abandoned == false)
    }

    @Test func summarisesAPerfectRoundWithNoMissedCards() throws {
        var state = try start()
        for _ in 0..<10 { state = play(state, answerRight(state)) }
        let result = summarise(state)
        #expect([result.score, result.total] == [10, 10])
        #expect(result.missed.isEmpty)
        #expect(result.abandoned == false)
    }

    @Test func summarisesARoundOfASmallPoolOutOfTheCardsItHad() throws {
        var state = try start(size: 4)
        for _ in 0..<4 { state = play(state, answerRight(state)) }
        let result = summarise(state)
        #expect([result.score, result.total] == [4, 4])
        #expect(result.abandoned == false)
    }

    @Test func summarisesAnAbandonedRoundWithTheAnswersGivenSoFar() throws {
        var state = try start()
        let first = state.cards[0]
        state = play(state, [.answer(value: !first.answer, at: 1), .next])
        state = play(state, answerRight(state))
        state = play(state, [.abandon])
        let result = summarise(state)
        #expect([result.score, result.total] == [1, 2])
        #expect(result.abandoned)
        #expect(result.missed.map(\.card) == [first])
    }

    @Test func summarisesARoundAbandonedBeforeAnyAnswerAsZeroOutOfZero() throws {
        let result = summarise(play(try start(), [.abandon]))
        #expect(result == RoundResult(mode: .classic, route: route, score: 0, total: 0, answers: [], missed: [], abandoned: true))
    }

    @Test func playsAPoolThatListsACardTwiceAsARoundOfItsDistinctCards() throws {
        var state = try start(pool: pool(6) + pool(6))
        #expect(state.cards.count == 6)
        for _ in 0..<6 { state = play(state, answerRight(state)) }
        #expect(state.phase == .finished)
        #expect(Set(state.answers.map(\.card.id)).count == 6)
        let result = summarise(state)
        #expect([result.score, result.total] == [6, 6])
    }
}
