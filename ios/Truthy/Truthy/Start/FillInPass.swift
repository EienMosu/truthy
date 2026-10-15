import SwiftUI
import TruthyEngine

// The fill-in pass (FillInPass.tsx, reference 4.5): compact "YOUR PASS" with Area, Platform and Deck on steps 2 and 3;
// the route stage with Deck, Section and Class on steps 4 and 5; the full "BOARDING PASS" on step 6. A filled field
// of an earlier step is a way back ("Change deck, now CLF"); a blank field is three dashes, read "not chosen".
// A back that changes the stage draws what BackTransition's frame holds (FillInPass.tsx:379-460, passValueTravel.ts;
// plan C task 12 does the same): the band takes the new stage's look at once and its height morphs, the old block
// fades out over the new one while the body's height morphs from the old block's to the new one's, and every value
// that is on both layouts and stays chosen travels as two copies on one eased path, the old look and the new,
// cross-fading on a linear clock while the values themselves are hidden. The pass animates the back's progress
// itself, so every frame of a played back or a spring is the frame's.

extension View {
    /// The paper's own text (README deviation 6): the pass, and in tasks 13 and 14 the ticket's band, legs, fields,
    /// stub and stamps, the headers' label rows and the result's fields, grow with Dynamic Type up to `xxLarge`, one
    /// below the largest standard size, and no further: in their fixed columns a larger size breaks words
    /// ("Platfor m") and ends values in an ellipsis. Reading text (titles, cards, statements, explanations, the
    /// sheet) grows to the largest accessibility size.
    func paperTextSize() -> some View {
        dynamicTypeSize(...DynamicTypeSize.xxLarge)
    }
}

struct PassField: Identifiable {
    let id: PassFieldName
    let label: String
    let value: String?
    let mono: Bool
    /// The step the field returns to, nil when it is no way back.
    let backTo: Step?
}

/// A back running over the pass: the step it leaves, the one transition every part of that back reads, and the
/// progress the finger or a played back drives.
struct PassBack: Equatable {
    let from: Step
    let transition: BackTransition
    var progress: Double
    let reducedMotion: Bool

    var frame: BackFrame { transition.frame(at: progress, reducedMotion: reducedMotion) }
    /// Whether this back changes the pass's stage (it does not depend on the progress).
    var changesStage: Bool { transition.frame(at: 0, reducedMotion: reducedMotion).stageChange }
}

/// Where a value sits on one layout of the pass, in the pass body's space, and how it looks there.
struct PassValueSpot: Equatable, Sendable {
    let text: String
    let style: TypeStyle
    let rect: CGRect
}

/// The pass's change of stage at one frame of a back: the heights of the band and the body, and the two copies of a
/// travelling value (passValueTravel.ts: one eased path, the old copy gone by 60 percent, the new one in from 40).
struct PassMorph: Equatable {
    let frame: BackFrame

    /// A height that goes from the old stage's to the new one's with the paper (`morph`, 360 on the ease curve).
    func height(from old: Double, to new: Double) -> Double {
        old + (new - old) * frame.morph
    }

    /// Where a copy is drawn: moved by dx and dy from its own value's place, scaled about its top leading corner (or
    /// top trailing, for a value that keeps to the right), at an opacity.
    struct Copy: Equatable {
        var dx: Double
        var dy: Double
        var scale: Double
        var opacity: Double
    }

    /// The copies of a value at `old` on the layout being left and at `new` on the layout coming back. Their tops
    /// meet, and so do the edges the text keeps to; the scale is the change of text height, so the two copies cover
    /// each other all the way and only their opacities differ.
    func copies(from old: CGRect, to new: CGRect, right: Bool) -> (old: Copy, new: Copy) {
        let e = frame.morph
        let scale = old.height > 0 && new.height > 0 ? new.height / old.height : 1
        let dx = right ? new.maxX - old.maxX : new.minX - old.minX
        let dy = new.minY - old.minY
        return (Copy(dx: dx * e, dy: dy * e, scale: 1 + (scale - 1) * e, opacity: frame.oldValueOpacity),
                Copy(dx: -dx * (1 - e), dy: -dy * (1 - e), scale: 1 / scale + (1 - 1 / scale) * e, opacity: frame.newValueOpacity))
    }
}

