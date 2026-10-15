import SwiftUI

// The parts of the boarding pass shell that the round's ticket, the ready pass of the start flow and the result share
// (BoardingPass.tsx): the carrier band, the legs and the ruled field grid, laid out with the web's numbers so their
// frames match the web's within the visual review's 2 points.

/// The carrier band: the cloud, "Truthy" and "BOARDING PASS", 44 tall, 16 in from the sides, 10 between the cloud and
/// the name. Decoration: hidden from VoiceOver.
struct TicketBand: View {
    @Environment(\.palette) private var palette

    var body: some View {
        HStack(spacing: Tokens.Space.s10) {
            IconShape(icon: .carrierCloud).fill(palette.onAccent.color).frame(width: 22, height: 16)
            Text("Truthy").typeRole(Tokens.TypeRole.carrierTitle)
            Spacer(minLength: 0)
            Text("BOARDING PASS").typeRole(Tokens.TypeRole.carrierLabel)
        }
        .foregroundStyle(palette.onAccent.color)
        .padding(.horizontal, Tokens.Space.s16)
        .frame(maxWidth: .infinity, minHeight: Tokens.Size.carrier)
        .background(palette.accent.color)
        .accessibilityHidden(true)
    }
}

/// The legs row: two equal columns around an empty 40 point column, 8 apart, the ticket inset at the sides, 14 above
/// and 12 below. Each leg is its code over its name, 6 apart; the second keeps to the right. The codes align at the
/// top, so a name on two lines does not push its code down.
struct TicketLegs<From: View, To: View>: View {
    @ViewBuilder let from: () -> From
    @ViewBuilder let to: () -> To

    var body: some View {
        LegColumns {
            from().frame(maxWidth: .infinity, alignment: .leading)
            to().frame(maxWidth: .infinity, alignment: .trailing)
        }
        .padding(.horizontal, Tokens.Size.ticketInset)
        .padding(.top, Tokens.Space.s14)
        .padding(.bottom, Tokens.Space.s12)
    }
}

/// One leg's text: the code in the leg-code role over the name in the muted leg-name role.
struct LegText: View {
    let code: String
    let name: String
    var trailing = false
    @Environment(\.palette) private var palette

