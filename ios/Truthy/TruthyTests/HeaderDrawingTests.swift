import SwiftUI
import Testing
import TruthyEngine
import UIKit
@testable import Truthy

// Task 15, step 52: the pairs showed the headers' drawing stretched to the header's width and the plane cut at the
// route's start, the Three lives line to fly missing, and each header 2 taller than the web's. The drawing is the web's
// 276 by 34 SVG box (FlightPath.tsx PathFrame): one scale, centred, nothing clipped.

@MainActor
@Suite struct HeaderDrawingTests {
    private func pixels(_ view: some View, width: Double) -> Bitmap {
        Bitmap(onScreen: view.frame(width: width, height: 34).padding(16).background(Color.white), width: width + 32, height: 66)
    }

    private func rgb(_ color: TokenColor) -> [Int] { [color.red, color.green, color.blue].map { Int(($0 * 255).rounded()) } }

    /// The x of every pixel within 10 per channel of `color`, on the row y.
    private func xs(of color: [Int], in map: Bitmap, y: Double, from: Double, to: Double) -> [Double] {
        stride(from: from, to: to, by: 0.5).filter { map.shows(color, at: $0, y, tolerance: 10) }
    }

    @Test func theRouteKeepsOneScaleAndIsCentred() {
        // 338 wide (the 15 Pro Max's header): the box is drawn at scale 1, 31 in from each side; the plane on the first
        // waypoint (x 6, y 24, r 12) spans x 16 + 31 + 6 - 12 to + 12.
        let map = pixels(FlightRoute(total: 10, results: [], current: 0, answered: false), width: 338)
        let plane = xs(of: rgb(Tokens.day.accent), in: map, y: 40, from: 16, to: 120)
        let left = plane.min() ?? 0
        let right = plane.max() ?? 0
        #expect(abs(left - 41) <= 1 && abs(right - 64.5) <= 1, "the plane spans \(left) to \(right), the web's 41 to 65")
    }

    @Test func thePlaneOnTheFirstWaypointShowsWhole() {
        // 276 wide: the box fills the width, so the plane's disc reaches 6 past its left edge (x 16 + 6 - 12).
        let map = pixels(FlightRoute(total: 10, results: [], current: 0, answered: false), width: 276)
        let left = xs(of: rgb(Tokens.day.accent), in: map, y: 40, from: 0, to: 60).min() ?? 99
        #expect(left <= 10.5, "the plane starts at \(left), the web's at 10")
    }

    @Test func threeLivesDrawTheLineStillToFly() {
        // LivesPath.tsx: M238 17H274, dashes 2 on 5 with round caps, beyond the plane's disc (226 to 250).
        let map = pixels(LivesRoute(results: [], answered: false), width: 276)
        let dashes = xs(of: rgb(Tokens.day.ink), in: map, y: 33, from: 267, to: 291)
        #expect(!dashes.isEmpty, "no dash of the line still to fly")
    }

    @Test func threeLivesPutTheAnsweredCardsMarkInThePlanesPlace() {
        // A wrong answer on screen: its square (13, with an x) at x 238 in place of the plane.
        let map = pixels(LivesRoute(results: [true, false], answered: true), width: 276)
        // x 16 + 238 + 4.5, y 16 + 17 - 1: inside the square, clear of its x.
        let wrong = map.shows(rgb(Tokens.day.wrong), at: 258.5, 32, tolerance: 10)
        #expect(wrong, "\(map.at(258.5, 32)) where the wrong square should be")
    }

    @Test func aStreaksAnsweredCardShowsItsMarkInThePlanesPlace() {
        // StreakPath.tsx: a right answer on the first card, its fresh mark (r7, the correct colour) at the route's start.
        let map = pixels(StreakRoute(streak: 1, best: Int?.none, answered: true), width: 276)
        // x 16 + 6 + 4.5, y 16 + 24 - 1: inside the circle, clear of its tick.
        let fresh = map.shows(rgb(Tokens.day.correct), at: 26.5, 39, tolerance: 10)
        #expect(fresh, "\(map.at(26.5, 39)) where the fresh mark should be")
    }

    @Test func timedStartsWithAnInkDotOfRadiusFive() {
        let map = pixels(TimedRoute(t: 0.5), width: 276)
        // x 16 + 6 - 4, y 16 + 24.
        let dot = map.shows(rgb(Tokens.day.ink), at: 18, 40, tolerance: 12)
        #expect(dot, "\(map.at(18, 40)) at 4 left of the start dot's centre")
    }

    /// Step 52 review: the label row wraps as the web's (PathFrame: flex-wrap, justify-between, gap-x 8, each label
    /// whitespace-nowrap): when the two labels do not fit side by side, each stays whole on its own line and the right
    /// one keeps to the right on the second. The app broke each label inside itself ("0 correct ·" over "0 wrong") or
    /// ran the two together (largest text size, pairs p2 to p4, lives-p2 and the result headers).
    @Test func theLabelsWrapWholeOntoTheirOwnLines() {
        let left = Text("Card ") + Text("1").bold() + Text(" of 10")
        let right = Text("0 correct · 0 wrong")
        func width(_ text: Text) -> Double {
            UIHostingController(rootView: text.typeRole(Tokens.TypeRole.routeLabel).fixedSize().environment(\.dynamicTypeSize, .xxLarge))
                .sizeThatFits(in: CGSize(width: 1000, height: 1000)).width
        }
        let (w1, w2) = (width(left), width(right))
        let frame = max(w1, w2) + 30
        #expect(w1 + 8 + w2 > frame, "the labels \(w1) and \(w2) fit \(frame) side by side")
        let header = HeaderFrame(label: "Card 1 of 10.", left: left, right: right) { Color.clear }
            .environment(\.dynamicTypeSize, .accessibility5)
        let map = Bitmap(header.frame(width: frame, height: 120, alignment: .top).background(Color.white), width: frame, height: 120)
        let line = Tokens.TypeRole.routeLabel.points(at: .xxLarge) * Tokens.TypeRole.routeLabel.lineHeight
        func ink(_ y0: Double, _ y1: Double) -> (Double, Double) {
            var xs: [Double] = []
            for y in stride(from: y0, to: y1, by: 0.5) {
                for x in stride(from: 0.0, to: frame, by: 0.5) where map.at(x, y)[0] < 128 { xs.append(x) }
            }
            return (xs.min() ?? -1, xs.max() ?? -1)
        }
        let first = ink(36, 36 + line)
        let second = ink(36 + line, 36 + 2 * line)
        #expect(first.0 <= 2 && first.1 <= w1 + 1, "the first line's ink spans \(first), the left label is \(w1) wide")
        #expect(second.0 >= frame - w2 - 1 && second.1 >= frame - 3, "the second line's ink spans \(second), the right label is \(w2) wide")
    }

    @Test func theHeaderIsAsTallAsTheDrawingAndOneLabelLine() {
        // PathFrame: 34 + 2 + one line of the route label role (11 at 1.27).
        let header = HeaderFrame(label: "Card 1 of 10.", left: Text("Card 1 of 10"), right: Text("0 correct · 0 wrong")) { Color.clear }
        let height = UIHostingController(rootView: header).sizeThatFits(in: CGSize(width: 283, height: 10_000)).height
        let web = 34 + 2 + 11 * 1.27
        #expect(abs(height - web) <= 0.5, "the header is \(height) tall, the web's \(web)")
    }
}
