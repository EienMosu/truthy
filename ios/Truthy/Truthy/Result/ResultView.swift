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

    private var result: RoundResult { summarise(coordinator.state) }
    private var copy: ResultCopy {
        resultCopy(result, coordinator.ticket.modeLabel, coordinator.state.cards.count, coordinator.outcome?.previousBest)
    }

    var body: some View {
        AppFrame {
            VStack(spacing: Tokens.Space.s12) {
                HStack(alignment: .top, spacing: Tokens.Space.s12) {
                    RoundIconButton(icon: .cross, label: "Close results") { close() }
                    VStack(spacing: Tokens.Space.s4) {
                        RouteCanvas(flown: 1, plane: nil, marks: (0..<copy.marks).map { i in
                            RouteMark(t: waypointT(Double(i), Double(copy.marks)),
                                      state: i < result.answers.count ? (result.answers[i].correct ? .correct : .wrong) : .future,
                                      scale: completedScale(copy.marks), last: i == copy.marks - 1)
                        }, ring: copy.ring.map { waypointT(Double($0), Double(copy.marks)) })
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
                // A heading VoiceOver reads but nobody sees (an opacity-0 view would leave the accessibility tree).
                Color.clear.frame(width: 1, height: 1)
                    .accessibilityElement()
                    .accessibilityLabel("Round complete")
                    .accessibilityAddTraits(.isHeader)
                    .accessibilityFocused($headingFocused)
                ScrollViewReader { scroller in
                    ScrollView {
                        ticket(scroller)
                    }
                    .onAppear {
                        // Reference 4.4: a New best brings the comparison into view first.
                        if case .newBest? = coordinator.comparison { scroller.scrollTo("score", anchor: .center) }
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

    private func ticket(_ scroller: ScrollViewProxy) -> some View {
        VStack(alignment: .leading, spacing: Tokens.Space.s16) {
            HStack(alignment: .top) {
                ForEach(Array(copy.fields.enumerated()), id: \.offset) { _, field in
                    VStack(alignment: .leading, spacing: Tokens.Space.s2) {
                        Text(field.label).typeRole(Tokens.TypeRole.fieldLabel).foregroundStyle(palette.inkMuted.color)
                        Text(field.value).typeRole(Tokens.TypeRole.fieldValue)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .accessibilityElement(children: .combine)
                }
            }
            .paperTextSize()
            ScoreBlock(copy: copy, score: result.score, comparison: coordinator.comparison).id("score")
            Perforation(axis: .horizontal)
            MissedCardsView(missed: missedCards(result.answers)) { number in
                // The opened Why row scrolls into view after 380 ms (50 with reduced motion).
                Task {
                    try? await Task.sleep(for: .milliseconds(reducedMotion ? 50 : 380))
                    withAnimation(reducedMotion ? nil : Tokens.Curve.ease.animation(Tokens.Duration.t3)) { scroller.scrollTo("missed-\(number)") }
                }
            }
        }
        .foregroundStyle(palette.ink.color)
        .padding(Tokens.Size.ticketInset)
        .background(RoundedRectangle(cornerRadius: Tokens.Radius.card).fill(palette.surfaceRaised.color))
        .tokenShadow(shadows.ticket, RoundedRectangle(cornerRadius: Tokens.Radius.card))
    }

    private var actions: some View {
        VStack(spacing: Tokens.Space.s4) {
            PillButton(title: "Play again", leading: .replay) {
                guard coordinator.resultActionsReady else { return }
                model.playAgain(coordinator.request)
            }
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

    var body: some View {
        VStack(alignment: .leading, spacing: Tokens.Space.s6) {
            Text(copy.scoreLabel).typeRole(Tokens.TypeRole.answerLabel).foregroundStyle(palette.inkMuted.color)
            HStack(alignment: .firstTextBaseline, spacing: Tokens.Space.s6) {
                Text("\(score)").typeRole(Tokens.TypeRole.score)
                if let unit = copy.unit { Text(unit).typeRole(Tokens.TypeRole.scoreUnit).foregroundStyle(palette.inkMuted.color) }
            }
            .accessibilityElement(children: .combine)
            comparisonView
        }
    }

    @ViewBuilder private var comparisonView: some View {
        switch comparison {
        case .first?:
            Text("First round on this route").typeRole(Tokens.TypeRole.emphasis)
        case .newBest(let previous)?:
            VStack(alignment: .leading, spacing: Tokens.Space.s4) {
                HStack(spacing: Tokens.Space.s6) {
                    IconView(icon: .star, size: 18)
                    Text("New best").typeRole(Tokens.TypeRole.stampResult)
                }
                .foregroundStyle(palette.correct.color)
                .padding(.horizontal, Tokens.Space.s10)
                .padding(.vertical, Tokens.Space.s4)
                .background(StampBorder(color: palette.correct.color))
                .rotationEffect(.degrees(-6))
                Text("Previous best \(copy.best(previous))").typeRole(Tokens.TypeRole.emphasis)
            }
            .accessibilityElement(children: .combine)
        case .equal(let best)?:
            VStack(alignment: .leading) {
                Text("Equals your best").typeRole(Tokens.TypeRole.emphasis)
                Text("Best \(copy.best(best))").typeRole(Tokens.TypeRole.monoData).foregroundStyle(palette.inkMuted.color)
            }
            .accessibilityElement(children: .combine)
        case .short(let best, let by)?:
            VStack(alignment: .leading) {
                Text("\(by) short of your best").typeRole(Tokens.TypeRole.emphasis)
                Text("Best \(copy.best(best))").typeRole(Tokens.TypeRole.monoData).foregroundStyle(palette.inkMuted.color)
            }
            .accessibilityElement(children: .combine)
        case nil:
            EmptyView()
        }
    }
}
