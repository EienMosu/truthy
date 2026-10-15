import Foundation
import Observation
import TruthyEngine

// The start flow's state (spec 5.1, reference 4.2): one screen with a step stack, never a navigation push. Forward
// choices push the next step of the path; every way back goes through back(to:), which clears the choices made on
// and after the target only when the back completes (a cancelled gesture changes nothing). The guards of reference
// 4.3 are here: options, Continue and Start round wait 250 ms after a step appears; backs never wait, and every back
// is consumed while the paper unrolls.

@MainActor @Observable
final class StartFlowModel {
    let index: DeckIndex
    private(set) var stack: [Step] = [1]
    private(set) var choice = StartChoice()
    /// The progress of a back that is running (a gesture or a played back motion), nil when none runs.
    var backProgress: Double?
    /// The card that takes focus after a back (reference 4.4): its id, or RECENT.
    private(set) var focusAfterBack: String?
    private(set) var unrolling = false
    private(set) var stepShownAt: Double
    private let clock: any MonotonicClock

    init(index: DeckIndex, clock: any MonotonicClock) {
        self.index = index
        self.clock = clock
        stepShownAt = clock.nowMs()
    }

    var step: Step { stack.last ?? 1 }
    var recent: Bool { choice.via == RECENT }

    var area: IndexArea? { choice.areaId.flatMap { id in index.areas.first { $0.id == id } } }
    var platform: IndexPlatform? { choice.platformId.flatMap { id in area?.platforms.first { $0.id == id } } }
    var deck: IndexDeck? {
        choice.deckId.flatMap { id in index.areas.lazy.flatMap(\.platforms).flatMap(\.decks).first { $0.id == id } }
    }
    var hasSections: Bool { !(deck?.sections.isEmpty ?? true) }

    /// Where Back goes from the step on screen.
    var previous: Step { previousStep(step, hasSections, recent) }

    /// Options, Continue and Start round take presses 250 ms after a step appears.
    var settled: Bool { clock.nowMs() - stepShownAt >= SWIPE.settleMs }

    private var accepting: Bool { settled && !unrolling && backProgress == nil }

    private func push(_ next: Step) {
        stack.append(next)
        stepShownAt = clock.nowMs()
        focusAfterBack = nil
    }

    @discardableResult func chooseArea(_ id: String) -> Bool {
        guard accepting, step == 1 else { return false }
        choice = StartChoice(areaId: id)
        push(2)
        return true
    }

    @discardableResult func chooseRecent() -> Bool {
        guard accepting, step == 1 else { return false }
        choice = StartChoice(via: RECENT)
        push(3)
        return true
    }

    @discardableResult func choosePlatform(_ id: String) -> Bool {
        guard accepting, step == 2 else { return false }
        choice.platformId = id
        push(3)
        return true
    }

    @discardableResult func chooseDeck(_ id: String) -> Bool {
        guard accepting, step == 3 else { return false }
        choice.deckId = id
        afterDeck()
        return true
    }

    /// A deck of the Recent list fills area, platform and deck at once.
    @discardableResult func chooseRecentDeck(_ recentDeck: RecentDeck) -> Bool {
        guard accepting, step == 3, recent else { return false }
        choice.areaId = recentDeck.area.id
        choice.platformId = recentDeck.platform.id
        choice.deckId = recentDeck.deck.id
        afterDeck()
        return true
    }

    private func afterDeck() {
        if hasSections {
            push(4)
        } else {
            choice.sectionId = WHOLE_DECK
            push(5)
        }
    }

    @discardableResult func chooseSection(_ id: String) -> Bool {
        guard accepting, step == 4 else { return false }
        choice.sectionId = id
        push(5)
        return true
    }

    @discardableResult func chooseMode(_ mode: Mode) -> Bool {
        guard accepting, step == 5, isOffered(mode) else { return false }
        choice.mode = mode
        push(6)
        return true
    }

    /// Continue: the whole path to the ready pass is pushed, so Back retraces it.
    @discardableResult func continueTo(_ target: ContinueTarget) -> Bool {
        guard accepting, step == 1 else { return false }
        choice = StartChoice(areaId: target.found.area.id, platformId: target.found.platform.id, deckId: target.found.deck.id,
                             sectionId: target.route.sectionId, mode: target.mode)
        stack = pathTo(6, hasSections)
        stepShownAt = clock.nowMs()
        return true
    }

    /// Whether a back may start now: not on step 1, not while the paper unrolls.
    var canGoBack: Bool { step > 1 && !unrolling }

    /// Completes a back to `target`: clears the choices made on and after it and shows it. Returns false when the
    /// back is consumed (step 1, during the unroll, or a target that is not earlier).
    @discardableResult func back(to target: Step) -> Bool {
        guard canGoBack, target < step else { return false }
        let before = choice
        choice = clearFrom(choice, target)
        if let at = stack.firstIndex(of: target) {
            stack = Array(stack[...at])
        } else {
            stack = pathTo(target, hasSections, recent)
        }
        focusAfterBack = chosenOn(target, before)
        stepShownAt = clock.nowMs()
        backProgress = nil
        return true
    }

    /// Escape: one step back; on step 1 it is consumed and does nothing.
    @discardableResult func escape() -> Bool {
        if step == 1 { return true }
        return back(to: previous)
    }

    /// "Change platform, now {title}" on the recent path (StartFlow.tsx toPlatformDecks): that platform's own deck
    /// step on the ordinary path, [1, 2, 3] with area and platform kept, focus on the deck chosen before.
    @discardableResult func changePlatformOnRecentPath() -> Bool {
        guard canGoBack, recent, let areaId = choice.areaId, let platformId = choice.platformId else { return false }
        let deckId = choice.deckId
        choice = StartChoice(areaId: areaId, platformId: platformId)
        stack = [1, 2, 3]
        focusAfterBack = deckId
        stepShownAt = clock.nowMs()
        backProgress = nil
        return true
    }

    /// Start round: the paper unrolls for 360 ms, during which every back is consumed.
    @discardableResult func beginUnroll() -> Bool {
        guard accepting, step == 6, choice.mode != nil else { return false }
        unrolling = true
        return true
    }

    /// The route and class of the ready pass.
    var readyRoute: (route: Route, mode: Mode)? {
        guard let deckId = choice.deckId, let sectionId = choice.sectionId, let mode = choice.mode else { return nil }
        return (Route(deckId: deckId, sectionId: sectionId), mode)
    }

    #if DEBUG
    /// A debug launch (spec 7.4): opens `target` with the route's choices up to it, as the player would have made them.
    /// A deck without sections has no step 4, so 4 opens 5.
    @discardableResult func openForDebug(route: Route, mode: Mode, step target: Step) -> Bool {
        guard let found = findRoute(index, route), (1...6).contains(target) else { return false }
        let full = StartChoice(areaId: found.area.id, platformId: found.platform.id, deckId: found.deck.id, sectionId: route.sectionId, mode: mode)
        let sections = !found.deck.sections.isEmpty
        let step = !sections && target == 4 ? 5 : target
        choice = clearFrom(full, step)
        stack = pathTo(step, sections)
        stepShownAt = clock.nowMs()
        return true
    }
    #endif
}