/// The pass body: the block on screen and, during a change of stage, the block being left laid over it at the top.
/// The body is as tall as the old block morphed into the new one (`morph`), measured in the same layout pass, so the
/// first frame of a back is already the old stage's height.
struct PassBodyLayout: Layout {
    var morph: Double

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let sizes = subviews.map { $0.sizeThatFits(ProposedViewSize(width: proposal.width, height: nil)) }
        guard let current = sizes.first else { return .zero }
        let width = proposal.width ?? sizes.map(\.width).max() ?? 0
        guard sizes.count > 1 else { return CGSize(width: width, height: current.height) }
        let old = sizes[1].height
        return CGSize(width: width, height: old + (current.height - old) * morph)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        for subview in subviews {
            subview.place(at: bounds.origin, anchor: .topLeading, proposal: ProposedViewSize(width: bounds.width, height: nil))
        }
    }
}

/// The body clips only while its height morphs (at rest a focus ring may reach past it).
private struct MorphClip: Shape {
    let active: Bool

    func path(in rect: CGRect) -> Path {
        Path(active ? rect : rect.insetBy(dx: -1000, dy: -1000))
    }
}

struct FillInPass: View, @preconcurrency Animatable {
    let flow: StartFlowModel
    /// The step whose stage the pass shows (the step on screen, or the step a back that changes the stage returns to).
    var showing: Step?
    /// The back running now: the dashes of the fields it clears and, on a change of stage, the morph. Nil at rest.
    var back: PassBack?
    let onBack: (Step) -> Void
    /// "Change platform, now {title}" on the recent path (the pass line of the route stage).
    var onChangePlatform: () -> Void = {}
    var onFieldFrame: (PassFieldName, CGRect) -> Void = { _, _ in }
    @Environment(\.palette) private var palette
    @Environment(\.shadows) private var shadows
    /// Where each value sits on each layout, in the body's space: the copies of a change of stage start and end there.
    @State private var spots: [SpotKey: PassValueSpot] = [:]

    var animatableData: Double {
        get { back?.progress ?? 0 }
        set { back?.progress = newValue }
    }

    private struct SpotKey: Hashable {
        let stage: Stage
        let field: PassFieldName
    }

    private nonisolated static let bodySpace = "passBody"

    private var step: Step { showing ?? flow.step }
    var stage: Stage { Self.stage(of: step) }
    enum Stage { case destination, route, ready }

    nonisolated static func stage(of step: Step) -> Stage {
        step >= 6 ? .ready : (step >= 4 ? .route : .destination)
    }

    /// The band's height token: 44 for the ready pass, 30 for the compact one (text at large sizes grows it further).
    nonisolated static func bandHeight(_ stage: Stage) -> Double {
        stage == .ready ? Tokens.Size.carrier : Tokens.Size.carrierCompact
    }

    /// The fields whose values a layout shows: the route stage's pass line carries the area and the platform.
    nonisolated static func shows(_ stage: Stage) -> [PassFieldName] {
        switch stage {
        case .destination: [.area, .platform, .deck]
        case .route: [.area, .platform, .deck, .section, .mode]
        case .ready: [.deck, .section, .mode]
        }
    }

    /// The values a change of stage carries across: on both layouts and still chosen after the back (`kept`); a field
    /// the back clears turns back into dashes instead (passValueTravel.ts matches values by field, never by text).
    nonisolated static func travelling(from old: Stage, to new: Stage, kept: Set<PassFieldName>) -> [PassFieldName] {
        PassFieldName.allCases.filter { kept.contains($0) && shows(old).contains($0) && shows(new).contains($0) }
    }

    private func field(_ name: PassFieldName, _ label: String, _ value: String?, mono: Bool = false, on step: Step) -> PassField {
        let fieldStep = stepOf(name.choiceKey, flow.choice)
        let canReturn = value != nil && fieldStep < step && !(name == .section && !flow.hasSections)
        return PassField(id: name, label: label, value: value, mono: mono, backTo: canReturn ? fieldStep : nil)
    }

    private var sectionValue: String? { flow.choice.sectionId.map { $0 == WHOLE_DECK ? "Whole deck" : $0 } }
    private var modeName: String? { flow.choice.mode.map { modeInfo($0).name } }

    func fields(_ stage: Stage, on step: Step) -> [PassField] {
        switch stage {
        case .destination:
            return [field(.area, "Area", flow.area?.title, on: step), field(.platform, "Platform", flow.platform?.title, on: step),
                    field(.deck, "Deck", flow.deck?.code, mono: true, on: step)]
        case .route, .ready:
            return [field(.deck, "Deck", flow.deck?.code, mono: true, on: step), field(.section, "Section", sectionValue, mono: true, on: step),
                    field(.mode, "Class", modeName, on: step)]
        }
    }

    var fields: [PassField] { fields(stage, on: step) }

