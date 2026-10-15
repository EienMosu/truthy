import Foundation
import Testing
@testable import TruthyEngine

// tests/tokens/contrast.test.ts on the colours natives draw: native-data/tokens/resolved.json, the file task 8's
// generator reads. Spec 5.9: body text 4.5, large text 3, non-text 3, in both themes.
enum ResolvedTokens {
    nonisolated(unsafe) static let json: [String: Any] = {
        let url = Golden.root.appending(path: "native-data/tokens/resolved.json")
        let data = (try? Data(contentsOf: url)) ?? Data("{}".utf8)
        return (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
    }()

    /// The value at a dot path such as "color.primitive.navy-900".
    static func node(_ path: String) -> Any? {
        path.split(separator: ".").reduce(json as Any?) { node, key in (node as? [String: Any])?[String(key)] }
    }

    /// "#rrggbb" of a colour role in a theme ("day" or "night"), following {references}.
    static func hex(_ theme: String, _ role: String) -> String? {
        var value = (node("color.\(theme).\(role)") as? [String: Any])?["$value"]
        for _ in 0..<8 {
            if let reference = value as? String, reference.hasPrefix("{"), reference.hasSuffix("}") {
                value = (node(String(reference.dropFirst().dropLast())) as? [String: Any])?["$value"]
            } else {
                break
            }
        }
        return ((value as? [String: Any])?["hex"] as? String)?.lowercased()
    }
}

@Suite struct ContrastTests {
    @Test func everyPairReachesItsMinimumInBothThemes() throws {
        #expect(CONTRAST_PAIRS.count == 27)
        for theme in ["day", "night"] {
            for pair in CONTRAST_PAIRS {
                let foreground = try #require(ResolvedTokens.hex(theme, pair.foreground), "\(theme) \(pair.foreground)")
                let background = try #require(ResolvedTokens.hex(theme, pair.background), "\(theme) \(pair.background)")
                let ratio = try #require(contrastRatio(foreground, background))
                #expect(ratio >= contrastMinimum(pair.kind), "\(theme): \(pair.foreground) on \(pair.background) is \(ratio)")
            }
        }
    }

    @Test func theDecidedExceptionsHold() {
        for theme in ["day", "night"] {
            #expect(ResolvedTokens.hex(theme, "focus") == ResolvedTokens.hex(theme, "ink"), "\(theme): the focus colour is ink")
        }
        #expect(CONTRAST_PAIRS.contains(ContrastPair(foreground: "ink", background: "sky-1", kind: .bodyText, usedFor: "start-flow tagline (decision: ink)")))
        #expect(CONTRAST_PAIRS.contains(ContrastPair(foreground: "ink", background: "sky-3", kind: .bodyText, usedFor: "the ready line (decision: ink)")))
    }

    @Test func theRatiosMatchTheDesignSystem() throws {
        #expect(abs(try #require(contrastRatio("#10233f", "#fdfbf5")) - 15.21) < 0.005)
        #expect(abs(try #require(relativeLuminance("#ffffff")) - 1) < 1e-12)
        #expect(relativeLuminance("#000000") == 0)
        #expect(relativeLuminance("#12345") == nil)
    }
}
