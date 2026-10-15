import CoreGraphics
import Testing
import TruthyEngine
@testable import Truthy

// README "Cross-platform agreements", the start back motion: on a change of stage the pass draws what BackTransition's
// frame holds (plan C task 11 rule 4): the band's and the body's heights morph, the two blocks cross-fade and each
// value kept on both layouts travels as two copies. These are the values FillInPass reads at each frame.
@Suite struct PassMorphTests {
    /// Ready to route (6 to 5) and route to destination (4 to 3, four items: 425 ms, the morph is over by 360).
    private let fromSix = BackTransition(from: 6, to: 5, itemCount: 1)
    private let fromFour = BackTransition(from: 4, to: 3, itemCount: 4)
    /// The deck code as the ready pass's leg (Mono 34) and as the route stage's Deck field (Mono 16), in body points.
    private let leg = CGRect(x: 16, y: 16, width: 66, height: 43)
    private let field = CGRect(x: 16, y: 66, width: 31, height: 20)

    private func near(_ copy: PassMorph.Copy, _ dx: Double, _ dy: Double, _ scale: Double, _ opacity: Double) -> Bool {
        abs(copy.dx - dx) < 1e-9 && abs(copy.dy - dy) < 1e-9 && abs(copy.scale - scale) < 1e-9 && abs(copy.opacity - opacity) < 1e-9
    }

    private func morph(_ back: BackTransition, _ p: Double, reduced: Bool = false) -> PassMorph {
        PassMorph(frame: back.frame(at: p, reducedMotion: reduced))
    }

    @Test func progressZeroIsThePassBeingLeftAtRest() {
        let start = morph(fromSix, 0)
        #expect(start.height(from: FillInPass.bandHeight(.ready), to: FillInPass.bandHeight(.route)) == Tokens.Size.carrier)
        #expect(start.height(from: 120, to: 72) == 120)
        #expect(start.frame.oldBlockOpacity == 1 && start.frame.newBlockOpacity == 0)
        let copies = start.copies(from: leg, to: field, right: false)
        #expect(near(copies.old, 0, 0, 1, 1), "the old copy covers the old value")
        #expect(copies.new.opacity == 0)
    }

    @Test func progressOneIsThePassComingBackAtRest() {
        let end = morph(fromSix, 1)
        #expect(end.height(from: FillInPass.bandHeight(.ready), to: FillInPass.bandHeight(.route)) == Tokens.Size.carrierCompact)
        #expect(end.height(from: 120, to: 72) == 72)
        #expect(end.frame.oldBlockOpacity == 0 && end.frame.newBlockOpacity == 1)
        let copies = end.copies(from: leg, to: field, right: false)
        #expect(copies.old.opacity == 0)
        #expect(near(copies.new, 0, 0, 1, 1), "the new copy covers the new value")
    }

    @Test func theHeightFollowsTheProgressWithoutAJump() {
        // Each hundredth of the progress moves the height by a few points at most, never the whole 48 at once.
        var last = 120.0
        for i in 1...100 {
            let height = morph(fromFour, Double(i) / 100).height(from: 120, to: 72)
            #expect(height <= last && height >= 72, "p \(i)")
            #expect(last - height < 3, "no jump at p \(i)")
            last = height
        }
        #expect(last == 72)
        #expect(morph(fromFour, 0.5).height(from: 120, to: 72) < 120 && morph(fromFour, 0.5).height(from: 120, to: 72) > 72)
    }

    @Test func theTwoCopiesCoverEachOtherAllTheWay() {
        for i in 0...20 {
            let p = Double(i) / 20
            for right in [false, true] {
                let copies = morph(fromSix, p).copies(from: leg, to: field, right: right)
                let oldEdge = (right ? leg.maxX : leg.minX) + copies.old.dx
                let newEdge = (right ? field.maxX : field.minX) + copies.new.dx
                #expect(abs(oldEdge - newEdge) < 1e-9, "p \(p), right \(right)")
                #expect(abs(leg.minY + copies.old.dy - (field.minY + copies.new.dy)) < 1e-9)
                #expect(abs(leg.height * copies.old.scale - field.height * copies.new.scale) < 1e-9)
            }
        }
    }

    @Test func theCopiesCrossFadeOnALinearClock() {
        // passValueTravel.ts: the old copy is gone by 60 percent of the 360, the new one comes in from 40 percent.
        let ms = { (t: Double) in self.fromSix.frame(at: t / 360, reducedMotion: false) }
        #expect(abs(ms(108).oldValueOpacity - 0.5) < 1e-9)
        #expect(ms(216).oldValueOpacity == 0)
        #expect(ms(144).newValueOpacity == 0)
        #expect(abs(ms(252).newValueOpacity - 0.5) < 1e-9)
    }

    @Test func reducedMotionSwitchesTheHeightWhenTheOldStepHasFadedAndCopiesNothing() {
        #expect(morph(fromSix, 99.0 / 230, reduced: true).height(from: 120, to: 72) == 120)
        #expect(morph(fromSix, 101.0 / 230, reduced: true).height(from: 120, to: 72) == 72)
        #expect(!fromSix.frame(at: 0.5, reducedMotion: true).valuesTravel)
    }

    @Test func theValuesKeptOnBothLayoutsTravelAndTheClearedOnesDoNot() {
        // 6 to 5 clears the class: the deck and the section travel from the legs to the fields.
        #expect(FillInPass.travelling(from: .ready, to: .route, kept: [.area, .platform, .deck, .section]) == [.deck, .section])
        // 4 to 3 clears the deck: the area and the platform travel from the pass line to their fields.
        #expect(FillInPass.travelling(from: .route, to: .destination, kept: [.area, .platform]) == [.area, .platform])
        // 6 to 3 (the deck leg) clears the deck: no value is on both layouts and kept.
        #expect(FillInPass.travelling(from: .ready, to: .destination, kept: [.area, .platform]).isEmpty)
    }
}
