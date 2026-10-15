import SwiftUI
import TruthyEngine
import UIKit
import UIKit.UIGestureRecognizerSubclass

// The card under the finger (spec 5.3, reference 7.2 item 1): a UIPanGestureRecognizer subclass bridged with
// UIGestureRecognizerRepresentable, attached to a stationary container. touchesBegan keeps the touch-down sample
// (window point, UITouch.timestamp) before any slop; moves and the end append every coalesced touch; a second touch
// cancels. It begins only for horizontal-dominant movement, so the ticket's own vertical scroll keeps working, and
// never for a touch that starts within 24 of the window edge (the round's back pan lives there).

final class CardPanRecognizer: UIPanGestureRecognizer {
    private(set) var samples: [SwipeSample] = []

    private func sample(_ touch: UITouch) -> SwipeSample {
        let point = touch.location(in: nil)
        return SwipeSample(x: point.x, y: point.y, t: touch.timestamp * 1000)
    }

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent) {
        if !samples.isEmpty || touches.count > 1 {
            state = state == .possible ? .failed : .cancelled
            return
        }
        if let touch = touches.first { samples = [sample(touch)] }
        super.touchesBegan(touches, with: event)
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent) {
        append(touches, event)
        super.touchesMoved(touches, with: event)
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent) {
        append(touches, event)
        super.touchesEnded(touches, with: event)
    }

    private func append(_ touches: Set<UITouch>, _ event: UIEvent) {
        for touch in touches {
            for coalesced in event.coalescedTouches(for: touch) ?? [touch] { samples.append(sample(coalesced)) }
        }
    }

    override func reset() {
        super.reset()
        samples = []
    }

    /// The finger's travel from the touch-down point, slop included, so the card never lags the finger.
    var dx: Double {
        guard let first = samples.first, let last = samples.last else { return 0 }
        return last.x - first.x
    }
}

struct CardDrag: Equatable {
    enum Phase { case moved, released, cancelled }
    var phase: Phase
    var dx: Double
    var samples: [SwipeSample]
    /// Points per second, from the recognizer.
    var velocity: Double
    var windowWidth: Double
}

struct CardPan: UIGestureRecognizerRepresentable {
    var isEnabled: Bool
    var onDrag: (CardDrag) -> Void

    func makeCoordinator(converter: CoordinateSpaceConverter) -> Delegate {
        Delegate()
    }

    func makeUIGestureRecognizer(context: Context) -> CardPanRecognizer {
        let recognizer = CardPanRecognizer()
        recognizer.delegate = context.coordinator
        recognizer.maximumNumberOfTouches = 1
        return recognizer
    }

    func updateUIGestureRecognizer(_ recognizer: CardPanRecognizer, context: Context) {
        recognizer.isEnabled = isEnabled
    }

    func handleUIGestureRecognizerAction(_ recognizer: CardPanRecognizer, context: Context) {
        let width = recognizer.view?.window?.bounds.width ?? 0
        let velocity = recognizer.velocity(in: nil).x
        let drag = { (phase: CardDrag.Phase) in
            CardDrag(phase: phase, dx: recognizer.dx, samples: recognizer.samples, velocity: velocity, windowWidth: width)
        }
        switch recognizer.state {
        case .began, .changed: onDrag(drag(.moved))
        case .ended: onDrag(drag(.released))
        case .cancelled, .failed: onDrag(drag(.cancelled))
        default: break
        }
    }

    final class Delegate: NSObject, UIGestureRecognizerDelegate {
        func gestureRecognizerShouldBegin(_ recognizer: UIGestureRecognizer) -> Bool {
            guard let pan = recognizer as? CardPanRecognizer, let first = pan.samples.first, let last = pan.samples.last else { return false }
            let width = pan.view?.window?.bounds.width ?? 0
            guard first.x >= SWIPE.edgePx, first.x <= width - SWIPE.edgePx else { return false }
            // The recognizer's own translation is still zero when SwiftUI asks; the samples hold the movement so far.
            return abs(last.x - first.x) > abs(last.y - first.y)
        }

        func gestureRecognizer(_ recognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool {
            false
        }
    }
}

/// The threshold haptic (spec 5.5): one tick per crossing of the 90 commit line, re-armed by moving back under it,
/// never per move.
struct CrossingCounter: Equatable {
    private(set) var count = 0
    private var beyond = false

    mutating func update(dx: Double) {
        let over = abs(dx) >= SWIPE.commitPx
        if over && !beyond { count += 1 }
        beyond = over
    }

    mutating func release() {
        beyond = false
    }
}

/// The card's spring back, as a function of time, so a touch can catch it where it is (spec 5.3: the drawn offset is
/// c + dx while interpret and the haptic use dx alone). A damped spring from `offset` with `velocity` (points per
/// second) towards 0, with the response and damping of Tokens.Spring.snap.
struct SpringBack: Equatable {
    var offset: Double
    var velocity: Double
    var startedAt: Double
    var spring = Tokens.Spring.snap

    func position(atMs now: Double) -> Double {
        let t = max(0, (now - startedAt) / 1000)
        let omega = 2 * Double.pi / spring.response
        let zeta = spring.dampingFraction
        let decay = exp(-zeta * omega * t)
        let omegaD = omega * (1 - zeta * zeta).squareRoot()
        let b = (velocity + zeta * omega * offset) / omegaD
        return decay * (offset * cos(omegaD * t) + b * sin(omegaD * t))
    }
}
