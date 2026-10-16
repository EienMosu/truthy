import SwiftUI
import TruthyEngine

// The result (reference 4.1 R1 and 4.5): Close results, the completed route with its sentence, the ticket with the
// class's fields, the score and the comparison, the missed cards with Why, and Play again and Choose another route.
// The round was recorded once when it finished (RoundCoordinator.showResult); every action waits 1000 ms.

struct ResultView: View {
    let model: AppModel
    let coordinator: RoundCoordinator
    @Environment(\.palette) private var palette
    @Environment(\.shadows) private var shadows
    @Environment(\.accessibilityReduceMotion) private var reducedMotion
    @AccessibilityFocusState private var headingFocused: Bool
    /// The screen's root holds keyboard focus, so Escape works after touches.
    @FocusState private var keysFocused: Bool
    /// The stage the ticket fills (ResultView.tsx: the ticket is at least the stage's height) and the height of its main
    /// part; the missed cards take the rest, at least 228, and scroll inside it.
    @State private var stageHeight = 0.0
    @State private var mainHeight = 0.0
    /// The height of Play again, under which the ticket runs on.
    @State private var pillHeight = Tokens.Size.pill

    private var result: RoundResult { summarise(coordinator.state) }
    private var copy: ResultCopy {
        resultCopy(result, coordinator.ticket.modeLabel, coordinator.state.cards.count, coordinator.outcome?.previousBest)
    }

    var body: some View {
        AppFrame {
            VStack(spacing: Tokens.Space.s12) {
                HStack(alignment: .center, spacing: Tokens.Space.s12) {
                    RoundIconButton(icon: .cross, label: "Close results") { close() }
                    // FlightPath.tsx, the completed variant in its PathFrame: the drawing, then the label row 2 under it.
                    VStack(spacing: Tokens.Space.s2) {
                        CompletedRoute(results: result.answers.map(\.correct), total: copy.marks, ring: copy.ring)
                            .frame(height: Tokens.Size.flightPathHeight)
                            .accessibilityElement(children: .ignore)
                            .accessibilityLabel(copy.label)
                        HStack {
                            Text(copy.ended).bold() + Text(copy.endedDetail)
                            Spacer()
                            Text("\(result.total - result.missed.count) correct · \(result.missed.count) wrong")
                        }
                        .typeRole(Tokens.TypeRole.routeLabel)
                        .foregroundStyle(palette.ink.color)
                        .accessibilityHidden(true)
                        .paperTextSize()
                    }
                }
                // The header is 56 tall, as on the round (ResultView.tsx h-(--size-header)).
                .frame(minHeight: Tokens.Size.header)
                ScrollViewReader { scroller in
                    ScrollView {
                        ticket(scroller)
                    }
                    .scrollIndicators(.hidden)
                    // The ticket runs on under Play again (opaque), not under the quiet button; the stage it fills is
                    // the scroll's layout height, above the gap over the pill.
                    .scrollsUnderRow(Tokens.Space.s12 + pillHeight)
                    .onGeometryChange(for: Double.self) { $0.size.height } action: { stageHeight = $0 }
                    // A heading VoiceOver reads but nobody sees (an opacity-0 view would leave the accessibility tree);
                    // it takes no room, so the ticket starts 12 under the header as on the web.
                    .overlay(alignment: .topLeading) {
                        Color.clear.frame(width: 1, height: 1)
                            .accessibilityElement()
                            .accessibilityLabel("Round complete")
                            .accessibilityAddTraits(.isHeader)
                            .accessibilityFocused($headingFocused)
                    }
                    .onAppear {
                        // Reference 4.4: a New best brings the comparison into view first.
                        if case .newBest? = coordinator.comparison { scroller.scrollTo("score", anchor: .center) }
                    }
                    .onChange(of: coordinator.comparison) { _, comparison in
                        if case .newBest? = comparison {
                            withAnimation(reducedMotion ? nil : Tokens.Curve.ease.animation(Tokens.Duration.t3)) {
                                scroller.scrollTo("score", anchor: .center)
                            }
                        }
                    }
                }
                actions
            }
        }
        .backPans(isEnabled: true, anywhere: false) { event in
            if event.phase == .ended, BackTransition.completes(progress: event.progress, velocity: event.velocity) { close() }
        }
        .focusable(interactions: .edit)
        .focusEffectDisabled()
        .focused($keysFocused)
        .onKeyPress(.escape, phases: .down) { _ in
            close()
            return .handled
        }
        .onAppear {
            headingFocused = true
            keysFocused = true
        }
    }

