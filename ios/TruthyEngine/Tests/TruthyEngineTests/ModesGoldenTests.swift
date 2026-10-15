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
