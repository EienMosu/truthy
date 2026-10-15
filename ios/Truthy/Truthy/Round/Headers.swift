import SwiftUI
import TruthyEngine

// The header of each class (reference 4.1a): one image with a full-sentence label, and a label row that is hidden
// from VoiceOver. The geometry is task 6's (pointAt, headingAt, streakLayout, trailLayout); the drawing is a Canvas in
// the 276 by 34 box of the web, scaled to the width.

struct HeaderFrame<Picture: View>: View {
    let label: String
    let left: Text
    let right: Text?
    @ViewBuilder let picture: () -> Picture
    @Environment(\.palette) private var palette

    var body: some View {
        VStack(spacing: Tokens.Space.s4) {
            picture()
                .frame(maxWidth: .infinity)
                .frame(height: Tokens.Size.flightPathHeight)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(label)
                .accessibilityAddTraits(.isImage)
            HStack {
                left
                Spacer()
                if let right { right }
            }
            .typeRole(Tokens.TypeRole.routeLabel)
            .foregroundStyle(palette.ink.color)
            .accessibilityHidden(true)
            .paperTextSize()
        }
    }
}

/// A waypoint of the header: where it sits, its state, its scale, whether it is the card just answered right (drawn
/// in the correct colour) and whether it is the route's last (a future one is r5 there, r4 elsewhere).
struct RouteMark {
    var t: Double
    var state: WaypointState
    var scale: Double = 1
    var fresh = false
    var last = false
}

/// The route drawn in the header box (FlightPath.tsx): the dotted curve in ink, solid up to `flown`, the waypoints (a
/// circle with a tick for a right answer, a square with an x for a wrong one, reference 5.9), and the plane.
struct RouteCanvas: View {
    var flown: Double
    var plane: Double?
    var marks: [RouteMark] = []
    /// Streak's completed route: the ring at the previous best (reference 4.1 R1), as a position on the curve.
    var ring: Double?
    @Environment(\.palette) private var palette

    var body: some View {
        Canvas { context, size in
            let scale = size.width / 276
            context.scaleBy(x: scale, y: size.height / 34)
            var curve = Path()
            curve.move(to: CGPoint(x: 6, y: 24))
            curve.addQuadCurve(to: CGPoint(x: 270, y: 24), control: CGPoint(x: 138, y: -6))
            context.stroke(curve, with: .color(palette.ink.color), style: StrokeStyle(lineWidth: 1.6, lineCap: .round, dash: [2, 5]))
            if flown > 0 {
                context.stroke(SVGPath.parse(flownPath(flown)), with: .color(palette.ink.color), style: StrokeStyle(lineWidth: 2.4, lineCap: .round))
            }
            let glyph = StrokeStyle(lineWidth: 1.8, lineCap: .butt, lineJoin: .miter)
            // Under the marks, so the mark at the previous best keeps its tick inside the ring.
            if let ring {
                let p = pointAt(ring)
                let circle = Path(ellipseIn: CGRect(x: p.x - 7, y: p.y - 7, width: 14, height: 14))
                context.fill(circle, with: .color(palette.surfaceRaised.color))
                context.stroke(circle, with: .color(palette.ink.color), lineWidth: 1.6)
            }
            for mark in marks {
                let p = pointAt(mark.t)
                let r = 7 * mark.scale
                switch mark.state {
                case .correct:
                    context.fill(Path(ellipseIn: CGRect(x: p.x - r, y: p.y - r, width: 2 * r, height: 2 * r)),
                                 with: .color(mark.fresh ? palette.correct.color : palette.ink.color))
                    if r >= 5 {
                        var tick = context
                        tick.translateBy(x: p.x, y: p.y)
                        tick.scaleBy(x: mark.scale, y: mark.scale)
                        tick.stroke(SVGPath.parse("M-3 0l2 2 4-4"), with: .color(palette.surfaceRaised.color), style: glyph)
                    }
                case .wrong:
                    let side = 13 * mark.scale
                    context.fill(Path(roundedRect: CGRect(x: p.x - side / 2, y: p.y - side / 2, width: side, height: side), cornerRadius: 2), with: .color(palette.wrong.color))
                    if side >= 9 {
                        var cross = context
                        cross.translateBy(x: p.x, y: p.y)
                        cross.scaleBy(x: mark.scale, y: mark.scale)
                        cross.stroke(SVGPath.parse("M-3-3l6 6m0-6l-6 6"), with: .color(palette.surfaceRaised.color), style: glyph)
                    }
                case .current:
                    break
                case .future:
                    let open = mark.last ? 5.0 : 4.0
                    let ring = Path(ellipseIn: CGRect(x: p.x - open, y: p.y - open, width: 2 * open, height: 2 * open))
                    context.fill(ring, with: .color(palette.surfaceRaised.color))
                    context.stroke(ring, with: .color(palette.ink.color), lineWidth: 1.6)
                }
            }
            if let plane {
                let p = pointAt(plane)
                var disc = context
                disc.translateBy(x: p.x, y: p.y)
                disc.fill(Path(ellipseIn: CGRect(x: -12, y: -12, width: 24, height: 24)), with: .color(palette.accent.color))
                disc.rotate(by: .degrees(headingAt(plane)))
                disc.stroke(Icon.planeArrow.path, with: .color(palette.onAccent.color), style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
            }
        }
    }
}

struct FlightPathHeader: View {
    let round: RoundState

