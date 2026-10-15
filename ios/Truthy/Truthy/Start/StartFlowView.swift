import SwiftUI
import TruthyEngine

// The start flow (spec 3 and 5.1, reference 4.1 to 4.5): one screen whose steps change in place. Forward plays the
// web's forward motion; every way back (the edge pan, the anywhere pan on iOS 26, the Back pill, a pass field,
// Escape, "Change platform") plays BackTransition, driven by the finger or over its own duration. Lists are announced
// as lists and fade at the bottom while more lies below (task 5's listCue).

struct StartFlowView: View {
    let model: AppModel
    @Environment(\.palette) private var palette
    @Environment(\.accessibilityReduceMotion) private var reducedMotion
    @AccessibilityFocusState private var titleFocused: Bool
    @AccessibilityFocusState private var focusedCard: String?
    /// The screen's root holds keyboard focus, so Escape works after touches (a touch never moves focus on iOS).
    @FocusState private var keysFocused: Bool
    @State private var unrollScale = 0.0
    @State private var unrollRoute: Route?
    @State private var unrollMode: Mode?
    @State private var backTarget: Step?
    /// True while a played back runs (the Back pill, a pass field, Escape, Change platform): the pans are off then.
    @State private var playingBack = false
    /// True while this view's own pan drives the back: its recognizer stays enabled (disabling it would cancel it).
    @State private var panning = false
    /// The panel on screen arrived forward (its items drop in, staggered) or at rest (launch, after a back).
    @State private var arrivedForward = false
    /// The step on screen was settled by a back, completed or cancelled: the zones the back drew are swapped for their
    /// resting views without an entering motion (N1: the logo, the tagline, the pass and the foot zone did not leave
    /// and enter again a moment after the back had come to rest).
    @State private var settledByBack = false
    @State private var cardFrames: [String: CGRect] = [:]
    @State private var fieldFrames: [PassFieldName: CGRect] = [:]
    @State private var travel: NameTravel?
    @State private var windowHeight = 0.0
    @State private var topContentHeight = 0.0
    @Environment(\.dynamicTypeSize) private var typeSize
    /// The whole column's scroll on a short screen or at an accessibility text size (rule 9).
    @State private var columnPosition = ScrollPosition(edge: .top)
    @State private var columnOffset = 0.0
    /// The column was scrolled when the step on screen arrived and jumped to its top (StartFlow.tsx:489-501).
    @State private var columnJumped = false

    private var flow: StartFlowModel { model.startFlow }
    private var backRuns: Bool { backTarget != nil && flow.backProgress != nil }

    /// Rule 9: under 568 tall (the web's `short`) or at an accessibility text size the fixed layout does not fit, so
    /// the whole column scrolls: the zones take their own heights and the foot zone follows the list.
    private var short: Bool {
        (windowHeight > 0 && windowHeight < FrameLayout.shortScreen) || typeSize.isAccessibilitySize
    }

    /// Rule 5: right after the column jumped to its top, the Back pill and the pass fields lie where the finger just
    /// was, so a press on them waits out the step's settle time (a double tap must not take a way back unseen).
    private var headerHeld: Bool { columnJumped && !flow.settled }

