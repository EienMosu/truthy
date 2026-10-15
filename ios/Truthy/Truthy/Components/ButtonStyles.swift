import SwiftUI

// Press feedback per control, as the web gives it (spec 5.6, reference 5.7): round buttons 0.92, the Back pill 0.96,
// pills 2 down plus 0.98 plus the press shadow, cards and the quiet button 0.98, all over 120 ms on the ease curve;
// the press tint only on the pass fields and the continue line. No tap highlight, no hover: every style disables the iPad pointer's automatic hover effect.

private let pressAnimation = Tokens.Curve.ease.animation(Tokens.Duration.t1)

struct ScaleButtonStyle: ButtonStyle {
    var scale: Double

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? scale : 1)
            .animation(pressAnimation, value: configuration.isPressed)
            .hoverEffectDisabled()
    }
}

extension ButtonStyle where Self == ScaleButtonStyle {
    static var round: ScaleButtonStyle { ScaleButtonStyle(scale: 0.92) }
    static var backPill: ScaleButtonStyle { ScaleButtonStyle(scale: 0.96) }
    static var card: ScaleButtonStyle { ScaleButtonStyle(scale: 0.98) }
    static var quiet: ScaleButtonStyle { ScaleButtonStyle(scale: 0.98) }
}

/// The pass fields and the continue line: the press colour fills the shape while pressed (the continue line also
/// scales to 0.98).
struct PressTintButtonStyle<S: Shape>: ButtonStyle {
    let shape: S
    var scale: Double = 1
    @Environment(\.palette) private var palette

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background(shape.fill(configuration.isPressed ? palette.press.color : Color.clear))
            .scaleEffect(configuration.isPressed ? scale : 1)
            .animation(pressAnimation, value: configuration.isPressed)
            .hoverEffectDisabled()
    }
}

/// The 60 point pill (PillButton.tsx): 2 points down, 0.98 and the press shadow while pressed; no shadow when dimmed.
struct PillButtonStyle: ButtonStyle {
    var fill: Color
    var dimmed: Bool
    @Environment(\.shadows) private var shadows

    func makeBody(configuration: Configuration) -> some View {
        let shape = Capsule()
        // A dimmed pill is aria-disabled on the web: it shows no press.
        let pressed = configuration.isPressed && !dimmed
        configuration.label
            .frame(maxWidth: .infinity, minHeight: Tokens.Size.pill)
            .background(shape.fill(fill))
            .tokenShadow(dimmed ? [] : (pressed ? shadows.press : shadows.button), shape)
            .offset(y: pressed ? 2 : 0)
            .scaleEffect(pressed ? 0.98 : 1)
            .opacity(dimmed ? Tokens.Opacity.disabled : 1)
            .animation(pressAnimation, value: pressed)
            .hoverEffectDisabled()
    }
}
