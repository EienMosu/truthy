import SwiftUI
import Testing
import TruthyEngine
@testable import Truthy

// The path data of the icons and the logo, and the frame of every screen (spec 5.6).
@MainActor
@Suite struct SVGPathTests {
    @Test(arguments: Icon.allCases)
    func eachIconStaysInItsViewBox(icon: Icon) {
        let bounds = icon.path.boundingRect
        #expect(!bounds.isEmpty || bounds.width > 0 || bounds.height > 0, "\(icon) draws nothing")
        // Strokes are centred on the path; allow the stroke's half width around the box.
        #expect(icon.viewBox.insetBy(dx: -2, dy: -2).contains(bounds), "\(icon): \(bounds) outside \(icon.viewBox)")
    }

    @Test func readsCompactNumbersAndArcs() {
        let star = SVGPath.parse("M9 1.8l2.1 4.5 4.9.6-3.6 3.4z")
        #expect(abs(star.boundingRect.maxX - 16) < 0.001)
        let ticket = SVGPath.parse(LogoMark.ticket)
        #expect(abs(ticket.boundingRect.width - 44) < 0.01 && abs(ticket.boundingRect.height - 30) < 0.01)
        // The notch at x 44 is cut inward to x 39.5: (43, 15) is outside the ticket, (38, 15) inside.
        #expect(!ticket.contains(CGPoint(x: 43, y: 15)))
        #expect(ticket.contains(CGPoint(x: 38, y: 15)))
    }
}

@Suite struct FrameLayoutTests {
    private let insets = EdgeInsets(top: 59, leading: 0, bottom: 34, trailing: 0)

    @Test func theWebsPaddingIsAMinimumOnTallScreens() {
        let tall = FrameLayout.padding(systemInsets: insets, screenHeight: 932)
        #expect(tall.top == 59 && tall.bottom == 34 && tall.leading == 16 && tall.trailing == 16)
        let noInsets = FrameLayout.padding(systemInsets: EdgeInsets(), screenHeight: 568)
        #expect(noInsets.top == 52 && noInsets.bottom == 34)
    }

    @Test func shortScreensUseEightAndTwelve() {
        let short = FrameLayout.padding(systemInsets: EdgeInsets(), screenHeight: 567)
        #expect(short.top == 8 && short.bottom == 12)
    }

    @Test func theColumnIsAtMost430AndTheSidesAddTheInsets() {
        #expect(FrameLayout.columnWidth(1024) == 430)
        #expect(FrameLayout.columnWidth(375) == 375)
        let landscape = FrameLayout.padding(systemInsets: EdgeInsets(top: 0, leading: 59, bottom: 21, trailing: 59), screenHeight: 430)
        #expect(landscape.leading == 75 && landscape.trailing == 75 && landscape.top == 8)
    }
}

@Suite struct NoHoverTests {
    // Spec 5.7 item 1: no hover state anywhere. The app also runs on iPad (family 1,2), where a pointer gives a Button an
    // automatic hover effect, so each of the three button styles has to switch it off.
    @Test func everyButtonStyleDisablesThePointerHoverEffect() throws {
        let file = URL(filePath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
            .appending(path: "Truthy/Components/ButtonStyles.swift")
        let source = try String(contentsOf: file, encoding: .utf8)
        let styles = source.components(separatedBy: ": ButtonStyle {").count - 1
        let disabled = source.components(separatedBy: ".hoverEffectDisabled()").count - 1
        #expect(styles == 3)
        #expect(disabled == styles)
    }
}
