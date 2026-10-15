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
