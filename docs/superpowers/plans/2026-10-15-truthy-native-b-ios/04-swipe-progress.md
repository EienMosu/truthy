### Task 4: Swipe interpretation and the progress rules, with partial reads and the unreadable side copy

This task ports two web modules into the engine package, line by line: `src/input/swipe.ts` (which turns the samples of one drag into True, False or cancel) and `src/progress/progress.ts` with its store `src/progress/local.ts` (card history, records, the last route, pruning, the seen share, reading a stored value part by part, and the rule that keeps a value that did not read back whole under a side key before writing over it). They come together because they are the last pure rules that decide what the player's answers do. The round screen (task 13) feeds `interpret` with touch samples. The file store (task 9) runs `createLocalStore` over two files, so the native app keeps the web's side-copy decision exactly, including its failure rules.

Two port traps decide the shape of the code. Foundation's `JSONSerialization` rejects a whole document that holds a number such as `1e999`, while `JSON.parse` reads it as Infinity and `readProgress` then drops only the entry that holds it. So the engine reads stored JSON with a small parser of its own that gives `JSON.parse`'s results. Swift's synthesized `Codable` also leaves out a nil optional, while the web reads a stored value with no `last` key as not whole. A file written that way would be copied aside again on every later save. So `Progress` and `LastRound` write `null` explicitly.

