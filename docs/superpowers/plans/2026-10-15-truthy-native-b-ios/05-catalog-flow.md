### Task 5: Content helpers, the class table, the catalog, the start-flow steps, the list cue and the two labels

This task ports the pure helpers the start flow stands on, line by line from the web, into the engine package: the route and text helpers of `src/content/schema.ts`, `load.ts` and `text.ts`, the class table of `src/app-state/modes.ts`, the catalog helpers of `components/start/useCatalog.ts` (deck counts, the owner of a card, the seen percentage, the Continue target, the Recent list, pruning removed cards), the step helpers of `components/start/StartFlow.tsx` (the step of a choice, clearing, the path, the previous step, the card that takes focus, whether a remembered step can still show), the list fade cue of `components/start/listCue.ts`, and the two accessible names `changeLabel` (`components/FillInPass.tsx`) and `continueLabel` (`components/start/ContinueLine.tsx`). Tasks 11 and 12 build the start flow on these; task 11 prunes the played decks with `withoutRemovedCards` when the start screen loads, and task 9's `FileProgressStore.prunedForRound` prunes the round's deck with `pruneDeck`; task 6's `ticketFor` uses `deckPassName` and `modeInfo`.

Each module gets a unit suite with the cases the web tests pin (reference 3.6 to 3.8) and a golden suite that runs every case of the 31 vector files plan A task 7 wrote for these modules. The purity test of task 1 scans the six new engine files.

Builds on task 1 (content types, `WHOLE_DECK`, `MODES`, `Mode`, `jsRound`, the golden loader), task 4 (`Progress`, `LastRound`, `pruneDeck`, `seenShare`, and the test helper `ProgressGolden` in `Tests/TruthyEngineTests/Golden/GoldenProgress.swift`). It uses nothing of tasks 2 and 3.

**Files:**
- Create: `ios/TruthyEngine/Sources/TruthyEngine/ContentHelpers.swift`, `Modes.swift`, `Catalog.swift`, `StartSteps.swift`, `ListCue.swift`, `Labels.swift` (all in `ios/TruthyEngine/Sources/TruthyEngine/`)
- Test: create `ContentHelpersTests.swift`, `ModeTableTests.swift`, `CatalogTests.swift`, `StartStepsTests.swift`, `ListCueTests.swift`, `LabelsTests.swift`, `ContentGoldenTests.swift`, `ModesGoldenTests.swift`, `CatalogGoldenTests.swift`, `StartStepsGoldenTests.swift`, `ListCueGoldenTests.swift`, `LabelsGoldenTests.swift` (all in `ios/TruthyEngine/Tests/TruthyEngineTests/`)

**Interfaces:**
- Consumes, from task 1: `Card`, `DeckFile`, `DeckIndex`, `IndexArea`, `IndexPlatform`, `IndexDeck`, `IndexSection`, `Route`, `WHOLE_DECK`, `Mode`, `jsRound` (internal); test support `Golden.load`, `GoldenFile.decode`, `GoldenValue` with `number()`, `int()`, `bool()`, `string()`, `array()`, `GoldenError`.
- Consumes, from task 4: `Progress(version:cards:records:last:)`, `LastRound`, `emptyProgress()`, `pruneDeck(_:_:_:)`, `seenShare(_:_:)`; test support `ProgressGolden.progress(_:)`, `ProgressGolden.required(_:_:)`.
- Consumes, from plan A task 7 (`native-data/golden`), 31 files: `src.content.schema.WHOLE_DECK.json`, `src.content.schema.routeKey.json`, `.deckPassName.json`, `.findRoute.json`; `src.content.load.poolFor.json`; `src.content.text.textParts.json`, `.plainText.json`; `src.app-state.modes.MODE_TABLE.json`, `.modeInfo.json`, `.isOffered.json`, `.lastScoreText.json`; `components.start.useCatalog.deckCount.json`, `.decksLabel.json`, `.deckOfCard.json`, `.seenPercent.json`, `.continueTarget.json`, `.recentDecks.json`, `.RECENT_LIMIT.json`, `.withoutRemovedCards.json`; `components.start.StartFlow.STEP_OF.json`, `.stepOf.json`, `.clearFrom.json`, `.pathTo.json`, `.previousStep.json`, `.chosenOn.json`, `.canShow.json`; `components.start.listCue.FADE_PX.json`, `.listCue.json`, `.revealDelta.json`; `components.FillInPass.changeLabel.json`; `components.start.ContinueLine.continueLabel.json`. Their shapes are plan A task 7's rules 4 to 7: a closed class is the `modeTable` key of a case; `findRoute` and the `found` of `continueTarget` are projected to `{areaId, platformId, deckId, sectionId}` (`sectionId` null for the whole deck); a recent deck to `{areaId, platformId, deckId, lastSeenAt}`; `withoutRemovedCards` answers `{progress, saved}`; `deckOfCard`'s `deckIds` is a list; `continueLabel` takes `{props}`; an argument left out is an absent key. Constants are `<module>.<NAME>.json` like functions (plan A's one exception, `src.engine.deal.DEAL.constant.json`, is task 2's).
- Produces (public, `TruthyEngine`):

```swift
// ContentHelpers.swift
public func deckPassName(_ platform: IndexPlatform, _ deck: IndexDeck) -> String
public func routeKey(_ route: Route) -> String
public struct RouteInIndex: Equatable, Sendable { public let area: IndexArea; public let platform: IndexPlatform; public let deck: IndexDeck; public let section: IndexSection? }
public func findRoute(_ index: DeckIndex, _ route: Route) -> RouteInIndex?
public func poolFor(_ deck: DeckFile, _ sectionId: String) -> [Card]
public struct TextPart: Codable, Equatable, Sendable { public let text: String; public let code: Bool }
public func textParts(_ text: String) -> [TextPart]
public func plainText(_ text: String) -> String

// Modes.swift
public struct ModeInfo: Codable, Equatable, Sendable { public let id: Mode; public let name: String; public let description: String; public let unit: String; public var offered: Bool }
public let MODE_TABLE: [ModeInfo]
public func modeInfo(_ mode: Mode, _ table: [ModeInfo] = MODE_TABLE) -> ModeInfo
public func isOffered(_ mode: Mode, _ table: [ModeInfo] = MODE_TABLE) -> Bool
public func lastScoreText(_ mode: Mode, _ score: Int, _ total: Int) -> String

// Catalog.swift
public func deckCount(_ area: IndexArea) -> Int
public func deckCount(_ platform: IndexPlatform) -> Int
public func decksLabel(_ count: Int) -> String
public func deckOfCard(_ cardId: String, _ deckIds: Set<String>) -> String?
public func seenPercent(_ progress: Progress, _ deck: (id: String, cardCount: Int), _ cardIds: [String]? = nil) -> Int
public struct LastScore: Equatable, Sendable { public let score: Int; public let total: Int }
public struct ContinueTarget: Equatable, Sendable { public let route: Route; public let mode: Mode; public let found: RouteInIndex; public let lastScore: LastScore? }
public func continueTarget(_ index: DeckIndex, _ progress: Progress, _ table: [ModeInfo] = MODE_TABLE) -> ContinueTarget?
public struct RecentDeck: Equatable, Sendable { public let area: IndexArea; public let platform: IndexPlatform; public let deck: IndexDeck; public let lastSeenAt: Double }
public let RECENT_LIMIT: Int                                   // 4
public func recentDecks(_ index: DeckIndex, _ progress: Progress, _ limit: Int = RECENT_LIMIT) -> [RecentDeck]
public func withoutRemovedCards(_ progress: Progress, _ cardIds: [String: [String]], _ save: (Progress) -> Void) -> Progress

// StartSteps.swift
public typealias Step = Int                                    // 1 to 6
public let RECENT: String                                      // "recent"
public enum ChoiceKey: String, CaseIterable, Codable, Sendable { case via, areaId, platformId, deckId, sectionId, mode }
public struct Choice: Codable, Hashable, Sendable { public var via: String?; public var areaId: String?; public var platformId: String?; public var deckId: String?; public var sectionId: String?; public var mode: Mode?; public subscript(key: ChoiceKey) -> String? { get } }
public let STEP_OF: [ChoiceKey: Step]
public func stepOf(_ key: ChoiceKey, _ choice: Choice) -> Step
public func clearFrom(_ choice: Choice, _ step: Step) -> Choice
public func pathTo(_ step: Step, _ hasSections: Bool, _ recent: Bool = false) -> [Step]
public func previousStep(_ step: Step, _ hasSections: Bool, _ recent: Bool = false) -> Step
public func chosenOn(_ target: Step, _ choice: Choice) -> String?
public func canShow(_ index: DeckIndex, _ step: Step, _ choice: Choice, _ table: [ModeInfo] = MODE_TABLE) -> Bool

// ListCue.swift
public let FADE_PX: Double                                     // 28
public struct ItemSpan: Codable, Equatable, Sendable { public let top: Double; public let bottom: Double }
public struct ListCue: Equatable, Sendable { public let more: Bool; public let lift: Double }
public func listCue(_ viewHeight: Double, _ contentBottom: Double, _ items: [ItemSpan]) -> ListCue
public func revealDelta(_ viewHeight: Double, _ item: ItemSpan, _ room: Double) -> Double

// Labels.swift
public enum PassFieldName: String, Codable, CaseIterable, Sendable { case area, platform, deck, section, mode }
public func changeLabel(_ field: PassFieldName, _ value: String) -> String
public struct ContinueLabelProps: Equatable, Sendable { public var deckName: String; public var sectionTitle: String; public var modeLabel: String; public var lastScore: String?; public var needsConnection: Bool }
public func continueLabel(_ props: ContinueLabelProps) -> String
```

  Every struct has a public memberwise initialiser in property order. Task 7's `EngineNames.swift` names `Choice` `StartChoice` for the app.

**Rules:**

