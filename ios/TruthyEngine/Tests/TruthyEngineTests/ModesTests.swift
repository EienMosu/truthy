import Testing
@testable import TruthyEngine

// tests/engine/modes.test.ts: chunkSeed, Streak, Three lives, Classic's rule, leaving, scoreOf, the seed and
// the stored history of every chunk. (Its token test, the Timed hold against design/system/tokens.json, is
// task 8's: the generated Tokens.swift carries the 700.)
@Suite("Round: the four classes")
struct ModesTests: RoundTesting {
    @Test func chunkSeedIsTheSeedForTheFirstChunkAndADifferentUInt32ForEachLaterOne() {
        #expect(chunkSeed(12345, 0) == 12345)
        let seeds = (0..<5).map { chunkSeed(12345, $0) }
        #expect(Set(seeds).count == 5)
        #expect(seeds.allSatisfy { $0 == $0.rounded(.down) && $0 >= 0 && $0 <= 4_294_967_295 })
        #expect(chunkSeed(4_294_967_295, 1) == 2_654_435_768)
    }

    // Reference 3.3, computed from the TypeScript: chunkSeed(12345, 1...5).
    @Test func chunkSeedWrapsAsTheTypeScriptDoes() {
        #expect((1...5).map { chunkSeed(12345, $0) } == [2_654_448_114, 1_013_916_587, 3_668_352_356, 2_027_820_829, 387_289_302])
    }

    @Test func streakGoesOnAfterARightAnswerAndDealsASecondChunkAfterCardTen() throws {
        let state = rightTimes(try start(.streak), 10)
        #expect(state.phase == .question)
        #expect(state.index == 10)
        #expect(state.cards.count == 20)
        #expect(Set(ids(state.cards)).count == 20)
        #expect(state.source.chunks == 2)
    }

    @Test func streakIsDecidedByTheFirstWrongAnswerAndNextFinishesIt() throws {
        let wrong = give(rightTimes(try start(.streak), 3), false)
        #expect(wrong.phase == .answered)
        #expect(isDecided(wrong))
        let done = play(wrong, [.next])
        #expect(done.phase == .finished)
        #expect(done.abandoned == false)
        #expect(done.index == 3)
        let result = summarise(done)
        #expect(result.mode == .streak)
        #expect([result.score, result.total] == [3, 4])
        #expect(result.abandoned == false)
        #expect(ids(result.missed.map(\.card)) == [wrong.cards[3].id])
    }

    @Test func streakIsNotDecidedByARightAnswer() throws {
        #expect(isDecided(give(try start(.streak), true)) == false)
    }

    @Test func streakScoresZeroWhenTheFirstAnswerIsWrong() throws {
        #expect(summarise(play(give(try start(.streak), false), [.next])).score == 0)
    }

    @Test func streakIgnoresASecondAnswerToTheEndingCard() throws {
        let wrong = give(try start(.streak), false)
        #expect(reduce(wrong, .answer(value: true, at: 2000)) == wrong)
    }

    @Test func streakDealsTheSameRoundForTheSameSeedAcrossChunks() throws {
        let a = rightTimes(try start(.streak, seed: 77), 25)
        let b = rightTimes(try start(.streak, seed: 77), 25)
        #expect(ids(b.cards) == ids(a.cards))
        #expect(ids(rightTimes(try start(.streak, seed: 78), 25).cards) != ids(a.cards))
    }

    @Test func streakNeverRunsOutOfCardsOnAnElevenCardRoute() throws {
        let state = rightTimes(try start(.streak, size: 11), 30)
        #expect(state.phase == .question)
        #expect(state.answers.count == 30)
        #expect(Set(ids(Array(state.cards.prefix(11)))).count == 11)
        #expect(currentCard(state) != nil)
    }

    @Test func threeLivesHasThreeLives() throws {
        #expect(LIVES == 3)
        #expect(livesLeft(try start(.lives)) == 3)
    }

    @Test func threeLivesGoesOnAfterTheFirstAndTheSecondWrongAnswer() throws {
        var state = play(give(try start(.lives), false), [.next])
        #expect(state.phase == .question)
        #expect(livesLeft(state) == 2)
        state = play(give(state, false), [.next])
        #expect(state.phase == .question)
        #expect(livesLeft(state) == 1)
    }

    @Test func threeLivesIsDecidedByTheThirdWrongAnswerAndScoresTheCardsAnswered() throws {
        var state = try start(.lives)
        for right in [true, false, true, true, false, true] { state = play(give(state, right), [.next]) }
        let last = give(state, false)
        #expect(isDecided(last))
        #expect(livesLeft(last) == 0)
        #expect(wrongCount(last) == 3)
        let done = play(last, [.next])
        #expect(done.phase == .finished)
        let result = summarise(done)
        #expect(result.mode == .lives)
        #expect([result.score, result.total] == [7, 7])
        #expect(result.abandoned == false)
        #expect(result.missed.count == 3)
    }

    @Test func threeLivesIsNotDecidedByARightAnswerOnTheLastLife() throws {
        var state = try start(.lives)
        for right in [false, false] { state = play(give(state, right), [.next]) }
        #expect(isDecided(give(state, true)) == false)
    }

