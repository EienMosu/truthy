package com.eienmosu.truthy.engine

/** One missed card, as the list shows it. */
data class MissedCard(
    /** The card's place in the round, from 1. */
    val number: Int,
    /** What the player answered. */
    val given: Boolean,
    /** The right answer. */
    val answer: Boolean,
    /** The card's appliesTo, when it has one. */
    val appliesTo: String?,
    val statement: String,
    val explanation: String,
    val source: CardSource,
)

/** The wrong answers of a round, in order, with their card numbers. */
fun missedCards(answers: List<Answered>): List<MissedCard> =
    answers.withIndex().filter { !it.value.correct }.map { (index, answered) ->
        MissedCard(
            number = index + 1,
            given = answered.given,
            answer = answered.card.answer,
            appliesTo = if (answered.card.appliesTo.isEmpty()) null else answered.card.appliesTo,
            statement = answered.card.text.en.statement,
            explanation = answered.card.text.en.explanation,
            source = answered.card.source,
        )
    }