1. **The class table is a parameter where the web reads a module constant.** The web closes a class by flipping `offered` in `MODE_TABLE`; plan A's vectors carry the table as it stood in the case's `modeTable`. So `modeInfo`, `isOffered`, `continueTarget` and `canShow` take the table as a trailing argument that defaults to `MODE_TABLE`; a golden case with `modeTable` passes it, a case without passes nothing. `MODE_TABLE` is a `let`: nothing mutates it.
2. **An unknown class cannot be built.** `Mode` has four cases, so `modeInfo` cannot be handed `"blitz"`; it does not throw. A golden case whose `mode` is not a `Mode` checks that the vector holds `{"$throws": "Unknown mode \"<mode>\"."}`, as task 3 does for `startRound`. A choice in a vector whose `mode` is not a `Mode` (the `canShow` case "step 6 with a class that does not exist" passes `"zen"`, a stale web history entry) is decoded without its mode: the web's `resolve` finds no row for it, as for no class, so `canShow` answers as the web does.
3. **Strings are compared as the web compares them.** Ids are ASCII, so `==` is fine for them. Prefix tests (`deckOfCard`, the fallback of `seenPercent`) and `textParts` work on UTF-16 code units (`utf16`), as `startsWith`, `lastIndexOf` and `slice` do. `textParts` scans the regular expression `` /`([^`]+)`/g `` left to right exactly as `matchAll` does: at a backtick it takes the shortest run of other units up to the next backtick when that run is not empty, otherwise it moves on one unit.
4. **Sorting and maxima.** `recentDecks` sorts newest first with an index tiebreak (equal times keep catalog order, as the stable `Array.sort` does) and takes a deck's time with `Math.max` semantics (`NaN` wins, `+0` beats `-0`), then cuts with `slice(0, limit)` semantics (a negative limit counts from the end).
5. **`seenPercent`** is `min(100, max(1, jsRound(share * 100)))` for any share above 0 and 0 otherwise; `0.29 * 100` is `28.999999999999996` and rounds to 29, as in JavaScript.
6. **`withoutRemovedCards`** calls `save` only when the number of card entries changed (reference 3.6, start-screen prune). The app's store is asynchronous, so the function takes the save as a closure: the app passes one that records the pruned progress and saves it after (task 11).
7. **Steps are numbers.** `Step` is an `Int` from 1 to 6, as the TypeScript's `1 | 2 | 3 | 4 | 5 | 6`; `pathTo` and `previousStep` return the same numbers the web does.
8. **Purity.** The six files import nothing. Task 1's purity test scans them.

**Review focus.** None of the README's five lines belongs to this task. What a reviewer should check: `textParts` against `src/content/text.ts` on the empty pair and the run of three and four backticks; `canShow` against `StartFlow.tsx:172-185` in the order of its checks; `recentDecks` keeps catalog order for equal times.

**Steps:**

- [ ] **Step 1: Check the starting point.**

```bash
git status --short
for f in src.content.schema.WHOLE_DECK src.content.schema.routeKey src.content.schema.deckPassName src.content.schema.findRoute src.content.load.poolFor src.content.text.textParts src.content.text.plainText src.app-state.modes.MODE_TABLE src.app-state.modes.modeInfo src.app-state.modes.isOffered src.app-state.modes.lastScoreText components.start.useCatalog.deckCount components.start.useCatalog.decksLabel components.start.useCatalog.deckOfCard components.start.useCatalog.seenPercent components.start.useCatalog.continueTarget components.start.useCatalog.recentDecks components.start.useCatalog.RECENT_LIMIT components.start.useCatalog.withoutRemovedCards components.start.StartFlow.STEP_OF components.start.StartFlow.stepOf components.start.StartFlow.clearFrom components.start.StartFlow.pathTo components.start.StartFlow.previousStep components.start.StartFlow.chosenOn components.start.StartFlow.canShow components.start.listCue.FADE_PX components.start.listCue.listCue components.start.listCue.revealDelta components.FillInPass.changeLabel components.start.ContinueLine.continueLabel; do test -f "native-data/golden/$f.json" || echo "missing $f"; done
swift test --package-path ios/TruthyEngine 2>&1 | tail -1
```

Expected: nothing from `git status --short`; no `missing` line; `Test run with 238 tests in 23 suites passed after ... with 1 known issue` (task 4's end). A missing file means plan A task 7 named it otherwise: stop and report.

- [ ] **Step 2: Write the unit tests of the content helpers and the class table.**

`ios/TruthyEngine/Tests/TruthyEngineTests/ContentHelpersTests.swift`:

```swift
import Testing
@testable import TruthyEngine

// The pinned cases of tests/content/schema.test.ts, schema-polish.test.ts, load.test.ts and text.test.ts.
private func deck(_ id: String, _ sections: [String], passName: String? = nil) -> IndexDeck {
    IndexDeck(id: id, code: String(id.prefix(3)).uppercased(), title: "Title \(id)", passName: passName, cardCount: 10,
              version: "2026-10-01", hash: "h", sections: sections.map { IndexSection(id: $0, title: "Section \($0)", cardCount: 5) })
}

private let index = DeckIndex(areas: [
    IndexArea(id: "cloud", title: "Cloud", platforms: [
        IndexPlatform(id: "aws", title: "AWS", decks: [deck("aws-clf-c02", ["CON", "SEC"])]),
        IndexPlatform(id: "gcp", title: "Google Cloud", decks: [deck("gcp-cdl", [], passName: "Google Cloud Digital Leader")]),
    ]),
    IndexArea(id: "frontend", title: "Frontend", platforms: [
        IndexPlatform(id: "nextjs", title: "Next.js", decks: [deck("nextjs-rendering", ["RSC"])]),
    ]),
])

private func card(_ id: String, _ section: String) -> Card {
    Card(id: id, section: section, text: CardText(en: CardTextEn(statement: "S \(id)", explanation: "E \(id)")), answer: true,
         source: CardSource(title: "Docs", url: "https://docs.aws.amazon.com/"), difficulty: 1, appliesTo: "", conflictGroups: [])
}

@Suite struct ContentHelpersTests {
    @Test func namesARouteAndADeckOnThePass() {
        #expect(routeKey(Route(deckId: "aws-clf-c02", sectionId: "SEC")) == "aws-clf-c02/SEC")
        #expect(routeKey(Route(deckId: "nextjs-rendering", sectionId: WHOLE_DECK)) == "nextjs-rendering/ALL")
        let aws = index.areas[0].platforms[0]
        let gcp = index.areas[0].platforms[1]
        #expect(deckPassName(aws, aws.decks[0]) == "AWS Title aws-clf-c02")
        #expect(deckPassName(gcp, gcp.decks[0]) == "Google Cloud Digital Leader")
    }

    @Test func findsARouteByDeckThenSection() {
        let sec = findRoute(index, Route(deckId: "aws-clf-c02", sectionId: "SEC"))
        #expect(sec?.area.id == "cloud" && sec?.platform.id == "aws" && sec?.section?.id == "SEC")
        #expect(findRoute(index, Route(deckId: "gcp-cdl", sectionId: WHOLE_DECK))?.section == nil)
        #expect(findRoute(index, Route(deckId: "gcp-cdl", sectionId: WHOLE_DECK))?.deck.id == "gcp-cdl")
        #expect(findRoute(index, Route(deckId: "nextjs-rendering", sectionId: "RSC"))?.area.id == "frontend")
        #expect(findRoute(index, Route(deckId: "aws-saa-c03", sectionId: WHOLE_DECK)) == nil)
        #expect(findRoute(index, Route(deckId: "aws-clf-c02", sectionId: "OLD")) == nil)
        #expect(findRoute(index, Route(deckId: "aws-clf-c02", sectionId: "sec")) == nil)
        #expect(findRoute(index, Route(deckId: "gcp-cdl", sectionId: "SEC")) == nil)
    }

    @Test func dealsFromTheSectionInFileOrderOrTheWholeDeck() {
        let file = DeckFile(id: "aws-clf", hash: "h1", cards: [card("aws-clf-001", "S01"), card("aws-clf-002", "S02"), card("aws-clf-003", "S01")])
        #expect(poolFor(file, "S01").map(\.id) == ["aws-clf-001", "aws-clf-003"])
        #expect(poolFor(file, WHOLE_DECK).map(\.id) == ["aws-clf-001", "aws-clf-002", "aws-clf-003"])
        #expect(poolFor(file, "S99").isEmpty)
        #expect(poolFor(file, "s01").isEmpty)
    }

    @Test func splitsTextIntoPlainAndCodeParts() {
        #expect(textParts("AWS patches the host.") == [TextPart(text: "AWS patches the host.", code: false)])
        #expect(textParts("An `asserts x is string` function narrows `x` after a call.") == [
            TextPart(text: "An ", code: false), TextPart(text: "asserts x is string", code: true),
            TextPart(text: " function narrows ", code: false), TextPart(text: "x", code: true), TextPart(text: " after a call.", code: false),
        ])
        #expect(textParts("`a``b`") == [TextPart(text: "a", code: true), TextPart(text: "b", code: true)])
        #expect(textParts("one ` two") == [TextPart(text: "one ", code: false), TextPart(text: "`", code: true), TextPart(text: " two", code: false)])
        #expect(textParts("a `` b") == [
            TextPart(text: "a ", code: false), TextPart(text: "`", code: true), TextPart(text: "`", code: true), TextPart(text: " b", code: false),
        ])
        #expect(textParts("a ``` b").filter(\.code).count == 3)
        #expect(textParts("") == [])
        #expect(textParts("`") == [TextPart(text: "`", code: true)])
    }

    @Test func readsCodeWithoutItsBackticks() {
        #expect(plainText("An `asserts x is string` function narrows `x` after a call.") == "An asserts x is string function narrows x after a call.")
        #expect(plainText("one ` two") == "one ` two")
        #expect(plainText("Käse `ß` 😀 ende") == "Käse ß 😀 ende")
    }

    @Test func keepsAFragmentAcrossALineBreakAndAroundAnEmoji() {
        #expect(textParts("`line one\nline two` after") == [TextPart(text: "line one\nline two", code: true), TextPart(text: " after", code: false)])
        #expect(textParts("😀`x`😀") == [TextPart(text: "😀", code: false), TextPart(text: "x", code: true), TextPart(text: "😀", code: false)])
    }
}
```

`ios/TruthyEngine/Tests/TruthyEngineTests/ModeTableTests.swift`:

```swift
import Testing
@testable import TruthyEngine

