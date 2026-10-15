import Foundation
@testable import Truthy

// Fakes and fixtures the app's unit tests share: a clock the test moves by hand, a scratch directory per test, and
// the embedded decks (the test host is the app, so Bundle.main holds them).

final class FakeClock: WallClock, MonotonicClock, @unchecked Sendable {
    var now: Double

    init(_ now: Double = 1_700_000_000_000) {
        self.now = now
    }

    func nowMs() -> Double { now }

    func advance(_ ms: Double) {
        now += ms
    }
}

enum Scratch {
    /// A new empty directory under the test host's temporary directory.
    static func directory() -> URL {
        let url = FileManager.default.temporaryDirectory.appending(path: "truthy-tests-\(UUID().uuidString)")
        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }

    static func defaults() -> UserDefaults {
        let name = "truthy-tests-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: name)!
        defaults.removePersistentDomain(forName: name)
        return defaults
    }
}
