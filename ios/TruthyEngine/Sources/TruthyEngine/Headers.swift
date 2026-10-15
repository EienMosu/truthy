// The Streak, Three lives and Timed headers (components/StreakPath.tsx, LivesPath.tsx, TimedPath.tsx).

public struct StreakLayout: Sendable {
    /// Where slot i sits on the curve, 0 to 1.
    public let t: @Sendable (Int) -> Double
    public let dot: Double
    public let ticks: Bool
    /// The slot of the best (best - 1), nil without a best of at least 1.
    public let ring: Int?
    /// The ring is at or ahead of the card on screen.
    public let target: Bool
    public let future: [Int]
}

/// The layout for `done` dots (the card on screen is slot `done`) and the best on the route.
public func streakLayout(_ done: Int, _ best: Int?) -> StreakLayout {
    let ring: Int? = best.flatMap { $0 < 1 ? nil : $0 - 1 }
    let target = ring.map { done <= $0 } ?? false
    let step = target ? 1 / Double(max(ring ?? 1, 1)) : 1 / (Double(done) + 1.6)
    let dot = min(6, round1(264 * step * 0.31))
    let future = target ? Array((0..<max(0, (ring ?? 0) - done - 1)).map { done + 1 + $0 }) : []
    return StreakLayout(t: { min(1, Double($0) * step) }, dot: dot, ticks: dot >= 5, ring: ring, target: target, future: future)
}

/// The header's accessible name. A best of 0 counts as no best.
public func streakLabel(_ streak: Int, _ best: Int?, _ ended: Bool) -> String {
    let start = ended ? "Streak ended at \(streak)" : "Streak of \(streak) correct \(streak == 1 ? "answer" : "answers")"
    guard let best, best >= 1 else { return "\(start)." }
    if streak < best { return "\(start). Your best on this route is \(best)." }
    if streak == best { return "\(start), equal to your best on this route." }
    return "\(start). New best on this route, previous best \(best)."
}

public struct TrailLayout: Sendable {
    /// x of mark i, 0 the oldest.
    public let x: @Sendable (Int) -> Double
    public let r: Double
    public let side: Double
    public let cross: Bool
}

/// Where the marks of the answered cards sit on the line y 17 of the Three lives header.
public func trailLayout(_ marks: Int) -> TrailLayout {
    if marks <= 14 { return TrailLayout(x: { 219 - 9 * Double(marks - 1 - $0) }, r: 2.6, side: 9, cross: true) }
    let step = 119 / Double(marks - 1)
    let side = max(6, min(8, round1(step * 1.3)))
    return TrailLayout(x: { round1(100 + Double($0) * step) }, r: min(2.2, round1(step * 0.45)), side: side, cross: true)
}

/// The header's accessible name.
public func livesLabel(_ results: [Bool]) -> String {
    let wrong = results.enumerated().filter { !$0.element }.map { $0.offset + 1 }
    let left = max(0, LIVES - wrong.count)
    let n = results.count
    let were = wrong.count == 1 ? "was" : "were"
    if left == 0 { return "No lives left. The round is over after \(n) cards: \(cardList(wrong)) \(were) wrong." }
    let head = "\(left) of \(LIVES) lives left."
    if n == 0 { return "\(head) No cards answered yet." }
    let answered = "\(n) \(n == 1 ? "card" : "cards") answered"
    if wrong.isEmpty { return "\(head) \(answered)." }
    return "\(head) \(answered), \(cardList(wrong)) \(were) wrong."
}

private func wholeSeconds(_ remainingMs: Double) -> Int {
    Int((jsMathMax(0, remainingMs) / 1000).rounded(.up))
}

/// The clock: "1:00", "0:41", "0:00". The seconds are rounded up.
public func clockText(_ remainingMs: Double) -> String {
    let seconds = wholeSeconds(remainingMs)
    return "\(seconds / 60):\(pad2(seconds % 60))"
}

/// The header's accessible name, from the whole seconds.
public func timedLabel(_ remainingMs: Double, _ correct: Int, _ wrong: Int) -> String {
    let seconds = wholeSeconds(remainingMs)
    if seconds == 0 {
        let n = correct + wrong
        return "Time is up. \(n) \(n == 1 ? "card" : "cards") answered: \(correct) correct, \(wrong) wrong."
    }
    let total = jsNumberString(TIMED.roundMs / 1000)
    return "\(seconds) \(seconds == 1 ? "second" : "seconds") left of \(total). \(correct) correct, \(wrong) wrong."
}