// tests/app-state/modes.test.ts, modes-polish.test.ts and the copy of modes-score-copy-polish.test.ts.
@Suite struct ModeTableTests {
    @Test func theTableIsTheWebsWordForWord() {
        #expect(MODE_TABLE == [
            ModeInfo(id: .classic, name: "Classic", description: "Correct answers out of 10 cards.", unit: "of 10", offered: true),
            ModeInfo(id: .streak, name: "Streak", description: "Correct answers in a row, until the first wrong one.", unit: "in a row", offered: true),
            ModeInfo(id: .lives, name: "Three lives", description: "Cards answered until the third wrong one.", unit: "cards", offered: true),
            ModeInfo(id: .timed, name: "Timed", description: "Correct answers in one minute, wrong ones cost nothing.", unit: "correct", offered: true),
        ])
        #expect(MODE_TABLE.map(\.id) == MODES)
    }

    @Test func findsTheRowOfEachClassAndOffersAll() {
        for mode in Mode.allCases {
            #expect(modeInfo(mode).id == mode)
            #expect(isOffered(mode))
        }
    }

    @Test func aClosedClassIsNotOfferedInTheTableGiven() {
        let closed = MODE_TABLE.map { row in var row = row; row.offered = row.id != .timed; return row }
        #expect(!isOffered(.timed, closed))
        #expect(isOffered(.classic, closed))
        #expect(isOffered(.timed))
    }

    @Test func saysTheLastScoreAsTheContinueLineDoes() {
        #expect(lastScoreText(.classic, 7, 10) == "7 of 10")
        #expect(lastScoreText(.classic, 5, 7) == "5 of 7")
        #expect(lastScoreText(.streak, 13, 14) == "13 in a row")
        #expect(lastScoreText(.streak, 1, 2) == "1 in a row")
        #expect(lastScoreText(.lives, 21, 21) == "21 cards")
        #expect(lastScoreText(.timed, 14, 17) == "14 correct")
        #expect(lastScoreText(.timed, 0, 0) == "0 correct")
    }
}
```

- [ ] **Step 3: Write the unit tests of the catalog, the steps, the list cue and the labels.**

`ios/TruthyEngine/Tests/TruthyEngineTests/CatalogTests.swift`:

```swift
import Testing
@testable import TruthyEngine

// tests/components/start/useCatalog.test.tsx and unoffered.test.tsx, the pure helpers.
private func deck(_ id: String, _ cardCount: Int = 10) -> IndexDeck {
    IndexDeck(id: id, code: String(id.prefix(3)).uppercased(), title: id, passName: nil, cardCount: cardCount, version: "v", hash: "h", sections: [])
}

private let index = DeckIndex(areas: [
    IndexArea(id: "cloud", title: "Cloud", platforms: [
        IndexPlatform(id: "aws", title: "AWS", decks: [deck("aws-clf-c02"), deck("aws-saa-c03")]),
        IndexPlatform(id: "gcp", title: "Google Cloud", decks: [deck("gcp-cdl"), deck("gcp-cdl-pro")]),
        IndexPlatform(id: "azure", title: "Azure", decks: []),
    ]),
    IndexArea(id: "devops", title: "DevOps", platforms: []),
])

private func seen(_ ids: [String: Double]) -> Progress {
    Progress(version: 1, cards: ids.mapValues { CardHistory(seen: 1, lastCorrect: true, lastSeenAt: $0) }, records: [:], last: nil)
}

@Suite struct CatalogTests {
    @Test func countsDecksAndSaysHowMany() {
        #expect(deckCount(index.areas[0]) == 4)
        #expect(deckCount(index.areas[0].platforms[2]) == 0)
        #expect(deckCount(index.areas[1]) == 0)
        #expect(decksLabel(0) == "No decks yet")
        #expect(decksLabel(1) == "1 deck")
        #expect(decksLabel(54) == "54 decks")
    }

    @Test func aCardBelongsToTheDeckOfItsLongestPrefix() {
        let ids: Set<String> = ["gcp-cdl", "gcp-cdl-pro", "aws-clf-c02"]
        #expect(deckOfCard("gcp-cdl-s1.1-01", ids) == "gcp-cdl")
        #expect(deckOfCard("gcp-cdl-pro-1", ids) == "gcp-cdl-pro")
        #expect(deckOfCard("aws-clf-c02-t1.1-01", ids) == "aws-clf-c02")
        #expect(deckOfCard("azure-1", ids) == nil)
        #expect(deckOfCard("gcp", ids) == nil)
        #expect(deckOfCard("-gcp-cdl", ids) == nil)
    }

    @Test func seenPercentRoundsHalfUpAndNeverReadsZeroWhenSomethingWasSeen() {
        let ids = (1...100).map { "d-\($0)" }
        let some = seen(Dictionary(uniqueKeysWithValues: ids.prefix(29).map { ($0, 1.0) }))
        #expect(seenPercent(some, (id: "d", cardCount: 100), ids) == 29)
        #expect(seenPercent(seen(["d-1": 1]), (id: "d", cardCount: 1000), (1...1000).map { "d-\($0)" }) == 1)
        #expect(seenPercent(emptyProgress(), (id: "d", cardCount: 100), ids) == 0)
        #expect(seenPercent(seen(Dictionary(uniqueKeysWithValues: ids.map { ($0, 1.0) })), (id: "d", cardCount: 100), ids) == 100)
        // Without the deck's ids: the prefix count over the card count, capped at 100.
        #expect(seenPercent(seen(["d-1": 1, "d-2": 1, "dx-1": 1]), (id: "d", cardCount: 4)) == 50)
        #expect(seenPercent(seen(["d-1": 1, "d-2": 1]), (id: "d", cardCount: 1)) == 100)
        #expect(seenPercent(seen(["d-1": 1]), (id: "d", cardCount: 0)) == 0)
    }

    @Test func continueLeadsToTheLastRouteWhileItCanBePlayed() {
        let last = LastRound(route: Route(deckId: "aws-clf-c02", sectionId: WHOLE_DECK), mode: .classic, score: 7, total: 10)
        let progress = Progress(version: 1, cards: [:], records: [:], last: last)
        let target = continueTarget(index, progress)
        #expect(target?.route == last.route && target?.mode == .classic && target?.lastScore == LastScore(score: 7, total: 10))
        #expect(target?.found.platform.id == "aws")
        let left = Progress(version: 1, cards: [:], records: [:], last: LastRound(route: last.route, mode: .timed, score: nil, total: nil))
        #expect(continueTarget(index, left)?.lastScore == nil)
        let closed = MODE_TABLE.map { row in var row = row; row.offered = row.id != .timed; return row }
        #expect(continueTarget(index, left, closed) == nil)
        #expect(continueTarget(index, emptyProgress()) == nil)
        let gone = Progress(version: 1, cards: [:], records: [:], last: LastRound(route: Route(deckId: "gone", sectionId: "ALL"), mode: .classic, score: 1, total: 2))
        #expect(continueTarget(index, gone) == nil)
    }

    @Test func recentListsTheDecksPlayedLastNewestFirstAndKeepsCatalogOrderOnTies() {
        let progress = seen([
            "aws-clf-c02-1": 100, "aws-clf-c02-2": 300, "gcp-cdl-1": 200, "gcp-cdl-pro-1": 300, "aws-saa-c03-1": 50, "unknown-1": 999,
        ])
        #expect(recentDecks(index, progress).map(\.deck.id) == ["aws-clf-c02", "gcp-cdl-pro", "gcp-cdl", "aws-saa-c03"])
        #expect(recentDecks(index, progress).first?.lastSeenAt == 300)
        #expect(recentDecks(index, progress, 2).map(\.deck.id) == ["aws-clf-c02", "gcp-cdl-pro"])
        #expect(recentDecks(index, emptyProgress()).isEmpty)
        #expect(RECENT_LIMIT == 4)
    }

    @Test func pruningSavesOnlyWhenACardWasDropped() {
        let progress = seen(["aws-clf-c02-1": 1, "aws-clf-c02-old": 1, "gcp-cdl-1": 1])
        var saved: [Progress] = []
        let pruned = withoutRemovedCards(progress, ["aws-clf-c02": ["aws-clf-c02-1"]]) { saved.append($0) }
        #expect(Set(pruned.cards.keys) == ["aws-clf-c02-1", "gcp-cdl-1"])
        #expect(saved == [pruned])
        saved = []
        #expect(withoutRemovedCards(pruned, ["aws-clf-c02": ["aws-clf-c02-1"]]) { saved.append($0) } == pruned)
        #expect(saved.isEmpty)
    }
}
```

`ios/TruthyEngine/Tests/TruthyEngineTests/StartStepsTests.swift`:

```swift
import Testing
@testable import TruthyEngine

// The "steps (pure)" block of tests/components/start/StartFlow.test.tsx and unoffered.test.tsx.
private let index = DeckIndex(areas: [
    IndexArea(id: "cloud", title: "Cloud", platforms: [
        IndexPlatform(id: "aws", title: "AWS", decks: [
            IndexDeck(id: "aws-clf-c02", code: "CLF", title: "Cloud Practitioner", passName: nil, cardCount: 92, version: "v", hash: "h",
                      sections: [IndexSection(id: "CON", title: "Cloud concepts", cardCount: 45), IndexSection(id: "SEC", title: "Security and compliance", cardCount: 47)]),
        ]),
        IndexPlatform(id: "gcp", title: "Google Cloud", decks: [
            IndexDeck(id: "gcp-cdl", code: "CDL", title: "Cloud Digital Leader", passName: "Google Cloud Digital Leader", cardCount: 133, version: "v", hash: "h", sections: []),
        ]),
    ]),
])

private let full = Choice(areaId: "cloud", platformId: "aws", deckId: "aws-clf-c02", sectionId: "SEC", mode: .classic)

