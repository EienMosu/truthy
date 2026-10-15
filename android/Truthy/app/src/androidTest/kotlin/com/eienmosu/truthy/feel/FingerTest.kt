package com.eienmosu.truthy.feel

import android.os.SystemClock
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import com.eienmosu.truthy.round.CardDragOffset
import com.eienmosu.truthy.support.CLF_ID
import com.eienmosu.truthy.support.CLF_SECURITY
import com.eienmosu.truthy.support.DeckAnswers
import com.eienmosu.truthy.support.Device
import com.eienmosu.truthy.support.Finger
import com.eienmosu.truthy.support.SETTLE_MS
import com.eienmosu.truthy.support.Ui
import com.eienmosu.truthy.support.button
import com.eienmosu.truthy.ui.TestTags
import java.util.regex.Pattern
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class FingerTest {
    @get:Rule val rule = createEmptyComposeRule()
    private val ui = Ui(rule)
    private val card = hasTestTag(TestTags.CARD)

    @Before fun firstLaunch() = Device.reset()

    private fun roundAtCardOne() {
        ui.atHome()
        ui.chooseRoute(CLF_SECURITY)
        ui.startRound()
        ui.cardOnScreen(DeckAnswers(CLF_ID))
        ui.idle()
        SystemClock.sleep(SETTLE_MS)
    }

    @Test fun theCardFollowsTheFingerWithinOneDp() {
        Device.launch().use {
            roundAtCardOne()
            val d = Device.density
            // The card's drawn offset in dp, from the drag area (task 13's CardDragOffset): the rotated card's bounding
            // box runs past the window's right edge, and boundsInWindow is clipped to the window, so its centre lags.
            fun drawn(): Float = ui.node(hasTestTag("swipe-card")).config[CardDragOffset] * d
            val from = ui.centre(card)
            val down = Finger.press(from)
            SystemClock.sleep(16)
            Finger.moveTo(down, from + Offset(12 * d, 0f)) // past the touch slop: the drag has begun
            ui.idle()
            for (sample in 1..10) {
                SystemClock.sleep(16)
                val travel = (12 + 5 * sample) * d // ends at 62 dp, short of the 90 commit line
                Finger.moveTo(down, from + Offset(travel, 0f))
                ui.idle()
                val offset = drawn()
                assertEquals("sample $sample: the card is not under the finger", travel, offset, d)
            }
            // Back to the touch-down point and up: dx is 0, interpret cancels, the card springs home unanswered.
            Finger.moveTo(down, from)
            Finger.release(down, from)
            ui.idle()
            ui.waitFor(button("True"))
            assertFalse(ui.exists(button("Next card")))
        }
    }

    @Test fun aLongPressSelectsNothingAndOpensNoMenu() {
        Device.launch().use {
            roundAtCardOne()
            val at = ui.centre(card)
            val down = Finger.press(at)
            SystemClock.sleep(1_000)
            Finger.release(down, at)
            ui.idle()
            val device = UiDevice.getInstance(Device.instrumentation)
            assertFalse("a text menu opened", device.hasObject(By.text(Pattern.compile("(?i)(copy|select all|share|paste)"))))
            ui.waitFor(button("True"))
            assertFalse(ui.exists(button("Next card")))
        }
    }
}
