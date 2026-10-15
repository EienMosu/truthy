import SwiftUI

// The calm ground of every screen (SkyBackdrop.tsx, reference 5.1): the four sky colours in one smooth vertical
// gradient at the native stops of the tokens (0, 35, 62 and 100 percent), and two clouds inside the 430 frame. Ignores touches and VoiceOver.

struct SkyBackdrop: View {
    enum LowerCloud { case game, start }
    var lowerCloud: LowerCloud = .game
    @Environment(\.palette) private var palette

    var body: some View {
        ZStack(alignment: .topLeading) {
            LinearGradient(stops: [
                .init(color: palette.sky1.color, location: Tokens.Native.skyStops[0]),
                .init(color: palette.sky2.color, location: Tokens.Native.skyStops[1]),
                .init(color: palette.sky3.color, location: Tokens.Native.skyStops[2]),
                .init(color: palette.sky4.color, location: Tokens.Native.skyStops[3]),
            ], startPoint: .top, endPoint: .bottom)
            GeometryReader { proxy in
                let frame = min(proxy.size.width, Tokens.Size.maxWidth)
                let left = (proxy.size.width - frame) / 2
                IconShape(icon: .skyCloud)
                    .fill(palette.cloud.color.opacity(Tokens.Opacity.cloud))
                    .frame(width: 150, height: 46)
                    .offset(x: left - 30, y: 196)
                IconShape(icon: .skyCloud)
                    .fill(palette.cloud.color.opacity(Tokens.Opacity.cloud))
                    .frame(width: 170, height: 50)
                    .offset(x: left + frame + 40 - 170, y: lowerCloud == .start ? 660 : 620)
            }
        }
        .ignoresSafeArea()
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}
