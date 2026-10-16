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

    /// The role's size at a Dynamic Type size: the size times its text style's scale, unrounded (at the default size,
    /// the token's own size). UIFontMetrics' scaledValue rounds the result to a pixel.
    func points(at dynamicType: DynamicTypeSize) -> Double {
        let traits = UITraitCollection(preferredContentSizeCategory: UIContentSizeCategory(dynamicType))
        return size * UIFontMetrics(forTextStyle: uiTextStyle).scaledValue(for: 1000, compatibleWith: traits) / 1000
    }

    /// The role's font at a Dynamic Type size, at exactly points(at:). Font.custom(_:size:relativeTo:) resolves the
    /// scaled size to a whole point (10.5 draws as 11, 13.5 as 14, 15.5 as 16, 15 at xLarge as 17), so the role builds
    /// a fixed-size font from the Dynamic Type size of the environment it is drawn in.
    func font(at dynamicType: DynamicTypeSize) -> Font {
        .custom(postScriptName, fixedSize: points(at: dynamicType))
    }

    /// The extra space SwiftUI adds between lines to reach the role's line height. Overpass's own line height is about
    /// 1.27 (reference 5.3), so a role at 1.27 or less adds nothing; the extra space scales with the text.
    var extraLineSpacing: Double {
        let extra = max(0, lineHeight - 1.27) * size
        return UIFontMetrics(forTextStyle: uiTextStyle).scaledValue(for: extra)
    }

    /// The CSS leading beyond Overpass's own 1.27 at a Dynamic Type size, signed: a role under 1.27 gives a negative
    /// value. It scales with the size SwiftUI's environment reports, not with the device setting UIKit reads, so a
    /// capped text (dynamicTypeSize(...xxLarge)) keeps its leading in step with its glyphs.
    func leading(at size: DynamicTypeSize) -> Double {
        let traits = UITraitCollection(preferredContentSizeCategory: UIContentSizeCategory(size))
        return UIFontMetrics(forTextStyle: uiTextStyle).scaledValue(for: (lineHeight - 1.27) * self.size, compatibleWith: traits)
    }
}

extension TypeStyle {
    /// Overpass's ascent plus descent over its size (all four cuts): 0.883 + 0.383.
    static let overpassLine = 1.2659912109375

    /// The line box of the role at a Dynamic Type size on a screen of `scale` pixels per point, as SwiftUI needs it to
    /// draw the web's line height: SwiftUI lays a line out with the font's metrics (the role's exact size, font(at:)),
    /// the first line's box ending on the next pixel and each further line a rounded number of pixels below the one
    /// before. `spacing` goes between lines (never below zero) and `padding` above and below the text (half of what one
    /// line lacks, signed: a role under its natural line trims the box as CSS does).
    func lineBox(at size: DynamicTypeSize, scale: Double) -> (spacing: Double, padding: Double) {
        let exact = points(at: size)
        let natural = Self.overpassLine * exact
        let pixel = max(scale, 1)
        let first = (natural * pixel).rounded(.up) / pixel
        let next = (natural * pixel).rounded() / pixel
        let css = lineHeight * exact
        return (max(0, css - next), (css - first) / 2)
    }
}

private struct TypeRoleModifier: ViewModifier {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Environment(\.displayScale) private var displayScale
    let style: TypeStyle

    func body(content: Content) -> some View {
        // The web's line box (lineBox above): the line height between lines and, for the box, half of the rest above
        // and below (CSS half-leading).
        let box = style.lineBox(at: dynamicTypeSize, scale: displayScale)
        content
            .font(style.font(at: dynamicTypeSize))
            .tracking(style.letterSpacing)
            .lineSpacing(box.spacing)
            .padding(.vertical, box.padding)
    }
}

extension View {
    /// Sets a type role of Tokens.TypeRole on the text inside.
    func typeRole(_ style: TypeStyle) -> some View {
        modifier(TypeRoleModifier(style: style))
    }
}

/// The web's underline of a link (BoardingPass.tsx and MissedCards.tsx: <u class="decoration-[1.5px]
/// underline-offset-[3px]">): 1.5 thick, its top 3 under the baseline, so it passes under the descenders, drawn under
/// each line of the text from its first to its last character (the space a line wraps at is not underlined) and
/// snapped to the pixel grid as the browser snaps it (5 pixels at 3x). SwiftUI's underline is the font's, close under
/// the baseline and through the descenders.
struct WebUnderline: TextRenderer {
    static let thickness = 1.5
    static let offset = 3.0
    /// The text drawn, to tell its spaces (a layout's character indices count its UTF-16 units).
    let text: String