@Suite struct StartStepsTests {
    @Test func onTheRecentPathTheAreaAndPlatformComeWithTheDeck() {
        #expect(STEP_OF == [.via: 1, .areaId: 1, .platformId: 2, .deckId: 3, .sectionId: 4, .mode: 5])
        #expect(stepOf(.areaId, Choice()) == 1)
        #expect(stepOf(.platformId, Choice()) == 2)
        #expect(stepOf(.areaId, Choice(via: RECENT)) == 3)
        #expect(stepOf(.platformId, Choice(via: RECENT)) == 3)
        #expect(stepOf(.deckId, Choice(via: RECENT)) == 3)
        #expect(stepOf(.via, Choice(via: RECENT)) == 1)
    }

    @Test func goingBackToAStepClearsItAndEverythingAfter() {
        #expect(clearFrom(full, 6) == full)
        #expect(clearFrom(full, 4) == Choice(areaId: "cloud", platformId: "aws", deckId: "aws-clf-c02"))
        #expect(clearFrom(full, 2) == Choice(areaId: "cloud"))
        #expect(clearFrom(full, 1) == Choice())
        var recent = full
        recent.via = RECENT
        #expect(clearFrom(recent, 3) == Choice(via: RECENT))
        #expect(clearFrom(recent, 4) == Choice(via: RECENT, areaId: "cloud", platformId: "aws", deckId: "aws-clf-c02"))
    }

    @Test func thePathSkipsTheSectionStepWithoutSectionsAndThePlatformStepOnTheRecentPath() {
        #expect(pathTo(6, true) == [1, 2, 3, 4, 5, 6])
        #expect(pathTo(6, false) == [1, 2, 3, 5, 6])
        #expect(pathTo(5, true, true) == [1, 3, 4, 5])
        #expect(pathTo(1, true) == [1])
        #expect(previousStep(5, false) == 3)
        #expect(previousStep(5, true) == 4)
        #expect(previousStep(3, true, true) == 1)
        #expect(previousStep(1, true) == 1)
    }

    @Test func theCardChosenOnAStepTakesFocusOnTheWayBack() {
        #expect(chosenOn(1, full) == "cloud")
        #expect(chosenOn(3, full) == "aws-clf-c02")
        #expect(chosenOn(5, full) == "classic")
        #expect(chosenOn(6, full) == nil)
        #expect(chosenOn(1, Choice(via: RECENT, areaId: "cloud")) == RECENT)
        #expect(chosenOn(2, Choice()) == nil)
    }

    @Test func aRememberedStepShowsOnlyWhileItsChoicesExist() {
        #expect(canShow(index, 6, full))
        #expect(canShow(index, 1, Choice()))
        #expect(!canShow(index, 2, Choice()))
        #expect(!canShow(index, 2, Choice(via: RECENT, areaId: "cloud")))
        #expect(canShow(index, 3, Choice(via: RECENT)))
        #expect(!canShow(index, 4, Choice(areaId: "cloud", platformId: "gcp", deckId: "gcp-cdl")))
        #expect(canShow(index, 5, Choice(areaId: "cloud", platformId: "gcp", deckId: "gcp-cdl", sectionId: WHOLE_DECK)))
        #expect(!canShow(index, 5, Choice(areaId: "cloud", platformId: "aws", deckId: "aws-clf-c02", sectionId: "OLD")))
        #expect(!canShow(index, 3, Choice(areaId: "cloud", platformId: "gone")))
        let closed = MODE_TABLE.map { row in var row = row; row.offered = row.id != .timed; return row }
        var timed = full
        timed.mode = .timed
        #expect(!canShow(index, 6, timed, closed))
        #expect(canShow(index, 5, timed, closed))
        #expect(full[.mode] == "classic" && full[.via] == nil)
    }
}
```

`ios/TruthyEngine/Tests/TruthyEngineTests/ListCueTests.swift`:

```swift
import Testing
@testable import TruthyEngine

// tests/components/start/listCue.test.tsx, the pure functions.
private func items(_ spans: [(Double, Double)]) -> [ItemSpan] { spans.map { ItemSpan(top: $0.0, bottom: $0.1) } }

@Suite struct ListCueTests {
    @Test func theFadeEndsOverACardWhereverTheFoldFalls() {
        let cards = items([(0, 100), (110, 210), (220, 320)])
        #expect(FADE_PX == 28)
        #expect(listCue(400, 320, cards) == ListCue(more: false, lift: 0))
        #expect(listCue(319, 320, cards) == ListCue(more: false, lift: 0))
        #expect(listCue(250, 320, cards) == ListCue(more: true, lift: 0))          // the fold cuts 30 of the third card
        #expect(listCue(215, 320, cards) == ListCue(more: true, lift: 5))          // in the gap: at the bottom of the card above
        #expect(listCue(234, 320, cards) == ListCue(more: true, lift: 24 * 0.5))   // 14 of 28 shown: halfway
        #expect(listCue(50, 320, cards) == ListCue(more: true, lift: 0))
        #expect(listCue(250, 320, []) == ListCue(more: true, lift: 0))
    }

    @Test func aCardScrollsIntoViewWithRoomForTheFade() {
        #expect(revealDelta(300, ItemSpan(top: 100, bottom: 200), 4) == 0)
        #expect(revealDelta(300, ItemSpan(top: -20, bottom: 80), 4) == -24)
        #expect(revealDelta(300, ItemSpan(top: 250, bottom: 350), 4) == 82)
        #expect(revealDelta(300, ItemSpan(top: 50, bottom: 450), 4) == 46)
    }
}
```

`ios/TruthyEngine/Tests/TruthyEngineTests/LabelsTests.swift`:

```swift
import Testing
@testable import TruthyEngine

// tests/components/FillInPass.test.tsx, ContinueLine.test.tsx and continue-line-polish.test.tsx, the names.
@Suite struct LabelsTests {
    @Test func aPassFieldNamesItsWayBack() {
        #expect(changeLabel(.deck, "CLF") == "Change deck, now CLF")
        #expect(changeLabel(.mode, "Classic") == "Change class, now Classic")
        #expect(changeLabel(.section, "Whole deck") == "Change section, now Whole deck")
        #expect(changeLabel(.area, "Cloud") == "Change area, now Cloud")
    }

    @Test func theContinueLineSaysTheRouteAndTheLastScore() {
        let props = ContinueLabelProps(deckName: "AWS Cloud Practitioner", sectionTitle: "Security and compliance", modeLabel: "Classic", lastScore: "7 of 10", needsConnection: false)
        #expect(continueLabel(props) == "Continue: AWS Cloud Practitioner, Security and compliance, Classic. Last score 7 of 10.")
        var left = props
        left.lastScore = nil
        #expect(continueLabel(left) == "Continue: AWS Cloud Practitioner, Security and compliance, Classic.")
        left.lastScore = ""
        #expect(continueLabel(left) == "Continue: AWS Cloud Practitioner, Security and compliance, Classic.")
        var offline = props
        offline.needsConnection = true
        #expect(continueLabel(offline) == "Continue: AWS Cloud Practitioner, Security and compliance, Classic, needs a connection.")
    }
}
```

- [ ] **Step 4: Run them and see them fail.**

```bash
swift build --package-path ios/TruthyEngine --build-tests 2>&1 | grep -E 'error:' | head -5
```

Expected: errors such as `error: cannot find 'routeKey' in scope`, `error: cannot find 'MODE_TABLE' in scope` and `error: cannot find type 'Choice' in scope`.

- [ ] **Step 5: Write the content helpers and the class table.**

`ios/TruthyEngine/Sources/TruthyEngine/ContentHelpers.swift`:

```swift
// Routes, deck names, the pool of a route and card text: src/content/schema.ts, src/content/load.ts and
// src/content/text.ts, line by line.

/// The deck's name on the pass and the ticket: its own pass name when the catalog gives one, else the platform and
/// the deck title ("AWS Cloud Practitioner").
public func deckPassName(_ platform: IndexPlatform, _ deck: IndexDeck) -> String {
    deck.passName ?? "\(platform.title) \(deck.title)"
}

/// "aws-clf-c02/SEC"; the record key adds "#<mode>" (task 4's recordKey).
public func routeKey(_ route: Route) -> String {
    "\(route.deckId)/\(route.sectionId)"
}

/// Everything the index says about one route. `section` is nil for the whole deck.
public struct RouteInIndex: Equatable, Sendable {
    public let area: IndexArea
    public let platform: IndexPlatform
    public let deck: IndexDeck
    public let section: IndexSection?

    public init(area: IndexArea, platform: IndexPlatform, deck: IndexDeck, section: IndexSection?) {
        self.area = area
        self.platform = platform
        self.deck = deck
        self.section = section
    }
}

/// Finds a route in the index, or nil when its deck or section is gone. The first deck with the id decides: a
/// missing section is nil even if another platform had a deck of the same id.
public func findRoute(_ index: DeckIndex, _ route: Route) -> RouteInIndex? {
    for area in index.areas {
        for platform in area.platforms {
            guard let deck = platform.decks.first(where: { $0.id == route.deckId }) else { continue }
            if route.sectionId == WHOLE_DECK { return RouteInIndex(area: area, platform: platform, deck: deck, section: nil) }
            guard let section = deck.sections.first(where: { $0.id == route.sectionId }) else { return nil }
            return RouteInIndex(area: area, platform: platform, deck: deck, section: section)
        }
    }
    return nil
}

/// The cards a round on this route deals from, in file order. WHOLE_DECK gives every card; an unknown section none.
public func poolFor(_ deck: DeckFile, _ sectionId: String) -> [Card] {
    sectionId == WHOLE_DECK ? deck.cards : deck.cards.filter { $0.section == sectionId }
}

/// A run of card text, shown in the mono face when `code` is true.
public struct TextPart: Codable, Equatable, Sendable {
    public let text: String
    public let code: Bool

    public init(text: String, code: Bool) {
        self.text = text
        self.code = code
    }
}

private let BACKTICK: UInt16 = 0x60

/// text.split(/(`)/) without its empty pieces: every backtick is a code part of its own.
private func plainParts(_ units: ArraySlice<UInt16>) -> [TextPart] {
    var parts: [TextPart] = []
    var piece: [UInt16] = []
    func flush() {
        guard !piece.isEmpty else { return }
        parts.append(TextPart(text: String(decoding: piece, as: UTF16.self), code: false))
        piece = []
    }
    for unit in units {
        if unit == BACKTICK {
            flush()
            parts.append(TextPart(text: "`", code: true))
        } else {
            piece.append(unit)
        }
    }
    flush()
    return parts
}

