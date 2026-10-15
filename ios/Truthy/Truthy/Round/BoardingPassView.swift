import SwiftUI
import TruthyEngine

// The ticket of the round (BoardingPass.tsx, reference 4.1 P2 to P3t, 5.7): the band, the legs, the Class, Card and
// Gate fields, the statement (with its appliesTo line), and below the perforation the stub of the question (route
// line and card number, barcode, hints, the intent stamps while dragging, Timed's stub stamp) or the slip of the
// answer. The stub tears away when the slip comes (Classic, Streak, Three lives), the stamp lands after it, and the
// main part jolts; in Timed the stub stays and takes its stamp. The stub is hidden from VoiceOver as a whole (5.9).

struct BoardingPassView: View {
    let coordinator: RoundCoordinator
    /// The drag's intent from -1 to 1: the stub's pull and the intent stamps.
    var intent: Double = 0
    /// VoiceOver focus of the statement (reference 4.4).
    let statementFocus: AccessibilityFocusState<Bool>.Binding
    /// The one answer path, for the custom actions "Answer true" and "Answer false" (reference 5.9).
    let onAnswer: (Bool) -> Bool
    var onSource: (URL) -> Void
    /// Frames in the ticket's scroll content ("ticketContent"), for the ticket scroll of task 6.
    var onStatementFrame: (CGRect) -> Void = { _ in }
    var onSlipFrame: (CGRect) -> Void = { _ in }
    @Environment(\.palette) private var palette
    @Environment(\.shadows) private var shadows
    @Environment(\.accessibilityReduceMotion) private var reducedMotion

    private var round: RoundState { coordinator.state }
    private var ticket: TicketInfo { coordinator.ticket }

    var body: some View {
        VStack(spacing: 0) {
            main
                .keyframeAnimator(initialValue: 0.0, trigger: reducedMotion ? 0 : round.answers.count) { content, y in
                    content.offset(y: y)
                } keyframes: { _ in
                    // The jolt (reference 5.7): 2 down at 40 percent and back, after 420 (120 in Timed, 240 at time up).
                    KeyframeTrack {
                        LinearKeyframe(0.0, duration: joltDelay)
                        CubicKeyframe(2.0, duration: Tokens.Transition.jolt.duration * 0.4)
                        CubicKeyframe(0.0, duration: Tokens.Transition.jolt.duration * 0.6)
                    }
                }
            lower
        }
        .tokenShadow(shadows.ticket, RoundedRectangle(cornerRadius: Tokens.Radius.card))
    }

    private var joltDelay: Double {
        guard round.mode == .timed else { return Tokens.Transition.jolt.delay }
        return coordinator.decided ? 0.24 : 0.12
    }

