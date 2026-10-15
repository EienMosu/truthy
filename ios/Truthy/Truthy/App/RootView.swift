import SwiftUI

// The root: the theme from the first frame, the two top-level screens swapped in place (no navigation, no modal
// presentation), and the app's life cycle handed to the round (spec 5.2, 5.6).

struct RootView: View {
    @Bindable var model: AppModel
    @Environment(\.colorScheme) private var system

    var body: some View {
        ThemedRoot(stored: model.storedTheme) { _ in
            ZStack {
                if !model.launched {
                    // Until the journal is applied and the start screen is loaded: only the sky, so the Recent card and
                    // the Continue line never pop in after the first frame (smell 5, N10).
                    SkyBackdrop(lowerCloud: .start)
                } else {
                    switch model.screen {
                    case .start:
                        StartFlowView(model: model)
                            .transition(.identity)
                    case .round(let request):
                        RoundScreen(model: model, request: request)
                            .id(request.id)
                            .transition(.identity)
                    }
                }
            }
        }
        .onAppear { model.systemDark = system == .dark }
        .onChange(of: system) { _, value in model.systemDark = value == .dark }
        .task { await model.launch() }
    }
}
