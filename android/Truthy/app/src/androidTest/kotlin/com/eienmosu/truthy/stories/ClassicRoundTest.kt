package com.eienmosu.truthy.stories

import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.eienmosu.truthy.engine.Mode
import com.eienmosu.truthy.engine.plainText
import com.eienmosu.truthy.engine.recordKey
import com.eienmosu.truthy.support.CLF_ID
import com.eienmosu.truthy.support.CLF_SECURITY
import com.eienmosu.truthy.support.CLF_SEC_ROUTE
import com.eienmosu.truthy.support.DeckAnswers
import com.eienmosu.truthy.support.Device
import com.eienmosu.truthy.support.Ui
import com.eienmosu.truthy.support.WAIT_MS
import com.eienmosu.truthy.support.button
import com.eienmosu.truthy.support.label
import com.eienmosu.truthy.support.roundHeading
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ClassicRoundTest {
    @get:Rule val rule = createEmptyComposeRule()
    private val ui = Ui(rule)

    @Before fun firstLaunch() = Device.reset()

    @Test fun aFirstRunFillsInThePassPlaysTenCardsAndShowsTheResult() {
        Device.launch().use {
            ui.atHome()
            // A new player has nothing to continue.
            assertFalse(ui.exists(label(Regex("Continue: .*"))))
            ui.chooseRoute(CLF_SECURITY)
            ui.startRound()
            ui.waitFor(label(roundHeading("Classic")))

            val played = ui.playClassic(DeckAnswers(CLF_ID), wrongOn = setOf(3, 6, 9))

            ui.waitForResult()
            ui.waitFor(label("Round complete. 10 of 10 cards. 7 correct, 3 wrong: cards 3, 6 and 9."))
            ui.waitFor(label("First round on this route"))
            ui.waitFor(label("3 to review"))
            val missed = played.filter { !it.correct }
            assertEquals(listOf(3, 6, 9), missed.map { it.number })
            assertEquals(3, ui.count(button(Regex("Why, card \\d{2}"))))
            for (card in missed) ui.waitFor(button("Why, card %02d".format(card.number)))

            // "Why" opens the explanation and the source link of that card.
            val third = missed.first().card
            ui.tapScrolled(button("Why, card 03"))
            ui.waitForAny(label(plainText(third.text.en.explanation)))
            ui.waitFor(button("${third.source.title} (opens in browser)"))
            ui.waitFor(button("Play again"))
            ui.waitFor(button("Choose another route"))

            // Recorded once: the record of this route and class is the score.
            rule.waitUntil(WAIT_MS) { Device.progress().records[recordKey(CLF_SEC_ROUTE, Mode.CLASSIC)] == 7 }
            assertEquals(10, Device.progress().cards.size)
        }
    }
}
