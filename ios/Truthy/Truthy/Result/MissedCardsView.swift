import SwiftUI
import TruthyEngine

// The missed cards (MissedCards.tsx, reference 4.5), the sunk lower part of the result's ticket: "Missed cards" and
// "{n} to review", then a list that scrolls inside the lower part, one row per wrong answer divided by rules, with its
// number, what was said, the statement and the right answer, and a Why disclosure (chevron 220 ms, row 360 ms, scrolled
// into view after 380 ms, 50 with reduced motion) with the explanation beside a quote rule and the source link. A 28
// point fade at the foot shows that more lies below.

struct MissedCardsView: View {
    let missed: [MissedCard]
    /// The height of the lower part (at least 228): the list scrolls inside what the header leaves.
    let height: Double
    @State private var open: Set<Int> = []
    @Environment(\.palette) private var palette
    @Environment(\.resolvedTheme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reducedMotion

    var body: some View {
        Group {
            if missed.isEmpty {
                Text("No missed cards").typeRole(Tokens.TypeRole.listStatement)
                    .foregroundStyle(palette.ink.color)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, Tokens.Size.ticketInset)
                    .padding(.top, Tokens.Space.s16)
                    .padding(.bottom, Tokens.Space.s20)
                    .frame(height: height, alignment: .top)
                    .accessibilityLabel("Missed cards, No missed cards")
            } else {
                VStack(spacing: 0) {
                    // One line, or two at the largest text sizes, so neither is cut (N9).
                    ViewThatFits(in: .horizontal) {
                        HStack(alignment: .firstTextBaseline) { missedHeading; Spacer(minLength: Tokens.Space.s8); toReview }
                        VStack(alignment: .leading, spacing: Tokens.Space.s2) { missedHeading; toReview }
                    }
                    .padding(.horizontal, Tokens.Size.ticketInset)
                    .padding(.top, Tokens.Space.s16)
                    .padding(.bottom, Tokens.Space.s4)
                    list
                }
                .frame(height: height, alignment: .top)
                .overlay(alignment: .bottom) {
                    LinearGradient(colors: [palette.surfaceSunkClear.color, palette.surfaceSunk.color], startPoint: .top, endPoint: .bottom)
                        .frame(height: 28)
                        .allowsHitTesting(false)
                        .accessibilityHidden(true)
                }
            }
        }
        .background(NotchedPaper(edge: .top).fill(palette.surfaceSunk.color))
        .clipShape(NotchedPaper(edge: .top))
    }

    private var missedHeading: some View {
        Text("Missed cards").typeRole(Tokens.TypeRole.monoData).foregroundStyle(palette.inkMuted.color).fixedSize()
            .accessibilityAddTraits(.isHeader)
    }

    private var toReview: some View {
        Text("\(missed.count) to review").typeRole(Tokens.TypeRole.monoDataStrong).foregroundStyle(palette.ink.color).fixedSize()
    }