    func draw(layout: Text.Layout, in context: inout GraphicsContext) {
        let scale = max(1, context.environment.displayScale)
        let units = Array(text.utf16)
        let first = layout.flatMap { $0 }.flatMap { $0.characterIndices }.min()
        let thickness = max(1, (Self.thickness * scale).rounded()) / scale
        for line in layout {
            var left = Double.infinity
            var right = -Double.infinity
            for run in line {
                for index in run.indices {
                    let slice = run[index]
                    let blank = slice.characterIndices.allSatisfy { character in
                        guard let first else { return false }
                        let offset = first.distance(to: character)
                        guard units.indices.contains(offset), let scalar = Unicode.Scalar(units[offset]) else { return false }
                        return CharacterSet.whitespacesAndNewlines.contains(scalar)
                    }
                    guard !blank else { continue }
                    left = min(left, slice.typographicBounds.rect.minX)
                    right = max(right, slice.typographicBounds.rect.maxX)
                }
            }
            if right > left {
                let top = ((line.typographicBounds.origin.y + Self.offset) * scale).rounded() / scale
                context.fill(Path(CGRect(x: left, y: top, width: right - left, height: thickness)), with: .foreground)
            }
            context.draw(line)
        }
    }
}

extension View {
    /// Underlines the text inside as the web underlines a link (WebUnderline); `text` is the string it draws.
    func webUnderline(_ text: String) -> some View {
        textRenderer(WebUnderline(text: text))
    }
}

/// Text with spans in a font of their own (a semibold number in a mono line, a code part, the Timed clock), built at
/// the Dynamic Type size of the place it is drawn, so a span's font(at:) is its exact size there, a cap of the paper
/// (paperTextSize) or of a fitted word (wholeWords) applied around it included.
struct SizedText: View {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    let make: (DynamicTypeSize) -> Text

    init(_ make: @escaping (DynamicTypeSize) -> Text) {
        self.make = make
    }

    var body: some View {
        make(dynamicTypeSize)
    }
}

/// N9: at the accessibility sizes a narrow column would break a long word in the middle ("Cloud Practition / er").
/// The text then takes the largest Dynamic Type size, no larger than its own, at which its longest word fits its width;
/// at the standard sizes (up to xxxLarge) it keeps its size, as the web keeps its words whole there.
@MainActor
enum WordFit {
    /// The width of `word` in `style` at a Dynamic Type size, tracking included.
    static func width(of word: String, _ style: TypeStyle, at size: DynamicTypeSize) -> Double {
        let traits = UITraitCollection(preferredContentSizeCategory: UIContentSizeCategory(size))
        guard let font = UIFont(name: style.postScriptName, size: style.points(at: size)) else { return 0 }
        let tracking = UIFontMetrics(forTextStyle: style.uiTextStyle).scaledValue(for: style.letterSpacing, compatibleWith: traits)
        return Double(NSAttributedString(string: word, attributes: [.font: font, .kern: tracking]).size().width)
    }

    /// The largest size from `upTo` down to xxxLarge at which the longest word of `text` fits `width`.
    static func size(_ text: String, _ style: TypeStyle, width: Double, upTo: DynamicTypeSize) -> DynamicTypeSize {
        guard upTo.isAccessibilitySize, width > 0 else { return upTo }
        let words = text.split(whereSeparator: { $0.isWhitespace }).map(String.init)
        guard let longest = words.max(by: { Self.width(of: $0, style, at: upTo) < Self.width(of: $1, style, at: upTo) }) else { return upTo }
        let sizes = DynamicTypeSize.allCases.filter { $0 <= upTo && $0 >= .xxxLarge }.reversed()
        return sizes.first { Self.width(of: longest, style, at: $0) <= width } ?? .xxxLarge
    }
}

private struct WholeWordsModifier: ViewModifier {
    let text: String
    let style: TypeStyle
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @State private var width = 0.0

    func body(content: Content) -> some View {
        content
            .dynamicTypeSize(WordFit.size(text, style, width: width, upTo: dynamicTypeSize))
            .onGeometryChange(for: Double.self) { $0.size.width } action: { width = $0 }
    }
}

extension View {
    /// Keeps the words of `text` whole at the accessibility sizes (N9): see WordFit.
    func wholeWords(_ text: String, _ style: TypeStyle) -> some View {
        modifier(WholeWordsModifier(text: text, style: style))
    }
}
