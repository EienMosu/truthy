### Task 6: Play copy, leaving, the result, the ticket scroll, the flight path, the headers, the barcode, `ticketFor` and the contrast pairs; every golden file now required

This task ports the last 34 entries of reference 3.9 into the engine: the words of the play screen (`components/play/PlayScreen.tsx`), the leave rules (`components/play/leave.ts`), the result copy and recording a round once (`components/play/resultCopy.ts`, `ResultView.tsx`), the missed-card list (`components/MissedCards.tsx`), the ticket's route words (`components/play/useRound.ts`: `ticketFor`), the ticket scroll arithmetic (`components/play/ticketScroll.ts`), the flight path geometry and labels (`components/FlightPath.tsx`), the Streak, Three lives and Timed headers (`StreakPath.tsx`, `LivesPath.tsx`, `TimedPath.tsx`), the barcode (`components/BoardingPass.tsx`) and the contrast pairs of the design system (`tests/tokens/contrast.test.ts`, spec 5.9). The guard constants `NEXT_ARRIVES_MS`, `RESULT_ARRIVES_MS`, `SPOKEN_RELEASE_MS` and `ARROW_STEP` become public constants, so task 11's guards and task 13's announcements use them instead of literals.

Its last step turns on the coverage gate of task 1: from then on a golden file without a test fails `swift test` (spec 7.1).

Builds on tasks 1 to 5: the round reducer and its readers (task 3), `LocalStore`, `applyResult`, `ApplyOutcome` and `Comparison` (task 4), `plainText`, `deckPassName`, `modeInfo` and `RouteInIndex` (task 5), `pad2` and `jsRound` (task 1); test support `RoundVectors` and `RoundTesting` (task 3), `ProgressGolden` (task 4).

**Files:**
- Create: `ios/TruthyEngine/Sources/TruthyEngine/JSMath.swift`, `PlayCopy.swift`, `Leave.swift`, `ResultCopy.swift`, `MissedCards.swift`, `Ticket.swift`, `TicketScroll.swift`, `FlightPath.swift`, `Headers.swift`, `Barcode.swift`, `Contrast.swift` (all in `ios/TruthyEngine/Sources/TruthyEngine/`)
- Test: create `JSMathTests.swift`, `PlayCopyTests.swift`, `LeaveTests.swift`, `ResultCopyTests.swift`, `TicketScrollTests.swift`, `FlightPathTests.swift`, `HeadersTests.swift`, `BarcodeTests.swift`, `ContrastTests.swift`, `PlayCopyGoldenTests.swift`, `ResultGoldenTests.swift`, `TicketScrollGoldenTests.swift`, `FlightPathGoldenTests.swift`, `HeadersGoldenTests.swift`, `ContrastGoldenTests.swift` (all in `ios/TruthyEngine/Tests/TruthyEngineTests/`)
- Modify: `ios/TruthyEngine/Tests/TruthyEngineTests/GoldenCoverageTests.swift` (one line, step 13)

**Interfaces:**
- Consumes: task 3's `RoundState`, `RoundEvent`, `reduce`, `currentCard`, `lastAnswer`, `livesLeft`, `isDecided`, `scoreOf`, `summarise`, `TIMED`, `LIVES`; task 4's `LocalStore` (`load()`, `save(_:)`), `applyResult`, `ApplyOutcome`, `Comparison`; task 5's `plainText`, `deckPassName`, `modeInfo`, `RouteInIndex`; task 1's `pad2`, `jsRound`; test support `RoundVectors.replay(_:_:)` (task 3), `ProgressGolden` (task 4), `RoundTesting` (task 3), and the 34 files of plan A task 8 (`components.play.PlayScreen.*`, `components.play.leave.*`, `components.play.resultCopy.resultCopy`, `components.play.ResultView.*`, `components.MissedCards.missedCards`, `components.play.useRound.ticketFor`, `components.play.ticketScroll.*`, `components.FlightPath.*`, `components.StreakPath.*`, `components.LivesPath.*`, `components.TimedPath.*`, `components.BoardingPass.barcodeBars`, `design.system.tokens.contrastPairs`; constants are `<module>.<NAME>.json` like functions). Their shapes are plan A task 8's rules 2 to 8: a function of a round takes the trace `{start, events}` and further keys; the store is `progress` (the stored JSON or null) and `storage` (`"works"` or `"full"`); `recordRound` also takes `calls` and answers `{writes, sameOutcome, outcome, stored}`; `resultCopy`'s `best` is an object from sampled records to text; `streakLayout.t` and `trailLayout.x` are objects from probe to value.
- Produces (public, `TruthyEngine`):

```swift
// JSMath.swift (internal)
func jsNumberString(_ x: Double) -> String         // Number.prototype.toString: 60 -> "60", 0.5 -> "0.5", -0 -> "0", 1e21 -> "1e+21"
func jsMathMax(_ a: Double, _ b: Double) -> Double  // Math.max: NaN wins, +0 above -0
func jsMathMin(_ a: Double, _ b: Double) -> Double  // Math.min: NaN wins, -0 below +0

// PlayCopy.swift
public let NEXT_ARRIVES_MS: Double                  // 420
public let SPOKEN_RELEASE_MS: Double                // 150
public func verdictText(_ correct: Bool, _ answer: Bool, _ newBest: Bool = false) -> String
public func roundStatus(_ round: RoundState) -> String
public func timedStatus(_ round: RoundState) -> String
public func timedCardText(_ round: RoundState) -> String

// Leave.swift
public func leavesSomething(_ round: RoundState) -> Bool
public func saveLeftRound(_ round: RoundState, _ store: LocalStore)

// ResultCopy.swift
public struct ResultField: Equatable, Sendable { public let label: String; public let value: String }
public struct ResultCopy: Sendable { public let fields: [ResultField]; public let scoreLabel: String; public let unit: String?; public let best: @Sendable (Int) -> String; public let ended: String; public let endedDetail: String; public let label: String; public let marks: Int; public let ring: Int? }
public func resultCopy(_ result: RoundResult, _ modeName: String, _ dealt: Int, _ previousBest: Int?) -> ResultCopy
public let RESULT_ARRIVES_MS: Double                // 1000
public final class RecordedRounds { public init() }  // the web's WeakMap: rounds already written, with their outcome
public func recordRound(_ round: RoundState, _ store: LocalStore, _ recorded: RecordedRounds) -> ApplyOutcome

// MissedCards.swift
public struct MissedCard: Equatable, Sendable { public let number: Int; public let given: Bool; public let answer: Bool; public let appliesTo: String?; public let statement: String; public let explanation: String; public let source: CardSource }
public func missedCards(_ answers: [Answered]) -> [MissedCard]

// Ticket.swift
public struct TicketInfo: Equatable, Sendable { public let deckCode: String; public let deckName: String; public let sectionCode: String; public let sectionName: String; public let modeLabel: String; public let best: Int? }
public func ticketFor(_ found: RouteInIndex, _ mode: Mode, _ best: Int?) -> TicketInfo

// TicketScroll.swift
public struct Span: Codable, Equatable, Sendable { public let top: Double; public let bottom: Double }
public struct SlipScrollAt: Codable, Equatable, Sendable { public let top: Double; public let visible: Double; public let gap: Double; public let max: Double }
public struct KeyScrollAt: Codable, Equatable, Sendable { public let top: Double; public let visible: Double; public let max: Double }
public func statementScroll(_ text: Span, _ visible: Double) -> Double
public func slipScroll(_ slip: Span, _ at: SlipScrollAt) -> Double?
public let ARROW_STEP: Double                       // 40
public func keyScroll(_ key: String, _ shift: Bool, _ at: KeyScrollAt) -> Double?

// FlightPath.swift
public struct Point: Codable, Equatable, Sendable { public let x: Double; public let y: Double }
public enum WaypointState: String, Codable, Sendable { case correct, wrong, current, future }
public func pointAt(_ t: Double) -> Point
public func waypointT(_ i: Double, _ n: Double) -> Double
public func flownPath(_ t: Double) -> String
public func headingAt(_ t: Double) -> Double
public func waypointStates(_ total: Int, _ results: [Bool], _ current: Int, _ answered: Bool) -> [WaypointState]
public func cardList(_ numbers: [Int]) -> String
public func flightPathLabel(_ total: Int, _ results: [Bool], _ current: Int) -> String
public func completedLabel(_ total: Int, _ results: [Bool]) -> String
public func completedScale(_ cards: Int) -> Double

// Headers.swift
public struct StreakLayout: Sendable { public let t: @Sendable (Int) -> Double; public let dot: Double; public let ticks: Bool; public let ring: Int?; public let target: Bool; public let future: [Int] }
public func streakLayout(_ done: Int, _ best: Int?) -> StreakLayout
public func streakLabel(_ streak: Int, _ best: Int?, _ ended: Bool) -> String
public struct TrailLayout: Sendable { public let x: @Sendable (Int) -> Double; public let r: Double; public let side: Double; public let cross: Bool }
public func trailLayout(_ marks: Int) -> TrailLayout
public func livesLabel(_ results: [Bool]) -> String
public func clockText(_ remainingMs: Double) -> String
public func timedLabel(_ remainingMs: Double, _ correct: Int, _ wrong: Int) -> String

// Barcode.swift
public struct BarcodeBar: Codable, Equatable, Sendable { public let x: Int; public let width: Int }
public func barcodeBars(_ data: String) -> (bars: [BarcodeBar], width: Int)

// Contrast.swift
public enum ContrastKind: String, Codable, Sendable { case bodyText = "body text", largeText = "large text", nonText = "non-text" }
public struct ContrastPair: Equatable, Sendable { public let foreground: String; public let background: String; public let kind: ContrastKind; public let usedFor: String }
public let CONTRAST_PAIRS: [ContrastPair]           // the 27 pairs of tests/tokens/contrast.test.ts, in order
public func contrastMinimum(_ kind: ContrastKind) -> Double
public func relativeLuminance(_ hex: String) -> Double?
public func contrastRatio(_ foregroundHex: String, _ backgroundHex: String) -> Double?
```

**Rules:**