    var body: some View {
        ZStack {
            SkyBackdrop(lowerCloud: .start)
            AppFrame {
                if short {
                    ScrollView {
                        column
                    }
                    .scrollPosition($columnPosition)
                    .onScrollGeometryChange(for: Double.self) { $0.contentOffset.y + $0.contentInsets.top } action: { _, y in columnOffset = y }
                } else {
                    column
                }
            }
            if flow.unrolling {
                RoundedRectangle(cornerRadius: Tokens.Radius.card)
                    .fill(palette.surfaceRaised.color)
                    .scaleEffect(x: 1, y: unrollScale, anchor: .top)
                    .padding(Tokens.Size.gutter)
                    .accessibilityHidden(true)
                    .onAppear {
                        guard let route = unrollRoute, let mode = unrollMode else { return }
                        withAnimation(Tokens.Curve.ease.animation(Tokens.Duration.t3)) {
                            unrollScale = 1
                        } completion: {
                            model.startRound(route: route, mode: mode)
                        }
                    }
            }
            if let travel {
                NameTravelView(travel: travel).onAppear {
                    withAnimation(Tokens.Curve.ease.animation(Tokens.Duration.travel, delay: Tokens.Duration.travelHold)) {
                        self.travel?.progress = 1
                    } completion: {
                        self.travel = nil
                    }
                }
            }
        }
        .onGeometryChange(for: Double.self) { $0.size.height } action: { windowHeight = $0 }
        .coordinateSpace(name: "flow")
        .allowsHitTesting(!flow.unrolling)
        .backPans(isEnabled: flow.canGoBack && !playingBack, anywhere: true, onEvent: handlePan)
        .focusable(interactions: .edit)
        .focusEffectDisabled()
        .focused($keysFocused)
        .onKeyPress(.escape, phases: .down) { _ in
            playBack(to: flow.step == 1 ? nil : flow.previous)
            return .handled
        }
        .onChange(of: flow.step) { old, new in
            // Rule 9: a step that arrives starts at the column's top, with the pass and its title in view.
            columnJumped = short && columnOffset > 0
            if columnJumped {
                var jump = Transaction()
                jump.disablesAnimations = true
                withTransaction(jump) { columnPosition.scrollTo(edge: .top) }
            }
            if new > old { titleFocused = true } else { focusedCard = flow.focusAfterBack }
        }
        .onAppear {
            keysFocused = true
            if model.returnedFromRound { titleFocused = true }
        }
    }

    /// The top zone, the step's panel and the foot zone, in a column that fills the frame, or that scrolls as one
    /// on a short screen (rule 9).
    private var column: some View {
        VStack(spacing: 0) {
            topZones
            ZStack(alignment: .top) {
                if let target = backTarget, flow.backProgress != nil {
                    stepPanel(target, leaving: false)
                        // Inserted at progress 0; a played back animates it from here (a value a view is inserted
                        // with would not be interpolated).
                        .onAppear { if playingBack { runPlayedBack(target) } }
                }
                // The step on screen keeps one identity while a back runs over it: a cancelled back leaves its list
                // scrolled where it was and its items in place (N1), instead of a new panel whose items drop in.
                stepPanel(flow.step, leaving: backRuns ? true : nil)
                    .id(flow.step)
                    .transition(.asymmetric(
                        insertion: .identity,
                        removal: reducedMotion
                            ? .opacity.animation(Tokens.Curve.easeOut.animation(Tokens.Duration.reducedOut))
                            : .offset(y: -10).combined(with: .opacity).animation(Tokens.Curve.easeOut.animation(Tokens.Duration.stepExit))))
            }
            .padding(.top, Tokens.Space.s20)
            footZones
        }
    }

    // MARK: Back motion

    /// The one transition of the back running now, or of a back to `target`: every part reads the same time base.
    private func backMotion(_ target: Step) -> BackTransition {
        BackTransition(from: flow.step, to: target, itemCount: StepContent(flow: flow, app: model, step: target, choose: choose).options.count + 1)
    }

    private func motion(_ role: BackMotion.Role) -> BackMotion {
        BackMotion(progress: flow.backProgress ?? 0, transition: backMotion(backTarget ?? flow.previous), role: role, reducedMotion: reducedMotion)
    }

    /// The back running now as the pass reads it: the pass animates the progress itself, so its dashes, its morph and
    /// its value copies are the frame's at every frame of a played back or a spring. Nil at rest.
    private var passBack: PassBack? {
        guard let target = backTarget, let progress = flow.backProgress else { return nil }
        return PassBack(from: flow.step, transition: backMotion(target), progress: progress, reducedMotion: reducedMotion)
    }

    // MARK: Zones

