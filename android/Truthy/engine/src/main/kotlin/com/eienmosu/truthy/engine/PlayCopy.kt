package com.eienmosu.truthy.engine

/**
 * How long after an answer the action ("Next card", or "See results" after a deciding answer) takes presses
 * (monotonic clock, the same with reduced motion).
 */
const val NEXT_ARRIVES_MS: Double = 420.0

/** How long after the leave sheet has closed the live regions keep what they said when it opened. */
const val SPOKEN_RELEASE_MS: Double = 150.0

/** What the live region says after an answer: "Correct. The answer is False." and, past the record, " New best." */
fun verdictText(correct: Boolean, answer: Boolean, newBest: Boolean = false): String =
    "${if (correct) "Correct" else "Not quite"}. The answer is ${if (answer) "True" else "False"}.${if (newBest) " New best." else ""}"

/**
 * What the live region says after the verdict when a wrong answer changes the round: in Three lives "Life lost,
 * 2 left.", "Last life." or "Out of lives.", in Streak "Streak ended at 3.". Empty after a right answer, in
 * Classic and in Timed.
 */
fun roundStatus(round: RoundState): String {
    if (lastAnswer(round)?.correct != false) return ""
    if (round.mode == Mode.STREAK) return "Streak ended at ${scoreOf(Mode.STREAK, round.answers)}."
    if (round.mode != Mode.LIVES) return ""
    val left = livesLeft(round)
    if (left == 0) return "Out of lives."
    return if (left == 1) "Last life." else "Life lost, $left left."
}

/**
 * What the live region says in Timed: "Correct." or "Not quite." during the stamp, "Time is up. This card
 * doesn't count." at time up, nothing on a question.
 */
fun timedStatus(round: RoundState): String {
    if (isDecided(round)) return "Time is up. This card doesn't count."
    if (round.phase != Phase.STAMPED) return ""
    return if (lastAnswer(round)?.correct == true) "Correct." else "Not quite."
}

/**
 * What the Timed card announcer says: "Card 2. <statement>" from the second card on, until time is up, with
 * "Applies to <appliesTo>." before the statement when the card has one. The statement is plain text (code
 * without its backticks). The first card is read through focus.
 */
fun timedCardText(round: RoundState): String {
    val card = currentCard(round)
    if (round.index == 0 || isDecided(round) || card == null) return ""
    val appliesTo = if (card.appliesTo.isNotEmpty()) "Applies to ${card.appliesTo}. " else ""
    return "Card ${round.index + 1}. $appliesTo${plainText(card.text.en.statement)}"
}
