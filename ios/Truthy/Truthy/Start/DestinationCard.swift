import SwiftUI
import TruthyEngine

// A destination card of the start flow (DestinationCard.tsx): name, detail, an optional status, and a stub with a
// label over a value, behind a notched paper with a dashed perforation. One button whose accessible name is the
// sentence of reference 4.5; an unavailable card is a labelled, disabled group instead.

struct DestinationCard: View {
    enum NameStyle { case title, code }
    let name: String
    var nameStyle: NameStyle = .title
    var detail: String?
    var detailMuted = false
    var status: String?
    var stubLabel: String?
    var stubValue: String?
    var stubUnit: String?
    var stubValueMuted = false
    var stubWidth: Double = Tokens.Size.cardStub
    var minHeight: Double = Tokens.Size.cardMin
    var chevron = true
    var enabled = true
    let label: String
    let action: () -> Void
    @Environment(\.palette) private var palette
    @Environment(\.shadows) private var shadows

    var body: some View {
        let shape = DestinationCardShape(stub: stubWidth)
        let content = HStack(spacing: 0) {
            VStack(alignment: .leading, spacing: Tokens.Space.s4) {
                // The name wraps where the web cuts it (README deviation 5): text never clips at the largest size.
                Text(name).typeRole(nameStyle == .code ? Tokens.TypeRole.deckCode : Tokens.TypeRole.cardName)
                    .fixedSize(horizontal: false, vertical: true)
                if let detail {
                    Text(detail).typeRole(Tokens.TypeRole.listTitle).foregroundStyle(detailMuted ? palette.inkMuted.color : palette.ink.color)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if let status {
                    Text(status).typeRole(Tokens.TypeRole.monoData).foregroundStyle(palette.inkMuted.color)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, Tokens.Space.s16)
            .padding(.leading, Tokens.Space.s18)
            if chevron {
                IconView(icon: .chevronRight, size: 16).foregroundStyle(palette.inkMuted.color).padding(.trailing, Tokens.Space.s12)
            }
            Perforation(axis: .vertical).padding(.vertical, Tokens.Size.cardNotch + 4)
            VStack(spacing: Tokens.Space.s2) {
                if let stubLabel { Text(stubLabel).typeRole(Tokens.TypeRole.fieldLabel).foregroundStyle(palette.inkMuted.color) }
                if let stubValue {
                    Text(stubValue).typeRole(Tokens.TypeRole.cardStubValue).foregroundStyle(stubValueMuted ? palette.inkMuted.color : palette.ink.color)
                }
                if let stubUnit { Text(stubUnit).typeRole(Tokens.TypeRole.monoCaption).foregroundStyle(palette.inkMuted.color) }
            }
            // The stub is a fixed column of paper (README deviation 6).
            .paperTextSize()
            .frame(width: stubWidth)
        }
        .foregroundStyle(palette.ink.color)
        .frame(maxWidth: .infinity, minHeight: minHeight)
        .background(shape.fill(enabled ? palette.surfaceRaised.color : palette.surfaceSunk.color))
        .tokenShadow(enabled ? shadows.small : [], shape)
        .contentShape(shape)

        if enabled {
            Button(action: action) { content }
                .buttonStyle(.card)
                .keyboardFocusRing(RoundedRectangle(cornerRadius: Tokens.Radius.card))
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(label)
                .accessibilityAddTraits(.isButton)
        } else {
            content
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(label)
        }
    }
}
