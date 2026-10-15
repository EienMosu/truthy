import SwiftUI
import TruthyEngine

// The round screen (spec 5.2 to 5.6, reference 4.1 P0 to P3t): the X and the class's header, the ticket in its own
// vertical scroll with the card drag on a stationary container, the answer row or the action after an answer,
// haptics at the decision moments, the hardware keys, announcements, the leading-edge back pan and, once finished,
// the result (task 14).

struct RoundScreen: View {
    let model: AppModel
    let request: RoundRequest
    @State private var coordinator: RoundCoordinator?
    @State private var failed = false
    @Environment(\.palette) private var palette

    var body: some View {
        ZStack {
            SkyBackdrop()
            if let coordinator {
                if coordinator.finished {
                    ResultView(model: model, coordinator: coordinator)
                } else {
                    RoundView(model: model, coordinator: coordinator)
                }
            } else if failed {
                VStack(spacing: Tokens.Space.s16) {
                    Text("This deck didn't load").typeRole(Tokens.TypeRole.stepTitle).accessibilityAddTraits(.isHeader)
                    Text("Check your connection and try again.").typeRole(Tokens.TypeRole.body)
                    PillButton(title: "Try again") { failed = false }
                }
                .foregroundStyle(palette.ink.color)
                .padding(Tokens.Size.gutter)
            } else {
                loading
            }
        }
        .task(id: failed) {
            guard coordinator == nil, !failed else { return }
            do {
                let prepared = try await RoundCoordinator.prepare(request: request, index: model.index, decks: model.decks, store: model.store,
                                                                  journal: model.journal, wall: model.wall, mono: model.mono)
                coordinator = prepared
                #if DEBUG
                if let screen = model.takeDebugScreen() { await prepared.applyDebug(screen) }
                #endif
            } catch {
                failed = true
            }
        }
    }

    /// While the deck decodes (reference 4.1 P0): the X, an empty ticket, "Your round" for VoiceOver and the status
    /// read but not shown. Back here leaves at once (spec 5.2).
    private var loading: some View {
        AppFrame {
            VStack(alignment: .leading, spacing: Tokens.Space.s12) {
                RoundIconButton(icon: .cross, label: "Leave round") { leaveNow() }
                NotchedPaper(edge: .bottom)
                    .fill(palette.surfaceRaised.color)
                    .frame(maxWidth: .infinity, minHeight: Tokens.Size.statementMin)
                    .accessibilityHidden(true)
                Spacer(minLength: 0)
            }
        }
        .overlay(alignment: .topLeading) {
            Color.clear.frame(width: 1, height: 1)
                .accessibilityElement()
                .accessibilityLabel("Your round")
                .accessibilityAddTraits(.isHeader)
        }
        .backPans(isEnabled: true, anywhere: false) { event in
            if event.phase == .ended && BackTransition.completes(progress: event.progress, velocity: event.velocity) { leaveNow() }
        }
        .onAppear { AccessibilityNotification.Announcement("Loading your round").post() }
    }

    private func leaveNow() {
        Task { await model.showStart(byControl: true) }
    }
}

/// Where the ticket scrolls (task 6's ticket scroll, reference 4.4): after an answer only when the slip is not in view,
/// to min(max, slip.top); on a new card only as far as shows the statement above the action row.
enum TicketScrollTarget {
    static func afterAnswer(slip: CGRect, offset: Double, viewport: Double, contentHeight: Double) -> Double? {
        slipScroll(Span(top: slip.minY, bottom: slip.maxY),
                   SlipScrollAt(top: offset, visible: viewport, gap: Tokens.Space.s12, max: max(0, contentHeight - viewport)))
    }

    static func newCard(statement: CGRect, viewport: Double) -> Double {
        statementScroll(Span(top: statement.minY, bottom: statement.maxY), viewport)
    }
}

