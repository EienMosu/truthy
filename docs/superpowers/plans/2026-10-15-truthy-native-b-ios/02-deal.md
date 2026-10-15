### Task 2: Dealing: `deal`, `dealChunk` and every internal of `deal.ts`, against all dealing vectors

This task ports `src/engine/deal.ts` to the Swift engine line by line: the two entry points `deal` and `dealChunk`, the constants `DEAL`, `CHUNK`, `SEARCH_BUDGET` and `OVERDUE_AFTER_PASSES`, and every internal step reference 3.9 lists as ported (`dealRanked`, `uniqueById`, `dealSize`, `wasSeen`, `wasMissed`, `lastSeenAt`, `oldestFirst`, `rankByPriority`, `balanceFor`, `choose`, `searchOverCap`, `searchWithAllRules` with `canStillFinish`, `relaxStepByStep`, `sharesGroup`, `trueCount`, `balanceAllows`, `arrange`, `joinOf`, `runLimit`, `placementCheck`, `pickAnswer`). Dealing is the first parity risk of the spec (section 9, item 1): one rng draw out of order or one unstable sort changes every card dealt after it, silently. So the port is checked twice. A reference suite writes out the exact vectors of the web's own tests (`tests/engine/deal-pins-polish.test.ts`, `tests/engine/overdue-boundary.test.ts`, the edges of `tests/engine/deal.test.ts`) and the exact number of rng draws of a first chunk; it needs no golden file. A golden suite then reads every `native-data/golden/src.engine.deal.*.json` file that plan A task 5 wrote and runs each case through the Swift function of the same name, internals included, so a wrong step shows up at that step and not only in the cards it deals at the end. The round reducer of task 3 is the only caller in the app: it calls `dealChunk`.

Builds on task 1: the package `ios/TruthyEngine`, the content types, `createRng`, `shuffle`, the golden loader and the purity test (which scans the new `Deal.swift` like every engine source).

**Files:**
- Create: `ios/TruthyEngine/Sources/TruthyEngine/Deal.swift`
- Test: create `ios/TruthyEngine/Tests/TruthyEngineTests/DealReferenceTests.swift`, `ios/TruthyEngine/Tests/TruthyEngineTests/DealGoldenTests.swift`

**Interfaces:**
- Consumes (task 1). The README fixes `Card` (Codable from the shipped card JSON), `CardHistory` (`seen: Int`, `lastCorrect: Bool`, `lastSeenAt: Double`, used here through its memberwise initializer, reachable with `@testable import`), `History = [String: CardHistory]`, `Rng = () -> Double` and `createRng(_ seed: Double) -> Rng`. Task 1 also defines, under these names:

```swift
// Sources/TruthyEngine (task 1)
public func shuffle<T>(_ items: [T], _ rng: Rng) -> [T]   // Fisher-Yates from the end, items.count - 1 draws

// Tests/TruthyEngineTests/Support (task 1: JSONValue.swift, Golden.swift, GoldenReaders.swift)
enum JSONValue: Codable, Equatable, Sendable { case null, bool(Bool), number(Double), string(String), array([JSONValue]), object([String: JSONValue]) }
typealias GoldenValue = JSONValue
extension JSONValue {
  subscript(key: String) -> JSONValue? { get }        // the member of an object; nil when absent (TypeScript undefined) or not an object
  func number() throws -> Double                      // a JSON number or a {"$number": ...} tag
  func int() throws -> Int                            // a number that is a whole number
  func bool() throws -> Bool
  func string() throws -> String
  func array() throws -> [JSONValue]
}
struct GoldenCase: Decodable, Sendable { let name: String; let input: JSONValue; let output: JSONValue }
struct GoldenFile: Decodable, Sendable {
  let module: String; let function: String; let cases: [GoldenCase]
  func card(_ value: JSONValue) throws -> Card      // {"$card": id} through the file's card table
  func cards(_ value: JSONValue) throws -> [Card]   // an array of card references, or {"$deck": id} (native-data/decks/<id>.json, file order)
  func rng(_ value: JSONValue) throws -> Rng        // {"$rng": {"seed": n}} is createRng(n); {"$rng": {"values": [...]}} returns them in order and records an issue when they run out
}
enum Golden {
  static let directory: URL                                                        // native-data/golden, found from #filePath
  static func load(_ module: String, _ function: String) throws -> GoldenFile     // "<module with / as .>.<function>.json"; DEAL is "src.engine.deal.DEAL.constant.json"
}
struct GoldenError: Error, CustomStringConvertible { let description: String }
```

- Produces. Public, under the naming rule of the README (task 3 and the app use only these):

```swift
public struct DealConstants: Equatable, Sendable { public let missedPerTen: Int; public let minTrue: Int; public let maxTrue: Int; public let maxRun: Int }
public let DEAL: DealConstants                 // missedPerTen 3, minTrue 4, maxTrue 6, maxRun 3
public let CHUNK: Int                          // 10
public let SEARCH_BUDGET: Double               // 20_000
public struct DealOptions: Equatable, Sendable {
  public var count: Double; public var avoid: [Card]?; public var before: [Bool]?; public var budget: Double?
  public init(count: Double, avoid: [Card]? = nil, before: [Bool]? = nil, budget: Double? = nil)
}
public func deal(_ pool: [Card], _ history: History, _ rng: @escaping Rng, _ options: DealOptions) -> [Card]
public func dealChunk(_ pool: [Card], _ history: History, _ rng: @escaping Rng, _ dealt: [Card], _ budget: Double = SEARCH_BUDGET) -> [Card]
```

  Internal (module-internal, read by the tests through `@testable import`; the TypeScript names and parameter order):

```swift
struct Setting: Equatable { var avoid: [Card]?; var before: [Bool]?; var budget: Double?; var overdue: Bool? }
struct Join: Equatable { var last: Bool?; var run: Int }
struct Ranking: Equatable { var withinCap: [Card]; var overCap: [Card]; var comeBack: [Card]; var missed: Set<String>; var missedCap: Int }
struct Balance: Equatable { var minTrue: Int; var maxTrue: Int }
struct Limits: Equatable { var budget: Double?; var missed: Set<String>?; var missedLimit: Int? }
struct Rules: Equatable { var conflicts: Bool; var balance: Bool }
let OVERDUE_AFTER_PASSES: Int   // 2
func dealRanked(_ ranking: Ranking, _ size: Int, _ rng: @escaping Rng, _ setting: Setting) -> [Card]
func joinOf(_ before: [Bool]) -> Join
func uniqueById(_ pool: [Card]) -> [Card]
func dealSize(_ count: Double, _ available: Int) -> Int
func wasSeen(_ card: Card, _ history: History) -> Bool
func wasMissed(_ card: Card, _ history: History) -> Bool
func lastSeenAt(_ card: Card, _ history: History) -> Double
func stableSorted(_ cards: [Card], by key: (Card) -> Double) -> [Card]   // the port's stable sort, no TypeScript twin
func oldestFirst(_ cards: [Card], _ history: History) -> [Card]
func rankByPriority(_ cards: [Card], _ history: History, _ rng: @escaping Rng, _ size: Int) -> Ranking
func balanceFor(_ size: Int) -> Balance
func choose(_ ranking: Ranking, _ size: Int, _ avoid: [Card], _ budget: Double, _ overdue: Bool) -> [Card]
func searchOverCap(_ ranking: Ranking, _ unshown: [Card], _ search: ([Card], Limits) -> [Card]?) -> [Card]?
func searchWithAllRules(_ ranked: [Card], _ size: Int, _ avoid: [Card], _ balance: Balance, _ limits: Limits = Limits()) -> [Card]?
func relaxStepByStep(_ ranked: [Card], _ size: Int, _ avoid: [Card], _ balance: Balance, _ first: [Card] = []) -> [Card]
func sharesGroup(_ card: Card, _ others: [Card]) -> Bool
func trueCount(_ cards: [Card]) -> Int
func balanceAllows(_ answer: Bool, _ trues: Int, _ falses: Int, _ size: Int, _ balance: Balance) -> Bool
func arrange(_ chosen: [Card], _ rng: @escaping Rng, _ join: Join) -> [Card]
func runLimit(_ trues: Int, _ falses: Int, _ join: Join) -> Int
func placementCheck(_ limit: Int) -> (Int, Int, Bool?, Int) -> Bool
func pickAnswer(_ allowed: [Bool], _ trues: Int, _ falses: Int, _ rng: @escaping Rng) -> Bool
```

**Rules:**

