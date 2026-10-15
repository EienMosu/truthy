import Foundation

/// One line of the trace the app writes with `TRUTHY_REVIEW_TRACE` (`TraceSample` in the app's
/// `Debug/ReviewFrames.swift`): time, the first touch in window points, the card's and the pass's frames
/// [x, y, width, height].
struct TracePoint: Decodable, Equatable {
    let t: Double
    let touch: [Double]?
    let card: [Double]?
    var pass: [Double]? = nil
}

/// Feel item N4: the card's drawn offset equals the finger's travel since touch-down (spec 5.3, "slop included").
enum FollowCheck {
    /// Reads a trace file, one JSON object per line.
    static func read(_ path: String) throws -> [TracePoint] {
        let text = try String(contentsOfFile: path, encoding: .utf8)
        return try text.split(separator: "\n").map { try JSONDecoder().decode(TracePoint.self, from: Data($0.utf8)) }
    }

    /// The error |card offset - finger travel| at `count` frames spread evenly over the drag, in points. The drag is
    /// the last run of frames with a finger down (the taps of the route choice came before it). The card's offset is
    /// the move of its centre (a rotation about the centre keeps the centre), measured from the last frame before the
    /// finger came down. A display-link sample reads the newest touch but the card as last drawn, so each card is
    /// compared with the touch of the frame before it. Only frames where that finger is at least `beyond` points from
    /// where it came down count, so the recognizer's slop is behind. Nil when the trace has fewer such frames than `count`.
    static func errors(_ trace: [TracePoint], count: Int = 10, beyond: Double = 20) -> [Double]? {
        let points = trace.sorted { $0.t < $1.t }
        guard let lastTouch = points.lastIndex(where: { $0.touch != nil }) else { return nil }
        let down = (points[..<lastTouch].lastIndex(where: { $0.touch == nil }) ?? -1) + 1
        guard down > 0,
              let rest = points[..<down].last(where: { $0.card != nil })?.card,
              let downX = points[down].touch?.first
        else { return nil }
        let restCentre = rest[0] + rest[2] / 2
        var travelled: [(finger: Double, card: Double)] = []
        var drawnFor: Double?
        for point in points[down...] {
            guard let touch = point.touch else { break }
            defer { drawnFor = touch[0] }
            guard let card = point.card, let x = drawnFor else { continue }
            let finger = x - downX
            if abs(finger) >= beyond { travelled.append((finger, card[0] + card[2] / 2 - restCentre)) }
        }
        guard travelled.count >= count, count > 0 else { return nil }
        return (0..<count).map { i in
            let pick = travelled[i * (travelled.count - 1) / max(count - 1, 1)]
            return abs(pick.card - pick.finger)
        }
    }
}
