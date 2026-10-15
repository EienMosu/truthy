// What the result says in each class (components/play/resultCopy.ts) and recording a round once
// (components/play/ResultView.tsx).

public struct ResultField: Equatable, Sendable {
    public let label: String
    public let value: String

    public init(label: String, value: String) {
        self.label = label
        self.value = value
    }
}

public struct ResultCopy: Sendable {
    public let fields: [ResultField]
    public let scoreLabel: String
    public let unit: String?
    /// How a record reads in the comparison: "9 / 10", "21 cards", "12".
    public let best: @Sendable (Int) -> String
    public let ended: String
    public let endedDetail: String
    /// The completed header's accessible name.
    public let label: String
    public let marks: Int
    /// Streak: the mark (from 0) where the previous best was reached.
    public let ring: Int?

    public init(fields: [ResultField], scoreLabel: String, unit: String?, best: @escaping @Sendable (Int) -> String, ended: String,
                endedDetail: String, label: String, marks: Int, ring: Int?) {
        self.fields = fields
        self.scoreLabel = scoreLabel
        self.unit = unit
        self.best = best
        self.ended = ended
        self.endedDetail = endedDetail
        self.label = label
        self.marks = marks
        self.ring = ring
    }
}

private func cards(_ count: Int) -> String {
    count == 1 ? "1 card" : "\(count) cards"
}

/// "18 correct, 3 wrong: cards 6, 15 and 21." or "18 correct, 0 wrong."
private func tally(_ correct: Int, _ wrong: [Int]) -> String {
    let head = "\(correct) correct, \(wrong.count) wrong"
    return wrong.isEmpty ? "\(head)." : "\(head): \(cardList(wrong))."
}

/// The copy of a finished round. `dealt` is the cards the round dealt, `previousBest` the record before it.
public func resultCopy(_ result: RoundResult, _ modeName: String, _ dealt: Int, _ previousBest: Int?) -> ResultCopy {
    let n = result.total
    let w = result.missed.count
    let c = n - w
    let wrong = result.answers.enumerated().filter { !$0.element.correct }.map { $0.offset + 1 }
    let klass = ResultField(label: "Class", value: modeName)
    let wrongField = ResultField(label: "Wrong", value: pad2(w))
    let seconds = jsNumberString(TIMED.roundMs / 1000)
    switch result.mode {
    case .classic:
        return ResultCopy(
            fields: [klass, ResultField(label: "Cards", value: "\(pad2(n)) / \(pad2(dealt))"), wrongField],
            scoreLabel: "Your score", unit: "of \(dealt)", best: { "\($0) / \(dealt)" }, ended: "Arrived",
            endedDetail: " · \(n) of \(dealt)", label: completedLabel(dealt, result.answers.map(\.correct)), marks: dealt, ring: nil)
    case .streak:
        let ring = previousBest.flatMap { $0 >= 1 && $0 <= result.score ? $0 - 1 : nil }
        return ResultCopy(
            fields: [klass, ResultField(label: "Cards", value: pad2(n)), wrongField],
            scoreLabel: "Correct in a row", unit: nil, best: { "\($0)" }, ended: "Ended", endedDetail: " · \(cards(n))",
            label: "Streak over on card \(n). \(result.score) correct in a row. Card \(n) was wrong.", marks: n, ring: ring)
    case .lives:
        return ResultCopy(
            fields: [klass, ResultField(label: "Correct", value: pad2(c)), wrongField],
            scoreLabel: "Your score", unit: "cards", best: { "\($0) cards" }, ended: "Out of lives", endedDetail: "",
            label: "Out of lives after \(n) cards. \(tally(c, wrong))", marks: n, ring: nil)
    case .timed:
        return ResultCopy(
            fields: [klass, ResultField(label: "Time", value: "\(seconds) s"), ResultField(label: "Answered", value: pad2(n))],
            scoreLabel: "Correct", unit: "of \(n)", best: { "\($0)" }, ended: "Time is up", endedDetail: " · \(cards(n))",
            label: "Time is up. \(cards(n)) answered in \(seconds) seconds. \(tally(c, wrong))", marks: n, ring: nil)
    }
}

/// The result's actions take presses after this many monotonic milliseconds.
public let RESULT_ARRIVES_MS: Double = 1000

/// The rounds already written, with what applyResult said: the web's WeakMap, kept by the caller.
public final class RecordedRounds {
    private var entries: [(round: RoundState, outcome: ApplyOutcome)] = []

    public init() {}

    func outcome(of round: RoundState) -> ApplyOutcome? {
        entries.first { $0.round == round }?.outcome
    }

    func keep(_ round: RoundState, _ outcome: ApplyOutcome) {
        entries.append((round, outcome))
    }
}

/// Records a finished round: card history, the record for its route and class, the last route. The first call for a
/// round writes; later calls return the same outcome without writing again.
public func recordRound(_ round: RoundState, _ store: LocalStore, _ recorded: RecordedRounds) -> ApplyOutcome {
    if let done = recorded.outcome(of: round) { return done }
    let outcome = applyResult(store.load(), summarise(round))
    store.save(outcome.progress)
    recorded.keep(round, outcome)
    return outcome
}
