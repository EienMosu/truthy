import Foundation
import TruthyEngine

// The web's back motion of the start flow (reference 5.7 "Start: step forward and back", dir = -1; StartFlow.tsx:230-267,
// 815-822, FillInPass.tsx:131-132, 379-385, passValueTravel.ts:104-113) written as a function of progress p from 0 to 1,
// so a finger can drive it (spec 5.1, risk 2). Every way back plays it: the gestures, the Back pill, a pass field,
// Escape, "Change platform". Time is p times durationMs, linear; each part runs its own easing inside its window and is
// exactly at rest outside it (plan C task 11 rule 4 is the same motion).
//   Full motion: the old panel sinks 10 and fades over 140 (ease-out), its title over 80; the new step's items come in
//   from 24 above over 240 (ease), the first after 110 and each next 25 later. Back to step 1: the pass and the Back pill
//   leave (+12 over 110), the logo (from -12) and the continue line (from +12) come in over 240 after 120, and the theme
//   switch moves to the logo row over 240. From step 6: Start round leaves (+12 over 110). The cleared pass fields
//   return to dashes over 140 after 220. A change of pass stage: the old block fades over 120 (ease-out), the new one
//   over 220 after 90, the paper and the band morph over 360, the old value copy is gone by 60 percent and the new one
//   comes in from 40 percent (linear).
//   Reduced motion, 230 = 90 + 140 ms: nothing moves; what leaves fades over 100, what comes fades in over 140 after 90
//   (ease-out, the web's default opacity easing); the parts the web switches at once (the dashes, the theme switch, the
//   pass morph) switch at t = 100, so p = 0 is still the old step at rest. No value copy travels.

/// A layer's opacity and vertical offset in points (positive is down).
struct BackLayer: Equatable, Sendable {
    var opacity: Double
    var offsetY: Double
}

struct BackFrame: Equatable, Sendable {
    /// The step being left: it fades and sinks.
    var oldOpacity: Double
    var oldOffsetY: Double
    /// The old title's own faster fade, applied on top of the panel's (1 under reduced motion).
    var oldTitleOpacity: Double
    /// Offset and opacity of the new step's item i (0 is the title).
    var newItems: [ItemFrame]
    /// The dashes of the pass fields this back clears.
    var dashesOpacity: Double
    /// Back to step 1: the pass and the Back pill leave (tripOut), the logo (brandIn) and the continue line (footIn)
    /// come in, and the theme switch moves to the logo row (switchShift, 0 to 1).
    var topSwap: Bool
    var tripOut: BackLayer
    var brandIn: BackLayer
    var footIn: BackLayer
    var switchShift: Double
    /// Start round leaving, on a back from step 6.
    var footOut: BackLayer
    /// The pass changes stage (destination for steps 2 and 3, route for 4 and 5, ready for 6) and stays on screen.
    var stageChange: Bool
    var oldBlockOpacity: Double
    var newBlockOpacity: Double
    /// The paper's and the band's height, from the old stage (0) to the new one (1).
    var morph: Double
    /// Whether the values travel as two cross-fading copies; under reduced motion the blocks carry them.
    var valuesTravel: Bool
    var oldValueOpacity: Double
    var newValueOpacity: Double

    struct ItemFrame: Equatable, Sendable {
        var offsetY: Double
        var opacity: Double
    }
}

struct BackTransition: Equatable, Sendable {
    let from: Step
    let to: Step
    /// The new step's title plus its rendered options. No default: every caller passes it (at least 1, the title).
    let itemCount: Int

    init(from: Step, to: Step, itemCount: Int) {
        self.from = from
        self.to = to
        self.itemCount = max(1, itemCount)
    }

    private static func ms(_ seconds: Double) -> Double { (seconds * 1000).rounded() }

    /// The length of the whole motion in milliseconds: max(360, 110 + 25 (itemCount - 1) + 240), or 230 reduced.
    func durationMs(reducedMotion: Bool) -> Double {
        if reducedMotion { return 90 + Self.ms(Tokens.Duration.reducedIn) }
        let lastItem = Self.ms(Tokens.Duration.stepEnterDelay) + Double(itemCount - 1) * Self.ms(Tokens.Duration.stepStagger)
            + Self.ms(Tokens.Duration.stepEnter)
        return max(Self.ms(Tokens.Duration.t3), lastItem)
    }

