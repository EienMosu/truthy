### Task 10: Shapes, icons, shadows, the sky, buttons with the web's press feedback, the frame and a debug gallery

The visual pieces every screen is built from (spec 6 and 5.6, reference 5.4 to 5.6), drawn in code from the web's own data: an SVG path reader so the 19 icons of `components/icons.tsx`, the logo and the clouds keep their path data verbatim; the notched paper of the ticket and of the destination cards; the perforations; the stamp's double border; the logo mark; the barcode of task 6's `barcodeBars`; the web's negative-spread shadows; the sky gradient with its two clouds; the 60 point pill, the round button and the quiet button with the web's press feedback per control; the frame of every screen (safe areas, the 430 column); keyboard-only focus rings; and a debug gallery screen of all of it.

Builds on tasks 7 and 8 (tokens, type roles, palette and shadows in the environment) and task 6 (`barcodeBars`), task 1 (`logoMarkHeight`).

**Files:**
- Create (app): `ios/Truthy/Truthy/Components/SVGPath.swift`, `Icons.swift`, `Shapes.swift`, `Shadows.swift`, `SkyBackdrop.swift`, `ButtonStyles.swift`, `PillButton.swift`, `FrameLayout.swift`, `KeyboardFocus.swift` (all in `ios/Truthy/Truthy/Components/`), `ios/Truthy/Truthy/Debug/GalleryView.swift`
- Test: create `ios/Truthy/TruthyTests/ComponentsTests.swift`

**Interfaces:**
- Produces (app target, used by tasks 12 to 15):

```swift
enum SVGPath { static func parse(_ data: String) -> Path }
enum Icon: String, CaseIterable { 19 cases; var data: String; var viewBox: CGRect; var filled: Bool; var defaultStroke: Double; var path: Path }
struct IconView: View { init(icon: Icon, size: Double, strokeWidth: Double? = nil) }   // draws the icon's extra circles too
struct IconShape: Shape { let icon: Icon; var parts: Parts = .all }               // Parts: .all, .path, .circles
struct NotchedPaper: Shape { enum Edge { case top, bottom }; init(edge: Edge, notch: Double = 12, radius: Double = 16) }
struct DestinationCardShape: Shape { init(stub: Double, notch: Double = 7, radius: Double = 16) }
struct Perforation: View { enum Axis { case horizontal, vertical }; init(axis: Axis) }
struct StampBorder: View { init(color: Color) }
struct LogoMark: View { enum Variant { case full, compact }; init(width: Double = 44, variant: Variant = .full); static let ticket, tear, check: String }
struct BarcodeView: View { init(data: String) }
extension View { func tokenShadow<S: Shape>(_ layers: [ShadowLayer], _ shape: S) -> some View }
struct SkyBackdrop: View { enum LowerCloud { case game, start }; init(lowerCloud: LowerCloud = .game) }
struct ScaleButtonStyle: ButtonStyle; extension ButtonStyle where Self == ScaleButtonStyle { static var round, backPill, card, quiet }
struct PressTintButtonStyle<S: Shape>: ButtonStyle { init(shape: S, scale: Double = 1) }
struct PillButtonStyle: ButtonStyle { init(fill: Color, dimmed: Bool) }
struct PillButton: View { enum Fill { case ink, answerTrue, answerFalse }; init(title: String, fill: Fill = .ink, leading: Icon? = nil, leadingSize: Double = 18, leadingStroke: Double? = nil, trailingArrow: Bool = false, dimmed: Bool = false, action: () -> Void) }
struct RoundIconButton: View { init(icon: Icon, label: String, action: () -> Void) }
struct QuietButton: View { init(title: String, leading: Icon? = nil, action: () -> Void) }
enum FrameLayout { static func padding(systemInsets: EdgeInsets, screenHeight: Double) -> EdgeInsets; static func columnWidth(_ width: Double) -> Double }
struct AppFrame<Content: View>: View
extension View { func keyboardFocusRing<S: Shape>(_ shape: S) -> some View }   // on a Button: no focus target of its own
struct GalleryView: View   // DEBUG only, launch argument -screen gallery (task 11)
```

**Rules:**

