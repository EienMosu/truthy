import SwiftUI
import TruthyEngine
import UIKit

// The native back gestures (spec 5.1, 5.2): a pan that starts within 24 points of the leading window edge, bridged
// with UIGestureRecognizerRepresentable (iOS 18), and on iOS 26 and later a rightward horizontal pan anywhere on a
// step. Each reports the progress across the window, the horizontal velocity and the window's width; the caller
// decides on release with BackTransition.completes. The recognizers' isEnabled never changes while a pan runs:
// disabling a UIKit recognizer mid-gesture cancels it.

struct BackPanEvent: Equatable {
    enum Phase { case changed, ended, cancelled }
    var phase: Phase
    /// The finger's travel as a share of the window width, 0 to 1.
    var progress: Double
    /// Points per second, positive towards the trailing edge.
    var velocity: Double
    /// The window's width in points (a released spring turns the velocity into progress per second with it).
    var windowWidth: Double
}

/// A pan that begins only for a touch that went down within SWIPE.edgePx (24) of the leading window edge and moves
/// rightward more than vertically. UIScreenEdgePanGestureRecognizer's own edge region is narrower than 24, so a touch
/// at 10 would be neither the card (it refuses the 24 edge band) nor the back.
final class EdgePanRecognizer: UIPanGestureRecognizer {
    private(set) var down: CGPoint?
    private(set) var latest: CGPoint?

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent) {
        if down == nil, let touch = touches.first {
            down = touch.location(in: nil)
            latest = down
        }
        super.touchesBegan(touches, with: event)
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent) {
        if let touch = touches.first { latest = touch.location(in: nil) }
        super.touchesMoved(touches, with: event)
    }

    override func reset() {
        super.reset()
        down = nil
        latest = nil
    }
}

struct EdgeBackPan: UIGestureRecognizerRepresentable {
    var isEnabled: Bool
    var onEvent: (BackPanEvent) -> Void

    func makeCoordinator(converter: CoordinateSpaceConverter) -> Delegate {
        Delegate()
    }

    func makeUIGestureRecognizer(context: Context) -> EdgePanRecognizer {
        let recognizer = EdgePanRecognizer()
        recognizer.delegate = context.coordinator
        recognizer.maximumNumberOfTouches = 1
        return recognizer
    }

    func updateUIGestureRecognizer(_ recognizer: EdgePanRecognizer, context: Context) {
        recognizer.isEnabled = isEnabled
    }

    func handleUIGestureRecognizerAction(_ recognizer: EdgePanRecognizer, context: Context) {
        BackPanReport.report(recognizer, onEvent)
    }

    final class Delegate: NSObject, UIGestureRecognizerDelegate {
        func gestureRecognizerShouldBegin(_ recognizer: UIGestureRecognizer) -> Bool {
            guard let pan = recognizer as? EdgePanRecognizer, let down = pan.down, let latest = pan.latest else { return false }
            let dx = latest.x - down.x
            return down.x <= SWIPE.edgePx && dx > 0 && dx > abs(latest.y - down.y)
        }
    }
}

/// iOS 26 and later: a rightward pan anywhere on a step goes back, as the system's pushed screens do. It begins only
/// for a horizontal, rightward movement, so vertical scrolls and leftward pans stay with the lists.
struct AnywhereBackPan: UIGestureRecognizerRepresentable {
    var isEnabled: Bool
    var onEvent: (BackPanEvent) -> Void

    func makeCoordinator(converter: CoordinateSpaceConverter) -> Delegate {
        Delegate()
    }

    func makeUIGestureRecognizer(context: Context) -> UIPanGestureRecognizer {
        let recognizer = UIPanGestureRecognizer()
        recognizer.delegate = context.coordinator
        return recognizer
    }

    func updateUIGestureRecognizer(_ recognizer: UIPanGestureRecognizer, context: Context) {
        recognizer.isEnabled = isEnabled
    }

    func handleUIGestureRecognizerAction(_ recognizer: UIPanGestureRecognizer, context: Context) {
        BackPanReport.report(recognizer, onEvent)
    }