1. **Order of the draws.** Exactly as reference 3.2, "RNG draws, in order": `dealChunk` shuffles only the unshown cards (never the whole pool, never `comeBack`), the search draws nothing, `arrange` shuffles the chosen True cards and then the chosen False cards, and `pickAnswer` draws only when both answers are allowed. `deal` with a size of 0 (a count that is NaN or at most 0, or an empty pool) returns `[]` before any draw. The reference suite pins the draw count of three first chunks (31, 31 and 32, counted with the TypeScript on the same pool); the golden suite hands `rankByPriority`, `dealRanked`, `arrange` and `pickAnswer` their rng as a list of values and fails unless each uses all of them.
2. **Numbers the TypeScript lets through.** `DealOptions.count` and every budget are `Double`, as the web's tests pass `count: 4.7`, `count: -3` and a budget of `Infinity` (`dealChunk(..., dealt, Infinity)` in `tests/content/shipped-dealing-polish.test.ts`); `Infinity - 1` stays `Infinity`, so the search never runs out. `dealSize` floors the count and caps it at the cards there are. `missedLimit` is `Int?`: nil is the TypeScript's `Infinity`, read as `Int.max` inside the search, where no expression with it can overflow (`missedLeft - (Int.max - missedTaken)` stays above `Int.min`). The floors and the ceiling of `balanceFor` and the missed cap are written with `rounded(.down)` and `rounded(.up)` on `Double`, as `Math.floor` and `Math.ceil`.
3. **Stable sorts and identity.** `oldestFirst` and the `comeBack` order sort through `stableSorted`, which breaks ties by position (spec 4.4, audit R33): equal `lastSeenAt` keep their shuffled order, and `-0` equals `0` as `a - b` is 0 for them. A non-finite or missing `lastSeenAt` counts as 0. Cards are compared by `id` everywhere: `choose` asks whether the chosen deal holds an unshown card through a set of ids, where the TypeScript uses `includes` on the same objects. `unshown[0]` in the overdue rule is the first card of the ranked list (`withinCap` then `overCap`), not of the file.
4. **Memo and recursion.** `placementCheck(limit)` returns a recursive local function over a memo held by a private class, keyed by `(t, f, last, run)` as the TypeScript's string key `"t,f,last,run"`. `visit` decrements the budget after the full-deal check and before `canStillFinish`, exactly as `budget-- <= 0` (reference 3.2, step 7).
5. **The rng parameters are `@escaping`.** An escaping closure can be passed on to `shuffle` whether task 1 declared its parameter escaping or not; every `Rng` the app and the tests make (`createRng`, a wrapper closure) is escaping anyway.
6. **Purity.** `Deal.swift` imports nothing (not even Foundation) and names no clock, generator, timer, file or UI type; keep its comments free of those words too, in case the purity scan reads comments.
7. **Golden inputs, as plan A task 5 writes them.** Every argument is a key of `input`, named after the TypeScript parameter; an argument left `undefined` has no key and becomes nil or the Swift default. The shapes that are not plain values:

| File (`src.engine.deal.<function>.json`) | `input` keys | Note |
|---|---|---|
| `deal` | `pool`, `history`, `rng`, `options` (`count`, `avoid`?, `before`?, `budget`?) | `pool` may be `{"$deck": id}`; `count` may be a `$number` tag |
| `dealChunk` | `pool`, `history`, `rng`, `dealt`, `budget`? | no `budget` key: the default `SEARCH_BUDGET` |
| `rankByPriority` | `cards`, `history`, `rng`, `size` | output is a ranking: `withinCap`, `overCap`, `comeBack`, `missed` (the ids, an array), `missedCap` |
| `dealRanked` | `ranking`, `size`, `rng` (values), `setting` (`avoid`?, `before`?, `budget`?, `overdue`?) | |
| `choose` | `ranking`, `size`, `avoid`, `budget`, `overdue` | |
| `searchOverCap` | `ranking`, `unshown`, `search` (`size`, `avoid`, `budget`) | the test builds the search `choose` hands over |
| `searchWithAllRules` | `ranked`, `size`, `avoid`, `balance`, `limits` (`budget`?, `missed`? as ids, `missedLimit`?) | output `null` is no deal |
| `relaxStepByStep` | `ranked`, `size`, `avoid`, `balance`, `first` | |
| `arrange` | `chosen`, `rng` (values), `join` (`last`: `true`, `false` or `null`; `run`) | |
| `joinOf`, `runLimit`, `placementCheck` | `before`; `trues`, `falses`, `join`; `limit`, `t`, `f`, `last`, `run` | |
| `pickAnswer` | `allowed`, `trues`, `falses`, `rng` (values) | |
| `wasSeen`, `wasMissed`, `lastSeenAt`, `oldestFirst` | `card` or `cards`, `history` | the history kinds include NaN, infinite and `-0` values |
| `uniqueById`, `dealSize`, `balanceFor`, `balanceAllows`, `sharesGroup`, `trueCount` | the parameter names | |
| `DEAL`, `CHUNK`, `SEARCH_BUDGET`, `OVERDUE_AFTER_PASSES` (files `src.engine.deal.<NAME>.json`, and `src.engine.deal.DEAL.constant.json` for `DEAL`) | `null` | output is the value |

   If plan A's files differ from this table, the decoding in `DealGoldenTests.swift` follows the files; `Deal.swift` does not change.
8. **A `seen` that is not a whole number.** `CardHistory.seen` is an `Int` (README), as every stored entry is (`readProgress` keeps only non-negative integers). The web pins dealing over a corrupt history (`deal.test.ts`, "still deals a full, valid round from a history with corrupt numbers": `seen: NaN`, `seen: -4`), and plan A writes those cases. Dealing asks one thing of `seen`, `seen > 0`, so the golden suite reads histories with its own decoder: a `seen` that is not a whole number becomes 1 when it is above 0 and 0 otherwise (NaN is not above 0). The case is read and checked, not skipped (spec 7.1).
9. **Every load is a literal.** Each golden test calls `Golden.load("src/engine/deal", "<name>")` with two string literals, because task 1's coverage test reads the sources and counts only such calls (a name passed through a variable or a wrapper counts as no test once task 6 requires every file). `checked(_:_:)` then checks that the file holds the function asked for. Plan A names the constant `DEAL` `src.engine.deal.DEAL.constant.json` (its one exception), so `deal` and `DEAL` are two files even on the default macOS volume; task 1's `Golden.fileName` maps it.

**Steps:**

- [ ] **Step 1: Write the reference tests.**

`ios/TruthyEngine/Tests/TruthyEngineTests/DealReferenceTests.swift`:

