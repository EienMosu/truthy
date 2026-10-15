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
