import SwiftUI
import TruthyEngine

// The continue line of start step 1 (ContinueLine.tsx): the deck's pass name, then "CLF → SEC · Classic · last 7 of
// 10", one tap back into the last route. Its accessible name is task 5's continueLabel.

struct ContinueLine: View {
    let target: ContinueTarget
    let action: () -> Void
    @Environment(\.palette) private var palette

    var deckName: String { deckPassName(target.found.platform, target.found.deck) }
    var sectionCode: String { target.found.section?.id ?? WHOLE_DECK }
    var sectionTitle: String { target.found.section?.title ?? "Whole deck" }
    var className: String { modeInfo(target.mode).name }
    var score: String? { target.lastScore.map { lastScoreText(target.mode, $0.score, $0.total) } }

    /// The last score: the mono data role at the semibold weight.
    static let scoreStrong = TypeStyle(family: .mono, weight: 600, size: Tokens.TypeRole.monoData.size,
                                       lineHeight: Tokens.TypeRole.monoData.lineHeight, letterSpacing: Tokens.TypeRole.monoData.letterSpacing)

    var label: String {
        continueLabel(ContinueLabelProps(deckName: deckName, sectionTitle: sectionTitle, modeLabel: className, lastScore: score))
    }

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: Tokens.Radius.card)
        Button(action: action) {
            // ContinueLine.tsx ROW: 4 before the logo's disc, 14 between the parts, 12 after the chevron.
            HStack(spacing: Tokens.Space.s14) {
                LogoMark(width: 26)
                    .frame(width: Tokens.Size.continueIcon, height: Tokens.Size.continueIcon)
                    .background(Circle().fill(palette.surfaceRaised.color))
                VStack(alignment: .leading, spacing: 3) {
                    // The web ends a long name in an ellipsis (ContinueLine.tsx); here it wraps (README deviation 5): at the
                    // largest text size "Google Cloud Digital Leader" no longer fits one line, and text never clips.
                    Text(deckName).typeRole(Tokens.TypeRole.continueDeckName).fixedSize(horizontal: false, vertical: true)
                    // The mono data role, the last score's number semibold in ink.
                    SizedText { size in
                        Text("\(target.found.deck.code) → \(sectionCode) · \(className)")
                            + (score.map { Text(" · last ") + Text($0).font(Self.scoreStrong.font(at: size)).foregroundStyle(palette.ink.color) } ?? Text(""))
                    }
                        .typeRole(Tokens.TypeRole.monoData)
                        .foregroundStyle(palette.inkMuted.color)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
                IconView(icon: .chevronRight, size: 16).foregroundStyle(palette.ink.color)
            }
            .foregroundStyle(palette.ink.color)
            .padding(.leading, Tokens.Space.s4)
            .padding(.trailing, Tokens.Space.s12)
            .frame(minHeight: Tokens.Size.pill)
            .contentShape(shape)
        }
        // The line sits under step 1's list: above the second accessibility size its wrapped name would push the list
        // off the screen (six lines at the largest), so it stops growing there, still wrapped and never cut.
        .dynamicTypeSize(...DynamicTypeSize.accessibility2)
        .buttonStyle(PressTintButtonStyle(shape: shape, scale: 0.98))
        .keyboardFocusRing(shape)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
        .accessibilityAddTraits(.isButton)
    }
}
