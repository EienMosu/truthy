package com.eienmosu.truthy.stories

import android.os.SystemClock
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.eienmosu.truthy.engine.Mode
import com.eienmosu.truthy.support.CLF_ID
import com.eienmosu.truthy.support.CLF_SECURITY
import com.eienmosu.truthy.support.CLF_SEC_ROUTE
import com.eienmosu.truthy.support.CONTINUE_CLF_SECURITY
import com.eienmosu.truthy.support.DeckAnswers
import com.eienmosu.truthy.support.Device
import com.eienmosu.truthy.support.LEAVE_IN_SHEET
import com.eienmosu.truthy.support.LEAVE_X
import com.eienmosu.truthy.support.SETTLE_MS
import com.eienmosu.truthy.support.SHEET_TITLE
import com.eienmosu.truthy.support.Ui
import com.eienmosu.truthy.support.WAIT_MS
import com.eienmosu.truthy.support.button
import com.eienmosu.truthy.support.label
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class LeaveTest {
    @get:Rule val rule = createEmptyComposeRule()
    private val ui = Ui(rule)

    @Before fun firstLaunch() = Device.reset()

    @Test fun leavingWithNoAnswersLeavesAtOnceAndSavesNothing() {
        Device.launch().use {
            ui.atHome()
            ui.chooseRoute(CLF_SECURITY)
            ui.startRound()
            ui.cardOnScreen(DeckAnswers(CLF_ID))
            ui.tap(LEAVE_X)
            ui.atHome()
            assertFalse(ui.exists(SHEET_TITLE))
            assertFalse(ui.exists(label(Regex("Continue: .*"))))
            val progress = Device.progress()
            assertNull(progress.last)
            assertTrue(progress.cards.isEmpty())
            assertTrue(progress.records.isEmpty())
        }
    }

    @Test fun leavingWithAnswersKeepsThemAndOffersTheRouteWithoutAScore() {
        Device.launch().use {
            ui.atHome()
            ui.chooseRoute(CLF_SECURITY)
            ui.startRound()
            val card = ui.cardOnScreen(DeckAnswers(CLF_ID))
            SystemClock.sleep(SETTLE_MS)
            ui.answer(card, right = true)
            ui.waitFor(button("Next card"))

            ui.tap(LEAVE_X)
            ui.waitFor(SHEET_TITLE)
            ui.waitFor(label("Your answers so far stay in your history. This round won't count toward your best."))
            ui.waitFor(button("Keep playing"))
            ui.tap(LEAVE_IN_SHEET)
            ui.atHome()
            ui.waitFor(button(CONTINUE_CLF_SECURITY))

            // Abandoned (spec 4.5): the answer is in the history, `last` has no score, no record is set.
            rule.waitUntil(WAIT_MS) { Device.progress().cards.containsKey(card.id) }
            val progress = Device.progress()
            assertEquals(CLF_SEC_ROUTE, progress.last?.route)
            assertEquals(Mode.CLASSIC, progress.last?.mode)
            assertNull(progress.last?.score)
            assertNull(progress.last?.total)
            assertTrue(progress.records.isEmpty())
        }
    }
}
