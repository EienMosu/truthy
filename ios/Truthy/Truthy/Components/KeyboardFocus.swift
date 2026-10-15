import GameController
import SwiftUI

// Focus rings only for hardware keyboard focus, never after a touch (spec 5.6, 5.7 smell 10). The system focus
// effect is off everywhere; a control focused while a hardware keyboard is connected draws the web's ink ring, 2
// points wide, 2 outside the shape. The modifier goes on a Button, which is focusable already: it only reads the
// button's focus, so each control stays one focus stop.

enum HardwareKeyboard {
    @MainActor static var isConnected: Bool { GCKeyboard.coalesced != nil }
}

struct KeyboardFocusRing<S: Shape>: ViewModifier {
    let shape: S
    @FocusState private var focused: Bool
    @Environment(\.palette) private var palette

    func body(content: Content) -> some View {
        content
            .focused($focused)
            .focusEffectDisabled()
            .overlay {
                if focused && HardwareKeyboard.isConnected {
                    shape.stroke(palette.ink.color, lineWidth: 2).padding(-2).allowsHitTesting(false)
                }
            }
    }
}

extension View {
    func keyboardFocusRing<S: Shape>(_ shape: S) -> some View {
        modifier(KeyboardFocusRing(shape: shape))
    }
}
