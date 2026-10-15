package com.eienmosu.truthy.round

import com.eienmosu.truthy.engine.pad2

// Every string of the leave sheet and the result screen, verbatim from reference 4.5: the web's LeaveDialog.tsx,
// ResultView.tsx, ScoreBlock.tsx and MissedCards.tsx, and the native source link label of spec 5.6.

object LeaveText {
    const val TITLE = "Leave round?"
    const val OPEN_BODY = "Your answers so far stay in your history. This round won't count toward your best."
    const val DECIDED_BODY = "This round is over and its score is kept. Leaving skips its result."
    const val KEEP_PLAYING = "Keep playing"
    const val LEAVE_ROUND = "Leave round"

    /** Before the round is decided its answers are kept without a record; once decided, leaving records its score. */
    fun body(decided: Boolean): String = if (decided) DECIDED_BODY else OPEN_BODY
}

object ResultText {
    const val CLOSE_RESULTS = "Close results"
    const val HEADING = "Round complete"
    const val PLAY_AGAIN = "Play again"
    const val CHOOSE_ANOTHER_ROUTE = "Choose another route"
    const val FIRST_ROUND = "First round on this route"
    const val NEW_BEST = "New best"
    const val EQUALS_BEST = "Equals your best"
    const val MISSED_CARDS = "Missed cards"
    const val NO_MISSED_CARDS = "No missed cards"
    const val WHY = "Why"
    const val ANSWER = "Answer"

    fun previousBest(best: String): String = "Previous best $best"
    fun best(best: String): String = "Best $best"
    fun shortOfBest(by: Int): String = "$by short of your best"
    fun toReview(count: Int): String = "$count to review"
    fun cardCaption(number: Int): String = "Card ${pad2(number)}"
    fun youSaid(given: Boolean): String = "You said ${word(given)}"
    fun whyLabel(number: Int): String = "Why, card ${pad2(number)}"
    fun appliesTo(text: String): String = "Applies to $text"
    fun sourceLabel(title: String): String = "$title (opens in browser)"
    fun tally(correct: Int, wrong: Int): String = "$correct correct · $wrong wrong"
    fun word(value: Boolean): String = if (value) "True" else "False"
}
