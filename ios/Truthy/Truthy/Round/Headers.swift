import SwiftUI
import TruthyEngine

// The header of each class (reference 4.1a): one image with a full-sentence label, and a label row that is hidden
// from VoiceOver. The geometry is task 6's (pointAt, headingAt, streakLayout, trailLayout); the drawing is the web's
// 276 by 34 SVG box (FlightPath.tsx PathFrame), drawn at one scale and centred as the SVG does, and not clipped at its
// edges, so the plane on the first or the last waypoint shows whole. Each class draws what its web header draws
// (FlightPath.tsx, StreakPath.tsx, LivesPath.tsx, TimedPath.tsx).

struct HeaderFrame<Picture: View>: View {
    let label: String
    /// The labels, built at the Dynamic Type size they are drawn at (SizedText): the Timed clock has a font of its own.
    let left: (DynamicTypeSize) -> Text
    let right: ((DynamicTypeSize) -> Text)?
    @ViewBuilder let picture: () -> Picture
    @Environment(\.palette) private var palette

    var body: some View {
        // PathFrame: the drawing, then the label row 2 under it.
        VStack(spacing: Tokens.Space.s2) {
            picture()
                .frame(maxWidth: .infinity)
                .frame(height: Tokens.Size.flightPathHeight)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(label)
                .accessibilityAddTraits(.isImage)
            RouteLabelRow {
                SizedText(left)
                if let right { SizedText(right) }
            }
            .typeRole(Tokens.TypeRole.routeLabel)
            .foregroundStyle(palette.ink.color)
            .accessibilityHidden(true)
            .paperTextSize()
        }
    }
}

/// The label row under a route (FlightPath.tsx PathFrame: flex flex-wrap justify-between gap-x-8, each label
/// whitespace-nowrap, the right one ml-auto): the labels side by side at the row's ends while both fit with 8 between
/// them, otherwise each whole on its own line, the right one kept to the right. A label wider than the row on its own
/// wraps inside the row's width, so it never clips.
struct RouteLabelRow: Layout {
    /// Each label's size and place in a row `width` wide, from the labels' sizes on one line.
    static func frames(_ sizes: [CGSize], width: Double) -> [CGRect] {
        guard let first = sizes.first else { return [] }
        guard sizes.count > 1 else { return [CGRect(origin: .zero, size: first)] }
        let second = sizes[1]
        if first.width + Tokens.Space.s8 + second.width <= width {
            return [CGRect(origin: .zero, size: first), CGRect(x: width - second.width, y: 0, width: second.width, height: second.height)]
        }
        return [CGRect(origin: .zero, size: first),
                CGRect(x: max(0, width - second.width), y: first.height, width: second.width, height: second.height)]
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let ideal = subviews.map { $0.sizeThatFits(.unspecified) }
        let width = proposal.width ?? (ideal.map(\.width).reduce(0, +) + Tokens.Space.s8 * Double(max(0, ideal.count - 1)))
        let frames = Self.frames(sizes(subviews, ideal: ideal, width: width), width: width)
        return CGSize(width: width, height: frames.map(\.maxY).max() ?? 0)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let ideal = subviews.map { $0.sizeThatFits(.unspecified) }
        let frames = Self.frames(sizes(subviews, ideal: ideal, width: bounds.width), width: bounds.width)
        for (subview, frame) in zip(subviews, frames) {
            subview.place(at: CGPoint(x: bounds.minX + frame.minX, y: bounds.minY + frame.minY), proposal: ProposedViewSize(frame.size))
        }
    }

    /// A label on one line, or wrapped to the row's width when that line is wider than the row.
    private func sizes(_ subviews: Subviews, ideal: [CGSize], width: Double) -> [CGSize] {
        zip(subviews, ideal).map { subview, size in
            size.width <= width ? size : subview.sizeThatFits(ProposedViewSize(width: width, height: nil))
        }
    }
}

extension HeaderFrame {
    /// Labels that set no font of their own.
    init(label: String, left: Text, right: Text?, @ViewBuilder picture: @escaping () -> Picture) {
        self.init(label: label, left: { _ in left }, right: right.map { right in { _ in right } }, picture: picture)
    }
}

