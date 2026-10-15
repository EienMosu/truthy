import SwiftUI

// SVG path data as a SwiftUI Path (spec 6: icons and shapes are drawn from the web's own path data, no bitmaps).
// Supports every command the web's paths use: M L H V C S Q T A Z, absolute and relative, implicit repeats and the
// compact number forms ("4.9.6" is 4.9 then .6, "1-6" is 1 then -6).

enum SVGPath {
    static func parse(_ data: String) -> Path {
        var scanner = Scanner(Array(data.utf8))
        var path = Path()
        var current = CGPoint.zero
        var start = CGPoint.zero
        var lastControl: CGPoint?
        var lastCommand: UInt8 = 0
        while let command = scanner.command(repeating: lastCommand) {
            let relative = command >= UInt8(ascii: "a")
            let upper = relative ? command - 32 : command
            func point(_ x: Double, _ y: Double) -> CGPoint {
                relative ? CGPoint(x: current.x + x, y: current.y + y) : CGPoint(x: x, y: y)
            }
            var control: CGPoint?
            switch upper {
            case UInt8(ascii: "M"):
                guard let x = scanner.number(), let y = scanner.number() else { return path }
                current = point(x, y)
                start = current
                path.move(to: current)
                lastCommand = relative ? UInt8(ascii: "l") : UInt8(ascii: "L")
                lastControl = nil
                continue
            case UInt8(ascii: "L"):
                guard let x = scanner.number(), let y = scanner.number() else { return path }
                current = point(x, y)
                path.addLine(to: current)
            case UInt8(ascii: "H"):
                guard let x = scanner.number() else { return path }
                current = CGPoint(x: relative ? current.x + x : x, y: current.y)
                path.addLine(to: current)
            case UInt8(ascii: "V"):
                guard let y = scanner.number() else { return path }
                current = CGPoint(x: current.x, y: relative ? current.y + y : y)
                path.addLine(to: current)
            case UInt8(ascii: "C"):
                guard let x1 = scanner.number(), let y1 = scanner.number(), let x2 = scanner.number(), let y2 = scanner.number(),
                      let x = scanner.number(), let y = scanner.number() else { return path }
                let c1 = point(x1, y1)
                let c2 = point(x2, y2)
                current = point(x, y)
                path.addCurve(to: current, control1: c1, control2: c2)
                control = c2
            case UInt8(ascii: "S"):
                guard let x2 = scanner.number(), let y2 = scanner.number(), let x = scanner.number(), let y = scanner.number() else { return path }
                let c1 = reflect(lastControl, current, if: lastCommand, in: "CcSs")
                let c2 = point(x2, y2)
                current = point(x, y)
                path.addCurve(to: current, control1: c1, control2: c2)
                control = c2
            case UInt8(ascii: "Q"):
                guard let x1 = scanner.number(), let y1 = scanner.number(), let x = scanner.number(), let y = scanner.number() else { return path }
                let c = point(x1, y1)
                current = point(x, y)
                path.addQuadCurve(to: current, control: c)
                control = c
            case UInt8(ascii: "T"):
                guard let x = scanner.number(), let y = scanner.number() else { return path }
                let c = reflect(lastControl, current, if: lastCommand, in: "QqTt")
                current = point(x, y)
                path.addQuadCurve(to: current, control: c)
                control = c
            case UInt8(ascii: "A"):
                guard let rx = scanner.number(), let ry = scanner.number(), let rotation = scanner.number(),
                      let large = scanner.flag(), let sweep = scanner.flag(), let x = scanner.number(), let y = scanner.number() else { return path }
                let end = point(x, y)
                addArc(&path, from: current, to: end, rx: rx, ry: ry, rotation: rotation, large: large, sweep: sweep)
                current = end
            case UInt8(ascii: "Z"):
                path.closeSubpath()
                current = start
            default:
                return path
            }
            lastControl = control
            lastCommand = command
        }
        return path
    }

    private static func reflect(_ control: CGPoint?, _ current: CGPoint, if last: UInt8, in commands: String) -> CGPoint {
        guard let control, commands.utf8.contains(last) else { return current }
        return CGPoint(x: 2 * current.x - control.x, y: 2 * current.y - control.y)
    }