    /// The stage the running back leaves, when it is not the one shown: the pass morphs from it.
    private var leavingStage: Stage? {
        guard let back, back.changesStage else { return nil }
        let old = Self.stage(of: back.from)
        return old == stage ? nil : old
    }

    /// The fields still chosen once the running back completes (it clears its target step and the later ones).
    private var kept: Set<PassFieldName> {
        let target = back?.transition.to ?? step
        let chosen: [PassFieldName: Bool] = [.area: flow.area != nil, .platform: flow.platform != nil, .deck: flow.deck != nil,
                                             .section: sectionValue != nil, .mode: modeName != nil]
        return Set(PassFieldName.allCases.filter { chosen[$0] == true && stepOf($0.choiceKey, flow.choice) < target })
    }

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: Tokens.Radius.card)
        let frame = back?.frame
        let leaving = leavingStage
        let morph = frame.map { PassMorph(frame: $0) }
        // A value travels only once both of its places are known, so a value is never hidden without its copies.
        let copied: [PassFieldName] = leaving.map { old in
            guard frame?.valuesTravel == true else { return [] }
            return Self.travelling(from: old, to: stage, kept: kept).filter {
                spots[SpotKey(stage: old, field: $0)] != nil && spots[SpotKey(stage: stage, field: $0)] != nil
            }
        } ?? []
        let hidden = Set(copied)
        VStack(spacing: 0) {
            band(minHeight: leaving.flatMap { old in morph?.height(from: Self.bandHeight(old), to: Self.bandHeight(stage)) }
                 ?? Self.bandHeight(stage))
            PassBodyLayout(morph: leaving == nil ? 1 : frame?.morph ?? 1) {
                block(stage, on: step, current: true, hidden: hidden)
                    .opacity(leaving == nil ? 1 : frame?.newBlockOpacity ?? 1)
                if let leaving, let back {
                    block(leaving, on: back.from, current: false, hidden: hidden)
                        .opacity(frame?.oldBlockOpacity ?? 0)
                        .allowsHitTesting(false)
                        .accessibilityHidden(true)
                }
            }
            .clipShape(MorphClip(active: leaving != nil && (frame?.morph ?? 1) < 1))
            .overlay(alignment: .topLeading) {
                if let leaving, let morph {
                    copies(copied, from: leaving, morph: morph)
                }
            }
            .coordinateSpace(name: Self.bodySpace)
        }
        .background(shape.fill(palette.surfaceRaised.color))
        .clipShape(shape)
        .tokenShadow(stage == .ready ? shadows.ticket : shadows.small, shape)
        .paperTextSize()
        .accessibilityElement(children: .contain)
    }

    /// The band of the stage shown: its look changes at once, its height with the paper (FillInPass.tsx: the band's
    /// height transition).
    private func band(minHeight: Double) -> some View {
        HStack(spacing: Tokens.Space.s8) {
            if stage == .ready {
                IconShape(icon: .carrierCloud).fill(palette.onAccent.color).frame(width: 22, height: 16)
                Text("Truthy").typeRole(Tokens.TypeRole.carrierTitle)
                Spacer()
                Text("BOARDING PASS").typeRole(Tokens.TypeRole.carrierLabel)
            } else {
                LogoMark(width: 20, variant: .compact)
                Text("Truthy").typeRole(Tokens.TypeRole.carrierTitleCompact)
                Spacer()
                Text("YOUR PASS").typeRole(Tokens.TypeRole.carrierLabelCompact)
            }
        }
        .foregroundStyle(palette.onAccent.color)
        .padding(.horizontal, Tokens.Space.s16)
        .frame(minHeight: minHeight)
        .background(palette.accent.color)
        .clipped()
        .accessibilityHidden(true)
    }

    /// What the paper holds under its band in one layout. `current` is the block on screen; the block a change of
    /// stage leaves is drawn with its own step, clears nothing and reports no field frames.
    @ViewBuilder private func block(_ stage: Stage, on step: Step, current: Bool, hidden: Set<PassFieldName>) -> some View {
        switch stage {
        case .ready:
            readyBody(hidden: hidden)
        case .route:
            VStack(spacing: 0) {
                passLine(hidden: hidden)
                fieldRow(fields(stage, on: step), stage: stage, current: current, hidden: hidden)
            }
        case .destination:
            fieldRow(fields(stage, on: step), stage: stage, current: current, hidden: hidden)
        }
    }

    /// A pass value: it reports where it sits on its layout (text and look included, so a new value is never drawn
    /// with an old copy's words) and hides while its copies travel.
    private func value(_ text: String, _ style: TypeStyle, _ stage: Stage, _ field: PassFieldName, hidden: Set<PassFieldName>) -> some View {
        Text(text).typeRole(style).lineLimit(1)
            .onGeometryChange(for: PassValueSpot.self) { PassValueSpot(text: text, style: style, rect: $0.frame(in: .named(Self.bodySpace))) } action: {
                spots[SpotKey(stage: stage, field: field)] = $0
            }
            .opacity(hidden.contains(field) ? 0 : 1)
    }

    /// The two copies of each travelling value, over the body, out of the reading order and taking no presses.
    private func copies(_ fields: [PassFieldName], from old: Stage, morph: PassMorph) -> some View {
        ZStack(alignment: .topLeading) {
            ForEach(fields, id: \.self) { field in
                if let a = spots[SpotKey(stage: old, field: field)], let b = spots[SpotKey(stage: stage, field: field)] {
                    // The ready pass's section leg keeps to the right: there the right edges meet.
                    let right = field == .section && (old == .ready || stage == .ready)
                    let pair = morph.copies(from: a.rect, to: b.rect, right: right)
                    copy(a, pair.old, right: right)
                    copy(b, pair.new, right: right)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    private func copy(_ spot: PassValueSpot, _ copy: PassMorph.Copy, right: Bool) -> some View {
        Text(spot.text).typeRole(spot.style).lineLimit(1)
            .foregroundStyle(palette.ink.color)
            .frame(width: spot.rect.width, height: spot.rect.height, alignment: .leading)
            .scaleEffect(copy.scale, anchor: right ? .topTrailing : .topLeading)
            .offset(x: spot.rect.minX + copy.dx, y: spot.rect.minY + copy.dy)
            .opacity(copy.opacity)
    }

    /// The route stage's pass line (FillInPass.tsx): "area · platform", each word a way back. On the recent path the
    /// platform word is the change-platform rewrite (task 11).
    private func passLine(hidden: Set<PassFieldName>) -> some View {
        HStack(spacing: Tokens.Space.s2) {
            if let area = flow.area {
                lineWord(changeLabel(.area, area.title), area.title, .area, hidden: hidden) { onBack(1) }
            }
            Text("·").typeRole(Tokens.TypeRole.passLine).foregroundStyle(palette.rule.color).accessibilityHidden(true)
            if let platform = flow.platform {
                lineWord(changeLabel(.platform, platform.title), platform.title, .platform, hidden: hidden) {
                    flow.recent ? onChangePlatform() : onBack(2)
                }
            }
        }
        .padding(.horizontal, Tokens.Space.s10)
        .padding(.top, Tokens.Space.s8)
        .frame(maxWidth: .infinity, minHeight: Tokens.Size.passLine, alignment: .leading)
    }

    private func lineWord(_ label: String, _ text: String, _ field: PassFieldName, hidden: Set<PassFieldName>,
                          _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            value(text, Tokens.TypeRole.passLine, .route, field, hidden: hidden).foregroundStyle(palette.ink.color)
                .frame(minWidth: Tokens.Size.touchMin, minHeight: Tokens.Size.touchMin).contentShape(Rectangle())
        }
        .buttonStyle(PressTintButtonStyle(shape: RoundedRectangle(cornerRadius: Tokens.Radius.small)))
        .keyboardFocusRing(RoundedRectangle(cornerRadius: Tokens.Radius.small))
        .accessibilityLabel(label)
    }

    private func fieldRow(_ fields: [PassField], stage: Stage, current: Bool, hidden: Set<PassFieldName>) -> some View {
        HStack(alignment: .top, spacing: Tokens.Space.s8) {
            ForEach(fields) { field in
                fieldView(field, stage: stage, current: current, hidden: hidden).frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(.horizontal, Tokens.Space.s16)
        .padding(.vertical, Tokens.Space.s10)
    }

    @ViewBuilder private func fieldView(_ field: PassField, stage: Stage, current: Bool, hidden: Set<PassFieldName>) -> some View {
        let content = VStack(alignment: .leading, spacing: Tokens.Space.s2) {
            Text(field.label).typeRole(Tokens.TypeRole.fieldLabel).foregroundStyle(palette.inkMuted.color)
            if let text = field.value {
                // A field a running back clears turns back into dashes (BackTransition's dashes part).
                let clearing = current && back.map { stepOf(field.id.choiceKey, flow.choice) >= $0.transition.to } ?? false
                let dashes = back?.frame.dashesOpacity ?? 1
                ZStack(alignment: .topLeading) {
                    value(text, field.mono ? Tokens.TypeRole.fieldValue : Tokens.TypeRole.fieldValuePass, stage, field.id, hidden: hidden)
                        .opacity(clearing ? 1 - dashes : 1)
                    if clearing { Text("---").typeRole(Tokens.TypeRole.fieldValue).opacity(dashes).accessibilityHidden(true) }
                }
            } else {
                Text("---").typeRole(Tokens.TypeRole.fieldValue).accessibilityLabel("not chosen")
            }
        }
        .foregroundStyle(palette.ink.color)
        .frame(minHeight: 43, alignment: .topLeading)
        .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("flow")) } action: { if current { onFieldFrame(field.id, $0) } }
        if let step = field.backTo, let text = field.value {
            Button { onBack(step) } label: { content.contentShape(Rectangle()) }
                .buttonStyle(PressTintButtonStyle(shape: RoundedRectangle(cornerRadius: Tokens.Radius.small)))
                .keyboardFocusRing(RoundedRectangle(cornerRadius: Tokens.Radius.small))
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(changeLabel(field.id, text))
                .accessibilityAddTraits(.isButton)
        } else {
            content.accessibilityElement(children: .combine)
        }
    }

    private func readyBody(hidden: Set<PassFieldName>) -> some View {
        let section = flow.deck?.sections.first { $0.id == flow.choice.sectionId }
        let cards = section?.cardCount ?? flow.deck?.cardCount ?? 0
        return VStack(spacing: 0) {
            HStack {
                legButton(.deck, code: flow.deck?.code ?? "", name: flow.deck?.title ?? "", hidden: hidden)
                Spacer()
                legButton(.section, code: flow.choice.sectionId ?? "", name: section?.title ?? "Whole deck", hidden: hidden)
            }
            .padding(Tokens.Space.s16)
            Perforation(axis: .horizontal)
            HStack(alignment: .top) {
                readyField("Class", modeName ?? "", backTo: 5, name: .mode, hidden: hidden)
                readyField("Cards", "\(cards)", backTo: nil, name: nil, hidden: hidden)
                VStack(alignment: .leading, spacing: Tokens.Space.s2) {
                    Text("Gate").typeRole(Tokens.TypeRole.fieldLabel).foregroundStyle(palette.inkMuted.color)
                    Text("F ← → T").typeRole(Tokens.TypeRole.fieldValue).accessibilityHidden(true)
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("Gate, False left, true right")
            }
            .foregroundStyle(palette.ink.color)
            .padding(Tokens.Space.s16)
        }
    }

    private func legButton(_ name: PassFieldName, code: String, name title: String, hidden: Set<PassFieldName>) -> some View {
        let label = name == .section && code == WHOLE_DECK ? "Whole deck" : code
        let canReturn = !(name == .section && !flow.hasSections)
        return Button { onBack(name == .deck ? 3 : 4) } label: {
            VStack(alignment: .leading, spacing: Tokens.Space.s2) {
                value(code, Tokens.TypeRole.legCode, .ready, name, hidden: hidden)
                Text(title).typeRole(Tokens.TypeRole.legName).foregroundStyle(palette.inkMuted.color)
            }
            .foregroundStyle(palette.ink.color)
            .contentShape(Rectangle())
        }
        .buttonStyle(PressTintButtonStyle(shape: RoundedRectangle(cornerRadius: Tokens.Radius.small)))
        .disabled(!canReturn)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(canReturn ? changeLabel(name, label) : "\(label), \(title)")
    }

    private func readyField(_ label: String, _ text: String, backTo: Step?, name: PassFieldName?, hidden: Set<PassFieldName>) -> some View {
        let content = VStack(alignment: .leading, spacing: Tokens.Space.s2) {
            Text(label).typeRole(Tokens.TypeRole.fieldLabel).foregroundStyle(palette.inkMuted.color)
            if let name {
                value(text, Tokens.TypeRole.fieldValue, .ready, name, hidden: hidden)
            } else {
                Text(text).typeRole(Tokens.TypeRole.fieldValue)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        return Group {
            if let backTo, let name {
                Button { onBack(backTo) } label: { content.contentShape(Rectangle()) }
                    .buttonStyle(PressTintButtonStyle(shape: RoundedRectangle(cornerRadius: Tokens.Radius.small)))
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel(changeLabel(name, text))
            } else {
                content.accessibilityElement(children: .combine)
            }
        }
    }
}

extension PassFieldName {
    var choiceKey: ChoiceKey {
        switch self {
        case .area: .areaId
        case .platform: .platformId
        case .deck: .deckId
        case .section: .sectionId
        case .mode: .mode
        }
    }
}
