#if DEBUG
import SwiftUI
import TruthyEngine

// A screen of every component in both themes, for the visual review and for reviewers (launch argument
// -screen gallery, task 11).
struct GalleryView: View {
    @Environment(\.palette) private var palette

    var body: some View {
        ZStack {
            SkyBackdrop()
            ScrollView {
                VStack(alignment: .leading, spacing: Tokens.Space.s16) {
                    LogoMark()
                    LogoMark(width: 20, variant: .compact)
                    LazyVGrid(columns: Array(repeating: GridItem(.fixed(40)), count: 6)) {
                        ForEach(Icon.allCases, id: \.self) { icon in
                            IconView(icon: icon, size: 24).foregroundStyle(palette.ink.color)
                        }
                    }
                    NotchedPaper(edge: .bottom).fill(palette.surfaceRaised.color).frame(height: 120)
                    DestinationCardShape(stub: Tokens.Size.cardStub).fill(palette.surfaceRaised.color).frame(height: Tokens.Size.cardMin)
                    Perforation(axis: .horizontal)
                    BarcodeView(data: "aws-clf-c02-t1.1-01")
                    StampBorder(color: palette.correct.color).frame(width: 120, height: 44)
                    PillButton(title: "True", fill: .answerTrue, leading: .check) {}
                    PillButton(title: "Next card", trailingArrow: true) {}
                    RoundIconButton(icon: .cross, label: "Leave round") {}
                }
                .padding(Tokens.Size.gutter)
            }
        }
    }
}
#endif
