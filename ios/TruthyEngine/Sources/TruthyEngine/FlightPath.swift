import Foundation

// The flight path of the round header (components/FlightPath.tsx:44-138): the quadratic curve M6 24 Q138 -6 270 24 in
// a 276 by 34 box, its waypoints and their accessible labels.

public struct Point: Codable, Equatable, Sendable {
    public let x: Double
    public let y: Double

    public init(x: Double, y: Double) {
        self.x = x
        self.y = y
    }
}

public enum WaypointState: String, Codable, Sendable {
    case correct, wrong, current, future
}

private let P0 = Point(x: 6, y: 24)
private let P1 = Point(x: 138, y: -6)
private let P2 = Point(x: 270, y: 24)

private func lerp(_ a: Point, _ b: Point, _ t: Double) -> Point {
    Point(x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t)
}

/// The point of the curve at t, rounded to 0.01.
public func pointAt(_ t: Double) -> Point {
    let p = lerp(lerp(P0, P1, t), lerp(P1, P2, t), t)
    return Point(x: round2(p.x), y: round2(p.y))
}

/// Where waypoint i of n sits: evenly spread, the first at the start and the last at the end.
public func waypointT(_ i: Double, _ n: Double) -> Double {
    n <= 1 ? 0 : i / (n - 1)
}

/// The flown part of the curve, from the start to t, as an SVG path.
public func flownPath(_ t: Double) -> String {
    let control = lerp(P0, P1, t)
    let end = pointAt(t)
    let numbers = [P0.x, P0.y, round2(control.x), round2(control.y), end.x, end.y].map(jsNumberString)
    return "M\(numbers[0]) \(numbers[1]) Q\(numbers[2]) \(numbers[3]) \(numbers[4]) \(numbers[5])"
}

/// The plane's heading at t in degrees, rounded to 0.01.
public func headingAt(_ t: Double) -> Double {
    let dx = 2 * (1 - t) * (P1.x - P0.x) + 2 * t * (P2.x - P1.x)
    let dy = 2 * (1 - t) * (P1.y - P0.y) + 2 * t * (P2.y - P1.y)
    return round2((atan2(dy, dx) * 180) / Double.pi)
}

/// The state of every waypoint.
public func waypointStates(_ total: Int, _ results: [Bool], _ current: Int, _ answered: Bool) -> [WaypointState] {
    (0..<max(0, total)).map { i in
        if i < results.count && (i < current || answered) { return results[i] ? .correct : .wrong }
        return i == current ? .current : .future
    }
}

/// "card 3", "cards 1 and 2", "cards 1, 2 and 5".
public func cardList(_ numbers: [Int]) -> String {
    if numbers.count == 1 { return "card \(numbers[0])" }
    let head = numbers.dropLast().map(String.init).joined(separator: ", ")
    return "cards \(head) and \(numbers.last.map(String.init) ?? "undefined")"
}

/// "Card 4 of 10. Cards 1 and 2 correct, card 3 wrong."
public func flightPathLabel(_ total: Int, _ results: [Bool], _ current: Int) -> String {
    let correct = results.enumerated().filter(\.element).map { $0.offset + 1 }
    let wrong = results.enumerated().filter { !$0.element }.map { $0.offset + 1 }
    var parts: [String] = []
    if !correct.isEmpty { parts.append("\(cardList(correct)) correct") }
    if !wrong.isEmpty { parts.append("\(cardList(wrong)) wrong") }
    let head = "Card \(current + 1) of \(total)."
    if parts.isEmpty { return head }
    let tally = parts.joined(separator: ", ")
    return "\(head) \(tally.prefix(1).uppercased())\(tally.dropFirst())."
}

/// "Round complete. 10 of 10 cards. 7 correct, 3 wrong: cards 3, 6 and 9."
public func completedLabel(_ total: Int, _ results: [Bool]) -> String {
    let wrong = results.enumerated().filter { !$0.element }.map { $0.offset + 1 }
    let correct = results.count - wrong.count
    let head = "Round complete. \(results.count) of \(total) cards. \(correct) correct, \(wrong.count) wrong"
    return wrong.isEmpty ? "\(head)." : "\(head): \(cardList(wrong))."
}

/// The scale of the marks on a completed route: 1 up to 10 cards, 6/7 up to 17, then as large as keeps them apart.
public func completedScale(_ cards: Int) -> Double {
    if cards <= 10 { return 1 }
    if cards <= 17 { return 6.0 / 7 }
    return min(6, (0.35 * 264) / Double(cards - 1)) / 7
}
