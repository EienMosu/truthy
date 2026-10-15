package com.eienmosu.truthy.engine

// The flight-path header (components/FlightPath.tsx): the labels first, because the result copy uses them.

/** "card 3", "cards 1 and 2", "cards 1, 2 and 5". The list is never empty where this is called. */
fun cardList(numbers: List<Int>): String {
    if (numbers.size == 1) return "card ${numbers[0]}"
    val head = numbers.dropLast(1).joinToString(", ")
    return "cards $head and ${numbers.last()}"
}

/** The accessible label of a finished round: "Round complete. 10 of 10 cards. 7 correct, 3 wrong: cards 3, 6 and 9." */
fun completedLabel(total: Int, results: List<Boolean>): String {
    val wrong = results.withIndex().filter { !it.value }.map { it.index + 1 }
    val correct = results.size - wrong.size
    val head = "Round complete. ${results.size} of $total cards. $correct correct, ${wrong.size} wrong"
    return if (wrong.isEmpty()) "$head." else "$head: ${cardList(wrong)}."
}