/// The SVG box of the headers: `draw` works in the 276 by 34 view box. The box keeps one scale, the smaller of the two
/// fits (preserveAspectRatio xMidYMid meet, the SVG default), is centred, and draws past its edges (overflow visible).
struct PathBox: View {
    /// How far past the box a drawing may reach: the plane's disc (r12) on a waypoint at x 6 reaches 6 past it.
    static let bleed = 16.0
    let draw: (inout GraphicsContext) -> Void

    /// The scale and the offset of the view box in a box of `width` by `height`.
    static func fit(width: Double, height: Double) -> (scale: Double, x: Double, y: Double) {
        let scale = min(width / 276, height / 34)
        return (scale, (width - 276 * scale) / 2, (height - 34 * scale) / 2)
    }

    var body: some View {
        Canvas { context, size in
            let fit = Self.fit(width: size.width - 2 * Self.bleed, height: size.height - 2 * Self.bleed)
            context.translateBy(x: Self.bleed + fit.x, y: Self.bleed + fit.y)
            context.scaleBy(x: fit.scale, y: fit.scale)
            draw(&context)
        }
        .padding(-Self.bleed)
        .allowsHitTesting(false)
    }
}

/// The pieces every header is drawn with (FlightPath.tsx RouteLine, Plane and Mark).
struct PathPieces {
    let palette: Palette

    /// The dotted curve of the route and, once the plane has left, the solid part up to t.
    func routeLine(_ context: GraphicsContext, flownTo t: Double) {
        var curve = Path()
        curve.move(to: CGPoint(x: 6, y: 24))
        curve.addQuadCurve(to: CGPoint(x: 270, y: 24), control: CGPoint(x: 138, y: -6))
        context.stroke(curve, with: .color(palette.ink.color), style: StrokeStyle(lineWidth: 1.6, lineCap: .round, dash: [2, 5]))
        if t > 0 {
            context.stroke(SVGPath.parse(flownPath(t)), with: .color(palette.ink.color), style: StrokeStyle(lineWidth: 2.4, lineCap: .round))
        }
    }

    /// The plane on the card on screen: an accent disc of r12 with the arrow turned to the heading.
    func plane(_ context: GraphicsContext, at p: Point, heading: Double) {
        var disc = context
        disc.translateBy(x: p.x, y: p.y)
        disc.rotate(by: .degrees(heading))
        disc.fill(Path(ellipseIn: CGRect(x: -12, y: -12, width: 24, height: 24)), with: .color(palette.accent.color))
        disc.stroke(Icon.planeArrow.path, with: .color(palette.onAccent.color), style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
    }

    /// An answered card: a circle of r7 with a tick (right) or a square of 13 with an x (wrong); the whole mark scales.
    /// A fresh right mark (the card just answered) is in the correct colour; `plain` leaves out the tick and the x.
    func mark(_ context: GraphicsContext, correct: Bool, at p: Point, scale: Double = 1, fresh: Bool = false, plain: Bool = false) {
        var mark = context
        mark.translateBy(x: p.x, y: p.y)
        mark.scaleBy(x: scale, y: scale)
        let glyph = StrokeStyle(lineWidth: 1.8)
        if correct {
            mark.fill(Path(ellipseIn: CGRect(x: -7, y: -7, width: 14, height: 14)), with: .color(fresh ? palette.correct.color : palette.ink.color))
            if !plain { mark.stroke(SVGPath.parse("M-3 0l2 2 4-4"), with: .color(palette.surfaceRaised.color), style: glyph) }
        } else {
            mark.fill(Path(roundedRect: CGRect(x: -6.5, y: -6.5, width: 13, height: 13), cornerRadius: 2), with: .color(palette.wrong.color))
            if !plain { mark.stroke(SVGPath.parse("M-3-3l6 6m0-6l-6 6"), with: .color(palette.surfaceRaised.color), style: glyph) }
        }
    }

    /// An open circle: paper inside an ink ring of 1.6.
    func openCircle(_ context: GraphicsContext, at p: Point, r: Double) {
        let circle = Path(ellipseIn: CGRect(x: p.x - r, y: p.y - r, width: 2 * r, height: 2 * r))
        context.fill(circle, with: .color(palette.surfaceRaised.color))
        context.stroke(circle, with: .color(palette.ink.color), lineWidth: 1.6)
    }

    /// A ring without fill, in ink.
    func ring(_ context: GraphicsContext, at p: Point, r: Double, width: Double = 1.4) {
        context.stroke(Path(ellipseIn: CGRect(x: p.x - r, y: p.y - r, width: 2 * r, height: 2 * r)), with: .color(palette.ink.color), lineWidth: width)
    }
}

/// Classic during a round (FlightPath.tsx): one waypoint per card, the plane on the card on screen until it is answered.
struct FlightRoute: View {
    let total: Int
    let results: [Bool]
    let current: Int
    let answered: Bool
    @Environment(\.palette) private var palette

