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
