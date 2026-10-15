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
