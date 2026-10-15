package com.eienmosu.truthy.engine

/** One field of the pass: its label and value. */
data class LabelledValue(val label: String, val value: String)

/**
 * What the result screen says in a class: the three fields of the pass, the label and unit of the score, how a
 * record reads, the header's label row and its accessible name, and the marks on the completed route.
 */
class ResultCopy(
    val fields: List<LabelledValue>,
    val scoreLabel: String,
    /** Null where the score has no unit (Streak). */
    val unit: String?,
    /** How a record reads in the comparison: "9 / 10", "21 cards", "12". */
    val best: (Int) -> String,
    /** The bold word of the header's label row: "Arrived", "Ended", "Out of lives", "Time is up". */
    val ended: String,
    /** What follows it: " · 10 of 10", " · 14 cards", "". */
    val endedDetail: String,
    /** The header's accessible name. */
    val label: String,
    /** Marks on the completed route. */
    val marks: Int,
    /** Streak: the card (from 0) where the previous best was reached. */
    val ring: Int?,
)

private fun cards(count: Int): String = if (count == 1) "1 card" else "$count cards"

// "18 correct, 3 wrong: cards 6, 15 and 21." and, when nothing is wrong, "18 correct, 0 wrong."
private fun tally(correct: Int, wrong: List<Int>): String {
    val head = "$correct correct, ${wrong.size} wrong"
    return if (wrong.isEmpty()) "$head." else "$head: ${cardList(wrong)}."
}

/**
 * The copy of a finished round. `dealt` is the cards the round dealt (Classic counts "of 10" by it),
 * `previousBest` the record before the round (null: none), `modeName` the class name on the ticket.
 */
fun resultCopy(result: RoundResult, modeName: String, dealt: Int, previousBest: Int?): ResultCopy {
    val n = result.total
    val w = result.missed.size
    val c = n - w
    val wrong = result.answers.withIndex().filter { !it.value.correct }.map { it.index + 1 }
    val klass = LabelledValue("Class", modeName)
    val wrongField = LabelledValue("Wrong", pad2(w))
    return when (result.mode) {
        Mode.CLASSIC -> ResultCopy(
            fields = listOf(klass, LabelledValue("Cards", "${pad2(n)} / ${pad2(dealt)}"), wrongField),
            scoreLabel = "Your score",
            unit = "of $dealt",
            best = { record -> "$record / $dealt" },
            ended = "Arrived",
            endedDetail = " · $n of $dealt",
            label = completedLabel(dealt, result.answers.map { it.correct }),
            marks = dealt,
            ring = null,
        )
        Mode.STREAK -> ResultCopy(
            fields = listOf(klass, LabelledValue("Cards", pad2(n)), wrongField),
            scoreLabel = "Correct in a row",
            unit = null,
            best = { record -> "$record" },
            ended = "Ended",
            endedDetail = " · ${cards(n)}",
            label = "Streak over on card $n. ${result.score} correct in a row. Card $n was wrong.",
            marks = n,
            ring = if (previousBest != null && previousBest >= 1 && previousBest <= result.score) previousBest - 1 else null,
        )
        Mode.LIVES -> ResultCopy(
            fields = listOf(klass, LabelledValue("Correct", pad2(c)), wrongField),
            scoreLabel = "Your score",
            unit = "cards",
            best = { record -> "$record cards" },
            ended = "Out of lives",
            endedDetail = "",
            label = "Out of lives after $n cards. ${tally(c, wrong)}",
            marks = n,
            ring = null,
        )
        Mode.TIMED -> ResultCopy(
            fields = listOf(klass, LabelledValue("Time", "$TIMED_SECONDS s"), LabelledValue("Answered", pad2(n))),
            scoreLabel = "Correct",
            unit = "of $n",
            best = { record -> "$record" },
            ended = "Time is up",
            endedDetail = " · ${cards(n)}",
            label = "Time is up. ${cards(n)} answered in $TIMED_SECONDS seconds. ${tally(c, wrong)}",
            marks = n,
            ring = null,
        )
    }
}