    private var main: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: Tokens.Space.s8) {
                IconShape(icon: .carrierCloud).fill(palette.onAccent.color).frame(width: 22, height: 16)
                Text("Truthy").typeRole(Tokens.TypeRole.carrierTitle)
                Spacer()
                Text("BOARDING PASS").typeRole(Tokens.TypeRole.carrierLabel)
            }
            .foregroundStyle(palette.onAccent.color)
            .padding(.horizontal, Tokens.Size.ticketInset)
            .frame(minHeight: Tokens.Size.carrier)
            .background(palette.accent.color)
            .accessibilityHidden(true)
            .paperTextSize()
            HStack {
                leg(ticket.deckCode, ticket.deckName)
                Spacer()
                leg(ticket.sectionCode, ticket.sectionName)
            }
            .padding(Tokens.Size.ticketInset)
            .paperTextSize()
            HStack(alignment: .top) {
                field("Class", ticket.modeLabel)
                field("Card", round.mode == .classic ? "\(pad2(round.index + 1)) / \(pad2(round.cards.count))" : pad2(round.index + 1))
                field("Gate", coordinator.decided && round.mode == .timed ? "Closed" : "F ← → T",
                      label: coordinator.decided && round.mode == .timed ? "Gate, Closed" : "Gate, False left, true right")
            }
            .padding(.horizontal, Tokens.Size.ticketInset)
            .paperTextSize()
            VStack(alignment: .leading, spacing: Tokens.Space.s8) {
                if let card = coordinator.card, !card.appliesTo.isEmpty {
                    Text(card.appliesTo).typeRole(Tokens.TypeRole.monoDataStrong).foregroundStyle(palette.inkMuted.color)
                        .accessibilityLabel("Applies to \(card.appliesTo)")
                }
                if let card = coordinator.card {
                    CardTextView(text: card.text.en.statement, style: Tokens.TypeRole.cardStatement)
                        .foregroundStyle(coordinator.decided && round.mode == .timed ? palette.inkMuted.color : palette.ink.color)
                        .accessibilityIdentifier("statement")
                        .accessibilityFocused(statementFocus)
                        .accessibilityAction(named: "Answer true") { _ = onAnswer(true) }
                        .accessibilityAction(named: "Answer false") { _ = onAnswer(false) }
                        .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("ticketContent")) } action: { onStatementFrame($0) }
                }
            }
            .frame(maxWidth: .infinity, minHeight: Tokens.Size.statementMin, alignment: .topLeading)
            .padding(Tokens.Size.ticketInset)
        }
        .foregroundStyle(palette.ink.color)
        .background(NotchedPaper(edge: .bottom).fill(palette.surfaceRaised.color))
        .clipShape(NotchedPaper(edge: .bottom))
    }

    /// A leg (code over name) is content; only the empty arrow column between the legs is decoration (reference 5.9).
    private func leg(_ code: String, _ name: String) -> some View {
        VStack(alignment: .leading, spacing: Tokens.Space.s2) {
            Text(code).typeRole(Tokens.TypeRole.legCode)
            Text(name).typeRole(Tokens.TypeRole.legName).foregroundStyle(palette.inkMuted.color)
        }
        .accessibilityElement(children: .combine)
    }

    private func field(_ label: String, _ value: String, label spoken: String? = nil) -> some View {
        VStack(alignment: .leading, spacing: Tokens.Space.s2) {
            Text(label).typeRole(Tokens.TypeRole.fieldLabel).foregroundStyle(palette.inkMuted.color)
            Text(value).typeRole(Tokens.TypeRole.fieldValue)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(spoken ?? "\(label), \(value)")
    }

    /// The side the stub tears to: left after a right answer, right after a wrong one.
    private var tearSide: Double { lastAnswer(round)?.correct == true ? -1 : 1 }

    @ViewBuilder private var lower: some View {
        if round.phase == .answered || (round.phase == .finished && round.mode != .timed), let answered = lastAnswer(round) {
            slip(answered)
                .transition(.opacity.animation(Tokens.Curve.ease.animation(reducedMotion ? Tokens.Duration.reducedIn : Tokens.Duration.t2)))
        } else {
            stub
                .transition(reducedMotion
                    ? .opacity.animation(Tokens.Curve.ease.animation(Tokens.Duration.reducedOut))
                    : .asymmetric(
                        insertion: .offset(y: 12).combined(with: .opacity).animation(Tokens.Curve.ease.animation(Tokens.Duration.t2)),
                        removal: .modifier(active: TearOff(side: tearSide, p: 1), identity: TearOff(side: tearSide, p: 0))
                            .animation(Tokens.Curve.fall.animation(Tokens.Transition.tear.duration))))
        }
    }

    private var stub: some View {
        VStack(spacing: Tokens.Space.s8) {
            Perforation(axis: .horizontal).padding(.horizontal, Tokens.Size.notch + 6)
            HStack(alignment: .firstTextBaseline) {
                Text("\(ticket.deckCode) → \(ticket.sectionCode) · \(ticket.modeLabel)").typeRole(Tokens.TypeRole.monoData)
                    .foregroundStyle(palette.inkMuted.color)
                Spacer()
                Text("Card \(pad2(round.index + 1))").typeRole(Tokens.TypeRole.monoDataStrong)
            }
            BarcodeView(data: coordinator.card?.id ?? "")
            if round.mode == .timed {
                Text(timedHint ?? "swipe to board").typeRole(Self.monoRegular).foregroundStyle(palette.inkMuted.color)
                    .frame(maxWidth: .infinity)
            } else {
                HStack {
                    Text("← False").typeRole(Tokens.TypeRole.monoDataStrong).foregroundStyle(palette.answerFalse.color)
                    Spacer()
                    Text("swipe to board").typeRole(Self.monoRegular).foregroundStyle(palette.inkMuted.color)
                    Spacer()
                    Text("True →").typeRole(Tokens.TypeRole.monoDataStrong).foregroundStyle(palette.answerTrue.color)
                }
            }
        }
        .foregroundStyle(palette.ink.color)
        .padding(.horizontal, Tokens.Size.ticketInset)
        .padding(.vertical, Tokens.Space.s12)
        .frame(maxWidth: .infinity, minHeight: Tokens.Size.lower)
        .overlay(alignment: .topLeading) {
            if round.mode != .timed { intentStamp(true).padding(.leading, Tokens.Space.s16).padding(.top, 64) }
        }
        .overlay(alignment: .topTrailing) {
            if round.mode != .timed { intentStamp(false).padding(.trailing, Tokens.Space.s16).padding(.top, 64) }
        }
        .overlay(alignment: .top) {
            // Timed's stub stamp, centred 96 from the stub's top.
            if round.mode == .timed, round.phase == .stamped { timedStamp.frame(height: 0).offset(y: 96) }
        }
        .background(NotchedPaper(edge: .top).fill(palette.surfaceRaised.color))
        .offset(y: abs(intent) * Tokens.Gesture.stubPull)
        .rotationEffect(.degrees(intent * 2), anchor: UnitPoint(x: 0.2, y: 0))
        .accessibilityHidden(true)
        .paperTextSize()
    }

    /// "swipe to board": the mono face at the strong data size, regular weight.
    private static let monoRegular = TypeStyle(family: .mono, weight: 400, size: Tokens.TypeRole.monoDataStrong.size,
                                               lineHeight: Tokens.TypeRole.monoDataStrong.lineHeight, letterSpacing: 0)

    /// The intent stamp of a side, inside the stub (PassStub): True at the left rotated -7, False at the right at +7.
    private func intentStamp(_ isTrue: Bool) -> some View {
        let value = isTrue ? intent : -intent
        let colour = isTrue ? palette.answerTrue.color : palette.answerFalse.color
        return HStack(spacing: Tokens.Space.s8) {
            IconView(icon: isTrue ? .check : .cross, size: isTrue ? 18 : 16, strokeWidth: 3)
            Text(isTrue ? "True" : "False").typeRole(Tokens.TypeRole.intentStamp)
        }
        .foregroundStyle(colour)
        .padding(.horizontal, Tokens.Space.s12)
        .padding(.vertical, Tokens.Space.s6)
        .background(RoundedRectangle(cornerRadius: Tokens.Radius.small).fill(palette.surfaceRaised.color))
        .overlay(RoundedRectangle(cornerRadius: Tokens.Radius.small).strokeBorder(colour, lineWidth: Tokens.Stroke.stamp))
        .rotationEffect(.degrees(isTrue ? -7 : 7))
        .opacity(min(1, max(0, value * Tokens.Gesture.intentOpacityGain)))
    }

    private var timedHint: String? {
        guard round.mode == .timed, round.phase == .stamped else { return nil }
        if coordinator.decided { return "This card doesn't count · \(round.answers.count) answered" }
        return lastAnswer(round)?.correct == true ? "Next card coming up" : "Wrong, saved for review at the end"
    }

    private var timedStamp: some View {
        let timeUp = coordinator.decided
        let correct = lastAnswer(round)?.correct == true
        let colour = timeUp ? palette.ink.color : (correct ? palette.correct.color : palette.wrong.color)
        return LandingStamp(duration: Tokens.Duration.stampTimed, delay: timeUp ? 0.12 : 0, reducedMotion: reducedMotion) {
            HStack(spacing: Tokens.Space.s6) {
                if timeUp {
                    IconView(icon: .clockHands, size: 22)
                } else {
                    IconView(icon: correct ? .check : .cross, size: correct ? 24 : 20, strokeWidth: 3)
                }
                Text(timeUp ? "Time is up" : (correct ? "Correct" : "Not quite")).typeRole(Tokens.TypeRole.stampStub)
            }
            .foregroundStyle(colour)
            .padding(.horizontal, Tokens.Space.s18)
            .padding(.top, Tokens.Space.s8)
            .padding(.bottom, Tokens.Space.s6)
            // On raised paper so the barcode under it does not show through (Stamp.tsx STUB_BASE, design system 5.11).
            .background(StampBorder(color: colour))
            .background(RoundedRectangle(cornerRadius: Tokens.Radius.small).fill(palette.surfaceRaised.color))
        }
        .id(round.answers.count * 2 + (timeUp ? 1 : 0))
    }

    private func slip(_ answered: Answered) -> some View {
        let card = answered.card
        let newBest = coordinator.request.mode == .streak && answered.correct && (coordinator.previousBest ?? 0) >= 1
            && round.answers.prefix { $0.correct }.count == (coordinator.previousBest ?? 0) + 1
        let colour = answered.correct ? palette.correct.color : palette.wrong.color
        return VStack(alignment: .leading, spacing: Tokens.Space.s12) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: Tokens.Space.s2) {
                    Text("The answer is").typeRole(Tokens.TypeRole.answerLabel).foregroundStyle(palette.inkMuted.color)
                    Text(card.answer ? "True" : "False").typeRole(Tokens.TypeRole.answerValue)
                }
                .accessibilityElement(children: .combine)
                Spacer()
                LandingStamp(duration: Tokens.Transition.stamp.duration, delay: Tokens.Transition.stamp.delay, reducedMotion: reducedMotion) {
                    HStack(spacing: Tokens.Space.s6) {
                        IconView(icon: newBest ? .star : (answered.correct ? .check : .cross), size: newBest ? 20 : (answered.correct ? 22 : 18), strokeWidth: 3)
                        Text(newBest ? "New best" : (answered.correct ? "Correct" : "Not quite")).typeRole(Tokens.TypeRole.stamp)
                    }
                    .foregroundStyle(colour)
                    .padding(.horizontal, Tokens.Space.s10)
                    .padding(.vertical, Tokens.Space.s4)
                    .background(StampBorder(color: colour))
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(newBest ? "Correct. New best" : (answered.correct ? "Correct" : "Not quite"))
            }
            .paperTextSize()
            CardTextView(text: card.text.en.explanation, style: Tokens.TypeRole.body)
            if let url = URL(string: card.source.url) {
                SourceLink(title: card.source.title) { onSource(url) }
            }
        }
        .foregroundStyle(palette.ink.color)
        .padding(Tokens.Size.ticketInset)
        .frame(maxWidth: .infinity, minHeight: Tokens.Size.lower, alignment: .topLeading)
        .background(NotchedPaper(edge: .top).fill(palette.surfaceSunk.color))
        .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("ticketContent")) } action: { onSlipFrame($0) }
    }
}

