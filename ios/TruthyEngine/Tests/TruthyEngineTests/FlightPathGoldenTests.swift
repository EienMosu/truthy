import Testing
@testable import TruthyEngine

// native-data/golden vectors of components/FlightPath.tsx.
private typealias G = ProgressGolden

private func bools(_ value: GoldenValue) throws -> [Bool] { try value.array().map { try $0.bool() } }

@Suite struct FlightPathGoldenTests {
    @Test func pointAtCases() throws {
        let file = try Golden.load("components/FlightPath", "pointAt")
        for c in file.cases {
            #expect(pointAt(try G.required(c.input, "t").number()) == (try file.decode(Point.self, c.output)), "\(c.name)")
        }
    }

    @Test func waypointTCases() throws {
        let file = try Golden.load("components/FlightPath", "waypointT")
        for c in file.cases {
            #expect(waypointT(try G.required(c.input, "i").number(), try G.required(c.input, "n").number()) == (try c.output.number()), "\(c.name)")
        }
    }

    @Test func flownPathCases() throws {
        let file = try Golden.load("components/FlightPath", "flownPath")
        for c in file.cases {
            #expect(flownPath(try G.required(c.input, "t").number()) == (try c.output.string()), "\(c.name)")
        }
    }

    @Test func headingAtCases() throws {
        let file = try Golden.load("components/FlightPath", "headingAt")
        for c in file.cases {
            #expect(headingAt(try G.required(c.input, "t").number()) == (try c.output.number()), "\(c.name)")
        }
    }

    @Test func waypointStatesCases() throws {
        let file = try Golden.load("components/FlightPath", "waypointStates")
        for c in file.cases {
            let states = waypointStates(
                try G.required(c.input, "total").int(), try bools(G.required(c.input, "results")), try G.required(c.input, "current").int(),
                try G.required(c.input, "answered").bool())
            #expect(states == (try file.decode([WaypointState].self, c.output)), "\(c.name)")
        }
    }

    @Test func cardListCases() throws {
        let file = try Golden.load("components/FlightPath", "cardList")
        for c in file.cases {
            #expect(cardList(try G.required(c.input, "numbers").array().map { try $0.int() }) == (try c.output.string()), "\(c.name)")
        }
    }

    @Test func flightPathLabelCases() throws {
        let file = try Golden.load("components/FlightPath", "flightPathLabel")
        for c in file.cases {
            let label = flightPathLabel(try G.required(c.input, "total").int(), try bools(G.required(c.input, "results")), try G.required(c.input, "current").int())
            #expect(label == (try c.output.string()), "\(c.name)")
        }
    }

    @Test func completedLabelCases() throws {
        let file = try Golden.load("components/FlightPath", "completedLabel")
        for c in file.cases {
            #expect(completedLabel(try G.required(c.input, "total").int(), try bools(G.required(c.input, "results"))) == (try c.output.string()), "\(c.name)")
        }
    }

    @Test func completedScaleCases() throws {
        let file = try Golden.load("components/FlightPath", "completedScale")
        for c in file.cases {
            #expect(completedScale(try G.required(c.input, "cards").int()) == (try c.output.number()), "\(c.name)")
        }
    }
}