```swift
// The exact reference vectors of the web's dealing tests, written out here so that they hold even before
// a golden file is read: tests/engine/deal-pins-polish.test.ts and tests/engine/overdue-boundary.test.ts,
// plus the edges of tests/engine/deal.test.ts that decide whether the rng is touched at all.
import Foundation
import Testing
@testable import TruthyEngine

// A card as the web tests build it (section "SEC", difficulty 2, an AWS source), decoded from its JSON so
// that the test depends only on the shipped card shape.
private func card(_ id: String, _ answer: Bool, _ conflictGroups: [String] = []) -> Card {
  let object: [String: Any] = [
    "id": id,
    "section": "SEC",
    "text": ["en": ["statement": "Statement \(id)", "explanation": "Explanation \(id)"]],
    "answer": answer,
    "source": ["title": "AWS documentation", "url": "https://docs.aws.amazon.com/"],
    "difficulty": 2,
    "appliesTo": "",
    "conflictGroups": conflictGroups,
  ]
  let data = try! JSONSerialization.data(withJSONObject: object)
  return try! JSONDecoder().decode(Card.self, from: data)
}

private func cards(_ prefix: String, _ n: Int, _ answer: (Int) -> Bool = { $0 % 2 == 0 }) -> [Card] {
  (0..<n).map { card("\(prefix)\($0 + 1)", answer($0)) }
}

private func missed(_ lastSeenAt: Double) -> CardHistory { CardHistory(seen: 1, lastCorrect: false, lastSeenAt: lastSeenAt) }
private func right(_ lastSeenAt: Double) -> CardHistory { CardHistory(seen: 1, lastCorrect: true, lastSeenAt: lastSeenAt) }

private func ids(_ dealt: [Card]) -> [String] { dealt.map(\.id) }

// An rng that counts its draws.
private final class Draws {
  var count = 0
}

private func counting(_ rng: @escaping Rng, _ draws: Draws) -> Rng {
  {
    draws.count += 1
    return rng()
  }
}

// 16 cards with answers True, False, True, ...; c3 and c8 share group a, c5 and c12 share group b; c1 and c6 were
// missed, c2 was answered right.
private let pinsPool: [Card] = (0..<16).map { i in
  card("c\(i + 1)", i % 2 == 0, i == 2 || i == 7 ? ["a"] : i == 4 || i == 11 ? ["b"] : [])
}
private let pinsHistory: History = ["c1": missed(5), "c2": CardHistory(seen: 2, lastCorrect: true, lastSeenAt: 9), "c6": missed(3)]

// c1 to c3 (True) and c4 to c8 (False) were missed, oldest first; c9 to c15 (True) were never seen; c16 (False)
// was answered right. c5 and c10 share group b.
private let overCapPool: [Card] = (0..<16).map { i in
  card("c\(i + 1)", i < 3 || (i >= 8 && i < 15), i == 4 || i == 9 ? ["b"] : [])
}
private let overCapHistory: History = {
  var history: History = ["c16": right(9)]
  for (i, c) in overCapPool.prefix(8).enumerated() { history[c.id] = missed(Double(i + 1)) }
  return history
}()

@Suite struct DealReferenceTests {
  @Test("the constants")
  func constants() {
    #expect(DEAL == DealConstants(missedPerTen: 3, minTrue: 4, maxTrue: 6, maxRun: 3))
    #expect(CHUNK == 10)
    #expect(SEARCH_BUDGET == 20_000)
    #expect(OVERDUE_AFTER_PASSES == 2)
  }

  @Test("deal-pins-polish: seed n deals exactly these ten cards in this order", arguments: [
    (1.0, ["c3", "c10", "c16", "c9", "c5", "c6", "c7", "c14", "c15", "c1"]),
    (2.0, ["c11", "c13", "c8", "c10", "c14", "c9", "c16", "c15", "c1", "c6"]),
    (3.0, ["c9", "c6", "c1", "c16", "c4", "c13", "c14", "c11", "c5", "c8"]),
  ])
  func referencePool(seed: Double, expected: [String]) {
    #expect(ids(deal(pinsPool, pinsHistory, createRng(seed), DealOptions(count: 10))) == expected)
    // dealChunk with nothing dealt takes the same path as deal with a count of ten (chunks.test.ts).
    #expect(ids(dealChunk(pinsPool, pinsHistory, createRng(seed), [])) == expected)
  }

  @Test("deal-pins-polish: three chunks with the seeds 100, 101 and 102")
  func threeChunks() {
    var dealt: [Card] = []
    for k in 0..<3 { dealt += dealChunk(pinsPool, pinsHistory, createRng(Double(100 + k)), dealt) }
    #expect(ids(dealt) == [
      "c11", "c6", "c14", "c9", "c13", "c10", "c3", "c16", "c1", "c15",
      "c7", "c4", "c12", "c8", "c5", "c2",
      "c6", "c14", "c11", "c10", "c9", "c13",
    ])
  }

  @Test("deal-pins-polish: more missed cards than the cap, seed n", arguments: [
    (1.0, ["c10", "c7", "c6", "c12", "c15", "c16", "c13", "c4", "c9", "c14"]),
    (2.0, ["c13", "c11", "c4", "c14", "c6", "c16", "c10", "c15", "c9", "c7"]),
    (3.0, ["c9", "c16", "c10", "c4", "c7", "c14", "c13", "c6", "c11", "c15"]),
  ])
  func overCap(seed: Double, expected: [String]) {
    #expect(ids(deal(overCapPool, overCapHistory, createRng(seed), DealOptions(count: 10))) == expected)
  }

  @Test("deal-pins-polish: six chunks with the seeds 210 to 215, k1 overdue in the sixth")
  func overdue() {
    let route = (0..<21).map { i in card("k\(i + 1)", i % 2 == 0, i == 0 || i == 11 ? ["pair"] : []) }
    var dealt: [Card] = []
    for k in 0..<6 { dealt += dealChunk(route, [:], createRng(Double(210 + k)), dealt) }
    #expect(ids(dealt) == [
      "k7", "k3", "k15", "k8", "k12", "k19", "k4", "k14", "k17", "k11",
      "k9", "k10", "k16", "k6", "k21", "k5", "k18", "k2", "k20", "k13",
      "k7", "k11", "k12", "k19", "k3", "k17", "k14", "k4", "k15", "k8",
      "k6", "k13", "k9", "k20", "k5", "k2", "k16", "k21", "k10", "k18",
      "k15", "k7", "k14", "k17", "k4", "k3", "k19", "k8", "k11", "k12",
      "k20", "k1", "k9", "k21", "k2", "k5", "k13", "k10", "k16", "k6",
    ])
  }

  @Test("overdue-boundary: six chunks with the seeds 150 to 155, k1 overdue at exactly twice the route")
  func overdueBoundary() {
    let route = (0..<25).map { i -> Card in
      let pair = i < 5 ? i : i - (CHUNK + 1)
      return card("k\(i + 1)", i % 2 == 0, pair >= 0 && pair < 5 ? ["pair\(pair + 1)"] : [])
    }
    var dealt: [Card] = []
    for k in 0..<6 { dealt += dealChunk(route, [:], createRng(Double(150 + k)), dealt) }
    #expect(!ids(Array(dealt.prefix(50))).contains("k1"))
    #expect(ids(dealt) == [
      "k15", "k23", "k2", "k6", "k10", "k11", "k22", "k5", "k24", "k14",
      "k12", "k7", "k25", "k21", "k18", "k17", "k20", "k8", "k9", "k19",
      "k3", "k10", "k16", "k6", "k13", "k4", "k22", "k11", "k23", "k24",
      "k12", "k21", "k17", "k19", "k18", "k8", "k25", "k20", "k9", "k7",
      "k10", "k5", "k15", "k23", "k24", "k6", "k22", "k11", "k14", "k2",
      "k25", "k1", "k20", "k9", "k19", "k8", "k21", "k17", "k16", "k18",
    ])
  }

  @Test("deal.test: no cards and no draw for a count of 0, -3 or NaN, or an empty pool", arguments: [0.0, -3.0, Double.nan])
  func nothingToDeal(count: Double) {
    let draws = Draws()
    let rng = counting(createRng(1), draws)
    #expect(deal(cards("c", 12), [:], rng, DealOptions(count: count)).isEmpty)
    #expect(deal([], [:], rng, DealOptions(count: 10)).isEmpty)
    #expect(draws.count == 0)
  }

  @Test("deal.test: a fractional count deals its floor, a pool that lists each id twice deals each card once")
  func countsAndDuplicates() {
    #expect(deal(cards("c", 40), [:], createRng(1), DealOptions(count: 4.7)).count == 4)
    let twice = deal(cards("c", 6) + cards("c", 6), [:], createRng(1), DealOptions(count: 10))
    #expect(twice.count == 6)
    #expect(Set(ids(twice)).count == 6)
  }

  // 16 unshown cards: 15 draws to rank them; t - 1 and f - 1 to shuffle the chosen True and False cards; then one
  // draw at each position where both answers are allowed. Counted with the TypeScript on the same pool.
  @Test("the draws of a first chunk, counted", arguments: [(1.0, 31), (2.0, 31), (3.0, 32)])
  func drawCount(seed: Double, expected: Int) {
    let draws = Draws()
    #expect(dealChunk(pinsPool, pinsHistory, counting(createRng(seed), draws), []).count == 10)
    #expect(draws.count == expected)
  }
}
```

- [ ] **Step 2: Run them and watch them fail.**

```bash
swift test --package-path ios/TruthyEngine --filter DealReferenceTests
```

Expected: the build of the test target fails, among others with `error: cannot find 'DealOptions' in scope`, `error: cannot find 'dealChunk' in scope` and `error: cannot find 'CHUNK' in scope`.

- [ ] **Step 3: Write the golden tests.**

`ios/TruthyEngine/Tests/TruthyEngineTests/DealGoldenTests.swift`:

