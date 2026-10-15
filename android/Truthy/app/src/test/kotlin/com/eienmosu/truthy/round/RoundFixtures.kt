package com.eienmosu.truthy.round

import com.eienmosu.truthy.engine.Card
import com.eienmosu.truthy.engine.Mode
import com.eienmosu.truthy.engine.Route
import com.eienmosu.truthy.engine.RoundEvent
import com.eienmosu.truthy.engine.RoundState
import com.eienmosu.truthy.engine.StartArgs
import com.eienmosu.truthy.engine.TicketInfo
import com.eienmosu.truthy.engine.currentCard
import com.eienmosu.truthy.engine.modeInfo
import com.eienmosu.truthy.engine.reduce
import com.eienmosu.truthy.engine.startRound
import kotlinx.serialization.json.Json

/** Small rounds for the JVM tests. Cards are decoded from the shipped JSON shape, so the tests need no Card constructor. */
internal object RoundFixtures {
    fun card(n: Int, answer: Boolean, appliesTo: String = ""): Card = Json.decodeFromString(
        Card.serializer(),
        """{"id":"test-c$n","section":"SEC","text":{"en":{"statement":"Statement $n","explanation":"Because $n."}},""" +
            """"answer":$answer,"source":{"title":"Docs $n","url":"https://example.com/docs/$n"},"difficulty":1,""" +
            """"appliesTo":"$appliesTo","conflictGroups":[]}""",
    )

    /** Half True, half False, so every class can deal from it. */
    fun pool(size: Int = 10): List<Card> = (1..size).map { card(it, answer = it % 2 == 0) }

    fun start(mode: Mode, pool: List<Card> = pool()): RoundState =
        startRound(StartArgs(mode, Route("test", "SEC"), pool, emptyMap(), 7.0))

    fun ticket(mode: Mode, best: Int? = null): TicketInfo =
        TicketInfo("TST", "Test deck", "SEC", "Section", modeInfo(mode).name, best)

    /** Answers the card on screen right or wrong, whatever its answer is. */
    fun answer(round: RoundState, correct: Boolean, at: Double = 1_000.0): RoundState {
        val card = currentCard(round)!!
        return reduce(round, RoundEvent.Answer(if (correct) card.answer else !card.answer, at))
    }

    fun next(round: RoundState): RoundState = reduce(round, RoundEvent.Next)

    fun tick(round: RoundState, now: Double): RoundState = reduce(round, RoundEvent.Tick(now))

    fun word(answer: Boolean): String = if (answer) "True" else "False"
}
