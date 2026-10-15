import Testing
@testable import TruthyEngine

// tests/components/start/listCue.test.tsx, the pure functions.
private func items(_ spans: [(Double, Double)]) -> [ItemSpan] { spans.map { ItemSpan(top: $0.0, bottom: $0.1) } }

@Suite struct ListCueTests {
    @Test func theFadeEndsOverACardWhereverTheFoldFalls() {
        let cards = items([(0, 100), (110, 210), (220, 320)])
        #expect(FADE_PX == 28)
        #expect(listCue(400, 320, cards) == ListCue(more: false, lift: 0))
        #expect(listCue(319, 320, cards) == ListCue(more: false, lift: 0))
        #expect(listCue(250, 320, cards) == ListCue(more: true, lift: 0))          // the fold cuts 30 of the third card
        #expect(listCue(215, 320, cards) == ListCue(more: true, lift: 5))          // in the gap: at the bottom of the card above
        #expect(listCue(234, 320, cards) == ListCue(more: true, lift: 24 * 0.5))   // 14 of 28 shown: halfway
        #expect(listCue(50, 320, cards) == ListCue(more: true, lift: 0))
        #expect(listCue(250, 320, []) == ListCue(more: true, lift: 0))
    }

    @Test func aCardScrollsIntoViewWithRoomForTheFade() {
        #expect(revealDelta(300, ItemSpan(top: 100, bottom: 200), 4) == 0)
        #expect(revealDelta(300, ItemSpan(top: -20, bottom: 80), 4) == -24)
        #expect(revealDelta(300, ItemSpan(top: 250, bottom: 350), 4) == 82)
        #expect(revealDelta(300, ItemSpan(top: 50, bottom: 450), 4) == 46)
    }
}