    /// An SVG elliptical arc (endpoint form) as cubic curves, after the SVG specification's appendix B.2.4.
    private static func addArc(_ path: inout Path, from p0: CGPoint, to p1: CGPoint, rx rx0: Double, ry ry0: Double, rotation: Double,
                               large: Bool, sweep: Bool) {
        if p0 == p1 { return }
        var rx = abs(rx0)
        var ry = abs(ry0)
        if rx == 0 || ry == 0 {
            path.addLine(to: p1)
            return
        }
        let phi = rotation * .pi / 180
        let (cosPhi, sinPhi) = (cos(phi), sin(phi))
        let dx = (p0.x - p1.x) / 2
        let dy = (p0.y - p1.y) / 2
        let x1 = cosPhi * dx + sinPhi * dy
        let y1 = -sinPhi * dx + cosPhi * dy
        let lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry)
        if lambda > 1 {
            rx *= lambda.squareRoot()
            ry *= lambda.squareRoot()
        }
        let numerator = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1
        let denominator = rx * rx * y1 * y1 + ry * ry * x1 * x1
        var factor = (max(0, numerator) / denominator).squareRoot()
        if large == sweep { factor = -factor }
        let cx1 = factor * rx * y1 / ry
        let cy1 = -factor * ry * x1 / rx
        let cx = cosPhi * cx1 - sinPhi * cy1 + (p0.x + p1.x) / 2
        let cy = sinPhi * cx1 + cosPhi * cy1 + (p0.y + p1.y) / 2
        func angle(_ ux: Double, _ uy: Double, _ vx: Double, _ vy: Double) -> Double {
            let a = atan2(ux * vy - uy * vx, ux * vx + uy * vy)
            return a
        }
        let theta1 = angle(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry)
        var delta = angle((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry)
        if !sweep && delta > 0 { delta -= 2 * .pi }
        if sweep && delta < 0 { delta += 2 * .pi }
        let segments = max(1, Int((abs(delta) / (.pi / 2)).rounded(.up)))
        let step = delta / Double(segments)
        let k = 4.0 / 3 * tan(step / 4)
        func onEllipse(_ t: Double) -> CGPoint {
            CGPoint(x: cx + rx * cos(t) * cosPhi - ry * sin(t) * sinPhi, y: cy + rx * cos(t) * sinPhi + ry * sin(t) * cosPhi)
        }
        func derivative(_ t: Double) -> CGPoint {
            CGPoint(x: -rx * sin(t) * cosPhi - ry * cos(t) * sinPhi, y: -rx * sin(t) * sinPhi + ry * cos(t) * cosPhi)
        }
        var t = theta1
        for i in 0..<segments {
            let next = t + step
            let a = onEllipse(t)
            let b = i == segments - 1 ? p1 : onEllipse(next)
            let da = derivative(t)
            let db = derivative(next)
            path.addCurve(to: b, control1: CGPoint(x: a.x + k * da.x, y: a.y + k * da.y), control2: CGPoint(x: b.x - k * db.x, y: b.y - k * db.y))
            t = next
        }
    }

    private struct Scanner {
        let bytes: [UInt8]
        var at = 0

        init(_ bytes: [UInt8]) {
            self.bytes = bytes
        }

        private mutating func skipSeparators() {
            while at < bytes.count, bytes[at] == UInt8(ascii: " ") || bytes[at] == UInt8(ascii: ",") || bytes[at] == 0x0A || bytes[at] == 0x09 || bytes[at] == 0x0D {
                at += 1
            }
        }

        /// The next command letter, or `repeating` when a number follows a command without a new letter.
        mutating func command(repeating: UInt8) -> UInt8? {
            skipSeparators()
            guard at < bytes.count else { return nil }
            let byte = bytes[at]
            if (byte >= UInt8(ascii: "A") && byte <= UInt8(ascii: "Z")) || (byte >= UInt8(ascii: "a") && byte <= UInt8(ascii: "z")) {
                at += 1
                return byte
            }
            return repeating == 0 ? nil : repeating
        }

        mutating func flag() -> Bool? {
            skipSeparators()
            guard at < bytes.count, bytes[at] == UInt8(ascii: "0") || bytes[at] == UInt8(ascii: "1") else { return nil }
            at += 1
            return bytes[at - 1] == UInt8(ascii: "1")
        }

        mutating func number() -> Double? {
            skipSeparators()
            let begin = at
            if at < bytes.count, bytes[at] == UInt8(ascii: "-") || bytes[at] == UInt8(ascii: "+") { at += 1 }
            var seenDot = false
            var seenDigit = false
            while at < bytes.count {
                let byte = bytes[at]
                if byte >= UInt8(ascii: "0") && byte <= UInt8(ascii: "9") {
                    seenDigit = true
                } else if byte == UInt8(ascii: "."), !seenDot {
                    seenDot = true
                } else if (byte == UInt8(ascii: "e") || byte == UInt8(ascii: "E")), seenDigit {
                    at += 1
                    if at < bytes.count, bytes[at] == UInt8(ascii: "-") || bytes[at] == UInt8(ascii: "+") { at += 1 }
                    continue
                } else {
                    break
                }
                at += 1
            }
            guard seenDigit else {
                at = begin
                return nil
            }
            return Double(String(decoding: bytes[begin..<at], as: UTF8.self))
        }
    }
}
