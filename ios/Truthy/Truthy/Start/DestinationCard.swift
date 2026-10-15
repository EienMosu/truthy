import SwiftUI
import TruthyEngine

// A destination card of the start flow (DestinationCard.tsx): the name, a mono line (a place's deck count) or a detail
// line, a deck's progress track and status, and a stub with a label over a value (and a unit) above the chevron, behind
// a notched paper with a dashed perforation on the stub line. One button whose accessible name is the sentence of
// reference 4.5; an unavailable card is a labelled, disabled group in sunk paper without a stub.

struct DestinationCard: View {
    enum NameStyle { case title, code }
    /// The four kinds of card, with the web's stub width, minimum height and main column spacing.
    enum Variant {
        case place, deck, section, mode

        var stubWidth: Double { self == .place ? Tokens.Size.cardStub : Tokens.Size.cardStubDeck }
        var minHeight: Double {
            switch self {
            case .place: Tokens.Size.cardMin
            case .deck: Tokens.Size.cardMinDeck
            case .section: Tokens.Size.cardMinSection
            case .mode: Tokens.Size.cardMinClass
            }
        }
        var gap: Double { self == .deck || self == .section ? Tokens.Space.s2 : Tokens.Space.s4 }
        var verticalPadding: Double {
            switch self {
            case .place, .deck: Tokens.Space.s18
            case .section: Tokens.Space.s14
            case .mode: Tokens.Space.s16
            }
        }
    }

    let variant: Variant
    let name: String
    var nameStyle: NameStyle = .title
    /// The mono line under the name: a place's "17 decks", or why an unavailable card cannot be chosen.
    var sub: String?
    var detail: String?
    var detailMuted = false
    /// A deck's share seen, in whole percent; 0 reads "Not started".
    var seenPercent: Int?
    var stubLabel: String?
    var stubValue: String?
    var stubUnit: String?
    var stubValueMuted = false
    var enabled = true
    let label: String
    let action: () -> Void
    @Environment(\.palette) private var palette
    @Environment(\.shadows) private var shadows

    var body: some View {
        if enabled {
            Button(action: action) { ticket }
                .buttonStyle(.card)
                .keyboardFocusRing(RoundedRectangle(cornerRadius: Tokens.Radius.card))
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(label)
                .accessibilityAddTraits(.isButton)
        } else {
            unavailable
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(label)
        }
    }

    private var nameText: some View {
        // The name wraps where the web cuts it (README deviation 5): text never clips at the largest size.
        Text(name).typeRole(nameStyle == .code ? Tokens.TypeRole.deckCode : Tokens.TypeRole.cardName)
            .fixedSize(horizontal: false, vertical: true)
            .wholeWords(name, nameStyle == .code ? Tokens.TypeRole.deckCode : Tokens.TypeRole.cardName)
    }

    private func subText(_ text: String) -> some View {
        Text(text).typeRole(Tokens.TypeRole.monoData).foregroundStyle(palette.inkMuted.color).fixedSize(horizontal: false, vertical: true)
    }

    private func detailText(_ text: String, muted: Bool) -> some View {
        Text(text).typeRole(Tokens.TypeRole.listTitle).foregroundStyle(muted ? palette.inkMuted.color : palette.ink.color)
            .fixedSize(horizontal: false, vertical: true)
            .wholeWords(text, Tokens.TypeRole.listTitle)
    }

