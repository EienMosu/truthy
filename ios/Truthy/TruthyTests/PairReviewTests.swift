import SwiftUI
import Testing
import TruthyEngine
import UIKit
@testable import Truthy

// Task 15, step 52: the review of the web and iOS pairs found these differences that the frame and colour probes do
// not measure. Each test draws the view and reads its pixels, or measures it, against the web's value.

/// A view drawn into memory at a known scale, its pixels read as sRGB bytes, top row first.
struct Bitmap: CustomStringConvertible {
    let width: Int
    let height: Int
    let scale: Double
    let bytes: [UInt8]

    @MainActor
    init(_ view: some View, width: Double, height: Double, scale: Double = 2) {
        let renderer = ImageRenderer(content: view.frame(width: width, height: height))
        renderer.scale = scale
        let image = renderer.cgImage!
        var bytes = [UInt8](repeating: 0, count: image.width * image.height * 4)
        let context = CGContext(data: &bytes, width: image.width, height: image.height, bitsPerComponent: 8, bytesPerRow: image.width * 4,
                                space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
        context.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
        self.width = image.width
        self.height = image.height
        self.scale = scale
        self.bytes = bytes
    }

    /// Drawn on screen, in a window of the test host's scene, where a Canvas clips to its bounds (ImageRenderer does not).
    @MainActor
    init(onScreen view: some View, width: Double, height: Double, scale: Double = 2) {
        let scene = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first!
        let window = UIWindow(windowScene: scene)
        window.frame = CGRect(x: 0, y: 0, width: width, height: height)
        let host = UIHostingController(rootView: view.frame(width: width, height: height))
        // The window's status bar and home indicator insets would move the view down.
        host.safeAreaRegions = []
        window.rootViewController = host
        window.isHidden = false
        host.view.frame = window.bounds
        host.view.layoutIfNeeded()
        let format = UIGraphicsImageRendererFormat()
        format.scale = scale
        let image = UIGraphicsImageRenderer(bounds: window.bounds, format: format).image { _ in
            _ = window.drawHierarchy(in: window.bounds, afterScreenUpdates: true)
        }
        // Take the view out of the scene, so nothing it animates keeps running in other tests' run loops.
        window.isHidden = true
        window.rootViewController = nil
        window.windowScene = nil
        self.init(image: image.cgImage!, scale: scale)
    }

    private init(image: CGImage, scale: Double) {
        var bytes = [UInt8](repeating: 0, count: image.width * image.height * 4)
        let context = CGContext(data: &bytes, width: image.width, height: image.height, bitsPerComponent: 8, bytesPerRow: image.width * 4,
                                space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
        context.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
        self.width = image.width
        self.height = image.height
        self.scale = scale
        self.bytes = bytes
    }

    var description: String { "Bitmap \(width) by \(height)" }

    /// The colour at (x, y) in points, as 0 to 255 per channel.
    func at(_ x: Double, _ y: Double) -> [Int] {
        let i = (Int(y * scale) * width + Int(x * scale)) * 4
        return (0..<4).map { Int(bytes[i + $0]) }
    }

    /// Whether the colour at (x, y) is `rgb` within `tolerance` per channel.
    func shows(_ rgb: [Int], at x: Double, _ y: Double, tolerance: Int = 3) -> Bool {
        zip(at(x, y).prefix(3), rgb).allSatisfy { abs($0 - $1) <= tolerance }
    }
}

@MainActor
@Suite struct PairReviewTests {
    private let red = [255, 0, 0]

    /// A box shadow is never painted inside its box (CSS): a destination card's notches show the sky under them, where
    /// the app showed the shadow there, grey by day and black by night (pairs s1 to s5).
    @Test(arguments: [false, true])
    func aCardsNotchesShowWhatLiesUnderThem(night: Bool) {
        let card = DestinationCard(variant: .place, name: "Cloud", sub: "17 decks", label: "Cloud", action: {})
            .frame(width: 343, height: 104)
            .environment(\.palette, night ? Tokens.night : Tokens.day)
            .environment(\.shadows, night ? Tokens.nightShadows : Tokens.dayShadows)
        let map = Bitmap(ZStack { Color(red: 1, green: 0, blue: 0); card }.frame(width: 383, height: 144), width: 383, height: 144)
        let x = 20 + 343 - Tokens.Size.cardStub
        for (dx, dy) in [(0.0, -2.5), (-3, -2), (3, -2), (0, -5.5)] {
            let bottom = map.shows(red, at: x + dx, 124 + dy)
            let top = map.shows(red, at: x + dx, 20 - dy)
            #expect(bottom, "bottom notch at \(dx), \(dy): \(map.at(x + dx, 124 + dy))")
            #expect(top, "top notch at \(dx), \(-dy): \(map.at(x + dx, 20 - dy))")
        }
    }

    /// The ticket's side notches on the perforation show the sky too (pairs p2, p3, r1).
    @Test func theTicketsSideNotchesShowWhatLiesUnderThem() {
        let paper = VStack(spacing: 0) {
            NotchedPaper(edge: .bottom).fill(Tokens.day.surfaceRaised.color).frame(height: 100)
            NotchedPaper(edge: .top).fill(Tokens.day.surfaceSunk.color).frame(height: 100)
        }
        .tokenShadow(Tokens.dayShadows.ticket, RoundedRectangle(cornerRadius: Tokens.Radius.card))
        .frame(width: 343, height: 200)
        let map = Bitmap(ZStack { Color(red: 1, green: 0, blue: 0); paper }.frame(width: 383, height: 260), width: 383, height: 260)
        // The notches of r16 are centred on the perforation at y 30 + 100, on both edges of the paper (x 20 and 363).
        for (x, dy) in [(22.0, 0.0), (25, -6), (25, 6), (361, 0), (358, -6), (358, 6)] {
            let sky = map.shows(red, at: x, 130 + dy)
            #expect(sky, "notch at \(x), \(dy): \(map.at(x, 130 + dy))")
        }
    }

    /// The amber dot of a deck's progress track sits on the end of the part seen and shows whole at 1 percent, half of
    /// it before the track's start (DestinationCard.tsx, -right-[4px]); the app cut it at the track's edge (pair s3-recent).
    @Test func theProgressDotShowsWholeAtTheStartOfTheTrack() {
        let card = DestinationCard(variant: .deck, name: "CDL", nameStyle: .code, detail: "Cloud Digital Leader", seenPercent: 1,
                                   stubLabel: "Cards", stubValue: "133", label: "CDL", action: {})
        let map = Bitmap(onScreen: card.frame(width: 343, height: 128).padding(20).background(Color.white), width: 383, height: 168)
        // The amber pixels left of the card's text column: the track starts 20 into the card (x 40), the dot's centre
        // 0.56 into it and its radius is 4, so its left edge is at x 36.6.
        var amber: [Double] = []
        for y in stride(from: 20.0, to: 148, by: 0.5) {
            for x in stride(from: 20.0, to: 80, by: 0.5) {
                let pixel = map.at(x, y)
                if pixel[0] > 200 && pixel[2] < 60 { amber.append(x) }
            }
        }
        let left = amber.min() ?? 0
        #expect(!amber.isEmpty && left <= 37.5, "the dot starts at \(left), the track at 40")
    }

    /// The comparison of the score row is flush with the row's trailing edge when it wraps (ScoreBlock.tsx text-right in a
    /// flex item at the end); the app left it at the start of its share, short of the edge (pair streak-r1).
    @Test func aWrappedComparisonEndsAtTheRowsTrailingEdge() {
        let row = ShrinkRow(gap: 16) {
            Color.blue.frame(width: 120, height: 20)
            Text("First round on this route").font(.system(size: 18, weight: .semibold)).multilineTextAlignment(.trailing)
        }
        let map = Bitmap(row.frame(width: 250).padding(10).background(Color.white), width: 270, height: 80)
        // The rightmost inked pixel of the comparison's lines, in points from the left.
        var right = 0.0
        for y in stride(from: 10.0, to: 70, by: 0.5) {
            for x in stride(from: 140.0, to: 270, by: 0.5) where map.at(x, y)[0] < 128 {
                right = max(right, x)
            }
        }
        #expect(right >= 256, "the comparison ends at \(right), the row at 260")
    }

    /// The continue line (ContinueLine.tsx): 4 before the logo's disc, 12 after the chevron, the chevron in ink; the
    /// app had 8 on both sides and a muted chevron (pair s1-returning).
    @Test func theContinueLineHasTheWebsInsetsAndAnInkChevron() throws {
        let index = try DeckStore(bundle: .main).index()
        let route = Route(deckId: "aws-clf-c02", sectionId: "SEC")
        let found = try #require(findRoute(index, route))
        let line = ContinueLine(target: ContinueTarget(route: route, mode: .classic, found: found, lastScore: nil), action: {})
        let map = Bitmap(onScreen: ZStack { Color(red: 1, green: 0, blue: 0); line }.frame(width: 343, height: 60), width: 343, height: 60)
        let paper = [Tokens.day.surfaceRaised.red, Tokens.day.surfaceRaised.green, Tokens.day.surfaceRaised.blue].map { Int(($0 * 255).rounded()) }
        let disc = stride(from: 0.0, to: 40, by: 0.5).first { map.shows(paper, at: $0, 30, tolerance: 6) } ?? -1
        #expect(abs(disc - 4) <= 0.5, "the disc starts at \(disc)")
        // The chevron (M6 3l5 5-5 5 in its 16 box) has its point at x 11 of the box, which ends 12 before the row's end.
        let ink = [Tokens.day.ink.red, Tokens.day.ink.green, Tokens.day.ink.blue].map { Int(($0 * 255).rounded()) }
        let point = stride(from: 343.0, to: 300, by: -0.5).first { map.at($0, 30)[0] < 128 } ?? -1
        #expect(abs(point - 327) <= 1.5, "the chevron's point is at \(point)")
        let darkest = stride(from: 320.0, to: 330, by: 0.5).map { map.at($0, 30) }.min { $0[0] < $1[0] } ?? []
        #expect(zip(darkest.prefix(3), ink).allSatisfy { abs($0 - $1) <= 30 }, "the chevron is \(darkest), ink is \(ink)")
    }

    /// The ticket runs on under the row below it (PlayScreen.tsx SCROLLER_ENDS, ResultView.tsx UNDER_PILL): its scroller
    /// ends 12 plus the row lower, with as much padding, so the ticket shows behind and between the pills. The app
    /// stopped it 12 above the row, a hard edge across the ticket (pairs p2, r1 and timed-r1 on the SE).
    @Test func aStageScrollRunsUnderTheRowBelowIt() {
        let stage = VStack(spacing: 12) {
            ScrollView { Color(red: 0, green: 0, blue: 1).frame(height: 1000) }.scrollsUnderRow(72)
            Color.clear.frame(height: 60)
        }
        let map = Bitmap(onScreen: stage.background(Color.white), width: 100, height: 300)
        // The stage ends at y 228; the gap is 228 to 240 and the row 240 to 300.
        let gap = map.shows([0, 0, 255], at: 50, 234, tolerance: 8)
        let row = map.shows([0, 0, 255], at: 50, 270, tolerance: 8)
        #expect(gap && row, "the gap shows \(map.at(50, 234)), the row \(map.at(50, 270))")
    }

    /// Scrolled to its end, the ticket ends at the stage's foot, above the row: nothing of it is left under the row.
    @Test func aStageScrollEndsAboveTheRow() {
        let stage = VStack(spacing: 12) {
            ScrollView {
                VStack(spacing: 0) { Color(red: 0, green: 0, blue: 1).frame(height: 990); Color(red: 0, green: 1, blue: 0).frame(height: 10) }
            }
            .defaultScrollAnchor(.bottom)
            .scrollsUnderRow(72)
            Color.clear.frame(height: 60)
        }
        let map = Bitmap(onScreen: stage.background(Color.white), width: 100, height: 300)
        let end = map.at(50, 224)
        let under = map.at(50, 270)
        #expect(end[1] > 100 && end[2] < 60, "the ticket's end shows \(end) at the stage's foot")
        #expect(under[0] > 240 && under[1] > 240 && under[2] > 240, "under the row: \(under)")
    }

    /// Step lists keep 12 between their cards (StartFlow.tsx, flex-col gap-(--space-12)); the app had 8.
    @Test func aStepsListKeepsTwelveBetweenItsCards() {
        func height(_ count: Int) -> Double {
            let options = (0..<count).map { i in
                StepOption(id: "\(i)", card: DestinationCard(variant: .place, name: "Cloud", sub: "17 decks", label: "Cloud", action: {}))
            }
            return UIHostingController(rootView: ListHost(options: options)).sizeThatFits(in: CGSize(width: 375, height: 10_000)).height
        }
        let one = height(1)
        let two = height(2)
        #expect(abs((two - one) - (one - 30) - 12) < 0.5, "two cards \(two), one card \(one)")
    }

    /// On the ready step the mode's line sits 14 under the title, where the web's list wrapper puts it (mt-8 and pt-6).
    /// Step 1's list ends 12 above the continue line (StartFlow.tsx: the section's mb-(--size-foot-gap), 76, over the
    /// line's 60 and its 4 from the foot); the app ran the list down to the line's top (pair s1-returning).
    @Test func stepOnesListEndsTwelveAboveTheContinueLine() {
        #expect(StartFlowView.continueLineGap == Tokens.Size.footGap - Tokens.Size.pill - Tokens.Space.s4)
        #expect(StartFlowView.continueLineGap == 12)
    }

    /// A Timed card's stub, while it is a question, carries "← False", "swipe to board" and "True →" as the other
    /// classes' do (PlayScreen.tsx: no hint until the stub is stamped); the app showed "swipe to board" alone
    /// (pair large-*-timed-p2).
    @Test func aTimedQuestionsStubShowsTheSidesHints() async throws {
        let decks = DeckStore(bundle: .main)
        let route = Route(deckId: "aws-clf-c02", sectionId: "SEC")
        let directory = Scratch.directory()
        let round = try RoundCoordinator(request: RoundRequest(route: route, mode: .timed, seed: 7), deck: try await decks.deck("aws-clf-c02"),
                                         found: try #require(findRoute(try decks.index(), route)), progress: emptyProgress(),
                                         store: FileProgressStore(directory: directory), journal: RoundJournal(directory: directory),
                                         wall: FakeClock(1_790_000_000_000), mono: FakeClock(1_000))
        let map = Bitmap(onScreen: PassHost(coordinator: round).frame(width: 398, height: 760, alignment: .top).background(Color.white),
                         width: 398, height: 760)
        let red = [Tokens.day.answerFalse.red, Tokens.day.answerFalse.green, Tokens.day.answerFalse.blue].map { Int(($0 * 255).rounded()) }
        var falseInk = 0
        for y in stride(from: 0.0, to: 760, by: 1) {
            for x in stride(from: 0.0, to: 120, by: 1) where map.shows(red, at: x, y, tolerance: 24) { falseInk += 1 }
        }
        #expect(falseInk > 10, "\(falseInk) pixels of the False colour on the stub's left")
    }

    @Test func theReadyStepsLineSitsFourteenUnderTheTitle() {
        #expect(StartFlowView.readyLineGap == 14)
    }

    /// Step 52 review: the Back pill casts the small elevation (StartFlow.tsx shadow-(--elevation-small), reference
    /// 5.5); the app drew it flat on the sky (pairs s2 to s6 and s3-recent, day and night).
    @Test(arguments: [false, true])
    func theBackPillCastsTheSmallShadow(night: Bool) {
        let pill = BackPill(label: "Back to areas", action: {})
            .environment(\.palette, night ? Tokens.night : Tokens.day)
            .environment(\.shadows, night ? Tokens.nightShadows : Tokens.dayShadows)
        let map = Bitmap(ZStack(alignment: .topLeading) { Color(white: 1); pill.padding(20) }, width: 200, height: 100)
        // The pill is 48 tall from y 20; 2.5 under its foot the shadow's blurred layer (6 down, 12 blur, -6 spread).
        let under = map.at(50, 70.5)
        #expect(under.prefix(3).allSatisfy { $0 <= 243 }, "2.5 under the pill: \(under)")
        #expect(map.shows([255, 255, 255], at: 190, 90), "the background: \(map.at(190, 90))")
    }

    /// Step 52 review: a pill's ends are true semicircles (PillButton.tsx rounded-(--radius-pill) on a 60 pill, the Back
    /// pill's rounded-(--radius-pill-small) on 48); SwiftUI's Capsule() draws continuous (squircle) ends, which leave
    /// the circle by up to 0.55 towards the straight edge. The edge of the upper left quarter lies at the radius from
    /// the end's centre (a circular end measures within 0.2 there, the pixel steps of a 3x drawing).
    @Test func everyPillHasSemicircleEnds() {
        func edges(_ map: Bitmap, centre: (Double, Double), radius: Double, inside: ([Int]) -> Bool) -> [Double] {
            stride(from: 0.0, through: 85, by: 5).map { degrees in
                let angle = degrees * .pi / 180
                let r = stride(from: radius - 6, to: radius + 6, by: 0.05).first { r in
                    !inside(map.at(centre.0 - r * cos(angle), centre.1 - r * sin(angle)))
                } ?? 0
                return r - radius
            }
        }
        let pill = PillButton(title: "Next card", action: {}).frame(width: 300).padding(20)
        let pillMap = Bitmap(ZStack(alignment: .topLeading) { Color(white: 1); pill }, width: 340, height: 100, scale: 3)
        let pillEdges = edges(pillMap, centre: (50, 50), radius: Tokens.Size.pill / 2) { $0[0] < 128 }
        #expect(pillEdges.allSatisfy { abs($0) <= 0.35 }, "the pill's edge off its semicircle: \(pillEdges)")
        let back = BackPill(label: "Back to areas", action: {}).padding(20)
        let backMap = Bitmap(ZStack(alignment: .topLeading) { Color(red: 0, green: 0, blue: 1); back }, width: 200, height: 100, scale: 3)
        let backEdges = edges(backMap, centre: (44, 44), radius: Tokens.Size.pillSmall / 2) { $0[0] > 160 }
        #expect(backEdges.allSatisfy { abs($0) <= 0.35 }, "the Back pill's edge off its semicircle: \(backEdges)")
    }

    /// Step 52 review: the round's 60 pills sit at the top of the 64 action row (PlayScreen.tsx: the row is
    /// h-(--size-actions), the answer row or Next card fills it with absolute inset-0 and the pill is h-(--size-pill));
    /// the app centred them, 2 lower (pairs p2, p3, p4, streak-p2, lives-p2, timed-p2 and timed-up).
    @Test func theRoundsPillsSitAtTheTopOfTheActionRow() async throws {
        let directory = Scratch.directory()
        let model = try AppModel(bundle: .main, directory: directory, defaults: Scratch.defaults(), wall: FakeClock(), mono: FakeClock(),
                                 arguments: LaunchArguments())
        let decks = DeckStore(bundle: .main)
        let route = Route(deckId: "aws-clf-c02", sectionId: "SEC")
        let round = try RoundCoordinator(request: RoundRequest(route: route, mode: .classic, seed: 7), deck: try await decks.deck("aws-clf-c02"),
                                         found: try #require(findRoute(try decks.index(), route)), progress: emptyProgress(),
                                         store: FileProgressStore(directory: directory), journal: RoundJournal(directory: directory),
                                         wall: FakeClock(1_790_000_000_000), mono: FakeClock(1_000))
        let map = Bitmap(onScreen: RoundView(model: model, coordinator: round), width: 402, height: 874)
        // The frame leaves 34 under the row, so the row runs from 776 to 840 and the False pill from 776 to 836.
        let red = [Tokens.day.answerFalse.red, Tokens.day.answerFalse.green, Tokens.day.answerFalse.blue].map { Int(($0 * 255).rounded()) }
        let foot = stride(from: 873.5, to: 700, by: -0.5).first { map.shows(red, at: 60, $0, tolerance: 12) } ?? 0
        #expect(foot >= 834.5 && foot <= 835.5, "the False pill's last row of pixels is at \(foot)")
    }
}

private struct PassHost: View {
    let coordinator: RoundCoordinator
    @AccessibilityFocusState private var focused: Bool

    var body: some View {
        BoardingPassView(coordinator: coordinator, statementFocus: $focused, onAnswer: { _ in false }, onSource: { _ in })
            .fixedSize(horizontal: false, vertical: true)
    }
}

private struct ListHost: View {
    let options: [StepOption]
    @AccessibilityFocusState private var focused: String?

    var body: some View {
        FadingList(options: options, step: 1, scrolls: false, focusedCard: $focused, revealId: nil, motion: { _ in nil },
                    entering: { EnteringItem(index: $0, animate: false, reducedMotion: false) }, onCardFrame: { _, _ in })
            .fixedSize(horizontal: false, vertical: true)
    }
}
