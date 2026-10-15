### Task 3: The round reducer, the four classes and the Timed clock

This task ports `src/engine/round.ts` to the Swift engine line by line: the constants, the round state and its events, `startRound`, the pure `reduce` with the Classic, Streak, Three lives and Timed rules, the Timed clock with its stamp hold and its pause, the state readers (`currentCard`, `lastAnswer`, `wrongCount`, `livesLeft`, `isDecided`), `chunkSeed`, `scoreOf` and `summarise`. It is the heart of parity (spec success criterion 1): the round coordinator of task 11 only feeds this reducer events, so a Timed clock edge or a chunk seed that differs from the web here changes every round the app plays. The web's four round test files are ported first as Swift Testing suites, then the reducer, then the golden vectors plan A exported from the same TypeScript.

Builds on task 1 (content types, `createRng`, the golden loader) and task 2 (`dealChunk`, `CHUNK`). Nothing in the app target uses it yet.

**Files:**
- Create: `ios/TruthyEngine/Sources/TruthyEngine/Round.swift`
- Test: create `ios/TruthyEngine/Tests/TruthyEngineTests/RoundTesting.swift` (fixtures), `RoundTests.swift`, `ModesTests.swift`, `TimedTests.swift`, `RoundVectors.swift` (vector decoding and encoding), `RoundGoldenTests.swift`, all in `ios/TruthyEngine/Tests/TruthyEngineTests/`