struct RoundView: View {
    let model: AppModel
    @Bindable var coordinator: RoundCoordinator
    @Environment(\.palette) private var palette
    @Environment(\.resolvedTheme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reducedMotion
    @Environment(\.scenePhase) private var scenePhase
    @State private var dragDx = 0.0
    @State private var caught = 0.0
    @State private var springBack: SpringBack?
    @State private var crossing = CrossingCounter()
    @State private var verdicts = 0
    @State private var lastCorrect = true
    @State private var timeUps = 0
    @State private var roundBack = 1.0
    @State private var leaving = false
    @State private var heldAnnouncement: String?
    @State private var scroll = ScrollPosition(edge: .top)
    @State private var scrollGeometry: [Double] = [0, 0, 0]   // offset, viewport, content height
    @State private var statementFrame = CGRect.zero
    @State private var slipFrame = CGRect.zero
    @State private var slipScrolled = false
    /// Whether the statement had VoiceOver focus when the player answered (Timed's next card, reference 4.4).
    @State private var statementHadFocusAtAnswer = false
    @State private var ticketWidth = 0.0
    @AccessibilityFocusState private var statementFocused: Bool
    @AccessibilityFocusState private var actionFocused: Bool
    @AccessibilityFocusState private var xFocused: Bool
    /// The screen's root holds keyboard focus, so the keys work after touches (spec section 2).
    @FocusState private var keysFocused: Bool

    private var round: RoundState { coordinator.state }

    var body: some View {
        AppFrame {
            VStack(spacing: Tokens.Space.s12) {
                header
                ScrollView {
                    ticket.coordinateSpace(name: "ticketContent")
                }
                .scrollPosition($scroll)
                .onScrollGeometryChange(for: [Double].self) { [$0.contentOffset.y, $0.containerSize.height, $0.contentSize.height] } action: { _, g in
                    scrollGeometry = g
                }
                .onChange(of: slipFrame) { _, frame in
                    guard round.phase == .answered, !slipScrolled, frame.height > 0 else { return }
                    slipScrolled = true
                    // After the layout pass has delivered every geometry callback: the slip frame and the content
                    // height come from two sources whose order is not guaranteed, so both are read once settled.
                    Task {
                        await Task.yield()
                        guard round.phase == .answered, slipFrame.height > 0 else { return }
                        if let y = TicketScrollTarget.afterAnswer(slip: slipFrame, offset: scrollGeometry[0], viewport: scrollGeometry[1],
                                                                  contentHeight: scrollGeometry[2]) {
                            withAnimation(Tokens.Curve.ease.animation(Tokens.Duration.t3)) { scroll.scrollTo(y: y) }
                        }
                    }
                }
                .onChange(of: round.index) { _, _ in
                    slipScrolled = false
                    // The next slip may land at the same frame; from zero its first frame is always a change.
                    slipFrame = .zero
                    // After the new card's layout: only as far as shows its statement above the action row.
                    Task {
                        await Task.yield()
                        scroll.scrollTo(y: TicketScrollTarget.newCard(statement: statementFrame, viewport: scrollGeometry[1]))
                    }
                }
                actions
            }
        }
        .scaleEffect(roundBack)
        .backPans(isEnabled: !coordinator.sheetOpen && !leaving, anywhere: false, onEvent: handleBack)
        .sensoryFeedback(.impact(weight: .light), trigger: crossing.count)
        .sensoryFeedback(trigger: verdicts) { _, _ in lastCorrect ? .success : .error }
        .sensoryFeedback(.warning, trigger: timeUps)
        .focusable(interactions: .edit)
        .focusEffectDisabled()
        .focused($keysFocused)
        .onKeyPress(.leftArrow, phases: .down) { _ in answer(false) ? .handled : .ignored }
        .onKeyPress(.rightArrow, phases: .down) { _ in answer(true) ? .handled : .ignored }
        .onKeyPress(.return, phases: .down) { _ in
            Task { await coordinator.next() }
            return .handled
        }
        .onKeyPress(.escape, phases: .down) { _ in
            pressX()
            return .handled
        }
        .onAppear {
            coordinator.startTicker()
            statementFocused = true
            keysFocused = true
        }
        .onDisappear { coordinator.stopTicker() }
        .onChange(of: scenePhase) { _, phase in coordinator.scenePhaseChanged(phase) }
        .onChange(of: coordinator.decided) { _, decided in
            if decided && round.mode == .timed {
                timeUps += 1
                announce("Time is up. This card doesn't count.")
            }
        }
        .onChange(of: round.index) { _, _ in
            if round.mode == .timed { announce(timedCardText(round)) }
            // Reference 4.4: the new card's statement takes focus; in Timed only if the old one had it at the answer,
            // otherwise focus stays on True or False and the announcement carries the new card.
            Task {
                await Task.yield()
                if round.mode != .timed || round.index == 0 || statementHadFocusAtAnswer { statementFocused = true }
                statementHadFocusAtAnswer = false
            }
        }
        .onChange(of: coordinator.showsAction) { _, shows in
            // Reference 4.4: after an answer focus goes to Next card or See results when it takes presses (at once with
            // reduced motion); at time up only from True or False, which then leave the screen.
            guard shows else { return }
            Task {
                try? await Task.sleep(for: .milliseconds(reducedMotion ? 0 : Int(NEXT_ARRIVES_MS)))
                actionFocused = true
            }
        }
        .leaveSheet(coordinator: coordinator, onLeave: leave)
        .onChange(of: coordinator.sheetOpen) { _, open in
            if !open && !leaving { xFocused = true }
            guard !open, let held = heldAnnouncement else { return }
            heldAnnouncement = nil
            Task {
                try? await Task.sleep(for: .milliseconds(Int(SPOKEN_RELEASE_MS)))
                AccessibilityNotification.Announcement(held).post()
            }
        }
    }

    // MARK: Header and ticket

    private var header: some View {
        HStack(alignment: .top, spacing: Tokens.Space.s12) {
            RoundIconButton(icon: .cross, label: "Leave round") { pressX() }
                .accessibilityFocused($xFocused)
            Group {
                switch round.mode {
                case .classic: FlightPathHeader(round: round)
                case .streak: StreakHeader(round: round, best: coordinator.previousBest)
                case .lives: LivesHeader(round: round)
                case .timed: TimedHeader(round: round)
                }
            }
            .frame(maxWidth: .infinity)
        }
        .frame(minHeight: Tokens.Size.header)
        .overlay(alignment: .topLeading) {
            // A heading VoiceOver reads but nobody sees (an opacity-0 view would leave the accessibility tree).
            Color.clear.frame(width: 1, height: 1)
                .accessibilityElement()
                .accessibilityLabel("\(coordinator.ticket.deckName), \(coordinator.ticket.sectionName): \(coordinator.ticket.modeLabel) round")
                .accessibilityAddTraits(.isHeader)
        }
    }

    private var ticket: some View {
        let dx = caught + dragDx
        return BoardingPassView(coordinator: coordinator, intent: intent(dragDx), statementFocus: $statementFocused,
                                onAnswer: { answer($0) },
                                onSource: { url in SafariPresenter.present(url, theme: theme, palette: palette) },
                                onStatementFrame: { statementFrame = $0 }, onSlipFrame: { slipFrame = $0 })
            .reviewFrame(ReviewName.card)
            // CSS translateX(dx) rotate(dx/18deg): the card turns about its own moved centre.
            .rotationEffect(.degrees(dx / Tokens.Gesture.rotationDivisor))
            .offset(x: dx)
            .id(round.mode == .timed ? round.index : 0)
            .transition(timedCardTransition)
            .onGeometryChange(for: Double.self) { $0.size.width } action: { ticketWidth = $0 }
            .contentShape(Rectangle())
            // Enabled by observable state only: canAnswer depends on the clock and would leave the recognizer disabled.
            // The 250 ms settle still holds: interpret gets cardShownAt and coordinator.answer checks canAnswer.
            .gesture(CardPan(isEnabled: (round.phase == .question && !coordinator.sheetOpen) || dragDx != 0, onDrag: handleDrag))
    }

    /// Timed (reference 5.7): after the 700 ms hold the card leaves towards the answered side (x 120 percent, 8 degrees,
    /// 220 on the fall curve) and the next one comes from 14 below (280). The other classes keep one ticket.
    private var timedCardTransition: AnyTransition {
        guard round.mode == .timed, !reducedMotion else { return .identity }
        let side: Double = lastAnswer(round)?.given == false ? -1 : 1
        return .asymmetric(
            insertion: .offset(y: 14).combined(with: .opacity).animation(Tokens.Curve.ease.animation(Tokens.Transition.timedDeal.duration)),
            removal: .offset(x: side * 1.2 * ticketWidth).combined(with: .rotation(side))
                .combined(with: .opacity).animation(Tokens.Curve.fall.animation(Tokens.Transition.timedLeave.duration)))
    }

    // MARK: Actions

    @ViewBuilder private var actions: some View {
        let timedStamped = round.mode == .timed && round.phase == .stamped && !coordinator.decided
        if coordinator.showsAction {
            PillButton(title: coordinator.decided ? "See results" : "Next card", trailingArrow: true) {
                Task { await coordinator.next() }
            }
            .accessibilityFocused($actionFocused)
            .frame(minHeight: Tokens.Size.actions)
            .transition(reducedMotion ? .opacity : .offset(y: 12).combined(with: .opacity).animation(
                Tokens.Curve.ease.animation(Tokens.Transition.answerRow.duration, delay: Tokens.Transition.answerRow.delay)))
        } else {
            HStack(spacing: Tokens.Space.s12) {
                PillButton(title: "False", fill: .answerFalse, leading: .cross, leadingSize: 16, leadingStroke: 3, dimmed: timedStamped) { _ = answer(false) }
                PillButton(title: "True", fill: .answerTrue, leading: .check, leadingStroke: 3, dimmed: timedStamped) { _ = answer(true) }
            }
            // Two half-width pills: past xxLarge "False" breaks in the middle of the word (README deviation 6).
            .paperTextSize()
            .frame(minHeight: Tokens.Size.actions)
            .transition(.opacity.animation(Tokens.Curve.ease.animation(Tokens.Duration.t2)))
        }
    }

    private func intent(_ dx: Double) -> Double {
        TruthyEngine.intent(dx)
    }

    // MARK: Answering

    @discardableResult private func answer(_ value: Bool) -> Bool {
        let hadFocus = statementFocused
        guard coordinator.answer(value), let answered = lastAnswer(round) else { return false }
        statementHadFocusAtAnswer = hadFocus
        lastCorrect = answered.correct
        verdicts += 1
        if round.mode == .timed {
            announce(timedStatus(round))
        } else {
            let best = coordinator.previousBest ?? 0
            let newBest = round.mode == .streak && answered.correct && best >= 1 && round.answers.prefix { $0.correct }.count == best + 1
            let status = roundStatus(round)
            announce(verdictText(answered.correct, answered.card.answer, newBest) + (status.isEmpty ? "" : " \(status)"))
        }
        return true
    }

    private func announce(_ text: String) {
        guard !text.isEmpty else { return }
        if coordinator.sheetOpen {
            heldAnnouncement = text
        } else {
            AccessibilityNotification.Announcement(text).post()
        }
    }

    /// The finger: the drawn offset is the catch offset plus dx; interpret and the haptic read dx alone. Release
    /// answers through the one answer path and springs the card back with the finger's speed (spec 5.3).
    private func handleDrag(_ drag: CardDrag) {
        switch drag.phase {
        case .moved:
            if dragDx == 0, let spring = springBack {
                caught = spring.position(atMs: model.mono.nowMs())
                springBack = nil
            }
            dragDx = drag.dx
            crossing.update(dx: drag.dx)
        case .released, .cancelled:
            crossing.release()
            if drag.phase == .released {
                let outcome = interpret(drag.samples, SwipeContext(viewportWidth: drag.windowWidth, cardShownAt: coordinator.cardShownAt))
                if outcome != .cancel { answer(outcome == .true) }
            }
            let offset = caught + dragDx
            caught = 0
            dragDx = offset
            if reducedMotion {
                dragDx = 0
                return
            }
            springBack = SpringBack(offset: offset, velocity: drag.velocity, startedAt: model.mono.nowMs())
            let unitVelocity = offset == 0 ? 0 : -drag.velocity / offset
            withAnimation(Tokens.Spring.snap.animation(initialVelocity: unitVelocity)) {
                dragDx = 0
            } completion: {
                springBack = nil
            }
        }
    }

    // MARK: Leaving

    /// The X, Escape and back on the round: with no answers leave at once, otherwise ask; on the sheet, keep playing.
    private func pressX() {
        if coordinator.sheetOpen {
            coordinator.keepPlaying()
            return
        }
        switch coordinator.xAction {
        case .leaveNow: leave()
        case .openSheet: coordinator.openSheet()
        }
    }

    private func leave() {
        guard !leaving else { return }
        leaving = true
        Task {
            await coordinator.leave()
            await model.showStart(byControl: true)
        }
    }

    /// The leading-edge pan on the round scales the surface from 1 to 0.94 with the progress, pivot at the centre, and,
    /// on release past the rule, does what the X does; a cancel springs back (spec 5.2).
    private func handleBack(_ event: BackPanEvent) {
        switch event.phase {
        case .changed:
            roundBack = 1 - 0.06 * event.progress
        case .ended, .cancelled:
            let complete = event.phase == .ended && BackTransition.completes(progress: event.progress, velocity: event.velocity)
            withAnimation(Tokens.Spring.snap.animation) { roundBack = 1 }
            if complete { pressX() }
        }
    }
}

private extension AnyTransition {
    /// The leaving Timed card turns 8 degrees towards its side.
    static func rotation(_ side: Double) -> AnyTransition {
        .modifier(active: TurnModifier(degrees: side * 8), identity: TurnModifier(degrees: 0))
    }
}

private struct TurnModifier: ViewModifier {
    let degrees: Double

    func body(content: Content) -> some View {
        content.rotationEffect(.degrees(degrees))
    }
}
