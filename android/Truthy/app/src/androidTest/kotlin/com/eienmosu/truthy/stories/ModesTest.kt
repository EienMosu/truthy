package com.eienmosu.truthy.stories

import android.os.SystemClock
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.lifecycle.Lifecycle
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.eienmosu.truthy.engine.Card
import com.eienmosu.truthy.engine.Mode
import com.eienmosu.truthy.engine.recordKey
import com.eienmosu.truthy.support.CLF_ID
import com.eienmosu.truthy.support.CLF_SECURITY
import com.eienmosu.truthy.support.CLF_SEC_ROUTE
import com.eienmosu.truthy.support.DeckAnswers
import com.eienmosu.truthy.support.Device
import com.eienmosu.truthy.support.SETTLE_MS
import com.eienmosu.truthy.support.Ui
import com.eienmosu.truthy.support.WAIT_MS
import com.eienmosu.truthy.support.inClass
import com.eienmosu.truthy.support.label
import com.eienmosu.truthy.support.roundHeading
import androidx.test.uiautomator.UiDevice
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ModesTest {
    @get:Rule val rule = createEmptyComposeRule()
    private val ui = Ui(rule)
    private val deck by lazy { DeckAnswers(CLF_ID) }

    @Before fun firstLaunch() = Device.reset()

    private fun start(className: String) {
        ui.atHome()
        ui.chooseRoute(CLF_SECURITY.inClass(className))
        ui.startRound()
        ui.waitFor(label(roundHeading(className)))
    }

    // Spec section 2 (orientation not locked) and reference 7.2 item 10: a rotation recreates the activity
    // (configChanges holds only uiMode) and must not reset the round: the view models keep it.
    @Test fun rotatingMidRoundKeepsTheRound() {
        Device.launch().use {
            start("Classic")
            val card = ui.cardOnScreen(deck)
            SystemClock.sleep(SETTLE_MS)
            ui.answer(card, right = true)
            ui.waitFor(label(Regex("Card 1 of 10\\..*")))
            val device = UiDevice.getInstance(Device.instrumentation)
            try {
                device.setOrientationLeft()
                ui.idle()
                ui.waitFor(label(roundHeading("Classic")))
                ui.waitFor(label(Regex("Card 1 of 10\\..*")))
                ui.goOn(last = false)
                ui.waitFor(label(Regex("Card 2 of 10\\..*")))
            } finally {
                device.setOrientationNatural()
                device.unfreezeRotation()
            }
        }
    }

    @Test fun aStreakEndsOnTheFirstWrongAnswer() {
        Device.launch().use {
            start("Streak")
            ui.waitFor(label("Streak of 0 correct answers."))
            var previous: Card? = null
            for (number in 1..3) {
                val card = ui.cardOnScreen(deck, previous)
                SystemClock.sleep(SETTLE_MS)
                ui.answer(card, right = number < 3)
                if (number == 2) ui.waitFor(label("Streak of 2 correct answers."))
                if (number == 3) ui.waitFor(label("Streak ended at 2."))
                ui.goOn(last = number == 3)
                previous = card
            }
            ui.waitForResult()
            ui.waitFor(label("Streak over on card 3. 2 correct in a row. Card 3 was wrong."))
            rule.waitUntil(WAIT_MS) { Device.progress().records[recordKey(CLF_SEC_ROUTE, Mode.STREAK)] == 2 }
        }
    }

    @Test fun threeLivesEndOnTheThirdWrongAnswer() {
        Device.launch().use {
            start("Three lives")
            ui.waitFor(label("3 of 3 lives left. No cards answered yet."))
            val wrongOn = setOf(2, 4, 5)
            var previous: Card? = null
            for (number in 1..5) {
                val card = ui.cardOnScreen(deck, previous)
                SystemClock.sleep(SETTLE_MS)
                ui.answer(card, right = number !in wrongOn)
                if (number == 2) ui.waitFor(label("2 of 3 lives left. 2 cards answered, card 2 was wrong."))
                if (number == 4) ui.waitFor(label("1 of 3 lives left. 4 cards answered, cards 2 and 4 were wrong."))
                if (number == 5) ui.waitFor(label("No lives left. The round is over after 5 cards: cards 2, 4 and 5 were wrong."))
                ui.goOn(last = number == 5)
                previous = card
            }
            ui.waitForResult()
            ui.waitFor(label("Out of lives after 5 cards. 2 correct, 3 wrong: cards 2, 4 and 5."))
            rule.waitUntil(WAIT_MS) { Device.progress().records[recordKey(CLF_SEC_ROUTE, Mode.LIVES)] == 5 }
        }
    }

    @Test fun aTimedRoundEndsWhenTheMinuteIsOver() {
        Device.launch().use {
            start("Timed")
            ui.waitFor(label(Regex("\\d+ seconds? left of 60\\. 0 correct, 0 wrong\\.")))
            val first = ui.cardOnScreen(deck)
            SystemClock.sleep(SETTLE_MS)
            ui.answer(first, right = true)
            ui.waitFor(label(Regex("\\d+ seconds? left of 60\\. 1 correct, 0 wrong\\.")))
            // After the 700 ms hold the next card is dealt; the stub stayed and took the stamp.
            val second = ui.cardOnScreen(deck, first)
            SystemClock.sleep(SETTLE_MS)
            ui.answer(second, right = false)
            ui.waitFor(label(Regex("\\d+ seconds? left of 60\\. 1 correct, 1 wrong\\.")))

            // The rest of the minute runs out in real time.
            ui.waitFor(label("Time is up. 2 cards answered: 1 correct, 1 wrong."), timeoutMs = 70_000)
            ui.waitForAny(label("Closed"))
            ui.goOn(last = true)
            ui.waitForResult()
            ui.waitFor(label("Time is up. 2 cards answered in 60 seconds. 1 correct, 1 wrong: card 2."))
            rule.waitUntil(WAIT_MS) { Device.progress().records[recordKey(CLF_SEC_ROUTE, Mode.TIMED)] == 1 }
        }
    }

    @Test fun theTimedClockPausesOnlyWhileTheAppIsStopped() {
        Device.launch().use { scenario ->
            start("Timed")
            ui.cardOnScreen(deck)
            SystemClock.sleep(2_000)
            val before = ui.timedSecondsLeft()
            val readBefore = SystemClock.uptimeMillis()

            // ON_STOP sends visibility(hidden) to the engine; the minute does not run in the background.
            scenario.moveToState(Lifecycle.State.CREATED)
            SystemClock.sleep(5_000)
            scenario.moveToState(Lifecycle.State.RESUMED)
            ui.idle()
            val after = ui.timedSecondsLeft()
            // The clock runs until ON_STOP and again from ON_START: the two activity transitions take up to a second
            // or more each on an emulator. Only the 5 s between them must not count.
            val running = SystemClock.uptimeMillis() - readBefore - 5_000
            val allowed = 1 + Math.ceil(running / 1_000.0).toInt()
            assertTrue(
                "the clock ran while the app was stopped: $before, then $after ($running ms in transitions)",
                before - after <= allowed,
            )

            SystemClock.sleep(3_000)
            val later = ui.timedSecondsLeft()
            assertTrue("the clock did not run again after ON_START: $after, then $later", after - later >= 2)
        }
    }
}