    @ViewBuilder private var topZones: some View {
        // The theme switch lies over the top zone's trailing corner (StartFlow.tsx: absolute, top right), so the pass
        // takes the column's whole width, as on the web.
        ZStack(alignment: .topTrailing) {
            ZStack(alignment: .topLeading) {
                if let target = backTarget, backRuns, target == 1 {
                    topZone(1).modifier(motion(.brandIn))
                    topZone(flow.step).modifier(motion(.tripOut))
                } else {
                    // The same view at rest and during a back that changes the pass's stage, so the pass keeps its
                    // identity (and its measured values) and nothing is inserted when the back completes.
                    topZone(flow.step)
                        .id(flow.step == 1)
                        .transition(.asymmetric(
                            insertion: settledByBack ? .identity : .offset(y: flow.step == 1 ? -12 : 12).combined(with: .opacity)
                                .animation(Tokens.Curve.ease.animation(Tokens.Duration.stepEnter, delay: Tokens.Duration.topEnterDelay)),
                            removal: .offset(y: 12).combined(with: .opacity).animation(Tokens.Curve.ease.animation(Tokens.Duration.topExit))))
                }
            }
            .frame(maxWidth: .infinity, alignment: .topLeading)
            .opacity(flow.unrolling ? 0 : 1)
            .animation(Tokens.Curve.ease.animation(Tokens.Duration.topExit), value: flow.unrolling)
            Group {
                if backRuns {
                    ThemeSwitch(theme: model.theme) { model.switchTheme() }
                        .modifier(SwitchShift(progress: flow.backProgress ?? 0, transition: backMotion(backTarget ?? flow.previous),
                                              reducedMotion: reducedMotion, onStepOne: false))
                } else {
                    ThemeSwitch(theme: model.theme) { model.switchTheme() }
                        .modifier(SwitchShift(progress: 0, transition: nil, reducedMotion: reducedMotion, onStepOne: flow.step == 1))
                        .animation(Tokens.Curve.ease.animation(Tokens.Duration.stepEnter), value: flow.step == 1)
                }
            }
            .opacity(flow.unrolling ? 0 : 1)
            .animation(Tokens.Curve.ease.animation(Tokens.Duration.topExit), value: flow.unrolling)
        }
        .foregroundStyle(palette.ink.color)
        .fixedSize(horizontal: false, vertical: true)
        .onGeometryChange(for: Double.self) { $0.size.height } action: { topContentHeight = $0 }
        .frame(height: topZoneHeight.map { CGFloat($0) }, alignment: .top)
    }

    /// The top zone is 176 tall (StartFlow.tsx), its content reaching below it where it is taller. The title of a step
    /// starts 20 under it, so a taller pass pushes the title down; on step 6 the pass may reach into the 112 above
    /// the title. Where the column scrolls (rule 9) the zone is as tall as what it holds.
    private var topZoneHeight: Double? {
        guard !short else { return nil }
        let overlap = flow.step == 6 && backTarget == nil ? readyOffset : 0
        return max(Tokens.Size.startTopZone, topContentHeight - overlap)
    }

    /// Reference 4.1 S6: 112 above the title, 88 under 600 tall, none where the column scrolls (rule 9).
    private var readyOffset: Double {
        short ? 0 : windowHeight < 600 ? Tokens.Size.readyOffset - 24 : Tokens.Size.readyOffset
    }

