package com.eienmosu.truthy.stories

import android.os.SystemClock
import android.view.KeyEvent
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.lifecycle.Lifecycle
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.eienmosu.truthy.support.ARRIVAL_MS
import com.eienmosu.truthy.support.CLF_ID
import com.eienmosu.truthy.support.CLF_SECURITY
import com.eienmosu.truthy.support.DeckAnswers
import com.eienmosu.truthy.support.Device
import com.eienmosu.truthy.support.Keys
import com.eienmosu.truthy.support.LEAVE_IN_SHEET
import com.eienmosu.truthy.support.SETTLE_MS
import com.eienmosu.truthy.support.SHEET_TITLE
import com.eienmosu.truthy.support.Ui
import com.eienmosu.truthy.support.label
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class KeyboardTest {
    @get:Rule val rule = createEmptyComposeRule()
    private val ui = Ui(rule)

    @Before fun firstLaunch() = Device.reset()

    private fun verdict(correct: Boolean) = if (correct) "correct" else "wrong"

    @Test fun theArrowsAnswerReturnGoesOnAndEscapeIsTheX() {
        Device.launch().use {
            ui.atHome()
            ui.chooseRoute(CLF_SECURITY)
            ui.startRound()
            val deck = DeckAnswers(CLF_ID)

            val first = ui.cardOnScreen(deck)
            SystemClock.sleep(SETTLE_MS)
            Keys.hold(KeyEvent.KEYCODE_DPAD_RIGHT, repeats = 4)
            ui.waitFor(label("Card 1 of 10. Card 1 ${verdict(first.answer)}."))

            SystemClock.sleep(ARRIVAL_MS)
            Keys.press(KeyEvent.KEYCODE_ENTER)
            val second = ui.cardOnScreen(deck, first)
            ui.waitFor(label(Regex("Card 2 of 10\\..*")))
            SystemClock.sleep(SETTLE_MS)
            Keys.press(KeyEvent.KEYCODE_DPAD_LEFT)
            val firstRight = first.answer
            val secondRight = !second.answer
            val tally = when {
                firstRight && secondRight -> "Cards 1 and 2 correct."
                !firstRight && !secondRight -> "Cards 1 and 2 wrong."
                firstRight -> "Card 1 correct, card 2 wrong."
                else -> "Card 2 correct, card 1 wrong."
            }
            ui.waitFor(label("Card 2 of 10. $tally"))

            Keys.press(KeyEvent.KEYCODE_ESCAPE)
            ui.waitFor(SHEET_TITLE)
            Keys.press(KeyEvent.KEYCODE_ESCAPE)
            ui.waitGone(SHEET_TITLE)
            Keys.press(KeyEvent.KEYCODE_ESCAPE)
            ui.waitFor(SHEET_TITLE)
            ui.tap(LEAVE_IN_SHEET)
            ui.atHome()
        }
    }

    @Test fun escapeGoesBackOneStepAndIsConsumedOnStepOne() {
        Device.launch().use { scenario ->
            ui.atHome()
            Keys.press(KeyEvent.KEYCODE_ESCAPE)
            ui.idle()
            SystemClock.sleep(SETTLE_MS)
            assertEquals(Lifecycle.State.RESUMED, scenario.state)
            ui.atHome()

            ui.choose(CLF_SECURITY.area)
            ui.atStep("Choose a platform")
            ui.choose(CLF_SECURITY.platform)
            ui.atStep("Choose a deck")
            // A held Escape acts once: one step back, not two.
            Keys.hold(KeyEvent.KEYCODE_ESCAPE, repeats = 3)
            ui.atStep("Choose a platform")
            Keys.press(KeyEvent.KEYCODE_ESCAPE)
            ui.atStep("Choose an area")
        }
    }
}