```swift
// The golden vectors of the dealing (native-data/golden/src.engine.deal.*.json, plan A task 5): every case of
// deal and dealChunk, the constants, and each internal step of deal.ts, run through the Swift port.
// Cards are compared by id; a step that is given its rng as a list of values must use every value, no more.
import Foundation
import Testing
@testable import TruthyEngine

private let MODULE = "src/engine/deal"

// Every golden file of the module, by function name. The coverage test below fails when plan A writes one
// that is not in this list, so that no dealing vector goes unread (spec 7.1). Every test calls Golden.load with
// two string literals, which is how task 1's coverage test sees which files the suite reads.
private let DEAL_GOLDEN_FUNCTIONS: [String] = [
  "deal", "dealChunk", "DEAL", "CHUNK", "SEARCH_BUDGET", "OVERDUE_AFTER_PASSES",
  "dealRanked", "uniqueById", "dealSize", "wasSeen", "wasMissed", "lastSeenAt", "oldestFirst", "rankByPriority",
  "balanceFor", "choose", "searchOverCap", "searchWithAllRules", "relaxStepByStep", "sharesGroup", "trueCount",
  "balanceAllows", "arrange", "joinOf", "runLimit", "placementCheck", "pickAnswer",
]

// Checks that a loaded file is the file of `function` and has cases, and hands it back.
private func checked(_ file: GoldenFile, _ function: String) -> GoldenFile {
  #expect(file.module == MODULE)
  #expect(file.function == function, "the file read for \(function) holds \(file.function)")
  #expect(!file.cases.isEmpty, "\(function) has no cases")
  return file
}

private func member(_ value: GoldenValue, _ key: String) throws -> GoldenValue {
  guard let found = value[key] else { throw GoldenError(description: "no \(key) in \(value)") }
  return found
}

// A member that the TypeScript left undefined (written by leaving the key out) is nil.
private func optional(_ value: GoldenValue, _ key: String) -> GoldenValue? {
  value[key]
}

private func ids(_ cards: [Card]) -> [String] { cards.map(\.id) }

private func expectedIds(_ file: GoldenFile, _ value: GoldenValue) throws -> [String] {
  try ids(file.cards(value))
}

// Exact equality of numbers: -0 is not 0, NaN equals NaN.
private func same(_ a: Double, _ b: Double) -> Bool {
  (a.isNaN && b.isNaN) || (a == b && a.sign == b.sign)
}

// An rng of the case, wrapped to count its draws; `expected` is the number of values when the rng is a list.
private final class Draws {
  var count = 0
}

private func rng(_ file: GoldenFile, _ value: GoldenValue) throws -> (rng: Rng, draws: Draws, expected: Int?) {
  let inner = try file.rng(value)
  let draws = Draws()
  let values = try value["$rng"]?["values"]?.array()
  return ({ draws.count += 1; return inner() }, draws, values?.count)
}

private func expectAllDrawn(_ r: (rng: Rng, draws: Draws, expected: Int?), _ name: String) {
  if let expected = r.expected { #expect(r.draws.count == expected, "\(name): \(r.draws.count) draws of \(expected)") }
}

private func optionalCards(_ file: GoldenFile, _ value: GoldenValue?) throws -> [Card]? {
  guard let value else { return nil }
  return try file.cards(value)
}

private func optionalNumber(_ value: GoldenValue?) throws -> Double? {
  try value?.number()
}

// A history of a case. CardHistory.seen is an Int (README, task 1), as every stored entry is: readProgress keeps
// only a non-negative integer. The web's "a history with corrupt numbers" (deal.test.ts) and the history kinds of
// the internal vectors write seen NaN. Dealing asks one thing of seen, `seen > 0`, so a seen that is not a whole
// number reads as the Int with the same answer: 1 when it is above 0, 0 otherwise (NaN is not above 0).
private func history(_ value: GoldenValue) throws -> History {
  guard case .object(let entries) = value else { throw GoldenError(description: "not a history: \(value)") }
  var history: History = [:]
  for (id, entry) in entries {
    let seen = try member(entry, "seen").number()
    let whole = seen.isFinite && seen == seen.rounded(.towardZero) && abs(seen) < 9_007_199_254_740_992
    history[id] = CardHistory(
      seen: whole ? Int(seen) : (seen > 0 ? 1 : 0),
      lastCorrect: try member(entry, "lastCorrect").bool(),
      lastSeenAt: try member(entry, "lastSeenAt").number()
    )
  }
  return history
}

private func ranking(_ file: GoldenFile, _ value: GoldenValue) throws -> Ranking {
  Ranking(
    withinCap: try file.cards(member(value, "withinCap")),
    overCap: try file.cards(member(value, "overCap")),
    comeBack: try file.cards(member(value, "comeBack")),
    missed: Set(try member(value, "missed").array().map { try $0.string() }),
    missedCap: try member(value, "missedCap").int()
  )
}

private func balance(_ value: GoldenValue) throws -> Balance {
  Balance(minTrue: try member(value, "minTrue").int(), maxTrue: try member(value, "maxTrue").int())
}

private func lastAnswer(_ value: GoldenValue) throws -> Bool? {
  value == .null ? nil : try value.bool()
}

private func join(_ value: GoldenValue) throws -> Join {
  Join(last: try lastAnswer(member(value, "last")), run: try member(value, "run").int())
}

private func bools(_ value: GoldenValue) throws -> [Bool] {
  try value.array().map { try $0.bool() }
}

private func setting(_ file: GoldenFile, _ value: GoldenValue) throws -> Setting {
  Setting(
    avoid: try optionalCards(file, optional(value, "avoid")),
    before: try optional(value, "before").map(bools),
    budget: try optionalNumber(optional(value, "budget")),
    overdue: try optional(value, "overdue")?.bool()
  )
}

private func limits(_ value: GoldenValue) throws -> Limits {
  Limits(
    budget: try optionalNumber(optional(value, "budget")),
    missed: try optional(value, "missed").map { Set(try $0.array().map { try $0.string() }) },
    missedLimit: try optional(value, "missedLimit")?.int()
  )
}

// A deal or no deal (null).
private func expectedDeal(_ file: GoldenFile, _ value: GoldenValue) throws -> [String]? {
  value == .null ? nil : try expectedIds(file, value)
}

@Suite struct DealGoldenTests {
  @Test("every golden file of src/engine/deal is read by this suite")
  func coverage() throws {
    let prefix = MODULE.replacingOccurrences(of: "/", with: ".") + "."
    let names = try FileManager.default.contentsOfDirectory(atPath: Golden.directory.path)
      .filter { $0.hasPrefix(prefix) && $0.hasSuffix(".json") }
      .map { String($0.dropFirst(prefix.count).dropLast(".json".count)) }
      .map { $0 == "DEAL.constant" ? "DEAL" : $0 }
    #expect(Set(names) == Set(DEAL_GOLDEN_FUNCTIONS))
  }

  @Test("deal")
  func dealVectors() throws {
    let file = checked(try Golden.load("src/engine/deal", "deal"), "deal")
    for c in file.cases {
      let options = try member(c.input, "options")
      let r = try rng(file, member(c.input, "rng"))
      let dealt = deal(
        try file.cards(member(c.input, "pool")), try history(member(c.input, "history")), r.rng,
        DealOptions(
          count: try member(options, "count").number(),
          avoid: try optionalCards(file, optional(options, "avoid")),
          before: try optional(options, "before").map(bools),
          budget: try optionalNumber(optional(options, "budget"))
        )
      )
      #expect(ids(dealt) == (try expectedIds(file, c.output)), "\(c.name)")
    }
  }

  @Test("dealChunk")
  func dealChunkVectors() throws {
    let file = checked(try Golden.load("src/engine/deal", "dealChunk"), "dealChunk")
    for c in file.cases {
      let pool = try file.cards(member(c.input, "pool"))
      let history = try history(member(c.input, "history"))
      let r = try rng(file, member(c.input, "rng"))
      let dealt = try file.cards(member(c.input, "dealt"))
      let output = if let budget = optional(c.input, "budget") {
        dealChunk(pool, history, r.rng, dealt, try budget.number())
      } else {
        dealChunk(pool, history, r.rng, dealt)
      }
      #expect(ids(output) == (try expectedIds(file, c.output)), "\(c.name)")
    }
  }

  @Test("the constants DEAL, CHUNK, SEARCH_BUDGET and OVERDUE_AFTER_PASSES")
  func constants() throws {
    let deal = checked(try Golden.load("src/engine/deal", "DEAL"), "DEAL")
    for c in deal.cases {
      #expect(c.input == .null)
      #expect(DEAL == DealConstants(
        missedPerTen: try member(c.output, "missedPerTen").int(),
        minTrue: try member(c.output, "minTrue").int(),
        maxTrue: try member(c.output, "maxTrue").int(),
        maxRun: try member(c.output, "maxRun").int()
      ))
    }
    for c in checked(try Golden.load("src/engine/deal", "CHUNK"), "CHUNK").cases { #expect(CHUNK == (try c.output.int())) }
    for c in checked(try Golden.load("src/engine/deal", "SEARCH_BUDGET"), "SEARCH_BUDGET").cases { #expect(same(SEARCH_BUDGET, try c.output.number())) }
    for c in checked(try Golden.load("src/engine/deal", "OVERDUE_AFTER_PASSES"), "OVERDUE_AFTER_PASSES").cases { #expect(OVERDUE_AFTER_PASSES == (try c.output.int())) }
  }

  @Test("uniqueById")
  func uniqueByIdVectors() throws {
    let file = checked(try Golden.load("src/engine/deal", "uniqueById"), "uniqueById")
    for c in file.cases {
      #expect(ids(uniqueById(try file.cards(member(c.input, "pool")))) == (try expectedIds(file, c.output)), "\(c.name)")
    }
  }

  @Test("dealSize")
  func dealSizeVectors() throws {
    let file = checked(try Golden.load("src/engine/deal", "dealSize"), "dealSize")
    for c in file.cases {
      let size = dealSize(try member(c.input, "count").number(), try member(c.input, "available").int())
      #expect(size == (try c.output.int()), "\(c.name)")
    }
  }

  @Test("wasSeen, wasMissed and lastSeenAt")
  func historyVectors() throws {
    let seen = checked(try Golden.load("src/engine/deal", "wasSeen"), "wasSeen")
    for c in seen.cases {
      let output = wasSeen(try seen.card(member(c.input, "card")), try history(member(c.input, "history")))
      #expect(output == (try c.output.bool()), "wasSeen: \(c.name)")
    }
    let missed = checked(try Golden.load("src/engine/deal", "wasMissed"), "wasMissed")
    for c in missed.cases {
      let output = wasMissed(try missed.card(member(c.input, "card")), try history(member(c.input, "history")))
      #expect(output == (try c.output.bool()), "wasMissed: \(c.name)")
    }
    let file = checked(try Golden.load("src/engine/deal", "lastSeenAt"), "lastSeenAt")
    for c in file.cases {
      let at = lastSeenAt(try file.card(member(c.input, "card")), try history(member(c.input, "history")))
      #expect(same(at, try c.output.number()), "lastSeenAt: \(c.name)")
    }
  }

  @Test("oldestFirst")
  func oldestFirstVectors() throws {
    let file = checked(try Golden.load("src/engine/deal", "oldestFirst"), "oldestFirst")
    for c in file.cases {
      let sorted = oldestFirst(try file.cards(member(c.input, "cards")), try history(member(c.input, "history")))
      #expect(ids(sorted) == (try expectedIds(file, c.output)), "\(c.name)")
    }
  }

  @Test("rankByPriority")
  func rankByPriorityVectors() throws {
    let file = checked(try Golden.load("src/engine/deal", "rankByPriority"), "rankByPriority")
    for c in file.cases {
      let r = try rng(file, member(c.input, "rng"))
      let ranked = rankByPriority(
        try file.cards(member(c.input, "cards")), try history(member(c.input, "history")), r.rng,
        try member(c.input, "size").int()
      )
      #expect(ranked == (try ranking(file, c.output)), "\(c.name)")
      expectAllDrawn(r, c.name)
    }
  }

  @Test("dealRanked")
  func dealRankedVectors() throws {
    let file = checked(try Golden.load("src/engine/deal", "dealRanked"), "dealRanked")
    for c in file.cases {
      let r = try rng(file, member(c.input, "rng"))
      let dealt = dealRanked(
        try ranking(file, member(c.input, "ranking")), try member(c.input, "size").int(), r.rng,
        try setting(file, member(c.input, "setting"))
      )
      #expect(ids(dealt) == (try expectedIds(file, c.output)), "\(c.name)")
      expectAllDrawn(r, c.name)
    }
  }

  @Test("choose")
  func chooseVectors() throws {
    let file = checked(try Golden.load("src/engine/deal", "choose"), "choose")
    for c in file.cases {
      let chosen = choose(
        try ranking(file, member(c.input, "ranking")), try member(c.input, "size").int(),
        try file.cards(member(c.input, "avoid")), try member(c.input, "budget").number(),
        try member(c.input, "overdue").bool()
      )
      #expect(ids(chosen) == (try expectedIds(file, c.output)), "\(c.name)")
    }
  }

  @Test("searchOverCap")
  func searchOverCapVectors() throws {
    let file = checked(try Golden.load("src/engine/deal", "searchOverCap"), "searchOverCap")
    for c in file.cases {
      let ranked = try ranking(file, member(c.input, "ranking"))
      let unshown = try file.cards(member(c.input, "unshown"))
      let spec = try member(c.input, "search")
      let size = try member(spec, "size").int()
      let avoid = try file.cards(member(spec, "avoid"))
      let budget = try member(spec, "budget").number()
      // The search choose hands over: its own budget and the ranking's missed cards, then the limits given.
      let search = { (cards: [Card], given: Limits) -> [Card]? in
        searchWithAllRules(cards, size, avoid, balanceFor(size), Limits(
          budget: given.budget ?? budget, missed: given.missed ?? ranked.missed, missedLimit: given.missedLimit
        ))
      }
      let found = searchOverCap(ranked, unshown, search)
      #expect(found.map(ids) == (try expectedDeal(file, c.output)), "\(c.name)")
    }
  }

  @Test("searchWithAllRules")
  func searchWithAllRulesVectors() throws {
    let file = checked(try Golden.load("src/engine/deal", "searchWithAllRules"), "searchWithAllRules")
    for c in file.cases {
      let found = searchWithAllRules(
        try file.cards(member(c.input, "ranked")), try member(c.input, "size").int(),
        try file.cards(member(c.input, "avoid")), try balance(member(c.input, "balance")),
        try limits(member(c.input, "limits"))
      )
      #expect(found.map(ids) == (try expectedDeal(file, c.output)), "\(c.name)")
    }
  }

  @Test("relaxStepByStep")
  func relaxStepByStepVectors() throws {
    let file = checked(try Golden.load("src/engine/deal", "relaxStepByStep"), "relaxStepByStep")
    for c in file.cases {
      let picked = relaxStepByStep(
        try file.cards(member(c.input, "ranked")), try member(c.input, "size").int(),
        try file.cards(member(c.input, "avoid")), try balance(member(c.input, "balance")),
        try file.cards(member(c.input, "first"))
      )
      #expect(ids(picked) == (try expectedIds(file, c.output)), "\(c.name)")
    }
  }

  @Test("sharesGroup and trueCount")
  func groupsAndCounts() throws {
    let shares = checked(try Golden.load("src/engine/deal", "sharesGroup"), "sharesGroup")
    for c in shares.cases {
      let output = sharesGroup(try shares.card(member(c.input, "card")), try shares.cards(member(c.input, "others")))
      #expect(output == (try c.output.bool()), "sharesGroup: \(c.name)")
    }
    let counts = checked(try Golden.load("src/engine/deal", "trueCount"), "trueCount")
    for c in counts.cases {
      #expect(trueCount(try counts.cards(member(c.input, "cards"))) == (try c.output.int()), "trueCount: \(c.name)")
    }
  }

  @Test("balanceFor and balanceAllows")
  func balanceVectors() throws {
    let file = checked(try Golden.load("src/engine/deal", "balanceFor"), "balanceFor")
    for c in file.cases {
      #expect(balanceFor(try member(c.input, "size").int()) == (try balance(c.output)), "balanceFor: \(c.name)")
    }
    let allows = checked(try Golden.load("src/engine/deal", "balanceAllows"), "balanceAllows")
    for c in allows.cases {
      let output = balanceAllows(
        try member(c.input, "answer").bool(), try member(c.input, "trues").int(), try member(c.input, "falses").int(),
        try member(c.input, "size").int(), try balance(member(c.input, "balance"))
      )
      #expect(output == (try c.output.bool()), "balanceAllows: \(c.name)")
    }
  }

  @Test("arrange")
  func arrangeVectors() throws {
    let file = checked(try Golden.load("src/engine/deal", "arrange"), "arrange")
    for c in file.cases {
      let r = try rng(file, member(c.input, "rng"))
      let order = arrange(try file.cards(member(c.input, "chosen")), r.rng, try join(member(c.input, "join")))
      #expect(ids(order) == (try expectedIds(file, c.output)), "\(c.name)")
      expectAllDrawn(r, c.name)
    }
  }

  @Test("joinOf, runLimit and placementCheck")
  func runVectors() throws {
    let joins = checked(try Golden.load("src/engine/deal", "joinOf"), "joinOf")
    for c in joins.cases {
      #expect(joinOf(try bools(member(c.input, "before"))) == (try join(c.output)), "joinOf: \(c.name)")
    }
    let limits = checked(try Golden.load("src/engine/deal", "runLimit"), "runLimit")
    for c in limits.cases {
      let limit = runLimit(try member(c.input, "trues").int(), try member(c.input, "falses").int(), try join(member(c.input, "join")))
      #expect(limit == (try c.output.int()), "runLimit: \(c.name)")
    }
    let places = checked(try Golden.load("src/engine/deal", "placementCheck"), "placementCheck")
    for c in places.cases {
      let canPlace = placementCheck(try member(c.input, "limit").int())
      let output = canPlace(
        try member(c.input, "t").int(), try member(c.input, "f").int(), try lastAnswer(member(c.input, "last")),
        try member(c.input, "run").int()
      )
      #expect(output == (try c.output.bool()), "placementCheck: \(c.name)")
    }
  }

  @Test("pickAnswer")
  func pickAnswerVectors() throws {
    let file = checked(try Golden.load("src/engine/deal", "pickAnswer"), "pickAnswer")
    for c in file.cases {
      let r = try rng(file, member(c.input, "rng"))
      let output = pickAnswer(
        try bools(member(c.input, "allowed")), try member(c.input, "trues").int(), try member(c.input, "falses").int(), r.rng
      )
      #expect(output == (try c.output.bool()), "\(c.name)")
      expectAllDrawn(r, c.name)
    }
  }
}
```