    /// The result's ticket (ResultView.tsx): the boarding pass with the route's legs, the class's fields and the score
    /// block above the perforation, and the missed cards on the sunk lower part, which fills the stage.
    private func ticket(_ scroller: ScrollViewProxy) -> some View {
        let lower = max(Tokens.Size.lower, stageHeight - mainHeight)
        return VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 0) {
                TicketBand().paperTextSize()
                TicketLegs {
                    LegText(code: coordinator.ticket.deckCode, name: coordinator.ticket.deckName).accessibilityElement(children: .combine)
                } to: {
                    LegText(code: coordinator.ticket.sectionCode, name: coordinator.ticket.sectionName, trailing: true)
                        .accessibilityElement(children: .combine)
                }
                .paperTextSize()
                FieldGrid(fields: copy.fields.map { TicketField($0.label, $0.value) })
                    .paperTextSize()
                ScoreBlock(copy: copy, score: result.score, comparison: coordinator.comparison).id("score")
            }
            .foregroundStyle(palette.ink.color)
            .background(NotchedPaper(edge: .bottom).fill(palette.surfaceRaised.color))
            .clipShape(NotchedPaper(edge: .bottom))
            .overlay(alignment: .bottom) { Perforation(axis: .horizontal).padding(.horizontal, Tokens.Size.notch + Tokens.Space.s6) }
            .onGeometryChange(for: Double.self) { $0.size.height } action: { mainHeight = $0 }
            MissedCardsView(missed: missedCards(result.answers), height: lower) {
                // An opened Why brings the whole lower part into view where the stage scrolls (a short phone), so the
                // explanation does not open under Play again.
                withAnimation(reducedMotion ? nil : Tokens.Curve.ease.animation(Tokens.Duration.t3)) {
                    scroller.scrollTo("missed", anchor: .bottom)
                }
            }
            .id("missed")
        }
        .tokenShadow(shadows.ticket, RoundedRectangle(cornerRadius: Tokens.Radius.card))
        .reviewFrame(ReviewName.ticket)
    }

    private var actions: some View {
        VStack(spacing: Tokens.Space.s4) {
            PillButton(title: "Play again", leading: .replay) {
                guard coordinator.resultActionsReady else { return }
                model.playAgain(coordinator.request)
            }
            .onGeometryChange(for: Double.self) { $0.size.height } action: { pillHeight = $0 }
            QuietButton(title: "Choose another route", leading: .routeCurve) { close() }
        }
    }

    private func close() {
        guard coordinator.resultActionsReady else { return }
        Task { await model.showStart(byControl: true) }
    }
}

