import SwiftUI

// Motion from the tokens: the web's cubic-bezier curves as SwiftUI animations and as functions of progress (for the
// back motion, which a finger drives, task 11), and the native springs of reference 5.7.

extension CubicCurve {
    var unitCurve: UnitCurve {
        .bezier(startControlPoint: UnitPoint(x: x1, y: y1), endControlPoint: UnitPoint(x: x2, y: y2))
    }

    /// An animation over `duration` seconds, after `delay`.
    func animation(_ duration: Double, delay: Double = 0) -> Animation {
        Animation.timingCurve(x1, y1, x2, y2, duration: duration).delay(delay)
    }

    /// The eased progress at linear progress `t`: exactly 0 at or before the start and 1 at or after the end.
    func value(at t: Double) -> Double {
        if t <= 0 { return 0 }
        if t >= 1 { return 1 }
        return unitCurve.value(at: t)
    }
}

extension SpringSpec {
    var animation: Animation {
        .spring(response: response, dampingFraction: dampingFraction)
    }

    /// The same spring started at `velocity` units per second (spec 5.3: the finger's speed, divided by the distance
    /// still to go, gives the unit velocity of a spring that animates from 1 to 0).
    func animation(initialVelocity velocity: Double) -> Animation {
        let stiffness = pow(2 * Double.pi / response, 2)
        let damping = 4 * Double.pi * dampingFraction / response
        return .interpolatingSpring(mass: 1, stiffness: stiffness, damping: damping, initialVelocity: velocity)
    }
}