    var body: some View {
        let pieces = PathPieces(palette: palette)
        let states = waypointStates(total, results, current, answered)
        let t = waypointT(Double(current), Double(total))
        PathBox { context in
            pieces.routeLine(context, flownTo: t)
            for (i, state) in states.enumerated() {
                let at = pointAt(waypointT(Double(i), Double(total)))
                switch state {
                case .correct, .wrong: pieces.mark(context, correct: state == .correct, at: at, fresh: state == .correct && i == current)
                case .current: break
                case .future: pieces.openCircle(context, at: at, r: i == total - 1 ? 5 : 4)
                }
            }
            if !answered { pieces.plane(context, at: pointAt(t), heading: headingAt(t)) }
        }
    }
}

/// A finished route on the result (FlightPath.tsx CompletedMarks): a mark per card, the ring where the previous best
/// was reached. A right mark too small for its tick is plain; a wrong square keeps a side of at least 6 with its x and,
/// enlarged past its neighbours, is drawn after them.
struct CompletedRoute: View {
    let results: [Bool]
    let total: Int
    let ring: Int?
    @Environment(\.palette) private var palette

    var body: some View {
        let pieces = PathPieces(palette: palette)
        let scale = completedScale(total)
        let plainCorrect = 7 * scale < 5
        let wrongScale = max(scale, 6.0 / 13)
        let lifted = wrongScale > scale
        let marks = Array(results.prefix(total).enumerated())
        let below = lifted ? marks.filter { $0.element } : marks
        let above = lifted ? marks.filter { !$0.element } : []
        let ringAt = ring.flatMap { $0 < 0 || $0 >= total ? nil : pointAt(waypointT(Double($0), Double(total))) }
        let gap = total <= 1 ? Double.infinity : 264 / Double(total - 1)
        let ringOffset = min(3.5, (gap - 2 * 7 * scale) / 2)
        PathBox { context in
            pieces.routeLine(context, flownTo: 1)
            func draw(_ mark: (offset: Int, element: Bool)) {
                pieces.mark(context, correct: mark.element, at: pointAt(waypointT(Double(mark.offset), Double(total))),
                            scale: mark.element ? scale : wrongScale, plain: mark.element ? plainCorrect : false)
            }
            below.forEach(draw)
            if let ringAt { pieces.ring(context, at: ringAt, r: ((7 * scale + ringOffset) * 100).rounded() / 100) }
            above.forEach(draw)
        }
    }
}

/// Streak (StreakPath.tsx): a dot per right answer before the card on screen, the open slots and the target ring up to
/// the best, the plane on the card on screen and, once it is answered, its mark there.
struct StreakRoute: View {
    let streak: Int
    let best: Int?
    /// The verdict of the card on screen; nil while it is a question.
    let answered: Bool?
    @Environment(\.palette) private var palette