    /// The top zone of `step`: the logo and the tagline on step 1, the Back pill and the pass on the others.
    @ViewBuilder private func topZone(_ step: Step) -> some View {
        if step == 1 {
            VStack(alignment: .leading, spacing: Tokens.Space.s14) {
                // Logo.tsx: the mark, 12 (a third of the type size) and the wordmark, 0.111em of padding above it.
                HStack(spacing: Tokens.Space.s12) {
                    LogoMark()
                    Text("Truthy").typeRole(Tokens.TypeRole.logo).padding(.top, Tokens.TypeRole.logo.size * 0.1111)
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("Truthy")
                .accessibilityAddTraits(.isHeader)
                .reviewFrame(ReviewName.logo)
                Text("True or false cards that teach you IT, one swipe at a time.")
                    .typeRole(Tokens.TypeRole.tagline)
                    .frame(maxWidth: 300, alignment: .leading)
            }
            .padding(.top, 36)
        } else {
            tripZone(step)
        }
    }

    /// The Back pill over the pass. During a back that changes the pass's stage the pass shows the stage it returns
    /// to and morphs from the one it leaves (FillInPass reads the frame).
    private func tripZone(_ step: Step) -> some View {
        let back = passBack
        let showing = back.map { $0.changesStage ? $0.transition.to : step } ?? step
        return VStack(alignment: .leading, spacing: Tokens.Space.s12) {
            Button { if !headerHeld { playBack(to: flow.previous) } } label: {
                HStack(spacing: Tokens.Space.s8) {
                    IconView(icon: .backPill, size: 18)
                    Text("Back").typeRole(Tokens.TypeRole.buttonBack)
                }
                .padding(.leading, Tokens.Space.s14)
                .padding(.trailing, Tokens.Space.s20)
                .frame(minHeight: Tokens.Size.pillSmall)
                .background(Capsule().fill(palette.surfaceRaised.color))
            }
            .buttonStyle(.backPill)
            .keyboardFocusRing(Capsule())
            .accessibilityLabel("Back to \(StepContent.backTo[flow.previous] ?? "areas")")
            FillInPass(flow: flow, showing: showing, back: back,
                       onBack: { target in if !headerHeld { playBack(to: target) } },
                       onChangePlatform: { if !headerHeld { playBackToPlatform() } },
                       onFieldFrame: { name, frame in fieldFrames[name] = frame })
                // StartFlow.tsx: the ready pass sits 8 lower than the pass of steps 2 to 5.
                .padding(.top, step == 6 ? Tokens.Space.s8 : 0)
        }
    }

    @ViewBuilder private var footZones: some View {
        ZStack(alignment: .bottom) {
            if let target = backTarget, backRuns {
                if target == 1, let continueTarget = model.continueTarget { continueLine(continueTarget).modifier(motion(.footIn)) }
                if flow.step == 6 { startRoundButton.modifier(motion(.footOut)) }
            } else if flow.step == 1, let target = model.continueTarget {
                continueLine(target)
                    .transition(settledByBack ? .identity : .offset(y: 12).combined(with: .opacity)
                        .animation(Tokens.Curve.ease.animation(Tokens.Duration.stepEnter, delay: Tokens.Duration.topEnterDelay)))
            } else if flow.step == 6 {
                startRoundButton
                    .transition(.asymmetric(
                        insertion: settledByBack ? .identity : .offset(y: 12).combined(with: .opacity)
                            .animation(Tokens.Curve.ease.animation(Tokens.Duration.stepEnter, delay: Tokens.Duration.topEnterDelay)),
                        removal: .offset(y: 12).combined(with: .opacity).animation(Tokens.Curve.ease.animation(Tokens.Duration.topExit))))
            }
        }
    }

    private func continueLine(_ target: ContinueTarget) -> some View {
        ContinueLine(target: target) {
            withAnimation(Tokens.Curve.ease.animation(Tokens.Duration.stepEnter, delay: Tokens.Duration.stepEnterDelay)) {
                if flow.continueTo(target) {
                    arrivedForward = true
                    settledByBack = false
                }
            }
        }
        .padding(.bottom, 4)
    }

    private var startRoundButton: some View {
        PillButton(title: "Start round", trailingArrow: true) { startRound() }
            .padding(.bottom, 4)
    }

    // MARK: A step

    /// A step's panel: `leaving` true is the step a back leaves, false the step it comes back to, nil a step at rest or
    /// arriving forward.
    private func stepPanel(_ step: Step, leaving: Bool?) -> some View {
        let content = StepContent(flow: flow, app: model, step: step, choose: choose)
        return VStack(alignment: .leading, spacing: Tokens.Space.s8) {
            Text(content.title)
                .typeRole(Tokens.TypeRole.stepTitle)
                .frame(minHeight: Tokens.Native.stepTitleRow)
                .padding(.top, step == 6 ? readyOffset : 0)
                .accessibilityAddTraits(.isHeader)
                .accessibilityFocused($titleFocused)
                .modifier(OptionalMotion(motion: leaving == true ? motion(.oldTitle) : leaving == false ? motion(.newItem(0)) : nil))
                .modifier(EnteringItem(index: 0, animate: leaving == nil && arrivedForward, reducedMotion: reducedMotion))
            if step == 6, let mode = flow.choice.mode {
                Text("\(modeInfo(mode).description) Swipe right for true, left for false.")
                    .typeRole(Tokens.TypeRole.tagline)
                    .frame(maxWidth: 320, alignment: .leading)
                    .modifier(OptionalMotion(motion: leaving == false ? motion(.newItem(1)) : nil))
                    .modifier(EnteringItem(index: 1, animate: leaving == nil && arrivedForward, reducedMotion: reducedMotion))
            } else {
                FadingList(options: content.options, step: step, scrolls: !short, focusedCard: $focusedCard,
                           revealId: leaving == nil && !arrivedForward ? flow.focusAfterBack : nil,
                           motion: { i in leaving == false ? motion(.newItem(i + 1)) : nil },
                           entering: { i in EnteringItem(index: i + 1, animate: leaving == nil && arrivedForward, reducedMotion: reducedMotion) },
                           onCardFrame: { id, frame in cardFrames[id] = frame })
            }
        }
        .foregroundStyle(palette.ink.color)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        // The panel a back leaves sinks and fades as one; its title also fades faster on its own (oldTitle above).
        .modifier(OptionalMotion(motion: leaving == true ? motion(.oldPanel) : nil))
    }

    // MARK: Actions

    private func choose(_ choice: StepContent.StepChoice) {
        startTravel(choice)
        withAnimation(Tokens.Curve.ease.animation(Tokens.Duration.stepEnter, delay: Tokens.Duration.stepEnterDelay)) {
            let moved: Bool
            switch choice {
            case .area(let id): moved = flow.chooseArea(id)
            case .recent: moved = flow.chooseRecent()
            case .platform(let id): moved = flow.choosePlatform(id)
            case .deck(let id): moved = flow.chooseDeck(id)
            case .recentDeck(let deck): moved = flow.chooseRecentDeck(deck)
            case .section(let id): moved = flow.chooseSection(id)
            case .mode(let mode): moved = flow.chooseMode(mode)
            }
            if moved {
                arrivedForward = true
                settledByBack = false
            }
        }
    }

    /// Name travel (reference 5.7): a scaled copy of the chosen name moves from its card into its pass field, 300 ms
    /// on the ease curve after 60 ms. Skipped for the class, whose pass value changes typeface, and with reduced
    /// motion; every back clears it. The copy is inserted at progress 0 and animates from its own onAppear.
    private func startTravel(_ choice: StepContent.StepChoice) {
        guard !reducedMotion, flow.settled else { return }
        let source: (id: String, field: PassFieldName, text: String, style: TypeStyle)?
        switch choice {
        case .area(let id): source = flow.index.areas.first { $0.id == id }.map { (id, .area, $0.title, Tokens.TypeRole.cardName) }
        case .platform(let id): source = flow.area?.platforms.first { $0.id == id }.map { (id, .platform, $0.title, Tokens.TypeRole.cardName) }
        case .deck(let id): source = flow.platform?.decks.first { $0.id == id }.map { (id, .deck, $0.code, Tokens.TypeRole.deckCode) }
        case .recentDeck(let recent): source = (recent.deck.id, .deck, recent.deck.code, Tokens.TypeRole.deckCode)
        case .section(let id): source = (id, .section, id == WHOLE_DECK ? "Whole deck" : id, id == WHOLE_DECK ? Tokens.TypeRole.cardName : Tokens.TypeRole.deckCode)
        case .recent, .mode: source = nil
        }
        guard let source, let from = cardFrames[source.id], let to = fieldFrames[source.field] else { return }
        travel = NameTravel(text: source.text, style: source.style, from: from, to: to, progress: 0)
    }

    /// A back played over its own duration: the Back pill, a pass field, Escape. Nil does nothing (step 1). The two
    /// panels are inserted at progress 0 here; runPlayedBack starts the motion from their onAppear.
    private func playBack(to target: Step?) {
        guard let target, flow.canGoBack, backTarget == nil, !playingBack else { return }
        travel = nil
        playingBack = true
        backTarget = target
        flow.backProgress = 0
    }

    private func runPlayedBack(_ target: Step) {
        withAnimation(.linear(duration: backMotion(target).durationMs(reducedMotion: reducedMotion) / 1000)) {
            flow.backProgress = 1
        } completion: {
            settledByBack = true
            flow.back(to: target)
            arrivedForward = false
            backTarget = nil
            playingBack = false
        }
    }

    /// "Change platform, now {title}" on the recent path: B from the step on screen to the platform's deck step, which
    /// leaves the ordinary path [1, 2, 3] (task 11). The step on screen first moves onto the ordinary path, so the
    /// back draws that platform's decks coming back, not the Recent list, and keeps the area and the platform on the
    /// pass (StartFlow.tsx toPlatformDecks shows step 3 with only those two chosen).
    private func playBackToPlatform() {
        guard flow.recent, flow.step > 3, flow.canGoBack, backTarget == nil, !playingBack else { return }
        flow.moveOntoOrdinaryPath()
        playBack(to: 3)
    }

    /// The back gestures: the finger drives the progress; release completes or cancels with a spring seeded with the
    /// finger's speed (spec 5.1). A gesture always goes back exactly one step.
    private func handlePan(_ event: BackPanEvent) {
        guard flow.canGoBack, !playingBack else { return }
        switch event.phase {
        case .changed:
            if backTarget == nil {
                travel = nil
                backTarget = flow.previous
                panning = true
            }
            guard panning else { return }
            flow.backProgress = event.progress
        case .ended, .cancelled:
            guard panning, let target = backTarget else { return }
            panning = false
            let complete = event.phase == .ended && BackTransition.completes(progress: event.progress, velocity: event.velocity)
            let remaining = max(0.05, complete ? 1 - event.progress : event.progress)
            let spring = Tokens.Spring.snap.animation(initialVelocity: abs(event.velocity) / (event.windowWidth * remaining))
            withAnimation(spring) {
                flow.backProgress = complete ? 1 : 0
            } completion: {
                settledByBack = true
                if complete {
                    flow.back(to: target)
                    arrivedForward = false
                } else {
                    flow.backProgress = nil
                }
                backTarget = nil
            }
        }
    }

    /// Start round: the Back pill and the switch fade, the empty paper unrolls over 360 ms from its own onAppear (at
    /// once with reduced motion), then the round replaces the start flow.
    private func startRound() {
        guard let ready = flow.readyRoute, flow.beginUnroll() else { return }
        if reducedMotion {
            model.startRound(route: ready.route, mode: ready.mode)
            return
        }
        unrollScale = 0
        unrollRoute = ready.route
        unrollMode = ready.mode
    }
}

/// The theme switch's row: on step 1 it sits 32 lower, beside the logo; a back to step 1 moves it there with
/// BackTransition's switchShift.
private struct SwitchShift: ViewModifier, @preconcurrency Animatable {
    var progress: Double
    let transition: BackTransition?
    let reducedMotion: Bool
    let onStepOne: Bool