- [ ] **Step 4: Build them and watch them fail.**

```bash
swift build --package-path ios/TruthyEngine --build-tests
```

Expected: the same errors as step 2, plus `error: cannot find type 'Ranking' in scope`, `error: cannot find type 'Setting' in scope` and `error: cannot find 'Limits' in scope`.

- [ ] **Step 5: Write the port.**

`ios/TruthyEngine/Sources/TruthyEngine/Deal.swift`:

```swift
// Dealing: which cards a round gets, and in which order (spec section 6, "Dealing").
// A line-by-line port of src/engine/deal.ts. The only source of chance is the rng passed in.

/// The rules of a deal, per ten cards: at most three missed cards, four to six True cards, runs of at most three.
public struct DealConstants: Equatable, Sendable {
  public let missedPerTen: Int
  public let minTrue: Int
  public let maxTrue: Int
  public let maxRun: Int
}

public let DEAL = DealConstants(missedPerTen: 3, minTrue: 4, maxTrue: 6, maxRun: 3)

public struct DealOptions: Equatable, Sendable {
  public var count: Double // how many cards to deal (a Double, as in the TypeScript: NaN, 4.7 and -3 have pinned results)
  public var avoid: [Card]? // cards whose conflict groups must not be repeated
  public var before: [Bool]? // the answers of the cards dealt just before this deal, oldest first
  public var budget: Double? // the steps one search may take, SEARCH_BUDGET unless a test sets another

  public init(count: Double, avoid: [Card]? = nil, before: [Bool]? = nil, budget: Double? = nil) {
    self.count = count
    self.avoid = avoid
    self.before = before
    self.budget = budget
  }
}

public func deal(_ pool: [Card], _ history: History, _ rng: @escaping Rng, _ options: DealOptions) -> [Card] {
  let cards = uniqueById(pool)
  let size = dealSize(options.count, cards.count)
  if size == 0 { return [] }
  return dealRanked(
    rankByPriority(cards, history, rng, size), size, rng,
    Setting(avoid: options.avoid, before: options.before, budget: options.budget)
  )
}

// How a deal is chosen beyond its cards: the conflict groups to keep clear of, the answers just before it,
// the bound on the search and whether an unshown card is overdue (dealChunk only).
struct Setting: Equatable {
  var avoid: [Card]? = nil
  var before: [Bool]? = nil
  var budget: Double? = nil
  var overdue: Bool? = nil
}

// Chooses `size` cards from a ranking and puts them in order.
func dealRanked(_ ranking: Ranking, _ size: Int, _ rng: @escaping Rng, _ setting: Setting) -> [Card] {
  let chosen = choose(ranking, size, setting.avoid ?? [], setting.budget ?? SEARCH_BUDGET, setting.overdue ?? false)
  return arrange(chosen, rng, joinOf(setting.before ?? []))
}

// Where a deal joins the cards before it: their last answer and the length of the run of equal answers
// that ends them. Nothing before: no last answer, no run.
struct Join: Equatable {
  var last: Bool?
  var run: Int
}

func joinOf(_ before: [Bool]) -> Join {
  let last = before.last
  var run = 0
  var i = before.count - 1
  while i >= 0 && before[i] == last {
    run += 1
    i -= 1
  }
  return Join(last: last, run: run)
}

public let CHUNK = 10

// The next cards of a round, given every card the round has dealt so far (in order): ten, or as many as
// may be dealt. First in line are the cards the round has not shown, ranked by the stored history. Behind
// them stand the cards it may bring back: every card outside the last min(CHUNK, route size - 1) dealt,
// the one shown longest ago first. A card still unshown once the round has dealt the route twice over is
// overdue: the chunk then takes one unshown card even if a rule has to give way for it (see choose).
public func dealChunk(_ pool: [Card], _ history: History, _ rng: @escaping Rng, _ dealt: [Card], _ budget: Double = SEARCH_BUDGET) -> [Card] {
  let cards = uniqueById(pool)
  var lastDealtAt: [String: Int] = [:]
  for (position, card) in dealt.enumerated() { lastDealtAt[card.id] = position }
  let unshown = cards.filter { lastDealtAt[$0.id] == nil }
  let gap = min(CHUNK, cards.count - 1)
  let comeBack = stableSorted(cards.filter { (lastDealtAt[$0.id] ?? dealt.count) < dealt.count - gap }) {
    Double(lastDealtAt[$0.id] ?? 0)
  }
  let size = min(CHUNK, unshown.count + comeBack.count)
  let lastTen = Array(dealt.suffix(CHUNK))
  var ranking = rankByPriority(unshown, history, rng, size)
  ranking.comeBack = comeBack
  return dealRanked(ranking, size, rng, Setting(
    avoid: lastTen,
    before: lastTen.map(\.answer),
    budget: budget,
    overdue: !unshown.isEmpty && dealt.count >= OVERDUE_AFTER_PASSES * cards.count
  ))
}

// How many times a round deals the whole route before a card it has not shown is overdue.
let OVERDUE_AFTER_PASSES = 2

// The first card with each id wins, so a card can never be dealt twice.
func uniqueById(_ pool: [Card]) -> [Card] {
  var seen = Set<String>()
  return pool.filter { seen.insert($0.id).inserted }
}

func dealSize(_ count: Double, _ available: Int) -> Int {
  if count.isNaN || count <= 0 { return 0 }
  return Int(min(count.rounded(.down), Double(available)))
}

func wasSeen(_ card: Card, _ history: History) -> Bool {
  guard let entry = history[card.id] else { return false }
  return entry.seen > 0
}

func wasMissed(_ card: Card, _ history: History) -> Bool {
  wasSeen(card, history) && history[card.id]?.lastCorrect == false
}

func lastSeenAt(_ card: Card, _ history: History) -> Double {
  if let at = history[card.id]?.lastSeenAt, at.isFinite { return at }
  return 0
}

// Array.prototype.sort is stable; Swift's sort is not promised to be, so equal keys keep their order through
// an index tiebreak (spec 4.4). -0 and 0 are equal keys, as `a - b` is 0 for them in the TypeScript.
func stableSorted(_ cards: [Card], by key: (Card) -> Double) -> [Card] {
  let keys: [Double] = cards.map(key)
  let order: [Int] = cards.indices.sorted { (a: Int, b: Int) -> Bool in
    if keys[a] != keys[b] { return keys[a] < keys[b] }
    return a < b
  }
  return order.map { cards[$0] }
}

// Oldest first; equal times keep their (shuffled) order.
func oldestFirst(_ cards: [Card], _ history: History) -> [Card] {
  stableSorted(cards) { lastSeenAt($0, history) }
}

// The pool in the order cards should be considered: missed cards up to the cap (oldest miss first),
// never seen (shuffled), seen longest ago. The missed cards over the cap are kept apart.
struct Ranking: Equatable {
  var withinCap: [Card]
  var overCap: [Card]
  var comeBack: [Card] // dealChunk only: cards the round has shown and may bring back, the one shown longest ago first
  var missed: Set<String> // the ids of the missed cards among withinCap and overCap
  var missedCap: Int // how many missed cards a deal of this size holds at most, unless the rules need more
}

func rankByPriority(_ cards: [Card], _ history: History, _ rng: @escaping Rng, _ size: Int) -> Ranking {
  let shuffled = shuffle(cards, rng)
  let missed = oldestFirst(shuffled.filter { wasMissed($0, history) }, history)
  let unseen = shuffled.filter { !wasSeen($0, history) }
  let seenRight = oldestFirst(shuffled.filter { wasSeen($0, history) && !wasMissed($0, history) }, history)
  let missedCap = Int((Double(size * DEAL.missedPerTen) / 10).rounded(.down))
  return Ranking(
    withinCap: Array(missed.prefix(missedCap)) + unseen + seenRight,
    overCap: Array(missed.dropFirst(missedCap)),
    comeBack: [],
    missed: Set(missed.map(\.id)),
    missedCap: missedCap
  )
}

// How many True cards a deal of `size` may have: 4 to 6 per ten, scaled (floor of 40%, ceiling of 60%).
struct Balance: Equatable {
  var minTrue: Int
  var maxTrue: Int
}

func balanceFor(_ size: Int) -> Balance {
  Balance(
    minTrue: Int((Double(size * DEAL.minTrue) / 10).rounded(.down)),
    maxTrue: Int((Double(size * DEAL.maxTrue) / 10).rounded(.up))
  )
}

// Picks `size` cards, relaxing the rules in the order of the spec only as far as needed:
// 1. every rule, without the missed cards over the cap; 2. the missed cards over the cap (searchOverCap);
// 3. a card the round has shown may come back; 4. conflict groups, then 5. answer balance (relaxStepByStep).
// When an unshown card is overdue and the chunk holds none, the first unshown card goes in and the
// fallback relaxes the rest of the chunk around it.
func choose(_ ranking: Ranking, _ size: Int, _ avoid: [Card], _ budget: Double, _ overdue: Bool) -> [Card] {
  let balance = balanceFor(size)
  let unshown = ranking.withinCap + ranking.overCap
  let everyCard = unshown + ranking.comeBack
  let search = { (ranked: [Card], limits: Limits) -> [Card]? in
    searchWithAllRules(ranked, size, avoid, balance, Limits(
      budget: limits.budget ?? budget,
      missed: limits.missed ?? ranking.missed,
      missedLimit: limits.missedLimit
    ))
  }
  let chosen: [Card]
  if let found = search(ranking.withinCap, Limits()) {
    chosen = found
  } else if let found = searchOverCap(ranking, unshown, search) {
    chosen = found
  } else if !ranking.comeBack.isEmpty, let found = search(everyCard, Limits()) {
    chosen = found
  } else {
    chosen = relaxStepByStep(everyCard, size, avoid, balance)
  }
  let unshownIds = Set(unshown.map(\.id))
  if !overdue || chosen.contains(where: { unshownIds.contains($0.id) }) { return chosen }
  return relaxStepByStep(everyCard, size, avoid, balance, Array(unshown.prefix(1)))
}

// Step 2. A deal that keeps the missed cards within the cap comes before a deal over it; over the cap, the
// fewer missed cards the better. The limits tried run from the cap up to one below what the loosest deal holds.
func searchOverCap(_ ranking: Ranking, _ unshown: [Card], _ search: ([Card], Limits) -> [Card]?) -> [Card]? {
  if ranking.overCap.isEmpty { return nil }
  guard let loosest = search(unshown, Limits()) else { return nil }
  let held = loosest.filter { ranking.missed.contains($0.id) }.count
  var limit = ranking.missedCap
  while limit < held {
    if let found = search(unshown, Limits(missedLimit: limit)) { return found }
    limit += 1
  }
  return loosest
}

// A bound on the work one search may do (a Double, so that a test can pass Infinity as the web's does).
public let SEARCH_BUDGET: Double = 20_000

// What else a search must keep to: the steps it may take, and at most `missedLimit` of the `missed` cards.
// No missedLimit is the TypeScript's Infinity.
struct Limits: Equatable {
  var budget: Double? = nil
  var missed: Set<String>? = nil
  var missedLimit: Int? = nil
}

// Depth-first over the ranked cards: at each card, first try to take it, then try to leave it out.
// Returns nil when no deal keeps both the conflict groups and the balance (or the search ran out of steps).
func searchWithAllRules(_ ranked: [Card], _ size: Int, _ avoid: [Card], _ balance: Balance, _ limits: Limits = Limits()) -> [Card]? {
  var usedGroups = Set(avoid.flatMap(\.conflictGroups))
  var picked: [Card] = []
  let missed = limits.missed ?? []
  let missedLimit = limits.missedLimit ?? Int.max // Int.max stands for Infinity: nothing below overflows with it
  var trues = 0
  var missedTaken = 0
  var budget = limits.budget ?? SEARCH_BUDGET

  func isMissed(_ card: Card) -> Bool { missed.contains(card.id) }

  func canTake(_ card: Card) -> Bool {
    !card.conflictGroups.contains { usedGroups.contains($0) }
      && !(isMissed(card) && missedTaken >= missedLimit)
      && balanceAllows(card.answer, trues, picked.count - trues, size, balance)
  }

  func take(_ card: Card) {
    picked.append(card)
    if card.answer { trues += 1 }
    if isMissed(card) { missedTaken += 1 }
    for group in card.conflictGroups { usedGroups.insert(group) }
  }

  // A card is only taken when none of its groups is in use, so removing them on the way back is safe.
  func putBack(_ card: Card) {
    picked.removeLast()
    if card.answer { trues -= 1 }
    if isMissed(card) { missedTaken -= 1 }
    for group in card.conflictGroups { usedGroups.remove(group) }
  }

  // Whether ranked[from...] can still fill the deal: an upper bound on what those cards can add.
  func canStillFinish(_ from: Int) -> Bool {
    var loose = [0, 0] // cards with no group, by answer (0 False, 1 True)
    var grouped = [0, 0] // cards with groups, by answer
    var groupsOf = [Set<String>(), Set<String>()]
    var allGroups = Set<String>()
    var takeable = 0
    var missedLeft = 0
    for card in ranked.dropFirst(from) {
      if card.conflictGroups.contains(where: { usedGroups.contains($0) }) { continue }
      let answer = card.answer ? 1 : 0
      takeable += 1
      if isMissed(card) { missedLeft += 1 }
      if card.conflictGroups.isEmpty {
        loose[answer] += 1
        continue
      }
      grouped[answer] += 1
      for group in card.conflictGroups {
        groupsOf[answer].insert(group)
        allGroups.insert(group)
      }
    }
    let need = size - picked.count
    let falses = picked.count - trues
    let cardsLeft = loose[0] + loose[1] + min(grouped[0] + grouped[1], allGroups.count)
    let withinMissedLimit = takeable - max(0, missedLeft - (missedLimit - missedTaken))
    let truesLeft = min(loose[1] + min(grouped[1], groupsOf[1].count), balance.maxTrue - trues)
    let falsesLeft = min(loose[0] + min(grouped[0], groupsOf[0].count), size - balance.minTrue - falses)
    return min(cardsLeft, withinMissedLimit, truesLeft + falsesLeft) >= need
  }

  func visit(_ from: Int) -> Bool {
    if picked.count == size { return true }
    let left = budget
    budget -= 1
    if left <= 0 || !canStillFinish(from) { return false }
    guard from < ranked.count else { return false }
    let card = ranked[from]
    if canTake(card) {
      take(card)
      if visit(from + 1) { return true }
      putBack(card)
    }
    return visit(from + 1)
  }

  return visit(0) ? picked : nil
}

struct Rules: Equatable {
  var conflicts: Bool // keep conflict groups apart (within the deal and against `avoid`)
  var balance: Bool // keep the number of True cards inside the balance
}

// The fallback when no deal keeps every rule. Three passes over the ranked cards, each adding to the cards
// already picked (`first`, if given): all rules, then without conflict groups, then without the balance.
func relaxStepByStep(_ ranked: [Card], _ size: Int, _ avoid: [Card], _ balance: Balance, _ first: [Card] = []) -> [Card] {
  var picked = first
  var pickedIds = Set(first.map(\.id))

  func breaks(_ card: Card, _ rules: Rules) -> Bool {
    if rules.conflicts && sharesGroup(card, avoid + picked) { return true }
    if !rules.balance { return false }
    let trues = trueCount(picked)
    return !balanceAllows(card.answer, trues, picked.count - trues, size, balance)
  }

  func fill(_ rules: Rules) {
    for card in ranked {
      if picked.count == size { return }
      if pickedIds.contains(card.id) || breaks(card, rules) { continue }
      picked.append(card)
      pickedIds.insert(card.id)
    }
  }

  fill(Rules(conflicts: true, balance: true))
  fill(Rules(conflicts: false, balance: true))
  fill(Rules(conflicts: false, balance: false))
  return picked
}

func sharesGroup(_ card: Card, _ others: [Card]) -> Bool {
  card.conflictGroups.contains { group in others.contains { $0.conflictGroups.contains(group) } }
}

func trueCount(_ cards: [Card]) -> Int {
  cards.filter(\.answer).count
}

// True cards may not pass maxTrue, and False cards may not pass size - minTrue,
// so a full deal picked under this rule always lands inside the balance.
func balanceAllows(_ answer: Bool, _ trues: Int, _ falses: Int, _ size: Int, _ balance: Balance) -> Bool {
  answer ? trues < balance.maxTrue : falses < size - balance.minTrue
}

// Puts the chosen cards in an order drawn from the rng with no run of equal answers longer than the run limit.
// Position by position, it draws True or False in proportion to how many of each are left, among the answers
// that still allow the rest to be placed; then it takes the next card of that answer.
func arrange(_ chosen: [Card], _ rng: @escaping Rng, _ join: Join) -> [Card] {
  var trues = shuffle(chosen.filter(\.answer), rng)
  var falses = shuffle(chosen.filter { !$0.answer }, rng)
  let limit = runLimit(trues.count, falses.count, join)
  let canPlace = placementCheck(limit)
  var order: [Card] = []
  var last = join.last
  var run = join.run

  while trues.count + falses.count > 0 {
    let allowed = [true, false].filter { answer in
      let left = answer ? trues.count : falses.count
      if left == 0 || (answer == last && run >= limit) { return false }
      let nextRun = answer == last ? run + 1 : 1
      return canPlace(trues.count - (answer ? 1 : 0), falses.count - (answer ? 0 : 1), answer, nextRun)
    }
    let answer = pickAnswer(allowed, trues.count, falses.count, rng)
    guard let card = answer ? trues.first : falses.first else { break }
    if answer { trues.removeFirst() } else { falses.removeFirst() }
    order.append(card)
    run = answer == last ? run + 1 : 1
    last = answer
  }
  return order
}

// The run limit is DEAL.maxRun, unless no order of these answers after the cards before them can keep it;
// then it is the smallest limit some order can keep.
func runLimit(_ trues: Int, _ falses: Int, _ join: Join) -> Int {
  var limit = DEAL.maxRun
  while !placementCheck(limit)(trues, falses, join.last, join.run) { limit += 1 }
  return limit
}

// canPlace(t, f, last, run): can t True and f False cards still be placed after a run of `run` cards
// with answer `last`, without any run passing the limit? Memoised, so a whole deal costs little.
func placementCheck(_ limit: Int) -> (Int, Int, Bool?, Int) -> Bool {
  let memo = PlacementMemo()
  func canPlace(_ t: Int, _ f: Int, _ last: Bool?, _ run: Int) -> Bool {
    if t == 0 && f == 0 { return true }
    let key = PlacementKey(t: t, f: f, last: last, run: run)
    if let known = memo.known[key] { return known }
    let result =
      (t > 0 && (last != true || run < limit) && canPlace(t - 1, f, true, last == true ? run + 1 : 1))
      || (f > 0 && (last != false || run < limit) && canPlace(t, f - 1, false, last == false ? run + 1 : 1))
    memo.known[key] = result
    return result
  }
  return canPlace
}

private final class PlacementMemo {
  var known: [PlacementKey: Bool] = [:]
}

private struct PlacementKey: Hashable {
  let t: Int
  let f: Int
  let last: Bool?
  let run: Int
}

// Chooses between the allowed answers in proportion to the cards left of each.
// The run limit always leaves at least one allowed answer; the empty case is only a guard.
func pickAnswer(_ allowed: [Bool], _ trues: Int, _ falses: Int, _ rng: @escaping Rng) -> Bool {
  if allowed.isEmpty { return trues > 0 }
  if allowed.count == 1 { return allowed[0] == true }
  return rng() * Double(trues + falses) < Double(trues)
}
```

