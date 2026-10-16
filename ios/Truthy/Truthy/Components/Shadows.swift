import SwiftUI

// The web's box shadows with negative spread (reference 5.5), emulated: each layer is the shape inset by the spread,
// offset and blurred. CSS blur is twice the standard deviation; SwiftUI's blur radius is about one. As in CSS, an outer
// box shadow is never painted inside its own box: where the paper leaves its box open (a notch cut into a card or a
// ticket), what lies under the box shows there, not the shadow.

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
            .mask { OutsideOf(shape: shape).fill(style: FillStyle(eoFill: true)) }
            .allowsHitTesting(false)
            .accessibilityHidden(true)
        }
    }
}

/// Everything around `shape` out to `reach` on every side: the region a box shadow may paint.
struct OutsideOf<S: Shape>: Shape {
    let shape: S
    var reach = 200.0

    func path(in rect: CGRect) -> Path {
        var path = Path(rect.insetBy(dx: -reach, dy: -reach))
        path.addPath(shape.path(in: rect))
        return path
    }
}

extension View {
    func tokenShadow<S: Shape>(_ layers: [ShadowLayer], _ shape: S) -> some View {
        modifier(TokenShadow(layers: layers, shape: shape))
    }
}