/// The text in order as plain and code parts; no part is empty. A pair of backticks around at least one other unit is
/// a code part without its backticks (`/`([^`]+)`/g`, scanned as matchAll does); any other backtick is its own part.
public func textParts(_ text: String) -> [TextPart] {
    let units = Array(text.utf16)
    var parts: [TextPart] = []
    var from = 0
    var at = 0
    while at < units.count {
        if units[at] == BACKTICK {
            var end = at + 1
            while end < units.count && units[end] != BACKTICK { end += 1 }
            if end < units.count && end > at + 1 {
                parts += plainParts(units[from..<at])
                parts.append(TextPart(text: String(decoding: units[(at + 1)..<end], as: UTF16.self), code: true))
                at = end + 1
                from = at
                continue
            }
        }
        at += 1
    }
    parts += plainParts(units[from...])
    return parts
}

/// The text as it is read rather than seen (announcements, accessibility labels): code without its backticks.
public func plainText(_ text: String) -> String {
    textParts(text).map(\.text).joined()
}
```

`ios/TruthyEngine/Sources/TruthyEngine/Modes.swift`:

```swift
// The one table of classes (src/app-state/modes.ts): what the class step, the ticket, the continue line and the
// result say about each, and whether the class step offers it.

public struct ModeInfo: Codable, Equatable, Sendable {
    public let id: Mode
    public let name: String
    public let description: String
    public let unit: String
    public var offered: Bool

    public init(id: Mode, name: String, description: String, unit: String, offered: Bool) {
        self.id = id
        self.name = name
        self.description = description
        self.unit = unit
        self.offered = offered
    }
}

public let MODE_TABLE: [ModeInfo] = [
    ModeInfo(id: .classic, name: "Classic", description: "Correct answers out of 10 cards.", unit: "of 10", offered: true),
    ModeInfo(id: .streak, name: "Streak", description: "Correct answers in a row, until the first wrong one.", unit: "in a row", offered: true),
    ModeInfo(id: .lives, name: "Three lives", description: "Cards answered until the third wrong one.", unit: "cards", offered: true),
    ModeInfo(id: .timed, name: "Timed", description: "Correct answers in one minute, wrong ones cost nothing.", unit: "correct", offered: true),
]

/// The row of the class. The web throws for a class its table does not know; a Mode is always one of the four, and
/// every table (MODE_TABLE, or a vector's modeTable) has all four rows.
public func modeInfo(_ mode: Mode, _ table: [ModeInfo] = MODE_TABLE) -> ModeInfo {
    guard let row = table.first(where: { $0.id == mode }) else { preconditionFailure("Unknown mode \"\(mode.rawValue)\".") }
    return row
}

/// Whether the class step offers the class.
public func isOffered(_ mode: Mode, _ table: [ModeInfo] = MODE_TABLE) -> Bool {
    modeInfo(mode, table).offered
}

/// The score of a finished round as the continue line says it: "7 of 10", "13 in a row", "21 cards", "14 correct".
public func lastScoreText(_ mode: Mode, _ score: Int, _ total: Int) -> String {
    mode == .classic ? "\(score) of \(total)" : "\(score) \(modeInfo(mode).unit)"
}
```

- [ ] **Step 6: Write the catalog, the steps, the list cue and the labels.**

`ios/TruthyEngine/Sources/TruthyEngine/Catalog.swift`:

```swift
// What the start screen derives from the deck index and the progress (components/start/useCatalog.ts): deck
// counts, the owner of a card, the seen percentage, where Continue leads, the decks played last, and pruning the
// history of cards that left their deck. Pure: the app loads, saves and keeps the results (tasks 9 and 11).

/// The number of decks under an area (all its platforms).
public func deckCount(_ area: IndexArea) -> Int {
    area.platforms.reduce(0) { $0 + $1.decks.count }
}

/// The number of decks of a platform.
public func deckCount(_ platform: IndexPlatform) -> Int {
    platform.decks.count
}

/// "1 deck", "3 decks", or "No decks yet".
public func decksLabel(_ count: Int) -> String {
    count == 0 ? "No decks yet" : "\(count) \(count == 1 ? "deck" : "decks")"
}

private let DASH: UInt16 = 0x2D

/// The deck a card belongs to, among `deckIds`: the one whose "<id>-" is the card id's longest prefix, so "gcp-cdl"
/// never takes the cards of "gcp-cdl-pro". It tries the prefixes that end just before a "-", longest first.
public func deckOfCard(_ cardId: String, _ deckIds: Set<String>) -> String? {
    let units = Array(cardId.utf16)
    var dash = units.lastIndex(of: DASH)
    while let at = dash, at > 0 {
        let prefix = String(decoding: units[..<at], as: UTF16.self)
        if deckIds.contains(prefix) { return prefix }
        dash = units[..<at].lastIndex(of: DASH)
    }
    return nil
}

/// The seen share of a deck in whole percent. With the deck's current ids, seenShare over them; without, the history
/// entries seen at least once whose id starts with "<deck.id>-", over the card count. Anything seen shows at least 1.
public func seenPercent(_ progress: Progress, _ deck: (id: String, cardCount: Int), _ cardIds: [String]? = nil) -> Int {
    let share: Double
    if let cardIds {
        share = seenShare(progress.cards, cardIds)
    } else {
        let prefix = Array((deck.id + "-").utf16)
        let seen = progress.cards.filter { $0.key.utf16.starts(with: prefix) && $0.value.seen > 0 }.count
        share = deck.cardCount > 0 ? Double(seen) / Double(deck.cardCount) : 0
    }
    if !(share > 0) { return 0 }
    return Int(min(100, max(1, jsRound(share * 100))))
}

/// The score of the last round, when it was finished.
public struct LastScore: Equatable, Sendable {
    public let score: Int
    public let total: Int

    public init(score: Int, total: Int) {
        self.score = score
        self.total = total
    }
}

/// Where Continue leads: the last route and class, when both can still be played.
public struct ContinueTarget: Equatable, Sendable {
    public let route: Route
    public let mode: Mode
    public let found: RouteInIndex
    public let lastScore: LastScore?

    public init(route: Route, mode: Mode, found: RouteInIndex, lastScore: LastScore?) {
        self.route = route
        self.mode = mode
        self.found = found
        self.lastScore = lastScore
    }
}

public func continueTarget(_ index: DeckIndex, _ progress: Progress, _ table: [ModeInfo] = MODE_TABLE) -> ContinueTarget? {
    guard let last = progress.last, isOffered(last.mode, table) else { return nil }
    guard let found = findRoute(index, last.route) else { return nil }
    var lastScore: LastScore?
    if let score = last.score, let total = last.total { lastScore = LastScore(score: score, total: total) }
    return ContinueTarget(route: last.route, mode: last.mode, found: found, lastScore: lastScore)
}

/// A deck the player has played, where it sits in the catalog, and when one of its cards was last seen.
public struct RecentDeck: Equatable, Sendable {
    public let area: IndexArea
    public let platform: IndexPlatform
    public let deck: IndexDeck
    public let lastSeenAt: Double

    public init(area: IndexArea, platform: IndexPlatform, deck: IndexDeck, lastSeenAt: Double) {
        self.area = area
        self.platform = platform
        self.deck = deck
        self.lastSeenAt = lastSeenAt
    }
}

/// How many decks Recent lists at most.
public let RECENT_LIMIT = 4

/// Math.max of two numbers: NaN wins, and +0 is larger than -0.
private func jsMax(_ a: Double, _ b: Double) -> Double {
    if a.isNaN || b.isNaN { return .nan }
    if a == b { return a.sign == .minus && b.sign == .minus ? a : (a == 0 ? 0 : a) }
    return a > b ? a : b
}

/// The decks of the index the player has played, newest first; equal times keep catalog order; at most `limit`
/// (slice(0, limit): a negative limit counts from the end). A deck's time is the latest lastSeenAt of its cards.
public func recentDecks(_ index: DeckIndex, _ progress: Progress, _ limit: Int = RECENT_LIMIT) -> [RecentDeck] {
    let placed = index.areas.flatMap { area in
        area.platforms.flatMap { platform in platform.decks.map { (area: area, platform: platform, deck: $0) } }
    }
    let deckIds = Set(placed.map(\.deck.id))
    var latest: [String: Double] = [:]
    for (cardId, entry) in progress.cards {
        if let owner = deckOfCard(cardId, deckIds) { latest[owner] = jsMax(latest[owner] ?? -.infinity, entry.lastSeenAt) }
    }
    let played = placed.compactMap { place in
        latest[place.deck.id].map { RecentDeck(area: place.area, platform: place.platform, deck: place.deck, lastSeenAt: $0) }
    }
    // (a, b) => b.lastSeenAt - a.lastSeenAt on a stable sort: newer first, a tie (or NaN) keeps catalog order.
    let sorted = played.enumerated().sorted { a, b in
        let difference = b.element.lastSeenAt - a.element.lastSeenAt
        if difference < 0 { return true }
        if difference > 0 { return false }
        return a.offset < b.offset
    }.map(\.element)
    let end = limit < 0 ? max(0, sorted.count + limit) : min(limit, sorted.count)
    return Array(sorted[0..<end])
}

/// Drops the history of cards no longer in their deck (pruneDeck for each deck of `cardIds`), and calls `save` with
/// the result only when the number of card entries changed.
public func withoutRemovedCards(_ progress: Progress, _ cardIds: [String: [String]], _ save: (Progress) -> Void) -> Progress {
    var pruned = progress
    for (deckId, ids) in cardIds { pruned = pruneDeck(pruned, deckId, ids) }
    if pruned.cards.count != progress.cards.count { save(pruned) }
    return pruned
}
```

`ios/TruthyEngine/Sources/TruthyEngine/StartSteps.swift`:

```swift
// The steps and the choices of the start flow (components/start/StartFlow.tsx:72-185), pure.

/// A start step, 1 to 6: area, platform, deck, section, class, ready.
public typealias Step = Int