- [ ] **Step 6: Run the reference tests.**

```bash
swift test --package-path ios/TruthyEngine --filter DealReferenceTests
```

Expected: `✔ Test run with 9 tests in 1 suite passed`. If a reference vector differs, compare the draws first: the test "the draws of a first chunk, counted" tells a draw in the wrong place from a rule ported wrong.

- [ ] **Step 7: Run the golden tests.**

```bash
swift test --package-path ios/TruthyEngine --filter DealGoldenTests
```

Expected: `✔ Test run with 19 tests in 1 suite passed` (the `dealChunk` test reads every shipped deck and takes a few seconds in a debug build). A failure names the case (`#expect` carries the case name). A failure in `checked` that says the file holds another function, or a coverage failure that lacks `deal` or `DEAL`, means a golden file name does not map as Rule 9 says: compare `ls native-data/golden | grep src.engine.deal.` with the 27 names and task 1's `Golden.fileName`. A coverage failure that lists another name means plan A wrote a vector this task does not read: stop and find out which function it belongs to.

- [ ] **Step 8: Check that the golden suite catches an unstable sort.**

Break the tie rule of `stableSorted` on purpose, run, and put it back:

```bash
sed -i '' 's/    return a < b$/    return a > b/' ios/TruthyEngine/Sources/TruthyEngine/Deal.swift && swift test --package-path ios/TruthyEngine --filter DealGoldenTests; sed -i '' 's/    return a > b$/    return a < b/' ios/TruthyEngine/Sources/TruthyEngine/Deal.swift && grep -c '    return a < b$' ios/TruthyEngine/Sources/TruthyEngine/Deal.swift
```

