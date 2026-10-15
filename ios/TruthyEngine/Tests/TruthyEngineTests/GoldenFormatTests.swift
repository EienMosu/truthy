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