    var body: some View {
        let total = round.cards.count
        let results = round.answers.map(\.correct)
        let answered = round.phase == .answered
        let states = waypointStates(total, results, round.index, answered)
        let marks = states.enumerated().map { i, state in
            RouteMark(t: waypointT(Double(i), Double(total)), state: state, fresh: state == .correct && answered && i == round.index,
                      last: i == total - 1)
        }
        let correct = results.filter { $0 }.count
        HeaderFrame(
            label: flightPathLabel(total, results, round.index),
            left: Text("Card ") + Text("\(round.index + 1)").bold() + Text(" of \(total)"),
            right: Text("\(correct) correct · \(results.count - correct) wrong")
        ) {
            RouteCanvas(flown: waypointT(Double(round.index), Double(total)), plane: answered ? nil : waypointT(Double(round.index), Double(total)), marks: marks)
        }
    }
}

struct StreakHeader: View {
    let round: RoundState
    let best: Int?

    var body: some View {
        let streak = round.answers.prefix { $0.correct }.count
        let ended = isDecided(round)
        let layout = streakLayout(streak, best)
        let marks = (0..<streak).map { RouteMark(t: layout.t($0), state: .correct, scale: layout.dot / 7) }
            + layout.future.map { RouteMark(t: layout.t($0), state: .future) }
        HeaderFrame(
            label: streakLabel(streak, best, ended),
            left: ended ? Text("Streak ended at ") + Text("\(streak)").bold() : Text("Streak ") + Text("\(streak)").bold(),
            right: best.flatMap { $0 >= 1 ? (streak > $0 ? Text("Previous best ") : Text("Best ")) + Text("\($0)").bold() : nil }
        ) {
            RouteCanvas(flown: layout.t(streak), plane: ended ? nil : layout.t(streak), marks: marks)
        }
    }
}

struct LivesHeader: View {
    let round: RoundState
    @Environment(\.palette) private var palette

    var body: some View {
        let results = round.answers.map(\.correct)
        let left = livesLeft(round)
        let layout = trailLayout(results.count)
        HeaderFrame(
            label: livesLabel(results),
            left: left == 0 ? Text("No").bold() + Text(" lives left") : Text("\(left)").bold() + Text(" of 3 lives left"),
            right: Text("\(results.count)").bold() + Text(" answered")
        ) {
            Canvas { context, size in
                context.scaleBy(x: size.width / 276, y: size.height / 34)
                for (i, x) in [11.0, 39, 67].enumerated() {
                    var heart = context
                    heart.translateBy(x: x, y: 6)
                    if i < left {
                        heart.fill(Icon.heart.path, with: .color(palette.ink.color))
                    } else {
                        heart.stroke(Icon.heart.path, with: .color(palette.inkMuted.color), lineWidth: 1.6)
                        heart.stroke(Icon.heartSlash.path, with: .color(palette.inkMuted.color), style: StrokeStyle(lineWidth: 1.6, lineCap: .round))
                    }
                }
                for (i, correct) in results.enumerated() {
                    let x = layout.x(i)
                    if correct {
                        context.fill(Path(ellipseIn: CGRect(x: x - layout.r, y: 17 - layout.r, width: 2 * layout.r, height: 2 * layout.r)), with: .color(palette.ink.color))
                    } else {
                        context.fill(Path(CGRect(x: x - layout.side / 2, y: 17 - layout.side / 2, width: layout.side, height: layout.side)), with: .color(palette.wrong.color))
                    }
                }
                var plane = context
                plane.translateBy(x: 238, y: 17)
                plane.fill(Path(ellipseIn: CGRect(x: -12, y: -12, width: 24, height: 24)), with: .color(palette.accent.color))
                plane.stroke(Icon.planeArrow.path, with: .color(palette.onAccent.color), style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
            }
        }
    }
}

struct TimedHeader: View {
    let round: RoundState
    @Environment(\.accessibilityReduceMotion) private var reducedMotion

    var body: some View {
        let remaining = round.clock?.remainingMs ?? 0
        let results = round.answers.map(\.correct)
        let correct = results.filter { $0 }.count
        let shown = reducedMotion ? (remaining / 1000).rounded(.up) * 1000 : remaining
        let t = 1 - shown / TIMED.roundMs
        HeaderFrame(
            label: timedLabel(remaining, correct, results.count - correct),
            left: Text(clockText(remaining)).font(Tokens.TypeRole.timedClock.font.monospacedDigit()).bold() + Text(" left"),
            right: Text("\(correct) correct · \(results.count - correct) wrong")
        ) {
            // A start dot, the three quarter marks (filled once passed) and the r5 end dot (TimedPath.tsx).
            RouteCanvas(flown: t, plane: t, marks: [RouteMark(t: 0, state: .correct, scale: 0.5)]
                + [0.25, 0.5, 0.75].map { RouteMark(t: $0, state: t >= $0 ? .correct : .future, scale: 0.5) }
                + [RouteMark(t: 1, state: .future, last: true)])
        }
    }
}