/// The Recent card's choice on step 1: the deck step then lists the decks played last (the recent path).
public let RECENT = "recent"

public enum ChoiceKey: String, CaseIterable, Codable, Sendable {
    case via, areaId, platformId, deckId, sectionId, mode
}

/// What the player has chosen so far, as ids. sectionId is a section id or WHOLE_DECK.
public struct Choice: Codable, Hashable, Sendable {
    public var via: String?
    public var areaId: String?
    public var platformId: String?
    public var deckId: String?
    public var sectionId: String?
    public var mode: Mode?

    public init(via: String? = nil, areaId: String? = nil, platformId: String? = nil, deckId: String? = nil, sectionId: String? = nil, mode: Mode? = nil) {
        self.via = via
        self.areaId = areaId
        self.platformId = platformId
        self.deckId = deckId
        self.sectionId = sectionId
        self.mode = mode
    }

    /// The choice of a key as its id; the class as its raw value.
    public subscript(key: ChoiceKey) -> String? {
        switch key {
        case .via: via
        case .areaId: areaId
        case .platformId: platformId
        case .deckId: deckId
        case .sectionId: sectionId
        case .mode: mode?.rawValue
        }
    }

    fileprivate mutating func copy(_ key: ChoiceKey, from other: Choice) {
        switch key {
        case .via: via = other.via
        case .areaId: areaId = other.areaId
        case .platformId: platformId = other.platformId
        case .deckId: deckId = other.deckId
        case .sectionId: sectionId = other.sectionId
        case .mode: mode = other.mode
        }
    }
}

/// The step on which each choice is made on the ordinary path.
public let STEP_OF: [ChoiceKey: Step] = [.via: 1, .areaId: 1, .platformId: 2, .deckId: 3, .sectionId: 4, .mode: 5]

/// The step on which `key` is chosen: on the recent path the area and the platform come with the deck.
public func stepOf(_ key: ChoiceKey, _ choice: Choice) -> Step {
    if choice.via == RECENT && (key == .areaId || key == .platformId) { return 3 }
    return STEP_OF[key] ?? 1
}

/// Keeps only the choices made before `step`: going back to a step clears it and everything after it.
public func clearFrom(_ choice: Choice, _ step: Step) -> Choice {
    var kept = Choice()
    for key in ChoiceKey.allCases where stepOf(key, choice) < step && choice[key] != nil {
        kept.copy(key, from: choice)
    }
    return kept
}

/// The steps a player passes through up to `step`. A deck without sections has no step 4; the recent path no step 2.
public func pathTo(_ step: Step, _ hasSections: Bool, _ recent: Bool = false) -> [Step] {
    let all: [Step] = hasSections ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 5, 6]
    return all.filter { $0 <= step && !(recent && $0 == 2) }
}

/// Where Back goes from `step`: one step back on its path.
public func previousStep(_ step: Step, _ hasSections: Bool, _ recent: Bool = false) -> Step {
    let path = pathTo(step, hasSections, recent)
    return path.count >= 2 ? path[path.count - 2] : 1
}

/// The id of the card chosen on `target`; on step 1 of the recent path the Recent card (RECENT).
public func chosenOn(_ target: Step, _ choice: Choice) -> String? {
    if target == 1 && choice.via == RECENT { return RECENT }
    switch target {
    case 1: return choice.areaId
    case 2: return choice.platformId
    case 3: return choice.deckId
    case 4: return choice.sectionId
    case 5: return choice.mode?.rawValue
    default: return nil
    }
}

/// The choices looked up in the index (StartFlow.tsx: resolve). A missing entry was not chosen or no longer exists.
private struct Resolved {
    var area: IndexArea?
    var platform: IndexPlatform?
    var deck: IndexDeck?
    var hasSection = false
    var mode: ModeInfo?
}

private func resolve(_ index: DeckIndex, _ choice: Choice, _ table: [ModeInfo]) -> Resolved {
    var r = Resolved()
    r.area = choice.areaId.flatMap { id in index.areas.first { $0.id == id } }
    r.platform = choice.platformId.flatMap { id in r.area?.platforms.first { $0.id == id } }
    r.deck = choice.deckId.flatMap { id in r.platform?.decks.first { $0.id == id } }
    if let deck = r.deck, let sectionId = choice.sectionId {
        r.hasSection = sectionId == WHOLE_DECK || deck.sections.contains { $0.id == sectionId }
    }
    r.mode = choice.mode.flatMap { mode in table.first { $0.id == mode && $0.offered } }
    return r
}

/// True when every choice needed to show `step` exists in the index (a remembered step may be stale).
public func canShow(_ index: DeckIndex, _ step: Step, _ choice: Choice, _ table: [ModeInfo] = MODE_TABLE) -> Bool {
    let r = resolve(index, choice, table)
    let recent = choice.via == RECENT
    if recent && step == 2 { return false }
    let placed = !(recent && step == 3)
    if step >= 2 && placed && r.area == nil { return false }
    if step >= 3 && placed && r.platform == nil { return false }
    if step >= 4 && r.deck == nil { return false }
    if step == 4, let deck = r.deck, deck.sections.isEmpty { return false }
    if step >= 5 && !r.hasSection { return false }
    if step >= 6 && r.mode == nil { return false }
    return true
}
```

`ios/TruthyEngine/Sources/TruthyEngine/ListCue.swift`:

```swift
// The cue that a step's list goes on below the fold (components/start/listCue.ts): the list's bottom edge fades over
// 28 points while more content lies below, and the fade ends over a card, never over sky.

/// The length of the fade, as at the bottom of the missed-cards list.
public let FADE_PX: Double = 28

/// A card of the list, from the top of the list's view.
public struct ItemSpan: Codable, Equatable, Sendable {
    public let top: Double
    public let bottom: Double

    public init(top: Double, bottom: Double) {
        self.top = top
        self.bottom = bottom
    }
}

public struct ListCue: Equatable, Sendable {
    /// Content runs on below the view.
    public let more: Bool
    /// How far above the bottom of the view the fade ends (0: at the edge).
    public let lift: Double

    public init(more: Bool, lift: Double) {
        self.more = more
        self.lift = lift
    }
}

private func maxZero(_ x: Double) -> Double {
    x > 0 ? x : 0
}

/// The cue for a view `viewHeight` tall whose content ends at `contentBottom` and whose cards are `items`.
public func listCue(_ viewHeight: Double, _ contentBottom: Double, _ items: [ItemSpan]) -> ListCue {
    if contentBottom <= viewHeight + 1 { return ListCue(more: false, lift: 0) }
    guard let at = items.firstIndex(where: { $0.bottom > viewHeight + 1 }) else { return ListCue(more: true, lift: 0) }
    let cut = items[at]
    let above = at > 0 ? items[at - 1].bottom : min(cut.top, viewHeight)
    let shown = viewHeight - cut.top
    if shown <= 0 { return ListCue(more: true, lift: maxZero(viewHeight - above)) }
    if shown >= FADE_PX { return ListCue(more: true, lift: 0) }
    return ListCue(more: true, lift: maxZero(viewHeight - above) * (1 - shown / FADE_PX))
}

/// How far to scroll so that a card shows whole with `room` around it and the fade below: positive down, negative
/// up, 0 when it already shows. A card taller than the view shows its top.
public func revealDelta(_ viewHeight: Double, _ item: ItemSpan, _ room: Double) -> Double {
    let top = item.top - room
    let bottom = item.bottom + room + FADE_PX
    if top < 0 { return top }
    if bottom > viewHeight { return min(bottom - viewHeight, top) }
    return 0
}
```

`ios/TruthyEngine/Sources/TruthyEngine/Labels.swift`:

```swift
// Two accessible names of the start flow: a pass field's way back (components/FillInPass.tsx) and the continue line
// (components/start/ContinueLine.tsx).

public enum PassFieldName: String, Codable, CaseIterable, Sendable {
    case area, platform, deck, section, mode
}

/// "Change deck, now CLF". The class field says "class".
public func changeLabel(_ field: PassFieldName, _ value: String) -> String {
    let word = field == .mode ? "class" : field.rawValue
    return "Change \(word), now \(value)"
}

public struct ContinueLabelProps: Equatable, Sendable {
    public var deckName: String
    public var sectionTitle: String
    public var modeLabel: String
    /// Already worded ("7 of 10"); nil or empty when the last round was left before its end.
    public var lastScore: String?
    /// The web's offline line; the embedded decks never need a connection, so the app passes false.
    public var needsConnection: Bool

    public init(deckName: String, sectionTitle: String, modeLabel: String, lastScore: String? = nil, needsConnection: Bool = false) {
        self.deckName = deckName
        self.sectionTitle = sectionTitle
        self.modeLabel = modeLabel
        self.lastScore = lastScore
        self.needsConnection = needsConnection
    }
}

/// "Continue: AWS Cloud Practitioner, Security and compliance, Classic. Last score 7 of 10."
public func continueLabel(_ props: ContinueLabelProps) -> String {
    if props.needsConnection {
        return "Continue: \(props.deckName), \(props.sectionTitle), \(props.modeLabel), needs a connection."
    }
    let score = props.lastScore.map { $0.isEmpty ? "" : " Last score \($0)." } ?? ""
    return "Continue: \(props.deckName), \(props.sectionTitle), \(props.modeLabel).\(score)"
}
```

- [ ] **Step 7: Run the unit tests.**

```bash
swift test --package-path ios/TruthyEngine --filter 'ContentHelpersTests|ModeTableTests|CatalogTests|StartStepsTests|ListCueTests|LabelsTests'
```

Expected: `Test run with 25 tests in 6 suites passed` (6, 4, 6, 5, 2 and 2).

- [ ] **Step 8: Commit the port.**

```bash
git add ios/TruthyEngine/Sources/TruthyEngine/ContentHelpers.swift ios/TruthyEngine/Sources/TruthyEngine/Modes.swift ios/TruthyEngine/Sources/TruthyEngine/Catalog.swift ios/TruthyEngine/Sources/TruthyEngine/StartSteps.swift ios/TruthyEngine/Sources/TruthyEngine/ListCue.swift ios/TruthyEngine/Sources/TruthyEngine/Labels.swift ios/TruthyEngine/Tests/TruthyEngineTests/ContentHelpersTests.swift ios/TruthyEngine/Tests/TruthyEngineTests/ModeTableTests.swift ios/TruthyEngine/Tests/TruthyEngineTests/CatalogTests.swift ios/TruthyEngine/Tests/TruthyEngineTests/StartStepsTests.swift ios/TruthyEngine/Tests/TruthyEngineTests/ListCueTests.swift ios/TruthyEngine/Tests/TruthyEngineTests/LabelsTests.swift
pnpm vitest run tests/repo-hygiene.test.ts
git commit -m "feat: port the content helpers, the class table, the catalog, the start steps, the list cue and the labels to the Swift engine"
```

Expected: the hygiene test passes; the commit has twelve files.

- [ ] **Step 9: Write the golden tests.** One suite per module; every file is loaded with two string literals, and every case is checked.

`ios/TruthyEngine/Tests/TruthyEngineTests/ContentGoldenTests.swift`:

```swift
import Testing
@testable import TruthyEngine

