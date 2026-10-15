import Testing
@testable import TruthyEngine

// Values from node: String(x), Math.max, Math.min.
@Suite struct JSMathTests {
    @Test func numbersAreWrittenAsJavaScriptWritesThem() {
        let cases: [(Double, String)] = [
            (60, "60"), (138, "138"), (-6, "-6"), (0.5, "0.5"), (23.85, "23.85"), (-0.0, "0"), (0.1 + 0.2, "0.30000000000000004"),
            (0.00001, "0.00001"), (1e-7, "1e-7"), (1.5e-7, "1.5e-7"), (1e21, "1e+21"), (1.2345e22, "1.2345e+22"),
            (1.2345678901234568e20, "123456789012345680000"), (.infinity, "Infinity"), (-.infinity, "-Infinity"), (.nan, "NaN"),
        ]
        for (x, text) in cases { #expect(jsNumberString(x) == text, "\(x)") }
        #expect(jsMathMax(0, -0.0).sign == .plus)
        #expect(jsMathMin(0, -0.0).sign == .minus)
        #expect(jsMathMax(1, .nan).isNaN)
        #expect(jsMathMin(.nan, 1).isNaN)
    }
}