    private var ticket: some View {
        let shape = DestinationCardShape(stub: variant.stubWidth)
        return HStack(spacing: 0) {
            VStack(alignment: .leading, spacing: variant.gap) {
                nameText
                if let sub { subText(sub) }
                if let detail { detailText(detail, muted: detailMuted) }
                if let seenPercent {
                    HStack(spacing: Tokens.Space.s10) {
                        ProgressTrack(percent: seenPercent)
                        if seenPercent > 0 {
                            (Text("\(seenPercent)%").font(Self.statusStrong.font).foregroundStyle(palette.ink.color) + Text(" seen"))
                                .typeRole(Tokens.TypeRole.monoData).foregroundStyle(palette.inkMuted.color)
                        } else {
                            Text("Not started").typeRole(Tokens.TypeRole.monoData).foregroundStyle(palette.inkMuted.color)
                        }
                    }
                    .padding(.top, Tokens.Space.s10 - variant.gap)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, variant.verticalPadding)
            .padding(.leading, Tokens.Space.s20)
            .padding(.trailing, Tokens.Space.s12)
            stub
                // The stub is a fixed column of paper (README deviation 6).
                .paperTextSize()
                .frame(width: variant.stubWidth)
                .frame(maxHeight: .infinity)
                .overlay(alignment: .leading) {
                    Perforation(axis: .vertical).padding(.vertical, Tokens.Space.s12).offset(x: -Tokens.Stroke.rule / 2)
                }
        }
        .foregroundStyle(palette.ink.color)
        .frame(maxWidth: .infinity, minHeight: variant.minHeight)
        .background(shape.fill(palette.surfaceRaised.color))
        .tokenShadow(shadows.small, shape)
        .contentShape(shape)
    }

    /// The stub: the label, the value and the unit 2 apart, then the chevron 8 under them (alone on a place card, none
    /// on a class card), centred.
    private var stub: some View {
        VStack(spacing: Tokens.Space.s2) {
            if let stubLabel { Text(stubLabel).typeRole(Tokens.TypeRole.fieldLabel).foregroundStyle(palette.inkMuted.color) }
            if let stubValue {
                Text(stubValue).typeRole(Tokens.TypeRole.cardStubValue).foregroundStyle(stubValueMuted ? palette.inkMuted.color : palette.ink.color)
            }
            if let stubUnit { Text(stubUnit).typeRole(Tokens.TypeRole.fieldLabel).foregroundStyle(palette.inkMuted.color) }
            if variant != .mode {
                IconView(icon: .chevronRight, size: 16).foregroundStyle(palette.ink.color)
                    .padding(.top, stubValue == nil ? 0 : Tokens.Space.s8 - Tokens.Space.s2)
            }
        }
    }

    /// An option without content: sunk paper, no stub, the name, its detail and why, muted.
    private var unavailable: some View {
        VStack(alignment: .leading, spacing: Tokens.Space.s4) {
            nameText
            if let detail { detailText(detail, muted: true) }
            if let sub { subText(sub) }
        }
        .foregroundStyle(palette.inkMuted.color)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, Tokens.Space.s18)
        .padding(.leading, Tokens.Space.s20)
        .padding(.trailing, Tokens.Space.s12)
        .frame(minHeight: Tokens.Size.cardMinOff)
        .background(RoundedRectangle(cornerRadius: Tokens.Radius.card).fill(palette.surfaceSunk.color))
    }

    /// The share seen in the status line: the mono data role at the semibold weight.
    static let statusStrong = TypeStyle(family: .mono, weight: 600, size: Tokens.TypeRole.monoData.size,
                                        lineHeight: Tokens.TypeRole.monoData.lineHeight, letterSpacing: Tokens.TypeRole.monoData.letterSpacing)
}

/// The 56 by 8 progress track of a deck card (DestinationCard.tsx ProgressTrack): dashes 4 on 4 for the part not
/// seen, a solid ink line with an amber dot for the part seen. Decoration.
struct ProgressTrack: View {
    let percent: Int
    @Environment(\.palette) private var palette

    var body: some View {
        let width = Tokens.Size.progressTrack
        let seen = width * Double(min(100, max(0, percent))) / 100
        Canvas { context, size in
            var dashes = Path()
            dashes.move(to: CGPoint(x: 0, y: 4))
            dashes.addLine(to: CGPoint(x: size.width, y: 4))
            context.stroke(dashes, with: .color(palette.rule.color), style: StrokeStyle(lineWidth: Tokens.Stroke.perforation, dash: [4, 4]))
            guard seen > 0 else { return }
            context.fill(Path(roundedRect: CGRect(x: 0, y: 3, width: seen, height: Tokens.Stroke.perforation), cornerRadius: 1), with: .color(palette.ink.color))
            let dot = CGRect(x: seen - 4, y: 0, width: 8, height: 8)
            context.fill(Path(ellipseIn: dot.insetBy(dx: -1.5, dy: -1.5)), with: .color(palette.ink.color))
            context.fill(Path(ellipseIn: dot), with: .color(palette.accent.color))
        }
        .frame(width: width, height: Tokens.Space.s8)
        .accessibilityHidden(true)
    }
}
