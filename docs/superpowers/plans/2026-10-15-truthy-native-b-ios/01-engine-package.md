### Task 1: The TruthyEngine package: content types, the golden vector loader, the coverage and purity gates, rng, `pad2`, the logo height and the theme rules

This task creates `ios/TruthyEngine`, the Swift package every later task of this plan builds on, and fills it with the parts of the engine that everything else stands on. It holds the content and play types that the deck files and the progress decode into (`src/content/schema.ts`, `src/content/play.ts`), the seeded generator and the shuffle (`src/engine/rng.ts`), and three small helpers: `pad2` (`components/format.ts`), the logo mark's height (`components/Logo.tsx:20`) and the theme rules (`src/app-state/theme.ts`). It also holds two JavaScript number operations the later ports need bit for bit (`x >>> 0` and `Math.round`).

The test target gets the machinery tasks 2 to 6 use for every golden vector: a loader for plan A's format (card table, `$card`, `$deck`, `$rng`, `$number`, `$undefined`, `$throws`), a coverage test that reads which golden files the suite consumes and checks they exist and are well formed, and a purity test that fails when engine sources reach for a clock, randomness, a timer, storage or a UI framework (spec 4.2, as `tests/purity.test.ts` does for the web). The loader lives in the test target, not in the engine: the engine never reads a file.

Builds on: plan A, complete. This task reads `native-data/golden` (task 4 of plan A wrote the nine files listed under **Golden files this task consumes**) and `native-data/decks` (plan A task 3). Nothing from plan B exists yet.

**Files:**
- Create: `ios/.gitignore`, `ios/TruthyEngine/Package.swift`
- Create: `ios/TruthyEngine/Sources/TruthyEngine/Content.swift`, `Play.swift`, `JSNumber.swift`, `Rng.swift`, `Format.swift`, `Logo.swift`, `Theme.swift` (all in `ios/TruthyEngine/Sources/TruthyEngine/`)
- Create (test support, used by tasks 2 to 6): `ios/TruthyEngine/Tests/TruthyEngineTests/Support/JSONValue.swift`, `ios/TruthyEngine/Tests/TruthyEngineTests/Support/Golden.swift`, `ios/TruthyEngine/Tests/TruthyEngineTests/Support/GoldenReaders.swift`
- Test: create `ContentTests.swift`, `JSNumberTests.swift`, `RngTests.swift`, `GoldenFormatTests.swift`, `GoldenCoverageTests.swift`, `ShippedDecksTests.swift`, `RngGoldenTests.swift`, `SmallHelpersTests.swift`, `PurityTests.swift` (all in `ios/TruthyEngine/Tests/TruthyEngineTests/`)

**Interfaces:**
- Consumes: no Swift code. The files of `native-data/` as plan A's README defines them ("The golden vector format"), and the input and output shapes of the nine golden files in the table below.
- Produces (public, in the `TruthyEngine` library; the README's names exactly, plus the extras marked):

```swift
// Content.swift
public let WHOLE_DECK = "ALL"
public struct CardTextEn: Codable, Hashable, Sendable { public let statement: String; public let explanation: String }   // extra name
public struct CardText: Codable, Hashable, Sendable { public let en: CardTextEn }
public struct CardSource: Codable, Hashable, Sendable { public let title: String; public let url: String }
public struct Card: Codable, Hashable, Sendable { public let id: String; public let section: String; public let text: CardText; public let answer: Bool; public let source: CardSource; public let difficulty: Int; public let appliesTo: String; public let conflictGroups: [String] }
public struct DeckFile: Codable, Equatable, Sendable { public let id: String; public let hash: String; public let cards: [Card] }
public struct IndexSection: Codable, Equatable, Sendable { public let id: String; public let title: String; public let cardCount: Int }
public struct IndexDeck: Codable, Equatable, Sendable { public let id: String; public let code: String; public let title: String; public let passName: String?; public let cardCount: Int; public let version: String; public let hash: String; public let sections: [IndexSection] }
public struct IndexPlatform: Codable, Equatable, Sendable { public let id: String; public let title: String; public let decks: [IndexDeck] }
public struct IndexArea: Codable, Equatable, Sendable { public let id: String; public let title: String; public let platforms: [IndexPlatform] }
public struct DeckIndex: Codable, Equatable, Sendable { public let areas: [IndexArea] }
public struct Route: Codable, Hashable, Sendable { public let deckId: String; public let sectionId: String }

// Play.swift
public enum Mode: String, Codable, CaseIterable, Sendable { case classic, streak, lives, timed }
public let MODES: [Mode]                                                       // extra: play.ts MODES
public struct CardHistory: Codable, Equatable, Sendable { public var seen: Int; public var lastCorrect: Bool; public var lastSeenAt: Double }
public typealias History = [String: CardHistory]
public struct Answered: Codable, Equatable, Sendable { public let card: Card; public let given: Bool; public let correct: Bool; public let at: Double }
public struct RoundResult: Codable, Equatable, Sendable { public let mode: Mode; public let route: Route; public let score: Int; public let total: Int; public let answers: [Answered]; public let missed: [Answered]; public let abandoned: Bool }

// Rng.swift
public typealias Rng = () -> Double
public func createRng(_ seed: Double) -> Rng
public func shuffle<T>(_ items: [T], _ rng: Rng) -> [T]

// Format.swift, Logo.swift, Theme.swift
public func pad2(_ n: Int) -> String
public func logoMarkHeight(_ width: Double = 44) -> Double                     // extra name: LogoMark's height rule
public enum Theme: String, Codable, CaseIterable, Sendable { case light, dark }
public let THEME_KEY = "truthy.theme"
public func parseTheme(_ value: String?) -> Theme?
public func oppositeTheme(_ theme: Theme) -> Theme
public func resolveTheme(_ choice: Theme?, _ systemDark: Bool) -> Theme
public func switchTheme(_ choice: Theme?, _ systemDark: Bool) -> Theme       // the flip rule of the web's switchTheme
```

  - Every type has a public memberwise `init` with the property names as labels, in property order (Swift makes the synthesized one internal, so the files write them out).
  - Internal, for the engine files of tasks 2 to 6 (and the tests through `@testable import TruthyEngine`): `func jsUint32(_ x: Double) -> UInt32` (`x >>> 0`, for example in `chunkSeed`) and `func jsRound(_ x: Double) -> Double` (`Math.round`, for example in the flight path).
  - Test support in `TruthyEngineTests`, for tasks 2 to 6:

```swift
enum JSONValue: Codable, Equatable, Sendable { case null, bool(Bool), number(Double), string(String), array([JSONValue]), object([String: JSONValue])
    subscript(key: String) -> JSONValue? { get }; var stringValue: String? { get }; var numberValue: Double? { get }; var arrayValue: [JSONValue]? { get }; var tag: (key: String, value: JSONValue)? { get } }
struct GoldenError: Error, CustomStringConvertible { let description: String }
struct GoldenCase: Decodable, Sendable { let name: String; let input: JSONValue; let output: JSONValue; var throwsMessage: String? { get } }
struct GoldenFile: Decodable, Sendable { let format: Int; let module: String; let function: String; let source: String; let tests: [String]; let cards: [String: JSONValue]; let cases: [GoldenCase]
    func resolved(_ value: JSONValue, decks: URL = Golden.decksDirectory) throws -> JSONValue
    func decode<T: Decodable>(_ type: T.Type, _ value: JSONValue, decks: URL = Golden.decksDirectory) throws -> T
    func rng(_ value: JSONValue) throws -> Rng }
enum Golden { static let root: URL; static let directory: URL; static let decksDirectory: URL; static let testsDirectory: URL
    static let nameExceptions: [String: String]                                  // plan A's one exception: DEAL
    static func fileName(_ module: String, _ function: String) -> String
    static func load(_ module: String, _ function: String) throws -> GoldenFile
    static func decodeFile(at url: URL) throws -> GoldenFile
    static func fileNames() throws -> [String]
    static func isUndefined(_ value: JSONValue) -> Bool }
// Support/GoldenReaders.swift: the throwing readers tasks 2 to 4 use
typealias GoldenValue = JSONValue
extension JSONValue { func number() throws -> Double; func int() throws -> Int; func bool() throws -> Bool; func string() throws -> String; func array() throws -> [JSONValue] }
extension GoldenFile { func card(_ value: JSONValue) throws -> Card; func cards(_ value: JSONValue) throws -> [Card] }
// GoldenCoverageTests.swift: `private let everyFileRequired = false`; task 6 sets it to true.
```

  - How tasks 2 to 6 add a golden test: call `Golden.load` with the module and the function as two string literals, never through a variable or a wrapper that takes the name (the coverage test finds the call by reading the source, and a call it cannot read counts as no test), loop over every case of the file, decode inputs and outputs with `golden.decode`, build rng arguments with `golden.rng`, read a thrown error with `item.throwsMessage`, and compare numbers exactly (`==`; `isNaN` for NaN). A test never skips a case.
  - The app's theme types of the README (`StoredTheme` and `ResolvedTheme`, declared in task 7's `EngineNames.swift`) are the app's names for this `Theme`; the engine has only `Theme`.
  - **File names.** Plan A names every file `<module with / as .>.<name>.json`, constants included, with one exception: the constant `DEAL` of `src/engine/deal` is `src.engine.deal.DEAL.constant.json`, because `src.engine.deal.DEAL.json` and `src.engine.deal.deal.json` would be one file on the default case-insensitive macOS volume. `Golden.fileName` holds that one pair in `nameExceptions`; a test still writes `Golden.load("src/engine/deal", "DEAL")`. Nothing reads the folder to pick a name, and the coverage test fails when two golden file names are equal ignoring case (README, "Cross-platform agreements").
  - **The manifest.** The app never reads `native-data/manifest.json`. `ShippedDecksTests` checks it once: `format` 1, `generator` 1, `deckHashes` naming exactly the 54 decks of the index, each hash equal to the index entry's `hash` (and, through the first test, to the deck file's), and every index `version` equal to `deckIndexVersion`. A failure means plan A changed its layout: this plan is updated first.

**Golden files this task consumes** (written by plan A task 4; `<module>.<name>.json` in `native-data/golden`, constants included):

| File | `input` | `output` |
|---|---|---|
| `src.engine.rng.createRng.json` | `{"seed": number}` (also -1, 1.9, 2^32 + 1) | the first draws of `createRng(seed)`, as many as the array holds |
| `src.engine.rng.shuffle.json` | `{"items": [string], "rng": {"$rng": ...}}` | `[string]` |
| `components.format.pad2.json` | `{"n": integer}` | string |
| `components.Logo.LogoMark.json` | `{}` (the default width) or `{"width": number}` | the mark's height, a number |
| `src.app-state.theme.THEME_KEY.json` | `null` | `"truthy.theme"` |
| `src.app-state.theme.parseTheme.json` | `{"value": any JSON value}`, or `{}` for undefined | `"light"`, `"dark"` or `null` |
| `src.app-state.theme.oppositeTheme.json` | `{"theme": "light" or "dark"}` | the other theme |
| `src.app-state.theme.resolveTheme.json` | `{"choice": theme or null, "systemDark": bool}` | a theme |
| `src.app-state.theme.switchTheme.json` | `{"choice": theme or null, "systemDark": bool}` | `{"theme": theme, "stored": string or null}` |

