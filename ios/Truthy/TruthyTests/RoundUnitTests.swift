import SwiftUI
import Testing
import TruthyEngine
@testable import Truthy

// N6: one haptic per crossing of the 90 line, none per move; and the spring a touch catches (spec 5.3).
@Suite struct CrossingCounterTests {
    @Test func theTriggerChangesOncePerCrossing() {
        var counter = CrossingCounter()
        for dx in stride(from: 0.0, through: 95, by: 1) { counter.update(dx: dx) }
        for dx in stride(from: 95.0, through: 50, by: -1) { counter.update(dx: dx) }
        for dx in stride(from: 50.0, through: 95, by: 1) { counter.update(dx: dx) }
        #expect(counter.count == 2)
    }

    @Test func movingBeyondTheLineDoesNotTriggerAgainAndALeftwardDragCountsToo() {
        var counter = CrossingCounter()
        for dx in [0.0, 89, 90, 120, 200, 150, 91] { counter.update(dx: dx) }
        #expect(counter.count == 1)
        counter.release()
        for dx in [0.0, -60, -95] { counter.update(dx: dx) }
        #expect(counter.count == 2)
    }
}

@Suite struct SpringBackTests {
    @Test func theSpringStartsAtTheReleaseOffsetAndSettlesAtRest() {
        let spring = SpringBack(offset: 80, velocity: 0, startedAt: 0)
        #expect(spring.position(atMs: 0) == 80)
        #expect(abs(spring.position(atMs: 2000)) < 0.5)
        #expect(spring.position(atMs: 100) < 80)
    }

    @Test func aFlingCarriesTheCardOnBeforeItTurns() {
        let spring = SpringBack(offset: 60, velocity: 600, startedAt: 0)
        #expect(spring.position(atMs: 16) > 60)
    }
}

// Reference 4.4 and task 6's ticket scroll: the slip scrolls in only when it is not in view.
@Suite struct TicketScrollTargetTests {
    @Test func aSlipInViewAsksForNoScrollAndOneBelowScrollsToItsTop() {
        #expect(TicketScrollTarget.afterAnswer(slip: CGRect(x: 0, y: 300, width: 300, height: 212), offset: 0, viewport: 500, contentHeight: 800) == nil)
        #expect(TicketScrollTarget.afterAnswer(slip: CGRect(x: 0, y: 400, width: 300, height: 300), offset: 0, viewport: 500, contentHeight: 750) == 250)
        #expect(TicketScrollTarget.newCard(statement: CGRect(x: 0, y: 100, width: 300, height: 200), viewport: 400) == 0)
    }
}