    var animatableData: Double {
        get { progress }
        set { progress = newValue }
    }

    func body(content: Content) -> some View {
        let shift = transition.map { $0.frame(at: progress, reducedMotion: reducedMotion).switchShift } ?? (onStepOne ? 1 : 0)
        content.padding(.top, 32 * shift)
    }
}

/// A step's item arriving forward (reference 5.7): from 24 below with opacity over 240 after 110, each next 25 later;
/// with reduced motion an opacity fade over 140 after 90. Items of a step at rest (launch, after a back) show at once.
struct EnteringItem: ViewModifier {
    let index: Int
    let animate: Bool
    let reducedMotion: Bool
    @State private var shown = false

    func body(content: Content) -> some View {
        let visible = shown || !animate
        content
            .opacity(visible ? 1 : 0)
            .offset(y: visible || reducedMotion ? 0 : 24)
            .onAppear {
                guard animate, !shown else { return }
                let delay = reducedMotion ? 0.09 : Tokens.Duration.stepEnterDelay + Double(index) * Tokens.Duration.stepStagger
                withAnimation(Tokens.Curve.ease.animation(reducedMotion ? Tokens.Duration.reducedIn : Tokens.Duration.stepEnter, delay: delay)) {
                    shown = true
                }
            }
    }
}

/// A step's list: native scrolling, announced as a list, its bottom edge fading over 28 points while more lies below,
/// the fade ending over a card (task 5's listCue). After a back it first scrolls the card chosen before into view
/// with task 5's revealDelta and the web's FOCUS_ROOM of 8 (reference 4.4). Where the whole column scrolls (rule 9)
/// the list takes its own height, does not scroll on its own and does not fade.
struct FadingList: View {
    let options: [StepOption]
    let step: Step
    let scrolls: Bool
    @AccessibilityFocusState.Binding var focusedCard: String?
    let revealId: String?
    let motion: (Int) -> BackMotion?
    let entering: (Int) -> EnteringItem
    let onCardFrame: (String, CGRect) -> Void
    @State private var frames: [Int: CGRect] = [:]
    @State private var viewHeight: Double = 0
    @State private var contentBottom: Double = 0
    @State private var position = ScrollPosition(edge: .top)
    @State private var offsetY = 0.0
    @State private var revealed = false