// native-data/golden vectors of src/content/schema.ts, load.ts and text.ts.
private func required(_ value: GoldenValue, _ key: String) throws -> GoldenValue {
    guard let member = value[key] else { throw GoldenError(description: "no \(key) in \(value)") }
    return member
}

/// The projection plan A writes for a found route.
func routeProjection(_ found: RouteInIndex?) -> GoldenValue {
    guard let found else { return .null }
    return .object([
        "areaId": .string(found.area.id), "platformId": .string(found.platform.id), "deckId": .string(found.deck.id),
        "sectionId": found.section.map { .string($0.id) } ?? .null,
    ])
}

@Suite struct ContentGoldenTests {
    @Test func wholeDeck() throws {
        let file = try Golden.load("src/content/schema", "WHOLE_DECK")
        #expect(try file.cases[0].output.string() == WHOLE_DECK)
    }

    @Test func routeKeyCases() throws {
        let file = try Golden.load("src/content/schema", "routeKey")
        for c in file.cases {
            #expect(routeKey(try file.decode(Route.self, required(c.input, "route"))) == (try c.output.string()), "\(c.name)")
        }
    }

    @Test func deckPassNameCases() throws {
        let file = try Golden.load("src/content/schema", "deckPassName")
        for c in file.cases {
            let platform = try required(c.input, "platform")
            let deck = try required(c.input, "deck")
            // The web types take only the titles and the pass name; the rest of each struct is a placeholder.
            let name = deckPassName(
                IndexPlatform(id: "", title: try required(platform, "title").string(), decks: []),
                IndexDeck(id: "", code: "", title: try required(deck, "title").string(), passName: try deck["passName"]?.string(),
                          cardCount: 1, version: "", hash: "", sections: []))
            #expect(name == (try c.output.string()), "\(c.name)")
        }
    }

    @Test func findRouteCases() throws {
        let file = try Golden.load("src/content/schema", "findRoute")
        for c in file.cases {
            let found = findRoute(try file.decode(DeckIndex.self, required(c.input, "index")), try file.decode(Route.self, required(c.input, "route")))
            #expect(routeProjection(found) == c.output, "\(c.name)")
        }
    }

    @Test func poolForCases() throws {
        let file = try Golden.load("src/content/load", "poolFor")
        for c in file.cases {
            let pool = poolFor(try file.decode(DeckFile.self, required(c.input, "deck")), try required(c.input, "sectionId").string())
            #expect(pool.map(\.id) == (try file.cards(c.output).map(\.id)), "\(c.name)")
        }
    }

    @Test func textPartsCases() throws {
        let file = try Golden.load("src/content/text", "textParts")
        for c in file.cases {
            #expect(textParts(try required(c.input, "text").string()) == (try file.decode([TextPart].self, c.output)), "\(c.name)")
        }
    }

    @Test func plainTextCases() throws {
        let file = try Golden.load("src/content/text", "plainText")
        for c in file.cases {
            #expect(plainText(try required(c.input, "text").string()) == (try c.output.string()), "\(c.name)")
        }
    }
}
```

`ios/TruthyEngine/Tests/TruthyEngineTests/ModesGoldenTests.swift`:

```swift
import Testing
@testable import TruthyEngine

// native-data/golden vectors of src/app-state/modes.ts. A class name that is not a Mode is the web's throw.
private func expectThrow(_ output: GoldenValue, _ mode: String, _ name: String) {
    #expect(output == .object(["$throws": .string("Unknown mode \"\(mode)\".")]), "\(name)")
}

@Suite struct ModesGoldenTests {
    @Test func modeTable() throws {
        let file = try Golden.load("src/app-state/modes", "MODE_TABLE")
        #expect(try file.decode([ModeInfo].self, file.cases[0].output) == MODE_TABLE)
    }

    @Test func modeInfoCases() throws {
        let file = try Golden.load("src/app-state/modes", "modeInfo")
        for c in file.cases {
            let name = try ProgressGolden.required(c.input, "mode").string()
            guard let mode = Mode(rawValue: name) else { expectThrow(c.output, name, c.name); continue }
            #expect(modeInfo(mode) == (try file.decode(ModeInfo.self, c.output)), "\(c.name)")
        }
    }

    @Test func isOfferedCases() throws {
        let file = try Golden.load("src/app-state/modes", "isOffered")
        for c in file.cases {
            let name = try ProgressGolden.required(c.input, "mode").string()
            guard let mode = Mode(rawValue: name) else { expectThrow(c.output, name, c.name); continue }
            let table = try c.input["modeTable"].map { try file.decode([ModeInfo].self, $0) } ?? MODE_TABLE
            #expect(isOffered(mode, table) == (try c.output.bool()), "\(c.name)")
        }
    }

    @Test func lastScoreTextCases() throws {
        let file = try Golden.load("src/app-state/modes", "lastScoreText")
        for c in file.cases {
            let name = try ProgressGolden.required(c.input, "mode").string()
            let mode = try #require(Mode(rawValue: name))
            let text = lastScoreText(mode, try ProgressGolden.required(c.input, "score").int(), try ProgressGolden.required(c.input, "total").int())
            #expect(text == (try c.output.string()), "\(c.name)")
        }
    }
}
```

`ios/TruthyEngine/Tests/TruthyEngineTests/CatalogGoldenTests.swift`:

```swift
import Testing
@testable import TruthyEngine

// native-data/golden vectors of components/start/useCatalog.ts.
private typealias G = ProgressGolden

private func table(_ file: GoldenFile, _ input: GoldenValue) throws -> [ModeInfo] {
    try input["modeTable"].map { try file.decode([ModeInfo].self, $0) } ?? MODE_TABLE
}

@Suite struct CatalogGoldenTests {
    @Test func deckCountCases() throws {
        let file = try Golden.load("components/start/useCatalog", "deckCount")
        for c in file.cases {
            let place = try G.required(c.input, "place")
            let count = place["platforms"] != nil
                ? deckCount(try file.decode(IndexArea.self, place))
                : deckCount(try file.decode(IndexPlatform.self, place))
            #expect(count == (try c.output.int()), "\(c.name)")
        }
    }

    @Test func decksLabelCases() throws {
        let file = try Golden.load("components/start/useCatalog", "decksLabel")
        for c in file.cases {
            #expect(decksLabel(try G.required(c.input, "count").int()) == (try c.output.string()), "\(c.name)")
        }
    }

    @Test func deckOfCardCases() throws {
        let file = try Golden.load("components/start/useCatalog", "deckOfCard")
        for c in file.cases {
            let ids = Set(try G.strings(G.required(c.input, "deckIds")))
            let owner = deckOfCard(try G.required(c.input, "cardId").string(), ids)
            #expect(owner == (try file.decode(String?.self, c.output)), "\(c.name)")
        }
    }

    @Test func seenPercentCases() throws {
        let file = try Golden.load("components/start/useCatalog", "seenPercent")
        for c in file.cases {
            let deck = try G.required(c.input, "deck")
            let percent = seenPercent(
                try G.progress(G.required(c.input, "progress")),
                (id: try G.required(deck, "id").string(), cardCount: try G.required(deck, "cardCount").int()),
                try c.input["cardIds"].map(G.strings))
            #expect(percent == (try c.output.int()), "\(c.name)")
        }
    }

    @Test func continueTargetCases() throws {
        let file = try Golden.load("components/start/useCatalog", "continueTarget")
        for c in file.cases {
            let target = continueTarget(
                try file.decode(DeckIndex.self, G.required(c.input, "index")), try G.progress(G.required(c.input, "progress")),
                try table(file, c.input))
            guard let target else {
                #expect(c.output == .null, "\(c.name)")
                continue
            }
            let expected = try G.required(c.output, "lastScore")
            #expect(try G.route(G.required(c.output, "route")) == target.route, "\(c.name): route")
            #expect(try G.mode(G.required(c.output, "mode")) == target.mode, "\(c.name): mode")
            #expect(routeProjection(target.found) == (try G.required(c.output, "found")), "\(c.name): found")
            let lastScore: LastScore? = expected == .null ? nil
                : LastScore(score: try G.required(expected, "score").int(), total: try G.required(expected, "total").int())
            #expect(target.lastScore == lastScore, "\(c.name): lastScore")
        }
    }

    @Test func recentDecksCases() throws {
        let file = try Golden.load("components/start/useCatalog", "recentDecks")
        for c in file.cases {
            let index = try file.decode(DeckIndex.self, G.required(c.input, "index"))
            let progress = try G.progress(G.required(c.input, "progress"))
            let decks = if let limit = c.input["limit"] { recentDecks(index, progress, try limit.int()) } else { recentDecks(index, progress) }
            let got: [GoldenValue] = decks.map {
                .object(["areaId": .string($0.area.id), "platformId": .string($0.platform.id), "deckId": .string($0.deck.id), "lastSeenAt": .number($0.lastSeenAt)])
            }
            #expect(got == (try c.output.array()), "\(c.name)")
        }
    }

    @Test func recentLimit() throws {
        let file = try Golden.load("components/start/useCatalog", "RECENT_LIMIT")
        #expect(try file.cases[0].output.int() == RECENT_LIMIT)
    }