    @Test func threeLivesPlaysPastTheFirstChunk() throws {
        let state = rightTimes(try start(.lives, size: 12), 12)
        #expect(state.index == 12)
        #expect(state.cards.count > 12)
    }

    @Test func livesLeftNeverGoesBelowZero() throws {
        var state = try start(.lives)
        state.answers = (0..<4).map { Answered(card: card("w\($0)", true), given: false, correct: false, at: Double($0)) }
        #expect(wrongCount(state) == 4)
        #expect(livesLeft(state) == 0)
    }

    @Test func classicIsDecidedByTheAnswerToItsLastCardAndFinishesOnNext() throws {
        let state = rightTimes(try start(.classic), 9)
        #expect(isDecided(state) == false)
        let last = give(state, true)
        #expect(isDecided(last))
        #expect(play(last, [.next]).phase == .finished)
        #expect(last.cards.count == 10)
    }

    @Test func classicIsDecidedByTheLastCardOfAShortRoute() throws {
        #expect(isDecided(give(try start(.classic, size: 1), false)))
    }

    @Test(arguments: Mode.allCases)
    func aRoundThatIsLeftIsAbandonedAndKeepsItsAnswers(mode: Mode) throws {
        let left = play(give(try start(mode), true), [.abandon])
        #expect(left.phase == .finished)
        #expect(left.abandoned)
        let result = summarise(left)
        #expect(result.abandoned)
        #expect(result.total == 1)
    }

    @Test func aDecidedRoundThatIsLeftIsAbandonedOnlyNextFinishesItWithItsScore() throws {
        let streak = give(rightTimes(try start(.streak), 5), false)
        let classic = give(rightTimes(try start(.classic), 9), true)
        var lives = try start(.lives)
        for right in [false, false] { lives = play(give(lives, right), [.next]) }
        lives = give(lives, false)
        for decided in [streak, classic, lives] {
            #expect(isDecided(decided))
            let left = play(decided, [.abandon])
            #expect(left.phase == .finished)
            #expect(left.abandoned)
            let done = play(decided, [.next])
            #expect(done.phase == .finished)
            #expect(done.abandoned == false)
        }
    }

    @Test func returnsAFinishedRoundAsItIs() throws {
        let done = play(give(try start(.streak), false), [.next])
        #expect(reduce(done, .abandon) == done)
    }

    @Test func isDecidedIsFalseOnceFinished() throws {
        let done = play(give(try start(.streak), false), [.next])
        #expect(isDecided(done) == false)
    }

    @Test func scoreOfIsTheNumberEachModesRecordKeeps() {
        let answers = [true, true, false, true].enumerated().map { i, correct in
            Answered(card: card("s\(i)", true), given: correct, correct: correct, at: Double(i))
        }
        #expect(scoreOf(.classic, answers) == 3)
        #expect(scoreOf(.timed, answers) == 3)
        #expect(scoreOf(.streak, answers) == 2)
        #expect(scoreOf(.lives, answers) == 4)
        #expect(Mode.allCases.map { scoreOf($0, []) } == [0, 0, 0, 0])
    }

    // Chunk k of a round is dealt with createRng(chunkSeed(seed, k)), after the cards already dealt.
    @Test func dealsChunkOneAndTwoWithChunkSeedOneAndTwo() throws {
        let seed: Double = 4242
        let state = rightTimes(try start(.streak, seed: seed), 20)
        let first10 = Array(state.cards.prefix(10))
        #expect(ids(first10) == ids(dealChunk(pool(40), [:], createRng(chunkSeed(seed, 0)), [])))
        let chunk1 = dealChunk(pool(40), [:], createRng(chunkSeed(seed, 1)), first10)
        #expect(ids(Array(state.cards[10..<20])) == ids(chunk1))
        let chunk2 = dealChunk(pool(40), [:], createRng(chunkSeed(seed, 2)), first10 + chunk1)
        #expect(ids(Array(state.cards[20..<30])) == ids(chunk2))
    }

    // Every chunk of an unbounded round is dealt from the stored history, not only the first: nine missed
    // cards of both answers over a pool of forty, three per chunk.
    @Test(arguments: [Mode.streak, .lives, .timed])
    func dealsThreeMissedCardsInEachOfTheFirstThreeChunks(mode: Mode) throws {
        let missedIds = ["c1", "c4", "c9", "c12", "c17", "c20", "c25", "c28", "c33"]
        var history: History = [:]
        for (i, id) in missedIds.enumerated() { history[id] = CardHistory(seen: 2, lastCorrect: false, lastSeenAt: Double(100 + i)) }
        for seed in 1...40 {
            var state = try start(mode, seed: Double(seed), history: history)
            var now = T0
            while state.answers.count < 21 {
                state = reduce(state, .answer(value: currentCard(state)?.answer ?? true, at: now))
                if mode == .timed {
                    let answered = state.answers.count
                    while state.answers.count == answered && state.phase == .stamped {
                        now += 100
                        state = reduce(state, .tick(now: now))
                    }
                } else {
                    state = reduce(state, .next)
                }
            }
            let missedIn = [0, 10, 20].map { from in state.cards[from..<(from + 10)].filter { missedIds.contains($0.id) }.count }
            #expect(missedIn == [3, 3, 3], "seed \(seed)")
        }
    }
}
