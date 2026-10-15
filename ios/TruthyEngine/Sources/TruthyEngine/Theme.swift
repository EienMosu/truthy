// The theme rules of src/app-state/theme.ts. Day ("light") or night ("dark"); by default the system decides.
// A press on the theme switch flips the theme the player sees and stores the result under THEME_KEY, which
// wins over the system from then on. Nothing removes the key: there is no way back to following the system.

public enum Theme: String, Codable, CaseIterable, Sendable {
    case light, dark
}

/// The preference key: UserDefaults on iOS, as localStorage on the web.
public let THEME_KEY = "truthy.theme"

/// "light" or "dark", or nil for anything else (no choice, or a value this build does not know).
public func parseTheme(_ value: String?) -> Theme? {
    switch value {
    case "light": .light
    case "dark": .dark
    default: nil
    }
}

public func oppositeTheme(_ theme: Theme) -> Theme {
    theme == .dark ? .light : .dark
}

/// A choice wins over the system setting; without one the system decides.
public func resolveTheme(_ choice: Theme?, _ systemDark: Bool) -> Theme {
    choice ?? (systemDark ? .dark : .light)
}

/// The flip rule of the web's switchTheme: the opposite of the theme visible now. The caller shows it and stores
/// it under THEME_KEY; the theme flips on screen even when storing fails.
public func switchTheme(_ choice: Theme?, _ systemDark: Bool) -> Theme {
    oppositeTheme(resolveTheme(choice, systemDark))
}
