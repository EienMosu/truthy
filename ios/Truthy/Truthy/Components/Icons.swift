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
