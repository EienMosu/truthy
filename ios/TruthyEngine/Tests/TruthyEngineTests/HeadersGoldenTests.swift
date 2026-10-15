import Testing
@testable import TruthyEngine

// native-data/golden vectors of the Streak, Three lives and Timed headers and of the barcode.
private typealias G = ProgressGolden

private func probes(_ value: GoldenValue) throws -> [(Int, Double)] {
    guard case .object(let members) = value else { throw GoldenError(description: "not a probe table: \(value)") }
    return try members.map { (try #require(Int($0.key)), try $0.value.number()) }
}

@Suite struct HeadersGoldenTests {
    @Test func streakLayoutCases() throws {
        let file = try Golden.load("components/StreakPath", "streakLayout")
        for c in file.cases {
            let layout = streakLayout(try G.required(c.input, "done").int(), try G.optionalInt(G.required(c.input, "best")))
            #expect(layout.dot == (try G.required(c.output, "dot").number()), "\(c.name): dot")
            #expect(layout.ticks == (try G.required(c.output, "ticks").bool()), "\(c.name): ticks")
            #expect(layout.ring == (try G.optionalInt(G.required(c.output, "ring"))), "\(c.name): ring")
            #expect(layout.target == (try G.required(c.output, "target").bool()), "\(c.name): target")
            #expect(layout.future == (try G.required(c.output, "future").array().map { try $0.int() }), "\(c.name): future")
            for (slot, t) in try probes(G.required(c.output, "t")) { #expect(layout.t(slot) == t, "\(c.name): t(\(slot))") }
        }
    }

    @Test func streakLabelCases() throws {
        let file = try Golden.load("components/StreakPath", "streakLabel")
        for c in file.cases {
            let label = streakLabel(try G.required(c.input, "streak").int(), try G.optionalInt(G.required(c.input, "best")), try G.required(c.input, "ended").bool())
            #expect(label == (try c.output.string()), "\(c.name)")
        }
    }

    @Test func trailLayoutCases() throws {
        let file = try Golden.load("components/LivesPath", "trailLayout")
        for c in file.cases {
            let layout = trailLayout(try G.required(c.input, "marks").int())
            #expect(layout.r == (try G.required(c.output, "r").number()), "\(c.name): r")
            #expect(layout.side == (try G.required(c.output, "side").number()), "\(c.name): side")
            #expect(layout.cross == (try G.required(c.output, "cross").bool()), "\(c.name): cross")
            for (mark, x) in try probes(G.required(c.output, "x")) { #expect(layout.x(mark) == x, "\(c.name): x(\(mark))") }
        }
    }

    @Test func livesLabelCases() throws {
        let file = try Golden.load("components/LivesPath", "livesLabel")
        for c in file.cases {
            #expect(livesLabel(try G.required(c.input, "results").array().map { try $0.bool() }) == (try c.output.string()), "\(c.name)")
        }
    }

    @Test func clockTextCases() throws {
        let file = try Golden.load("components/TimedPath", "clockText")
        for c in file.cases {
            #expect(clockText(try G.required(c.input, "remainingMs").number()) == (try c.output.string()), "\(c.name)")
        }
    }

    @Test func timedLabelCases() throws {
        let file = try Golden.load("components/TimedPath", "timedLabel")
        for c in file.cases {
            let label = timedLabel(try G.required(c.input, "remainingMs").number(), try G.required(c.input, "correct").int(), try G.required(c.input, "wrong").int())
            #expect(label == (try c.output.string()), "\(c.name)")
        }
    }

    @Test func barcodeBarsCases() throws {
        let file = try Golden.load("components/BoardingPass", "barcodeBars")
        for c in file.cases {
            let barcode = barcodeBars(try G.required(c.input, "data").string())
            #expect(barcode.bars == (try file.decode([BarcodeBar].self, G.required(c.output, "bars"))), "\(c.name): bars")
            #expect(barcode.width == (try G.required(c.output, "width").int()), "\(c.name): width")
        }
    }
}
