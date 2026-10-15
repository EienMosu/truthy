import Foundation
import Testing

// Spec 4.2, as tests/purity.test.ts does for the web: the engine reaches for no clock, no randomness, no timer
// or scheduler, no file or preference storage and no UI framework. Time and seeds always come in as arguments.

private let forbidden: [(name: String, pattern: String)] = [
    ("the wall clock", #"\b(?:Date|CFAbsoluteTimeGetCurrent|gettimeofday)\b"#),
    ("a monotonic clock", #"\b(?:CACurrentMediaTime|ProcessInfo|DispatchTime|ContinuousClock|SuspendingClock|mach_absolute_time|clock_gettime)\b"#),
    ("randomness", #"\.random(?:Element)?\b|\.shuffle(?:d)?\(|\b(?:SystemRandomNumberGenerator|RandomNumberGenerator|arc4random\w*|SecRandomCopyBytes)\b"#),
    ("a timer or scheduler", #"\b(?:Timer|DispatchQueue|RunLoop|OperationQueue|CADisplayLink)\b|Task\.sleep"#),
    ("storage", #"\b(?:FileManager|FileHandle|UserDefaults|Bundle|NSUbiquitousKeyValueStore)\b|contentsOf:|\.write\(to:"#),
    ("a UI framework", #"(?m)^\s*(?:@\w+\s+)*import\s+(?:SwiftUI|UIKit|AppKit|Combine|QuartzCore)\b"#),
]

/// The code without its comments, so a comment may name what the code must not use.
private func withoutComments(_ source: String) -> String {
    source
        .replacing(try! Regex(#"/\*[\s\S]*?\*/"#), with: "")
        .replacing(try! Regex(#"//[^\n]*"#), with: "")
}

/// Simple word boundaries: with the default Unicode ones, "UserDefaults.standard" is one word and `\b` misses it.
private func findings(in file: String, _ source: String) -> [String] {
    let code = withoutComments(source)
    return forbidden.compactMap { rule in
        code.contains(try! Regex(rule.pattern).wordBoundaryKind(.simple)) ? "\(file) uses \(rule.name)" : nil
    }
}

private let engineDirectory = Golden.root.appending(path: "ios/TruthyEngine/Sources/TruthyEngine")

@Suite struct PurityTests {
    @Test func theScannerIgnoresCommentsAndReadsTheCode() {
        #expect(findings(in: "a.swift", "// never Date() here\nlet a = 1 /* Timer */") == [])
        let planted = """
            import SwiftUI
            @preconcurrency import Combine
            let now = Date().timeIntervalSince1970 + CACurrentMediaTime()
            let pick = [1, 2].randomElement() ?? Int.random(in: 0...1)
            DispatchQueue.main.async { try? await Task.sleep(for: .seconds(1)) }
            let saved = UserDefaults.standard.string(forKey: "k")
            let raw = try Data(contentsOf: url)
            """
        #expect(findings(in: "planted.swift", planted) == [
            "planted.swift uses the wall clock",
            "planted.swift uses a monotonic clock",
            "planted.swift uses randomness",
            "planted.swift uses a timer or scheduler",
            "planted.swift uses storage",
            "planted.swift uses a UI framework",
        ])
    }

    @Test func theScannerAcceptsTheEngineOwnNames() {
        let code = "let rng = createRng(seed)\nlet order = shuffle(items, rng)\nlet updated = Dictionary(uniqueKeysWithValues: pairs)"
        #expect(findings(in: "ok.swift", code) == [])
    }

    @Test func theEngineIsPure() throws {
        let files = try FileManager.default.contentsOfDirectory(atPath: engineDirectory.path(percentEncoded: false))
            .filter { $0.hasSuffix(".swift") }
            .sorted()
        #expect(files.count >= 7)
        var found: [String] = []
        for file in files {
            found += findings(in: file, try String(contentsOf: engineDirectory.appending(path: file), encoding: .utf8))
        }
        #expect(found == [])
    }

    @Test func theEnginePackageHasNoDependencies() throws {
        let manifest = try String(contentsOf: Golden.root.appending(path: "ios/TruthyEngine/Package.swift"), encoding: .utf8)
        #expect(manifest.contains(#".target(name: "TruthyEngine")"#))
        #expect(!manifest.contains(".package("))
    }
}
