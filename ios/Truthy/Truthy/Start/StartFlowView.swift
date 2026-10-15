import SwiftUI

// A stand-in until task 12 writes the start flow: the title of step 1, so the app opens on something.
struct StartFlowView: View {
    let model: AppModel
    @Environment(\.palette) private var palette

    var body: some View {
        ZStack {
            SkyBackdrop(lowerCloud: .start)
            Text("Choose an area").typeRole(Tokens.TypeRole.stepTitle).foregroundStyle(palette.ink.color)
        }
    }
}