    var body: some View {
        if scrolls {
            scrollingList
        } else {
            cards
                .coordinateSpace(name: "list")
                .padding(.horizontal, -8)
                .accessibilityElement(children: .contain)
        }
    }

    private var cards: some View {
        VStack(spacing: Tokens.Space.s8) {
            ForEach(Array(options.enumerated()), id: \.element.id) { i, option in
                option.card
                    .accessibilityFocused($focusedCard, equals: option.id)
                    .modifier(OptionalMotion(motion: motion(i)))
                    .modifier(entering(i))
                    .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("list")) } action: { frames[i] = $0 }
                    .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("flow")) } action: { onCardFrame(option.id, $0) }
            }
        }
        .padding(EdgeInsets(top: 6, leading: 8, bottom: 24, trailing: 8))
    }

    private var scrollingList: some View {
        let cue = listCue(viewHeight, contentBottom, frames.sorted { $0.key < $1.key }.map { ItemSpan(top: $0.value.minY, bottom: $0.value.maxY) })
        return ScrollView {
            cards
                .onGeometryChange(for: Double.self) { $0.frame(in: .named("list")).maxY } action: { contentBottom = $0 }
        }
        .scrollPosition($position)
        .onScrollGeometryChange(for: Double.self) { $0.contentOffset.y } action: { _, y in offsetY = y }
        .onChange(of: frames) { _, frames in
            // The frames are in the list view's space: their minY is where the card shows now.
            guard !revealed, viewHeight > 0, let id = revealId, let i = options.firstIndex(where: { $0.id == id }), let f = frames[i] else { return }
            revealed = true
            let delta = revealDelta(viewHeight, ItemSpan(top: f.minY, bottom: f.maxY), 8)
            if delta != 0 { position.scrollTo(y: offsetY + delta) }
        }
        .coordinateSpace(name: "list")
        .padding(.horizontal, -8)
        .onGeometryChange(for: Double.self) { $0.size.height } action: { viewHeight = $0 }
        .mask {
            VStack(spacing: 0) {
                Rectangle()
                LinearGradient(colors: [.black, .black.opacity(cue.more ? 0 : 1)], startPoint: .top, endPoint: .bottom)
                    .frame(height: FADE_PX)
                Rectangle().frame(height: cue.lift).opacity(cue.more ? 0 : 1)
            }
        }
        .accessibilityElement(children: .contain)
    }
}