1. **Path data verbatim.** `Icon.data` is `ICON_PATHS` of `components/icons.tsx` character for character, and `Icon.circles` holds the circles the web's composite icons add to it (the clock face r8 at (11, 12), the sun's disc r3.3 at (9, 9), the route's two stops r2 at (3, 11) and (17, 3), all stroked); the route curve alone is dashed 2 and 3, its stops are not; `LogoMark` holds `Logo.tsx`'s three paths. `SVGPath.parse` reads every command those paths use (M, L, H, V, C, S, Q, T, A, Z, absolute and relative, implicit repeats, and compact numbers such as `4.9.6` and `1-6`) and turns elliptical arcs into cubic curves after the SVG specification's appendix B.2.4. Strokes keep the web's caps and joins (reference 5.6: round, except the book and the route curve).
2. **Shapes cut, not painted.** The ticket's and the cards' notches are subtracted from the paper (`Path.subtracting`, iOS 17), so one path serves for fill, clip and hit testing; nothing is drawn over the notch.
3. **Shadows** are the web's layers (reference 5.5): each is the shape grown by the (negative) spread, offset and blurred by half the CSS blur. The pill drops its shadow when dimmed and takes the press shadow while pressed.
4. **Press feedback per control** (spec 5.6): round buttons 0.92, the Back pill 0.96, pills 2 down plus 0.98 plus the press shadow, cards and the quiet button 0.98, over 120 ms on the ease curve; the press tint only on the pass fields and the continue line (`PressTintButtonStyle`). No tap highlight and no hover state anywhere. A dimmed pill is the web's aria-disabled one: it shows no press and its action does nothing. The pill's gap is `space-10`; its leading icon is 18 by default with the icon's own stroke, and callers pass the web's size and stroke (False's cross 16 at 3, True's check 18 at 3, the replay icon 18 at its 2.2). The quiet button is full width (`w-full`) and draws its leading icon at the icon's own view box width (the route icon at 20).
5. **The frame** (spec 5.6): top and bottom padding are the larger of the system inset and 52 and 34, or `Tokens.Native.shortSafeTop` and `shortSafeBottom` (8 and 12) under `Tokens.Native.shortScreenBelow` (568) tall; the sky's gradient stops are `Tokens.Native.skyStops` (task 8: these numbers live only in `resolved.json`'s native group); the sides are the 16 gutter plus the side inset; the column is at most 430 wide and centred. The orientation is not locked (task 7), so a phone held sideways gets the short-screen padding.
6. **Focus rings** only under hardware keyboard focus (spec 5.6): the system focus effect is off; a focused control draws the web's 2 point ink ring 2 outside its shape only while a hardware keyboard is connected (GameController's `GCKeyboard.coalesced`), so a tap never leaves a ring (N8, checked by task 15's screenshot). `keyboardFocusRing` goes on a Button and only reads its focus (`focused(_:)`); it adds no `focusable()`, which would give each control a second focus stop. `PillButton`, `RoundIconButton` and `QuietButton` carry it themselves (capsule, circle, capsule).
7. **Accessibility.** Every icon, shape, perforation, barcode and the sky are hidden from VoiceOver; controls carry the label of reference 4.5 their callers give.

**Review focus.** None of the README's lines; a reviewer compares the gallery screen in both themes with the web (task 15 then measures the frames).

**Steps:**

- [ ] **Step 1: Check the starting point.**

```bash
git status --short
xcodebuild test -project ios/Truthy/Truthy.xcodeproj -scheme Truthy -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5' -only-testing:TruthyTests 2>&1 | grep -E 'Test run with|TEST (SUCCEEDED|FAILED)' | tail -2
```

Expected: nothing; `Test run with 25 tests in 10 suites passed` and `** TEST SUCCEEDED **`.

- [ ] **Step 2: Write the tests.**

`ios/Truthy/TruthyTests/ComponentsTests.swift`:

```swift
import SwiftUI
import Testing
import TruthyEngine
@testable import Truthy

// The path data of the icons and the logo, and the frame of every screen (spec 5.6).
@MainActor
@Suite struct SVGPathTests {
    @Test(arguments: Icon.allCases)
    func eachIconStaysInItsViewBox(icon: Icon) {
        let bounds = icon.path.boundingRect
        #expect(!bounds.isEmpty || bounds.width > 0 || bounds.height > 0, "\(icon) draws nothing")
        // Strokes are centred on the path; allow the stroke's half width around the box.
        #expect(icon.viewBox.insetBy(dx: -2, dy: -2).contains(bounds), "\(icon): \(bounds) outside \(icon.viewBox)")
    }

    @Test func readsCompactNumbersAndArcs() {
        let star = SVGPath.parse("M9 1.8l2.1 4.5 4.9.6-3.6 3.4z")
        #expect(abs(star.boundingRect.maxX - 16) < 0.001)
        let ticket = SVGPath.parse(LogoMark.ticket)
        #expect(abs(ticket.boundingRect.width - 44) < 0.01 && abs(ticket.boundingRect.height - 30) < 0.01)
        // The notch at x 44 is cut inward to x 39.5: (43, 15) is outside the ticket, (38, 15) inside.
        #expect(!ticket.contains(CGPoint(x: 43, y: 15)))
        #expect(ticket.contains(CGPoint(x: 38, y: 15)))
    }
}

@Suite struct FrameLayoutTests {
    private let insets = EdgeInsets(top: 59, leading: 0, bottom: 34, trailing: 0)

    @Test func theWebsPaddingIsAMinimumOnTallScreens() {
        let tall = FrameLayout.padding(systemInsets: insets, screenHeight: 932)
        #expect(tall.top == 59 && tall.bottom == 34 && tall.leading == 16 && tall.trailing == 16)
        let noInsets = FrameLayout.padding(systemInsets: EdgeInsets(), screenHeight: 568)
        #expect(noInsets.top == 52 && noInsets.bottom == 34)
    }

    @Test func shortScreensUseEightAndTwelve() {
        let short = FrameLayout.padding(systemInsets: EdgeInsets(), screenHeight: 567)
        #expect(short.top == 8 && short.bottom == 12)
    }

    @Test func theColumnIsAtMost430AndTheSidesAddTheInsets() {
        #expect(FrameLayout.columnWidth(1024) == 430)
        #expect(FrameLayout.columnWidth(375) == 375)
        let landscape = FrameLayout.padding(systemInsets: EdgeInsets(top: 0, leading: 59, bottom: 21, trailing: 59), screenHeight: 430)
        #expect(landscape.leading == 75 && landscape.trailing == 75 && landscape.top == 8)
    }
}
```

- [ ] **Step 3: Run them and see them fail.**

```bash
DEST26='platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5'
xcodebuild build-for-testing -project ios/Truthy/Truthy.xcodeproj -scheme Truthy -destination "$DEST26" 2>&1 | grep -E 'error:' | head -3
```

Expected: errors such as `cannot find type 'Icon' in scope`, `cannot find 'SVGPath' in scope` and `cannot find 'FrameLayout' in scope`.

- [ ] **Step 4: Write the path reader and the icons.**

`ios/Truthy/Truthy/Components/SVGPath.swift`:

```swift
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
```

`ios/Truthy/Truthy/Components/Icons.swift`:

```swift
import SwiftUI

// The icons of components/icons.tsx (ICON_PATHS, 19 entries), with their view boxes and the stroke style the web
// draws each with (reference 5.6). Strokes are in view box units, so they scale with the drawn size.

enum Icon: String, CaseIterable, Sendable {
    case cross, check, backHeader, backPill, forward, chevronRight, chevronDown, planeArrow, carrierCloud, skyCloud
    case book, replay, routeCurve, clockHands, star, heart, heartSlash, moon, sunRays

    var data: String {
        switch self {
        case .cross: "M3 3l10 10M13 3L3 13"
        case .check: "M3 9.5l4 4 8-9"
        case .backHeader: "M16 8H3M8 2.5L2.5 8 8 13.5"
        case .backPill: "M15 9H4M8.5 4L3.5 9l5 5"
        case .forward: "M1 8h36M30 2l7 6-7 6"
        case .chevronRight: "M6 3l5 5-5 5"
        case .chevronDown: "M2 4l4 4 4-4"
        case .planeArrow: "M-7 0h14M1-6l4 6-4 6M-6-3l2 3-2 3"
        case .carrierCloud: "M5 15h13a4 4 0 0 0 .6-8A6 6 0 0 0 7.2 5.5 4.8 4.8 0 0 0 5 15z"
        case .skyCloud: "M0 46h150c0-12-10-20-22-20-2-14-14-24-29-24-12 0-22 6-26 16-4-3-9-5-15-5-12 0-21 8-23 19C24 28 20 26 15 26 6 26 0 34 0 46z"
        case .book: "M3 3h5l1 1 1-1h5v12h-5l-1 1-1-1H3zM9 4v11"
        case .replay: "M3.5 9a5.5 5.5 0 1 0 1.8-4.1M3.5 2.5v3h3"
        case .routeCurve: "M5 10.5C10 10 10 4 15 3.5"
        case .clockHands: "M11 7.5V12l3 2M8.5 2h5"
        case .star: "M9 1.8l2.1 4.5 4.9.6-3.6 3.4.9 4.9L9 12.8l-4.3 2.4.9-4.9L2 6.9l4.9-.6z"
        case .heart: "M0 6.2C-1.5 4.3-3 3.2-5.1 3.2c-3.7 0-5.9 3.9-4.5 7.3C-7.5 15.1 0 19.7 0 19.7s7.5-4.6 9.6-9.2c1.4-3.4-.8-7.3-4.5-7.3C3 3.2 1.5 4.3 0 6.2z"
        case .heartSlash: "M-8 18L8 3"
        case .moon: "M15.8 9.6A6.8 6.8 0 1 1 8.4 2.2a5.3 5.3 0 0 0 7.4 7.4z"
        case .sunRays: "M9 1.5v1.6M9 14.9v1.6M1.5 9h1.6M14.9 9h1.6M3.7 3.7l1.1 1.1M13.2 13.2l1.1 1.1M3.7 14.3l1.1-1.1M13.2 4.8l1.1-1.1"
        }
    }

    /// The web's view box (icons.tsx and the components that draw the raw paths).
    var viewBox: CGRect {
        switch self {
        case .cross, .chevronRight: CGRect(x: 0, y: 0, width: 16, height: 16)
        case .check, .backPill, .book, .replay, .star, .moon, .sunRays: CGRect(x: 0, y: 0, width: 18, height: 18)
        case .backHeader: CGRect(x: 0, y: 0, width: 18, height: 16)
        case .forward: CGRect(x: 0, y: 0, width: 40, height: 16)
        case .chevronDown: CGRect(x: 0, y: 0, width: 12, height: 12)
        case .planeArrow: CGRect(x: -12, y: -12, width: 24, height: 24)
        case .carrierCloud: CGRect(x: 0, y: 0, width: 22, height: 16)
        case .skyCloud: CGRect(x: 0, y: 0, width: 150, height: 46)
        case .routeCurve: CGRect(x: 0, y: 0, width: 20, height: 14)
        case .clockHands: CGRect(x: 0, y: 0, width: 22, height: 22)
        case .heart, .heartSlash: CGRect(x: -11, y: 0, width: 22, height: 22)
        }
    }

    /// Filled shapes; every other icon is stroked.
    var filled: Bool {
        [.carrierCloud, .skyCloud, .star, .heart].contains(self)
    }

    /// The stroke width the web draws the icon with by default (reference 5.6).
    var defaultStroke: Double {
        switch self {
        case .cross, .backHeader: 2.4
        case .check: 3
        case .backPill, .chevronRight, .replay: 2.2
        case .forward, .planeArrow, .moon, .sunRays: 2
        case .chevronDown, .routeCurve: 1.8
        case .book, .heartSlash: 1.6
        case .clockHands: 2.4
        default: 0
        }
    }

    /// Circles the web's composite icons draw with the path (icons.tsx): the clock face, the sun's disc, the route's two
    /// stops. Stroked like the path, never dashed.
    var circles: [(center: CGPoint, radius: Double)] {
        switch self {
        case .clockHands: [(CGPoint(x: 11, y: 12), 8)]
        case .sunRays: [(CGPoint(x: 9, y: 9), 3.3)]
        case .routeCurve: [(CGPoint(x: 3, y: 11), 2), (CGPoint(x: 17, y: 3), 2)]
        default: []
        }
    }

    /// The path's dash in view box units: the route curve is dashed 2 and 3 (RouteIcon), every other icon is solid.
    var dash: [CGFloat] { self == .routeCurve ? [2, 3] : [] }

    /// Round caps and joins, except the book (butt caps, round join) and the route curve (round cap, no join set).
    var strokeStyle: (cap: CGLineCap, join: CGLineJoin) {
        switch self {
        case .book: (.butt, .round)
        case .routeCurve: (.round, .miter)
        default: (.round, .round)
        }
    }

    var path: Path {
        SVGPath.parse(data)
    }
}

/// An icon drawn at `size` points wide; the height keeps the view box's proportion. Decorative unless labelled by
/// the control around it.
struct IconView: View {
    let icon: Icon
    var size: Double
    var strokeWidth: Double?

    var body: some View {
        let box = icon.viewBox
        let scale = size / box.width
        Group {
            if icon.filled {
                IconShape(icon: icon).fill()
            } else {
                let style = icon.strokeStyle
                let width = (strokeWidth ?? icon.defaultStroke) * scale
                ZStack {
                    // The circles plain, the path with its dash (only the route curve has one).
                    IconShape(icon: icon, parts: .circles).stroke(style: StrokeStyle(lineWidth: width, lineCap: style.cap, lineJoin: style.join))
                    IconShape(icon: icon, parts: .path)
                        .stroke(style: StrokeStyle(lineWidth: width, lineCap: style.cap, lineJoin: style.join, dash: icon.dash.map { $0 * scale }))
                }
            }
        }
        .frame(width: size, height: box.height * scale)
        .accessibilityHidden(true)
    }
}

/// The icon's path and circles scaled from its view box into the frame.
struct IconShape: Shape {
    enum Parts { case all, path, circles }
    let icon: Icon
    var parts: Parts = .all

    func path(in rect: CGRect) -> Path {
        let box = icon.viewBox
        let scale = rect.width / box.width
        var drawn = parts == .circles ? Path() : icon.path
        if parts != .path {
            for circle in icon.circles {
                drawn.addEllipse(in: CGRect(x: circle.center.x - circle.radius, y: circle.center.y - circle.radius,
                                            width: 2 * circle.radius, height: 2 * circle.radius))
            }
        }
        return drawn.applying(CGAffineTransform(translationX: -box.minX, y: -box.minY).concatenating(CGAffineTransform(scaleX: scale, y: scale)))
            .offsetBy(dx: rect.minX, dy: rect.minY)
    }
}
```

- [ ] **Step 5: Write the shapes, the shadows and the sky.**

`ios/Truthy/Truthy/Components/Shapes.swift`:

```swift
import SwiftUI
import TruthyEngine

// The shapes of the Boarding Pass (design system section 9): notched paper, destination cards, perforations, the
// stamp's double border and the logo mark, drawn from the web's numbers.

/// Paper with half circles of `notch` cut into both sides at the top or the bottom edge (BoardingPass.tsx
/// notchedPaper), radius 16 on the corners of the other edge. One path, for fill and clip alike.
struct NotchedPaper: Shape {
    enum Edge { case top, bottom }
    var edge: Edge
    var notch = Tokens.Size.notch
    var radius = Tokens.Radius.card

    func path(in rect: CGRect) -> Path {
        let radii = edge == .bottom
            ? RectangleCornerRadii(topLeading: radius, bottomLeading: 0, bottomTrailing: 0, topTrailing: radius)
            : RectangleCornerRadii(topLeading: 0, bottomLeading: radius, bottomTrailing: radius, topTrailing: 0)
        let paper = UnevenRoundedRectangle(cornerRadii: radii, style: .circular).path(in: rect)
        let y = edge == .top ? rect.minY : rect.maxY
        var notches = Path()
        notches.addEllipse(in: CGRect(x: rect.minX - notch, y: y - notch, width: 2 * notch, height: 2 * notch))
        notches.addEllipse(in: CGRect(x: rect.maxX - notch, y: y - notch, width: 2 * notch, height: 2 * notch))
        return paper.subtracting(notches)
    }
}

/// A destination card (DestinationCard.tsx): a rounded rectangle with notches of radius 7 at the stub line, top and
/// bottom, `stub` from the trailing edge.
struct DestinationCardShape: Shape {
    var stub: Double
    var notch = Tokens.Size.cardNotch
    var radius = Tokens.Radius.card

    func path(in rect: CGRect) -> Path {
        let x = rect.maxX - stub
        var notches = Path()
        notches.addEllipse(in: CGRect(x: x - notch, y: rect.minY - notch, width: 2 * notch, height: 2 * notch))
        notches.addEllipse(in: CGRect(x: x - notch, y: rect.maxY - notch, width: 2 * notch, height: 2 * notch))
        return Path(roundedRect: rect, cornerRadius: radius, style: .circular).subtracting(notches)
    }
}

/// A dashed perforation: horizontal 2 on, dashes 7 and 5 (butt ends); vertical 1.5, dashes 5 and 5.
struct Perforation: View {
    enum Axis { case horizontal, vertical }
    var axis: Axis
    @Environment(\.palette) private var palette

    var body: some View {
        let width = axis == .horizontal ? Tokens.Stroke.perforation : Tokens.Stroke.rule
        let dash: [CGFloat] = axis == .horizontal ? [7, 5] : [5, 5]
        Canvas { context, size in
            var line = Path()
            if axis == .horizontal {
                line.move(to: CGPoint(x: 0, y: size.height / 2))
                line.addLine(to: CGPoint(x: size.width, y: size.height / 2))
            } else {
                line.move(to: CGPoint(x: size.width / 2, y: 0))
                line.addLine(to: CGPoint(x: size.width / 2, y: size.height))
            }
            context.stroke(line, with: .color(palette.rule.color), style: StrokeStyle(lineWidth: width, lineCap: .butt, dash: dash))
        }
        .frame(width: axis == .vertical ? width : nil, height: axis == .horizontal ? width : nil)
        .accessibilityHidden(true)
    }
}

/// The stamp's double border: two 1 point rounded rectangles, the outer at radius 8, the inner inset 2 at radius 6.
struct StampBorder: View {
    var color: Color

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: Tokens.Radius.small).strokeBorder(color, lineWidth: 1)
            RoundedRectangle(cornerRadius: Tokens.Radius.small - 2).strokeBorder(color, lineWidth: 1).padding(2)
        }
        .accessibilityHidden(true)
    }
}

/// The logo mark (Logo.tsx): full (amber ticket, tear line and check in on-accent) or compact (on-accent ticket,
/// amber check, no tear line). Its height follows task 1's logoMarkHeight.
struct LogoMark: View {
    enum Variant { case full, compact }
    var width: Double = 44
    var variant: Variant = .full
    @Environment(\.palette) private var palette

    static let ticket = "M6 0H38A6 6 0 0 1 44 6V10.5A4.5 4.5 0 0 0 44 19.5V24A6 6 0 0 1 38 30H6A6 6 0 0 1 0 24V19.5A4.5 4.5 0 0 0 0 10.5V6A6 6 0 0 1 6 0Z"
    static let tear = "M33 5v20"
    static let check = "M9 15.5l4.5 4.5 9-10"

    var body: some View {
        let scale = width / 44
        let transform = CGAffineTransform(scaleX: scale, y: scale)
        let paper = variant == .full ? palette.accent.color : palette.onAccent.color
        let ink = variant == .full ? palette.onAccent.color : palette.accent.color
        Canvas { context, _ in
            context.fill(SVGPath.parse(Self.ticket).applying(transform), with: .color(paper))
            if variant == .full {
                context.stroke(SVGPath.parse(Self.tear).applying(transform), with: .color(ink),
                               style: StrokeStyle(lineWidth: 1.6 * scale, lineCap: .round, dash: [2.5 * scale, 3 * scale]))
            }
            context.stroke(SVGPath.parse(Self.check).applying(transform), with: .color(ink),
                           style: StrokeStyle(lineWidth: (variant == .full ? 3 : 3.4) * scale, lineCap: .round, lineJoin: .round))
        }
        .frame(width: width, height: logoMarkHeight(width))
        .accessibilityHidden(true)
    }
}

/// The barcode of a card's id (task 6's barcodeBars), stretched to the frame.
struct BarcodeView: View {
    let data: String
    @Environment(\.palette) private var palette

    var body: some View {
        let barcode = barcodeBars(data)
        Canvas { context, size in
            let scale = size.width / Double(max(1, barcode.width))
            for bar in barcode.bars {
                context.fill(Path(CGRect(x: Double(bar.x) * scale, y: 0, width: Double(bar.width) * scale, height: size.height)), with: .color(palette.ink.color))
            }
        }
        .frame(height: Tokens.Size.barcode)
        .accessibilityHidden(true)
    }
}
```

`ios/Truthy/Truthy/Components/Shadows.swift`:

```swift
import SwiftUI

// The web's box shadows with negative spread (reference 5.5), emulated: each layer is the shape inset by the spread,
// offset and blurred. CSS blur is twice the standard deviation; SwiftUI's blur radius is about one.

struct TokenShadow<S: Shape>: ViewModifier {
    let layers: [ShadowLayer]
    let shape: S

    func body(content: Content) -> some View {
        content.background {
            ZStack {
                ForEach(Array(layers.enumerated()), id: \.offset) { _, layer in
                    shape
                        .fill(layer.color.color)
                        .padding(-layer.spread)
                        .offset(x: layer.x, y: layer.y)
                        .blur(radius: layer.blur / 2)
                }
            }
            .allowsHitTesting(false)
            .accessibilityHidden(true)
        }
    }
}

extension View {
    func tokenShadow<S: Shape>(_ layers: [ShadowLayer], _ shape: S) -> some View {
        modifier(TokenShadow(layers: layers, shape: shape))
    }
}
```

`ios/Truthy/Truthy/Components/SkyBackdrop.swift`:

```swift
import SwiftUI

// The calm ground of every screen (SkyBackdrop.tsx, reference 5.1): the four sky colours in one smooth vertical
// gradient at the native stops of the tokens (0, 35, 62 and 100 percent), and two clouds inside the 430 frame. Ignores touches and VoiceOver.

struct SkyBackdrop: View {
    enum LowerCloud { case game, start }
    var lowerCloud: LowerCloud = .game
    @Environment(\.palette) private var palette

    var body: some View {
        ZStack(alignment: .topLeading) {
            LinearGradient(stops: [
                .init(color: palette.sky1.color, location: Tokens.Native.skyStops[0]),
                .init(color: palette.sky2.color, location: Tokens.Native.skyStops[1]),
                .init(color: palette.sky3.color, location: Tokens.Native.skyStops[2]),
                .init(color: palette.sky4.color, location: Tokens.Native.skyStops[3]),
            ], startPoint: .top, endPoint: .bottom)
            GeometryReader { proxy in
                let frame = min(proxy.size.width, Tokens.Size.maxWidth)
                let left = (proxy.size.width - frame) / 2
                IconShape(icon: .skyCloud)
                    .fill(palette.cloud.color.opacity(Tokens.Opacity.cloud))
                    .frame(width: 150, height: 46)
                    .offset(x: left - 30, y: 196)
                IconShape(icon: .skyCloud)
                    .fill(palette.cloud.color.opacity(Tokens.Opacity.cloud))
                    .frame(width: 170, height: 50)
                    .offset(x: left + frame + 40 - 170, y: lowerCloud == .start ? 660 : 620)
            }
        }
        .ignoresSafeArea()
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}
```

- [ ] **Step 6: Write the buttons, the frame, the focus ring and the gallery.**

`ios/Truthy/Truthy/Components/ButtonStyles.swift`:

```swift
import SwiftUI

// Press feedback per control, as the web gives it (spec 5.6, reference 5.7): round buttons 0.92, the Back pill 0.96,
// pills 2 down plus 0.98 plus the press shadow, cards and the quiet button 0.98, all over 120 ms on the ease curve;
// the press tint only on the pass fields and the continue line. No tap highlight, no hover.

private let pressAnimation = Tokens.Curve.ease.animation(Tokens.Duration.t1)

struct ScaleButtonStyle: ButtonStyle {
    var scale: Double

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? scale : 1)
            .animation(pressAnimation, value: configuration.isPressed)
    }
}

extension ButtonStyle where Self == ScaleButtonStyle {
    static var round: ScaleButtonStyle { ScaleButtonStyle(scale: 0.92) }
    static var backPill: ScaleButtonStyle { ScaleButtonStyle(scale: 0.96) }
    static var card: ScaleButtonStyle { ScaleButtonStyle(scale: 0.98) }
    static var quiet: ScaleButtonStyle { ScaleButtonStyle(scale: 0.98) }
}

/// The pass fields and the continue line: the press colour fills the shape while pressed (the continue line also
/// scales to 0.98).
struct PressTintButtonStyle<S: Shape>: ButtonStyle {
    let shape: S
    var scale: Double = 1
    @Environment(\.palette) private var palette

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background(shape.fill(configuration.isPressed ? palette.press.color : Color.clear))
            .scaleEffect(configuration.isPressed ? scale : 1)
            .animation(pressAnimation, value: configuration.isPressed)
    }
}

/// The 60 point pill (PillButton.tsx): 2 points down, 0.98 and the press shadow while pressed; no shadow when dimmed.
struct PillButtonStyle: ButtonStyle {
    var fill: Color
    var dimmed: Bool
    @Environment(\.shadows) private var shadows

    func makeBody(configuration: Configuration) -> some View {
        let shape = Capsule()
        // A dimmed pill is aria-disabled on the web: it shows no press.
        let pressed = configuration.isPressed && !dimmed
        configuration.label
            .frame(maxWidth: .infinity, minHeight: Tokens.Size.pill)
            .background(shape.fill(fill))
            .tokenShadow(dimmed ? [] : (pressed ? shadows.press : shadows.button), shape)
            .offset(y: pressed ? 2 : 0)
            .scaleEffect(pressed ? 0.98 : 1)
            .opacity(dimmed ? Tokens.Opacity.disabled : 1)
            .animation(pressAnimation, value: pressed)
    }
}
```

`ios/Truthy/Truthy/Components/PillButton.swift`:

```swift
import SwiftUI

// The 60 point pill (PillButton.tsx): a filled capsule with an optional leading icon and a trailing arrow, used for
// True, False, Next card, See results, Start round, Play again and Keep playing. The title is the visible text and
// the accessible name (reference 4.5).

struct PillButton: View {
    enum Fill { case ink, answerTrue, answerFalse }
    let title: String
    var fill: Fill = .ink
    var leading: Icon?
    /// The web's size and stroke for the leading icon: the False cross 16 at 3, the True check 18 at 3, the replay 18
    /// at its own 2.2 (nil keeps the icon's default stroke).
    var leadingSize: Double = 18
    var leadingStroke: Double?
    var trailingArrow = false
    var dimmed = false
    let action: () -> Void
    @Environment(\.palette) private var palette

    var body: some View {
        // A dimmed pill takes no presses (the web's aria-disabled pill).
        Button(action: { if !dimmed { action() } }) {
            HStack(spacing: Tokens.Space.s10) {
                if let leading { IconView(icon: leading, size: leadingSize, strokeWidth: leadingStroke) }
                Text(title).typeRole(Tokens.TypeRole.button)
                if trailingArrow { Text("→").typeRole(Tokens.TypeRole.button).accessibilityHidden(true) }
            }
            .foregroundStyle(palette.onDark.color)
            .padding(.horizontal, Tokens.Space.s20)
        }
        .buttonStyle(PillButtonStyle(fill: fillColor, dimmed: dimmed))
        .keyboardFocusRing(Capsule())
        .accessibilityLabel(title)
    }

    private var fillColor: Color {
        switch fill {
        case .ink: palette.ink.color
        case .answerTrue: palette.answerTrue.color
        case .answerFalse: palette.answerFalse.color
        }
    }
}

/// The 48 point round button with an icon (the X of the round, RoundButton.tsx).
struct RoundIconButton: View {
    let icon: Icon
    let label: String
    let action: () -> Void
    @Environment(\.palette) private var palette
    @Environment(\.shadows) private var shadows

    var body: some View {
        Button(action: action) {
            IconView(icon: icon, size: 16)
                .foregroundStyle(palette.ink.color)
                .frame(width: Tokens.Size.roundButton, height: Tokens.Size.roundButton)
                .background(Circle().fill(palette.surfaceRaised.color))
                .tokenShadow(shadows.small, Circle())
        }
        .buttonStyle(.round)
        .keyboardFocusRing(Circle())
        .accessibilityLabel(label)
    }
}

/// The quiet button: text only, full width, 48 tall (QuietButton.tsx `w-full`). Its leading icon is drawn at the
/// icon's own view box width (the route icon at 20).
struct QuietButton: View {
    let title: String
    var leading: Icon?
    let action: () -> Void
    @Environment(\.palette) private var palette

    var body: some View {
        Button(action: action) {
            HStack(spacing: Tokens.Space.s8) {
                if let leading { IconView(icon: leading, size: leading.viewBox.width) }
                Text(title).typeRole(Tokens.TypeRole.buttonQuiet)
            }
            .foregroundStyle(palette.ink.color)
            .frame(maxWidth: .infinity, minHeight: Tokens.Size.pillSmall)
            .contentShape(Rectangle())
        }
        .buttonStyle(.quiet)
        .keyboardFocusRing(Capsule())
        .accessibilityLabel(title)
    }
}
```

`ios/Truthy/Truthy/Components/FrameLayout.swift`:

```swift
import SwiftUI

// The app frame (spec 5.6, reference 5.4): top and bottom padding are the larger of the system inset and 52 and 34
// on screens 568 or taller, 8 and 12 on shorter ones (the native group of the tokens); the sides are the 16 gutter
// plus the side inset; the content column is at most 430 wide and centred.

enum FrameLayout {
    static let shortScreen: Double = Tokens.Native.shortScreenBelow

    static func padding(systemInsets: EdgeInsets, screenHeight: Double) -> EdgeInsets {
        let short = screenHeight < shortScreen
        return EdgeInsets(
            top: max(systemInsets.top, short ? Tokens.Native.shortSafeTop : Tokens.Size.safeTop),
            leading: Tokens.Size.gutter + systemInsets.leading,
            bottom: max(systemInsets.bottom, short ? Tokens.Native.shortSafeBottom : Tokens.Size.safeBottom),
            trailing: Tokens.Size.gutter + systemInsets.trailing)
    }

    /// The width of the content column in a window `width` wide.
    static func columnWidth(_ width: Double) -> Double {
        min(width, Tokens.Size.maxWidth)
    }
}

/// Lays its content out in the centred column with the frame's padding, ignoring the system's own safe area.
struct AppFrame<Content: View>: View {
    @ViewBuilder let content: () -> Content

    var body: some View {
        GeometryReader { proxy in
            // The reader ignores the safe area, so its size is already the whole window: the insets are not added again.
            let insets = proxy.safeAreaInsets
            let padding = FrameLayout.padding(systemInsets: insets, screenHeight: proxy.size.height)
            content()
                .frame(maxWidth: FrameLayout.columnWidth(proxy.size.width) - 2 * Tokens.Size.gutter)
                .padding(padding)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .ignoresSafeArea()
    }
}
```

`ios/Truthy/Truthy/Components/KeyboardFocus.swift`:

```swift
import GameController
import SwiftUI

// Focus rings only for hardware keyboard focus, never after a touch (spec 5.6, 5.7 smell 10). The system focus
// effect is off everywhere; a control focused while a hardware keyboard is connected draws the web's ink ring, 2
// points wide, 2 outside the shape. The modifier goes on a Button, which is focusable already: it only reads the
// button's focus, so each control stays one focus stop.

enum HardwareKeyboard {
    @MainActor static var isConnected: Bool { GCKeyboard.coalesced != nil }
}

struct KeyboardFocusRing<S: Shape>: ViewModifier {
    let shape: S
    @FocusState private var focused: Bool
    @Environment(\.palette) private var palette

    func body(content: Content) -> some View {
        content
            .focused($focused)
            .focusEffectDisabled()
            .overlay {
                if focused && HardwareKeyboard.isConnected {
                    shape.stroke(palette.ink.color, lineWidth: 2).padding(-2).allowsHitTesting(false)
                }
            }
    }
}

extension View {
    func keyboardFocusRing<S: Shape>(_ shape: S) -> some View {
        modifier(KeyboardFocusRing(shape: shape))
    }
}
```

`ios/Truthy/Truthy/Debug/GalleryView.swift`:

```swift
#if DEBUG
import SwiftUI
import TruthyEngine

// A screen of every component in both themes, for the visual review and for reviewers (launch argument
// -screen gallery, task 11).
struct GalleryView: View {
    @Environment(\.palette) private var palette

    var body: some View {
        ZStack {
            SkyBackdrop()
            ScrollView {
                VStack(alignment: .leading, spacing: Tokens.Space.s16) {
                    LogoMark()
                    LogoMark(width: 20, variant: .compact)
                    LazyVGrid(columns: Array(repeating: GridItem(.fixed(40)), count: 6)) {
                        ForEach(Icon.allCases, id: \.self) { icon in
                            IconView(icon: icon, size: 24).foregroundStyle(palette.ink.color)
                        }
                    }
                    NotchedPaper(edge: .bottom).fill(palette.surfaceRaised.color).frame(height: 120)
                    DestinationCardShape(stub: Tokens.Size.cardStub).fill(palette.surfaceRaised.color).frame(height: Tokens.Size.cardMin)
                    Perforation(axis: .horizontal)
                    BarcodeView(data: "aws-clf-c02-t1.1-01")
                    StampBorder(color: palette.correct.color).frame(width: 120, height: 44)
                    PillButton(title: "True", fill: .answerTrue, leading: .check) {}
                    PillButton(title: "Next card", trailingArrow: true) {}
                    RoundIconButton(icon: .cross, label: "Leave round") {}
                }
                .padding(Tokens.Size.gutter)
            }
        }
    }
}
#endif
```

- [ ] **Step 7: Run the tests and look at the gallery.**

```bash
DEST26='platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5'
xcodebuild test -project ios/Truthy/Truthy.xcodeproj -scheme Truthy -destination "$DEST26" -only-testing:TruthyTests 2>&1 | grep -E 'Test run with|✘|TEST (SUCCEEDED|FAILED)' | tail -4
```

Expected: `Test run with 30 tests in 12 suites passed` (plus `SVGPathTests` 2, the icon test parameterised over 19 icons, and `FrameLayoutTests` 3) and `** TEST SUCCEEDED **`. The gallery opens once task 11 reads `-screen gallery`; look at it then in both themes (task 11, step 9).

- [ ] **Step 8: Run the gates and commit.**

```bash
DEST26='platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5'
xcodebuild test -project ios/Truthy/Truthy.xcodeproj -scheme Truthy -destination "$DEST26" 2>&1 | grep -E 'TEST (SUCCEEDED|FAILED)'
git add ios/Truthy/Truthy/Components ios/Truthy/Truthy/Debug ios/Truthy/TruthyTests/ComponentsTests.swift
pnpm test
git commit -m "feat: draw the Boarding Pass shapes, icons, shadows, sky and buttons from the web's path data and tokens"
git status --short
```

Expected: `** TEST SUCCEEDED **` (task 7's `AppSourceRulesTests` now scans the new files: no literal colour or font size outside `Tokens.swift` and `Debug/`); `pnpm test` passes; nothing from `git status --short`.