    final class Delegate: NSObject, UIGestureRecognizerDelegate {
        func gestureRecognizerShouldBegin(_ recognizer: UIGestureRecognizer) -> Bool {
            guard let pan = recognizer as? UIPanGestureRecognizer else { return false }
            let velocity = pan.velocity(in: pan.view)
            return velocity.x > 0 && abs(velocity.x) > abs(velocity.y)
        }
    }
}

enum BackPanReport {
    @MainActor static func report(_ recognizer: UIPanGestureRecognizer, _ onEvent: (BackPanEvent) -> Void) {
        let width = max(1, recognizer.view?.window?.bounds.width ?? recognizer.view?.bounds.width ?? 1)
        let progress = min(1, max(0, recognizer.translation(in: recognizer.view).x / width))
        let velocity = recognizer.velocity(in: recognizer.view).x
        switch recognizer.state {
        case .began, .changed: onEvent(BackPanEvent(phase: .changed, progress: progress, velocity: velocity, windowWidth: width))
        case .ended: onEvent(BackPanEvent(phase: .ended, progress: progress, velocity: velocity, windowWidth: width))
        case .cancelled, .failed: onEvent(BackPanEvent(phase: .cancelled, progress: progress, velocity: velocity, windowWidth: width))
        default: break
        }
    }
}

extension View {
    /// The back gestures of a start step or the round: the edge pan everywhere, the anywhere pan on iOS 26 and later.
    /// The whole frame takes the pans: the 16 gutter and the sky behind it draw nothing hit-testable, and a touch that
    /// hits nothing never reaches a gesture of this view. (contentShape covers the layout frame only: the leading
    /// safe-area inset in landscape is checked on 26.5 and on the device, task 16.)
    @ViewBuilder func backPans(isEnabled: Bool, anywhere: Bool, onEvent: @escaping (BackPanEvent) -> Void) -> some View {
        if anywhere, #available(iOS 26, *) {
            self.contentShape(Rectangle())
                .gesture(EdgeBackPan(isEnabled: isEnabled, onEvent: onEvent))
                .gesture(AnywhereBackPan(isEnabled: isEnabled, onEvent: onEvent))
        } else {
            self.contentShape(Rectangle()).gesture(EdgeBackPan(isEnabled: isEnabled, onEvent: onEvent))
        }
    }
}

/// Drives a part of the back motion as a function of progress, so SwiftUI can animate the progress itself (a played
/// back, a spring after release) and every frame is BackTransition's.
struct BackMotion: ViewModifier, @preconcurrency Animatable {
    var progress: Double
    let transition: BackTransition
    let role: Role
    let reducedMotion: Bool

    enum Role: Equatable { case oldPanel, oldTitle, newItem(Int), dashes, tripOut, brandIn, footIn, footOut }

    var animatableData: Double {
        get { progress }
        set { progress = newValue }
    }

    func body(content: Content) -> some View {
        let effect = effect
        content.opacity(effect.opacity).offset(y: effect.offsetY)
    }

    /// The opacity and the vertical offset of this role at this progress. One structure for every role, so a view
    /// keeps its identity whichever role, if any, moves it.
    var effect: (opacity: Double, offsetY: Double) {
        let frame = transition.frame(at: progress, reducedMotion: reducedMotion)
        switch role {
        case .oldPanel: return (frame.oldOpacity, frame.oldOffsetY)
        case .oldTitle: return (frame.oldTitleOpacity, 0)
        case .newItem(let i):
            let item = frame.newItems[min(i, frame.newItems.count - 1)]
            return (item.opacity, item.offsetY)
        case .dashes: return (frame.dashesOpacity, 0)
        case .tripOut: return (frame.tripOut.opacity, frame.tripOut.offsetY)
        case .brandIn: return (frame.brandIn.opacity, frame.brandIn.offsetY)
        case .footIn: return (frame.footIn.opacity, frame.footIn.offsetY)
        case .footOut: return (frame.footOut.opacity, frame.footOut.offsetY)
        }
    }
}
