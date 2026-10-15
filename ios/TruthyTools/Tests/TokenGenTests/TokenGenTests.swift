import Foundation
import Testing
@testable import TokenGen

// ios/TruthyTools/Tests/TokenGenTests/TokenGenTests.swift: five folders below the repository root.
private let repository = URL(filePath: #filePath)
    .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()

private let fixture = #"""
{
  "color": {
    "primitive": { "navy": { "$value": { "hex": "#10233f" } }, "navy-a32": { "$value": { "hex": "#10233f", "alpha": 0.32 } } },
    "day": { "ink": { "$value": "{color.primitive.navy}" }, "true": { "$value": { "hex": "#1d5cc0" } }, "scrim": { "$value": "{color.primitive.navy-a32}" } },
    "night": { "ink": { "$value": { "hex": "#e6e3da" } }, "true": { "$value": { "hex": "#6f9ae0" } }, "scrim": { "$value": { "hex": "#000000", "alpha": 0.6 } } }
  },
  "font": { "family": { "sans": { "$value": ["Overpass"] }, "mono": { "$value": ["Overpass Mono"] } },
            "weight": { "sans-semibold": { "$value": 600 }, "sans-extrabold": { "$value": 800 }, "mono-semibold": { "$value": 600 } } },
  "typography": {
    "stamp": { "$value": { "fontFamily": "{font.family.sans}", "fontSize": { "value": 24, "unit": "px" }, "fontWeight": "{font.weight.sans-extrabold}", "letterSpacing": { "value": -0.24, "unit": "px" }, "lineHeight": 1.27 } },
    "body": { "$value": { "fontFamily": "{font.family.sans}", "fontSize": { "value": 15.5, "unit": "px" }, "fontWeight": "{font.weight.sans-semibold}", "letterSpacing": { "value": 0, "unit": "px" }, "lineHeight": 1.45 } },
    "carrier-title": { "$value": { "fontFamily": "{font.family.sans}", "fontSize": { "value": 16, "unit": "px" }, "fontWeight": "{font.weight.sans-extrabold}", "letterSpacing": { "value": -0.16, "unit": "px" }, "lineHeight": 1.27 } },
    "carrier-label": { "$value": { "fontFamily": "{font.family.mono}", "fontSize": { "value": 12, "unit": "px" }, "fontWeight": "{font.weight.mono-semibold}", "letterSpacing": { "value": 0.72, "unit": "px" }, "lineHeight": 1.27 } },
    "mono-data-strong": { "$value": { "fontFamily": "{font.family.mono}", "fontSize": { "value": 13, "unit": "px" }, "fontWeight": "{font.weight.mono-semibold}", "letterSpacing": { "value": 0, "unit": "px" }, "lineHeight": 1.27 } },
    "score": { "$value": { "fontFamily": "{font.family.mono}", "fontSize": { "value": 48, "unit": "px" }, "fontWeight": "{font.weight.mono-semibold}", "letterSpacing": { "value": 0.96, "unit": "px" }, "lineHeight": 1 } },
    "emphasis": { "$value": { "fontFamily": "{font.family.sans}", "fontSize": { "value": 16, "unit": "px" }, "fontWeight": "{font.weight.sans-extrabold}", "letterSpacing": { "value": -0.16, "unit": "px" }, "lineHeight": 1.27 } }
  },
  "space": { "4": { "$value": { "value": 4, "unit": "px" } } },
  "size": { "max-width": { "$value": { "value": 430, "unit": "px" } } },
  "radius": { "card": { "$value": { "value": 16, "unit": "px" } } },
  "stroke": { "rule": { "$value": { "value": 1.5, "unit": "px" } } },
  "opacity": { "disabled": { "$value": 0.45 } },
  "elevation": {
    "day": { "small": { "$value": [{ "color": { "hex": "#10233f", "alpha": 0.1 }, "offsetX": { "value": 0, "unit": "px" }, "offsetY": { "value": 1, "unit": "px" }, "blur": { "value": 0, "unit": "px" }, "spread": { "value": 0, "unit": "px" } }] } },
    "night": { "small": { "$value": [{ "color": { "hex": "#000000", "alpha": 0.2 }, "offsetX": { "value": 0, "unit": "px" }, "offsetY": { "value": 6, "unit": "px" }, "blur": { "value": 12, "unit": "px" }, "spread": { "value": -6, "unit": "px" } }] } }
  },
  "motion": {
    "duration": { "t1": { "$value": { "value": 120, "unit": "ms" } } },
    "easing": { "ease": { "$value": [0.2, 0.7, 0.2, 1] } },
    "spring": { "snap": { "$value": {}, "$extensions": { "ch.truthy": { "swiftUI": ".spring(response: 0.33, dampingFraction: 0.6)" } } } },
    "transition": { "stamp": { "$value": { "duration": "{motion.duration.t1}", "delay": { "value": 380, "unit": "ms" }, "timingFunction": "{motion.easing.ease}" } } },
    "gesture": { "rotation-divisor": { "$value": 18 }, "commit-distance": { "$value": { "value": 90, "unit": "px" } } }
  },
  "native": {
    "sky-stops": [0, 0.35, 0.62, 1],
    "sheet": { "offset-y": 24, "duration-reduced-ms": 140, "min-width": 320 },
    "safe-area-short": { "below-height": 568, "top": 8, "bottom": 12 },
    "step-title-row": 36,
    "type": {
      "stub-stamp-size": 28, "new-best-size": 22, "missed-explanation-size": 15, "missed-answer-size": 17,
      "carrier-compact": { "title": 14, "label": 11 }, "source-link-size": 13.5, "score-unit-size": 20, "timed-clock-size": 13,
      "stub-value": { "size": 16, "lineHeight": 1.27 }, "continue-deck-line-height": 1.2
    }
  }
}
"""#

@Suite struct TokenGenTests {
    @Test func theCommittedTokensAreWhatTheGeneratorWrites() throws {
        let resolved = try Data(contentsOf: repository.appending(path: "native-data/tokens/resolved.json"))
        let committed = try String(contentsOf: repository.appending(path: "ios/Truthy/Truthy/Design/Tokens.swift"), encoding: .utf8)
        #expect(try TokenGen.generate(resolved) == committed, "Tokens.swift is stale: run swift run --package-path ios/TruthyTools generate-tokens")
    }

    @Test func followsReferencesAndKeepsAlpha() throws {
        let text = try TokenGen.generate(Data(fixture.utf8))
        #expect(text.contains("ink: TokenColor(red: 0.06274509803921569, green: 0.13725490196078433, blue: 0.24705882352941178, opacity: 1)"))
        #expect(text.contains("scrim: TokenColor(red: 0.06274509803921569, green: 0.13725490196078433, blue: 0.24705882352941178, opacity: 0.32)"))
        #expect(text.contains("let answerTrue: TokenColor"))
    }

    @Test func writesEveryGroupInSwiftUnits() throws {
        let text = try TokenGen.generate(Data(fixture.utf8))
        #expect(text.contains("static let s4: Double = 4"))
        #expect(text.contains("static let maxWidth: Double = 430"))
        #expect(text.contains("static let t1: Double = 0.12"))
        #expect(text.contains("static let ease = CubicCurve(x1: 0.2, y1: 0.7, x2: 0.2, y2: 1)"))
        #expect(text.contains("static let snap = SpringSpec(response: 0.33, dampingFraction: 0.6)"))
        #expect(text.contains("static let rotationDivisor: Double = 18"))
        #expect(text.contains("ShadowLayer(color: TokenColor(red: 0, green: 0, blue: 0, opacity: 0.2), x: 0, y: 6, blur: 12, spread: -6)"))
    }

    @Test func writesTheTypeRolesAndTheCodeVariants() throws {
        let text = try TokenGen.generate(Data(fixture.utf8))
        #expect(text.contains("static let stamp = TypeStyle(family: .sans, weight: 800, size: 24, lineHeight: 1.27, letterSpacing: -0.24)"))
        #expect(text.contains("static let stampStub = TypeStyle(family: .sans, weight: 800, size: 28, lineHeight: 1.27, letterSpacing: -0.24)"))
        #expect(text.contains("static let carrierLabelCompact = TypeStyle(family: .mono, weight: 600, size: 11, lineHeight: 1.27, letterSpacing: 0.66)"))
        #expect(text.contains("static let scoreUnit = TypeStyle(family: .mono, weight: 600, size: 20, lineHeight: 1.27, letterSpacing: 0)"))
    }

    @Test func writesTheNativeGroupAndTheTransitions() throws {
        let text = try TokenGen.generate(Data(fixture.utf8))
        #expect(text.contains("static let skyStops: [Double] = [0, 0.35, 0.62, 1]"))
        #expect(text.contains("static let shortScreenBelow: Double = 568"))
        #expect(text.contains("static let sheetReducedDuration: Double = 0.14"))
        #expect(text.contains("static let stepTitleRow: Double = 36"))
        #expect(text.contains("static let stamp = (duration: 0.12, delay: 0.38)"))
        // A changed native size reaches the code variant: nothing reads it from a table of numbers.
        let bigger = fixture.replacingOccurrences(of: #""stub-stamp-size": 28"#, with: #""stub-stamp-size": 30"#)
        #expect(try TokenGen.generate(Data(bigger.utf8)).contains("static let stampStub = TypeStyle(family: .sans, weight: 800, size: 30,"))
    }

    @Test func refusesThemesWithDifferentRoles() throws {
        let broken = fixture.replacingOccurrences(of: #""night": { "ink""#, with: #""night": { "inky""#)
        #expect(throws: TokenError.self) { try TokenGen.generate(Data(broken.utf8)) }
    }

    @Test func theSameTokensGiveTheSameText() throws {
        #expect(try TokenGen.generate(Data(fixture.utf8)) == TokenGen.generate(Data(fixture.utf8)))
    }
}
