import TruthyEngine

// The app's names for engine types. Foundation has a Progress class of its own: a file that imports SwiftUI or
// Foundation and TruthyEngine cannot write a bare Progress (task 4, rule 4), but a declaration of this module
// shadows both imports, so app files write Progress. The theme and choice names say what the app does with them.

typealias Progress = TruthyEngine.Progress
typealias StoredTheme = TruthyEngine.Theme
typealias ResolvedTheme = TruthyEngine.Theme
typealias StartChoice = TruthyEngine.Choice