1. **Numbers in text are JavaScript's.** A number written into a string (`flownPath`, "60 s", "of 60") goes through `jsNumberString`, which is ECMAScript's Number-to-String: integers without a decimal point, `-0` as `0`, the shortest round-trip digits, and exponents only below 1e-6 or from 1e21 on. Swift's `description` writes `138.0` and `1e-05`, which the web never does.
2. **Math.max and Math.min** keep their JavaScript meaning where a `-0` or a `NaN` can reach them (`statementScroll`, `slipScroll`, `keyScroll`): `jsMathMax` and `jsMathMin`. Rounding is task 1's `jsRound`; `round1` and `round2` are `jsRound(x * 10) / 10` and `jsRound(x * 100) / 100`.
3. **`headingAt` uses `atan2`** from Foundation (allowed in the engine; the purity test forbids clocks, randomness, timers, storage and UI, not math). V8's `Math.atan2` and Darwin's may differ in the last bit; after `round2` that matters only on an exact half, and the golden suite would name the case.
4. **`recordRound` writes once per round.** The web remembers recorded rounds in a `WeakMap` keyed by the round object; a Swift `RoundState` is a value, so the memory is a `RecordedRounds` object the caller keeps (task 9's `FileProgressStore` keeps one, inside its actor) and the round is found by equality. The first call for a round loads, applies, saves and keeps the outcome; later calls return the kept outcome without writing.
5. **`saveLeftRound`** is the web's: `reduce` with `next` when the round is decided, `abandon` otherwise, then `applyResult(store.load(), summarise(...))` and `save`. Task 9's journal applies the same leave rules without a `RoundState` (it rebuilds the result from the journal) and its test compares the two.
6. **`resultCopy.best` and the layouts' functions** are Swift closures; the golden suite calls them at every key the vector gives.
7. **`barcodeBars`** reads the first UTF-16 unit of each Unicode scalar (`for (const ch of data)` walks code points; `charCodeAt(0)` is the high surrogate beyond the first plane) and its low seven bits.
8. **Contrast.** `CONTRAST_PAIRS` is the web test's list verbatim (`where` is `usedFor`, a Swift keyword otherwise). The unit test reads the colours from `native-data/tokens/resolved.json`, the file task 8's generator reads, and checks every pair in both themes against its minimum (4.5 body text, 3 large text, 3 non-text), and the decided exceptions: the tagline and the step 6 line are `ink` on the sky, and the focus colour is `ink`. The golden test checks the vector's pairs, colours, ratios and verdicts against the engine and the resolved tokens.
9. **The gate.** Step 13 sets `everyFileRequired` to true in task 1's coverage test: the 130 files of `native-data/golden` must all be loaded by some test, and the run fails otherwise.

**Review focus.** Not one of the README's five lines, but two rules they rest on: `saveLeftRound` and `recordRound` (Review Focus 1 and 5 build on them in tasks 9, 11 and 14), and the constants the guards use.

**Steps:**

- [ ] **Step 1: Check the starting point.**

```bash
git status --short
ls native-data/golden | wc -l
ls native-data/golden | grep -cE '^(components\.(play|MissedCards|FlightPath|StreakPath|LivesPath|TimedPath|BoardingPass)|design\.system\.tokens)'
test -f native-data/tokens/resolved.json && echo tokens-present
swift test --package-path ios/TruthyEngine 2>&1 | tail -1
```

Expected: nothing from `git status --short`; `130`; `34`; `tokens-present`; `Test run with 294 tests in 35 suites passed after ... with 1 known issue`. Other counts mean plan A wrote another set of files: stop and report.

- [ ] **Step 2: Write the tests of the number helpers, the play copy and leaving.**

`ios/TruthyEngine/Tests/TruthyEngineTests/JSMathTests.swift`:

```swift
import Testing
@testable import TruthyEngine

// Values from node: String(x), Math.max, Math.min.
@Suite struct JSMathTests {
    @Test func numbersAreWrittenAsJavaScriptWritesThem() {
        let cases: [(Double, String)] = [
            (60, "60"), (138, "138"), (-6, "-6"), (0.5, "0.5"), (23.85, "23.85"), (-0.0, "0"), (0.1 + 0.2, "0.30000000000000004"),
            (0.00001, "0.00001"), (1e-7, "1e-7"), (1.5e-7, "1.5e-7"), (1e21, "1e+21"), (1.2345e22, "1.2345e+22"),
            (1.2345678901234568e20, "123456789012345680000"), (.infinity, "Infinity"), (-.infinity, "-Infinity"), (.nan, "NaN"),
        ]
        for (x, text) in cases { #expect(jsNumberString(x) == text, "\(x)") }
        #expect(jsMathMax(0, -0.0).sign == .plus)
        #expect(jsMathMin(0, -0.0).sign == .minus)
        #expect(jsMathMax(1, .nan).isNaN)
        #expect(jsMathMin(.nan, 1).isNaN)
    }
}
```

`ios/TruthyEngine/Tests/TruthyEngineTests/PlayCopyTests.swift`:

```swift
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
```

`ios/TruthyEngine/Tests/TruthyEngineTests/LeaveTests.swift`:

```swift
import Testing
@testable import TruthyEngine

// tests/components/play/leave.test.ts, over an in-memory storage that counts its writes (task 4's LocalStoreTests
// has a private MemoryStorage of its own, so this one has another name).
final class CountingStorage: KeyValueStorage {
    var items: [String: String] = [:]
    var full = false
    var writes = 0
    func getItem(_ key: String) throws -> String? { items[key] }
    func setItem(_ key: String, _ value: String) throws {
        if full { throw CountingStorageFull() }
        writes += 1
        items[key] = value
    }
}

struct CountingStorageFull: Error {}

@Suite struct LeaveTests: RoundTesting {
    @Test func aRoundLeftBeforeItsFirstAnswerLeavesNothingUnlessItIsDecided() throws {
        #expect(!leavesSomething(try start(.classic)))
        #expect(leavesSomething(give(try start(.classic), true)))
        let timedOut = play(try timed(), ticks(T0, T0 + 60_000, step: 1000))
        #expect(timedOut.answers.isEmpty && leavesSomething(timedOut))
    }

    @Test func anUndecidedRoundIsKeptAsAbandonedWithNoRecord() throws {
        let storage = CountingStorage()
        let round = play(give(play(give(try start(.classic), true), [.next]), false, at: 2000), [.next])
        saveLeftRound(round, createLocalStore(storage))
        let stored = parseProgress(storage.items[PROGRESS_KEY])
        #expect(stored.cards.count == 2)
        #expect(stored.records.isEmpty)
        #expect(stored.last == LastRound(route: route, mode: .classic, score: nil, total: nil))
    }

    @Test func aDecidedRoundIsRecordedAsItsResultWouldBe() throws {
        let storage = CountingStorage()
        let decided = give(play(give(play(give(try start(.streak), true), [.next]), true, at: 2000), [.next]), false, at: 3000)
        #expect(isDecided(decided))
        saveLeftRound(decided, createLocalStore(storage))
        let stored = parseProgress(storage.items[PROGRESS_KEY])
        #expect(stored.records[recordKey(route, .streak)] == 2)
        #expect(stored.last?.score == 2 && stored.last?.total == 3)
        let full = CountingStorage()
        full.full = true
        saveLeftRound(decided, createLocalStore(full))
        #expect(full.items.isEmpty)
    }
}
```

- [ ] **Step 3: Write the tests of the result, the ticket scroll, the flight path, the headers, the barcode and the contrast.**

`ios/TruthyEngine/Tests/TruthyEngineTests/ResultCopyTests.swift`:

```swift
import Testing
@testable import TruthyEngine

// tests/components/play/resultCopy.test.ts, ResultView.test.tsx (recording) and tests/components/MissedCards.test.tsx.
private func answered(_ card: Card, _ correct: Bool, _ at: Double) -> Answered {
    Answered(card: card, given: correct == card.answer, correct: correct, at: at)
}

@Suite struct ResultCopyTests: RoundTesting {
    private func result(_ mode: Mode, _ verdicts: [Bool]) -> RoundResult {
        let answers = verdicts.enumerated().map { answered(card("c\($0.offset + 1)", $0.offset % 2 == 0), $0.element, Double(1000 + $0.offset)) }
        return RoundResult(mode: mode, route: route, score: scoreOf(mode, answers), total: answers.count, answers: answers,
                           missed: answers.filter { !$0.correct }, abandoned: false)
    }

    @Test func classicCountsOfTheCardsDealt() {
        let copy = resultCopy(result(.classic, [true, true, false, true, true, false, true, true, false, true]), "Classic", 10, nil)
        #expect(copy.fields == [ResultField(label: "Class", value: "Classic"), ResultField(label: "Cards", value: "10 / 10"), ResultField(label: "Wrong", value: "03")])
        #expect(copy.scoreLabel == "Your score" && copy.unit == "of 10" && copy.best(9) == "9 / 10")
        #expect(copy.ended == "Arrived" && copy.endedDetail == " · 10 of 10" && copy.marks == 10 && copy.ring == nil)
        #expect(copy.label == "Round complete. 10 of 10 cards. 7 correct, 3 wrong: cards 3, 6 and 9.")
    }

    @Test func streakRingsThePreviousBestItReached() {
        let copy = resultCopy(result(.streak, [true, true, true, false]), "Streak", 10, 2)
        #expect(copy.fields[1] == ResultField(label: "Cards", value: "04"))
        #expect(copy.scoreLabel == "Correct in a row" && copy.unit == nil && copy.best(12) == "12")
        #expect(copy.label == "Streak over on card 4. 3 correct in a row. Card 4 was wrong.")
        #expect(copy.endedDetail == " · 4 cards" && copy.ring == 1)
        #expect(resultCopy(result(.streak, [true, true, false]), "Streak", 10, 2).ring == 1)
        #expect(resultCopy(result(.streak, [true, false]), "Streak", 10, 5).ring == nil)
        #expect(resultCopy(result(.streak, [true, false]), "Streak", 10, 0).ring == nil)
    }

    @Test func livesAndTimedSayTheirOwnEnds() {
        let lives = resultCopy(result(.lives, [true, false, true, false, false]), "Three lives", 10, nil)
        #expect(lives.fields[1] == ResultField(label: "Correct", value: "02") && lives.unit == "cards" && lives.best(21) == "21 cards")
        #expect(lives.label == "Out of lives after 5 cards. 2 correct, 3 wrong: cards 2, 4 and 5.")
        #expect(lives.ended == "Out of lives" && lives.endedDetail == "")
        let timed = resultCopy(result(.timed, [true]), "Timed", 1, nil)
        #expect(timed.fields == [ResultField(label: "Class", value: "Timed"), ResultField(label: "Time", value: "60 s"), ResultField(label: "Answered", value: "01")])
        #expect(timed.label == "Time is up. 1 card answered in 60 seconds. 1 correct, 0 wrong.")
        #expect(timed.unit == "of 1" && timed.endedDetail == " · 1 card")
        #expect(RESULT_ARRIVES_MS == 1000)
    }

    @Test func aRoundIsRecordedOnceHoweverOftenItIsShown() throws {
        var round = try start(.classic, size: 10)
        for i in 0..<10 { round = play(give(round, true, at: Double(1000 + i)), [.next]) }
        #expect(round.phase == .finished)
        let storage = CountingStorage()
        let store = createLocalStore(storage)
        let recorded = RecordedRounds()
        let first = recordRound(round, store, recorded)
        let second = recordRound(round, store, recorded)
        #expect(first == second)
        #expect(storage.writes == 1)
        #expect(first.isNewBest && first.previousBest == nil)
        #expect(parseProgress(storage.items[PROGRESS_KEY]).records[recordKey(route, .classic)] == 10)
    }

    @Test func theMissedListNumbersTheWrongAnswersByPlace() {
        let a = card("c1", true)
        var applied = card("c2", false)
        applied = Card(id: applied.id, section: applied.section, text: applied.text, answer: false, source: applied.source,
                       difficulty: 1, appliesTo: "Angular v22", conflictGroups: [])
        let missed = missedCards([answered(a, true, 1), answered(applied, false, 2), answered(a, false, 3)])
        #expect(missed.map(\.number) == [2, 3])
        #expect(missed[0].appliesTo == "Angular v22" && missed[1].appliesTo == nil)
        #expect(missed[0].given == true && missed[0].answer == false)
        #expect(missedCards([]).isEmpty)
    }
}
```

`ios/TruthyEngine/Tests/TruthyEngineTests/TicketScrollTests.swift`:

```swift
import Testing
@testable import TruthyEngine

// tests/components/play/ticketScroll.test.ts and tests/components/play/useRound.test.tsx (ticketFor).
@Suite struct TicketScrollTests {
    @Test func aNewCardShowsItsStatementAboveTheActionRow() {
        #expect(statementScroll(Span(top: 100, bottom: 300), 400) == 0)
        #expect(statementScroll(Span(top: 100, bottom: 500), 400) == 100)
        #expect(statementScroll(Span(top: 100, bottom: 450), 400) == 50)
        #expect(statementScroll(Span(top: 0, bottom: 100), 400).sign == .plus)
    }

    @Test func theSlipScrollsInOnlyWhenItIsNotInView() {
        let at = SlipScrollAt(top: 0, visible: 500, gap: 12, max: 300)
        #expect(slipScroll(Span(top: 300, bottom: 512), at) == nil)
        #expect(slipScroll(Span(top: 300, bottom: 513), at) == 300)
        #expect(slipScroll(Span(top: 400, bottom: 700), SlipScrollAt(top: 0, visible: 500, gap: 12, max: 250)) == 250)
        #expect(ARROW_STEP == 40)
        let place = KeyScrollAt(top: 100, visible: 500, max: 600)
        #expect(keyScroll("ArrowDown", false, place) == 140)
        #expect(keyScroll(" ", true, place) == 0)
        #expect(keyScroll("PageDown", false, place) == 560)
        #expect(keyScroll("End", false, place) == 600)
        #expect(keyScroll("ArrowDown", true, place) == nil)
        #expect(keyScroll("a", false, place) == nil)
    }

    @Test func theTicketNamesTheRouteFromTheIndex() {
        let deck = IndexDeck(id: "aws-clf-c02", code: "CLF", title: "Cloud Practitioner", passName: nil, cardCount: 92, version: "v", hash: "h",
                             sections: [IndexSection(id: "SEC", title: "Security and compliance", cardCount: 47)])
        let platform = IndexPlatform(id: "aws", title: "AWS", decks: [deck])
        let area = IndexArea(id: "cloud", title: "Cloud", platforms: [platform])
        let sec = ticketFor(RouteInIndex(area: area, platform: platform, deck: deck, section: deck.sections[0]), .classic, 7)
        #expect(sec == TicketInfo(deckCode: "CLF", deckName: "AWS Cloud Practitioner", sectionCode: "SEC", sectionName: "Security and compliance", modeLabel: "Classic", best: 7))
        let whole = ticketFor(RouteInIndex(area: area, platform: platform, deck: deck, section: nil), .lives, nil)
        #expect(whole.sectionCode == "ALL" && whole.sectionName == "Whole deck" && whole.modeLabel == "Three lives" && whole.best == nil)
    }
}
```

`ios/TruthyEngine/Tests/TruthyEngineTests/FlightPathTests.swift`:

```swift
import Testing
@testable import TruthyEngine

// tests/components/FlightPath.test.tsx and FlightPath-polish.test.tsx.
@Suite struct FlightPathTests {
    @Test func theCurveRunsFromStartToEndThroughItsTop() {
        #expect(pointAt(0) == Point(x: 6, y: 24))
        #expect(pointAt(1) == Point(x: 270, y: 24))
        #expect(pointAt(0.5) == Point(x: 138, y: 9))
        #expect(headingAt(0.5) == 0)
        #expect(headingAt(0) == -12.8)
        #expect(flownPath(0) == "M6 24 Q6 24 6 24")
        #expect(flownPath(1) == "M6 24 Q138 -6 270 24")
    }

    @Test func waypointsSpreadEvenlyAndTakeTheirStates() {
        #expect(waypointT(0, 0) == 0)
        #expect(waypointT(0, 1) == 0)
        #expect(waypointT(2, 5) == 0.5)
        #expect(waypointStates(4, [true, false], 2, false) == [.correct, .wrong, .current, .future])
        #expect(waypointStates(4, [true, false, true], 2, true) == [.correct, .wrong, .correct, .future])
    }

    @Test func theLabelsListTheCards() {
        #expect(cardList([3]) == "card 3")
        #expect(cardList([1, 2]) == "cards 1 and 2")
        #expect(cardList([1, 2, 5]) == "cards 1, 2 and 5")
        #expect(flightPathLabel(10, [], 0) == "Card 1 of 10.")
        #expect(flightPathLabel(10, [true, true, false], 3) == "Card 4 of 10. Cards 1 and 2 correct, card 3 wrong.")
        #expect(flightPathLabel(10, [false], 1) == "Card 2 of 10. Card 1 wrong.")
        #expect(completedLabel(10, [true, true, true]) == "Round complete. 3 of 10 cards. 3 correct, 0 wrong.")
    }

    @Test func marksShrinkOnLongRoutes() {
        #expect(completedScale(10) == 1)
        #expect(completedScale(17) == 6.0 / 7)
        #expect(completedScale(18) == min(6, 0.35 * 264 / 17) / 7)
        #expect(completedScale(60) == min(6, 0.35 * 264 / 59) / 7)
    }
}
```

`ios/TruthyEngine/Tests/TruthyEngineTests/HeadersTests.swift`:

```swift
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
```

`ios/TruthyEngine/Tests/TruthyEngineTests/BarcodeTests.swift`:

```swift
import Testing
@testable import TruthyEngine

// tests/components/BoardingPass.test.tsx (barcodeBars).
@Suite struct BarcodeTests {
    @Test func startAndEndBarsFrameTheData() {
        let empty = barcodeBars("")
        #expect(empty.bars == [BarcodeBar(x: 0, width: 2), BarcodeBar(x: 3, width: 1), BarcodeBar(x: 6, width: 1), BarcodeBar(x: 8, width: 2)])
        #expect(empty.width == 10)
    }

    @Test func eachCharacterIsSevenBitsLeastSignificantFirst() {
        // "A" is 65 = 1000001: bits 1,0,0,0,0,0,1; on, off, on, off, on, off, on; then a 1 wide gap.
        let a = barcodeBars("A")
        #expect(a.bars[2] == BarcodeBar(x: 6, width: 2))
        #expect(a.width == 6 + (2 + 1 + 1 + 1 + 1 + 1 + 2) + 1 + 4)
        // Beyond the first plane only the high surrogate counts: U+1F600 reads as 0xD83D, whose low seven bits are
        // 0111101, widths 2, 1, 2, 2, 2, 2, 1.
        #expect(barcodeBars("😀").width == 6 + 12 + 1 + 4)
        // "é" is one unit, 233, low seven bits 1101001: widths 2, 1, 1, 2, 1, 2, 2.
        #expect(barcodeBars("é").width == 6 + 11 + 1 + 4)
    }
}
```

`ios/TruthyEngine/Tests/TruthyEngineTests/ContrastTests.swift`:

```swift
import Foundation
import Testing
@testable import TruthyEngine

// tests/tokens/contrast.test.ts on the colours natives draw: native-data/tokens/resolved.json, the file task 8's
// generator reads. Spec 5.9: body text 4.5, large text 3, non-text 3, in both themes.
enum ResolvedTokens {
    nonisolated(unsafe) static let json: [String: Any] = {
        let url = Golden.root.appending(path: "native-data/tokens/resolved.json")
        let data = (try? Data(contentsOf: url)) ?? Data("{}".utf8)
        return (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
    }()

    /// The value at a dot path such as "color.primitive.navy-900".
    static func node(_ path: String) -> Any? {
        path.split(separator: ".").reduce(json as Any?) { node, key in (node as? [String: Any])?[String(key)] }
    }

    /// "#rrggbb" of a colour role in a theme ("day" or "night"), following {references}.
    static func hex(_ theme: String, _ role: String) -> String? {
        var value = (node("color.\(theme).\(role)") as? [String: Any])?["$value"]
        for _ in 0..<8 {
            if let reference = value as? String, reference.hasPrefix("{"), reference.hasSuffix("}") {
                value = (node(String(reference.dropFirst().dropLast())) as? [String: Any])?["$value"]
            } else {
                break
            }
        }
        return ((value as? [String: Any])?["hex"] as? String)?.lowercased()
    }
}

@Suite struct ContrastTests {
    @Test func everyPairReachesItsMinimumInBothThemes() throws {
        #expect(CONTRAST_PAIRS.count == 27)
        for theme in ["day", "night"] {
            for pair in CONTRAST_PAIRS {
                let foreground = try #require(ResolvedTokens.hex(theme, pair.foreground), "\(theme) \(pair.foreground)")
                let background = try #require(ResolvedTokens.hex(theme, pair.background), "\(theme) \(pair.background)")
                let ratio = try #require(contrastRatio(foreground, background))
                #expect(ratio >= contrastMinimum(pair.kind), "\(theme): \(pair.foreground) on \(pair.background) is \(ratio)")
            }
        }
    }

    @Test func theDecidedExceptionsHold() {
        for theme in ["day", "night"] {
            #expect(ResolvedTokens.hex(theme, "focus") == ResolvedTokens.hex(theme, "ink"), "\(theme): the focus colour is ink")
        }
        #expect(CONTRAST_PAIRS.contains(ContrastPair(foreground: "ink", background: "sky-1", kind: .bodyText, usedFor: "start-flow tagline (decision: ink)")))
        #expect(CONTRAST_PAIRS.contains(ContrastPair(foreground: "ink", background: "sky-3", kind: .bodyText, usedFor: "the ready line (decision: ink)")))
    }

    @Test func theRatiosMatchTheDesignSystem() throws {
        #expect(abs(try #require(contrastRatio("#10233f", "#fdfbf5")) - 15.21) < 0.005)
        #expect(abs(try #require(relativeLuminance("#ffffff")) - 1) < 1e-12)
        #expect(relativeLuminance("#000000") == 0)
        #expect(relativeLuminance("#12345") == nil)
    }
}
```

- [ ] **Step 4: Run them and see them fail.**

```bash
swift build --package-path ios/TruthyEngine --build-tests 2>&1 | grep -E 'error:' | head -5
```

Expected: errors such as `error: cannot find 'jsNumberString' in scope`, `error: cannot find 'verdictText' in scope` and `error: cannot find 'CONTRAST_PAIRS' in scope`.

- [ ] **Step 5: Write the number helpers, the play copy, leaving and the result.**

`ios/TruthyEngine/Sources/TruthyEngine/JSMath.swift`:

```swift
// JavaScript number operations the copy and geometry ports need, beyond task 1's jsRound and jsUint32.

/// Number.prototype.toString(10), as ECMAScript defines it: the shortest digits that read back as x; no point for an
/// integer; "-0" is "0"; plain notation from 1e-6 up to 1e21, an exponent ("1e-7", "1.5e+21") outside.
func jsNumberString(_ x: Double) -> String {
    if x.isNaN { return "NaN" }
    if x.isInfinite { return x < 0 ? "-Infinity" : "Infinity" }
    if x == 0 { return "0" }
    let sign = x < 0 ? "-" : ""
    // Swift's description already holds the shortest round-trip digits; read them and the decimal exponent.
    var text = abs(x).description
    var exponent = 0
    if let e = text.firstIndex(where: { $0 == "e" || $0 == "E" }) {
        exponent = Int(text[text.index(after: e)...]) ?? 0
        text = String(text[..<e])
    }
    let parts = text.split(separator: ".", omittingEmptySubsequences: false)
    let whole = String(parts[0])
    let fraction = parts.count > 1 ? String(parts[1]) : ""
    var digits = whole + fraction
    var point = whole.count + exponent  // the value is 0.digits times 10^point
    while digits.hasPrefix("0") && digits.count > 1 {
        digits.removeFirst()
        point -= 1
    }
    while digits.hasSuffix("0") && digits.count > 1 { digits.removeLast() }
    let k = digits.count
    let n = point
    if k <= n && n <= 21 { return sign + digits + String(repeating: "0", count: n - k) }
    if 0 < n && n <= 21 { return sign + String(digits.prefix(n)) + "." + String(digits.dropFirst(n)) }
    if -6 < n && n <= 0 { return sign + "0." + String(repeating: "0", count: -n) + digits }
    let e = n - 1
    let mantissa = k == 1 ? digits : String(digits.prefix(1)) + "." + String(digits.dropFirst())
    return sign + mantissa + "e" + (e < 0 ? "-" : "+") + String(abs(e))
}

/// Math.max: NaN if either is NaN, and +0 above -0.
func jsMathMax(_ a: Double, _ b: Double) -> Double {
    if a.isNaN || b.isNaN { return .nan }
    if a == 0 && b == 0 { return a.sign == .minus && b.sign == .minus ? -0.0 : 0 }
    return a > b ? a : b
}

/// Math.min: NaN if either is NaN, and -0 below +0.
func jsMathMin(_ a: Double, _ b: Double) -> Double {
    if a.isNaN || b.isNaN { return .nan }
    if a == 0 && b == 0 { return a.sign == .minus || b.sign == .minus ? -0.0 : 0 }
    return a < b ? a : b
}

func round1(_ value: Double) -> Double { jsRound(value * 10) / 10 }
func round2(_ value: Double) -> Double { jsRound(value * 100) / 100 }
```

`ios/TruthyEngine/Sources/TruthyEngine/PlayCopy.swift`:

```swift
// What the play screen says (components/play/PlayScreen.tsx:52-143) and two of its guard times.

/// After an answer, Next card and See results take presses only after this many monotonic milliseconds.
public let NEXT_ARRIVES_MS: Double = 420

/// After the leave sheet closes, the live regions keep what they said for this long.
public let SPOKEN_RELEASE_MS: Double = 150

/// "Correct. The answer is False." and, past the record in Streak, " New best."
public func verdictText(_ correct: Bool, _ answer: Bool, _ newBest: Bool = false) -> String {
    "\(correct ? "Correct" : "Not quite"). The answer is \(answer ? "True" : "False").\(newBest ? " New best." : "")"
}

/// What follows the verdict when a wrong answer changes the round: "Life lost, 2 left.", "Last life.", "Out of lives.",
/// "Streak ended at 3.". Empty after a right answer, in Classic and in Timed.
public func roundStatus(_ round: RoundState) -> String {
    guard let last = lastAnswer(round), !last.correct else { return "" }
    if round.mode == .streak { return "Streak ended at \(scoreOf(.streak, round.answers))." }
    if round.mode != .lives { return "" }
    let left = livesLeft(round)
    if left == 0 { return "Out of lives." }
    return left == 1 ? "Last life." : "Life lost, \(left) left."
}

/// Timed's live region: "Correct." or "Not quite." during the stamp, the end at time up, nothing on a question.
public func timedStatus(_ round: RoundState) -> String {
    if isDecided(round) { return "Time is up. This card doesn't count." }
    if round.phase != .stamped { return "" }
    return lastAnswer(round)?.correct == true ? "Correct." : "Not quite."
}

/// Timed's card announcer from the second card on, until time is up: "Card 2. Applies to X. <statement>".
public func timedCardText(_ round: RoundState) -> String {
    guard let card = currentCard(round), round.index != 0, !isDecided(round) else { return "" }
    let appliesTo = card.appliesTo.isEmpty ? "" : "Applies to \(card.appliesTo). "
    return "Card \(round.index + 1). \(appliesTo)\(plainText(card.text.en.statement))"
}
```

`ios/TruthyEngine/Sources/TruthyEngine/Leave.swift`:

```swift
// Leaving a round for any reason but its end (components/play/leave.ts).

/// Whether leaving saves anything: answers to keep, or a decided round (the Timed minute can run out with nothing
/// answered).
public func leavesSomething(_ round: RoundState) -> Bool {
    !round.answers.isEmpty || isDecided(round)
}

/// Before its deciding answer a round is kept as abandoned (history and `last` without a score, no record); after it,
/// it is recorded as its result would record it.
public func saveLeftRound(_ round: RoundState, _ store: LocalStore) {
    let ended = reduce(round, isDecided(round) ? .next : .abandon)
    store.save(applyResult(store.load(), summarise(ended)).progress)
}
```

`ios/TruthyEngine/Sources/TruthyEngine/ResultCopy.swift`:

```swift
// What the result says in each class (components/play/resultCopy.ts) and recording a round once
// (components/play/ResultView.tsx).

public struct ResultField: Equatable, Sendable {
    public let label: String
    public let value: String

    public init(label: String, value: String) {
        self.label = label
        self.value = value
    }
}

public struct ResultCopy: Sendable {
    public let fields: [ResultField]
    public let scoreLabel: String
    public let unit: String?
    /// How a record reads in the comparison: "9 / 10", "21 cards", "12".
    public let best: @Sendable (Int) -> String
    public let ended: String
    public let endedDetail: String
    /// The completed header's accessible name.
    public let label: String
    public let marks: Int
    /// Streak: the mark (from 0) where the previous best was reached.
    public let ring: Int?

    public init(fields: [ResultField], scoreLabel: String, unit: String?, best: @escaping @Sendable (Int) -> String, ended: String,
                endedDetail: String, label: String, marks: Int, ring: Int?) {
        self.fields = fields
        self.scoreLabel = scoreLabel
        self.unit = unit
        self.best = best
        self.ended = ended
        self.endedDetail = endedDetail
        self.label = label
        self.marks = marks
        self.ring = ring
    }
}

private func cards(_ count: Int) -> String {
    count == 1 ? "1 card" : "\(count) cards"
}

/// "18 correct, 3 wrong: cards 6, 15 and 21." or "18 correct, 0 wrong."
private func tally(_ correct: Int, _ wrong: [Int]) -> String {
    let head = "\(correct) correct, \(wrong.count) wrong"
    return wrong.isEmpty ? "\(head)." : "\(head): \(cardList(wrong))."
}

/// The copy of a finished round. `dealt` is the cards the round dealt, `previousBest` the record before it.
public func resultCopy(_ result: RoundResult, _ modeName: String, _ dealt: Int, _ previousBest: Int?) -> ResultCopy {
    let n = result.total
    let w = result.missed.count
    let c = n - w
    let wrong = result.answers.enumerated().filter { !$0.element.correct }.map { $0.offset + 1 }
    let klass = ResultField(label: "Class", value: modeName)
    let wrongField = ResultField(label: "Wrong", value: pad2(w))
    let seconds = jsNumberString(TIMED.roundMs / 1000)
    switch result.mode {
    case .classic:
        return ResultCopy(
            fields: [klass, ResultField(label: "Cards", value: "\(pad2(n)) / \(pad2(dealt))"), wrongField],
            scoreLabel: "Your score", unit: "of \(dealt)", best: { "\($0) / \(dealt)" }, ended: "Arrived",
            endedDetail: " · \(n) of \(dealt)", label: completedLabel(dealt, result.answers.map(\.correct)), marks: dealt, ring: nil)
    case .streak:
        let ring = previousBest.flatMap { $0 >= 1 && $0 <= result.score ? $0 - 1 : nil }
        return ResultCopy(
            fields: [klass, ResultField(label: "Cards", value: pad2(n)), wrongField],
            scoreLabel: "Correct in a row", unit: nil, best: { "\($0)" }, ended: "Ended", endedDetail: " · \(cards(n))",
            label: "Streak over on card \(n). \(result.score) correct in a row. Card \(n) was wrong.", marks: n, ring: ring)
    case .lives:
        return ResultCopy(
            fields: [klass, ResultField(label: "Correct", value: pad2(c)), wrongField],
            scoreLabel: "Your score", unit: "cards", best: { "\($0) cards" }, ended: "Out of lives", endedDetail: "",
            label: "Out of lives after \(n) cards. \(tally(c, wrong))", marks: n, ring: nil)
    case .timed:
        return ResultCopy(
            fields: [klass, ResultField(label: "Time", value: "\(seconds) s"), ResultField(label: "Answered", value: pad2(n))],
            scoreLabel: "Correct", unit: "of \(n)", best: { "\($0)" }, ended: "Time is up", endedDetail: " · \(cards(n))",
            label: "Time is up. \(cards(n)) answered in \(seconds) seconds. \(tally(c, wrong))", marks: n, ring: nil)
    }
}

/// The result's actions take presses after this many monotonic milliseconds.
public let RESULT_ARRIVES_MS: Double = 1000

/// The rounds already written, with what applyResult said: the web's WeakMap, kept by the caller.
public final class RecordedRounds {
    private var entries: [(round: RoundState, outcome: ApplyOutcome)] = []

    public init() {}

    func outcome(of round: RoundState) -> ApplyOutcome? {
        entries.first { $0.round == round }?.outcome
    }

    func keep(_ round: RoundState, _ outcome: ApplyOutcome) {
        entries.append((round, outcome))
    }
}

/// Records a finished round: card history, the record for its route and class, the last route. The first call for a
/// round writes; later calls return the same outcome without writing again.
public func recordRound(_ round: RoundState, _ store: LocalStore, _ recorded: RecordedRounds) -> ApplyOutcome {
    if let done = recorded.outcome(of: round) { return done }
    let outcome = applyResult(store.load(), summarise(round))
    store.save(outcome.progress)
    recorded.keep(round, outcome)
    return outcome
}
```

`ios/TruthyEngine/Sources/TruthyEngine/MissedCards.swift`:

```swift
// The wrong answers of a round, as the result's list shows them (components/MissedCards.tsx).

public struct MissedCard: Equatable, Sendable {
    /// The card's place in the round, from 1.
    public let number: Int
    public let given: Bool
    public let answer: Bool
    /// nil for a card without one.
    public let appliesTo: String?
    public let statement: String
    public let explanation: String
    public let source: CardSource

    public init(number: Int, given: Bool, answer: Bool, appliesTo: String?, statement: String, explanation: String, source: CardSource) {
        self.number = number
        self.given = given
        self.answer = answer
        self.appliesTo = appliesTo
        self.statement = statement
        self.explanation = explanation
        self.source = source
    }
}

public func missedCards(_ answers: [Answered]) -> [MissedCard] {
    answers.enumerated().compactMap { i, answered in
        answered.correct ? nil : MissedCard(
            number: i + 1, given: answered.given, answer: answered.card.answer,
            appliesTo: answered.card.appliesTo.isEmpty ? nil : answered.card.appliesTo,
            statement: answered.card.text.en.statement, explanation: answered.card.text.en.explanation, source: answered.card.source)
    }
}
```

`ios/TruthyEngine/Sources/TruthyEngine/Ticket.swift`:

```swift
// What the ticket shows about the route (components/play/useRound.ts: ticketFor).

public struct TicketInfo: Equatable, Sendable {
    public let deckCode: String
    public let deckName: String
    public let sectionCode: String
    public let sectionName: String
    public let modeLabel: String
    public let best: Int?

    public init(deckCode: String, deckName: String, sectionCode: String, sectionName: String, modeLabel: String, best: Int?) {
        self.deckCode = deckCode
        self.deckName = deckName
        self.sectionCode = sectionCode
        self.sectionName = sectionName
        self.modeLabel = modeLabel
        self.best = best
    }
}

public func ticketFor(_ found: RouteInIndex, _ mode: Mode, _ best: Int?) -> TicketInfo {
    TicketInfo(
        deckCode: found.deck.code, deckName: deckPassName(found.platform, found.deck), sectionCode: found.section?.id ?? WHOLE_DECK,
        sectionName: found.section?.title ?? "Whole deck", modeLabel: modeInfo(mode).name, best: best)
}
```

- [ ] **Step 6: Write the ticket scroll, the flight path, the headers, the barcode and the contrast.**

`ios/TruthyEngine/Sources/TruthyEngine/TicketScroll.swift`:

```swift
// Where the round scrolls its ticket (components/play/ticketScroll.ts). Pure arithmetic over points.

public struct Span: Codable, Equatable, Sendable {
    public let top: Double
    public let bottom: Double

    public init(top: Double, bottom: Double) {
        self.top = top
        self.bottom = bottom
    }
}

public struct SlipScrollAt: Codable, Equatable, Sendable {
    public let top: Double
    public let visible: Double
    public let gap: Double
    public let max: Double

    public init(top: Double, visible: Double, gap: Double, max: Double) {
        self.top = top
        self.visible = visible
        self.gap = gap
        self.max = max
    }
}

public struct KeyScrollAt: Codable, Equatable, Sendable {
    public let top: Double
    public let visible: Double
    public let max: Double

    public init(top: Double, visible: Double, max: Double) {
        self.top = top
        self.visible = visible
        self.max = max
    }
}

/// A new card: the scroll that shows the statement above the action row; 0 when it fits.
public func statementScroll(_ text: Span, _ visible: Double) -> Double {
    jsMathMax(0, jsMathMin(text.bottom - visible, text.top))
}

/// After an answer: the scroll that brings the slip in, or nil when it is in view (it may end in the gap).
public func slipScroll(_ slip: Span, _ at: SlipScrollAt) -> Double? {
    if slip.top >= at.top && slip.bottom <= at.top + at.visible + at.gap { return nil }
    return jsMathMax(0, jsMathMin(at.max, slip.top))
}

/// One arrow press scrolls this far.
public let ARROW_STEP: Double = 40

/// Where a key that scrolls a page takes the ticket, or nil for any other key. The app ports no ticket scroll keys
/// (spec section 2); the function is ported for parity.
public func keyScroll(_ key: String, _ shift: Bool, _ at: KeyScrollAt) -> Double? {
    let page = jsMathMax(ARROW_STEP, at.visible - ARROW_STEP)
    let top: Double
    if key == " " {
        top = at.top + (shift ? -page : page)
    } else if shift {
        return nil
    } else {
        switch key {
        case "ArrowDown": top = at.top + ARROW_STEP
        case "ArrowUp": top = at.top - ARROW_STEP
        case "PageDown": top = at.top + page
        case "PageUp": top = at.top - page
        case "Home": top = 0
        case "End": top = at.max
        default: return nil
        }
    }
    return jsMathMax(0, jsMathMin(at.max, top))
}
```

`ios/TruthyEngine/Sources/TruthyEngine/FlightPath.swift`:

```swift
import Foundation

// The flight path of the round header (components/FlightPath.tsx:44-138): the quadratic curve M6 24 Q138 -6 270 24 in
// a 276 by 34 box, its waypoints and their accessible labels.

public struct Point: Codable, Equatable, Sendable {
    public let x: Double
    public let y: Double

    public init(x: Double, y: Double) {
        self.x = x
        self.y = y
    }
}

public enum WaypointState: String, Codable, Sendable {
    case correct, wrong, current, future
}

private let P0 = Point(x: 6, y: 24)
private let P1 = Point(x: 138, y: -6)
private let P2 = Point(x: 270, y: 24)

private func lerp(_ a: Point, _ b: Point, _ t: Double) -> Point {
    Point(x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t)
}

/// The point of the curve at t, rounded to 0.01.
public func pointAt(_ t: Double) -> Point {
    let p = lerp(lerp(P0, P1, t), lerp(P1, P2, t), t)
    return Point(x: round2(p.x), y: round2(p.y))
}

/// Where waypoint i of n sits: evenly spread, the first at the start and the last at the end.
public func waypointT(_ i: Double, _ n: Double) -> Double {
    n <= 1 ? 0 : i / (n - 1)
}

/// The flown part of the curve, from the start to t, as an SVG path.
public func flownPath(_ t: Double) -> String {
    let control = lerp(P0, P1, t)
    let end = pointAt(t)
    let numbers = [P0.x, P0.y, round2(control.x), round2(control.y), end.x, end.y].map(jsNumberString)
    return "M\(numbers[0]) \(numbers[1]) Q\(numbers[2]) \(numbers[3]) \(numbers[4]) \(numbers[5])"
}

/// The plane's heading at t in degrees, rounded to 0.01.
public func headingAt(_ t: Double) -> Double {
    let dx = 2 * (1 - t) * (P1.x - P0.x) + 2 * t * (P2.x - P1.x)
    let dy = 2 * (1 - t) * (P1.y - P0.y) + 2 * t * (P2.y - P1.y)
    return round2((atan2(dy, dx) * 180) / Double.pi)
}

/// The state of every waypoint.
public func waypointStates(_ total: Int, _ results: [Bool], _ current: Int, _ answered: Bool) -> [WaypointState] {
    (0..<max(0, total)).map { i in
        if i < results.count && (i < current || answered) { return results[i] ? .correct : .wrong }
        return i == current ? .current : .future
    }
}

/// "card 3", "cards 1 and 2", "cards 1, 2 and 5".
public func cardList(_ numbers: [Int]) -> String {
    if numbers.count == 1 { return "card \(numbers[0])" }
    let head = numbers.dropLast().map(String.init).joined(separator: ", ")
    return "cards \(head) and \(numbers.last.map(String.init) ?? "undefined")"
}

/// "Card 4 of 10. Cards 1 and 2 correct, card 3 wrong."
public func flightPathLabel(_ total: Int, _ results: [Bool], _ current: Int) -> String {
    let correct = results.enumerated().filter(\.element).map { $0.offset + 1 }
    let wrong = results.enumerated().filter { !$0.element }.map { $0.offset + 1 }
    var parts: [String] = []
    if !correct.isEmpty { parts.append("\(cardList(correct)) correct") }
    if !wrong.isEmpty { parts.append("\(cardList(wrong)) wrong") }
    let head = "Card \(current + 1) of \(total)."
    if parts.isEmpty { return head }
    let tally = parts.joined(separator: ", ")
    return "\(head) \(tally.prefix(1).uppercased())\(tally.dropFirst())."
}

/// "Round complete. 10 of 10 cards. 7 correct, 3 wrong: cards 3, 6 and 9."
public func completedLabel(_ total: Int, _ results: [Bool]) -> String {
    let wrong = results.enumerated().filter { !$0.element }.map { $0.offset + 1 }
    let correct = results.count - wrong.count
    let head = "Round complete. \(results.count) of \(total) cards. \(correct) correct, \(wrong.count) wrong"
    return wrong.isEmpty ? "\(head)." : "\(head): \(cardList(wrong))."
}

/// The scale of the marks on a completed route: 1 up to 10 cards, 6/7 up to 17, then as large as keeps them apart.
public func completedScale(_ cards: Int) -> Double {
    if cards <= 10 { return 1 }
    if cards <= 17 { return 6.0 / 7 }
    return min(6, (0.35 * 264) / Double(cards - 1)) / 7
}
```

`ios/TruthyEngine/Sources/TruthyEngine/Headers.swift`:

```swift
// The Streak, Three lives and Timed headers (components/StreakPath.tsx, LivesPath.tsx, TimedPath.tsx).

public struct StreakLayout: Sendable {
    /// Where slot i sits on the curve, 0 to 1.
    public let t: @Sendable (Int) -> Double
    public let dot: Double
    public let ticks: Bool
    /// The slot of the best (best - 1), nil without a best of at least 1.
    public let ring: Int?
    /// The ring is at or ahead of the card on screen.
    public let target: Bool
    public let future: [Int]
}

/// The layout for `done` dots (the card on screen is slot `done`) and the best on the route.
public func streakLayout(_ done: Int, _ best: Int?) -> StreakLayout {
    let ring: Int? = best.flatMap { $0 < 1 ? nil : $0 - 1 }
    let target = ring.map { done <= $0 } ?? false
    let step = target ? 1 / Double(max(ring ?? 1, 1)) : 1 / (Double(done) + 1.6)
    let dot = min(6, round1(264 * step * 0.31))
    let future = target ? Array((0..<max(0, (ring ?? 0) - done - 1)).map { done + 1 + $0 }) : []
    return StreakLayout(t: { min(1, Double($0) * step) }, dot: dot, ticks: dot >= 5, ring: ring, target: target, future: future)
}

/// The header's accessible name. A best of 0 counts as no best.
public func streakLabel(_ streak: Int, _ best: Int?, _ ended: Bool) -> String {
    let start = ended ? "Streak ended at \(streak)" : "Streak of \(streak) correct \(streak == 1 ? "answer" : "answers")"
    guard let best, best >= 1 else { return "\(start)." }
    if streak < best { return "\(start). Your best on this route is \(best)." }
    if streak == best { return "\(start), equal to your best on this route." }
    return "\(start). New best on this route, previous best \(best)."
}

public struct TrailLayout: Sendable {
    /// x of mark i, 0 the oldest.
    public let x: @Sendable (Int) -> Double
    public let r: Double
    public let side: Double
    public let cross: Bool
}

/// Where the marks of the answered cards sit on the line y 17 of the Three lives header.
public func trailLayout(_ marks: Int) -> TrailLayout {
    if marks <= 14 { return TrailLayout(x: { 219 - 9 * Double(marks - 1 - $0) }, r: 2.6, side: 9, cross: true) }
    let step = 119 / Double(marks - 1)
    let side = max(6, min(8, round1(step * 1.3)))
    return TrailLayout(x: { round1(100 + Double($0) * step) }, r: min(2.2, round1(step * 0.45)), side: side, cross: true)
}

/// The header's accessible name.
public func livesLabel(_ results: [Bool]) -> String {
    let wrong = results.enumerated().filter { !$0.element }.map { $0.offset + 1 }
    let left = max(0, LIVES - wrong.count)
    let n = results.count
    let were = wrong.count == 1 ? "was" : "were"
    if left == 0 { return "No lives left. The round is over after \(n) cards: \(cardList(wrong)) \(were) wrong." }
    let head = "\(left) of \(LIVES) lives left."
    if n == 0 { return "\(head) No cards answered yet." }
    let answered = "\(n) \(n == 1 ? "card" : "cards") answered"
    if wrong.isEmpty { return "\(head) \(answered)." }
    return "\(head) \(answered), \(cardList(wrong)) \(were) wrong."
}

private func wholeSeconds(_ remainingMs: Double) -> Int {
    Int((jsMathMax(0, remainingMs) / 1000).rounded(.up))
}

/// The clock: "1:00", "0:41", "0:00". The seconds are rounded up.
public func clockText(_ remainingMs: Double) -> String {
    let seconds = wholeSeconds(remainingMs)
    return "\(seconds / 60):\(pad2(seconds % 60))"
}

/// The header's accessible name, from the whole seconds.
public func timedLabel(_ remainingMs: Double, _ correct: Int, _ wrong: Int) -> String {
    let seconds = wholeSeconds(remainingMs)
    if seconds == 0 {
        let n = correct + wrong
        return "Time is up. \(n) \(n == 1 ? "card" : "cards") answered: \(correct) correct, \(wrong) wrong."
    }
    let total = jsNumberString(TIMED.roundMs / 1000)
    return "\(seconds) \(seconds == 1 ? "second" : "seconds") left of \(total). \(correct) correct, \(wrong) wrong."
}
```

`ios/TruthyEngine/Sources/TruthyEngine/Barcode.swift`:

```swift
// The barcode of the stub (components/BoardingPass.tsx:251-277): the same bars on every platform. The data is the
// card's id.

public struct BarcodeBar: Codable, Equatable, Sendable {
    public let x: Int
    public let width: Int

    public init(x: Int, width: Int) {
        self.x = x
        self.width = width
    }
}

/// Start bars 2/1/1/2 (on, off, on, off); per character 7 bits of its first UTF-16 unit, least significant first, width
/// 2 for a 1 and 1 for a 0, alternating on and off from on, then a 1-wide gap; end bars 1/1/2 (on, off, on).
public func barcodeBars(_ data: String) -> (bars: [BarcodeBar], width: Int) {
    var bars: [BarcodeBar] = []
    var x = 0
    func bar(_ width: Int, _ on: Bool) {
        if on { bars.append(BarcodeBar(x: x, width: width)) }
        x += width
    }
    bar(2, true)
    bar(1, false)
    bar(1, true)
    bar(2, false)
    for scalar in data.unicodeScalars {
        let code = Int(scalar.utf16.first ?? 0)
        for bit in 0..<7 { bar((code >> bit) & 1 == 1 ? 2 : 1, bit % 2 == 0) }
        bar(1, false)
    }
    bar(1, true)
    bar(1, false)
    bar(2, true)
    return (bars, x)
}
```

`ios/TruthyEngine/Sources/TruthyEngine/Contrast.swift`:

```swift
import Foundation

// The contrast pairs of the design system (tests/tokens/contrast.test.ts, spec 5.9), as data and WCAG 2.x arithmetic.

public enum ContrastKind: String, Codable, Sendable {
    case bodyText = "body text"
    case largeText = "large text"
    case nonText = "non-text"
}

public struct ContrastPair: Equatable, Sendable {
    public let foreground: String
    public let background: String
    public let kind: ContrastKind
    /// Where the screens use it (the web test's `where`).
    public let usedFor: String

    public init(foreground: String, background: String, kind: ContrastKind, usedFor: String) {
        self.foreground = foreground
        self.background = background
        self.kind = kind
        self.usedFor = usedFor
    }
}

private func pair(_ foreground: String, _ background: String, _ kind: ContrastKind, _ usedFor: String) -> ContrastPair {
    ContrastPair(foreground: foreground, background: background, kind: kind, usedFor: usedFor)
}

public let CONTRAST_PAIRS: [ContrastPair] = [
    pair("ink", "surface-raised", .bodyText, "ticket, cards, fill-in pass, Back pill"),
    pair("ink", "surface-sunk", .bodyText, "answer slip, missed-cards slip"),
    pair("ink-muted", "surface-raised", .bodyText, "field labels, leg names, card details"),
    pair("ink-muted", "surface-sunk", .bodyText, "missed-card heads, unavailable card"),
    pair("true", "surface-raised", .bodyText, "True hint"),
    pair("true", "surface-sunk", .bodyText, "source link, Why link"),
    pair("false", "surface-raised", .bodyText, "False hint"),
    pair("on-dark", "true", .bodyText, "True pill label"),
    pair("on-dark", "false", .bodyText, "False pill label"),
    pair("on-dark", "ink", .bodyText, "Next card, Play again, Start round"),
    pair("on-accent", "accent", .bodyText, "carrier band"),
    pair("ink", "sky-1", .bodyText, "start-flow tagline (decision: ink)"),
    pair("ink", "sky-2", .bodyText, "the tagline where it crosses into sky-2, step titles"),
    pair("ink", "sky-3", .bodyText, "the ready line (decision: ink)"),
    pair("ink", "sky-4", .bodyText, "continue line, quiet buttons"),
    pair("ink-muted", "sky-4", .bodyText, "continue line route"),
    pair("correct", "surface-sunk", .largeText, "Correct stamp on the slip, 24px ExtraBold"),
    pair("correct", "surface-raised", .largeText, "New best stamp, 22px ExtraBold"),
    pair("wrong", "surface-sunk", .largeText, "Not quite stamp, 24px ExtraBold"),
    pair("wrong", "surface-raised", .largeText, "Not quite stamp on the stub, 28px ExtraBold"),
    pair("false", "surface-raised", .largeText, "False intent stamp, 26px"),
    pair("focus", "sky-1", .nonText, "focus ring on the sky"),
    pair("focus", "sky-2", .nonText, "focus ring on the sky"),
    pair("focus", "sky-3", .nonText, "focus ring on the sky (filled pills)"),
    pair("focus", "sky-4", .nonText, "focus ring on the sky (filled pills)"),
    pair("focus", "surface-raised", .nonText, "focus ring inside the pass and the ticket"),
    pair("focus", "surface-sunk", .nonText, "focus ring on the slip"),
]

public func contrastMinimum(_ kind: ContrastKind) -> Double {
    kind == .bodyText ? 4.5 : 3
}

/// Relative luminance of an opaque "#rrggbb" colour (WCAG 2.x), or nil for anything else.
public func relativeLuminance(_ hex: String) -> Double? {
    let digits = Array(hex.utf8)
    guard digits.count == 7, digits[0] == UInt8(ascii: "#") else { return nil }
    var channels: [Double] = []
    for at in stride(from: 1, to: 7, by: 2) {
        guard let byte = UInt8(String(decoding: digits[at..<(at + 2)], as: UTF8.self), radix: 16) else { return nil }
        let c = Double(byte) / 255
        channels.append(c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4))
    }
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

/// The contrast ratio of two opaque colours, or nil when either is not "#rrggbb".
public func contrastRatio(_ foregroundHex: String, _ backgroundHex: String) -> Double? {
    guard let a = relativeLuminance(foregroundHex), let b = relativeLuminance(backgroundHex) else { return nil }
    return (max(a, b) + 0.05) / (min(a, b) + 0.05)
}
```

- [ ] **Step 7: Run the unit tests.**

```bash
swift test --package-path ios/TruthyEngine --filter 'JSMathTests|PlayCopyTests|LeaveTests|ResultCopyTests|TicketScrollTests|FlightPathTests|HeadersTests|BarcodeTests|ContrastTests'
```

Expected: `Test run with 29 tests in 9 suites passed` (1, 5, 3, 5, 3, 4, 3, 2 and 3). `ContrastTests` reads `native-data/tokens/resolved.json`; if a role is missing there, the message names it: stop and report, the generator of task 8 reads the same file. `PlayCopyTests` and `LeaveTests` use task 3's `RoundTesting` fixtures (40-card pools, `T0`).

- [ ] **Step 8: Commit the port.**

```bash
git add ios/TruthyEngine/Sources/TruthyEngine/JSMath.swift ios/TruthyEngine/Sources/TruthyEngine/PlayCopy.swift ios/TruthyEngine/Sources/TruthyEngine/Leave.swift ios/TruthyEngine/Sources/TruthyEngine/ResultCopy.swift ios/TruthyEngine/Sources/TruthyEngine/MissedCards.swift ios/TruthyEngine/Sources/TruthyEngine/Ticket.swift ios/TruthyEngine/Sources/TruthyEngine/TicketScroll.swift ios/TruthyEngine/Sources/TruthyEngine/FlightPath.swift ios/TruthyEngine/Sources/TruthyEngine/Headers.swift ios/TruthyEngine/Sources/TruthyEngine/Barcode.swift ios/TruthyEngine/Sources/TruthyEngine/Contrast.swift ios/TruthyEngine/Tests/TruthyEngineTests/JSMathTests.swift ios/TruthyEngine/Tests/TruthyEngineTests/PlayCopyTests.swift ios/TruthyEngine/Tests/TruthyEngineTests/LeaveTests.swift ios/TruthyEngine/Tests/TruthyEngineTests/ResultCopyTests.swift ios/TruthyEngine/Tests/TruthyEngineTests/TicketScrollTests.swift ios/TruthyEngine/Tests/TruthyEngineTests/FlightPathTests.swift ios/TruthyEngine/Tests/TruthyEngineTests/HeadersTests.swift ios/TruthyEngine/Tests/TruthyEngineTests/BarcodeTests.swift ios/TruthyEngine/Tests/TruthyEngineTests/ContrastTests.swift
pnpm vitest run tests/repo-hygiene.test.ts
git commit -m "feat: port the play copy, leaving, the result, the ticket scroll, the flight path, the headers, the barcode and the contrast pairs to the Swift engine"
```

Expected: the hygiene test passes; the commit has twenty files.

- [ ] **Step 9: Write the golden tests of the copy.** Every file is loaded with two string literals.

`ios/TruthyEngine/Tests/TruthyEngineTests/PlayCopyGoldenTests.swift`:

```swift
import Foundation
import Testing
@testable import TruthyEngine

// native-data/golden vectors of components/play/PlayScreen.tsx and components/play/leave.ts. A round is the trace
// that builds it, replayed with the engine (task 3's RoundVectors).
private typealias G = ProgressGolden

func roundOf(_ input: GoldenValue, _ file: GoldenFile) throws -> RoundState {
    try #require(try RoundVectors.replay(input, file).last)
}

/// A store over memory with what the vector says is stored, or one whose every write throws.
func vectorStore(_ input: GoldenValue) throws -> (store: LocalStore, storage: CountingStorage) {
    let storage = CountingStorage()
    if let progress = input["progress"], progress != .null {
        storage.items[PROGRESS_KEY] = String(decoding: try JSONEncoder().encode(progress), as: UTF8.self)
    }
    storage.full = input["storage"] == .string("full")
    return (createLocalStore(storage), storage)
}

/// What the progress key holds, read back as progress, or nil when nothing was written.
func storedProgress(_ storage: CountingStorage) -> TruthyEngine.Progress? {
    storage.items[PROGRESS_KEY].map { parseProgress($0) }
}

@Suite struct PlayCopyGoldenTests {
    @Test func verdictTextCases() throws {
        let file = try Golden.load("components/play/PlayScreen", "verdictText")
        for c in file.cases {
            let text = verdictText(
                try G.required(c.input, "correct").bool(), try G.required(c.input, "answer").bool(), try c.input["newBest"]?.bool() ?? false)
            #expect(text == (try c.output.string()), "\(c.name)")
        }
    }

    @Test func roundStatusCases() throws {
        let file = try Golden.load("components/play/PlayScreen", "roundStatus")
        for c in file.cases { #expect(roundStatus(try roundOf(c.input, file)) == (try c.output.string()), "\(c.name)") }
    }

    @Test func timedStatusCases() throws {
        let file = try Golden.load("components/play/PlayScreen", "timedStatus")
        for c in file.cases { #expect(timedStatus(try roundOf(c.input, file)) == (try c.output.string()), "\(c.name)") }
    }

    @Test func timedCardTextCases() throws {
        let file = try Golden.load("components/play/PlayScreen", "timedCardText")
        for c in file.cases { #expect(timedCardText(try roundOf(c.input, file)) == (try c.output.string()), "\(c.name)") }
    }

    @Test func guardTimes() throws {
        #expect(try Golden.load("components/play/PlayScreen", "NEXT_ARRIVES_MS").cases[0].output.number() == NEXT_ARRIVES_MS)
        #expect(try Golden.load("components/play/PlayScreen", "SPOKEN_RELEASE_MS").cases[0].output.number() == SPOKEN_RELEASE_MS)
        #expect(try Golden.load("components/play/ResultView", "RESULT_ARRIVES_MS").cases[0].output.number() == RESULT_ARRIVES_MS)
        #expect(try Golden.load("components/play/ticketScroll", "ARROW_STEP").cases[0].output.number() == ARROW_STEP)
    }

    @Test func leavesSomethingCases() throws {
        let file = try Golden.load("components/play/leave", "leavesSomething")
        for c in file.cases { #expect(leavesSomething(try roundOf(c.input, file)) == (try c.output.bool()), "\(c.name)") }
    }

    @Test func saveLeftRoundCases() throws {
        let file = try Golden.load("components/play/leave", "saveLeftRound")
        for c in file.cases {
            let (store, storage) = try vectorStore(c.input)
            saveLeftRound(try roundOf(c.input, file), store)
            let expected = try G.required(c.output, "stored")
            if expected == .null {
                #expect(storage.items[PROGRESS_KEY] == nil, "\(c.name): nothing stored")
            } else {
                let stored = try #require(storedProgress(storage), "\(c.name): stored")
                #expect(G.exactly(stored, try G.progress(expected)), "\(c.name)")
            }
        }
    }
}
```

`ios/TruthyEngine/Tests/TruthyEngineTests/ResultGoldenTests.swift`:

```swift
import Testing
@testable import TruthyEngine

// native-data/golden vectors of resultCopy, recordRound, missedCards and ticketFor.
private typealias G = ProgressGolden

@Suite struct ResultGoldenTests {
    @Test func resultCopyCases() throws {
        let file = try Golden.load("components/play/resultCopy", "resultCopy")
        for c in file.cases {
            let previous = try G.optionalInt(G.required(c.input, "previousBest"))
            let copy = resultCopy(
                try G.roundResult(file, G.required(c.input, "result")), try G.required(c.input, "modeName").string(),
                try G.required(c.input, "dealt").int(), previous)
            let fields = try G.required(c.output, "fields").array().map {
                ResultField(label: try G.required($0, "label").string(), value: try G.required($0, "value").string())
            }
            #expect(copy.fields == fields, "\(c.name): fields")
            #expect(copy.scoreLabel == (try G.required(c.output, "scoreLabel").string()), "\(c.name): scoreLabel")
            #expect(copy.unit == (try c.output["unit"]?.string()), "\(c.name): unit")
            #expect(copy.ended == (try G.required(c.output, "ended").string()), "\(c.name): ended")
            #expect(copy.endedDetail == (try G.required(c.output, "endedDetail").string()), "\(c.name): endedDetail")
            #expect(copy.label == (try G.required(c.output, "label").string()), "\(c.name): label")
            #expect(copy.marks == (try G.required(c.output, "marks").int()), "\(c.name): marks")
            #expect(copy.ring == (try c.output["ring"]?.int()), "\(c.name): ring")
            guard case .object(let best) = try G.required(c.output, "best") else { throw GoldenError(description: "\(c.name): best") }
            for (record, text) in best {
                #expect(copy.best(try #require(Int(record))) == (try text.string()), "\(c.name): best(\(record))")
            }
        }
    }

    @Test func recordRoundCases() throws {
        let file = try Golden.load("components/play/ResultView", "recordRound")
        for c in file.cases {
            let (store, storage) = try vectorStore(c.input)
            let round = try roundOf(c.input, file)
            let recorded = RecordedRounds()
            let outcomes = (0..<(try G.required(c.input, "calls").int())).map { _ in recordRound(round, store, recorded) }
            let expected = try G.required(c.output, "outcome")
            #expect(storage.writes == (try G.required(c.output, "writes").int()), "\(c.name): writes")
            #expect(outcomes.allSatisfy { $0 == outcomes[0] } == (try G.required(c.output, "sameOutcome").bool()), "\(c.name): same")
            #expect(G.exactly(outcomes[0].progress, try G.progress(G.required(expected, "progress"))), "\(c.name): outcome progress")
            #expect(outcomes[0].previousBest == (try G.optionalInt(G.required(expected, "previousBest"))), "\(c.name): previousBest")
            #expect(outcomes[0].isNewBest == (try G.required(expected, "isNewBest").bool()), "\(c.name): isNewBest")
            let stored = try G.required(c.output, "stored")
            if stored != .null { #expect(G.exactly(try #require(storedProgress(storage)), try G.progress(stored)), "\(c.name): stored") }
        }
    }

    private struct MissedVector: Decodable {
        let number: Int
        let given: Bool
        let answer: Bool
        let appliesTo: String?
        let statement: String
        let explanation: String
        let source: CardSource
    }

    @Test func missedCardsCases() throws {
        let file = try Golden.load("components/MissedCards", "missedCards")
        for c in file.cases {
            let answers = try G.required(c.input, "answers").array().map { try G.answered(file, $0) }
            let expected = try file.decode([MissedVector].self, c.output).map {
                MissedCard(number: $0.number, given: $0.given, answer: $0.answer, appliesTo: $0.appliesTo, statement: $0.statement,
                           explanation: $0.explanation, source: $0.source)
            }
            #expect(missedCards(answers) == expected, "\(c.name)")
        }
    }

    @Test func ticketForCases() throws {
        let file = try Golden.load("components/play/useRound", "ticketFor")
        for c in file.cases {
            let found = try G.required(c.input, "found")
            let section = try G.required(found, "section")
            let info = ticketFor(
                RouteInIndex(
                    area: try file.decode(IndexArea.self, G.required(found, "area")),
                    platform: try file.decode(IndexPlatform.self, G.required(found, "platform")),
                    deck: try file.decode(IndexDeck.self, G.required(found, "deck")),
                    section: section == .null ? nil : try file.decode(IndexSection.self, section)),
                try G.mode(G.required(c.input, "mode")), try G.optionalInt(G.required(c.input, "best")))
            let expected = TicketInfo(
                deckCode: try G.required(c.output, "deckCode").string(), deckName: try G.required(c.output, "deckName").string(),
                sectionCode: try G.required(c.output, "sectionCode").string(), sectionName: try G.required(c.output, "sectionName").string(),
                modeLabel: try G.required(c.output, "modeLabel").string(), best: try G.optionalInt(G.required(c.output, "best")))
            #expect(info == expected, "\(c.name)")
        }
    }
}
```

- [ ] **Step 10: Write the golden tests of the geometry and the contrast.**

`ios/TruthyEngine/Tests/TruthyEngineTests/TicketScrollGoldenTests.swift`:

```swift
import Testing
@testable import TruthyEngine

// native-data/golden vectors of components/play/ticketScroll.ts.
private typealias G = ProgressGolden

private func optionalNumber(_ value: GoldenValue) throws -> Double? {
    value == .null ? nil : try value.number()
}

@Suite struct TicketScrollGoldenTests {
    @Test func statementScrollCases() throws {
        let file = try Golden.load("components/play/ticketScroll", "statementScroll")
        for c in file.cases {
            let scroll = statementScroll(try file.decode(Span.self, G.required(c.input, "text")), try G.required(c.input, "visible").number())
            #expect(scroll == (try c.output.number()), "\(c.name)")
        }
    }

    @Test func slipScrollCases() throws {
        let file = try Golden.load("components/play/ticketScroll", "slipScroll")
        for c in file.cases {
            let scroll = slipScroll(try file.decode(Span.self, G.required(c.input, "slip")), try file.decode(SlipScrollAt.self, G.required(c.input, "at")))
            #expect(scroll == (try optionalNumber(c.output)), "\(c.name)")
        }
    }

    @Test func keyScrollCases() throws {
        let file = try Golden.load("components/play/ticketScroll", "keyScroll")
        for c in file.cases {
            let scroll = keyScroll(
                try G.required(c.input, "key").string(), try G.required(c.input, "shift").bool(),
                try file.decode(KeyScrollAt.self, G.required(c.input, "at")))
            #expect(scroll == (try optionalNumber(c.output)), "\(c.name)")
        }
    }

    @Test func arrowStepIsFortyPoints() throws {
        #expect(ARROW_STEP == 40)
        #expect(keyScroll("ArrowUp", false, KeyScrollAt(top: 0, visible: 100, max: 100)) == 0)
    }
}
```

`ios/TruthyEngine/Tests/TruthyEngineTests/FlightPathGoldenTests.swift`:

```swift
import Testing
@testable import TruthyEngine

// native-data/golden vectors of components/FlightPath.tsx.
private typealias G = ProgressGolden

private func bools(_ value: GoldenValue) throws -> [Bool] { try value.array().map { try $0.bool() } }

@Suite struct FlightPathGoldenTests {
    @Test func pointAtCases() throws {
        let file = try Golden.load("components/FlightPath", "pointAt")
        for c in file.cases {
            #expect(pointAt(try G.required(c.input, "t").number()) == (try file.decode(Point.self, c.output)), "\(c.name)")
        }
    }

    @Test func waypointTCases() throws {
        let file = try Golden.load("components/FlightPath", "waypointT")
        for c in file.cases {
            #expect(waypointT(try G.required(c.input, "i").number(), try G.required(c.input, "n").number()) == (try c.output.number()), "\(c.name)")
        }
    }

    @Test func flownPathCases() throws {
        let file = try Golden.load("components/FlightPath", "flownPath")
        for c in file.cases {
            #expect(flownPath(try G.required(c.input, "t").number()) == (try c.output.string()), "\(c.name)")
        }
    }

    @Test func headingAtCases() throws {
        let file = try Golden.load("components/FlightPath", "headingAt")
        for c in file.cases {
            #expect(headingAt(try G.required(c.input, "t").number()) == (try c.output.number()), "\(c.name)")
        }
    }

    @Test func waypointStatesCases() throws {
        let file = try Golden.load("components/FlightPath", "waypointStates")
        for c in file.cases {
            let states = waypointStates(
                try G.required(c.input, "total").int(), try bools(G.required(c.input, "results")), try G.required(c.input, "current").int(),
                try G.required(c.input, "answered").bool())
            #expect(states == (try file.decode([WaypointState].self, c.output)), "\(c.name)")
        }
    }

    @Test func cardListCases() throws {
        let file = try Golden.load("components/FlightPath", "cardList")
        for c in file.cases {
            #expect(cardList(try G.required(c.input, "numbers").array().map { try $0.int() }) == (try c.output.string()), "\(c.name)")
        }
    }

    @Test func flightPathLabelCases() throws {
        let file = try Golden.load("components/FlightPath", "flightPathLabel")
        for c in file.cases {
            let label = flightPathLabel(try G.required(c.input, "total").int(), try bools(G.required(c.input, "results")), try G.required(c.input, "current").int())
            #expect(label == (try c.output.string()), "\(c.name)")
        }
    }

    @Test func completedLabelCases() throws {
        let file = try Golden.load("components/FlightPath", "completedLabel")
        for c in file.cases {
            #expect(completedLabel(try G.required(c.input, "total").int(), try bools(G.required(c.input, "results"))) == (try c.output.string()), "\(c.name)")
        }
    }

    @Test func completedScaleCases() throws {
        let file = try Golden.load("components/FlightPath", "completedScale")
        for c in file.cases {
            #expect(completedScale(try G.required(c.input, "cards").int()) == (try c.output.number()), "\(c.name)")
        }
    }
}
```

`ios/TruthyEngine/Tests/TruthyEngineTests/HeadersGoldenTests.swift`:

```swift
import Testing
@testable import TruthyEngine

// native-data/golden vectors of the Streak, Three lives and Timed headers and of the barcode.
private typealias G = ProgressGolden

private func probes(_ value: GoldenValue) throws -> [(Int, Double)] {
    guard case .object(let members) = value else { throw GoldenError(description: "not a probe table: \(value)") }
    return try members.map { (try #require(Int($0.key)), try $0.value.number()) }
}

@Suite struct HeadersGoldenTests {
    @Test func streakLayoutCases() throws {
        let file = try Golden.load("components/StreakPath", "streakLayout")
        for c in file.cases {
            let layout = streakLayout(try G.required(c.input, "done").int(), try G.optionalInt(G.required(c.input, "best")))
            #expect(layout.dot == (try G.required(c.output, "dot").number()), "\(c.name): dot")
            #expect(layout.ticks == (try G.required(c.output, "ticks").bool()), "\(c.name): ticks")
            #expect(layout.ring == (try G.optionalInt(G.required(c.output, "ring"))), "\(c.name): ring")
            #expect(layout.target == (try G.required(c.output, "target").bool()), "\(c.name): target")
            #expect(layout.future == (try G.required(c.output, "future").array().map { try $0.int() }), "\(c.name): future")
            for (slot, t) in try probes(G.required(c.output, "t")) { #expect(layout.t(slot) == t, "\(c.name): t(\(slot))") }
        }
    }

    @Test func streakLabelCases() throws {
        let file = try Golden.load("components/StreakPath", "streakLabel")
        for c in file.cases {
            let label = streakLabel(try G.required(c.input, "streak").int(), try G.optionalInt(G.required(c.input, "best")), try G.required(c.input, "ended").bool())
            #expect(label == (try c.output.string()), "\(c.name)")
        }
    }

    @Test func trailLayoutCases() throws {
        let file = try Golden.load("components/LivesPath", "trailLayout")
        for c in file.cases {
            let layout = trailLayout(try G.required(c.input, "marks").int())
            #expect(layout.r == (try G.required(c.output, "r").number()), "\(c.name): r")
            #expect(layout.side == (try G.required(c.output, "side").number()), "\(c.name): side")
            #expect(layout.cross == (try G.required(c.output, "cross").bool()), "\(c.name): cross")
            for (mark, x) in try probes(G.required(c.output, "x")) { #expect(layout.x(mark) == x, "\(c.name): x(\(mark))") }
        }
    }

    @Test func livesLabelCases() throws {
        let file = try Golden.load("components/LivesPath", "livesLabel")
        for c in file.cases {
            #expect(livesLabel(try G.required(c.input, "results").array().map { try $0.bool() }) == (try c.output.string()), "\(c.name)")
        }
    }

    @Test func clockTextCases() throws {
        let file = try Golden.load("components/TimedPath", "clockText")
        for c in file.cases {
            #expect(clockText(try G.required(c.input, "remainingMs").number()) == (try c.output.string()), "\(c.name)")
        }
    }

    @Test func timedLabelCases() throws {
        let file = try Golden.load("components/TimedPath", "timedLabel")
        for c in file.cases {
            let label = timedLabel(try G.required(c.input, "remainingMs").number(), try G.required(c.input, "correct").int(), try G.required(c.input, "wrong").int())
            #expect(label == (try c.output.string()), "\(c.name)")
        }
    }

    @Test func barcodeBarsCases() throws {
        let file = try Golden.load("components/BoardingPass", "barcodeBars")
        for c in file.cases {
            let barcode = barcodeBars(try G.required(c.input, "data").string())
            #expect(barcode.bars == (try file.decode([BarcodeBar].self, G.required(c.output, "bars"))), "\(c.name): bars")
            #expect(barcode.width == (try G.required(c.output, "width").int()), "\(c.name): width")
        }
    }
}
```

`ios/TruthyEngine/Tests/TruthyEngineTests/ContrastGoldenTests.swift`:

```swift
import Foundation
import Testing
@testable import TruthyEngine

// native-data/golden/design.system.tokens.contrastPairs: the web's pairs, colours, ratios and verdicts, against the
// engine's list and arithmetic and against the resolved tokens natives draw from.
private typealias G = ProgressGolden

private func round2(_ x: Double) -> Double { (x * 100).rounded() / 100 }

@Suite struct ContrastGoldenTests {
    @Test func thePairsMatchTheWebInBothThemes() throws {
        let file = try Golden.load("design/system/tokens", "contrastPairs")
        let pairs = try G.required(file.cases[0].output, "pairs").array()
        #expect(pairs.count == CONTRAST_PAIRS.count * 2)
        for (i, entry) in pairs.enumerated() {
            let expected = CONTRAST_PAIRS[i % CONTRAST_PAIRS.count]
            let theme = try G.required(entry, "theme").string()
            #expect(theme == (i < CONTRAST_PAIRS.count ? "day" : "night"))
            #expect(try G.required(entry, "foreground").string() == expected.foreground)
            #expect(try G.required(entry, "background").string() == expected.background)
            #expect(try G.required(entry, "kind").string() == expected.kind.rawValue)
            let foreground = try G.required(entry, "foregroundHex").string().lowercased()
            let background = try G.required(entry, "backgroundHex").string().lowercased()
            #expect(foreground == ResolvedTokens.hex(theme, expected.foreground), "\(theme) \(expected.foreground): the native colour")
            #expect(background == ResolvedTokens.hex(theme, expected.background), "\(theme) \(expected.background): the native colour")
            let ratio = try #require(contrastRatio(foreground, background))
            #expect(round2(ratio) == (try G.required(entry, "ratio").number()), "\(theme) \(expected.foreground) on \(expected.background)")
            #expect(contrastMinimum(expected.kind) == (try G.required(entry, "minimum").number()))
            #expect((ratio >= contrastMinimum(expected.kind)) == (try G.required(entry, "passes").bool()))
        }
        for entry in try G.required(file.cases[0].output, "listed").array() {
            let ratio = try #require(contrastRatio(try G.required(entry, "foregroundHex").string(), try G.required(entry, "backgroundHex").string()))
            #expect(round2(ratio) == (try G.required(entry, "ratio").number()))
        }
    }
}
```

`round2` here is the web test's `Math.round(x * 100) / 100` on positive ratios, where `rounded()` and `Math.round` agree; the test keeps its own copy so that it does not depend on the engine's internal one.

- [ ] **Step 11: Run the golden tests.**

```bash
swift test --package-path ios/TruthyEngine --filter 'PlayCopyGoldenTests|ResultGoldenTests|TicketScrollGoldenTests|FlightPathGoldenTests|HeadersGoldenTests|ContrastGoldenTests'
```

Expected: `Test run with 32 tests in 6 suites passed` (7, 4, 4, 9, 7 and 1; they load all 34 files: `guardTimes` reads four constant files, and `barcodeBarsCases` lives in `HeadersGoldenTests`). A failure names the case; fix the port, never a vector. A `headingAt` case off by 0.01 is rule 3: report it with the case name and both values instead of changing the formula.

- [ ] **Step 12: Check that the tests bite.** Change the Streak ring rule on purpose and put it back:

```bash
sed -i '' 's/\$0 <= result.score/$0 < result.score/' ios/TruthyEngine/Sources/TruthyEngine/ResultCopy.swift
swift test --package-path ios/TruthyEngine --filter 'ResultCopyTests|ResultGoldenTests' 2>&1 | grep -E '✘ Test|Test run with'
git checkout -- ios/TruthyEngine/Sources/TruthyEngine/ResultCopy.swift
git diff --stat ios/TruthyEngine/Sources
```

Expected: at least `✘ Test streakRingsThePreviousBestItReached()` (a streak that equals its previous best rings it) and a failing run line, and `resultCopyCases()` too if the vectors hold such a streak; then no diff.

- [ ] **Step 13: Require every golden file.** In `ios/TruthyEngine/Tests/TruthyEngineTests/GoldenCoverageTests.swift` change

```swift
private let everyFileRequired = false
```

to

```swift
private let everyFileRequired = true
```

Then run:

```bash
swift test --package-path ios/TruthyEngine 2>&1 | grep -E 'everyGoldenFileHasATest|Test run with'
```

Expected: `✔ Test everyGoldenFileHasATest() passed` (no longer skipped: the consumed set equals all 130 files of `native-data/golden`) and `Test run with 355 tests in 50 suites passed after ... with 1 known issue` (294 in 35 after task 5, plus 29 unit and 32 golden tests in 15 suites). If the gate lists files, each is a vector no test loads with two literals: add the test in the task that owns its module, never skip it.

- [ ] **Step 14: Prove the gate bites, then commit.** Load one file through a variable for one run, then put the file back:

```bash
keep="${TMPDIR:-/tmp}/HeadersGoldenTests.swift.keep"
cp ios/TruthyEngine/Tests/TruthyEngineTests/HeadersGoldenTests.swift "$keep"
sed -i '' 's/Golden.load("components\/BoardingPass", "barcodeBars")/Golden.load(barcodeModule, "barcodeBars")/' ios/TruthyEngine/Tests/TruthyEngineTests/HeadersGoldenTests.swift
printf 'let barcodeModule = "components/BoardingPass"\n' >> ios/TruthyEngine/Tests/TruthyEngineTests/HeadersGoldenTests.swift
swift test --package-path ios/TruthyEngine --filter GoldenCoverageTests 2>&1 | grep -E 'components.BoardingPass.barcodeBars|Test run with'
mv "$keep" ios/TruthyEngine/Tests/TruthyEngineTests/HeadersGoldenTests.swift
grep -c 'Golden.load("components/BoardingPass", "barcodeBars")' ios/TruthyEngine/Tests/TruthyEngineTests/HeadersGoldenTests.swift
```

Expected: the coverage test fails with `Expectation failed: (untested → ["components.BoardingPass.barcodeBars.json"]) == []` (task 1 keeps the set in a named `let`, so the message lists it), because a load through a variable is no test (task 1, rule 10); the `grep` after the restore prints `1`.

```bash
swift test --package-path ios/TruthyEngine 2>&1 | tail -1
git add ios/TruthyEngine/Tests/TruthyEngineTests/PlayCopyGoldenTests.swift ios/TruthyEngine/Tests/TruthyEngineTests/ResultGoldenTests.swift ios/TruthyEngine/Tests/TruthyEngineTests/TicketScrollGoldenTests.swift ios/TruthyEngine/Tests/TruthyEngineTests/FlightPathGoldenTests.swift ios/TruthyEngine/Tests/TruthyEngineTests/HeadersGoldenTests.swift ios/TruthyEngine/Tests/TruthyEngineTests/ContrastGoldenTests.swift ios/TruthyEngine/Tests/TruthyEngineTests/GoldenCoverageTests.swift
pnpm test
git commit -m "test: check the copy, geometry and contrast of the Swift engine against their golden vectors and require every golden file"
git status --short
```

Expected: `Test run with 355 tests in 50 suites passed after ... with 1 known issue`; every Vitest file passes; the commit has seven files; `git status --short` prints nothing.
