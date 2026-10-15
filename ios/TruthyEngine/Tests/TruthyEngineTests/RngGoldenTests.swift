import Testing
import TruthyEngine

// native-data/golden vectors of src/engine/rng.ts.
@Suite struct RngGoldenTests {
    @Test func createRngMatchesTheWeb() throws {
        let golden = try Golden.load("src/engine/rng", "createRng")
        for item in golden.cases {
            let seed = try golden.decode(Double.self, #require(item.input["seed"]))
            let expected = try golden.decode([Double].self, item.output)
            let rng = createRng(seed)
            #expect(expected.map { _ in rng() } == expected, "\(item.name)")
        }
    }

    @Test func shuffleMatchesTheWeb() throws {
        let golden = try Golden.load("src/engine/rng", "shuffle")
        for item in golden.cases {
            let items = try golden.decode([String].self, #require(item.input["items"]))
            let rng = try golden.rng(#require(item.input["rng"]))
            let expected = try golden.decode([String].self, item.output)
            #expect(shuffle(items, rng) == expected, "\(item.name)")
        }
    }
}
