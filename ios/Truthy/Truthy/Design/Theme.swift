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