    var body: some View {
        let pieces = PathPieces(palette: palette)
        let done = answered == true ? streak - 1 : streak
        let layout = streakLayout(done, best)
        let futureRadius = min(4, ((layout.dot * 2 / 3) * 10).rounded() / 10)
        let here = pointAt(layout.t(done))
        let ringAt = layout.ring.map { pointAt(layout.t($0)) }
        PathBox { context in
            pieces.routeLine(context, flownTo: layout.t(done))
            if layout.dot > 1.2 {
                for slot in 0..<max(0, done) {
                    pieces.mark(context, correct: true, at: pointAt(layout.t(slot)), scale: layout.dot / 7, plain: !layout.ticks)
                }
            }
            if let ring = layout.ring, let ringAt, ring < done { pieces.ring(context, at: ringAt, r: layout.dot + 3.5) }
            if futureRadius >= 2 {
                for slot in layout.future { pieces.openCircle(context, at: pointAt(layout.t(slot)), r: futureRadius) }
            }
            if layout.target, let ring = layout.ring, let ringAt, ring > done {
                pieces.openCircle(context, at: ringAt, r: 7)
                context.fill(Path(ellipseIn: CGRect(x: ringAt.x - 3, y: ringAt.y - 3, width: 6, height: 6)), with: .color(palette.ink.color))
            }
            if let answered {
                pieces.mark(context, correct: answered, at: here, fresh: true)
                if answered, layout.ring == done { pieces.ring(context, at: here, r: 10.5) }
            } else {
                pieces.plane(context, at: here, heading: headingAt(layout.t(done)))
            }
        }
    }
}

/// Three lives (LivesPath.tsx): three hearts (a lost one outlined with a slash), the trail of the cards answered before
/// the one on screen ending at the plane at x 238, the dotted line still to fly, and the mark of the card on screen in
/// the plane's place once it is answered.
struct LivesRoute: View {
    let results: [Bool]
    let answered: Bool
    @Environment(\.palette) private var palette

    var body: some View {
        let pieces = PathPieces(palette: palette)
        let left = max(0, LIVES - results.filter { !$0 }.count)
        let marks = answered ? Array(results.dropLast()) : results
        let layout = trailLayout(marks.count)
        let crossReach = ((layout.side * 0.22) * 10).rounded() / 10
        let crossStroke = marks.count <= 14 ? 1.4 : 1.3
        let here = Point(x: 238, y: 17)
        PathBox { context in
            for (i, x) in [11.0, 39, 67].enumerated() {
                var heart = context
                heart.translateBy(x: x, y: 6)
                if i < left {
                    heart.fill(Icon.heart.path, with: .color(palette.ink.color))
                } else {
                    heart.stroke(Icon.heart.path, with: .color(palette.inkMuted.color), style: StrokeStyle(lineWidth: 1.6, lineJoin: .round))
                    heart.stroke(Icon.heartSlash.path, with: .color(palette.inkMuted.color), style: StrokeStyle(lineWidth: 1.6, lineCap: .round))
                }
            }
            if !marks.isEmpty {
                var line = Path()
                line.move(to: CGPoint(x: layout.x(0), y: 17))
                line.addLine(to: CGPoint(x: 238, y: 17))
                context.stroke(line, with: .color(palette.ink.color), style: StrokeStyle(lineWidth: 1.2, lineCap: .round))
            }
            var rest = Path()
            rest.move(to: CGPoint(x: 238, y: 17))
            rest.addLine(to: CGPoint(x: 274, y: 17))
            context.stroke(rest, with: .color(palette.ink.color), style: StrokeStyle(lineWidth: 1.6, lineCap: .round, dash: [2, 5]))
            for (i, correct) in marks.enumerated() where correct && layout.r > 0.6 {
                let x = layout.x(i)
                context.fill(Path(ellipseIn: CGRect(x: x - layout.r, y: 17 - layout.r, width: 2 * layout.r, height: 2 * layout.r)), with: .color(palette.ink.color))
            }
            // The wrong squares after every dot, so the dots around them never cover their x.
            for (i, correct) in marks.enumerated() where !correct {
                let x = layout.x(i)
                let r1 = { (v: Double) in (v * 10).rounded() / 10 }
                let square = CGRect(x: r1(x - layout.side / 2), y: r1(17 - layout.side / 2), width: layout.side, height: layout.side)
                context.fill(Path(roundedRect: square, cornerRadius: 1.5), with: .color(palette.wrong.color))
                if layout.cross {
                    var cross = Path()
                    cross.move(to: CGPoint(x: r1(x - crossReach), y: 17 - crossReach))
                    cross.addLine(to: CGPoint(x: r1(x - crossReach) + r1(crossReach * 2), y: 17 - crossReach + r1(crossReach * 2)))
                    cross.move(to: CGPoint(x: r1(x - crossReach) + r1(crossReach * 2), y: 17 - crossReach))
                    cross.addLine(to: CGPoint(x: r1(x - crossReach), y: 17 - crossReach + r1(crossReach * 2)))
                    context.stroke(cross, with: .color(palette.surfaceRaised.color), lineWidth: crossStroke)
                }
            }
            if answered, let last = results.last {
                pieces.mark(context, correct: last, at: here, fresh: true)
            } else {
                pieces.plane(context, at: here, heading: 0)
            }
        }
    }
}

/// Timed (TimedPath.tsx): the start dot, the three quarter marks (filled once passed), the open end dot and the plane.
struct TimedRoute: View {
    /// How far the clock has run, 0 to 1.
    let t: Double
    @Environment(\.palette) private var palette

