import SwiftUI

// The app frame (spec 5.6, reference 5.4): top and bottom padding are the larger of the system inset and 52 and 34
// on screens 568 or taller, 8 and 12 on shorter ones (the native group of the tokens); the sides are the 16 gutter
// plus the side inset; the content column is at most 430 wide and centred.

enum FrameLayout {
    static let shortScreen: Double = Tokens.Native.shortScreenBelow

    static func padding(systemInsets: EdgeInsets, screenHeight: Double) -> EdgeInsets {
        let short = screenHeight < shortScreen
        return EdgeInsets(
            top: max(systemInsets.top, short ? Tokens.Native.shortSafeTop : Tokens.Size.safeTop),
            leading: Tokens.Size.gutter + systemInsets.leading,
            bottom: max(systemInsets.bottom, short ? Tokens.Native.shortSafeBottom : Tokens.Size.safeBottom),
            trailing: Tokens.Size.gutter + systemInsets.trailing)
    }

    /// The width of the content column in a window `width` wide.
    static func columnWidth(_ width: Double) -> Double {
        min(width, Tokens.Size.maxWidth)
    }
}

/// Lays its content out in the centred column with the frame's padding, ignoring the system's own safe area.
struct AppFrame<Content: View>: View {
    @ViewBuilder let content: () -> Content

    var body: some View {
        GeometryReader { proxy in
            // The reader ignores the safe area, so its size is already the whole window: the insets are not added again.
            let insets = proxy.safeAreaInsets
            let padding = FrameLayout.padding(systemInsets: insets, screenHeight: proxy.size.height)
            content()
                .frame(maxWidth: FrameLayout.columnWidth(proxy.size.width) - 2 * Tokens.Size.gutter)
                .padding(padding)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .ignoresSafeArea()
    }
}