Builds on task 1 (the content types, the golden loader, the purity test). It uses nothing from tasks 2 and 3. `applyResult` takes a `RoundResult` (task 1's type), and the golden cases that come from the round engine carry the summarised result as data.

**Files:**
- Create: `ios/TruthyEngine/Sources/TruthyEngine/Swipe.swift`, `ios/TruthyEngine/Sources/TruthyEngine/Progress.swift`, `ios/TruthyEngine/Sources/TruthyEngine/StoredJSON.swift`, `ios/TruthyEngine/Sources/TruthyEngine/ProgressRead.swift`, `ios/TruthyEngine/Sources/TruthyEngine/LocalStore.swift`
- Test: create `ios/TruthyEngine/Tests/TruthyEngineTests/SwipeTests.swift`, `SwipeGoldenTests.swift`, `ProgressFixtures.swift`, `Golden/GoldenProgress.swift`, `ProgressTests.swift`, `ProgressGoldenTests.swift`, `ProgressReadTests.swift`, `ProgressReadGoldenTests.swift`, `LocalStoreTests.swift`, `LocalStoreGoldenTests.swift` (all under `ios/TruthyEngine/Tests/TruthyEngineTests/`)
- Reads (plan A's output, never edited): 16 files in `native-data/golden/`: `src.input.swipe.intent.json`, `src.input.swipe.canStart.json`, `src.input.swipe.interpret.json`, `src.input.swipe.SWIPE.json`; `src.progress.progress.emptyProgress.json`, `.recordKey.json`, `.bestFor.json`, `.compareWithBest.json`, `.applyResult.json`, `.pruneDeck.json`, `.seenShare.json`, `.readProgress.json`, `.parseProgress.json`; `src.progress.local.PROGRESS_KEY.json`, `src.progress.local.UNREADABLE_KEY.json`, `src.progress.local.createLocalStore.json`

**Interfaces:**
- Consumes, from task 1 (`TruthyEngine`):
  - `Route(deckId:sectionId:)`, `Mode` (raw values `classic`, `streak`, `lives`, `timed`), `CardHistory(seen:lastCorrect:lastSeenAt:)`, `History`, `WHOLE_DECK`, `Card` (`Codable` in the web's JSON shape), `Answered(card:given:correct:at:)`, `RoundResult(mode:route:score:total:answers:missed:abandoned:)`, each with a public memberwise initialiser.
- Consumes, from task 1 (test target, `Support/Golden.swift` and `Support/GoldenReaders.swift`):
  - `Golden.load(_ module: String, _ function: String) throws -> GoldenFile` reads `native-data/golden/<module with dots>.<function>.json` (a constant's file has the same form; `DEAL` is task 1's one exception). Every call in this task's tests takes two string literals, because task 1's coverage test finds consumed files only that way.
  - `GoldenFile.cases: [GoldenCase]` (`name: String`, `input: GoldenValue`, `output: GoldenValue`).
  - `GoldenFile.card(_ value: GoldenValue) throws -> Card` resolves `{"$card": id}`.
  - `GoldenValue`, task 1's `typealias GoldenValue = JSONValue` (`Equatable`): cases `.null`, `.bool(Bool)`, `.number(Double)`, `.string(String)`, `.array([GoldenValue])`, `.object([String: GoldenValue])`, and `subscript(key: String) -> GoldenValue?`. Its throwing readers are `number()` (which also decodes `{"$number": ...}`), `int()`, `bool()`, `string()` and `array()`.
  - `GoldenError(description:)`.
- Consumes, from plan A (task 7 of plan A writes it), the script format of `src.progress.local.createLocalStore.json`:
  - `input` is `{"storage": {"items": {key: string}} | null, "steps": [...]}`.
  - The steps are `{"op": "load"}`, `{"op": "save", "progress": P}`, `{"op": "resave"}` (that is `save(load())`), `{"op": "put", "key": k, "value": v}` (written straight into the storage), `{"op": "breakGet"}` (every later `getItem` throws) and `{"op": "breakSet", "keys": [k...] | "all"}` (every later `setItem` of those keys throws).
  - `output` is `{"loads": [P...], "items": {key: string} | null}`.
  - If plan A's committed file uses other names, stop and report: the runner in step 22 must follow the committed format.
- Produces (`TruthyEngine`, public; the names later tasks rely on):

```swift
// Swipe.swift
public struct SwipeConstants: Equatable, Sendable { public let commitPx, flingPx, flingVelocity, settleMs, edgePx: Double }
public let SWIPE: SwipeConstants                      // 90, 40, 0.5 (points per ms), 250 (ms), 24
public struct SwipeSample: Equatable, Sendable { public let x: Double; public let y: Double; public let t: Double; public init(x:y:t:) }
public struct SwipeContext: Equatable, Sendable { public let viewportWidth: Double; public let cardShownAt: Double; public init(viewportWidth:cardShownAt:) }
public enum SwipeOutcome: String, Sendable { case `true`, `false`, cancel }
public func intent(_ dx: Double) -> Double            // -1 ... 1 for the drag preview
public func canStart(_ sample: SwipeSample, _ context: SwipeContext) -> Bool
public func interpret(_ samples: [SwipeSample], _ context: SwipeContext) -> SwipeOutcome

// Progress.swift
public struct LastRound: Codable, Equatable, Sendable { public var route: Route; public var mode: Mode; public var score: Int?; public var total: Int?; public init(route:mode:score:total:) }
public struct Progress: Codable, Equatable, Sendable { public var version: Int; public var cards: [String: CardHistory]; public var records: [String: Int]; public var last: LastRound?; public init(version: Int = 1, cards:records:last:) }
public func emptyProgress() -> Progress
public func recordKey(_ route: Route, _ mode: Mode) -> String          // "aws-clf-c02/SEC#classic"
public func bestFor(_ progress: Progress, _ route: Route, _ mode: Mode) -> Int?
public enum Comparison: Equatable, Sendable { case first, newBest(previousBest: Int), equal(best: Int), short(best: Int, by: Int) }
public func compareWithBest(_ score: Int, _ previousBest: Int?) -> Comparison
public struct ApplyOutcome: Equatable, Sendable { public let progress: Progress; public let previousBest: Int?; public let isNewBest: Bool }
public func applyResult(_ progress: Progress, _ result: RoundResult) -> ApplyOutcome
public func pruneDeck(_ progress: Progress, _ deckId: String, _ cardIds: [String]) -> Progress
public func seenShare(_ history: History, _ cardIds: [String]) -> Double
public func progressJSON(_ progress: Progress) throws -> String          // JSON.stringify(progress), the web's shape

// ProgressRead.swift (StoredJSON.swift holds the internal parser it uses)
public func readProgress(_ raw: String?) -> (progress: Progress, whole: Bool)
public func parseProgress(_ raw: String?) -> Progress

// LocalStore.swift
public let PROGRESS_KEY: String                       // "truthy.progress.v1"
public let UNREADABLE_KEY: String                     // "truthy.progress.v1.unreadable"
public protocol KeyValueStorage { func getItem(_ key: String) throws -> String?; func setItem(_ key: String, _ value: String) throws }
public struct LocalStore { public func load() -> Progress; public func save(_ progress: Progress) }
public func createLocalStore(_ storage: (any KeyValueStorage)?) -> LocalStore
public func keepUnreadable(_ storage: any KeyValueStorage) throws    // the side-copy decision, run first by every save
```

  - Internal, used by this task's tests through `@testable import`: `enum StoredJSON` and `func parseJSON(_ text: String) -> StoredJSON?`. The name is not `JSONValue`, which is task 1's golden value type in the test target: two types of one name would make every test that writes the engine's spell `TruthyEngine.JSONValue`.
  - What later tasks must know:
    - Task 9's `FileProgressStore` backs a `KeyValueStorage` with files, key `K` to the file `K.json` in its directory: `truthy.progress.v1.json` and `truthy.progress.v1.unreadable.json`. The storage writes atomically and throws on any failure, and `getItem` returns nil only when the file does not exist. It then calls `createLocalStore(storage).load()` and `.save(_:)` from its serial actor. It needs no rule of its own for the side copy.
    - Task 13 passes `interpret` the samples of one gesture: window points, `t` in milliseconds on the `UITouch.timestamp` base, `viewportWidth` the window width. `intent`, `interpret` and the threshold haptic take dx alone, without the offset of a card caught while it springs back (spec 5.3).
    - Task 6's result copy and task 14 switch over `Comparison`. Its TypeScript kinds `first`, `new-best`, `equal`, `short` are the cases `.first`, `.newBest`, `.equal`, `.short`.

**Rules:**

1. **Swipe, as `swipe.ts`** (reference 3.4). The numbers are points and milliseconds, the same as the web's px and ms. `interpret` applies its rules in this order:
   1. Fewer than 2 samples: cancel.
   2. The first sample must pass `canStart`: `t - cardShownAt >= 250`, and `24 <= x <= viewportWidth - 24`, both ends inclusive.
   3. `dx == 0`: cancel.
   4. `|dy| > |dx|`: cancel. An exact diagonal passes.
   5. `|dx| >= 90`: commit to the side of dx.
   6. Otherwise commit only when `|dx| >= 40` and the velocity towards that side is at least 0.5. The velocity is measured from the oldest earlier sample with `last.t - t <= 80` (a sample at exactly 80 ms counts), and a `dt` of 0 or less means 0.

   `INTENT_FULL_PX` (110) and `VELOCITY_WINDOW_MS` (80) stay private, as they are unexported on the web; the golden boundary tables pin them.
2. **Progress, as `progress.ts`** (reference 3.5):
   - A first finished round sets the record, even with score 0. Only a strictly higher score replaces a record.
   - An abandoned round writes the card history and `last` (with score and total nil) and never touches the records.
   - `last` is replaced by every applied round.
   - A card answered twice in one round counts twice and keeps the later verdict and time.
   - `pruneDeck` drops a card's history when its id starts with `"<deckId>-"` (the plain prefix, so pruning `gcp-cdl` also drops an unlisted `gcp-cdl-pro-1`) and the id is not among the deck's current ids. The prefix is compared in UTF-16 code units, as `startsWith` does; Swift's `hasPrefix` compares characters. Records and `last` are kept.
3. **The stored JSON shape.**
   - `Progress.encode(to:)` and `LastRound.encode(to:)` write every key, with `null` for a nil `last`, `score` or `total`. The synthesized encoder would leave them out, and the web reads a value without `last` as not whole.
   - `progressJSON` writes with sorted keys (the same progress always gives the same text) and unescaped slashes (record keys keep their `/`). Epoch milliseconds come out as integers (`1790000000000`).
   - The web's key order differs. That is the same JSON value, and the golden store test compares the stored progress as JSON.
4. **Foundation has a `Progress` class too.** A Swift file that imports both Foundation (or SwiftUI, which re-exports it) and `TruthyEngine` cannot write a bare `Progress`: the compiler reports `'Progress' is ambiguous for type lookup in this context`.
   - Inside the engine module, its own `Progress` wins, so `Progress.swift` may import Foundation, for `JSONEncoder`.
   - The test files of this task that use `Progress` import only `Testing` and `TruthyEngine`. `ProgressFixtures.swift` imports Foundation and never names `Progress`.
   - App code (tasks 9 to 14) uses the module-level `typealias Progress = TruthyEngine.Progress` that task 7 declares in `ios/Truthy/Truthy/EngineNames.swift`; a declaration of the app module shadows both imports. App test files write `TruthyEngine.Progress`.
5. **Reading, as `readProgress`** (reference 3.5). `parseJSON` gives `JSON.parse`'s results:
   - Whitespace is space, tab, LF and CR only, so a byte order mark, a lone space or a NUL fails.
   - A number is read as the nearest `Double`, so `1e999` is Infinity, `-0` stays `-0` and `1.0` is `1`.
   - A later duplicate key replaces the earlier one, and `__proto__` is a plain key.
   - A lone surrogate in a `\u` escape becomes U+FFFD, because a Swift `String` cannot hold one. No golden case has one.
   - More than 512 nested arrays and objects fail the parse (the read is not whole, and the store keeps the raw text in the side copy) instead of overflowing the stack of the store's actor thread, and a `\u` escape needs exactly four ASCII hex digits (`\u+041` fails, as in `JSON.parse`; `UInt16(_:radix:)` would accept the sign). The depth limit and the lone surrogate are recorded deviations (README, "Deviations from the spec"); no golden case reaches either.

   The validation is the zod schemas':
   - `seen` and records: safe integers (at most 2^53 - 1), at least 0.
   - `lastSeenAt`: finite, at least 0, not necessarily whole.
   - `lastCorrect`: a boolean.
   - `last`: `null` reads as nil. A missing key fails, so the read is not whole. Otherwise it needs a route with non-empty `deckId` and `sectionId`, one of the four modes, and `score` and `total` that are missing or null (nil) or non-negative safe integers.
   - A `cards` or `records` value that is not an object reads as empty and not whole.
   - Unknown fields are dropped.
6. **The store, as `local.ts`** (reference 6).
   - The TypeScript interface `ProgressStore` is `LocalStore` here: README gives the name `ProgressStore` to the app's async protocol (task 9). The web's `Pick<Storage, "getItem" | "setItem">` is `KeyValueStorage`, and `undefined` is nil.
   - `save` runs `keepUnreadable` first. It writes the side key only when a value is stored, the value does not read back whole, and the side key does not already hold exactly that value (compared in UTF-16 code units, as `===` does).
   - If that side write throws, the main write is skipped.
   - Every throw ends the save silently, and a throwing `getItem` makes `load` return empty progress. A storage failure never reaches the player.
7. **Purity.** Nothing in these five files uses a clock, randomness, a timer, files or preferences. Task 1's purity test scans them like every engine source.

**Steps:**

- [ ] **Step 1: Write the swipe unit tests.**

`ios/TruthyEngine/Tests/TruthyEngineTests/SwipeTests.swift` ports the pinned cases of `tests/input/swipe.test.ts`, `swipe-polish.test.ts` and `swipe-early-touch-polish.test.ts`:

```swift
import Testing
@testable import TruthyEngine

// Ports of tests/input/swipe.test.ts, swipe-polish.test.ts and swipe-early-touch-polish.test.ts.
// A 390 wide window whose card appeared at t = 0; gestures start mid-screen at t = 1000.
private let phone = SwipeContext(viewportWidth: 390, cardShownAt: 0)

private func gesture(_ offsets: (Double, Double, Double)...) -> [SwipeSample] {
  offsets.map { SwipeSample(x: 195 + $0.0, y: 400 + $0.1, t: 1000 + $0.2) }
}

@Suite struct SwipeTests {
  @Test func constantsMatchTheInputTable() {
    #expect(SWIPE == SwipeConstants(commitPx: 90, flingPx: 40, flingVelocity: 0.5, settleMs: 250, edgePx: 24))
  }

  @Test func intentIsProportionalInside110AndClampedBeyond() {
    #expect(intent(0) == 0)
    #expect(intent(55) == 0.5)
    #expect(intent(-55) == -0.5)
    #expect(intent(110) == 1)
    #expect(intent(-110) == -1)
    #expect(intent(500) == 1)
    #expect(intent(-500) == -1)
  }

  @Test func canStartWaitsForTheSettleTimeFromCardShownAt() {
    #expect(!canStart(SwipeSample(x: 195, y: 400, t: 249), phone))
    #expect(canStart(SwipeSample(x: 195, y: 400, t: 250), phone))
    let later = SwipeContext(viewportWidth: 390, cardShownAt: 10_000)
    #expect(!canStart(SwipeSample(x: 195, y: 400, t: 10_100), later))
    #expect(canStart(SwipeSample(x: 195, y: 400, t: 10_250), later))
    let shown = SwipeContext(viewportWidth: 390, cardShownAt: 1_000)
    #expect(!canStart(SwipeSample(x: 100, y: 400, t: 0), shown))
    #expect(!canStart(SwipeSample(x: 100, y: 400, t: 749), shown))
  }

  @Test func canStartRejectsTheEdgeZonesBothEndsInclusive() {
    #expect(!canStart(SwipeSample(x: 23, y: 400, t: 1000), phone))
    #expect(canStart(SwipeSample(x: 24, y: 400, t: 1000), phone))
    #expect(!canStart(SwipeSample(x: 367, y: 400, t: 1000), phone))
    #expect(canStart(SwipeSample(x: 366, y: 400, t: 1000), phone))
    #expect(!canStart(SwipeSample(x: 0, y: 400, t: 1000), phone))
    let tablet = SwipeContext(viewportWidth: 1024, cardShownAt: 0)
    #expect(canStart(SwipeSample(x: 1000, y: 400, t: 1000), tablet))
    #expect(!canStart(SwipeSample(x: 1001, y: 400, t: 1000), tablet))
  }

  @Test func interpretNeedsTwoSamplesAMoveAndAValidStart() {
    #expect(interpret([], phone) == .cancel)
    #expect(interpret(gesture((0, 0, 0)), phone) == .cancel)
    #expect(interpret(gesture((0, 0, 0), (0, 0, 500)), phone) == .cancel)
    #expect(interpret(gesture((0, 0, 0), (120, 0, 300)), SwipeContext(viewportWidth: 390, cardShownAt: 900)) == .cancel)
    #expect(interpret([SwipeSample(x: 10, y: 400, t: 1000), SwipeSample(x: 130, y: 400, t: 1300)], phone) == .cancel)
  }

  @Test func interpretCommitsBy90AtReleaseByTheSideAtRelease() {
    #expect(interpret(gesture((0, 0, 0), (45, 0, 300), (90, 0, 600)), phone) == .true)
    #expect(interpret(gesture((0, 0, 0), (45, 0, 300), (89, 0, 600)), phone) == .cancel)
    #expect(interpret(gesture((0, 0, 0), (-45, 0, 300), (-90, 0, 600)), phone) == .false)
    #expect(interpret(gesture((0, 0, 0), (150, 0, 300), (60, 0, 900)), phone) == .cancel)
    #expect(interpret(gesture((0, 0, 0), (120, 0, 300), (-100, 0, 900)), phone) == .false)
  }

  @Test func interpretCancelsMostlyVerticalAndCommitsAnExactDiagonal() {
    #expect(interpret(gesture((0, 0, 0), (50, 150, 300), (100, 300, 600)), phone) == .cancel)
    #expect(interpret(gesture((0, 0, 0), (-100, -101, 600)), phone) == .cancel)
    #expect(interpret(gesture((0, 0, 0), (100, 100, 600)), phone) == .true)
  }

  @Test func interpretFlingsFrom40AtHalfAPointPerMs() {
    #expect(interpret(gesture((0, 0, 0), (20, 0, 20), (40, 0, 40)), phone) == .true)
    #expect(interpret(gesture((0, 0, 0), (20, 0, 20), (39, 0, 40)), phone) == .cancel)
    #expect(interpret(gesture((0, 0, 0), (-20, 0, 20), (-40, 0, 40)), phone) == .false)
    #expect(interpret(gesture((0, 0, 0), (20, 0, 400), (60, 0, 480)), phone) == .true)
    #expect(interpret(gesture((0, 0, 0), (20, 0, 400), (59, 0, 480)), phone) == .cancel)
    #expect(interpret(gesture((0, 0, 0), (80, 0, 400), (65, 0, 420), (50, 0, 440)), phone) == .cancel)
  }

  @Test func interpretMeasuresVelocityFromTheOldestSampleInsideThe80MsWindow() {
    #expect(interpret(gesture((0, 0, 0), (5, 0, 400), (50, 0, 481)), phone) == .cancel)
    #expect(interpret(gesture((0, 0, 0), (5, 0, 401), (50, 0, 481)), phone) == .true)
    #expect(interpret(gesture((0, 0, 0), (10, 0, 400), (48, 0, 460), (50, 0, 470)), phone) == .true)
    #expect(interpret(gesture((0, 0, 0), (30, 0, 400), (30, 0, 460), (50, 0, 470)), phone) == .cancel)
  }

  @Test func interpretReadsNoTimeBetweenSamplesAsNoVelocity() {
    #expect(interpret(gesture((0, 0, 0), (50, 0, 0)), phone) == .cancel)
    #expect(interpret(gesture((0, 0, 0), (100, 0, 0)), phone) == .true)
    #expect(interpret(gesture((0, 0, 0), (50, 0, 200), (60, 0, 200)), phone) == .cancel)
  }
}
```

- [ ] **Step 2: Write the swipe golden tests.**

`ios/TruthyEngine/Tests/TruthyEngineTests/SwipeGoldenTests.swift` runs every case of the four swipe vector files. `intent` is compared bit for bit, since `dx / 110` must be the same double as the web's:

```swift
import Testing
@testable import TruthyEngine

// native-data/golden/src.input.swipe.*.json: every case computed by src/input/swipe.ts. Every load names the
// module and the function as literals, for task 1's coverage test.

private func member(_ value: GoldenValue, _ key: String) throws -> GoldenValue {
  guard let found = value[key] else { throw GoldenError(description: "no field \(key) in \(value)") }
  return found
}

private func sample(_ value: GoldenValue) throws -> SwipeSample {
  SwipeSample(x: try member(value, "x").number(), y: try member(value, "y").number(), t: try member(value, "t").number())
}

private func context(_ value: GoldenValue) throws -> SwipeContext {
  SwipeContext(viewportWidth: try member(value, "viewportWidth").number(), cardShownAt: try member(value, "cardShownAt").number())
}

@Suite struct SwipeGoldenTests {
  @Test func swipeConstant() throws {
    let output = try #require(try Golden.load("src/input/swipe", "SWIPE").cases.first).output
    #expect(SWIPE.commitPx == (try member(output, "commitPx").number()))
    #expect(SWIPE.flingPx == (try member(output, "flingPx").number()))
    #expect(SWIPE.flingVelocity == (try member(output, "flingVelocity").number()))
    #expect(SWIPE.settleMs == (try member(output, "settleMs").number()))
    #expect(SWIPE.edgePx == (try member(output, "edgePx").number()))
  }

  @Test func intentCases() throws {
    let file = try Golden.load("src/input/swipe", "intent")
    #expect(!file.cases.isEmpty)
    for c in file.cases {
      let got = intent(try member(c.input, "dx").number())
      #expect(got.bitPattern == (try c.output.number()).bitPattern, "\(c.name)")
    }
  }

  @Test func canStartCases() throws {
    let file = try Golden.load("src/input/swipe", "canStart")
    #expect(!file.cases.isEmpty)
    for c in file.cases {
      let got = canStart(try sample(try member(c.input, "sample")), try context(try member(c.input, "context")))
      #expect(got == (try c.output.bool()), "\(c.name)")
    }
  }

  @Test func interpretCases() throws {
    let file = try Golden.load("src/input/swipe", "interpret")
    #expect(!file.cases.isEmpty)
    for c in file.cases {
      let samples = try member(c.input, "samples").array().map(sample)
      let got = interpret(samples, try context(try member(c.input, "context")))
      #expect(got.rawValue == (try c.output.string()), "\(c.name)")
    }
  }
}
```

- [ ] **Step 3: Run them and watch them fail.**

```bash
(cd ios/TruthyEngine && swift test --filter 'Swipe')
```

Expected: the test target does not build: `error: cannot find 'interpret' in scope`, with the same error for `canStart`, `intent`, `SwipeSample`, `SwipeContext` and `SWIPE`. No test runs.

- [ ] **Step 4: Write the swipe port.**

`ios/TruthyEngine/Sources/TruthyEngine/Swipe.swift`:

```swift
// Swipe interpretation, a line-by-line port of src/input/swipe.ts (reference 3.4).
// Pure: callers pass numbers. Positions are window points, times are monotonic milliseconds on the base
// of UITouch.timestamp (reference 7.3), and viewportWidth is the window width.

public struct SwipeConstants: Equatable, Sendable {
  public let commitPx: Double
  public let flingPx: Double
  public let flingVelocity: Double  // points per ms
  public let settleMs: Double
  public let edgePx: Double
}

public let SWIPE = SwipeConstants(commitPx: 90, flingPx: 40, flingVelocity: 0.5, settleMs: 250, edgePx: 24)

// How far a drag must go for the preview to show full intent.
private let INTENT_FULL_PX: Double = 110

// The release velocity is measured over this many ms before the last sample.
private let VELOCITY_WINDOW_MS: Double = 80

public struct SwipeSample: Equatable, Sendable {
  public let x: Double
  public let y: Double
  public let t: Double
  public init(x: Double, y: Double, t: Double) { self.x = x; self.y = y; self.t = t }
}

public struct SwipeContext: Equatable, Sendable {
  public let viewportWidth: Double
  public let cardShownAt: Double
  public init(viewportWidth: Double, cardShownAt: Double) { self.viewportWidth = viewportWidth; self.cardShownAt = cardShownAt }
}

public enum SwipeOutcome: String, Sendable {
  case `true`, `false`, cancel
}

private func clamp(_ value: Double, _ min: Double, _ max: Double) -> Double {
  Swift.min(max, Swift.max(min, value))
}

// -1 (fully towards False) to 1 (fully towards True), for the drag preview.
public func intent(_ dx: Double) -> Double {
  clamp(dx / INTENT_FULL_PX, -1, 1)
}

// A gesture may start only after the settle time and outside the edge zones, both ends inclusive.
public func canStart(_ sample: SwipeSample, _ context: SwipeContext) -> Bool {
  let settled = sample.t - context.cardShownAt >= SWIPE.settleMs
  let awayFromEdges = sample.x >= SWIPE.edgePx && sample.x <= context.viewportWidth - SWIPE.edgePx
  return settled && awayFromEdges
}

private func sideOf(_ dx: Double) -> SwipeOutcome {
  dx > 0 ? .true : .false
}

// Horizontal velocity in points per ms between the oldest earlier sample inside the window and the last one.
// No such sample, or no time between them, means 0.
private func releaseVelocity(_ samples: [SwipeSample], _ last: SwipeSample) -> Double {
  guard let reference = samples.dropLast().first(where: { last.t - $0.t <= VELOCITY_WINDOW_MS }) else { return 0 }
  let dt = last.t - reference.t
  if dt <= 0 { return 0 }
  return (last.x - reference.x) / dt
}

// Turns the samples of one gesture (first = touch down, last = release) into an answer or cancel.
public func interpret(_ samples: [SwipeSample], _ context: SwipeContext) -> SwipeOutcome {
  guard samples.count >= 2, let first = samples.first, let last = samples.last else { return .cancel }
  if !canStart(first, context) { return .cancel }

  let dx = last.x - first.x
  let dy = last.y - first.y
  if dx == 0 { return .cancel }
  if abs(dy) > abs(dx) { return .cancel }

  if abs(dx) >= SWIPE.commitPx { return sideOf(dx) }

  let velocityTowardsSide = releaseVelocity(samples, last) * (dx > 0 ? 1 : -1)
  if abs(dx) >= SWIPE.flingPx && velocityTowardsSide >= SWIPE.flingVelocity { return sideOf(dx) }
  return .cancel
}
```

- [ ] **Step 5: Run them green.**

```bash
(cd ios/TruthyEngine && swift test --filter 'Swipe')
```

Expected: `Test run with 14 tests in 2 suites passed` (10 in `SwipeTests`, 4 in `SwipeGoldenTests`, which together cover 96 golden cases: 16 of `intent`, 25 of `canStart`, 54 of `interpret`, 1 of `SWIPE`, the counts plan A's draft producer gave; the committed files are the reference).

- [ ] **Step 6: Commit.**

```bash
git add ios/TruthyEngine/Sources/TruthyEngine/Swipe.swift ios/TruthyEngine/Tests/TruthyEngineTests/SwipeTests.swift ios/TruthyEngine/Tests/TruthyEngineTests/SwipeGoldenTests.swift
git commit -m "feat: port swipe interpretation to the iOS engine"
```

- [ ] **Step 7: Write the test helpers for progress.**

`ios/TruthyEngine/Tests/TruthyEngineTests/ProgressFixtures.swift` builds the cards the unit tests answer, decoded from the web's JSON shape:

```swift
import Foundation
@testable import TruthyEngine

// Cards for the progress unit tests, decoded from the web's JSON shape so they do not depend on how task 1
// names the parts of a card's text. This file uses no progress type, so Foundation's Progress never meets it.
enum ProgressFixtures {
  static func card(_ id: String) throws -> Card {
    let json = #"{"id":"\#(id)","section":"SEC","text":{"en":{"statement":"Statement \#(id)","explanation":"Explanation \#(id)"}},"#
      + #""answer":true,"source":{"title":"AWS docs","url":"https://docs.aws.amazon.com/"},"difficulty":1,"appliesTo":"","conflictGroups":[]}"#
    return try JSONDecoder().decode(Card.self, from: Data(json.utf8))
  }
}
```

`ios/TruthyEngine/Tests/TruthyEngineTests/Golden/GoldenProgress.swift` decodes the progress types from golden JSON. It is a namespace, so its names cannot meet the decoders other tasks add to the loader:

```swift
import Testing
@testable import TruthyEngine

// Decoders from golden JSON to the progress types of task 4, and an exact comparison.
// A namespace, so these names never meet the decoders other tasks add to the golden loader.
enum ProgressGolden {
  static func required(_ value: GoldenValue, _ key: String) throws -> GoldenValue {
    guard let member = value[key] else { throw GoldenError(description: "no field \(key) in \(value)") }
    return member
  }

  static func optionalInt(_ value: GoldenValue) throws -> Int? {
    value == .null ? nil : try value.int()
  }

  static func strings(_ value: GoldenValue) throws -> [String] {
    try value.array().map { try $0.string() }
  }

  static func route(_ value: GoldenValue) throws -> Route {
    Route(deckId: try required(value, "deckId").string(), sectionId: try required(value, "sectionId").string())
  }

  static func mode(_ value: GoldenValue) throws -> Mode {
    let name = try value.string()
    guard let mode = Mode(rawValue: name) else { throw GoldenError(description: "not a mode: \(name)") }
    return mode
  }

  static func history(_ value: GoldenValue) throws -> [String: CardHistory] {
    guard case .object(let entries) = value else { throw GoldenError(description: "not a history: \(value)") }
    return try entries.mapValues {
      CardHistory(seen: try required($0, "seen").int(), lastCorrect: try required($0, "lastCorrect").bool(), lastSeenAt: try required($0, "lastSeenAt").number())
    }
  }

  static func progress(_ value: GoldenValue) throws -> Progress {
    guard case .object(let records) = try required(value, "records") else { throw GoldenError(description: "not records: \(value)") }
    let last = try required(value, "last")
    return Progress(
      version: try required(value, "version").int(),
      cards: try history(try required(value, "cards")),
      records: try records.mapValues { try $0.int() },
      last: last == .null
        ? nil
        : LastRound(
          route: try route(try required(last, "route")), mode: try mode(try required(last, "mode")),
          score: try optionalInt(try required(last, "score")), total: try optionalInt(try required(last, "total"))))
  }

  static func comparison(_ value: GoldenValue) throws -> Comparison {
    switch try required(value, "kind").string() {
    case "first": return .first
    case "new-best": return .newBest(previousBest: try required(value, "previousBest").int())
    case "equal": return .equal(best: try required(value, "best").int())
    case "short": return .short(best: try required(value, "best").int(), by: try required(value, "by").int())
    case let kind: throw GoldenError(description: "unknown comparison kind \(kind)")
    }
  }

  static func answered(_ file: GoldenFile, _ value: GoldenValue) throws -> Answered {
    Answered(
      card: try file.card(try required(value, "card")), given: try required(value, "given").bool(),
      correct: try required(value, "correct").bool(), at: try required(value, "at").number())
  }

  static func roundResult(_ file: GoldenFile, _ value: GoldenValue) throws -> RoundResult {
    RoundResult(
      mode: try mode(try required(value, "mode")), route: try route(try required(value, "route")),
      score: try required(value, "score").int(), total: try required(value, "total").int(),
      answers: try required(value, "answers").array().map { try answered(file, $0) },
      missed: try required(value, "missed").array().map { try answered(file, $0) },
      abandoned: try required(value, "abandoned").bool())
  }

  // Equal, and every lastSeenAt the same double bit for bit (so -0 stays -0).
  static func exactly(_ a: Progress, _ b: Progress) -> Bool {
    a == b && a.cards.allSatisfy { id, entry in b.cards[id]?.lastSeenAt.bitPattern == entry.lastSeenAt.bitPattern }
  }
}
```

- [ ] **Step 8: Write the progress unit tests.**

`ios/TruthyEngine/Tests/TruthyEngineTests/ProgressTests.swift` ports the pinned cases of `tests/progress/progress.test.ts` and `progress-polish.test.ts`, and pins the stored JSON shape (rule 3):

```swift
import Testing
@testable import TruthyEngine

// Ports of the pinned cases of tests/progress/progress.test.ts and progress-polish.test.ts.
private let sec = Route(deckId: "aws-clf-c02", sectionId: "SEC")
private let con = Route(deckId: "aws-clf-c02", sectionId: "CON")

private func answered(_ id: String, _ correct: Bool, _ at: Double) throws -> Answered {
  Answered(card: try ProgressFixtures.card(id), given: correct, correct: correct, at: at)
}

private func result(_ answers: [Answered], route: Route = sec, mode: Mode = .classic, score: Int? = nil, abandoned: Bool = false) -> RoundResult {
  RoundResult(
    mode: mode, route: route, score: score ?? answers.filter(\.correct).count, total: answers.count, answers: answers,
    missed: answers.filter { !$0.correct }, abandoned: abandoned)
}

// A classic result with the given score out of ten, all answered at time 1.
private func scored(_ score: Int, abandoned: Bool = false) throws -> RoundResult {
  result(try (0..<10).map { try answered("c\($0)", $0 < score, 1) }, abandoned: abandoned)
}

private func withRecord(_ best: Int, _ route: Route = sec, _ mode: Mode = .classic) -> Progress {
  Progress(cards: [:], records: [recordKey(route, mode): best], last: nil)
}

private func seenOnce() -> CardHistory { CardHistory(seen: 1, lastCorrect: true, lastSeenAt: 1) }

@Suite struct ProgressTests {
  @Test func emptyProgressHasVersion1AndNothingElse() {
    #expect(emptyProgress() == Progress(version: 1, cards: [:], records: [:], last: nil))
  }

  @Test func recordKeyJoinsTheRouteKeyAndTheMode() {
    #expect(recordKey(sec, .classic) == "aws-clf-c02/SEC#classic")
    #expect(recordKey(Route(deckId: "nextjs-rendering", sectionId: WHOLE_DECK), .timed) == "nextjs-rendering/ALL#timed")
  }

  @Test func bestForReadsTheRecordOfARouteAndMode() {
    let played = Progress(cards: [:], records: ["aws-clf-c02/SEC#classic": 9, "aws-clf-c02/CON#timed": 0], last: nil)
    #expect(bestFor(played, sec, .classic) == 9)
    #expect(bestFor(played, sec, .timed) == nil)
    #expect(bestFor(played, con, .timed) == 0)
  }

  @Test func compareWithBestKinds() {
    #expect(compareWithBest(0, nil) == .first)
    #expect(compareWithBest(8, 7) == .newBest(previousBest: 7))
    #expect(compareWithBest(9, 9) == .equal(best: 9))
    #expect(compareWithBest(7, 9) == .short(best: 9, by: 2))
  }

  @Test func applyResultAddsToTheHistoryAndKeepsTheLaterAnswer() throws {
    let before = Progress(cards: ["c1": CardHistory(seen: 4, lastCorrect: true, lastSeenAt: 500)], records: [:], last: nil)
    let outcome = applyResult(before, result([try answered("c1", true, 100), try answered("c2", true, 150), try answered("c1", false, 200)]))
    #expect(outcome.progress.cards["c1"] == CardHistory(seen: 6, lastCorrect: false, lastSeenAt: 200))
    #expect(outcome.progress.cards["c2"] == CardHistory(seen: 1, lastCorrect: true, lastSeenAt: 150))
  }

  @Test func applyResultSetsAFirstRecordEvenWithScore0AndReplacesOnlyOnAHigherScore() throws {
    let first = applyResult(emptyProgress(), try scored(0))
    #expect(first.isNewBest && first.previousBest == nil && first.progress.records["aws-clf-c02/SEC#classic"] == 0)
    let equal = applyResult(withRecord(7), try scored(7))
    #expect(!equal.isNewBest && equal.previousBest == 7 && equal.progress.records["aws-clf-c02/SEC#classic"] == 7)
    let better = applyResult(withRecord(6), try scored(8))
    #expect(better.isNewBest && better.progress.records["aws-clf-c02/SEC#classic"] == 8)
    #expect(better.progress.last == LastRound(route: sec, mode: .classic, score: 8, total: 10))
  }

  @Test func applyResultForAnAbandonedRoundKeepsTheAnswersButNeverTheRecord() throws {
    let outcome = applyResult(withRecord(2), try scored(9, abandoned: true))
    #expect(!outcome.isNewBest)
    #expect(outcome.progress.records["aws-clf-c02/SEC#classic"] == 2)
    #expect(outcome.progress.cards.count == 10)
    #expect(outcome.progress.last == LastRound(route: sec, mode: .classic, score: nil, total: nil))
    #expect(applyResult(emptyProgress(), try scored(5, abandoned: true)).progress.records.isEmpty)
  }

  @Test func pruneDeckDropsOnlyThisDecksRemovedCardsByThePlainPrefix() {
    let before = Progress(
      cards: ["aws-clf-c02-t1.1-01": seenOnce(), "aws-clf-c02-t1.1-02": seenOnce(), "aws-clf-c02x-1": seenOnce(), "gcp-cdl-pro-1": seenOnce()],
      records: ["aws-clf-c02/SEC#classic": 7], last: LastRound(route: sec, mode: .classic, score: 7, total: 10))
    let pruned = pruneDeck(before, "aws-clf-c02", ["aws-clf-c02-t1.1-01"])
    #expect(Set(pruned.cards.keys) == ["aws-clf-c02-t1.1-01", "aws-clf-c02x-1", "gcp-cdl-pro-1"])
    #expect(pruned.records == before.records && pruned.last == before.last)
    #expect(pruneDeck(before, "gcp-cdl", []).cards["gcp-cdl-pro-1"] == nil)
  }

  @Test func seenShareCountsDistinctListedCardsSeenAtLeastOnce() {
    #expect(seenShare(["a": seenOnce()], []) == 0)
    #expect(seenShare(["a": seenOnce(), "c": seenOnce()], ["a", "b", "c", "d"]) == 0.5)
    #expect(seenShare(["a": CardHistory(seen: 0, lastCorrect: false, lastSeenAt: 0)], ["a"]) == 0)
    #expect(seenShare(["a": seenOnce()], ["a", "a", "b"]) == 0.5)
    #expect(seenShare(["a": seenOnce()], ["a", "b", "c"]) == 1.0 / 3.0)
  }

  @Test func encodingWritesLastAndScoresAsNullNeverLeavesThemOut() throws {
    let empty = try progressJSON(emptyProgress())
    #expect(empty == #"{"cards":{},"last":null,"records":{},"version":1}"#)
    let abandoned = Progress(cards: [:], records: [:], last: LastRound(route: sec, mode: .lives, score: nil, total: nil))
    #expect(try progressJSON(abandoned).contains(#""last":{"mode":"lives","route":{"deckId":"aws-clf-c02","sectionId":"SEC"},"score":null,"total":null}"#))
  }

  @Test func encodingKeepsEpochMillisecondsAsIntegersAndSlashesUnescaped() throws {
    let played = Progress(
      cards: ["aws-clf-c02-t2.1-06": CardHistory(seen: 2, lastCorrect: true, lastSeenAt: 1_790_000_000_000)],
      records: ["aws-clf-c02/SEC#classic": 7], last: nil)
    let json = try progressJSON(played)
    #expect(json.contains(#""lastSeenAt":1790000000000"#))
    #expect(json.contains(#""aws-clf-c02/SEC#classic":7"#))
  }
}
```

- [ ] **Step 9: Write the progress golden tests.**

`ios/TruthyEngine/Tests/TruthyEngineTests/ProgressGoldenTests.swift` runs the vector files of the seven functions that do not read stored text:

```swift
import Testing
@testable import TruthyEngine

// native-data/golden/src.progress.progress.*.json: every case computed by src/progress/progress.ts.
private typealias G = ProgressGolden

@Suite struct ProgressGoldenTests {
  @Test func emptyProgressCase() throws {
    let file = try Golden.load("src/progress/progress", "emptyProgress")
    for c in file.cases { #expect(G.exactly(emptyProgress(), try G.progress(c.output)), "\(c.name)") }
  }

  @Test func recordKeyCases() throws {
    let file = try Golden.load("src/progress/progress", "recordKey")
    #expect(!file.cases.isEmpty)
    for c in file.cases {
      let got = recordKey(try G.route(try G.required(c.input, "route")), try G.mode(try G.required(c.input, "mode")))
      #expect(got == (try c.output.string()), "\(c.name)")
    }
  }

  @Test func bestForCases() throws {
    let file = try Golden.load("src/progress/progress", "bestFor")
    #expect(!file.cases.isEmpty)
    for c in file.cases {
      let got = bestFor(try G.progress(try G.required(c.input, "progress")), try G.route(try G.required(c.input, "route")), try G.mode(try G.required(c.input, "mode")))
      #expect(got == (try G.optionalInt(c.output)), "\(c.name)")
    }
  }

  @Test func compareWithBestCases() throws {
    let file = try Golden.load("src/progress/progress", "compareWithBest")
    #expect(!file.cases.isEmpty)
    for c in file.cases {
      let got = compareWithBest(try G.required(c.input, "score").int(), try G.optionalInt(try G.required(c.input, "previousBest")))
      #expect(got == (try G.comparison(c.output)), "\(c.name)")
    }
  }

  @Test func applyResultCases() throws {
    let file = try Golden.load("src/progress/progress", "applyResult")
    #expect(!file.cases.isEmpty)
    for c in file.cases {
      let got = applyResult(try G.progress(try G.required(c.input, "progress")), try G.roundResult(file, try G.required(c.input, "result")))
      #expect(G.exactly(got.progress, try G.progress(try G.required(c.output, "progress"))), "\(c.name): progress")
      #expect(got.previousBest == (try G.optionalInt(try G.required(c.output, "previousBest"))), "\(c.name): previousBest")
      #expect(got.isNewBest == (try G.required(c.output, "isNewBest").bool()), "\(c.name): isNewBest")
    }
  }

  @Test func pruneDeckCases() throws {
    let file = try Golden.load("src/progress/progress", "pruneDeck")
    #expect(!file.cases.isEmpty)
    for c in file.cases {
      let got = pruneDeck(
        try G.progress(try G.required(c.input, "progress")), try G.required(c.input, "deckId").string(),
        try G.strings(try G.required(c.input, "cardIds")))
      #expect(G.exactly(got, try G.progress(c.output)), "\(c.name)")
    }
  }

  @Test func seenShareCases() throws {
    let file = try Golden.load("src/progress/progress", "seenShare")
    #expect(!file.cases.isEmpty)
    for c in file.cases {
      let got = seenShare(try G.history(try G.required(c.input, "history")), try G.strings(try G.required(c.input, "cardIds")))
      #expect(got.bitPattern == (try c.output.number()).bitPattern, "\(c.name)")
    }
  }
}
```

- [ ] **Step 10: Run them and watch them fail.**

```bash
(cd ios/TruthyEngine && swift test --filter 'ProgressTests|ProgressGoldenTests')
```

Expected: the test target does not build: `error: cannot find type 'Progress' in scope` and `cannot find 'Progress' in scope`, and the same for `emptyProgress`, `recordKey`, `bestFor`, `compareWithBest`, `Comparison`, `applyResult`, `pruneDeck`, `seenShare`, `LastRound` and `progressJSON`. No test runs.

- [ ] **Step 11: Write the progress rules.**

`ios/TruthyEngine/Sources/TruthyEngine/Progress.swift`:

```swift
// Progress: card history, records and the last route played. A line-by-line port of
// src/progress/progress.ts (reference 3.5). Pure: every function returns new values.
import Foundation

// The last round played. score and total are nil for an abandoned round and for a last route stored
// before scores were kept.
public struct LastRound: Codable, Equatable, Sendable {
  public var route: Route
  public var mode: Mode
  public var score: Int?
  public var total: Int?

  public init(route: Route, mode: Mode, score: Int?, total: Int?) {
    self.route = route
    self.mode = mode
    self.score = score
    self.total = total
  }

  private enum CodingKeys: String, CodingKey { case route, mode, score, total }

  // Writes score and total as null, never leaves them out, so the file has the web's shape.
  public func encode(to encoder: any Encoder) throws {
    var container = encoder.container(keyedBy: CodingKeys.self)
    try container.encode(route, forKey: .route)
    try container.encode(mode, forKey: .mode)
    try container.encode(score, forKey: .score)
    try container.encode(total, forKey: .total)
  }
}

public struct Progress: Codable, Equatable, Sendable {
  public var version: Int
  public var cards: [String: CardHistory]
  public var records: [String: Int]  // key: recordKey(route, mode)
  public var last: LastRound?

  public init(version: Int = 1, cards: [String: CardHistory], records: [String: Int], last: LastRound?) {
    self.version = version
    self.cards = cards
    self.records = records
    self.last = last
  }

  private enum CodingKeys: String, CodingKey { case version, cards, records, last }

  // Writes "last": null, never leaves the key out: the web reads a value without it as not whole,
  // which would make every later save copy the stored value aside.
  public func encode(to encoder: any Encoder) throws {
    var container = encoder.container(keyedBy: CodingKeys.self)
    try container.encode(version, forKey: .version)
    try container.encode(cards, forKey: .cards)
    try container.encode(records, forKey: .records)
    try container.encode(last, forKey: .last)
  }
}

public func emptyProgress() -> Progress {
  Progress(version: 1, cards: [:], records: [:], last: nil)
}

// routeKey(route) + "#" + mode, as the web writes it ("aws-clf-c02/SEC#classic").
public func recordKey(_ route: Route, _ mode: Mode) -> String {
  "\(route.deckId)/\(route.sectionId)#\(mode.rawValue)"
}

/// The record for a route and mode, or nil when it has not been played (to the end) yet.
public func bestFor(_ progress: Progress, _ route: Route, _ mode: Mode) -> Int? {
  progress.records[recordKey(route, mode)]
}

/// How a finished round compares with the record that stood before it.
/// TypeScript kinds: "first", "new-best", "equal", "short".
public enum Comparison: Equatable, Sendable {
  case first
  case newBest(previousBest: Int)
  case equal(best: Int)
  case short(best: Int, by: Int)
}

/// Compares a score with the record before the round (nil when this route and mode had none).
public func compareWithBest(_ score: Int, _ previousBest: Int?) -> Comparison {
  guard let previousBest else { return .first }
  if score > previousBest { return .newBest(previousBest: previousBest) }
  if score == previousBest { return .equal(best: previousBest) }
  return .short(best: previousBest, by: previousBest - score)
}

public struct ApplyOutcome: Equatable, Sendable {
  public let progress: Progress
  public let previousBest: Int?
  public let isNewBest: Bool

  public init(progress: Progress, previousBest: Int?, isNewBest: Bool) {
    self.progress = progress
    self.previousBest = previousBest
    self.isNewBest = isNewBest
  }
}

// Records the answers of a round in the card history, remembers its route and mode (and its score when it
// was finished), and sets the record when a finished round beats it. A first finished round always sets the
// record, even with score 0. An abandoned round keeps its answers but never touches the record.
public func applyResult(_ progress: Progress, _ result: RoundResult) -> ApplyOutcome {
  let key = recordKey(result.route, result.mode)
  let previousBest = bestFor(progress, result.route, result.mode)
  let comparison = compareWithBest(result.score, previousBest)
  var isFirstOrBetter = false
  switch comparison {
  case .first, .newBest: isFirstOrBetter = true
  case .equal, .short: isFirstOrBetter = false
  }
  let isNewBest = !result.abandoned && isFirstOrBetter
  var records = progress.records
  if isNewBest { records[key] = result.score }
  return ApplyOutcome(
    progress: Progress(
      version: 1,
      cards: withAnswers(progress.cards, result),
      records: records,
      last: LastRound(
        route: Route(deckId: result.route.deckId, sectionId: result.route.sectionId),
        mode: result.mode,
        score: result.abandoned ? nil : result.score,
        total: result.abandoned ? nil : result.total
      )
    ),
    previousBest: previousBest,
    isNewBest: isNewBest
  )
}

// A card answered twice in one round counts twice and keeps the later verdict and time.
private func withAnswers(_ cards: [String: CardHistory], _ result: RoundResult) -> [String: CardHistory] {
  var next = cards
  for answer in result.answers {
    let id = answer.card.id
    let before = next[id]
    next[id] = CardHistory(seen: (before?.seen ?? 0) + 1, lastCorrect: answer.correct, lastSeenAt: answer.at)
  }
  return next
}

// Drops the history of cards of this deck that are not in the deck any more. A card belongs to the deck when
// its id starts with "<deckId>-" (the plain prefix, compared in UTF-16 code units as JavaScript does).
// Records and the last route are kept.
public func pruneDeck(_ progress: Progress, _ deckId: String, _ cardIds: [String]) -> Progress {
  let prefix = Array("\(deckId)-".utf16)
  let current = Set(cardIds)
  var cards: [String: CardHistory] = [:]
  for (id, entry) in progress.cards {
    if id.utf16.starts(with: prefix) && !current.contains(id) { continue }
    cards[id] = entry
  }
  return Progress(version: progress.version, cards: cards, records: progress.records, last: progress.last)
}

// The share (0 to 1) of the given cards that have been seen at least once. No cards gives 0.
public func seenShare(_ history: History, _ cardIds: [String]) -> Double {
  let ids = Set(cardIds)
  if ids.isEmpty { return 0 }
  var seen = 0
  for id in ids {
    if let entry = history[id], entry.seen > 0 { seen += 1 }
  }
  return Double(seen) / Double(ids.count)
}

// JSON.stringify(progress): the web's shape ("last": null and null scores written out), keys sorted so the
// same progress always gives the same text, and slashes in record keys left unescaped as on the web.
public func progressJSON(_ progress: Progress) throws -> String {
  let encoder = JSONEncoder()
  encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
  return String(decoding: try encoder.encode(progress), as: UTF8.self)
}
```

- [ ] **Step 12: Run them green.**

```bash
(cd ios/TruthyEngine && swift test --filter 'ProgressTests|ProgressGoldenTests')
```

Expected: `Test run with 18 tests in 2 suites passed` (11 in `ProgressTests`, 7 in `ProgressGoldenTests`).

- [ ] **Step 13: Commit.**

```bash
git add ios/TruthyEngine/Sources/TruthyEngine/Progress.swift ios/TruthyEngine/Tests/TruthyEngineTests/ProgressFixtures.swift ios/TruthyEngine/Tests/TruthyEngineTests/Golden/GoldenProgress.swift ios/TruthyEngine/Tests/TruthyEngineTests/ProgressTests.swift ios/TruthyEngine/Tests/TruthyEngineTests/ProgressGoldenTests.swift
git commit -m "feat: port the progress rules to the iOS engine"
```

- [ ] **Step 14: Write the reading tests.**

`ios/TruthyEngine/Tests/TruthyEngineTests/ProgressReadTests.swift` ports `tests/progress/partial-read.test.ts` and the reading rules of reference 3.5, including the numbers JSONSerialization gets wrong:

```swift
import Testing
@testable import TruthyEngine

// Ports of tests/progress/partial-read.test.ts and the reading rules of reference 3.5.
private let stored = #"{"version":1,"cards":{"a":{"seen":3,"lastCorrect":false,"lastSeenAt":5}},"records":{"a/ALL#classic":7},"last":{"route":{"deckId":"a","sectionId":"ALL"},"mode":"classic","score":7,"total":10}}"#
private let keptA = CardHistory(seen: 3, lastCorrect: false, lastSeenAt: 5)
private let lastA = LastRound(route: Route(deckId: "a", sectionId: "ALL"), mode: .classic, score: 7, total: 10)

private func cardsOnly(_ cards: String) -> String { #"{"version":1,"cards":"# + cards + #","records":{},"last":null}"# }

@Suite struct ProgressReadTests {
  @Test func nothingStoredIsEmptyAndWhole() {
    #expect(readProgress(nil) == (progress: emptyProgress(), whole: true))
  }

  @Test func aValidValueReadsWhole() {
    #expect(readProgress(stored) == (progress: Progress(cards: ["a": keptA], records: ["a/ALL#classic": 7], last: lastA), whole: true))
  }

  @Test func valuesThatAreNotProgressReadEmptyAndNotWhole() {
    for raw in ["{not json", "", " ", "{", "undefined", "NaN", "true", "\u{0}", "null", "42", "\"progress\"", "[]", "{}",
      #"{"version":2}"#, #"{"version":"1"}"#, #"{"version":true}"#, "\u{FEFF}{\"version\":1}", #"{"version":1,}"#, "01"] {
      #expect(readProgress(raw) == (progress: emptyProgress(), whole: false), "\(raw)")
    }
  }

  @Test func aVersionWritten1Point0IsVersion1() {
    #expect(readProgress(#"{"version":1.0,"cards":{},"records":{},"last":null}"#) == (progress: emptyProgress(), whole: true))
  }

  @Test func aMissingLastKeyReadsNotWholeWhileAMissingScoreIsNull() {
    #expect(readProgress(#"{"version":1,"cards":{},"records":{}}"#) == (progress: emptyProgress(), whole: false))
    let older = #"{"version":1,"cards":{},"records":{},"last":{"route":{"deckId":"a","sectionId":"ALL"},"mode":"classic"}}"#
    let read = readProgress(older)
    #expect(read.whole)
    #expect(read.progress.last == LastRound(route: Route(deckId: "a", sectionId: "ALL"), mode: .classic, score: nil, total: nil))
  }

  @Test func aFailingPartIsDroppedAloneAndTheRestKept() {
    let badRecord = #"{"version":1,"cards":{},"records":{"x/ALL#classic":7.5,"y/ALL#classic":2},"last":null}"#
    #expect(readProgress(badRecord) == (progress: Progress(cards: [:], records: ["y/ALL#classic": 2], last: nil), whole: false))
    let badMode = #"{"version":1,"cards":{},"records":{},"last":{"route":{"deckId":"a","sectionId":"ALL"},"mode":"daily"}}"#
    #expect(readProgress(badMode) == (progress: emptyProgress(), whole: false))
    let cardsArray = #"{"version":1,"cards":[],"records":{"y/ALL#classic":2},"last":null}"#
    #expect(readProgress(cardsArray) == (progress: Progress(cards: [:], records: ["y/ALL#classic": 2], last: nil), whole: false))
  }

  @Test func numbersFollowJavaScriptAndZod() {
    // 1e999 parses to Infinity, so only the entry that holds it is dropped.
    let infinite = readProgress(cardsOnly(#"{"a":{"seen":1,"lastCorrect":true,"lastSeenAt":1e999},"b":{"seen":1,"lastCorrect":true,"lastSeenAt":2}}"#))
    #expect(infinite == (progress: Progress(cards: ["b": CardHistory(seen: 1, lastCorrect: true, lastSeenAt: 2)], records: [:], last: nil), whole: false))
    // Safe integers only.
    #expect(!readProgress(cardsOnly(#"{"a":{"seen":9007199254740992,"lastCorrect":true,"lastSeenAt":1}}"#)).whole)
    #expect(readProgress(cardsOnly(#"{"a":{"seen":9007199254740991,"lastCorrect":true,"lastSeenAt":1}}"#)).progress.cards["a"]?.seen == 9_007_199_254_740_991)
    // A fractional lastSeenAt is kept, and -0 stays -0.
    #expect(readProgress(cardsOnly(#"{"a":{"seen":1,"lastCorrect":true,"lastSeenAt":1.5}}"#)).progress.cards["a"]?.lastSeenAt == 1.5)
    let negativeZero = readProgress(cardsOnly(#"{"a":{"seen":1,"lastCorrect":true,"lastSeenAt":-0}}"#))
    #expect(negativeZero.whole && negativeZero.progress.cards["a"]?.lastSeenAt.sign == .minus)
  }

  @Test func unknownFieldsAreDroppedAndProtoIsAPlainKey() {
    let raw = #"{"version":1,"theme":"night","cards":{"__proto__":{"seen":1,"lastCorrect":true,"lastSeenAt":1,"flagged":true},"bad":{"seen":-1}},"records":{},"last":null}"#
    #expect(readProgress(raw) == (progress: Progress(cards: ["__proto__": CardHistory(seen: 1, lastCorrect: true, lastSeenAt: 1)], records: [:], last: nil), whole: false))
  }

  @Test func aLaterDuplicateKeyWinsAsInJSONParse() {
    let raw = #"{"version":1,"cards":{},"records":{"a/ALL#classic":1,"a/ALL#classic":4},"last":null}"#
    #expect(readProgress(raw).progress.records == ["a/ALL#classic": 4])
  }

  @Test func escapesInStringsAreDecoded() {
    let raw = #"{"version":1,"cards":{"café-\"1\"":{"seen":1,"lastCorrect":true,"lastSeenAt":1}},"records":{},"last":null}"#
    #expect(readProgress(raw).progress.cards.keys.first == "caf\u{e9}-\"1\"")
  }

  // A recorded deviation: JSON.parse reads any depth; the native reader stops at 512 instead of overflowing the stack.
  @Test func moreThan512NestedValuesFailTheReadWithoutCrashing() {
    #expect(readProgress(String(repeating: "[", count: 100_000)).whole == false)
    func withExtra(_ depth: Int) -> String {
      #"{"version":1,"cards":{},"records":{},"last":null,"extra":"# + String(repeating: "[", count: depth) + String(repeating: "]", count: depth) + "}"
    }
    // The outer object is one level, so 511 arrays inside it are the most that still read.
    #expect(readProgress(withExtra(511)).whole)
    #expect(readProgress(withExtra(512)) == (progress: emptyProgress(), whole: false))
  }

  @Test func aUnicodeEscapeNeedsFourHexDigits() {
    #expect(readProgress(#"{"version":1,"cards":{},"records":{"\u0041/ALL#classic":1},"last":null}"#).progress.records == ["A/ALL#classic": 1])
    #expect(readProgress(#"{"version":1,"cards":{},"records":{"\u+041/ALL#classic":1},"last":null}"#) == (progress: emptyProgress(), whole: false))
    #expect(readProgress(#"{"version":1,"cards":{},"records":{"\u004g/ALL#classic":1},"last":null}"#).whole == false)
  }
}
```

- [ ] **Step 15: Write the reading golden tests.**

`ios/TruthyEngine/Tests/TruthyEngineTests/ProgressReadGoldenTests.swift`. The progress is compared exactly, `lastSeenAt` bit for bit, so the `-0` case must stay `-0`:

```swift
import Testing
@testable import TruthyEngine

// native-data/golden/src.progress.progress.readProgress.json and parseProgress.json, computed by the TypeScript code.
private typealias G = ProgressGolden

@Suite struct ProgressReadGoldenTests {
  @Test func readProgressCases() throws {
    let file = try Golden.load("src/progress/progress", "readProgress")
    #expect(!file.cases.isEmpty)
    for c in file.cases {
      let raw = try G.required(c.input, "raw")
      let got = readProgress(raw == .null ? nil : try raw.string())
      #expect(G.exactly(got.progress, try G.progress(try G.required(c.output, "progress"))), "\(c.name): progress")
      #expect(got.whole == (try G.required(c.output, "whole").bool()), "\(c.name): whole")
    }
  }

  @Test func parseProgressCases() throws {
    let file = try Golden.load("src/progress/progress", "parseProgress")
    #expect(!file.cases.isEmpty)
    for c in file.cases {
      let raw = try G.required(c.input, "raw")
      let got = parseProgress(raw == .null ? nil : try raw.string())
      #expect(G.exactly(got, try G.progress(c.output)), "\(c.name)")
    }
  }
}
```

- [ ] **Step 16: Run them and watch them fail.**

```bash
(cd ios/TruthyEngine && swift test --filter 'ProgressRead')
```

Expected: the test target does not build: `error: cannot find 'readProgress' in scope` (and `parseProgress`). No test runs.

- [ ] **Step 17: Write the JSON parser.**

`ios/TruthyEngine/Sources/TruthyEngine/StoredJSON.swift`:

```swift
// A strict JSON parser with JavaScript's JSON.parse results, for reading stored progress.
// Foundation's JSONSerialization rejects a whole document that holds a number such as 1e999, while
// JSON.parse reads it as Infinity and readProgress then drops only the part that holds it (reference 3.5).
// Every number is a Double, as in JavaScript; a later duplicate key replaces an earlier one.

enum StoredJSON: Equatable, Sendable {
  case null
  case bool(Bool)
  case number(Double)
  case string(String)
  case array([StoredJSON])
  case object([String: StoredJSON])
}

// The value of a whole JSON text, or nil when JSON.parse would throw.
func parseJSON(_ text: String) -> StoredJSON? {
  var parser = JSONParser(units: Array(text.utf16))
  parser.skipWhitespace()
  guard let value = parser.value() else { return nil }
  parser.skipWhitespace()
  return parser.index == parser.units.count ? value : nil
}

private struct JSONParser {
  let units: [UInt16]
  var index = 0
  // Nested arrays and objects open now. Deeper than maxDepth fails the parse instead of overflowing the stack.
  private var depth = 0
  static let maxDepth = 512

  init(units: [UInt16]) { self.units = units }

  private var current: UInt16? { index < units.count ? units[index] : nil }

  private static func unit(_ character: Unicode.Scalar) -> UInt16 { UInt16(character.value) }

  mutating func skipWhitespace() {
    while let c = current, c == 0x20 || c == 0x09 || c == 0x0A || c == 0x0D { index += 1 }
  }

  mutating func value() -> StoredJSON? {
    guard let c = current else { return nil }
    switch c {
    case Self.unit("{"): return object()
    case Self.unit("["): return array()
    case Self.unit("\""): return string().map(StoredJSON.string)
    case Self.unit("t"): return literal("true", .bool(true))
    case Self.unit("f"): return literal("false", .bool(false))
    case Self.unit("n"): return literal("null", .null)
    default: return number()
    }
  }

  private mutating func literal(_ word: String, _ result: StoredJSON) -> StoredJSON? {
    let expected = Array(word.utf16)
    guard index + expected.count <= units.count, Array(units[index..<index + expected.count]) == expected else { return nil }
    index += expected.count
    return result
  }

  private mutating func object() -> StoredJSON? {
    index += 1
    depth += 1
    defer { depth -= 1 }
    if depth > Self.maxDepth { return nil }
    var members: [String: StoredJSON] = [:]
    skipWhitespace()
    if current == Self.unit("}") { index += 1; return .object(members) }
    while true {
      skipWhitespace()
      guard current == Self.unit("\""), let key = string() else { return nil }
      skipWhitespace()
      guard current == Self.unit(":") else { return nil }
      index += 1
      skipWhitespace()
      guard let member = value() else { return nil }
      members[key] = member
      skipWhitespace()
      if current == Self.unit(",") { index += 1; continue }
      if current == Self.unit("}") { index += 1; return .object(members) }
      return nil
    }
  }

  private mutating func array() -> StoredJSON? {
    index += 1
    depth += 1
    defer { depth -= 1 }
    if depth > Self.maxDepth { return nil }
    var items: [StoredJSON] = []
    skipWhitespace()
    if current == Self.unit("]") { index += 1; return .array(items) }
    while true {
      skipWhitespace()
      guard let item = value() else { return nil }
      items.append(item)
      skipWhitespace()
      if current == Self.unit(",") { index += 1; continue }
      if current == Self.unit("]") { index += 1; return .array(items) }
      return nil
    }
  }

  // A string's UTF-16 code units; a lone surrogate becomes U+FFFD, which a Swift String cannot avoid.
  private mutating func string() -> String? {
    index += 1
    var out: [UInt16] = []
    while let c = current {
      index += 1
      if c == Self.unit("\"") { return String(decoding: out, as: UTF16.self) }
      if c < 0x20 { return nil }
      if c != Self.unit("\\") { out.append(c); continue }
      guard let escape = current else { return nil }
      index += 1
      switch escape {
      case Self.unit("\""), Self.unit("\\"), Self.unit("/"): out.append(escape)
      case Self.unit("b"): out.append(0x08)
      case Self.unit("f"): out.append(0x0C)
      case Self.unit("n"): out.append(0x0A)
      case Self.unit("r"): out.append(0x0D)
      case Self.unit("t"): out.append(0x09)
      case Self.unit("u"):
        // Exactly four ASCII hex digits, as JSON.parse requires (UInt16(_:radix:) would also take a sign).
        guard index + 4 <= units.count else { return nil }
        var code: UInt16 = 0
        for u in units[index..<index + 4] {
          switch u {
          case 0x30...0x39: code = code << 4 | (u - 0x30)
          case 0x41...0x46: code = code << 4 | (u - 0x37)
          case 0x61...0x66: code = code << 4 | (u - 0x57)
          default: return nil
          }
        }
        out.append(code)
        index += 4
      default: return nil
      }
    }
    return nil
  }

  private static func isDigit(_ c: UInt16?) -> Bool { c.map { $0 >= 0x30 && $0 <= 0x39 } ?? false }

  // -? (0 | [1-9][0-9]*) (. [0-9]+)? ([eE] [+-]? [0-9]+)?, read as the nearest Double (1e999 is Infinity).
  private mutating func number() -> StoredJSON? {
    let start = index
    if current == Self.unit("-") { index += 1 }
    if current == Self.unit("0") {
      index += 1
    } else if Self.isDigit(current) {
      while Self.isDigit(current) { index += 1 }
    } else {
      return nil
    }
    if current == Self.unit(".") {
      index += 1
      guard Self.isDigit(current) else { return nil }
      while Self.isDigit(current) { index += 1 }
    }
    if current == Self.unit("e") || current == Self.unit("E") {
      index += 1
      if current == Self.unit("+") || current == Self.unit("-") { index += 1 }
      guard Self.isDigit(current) else { return nil }
      while Self.isDigit(current) { index += 1 }
    }
    guard let parsed = Double(String(decoding: units[start..<index], as: UTF16.self)) else { return nil }
    return .number(parsed)
  }
}
```

- [ ] **Step 18: Write the reading port.**

`ios/TruthyEngine/Sources/TruthyEngine/ProgressRead.swift`:

```swift
// Reading a stored progress value part by part, a port of readProgress and parseProgress in
// src/progress/progress.ts and of the zod schemas they use (reference 3.5). Each card entry, each record and
// the last route stand on their own: one that fails is dropped alone, and the read is then not whole.
// Unknown fields are dropped.

private let MAX_SAFE_INTEGER: Double = 9_007_199_254_740_991

// zod 4: z.number() rejects Infinity and NaN; z.int() accepts safe integers only.
private func safeInteger(_ value: StoredJSON?) -> Int? {
  guard case .number(let n)? = value, n.isFinite, n == n.rounded(.towardZero), abs(n) <= MAX_SAFE_INTEGER else { return nil }
  return Int(n)
}

private func nonnegativeInteger(_ value: StoredJSON?) -> Int? {
  guard let n = safeInteger(value), n >= 0 else { return nil }
  return n
}

private func cardHistory(_ value: StoredJSON) -> CardHistory? {
  guard case .object(let fields) = value,
    let seen = nonnegativeInteger(fields["seen"]),
    case .bool(let lastCorrect)? = fields["lastCorrect"],
    case .number(let lastSeenAt)? = fields["lastSeenAt"], lastSeenAt.isFinite, lastSeenAt >= 0
  else { return nil }
  return CardHistory(seen: seen, lastCorrect: lastCorrect, lastSeenAt: lastSeenAt)
}

private func record(_ value: StoredJSON) -> Int? {
  nonnegativeInteger(value)
}

// A score or total: missing reads as nil (stored before scores were kept), null is nil, otherwise a
// non-negative safe integer. The outer nil means the value fails.
private func optionalCount(_ value: StoredJSON?) -> Int?? {
  switch value {
  case nil, .null?: return .some(nil)
  default:
    guard let n = nonnegativeInteger(value) else { return nil }
    return .some(n)
  }
}

private func nonEmptyString(_ value: StoredJSON?) -> String? {
  guard case .string(let s)? = value, !s.isEmpty else { return nil }
  return s
}

// The last route: null reads as nil and succeeds; a missing key fails (undefined is not null in zod).
private func lastRound(_ value: StoredJSON?) -> (success: Bool, last: LastRound?) {
  guard let value else { return (false, nil) }
  if value == .null { return (true, nil) }
  guard case .object(let fields) = value,
    case .object(let route)? = fields["route"],
    let deckId = nonEmptyString(route["deckId"]),
    let sectionId = nonEmptyString(route["sectionId"]),
    case .string(let modeName)? = fields["mode"], let mode = Mode(rawValue: modeName),
    let score = optionalCount(fields["score"]),
    let total = optionalCount(fields["total"])
  else { return (false, nil) }
  return (true, LastRound(route: Route(deckId: deckId, sectionId: sectionId), mode: mode, score: score, total: total))
}

// The entries of a stored map that pass; a value that is not an object reads as empty and not whole.
private func validEntries<T>(_ value: StoredJSON?, _ parse: (StoredJSON) -> T?) -> (kept: [String: T], whole: Bool) {
  guard case .object(let entries)? = value else { return ([:], false) }
  var kept: [String: T] = [:]
  var whole = true
  for (key, entry) in entries {
    if let parsed = parse(entry) { kept[key] = parsed } else { whole = false }
  }
  return (kept, whole)
}

// Never fails. Nothing stored reads as empty and whole. Invalid JSON, a value that is not an object and any
// version other than the number 1 read as empty and not whole. Otherwise a card entry, a record or a last
// route that fails is dropped alone (the last route becomes nil), and the rest is kept.
public func readProgress(_ raw: String?) -> (progress: Progress, whole: Bool) {
  guard let raw else { return (emptyProgress(), true) }
  guard let data = parseJSON(raw), case .object(let fields) = data, fields["version"] == .number(1) else {
    return (emptyProgress(), false)
  }
  let cards = validEntries(fields["cards"], cardHistory)
  let records = validEntries(fields["records"], record)
  let last = lastRound(fields["last"])
  return (
    Progress(version: 1, cards: cards.kept, records: records.kept, last: last.last),
    cards.whole && records.whole && last.success
  )
}

/// The progress kept from a stored value (see readProgress).
public func parseProgress(_ raw: String?) -> Progress {
  readProgress(raw).progress
}
```

- [ ] **Step 19: Run them green.**

```bash
(cd ios/TruthyEngine && swift test --filter 'ProgressRead')
```

Expected: `Test run with 14 tests in 2 suites passed` (12 in `ProgressReadTests`, 2 in `ProgressReadGoldenTests`).

- [ ] **Step 20: Commit.**

```bash
git add ios/TruthyEngine/Sources/TruthyEngine/StoredJSON.swift ios/TruthyEngine/Sources/TruthyEngine/ProgressRead.swift ios/TruthyEngine/Tests/TruthyEngineTests/ProgressReadTests.swift ios/TruthyEngine/Tests/TruthyEngineTests/ProgressReadGoldenTests.swift
git commit -m "feat: read stored progress part by part in the iOS engine"
```

- [ ] **Step 21: Write the store unit tests.**

`ios/TruthyEngine/Tests/TruthyEngineTests/LocalStoreTests.swift` ports `tests/progress/local.test.ts` and the side-key cases of `partial-read.test.ts`:

```swift
import Testing
@testable import TruthyEngine

// Ports of tests/progress/local.test.ts and the side-key cases of partial-read.test.ts.
private struct Refused: Error {}

private final class MemoryStorage: KeyValueStorage {
  var items: [String: String] = [:]
  var refuseGet = false
  var refuseSet: Set<String> = []

  func getItem(_ key: String) throws -> String? {
    if refuseGet { throw Refused() }
    return items[key]
  }

  func setItem(_ key: String, _ value: String) throws {
    if refuseSet.contains(key) { throw Refused() }
    items[key] = value
  }
}

private let played = Progress(
  cards: ["aws-clf-c02-t2.1-06": CardHistory(seen: 2, lastCorrect: true, lastSeenAt: 1_790_000_000_000)],
  records: ["aws-clf-c02/SEC#classic": 7],
  last: LastRound(route: Route(deckId: "aws-clf-c02", sectionId: "SEC"), mode: .classic, score: 7, total: 10))

private let droppedPart = #"{"version":1,"cards":{},"records":{"a/ALL#classic":7},"last":{"route":{"deckId":"a","sectionId":"ALL"},"mode":"daily"}}"#

@Suite struct LocalStoreTests {
  @Test func keysAreTheWebKeys() {
    #expect(PROGRESS_KEY == "truthy.progress.v1")
    #expect(UNREADABLE_KEY == "truthy.progress.v1.unreadable")
  }

  @Test func roundTripsAndLoadsTheLatestSave() {
    let storage = MemoryStorage()
    let store = createLocalStore(storage)
    #expect(store.load() == emptyProgress())
    store.save(played)
    #expect(createLocalStore(storage).load() == played)
    store.save(emptyProgress())
    #expect(store.load() == emptyProgress())
    #expect(storage.items[UNREADABLE_KEY] == nil)
  }

  @Test func withoutAStorageLoadIsEmptyAndSaveDoesNothing() {
    let store = createLocalStore(nil)
    store.save(played)
    #expect(store.load() == emptyProgress())
  }

  @Test func storageFailuresNeverReachTheCaller() {
    let storage = MemoryStorage()
    let store = createLocalStore(storage)
    store.save(played)
    storage.refuseSet = [PROGRESS_KEY, UNREADABLE_KEY]
    store.save(emptyProgress())
    #expect(store.load() == played)
    storage.refuseGet = true
    #expect(store.load() == emptyProgress())
    store.save(emptyProgress())
  }

  @Test func keepsAValueThatDidNotReadWholeUnderTheSideKeyBeforeWritingOverIt() {
    for raw in [droppedPart, "{not json", "null", "[]", #"{"version":2}"#, #"{"version":1,"cards":{},"records":{}}"#] {
      let storage = MemoryStorage()
      storage.items[PROGRESS_KEY] = raw
      let store = createLocalStore(storage)
      store.save(store.load())
      #expect(storage.items[UNREADABLE_KEY] == raw, "\(raw)")
      #expect(readProgress(storage.items[PROGRESS_KEY]).whole, "\(raw)")
    }
  }

  @Test func keepsTheValidRecordsThroughASave() {
    let storage = MemoryStorage()
    storage.items[PROGRESS_KEY] = droppedPart
    let store = createLocalStore(storage)
    store.save(store.load())
    #expect(createLocalStore(storage).load().records == ["a/ALL#classic": 7])
  }

  @Test func makesTheCopyOnceAndReplacesItWithALaterUnreadableValue() {
    let storage = MemoryStorage()
    let store = createLocalStore(storage)
    storage.items[PROGRESS_KEY] = "{first"
    store.save(played)
    #expect(storage.items[UNREADABLE_KEY] == "{first")
    storage.items[UNREADABLE_KEY] = "marker"
    store.save(emptyProgress())
    #expect(storage.items[UNREADABLE_KEY] == "marker")
    storage.items[PROGRESS_KEY] = "{second"
    store.save(played)
    #expect(storage.items[UNREADABLE_KEY] == "{second")
  }

  @Test func doesNotWriteOverAValueThatCannotBeKeptAsideFirst() {
    let storage = MemoryStorage()
    storage.items[PROGRESS_KEY] = "{not json"
    storage.refuseSet = [UNREADABLE_KEY]
    createLocalStore(storage).save(played)
    #expect(storage.items[PROGRESS_KEY] == "{not json")
  }

  @Test func writesOverWhenTheSideKeyAlreadyHoldsTheValue() {
    let storage = MemoryStorage()
    storage.items[PROGRESS_KEY] = "{not json"
    storage.items[UNREADABLE_KEY] = "{not json"
    storage.refuseSet = [UNREADABLE_KEY]
    createLocalStore(storage).save(played)
    #expect(createLocalStore(storage).load() == played)
  }

  @Test func aSavedValueReadsBackWhole() throws {
    let storage = MemoryStorage()
    createLocalStore(storage).save(played)
    let raw = try #require(storage.items[PROGRESS_KEY])
    #expect(readProgress(raw) == (progress: played, whole: true))
    #expect(readProgress(try progressJSON(emptyProgress())) == (progress: emptyProgress(), whole: true))
  }
}
```

- [ ] **Step 22: Write the store golden tests.**

`ios/TruthyEngine/Tests/TruthyEngineTests/LocalStoreGoldenTests.swift` runs the scripts of `src.progress.local.createLocalStore.json` (format under **Interfaces**) over a storage that can be broken step by step:

```swift
import Testing
@testable import TruthyEngine

// native-data/golden/src.progress.local.*.json. The createLocalStore cases are scripts over a storage held as
// plain data: steps run in order, and the output is what each load returned and the storage at the end.
//   load: store.load() into loads; save: store.save(progress); resave: store.save(store.load());
//   put: the script writes a key straight into the storage; breakGet: every getItem throws from here on;
//   breakSet: setItem throws from here on for the listed keys, or for every key when keys is "all".
// "storage": null is createLocalStore(nil).
private typealias G = ProgressGolden

private struct StorageBroken: Error {}

private final class ScriptStorage: KeyValueStorage {
  var items: [String: String]
  var getBroken = false
  var setBroken: Set<String> = []
  var setBrokenForAll = false

  init(_ items: [String: String]) { self.items = items }

  func getItem(_ key: String) throws -> String? {
    if getBroken { throw StorageBroken() }
    return items[key]
  }

  func setItem(_ key: String, _ value: String) throws {
    if setBrokenForAll || setBroken.contains(key) { throw StorageBroken() }
    items[key] = value
  }
}

// The stored progress is compared as JSON (the web and Swift order keys differently); any other value exactly.
private func sameStoredValue(_ got: String, _ expected: String) -> Bool {
  if got.utf16.elementsEqual(expected.utf16) { return true }
  guard let a = parseJSON(got), let b = parseJSON(expected), case .object = a else { return false }
  return a == b
}

@Suite struct LocalStoreGoldenTests {
  @Test func keys() throws {
    #expect(PROGRESS_KEY == (try #require(try Golden.load("src/progress/local", "PROGRESS_KEY").cases.first).output.string()))
    #expect(UNREADABLE_KEY == (try #require(try Golden.load("src/progress/local", "UNREADABLE_KEY").cases.first).output.string()))
  }

  @Test func createLocalStoreScripts() throws {
    let file = try Golden.load("src/progress/local", "createLocalStore")
    #expect(!file.cases.isEmpty)
    for c in file.cases {
      let storageSpec = try G.required(c.input, "storage")
      var storage: ScriptStorage? = nil
      if storageSpec != .null {
        guard case .object(let items) = try G.required(storageSpec, "items") else { throw GoldenError(description: "\(c.name): items") }
        storage = ScriptStorage(try items.mapValues { try $0.string() })
      }
      let store = createLocalStore(storage)
      var loads: [Progress] = []
      for step in try G.required(c.input, "steps").array() {
        switch try G.required(step, "op").string() {
        case "load": loads.append(store.load())
        case "save": store.save(try G.progress(try G.required(step, "progress")))
        case "resave": store.save(store.load())
        case "put": storage?.items[try G.required(step, "key").string()] = try G.required(step, "value").string()
        case "breakGet": storage?.getBroken = true
        case "breakSet":
          let keys = try G.required(step, "keys")
          if keys == .string("all") { storage?.setBrokenForAll = true } else { storage?.setBroken = Set(try keys.array().map { try $0.string() }) }
        case let op: throw GoldenError(description: "\(c.name): unknown op \(op)")
        }
      }
      let expectedLoads = try G.required(c.output, "loads").array().map(G.progress)
      #expect(loads.count == expectedLoads.count, "\(c.name): loads")
      for (got, expected) in zip(loads, expectedLoads) { #expect(G.exactly(got, expected), "\(c.name): load") }
      let expectedItems = try G.required(c.output, "items")
      if expectedItems == .null {
        #expect(storage == nil, "\(c.name): storage")
        continue
      }
      guard case .object(let items) = expectedItems, let storage else { throw GoldenError(description: "\(c.name): items") }
      #expect(Set(storage.items.keys) == Set(items.keys), "\(c.name): keys")
      for (key, value) in items {
        let got = storage.items[key] ?? ""
        #expect(sameStoredValue(got, try value.string()), "\(c.name): \(key) is \(got)")
      }
    }
  }
}
```

- [ ] **Step 23: Run them and watch them fail.**

```bash
(cd ios/TruthyEngine && swift test --filter 'LocalStore')
```

Expected: the test target does not build: `error: cannot find 'createLocalStore' in scope`, `cannot find 'PROGRESS_KEY' in scope`, `cannot find 'UNREADABLE_KEY' in scope` and `cannot find type 'KeyValueStorage' in scope`. No test runs.

- [ ] **Step 24: Write the store port.**

`ios/TruthyEngine/Sources/TruthyEngine/LocalStore.swift`:

```swift
// The progress store over a key-value storage, a port of src/progress/local.ts (reference 3.5 and 6).
// The engine holds no storage of its own: the app hands it one (task 9 backs it with files). A storage that
// throws never reaches the player: load gives the parts of the stored value that still read, and save does
// nothing when it cannot write or cannot first keep an unreadable value aside.
public let PROGRESS_KEY = "truthy.progress.v1"

// Where a stored value that did not read back whole is kept before the store writes over it, so a later
// version can still recover what this one could not read. It holds the latest such value only.
public let UNREADABLE_KEY = "truthy.progress.v1.unreadable"

// The two operations of the web's Storage that the store uses. Either may throw (blocked, full, broken).
public protocol KeyValueStorage {
  func getItem(_ key: String) throws -> String?
  func setItem(_ key: String, _ value: String) throws
}

// The TypeScript ProgressStore of local.ts. In Swift that name belongs to the app's async store protocol
// (task 9), so the engine's synchronous store is LocalStore.
public struct LocalStore {
  let storage: (any KeyValueStorage)?

  public func load() -> Progress {
    guard let storage else { return emptyProgress() }
    do {
      return parseProgress(try storage.getItem(PROGRESS_KEY))
    } catch {
      return emptyProgress()
    }
  }

  public func save(_ progress: Progress) {
    guard let storage else { return }
    do {
      try keepUnreadable(storage)
      try storage.setItem(PROGRESS_KEY, try progressJSON(progress))
    } catch {
      // Full or blocked storage: play goes on, this round is simply not remembered. When the stored
      // value could not be kept aside first, it is not written over either.
    }
  }
}

public func createLocalStore(_ storage: (any KeyValueStorage)?) -> LocalStore {
  LocalStore(storage: storage)
}

// The side-copy decision: copies the stored value to UNREADABLE_KEY when part or all of it was dropped on
// reading and the side key does not already hold exactly that value (compared in UTF-16 code units, as
// JavaScript's === does). Nothing stored reads as whole, so it makes no copy. A throw from either key stops
// the save that called it.
public func keepUnreadable(_ storage: any KeyValueStorage) throws {
  guard let raw = try storage.getItem(PROGRESS_KEY), !readProgress(raw).whole else { return }
  if let kept = try storage.getItem(UNREADABLE_KEY), kept.utf16.elementsEqual(raw.utf16) { return }
  try storage.setItem(UNREADABLE_KEY, raw)
}
```

- [ ] **Step 25: Run them green.**

```bash
(cd ios/TruthyEngine && swift test --filter 'LocalStore')
```

Expected: `Test run with 12 tests in 2 suites passed` (10 in `LocalStoreTests`, 2 in `LocalStoreGoldenTests`).

- [ ] **Step 26: Run the gates.**

```bash
(cd ios/TruthyEngine && swift build 2>&1 | grep -E 'warning|error'; swift test)
```

Expected: the build prints no warning or error. `swift test` ends with `Test run with 238 tests in 23 suites passed after ... with 1 known issue` (task 3's 180 in 15 suites plus these 58 in 8), with `everyGoldenFileHasATest()` skipped, and task 1's purity test passes over the five new sources.

```bash
git add -N ios/TruthyEngine/Sources/TruthyEngine/LocalStore.swift ios/TruthyEngine/Tests/TruthyEngineTests/LocalStoreTests.swift ios/TruthyEngine/Tests/TruthyEngineTests/LocalStoreGoldenTests.swift
pnpm test
```

Expected: every test file passes. `tests/repo-hygiene.test.ts` now scans the new Swift files (marked intent-to-add), and its native rules find no em dash, local path or e-mail-shaped string in them.

- [ ] **Step 27: Commit.**

```bash
git add ios/TruthyEngine/Sources/TruthyEngine/LocalStore.swift ios/TruthyEngine/Tests/TruthyEngineTests/LocalStoreTests.swift ios/TruthyEngine/Tests/TruthyEngineTests/LocalStoreGoldenTests.swift
git commit -m "feat: port the progress store and its unreadable side copy to the iOS engine"
```

**Tried during drafting:** in a throwaway Swift package (tools 6.0, iOS 18 and macOS 15, Swift 6 mode, Swift Testing) with stand-ins for task 1's content types and golden loader, the steps above were replayed in order with exactly the code shown. Every "watch them fail" run failed to build as stated, and every "green" run passed with the counts stated; the whole package ended at `Test run with 56 tests in 8 suites passed`, with no warning.
- **Unit tests** (`SwipeTests`, `ProgressTests`, `ProgressReadTests`, `LocalStoreTests`, 40 tests) ran against the code and need no data.
- **Golden tests** (`SwipeGoldenTests`, `ProgressGoldenTests`, `ProgressReadGoldenTests`, `LocalStoreGoldenTests`, 16 tests) ran against a local fixture in the golden format. The swipe files were computed by running plan A's draft swipe producer over `src/input/swipe.ts`. The progress and store files are plan A's draft output for `progress.ts` and `local.ts`: 63 stored values read, 32 store scripts. Both were computed by the TypeScript code at `main` 53e9c81, whose `swipe.ts`, `progress.ts`, `local.ts` and `play.ts` are byte-identical to the drafts' trees.
- **What runs only at execution:** the run against the committed `native-data/golden`, with its own case counts and names.
- **Mutations:** each of these made the stated test fail: a `<` for `<=` on the 80 ms window (the `interpret` unit tests), `encodeIfPresent` for `last` (store scripts), a missing `last` key read as whole (`readProgress` and store scripts), an infinite `lastSeenAt` accepted (`readProgress`), the side key's equality check replaced by an emptiness check (store scripts), and `>=` in `compareWithBest` (comparison cases).
- **Two facts were checked in a Swift script before the design was fixed:** `JSONSerialization` returns nil for `{"a":1e999}`, while `Double("1e999")` is `inf`; and `JSONEncoder` leaves out a nil optional unless `encode(to:)` writes it.
- **One fact was found by the build:** `'Progress' is ambiguous for type lookup` in a test file that imported Foundation (rule 4).
- **Changed after that run, in the review fix pass:** the engine's parser type is `StoredJSON` (it was `JSONValue`, which compiled only because the test module's own type shadows it), the loads are literal, and the test support is task 1's (`Support/Golden.swift`, `Support/GoldenReaders.swift`). The reconciliation pass then added the depth limit, the four-digit `\u` rule and their two tests (so 58 tests in this task). The README's drafting record says what of that was compiled and run against plan A's real export.