    private var list: some View {
        ScrollViewReader { scroller in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) {
                    ForEach(Array(missed.enumerated()), id: \.element.number) { i, card in
                        row(card, first: i == 0, scroller: scroller)
                    }
                }
                .padding(.horizontal, Tokens.Size.ticketInset)
                .padding(.bottom, Tokens.Space.s20)
            }
            .scrollIndicators(.hidden)
        }
    }

    private func row(_ card: MissedCard, first: Bool, scroller: ScrollViewProxy) -> some View {
        let isOpen = open.contains(card.number)
        return VStack(alignment: .leading, spacing: 0) {
            ViewThatFits(in: .horizontal) {
                HStack {
                    Text("Card \(pad2(card.number))").fixedSize()
                    Spacer(minLength: Tokens.Space.s8)
                    Text("You said \(card.given ? "True" : "False")").fixedSize()
                }
                VStack(alignment: .leading, spacing: 0) {
                    Text("Card \(pad2(card.number))")
                    Text("You said \(card.given ? "True" : "False")")
                }
            }
            .typeRole(Tokens.TypeRole.monoCaption)
            .foregroundStyle(palette.inkMuted.color)
            if let appliesTo = card.appliesTo {
                Text(appliesTo).typeRole(Tokens.TypeRole.monoData).foregroundStyle(palette.inkMuted.color)
                    .padding(.top, Tokens.Space.s6)
                    .accessibilityLabel("Applies to \(appliesTo)")
            }
            CardTextView(text: card.statement, style: Tokens.TypeRole.listStatement)
                .foregroundStyle(palette.ink.color)
                .padding(.top, Tokens.Space.s6)
            HStack(spacing: Tokens.Space.s12) {
                HStack(alignment: .firstTextBaseline, spacing: Tokens.Space.s8) {
                    Text("Answer").typeRole(Tokens.TypeRole.monoData).foregroundStyle(palette.inkMuted.color)
                    Text(card.answer ? "True" : "False").typeRole(Tokens.TypeRole.missedAnswer).foregroundStyle(palette.ink.color)
                }
                .accessibilityElement(children: .combine)
                Spacer(minLength: 0)
                Button {
                    let animation = Tokens.Curve.ease.animation(Tokens.Duration.t3)
                    withAnimation(reducedMotion ? nil : animation) {
                        if isOpen { open.remove(card.number) } else { open.insert(card.number) }
                    }
                    if !isOpen { reveal(card.number, scroller) }
                } label: {
                    HStack(spacing: Tokens.Space.s6) {
                        Text("Why").underline().typeRole(Tokens.TypeRole.monoDataStrong)
                        IconView(icon: .chevronDown, size: 12)
                            .rotationEffect(.degrees(isOpen ? 180 : 0))
                            .animation(reducedMotion ? nil : Tokens.Curve.ease.animation(Tokens.Duration.t2), value: isOpen)
                    }
                    .foregroundStyle(palette.answerTrue.color)
                    .padding(.horizontal, Tokens.Space.s8)
                    .frame(minHeight: Tokens.Size.touchMin)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.quiet)
                .padding(.trailing, -Tokens.Space.s8)
                .accessibilityLabel("Why, card \(pad2(card.number))")
                .accessibilityValue(isOpen ? "expanded" : "collapsed")
            }
            .frame(minHeight: Tokens.Size.touchMin)
            if isOpen {
                VStack(alignment: .leading, spacing: 0) {
                    CardTextView(text: card.explanation, style: Tokens.TypeRole.missedExplanation)
                        .foregroundStyle(palette.ink.color)
                    if let url = URL(string: card.source.url) {
                        SourceLink(title: card.source.title) { SafariPresenter.present(url, theme: theme, palette: palette) }
                    }
                }
                .padding(.leading, Tokens.Space.s12 + Tokens.Stroke.quote)
                .overlay(alignment: .leading) { Rectangle().fill(palette.rule.color).frame(width: Tokens.Stroke.quote) }
                .padding(.bottom, Tokens.Space.s12)
                // The row grows open from its top (reference 5.7).
                .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .padding(.top, Tokens.Space.s12)
        .padding(.bottom, Tokens.Space.s4)
        .overlay(alignment: .top) {
            if !first { Rectangle().fill(palette.rule.color).frame(height: Tokens.Stroke.rule) }
        }
        .id("missed-\(card.number)")
    }

    /// The opened row scrolls into the list after it has grown (380 ms, 50 with reduced motion).
    private func reveal(_ number: Int, _ scroller: ScrollViewProxy) {
        Task {
            try? await Task.sleep(for: .milliseconds(reducedMotion ? 50 : 380))
            withAnimation(reducedMotion ? nil : Tokens.Curve.ease.animation(Tokens.Duration.t3)) { scroller.scrollTo("missed-\(number)") }
        }
    }
}
