package com.eienmosu.truthy.round

import androidx.activity.ComponentActivity
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class LeaveSheetCardTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private val events = mutableListOf<String>()
    private var decided by mutableStateOf(false)

    private fun card() {
        rule.setContent {
            Themed {
                LeaveSheetCard(decided = decided, hiding = false, onKeepPlaying = { events += "keep" }, onLeave = { events += "leave" })
            }
        }
    }

    @Test
    fun saysTheTitleTheBodyAndBothActionsWithTheBodyAsALiveRegion() {
        card()
        rule.onNodeWithText(LeaveText.TITLE).assertIsDisplayed().assert(SemanticsMatcher.keyIsDefined(SemanticsProperties.Heading))
        rule.onNodeWithText(LeaveText.OPEN_BODY).assertIsDisplayed()
            .assert(SemanticsMatcher.expectValue(SemanticsProperties.LiveRegion, LiveRegionMode.Polite))
        rule.onNodeWithText(LeaveText.KEEP_PLAYING).assertIsDisplayed()
        rule.onNodeWithText(LeaveText.LEAVE_ROUND).assertIsDisplayed()
    }

    @Test
    fun switchesToTheDecidedBodyWhenTheRoundIsDecidedWhileOpen() {
        card()
        decided = true
        rule.waitForIdle()
        rule.onNodeWithText(LeaveText.DECIDED_BODY).assertIsDisplayed()
        rule.onNodeWithText(LeaveText.OPEN_BODY).assertDoesNotExist()
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
        rule.setContent { Themed { AtSize(412.dp, 915.dp, fontScale = 2f) { LeaveSheetCard(decided = true, hiding = false, onKeepPlaying = {}, onLeave = {}) } } }
        rule.waitForIdle()
        rule.assertNoClippedText()
    }

    @Test
    fun nothingClipsAtTwiceTheTextSizeOnTheSmallestPhone() {
        rule.setContent { Themed { AtSize(320.dp, 568.dp, fontScale = 2f) { LeaveSheetCard(decided = false, hiding = false, onKeepPlaying = {}, onLeave = {}) } } }
        rule.waitForIdle()
        rule.assertNoClippedText()
    }
}
