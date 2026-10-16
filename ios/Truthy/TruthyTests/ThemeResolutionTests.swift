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

    // The leading follows the size SwiftUI's environment reports (a capped text keeps its leading in step with its
    // glyphs), not the device's content size: it is a function of the Dynamic Type size, signed.
    @Test func theLeadingFollowsTheDynamicTypeSizeOfTheEnvironment() {
        let passLine = Tokens.TypeRole.passLine
        let direct: Double = UIFontMetrics(forTextStyle: passLine.uiTextStyle).scaledValue(
            for: (passLine.lineHeight - 1.27) * passLine.size,
            compatibleWith: UITraitCollection(preferredContentSizeCategory: .extraExtraLarge))
        #expect(passLine.leading(at: .xxLarge) == direct)
        #expect(passLine.leading(at: .xxLarge) < passLine.leading(at: .accessibility5))
        #expect(Tokens.TypeRole.cardName.leading(at: .large) < 0)
    }

    // Task 15's visual review: SwiftUI lays a line of Overpass out with the metrics of the point size rounded to a
    // whole point, and its box ends on a pixel (15.5 points: 20.33 on a 3x screen where CSS has 19.62), so 1.27 of the
    // size left every line up to 0.7 taller than the web's. The role's line box is the web's: one line is lineHeight
    // times the size, and so is each further line.
    @Test @MainActor func aRolesLinesHaveTheWebsHeight() {
        func height(_ text: String, _ role: TypeStyle) -> Double {
            let view = Text(text).typeRole(role).environment(\.displayScale, 3)
            return UIHostingController(rootView: view).sizeThatFits(in: CGSize(width: 1000, height: 1000)).height
        }
        for role in [Tokens.TypeRole.body, Tokens.TypeRole.fieldLabel, Tokens.TypeRole.monoDataStrong, Tokens.TypeRole.listStatement] {
            #expect(abs(height("Ag", role) - role.lineHeight * role.size) <= 0.34, "one line of \(role.size)")
        }
        // Lines further apart than the font's own (SwiftUI cannot draw them closer): the reading text.
        for role in [Tokens.TypeRole.body, Tokens.TypeRole.listStatement, Tokens.TypeRole.missedExplanation] {
            #expect(abs(height("Ag\nAg\nAg\nAg", role) - 4 * role.lineHeight * role.size) <= 0.67, "four lines of \(role.size)")
        }
    }

    // Step 52 review: a role whose size is not a whole number (the field label's 10.5, the source link's 13.5, the
    // body's 15.5) drew one whole point larger, and every role drew its Dynamic Type size rounded to a whole point
    // (15 at xLarge is 16.5, drawn as 17): Font.custom(_:size:relativeTo:) resolves to the rounded size. Each role draws
    // its size times its text style's scale, unrounded, as CoreText draws that size.
    @Test(arguments: [DynamicTypeSize.large, .xLarge, .accessibility1])
    @MainActor func everyRoleDrawsItsExactSize(at dynamicType: DynamicTypeSize) {
        let samples: [(TypeStyle, String)] = [
            (Tokens.TypeRole.fieldLabel, "Your score"),
            (Tokens.TypeRole.sourceLink, "What is IAM Identity Center?"),
            (Tokens.TypeRole.body, "Each AWS account has its own root user"),
            (Tokens.TypeRole.missedExplanation, "Each AWS account has its own root user"),
            (Tokens.TypeRole.monoData, "17 decks"),
        ]
        for (role, text) in samples {
            let traits = UITraitCollection(preferredContentSizeCategory: UIContentSizeCategory(dynamicType))
            let points = role.size * UIFontMetrics(forTextStyle: role.uiTextStyle).scaledValue(for: 1000, compatibleWith: traits) / 1000
            let drawn = InkSpan(Text(text).typeRole(role).foregroundStyle(.black).fixedSize().environment(\.dynamicTypeSize, dynamicType))
            let expected = InkSpan(text, font: UIFont(name: role.postScriptName, size: points)!, tracking: role.letterSpacing)
            #expect(abs(drawn.width - expected.width) <= 0.5,
                    "\(role.size) at \(dynamicType) (\(points) points): \(drawn.width) wide, \(expected.width) at its size")
            // Its line is the role's line height at that size.
            let line = UIHostingController(rootView: Text("Ag").typeRole(role).environment(\.displayScale, 3).environment(\.dynamicTypeSize, dynamicType))
                .sizeThatFits(in: CGSize(width: 1000, height: 1000)).height
            #expect(abs(line - role.lineHeight * points) <= 0.34, "a line of \(role.size) at \(dynamicType) is \(line) tall")
        }
    }

    // A code part of card text is the mono face at 0.92 of the text's size (CardText.tsx 0.92em): 14.26 for the
    // body's 15.5, which drew as 14.
    @Test(arguments: [DynamicTypeSize.large, .accessibility1])
    @MainActor func aCodePartDrawsAtItsExactSize(at dynamicType: DynamicTypeSize) {
        let role = Tokens.TypeRole.body
        let traits = UITraitCollection(preferredContentSizeCategory: UIContentSizeCategory(dynamicType))
        let points = 0.92 * role.size * UIFontMetrics(forTextStyle: role.uiTextStyle).scaledValue(for: 1000, compatibleWith: traits) / 1000
        let drawn = InkSpan(CardTextView(text: "`IAM Identity Center`", style: role).foregroundStyle(.black).fixedSize()
            .environment(\.dynamicTypeSize, dynamicType))
        let expected = InkSpan("IAM Identity Center", font: UIFont(name: "OverpassMono-SemiBold", size: points)!, tracking: 0)
        #expect(abs(drawn.width - expected.width) <= 0.5, "\(points) points: \(drawn.width) wide, \(expected.width) at its size")
    }
}

/// The horizontal extent of the dark pixels of a view or of a string CoreText draws, in points, drawn at 3x on white.
struct InkSpan {
    let left: Double
    let right: Double
    var width: Double { right - left }

    @MainActor
    init(_ view: some View) {
        let renderer = ImageRenderer(content: view.frame(width: 900, height: 160, alignment: .topLeading).background(Color.white))
        renderer.scale = 3
        self.init(image: renderer.cgImage!)
    }

    init(_ text: String, font: UIFont, tracking: Double) {
        // A kern attribute of 0 would turn the font's kerning off, so it is set only for a tracked role.
        var attributes: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: UIColor.black]
        if tracking != 0 { attributes[.kern] = tracking }
        let format = UIGraphicsImageRendererFormat()
        format.scale = 3
        let image = UIGraphicsImageRenderer(size: CGSize(width: 900, height: 160), format: format).image { context in
            UIColor.white.setFill()
            context.fill(CGRect(x: 0, y: 0, width: 900, height: 160))
            NSAttributedString(string: text, attributes: attributes).draw(at: .zero)
        }
        self.init(image: image.cgImage!)
    }

    private init(image: CGImage) {
        var bytes = [UInt8](repeating: 0, count: image.width * image.height * 4)
        let context = CGContext(data: &bytes, width: image.width, height: image.height, bitsPerComponent: 8, bytesPerRow: image.width * 4,
                                space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
        context.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
        var columns = [Int]()
        for x in 0..<image.width where (0..<image.height).contains(where: { bytes[($0 * image.width + x) * 4] < 128 }) {
            columns.append(x)
        }
        left = Double(columns.first ?? 0) / 3
        right = Double((columns.last ?? -1) + 1) / 3
    }
}