/// The score and the comparison with the best (ScoreBlock.tsx).
struct ScoreBlock: View {
    let copy: ResultCopy
    let score: Int
    let comparison: Comparison?
    @Environment(\.palette) private var palette
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        // ScoreBlock.tsx: the score at the left and the comparison at the right, their feet aligned, 14 above and 18
        // below; only the New best stamp, which cannot wrap, moves under the score when the row has no room for it.
        Group {
            if case .newBest? = comparison {
                ViewThatFits(in: .horizontal) {
                    HStack(alignment: .bottom, spacing: Tokens.Space.s16) {
                        scoreColumn
                        Spacer(minLength: 0)
                        comparisonView
                    }
                    VStack(alignment: .leading, spacing: Tokens.Space.s10) {
                        scoreColumn
                        comparisonView.frame(maxWidth: .infinity, alignment: .trailing)
                    }
                }
            } else {
                // At the accessibility text sizes, which the web does not have, the comparison goes under the score,
                // 10 below it and at the trailing edge, so no word is cut (N9).
                let layout = dynamicTypeSize.isAccessibilitySize
                    ? AnyLayout(VStackLayout(alignment: .leading, spacing: Tokens.Space.s10)) : AnyLayout(ShrinkRow(gap: Tokens.Space.s16))
                layout {
                    scoreColumn
                    comparisonView.frame(maxWidth: dynamicTypeSize.isAccessibilitySize ? .infinity : nil, alignment: .trailing)
                }
            }
        }
        .padding(.horizontal, Tokens.Size.ticketInset)
        .padding(.top, Tokens.Space.s14)
        .padding(.bottom, Tokens.Space.s18)
    }

    /// "Your score" over the score and its unit, 4 apart; the unit 8 after the score, on its baseline.
    private var scoreColumn: some View {
        VStack(alignment: .leading, spacing: Tokens.Space.s4) {
            Text(copy.scoreLabel).typeRole(Tokens.TypeRole.fieldLabel).foregroundStyle(palette.inkMuted.color)
                .fixedSize(horizontal: false, vertical: true)
            // The unit goes under the score where the two do not fit on one line (the largest text sizes).
            ViewThatFits(in: .horizontal) {
                HStack(alignment: .firstTextBaseline, spacing: Tokens.Space.s8) {
                    Text("\(score)").typeRole(Tokens.TypeRole.score)
                    if let unit = copy.unit { Text(unit).typeRole(Tokens.TypeRole.scoreUnit).foregroundStyle(palette.inkMuted.color) }
                }
                .fixedSize()
                VStack(alignment: .leading, spacing: 0) {
                    Text("\(score)").typeRole(Tokens.TypeRole.score)
                    if let unit = copy.unit { Text(unit).typeRole(Tokens.TypeRole.scoreUnit).foregroundStyle(palette.inkMuted.color) }
                }
            }
            .accessibilityElement(children: .combine)
        }
    }

    /// The comparison with the best, right-aligned, 2 above its foot: plain lines, or the New best stamp over
    /// "Previous best".
    @ViewBuilder private var comparisonView: some View {
        Group {
            switch comparison {
            case .first?:
                Text("First round on this route").typeRole(Tokens.TypeRole.emphasis)
            case .newBest(let previous)?:
                VStack(alignment: .trailing, spacing: Tokens.Space.s10) {
                    HStack(spacing: Tokens.Space.s8) {
                        IconView(icon: .star, size: 20)
                        Text("New best").typeRole(Tokens.TypeRole.stampResult)
                    }
                    .fixedSize()
                    .foregroundStyle(palette.correct.color)
                    .padding(.horizontal, Tokens.Space.s14 + Tokens.Stroke.stamp)
                    .padding(.top, Tokens.Space.s6 + Tokens.Stroke.stamp)
                    .padding(.bottom, Tokens.Space.s4 + Tokens.Stroke.stamp)
                    .background(StampBorder(color: palette.correct.color))
                    .rotationEffect(.degrees(-6))
                    Text("Previous best \(copy.best(previous))").typeRole(Tokens.TypeRole.monoData).foregroundStyle(palette.inkMuted.color)
                }
                .accessibilityElement(children: .combine)
            case .equal(let best)?:
                VStack(alignment: .trailing, spacing: Tokens.Space.s2) {
                    Text("Equals your best").typeRole(Tokens.TypeRole.emphasis)
                    Text("Best \(copy.best(best))").typeRole(Tokens.TypeRole.monoData).foregroundStyle(palette.inkMuted.color)
                }
                .accessibilityElement(children: .combine)
            case .short(let best, let by)?:
                VStack(alignment: .trailing, spacing: Tokens.Space.s2) {
                    Text("\(by) short of your best").typeRole(Tokens.TypeRole.emphasis)
                    Text("Best \(copy.best(best))").typeRole(Tokens.TypeRole.monoData).foregroundStyle(palette.inkMuted.color)
                }
                .accessibilityElement(children: .combine)
            case nil:
                EmptyView()
            }
        }
        .multilineTextAlignment(.trailing)
        .padding(.bottom, Tokens.Space.s2)
    }
}

/// Two parts on a row, the first at the leading edge and the second at the trailing edge, their feet aligned (flex,
/// justify-between, items-end, gap 16). When they do not fit side by side at their own widths, both give up room in
/// proportion to those widths, as a flex row shrinks its items, and their text wraps in what is left.
struct ShrinkRow: Layout {
    let gap: Double

    private func basis(_ subviews: Subviews) -> [Double] { subviews.map { Double($0.sizeThatFits(.unspecified).width) } }

    /// The widths of the parts: their own (`basis`) when they fit `total` with the gaps between them, otherwise each
    /// less by its share of the overflow in proportion to its basis.
    static func shrink(basis: [Double], total: Double, gap: Double) -> [Double] {
        let used = basis.reduce(0, +) + gap * Double(max(0, basis.count - 1))
        let sum = basis.reduce(0, +)
        guard used > total, sum > 0 else { return basis }
        return basis.map { $0 - (used - total) * $0 / sum }
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let total = proposal.width ?? (basis(subviews).reduce(0, +) + gap)
        let widths = Self.shrink(basis: basis(subviews), total: total, gap: gap)
        let heights = zip(subviews, widths).map { $0.sizeThatFits(ProposedViewSize(width: $1, height: nil)).height }
        return CGSize(width: total, height: heights.max() ?? 0)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let widths = Self.shrink(basis: basis(subviews), total: bounds.width, gap: gap)
        for (i, subview) in subviews.enumerated() {
            let size = subview.sizeThatFits(ProposedViewSize(width: widths[i], height: nil))
            // The second part ends at the trailing edge whatever width its lines take (text-right in the last flex item).
            let x = i == 0 ? bounds.minX : bounds.maxX - min(widths[i], size.width)
            subview.place(at: CGPoint(x: x, y: bounds.maxY - size.height), anchor: .topLeading,
                          proposal: ProposedViewSize(width: widths[i], height: size.height))
        }
    }
}
