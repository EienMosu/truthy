package com.eienmosu.truthy.round

import com.eienmosu.truthy.engine.Answered
import com.eienmosu.truthy.engine.Card
import com.eienmosu.truthy.engine.Mode
import com.eienmosu.truthy.engine.Phase
import com.eienmosu.truthy.engine.RoundState
import com.eienmosu.truthy.engine.TicketInfo
import com.eienmosu.truthy.engine.currentCard
import com.eienmosu.truthy.engine.isDecided
import com.eienmosu.truthy.engine.lastAnswer
import com.eienmosu.truthy.engine.pad2
import com.eienmosu.truthy.engine.roundStatus
import com.eienmosu.truthy.engine.scoreOf
import com.eienmosu.truthy.engine.timedCardText
import com.eienmosu.truthy.engine.timedStatus
import com.eienmosu.truthy.engine.verdictText

/** Which way the torn stub falls (left after a right answer) or a Timed card leaves (towards the side answered). */
enum class TearSide { LEFT, RIGHT }

/** What the stub of a Timed card is stamped with. */
enum class StubMark { CORRECT, WRONG, TIME_UP }

/** What the two live regions say: the status, and in Timed the card announcer. */
data class Spoken(val status: String, val card: String)

/** Everything the round screen derives from the round, as RoundView in components/play/PlayScreen.tsx does. */
data class RoundView(
    val card: Card?,
    val takesAnswers: Boolean,
    val answered: Boolean,
    val timed: Boolean,
    val decided: Boolean,
    val timeUp: Boolean,
    val beat: Boolean,
    val awaitsNext: Boolean,
    val actionLabel: String,
    val streak: Int,
    val newBest: Boolean,
    val slip: Answered?,
    val cardNumber: String,
    val cardField: String,
    val routeLine: String,
    val heading: String,
    val showStub: Boolean,
    val stubMark: StubMark?,
    val stubHint: String?,
    val tear: TearSide,
    val leaveSide: TearSide,
    val results: List<Boolean>,
    val correctCount: Int,
    val wrongCount: Int,
    val spoken: Spoken,
)

fun roundView(round: RoundState, ticket: TicketInfo): RoundView {
    val answered = round.phase == Phase.ANSWERED
    val last = if (answered) lastAnswer(round) else null
    val timed = round.mode == Mode.TIMED
    val decided = isDecided(round)
    val timeUp = timed && decided
    val beat = timed && round.phase == Phase.STAMPED && !decided
    val stamped = if (beat) lastAnswer(round) else null
    val streak = if (round.mode == Mode.STREAK) scoreOf(Mode.STREAK, round.answers) else 0
    val best = ticket.best
    val newBest = last?.correct == true && best != null && best >= 1 && streak == best + 1
    val cardNumber = pad2(round.index + 1)
    val results = round.answers.map { it.correct }
    val correct = results.count { it }
    val status = when {
        timed -> timedStatus(round)
        last != null -> listOf(verdictText(last.correct, last.card.answer, newBest), roundStatus(round))
            .filter { it.isNotEmpty() }
            .joinToString(" ")
        else -> ""
    }
    return RoundView(
        card = currentCard(round),
        takesAnswers = round.phase == Phase.QUESTION,
        answered = answered,
        timed = timed,
        decided = decided,
        timeUp = timeUp,
        beat = beat,
        awaitsNext = answered || timeUp,
        actionLabel = if (decided) "See results" else "Next card",
        streak = streak,
        newBest = newBest,
        slip = last,
        cardNumber = cardNumber,
        cardField = if (round.mode == Mode.CLASSIC) "$cardNumber / ${pad2(round.cards.size)}" else cardNumber,
        routeLine = "${ticket.deckCode} → ${ticket.sectionCode} · ${ticket.modeLabel}",
        heading = "${ticket.deckName}, ${ticket.sectionName}: ${ticket.modeLabel} round",
        showStub = round.phase == Phase.QUESTION || timed,
        stubMark = when {
            timeUp -> StubMark.TIME_UP
            stamped == null -> null
            stamped.correct -> StubMark.CORRECT
            else -> StubMark.WRONG
        },
        stubHint = when {
            timeUp -> "This card doesn't count · ${round.answers.size} answered"
            stamped == null -> null
            stamped.correct -> "Next card coming up"
            else -> "Wrong, saved for review at the end"
        },
        tear = if (last?.correct == false) TearSide.RIGHT else TearSide.LEFT,
        leaveSide = if (lastAnswer(round)?.given == true) TearSide.RIGHT else TearSide.LEFT,
        results = results,
        correctCount = correct,
        wrongCount = results.size - correct,
        spoken = Spoken(status, if (timed) timedCardText(round) else ""),
    )
}
