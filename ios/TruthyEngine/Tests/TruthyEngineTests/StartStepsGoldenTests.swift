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
