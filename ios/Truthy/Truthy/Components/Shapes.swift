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
