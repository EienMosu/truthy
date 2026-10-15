import Foundation
import QuartzCore

// The two clocks of spec 4.4 and reference 7.3, never mixed: engine events (answers, Timed ticks and visibility) and
// lastSeenAt use the wall clock in whole epoch milliseconds, as Date.now() does on the web; the UI guards (250, 420,
// 1000 ms) and swipe samples use the monotonic clock UITouch.timestamp is stamped with.

protocol WallClock: Sendable {
    func nowMs() -> Double
}

protocol MonotonicClock: Sendable {
    func nowMs() -> Double
}

struct SystemWallClock: WallClock {
    func nowMs() -> Double {
        (Date().timeIntervalSince1970 * 1000).rounded(.down)
    }
}

struct SystemMonotonicClock: MonotonicClock {
    func nowMs() -> Double {
        CACurrentMediaTime() * 1000
    }
}
