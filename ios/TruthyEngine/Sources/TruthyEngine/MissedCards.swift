// The wrong answers of a round, as the result's list shows them (components/MissedCards.tsx).

public struct MissedCard: Equatable, Sendable {
    /// The card's place in the round, from 1.
    public let number: Int
    public let given: Bool
    public let answer: Bool
    /// nil for a card without one.
    public let appliesTo: String?
    public let statement: String
    public let explanation: String
    public let source: CardSource

    public init(number: Int, given: Bool, answer: Bool, appliesTo: String?, statement: String, explanation: String, source: CardSource) {
        self.number = number
        self.given = given
        self.answer = answer
        self.appliesTo = appliesTo
        self.statement = statement
        self.explanation = explanation
        self.source = source
    }
}

public func missedCards(_ answers: [Answered]) -> [MissedCard] {
    answers.enumerated().compactMap { i, answered in
        answered.correct ? nil : MissedCard(
            number: i + 1, given: answered.given, answer: answered.card.answer,
            appliesTo: answered.card.appliesTo.isEmpty ? nil : answered.card.appliesTo,
            statement: answered.card.text.en.statement, explanation: answered.card.text.en.explanation, source: answered.card.source)
    }
}
