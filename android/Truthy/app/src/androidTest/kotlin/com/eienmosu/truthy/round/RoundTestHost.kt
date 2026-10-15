package com.eienmosu.truthy.round

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import com.eienmosu.truthy.design.TruthyTheme
import com.eienmosu.truthy.design.resolvedTheme
import com.eienmosu.truthy.engine.Card
import com.eienmosu.truthy.engine.Mode
import com.eienmosu.truthy.engine.Route
import com.eienmosu.truthy.engine.RoundEvent
import com.eienmosu.truthy.engine.RoundState
import com.eienmosu.truthy.engine.StartArgs
import com.eienmosu.truthy.engine.Theme
import com.eienmosu.truthy.engine.TicketInfo
import com.eienmosu.truthy.engine.modeInfo
import com.eienmosu.truthy.engine.reduce
import com.eienmosu.truthy.engine.startRound
import kotlinx.serialization.json.Json

internal object RoundTestData {
    /** 108 UTF-16 units, inside the 120 the schema allows. */
    const val LONG_STATEMENT = "A statement long enough to wrap over many lines of the ticket, so that the ticket scrolls on a short screen."
    /** 201 UTF-16 units, inside the 240 the schema allows. */
    const val LONG_EXPLANATION = "An explanation long enough to fill the answer slip with several lines of body text, so that the slip runs on below the action row " +
        "on a short screen and the ticket has to scroll to show the source link."

    fun card(n: Int, answer: Boolean, statement: String = "Statement $n", explanation: String = "Because $n."): Card = Json.decodeFromString(
        Card.serializer(),
        """{"id":"test-c$n","section":"SEC","text":{"en":{"statement":"$statement","explanation":"$explanation"}},""" +
            """"answer":$answer,"source":{"title":"Docs $n","url":"https://example.com/docs/$n"},"difficulty":1,""" +
            """"appliesTo":"","conflictGroups":[]}""",
    )

    fun pool(size: Int = 10, statement: (Int) -> String = { "Statement $it" }, explanation: (Int) -> String = { "Because $it." }): List<Card> =
        (1..size).map { card(it, answer = it % 2 == 0, statement = statement(it), explanation = explanation(it)) }

    fun start(mode: Mode, pool: List<Card> = pool()): RoundState =
        startRound(StartArgs(mode, Route("test", "SEC"), pool, emptyMap(), 7.0))

    fun ticket(mode: Mode, best: Int? = null): TicketInfo =
        TicketInfo("TST", "Test deck", "SEC", "Section", modeInfo(mode).name, best)
}

/** Plays the round with the engine directly, recording what the screen asked for. The coordinator's guards are task 11's tests. */
internal class RoundTestState(start: RoundState, val ticket: TicketInfo) {
    var round by mutableStateOf(start)
    var sheetOpen by mutableStateOf(false)
    var wallClock = 10_000.0
    val answers = mutableListOf<Boolean>()
    val haptics = mutableListOf<RoundHaptic>()
    val links = mutableListOf<String>()
    var nexts = 0
    var leaveRequests = 0

    fun answer(value: Boolean) {
        answers.add(value)
        round = reduce(round, RoundEvent.Answer(value, wallClock))
    }

    fun next() {
        nexts += 1
        round = reduce(round, RoundEvent.Next)
    }

    @Composable
    fun Content(modifier: Modifier = Modifier, cardShownAt: Double = SETTLED, reduced: Boolean = false) {
        TruthyTheme(resolvedTheme(Theme.LIGHT)) {
            RoundScreen(
                round = round,
                ticket = ticket,
                cardShownAt = { cardShownAt },
                onAnswer = { answer(it) },
                onNext = { next() },
                onRequestLeave = { leaveRequests += 1 },
                modifier = modifier,
                sheetOpen = sheetOpen,
                reducedMotion = reduced,
                haptics = { haptics.add(it) },
                openLink = { links.add(it) },
            )
        }
    }

    companion object {
        /** Long before any test event: the 250 ms settle has passed whatever clock the test injects with. */
        const val SETTLED = -1.0e12
    }
}
