import Testing
import TruthyEngine

// tests/engine/rng.test.ts, case by case.
private func draw(_ seed: Double, _ count: Int) -> [Double] {
    let rng = createRng(seed)
    return (0..<count).map { _ in rng() }
}

@Suite struct RngTests {
    @Test func producesTheReferenceMulberry32Values() {
        #expect(draw(1, 3).map { $0 * 4_294_967_296 } == [2_693_262_067, 11_749_833, 2_265_367_787])
        #expect(draw(42, 3).map { $0 * 4_294_967_296 } == [2_581_720_956, 1_925_393_290, 3_661_312_704])
        #expect(draw(0, 3).map { $0 * 4_294_967_296 } == [1_144_304_738, 1_416_247, 958_946_056])
    }

    @Test func givesTheSameSequenceForTheSameSeedAndAnotherForAnotherSeed() {
        #expect(draw(7, 50) == draw(7, 50))
        #expect(draw(7, 5) != draw(8, 5))
    }

    @Test func keepsTwoGeneratorsWithTheSameSeedIndependent() {
        let a = createRng(3)
        let b = createRng(3)
        _ = a()
        _ = a()
        #expect(b() == draw(3, 1)[0])
    }

    @Test func staysInTheUnitIntervalAndIsRoughlyUniform() {
        var buckets = [Int](repeating: 0, count: 10)
        for x in draw(99, 10_000) {
            #expect(x >= 0 && x < 1)
            buckets[Int((x * 10).rounded(.down))] += 1
        }
        #expect(buckets.allSatisfy { $0 > 800 && $0 < 1200 })
    }

    @Test func takesTheSeedAsAnUnsigned32BitInteger() {
        #expect(draw(-1, 3) == draw(4_294_967_295, 3))
        #expect(draw(1.9, 3) == draw(1, 3))
        #expect(draw(4_294_967_297, 3) == draw(1, 3))
    }

    @Test func shufflesToTheReferenceOrderAndLeavesTheInputAlone() {
        let items = ["a", "b", "c", "d", "e", "f", "g", "h"]
        #expect(shuffle(items, createRng(1)) == ["c", "b", "g", "h", "e", "d", "a", "f"])
        #expect(items == ["a", "b", "c", "d", "e", "f", "g", "h"])
        #expect(shuffle(items, createRng(5)).sorted() == items)
        #expect(shuffle(items, createRng(11)) == shuffle(items, createRng(11)))
    }

    @Test func shufflesAnEmptyListAndASingleItemWithoutDrawing() {
        var calls = 0
        let counting: Rng = {
            calls += 1
            return 0.5
        }
        #expect(shuffle([String](), counting) == [])
        #expect(shuffle(["only"], counting) == ["only"])
        #expect(calls == 0)
    }

    @Test func drawsExactlyCountMinusOneValues() {
        var calls = 0
        let counting: Rng = {
            calls += 1
            return 0.5
        }
        _ = shuffle(["a", "b", "c", "d", "e", "f", "g", "h"], counting)
        #expect(calls == 7)
    }

    @Test func canPutEveryItemInEveryPosition() {
        var seenAt: [String: Set<Int>] = [:]
        for seed in 0..<2000 {
            for (position, item) in shuffle(["w", "x", "y", "z"], createRng(Double(seed))).enumerated() {
                seenAt[item, default: []].insert(position)
            }
        }
        #expect(["w", "x", "y", "z"].allSatisfy { seenAt[$0]?.count == 4 })
    }
}