    func frame(at p: Double, reducedMotion reduced: Bool) -> BackFrame {
        let progress = p.isNaN ? 0 : min(1, max(0, p))
        let t = progress * durationMs(reducedMotion: reduced)
        let ms = Self.ms
        func window(_ start: Double, _ length: Double, _ curve: CubicCurve?) -> Double {
            let f = (t - start) / length
            if f <= 0 { return 0 }
            if f >= 1 { return 1 }
            return curve?.value(at: f) ?? f
        }
        let reducedOut = window(0, ms(Tokens.Duration.reducedOut), Tokens.Curve.easeOut)
        let reducedIn = window(90, ms(Tokens.Duration.reducedIn), Tokens.Curve.easeOut)
        let snap: Double = t >= ms(Tokens.Duration.reducedOut) ? 1 : 0
        let topSwap = to == 1
        func zoneOut() -> BackLayer {
            if reduced { return BackLayer(opacity: 1 - reducedOut, offsetY: 0) }
            let f = window(0, ms(Tokens.Duration.topExit), Tokens.Curve.ease)
            return BackLayer(opacity: 1 - f, offsetY: 12 * f)
        }
        func zoneIn(_ from: Double) -> BackLayer {
            if reduced { return BackLayer(opacity: reducedIn, offsetY: 0) }
            let f = window(ms(Tokens.Duration.topEnterDelay), ms(Tokens.Duration.stepEnter), Tokens.Curve.ease)
            return BackLayer(opacity: f, offsetY: from * (1 - f))
        }
        func stage(_ step: Step) -> Int { step <= 1 ? 0 : step <= 3 ? 1 : step <= 5 ? 2 : 3 }
        let old = reduced ? 0 : window(0, ms(Tokens.Duration.stepExit), Tokens.Curve.easeOut)
        let items = (0..<itemCount).map { i -> BackFrame.ItemFrame in
            if reduced { return .init(offsetY: 0, opacity: reducedIn) }
            let f = window(ms(Tokens.Duration.stepEnterDelay) + Double(i) * ms(Tokens.Duration.stepStagger), ms(Tokens.Duration.stepEnter),
                           Tokens.Curve.ease)
            return .init(offsetY: -24 * (1 - f), opacity: f)
        }
        let t3 = ms(Tokens.Duration.t3)
        return BackFrame(
            oldOpacity: reduced ? 1 - reducedOut : 1 - old,
            oldOffsetY: 10 * old,
            oldTitleOpacity: reduced ? 1 : 1 - window(0, ms(Tokens.Duration.stepExitTitle), Tokens.Curve.easeOut),
            newItems: items,
            dashesOpacity: reduced ? snap : window(t3 - ms(Tokens.Duration.dashIn), ms(Tokens.Duration.dashIn), Tokens.Curve.ease),
            topSwap: topSwap,
            tripOut: zoneOut(),
            brandIn: zoneIn(-12),
            footIn: zoneIn(12),
            switchShift: !topSwap ? 0 : reduced ? snap : window(0, ms(Tokens.Duration.stepEnter), Tokens.Curve.ease),
            footOut: zoneOut(),
            stageChange: !topSwap && stage(from) != stage(to),
            oldBlockOpacity: 1 - (reduced ? reducedOut : window(0, ms(Tokens.Duration.t1), Tokens.Curve.easeOut)),
            newBlockOpacity: reduced ? reducedIn : window(90, ms(Tokens.Duration.t2), Tokens.Curve.ease),
            morph: reduced ? snap : window(0, t3, Tokens.Curve.ease),
            valuesTravel: !reduced,
            oldValueOpacity: reduced ? 0 : 1 - window(0, t3 * 0.6, nil),
            newValueOpacity: reduced ? 1 : window(t3 * 0.4, t3 * 0.6, nil))
    }

    /// The release rule of the back gesture (spec 5.1): a fling towards the leading edge above 500 points a second
    /// cancels; one towards the trailing edge above 500, or a progress above one half, completes.
    static func completes(progress: Double, velocity: Double) -> Bool {
        if velocity < -500 { return false }
        return velocity > 500 || progress > 0.5
    }
}
