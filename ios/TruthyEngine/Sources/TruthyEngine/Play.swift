// What a round is made of, as far as both the engine and the progress need to know (src/content/play.ts).
// Types and one constant, no behaviour.

/// The class of a round. The raw values are the TypeScript strings, and the record keys use them.
public enum Mode: String, Codable, CaseIterable, Sendable {
    case classic, streak, lives, timed
}

/// play.ts: MODES, in the order the class step lists them.
public let MODES: [Mode] = [.classic, .streak, .lives, .timed]

public struct CardHistory: Codable, Equatable, Sendable {
    public var seen: Int
    public var lastCorrect: Bool
    /// Epoch milliseconds. A value that is not finite counts as 0 when dealing.
    public var lastSeenAt: Double

    public init(seen: Int, lastCorrect: Bool, lastSeenAt: Double) {
        self.seen = seen
        self.lastCorrect = lastCorrect
        self.lastSeenAt = lastSeenAt
    }
}

/// Card history by card id.
public typealias History = [String: CardHistory]

public struct Answered: Codable, Equatable, Sendable {
    public let card: Card
    public let given: Bool
    public let correct: Bool
    /// Epoch milliseconds, from the same clock as Timed's tick and visibility events.
    public let at: Double

    public init(card: Card, given: Bool, correct: Bool, at: Double) {
        self.card = card
        self.given = given
        self.correct = correct
        self.at = at
    }
}

public struct RoundResult: Codable, Equatable, Sendable {
    public let mode: Mode
    public let route: Route
    /// The number the class's record keeps.
    public let score: Int
    /// Cards answered.
    public let total: Int
    public let answers: [Answered]
    /// The answers with `correct == false`, in order.
    public let missed: [Answered]
    public let abandoned: Bool

    public init(mode: Mode, route: Route, score: Int, total: Int, answers: [Answered], missed: [Answered], abandoned: Bool) {
        self.mode = mode
        self.route = route
        self.score = score
        self.total = total
        self.answers = answers
        self.missed = missed
        self.abandoned = abandoned
    }
}
