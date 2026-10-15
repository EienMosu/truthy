package com.eienmosu.truthy.round

import com.eienmosu.truthy.engine.Card
import com.eienmosu.truthy.engine.CardSource
import com.eienmosu.truthy.engine.CardText
import com.eienmosu.truthy.engine.CardTextEn
import com.eienmosu.truthy.engine.Mode
import com.eienmosu.truthy.engine.Route
import com.eienmosu.truthy.engine.RoundEvent
import com.eienmosu.truthy.engine.RoundState
import com.eienmosu.truthy.engine.StartArgs
import com.eienmosu.truthy.engine.TicketInfo
import com.eienmosu.truthy.engine.currentCard
import com.eienmosu.truthy.engine.reduce
import com.eienmosu.truthy.engine.startRound

/** Rounds played through the engine, for the tests of the leave sheet, the back decision and the result. */
object TestRounds {
    val ROUTE = Route(deckId = "test-deck", sectionId = "SEC")

    fun card(n: Int, answer: Boolean = n % 2 == 0, appliesTo: String = ""): Card = Card(
        id = "test-deck-$n",
        section = "SEC",
        text = CardText(en = CardTextEn(statement = "Statement $n", explanation = "Explanation $n")),
        answer = answer,
        source = CardSource(title = "Source $n", url = "https://example.com/source-$n"),
        difficulty = 1,
        appliesTo = appliesTo,
        conflictGroups = emptyList(),
    )

    fun start(mode: Mode, size: Int = 10): RoundState =
        startRound(StartArgs(mode = mode, route = ROUTE, pool = (1..size).map { card(it) }, history = emptyMap(), seed = 1.0))

    /** Answers `answers` cards, wrongly at the 0-based places in `wrong`, one second apart; `finish` also sends Next after the last. */
    fun play(start: RoundState, wrong: Set<Int>, answers: Int, finish: Boolean): RoundState {
        var state = start
        for (i in 0 until answers) {
            val card = requireNotNull(currentCard(state)) { "no card for answer $i" }
            state = reduce(state, RoundEvent.Answer(value = if (i in wrong) !card.answer else card.answer, at = 1_000.0 * (i + 1)))
            if (i < answers - 1 || finish) state = reduce(state, RoundEvent.Next)
        }
        return state
    }

    /** A Classic round of 10: wrong at cards 3, 6 and 10 by default (score 7), finished unless `finish` is false. */
    fun classic(wrong: Set<Int> = setOf(2, 5, 9), answers: Int = 10, finish: Boolean = true): RoundState =
        play(start(Mode.CLASSIC), wrong, answers, finish)

    /** A Streak round ended by its second answer (decided), its result not opened yet. */
    fun streakEndedUnopened(): RoundState = play(start(Mode.STREAK), wrong = setOf(1), answers = 2, finish = false)

    /** A Timed round whose minute ran out with nothing answered: decided, no answers. */
    fun timedRunOut(): RoundState {
        var state = reduce(start(Mode.TIMED), RoundEvent.Tick(now = 0.0))
        for (second in 1..60) state = reduce(state, RoundEvent.Tick(now = 1_000.0 * second))
        return state
    }

    fun ticket(best: Int?): TicketInfo = TicketInfo(
        deckCode = "TST",
        deckName = "Test deck",
        sectionCode = "SEC",
        sectionName = "Security",
        modeLabel = "Classic",
        best = best,
    )
}