/// The stub tearing off (reference 5.7): to (-40, 360) and -18 degrees after a right answer, (40, 360) and 18 after a
/// wrong one, fading as it falls.
struct TearOff: ViewModifier {
    let side: Double
    let p: Double

    func body(content: Content) -> some View {
        content
            .rotationEffect(.degrees(side * 18 * p))
            .offset(x: side * 40 * p, y: 360 * p)
            .opacity(1 - p)
    }
}

/// A stamp landing (reference 5.7): from scale 1.9, -14 degrees and transparent to scale 1, -6 degrees, on the spring
/// curve; shown at rest under reduced motion.
struct LandingStamp<Content: View>: View {
    let duration: Double
    let delay: Double
    let reducedMotion: Bool
    @ViewBuilder let content: () -> Content
    @State private var landed = false

    var body: some View {
        let rest = landed || reducedMotion
        content()
            .scaleEffect(rest ? 1 : 1.9)
            .rotationEffect(.degrees(rest ? -6 : -14))
            .opacity(rest ? 1 : 0)
            .onAppear {
                guard !reducedMotion, !landed else { return }
                withAnimation(Tokens.Curve.spring.animation(duration, delay: delay)) { landed = true }
            }
    }
}

/// A source link (slip and Why): the book icon, the underlined title and an arrow, at least 48 tall; read as
/// "{title} (opens in browser)".
struct SourceLink: View {
    let title: String
    let action: () -> Void
    @Environment(\.palette) private var palette

    var body: some View {
        Button(action: action) {
            HStack(spacing: Tokens.Space.s6) {
                IconView(icon: .book, size: 18)
                Text(title).underline().multilineTextAlignment(.leading)
                Text("→").accessibilityHidden(true)
            }
            .typeRole(Tokens.TypeRole.sourceLink)
            .foregroundStyle(palette.answerTrue.color)
            .frame(minHeight: Tokens.Size.touchMin, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.quiet)
        .keyboardFocusRing(RoundedRectangle(cornerRadius: Tokens.Radius.small))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(title) (opens in browser)")
        .accessibilityAddTraits(.isButton)
    }
}
