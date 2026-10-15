import Foundation
@testable import TruthyEngine

// The fixtures of the web's round tests (tests/engine/round.test.ts, modes.test.ts, timed.test.ts,
// clock-polish.test.ts), as members of a protocol so that the names never clash with other test files.
protocol RoundTesting {}

extension RoundTesting {
    var route: Route { Route(deckId: "aws-clf-c02", sectionId: "CON") }
    var T0: Double { 1_700_000_000_000 } // the web tests' wall-clock origin, in epoch ms

    // c1, c3, c5 and so on are True, c2, c4 and so on False. Decoded from the shipped card shape.
    func card(_ id: String, _ answer: Bool) -> Card {
        let json = """
            {"id":"\(id)","section":"CON","text":{"en":{"statement":"Statement \(id)","explanation":"Explanation \(id)"}},\
            "answer":\(answer),"source":{"title":"AWS documentation","url":"https://docs.aws.amazon.com/"},\
            "difficulty":1,"appliesTo":"","conflictGroups":[]}
            """
        return try! JSONDecoder().decode(Card.self, from: Data(json.utf8))
    }

    func pool(_ n: Int) -> [Card] {
        (0..<n).map { card("c\($0 + 1)", $0 % 2 == 0) }
    }

    func start(_ mode: Mode = .classic, size: Int = 40, seed: Double = 1, history: History = [:], pool given: [Card]? = nil) throws -> RoundState {
        try startRound(StartArgs(mode: mode, route: route, pool: given ?? pool(size), history: history, seed: seed))
    }

    func play(_ state: RoundState, _ events: [RoundEvent]) -> RoundState {
        events.reduce(state) { TruthyEngine.reduce($0, $1) }
    }

    // Answers the card on screen right or wrong (no next).
    func give(_ state: RoundState, _ right: Bool, at: Double = 1000) -> RoundState {
        let truth = currentCard(state)?.answer ?? true
        return play(state, [.answer(value: right ? truth : !truth, at: at)])
    }

    // Answers the card on screen right, then next.
    func answerRight(_ state: RoundState, at: Double = 1000) -> [RoundEvent] {
        [.answer(value: currentCard(state)?.answer ?? true, at: at), .next]
    }

    // Answers `count` cards right, pressing next after each.
    func rightTimes(_ state: RoundState, _ count: Int) -> RoundState {
        var s = state
        for _ in 0..<count { s = play(give(s, true), [.next]) }
        return s
    }

    // Ticks every `step` ms from `from` (exclusive) to `to` (inclusive).
    func ticks(_ from: Double, _ to: Double, step: Double = 100) -> [RoundEvent] {
        var events: [RoundEvent] = []
        var now = from + step
        while now <= to {
            events.append(.tick(now: now))
            now += step
        }
        return events
    }

    func hide(_ at: Double) -> RoundEvent { .visibility(hidden: true, at: at) }
    func show(_ at: Double) -> RoundEvent { .visibility(hidden: false, at: at) }

    // A Timed round of a 40-card pool whose clock the first tick at T0 has started.
    func timed(size: Int = 40, seed: Double = 1) throws -> RoundState {
        play(try start(.timed, size: size, seed: seed), [.tick(now: T0)])
    }

    // The clock one tick before zero, on the first card, nothing answered.
    func nearlyUp() throws -> RoundState {
        play(try timed(), ticks(T0, T0 + 59_900))
    }

    func ids(_ cards: [Card]) -> [String] { cards.map(\.id) }
}