    var body: some View {
        VStack(alignment: trailing ? .trailing : .leading, spacing: Tokens.Space.s6) {
            Text(code).typeRole(Tokens.TypeRole.legCode).lineLimit(1)
            Text(name).typeRole(Tokens.TypeRole.legName).foregroundStyle(palette.inkMuted.color)
                .multilineTextAlignment(trailing ? .trailing : .leading)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

/// Two equal columns with an empty 40 point column between them and 8 between each (grid 1fr 40px 1fr, gap 8).
struct LegColumns: Layout {
    static let middle = 40.0
    static let gap = Tokens.Space.s8

    private func column(_ width: Double) -> Double { max(0, (width - Self.middle - 2 * Self.gap) / 2) }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? 343
        let height = subviews.map { $0.sizeThatFits(ProposedViewSize(width: column(width), height: nil)).height }.max() ?? 0
        return CGSize(width: width, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let width = column(bounds.width)
        for (i, subview) in subviews.enumerated() {
            let x = i == 0 ? bounds.minX : bounds.maxX - width
            subview.place(at: CGPoint(x: x, y: bounds.minY), anchor: .topLeading, proposal: ProposedViewSize(width: width, height: nil))
        }
    }
}

/// One cell of the field grid: its label and its value (or anything drawn as the value).
@MainActor
struct TicketField {
    let label: String
    let value: AnyView
    /// What VoiceOver reads for the cell; nil reads the label and the value's own text.
    var spoken: String?
    /// A way back (the ready pass's class): the whole cell is a button read as `spoken`.
    var action: (() -> Void)?

    init(_ label: String, _ value: String, spoken: String? = nil, action: (() -> Void)? = nil) {
        self.label = label
        self.value = AnyView(Text(value).typeRole(Tokens.TypeRole.fieldValue).lineLimit(1).fixedSize())
        self.spoken = spoken ?? "\(label), \(value)"
        self.action = action
    }

    init(_ label: String, spoken: String? = nil, action: (() -> Void)? = nil, @ViewBuilder value: () -> some View) {
        self.label = label
        self.value = AnyView(value())
        self.spoken = spoken
        self.action = action
    }
}

/// The ruled field grid (the dl of BoardingPass.tsx): a 1.5 rule above and below, three cells in columns of 1.1, 1 and
/// 1 of the width but never narrower than their content, the second and third each with a 1.5 rule at their left and
/// 12 after it, 8 above the label, the value 2 under it, 7 below.
struct FieldGrid: View {
    let fields: [TicketField]
    @Environment(\.palette) private var palette

    var body: some View {
        FieldColumns(fractions: [1.1, 1, 1]) {
            ForEach(Array(fields.enumerated()), id: \.offset) { i, field in
                cell(field, first: i == 0)
            }
        }
        .overlay(alignment: .top) { Rectangle().fill(palette.rule.color).frame(height: Tokens.Stroke.rule) }
        .overlay(alignment: .bottom) { Rectangle().fill(palette.rule.color).frame(height: Tokens.Stroke.rule) }
        .padding(.horizontal, Tokens.Size.ticketInset)
    }

    @ViewBuilder private func cell(_ field: TicketField, first: Bool) -> some View {
        let content = VStack(alignment: .leading, spacing: Tokens.Space.s2) {
            Text(field.label).typeRole(Tokens.TypeRole.fieldLabel).foregroundStyle(palette.inkMuted.color).lineLimit(1).fixedSize()
            field.value
        }
        .padding(.top, Tokens.Space.s8 + Tokens.Stroke.rule)
        .padding(.bottom, 7 + Tokens.Stroke.rule)
        .padding(.leading, first ? 0 : Tokens.Space.s12 + Tokens.Stroke.rule)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay(alignment: .leading) {
            if !first {
                Rectangle().fill(palette.rule.color).frame(width: Tokens.Stroke.rule).padding(.vertical, Tokens.Stroke.rule)
            }
        }
        if let action = field.action {
            Button(action: action) { content.contentShape(Rectangle()) }
                .buttonStyle(PressTintButtonStyle(shape: RoundedRectangle(cornerRadius: 6)))
                .keyboardFocusRing(RoundedRectangle(cornerRadius: 6))
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(field.spoken ?? field.label)
                .accessibilityAddTraits(.isButton)
        } else if let spoken = field.spoken {
            content.accessibilityElement(children: .ignore).accessibilityLabel(spoken)
        } else {
            content.accessibilityElement(children: .combine)
        }
    }
}

/// Columns in fractions of the width, each at least as wide as its content (CSS grid minmax(max-content, Nfr)): a
/// column whose content needs more than its share takes it, and the rest is shared among the others by fraction.
struct FieldColumns: Layout {
    let fractions: [Double]
    /// False: plain fractions (a value too long for its column is cut with an ellipsis instead).
    var contentMinimum = true

    func widths(_ total: Double, _ minimums: [Double]) -> [Double] {
        var fixed = Array(repeating: false, count: minimums.count)
        var widths = Array(repeating: 0.0, count: minimums.count)
        while true {
            let free = total - zip(widths, fixed).filter(\.1).map(\.0).reduce(0, +)
            let share = zip(fractions, fixed).filter { !$0.1 }.map(\.0).reduce(0, +)
            var changed = false
            for i in minimums.indices where !fixed[i] {
                let width = share > 0 ? free * fractions[i] / share : 0
                if minimums[i] > width {
                    fixed[i] = true
                    widths[i] = minimums[i]
                    changed = true
                }
            }
            if !changed {
                for i in minimums.indices where !fixed[i] { widths[i] = share > 0 ? free * fractions[i] / share : 0 }
                return widths
            }
        }
    }

    private func minimums(_ subviews: Subviews) -> [Double] {
        contentMinimum ? subviews.map { $0.sizeThatFits(.unspecified).width } : subviews.map { _ in 0 }
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let minimums = minimums(subviews)
        let width = proposal.width ?? minimums.reduce(0, +)
        let columns = widths(width, minimums)
        let height = zip(subviews, columns).map { $0.sizeThatFits(ProposedViewSize(width: $1, height: nil)).height }.max() ?? 0
        return CGSize(width: width, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let columns = widths(bounds.width, minimums(subviews))
        var x = bounds.minX
        for (subview, width) in zip(subviews, columns) {
            subview.place(at: CGPoint(x: x, y: bounds.minY), anchor: .topLeading, proposal: ProposedViewSize(width: width, height: bounds.height))
            x += width
        }
    }
}

/// A column of parts at least `minHeight` tall (the lower part of a ticket): with room to spare, `.between` spreads it
/// evenly between the parts (the stub, justify-between) and `.beforeLast` gives it all to the gap before the last part
/// (the slip's source link, margin-top auto).
struct SpreadColumn: Layout {
    enum Spread { case between, beforeLast }
    let minHeight: Double
    var spread: Spread = .between
    /// The fixed gaps between the parts, in order (missing gaps are 0).
    var gaps: [Double] = []

    private func gap(_ i: Int) -> Double { i < gaps.count ? gaps[i] : 0 }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? subviews.map { $0.sizeThatFits(.unspecified).width }.max() ?? 0
        let heights = subviews.map { $0.sizeThatFits(ProposedViewSize(width: width, height: nil)).height }
        let used = heights.reduce(0, +) + (0..<max(0, subviews.count - 1)).map(gap).reduce(0, +)
        return CGSize(width: width, height: max(minHeight, used))
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let heights = subviews.map { $0.sizeThatFits(ProposedViewSize(width: bounds.width, height: nil)).height }
        let gapCount = max(0, subviews.count - 1)
        let used = heights.reduce(0, +) + (0..<gapCount).map(gap).reduce(0, +)
        let spare = max(0, bounds.height - used)
        var y = bounds.minY
        for (i, subview) in subviews.enumerated() {
            subview.place(at: CGPoint(x: bounds.minX, y: y), anchor: .topLeading, proposal: ProposedViewSize(width: bounds.width, height: heights[i]))
            guard i < gapCount else { break }
            y += heights[i] + gap(i)
            switch spread {
            case .between: y += spare / Double(gapCount)
            case .beforeLast: if i == gapCount - 1 { y += spare }
            }
        }
    }
}
