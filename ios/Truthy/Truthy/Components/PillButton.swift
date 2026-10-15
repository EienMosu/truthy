import SwiftUI

// The 60 point pill (PillButton.tsx): a filled capsule with an optional leading icon and a trailing arrow, used for
// True, False, Next card, See results, Start round, Play again and Keep playing. The title is the visible text and
// the accessible name (reference 4.5).

struct PillButton: View {
    enum Fill { case ink, answerTrue, answerFalse }
    let title: String
    var fill: Fill = .ink
    var leading: Icon?
    /// The web's size and stroke for the leading icon: the False cross 16 at 3, the True check 18 at 3, the replay 18
    /// at its own 2.2 (nil keeps the icon's default stroke).
    var leadingSize: Double = 18
    var leadingStroke: Double?
    var trailingArrow = false
    var dimmed = false
    let action: () -> Void
    @Environment(\.palette) private var palette

    var body: some View {
        // A dimmed pill takes no presses (the web's aria-disabled pill).
        Button(action: { if !dimmed { action() } }) {
            HStack(spacing: Tokens.Space.s10) {
                if let leading { IconView(icon: leading, size: leadingSize, strokeWidth: leadingStroke) }
                Text(title).typeRole(Tokens.TypeRole.button)
                if trailingArrow { Text("→").typeRole(Tokens.TypeRole.button).accessibilityHidden(true) }
            }
            .foregroundStyle(palette.onDark.color)
            .padding(.horizontal, Tokens.Space.s20)
        }
        .buttonStyle(PillButtonStyle(fill: fillColor, dimmed: dimmed))
        .keyboardFocusRing(Capsule())
        .accessibilityLabel(title)
        .reviewFrame(ReviewName.pill(title))
    }

    private var fillColor: Color {
        switch fill {
        case .ink: palette.ink.color
        case .answerTrue: palette.answerTrue.color
        case .answerFalse: palette.answerFalse.color
        }
    }
}

/// The 48 point round button with an icon (the X of the round, RoundButton.tsx).
struct RoundIconButton: View {
    let icon: Icon
    let label: String
    let action: () -> Void
    @Environment(\.palette) private var palette
    @Environment(\.shadows) private var shadows

    var body: some View {
        Button(action: action) {
            IconView(icon: icon, size: 16)
                .foregroundStyle(palette.ink.color)
                .frame(width: Tokens.Size.roundButton, height: Tokens.Size.roundButton)
                .background(Circle().fill(palette.surfaceRaised.color))
                .tokenShadow(shadows.small, Circle())
        }
        .buttonStyle(.round)
        .keyboardFocusRing(Circle())
        .accessibilityLabel(label)
    }
}

/// The quiet button: text only, full width, 48 tall (QuietButton.tsx `w-full`). Its leading icon is drawn at the
/// icon's own view box width (the route icon at 20).
struct QuietButton: View {
    let title: String
    var leading: Icon?
    let action: () -> Void
    @Environment(\.palette) private var palette

    var body: some View {
        Button(action: action) {
            HStack(spacing: Tokens.Space.s8) {
                if let leading { IconView(icon: leading, size: leading.viewBox.width) }
                Text(title).typeRole(Tokens.TypeRole.buttonQuiet)
            }
            .foregroundStyle(palette.ink.color)
            .frame(maxWidth: .infinity, minHeight: Tokens.Size.pillSmall)
            .contentShape(Rectangle())
        }
        .buttonStyle(.quiet)
        .keyboardFocusRing(Capsule())
        .accessibilityLabel(title)
    }
}