/// A back's motion on a view that moves only while a back runs. The view keeps one identity with or without a motion
/// (a conditional here rebuilt the whole step panel as a back began and ended, which scrolled its list to the top and
/// dropped its items in again, N1); it animates the motion's progress itself.
private struct OptionalMotion: ViewModifier, @preconcurrency Animatable {
    var motion: BackMotion?

    var animatableData: Double {
        get { motion?.progress ?? 0 }
        set { motion?.progress = newValue }
    }

    func body(content: Content) -> some View {
        let effect = motion?.effect ?? (opacity: 1, offsetY: 0)
        content.opacity(effect.opacity).offset(y: effect.offsetY)
    }
}

/// A name on its way from a card into the pass.
struct NameTravel: Equatable {
    let text: String
    let style: TypeStyle
    let from: CGRect
    let to: CGRect
    var progress: Double
}

/// The travelling copy: it starts at the card's name (18 in, 16 down, at the card's type size) and ends on the pass
/// field's value, scaled to the field's size (translate and scale only, as the web does).
struct NameTravelView: View, @preconcurrency Animatable {
    var travel: NameTravel
    @Environment(\.palette) private var palette

    var animatableData: Double {
        get { travel.progress }
        set { travel.progress = newValue }
    }

    var body: some View {
        let p = travel.progress
        let start = CGPoint(x: travel.from.minX + Tokens.Space.s18, y: travel.from.minY + Tokens.Space.s16)
        let end = CGPoint(x: travel.to.minX, y: travel.to.minY + 14)
        let scale = 1 + (Tokens.TypeRole.fieldValue.size / travel.style.size - 1) * p
        Text(travel.text)
            .typeRole(travel.style)
            .foregroundStyle(palette.ink.color)
            .fixedSize()
            .scaleEffect(scale, anchor: .topLeading)
            .offset(x: start.x + (end.x - start.x) * p, y: start.y + (end.y - start.y) * p)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .allowsHitTesting(false)
            .accessibilityHidden(true)
    }
}
