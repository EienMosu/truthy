import SafariServices
import SwiftUI
import UIKit

// Source links open in the in-app browser (spec 5.6): SFSafariViewController presented from the top view controller,
// in the app's theme (its bar tint is honoured only before iOS 26).

enum SafariPresenter {
    @MainActor static func present(_ url: URL, theme: ResolvedTheme, palette: Palette) {
        guard let scene = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }).first,
              var top = scene.keyWindow?.rootViewController else { return }
        while let presented = top.presentedViewController { top = presented }
        let safari = SFSafariViewController(url: url)
        safari.overrideUserInterfaceStyle = theme == .dark ? .dark : .light
        safari.preferredControlTintColor = UIColor(palette.ink.color)
        safari.preferredBarTintColor = UIColor(palette.surfaceRaised.color)
        top.present(safari, animated: true)
    }
}