Expected: the run fails, at least `✘ Test "oldestFirst"` and `✘ Test "deal"` (the reference vectors have no equal times, so only the golden suite sees this); the final `grep` prints `1`. The README's port trap "sorts the TypeScript relies on being stable carry an index tiebreak" is pinned by these vectors.

- [ ] **Step 9: Run the whole engine suite.**

```bash
swift test --package-path ios/TruthyEngine
```

Expected: `Test run with 81 tests in 11 suites passed after ... with 1 known issue` (task 1's 53 in 9 suites, plus 9 reference and 19 golden tests in 2 suites), and the line `Test everyGoldenFileHasATest() skipped.` The known issue is task 1's rng that runs out on purpose. The purity test of task 1 now scans `Deal.swift` too and passes.

- [ ] **Step 10: Check the hygiene and commit.**

```bash
git add ios/TruthyEngine/Sources/TruthyEngine/Deal.swift ios/TruthyEngine/Tests/TruthyEngineTests/DealReferenceTests.swift ios/TruthyEngine/Tests/TruthyEngineTests/DealGoldenTests.swift
pnpm test
git commit -m "feat: port the dealing to the Swift engine, deal and dealChunk with every step of deal.ts, checked against the golden vectors"
```

Expected: every test file of `pnpm test` passes, the hygiene test among them (it scans the staged files: no local path, no e-mail-shaped string, no em dash), and the commit holds the three files.

**Verified while this task was drafted** (before `native-data/` existed): the three files above, exactly as shown, ran in a scratch Swift package (swift-tools-version 6.0, iOS 18 and macOS 15, Swift 6 language mode, Swift Testing, Swift 6.3.3) next to stand-ins for task 1's types, `createRng`, `shuffle` and golden loader, written to the interfaces above. `swift build` gave no error and no warning. The reference suite passed (9 tests). The golden suite passed (19 tests) against the 27 files that plan A task 5's draft producer wrote when run against the repository's own `deal.ts`, every case of them, with the shipped decks behind `{"$deck": id}`; that run had to put the files on a case-sensitive volume, because on the default macOS volume `src.engine.deal.DEAL.json` overwrote `src.engine.deal.deal.json`; plan A therefore names that constant `src.engine.deal.DEAL.constant.json` (Rule 9). The review fix pass afterwards replaced the suite's `load` wrapper by literal `Golden.load` calls and `checked`, moved the commands to `--package-path` and stated the counts of step 9; the README's drafting record says what of that was compiled again. Step 8's mutation failed `oldestFirst` and `deal`, as stated. What runs only once plan A is done: the golden suite against the committed `native-data/golden` and `native-data/decks`, and the purity and coverage tests of task 1.
