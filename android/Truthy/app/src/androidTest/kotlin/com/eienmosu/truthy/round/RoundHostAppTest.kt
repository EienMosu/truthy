package com.eienmosu.truthy.round

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.SemanticsNodeInteractionsProvider
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.eienmosu.truthy.ROUND_TAG
import com.eienmosu.truthy.RoundLoad
import com.eienmosu.truthy.RoundRequest
import com.eienmosu.truthy.START_TAG
import com.eienmosu.truthy.TopScreen
import com.eienmosu.truthy.TruthyRoot
import com.eienmosu.truthy.engine.Mode
import com.eienmosu.truthy.engine.Phase
import com.eienmosu.truthy.support.CLF_SEC_ROUTE
import com.eienmosu.truthy.support.WAIT_MS
import com.eienmosu.truthy.ui.TestTags
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** TruthyRoot on task 11's real AppViewModel over test services: what the player sees while the owner works. */
@RunWith(AndroidJUnit4::class)
class RoundHostAppTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private val rig = AppHostRig()
    private val request = RoundRequest(CLF_SEC_ROUTE, Mode.CLASSIC)

    @After
    fun close() = rig.close()

    private fun show() {
        rule.setContent { Themed { TruthyRoot(rig.app) } }
        rule.waitUntil(WAIT_MS) { rule.onAllNodesWithTagExist(START_TAG) }
    }

    private fun open() {
        rule.runOnUiThread { rig.app.openRound(request) }
        rule.waitUntil(WAIT_MS) { rig.load != null && rig.load != RoundLoad.Loading }
    }

    @Test
    fun theRoundStaysOnScreenAndInertWhileALeftRoundIsSaved() {
        show()
        open()
        rule.waitUntil(WAIT_MS) { rule.onAllNodesWithTagExist("round-screen") }
        val round = rig.coordinator
        rule.runOnUiThread {
            rig.monotonic += 1_000.0
            assertTrue(round.answer(true))
        }
        rule.waitForIdle()
        rule.runOnUiThread { rig.app.requestLeave() }
        rule.waitUntil(WAIT_MS) { round.sheetOpen.value }
        rule.waitForIdle()

        // A slow phone: the save of the left round takes as long as the test holds it.
        val hold = CompletableDeferred<Unit>()
        rig.progress.hold = hold
        rule.runOnUiThread { rig.app.leaveRound() }
        rule.waitUntil(WAIT_MS) { round.state.value.abandoned }
        rule.waitForIdle()
        assertTrue(rig.app.screen.value is TopScreen.Round)
        // Spec 5.7 item 5 and N10: the last frame of the round stays, sky and ticket, until the start flow replaces it.
        rule.onNodeWithTag("round-screen").assertIsDisplayed()
        rule.onNodeWithTag(TestTags.CARD).assertIsDisplayed()
        rule.onNodeWithTag(START_TAG).assertDoesNotExist()
        // Inert: Next card and the X do nothing while the save runs.
        rule.onNode(hasText("Next card") and hasClickAction()).performClick()
        rule.onNode(hasContentDescription("Leave round") and hasClickAction()).performClick()
        rule.waitForIdle()
        assertEquals(Phase.FINISHED, round.state.value.phase)
        assertEquals(1, round.state.value.answers.size)
        assertTrue(rig.app.screen.value is TopScreen.Round)

        hold.complete(Unit)
        rule.waitUntil(WAIT_MS) { rig.app.screen.value == TopScreen.Start }
        rule.waitUntil(WAIT_MS) { rule.onAllNodesWithTagExist(START_TAG) }
        rule.onNodeWithTag(ROUND_TAG).assertDoesNotExist()
        assertEquals(1, runBlocking { rig.progress.load() }.cards.size)
    }
}

private fun SemanticsNodeInteractionsProvider.onAllNodesWithTagExist(tag: String): Boolean =
    onAllNodes(hasTestTag(tag)).fetchSemanticsNodes().isNotEmpty()
