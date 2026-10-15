import Foundation
import TruthyEngine

// Debug launch arguments (spec 7.4): open any screen in a known state. Parsed in every build, read only in debug
// builds, so the phone's release build has none.
//   -seed <uint32>  -route <deckId>/<sectionId>  -mode <classic|streak|lives|timed>  -screen <name>  -step <1..6>
//   -theme light|dark (plan C's extras carry the same keys and values)

enum DebugScreen: String, CaseIterable, Sendable {
    case start, round, answered, sheet, result, gallery
}

struct LaunchArguments: Equatable, Sendable {
    var seed: UInt32?
    var route: Route?
    var mode: Mode?
    var screen: DebugScreen?
    /// The start step `-screen start` opens (1 to 6).
    var step: Step?
    var theme: StoredTheme?

    static func parse(_ arguments: [String]) -> LaunchArguments {
        var parsed = LaunchArguments()
        func value(_ name: String) -> String? {
            guard let at = arguments.firstIndex(of: name), at + 1 < arguments.count else { return nil }
            return arguments[at + 1]
        }
        parsed.seed = value("-seed").flatMap { UInt32($0) }
        parsed.route = value("-route").flatMap { text in
            let parts = text.split(separator: "/", maxSplits: 1).map(String.init)
            return parts.count == 2 && !parts[0].isEmpty && !parts[1].isEmpty ? Route(deckId: parts[0], sectionId: parts[1]) : nil
        }
        parsed.mode = value("-mode").flatMap { Mode(rawValue: $0) }
        parsed.screen = value("-screen").flatMap { DebugScreen(rawValue: $0) }
        parsed.step = value("-step").flatMap { Int($0) }.flatMap { (1...6).contains($0) ? $0 : nil }
        parsed.theme = parseTheme(value("-theme"))
        return parsed
    }

    /// The process's arguments in a debug build; none in a release build.
    static var current: LaunchArguments {
        #if DEBUG
        parse(ProcessInfo.processInfo.arguments)
        #else
        LaunchArguments()
        #endif
    }
}