    @Test func withoutRemovedCardsCases() throws {
        let file = try Golden.load("components/start/useCatalog", "withoutRemovedCards")
        for c in file.cases {
            guard case .object(let byDeck) = try G.required(c.input, "cardIds") else { throw GoldenError(description: "\(c.name): cardIds") }
            var saved = false
            let pruned = withoutRemovedCards(try G.progress(G.required(c.input, "progress")), try byDeck.mapValues(G.strings)) { _ in saved = true }
            #expect(G.exactly(pruned, try G.progress(G.required(c.output, "progress"))), "\(c.name): progress")
            #expect(saved == (try G.required(c.output, "saved").bool()), "\(c.name): saved")
        }
    }
}
```

`ios/TruthyEngine/Tests/TruthyEngineTests/StartStepsGoldenTests.swift`:

```swift
import Testing
@testable import TruthyEngine

// native-data/golden vectors of the step helpers of components/start/StartFlow.tsx.
private typealias G = ProgressGolden

private func choice(_ file: GoldenFile, _ input: GoldenValue, _ key: String = "choice") throws -> Choice {
    try file.decode(Choice.self, G.required(input, key))
}

// The web's Choice can hold a class it does not know (a stale history entry; the vectors pass "zen"), and its
// resolve finds no row of the table for it, as for no class. Choice.mode is a Mode, so such a class reads as none.
private func choiceWithKnownMode(_ file: GoldenFile, _ input: GoldenValue) throws -> Choice {
    guard case .object(var members) = try G.required(input, "choice") else {
        throw GoldenError(description: "choice is not an object in \(input)")
    }
    if let mode = members["mode"]?.stringValue, Mode(rawValue: mode) == nil { members["mode"] = nil }
    return try file.decode(Choice.self, .object(members))
}

@Suite struct StartStepsGoldenTests {
    @Test func stepOfTable() throws {
        let file = try Golden.load("components/start/StartFlow", "STEP_OF")
        let table = try file.decode([String: Int].self, file.cases[0].output)
        #expect(Dictionary(uniqueKeysWithValues: STEP_OF.map { ($0.key.rawValue, $0.value) }) == table)
    }

    @Test func stepOfCases() throws {
        let file = try Golden.load("components/start/StartFlow", "stepOf")
        for c in file.cases {
            let key = try #require(ChoiceKey(rawValue: try G.required(c.input, "key").string()))
            #expect(stepOf(key, try choice(file, c.input)) == (try c.output.int()), "\(c.name)")
        }
    }

    @Test func clearFromCases() throws {
        let file = try Golden.load("components/start/StartFlow", "clearFrom")
        for c in file.cases {
            let cleared = clearFrom(try choice(file, c.input), try G.required(c.input, "step").int())
            #expect(cleared == (try file.decode(Choice.self, c.output)), "\(c.name)")
        }
    }

    @Test func pathToCases() throws {
        let file = try Golden.load("components/start/StartFlow", "pathTo")
        for c in file.cases {
            let step = try G.required(c.input, "step").int()
            let sections = try G.required(c.input, "hasSections").bool()
            let path = if let recent = c.input["recent"] { pathTo(step, sections, try recent.bool()) } else { pathTo(step, sections) }
            #expect(path == (try file.decode([Int].self, c.output)), "\(c.name)")
        }
    }

    @Test func previousStepCases() throws {
        let file = try Golden.load("components/start/StartFlow", "previousStep")
        for c in file.cases {
            let step = try G.required(c.input, "step").int()
            let sections = try G.required(c.input, "hasSections").bool()
            let back = if let recent = c.input["recent"] { previousStep(step, sections, try recent.bool()) } else { previousStep(step, sections) }
            #expect(back == (try c.output.int()), "\(c.name)")
        }
    }

    @Test func chosenOnCases() throws {
        let file = try Golden.load("components/start/StartFlow", "chosenOn")
        for c in file.cases {
            let id = chosenOn(try G.required(c.input, "target").int(), try choice(file, c.input))
            #expect(id == (try file.decode(String?.self, c.output)), "\(c.name)")
        }
    }

    @Test func canShowCases() throws {
        let file = try Golden.load("components/start/StartFlow", "canShow")
        for c in file.cases {
            let table = try c.input["modeTable"].map { try file.decode([ModeInfo].self, $0) } ?? MODE_TABLE
            let shown = canShow(
                try file.decode(DeckIndex.self, G.required(c.input, "index")), try G.required(c.input, "step").int(),
                try choiceWithKnownMode(file, c.input), table)
            #expect(shown == (try c.output.bool()), "\(c.name)")
        }
    }
}
```

`ios/TruthyEngine/Tests/TruthyEngineTests/ListCueGoldenTests.swift`:

```swift
import Testing
@testable import TruthyEngine

// native-data/golden vectors of components/start/listCue.ts.
private typealias G = ProgressGolden

@Suite struct ListCueGoldenTests {
    @Test func fadeLength() throws {
        let file = try Golden.load("components/start/listCue", "FADE_PX")
        #expect(try file.cases[0].output.number() == FADE_PX)
    }

    @Test func listCueCases() throws {
        let file = try Golden.load("components/start/listCue", "listCue")
        for c in file.cases {
            let cue = listCue(
                try G.required(c.input, "viewHeight").number(), try G.required(c.input, "contentBottom").number(),
                try file.decode([ItemSpan].self, G.required(c.input, "items")))
            #expect(cue.more == (try G.required(c.output, "more").bool()), "\(c.name): more")
            #expect(cue.lift == (try G.required(c.output, "lift").number()), "\(c.name): lift")
        }
    }

    @Test func revealDeltaCases() throws {
        let file = try Golden.load("components/start/listCue", "revealDelta")
        for c in file.cases {
            let delta = revealDelta(
                try G.required(c.input, "viewHeight").number(), try file.decode(ItemSpan.self, G.required(c.input, "item")),
                try G.required(c.input, "room").number())
            #expect(delta == (try c.output.number()), "\(c.name)")
        }
    }
}
```

`ios/TruthyEngine/Tests/TruthyEngineTests/LabelsGoldenTests.swift`:

```swift
import Testing
@testable import TruthyEngine

// native-data/golden vectors of changeLabel (components/FillInPass.tsx) and continueLabel (ContinueLine.tsx).
private typealias G = ProgressGolden

@Suite struct LabelsGoldenTests {
    @Test func changeLabelCases() throws {
        let file = try Golden.load("components/FillInPass", "changeLabel")
        for c in file.cases {
            let field = try #require(PassFieldName(rawValue: try G.required(c.input, "field").string()))
            #expect(changeLabel(field, try G.required(c.input, "value").string()) == (try c.output.string()), "\(c.name)")
        }
    }

    @Test func continueLabelCases() throws {
        let file = try Golden.load("components/start/ContinueLine", "continueLabel")
        for c in file.cases {
            let props = try G.required(c.input, "props")
            let label = continueLabel(ContinueLabelProps(
                deckName: try G.required(props, "deckName").string(), sectionTitle: try G.required(props, "sectionTitle").string(),
                modeLabel: try G.required(props, "modeLabel").string(), lastScore: try props["lastScore"]?.string(),
                needsConnection: try props["needsConnection"]?.bool() ?? false))
            #expect(label == (try c.output.string()), "\(c.name)")
        }
    }
}
```

`routeProjection` is module-internal in the test target (no `private`), so `CatalogGoldenTests` uses the one of `ContentGoldenTests`.

- [ ] **Step 10: Run the golden tests.**

```bash
swift test --package-path ios/TruthyEngine --filter 'ContentGoldenTests|ModesGoldenTests|CatalogGoldenTests|StartStepsGoldenTests|ListCueGoldenTests|LabelsGoldenTests'
```

Expected: `Test run with 31 tests in 6 suites passed` (7, 4, 8, 7, 3 and 2). A failure names the case. Fix the port, never a vector. A file that fails to decode (`GoldenError`, `DecodingError`) means plan A's shape differs from Interfaces: follow the committed file in the test, not in the engine.

- [ ] **Step 11: Check that the golden suite bites.** Break the tiebreak of `recentDecks` on purpose and put it back:

```bash
sed -i '' 's/        return a.offset < b.offset$/        return a.offset > b.offset/' ios/TruthyEngine/Sources/TruthyEngine/Catalog.swift
swift test --package-path ios/TruthyEngine --filter 'CatalogTests|CatalogGoldenTests' 2>&1 | grep -E '✘ Test|Test run with'
sed -i '' 's/        return a.offset > b.offset$/        return a.offset < b.offset/' ios/TruthyEngine/Sources/TruthyEngine/Catalog.swift
git diff --stat ios/TruthyEngine/Sources
```

Expected: at least `✘ Test recentListsTheDecksPlayedLastNewestFirstAndKeepsCatalogOrderOnTies()` and `✘ Test recentDecksCases()` (the web pins equal times), and a failing run line; then no diff in `Sources`.

- [ ] **Step 12: Run the whole package and the web tests, and commit.**

```bash
swift test --package-path ios/TruthyEngine 2>&1 | tail -1
git add ios/TruthyEngine/Tests/TruthyEngineTests/ContentGoldenTests.swift ios/TruthyEngine/Tests/TruthyEngineTests/ModesGoldenTests.swift ios/TruthyEngine/Tests/TruthyEngineTests/CatalogGoldenTests.swift ios/TruthyEngine/Tests/TruthyEngineTests/StartStepsGoldenTests.swift ios/TruthyEngine/Tests/TruthyEngineTests/ListCueGoldenTests.swift ios/TruthyEngine/Tests/TruthyEngineTests/LabelsGoldenTests.swift
pnpm test
git commit -m "test: check the start-flow helpers of the Swift engine against their golden vectors"
```

Expected: `Test run with 294 tests in 35 suites passed after ... with 1 known issue` (task 4's 238 in 23, plus 25 unit and 31 golden tests in 12 suites), with `everyGoldenFileHasATest()` still skipped and `PurityTests` green over the six new files; every Vitest file passes; the commit has six files. `git status --short` prints nothing.
