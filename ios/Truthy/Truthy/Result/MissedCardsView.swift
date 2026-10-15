import SwiftUI
import TruthyEngine

// The missed cards (MissedCards.tsx, reference 4.5): "Missed cards" and "{n} to review", one row per wrong answer with
// its number, what was said, the statement and the right answer, and a Why disclosure (chevron 220 ms, row 360 ms,
// scrolled into view after 380 ms, 50 with reduced motion) with the explanation and the source link.

struct MissedCardsView: View {
    let missed: [MissedCard]
    /// Called with a card's number when its Why opens (the result scrolls it into view).
    var onOpen: (Int) -> Void = { _ in }
    @State private var open: Set<Int> = []
    @Environment(\.palette) private var palette
    @Environment(\.resolvedTheme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reducedMotion

    var body: some View {
        VStack(alignment: .leading, spacing: Tokens.Space.s12) {
            if missed.isEmpty {
                Text("No missed cards").typeRole(Tokens.TypeRole.listStatement)
                    .accessibilityLabel("Missed cards, No missed cards")
            } else {
                HStack {
                    Text("Missed cards").typeRole(Tokens.TypeRole.emphasis).accessibilityAddTraits(.isHeader)
                    Spacer()
                    Text("\(missed.count) to review").typeRole(Tokens.TypeRole.monoData).foregroundStyle(palette.inkMuted.color)
                }
                ForEach(missed, id: \.number) { card in row(card) }
            }
        }
    }

    private func row(_ card: MissedCard) -> some View {
        let isOpen = open.contains(card.number)
        return VStack(alignment: .leading, spacing: Tokens.Space.s6) {
            HStack {
                Text("Card \(pad2(card.number))")
                Spacer()
                Text("You said \(card.given ? "True" : "False")")
            }
            .typeRole(Tokens.TypeRole.monoCaption)
            .foregroundStyle(palette.inkMuted.color)
            if let appliesTo = card.appliesTo {
                Text(appliesTo).typeRole(Tokens.TypeRole.monoData).foregroundStyle(palette.inkMuted.color).accessibilityLabel("Applies to \(appliesTo)")
            }
            CardTextView(text: card.statement, style: Tokens.TypeRole.listStatement)
            HStack {
                (Text("Answer ") + Text(card.answer ? "True" : "False").font(Tokens.TypeRole.missedAnswer.font)).typeRole(Tokens.TypeRole.listStatement)
                Spacer()
                Button {
                    let animation = Tokens.Curve.ease.animation(Tokens.Duration.t3)
                    withAnimation(reducedMotion ? nil : animation) {
                        if isOpen { open.remove(card.number) } else { open.insert(card.number) }
                    }
                    if !isOpen { onOpen(card.number) }
                } label: {
                    HStack(spacing: Tokens.Space.s4) {
                        Text("Why").typeRole(Tokens.TypeRole.sourceLink)
                        IconView(icon: .chevronDown, size: 12)
                            .rotationEffect(.degrees(isOpen ? 180 : 0))
                            .animation(reducedMotion ? nil : Tokens.Curve.ease.animation(Tokens.Duration.t2), value: isOpen)
                    }
                    .foregroundStyle(palette.answerTrue.color)
                    .frame(minHeight: Tokens.Size.touchMin)
                }
                .buttonStyle(.quiet)
                .accessibilityLabel("Why, card \(pad2(card.number))")
                .accessibilityValue(isOpen ? "expanded" : "collapsed")
            }
            if isOpen {
                HStack(alignment: .top, spacing: Tokens.Space.s10) {
                    Rectangle().fill(palette.rule.color).frame(width: Tokens.Stroke.quote)
                    VStack(alignment: .leading, spacing: Tokens.Space.s8) {
                        CardTextView(text: card.explanation, style: Tokens.TypeRole.missedExplanation)
                        if let url = URL(string: card.source.url) {
                            SourceLink(title: card.source.title) { SafariPresenter.present(url, theme: theme, palette: palette) }
                        }
                    }
                }
                // The row grows open from its top inside the clipped card (reference 5.7).
                .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .padding(Tokens.Space.s12)
        .background(RoundedRectangle(cornerRadius: Tokens.Radius.small).fill(palette.surfaceSunk.color))
        .clipped()
        .id("missed-\(card.number)")
    }
}
