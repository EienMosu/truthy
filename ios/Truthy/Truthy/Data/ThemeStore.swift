import Foundation
import TruthyEngine

// The stored theme (reference 6): "light" or "dark" under truthy.theme in UserDefaults, read before the first frame.
// Nothing removes it: there is no way back to following the system, as on the web.

struct ThemeStore {
    let defaults: UserDefaults

    init(defaults: UserDefaults) {
        self.defaults = defaults
    }

    var stored: StoredTheme? {
        parseTheme(defaults.string(forKey: THEME_KEY))
    }

    func store(_ theme: StoredTheme) {
        defaults.set(theme.rawValue, forKey: THEME_KEY)
    }
}
