import SwiftUI

@main
struct TruthyApp: App {
    @State private var model: AppModel?

    init() {
        _model = State(initialValue: try? AppModel(bundle: .main, directory: FileProgressStore.applicationSupport(), defaults: .standard))
    }

    var body: some Scene {
        WindowGroup {
            if let model {
                #if DEBUG
                if model.arguments.screen == .gallery {
                    ThemedRoot(stored: model.storedTheme) { _ in GalleryView() }
                } else {
                    RootView(model: model)
                }
                #else
                RootView(model: model)
                #endif
            } else {
                // The decks are embedded, so this shows only on a corrupt bundle (reference 4.1, P1).
                Color("LaunchSurface").ignoresSafeArea().accessibilityLabel("The decks didn't load")
            }
        }
    }
}
