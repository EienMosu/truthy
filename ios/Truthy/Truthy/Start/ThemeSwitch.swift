import SwiftUI

// The theme switch on every start step (ThemeSwitch.tsx): a moon while the day theme shows, a sun at night.

struct ThemeSwitch: View {
    let theme: ResolvedTheme
    let action: () -> Void
    @Environment(\.palette) private var palette
    @Environment(\.shadows) private var shadows

    var body: some View {
        Button(action: action) {
            Group {
                if theme == .dark {
                    IconView(icon: .sunRays, size: 18)   // task 10's sun draws its r3.3 disc with the rays
                } else {
                    IconView(icon: .moon, size: 18)
                }
            }
            .foregroundStyle(palette.ink.color)
            .frame(width: Tokens.Size.roundButton, height: Tokens.Size.roundButton)
            .background(Circle().fill(palette.surfaceRaised.color))
            .tokenShadow(shadows.small, Circle())
        }
        .buttonStyle(.round)
        .keyboardFocusRing(Circle())
        .accessibilityLabel(theme == .dark ? "Switch to light theme" : "Switch to dark theme")
    }
}
