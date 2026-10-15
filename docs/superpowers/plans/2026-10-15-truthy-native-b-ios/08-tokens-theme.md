### Task 8: The token generator, `Tokens.swift`, type roles, motion and theme resolution

The design system reaches the app as generated code (spec 4.3 and 6): `ios/TruthyTools` is a small Swift package whose `generate-tokens` turns `native-data/tokens/resolved.json` (the tokens with reference 5.0's overrides applied) into `ios/Truthy/Truthy/Design/Tokens.swift`: the colours of both themes, the shadows, spacing, sizes, radii, strokes, opacities, durations, curves, springs, gesture numbers and the type roles, plus the code-only type variants reference 5.0 lists. A test fails when the committed file differs from what the generator would write. On top of the tokens this task writes the type roles as fonts (Overpass by PostScript name, the weight explicit, scaled with Dynamic Type), the motion helpers, and the theme resolution that decides, before the first frame, which theme the app shows (README Review Focus line 2).

Builds on task 7 (the project and its fonts) and plan A (`native-data/tokens/resolved.json`).

**Files:**
- Create: `ios/TruthyTools/Package.swift`, `ios/TruthyTools/Sources/TokenGen/TokenGen.swift`, `ios/TruthyTools/Sources/GenerateTokens/main.swift`, `ios/TruthyTools/Tests/TokenGenTests/TokenGenTests.swift`
- Create (generated, committed): `ios/Truthy/Truthy/Design/Tokens.swift`
- Create (app): `ios/Truthy/Truthy/Design/Motion.swift`, `ios/Truthy/Truthy/Design/Typography.swift`, `ios/Truthy/Truthy/Design/Theme.swift`
- Test: create `ios/Truthy/TruthyTests/ThemeResolutionTests.swift`

**Interfaces:**
- Consumes: `native-data/tokens/resolved.json` (DTCG: `color.primitive|day|night`, `typography`, `space`, `size`, `radius`, `stroke`, `opacity`, `elevation.day|night`, `motion.duration|easing|spring|transition|gesture`, and plan A's additive top-level `native` group of plain values: `sky-stops`, `sheet`, `safe-area-short`, `step-title-row`, `type`; references as `{a.b.c}`; colours as `{hex, alpha?}`; dimensions as `{value, unit}`); task 1's `resolveTheme`; task 7's `StoredTheme` and `ResolvedTheme`.
- Produces (app target, used by tasks 10 to 14):

```swift
// Design/Tokens.swift (generated)
struct TokenColor: Equatable, Sendable { let red, green, blue, opacity: Double; var color: Color }
struct ShadowLayer: Equatable, Sendable { let color: TokenColor; let x, y, blur, spread: Double }
enum FontFamily { case sans, mono }
struct TypeStyle: Equatable, Sendable { let family: FontFamily; let weight: Int; let size: Double; let lineHeight: Double; let letterSpacing: Double }
struct CubicCurve: Equatable, Sendable { let x1, y1, x2, y2: Double }
struct SpringSpec: Equatable, Sendable { let response: Double; let dampingFraction: Double }
struct Palette: Equatable, Sendable { accent, answerFalse, answerTrue, cloud, correct, focus, focusOnFill, ink, inkMuted, onAccent, onDark, press, rule, scrim, sky1, sky2, sky3, sky4, surface, surfaceRaised, surfaceSunk, surfaceSunkClear, wrong: TokenColor }
struct ShadowSet: Equatable, Sendable { button, press, sheet, small, ticket: [ShadowLayer] }
enum Tokens {
    static let day, night: Palette; static let dayShadows, nightShadows: ShadowSet
    enum Space { s2 ... s24 }; enum Size { maxWidth (430), pill, header, ... }; enum Radius; enum Stroke; enum Opacity
    enum Duration { t1 ... (seconds) }; enum Curve { ease, easeIn, easeOut, fall, spring }; enum Spring { snap, land, landFast }
    enum Gesture { commitDistance, intentDistance, rotationDivisor, stubPull, intentOpacityGain }
    enum Transition { answerRow, jolt, stamp, tear, timedDeal, timedLeave, ... : (duration: Double, delay: Double) in seconds }   // motion.transition
    enum Native { skyStops: [Double]; sheetOffsetY, sheetReducedDuration (seconds), sheetMinWidth, shortScreenBelow, shortSafeTop,
                  shortSafeBottom, stepTitleRow: Double }                                                                         // the native group
    enum TypeRole { every role of tokens.json (logo, stepTitle, cardStatement, ...) and the code variants stampStub, stampResult,
                     missedExplanation, missedAnswer, carrierTitleCompact, carrierLabelCompact, sourceLink, scoreUnit, timedClock,
                     cardStubValue, continueDeckName }
}

// Design/Typography.swift
extension TypeStyle { var postScriptName: String; var textStyle: Font.TextStyle; var font: Font; var extraLineSpacing: Double }
extension View { func typeRole(_ style: TypeStyle) -> some View }

// Design/Motion.swift
extension CubicCurve { func animation(_ duration: Double, delay: Double = 0) -> Animation; func value(at t: Double) -> Double }
extension SpringSpec { var animation: Animation; func animation(initialVelocity: Double) -> Animation }

// Design/Theme.swift
enum ThemeResolution { static func resolved(stored:system:) -> ResolvedTheme; static func preferredScheme(stored:) -> ColorScheme?;
                        static func scheme(_:) -> ColorScheme; static func palette(_:) -> Palette; static func shadows(_:) -> ShadowSet }
extension EnvironmentValues { var palette: Palette; var shadows: ShadowSet; var resolvedTheme: ResolvedTheme }
struct ThemedRoot<Content: View>: View { init(stored: StoredTheme?, content: (ResolvedTheme) -> Content) }
```

  The Swift names are the token keys in lower camel case; `true` and `false` (Swift keywords) are `answerTrue` and `answerFalse`; a spacing key that starts with a digit gets an `s` (`space.4` is `Tokens.Space.s4`). Members are sorted by key, because a JSON object has no order the generator could rely on.

**Rules:**

1. **The one source.** Every colour, size, duration, curve and spring a view uses comes from `Tokens.swift` (README global constraint); task 7's `AppSourceRulesTests` rejects literal colours and font sizes in every other app file. The code values that win over a role's own size (reference 5.0 and 5.3: the stub stamp at 28 and the result's New best at 22, the missed explanation at 15 and its answer word at Sans 800 17, the compact band at 14 and 11, the source link at 13.5, the score unit at 20, the Timed clock at 13, the card stub value at 16, the continue line's deck name at line height 1.2) are a table in the generator of paths into `native.type` of `resolved.json` (never numbers), applied to their base roles; the one number the table holds is the compact carrier label's tracking 0.66 (`tracking-[0.06em]` at 11 px in `FillInPass.tsx`, not the role's 0.72). The generator also writes `Tokens.Native` (the sky gradient stops, the sheet's offset, reduced duration and minimum width, the short-screen rule below 568 with 8 and 12, the 36 step-title row) and `Tokens.Transition` (each `motion.transition` as duration and delay in seconds: the stamp after 380 ms, the answer row after 360, the jolt after 420, the tear, the Timed leave and deal); tasks 10, 12, 13 and 14 read these and write the numbers nowhere else (README, "Cross-platform agreements"). Letter spacing stays in points, as the web keeps it in px.
2. **Fresh or failing.** `TokenGenTests.theCommittedTokensAreWhatTheGeneratorWrites` compares the committed `Tokens.swift` byte for byte with the generator's output for the committed `resolved.json`. A token change goes: plan A re-export, `swift run --package-path ios/TruthyTools generate-tokens`, commit both.
3. **Fonts.** A role draws with `Font.custom(<PostScript name>, size:, relativeTo:)`: the four names task 7 checked, by family and weight (sans 600 `OverpassRoman-SemiBold`, sans 800 `OverpassRoman-ExtraBold`, mono 400 `OverpassMono-Regular`, mono 600 `OverpassMono-SemiBold`, the names task 7's instanced files carry), scaled with the text style of about the same size. Overpass's own line height is about 1.27 (reference 5.3). The box follows CSS half-leading: `typeRole` adds the leading beyond 1.27 between lines and half of it above and below the text, scaled with the text; a role under 1.27 (logo, score and leg code at 1, deck code, card name and the continue deck name at 1.2) gets a negative half, which trims the box as CSS does. `extraLineSpacing` stays `max(0, ...)` for callers that set line spacing themselves.
4. **The theme before the first frame.** `ThemedRoot` resolves the theme from the stored choice (task 9 reads it synchronously at launch) and the system appearance, hands the palette down through the environment and asks the window for the stored scheme with `preferredColorScheme`, so the status bar follows the app's theme (spec 5.6, N12); with nothing stored it asks for nothing and the system decides. The launch screen alone follows the system (task 7's `LaunchSurface`).
5. **Springs** are SwiftUI's `.spring(response:dampingFraction:)` of reference 5.7; a spring started with a velocity uses the equivalent `interpolatingSpring` (stiffness `(2 pi / response)^2`, damping `4 pi dampingFraction / response`, mass 1).

**Review focus.** README line 2: `ThemeResolutionTests` pins the resolution (stored dark under a light system shows dark, stored light under a dark system shows light, nothing stored follows the system); task 15 checks the screenshots (N12) and the launch recording (N10).

**Steps:**

- [ ] **Step 1: Check the starting point.**

```bash
git status --short
test -f native-data/tokens/resolved.json && echo resolved-present
python3 -c 'import json; t = json.load(open("native-data/tokens/resolved.json")); print(t["size"]["max-width"]["$value"], t["typography"]["list-title"]["$value"]["lineHeight"])'
xcodebuild test -project ios/Truthy/Truthy.xcodeproj -scheme Truthy -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5' 2>&1 | grep -E 'TEST (SUCCEEDED|FAILED)'
```

Expected: nothing from `git status --short`; `resolved-present`; `{'value': 430, 'unit': 'px'} 1.25` (the overrides of reference 5.0 are applied: if this prints 390 or 1.2, the file is plan A's raw tokens and the generator would bake in stale values: stop); `** TEST SUCCEEDED **`.

- [ ] **Step 2: Write the generator package and its tests.**

`ios/TruthyTools/Package.swift`:

```swift
// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "TruthyTools",
    platforms: [.macOS(.v15)],
    products: [
        .executable(name: "generate-tokens", targets: ["GenerateTokens"]),
    ],
    targets: [
        .target(name: "TokenGen"),
        .executableTarget(name: "GenerateTokens", dependencies: ["TokenGen"]),
        .testTarget(name: "TokenGenTests", dependencies: ["TokenGen"]),
    ],
    swiftLanguageModes: [.v6]
)
```

`ios/TruthyTools/Tests/TokenGenTests/TokenGenTests.swift`:

```swift
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
```

- [ ] **Step 3: Run the tests and see them fail.**

```bash
swift build --package-path ios/TruthyTools --build-tests 2>&1 | grep -E 'error:' | head -3
```

Expected: `error: cannot find 'TokenGen' in scope` (the target has no source yet; SwiftPM may first say the target `TokenGen` has no sources: write step 4's files and build again).

- [ ] **Step 4: Write the generator.**

`ios/TruthyTools/Sources/TokenGen/TokenGen.swift`:

```swift
import Foundation

// Turns native-data/tokens/resolved.json (design/system/tokens.json with the overrides of reference 5.0 applied) into
// the Swift source of ios/Truthy/Truthy/Design/Tokens.swift. Pure: JSON in, text out; the same tokens always give the
// same text, so a test can compare the committed file with what the generator would write.

public struct TokenError: Error, CustomStringConvertible {
    public let description: String
}

public enum TokenGen {
    /// The code values that win where the web draws a role at another size (reference 5.0 and 5.3), as changes to
    /// a base role: name, base role, then the paths into resolved.json's native.type for the size and the line height,
    /// the weight and the letter spacing (nil keeps the base value). The only number here is the compact carrier
    /// label's tracking: tracking-[0.06em] at 11 px is 0.66 (FillInPass.tsx), not the role's 0.72.
    static let codeVariants: [(name: String, base: String, size: String?, weight: Int?, lineHeight: String?, letterSpacing: Double?)] = [
        ("stampStub", "stamp", "native.type.stub-stamp-size", nil, nil, nil),
        ("stampResult", "stamp", "native.type.new-best-size", nil, nil, nil),
        ("missedExplanation", "body", "native.type.missed-explanation-size", nil, nil, nil),
        ("missedAnswer", "body", "native.type.missed-answer-size", 800, "native.type.stub-value.lineHeight", nil),
        ("carrierTitleCompact", "carrier-title", "native.type.carrier-compact.title", nil, nil, nil),
        ("carrierLabelCompact", "carrier-label", "native.type.carrier-compact.label", nil, nil, 0.66),
        ("sourceLink", "mono-data-strong", "native.type.source-link-size", nil, nil, nil),
        ("scoreUnit", "score", "native.type.score-unit-size", nil, "native.type.stub-value.lineHeight", 0),
        ("timedClock", "mono-data-strong", "native.type.timed-clock-size", nil, nil, nil),
        ("cardStubValue", "mono-data-strong", "native.type.stub-value.size", nil, "native.type.stub-value.lineHeight", nil),
        ("continueDeckName", "emphasis", nil, nil, "native.type.continue-deck-line-height", nil),
    ]

    /// Tokens.Native: plain values of the native group, by Swift name, path and the factor that turns them into the
    /// unit the app uses (milliseconds become seconds).
    static let nativeValues: [(name: String, path: String, scale: Double)] = [
        ("sheetOffsetY", "native.sheet.offset-y", 1),
        ("sheetReducedDuration", "native.sheet.duration-reduced-ms", 0.001),
        ("sheetMinWidth", "native.sheet.min-width", 1),
        ("shortScreenBelow", "native.safe-area-short.below-height", 1),
        ("shortSafeTop", "native.safe-area-short.top", 1),
        ("shortSafeBottom", "native.safe-area-short.bottom", 1),
        ("stepTitleRow", "native.step-title-row", 1),
    ]

    public static func generate(_ json: Data) throws -> String {
        guard let root = try JSONSerialization.jsonObject(with: json) as? [String: Any] else {
            throw TokenError(description: "the tokens are not a JSON object")
        }
        let tokens = Tokens(root: root)
        var lines: [String] = []
        lines.append("// Generated by ios/TruthyTools from native-data/tokens/resolved.json. Do not edit: change the tokens or")
        lines.append("// scripts/native-token-overrides.json, export again, and run generate-tokens (task 8).")
        lines.append("import SwiftUI")
        lines.append("")
        lines.append(contentsOf: Self.prelude)
        lines.append("")
        let roles = try tokens.colourRoles()
        lines.append("struct Palette: Equatable, Sendable {")
        for role in roles { lines.append("    let \(swiftName(role)): TokenColor") }
        lines.append("}")
        lines.append("")
        let shadowNames = try tokens.keys("elevation.day")
        lines.append("struct ShadowSet: Equatable, Sendable {")
        for name in shadowNames { lines.append("    let \(swiftName(name)): [ShadowLayer]") }
        lines.append("}")
        lines.append("")
        lines.append("enum Tokens {")
        for theme in ["day", "night"] {
            lines.append("    static let \(theme) = Palette(")
            let entries = try roles.map { "        \(swiftName($0)): \(try tokens.colour("color.\(theme).\($0)"))" }
            lines.append(entries.joined(separator: ",\n"))
            lines.append("    )")
            lines.append("")
            lines.append("    static let \(theme)Shadows = ShadowSet(")
            let shadows = try shadowNames.map { name in
                let layers = try tokens.shadow("elevation.\(theme).\(name)")
                return "        \(swiftName(name)): [\(layers.joined(separator: ", "))]"
            }
            lines.append(shadows.joined(separator: ",\n"))
            lines.append("    )")
            lines.append("")
        }
        for (group, path, unitless) in [("Space", "space", false), ("Size", "size", false), ("Radius", "radius", false),
                                        ("Stroke", "stroke", false), ("Opacity", "opacity", true)] {
            lines.append("    enum \(group) {")
            for key in try tokens.keys(path) {
                let value = try unitless ? tokens.number("\(path).\(key)") : tokens.dimension("\(path).\(key)")
                lines.append("        static let \(swiftName(group == "Space" ? "s\(key)" : key)): Double = \(literal(value))")
            }
            lines.append("    }")
            lines.append("")
        }
        lines.append("    enum Duration {")
        for key in try tokens.keys("motion.duration") {
            lines.append("        static let \(swiftName(key)): Double = \(literal(try tokens.milliseconds("motion.duration.\(key)") / 1000))")
        }
        lines.append("    }")
        lines.append("")
        lines.append("    enum Curve {")
        for key in try tokens.keys("motion.easing") {
            let points = try tokens.bezier("motion.easing.\(key)")
            lines.append("        static let \(swiftName(key)) = CubicCurve(x1: \(literal(points[0])), y1: \(literal(points[1])), x2: \(literal(points[2])), y2: \(literal(points[3])))")
        }
        lines.append("    }")
        lines.append("")
        lines.append("    enum Spring {")
        for key in try tokens.keys("motion.spring") {
            let spring = try tokens.spring("motion.spring.\(key)")
            lines.append("        static let \(swiftName(key)) = SpringSpec(response: \(literal(spring.response)), dampingFraction: \(literal(spring.damping)))")
        }
        lines.append("    }")
        lines.append("")
        lines.append("    enum Gesture {")
        for key in try tokens.keys("motion.gesture") {
            let value = try tokens.numberOrDimension("motion.gesture.\(key)")
            lines.append("        static let \(swiftName(key)): Double = \(literal(value))")
        }
        lines.append("    }")
        lines.append("")
        lines.append("    enum Transition {")
        for key in try tokens.keys("motion.transition") {
            let timing = try tokens.transition("motion.transition.\(key)")
            lines.append("        static let \(swiftName(key)) = (duration: \(literal(timing.duration)), delay: \(literal(timing.delay)))")
        }
        lines.append("    }")
        lines.append("")
        lines.append("    enum Native {")
        let stops = try tokens.plainList("native.sky-stops").map(literal).joined(separator: ", ")
        lines.append("        static let skyStops: [Double] = [\(stops)]")
        for value in nativeValues {
            lines.append("        static let \(value.name): Double = \(literal(try tokens.plain(value.path) * value.scale))")
        }
        lines.append("    }")
        lines.append("")
        lines.append("    enum TypeRole {")
        var styles: [String: Style] = [:]
        for key in try tokens.keys("typography") {
            let style = try tokens.typography("typography.\(key)")
            styles[key] = style
            lines.append("        static let \(swiftName(key)) = \(style.swift)")
        }
        for variant in codeVariants {
            guard var style = styles[variant.base] else { throw TokenError(description: "no base role \(variant.base) for \(variant.name)") }
            if let size = variant.size { style.size = try tokens.plain(size) }
            if let weight = variant.weight { style.weight = weight }
            if let lineHeight = variant.lineHeight { style.lineHeight = try tokens.plain(lineHeight) }
            if let spacing = variant.letterSpacing { style.letterSpacing = spacing }
            lines.append("        static let \(variant.name) = \(style.swift)")
        }
        lines.append("    }")
        lines.append("}")
        return lines.joined(separator: "\n") + "\n"
    }

    static let prelude = [
        "/// An sRGB colour with its opacity, as the tokens give it.",
        "struct TokenColor: Equatable, Sendable {",
        "    let red: Double",
        "    let green: Double",
        "    let blue: Double",
        "    let opacity: Double",
        "",
        "    var color: Color { Color(.sRGB, red: red, green: green, blue: blue, opacity: opacity) }",
        "}",
        "",
        "/// One layer of a CSS box shadow: offset, blur and spread in points.",
        "struct ShadowLayer: Equatable, Sendable {",
        "    let color: TokenColor",
        "    let x: Double",
        "    let y: Double",
        "    let blur: Double",
        "    let spread: Double",
        "}",
        "",
        "enum FontFamily: Equatable, Sendable {",
        "    case sans, mono",
        "}",
        "",
        "/// A type role: family, weight, size in points, line height as a multiple of the size, letter spacing in points.",
        "struct TypeStyle: Equatable, Sendable {",
        "    let family: FontFamily",
        "    let weight: Int",
        "    let size: Double",
        "    let lineHeight: Double",
        "    let letterSpacing: Double",
        "}",
        "",
        "/// A CSS cubic-bezier timing curve.",
        "struct CubicCurve: Equatable, Sendable {",
        "    let x1: Double",
        "    let y1: Double",
        "    let x2: Double",
        "    let y2: Double",
        "}",
        "",
        "/// A native spring (reference 5.7): response in seconds and damping.",
        "struct SpringSpec: Equatable, Sendable {",
        "    let response: Double",
        "    let dampingFraction: Double",
        "}",
    ]

    /// "surface-raised" -> "surfaceRaised"; "true" and "false" are Swift keywords, so the answer colours are
    /// answerTrue and answerFalse; a name that starts with a digit gets an "s" in front by the caller.
    static func swiftName(_ key: String) -> String {
        if key == "true" { return "answerTrue" }
        if key == "false" { return "answerFalse" }
        let parts = key.split(whereSeparator: { $0 == "-" || $0 == "_" || $0 == "." })
        guard let first = parts.first else { return key }
        return first.lowercased() + parts.dropFirst().map { $0.prefix(1).uppercased() + $0.dropFirst() }.joined()
    }

    /// A number as Swift source: integers without a fraction, other values as Swift writes them.
    static func literal(_ value: Double) -> String {
        if value == value.rounded() && abs(value) < 1e15 { return String(Int(value)) }
        return String(value)
    }
}

struct Style {
    var family: String
    var weight: Int
    var size: Double
    var lineHeight: Double
    var letterSpacing: Double

    var swift: String {
        "TypeStyle(family: .\(family), weight: \(weight), size: \(TokenGen.literal(size)), lineHeight: \(TokenGen.literal(lineHeight)), letterSpacing: \(TokenGen.literal(letterSpacing)))"
    }
}

/// Reading the DTCG tree: dot paths, {references}, and the value shapes tokens.json uses.
struct Tokens {
    let root: [String: Any]

    /// The node at a dot path; a key that is a whole number indexes an array ("native.sky-stops.0").
    func node(_ path: String) throws -> Any {
        var node: Any = root
        for key in path.split(separator: ".") {
            if let list = node as? [Any], let index = Int(key), list.indices.contains(index) {
                node = list[index]
                continue
            }
            guard let object = node as? [String: Any], let next = object[String(key)] else {
                throw TokenError(description: "no token at \(path)")
            }
            node = next
        }
        return node
    }

    /// A plain number of the native group (no $value, no unit).
    func plain(_ path: String) throws -> Double {
        guard let number = try node(path) as? NSNumber else { throw TokenError(description: "\(path) is not a number") }
        return number.doubleValue
    }

    func plainList(_ path: String) throws -> [Double] {
        guard let list = try node(path) as? [NSNumber] else { throw TokenError(description: "\(path) is not a list of numbers") }
        return list.map(\.doubleValue)
    }

    /// A transition's duration and delay in seconds; each is a {value, unit: ms} or a reference to a duration token.
    func transition(_ path: String) throws -> (duration: Double, delay: Double) {
        guard let timing = try value(path) as? [String: Any] else { throw TokenError(description: "\(path) is not a transition") }
        func seconds(_ key: String) throws -> Double {
            if let reference = timing[key] as? String, reference.hasPrefix("{") {
                return try milliseconds(String(reference.dropFirst().dropLast())) / 1000
            }
            return try dimensionValue(timing[key] as Any, "\(path).\(key)", unit: "ms") / 1000
        }
        return (try seconds("duration"), try seconds("delay"))
    }

    /// The token's $value, following references such as "{color.primitive.navy-900}".
    func value(_ path: String) throws -> Any {
        guard let token = try node(path) as? [String: Any], let value = token["$value"] else {
            throw TokenError(description: "\(path) has no $value")
        }
        if let reference = value as? String, reference.hasPrefix("{"), reference.hasSuffix("}") {
            return try self.value(String(reference.dropFirst().dropLast()))
        }
        return value
    }

    /// The child keys of a group that are tokens, sorted (JSON objects have no order the generator could rely on).
    func keys(_ path: String) throws -> [String] {
        guard let group = try node(path) as? [String: Any] else { throw TokenError(description: "\(path) is not a group") }
        return group.keys.filter { !$0.hasPrefix("$") }.sorted()
    }

    func colourRoles() throws -> [String] {
        let day = Set(try keys("color.day"))
        let night = Set(try keys("color.night"))
        guard day == night else { throw TokenError(description: "the day and night colours differ: \(day.symmetricDifference(night).sorted())") }
        return day.sorted()
    }

    func colourLiteral(_ object: Any, _ path: String) throws -> String {
        guard let colour = object as? [String: Any], let hex = colour["hex"] as? String else {
            throw TokenError(description: "\(path) is not a colour")
        }
        let digits = Array(hex.dropFirst())
        guard hex.hasPrefix("#"), digits.count == 6, let value = Int(String(digits), radix: 16) else {
            throw TokenError(description: "\(path): \(hex) is not #rrggbb")
        }
        let channel = { (shift: Int) in TokenGen.literal(Double((value >> shift) & 0xff) / 255) }
        let alpha = (colour["alpha"] as? Double) ?? (colour["alpha"] as? Int).map(Double.init) ?? 1
        return "TokenColor(red: \(channel(16)), green: \(channel(8)), blue: \(channel(0)), opacity: \(TokenGen.literal(alpha)))"
    }

    func colour(_ path: String) throws -> String {
        try colourLiteral(try value(path), path)
    }

    func shadow(_ path: String) throws -> [String] {
        guard let layers = try value(path) as? [[String: Any]] else { throw TokenError(description: "\(path) is not a shadow") }
        return try layers.map { layer in
            let measure = { (key: String) throws -> String in
                guard let dimension = layer[key] as? [String: Any], let number = dimension["value"] as? Double ?? (dimension["value"] as? Int).map(Double.init) else {
                    throw TokenError(description: "\(path).\(key) is not a dimension")
                }
                return TokenGen.literal(number)
            }
            return "ShadowLayer(color: \(try colourLiteral(layer["color"] as Any, path)), x: \(try measure("offsetX")), y: \(try measure("offsetY")), blur: \(try measure("blur")), spread: \(try measure("spread")))"
        }
    }

    func dimensionValue(_ any: Any, _ path: String, unit: String) throws -> Double {
        guard let dimension = any as? [String: Any], dimension["unit"] as? String == unit,
              let number = dimension["value"] as? Double ?? (dimension["value"] as? Int).map(Double.init) else {
            throw TokenError(description: "\(path) is not a dimension in \(unit)")
        }
        return number
    }

    func dimension(_ path: String) throws -> Double { try dimensionValue(try value(path), path, unit: "px") }
    func milliseconds(_ path: String) throws -> Double { try dimensionValue(try value(path), path, unit: "ms") }

    func number(_ path: String) throws -> Double {
        let raw = try value(path)
        guard let number = raw as? Double ?? (raw as? Int).map(Double.init) else { throw TokenError(description: "\(path) is not a number") }
        return number
    }

    func numberOrDimension(_ path: String) throws -> Double {
        let raw = try value(path)
        if let number = raw as? Double ?? (raw as? Int).map(Double.init) { return number }
        return try dimensionValue(raw, path, unit: "px")
    }

    func bezier(_ path: String) throws -> [Double] {
        guard let points = try value(path) as? [Any], points.count == 4 else { throw TokenError(description: "\(path) is not a cubic bezier") }
        return try points.map { point in
            guard let number = point as? Double ?? (point as? Int).map(Double.init) else { throw TokenError(description: "\(path) has a point that is not a number") }
            return number
        }
    }

    /// The SwiftUI spring the tokens record in $extensions.ch.truthy.swiftUI: ".spring(response: 0.33, dampingFraction: 0.6)".
    func spring(_ path: String) throws -> (response: Double, damping: Double) {
        guard let token = try node(path) as? [String: Any],
              let extensions = (token["$extensions"] as? [String: Any])?["ch.truthy"] as? [String: Any],
              let text = extensions["swiftUI"] as? String else {
            throw TokenError(description: "\(path) has no SwiftUI spring")
        }
        let numbers = text.split(whereSeparator: { !"0123456789.".contains($0) }).compactMap { Double($0) }
        guard numbers.count == 2 else { throw TokenError(description: "\(path): cannot read \(text)") }
        return (numbers[0], numbers[1])
    }

    func typography(_ path: String) throws -> Style {
        guard let style = try value(path) as? [String: Any] else { throw TokenError(description: "\(path) is not a typography token") }
        let familyPath = (style["fontFamily"] as? String).map { String($0.dropFirst().dropLast()) } ?? ""
        let family = familyPath.hasSuffix("mono") ? "mono" : "sans"
        let weight: Int
        if let reference = style["fontWeight"] as? String {
            weight = Int(try number(String(reference.dropFirst().dropLast())))
        } else {
            weight = style["fontWeight"] as? Int ?? 600
        }
        let size = try dimensionValue(style["fontSize"] as Any, "\(path).fontSize", unit: "px")
        let spacing = try dimensionValue(style["letterSpacing"] as Any, "\(path).letterSpacing", unit: "px")
        guard let lineHeight = style["lineHeight"] as? Double ?? (style["lineHeight"] as? Int).map(Double.init) else {
            throw TokenError(description: "\(path).lineHeight is not a number")
        }
        return Style(family: family, weight: weight, size: size, lineHeight: lineHeight, letterSpacing: spacing)
    }
}
```

`ios/TruthyTools/Sources/GenerateTokens/main.swift`:

```swift
import Foundation
import TokenGen

// swift run --package-path ios/TruthyTools generate-tokens [repository root]
// Reads native-data/tokens/resolved.json and writes ios/Truthy/Truthy/Design/Tokens.swift.
let root = URL(fileURLWithPath: CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : FileManager.default.currentDirectoryPath)
let input = root.appending(path: "native-data/tokens/resolved.json")
let output = root.appending(path: "ios/Truthy/Truthy/Design/Tokens.swift")
do {
    let text = try TokenGen.generate(Data(contentsOf: input))
    try FileManager.default.createDirectory(at: output.deletingLastPathComponent(), withIntermediateDirectories: true)
    try Data(text.utf8).write(to: output, options: .atomic)
    print("wrote ios/Truthy/Truthy/Design/Tokens.swift, \(text.split(separator: "\n").count) lines")
} catch {
    FileHandle.standardError.write(Data("generate-tokens: \(error)\n".utf8))
    exit(1)
}
```

- [ ] **Step 5: Generate `Tokens.swift` and run the generator's tests.**

```bash
swift run --package-path ios/TruthyTools generate-tokens "$PWD"
head -3 ios/Truthy/Truthy/Design/Tokens.swift
grep -E 'static let (maxWidth|stampStub|snap|skyStops|stamp)\b' ios/Truthy/Truthy/Design/Tokens.swift
swift test --package-path ios/TruthyTools 2>&1 | tail -1
```

Expected: `wrote ios/Truthy/Truthy/Design/Tokens.swift, 333 lines` (measured on plan A's real `resolved.json`; the count leaves out empty lines); the generated header; among the matches `static let maxWidth: Double = 430`, `static let snap = SpringSpec(response: 0.33, dampingFraction: 0.6)`, `static let stamp = (duration: 0.42, delay: 0.38)` (the transition), `static let skyStops: [Double] = [0, 0.35, 0.62, 1]` and the `stampStub` role at size 28; `Test run with 7 tests in 1 suite passed`. The file has no local path: the generator writes none, and `pnpm test` checks it in step 9.

- [ ] **Step 6: Write the tests of the theme, the tokens and the fonts.**

`ios/Truthy/TruthyTests/ThemeResolutionTests.swift`:

```swift
import SwiftUI
import Testing
import TruthyEngine
import UIKit
@testable import Truthy

// README Review Focus line 2, the resolution half (task 15 checks the screenshot): the stored theme wins over the
// system appearance, nothing stored follows the system, and the window is asked for the stored scheme only.
@Suite struct ThemeResolutionTests {
    @Test func theStoredThemeWinsOverTheSystem() {
        #expect(ThemeResolution.resolved(stored: .dark, system: .light) == .dark)
        #expect(ThemeResolution.resolved(stored: .light, system: .dark) == .light)
        #expect(ThemeResolution.preferredScheme(stored: .dark) == .dark)
        #expect(ThemeResolution.preferredScheme(stored: .light) == .light)
    }

    @Test func nothingStoredFollowsTheSystem() {
        #expect(ThemeResolution.resolved(stored: nil, system: .dark) == .dark)
        #expect(ThemeResolution.resolved(stored: nil, system: .light) == .light)
        #expect(ThemeResolution.preferredScheme(stored: nil) == nil)
    }

    @Test func eachThemeHasItsOwnColoursAndShadows() {
        #expect(ThemeResolution.palette(.light) == Tokens.day)
        #expect(ThemeResolution.palette(.dark) == Tokens.night)
        #expect(ThemeResolution.shadows(.dark) == Tokens.nightShadows)
    }
}

// The generated tokens carry the resolved values (reference 5.0 and 5.1), and every type role draws with a font the
// app registers.
@Suite struct TokensTests {
    private func hex(_ colour: TokenColor) -> String {
        String(format: "#%02x%02x%02x", Int((colour.red * 255).rounded()), Int((colour.green * 255).rounded()), Int((colour.blue * 255).rounded()))
    }

    @Test func theColoursAreTheResolvedTokens() {
        #expect(hex(Tokens.day.sky1) == "#a9d6f0")
        #expect(hex(Tokens.night.sky1) == "#0b1528")
        #expect(hex(Tokens.day.surfaceRaised) == "#fdfbf5")
        #expect(hex(Tokens.day.ink) == hex(Tokens.day.focus))
        #expect(Tokens.day.scrim.opacity == 0.32 && Tokens.night.scrim.opacity == 0.6)
        #expect(Tokens.day.surfaceSunkClear.opacity == 0)
    }

    @Test func theOverridesOfReference5Point0Apply() {
        #expect(Tokens.Native.skyStops == [0, 0.35, 0.62, 1])
        #expect(Tokens.TypeRole.carrierLabelCompact.letterSpacing == 0.66)
        #expect(Tokens.Transition.stamp.delay == 0.38)
        #expect(Tokens.Size.maxWidth == 430)
        #expect(Tokens.TypeRole.listTitle.lineHeight == 1.25)
        #expect(Tokens.TypeRole.stampStub.size == 28 && Tokens.TypeRole.stampResult.size == 22)
        #expect(Tokens.Spring.snap == SpringSpec(response: 0.33, dampingFraction: 0.6))
        #expect(Tokens.Duration.holdTimed == 0.7)
    }

    @Test func everyTypeRoleHasARegisteredFont() {
        let roles = [Tokens.TypeRole.logo, Tokens.TypeRole.cardStatement, Tokens.TypeRole.deckCode, Tokens.TypeRole.fieldLabel,
                     Tokens.TypeRole.score, Tokens.TypeRole.body, Tokens.TypeRole.button, Tokens.TypeRole.timedClock]
        for role in roles {
            #expect(UIFont(name: role.postScriptName, size: role.size) != nil, "\(role.postScriptName)")
        }
        #expect(Tokens.TypeRole.logo.postScriptName == "OverpassRoman-ExtraBold")
        #expect(Tokens.TypeRole.body.postScriptName == "OverpassRoman-SemiBold")
        #expect(Tokens.TypeRole.fieldLabel.postScriptName == "OverpassMono-Regular")
        #expect(Tokens.TypeRole.fieldValue.postScriptName == "OverpassMono-SemiBold")
    }
}
```

- [ ] **Step 7: Run them and see them fail.**

```bash
DEST26='platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5'
xcodebuild build-for-testing -project ios/Truthy/Truthy.xcodeproj -scheme Truthy -destination "$DEST26" 2>&1 | grep -E 'error:' | head -3
```

Expected: errors such as `cannot find 'ThemeResolution' in scope` and `value of type 'TypeStyle' has no member 'postScriptName'` (Tokens.swift exists; the hand-written design files do not yet).

- [ ] **Step 8: Write the type roles, the motion helpers and the theme resolution.**

`ios/Truthy/Truthy/Design/Typography.swift`:

```swift
import SwiftUI
import UIKit

// The type roles of Tokens.swift as fonts: Overpass by PostScript name with the weight of the role (spec 6: every
// weight requested explicitly), scaled with Dynamic Type relative to a text style of about the same size.

extension TypeStyle {
    /// The file the role draws with (task 7 registers all four).
    var postScriptName: String {
        switch (family, weight) {
        case (.sans, 800...): "OverpassRoman-ExtraBold"
        case (.sans, _): "OverpassRoman-SemiBold"
        case (.mono, 600...): "OverpassMono-SemiBold"
        case (.mono, _): "OverpassMono-Regular"
        }
    }

    /// The Dynamic Type style the size scales with.
    var textStyle: Font.TextStyle {
        switch size {
        case 34...: .largeTitle
        case 28..<34: .title
        case 22..<28: .title2
        case 20..<22: .title3
        case 17..<20: .body
        case 16..<17: .callout
        case 15..<16: .subheadline
        case 13..<15: .footnote
        case 12..<13: .caption
        default: .caption2
        }
    }

    var uiTextStyle: UIFont.TextStyle {
        switch textStyle {
        case .largeTitle: .largeTitle
        case .title: .title1
        case .title2: .title2
        case .title3: .title3
        case .body: .body
        case .callout: .callout
        case .subheadline: .subheadline
        case .footnote: .footnote
        case .caption: .caption1
        default: .caption2
        }
    }

    var font: Font {
        .custom(postScriptName, size: size, relativeTo: textStyle)
    }

    /// The extra space SwiftUI adds between lines to reach the role's line height. Overpass's own line height is about
    /// 1.27 (reference 5.3), so a role at 1.27 or less adds nothing; the extra space scales with the text.
    var extraLineSpacing: Double {
        let extra = max(0, lineHeight - 1.27) * size
        return UIFontMetrics(forTextStyle: uiTextStyle).scaledValue(for: extra)
    }
}

private struct TypeRoleModifier: ViewModifier {
    let style: TypeStyle

    func body(content: Content) -> some View {
        // CSS leading beyond Overpass's own 1.27, scaled with the text: between lines, and half above and below the
        // box (CSS half-leading). A role under 1.27 gets a negative half, which trims the box as CSS does.
        let leading = UIFontMetrics(forTextStyle: style.uiTextStyle).scaledValue(for: (style.lineHeight - 1.27) * style.size)
        content
            .font(style.font)
            .tracking(style.letterSpacing)
            .lineSpacing(max(0, leading))
            .padding(.vertical, leading / 2)
    }
}

extension View {
    /// Sets a type role of Tokens.TypeRole on the text inside.
    func typeRole(_ style: TypeStyle) -> some View {
        modifier(TypeRoleModifier(style: style))
    }
}
```

`ios/Truthy/Truthy/Design/Motion.swift`:

```swift
import SwiftUI

// Motion from the tokens: the web's cubic-bezier curves as SwiftUI animations and as functions of progress (for the
// back motion, which a finger drives, task 11), and the native springs of reference 5.7.

extension CubicCurve {
    var unitCurve: UnitCurve {
        .bezier(startControlPoint: UnitPoint(x: x1, y: y1), endControlPoint: UnitPoint(x: x2, y: y2))
    }

    /// An animation over `duration` seconds, after `delay`.
    func animation(_ duration: Double, delay: Double = 0) -> Animation {
        Animation.timingCurve(x1, y1, x2, y2, duration: duration).delay(delay)
    }

    /// The eased progress at linear progress `t`: exactly 0 at or before the start and 1 at or after the end.
    func value(at t: Double) -> Double {
        if t <= 0 { return 0 }
        if t >= 1 { return 1 }
        return unitCurve.value(at: t)
    }
}

extension SpringSpec {
    var animation: Animation {
        .spring(response: response, dampingFraction: dampingFraction)
    }

    /// The same spring started at `velocity` units per second (spec 5.3: the finger's speed, divided by the distance
    /// still to go, gives the unit velocity of a spring that animates from 1 to 0).
    func animation(initialVelocity velocity: Double) -> Animation {
        let stiffness = pow(2 * Double.pi / response, 2)
        let damping = 4 * Double.pi * dampingFraction / response
        return .interpolatingSpring(mass: 1, stiffness: stiffness, damping: damping, initialVelocity: velocity)
    }
}
```

`ios/Truthy/Truthy/Design/Theme.swift`:

```swift
import SwiftUI
import TruthyEngine

// Which theme the app shows (reference 6, spec 5.6): the stored choice wins, otherwise the system decides; the
// stored theme applies from the first frame, the status bar follows it, and the launch screen alone follows the
// system. The colours of the theme reach every view through the environment.

enum ThemeResolution {
    /// The theme to show: task 1's resolveTheme over the stored choice and the system appearance.
    static func resolved(stored: StoredTheme?, system: ColorScheme) -> ResolvedTheme {
        resolveTheme(stored, system == .dark)
    }

    /// What the root asks of the window: the stored theme, or nil to follow the system.
    static func preferredScheme(stored: StoredTheme?) -> ColorScheme? {
        stored.map(scheme)
    }

    static func scheme(_ theme: ResolvedTheme) -> ColorScheme {
        theme == .dark ? .dark : .light
    }

    static func palette(_ theme: ResolvedTheme) -> Palette {
        theme == .dark ? Tokens.night : Tokens.day
    }

    static func shadows(_ theme: ResolvedTheme) -> ShadowSet {
        theme == .dark ? Tokens.nightShadows : Tokens.dayShadows
    }
}

private struct PaletteKey: EnvironmentKey {
    static let defaultValue = Tokens.day
}

private struct ShadowsKey: EnvironmentKey {
    static let defaultValue = Tokens.dayShadows
}

private struct ResolvedThemeKey: EnvironmentKey {
    static let defaultValue = ResolvedTheme.light
}

extension EnvironmentValues {
    /// The colours of the theme on screen.
    var palette: Palette {
        get { self[PaletteKey.self] }
        set { self[PaletteKey.self] = newValue }
    }

    var shadows: ShadowSet {
        get { self[ShadowsKey.self] }
        set { self[ShadowsKey.self] = newValue }
    }

    var resolvedTheme: ResolvedTheme {
        get { self[ResolvedThemeKey.self] }
        set { self[ResolvedThemeKey.self] = newValue }
    }
}

/// The root of every screen: resolves the theme against the system appearance, hands its colours down and asks the
/// window for the stored scheme, so the status bar follows the app's theme (spec 5.6, N12).
struct ThemedRoot<Content: View>: View {
    let stored: StoredTheme?
    @ViewBuilder let content: (ResolvedTheme) -> Content
    @Environment(\.colorScheme) private var system

    var body: some View {
        let theme = ThemeResolution.resolved(stored: stored, system: system)
        content(theme)
            .environment(\.palette, ThemeResolution.palette(theme))
            .environment(\.shadows, ThemeResolution.shadows(theme))
            .environment(\.resolvedTheme, theme)
            .preferredColorScheme(ThemeResolution.preferredScheme(stored: stored))
    }
}
```

- [ ] **Step 9: Run the gates and commit.**

```bash
DEST26='platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5'
swift test --package-path ios/TruthyEngine 2>&1 | tail -1
swift test --package-path ios/TruthyTools 2>&1 | tail -1
xcodebuild test -project ios/Truthy/Truthy.xcodeproj -scheme Truthy -destination "$DEST26" 2>&1 | grep -E 'Test run with|Executed [0-9]+ tests?,|TEST (SUCCEEDED|FAILED)' | tail -3
git add ios/TruthyTools ios/Truthy/Truthy/Design ios/Truthy/TruthyTests/ThemeResolutionTests.swift
pnpm test
git commit -m "feat: generate the iOS tokens from the resolved design tokens and resolve the theme before the first frame"
git status --short
```

Expected: the engine's `Test run with 355 tests in 50 suites passed after ... with 1 known issue`; the tools' `Test run with 7 tests in 1 suite passed`; the app's `Test run with 13 tests in 6 suites passed` (task 7's 7 in 4, plus 6 in 2), `Executed 1 test, with 0 failures` and `** TEST SUCCEEDED **`; `pnpm test` passes (its hygiene test reads the new files); `git status --short` prints nothing. `ios/TruthyTools/.build` stays out of git through task 1's `ios/.gitignore`.

- [ ] **Step 10: Check that the freshness test bites.**

```bash
printf '\n' >> ios/Truthy/Truthy/Design/Tokens.swift
swift test --package-path ios/TruthyTools --filter theCommittedTokensAreWhatTheGeneratorWrites 2>&1 | grep -E '✘|Test run with'
git checkout -- ios/Truthy/Truthy/Design/Tokens.swift
git status --short
```

Expected: `✘ Test theCommittedTokensAreWhatTheGeneratorWrites() ...` with the message `Tokens.swift is stale: run swift run --package-path ios/TruthyTools generate-tokens`; after the checkout, nothing from `git status --short`.