**Interfaces:**
- Consumes, from task 1 (engine): `Card` (`Codable`, the shipped key names), `Route(deckId:sectionId:)`, `Mode` (`String`-backed, `CaseIterable`, cases `classic`, `streak`, `lives`, `timed`), `CardHistory(seen:lastCorrect:lastSeenAt:)`, `History`, `Answered(card:given:correct:at:)`, `RoundResult(mode:route:score:total:answers:missed:abandoned:)` (memberwise, `score` and `total` are `Int`, `answers` and `missed` are `[Answered]`), `createRng(_ seed: Double) -> Rng`.
- Consumes, from task 2: `public let CHUNK: Int` (10) and `public func dealChunk(_ pool: [Card], _ history: History, _ rng: Rng, _ dealt: [Card], <budget defaulting to SEARCH_BUDGET>) -> [Card]`; this task calls it with the first four arguments only, so the budget's type does not matter here.
- Consumes, from task 1 (test support in `TruthyEngineTests/Support`): `JSONValue` with the cases `.null`, `.bool(Bool)`, `.number(Double)`, `.string(String)`, `.array([JSONValue])`, `.object([String: JSONValue])`; `GoldenFile` with `function: String`, `cards: [String: JSONValue]` (the raw card table), `cases: [GoldenCase]` and `decode(_ type:, _ value:)` (resolves `$card` and the other tags, then decodes); `GoldenCase` with `name: String`, `input: JSONValue`, `output: JSONValue`; `Golden.load(_ module: String, _ function: String) throws -> GoldenFile`, called with two string literals (`Golden.load("src/engine/round", "reduce")` reads `native-data/golden/src.engine.round.reduce.json`), which is how task 1's coverage test sees the suite read a file.
- Consumes, from plan A task 6: the files `native-data/golden/src.engine.round.<name>.json` for `startRound`, `reduce`, `currentCard`, `lastAnswer`, `wrongCount`, `livesLeft`, `isDecided`, `summarise`, `scoreOf`, `chunkSeed`, and `src.engine.round.<NAME>.json` for the constants `CLASSIC_LENGTH`, `LIVES`, `TIMED`, in these case shapes: `startRound` has `input: {"args": <StartArgs>}` and a snapshot or `{"$throws": ...}` as output; `reduce` has `input: {"start", "events"}` and one snapshot per state (the start state first); the six readers have the same input and one value per state (`{"$undefined": true}` for an undefined `currentCard` or `lastAnswer`); `scoreOf` has `input: {"mode", "answers"}`; `chunkSeed` has `input: {"seed", "chunk"}`; the constants have `input: null`.
- Produces (later tasks rely on these exactly; the names are the README's, the members mirror `round.ts`):

```swift
public let CLASSIC_LENGTH: Int                      // = CHUNK, 10
public let LIVES: Int                               // 3
public struct TimedSettings: Equatable, Sendable { public let roundMs: Double; public let holdMs: Double; public let maxStepMs: Double }
public let TIMED: TimedSettings                     // 60_000, 700, 1_000
public enum Phase: String, Equatable, Sendable { case question, answered, stamped, finished }
public struct Clock: Equatable, Sendable { public var remainingMs: Double; public var lastTick: Double?; public var hidden: Bool; public var holdMs: Double }
public struct DealSource: Equatable, Sendable { public var pool: [Card]; public var history: History; public var seed: Double; public var chunks: Int }
public struct RoundState: Equatable, Sendable { mode, route, cards, index, answers, phase, abandoned, source: DealSource, clock: Clock? }
public enum RoundEvent: Equatable, Sendable { case answer(value: Bool, at: Double), next, tick(now: Double), visibility(hidden: Bool, at: Double), abandon }
public struct StartArgs: Equatable, Sendable { public var mode: Mode; public var route: Route; public var pool: [Card]; public var history: History; public var seed: Double }
public struct RoundError: Error, Equatable, Sendable { public let message: String }
public func chunkSeed(_ seed: Double, _ chunk: Int) -> Double
public func startRound(_ args: StartArgs) throws -> RoundState     // throws RoundError for an empty pool
public func currentCard(_ state: RoundState) -> Card?
public func lastAnswer(_ state: RoundState) -> Answered?
public func wrongCount(_ state: RoundState) -> Int
public func livesLeft(_ state: RoundState) -> Int
public func isDecided(_ state: RoundState) -> Bool
public func reduce(_ state: RoundState, _ event: RoundEvent) -> RoundState
public func scoreOf(_ mode: Mode, _ answers: [Answered]) -> Int
public func summarise(_ state: RoundState) -> RoundResult
```

  Every struct above has a public memberwise initialiser in the order shown. Task 9 stores the seed as `UInt32` in the journal and passes `Double(seed)`; task 11 builds `StartArgs`, sends events with wall-clock epoch milliseconds floored to integers (reference 3.3, "Which clock") and reads the state through the functions above. `Clock` is this module's struct: in a file that imports SwiftUI or Foundation as well as `TruthyEngine`, `Clock` resolves to it (checked while drafting); the standard library's clock protocol is then `_Concurrency.Clock`.

  Note on the golden support: the names above are task 1's (`Support/JSONValue.swift` and `Support/Golden.swift`). Task 1's `JSONValue` keeps `{"$number": ...}` tags as objects, so `RoundVectors.number` and `RoundVectors.normalized` read them; `RoundVectors.card` goes through `GoldenFile.decode`, because the card table holds raw JSON. The thirteen golden files are each loaded with two string literals in `RoundGoldenTests.swift`, for task 1's coverage test.

**Rules** (reference 3.3, read again from `src/engine/round.ts`):

1. **Start.** `startRound` throws `RoundError` with the message `The route <deckId>/<sectionId> has no cards to deal.` for an empty pool, and otherwise deals chunk 0 with `createRng(chunkSeed(seed, 0))`. The TypeScript also throws `The mode "<mode>" is not available.` for an unknown mode; a `Mode` value cannot be unknown, so the golden test checks that the vector holds exactly that message for a mode string that is not a `Mode`. Timed starts with `Clock(remainingMs: 60_000, lastTick: nil, hidden: false, holdMs: 0)`, the other classes with `clock: nil`.
2. **Chunks.** Chunk k is `dealChunk(pool, history, createRng(chunkSeed(seed, k)), cards dealt so far)`, appended to `cards`, and `source.chunks` becomes k + 1. The stored history is passed to every chunk, not only the first. `advance` deals the next chunk only when `index + 1` reaches `cards.count`. Classic never deals a second chunk, because it is decided at its last card.
3. **`chunkSeed(seed, chunk)`** is `(seed + Math.imul(chunk, 0x9e3779b9)) >>> 0`: the product wraps to a signed 32-bit integer, the sum is a double, and `>>> 0` truncates towards zero and takes it modulo 2^32. Pinned: `chunkSeed(12345, 0) == 12345`, `chunkSeed(0xffffffff, 1) == 2654435768`, `chunkSeed(12345, 1...5) == 2654448114, 1013916587, 3668352356, 2027820829, 387289302`.
4. **`reduce`** returns a state equal to the one given (the TypeScript returns the same object) when the round is finished, when the event's time is not finite (`answer.at`, `tick.now`, `visibility.at`; `next` and `abandon` count as time 0), or when the event does not apply: an answer outside `question`, a `next` outside `answered` on a round that is not decided, a tick or visibility event without a clock.
5. **Phases.** Classic, Streak and Three lives go `question`, `answered` (on an answer), `question` (on `next`). Timed goes `question`, `stamped` (on an answer), `question` (when the hold has been counted down on ticks); it never enters `answered`. A `next` on a decided round finishes it with `abandoned` false; `abandon` finishes any unfinished round with `abandoned` true, decided or not.
6. **Decided** (`isDecided`, false once finished): Classic in `answered` with `index + 1 >= cards.count`; Streak in `answered` with the last answer wrong; Three lives in `answered` with 3 or more wrong answers; Timed when `clock.remainingMs == 0`.
7. **The Timed clock**, every time on the one wall clock in epoch milliseconds:
   - `elapsed` is 0 while hidden or before the first counted moment, otherwise `min(max(now - lastTick, 0), 1000)`: a step back counts nothing, a step longer than a second counts one second. `countTo` counts `elapsed` off (never below 0) and sets `lastTick = now`; it changes nothing while hidden. The first tick or the first answer arms the clock.
   - An answer counts the clock up to `at` first. If that reaches 0, the answer is not recorded and the phase becomes `stamped` with the hold unchanged; otherwise the answer is recorded, the phase becomes `stamped` and the hold is 700. An answer while hidden is recorded with its hold, which waits until the app is shown.
   - A tick does nothing at 0 or while hidden. When the clock reaches 0 the hold is set to 0, a card being stamped advances (its answer counts; the card now on screen does not) and the phase is `stamped`. Otherwise, while stamped, the hold drops by the same elapsed time and the next card comes when it reaches 0.
   - `visibility` does nothing at 0 or when `hidden` already has the event's value. Showing sets `hidden = false, lastTick = at`. Hiding first runs the whole tick logic at `at`, then pauses (`hidden = true, lastTick = nil`) unless the clock reached 0, which is time up and stays visible.
8. **Scores.** Classic and Timed: correct answers. Streak: the longest run of correct answers. Three lives: answers given. `total` is the number of answers; `missed` is the wrong answers in order. `livesLeft` is `max(0, 3 - wrongCount)`.
9. **Port details.** `max(x, 0)` keeps the zero second, so a negative zero comes out as +0 as `Math.max(0, x)` gives. `currentCard` and `recordAnswer` check the index against `cards` before reading (the TypeScript reads `undefined`). The engine stays pure: `Round.swift` imports nothing, and task 1's purity test scans it.

**Which tests ran while this plan was drafted:** all six test files and `Round.swift`, exactly as below, ran with `swift build` and `swift test` (Swift 6.3.3, Swift 6 language mode) in a scratch package next to stand-ins for tasks 1 and 2 written from the README and the TypeScript (`dealChunk` ported from `deal.ts`). The three behaviour suites passed with 93 tests. The golden suite ran against a fixture in plan A's format with all thirteen round files, computed by running `src/engine/round.ts` (16 traces of the four classes, including NaN and infinite times, time up during a stamp, an answer while hidden, a stored history and Streak rounds of three chunks); it passed with 6 tests, and failed in the constants test, `reduceTraces` and `stateReaderVectors` when `maxStepMs` was changed to 999. That run used a stand-in loader with a one-argument `Golden.load`; the review fix pass then moved `RoundVectors.card` and `RoundGoldenTests.swift` to task 1's loader (two-literal loads, `decode` for cards) and stated the whole-package counts of steps 7 and 13. The README's drafting record says what of that was compiled again. The golden suite runs against the real `native-data/golden` only once plan A has exported it, which the README requires before task 1.

**Steps:**

- [ ] **Step 1: Write the round test fixtures.**

Create `ios/TruthyEngine/Tests/TruthyEngineTests/RoundTesting.swift`. The helpers are members of a protocol extension, so a suite that conforms calls them unqualified while a global `card` or `pool` of another task's tests can never clash with them. The test cards are decoded from the shipped card shape, so they need nothing of `Card` but its `Codable` conformance.

```swift
import Foundation
@testable import TruthyEngine

// The fixtures of the web's round tests (tests/engine/round.test.ts, modes.test.ts, timed.test.ts,
// clock-polish.test.ts), as members of a protocol so that the names never clash with other test files.
protocol RoundTesting {}

extension RoundTesting {
    var route: Route { Route(deckId: "aws-clf-c02", sectionId: "CON") }
    var T0: Double { 1_700_000_000_000 } // the web tests' wall-clock origin, in epoch ms

    // c1, c3, c5 and so on are True, c2, c4 and so on False. Decoded from the shipped card shape.
    func card(_ id: String, _ answer: Bool) -> Card {
        let json = """
            {"id":"\(id)","section":"CON","text":{"en":{"statement":"Statement \(id)","explanation":"Explanation \(id)"}},\
            "answer":\(answer),"source":{"title":"AWS documentation","url":"https://docs.aws.amazon.com/"},\
            "difficulty":1,"appliesTo":"","conflictGroups":[]}
            """
        return try! JSONDecoder().decode(Card.self, from: Data(json.utf8))
    }

    func pool(_ n: Int) -> [Card] {
        (0..<n).map { card("c\($0 + 1)", $0 % 2 == 0) }
    }

    func start(_ mode: Mode = .classic, size: Int = 40, seed: Double = 1, history: History = [:], pool given: [Card]? = nil) throws -> RoundState {
        try startRound(StartArgs(mode: mode, route: route, pool: given ?? pool(size), history: history, seed: seed))
    }

    func play(_ state: RoundState, _ events: [RoundEvent]) -> RoundState {
        events.reduce(state) { TruthyEngine.reduce($0, $1) }
    }

    // Answers the card on screen right or wrong (no next).
    func give(_ state: RoundState, _ right: Bool, at: Double = 1000) -> RoundState {
        let truth = currentCard(state)?.answer ?? true
        return play(state, [.answer(value: right ? truth : !truth, at: at)])
    }

    // Answers the card on screen right, then next.
    func answerRight(_ state: RoundState, at: Double = 1000) -> [RoundEvent] {
        [.answer(value: currentCard(state)?.answer ?? true, at: at), .next]
    }

    // Answers `count` cards right, pressing next after each.
    func rightTimes(_ state: RoundState, _ count: Int) -> RoundState {
        var s = state
        for _ in 0..<count { s = play(give(s, true), [.next]) }
        return s
    }

    // Ticks every `step` ms from `from` (exclusive) to `to` (inclusive).
    func ticks(_ from: Double, _ to: Double, step: Double = 100) -> [RoundEvent] {
        var events: [RoundEvent] = []
        var now = from + step
        while now <= to {
            events.append(.tick(now: now))
            now += step
        }
        return events
    }

    func hide(_ at: Double) -> RoundEvent { .visibility(hidden: true, at: at) }
    func show(_ at: Double) -> RoundEvent { .visibility(hidden: false, at: at) }

    // A Timed round of a 40-card pool whose clock the first tick at T0 has started.
    func timed(size: Int = 40, seed: Double = 1) throws -> RoundState {
        play(try start(.timed, size: size, seed: seed), [.tick(now: T0)])
    }

    // The clock one tick before zero, on the first card, nothing answered.
    func nearlyUp() throws -> RoundState {
        play(try timed(), ticks(T0, T0 + 59_900))
    }

    func ids(_ cards: [Card]) -> [String] { cards.map(\.id) }
}
```

- [ ] **Step 2: Port `tests/engine/round.test.ts`.**

Create `ios/TruthyEngine/Tests/TruthyEngineTests/RoundTests.swift`:

```swift
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
```

- [ ] **Step 3: Port `tests/engine/modes.test.ts`.**

Create `ios/TruthyEngine/Tests/TruthyEngineTests/ModesTests.swift`. Two tests go beyond the web file: `chunkSeedWrapsAsTheTypeScriptDoes` pins reference 3.3's five computed seeds, and `livesLeftNeverGoesBelowZero` pins the floor of `livesLeft`, which no reachable state shows.

```swift
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
```

- [ ] **Step 4: Port `tests/engine/timed.test.ts` and `clock-polish.test.ts`.**

Create `ios/TruthyEngine/Tests/TruthyEngineTests/TimedTests.swift`. Besides the web's cases it pins five edges reference 3.3 states and no web test plays: a step of exactly one second, the first answer arming the clock, an answer while hidden, hiding after the hold ran out, and hiding at zero during a stamp.

```swift
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
```

- [ ] **Step 5: Run the tests and watch them fail.**

```bash
swift test --package-path ios/TruthyEngine --filter "RoundTests|ModesTests|TimedTests"
```

Expected: the build of `TruthyEngineTests` fails before any test runs, with errors such as `error: cannot find type 'RoundState' in scope`, `error: cannot find 'reduce' in scope` and `error: cannot find 'isDecided' in scope`.

- [ ] **Step 6: Write the round.**

Create `ios/TruthyEngine/Sources/TruthyEngine/Round.swift`, the port of `src/engine/round.ts` in the same order:

```swift
// The round: a pure reducer over the dealt cards, a line-by-line port of src/engine/round.ts.
// Randomness comes only from the seed given to startRound; time comes in on the events.

public let CLASSIC_LENGTH = CHUNK // a Classic round is the first chunk
public let LIVES = 3

// Timed: the length of the round, how long the stamp stays before the next card, and the most time one
// tick may count (a longer gap is a sleep the app did not report).
public struct TimedSettings: Equatable, Sendable {
    public let roundMs: Double
    public let holdMs: Double
    public let maxStepMs: Double

    public init(roundMs: Double, holdMs: Double, maxStepMs: Double) {
        self.roundMs = roundMs
        self.holdMs = holdMs
        self.maxStepMs = maxStepMs
    }
}

public let TIMED = TimedSettings(roundMs: 60_000, holdMs: 700, maxStepMs: 1_000)

public enum Phase: String, Equatable, Sendable {
    case question, answered, stamped, finished
}

// The Timed clock. It only moves on events: lastTick is the moment up to which time has been counted
// (nil before the first tick and while hidden); holdMs is what is left of the stamp.
public struct Clock: Equatable, Sendable {
    public var remainingMs: Double
    public var lastTick: Double?
    public var hidden: Bool
    public var holdMs: Double

    public init(remainingMs: Double, lastTick: Double?, hidden: Bool, holdMs: Double) {
        self.remainingMs = remainingMs
        self.lastTick = lastTick
        self.hidden = hidden
        self.holdMs = holdMs
    }
}

// What the next chunk is dealt from: the route's cards, the stored history, the round's seed and how many
// chunks it has dealt.
public struct DealSource: Equatable, Sendable {
    public var pool: [Card]
    public var history: History
    public var seed: Double
    public var chunks: Int

    public init(pool: [Card], history: History, seed: Double, chunks: Int) {
        self.pool = pool
        self.history = history
        self.seed = seed
        self.chunks = chunks
    }
}

public struct RoundState: Equatable, Sendable {
    public var mode: Mode
    public var route: Route
    public var cards: [Card] // every card dealt so far, in order; the unbounded modes add a chunk when they run out
    public var index: Int // index of the current card
    public var answers: [Answered]
    public var phase: Phase
    public var abandoned: Bool
    public var source: DealSource
    public var clock: Clock? // Timed only

    public init(
        mode: Mode, route: Route, cards: [Card], index: Int, answers: [Answered], phase: Phase,
        abandoned: Bool, source: DealSource, clock: Clock?
    ) {
        self.mode = mode
        self.route = route
        self.cards = cards
        self.index = index
        self.answers = answers
        self.phase = phase
        self.abandoned = abandoned
        self.source = source
        self.clock = clock
    }
}

public enum RoundEvent: Equatable, Sendable {
    case answer(value: Bool, at: Double)
    case next
    case tick(now: Double)
    case visibility(hidden: Bool, at: Double)
    case abandon
}

public struct StartArgs: Equatable, Sendable {
    public var mode: Mode
    public var route: Route
    public var pool: [Card]
    public var history: History
    public var seed: Double

    public init(mode: Mode, route: Route, pool: [Card], history: History, seed: Double) {
        self.mode = mode
        self.route = route
        self.pool = pool
        self.history = history
        self.seed = seed
    }
}

// What startRound throws, with the message the TypeScript Error carries.
public struct RoundError: Error, Equatable, Sendable {
    public let message: String

    public init(message: String) {
        self.message = message
    }
}

// The seed of chunk k of a round: the round's seed for the first chunk, then steps of the 32-bit golden
// ratio. (seed + Math.imul(chunk, 0x9e3779b9)) >>> 0: the product wraps to a signed 32-bit integer, the sum
// is a double, and >>> 0 takes it modulo 2^32.
public func chunkSeed(_ seed: Double, _ chunk: Int) -> Double {
    let step = Int32(bitPattern: UInt32(truncatingIfNeeded: chunk) &* 0x9e37_79b9)
    return Double(roundUnsigned32(seed + Double(step)))
}

// JavaScript's x >>> 0 for a double: truncate towards zero, then modulo 2^32; not finite gives 0.
private func roundUnsigned32(_ value: Double) -> UInt32 {
    guard value.isFinite else { return 0 }
    var wrapped = value.rounded(.towardZero).truncatingRemainder(dividingBy: 4_294_967_296)
    if wrapped < 0 { wrapped += 4_294_967_296 }
    return UInt32(wrapped)
}

private func withNextChunk(_ state: RoundState) -> RoundState {
    let source = state.source
    let chunk = dealChunk(source.pool, source.history, createRng(chunkSeed(source.seed, source.chunks)), state.cards)
    var next = state
    next.cards = state.cards + chunk
    next.source.chunks = source.chunks + 1
    return next
}

// Throws for an empty pool. The TypeScript also throws for a mode it does not know; a Mode value is always
// one of the four, so that case cannot be built here (the golden test checks the vector says so).
public func startRound(_ args: StartArgs) throws -> RoundState {
    if args.pool.isEmpty {
        throw RoundError(message: "The route \(args.route.deckId)/\(args.route.sectionId) has no cards to deal.")
    }
    return withNextChunk(
        RoundState(
            mode: args.mode,
            route: args.route,
            cards: [],
            index: 0,
            answers: [],
            phase: .question,
            abandoned: false,
            source: DealSource(pool: args.pool, history: args.history, seed: args.seed, chunks: 0),
            clock: args.mode == .timed ? Clock(remainingMs: TIMED.roundMs, lastTick: nil, hidden: false, holdMs: 0) : nil
        )
    )
}

// The card on screen; nil once the round is finished.
public func currentCard(_ state: RoundState) -> Card? {
    guard state.phase != .finished, state.cards.indices.contains(state.index) else { return nil }
    return state.cards[state.index]
}

public func lastAnswer(_ state: RoundState) -> Answered? {
    state.answers.last
}

public func wrongCount(_ state: RoundState) -> Int {
    state.answers.filter { !$0.correct }.count
}

public func livesLeft(_ state: RoundState) -> Int {
    max(0, LIVES - wrongCount(state))
}

// Decided: the mode's end rule has been met and only the result is left to show. No answer can change the
// score any more; the next event finishes the round.
public func isDecided(_ state: RoundState) -> Bool {
    if state.phase == .finished { return false }
    switch state.mode {
    case .classic:
        return state.phase == .answered && state.index + 1 >= state.cards.count
    case .streak:
        return state.phase == .answered && lastAnswer(state)?.correct == false
    case .lives:
        return state.phase == .answered && wrongCount(state) >= LIVES
    case .timed:
        guard let clock = state.clock else { return false }
        return clock.remainingMs == 0
    }
}

// Pure: returns a new state, or a state equal to the one given when the event does not apply.
// An event whose time is not a finite number does not apply: one NaN would make the Timed clock NaN for good,
// and a clock that is never 0 never ends the round.
public func reduce(_ state: RoundState, _ event: RoundEvent) -> RoundState {
    if state.phase == .finished { return state }
    if !timeOf(event).isFinite { return state }
    switch event {
    case let .answer(value, at):
        return state.phase == .question ? recordAnswer(state, value, at) : state
    case .next:
        if isDecided(state) {
            var finished = state
            finished.phase = .finished
            return finished
        }
        return state.phase == .answered ? advance(state) : state
    case let .tick(now):
        guard let clock = state.clock else { return state }
        return onTick(state, clock, now)
    case let .visibility(hidden, at):
        guard let clock = state.clock else { return state }
        return onVisibility(state, clock, hidden, at)
    case .abandon:
        var left = state
        left.phase = .finished
        left.abandoned = true
        return left
    }
}

// The moment an event happened; 0 for the events that carry no time.
private func timeOf(_ event: RoundEvent) -> Double {
    switch event {
    case let .answer(_, at): return at
    case let .visibility(_, at): return at
    case let .tick(now): return now
    case .next, .abandon: return 0
    }
}

// To the next card as a question. When the dealt cards run out, the next chunk is dealt first
// (dealChunk never returns an empty chunk).
private func advance(_ state: RoundState) -> RoundState {
    let index = state.index + 1
    var dealt = index < state.cards.count ? state : withNextChunk(state)
    dealt.index = index
    dealt.phase = .question
    return dealt
}

private func recordAnswer(_ state: RoundState, _ given: Bool, _ at: Double) -> RoundState {
    guard state.cards.indices.contains(state.index) else { return state }
    let card = state.cards[state.index]
    let answers = state.answers + [Answered(card: card, given: given, correct: given == card.answer, at: at)]
    var next = state
    guard let running = state.clock else {
        next.answers = answers
        next.phase = .answered
        return next
    }
    // Timed: the clock runs up to the answer first. An answer at or after zero does not count.
    let clock = countTo(running, at)
    if clock.remainingMs == 0 {
        next.clock = clock
        next.phase = .stamped
        return next
    }
    var held = clock
    held.holdMs = TIMED.holdMs
    next.answers = answers
    next.phase = .stamped
    next.clock = held
    return next
}

// The time to count between the last counted moment and `now`: none while hidden or before the first
// tick, never negative (a clock source may jump back), at most maxStepMs. The zero is the second argument
// of max so that a negative zero comes out as +0, as Math.max(0, x) gives.
private func elapsed(_ clock: Clock, _ now: Double) -> Double {
    guard !clock.hidden, let lastTick = clock.lastTick else { return 0 }
    return min(max(now - lastTick, 0), TIMED.maxStepMs)
}

private func countTo(_ clock: Clock, _ now: Double) -> Clock {
    if clock.hidden { return clock }
    var counted = clock
    counted.remainingMs = max(clock.remainingMs - elapsed(clock, now), 0)
    counted.lastTick = now
    return counted
}

private func onTick(_ state: RoundState, _ clock: Clock, _ now: Double) -> RoundState {
    if clock.remainingMs == 0 || clock.hidden { return state }
    let passed = elapsed(clock, now)
    let counted = countTo(clock, now)
    if counted.remainingMs == 0 {
        // Time is up. A card that was being stamped has been answered in time: it leaves, and the card that
        // does not count is the next one.
        var stopped = counted
        stopped.holdMs = 0
        var withStopped = state
        withStopped.clock = stopped
        var onCard = state.phase == .stamped ? advance(withStopped) : withStopped
        onCard.phase = .stamped
        return onCard
    }
    var next = state
    if state.phase != .stamped {
        next.clock = counted
        return next
    }
    let holdMs = max(clock.holdMs - passed, 0)
    var held = counted
    held.holdMs = holdMs
    next.clock = held
    if holdMs > 0 { return next }
    return advance(next)
}

private func onVisibility(_ state: RoundState, _ clock: Clock, _ hidden: Bool, _ at: Double) -> RoundState {
    if clock.remainingMs == 0 || clock.hidden == hidden { return state }
    if !hidden {
        var shown = clock
        shown.hidden = false
        shown.lastTick = at
        var next = state
        next.clock = shown
        return next
    }
    // Hiding counts the time up to this moment, as a tick does, then pauses.
    let counted = onTick(state, clock, at)
    guard let countedClock = counted.clock, countedClock.remainingMs != 0 else { return counted }
    var paused = countedClock
    paused.hidden = true
    paused.lastTick = nil
    var next = counted
    next.clock = paused
    return next
}

// The number a mode's record keeps (spec section 6, "Modes").
public func scoreOf(_ mode: Mode, _ answers: [Answered]) -> Int {
    switch mode {
    case .classic, .timed:
        return answers.filter { $0.correct }.count
    case .streak:
        return longestRun(answers)
    case .lives:
        return answers.count
    }
}

private func longestRun(_ answers: [Answered]) -> Int {
    var longest = 0
    var run = 0
    for answer in answers {
        run = answer.correct ? run + 1 : 0
        longest = max(longest, run)
    }
    return longest
}

public func summarise(_ state: RoundState) -> RoundResult {
    RoundResult(
        mode: state.mode,
        route: state.route,
        score: scoreOf(state.mode, state.answers),
        total: state.answers.count,
        answers: state.answers,
        missed: state.answers.filter { !$0.correct },
        abandoned: state.abandoned
    )
}
```

- [ ] **Step 7: Run the round suites, then the whole package.**

```bash
swift test --package-path ios/TruthyEngine --filter "RoundTests|ModesTests|TimedTests"
swift test --package-path ios/TruthyEngine
```

Expected: the first command ends with `✔ Test run with 93 tests in 3 suites passed` (36 in `RoundTests`, 24 in `ModesTests`, 33 in `TimedTests`; a parameterised test counts once). The second ends with `✔ Test run with 174 tests in 14 suites passed after ... with 1 known issue` (task 2's 81 in 11 suites plus these 93 in 3), with `everyGoldenFileHasATest()` skipped: task 1's purity test now scans `Round.swift` and finds nothing, and the golden tests of tasks 1 and 2 still pass. No warning mentions `Round.swift`.

- [ ] **Step 8: Commit the round.**

```bash
git add ios/TruthyEngine/Sources/TruthyEngine/Round.swift ios/TruthyEngine/Tests/TruthyEngineTests/RoundTesting.swift ios/TruthyEngine/Tests/TruthyEngineTests/RoundTests.swift ios/TruthyEngine/Tests/TruthyEngineTests/ModesTests.swift ios/TruthyEngine/Tests/TruthyEngineTests/TimedTests.swift
pnpm vitest run tests/repo-hygiene.test.ts
git commit -m "feat: port the round reducer, the four classes and the Timed clock to the Swift engine, with the web's round, modes, timed and clock tests"
```

Expected: the hygiene test passes with the staged files in its scan (`git ls-files` lists staged files), then the commit is created on `native`. Where `pnpm` is not installed, run it as `npx -y pnpm@10.34.0 vitest run tests/repo-hygiene.test.ts`.

- [ ] **Step 9: Write the vector decoding and encoding.**

Create `ios/TruthyEngine/Tests/TruthyEngineTests/RoundVectors.swift`. It reads the round's inputs (start arguments, events, answers, tagged numbers, card references) and writes Swift values back in the vector's JSON shape, so each snapshot is compared with one `==`:

```swift
@testable import TruthyEngine

// Reads the round's golden vectors (plan A, "The golden vector format") and writes round values back in the
// same JSON shape, so a test compares a whole snapshot with one ==. Everything is namespaced here so that
// no name clashes with another test file.
enum RoundVectors {
    struct Failure: Error, CustomStringConvertible {
        let description: String
    }

    static func object(_ value: JSONValue) throws -> [String: JSONValue] {
        guard case let .object(fields) = value else { throw Failure(description: "expected an object, got \(value)") }
        return fields
    }

    static func array(_ value: JSONValue) throws -> [JSONValue] {
        guard case let .array(items) = value else { throw Failure(description: "expected an array, got \(value)") }
        return items
    }

    static func string(_ value: JSONValue) throws -> String {
        guard case let .string(text) = value else { throw Failure(description: "expected a string, got \(value)") }
        return text
    }

    static func bool(_ value: JSONValue) throws -> Bool {
        guard case let .bool(flag) = value else { throw Failure(description: "expected a boolean, got \(value)") }
        return flag
    }

    static func field(_ fields: [String: JSONValue], _ key: String) throws -> JSONValue {
        guard let value = fields[key] else { throw Failure(description: "missing key \(key) in \(fields)") }
        return value
    }

    // A plain number, or one of the tagged numbers JSON cannot carry.
    static func number(_ value: JSONValue) throws -> Double {
        switch value {
        case let .number(number):
            return number
        case let .object(fields):
            switch try string(field(fields, "$number")) {
            case "NaN": return .nan
            case "Infinity": return .infinity
            case "-Infinity": return -.infinity
            case "-0": return -0.0
            case let other: throw Failure(description: "unknown tagged number \(other)")
            }
        default:
            throw Failure(description: "expected a number, got \(value)")
        }
    }

    static func int(_ value: JSONValue) throws -> Int {
        let parsed = try number(value)
        guard let whole = Int(exactly: parsed) else { throw Failure(description: "expected an integer, got \(parsed)") }
        return whole
    }

    // A {"$card": id} reference, decoded through the file's card table (task 1's loader resolves it). Round
    // vectors use the web tests' own cards, never a whole shipped deck.
    static func card(_ value: JSONValue, _ file: GoldenFile) throws -> Card {
        try file.decode(Card.self, value)
    }

    static func route(_ value: JSONValue) throws -> Route {
        let fields = try object(value)
        return Route(deckId: try string(field(fields, "deckId")), sectionId: try string(field(fields, "sectionId")))
    }

    static func history(_ value: JSONValue) throws -> History {
        var history: History = [:]
        for (id, entry) in try object(value) {
            let fields = try object(entry)
            history[id] = CardHistory(
                seen: try int(field(fields, "seen")),
                lastCorrect: try bool(field(fields, "lastCorrect")),
                lastSeenAt: try number(field(fields, "lastSeenAt"))
            )
        }
        return history
    }

    // The mode as the vector spells it: a string that is not a Mode is the TypeScript's unknown-mode case.
    static func modeName(ofStart value: JSONValue) throws -> String {
        try string(field(object(value), "mode"))
    }

    static func startArgs(_ value: JSONValue, _ file: GoldenFile) throws -> StartArgs {
        let fields = try object(value)
        let name = try string(field(fields, "mode"))
        guard let mode = Mode(rawValue: name) else { throw Failure(description: "unknown mode \(name)") }
        return StartArgs(
            mode: mode,
            route: try route(field(fields, "route")),
            pool: try array(field(fields, "pool")).map { try card($0, file) },
            history: try history(field(fields, "history")),
            seed: try number(field(fields, "seed"))
        )
    }

    static func event(_ value: JSONValue) throws -> RoundEvent {
        let fields = try object(value)
        switch try string(field(fields, "type")) {
        case "answer":
            return .answer(value: try bool(field(fields, "value")), at: try number(field(fields, "at")))
        case "next":
            return .next
        case "tick":
            return .tick(now: try number(field(fields, "now")))
        case "visibility":
            return .visibility(hidden: try bool(field(fields, "hidden")), at: try number(field(fields, "at")))
        case "abandon":
            return .abandon
        case let other:
            throw Failure(description: "unknown event type \(other)")
        }
    }

    static func answered(_ value: JSONValue, _ file: GoldenFile) throws -> Answered {
        let fields = try object(value)
        return Answered(
            card: try card(field(fields, "card"), file),
            given: try bool(field(fields, "given")),
            correct: try bool(field(fields, "correct")),
            at: try number(field(fields, "at"))
        )
    }

    // A trace: the state startRound returned, then the state after each event.
    static func replay(_ input: JSONValue, _ file: GoldenFile) throws -> [RoundState] {
        let fields = try object(input)
        var state = try startRound(startArgs(field(fields, "start"), file))
        var states = [state]
        for event in try array(field(fields, "events")) {
            state = reduce(state, try self.event(event))
            states.append(state)
        }
        return states
    }

    // Tagged numbers in an expected value become plain numbers, so that a loader that keeps the tags and one
    // that resolves them compare the same.
    static func normalized(_ value: JSONValue) -> JSONValue {
        switch value {
        case let .array(items):
            return .array(items.map(normalized))
        case let .object(fields):
            if fields.count == 1, fields["$number"] != nil, let parsed = try? number(value) {
                return .number(parsed)
            }
            return .object(fields.mapValues(normalized))
        default:
            return value
        }
    }

    static let undefined: JSONValue = .object(["$undefined": .bool(true)])

    static func encode(_ card: Card) -> JSONValue {
        .object(["$card": .string(card.id)])
    }

    static func encode(_ route: Route) -> JSONValue {
        .object(["deckId": .string(route.deckId), "sectionId": .string(route.sectionId)])
    }

    static func encode(_ answer: Answered) -> JSONValue {
        .object([
            "card": encode(answer.card),
            "given": .bool(answer.given),
            "correct": .bool(answer.correct),
            "at": .number(answer.at),
        ])
    }

    static func encode(_ clock: Clock?) -> JSONValue {
        guard let clock else { return .null }
        return .object([
            "remainingMs": .number(clock.remainingMs),
            "lastTick": clock.lastTick.map { .number($0) } ?? .null,
            "hidden": .bool(clock.hidden),
            "holdMs": .number(clock.holdMs),
        ])
    }

    // The snapshot of plan A's format: the state's own fields, with source replaced by its chunk count.
    static func encode(_ state: RoundState) -> JSONValue {
        .object([
            "mode": .string(state.mode.rawValue),
            "route": encode(state.route),
            "cards": .array(state.cards.map(encode)),
            "index": .number(Double(state.index)),
            "answers": .array(state.answers.map(encode)),
            "phase": .string(state.phase.rawValue),
            "abandoned": .bool(state.abandoned),
            "chunks": .number(Double(state.source.chunks)),
            "clock": encode(state.clock),
        ])
    }

    static func encode(_ result: RoundResult) -> JSONValue {
        .object([
            "mode": .string(result.mode.rawValue),
            "route": encode(result.route),
            "score": .number(Double(result.score)),
            "total": .number(Double(result.total)),
            "answers": .array(result.answers.map(encode)),
            "missed": .array(result.missed.map(encode)),
            "abandoned": .bool(result.abandoned),
        ])
    }

    static func encode(_ number: Int) -> JSONValue {
        .number(Double(number))
    }

    // What each state reader returns, in the vector's shape; nil is the TypeScript's undefined.
    static func read(_ function: String, _ state: RoundState) throws -> JSONValue {
        switch function {
        case "currentCard": return currentCard(state).map { encode($0) } ?? undefined
        case "lastAnswer": return lastAnswer(state).map { encode($0) } ?? undefined
        case "wrongCount": return encode(wrongCount(state))
        case "livesLeft": return encode(livesLeft(state))
        case "isDecided": return .bool(isDecided(state))
        case "summarise": return encode(summarise(state))
        default: throw Failure(description: "no reader named \(function)")
        }
    }
}
```

- [ ] **Step 10: Write the golden tests.**

Create `ios/TruthyEngine/Tests/TruthyEngineTests/RoundGoldenTests.swift`. Every case of every file is checked, and a trace is compared state by state, reporting the first differing state with its case name:

```swift
import Testing
@testable import TruthyEngine

// The round against the vectors the TypeScript computed (native-data/golden/src.engine.round.*.json): every
// case of every file, every state of every trace. A trace is replayed once per file and compared state by
// state; the first differing state is reported with the case name.
@Suite("Round: golden vectors")
struct RoundGoldenTests {
    typealias V = RoundVectors

    @Test func classicLengthLivesAndTimedAreTheWebConstants() throws {
        let classic = try Golden.load("src/engine/round", "CLASSIC_LENGTH")
        let lives = try Golden.load("src/engine/round", "LIVES")
        let timed = try Golden.load("src/engine/round", "TIMED")
        #expect(V.normalized(classic.cases[0].output) == V.encode(CLASSIC_LENGTH))
        #expect(V.normalized(lives.cases[0].output) == V.encode(LIVES))
        #expect(V.normalized(timed.cases[0].output) == .object([
            "roundMs": .number(TIMED.roundMs), "holdMs": .number(TIMED.holdMs), "maxStepMs": .number(TIMED.maxStepMs),
        ]))
    }

    @Test func chunkSeedVectors() throws {
        let file = try Golden.load("src/engine/round", "chunkSeed")
        #expect(!file.cases.isEmpty)
        for c in file.cases {
            let input = try V.object(c.input)
            let seed = try V.number(V.field(input, "seed"))
            let chunk = try V.int(V.field(input, "chunk"))
            #expect(chunkSeed(seed, chunk) == (try V.number(c.output)), "\(c.name)")
        }
    }

    @Test func scoreOfVectors() throws {
        let file = try Golden.load("src/engine/round", "scoreOf")
        #expect(!file.cases.isEmpty)
        for c in file.cases {
            let input = try V.object(c.input)
            let mode = try #require(Mode(rawValue: try V.string(V.field(input, "mode"))))
            let answers = try V.array(V.field(input, "answers")).map { try V.answered($0, file) }
            #expect(scoreOf(mode, answers) == (try V.int(c.output)), "\(c.name)")
        }
    }

    @Test func startRoundVectors() throws {
        let file = try Golden.load("src/engine/round", "startRound")
        #expect(!file.cases.isEmpty)
        for c in file.cases {
            let start = try V.field(V.object(c.input), "args")
            let expected = V.normalized(c.output)
            let mode = try V.modeName(ofStart: start)
            guard Mode(rawValue: mode) != nil else {
                // A Mode value is always one of the four: the TypeScript's unknown-mode throw cannot be built in Swift.
                #expect(expected == .object(["$throws": .string("The mode \"\(mode)\" is not available.")]), "\(c.name)")
                continue
            }
            let actual: JSONValue
            do {
                actual = V.encode(try startRound(V.startArgs(start, file)))
            } catch let error as RoundError {
                actual = .object(["$throws": .string(error.message)])
            }
            #expect(actual == expected, "\(c.name)")
        }
    }

    @Test func reduceTraces() throws {
        let file = try Golden.load("src/engine/round", "reduce")
        #expect(!file.cases.isEmpty)
        for c in file.cases {
            let states = try V.replay(c.input, file)
            let expected = try V.array(c.output).map(V.normalized)
            #expect(states.count == expected.count, "\(c.name): one snapshot per event plus the start")
            for (index, (state, snapshot)) in zip(states, expected).enumerated() where V.encode(state) != snapshot {
                Issue.record("\(c.name): state \(index) differs.\nexpected: \(snapshot)\nactual:   \(V.encode(state))")
                break
            }
        }
    }

    // Each reader's file is loaded with two string literals, so task 1's coverage test sees all six.
    private static func readerFile(_ function: String) throws -> GoldenFile {
        switch function {
        case "currentCard": try Golden.load("src/engine/round", "currentCard")
        case "lastAnswer": try Golden.load("src/engine/round", "lastAnswer")
        case "wrongCount": try Golden.load("src/engine/round", "wrongCount")
        case "livesLeft": try Golden.load("src/engine/round", "livesLeft")
        case "isDecided": try Golden.load("src/engine/round", "isDecided")
        default: try Golden.load("src/engine/round", "summarise")
        }
    }

    @Test(arguments: ["currentCard", "lastAnswer", "wrongCount", "livesLeft", "isDecided", "summarise"])
    func stateReaderVectors(function: String) throws {
        let file = try Self.readerFile(function)
        #expect(file.function == function)
        #expect(!file.cases.isEmpty)
        for c in file.cases {
            let states = try V.replay(c.input, file)
            let expected = try V.array(c.output).map(V.normalized)
            #expect(states.count == expected.count, "\(c.name): one value per state")
            for (index, (state, value)) in zip(states, expected).enumerated() {
                let actual = try V.read(file.function, state)
                if actual != value {
                    Issue.record("\(c.name): \(file.function) of state \(index) is \(actual), expected \(value)")
                    break
                }
            }
        }
    }
}
```

- [ ] **Step 11: Run the golden tests.**

```bash
swift test --package-path ios/TruthyEngine --filter RoundGoldenTests
```

Expected: `✔ Test run with 6 tests in 1 suite passed`. A failure names the case and the first state that differs; fix `Round.swift`, never the vectors (they are generated by plan A and the drift test guards them). If `Golden.load` throws because a file is missing, plan A's export does not hold the round files: stop and report, do not skip.

- [ ] **Step 12: Check that the vectors bite.**

```bash
sed -i '' 's/maxStepMs: 1_000)/maxStepMs: 999)/' ios/TruthyEngine/Sources/TruthyEngine/Round.swift
swift test --package-path ios/TruthyEngine --filter RoundGoldenTests
git checkout -- ios/TruthyEngine/Sources/TruthyEngine/Round.swift
git status --short ios/TruthyEngine
```

Expected: the run fails, at least in `classicLengthLivesAndTimedAreTheWebConstants()`, `reduceTraces()` and `stateReaderVectors(function:)` (a one-second tick now counts 999 ms), and ends with `✘ Test run with 6 tests in 1 suite failed`. After the checkout, `git status --short ios/TruthyEngine` lists only the two new test files of steps 9 and 10 (`?? ...RoundGoldenTests.swift`, `?? ...RoundVectors.swift`).

- [ ] **Step 13: Run the whole package and the web tests.**

```bash
swift test --package-path ios/TruthyEngine
pnpm test
```

Expected: `✔ Test run with 180 tests in 15 suites passed after ... with 1 known issue`, with `everyGoldenFileHasATest()` skipped; then every Vitest file passes (the web code is untouched; `pnpm test` is the README's gate that the web stays green).

- [ ] **Step 14: Commit the golden tests.**

```bash
git add ios/TruthyEngine/Tests/TruthyEngineTests/RoundVectors.swift ios/TruthyEngine/Tests/TruthyEngineTests/RoundGoldenTests.swift
pnpm vitest run tests/repo-hygiene.test.ts
git commit -m "test: check the Swift round against the round golden vectors: every trace state by state, the readers, startRound, scoreOf, chunkSeed and the constants"
```

Expected: the hygiene test passes and the commit is created. `git status --short` shows nothing left from this task.