**Rules:**

1. **The package.** `swift-tools-version: 6.0`, platforms iOS 18 and macOS 15 (macOS so `swift test` runs on the Mac itself), Swift 6 language mode, Swift Testing, no dependency. The library is `TruthyEngine`, the test target `TruthyEngineTests`. `ios/.gitignore` keeps Xcode user data and build output out of git, on top of the root `.gitignore` plan A task 10 extended (reference 8.1).
2. **Content types.** The property names and their order are those of a shipped card (`id, section, text, answer, source, difficulty, appliesTo, conflictGroups`) and of the index (schema.ts:93-125). `passName` is the only optional field: a missing key decodes to `nil`, and encoding leaves it out again. Decoding is strict: a missing required key is a `DecodingError`. `Card` is `Hashable` over all its fields, but engine code compares cards by `id` (README port traps); nothing here relies on whole-value equality of cards except the tests. Times (`at`, `lastSeenAt`) are `Double` epoch milliseconds, counts `Int`.
3. **mulberry32, exactly** (reference 3.1): the seed goes through `jsUint32` (`seed >>> 0`: -1 is 2^32 - 1, 1.9 is 1, 2^32 + 1 is 1, NaN and the infinities 0); each draw adds `0x6d2b79f5` with `&+`, `Math.imul` is `&*` on `UInt32`, and the result is the `UInt32` divided by 4294967296. Each generator owns its state: two generators with the same seed do not share it.
4. **shuffle**: Fisher-Yates from the end, `j = floor(rng() * (i + 1))`, exactly `count - 1` draws and none for 0 or 1 item; the input array is not changed.
5. **`jsRound` is `Math.round`, exactly**: the nearest integer, a half rounding toward +infinity, `-0` for x in [-0.5, -0]. The common shorthand `(x + 0.5).rounded(.down)` is wrong where `x + 0.5` is not exact (`0.49999999999999994` gives 1 instead of 0; `4503599627370497` gives `4503599627370498`), so the function compares the exact fraction `x - floor(x)` with 0.5 instead. A test pins both values.
6. **`pad2(n)`** is `String(n).padStart(2, "0")`: lengths in UTF-16 code units, negative numbers unchanged ("-5").
7. **`logoMarkHeight(width)`** is `Math.round(((width * 30) / 44) * 100) / 100` in that order of operations: 44 gives 30, 26 gives 17.73, 20 gives 13.64. The web has no function of that name: the rule sits inside the `LogoMark` component, and the golden file is named after the component.
8. **Theme rules.** `parseTheme` takes the stored string, or `nil` when nothing (or no string) is stored, and accepts only `"light"` and `"dark"`. The web's `parseTheme` takes any value; the golden cases whose value is not a string (a number, an object, an array) reach the native function as `nil` and expect `null`, as the web gives. `switchTheme(choice, systemDark)` is the web's flip rule as a pure function: the opposite of `resolveTheme(choice, systemDark)`; storing it under `THEME_KEY` and showing it are the app's work (tasks 9 and 11), and the flip happens even when storing fails.
9. **The golden loader** follows plan A's format: `{"$card": id}` is the card of the file's table; `{"$deck": id}` is the `cards` array of `native-data/decks/<id>.json`; `{"$number": "Infinity" | "-Infinity" | "NaN" | "-0"}` is that double; `{"$undefined": true}` drops its key from an object and is `null` elsewhere (an `Optional` decodes it to `nil`); `{"$rng": {"seed": n}}` is `createRng(n)`; `{"$rng": {"values": [...]}}` returns the values in order and records a test failure when they run out; `{"$throws": message}` is read with `throwsMessage`. The throwing readers of `GoldenReaders.swift` (`number()`, which also reads a `$number` tag, `int()`, `bool()`, `string()`, `array()`, and `GoldenFile.card(_:)` and `cards(_:)`) are what tasks 2 and 4 decode with; the optional properties are named `stringValue`, `numberValue` and `arrayValue`, because a property and a method may not share the name `string` (swiftc reports `invalid redeclaration of 'string()'`). `GoldenError` is a struct with a description, so a test can throw its own. `decode` re-encodes the resolved value and decodes it with Foundation's JSON coders, with the non-finite numbers carried as the strings `"Infinity"`, `"-Infinity"` and `"NaN"`; `-0` keeps its sign and every finite double comes back bit for bit (checked with `0.30000000000000004`).
10. **Coverage.** `GoldenCoverageTests` reads every `.swift` file under `ios/TruthyEngine/Tests/TruthyEngineTests` and collects each `Golden.load` call that has two string literals. Four checks: every golden file is well formed (format 1, its name is `fileName(module, function)`, with plan A's one exception for `DEAL`, at least one case, unique case names, every card table entry decodes as `Card` with its own id, every `$card` in a case is in the table); every file the suite loads exists; no two golden file names are equal ignoring case; and, once `everyFileRequired` is true (task 6), every golden file is loaded by some test. Until then the last check is skipped and listed as skipped. The two set checks hold their result in a named `let` before `#expect`, so that a failure prints the file names (an expectation that contains `try` does not expand its values).
11. **Purity.** `PurityTests` scans every `.swift` file in `ios/TruthyEngine/Sources/TruthyEngine` with comments removed (strings stay) for: the wall clock (`Date`, `CFAbsoluteTimeGetCurrent`, `gettimeofday`), a monotonic clock (`CACurrentMediaTime`, `ProcessInfo`, `DispatchTime`, `ContinuousClock`, `SuspendingClock`, `mach_absolute_time`, `clock_gettime`), randomness (`.random`, `.randomElement`, `.shuffle(`, `.shuffled(`, `SystemRandomNumberGenerator`, `RandomNumberGenerator`, `arc4random`, `SecRandomCopyBytes`), a timer or scheduler (`Timer`, `DispatchQueue`, `RunLoop`, `OperationQueue`, `CADisplayLink`, `Task.sleep`), storage (`FileManager`, `FileHandle`, `UserDefaults`, `Bundle`, `NSUbiquitousKeyValueStore`, and the file reads and writes Foundation allows without them: `contentsOf:` and `.write(to:`) and a UI framework import (`SwiftUI`, `UIKit`, `AppKit`, `Combine`, `QuartzCore`). The engine's own free function `shuffle(items, rng)` is not a finding. The patterns use simple word boundaries: with Swift Regex's default Unicode boundaries `UserDefaults.standard` is one word and `\bUserDefaults\b` does not match it. `import Foundation` is allowed (task 4 may need its JSON parser); the APIs above are not. The test also checks that `Package.swift` declares the engine target with no dependency.

**Review focus.** None of the README's five review focus items belongs to this task. What a reviewer should check here: the mulberry32 lines against `rng.ts` (each operator), `jsRound` against rule 5, and that the golden loader resolves every tag of plan A's format.

**Steps:**

- [ ] **Step 1: Check the starting point.**

```bash
git branch --show-current
ls native-data/golden/src.engine.rng.createRng.json native-data/golden/src.engine.rng.shuffle.json native-data/golden/components.format.pad2.json native-data/golden/components.Logo.LogoMark.json native-data/golden/src.app-state.theme.THEME_KEY.json native-data/golden/src.app-state.theme.parseTheme.json native-data/golden/src.app-state.theme.oppositeTheme.json native-data/golden/src.app-state.theme.resolveTheme.json native-data/golden/src.app-state.theme.switchTheme.json native-data/golden/src.engine.deal.DEAL.constant.json native-data/manifest.json
ls native-data/golden | wc -l
ls native-data/decks | wc -l
test -e ios && echo "ios exists" || echo "no ios folder yet"
swift --version
```

Expected: `native`; the eleven paths printed back with no error; `130` golden files; `55` (the index and 54 decks); `no ios folder yet`; a Swift 6 compiler (Xcode 26.6 prints `Apple Swift version 6.3.3`). If a golden file is missing or named differently, stop: plan A task 4 is not done, or it named the file another way.

- [ ] **Step 2: Create the package manifest, the ignore file and the content tests.**

`ios/.gitignore`:

```gitignore
xcuserdata/
*.xcuserstate
build/
DerivedData/
.build/
.swiftpm/
```

`ios/TruthyEngine/Package.swift`:

```swift
// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "TruthyEngine",
    platforms: [.iOS(.v18), .macOS(.v15)],
    products: [
        .library(name: "TruthyEngine", targets: ["TruthyEngine"]),
    ],
    targets: [
        .target(name: "TruthyEngine"),
        .testTarget(name: "TruthyEngineTests", dependencies: ["TruthyEngine"]),
    ],
    swiftLanguageModes: [.v6]
)
```

`ios/TruthyEngine/Tests/TruthyEngineTests/ContentTests.swift`:

```swift
import Foundation
import Testing
import TruthyEngine

// A card of native-data/decks/angular-fundamentals.json, byte for byte as the web build writes it.
private let shippedCard = #"{"id":"angular-fundamentals-sr2-05","section":"CMP","text":{"en":{"statement":"Angular writes two-way binding with parentheses inside square brackets, as in [(value)].","explanation":"The [(...)] form combines the property's binding with the corresponding event binding."}},"answer":true,"source":{"title":"Two-way binding","url":"https://angular.dev/guide/templates/two-way-binding"},"difficulty":1,"appliesTo":"Angular v22","conflictGroups":["two-way-binding-syntax"]}"#

// Two decks of an index: one with a pass name and no sections (gcp-cdl), one without a pass name.
private let shippedIndex = #"{"areas":[{"id":"cloud","title":"Cloud","platforms":[{"id":"gcp","title":"Google Cloud","decks":[{"id":"gcp-cdl","code":"CDL","title":"Cloud Digital Leader","passName":"Google Cloud Digital Leader","cardCount":133,"version":"2026-10-15","hash":"ed6f6217a4eb6f9c","sections":[]}]},{"id":"aws","title":"AWS","decks":[{"id":"aws-clf-c02","code":"CLF","title":"Cloud Practitioner","cardCount":214,"version":"2026-10-15","hash":"63acac4acc4a6213","sections":[{"id":"CON","title":"Cloud concepts","cardCount":45}]}]}]}]}"#

private func decode<T: Decodable>(_ type: T.Type, _ json: String) throws -> T {
    try JSONDecoder().decode(type, from: Data(json.utf8))
}

private func roundTrip<T: Codable>(_ value: T) throws -> T {
    try JSONDecoder().decode(T.self, from: JSONEncoder().encode(value))
}

@Suite struct ContentTests {
    @Test func decodesAShippedCard() throws {
        let card = try decode(Card.self, shippedCard)
        #expect(card.id == "angular-fundamentals-sr2-05")
        #expect(card.section == "CMP")
        #expect(card.text.en.statement == "Angular writes two-way binding with parentheses inside square brackets, as in [(value)].")
        #expect(card.text.en.explanation == "The [(...)] form combines the property's binding with the corresponding event binding.")
        #expect(card.answer == true)
        #expect(card.source == CardSource(title: "Two-way binding", url: "https://angular.dev/guide/templates/two-way-binding"))
        #expect(card.difficulty == 1)
        #expect(card.appliesTo == "Angular v22")
        #expect(card.conflictGroups == ["two-way-binding-syntax"])
        #expect(try roundTrip(card) == card)
    }

    @Test func refusesACardWithoutAnAnswer() {
        let broken = shippedCard.replacingOccurrences(of: #""answer":true,"#, with: "")
        #expect(throws: DecodingError.self) { try decode(Card.self, broken) }
    }

    @Test func decodesAnIndexWithAndWithoutAPassName() throws {
        let index = try decode(DeckIndex.self, shippedIndex)
        let platforms = index.areas[0].platforms
        #expect(index.areas.map(\.id) == ["cloud"])
        #expect(platforms.map(\.title) == ["Google Cloud", "AWS"])
        let cdl = platforms[0].decks[0]
        #expect(cdl.passName == "Google Cloud Digital Leader")
        #expect(cdl.sections.isEmpty)
        let clf = platforms[1].decks[0]
        #expect(clf.passName == nil)
        #expect(clf.code == "CLF")
        #expect(clf.cardCount == 214)
        #expect(clf.version == "2026-10-15")
        #expect(clf.hash == "63acac4acc4a6213")
        #expect(clf.sections == [IndexSection(id: "CON", title: "Cloud concepts", cardCount: 45)])
        #expect(try roundTrip(index) == index)
    }

    @Test func leavesAMissingPassNameOutWhenEncoding() throws {
        let clf = try decode(DeckIndex.self, shippedIndex).areas[0].platforms[1].decks[0]
        let text = String(decoding: try JSONEncoder().encode(clf), as: UTF8.self)
        #expect(!text.contains("passName"))
    }

    @Test func decodesADeckFile() throws {
        let deck = try decode(DeckFile.self, #"{"id":"angular-fundamentals","hash":"0123456789abcdef","cards":[\#(shippedCard)]}"#)
        #expect(deck.id == "angular-fundamentals")
        #expect(deck.hash == "0123456789abcdef")
        #expect(deck.cards.map(\.id) == ["angular-fundamentals-sr2-05"])
    }

    @Test func namesTheWholeDeckAndTheClassesAsTheWebDoes() throws {
        #expect(WHOLE_DECK == "ALL")
        #expect(Mode.allCases.map(\.rawValue) == ["classic", "streak", "lives", "timed"])
        #expect(MODES == Mode.allCases)
        #expect(try decode(Route.self, #"{"deckId":"gcp-cdl","sectionId":"ALL"}"#) == Route(deckId: "gcp-cdl", sectionId: WHOLE_DECK))
        #expect(try decode(Mode.self, #""lives""#) == .lives)
    }

    @Test func keepsHistoryAndAnswersAsTheProgressFileWritesThem() throws {
        let history = try decode(History.self, #"{"gcp-cdl-s1.1-01":{"seen":2,"lastCorrect":false,"lastSeenAt":1760000000000}}"#)
        #expect(history["gcp-cdl-s1.1-01"] == CardHistory(seen: 2, lastCorrect: false, lastSeenAt: 1_760_000_000_000))
        let card = try decode(Card.self, shippedCard)
        let answer = Answered(card: card, given: false, correct: false, at: 1_760_000_000_500)
        let result = RoundResult(
            mode: .classic,
            route: Route(deckId: "angular-fundamentals", sectionId: "CMP"),
            score: 0,
            total: 1,
            answers: [answer],
            missed: [answer],
            abandoned: false
        )
        #expect(try roundTrip(result) == result)
    }
}
```

- [ ] **Step 3: Run the tests and see them fail.**

```bash
swift test --package-path ios/TruthyEngine
```

Expected: the build stops before any test runs, with

```text
warning: 'truthyengine': Source files for target TruthyEngine should be located under 'Sources/TruthyEngine', 'Sources', or a custom sources path can be set with the 'path' property in Package.swift
error: 'truthyengine': target 'TruthyEngine' referenced in product 'TruthyEngine' is empty
```

- [ ] **Step 4: Write the content and play types.**

`ios/TruthyEngine/Sources/TruthyEngine/Content.swift`:

```swift
// The shipped content, as src/content/schema.ts describes it: native-data/decks/index.json and
// native-data/decks/<deckId>.json decode into these types. Property order is the order of a shipped card's keys.

/// The section id that means "the whole deck" (schema.ts: WHOLE_DECK).
public let WHOLE_DECK = "ALL"

public struct CardTextEn: Codable, Hashable, Sendable {
    public let statement: String
    public let explanation: String

    public init(statement: String, explanation: String) {
        self.statement = statement
        self.explanation = explanation
    }
}

/// A card's text by language. Only English ships.
public struct CardText: Codable, Hashable, Sendable {
    public let en: CardTextEn

    public init(en: CardTextEn) {
        self.en = en
    }
}

public struct CardSource: Codable, Hashable, Sendable {
    public let title: String
    public let url: String

    public init(title: String, url: String) {
        self.title = title
        self.url = url
    }
}

/// One statement. Engine code compares cards by `id`, never by the whole value.
public struct Card: Codable, Hashable, Sendable {
    public let id: String
    public let section: String
    public let text: CardText
    public let answer: Bool
    public let source: CardSource
    public let difficulty: Int
    public let appliesTo: String
    public let conflictGroups: [String]

    public init(
        id: String,
        section: String,
        text: CardText,
        answer: Bool,
        source: CardSource,
        difficulty: Int,
        appliesTo: String,
        conflictGroups: [String]
    ) {
        self.id = id
        self.section = section
        self.text = text
        self.answer = answer
        self.source = source
        self.difficulty = difficulty
        self.appliesTo = appliesTo
        self.conflictGroups = conflictGroups
    }
}

public struct DeckFile: Codable, Equatable, Sendable {
    public let id: String
    public let hash: String
    public let cards: [Card]

    public init(id: String, hash: String, cards: [Card]) {
        self.id = id
        self.hash = hash
        self.cards = cards
    }
}

public struct IndexSection: Codable, Equatable, Sendable {
    public let id: String
    public let title: String
    public let cardCount: Int

    public init(id: String, title: String, cardCount: Int) {
        self.id = id
        self.title = title
        self.cardCount = cardCount
    }
}

public struct IndexDeck: Codable, Equatable, Sendable {
    public let id: String
    public let code: String
    public let title: String
    /// Absent in the file when the deck has none; encoding leaves the key out again.
    public let passName: String?
    public let cardCount: Int
    public let version: String
    public let hash: String
    public let sections: [IndexSection]

    public init(
        id: String,
        code: String,
        title: String,
        passName: String?,
        cardCount: Int,
        version: String,
        hash: String,
        sections: [IndexSection]
    ) {
        self.id = id
        self.code = code
        self.title = title
        self.passName = passName
        self.cardCount = cardCount
        self.version = version
        self.hash = hash
        self.sections = sections
    }
}

public struct IndexPlatform: Codable, Equatable, Sendable {
    public let id: String
    public let title: String
    public let decks: [IndexDeck]

    public init(id: String, title: String, decks: [IndexDeck]) {
        self.id = id
        self.title = title
        self.decks = decks
    }
}

public struct IndexArea: Codable, Equatable, Sendable {
    public let id: String
    public let title: String
    public let platforms: [IndexPlatform]

    public init(id: String, title: String, platforms: [IndexPlatform]) {
        self.id = id
        self.title = title
        self.platforms = platforms
    }
}

public struct DeckIndex: Codable, Equatable, Sendable {
    public let areas: [IndexArea]

    public init(areas: [IndexArea]) {
        self.areas = areas
    }
}

/// A deck and a section of it, or WHOLE_DECK.
public struct Route: Codable, Hashable, Sendable {
    public let deckId: String
    public let sectionId: String

    public init(deckId: String, sectionId: String) {
        self.deckId = deckId
        self.sectionId = sectionId
    }
}
```

`ios/TruthyEngine/Sources/TruthyEngine/Play.swift`:

```swift
// What a round is made of, as far as both the engine and the progress need to know (src/content/play.ts).
// Types and one constant, no behaviour.

/// The class of a round. The raw values are the TypeScript strings, and the record keys use them.
public enum Mode: String, Codable, CaseIterable, Sendable {
    case classic, streak, lives, timed
}

/// play.ts: MODES, in the order the class step lists them.
public let MODES: [Mode] = [.classic, .streak, .lives, .timed]

public struct CardHistory: Codable, Equatable, Sendable {
    public var seen: Int
    public var lastCorrect: Bool
    /// Epoch milliseconds. A value that is not finite counts as 0 when dealing.
    public var lastSeenAt: Double

    public init(seen: Int, lastCorrect: Bool, lastSeenAt: Double) {
        self.seen = seen
        self.lastCorrect = lastCorrect
        self.lastSeenAt = lastSeenAt
    }
}

/// Card history by card id.
public typealias History = [String: CardHistory]

public struct Answered: Codable, Equatable, Sendable {
    public let card: Card
    public let given: Bool
    public let correct: Bool
    /// Epoch milliseconds, from the same clock as Timed's tick and visibility events.
    public let at: Double

    public init(card: Card, given: Bool, correct: Bool, at: Double) {
        self.card = card
        self.given = given
        self.correct = correct
        self.at = at
    }
}

public struct RoundResult: Codable, Equatable, Sendable {
    public let mode: Mode
    public let route: Route
    /// The number the class's record keeps.
    public let score: Int
    /// Cards answered.
    public let total: Int
    public let answers: [Answered]
    /// The answers with `correct == false`, in order.
    public let missed: [Answered]
    public let abandoned: Bool

    public init(mode: Mode, route: Route, score: Int, total: Int, answers: [Answered], missed: [Answered], abandoned: Bool) {
        self.mode = mode
        self.route = route
        self.score = score
        self.total = total
        self.answers = answers
        self.missed = missed
        self.abandoned = abandoned
    }
}
```

- [ ] **Step 5: Run the tests and see them pass.**

```bash
swift test --package-path ios/TruthyEngine
```

Expected: the XCTest part prints `Executed 0 tests, with 0 failures`, then Swift Testing ends with `Test run with 7 tests in 1 suite passed`. No compiler warning.

- [ ] **Step 6: Commit.**

```bash
git add ios/.gitignore ios/TruthyEngine/Package.swift ios/TruthyEngine/Sources/TruthyEngine/Content.swift ios/TruthyEngine/Sources/TruthyEngine/Play.swift ios/TruthyEngine/Tests/TruthyEngineTests/ContentTests.swift
git status --short
pnpm vitest run tests/repo-hygiene.test.ts
git commit -m "feat: add the TruthyEngine package with the content and play types"
```

Expected: `git status --short` lists exactly the five files as added (`A `) and nothing else (no `.build` or `.swiftpm` folder: both are ignored); the hygiene test passes (it reads `git ls-files`, so the staged files are scanned, under plan A's native rules); the commit has five files.

- [ ] **Step 7: Write the tests for the JavaScript number operations and for rng.** `JSNumberTests` takes its values from node (`x >>> 0`, `Math.round(x)`); `RngTests` is `tests/engine/rng.test.ts` case by case.

`ios/TruthyEngine/Tests/TruthyEngineTests/JSNumberTests.swift`:

```swift
import Testing
@testable import TruthyEngine

// The values come from node: `x >>> 0` and `Math.round(x)`.
@Suite struct JSNumberTests {
    @Test(arguments: [
        (0.5, UInt32(0)), (-1, 4_294_967_295), (1.9, 1), (4_294_967_297, 1), (-1.5, 4_294_967_295),
        (2_147_483_648, 2_147_483_648), (.nan, 0), (.infinity, 0), (-.infinity, 0), (1e20, 1_661_992_960),
    ] as [(Double, UInt32)])
    func uint32LikeJavaScript(x: Double, expected: UInt32) {
        #expect(jsUint32(x) == expected)
    }

    @Test(arguments: [
        (0.49999999999999994, 0.0), (0.5, 1), (1.5, 2), (2.5, 3), (-1.5, -1), (-2.5, -2),
        (4_503_599_627_370_497, 4_503_599_627_370_497), (1772.7272727272727, 1773), (1363.6363636363635, 1364),
    ] as [(Double, Double)])
    func roundLikeJavaScript(x: Double, expected: Double) {
        #expect(jsRound(x) == expected)
    }

    @Test func roundKeepsNegativeZeroAsJavaScriptDoes() {
        for x in [-0.5, -0.4, -0.0] {
            let rounded = jsRound(x)
            #expect(rounded == 0 && rounded.sign == .minus, "Math.round(\(x)) is -0")
        }
        #expect(jsRound(0.4).sign == .plus)
        #expect(jsRound(.infinity) == .infinity)
        #expect(jsRound(.nan).isNaN)
    }
}
```

`ios/TruthyEngine/Tests/TruthyEngineTests/RngTests.swift`:

```swift
import Testing
import TruthyEngine

// tests/engine/rng.test.ts, case by case.
private func draw(_ seed: Double, _ count: Int) -> [Double] {
    let rng = createRng(seed)
    return (0..<count).map { _ in rng() }
}

@Suite struct RngTests {
    @Test func producesTheReferenceMulberry32Values() {
        #expect(draw(1, 3).map { $0 * 4_294_967_296 } == [2_693_262_067, 11_749_833, 2_265_367_787])
        #expect(draw(42, 3).map { $0 * 4_294_967_296 } == [2_581_720_956, 1_925_393_290, 3_661_312_704])
        #expect(draw(0, 3).map { $0 * 4_294_967_296 } == [1_144_304_738, 1_416_247, 958_946_056])
    }

    @Test func givesTheSameSequenceForTheSameSeedAndAnotherForAnotherSeed() {
        #expect(draw(7, 50) == draw(7, 50))
        #expect(draw(7, 5) != draw(8, 5))
    }

    @Test func keepsTwoGeneratorsWithTheSameSeedIndependent() {
        let a = createRng(3)
        let b = createRng(3)
        _ = a()
        _ = a()
        #expect(b() == draw(3, 1)[0])
    }

    @Test func staysInTheUnitIntervalAndIsRoughlyUniform() {
        var buckets = [Int](repeating: 0, count: 10)
        for x in draw(99, 10_000) {
            #expect(x >= 0 && x < 1)
            buckets[Int((x * 10).rounded(.down))] += 1
        }
        #expect(buckets.allSatisfy { $0 > 800 && $0 < 1200 })
    }

    @Test func takesTheSeedAsAnUnsigned32BitInteger() {
        #expect(draw(-1, 3) == draw(4_294_967_295, 3))
        #expect(draw(1.9, 3) == draw(1, 3))
        #expect(draw(4_294_967_297, 3) == draw(1, 3))
    }

    @Test func shufflesToTheReferenceOrderAndLeavesTheInputAlone() {
        let items = ["a", "b", "c", "d", "e", "f", "g", "h"]
        #expect(shuffle(items, createRng(1)) == ["c", "b", "g", "h", "e", "d", "a", "f"])
        #expect(items == ["a", "b", "c", "d", "e", "f", "g", "h"])
        #expect(shuffle(items, createRng(5)).sorted() == items)
        #expect(shuffle(items, createRng(11)) == shuffle(items, createRng(11)))
    }

    @Test func shufflesAnEmptyListAndASingleItemWithoutDrawing() {
        var calls = 0
        let counting: Rng = {
            calls += 1
            return 0.5
        }
        #expect(shuffle([String](), counting) == [])
        #expect(shuffle(["only"], counting) == ["only"])
        #expect(calls == 0)
    }

    @Test func drawsExactlyCountMinusOneValues() {
        var calls = 0
        let counting: Rng = {
            calls += 1
            return 0.5
        }
        _ = shuffle(["a", "b", "c", "d", "e", "f", "g", "h"], counting)
        #expect(calls == 7)
    }

    @Test func canPutEveryItemInEveryPosition() {
        var seenAt: [String: Set<Int>] = [:]
        for seed in 0..<2000 {
            for (position, item) in shuffle(["w", "x", "y", "z"], createRng(Double(seed))).enumerated() {
                seenAt[item, default: []].insert(position)
            }
        }
        #expect(["w", "x", "y", "z"].allSatisfy { seenAt[$0]?.count == 4 })
    }
}
```

- [ ] **Step 8: Run them and see them fail.**

```bash
swift test --package-path ios/TruthyEngine
```

Expected: compile errors, among them `error: cannot find 'jsUint32' in scope`, `error: cannot find 'createRng' in scope` and `error: cannot find type 'Rng' in scope`.

- [ ] **Step 9: Write the number operations, the generator and the shuffle.**

`ios/TruthyEngine/Sources/TruthyEngine/JSNumber.swift`:

```swift
// JavaScript number operations the TypeScript engine relies on, written out so a port gives the same bits.
// Internal: every engine file uses them, and the tests reach them with @testable import.

/// `x >>> 0`: ToUint32. Truncates toward zero and wraps modulo 2^32; NaN and the infinities give 0.
func jsUint32(_ x: Double) -> UInt32 {
    guard x.isFinite else { return 0 }
    let wrapped = x.rounded(.towardZero).truncatingRemainder(dividingBy: 4_294_967_296)
    return UInt32(wrapped < 0 ? wrapped + 4_294_967_296 : wrapped)
}

/// `Math.round(x)`: the nearest integer, a half rounding toward +infinity, -0 for x in [-0.5, -0].
/// `(x + 0.5).rounded(.down)` is wrong where x + 0.5 is not exact (0.49999999999999994, odd numbers above 2^52);
/// the fraction `x - floor(x)` is always exact, so the comparison is too.
func jsRound(_ x: Double) -> Double {
    guard x.isFinite else { return x }
    let floor = x.rounded(.down)
    let result = x - floor >= 0.5 ? floor + 1 : floor
    return result == 0 && x.sign == .minus ? -0.0 : result
}
```

`ios/TruthyEngine/Sources/TruthyEngine/Rng.swift`:

```swift
// Seeded randomness for the engine (src/engine/rng.ts). The engine never draws from the system: a round gets
// one generator from its seed, so the same seed and the same events always give the same round on every platform.

/// Uniform in [0, 1).
public typealias Rng = () -> Double

/// mulberry32. The seed is taken as an unsigned 32-bit integer (`seed >>> 0`): -1 is 2^32 - 1, 1.9 is 1,
/// 2^32 + 1 is 1. `Math.imul` and `>>> 0` are UInt32 wrapping arithmetic.
public func createRng(_ seed: Double) -> Rng {
    var state = jsUint32(seed)
    return {
        state = state &+ 0x6d2b_79f5
        var t = state
        t = (t ^ (t >> 15)) &* (t | 1)
        t ^= t &+ ((t ^ (t >> 7)) &* (t | 61))
        return Double(t ^ (t >> 14)) / 4_294_967_296
    }
}

/// Fisher-Yates from the end. Returns a new array; draws exactly items.count - 1 numbers (none for 0 or 1 item).
public func shuffle<T>(_ items: [T], _ rng: Rng) -> [T] {
    var result = items
    var i = result.count - 1
    while i > 0 {
        let j = Int((rng() * Double(i + 1)).rounded(.down))
        result.swapAt(i, j)
        i -= 1
    }
    return result
}
```

- [ ] **Step 10: Run the tests and see them pass.**

```bash
swift test --package-path ios/TruthyEngine
```

Expected: `Test run with 19 tests in 3 suites passed` (content 7, number operations 3, rng 9; a parameterized test counts once).

- [ ] **Step 11: Commit.**

```bash
git add ios/TruthyEngine/Sources/TruthyEngine/JSNumber.swift ios/TruthyEngine/Sources/TruthyEngine/Rng.swift ios/TruthyEngine/Tests/TruthyEngineTests/JSNumberTests.swift ios/TruthyEngine/Tests/TruthyEngineTests/RngTests.swift
pnpm vitest run tests/repo-hygiene.test.ts
git commit -m "feat: port mulberry32 and the shuffle, with JavaScript's uint32 and Math.round"
```

Expected: the hygiene test passes; the commit has four files.

- [ ] **Step 12: Write the tests of the golden loader.** They build small files in plan A's format in memory, so the loader is tested on every tag whatever the vectors hold.

`ios/TruthyEngine/Tests/TruthyEngineTests/GoldenFormatTests.swift`:

```swift
import Foundation
import Testing
import TruthyEngine

// The loader on files written here, in plan A's format, so it is tested before native-data has any vector.

private let card = #"{"id":"t-1","section":"ALL","text":{"en":{"statement":"S","explanation":"E"}},"answer":true,"source":{"title":"T","url":"https://example.com/t"},"difficulty":2,"appliesTo":"","conflictGroups":[]}"#

private func file(cases: String, cards: String = #"{"t-1":\#(card)}"#) throws -> GoldenFile {
    let text = #"{"format":1,"module":"src/demo","function":"demo","source":"src/demo.ts","tests":["tests/demo.test.ts"],"cards":\#(cards),"cases":\#(cases)}"#
    return try JSONDecoder().decode(GoldenFile.self, from: Data(text.utf8))
}

private struct Numbers: Decodable {
    let a: Double
    let b: Double
    let c: Double
    let d: Double
    let e: Int
    let f: Double
}

private struct Optionals: Decodable {
    let kept: Int
    let gone: Int?
}

@Suite struct GoldenFormatTests {
    @Test func readsTheMetaAndTheCases() throws {
        let golden = try file(cases: #"[{"name":"one","input":{"n":1},"output":"01"}]"#)
        #expect(golden.format == 1)
        #expect(golden.module == "src/demo")
        #expect(golden.function == "demo")
        #expect(golden.source == "src/demo.ts")
        #expect(golden.tests == ["tests/demo.test.ts"])
        #expect(golden.cases.map(\.name) == ["one"])
        #expect(golden.cases[0].input["n"] == .number(1))
        #expect(golden.cases[0].output == .string("01"))
    }

    @Test func namesAFileAfterItsModuleAndFunction() {
        #expect(Golden.fileName("src/engine/deal", "dealChunk") == "src.engine.deal.dealChunk.json")
        #expect(Golden.fileName("components/FlightPath", "pointAt") == "components.FlightPath.pointAt.json")
        #expect(Golden.fileName("src/app-state/theme", "THEME_KEY") == "src.app-state.theme.THEME_KEY.json")
        // Plan A's one exception: DEAL and deal would be one file on a volume that ignores case.
        #expect(Golden.fileName("src/engine/deal", "DEAL") == "src.engine.deal.DEAL.constant.json")
        #expect(Golden.fileName("src/engine/deal", "deal") == "src.engine.deal.deal.json")
    }

    @Test func turnsCardReferencesIntoTheCardsOfTheTable() throws {
        let golden = try file(cases: #"[{"name":"c","input":{"pool":[{"$card":"t-1"},{"$card":"t-1"}]},"output":{"$card":"t-1"}}]"#)
        let pool = try golden.decode([Card].self, #require(golden.cases[0].input["pool"]))
        #expect(pool.map(\.id) == ["t-1", "t-1"])
        #expect(pool[0].difficulty == 2)
        #expect(pool[0].source.url == "https://example.com/t")
        #expect(try golden.decode(Card.self, golden.cases[0].output) == pool[0])
    }

    @Test func refusesACardTheTableDoesNotHave() throws {
        let golden = try file(cases: #"[{"name":"c","input":{"$card":"t-2"},"output":null}]"#)
        #expect(throws: GoldenError.self) { try golden.decode(Card.self, golden.cases[0].input) }
    }

    @Test func decodesTheNumbersJsonCannotCarry() throws {
        let golden = try file(cases: #"[{"name":"n","input":{"a":{"$number":"Infinity"},"b":{"$number":"-Infinity"},"c":{"$number":"NaN"},"d":{"$number":"-0"},"e":7,"f":0.30000000000000004},"output":null}]"#)
        let numbers = try golden.decode(Numbers.self, golden.cases[0].input)
        #expect(numbers.a == .infinity)
        #expect(numbers.b == -.infinity)
        #expect(numbers.c.isNaN)
        #expect(numbers.d == 0 && numbers.d.sign == .minus)
        #expect(numbers.e == 7)
        #expect(numbers.f == 0.1 + 0.2)
        // The throwing readers of GoldenReaders.swift read the same values straight from the case.
        let input = golden.cases[0].input
        #expect(try #require(input["a"]).number() == .infinity)
        #expect(try #require(input["d"]).number().sign == .minus)
        #expect(try #require(input["e"]).int() == 7)
        #expect(throws: GoldenError.self) { try #require(input["f"]).int() }
        #expect(throws: GoldenError.self) { try JSONValue.string("7").number() }
    }

    @Test func leavesAnUndefinedKeyOutAndReadsAnUndefinedOutputAsNil() throws {
        let golden = try file(cases: #"[{"name":"u","input":{"kept":1,"gone":{"$undefined":true}},"output":{"$undefined":true}}]"#)
        let input = try golden.decode(Optionals.self, golden.cases[0].input)
        #expect(input.kept == 1)
        #expect(input.gone == nil)
        #expect(try golden.decode(Int?.self, golden.cases[0].output) == nil)
    }

    @Test func readsAThrownErrorAsItsMessage() throws {
        let golden = try file(cases: #"[{"name":"t","input":{},"output":{"$throws":"no cards"}},{"name":"v","input":{},"output":3}]"#)
        #expect(golden.cases[0].throwsMessage == "no cards")
        #expect(golden.cases[1].throwsMessage == nil)
    }

    @Test func makesASeededRngThatMatchesCreateRng() throws {
        let golden = try file(cases: #"[{"name":"r","input":{"rng":{"$rng":{"seed":42}}},"output":null}]"#)
        let rng = try golden.rng(#require(golden.cases[0].input["rng"]))
        let reference = createRng(42)
        #expect([rng(), rng(), rng()] == [reference(), reference(), reference()])
    }

    @Test func makesAnRngThatReturnsItsValuesAndFailsWhenTheyRunOut() throws {
        let golden = try file(cases: #"[{"name":"r","input":{"rng":{"$rng":{"values":[0.25,0.5]}}},"output":null}]"#)
        let rng = try golden.rng(#require(golden.cases[0].input["rng"]))
        #expect(rng() == 0.25)
        #expect(rng() == 0.5)
        withKnownIssue {
            _ = rng()
        }
    }

    @Test func refusesAnArgumentThatIsNotAnRng() throws {
        let golden = try file(cases: #"[{"name":"r","input":{"rng":{"seed":1}},"output":null}]"#)
        #expect(throws: GoldenError.self) { try golden.rng(#require(golden.cases[0].input["rng"])) }
    }

    @Test func readsAWholeDeckFromTheDecksFolder() throws {
        let decks = FileManager.default.temporaryDirectory.appending(path: "golden-decks-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: decks, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: decks) }
        try Data(#"{"id":"t","hash":"0000000000000000","cards":[\#(card)]}"#.utf8).write(to: decks.appending(path: "t.json"))
        let golden = try file(cases: #"[{"name":"d","input":{"pool":{"$deck":"t"}},"output":null}]"#)
        let pool = try golden.decode([Card].self, #require(golden.cases[0].input["pool"]), decks: decks)
        #expect(pool.map(\.id) == ["t-1"])
    }
}
```

- [ ] **Step 13: Run them and see them fail.**

```bash
swift test --package-path ios/TruthyEngine
```

Expected: compile errors, among them `error: cannot find type 'GoldenFile' in scope`.

- [ ] **Step 14: Write the loader.**

`ios/TruthyEngine/Tests/TruthyEngineTests/Support/JSONValue.swift`:

```swift
import Foundation

/// A JSON value exactly as a golden file holds it, before any tag is resolved.
enum JSONValue: Codable, Equatable, Sendable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([JSONValue])
    case object([String: JSONValue])

    init(from decoder: any Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode(Double.self) {
            self = .number(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode([JSONValue].self) {
            self = .array(value)
        } else {
            self = .object(try container.decode([String: JSONValue].self))
        }
    }

    func encode(to encoder: any Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .null: try container.encodeNil()
        case .bool(let value): try container.encode(value)
        case .number(let value): try container.encode(value)
        case .string(let value): try container.encode(value)
        case .array(let value): try container.encode(value)
        case .object(let value): try container.encode(value)
        }
    }

    /// The member `key` of an object, or nil for a missing key or a value that is not an object.
    subscript(key: String) -> JSONValue? {
        if case .object(let members) = self { return members[key] }
        return nil
    }

    // Named ...Value so that GoldenReaders.swift can add the throwing readers string(), number() and array():
    // a property and a method may not share a name.
    var stringValue: String? {
        if case .string(let value) = self { return value }
        return nil
    }

    var numberValue: Double? {
        if case .number(let value) = self { return value }
        return nil
    }

    var arrayValue: [JSONValue]? {
        if case .array(let value) = self { return value }
        return nil
    }

    /// The single key of an object such as {"$card": "id"}, with its value.
    var tag: (key: String, value: JSONValue)? {
        if case .object(let members) = self, members.count == 1, let (key, value) = members.first, key.hasPrefix("$") {
            return (key, value)
        }
        return nil
    }
}
```

`ios/TruthyEngine/Tests/TruthyEngineTests/Support/Golden.swift`:

```swift
import Foundation
import Testing
import TruthyEngine

// Reads native-data/golden, the vectors plan A computes by running the TypeScript code. The format is plan A's
// "The golden vector format": one file per function or constant, a card table, tagged values.

/// Any failure to read a golden value. A struct with a description, so a test can throw one of its own.
struct GoldenError: Error, CustomStringConvertible {
    let description: String
}

struct GoldenCase: Decodable, Sendable {
    let name: String
    let input: JSONValue
    let output: JSONValue

    /// The message of an output written as {"$throws": message}, or nil when the case returns a value.
    var throwsMessage: String? {
        if let tag = output.tag, tag.key == "$throws" { return tag.value.stringValue }
        return nil
    }
}

struct GoldenFile: Decodable, Sendable {
    let format: Int
    let module: String
    let function: String
    let source: String
    let tests: [String]
    let cards: [String: JSONValue]
    let cases: [GoldenCase]

    /// `value` with its tags resolved: {"$card": id} becomes the card of the table, {"$deck": id} the cards of
    /// native-data/decks/<id>.json (read from `decks`), {"$number": ...} the double it names, and
    /// {"$undefined": true} is left out of an object (null anywhere else). {"$rng": ...} and {"$throws": ...} stay.
    func resolved(_ value: JSONValue, decks: URL = Golden.decksDirectory) throws -> JSONValue {
        if let tag = value.tag {
            switch tag.key {
            case "$card":
                guard let id = tag.value.stringValue else { throw GoldenError(description: "malformed tag: $card \(tag.value)") }
                guard let card = cards[id] else { throw GoldenError(description: "card \"\(id)\" is not in the file's card table") }
                return try resolved(card, decks: decks)
            case "$deck":
                guard let id = tag.value.stringValue else { throw GoldenError(description: "malformed tag: $deck \(tag.value)") }
                let data = try Data(contentsOf: decks.appending(path: "\(id).json"))
                guard let cardList = try JSONDecoder().decode(JSONValue.self, from: data)["cards"] else {
                    throw GoldenError(description: "malformed tag: deck \(id) has no cards")
                }
                return cardList
            case "$number":
                switch tag.value.stringValue {
                case "Infinity": return .number(.infinity)
                case "-Infinity": return .number(-.infinity)
                case "NaN": return .number(.nan)
                case "-0": return .number(-0.0)
                default: throw GoldenError(description: "malformed tag: $number \(tag.value)")
                }
            case "$undefined":
                return .null
            default:
                return value
            }
        }
        switch value {
        case .array(let items):
            return .array(try items.map { try resolved($0, decks: decks) })
        case .object(let members):
            var result: [String: JSONValue] = [:]
            for (key, member) in members where !Golden.isUndefined(member) {
                result[key] = try resolved(member, decks: decks)
            }
            return .object(result)
        default:
            return value
        }
    }

    /// `value`, resolved, decoded as `type`. Numbers JSON cannot carry survive: they travel as the strings
    /// "Infinity", "-Infinity" and "NaN" between the encoder and the decoder, and -0 keeps its sign.
    func decode<T: Decodable>(_ type: T.Type, _ value: JSONValue, decks: URL = Golden.decksDirectory) throws -> T {
        let encoder = JSONEncoder()
        encoder.nonConformingFloatEncodingStrategy = .convertToString(positiveInfinity: "Infinity", negativeInfinity: "-Infinity", nan: "NaN")
        let decoder = JSONDecoder()
        decoder.nonConformingFloatDecodingStrategy = .convertFromString(positiveInfinity: "Infinity", negativeInfinity: "-Infinity", nan: "NaN")
        return try decoder.decode(type, from: encoder.encode(resolved(value, decks: decks)))
    }

    /// The generator an rng argument stands for: {"$rng": {"seed": n}} is createRng(n); {"$rng": {"values": [...]}}
    /// returns the values in order and records a test failure when they run out.
    func rng(_ value: JSONValue) throws -> Rng {
        guard let tag = value.tag, tag.key == "$rng" else { throw GoldenError(description: "not an rng argument: \(value)") }
        if let seed = tag.value["seed"]?.numberValue {
            return createRng(seed)
        }
        guard let values = tag.value["values"]?.arrayValue?.compactMap(\.numberValue) else {
            throw GoldenError(description: "not an rng argument: \(value)")
        }
        var next = 0
        return {
            guard next < values.count else {
                Issue.record("the rng ran out after \(values.count) values")
                return 0
            }
            next += 1
            return values[next - 1]
        }
    }
}

enum Golden {
    /// The repository root, five folders above this file's folder (ios/TruthyEngine/Tests/TruthyEngineTests/Support).
    static let root: URL = URL(filePath: #filePath)
        .deletingLastPathComponent()
        .deletingLastPathComponent()
        .deletingLastPathComponent()
        .deletingLastPathComponent()
        .deletingLastPathComponent()
        .deletingLastPathComponent()

    static let directory: URL = root.appending(path: "native-data/golden")
    static let decksDirectory: URL = root.appending(path: "native-data/decks")
    static let testsDirectory: URL = root.appending(path: "ios/TruthyEngine/Tests/TruthyEngineTests")

    /// Plan A's one name that does not follow "<module with / as .>.<name>.json": the constant DEAL of src/engine/deal,
    /// because src.engine.deal.DEAL.json and the function's src.engine.deal.deal.json are one file on a volume that
    /// ignores case (plan A README, "The golden vector format").
    static let nameExceptions: [String: String] = ["src/engine/deal|DEAL": "src.engine.deal.DEAL.constant.json"]

    /// The file name of a function's or constant's vectors: "src/engine/rng" and "createRng" give "src.engine.rng.createRng.json".
    static func fileName(_ module: String, _ function: String) -> String {
        nameExceptions[module + "|" + function] ?? module.replacingOccurrences(of: "/", with: ".") + "." + function + ".json"
    }

    /// The vectors of one function or constant. Every test that ports a function calls this with string literals,
    /// so the coverage test can find which files the suite consumes.
    static func load(_ module: String, _ function: String) throws -> GoldenFile {
        try decodeFile(at: directory.appending(path: fileName(module, function)))
    }

    static func decodeFile(at url: URL) throws -> GoldenFile {
        try JSONDecoder().decode(GoldenFile.self, from: Data(contentsOf: url))
    }

    /// Every file name in native-data/golden, sorted.
    static func fileNames() throws -> [String] {
        try FileManager.default.contentsOfDirectory(atPath: directory.path(percentEncoded: false))
            .filter { $0.hasSuffix(".json") }
            .sorted()
    }

    static func isUndefined(_ value: JSONValue) -> Bool {
        if let tag = value.tag, tag.key == "$undefined" { return true }
        return false
    }
}
```

`ios/TruthyEngine/Tests/TruthyEngineTests/Support/GoldenReaders.swift` (the throwing readers the golden suites of tasks 2 and 4 decode with; task 3 reads with `decode` and its own helpers):

```swift
import TruthyEngine

// Throwing readers over a raw golden value, for suites that walk a case by hand. Each throws a GoldenError that
// names the value it could not read, so a case that does not have the expected shape fails with its content.

typealias GoldenValue = JSONValue

extension JSONValue {
    /// A JSON number, or one of the numbers JSON cannot carry, written {"$number": ...}.
    func number() throws -> Double {
        if case .number(let n) = self { return n }
        if let tag, tag.key == "$number" {
            switch tag.value.stringValue {
            case "Infinity": return .infinity
            case "-Infinity": return -.infinity
            case "NaN": return .nan
            case "-0": return -0.0
            default: break
            }
        }
        throw GoldenError(description: "not a number: \(self)")
    }

    /// A number that is a whole number Int can hold.
    func int() throws -> Int {
        let n = try number()
        guard let i = Int(exactly: n) else { throw GoldenError(description: "not an integer: \(n)") }
        return i
    }

    func bool() throws -> Bool {
        guard case .bool(let b) = self else { throw GoldenError(description: "not a boolean: \(self)") }
        return b
    }

    func string() throws -> String {
        guard case .string(let s) = self else { throw GoldenError(description: "not a string: \(self)") }
        return s
    }

    func array() throws -> [JSONValue] {
        guard case .array(let a) = self else { throw GoldenError(description: "not an array: \(self)") }
        return a
    }
}

extension GoldenFile {
    /// {"$card": id} through the file's card table.
    func card(_ value: JSONValue) throws -> Card {
        try decode(Card.self, value)
    }

    /// An array of card references, or {"$deck": id} (the cards of native-data/decks/<id>.json, in file order).
    func cards(_ value: JSONValue) throws -> [Card] {
        try decode([Card].self, value)
    }
}
```

- [ ] **Step 15: Run the tests and see them pass.**

```bash
swift test --package-path ios/TruthyEngine
```

Expected: `Test run with 30 tests in 4 suites passed after ... with 1 known issue`. The known issue is the rng that runs out, recorded on purpose inside `withKnownIssue` (`recorded a known issue at Golden.swift`).

- [ ] **Step 16: Write the coverage test, the shipped decks test and the golden tests of rng.**

`ios/TruthyEngine/Tests/TruthyEngineTests/GoldenCoverageTests.swift`:

```swift
import Foundation
import Testing
import TruthyEngine

// Spec 7.1: every file in native-data/golden is consumed, and a vector the suite skips is a failing test.
// Which files the suite consumes is read from the test sources: every Golden.load call with two string literals.

/// Off until every ported module has its golden tests; task 6 turns it on, and from then on a golden file
/// without a test fails the suite.
private let everyFileRequired = false

private func consumedFileNames() throws -> Set<String> {
    let pattern = try Regex(#"Golden\.load\("([^"]+)", "([^"]+)"\)"#, as: (Substring, Substring, Substring).self)
    var names = Set<String>()
    let files = FileManager.default.enumerator(at: Golden.testsDirectory, includingPropertiesForKeys: nil)
    while let url = files?.nextObject() as? URL {
        guard url.pathExtension == "swift" else { continue }
        for match in try String(contentsOf: url, encoding: .utf8).matches(of: pattern) {
            names.insert(Golden.fileName(String(match.output.1), String(match.output.2)))
        }
    }
    return names
}

private func cardReferences(in value: JSONValue) -> [String] {
    if let tag = value.tag, tag.key == "$card", let id = tag.value.stringValue { return [id] }
    switch value {
    case .array(let items): return items.flatMap(cardReferences)
    case .object(let members): return members.values.flatMap(cardReferences)
    default: return []
    }
}

@Suite struct GoldenCoverageTests {
    @Test func everyGoldenFileIsWellFormed() throws {
        let names = try Golden.fileNames()
        #expect(!names.isEmpty, "native-data/golden is empty: run plan A first")
        for name in names {
            let golden = try Golden.decodeFile(at: Golden.directory.appending(path: name))
            #expect(golden.format == 1, "\(name): format")
            #expect(Golden.fileName(golden.module, golden.function) == name, "\(name): module and function")
            #expect(!golden.cases.isEmpty, "\(name): no cases")
            #expect(Set(golden.cases.map(\.name)).count == golden.cases.count, "\(name): two cases share a name")
            for (id, card) in golden.cards {
                #expect(try golden.decode(Card.self, card).id == id, "\(name): card table entry \(id)")
            }
            for item in golden.cases {
                for id in cardReferences(in: item.input) + cardReferences(in: item.output) {
                    #expect(golden.cards[id] != nil, "\(name), \(item.name): card \(id) is not in the table")
                }
            }
        }
    }

    @Test func everyFileTheSuiteLoadsExists() throws {
        let consumed = try consumedFileNames()
        #expect(consumed.count >= 2, "the scan found no Golden.load call")
        // A named result, so that a failure prints the names (an expectation with `try` in it does not expand them).
        let missing = consumed.subtracting(try Golden.fileNames()).sorted()
        #expect(missing == [], "loaded files native-data/golden does not have")
    }

    @Test func noTwoGoldenFilesDifferOnlyInCase() throws {
        let names = try Golden.fileNames()
        #expect(Set(names.map { $0.lowercased() }).count == names.count)
    }

    @Test(.enabled(if: everyFileRequired)) func everyGoldenFileHasATest() throws {
        let untested = Set(try Golden.fileNames()).subtracting(try consumedFileNames()).sorted()
        #expect(untested == [], "golden files no test loads with two literals")
    }
}
```

`ios/TruthyEngine/Tests/TruthyEngineTests/ShippedDecksTests.swift`:

```swift
import Foundation
import Testing
import TruthyEngine

// The shipped content of native-data/decks decodes into the content types (reference 2.2: 4 areas, 54 decks,
// 285 sections, 7378 cards; gcp-cdl is the one deck without sections).
@Suite struct ShippedDecksTests {
    @Test func theIndexAndEveryDeckFileDecode() throws {
        let decoder = JSONDecoder()
        let index = try decoder.decode(DeckIndex.self, from: Data(contentsOf: Golden.decksDirectory.appending(path: "index.json")))
        let decks = index.areas.flatMap(\.platforms).flatMap(\.decks)
        #expect(index.areas.map(\.id) == ["cloud", "frontend", "devops", "backend"])
        #expect(decks.count == 54)
        #expect(decks.map(\.sections.count).reduce(0, +) == 285)
        #expect(decks.filter(\.sections.isEmpty).map(\.id) == ["gcp-cdl"])
        #expect(decks.map(\.cardCount).reduce(0, +) == 7378)
        var cards = 0
        for deck in decks {
            let file = try decoder.decode(DeckFile.self, from: Data(contentsOf: Golden.decksDirectory.appending(path: "\(deck.id).json")))
            #expect(file.id == deck.id)
            #expect(file.hash == deck.hash)
            #expect(file.cards.count == deck.cardCount, "\(deck.id)")
            #expect(file.cards.allSatisfy { $0.id.hasPrefix(deck.id + "-") }, "\(deck.id): card id prefix")
            let sections = deck.sections.isEmpty ? [WHOLE_DECK] : deck.sections.map(\.id)
            #expect(file.cards.allSatisfy { sections.contains($0.section) }, "\(deck.id): card sections")
            cards += file.cards.count
        }
        #expect(cards == 7378)
    }

    /// Plan A's manifest, checked once here; the app never reads it. A failure means plan A changed its layout.
    @Test func theManifestIsFormatOneAndMatchesTheDecks() throws {
        let url = Golden.root.appending(path: "native-data/manifest.json")
        let m = try JSONSerialization.jsonObject(with: Data(contentsOf: url)) as! [String: Any]
        #expect(m["format"] as? Int == 1 && m["generator"] as? Int == 1)
        let hashes = m["deckHashes"] as! [String: String]
        let index = try JSONDecoder().decode(DeckIndex.self, from: Data(contentsOf: Golden.decksDirectory.appending(path: "index.json")))
        let decks = index.areas.flatMap(\.platforms).flatMap(\.decks)
        #expect(Set(hashes.keys) == Set(decks.map(\.id)))
        for d in decks { #expect(hashes[d.id] == d.hash && d.version == m["deckIndexVersion"] as? String, "\(d.id)") }
    }
}
```

`ios/TruthyEngine/Tests/TruthyEngineTests/RngGoldenTests.swift`:

```swift
import Testing
import TruthyEngine

// native-data/golden vectors of src/engine/rng.ts.
@Suite struct RngGoldenTests {
    @Test func createRngMatchesTheWeb() throws {
        let golden = try Golden.load("src/engine/rng", "createRng")
        for item in golden.cases {
            let seed = try golden.decode(Double.self, #require(item.input["seed"]))
            let expected = try golden.decode([Double].self, item.output)
            let rng = createRng(seed)
            #expect(expected.map { _ in rng() } == expected, "\(item.name)")
        }
    }

    @Test func shuffleMatchesTheWeb() throws {
        let golden = try Golden.load("src/engine/rng", "shuffle")
        for item in golden.cases {
            let items = try golden.decode([String].self, #require(item.input["items"]))
            let rng = try golden.rng(#require(item.input["rng"]))
            let expected = try golden.decode([String].self, item.output)
            #expect(shuffle(items, rng) == expected, "\(item.name)")
        }
    }
}
```

- [ ] **Step 17: Run the tests.** These test data that exists already, against code that exists already, so they pass at once; step 18 shows they can fail.

```bash
swift test --package-path ios/TruthyEngine
```

Expected: `Test run with 38 tests in 7 suites passed after ... with 1 known issue`, and one line `Test everyGoldenFileHasATest() skipped.` `everyGoldenFileIsWellFormed` reads every file plan A wrote, not only the nine of this task, and decodes every card of every card table. If it reports a file, read the message: a card table entry that does not decode as `Card` means the content types and plan A disagree; stop and report.

- [ ] **Step 18: Prove the golden tests can fail.** In `ios/TruthyEngine/Sources/TruthyEngine/Rng.swift` change `(t | 61)` to `(t | 62)` and run:

```bash
swift test --package-path ios/TruthyEngine
```

Expected: `Suite RngTests failed` and `Suite RngGoldenTests failed` (one issue per wrong draw list, so the count depends on the number of vector cases). Change `62` back to `61`, run the same command again, and expect `Test run with 38 tests in 7 suites passed after ... with 1 known issue`. `git diff --stat` shows no change.

- [ ] **Step 19: Commit.**

```bash
git add ios/TruthyEngine/Tests/TruthyEngineTests/Support/JSONValue.swift ios/TruthyEngine/Tests/TruthyEngineTests/Support/Golden.swift ios/TruthyEngine/Tests/TruthyEngineTests/Support/GoldenReaders.swift ios/TruthyEngine/Tests/TruthyEngineTests/GoldenFormatTests.swift ios/TruthyEngine/Tests/TruthyEngineTests/GoldenCoverageTests.swift ios/TruthyEngine/Tests/TruthyEngineTests/ShippedDecksTests.swift ios/TruthyEngine/Tests/TruthyEngineTests/RngGoldenTests.swift
pnpm vitest run tests/repo-hygiene.test.ts
git commit -m "test: read the golden vectors, gate their coverage and check rng and the shipped decks against them"
```

Expected: the hygiene test passes; the commit has seven files.

- [ ] **Step 20: Write the tests of `pad2`, the logo height and the theme rules.** The first four tests are the web tests' own cases; the other seven run the golden files.

`ios/TruthyEngine/Tests/TruthyEngineTests/SmallHelpersTests.swift`:

```swift
import Testing
import TruthyEngine

// pad2 (tests/components/format.test.ts), the logo mark's height (tests/components/Logo.test.tsx) and the theme
// rules (tests/app-state/theme.test.ts), first as the web tests pin them, then against the golden vectors.
@Suite struct SmallHelpersTests {
    @Test func pad2PadsToTwoDigitsAndLeavesLongerNumbersAlone() {
        #expect(pad2(0) == "00")
        #expect(pad2(7) == "07")
        #expect(pad2(14) == "14")
        #expect(pad2(120) == "120")
        #expect(pad2(-5) == "-5")
    }

    @Test func logoMarkKeepsThe44By30Proportion() {
        #expect(logoMarkHeight() == 30)
        #expect(logoMarkHeight(44) == 30)
        #expect(logoMarkHeight(26) == 17.73)
        #expect(logoMarkHeight(20) == 13.64)
    }

    @Test func parsesOnlyLightAndDark() {
        #expect(parseTheme("light") == .light)
        #expect(parseTheme("dark") == .dark)
        for value in [nil, "", "Dark", " dark", "system", "auto", "1", #""dark""#, "purple"] as [String?] {
            #expect(parseTheme(value) == nil, "\(String(describing: value))")
        }
        #expect(THEME_KEY == "truthy.theme")
        #expect(Theme.allCases.map(\.rawValue) == ["light", "dark"])
    }

    @Test func letsAChoiceWinOverTheSystemAndFlipsTheVisibleTheme() {
        #expect(oppositeTheme(.light) == .dark)
        #expect(oppositeTheme(.dark) == .light)
        #expect(resolveTheme(nil, false) == .light)
        #expect(resolveTheme(nil, true) == .dark)
        #expect(resolveTheme(.light, true) == .light)
        #expect(resolveTheme(.dark, false) == .dark)
        #expect(switchTheme(nil, true) == .light)
        #expect(switchTheme(nil, false) == .dark)
        #expect(switchTheme(.dark, false) == .light)
        #expect(switchTheme(.light, true) == .dark)
    }

    @Test func pad2MatchesTheWeb() throws {
        let golden = try Golden.load("components/format", "pad2")
        for item in golden.cases {
            let n = try golden.decode(Int.self, #require(item.input["n"]))
            let expected = try golden.decode(String.self, item.output)
            #expect(pad2(n) == expected, "\(item.name)")
        }
    }

    @Test func logoMarkHeightMatchesTheWeb() throws {
        let golden = try Golden.load("components/Logo", "LogoMark")
        for item in golden.cases {
            let expected = try golden.decode(Double.self, item.output)
            if let width = item.input["width"] {
                #expect(logoMarkHeight(try golden.decode(Double.self, width)) == expected, "\(item.name)")
            } else {
                #expect(logoMarkHeight() == expected, "\(item.name)")
            }
        }
    }

    @Test func themeKeyMatchesTheWeb() throws {
        let golden = try Golden.load("src/app-state/theme", "THEME_KEY")
        #expect(golden.cases.count == 1)
        #expect(golden.cases[0].input == .null)
        #expect(try golden.decode(String.self, golden.cases[0].output) == THEME_KEY)
    }

    @Test func parseThemeMatchesTheWeb() throws {
        let golden = try Golden.load("src/app-state/theme", "parseTheme")
        for item in golden.cases {
            // A stored value that is not a string (a number, an object, an array) reaches the native store as no
            // string at all, so it is read as nil; the web gives null for all of them too.
            let value = item.input["value"]?.stringValue
            let expected = try golden.decode(Theme?.self, item.output)
            #expect(parseTheme(value) == expected, "\(item.name)")
        }
    }

    @Test func oppositeThemeMatchesTheWeb() throws {
        let golden = try Golden.load("src/app-state/theme", "oppositeTheme")
        for item in golden.cases {
            let theme = try golden.decode(Theme.self, #require(item.input["theme"]))
            #expect(oppositeTheme(theme) == (try golden.decode(Theme.self, item.output)), "\(item.name)")
        }
    }

    @Test func resolveThemeMatchesTheWeb() throws {
        let golden = try Golden.load("src/app-state/theme", "resolveTheme")
        for item in golden.cases {
            let choice = try golden.decode(Theme?.self, #require(item.input["choice"]))
            let systemDark = try golden.decode(Bool.self, #require(item.input["systemDark"]))
            #expect(resolveTheme(choice, systemDark) == (try golden.decode(Theme.self, item.output)), "\(item.name)")
        }
    }

    @Test func switchThemeMatchesTheWeb() throws {
        let golden = try Golden.load("src/app-state/theme", "switchTheme")
        for item in golden.cases {
            let choice = try golden.decode(Theme?.self, #require(item.input["choice"]))
            let systemDark = try golden.decode(Bool.self, #require(item.input["systemDark"]))
            let shown = try golden.decode(Theme.self, #require(item.output["theme"]))
            let stored = try golden.decode(String?.self, #require(item.output["stored"]))
            #expect(switchTheme(choice, systemDark) == shown, "\(item.name)")
            #expect(switchTheme(choice, systemDark).rawValue == stored, "\(item.name): the stored value")
        }
    }
}
```

- [ ] **Step 21: Run them and see them fail.**

```bash
swift test --package-path ios/TruthyEngine
```

Expected: compile errors, among them `error: cannot find 'pad2' in scope`, `error: cannot find 'logoMarkHeight' in scope` and `error: cannot find 'parseTheme' in scope`.

- [ ] **Step 22: Write the three helpers.**

`ios/TruthyEngine/Sources/TruthyEngine/Format.swift`:

```swift
// components/format.ts

/// A number as two digits: "07", "14". Longer numbers stay as they are (`String(n).padStart(2, "0")`).
public func pad2(_ n: Int) -> String {
    let text = String(n)
    let length = text.utf16.count
    return length >= 2 ? text : String(repeating: "0", count: 2 - length) + text
}
```

`ios/TruthyEngine/Sources/TruthyEngine/Logo.swift`:

```swift
// components/Logo.tsx: LogoMark keeps the 44 by 30 proportion of its view box.

/// The height of the logo mark drawn `width` wide: `Math.round(((width * 30) / 44) * 100) / 100`.
/// 44 gives 30 (next to the wordmark), 26 gives 17.73 (the continue line), 20 gives 13.64 (the compact pass band).
public func logoMarkHeight(_ width: Double = 44) -> Double {
    jsRound(width * 30 / 44 * 100) / 100
}
```

`ios/TruthyEngine/Sources/TruthyEngine/Theme.swift`:

```swift
// The theme rules of src/app-state/theme.ts. Day ("light") or night ("dark"); by default the system decides.
// A press on the theme switch flips the theme the player sees and stores the result under THEME_KEY, which
// wins over the system from then on. Nothing removes the key: there is no way back to following the system.

public enum Theme: String, Codable, CaseIterable, Sendable {
    case light, dark
}

/// The preference key: UserDefaults on iOS, as localStorage on the web.
public let THEME_KEY = "truthy.theme"

/// "light" or "dark", or nil for anything else (no choice, or a value this build does not know).
public func parseTheme(_ value: String?) -> Theme? {
    switch value {
    case "light": .light
    case "dark": .dark
    default: nil
    }
}

public func oppositeTheme(_ theme: Theme) -> Theme {
    theme == .dark ? .light : .dark
}

/// A choice wins over the system setting; without one the system decides.
public func resolveTheme(_ choice: Theme?, _ systemDark: Bool) -> Theme {
    choice ?? (systemDark ? .dark : .light)
}

/// The flip rule of the web's switchTheme: the opposite of the theme visible now. The caller shows it and stores
/// it under THEME_KEY; the theme flips on screen even when storing fails.
public func switchTheme(_ choice: Theme?, _ systemDark: Bool) -> Theme {
    oppositeTheme(resolveTheme(choice, systemDark))
}
```

- [ ] **Step 23: Run the tests and see them pass.**

```bash
swift test --package-path ios/TruthyEngine
```

Expected: `Test run with 49 tests in 8 suites passed after ... with 1 known issue`, `everyGoldenFileHasATest()` still skipped.

- [ ] **Step 24: Commit.**

```bash
git add ios/TruthyEngine/Sources/TruthyEngine/Format.swift ios/TruthyEngine/Sources/TruthyEngine/Logo.swift ios/TruthyEngine/Sources/TruthyEngine/Theme.swift ios/TruthyEngine/Tests/TruthyEngineTests/SmallHelpersTests.swift
pnpm vitest run tests/repo-hygiene.test.ts
git commit -m "feat: port pad2, the logo mark height and the theme rules"
```

Expected: the hygiene test passes; the commit has four files.

- [ ] **Step 25: Write the purity test.**

`ios/TruthyEngine/Tests/TruthyEngineTests/PurityTests.swift`:

```swift
import Foundation
import Testing

// Spec 4.2, as tests/purity.test.ts does for the web: the engine reaches for no clock, no randomness, no timer
// or scheduler, no file or preference storage and no UI framework. Time and seeds always come in as arguments.

private let forbidden: [(name: String, pattern: String)] = [
    ("the wall clock", #"\b(?:Date|CFAbsoluteTimeGetCurrent|gettimeofday)\b"#),
    ("a monotonic clock", #"\b(?:CACurrentMediaTime|ProcessInfo|DispatchTime|ContinuousClock|SuspendingClock|mach_absolute_time|clock_gettime)\b"#),
    ("randomness", #"\.random(?:Element)?\b|\.shuffle(?:d)?\(|\b(?:SystemRandomNumberGenerator|RandomNumberGenerator|arc4random\w*|SecRandomCopyBytes)\b"#),
    ("a timer or scheduler", #"\b(?:Timer|DispatchQueue|RunLoop|OperationQueue|CADisplayLink)\b|Task\.sleep"#),
    ("storage", #"\b(?:FileManager|FileHandle|UserDefaults|Bundle|NSUbiquitousKeyValueStore)\b|contentsOf:|\.write\(to:"#),
    ("a UI framework", #"(?m)^\s*(?:@\w+\s+)*import\s+(?:SwiftUI|UIKit|AppKit|Combine|QuartzCore)\b"#),
]

/// The code without its comments, so a comment may name what the code must not use.
private func withoutComments(_ source: String) -> String {
    source
        .replacing(try! Regex(#"/\*[\s\S]*?\*/"#), with: "")
        .replacing(try! Regex(#"//[^\n]*"#), with: "")
}

/// Simple word boundaries: with the default Unicode ones, "UserDefaults.standard" is one word and `\b` misses it.
private func findings(in file: String, _ source: String) -> [String] {
    let code = withoutComments(source)
    return forbidden.compactMap { rule in
        code.contains(try! Regex(rule.pattern).wordBoundaryKind(.simple)) ? "\(file) uses \(rule.name)" : nil
    }
}

private let engineDirectory = Golden.root.appending(path: "ios/TruthyEngine/Sources/TruthyEngine")

@Suite struct PurityTests {
    @Test func theScannerIgnoresCommentsAndReadsTheCode() {
        #expect(findings(in: "a.swift", "// never Date() here\nlet a = 1 /* Timer */") == [])
        let planted = """
            import SwiftUI
            @preconcurrency import Combine
            let now = Date().timeIntervalSince1970 + CACurrentMediaTime()
            let pick = [1, 2].randomElement() ?? Int.random(in: 0...1)
            DispatchQueue.main.async { try? await Task.sleep(for: .seconds(1)) }
            let saved = UserDefaults.standard.string(forKey: "k")
            let raw = try Data(contentsOf: url)
            """
        #expect(findings(in: "planted.swift", planted) == [
            "planted.swift uses the wall clock",
            "planted.swift uses a monotonic clock",
            "planted.swift uses randomness",
            "planted.swift uses a timer or scheduler",
            "planted.swift uses storage",
            "planted.swift uses a UI framework",
        ])
    }

    @Test func theScannerAcceptsTheEngineOwnNames() {
        let code = "let rng = createRng(seed)\nlet order = shuffle(items, rng)\nlet updated = Dictionary(uniqueKeysWithValues: pairs)"
        #expect(findings(in: "ok.swift", code) == [])
    }

    @Test func theEngineIsPure() throws {
        let files = try FileManager.default.contentsOfDirectory(atPath: engineDirectory.path(percentEncoded: false))
            .filter { $0.hasSuffix(".swift") }
            .sorted()
        #expect(files.count >= 7)
        var found: [String] = []
        for file in files {
            found += findings(in: file, try String(contentsOf: engineDirectory.appending(path: file), encoding: .utf8))
        }
        #expect(found == [])
    }

    @Test func theEnginePackageHasNoDependencies() throws {
        let manifest = try String(contentsOf: Golden.root.appending(path: "ios/TruthyEngine/Package.swift"), encoding: .utf8)
        #expect(manifest.contains(#".target(name: "TruthyEngine")"#))
        #expect(!manifest.contains(".package("))
    }
}
```

```bash
swift test --package-path ios/TruthyEngine
```

Expected: `Test run with 53 tests in 9 suites passed after ... with 1 known issue`. The scanner tests prove each rule finds its planted use; `theEngineIsPure` scans the seven engine files and finds nothing.

- [ ] **Step 26: Prove the purity test reads the real sources.** Plant a wall clock in a new engine file, run, and remove it:

```bash
printf 'import Foundation\n\nlet plantedNow = Date()\n' > ios/TruthyEngine/Sources/TruthyEngine/Planted.swift
swift test --package-path ios/TruthyEngine
rm ios/TruthyEngine/Sources/TruthyEngine/Planted.swift
swift test --package-path ios/TruthyEngine
```

Expected: the first run fails in `theEngineIsPure()` with `found → ["Planted.swift uses the wall clock"]`; the second run is green again with `Test run with 53 tests in 9 suites passed after ... with 1 known issue`.

- [ ] **Step 27: Commit.**

```bash
git add ios/TruthyEngine/Tests/TruthyEngineTests/PurityTests.swift
pnpm vitest run tests/repo-hygiene.test.ts
git commit -m "test: keep the Swift engine free of clocks, randomness, timers, storage and UI frameworks"
```

Expected: the hygiene test passes; the commit has one file.

- [ ] **Step 28: Run the gates.**

```bash
rm -rf ios/TruthyEngine/.build
swift build --package-path ios/TruthyEngine
swift test --package-path ios/TruthyEngine
pnpm test
git status --short
```

Expected: `swift build` ends with `Build complete!` and no warning; `swift test` ends with `Test run with 53 tests in 9 suites passed after ... with 1 known issue` and lists `everyGoldenFileHasATest()` as skipped (task 6 turns it on); `pnpm test` has no failed file (`tests/repo-hygiene.test.ts` scans the 21 new files: no local path, e-mail-shaped string, em dash or secret); `git status --short` prints nothing.

**Tried (while this plan was written; `native-data/` did not exist yet).** Every file above was put, exactly as shown, into a scratch Swift package laid out like the repository (`ios/TruthyEngine` next to a `native-data` folder), with Swift 6.3.3 from Xcode 26.6, and `swift build` and `swift test` ran there. The fixtures standing in for `native-data`: nine golden files in plan A's format, computed by running the web's own `createRng`, `shuffle`, `pad2`, `LogoMark`, `parseTheme`, `oppositeTheme`, `resolveTheme` and `THEME_KEY` (and the flip rule of `switchTheme`) through `tsx` against this repository's sources, and the 54 deck files and the index written by the web's `buildDecks` from `content/` (4 areas, 54 decks, 285 sections, 7378 cards). Observed: the failure of step 3 with the two lines quoted; the compile errors of steps 8, 13 and 21; the counts of steps 5, 10, 15, 17, 23 and 25; step 18's failure with `61` changed to `62` (`RngTests` 4 issues, `RngGoldenTests` 13); step 26's planted finding; no compiler warning in a clean build. What runs only once plan A's real `native-data` exists: `RngGoldenTests`, the seven golden tests of `SmallHelpersTests` and `ShippedDecksTests` ran here against the fixtures and run against the real files at execution; `everyGoldenFileIsWellFormed` covered only the nine fixture files here and reads every file of plan A at execution. The golden file names and case shapes in the table above come from plan A task 4 as it was being written; if the committed files differ, step 1 or step 17 stops the task. After that run, the review fix pass of 2026-10-15 changed the test support: the optional accessors became `stringValue`, `numberValue` and `arrayValue`, `GoldenError` became a struct, `GoldenReaders.swift` was added, `Golden.fileName` learned plan A's one exception (`src.engine.deal.DEAL.constant.json`), and the purity test's storage rule grew; the README's drafting record says which of these changes were compiled again.
