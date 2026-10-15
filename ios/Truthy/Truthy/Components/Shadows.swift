import SwiftUI

// The web's box shadows with negative spread (reference 5.5), emulated: each layer is the shape inset by the spread,
// offset and blurred. CSS blur is twice the standard deviation; SwiftUI's blur radius is about one.

struct TokenShadow<S: Shape>: ViewModifier {
    let layers: [ShadowLayer]
    let shape: S

    func body(content: Content) -> some View {
        content.background {
            ZStack {
                ForEach(Array(layers.enumerated()), id: \.offset) { _, layer in
                    shape
                        .fill(layer.color.color)
                        .padding(-layer.spread)
                        .offset(x: layer.x, y: layer.y)
                        .blur(radius: layer.blur / 2)
                }
            }
            .allowsHitTesting(false)
            .accessibilityHidden(true)
        }
    }
}

extension View {
    func tokenShadow<S: Shape>(_ layers: [ShadowLayer], _ shape: S) -> some View {
        modifier(TokenShadow(layers: layers, shape: shape))
    }
}
