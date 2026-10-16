import SwiftUI
import TruthyEngine

// "Leave round?" (spec 5.4): the platform sheet for behaviour, the web's floating card for looks. The sheet is
// transparent and has no grabber; its detent is the card's measured height plus the bottom inset, and .large when
// that is taller than the screen (the card then scrolls). Swiping down and tapping outside call onDismiss, which a
// flag tells from Leave round. On iOS 18 the card keeps the 16 gutter; on iOS 26 and later the inset sheet is
// itself the card's frame (sheet chrome under criterion 2).

enum LeaveSheetLayout {
    /// The detent for a card `height` tall on a screen `screenHeight` tall whose system bottom inset is `bottomInset`.
    /// The card's foot lies the larger of that inset and 34 above the screen's bottom, as the web's spacing; the sheet
    /// already keeps its content above the system inset (the visual review saw the card 34 too high on a phone with a
    /// home indicator), so the detent adds only what of the 34 the system inset leaves. `.large` when card and gap are
    /// taller than the screen (before the screen is measured, the card's own height).
    static func detent(cardHeight: Double, bottomInset: Double, screenHeight: Double) -> PresentationDetent {
        let gap = max(bottomInset, Tokens.Size.safeBottom)
        if screenHeight > 0 && cardHeight + gap > screenHeight { return .large }
        return .height(cardHeight + gap - bottomInset)
    }
}

struct LeaveCard: View {
    let decided: Bool
    /// Before iOS 26 the card draws its paper; on iOS 26 and later the inset sheet is the paper (SheetPaper).
    var drawsPaper = true
    let onKeepPlaying: () -> Void
    let onLeave: () -> Void
    @Environment(\.palette) private var palette
    @Environment(\.accessibilityReduceMotion) private var reducedMotion
    @State private var arrived = false

    static let undecided = "Your answers so far stay in your history. This round won't count toward your best."
    static let decidedText = "This round is over and its score is kept. Leaving skips its result."

    var body: some View {
        // LeaveDialog.tsx: the title in the step-title role, the text 8 under it, the two buttons 20 under that and 4 apart.
        VStack(alignment: .leading, spacing: 0) {
            Text("Leave round?").typeRole(Tokens.TypeRole.stepTitle).accessibilityAddTraits(.isHeader)
            Text(decided ? Self.decidedText : Self.undecided).typeRole(Tokens.TypeRole.body).fixedSize(horizontal: false, vertical: true)
                .padding(.top, Tokens.Space.s8)
            VStack(spacing: Tokens.Space.s4) {
                // Escape keeps playing: a key command of the presented sheet, which needs no focus.
                PillButton(title: "Keep playing", action: onKeepPlaying).keyboardShortcut(.cancelAction)
                QuietButton(title: "Leave round", action: onLeave).frame(maxWidth: .infinity)
            }
            .padding(.top, Tokens.Space.s20)
        }
        .foregroundStyle(palette.ink.color)
        .padding(Tokens.Space.s20)
        .frame(minWidth: Tokens.Native.sheetMinWidth)
        .background(RoundedRectangle(cornerRadius: Tokens.Radius.card).fill(drawsPaper ? palette.surfaceRaised.color : Color.clear))
        // The card's arrival (the web's sheet motion, from the native group of the tokens).
        .offset(y: arrived || reducedMotion ? 0 : Tokens.Native.sheetOffsetY)
        .opacity(arrived ? 1 : 0)
        .onAppear {
            withAnimation(reducedMotion ? .linear(duration: Tokens.Native.sheetReducedDuration)
                          : Tokens.Curve.ease.animation(Tokens.Transition.sheetOpen.duration)) { arrived = true }
        }
        .reviewFrame(ReviewName.sheet)
    }
}

/// Before iOS 26 the sheet is transparent and the card draws its paper inside the 16 gutter; on iOS 26 and later the
/// inset sheet is the paper itself and takes its corner radius, so no glass or clear strip shows around the card.
private struct SheetPaper: ViewModifier {
    @Environment(\.palette) private var palette

    func body(content: Content) -> some View {
        if #available(iOS 26, *) {
            content.presentationBackground(palette.surfaceRaised.color)
        } else {
            content.presentationBackground(.clear)
        }
    }
}

private struct LeaveSheetModifier: ViewModifier {
    @Bindable var coordinator: RoundCoordinator
    let onLeave: () -> Void
    @State private var cardHeight = 300.0
    @State private var screenHeight = 0.0
    @State private var bottomInset = 0.0
    @State private var leaving = false
    @State private var announcedDecision = false

    func body(content: Content) -> some View {
        content
            // Measured on the presenting round, outside the sheet: a reader inside would measure the sheet the detent sizes.
            .onGeometryChange(for: Double.self) { $0.safeAreaInsets.bottom } action: { bottomInset = $0 }
            .onGeometryChange(for: Double.self) { $0.size.height + $0.safeAreaInsets.top + $0.safeAreaInsets.bottom } action: { screenHeight = $0 }
            .sheet(isPresented: Binding(get: { coordinator.sheetOpen }, set: { if !$0 { coordinator.keepPlaying() } }),
                   onDismiss: {
                       if leaving { onLeave() } else { coordinator.keepPlaying() }
                       leaving = false
                   }) {
            ScrollView {
                LeaveCard(decided: coordinator.decided, drawsPaper: !Self.insetSheet, onKeepPlaying: { coordinator.keepPlaying() }, onLeave: {
                    leaving = true
                    coordinator.keepPlaying()
                })
                .onGeometryChange(for: Double.self) { $0.size.height } action: { cardHeight = $0 }
                .padding(.horizontal, sheetGutter)
            }
            .scrollBounceBehavior(.basedOnSize)
            .presentationDetents([LeaveSheetLayout.detent(cardHeight: cardHeight, bottomInset: bottomInset, screenHeight: screenHeight)])
            .presentationDragIndicator(.hidden)
            .modifier(SheetPaper())
            .onChange(of: coordinator.decided) { _, decided in
                if decided && !coordinator.decidedWhenSheetOpened && !announcedDecision {
                    announcedDecision = true
                    AccessibilityNotification.Announcement(LeaveCard.decidedText).post()
                }
            }
        }
    }

    private static var insetSheet: Bool {
        if #available(iOS 26, *) { return true }
        return false
    }

    private var sheetGutter: Double {
        Self.insetSheet ? 0 : Tokens.Size.gutter
    }
}

extension View {
    func leaveSheet(coordinator: RoundCoordinator, onLeave: @escaping () -> Void) -> some View {
        modifier(LeaveSheetModifier(coordinator: coordinator, onLeave: onLeave))
    }
}
