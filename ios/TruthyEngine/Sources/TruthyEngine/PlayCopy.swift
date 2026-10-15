// What the play screen says (components/play/PlayScreen.tsx:52-143) and two of its guard times.

/// After an answer, Next card and See results take presses only after this many monotonic milliseconds.
public let NEXT_ARRIVES_MS: Double = 420

/// After the leave sheet closes, the live regions keep what they said for this long.
public let SPOKEN_RELEASE_MS: Double = 150

/// "Correct. The answer is False." and, past the record in Streak, " New best."
public func verdictText(_ correct: Bool, _ answer: Bool, _ newBest: Bool = false) -> String {
    "\(correct ? "Correct" : "Not quite"). The answer is \(answer ? "True" : "False").\(newBest ? " New best." : "")"
}

/// What follows the verdict when a wrong answer changes the round: "Life lost, 2 left.", "Last life.", "Out of lives.",
/// "Streak ended at 3.". Empty after a right answer, in Classic and in Timed.
public func roundStatus(_ round: RoundState) -> String {
    guard let last = lastAnswer(round), !last.correct else { return "" }
    if round.mode == .streak { return "Streak ended at \(scoreOf(.streak, round.answers))." }
    if round.mode != .lives { return "" }
    let left = livesLeft(round)
    if left == 0 { return "Out of lives." }
    return left == 1 ? "Last life." : "Life lost, \(left) left."
}

/// Timed's live region: "Correct." or "Not quite." during the stamp, the end at time up, nothing on a question.
public func timedStatus(_ round: RoundState) -> String {
    if isDecided(round) { return "Time is up. This card doesn't count." }
    if round.phase != .stamped { return "" }
    return lastAnswer(round)?.correct == true ? "Correct." : "Not quite."
}

/// Timed's card announcer from the second card on, until time is up: "Card 2. Applies to X. <statement>".
public func timedCardText(_ round: RoundState) -> String {
    guard let card = currentCard(round), round.index != 0, !isDecided(round) else { return "" }
    let appliesTo = card.appliesTo.isEmpty ? "" : "Applies to \(card.appliesTo). "
    return "Card \(round.index + 1). \(appliesTo)\(plainText(card.text.en.statement))"
}
