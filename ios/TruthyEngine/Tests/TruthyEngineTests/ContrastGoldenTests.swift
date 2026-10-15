import Foundation
import Testing
@testable import TruthyEngine

// native-data/golden/design.system.tokens.contrastPairs: the web's pairs, colours, ratios and verdicts, against the
// engine's list and arithmetic and against the resolved tokens natives draw from.
private typealias G = ProgressGolden

private func round2(_ x: Double) -> Double { (x * 100).rounded() / 100 }

@Suite struct ContrastGoldenTests {
    @Test func thePairsMatchTheWebInBothThemes() throws {
        let file = try Golden.load("design/system/tokens", "contrastPairs")
        let pairs = try G.required(file.cases[0].output, "pairs").array()
        #expect(pairs.count == CONTRAST_PAIRS.count * 2)
        for (i, entry) in pairs.enumerated() {
            let expected = CONTRAST_PAIRS[i % CONTRAST_PAIRS.count]
            let theme = try G.required(entry, "theme").string()
            #expect(theme == (i < CONTRAST_PAIRS.count ? "day" : "night"))
            #expect(try G.required(entry, "foreground").string() == expected.foreground)
            #expect(try G.required(entry, "background").string() == expected.background)
            #expect(try G.required(entry, "kind").string() == expected.kind.rawValue)
            let foreground = try G.required(entry, "foregroundHex").string().lowercased()
            let background = try G.required(entry, "backgroundHex").string().lowercased()
            #expect(foreground == ResolvedTokens.hex(theme, expected.foreground), "\(theme) \(expected.foreground): the native colour")
            #expect(background == ResolvedTokens.hex(theme, expected.background), "\(theme) \(expected.background): the native colour")
            let ratio = try #require(contrastRatio(foreground, background))
            #expect(round2(ratio) == (try G.required(entry, "ratio").number()), "\(theme) \(expected.foreground) on \(expected.background)")
            #expect(contrastMinimum(expected.kind) == (try G.required(entry, "minimum").number()))
            #expect((ratio >= contrastMinimum(expected.kind)) == (try G.required(entry, "passes").bool()))
        }
        for entry in try G.required(file.cases[0].output, "listed").array() {
            let ratio = try #require(contrastRatio(try G.required(entry, "foregroundHex").string(), try G.required(entry, "backgroundHex").string()))
            #expect(round2(ratio) == (try G.required(entry, "ratio").number()))
        }
    }
}
