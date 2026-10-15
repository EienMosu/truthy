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
