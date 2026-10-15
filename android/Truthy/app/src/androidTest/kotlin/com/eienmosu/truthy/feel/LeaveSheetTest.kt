package com.eienmosu.truthy.feel

import android.os.SystemClock
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.test.espresso.Espresso
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.eienmosu.truthy.support.CLF_ID
import com.eienmosu.truthy.support.CLF_SECURITY
import com.eienmosu.truthy.support.DeckAnswers
import com.eienmosu.truthy.support.Device
import com.eienmosu.truthy.support.Finger
import com.eienmosu.truthy.support.LEAVE_X
import com.eienmosu.truthy.support.SETTLE_MS
import com.eienmosu.truthy.support.SHEET_TITLE
import com.eienmosu.truthy.support.Ui
import com.eienmosu.truthy.support.button
import com.eienmosu.truthy.support.inClass
import com.eienmosu.truthy.support.label
import com.eienmosu.truthy.ui.TestTags
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class LeaveSheetTest {
    @get:Rule val rule = createEmptyComposeRule()
    private val ui = Ui(rule)
    private val deck by lazy { DeckAnswers(CLF_ID) }
    private val sheetCard = hasTestTag(TestTags.SHEET_CARD)

    @Before fun firstLaunch() = Device.reset()

    /** A round with card 1 answered right, so the X opens the sheet instead of leaving. */
    private fun answerCardOne(className: String = "Classic") {
        ui.atHome()
        ui.chooseRoute(if (className == "Classic") CLF_SECURITY else CLF_SECURITY.inClass(className))
        ui.startRound()
        val card = ui.cardOnScreen(deck)
        SystemClock.sleep(SETTLE_MS)
        ui.answer(card, right = true)
    }

    private fun openSheet() {
        ui.tap(LEAVE_X)
        ui.waitFor(SHEET_TITLE)
        ui.idle()
    }

    @Test fun aDoubleTapOnTheXLeavesTheSheetOpen() {
        Device.launch().use {
            answerCardOne()
            ui.waitFor(button("Next card"))
            val x = ui.centre(LEAVE_X)
            Finger.tap(x)
            SystemClock.sleep(80)
            // Lands on the X again: 80 ms after the first tap the sheet's window is not up yet. Task 11's requestLeave
            // takes it as the web's tap on the scrim that covers the X, within the sheet's first 250 ms.
            Finger.tap(x)
            ui.idle()
            SystemClock.sleep(600)
            ui.idle()
            assertTrue("the second tap of a double tap closed the sheet", ui.exists(SHEET_TITLE))
        }
    }

    @Test fun swipingTheSheetDownKeepsPlaying() {
        Device.launch().use {
            answerCardOne()
            ui.waitFor(button("Next card"))
            openSheet()
            val from = ui.centre(sheetCard)
            Finger.drag(from, from + Offset(0f, 300 * Device.density), steps = 15, stepMs = 16)
            ui.waitGone(SHEET_TITLE)
            ui.waitFor(button("Next card"))
        }
    }

    @Test fun aTapOnTheScrimKeepsPlaying() {
        Device.launch().use {
            answerCardOne()
            ui.waitFor(button("Next card"))
            openSheet()
            SystemClock.sleep(400) // past the scrim's 250 ms guard
            val top = ui.node(sheetCard).positionOnScreen.y
            Finger.tap(Offset(Device.app.resources.displayMetrics.widthPixels / 2f, top / 2f))
            ui.waitGone(SHEET_TITLE)
            ui.waitFor(button("Next card"))
        }
    }

    @Test fun backOnTheSheetKeepsPlaying() {
        Device.launch().use {
            answerCardOne()
            ui.waitFor(button("Next card"))
            openSheet()
            Espresso.pressBackUnconditionally()
            ui.waitGone(SHEET_TITLE)
            ui.waitFor(button("Next card"))
        }
    }

    @Test fun theTimedClockKeepsRunningUnderTheSheet() {
        Device.launch().use {
            answerCardOne("Timed")
            ui.waitFor(label(Regex("\\d+ seconds? left of 60\\. 1 correct, 0 wrong\\.")))
            openSheet()
            val before = ui.timedSecondsLeft()
            SystemClock.sleep(3_000)
            val during = ui.timedSecondsLeft()
            assertTrue("the clock stopped under the sheet: $before, then $during", before - during >= 2)
            ui.tap(button("Keep playing"))
            ui.waitGone(SHEET_TITLE)
        }
    }
}
