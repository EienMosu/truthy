package com.eienmosu.truthy.round

import android.view.KeyEvent
import androidx.activity.ComponentActivity
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertContentDescriptionEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.lifecycle.Lifecycle
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.eienmosu.truthy.MonotonicClock
import com.eienmosu.truthy.design.Tokens
import com.eienmosu.truthy.engine.RoundState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

private const val X_TAG = "test.x"

/**
 * The host routes; it decides nothing (rule 1). A fake owner stands in for task 11's AppViewModel and coordinator:
 * it records every call and keeps the sheet open or closed as the coordinator would after keepPlaying.
 */
@RunWith(AndroidJUnit4::class)
class RoundHostTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private var now = 0.0
    private val clock = MonotonicClock { now }
    private val events = mutableListOf<String>()
    private var sheetOpen by mutableStateOf(false)
    private var scrimAccepted = false

    private val owner = object : RoundHostActions {
        override fun requestLeave() { events += "requestLeave" }
        override fun roundBack() { events += "roundBack" }
        override fun keepPlaying() {
            events += "keepPlaying"
            sheetOpen = false
        }
        override fun scrimTapAccepted(): Boolean {
            events += "scrimAsked"
            return scrimAccepted
        }
        override fun leaveRound() { events += "leaveRound" }
        override fun closeResult() { events += "closeResult" }
        override fun playAgain() { events += "playAgain" }
    }

    private fun host(state: RoundState?, best: Int? = null, open: Boolean = false, decidedAtOpen: Boolean = false) {
        sheetOpen = open
        rule.setContent {
            Themed {
                RoundHost(
                    round = state,
                    ticket = TestRounds.ticket(best),
                    sheetOpen = sheetOpen,
                    decidedWhenSheetOpened = decidedAtOpen,
                    clock = clock,
                    actions = owner,
                    openSource = { events += "open $it" },
                ) { requestClose ->
                    Box(Modifier.fillMaxSize()) {
                        Box(Modifier.size(Tokens.Size.touchMin).testTag(X_TAG).clickable { requestClose() })
                    }
                }
            }
        }
        rule.waitForIdle()
    }

    private fun back() {
        rule.runOnUiThread { rule.activity.onBackPressedDispatcher.onBackPressed() }
        rule.waitForIdle()
    }

    private fun key(code: Int) {
        InstrumentationRegistry.getInstrumentation().sendKeyDownUpSync(code)
        rule.waitForIdle()
    }

    @Test
    fun theXAsksTheOwnerToLeave() {
        host(TestRounds.classic(answers = 2, finish = false))
        rule.onNodeWithTag(X_TAG).performClick()
        rule.waitForIdle()
        assertEquals(listOf("requestLeave"), events)
        rule.onNodeWithText(LeaveText.TITLE).assertDoesNotExist()
    }

    @Test
    fun backOnTheRoundGoesToTheOwnersRoundBack() {
        host(TestRounds.classic(answers = 2, finish = false))
        back()
        assertEquals(listOf("roundBack"), events)
    }

    @Test
    fun anOpenSheetShowsTheCardAndKeepPlayingCallsKeepPlaying() {
        host(TestRounds.classic(answers = 2, finish = false), open = true)
        rule.onNodeWithText(LeaveText.TITLE).assertIsDisplayed()
        rule.onNodeWithText(LeaveText.OPEN_BODY).assertIsDisplayed()
        rule.onNodeWithText(LeaveText.KEEP_PLAYING).performClick()
        rule.waitForIdle()
        assertEquals(listOf("keepPlaying"), events)
        rule.onNodeWithText(LeaveText.TITLE).assertDoesNotExist()
    }

    @Test
    fun leaveRoundGoesToTheOwnersLeaveRound() {
        host(TestRounds.streakEndedUnopened(), open = true)
        rule.onNodeWithText(LeaveText.DECIDED_BODY).assertIsDisplayed()
        rule.onNodeWithText(LeaveText.LEAVE_ROUND).performClick()
        rule.waitForIdle()
        assertEquals(listOf("leaveRound"), events)
    }

    @Test
    fun theSheetSaysTheDecisionThroughItsStatusOnlyWhenTheRoundWasNotDecidedAtOpening() {
        host(TestRounds.streakEndedUnopened(), open = true, decidedAtOpen = false)
        rule.onNodeWithTag(LEAVE_STATUS_TAG, useUnmergedTree = true).assertContentDescriptionEquals(LeaveText.DECIDED_BODY)
    }

    @Test
    fun aSheetOpenedOnADecidedRoundKeepsItsStatusEmpty() {
        host(TestRounds.streakEndedUnopened(), open = true, decidedAtOpen = true)
        rule.onNodeWithTag(LEAVE_STATUS_TAG, useUnmergedTree = true)
            .assert(SemanticsMatcher.keyNotDefined(SemanticsProperties.ContentDescription))
    }

    @Test
    fun theSystemBackKeyOnTheSheetKeepsPlaying() {
        host(TestRounds.classic(answers = 2, finish = false), open = true)
        key(KeyEvent.KEYCODE_BACK)
        rule.onNodeWithText(LeaveText.TITLE).assertDoesNotExist()
        assertEquals(listOf("keepPlaying"), events)
    }

    @Test
    fun escapeOnTheSheetKeepsPlaying() {
        host(TestRounds.classic(answers = 2, finish = false), open = true)
        key(KeyEvent.KEYCODE_ESCAPE)
        rule.onNodeWithText(LeaveText.TITLE).assertDoesNotExist()
        assertEquals(listOf("keepPlaying"), events)
    }

    @Test
    fun theScrimAsksTheCoordinatorsGuardBeforeItKeepsPlaying() {
        host(TestRounds.classic(answers = 2, finish = false), open = true)
        scrimAccepted = false
        rule.tapAbove(SHEET_CARD_TAG)
        rule.waitForIdle()
        rule.onNodeWithText(LeaveText.TITLE).assertIsDisplayed()
        assertTrue("the guard was asked", "scrimAsked" in events)
        assertTrue("no dismissal yet", "keepPlaying" !in events)
        scrimAccepted = true
        rule.tapAbove(SHEET_CARD_TAG)
        rule.waitForIdle()
        rule.onNodeWithText(LeaveText.TITLE).assertDoesNotExist()
        assertEquals("keepPlaying", events.last())
    }

    @Test
    fun theResultsActionsGoToTheOwner() {
        host(TestRounds.classic(), best = 9)
        rule.onNodeWithText(ResultText.shortOfBest(2)).assertExists()
        now = 1_000.0
        rule.onNodeWithContentDescription(ResultText.CLOSE_RESULTS).performClick()
        rule.onNodeWithText(ResultText.PLAY_AGAIN).performClick()
        rule.onNodeWithText(ResultText.CHOOSE_ANOTHER_ROUTE).performClick()
        back()
        assertEquals(listOf("closeResult", "playAgain", "closeResult", "roundBack"), events)
    }

    @Test
    fun theSheetLeavesTheActivityResumedSoTheTimedClockRuns() {
        host(TestRounds.classic(answers = 2, finish = false), open = true)
        rule.onNodeWithText(LeaveText.TITLE).assertIsDisplayed()
        assertEquals(Lifecycle.State.RESUMED, rule.activity.lifecycle.currentState)
    }
}