    var body: some View {
        let pieces = PathPieces(palette: palette)
        PathBox { context in
            pieces.routeLine(context, flownTo: t)
            context.fill(Path(ellipseIn: CGRect(x: 1, y: 19, width: 10, height: 10)), with: .color(palette.ink.color))
            for quarter in [0.25, 0.5, 0.75] {
                let at = pointAt(quarter)
                let circle = Path(ellipseIn: CGRect(x: at.x - 3.5, y: at.y - 3.5, width: 7, height: 7))
                context.fill(circle, with: .color(t >= quarter ? palette.ink.color : palette.surfaceRaised.color))
                context.stroke(circle, with: .color(palette.ink.color), lineWidth: 1.6)
            }
            pieces.openCircle(context, at: pointAt(1), r: 5)
            pieces.plane(context, at: pointAt(t), heading: headingAt(t))
        }
    }
}

struct FlightPathHeader: View {
    let round: RoundState

    var body: some View {
        let total = round.cards.count
        let results = round.answers.map(\.correct)
        let correct = results.filter { $0 }.count
        HeaderFrame(
            label: flightPathLabel(total, results, round.index),
            left: Text("Card ") + Text("\(round.index + 1)").bold() + Text(" of \(total)"),
            right: Text("\(correct) correct · \(results.count - correct) wrong")
        ) {
            FlightRoute(total: total, results: results, current: round.index, answered: round.phase == .answered)
        }
    }
}

struct StreakHeader: View {
    let round: RoundState
    let best: Int?

    var body: some View {
        let streak = round.answers.prefix { $0.correct }.count
        let ended = isDecided(round)
        // The verdict of the card on screen once it is answered (PlayScreen.tsx: the last answer while answered).
        let verdict: Bool? = round.phase == .answered ? lastAnswer(round)?.correct : nil
        HeaderFrame(
            label: streakLabel(streak, best, ended),
            left: ended ? Text("Streak ended at ") + Text("\(streak)").bold() : Text("Streak ") + Text("\(streak)").bold(),
            right: best.flatMap { $0 >= 1 ? (streak > $0 ? Text("Previous best ") : Text("Best ")) + Text("\($0)").bold() : nil }
        ) {
            StreakRoute(streak: streak, best: best, answered: verdict)
        }
    }
}

struct LivesHeader: View {
    let round: RoundState

    var body: some View {
        let results = round.answers.map(\.correct)
        let left = livesLeft(round)
        HeaderFrame(
            label: livesLabel(results),
            left: left == 0 ? Text("No").bold() + Text(" lives left") : Text("\(left)").bold() + Text(" of 3 lives left"),
            right: Text("\(results.count)").bold() + Text(" answered")
        ) {
            LivesRoute(results: results, answered: round.phase == .answered)
        }
    }
}

struct TimedHeader: View {
    let round: RoundState
    @Environment(\.accessibilityReduceMotion) private var reducedMotion

    var body: some View {
        let remaining = round.clock?.remainingMs ?? TIMED.roundMs
        let results = round.answers.map(\.correct)
        let correct = results.filter { $0 }.count
        let shown = reducedMotion ? (remaining / 1000).rounded(.up) * 1000 : remaining
        HeaderFrame(
            label: timedLabel(remaining, correct, results.count - correct),
            left: { size in Text(clockText(remaining)).font(Tokens.TypeRole.timedClock.font(at: size).monospacedDigit()).bold() + Text(" left") },
            right: { _ in Text("\(correct) correct · \(results.count - correct) wrong") }
        ) {
            TimedRoute(t: min(1, max(0, 1 - shown / TIMED.roundMs)))
        }
    }
}
