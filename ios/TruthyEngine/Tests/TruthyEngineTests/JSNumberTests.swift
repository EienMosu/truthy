import Testing
@testable import TruthyEngine

// The values come from node: `x >>> 0` and `Math.round(x)`.
@Suite struct JSNumberTests {
    @Test(arguments: [
        (0.5, UInt32(0)), (-1, 4_294_967_295), (1.9, 1), (4_294_967_297, 1), (-1.5, 4_294_967_295),
        (2_147_483_648, 2_147_483_648), (.nan, 0), (.infinity, 0), (-.infinity, 0), (1e20, 1_661_992_960),
    ] as [(Double, UInt32)])
    func uint32LikeJavaScript(x: Double, expected: UInt32) {
        #expect(jsUint32(x) == expected)
    }

    @Test(arguments: [
        (0.49999999999999994, 0.0), (0.5, 1), (1.5, 2), (2.5, 3), (-1.5, -1), (-2.5, -2),
        (4_503_599_627_370_497, 4_503_599_627_370_497), (1772.7272727272727, 1773), (1363.6363636363635, 1364),
    ] as [(Double, Double)])
    func roundLikeJavaScript(x: Double, expected: Double) {
        #expect(jsRound(x) == expected)
    }

    @Test func roundKeepsNegativeZeroAsJavaScriptDoes() {
        for x in [-0.5, -0.4, -0.0] {
            let rounded = jsRound(x)
            #expect(rounded == 0 && rounded.sign == .minus, "Math.round(\(x)) is -0")
        }
        #expect(jsRound(0.4).sign == .plus)
        #expect(jsRound(.infinity) == .infinity)
        #expect(jsRound(.nan).isNaN)
    }
}
