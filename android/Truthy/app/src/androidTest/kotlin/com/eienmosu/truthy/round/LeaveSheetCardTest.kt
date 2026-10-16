package com.eienmosu.truthy.round

import androidx.activity.ComponentActivity
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertContentDescriptionEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class LeaveSheetCardTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private val events = mutableListOf<String>()
    private var decided by mutableStateOf(false)

    private fun card(decidedAtOpen: Boolean = false) {
        rule.setContent {
            Themed {
                LeaveSheetCard(
                    decided = decided,
                    decidedAtOpen = decidedAtOpen,
                    hiding = false,
                    onKeepPlaying = { events += "keep" },
                    onLeave = { events += "leave" },
                )
            }
        }
    }

    private fun status() = rule.onNodeWithTag(LEAVE_STATUS_TAG, useUnmergedTree = true)

    @Test
    fun saysTheTitleThenTheBodyAsPlainTextAndBothActions() {
        card()
        val title = rule.onNodeWithText(LeaveText.TITLE).assertIsDisplayed().assert(SemanticsMatcher.keyIsDefined(SemanticsProperties.Heading))
        // LeaveDialog.tsx: the title labels the dialog and the body describes it; a live body was read before the title.
        val body = rule.onNodeWithText(LeaveText.OPEN_BODY).assertIsDisplayed()
            .assert(SemanticsMatcher.keyNotDefined(SemanticsProperties.LiveRegion))
        assertTrue(title.fetchSemanticsNode().boundsInRoot.bottom <= body.fetchSemanticsNode().boundsInRoot.top)
        rule.onNodeWithText(LeaveText.KEEP_PLAYING).assertIsDisplayed()
        rule.onNodeWithText(LeaveText.LEAVE_ROUND).assertIsDisplayed()
        status().assert(SemanticsMatcher.expectValue(SemanticsProperties.LiveRegion, LiveRegionMode.Polite))
            .assert(SemanticsMatcher.keyNotDefined(SemanticsProperties.ContentDescription))
    }

    @Test
    fun switchesToTheDecidedBodyAndSaysItThroughTheStatusWhenTheRoundIsDecidedWhileOpen() {
        card()
        decided = true
        rule.waitForIdle()
        rule.onNodeWithText(LeaveText.DECIDED_BODY).assertIsDisplayed()
        rule.onNodeWithText(LeaveText.OPEN_BODY).assertDoesNotExist()
        status().assertContentDescriptionEquals(LeaveText.DECIDED_BODY)
    }

    @Test
    fun aSheetOpenedOnADecidedRoundSaysNothingThroughTheStatus() {
        decided = true
        card(decidedAtOpen = true)
        rule.onNodeWithText(LeaveText.DECIDED_BODY).assertIsDisplayed()
        status().assert(SemanticsMatcher.keyNotDefined(SemanticsProperties.ContentDescription))
    }

    @Test
    fun keepPlayingAndLeaveRoundCallTheirActions() {
        card()
        rule.onNodeWithText(LeaveText.KEEP_PLAYING).performClick()
        rule.onNodeWithText(LeaveText.LEAVE_ROUND).performClick()
        assertEquals(listOf("keep", "leave"), events)
    }

    @Test
    fun nothingClipsAtTwiceTheTextSizeOnALargePhone() {
        rule.setContent { Themed { AtSize(412.dp, 915.dp, fontScale = 2f) { LeaveSheetCard(decided = true, decidedAtOpen = true, hiding = false, onKeepPlaying = {}, onLeave = {}) } } }
        rule.waitForIdle()
        rule.assertNoClippedText()
    }

    @Test
    fun nothingClipsAtTwiceTheTextSizeOnTheSmallestPhone() {
        rule.setContent { Themed { AtSize(320.dp, 568.dp, fontScale = 2f) { LeaveSheetCard(decided = false, decidedAtOpen = false, hiding = false, onKeepPlaying = {}, onLeave = {}) } } }
        rule.waitForIdle()
        rule.assertNoClippedText()
    }
}
