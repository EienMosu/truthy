import Foundation

// Timed's 100 ms ticker (reference 7.3): a Timer in the common run loop modes, so it keeps firing while a scroll or a
// drag is tracking (a default-mode timer pauses then, and each tick may count at most one second, so the clock would
// lose time).

@MainActor
final class Ticker {
    static let intervalMs: Double = 100
    private var timer: Timer?
    let mode: RunLoop.Mode

    init(mode: RunLoop.Mode = .common) {
        self.mode = mode
    }

    var isRunning: Bool { timer != nil }

    func start(_ tick: @escaping @MainActor () -> Void) {
        stop()
        let timer = Timer(timeInterval: Self.intervalMs / 1000, repeats: true) { _ in
            MainActor.assumeIsolated { tick() }
        }
        RunLoop.main.add(timer, forMode: mode)
        self.timer = timer
    }

    func stop() {
        timer?.invalidate()
        timer = nil
    }
}
