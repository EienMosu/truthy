package com.eienmosu.truthy.round

import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertContentDescriptionEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performKeyInput
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.pressKey
import androidx.compose.ui.test.requestFocus
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.Density
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.eienmosu.truthy.engine.Mode
import com.eienmosu.truthy.engine.RoundEvent
import com.eienmosu.truthy.engine.currentCard
import com.eienmosu.truthy.engine.reduce
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@OptIn(ExperimentalTestApi::class)
@RunWith(AndroidJUnit4::class)
class RoundScreenTest {
    @get:Rule
    val rule = createComposeRule()

    private fun classic() = RoundTestState(RoundTestData.start(Mode.CLASSIC), RoundTestData.ticket(Mode.CLASSIC))

    private fun verdict(answer: Boolean, correct: Boolean) =
        "${if (correct) "Correct" else "Not quite"}. The answer is ${if (answer) "True" else "False"}."

    @Test
    fun theFirstCardShowsTheTicketTheHeadingAndTheStatement() {
        val host = classic()
        val card = currentCard(host.round)!!
        rule.setContent { host.Content() }
        rule.onNodeWithText("01 / 10").assertExists()
        rule.onNodeWithText("Classic").assertExists()
        rule.onNodeWithText(card.text.en.statement).assertExists()
        rule.onNodeWithContentDescription("Test deck, Section: Classic round").assertExists()
        rule.onNodeWithContentDescription("Card 1 of 10.").assertExists()
        rule.onNodeWithContentDescription("Leave round").assertExists()
        rule.onNodeWithText("swipe to board").assertDoesNotExist()
    }

    @Test
    fun aLeftRoundKeepsItsLastFrameAndTakesNothingUntilTheStartFlowReplacesIt() {
        val host = classic()
        val card = currentCard(host.round)!!
        rule.setContent { host.Content() }
        rule.onNodeWithText(card.text.en.statement).assertExists()
        host.round = reduce(host.round, RoundEvent.Abandon)
        rule.waitForIdle()
        rule.onNodeWithTag("round-screen").assertExists()
        rule.onNodeWithText(card.text.en.statement).assertExists()
        rule.onNodeWithText("01 / 10").assertExists()
        rule.onNodeWithTag("answer-true").performClick()
        rule.onNodeWithContentDescription("Leave round").performClick()
        rule.waitForIdle()
        assertTrue(host.answers.isEmpty())
        assertEquals(0, host.leaveRequests)
        rule.onNodeWithTag("swipe-card").assert(SemanticsMatcher.keyNotDefined(SemanticsActions.CustomActions))
    }

    @Test
    fun theTruePillAnswersAndTheSlipShowsTheVerdictTheExplanationAndTheSource() {
        val host = classic()
        val card = currentCard(host.round)!!
        rule.setContent { host.Content() }
        rule.onNodeWithTag("answer-true").performClick()
        rule.waitForIdle()
        assertEquals(listOf(true), host.answers)
        rule.onNodeWithTag("status").assertContentDescriptionEquals(verdict(card.answer, correct = card.answer))
        rule.onNodeWithText(card.text.en.explanation).assertExists()
        rule.onNodeWithContentDescription("${card.source.title} (opens in browser)").performScrollTo().performClick()
        assertEquals(listOf(card.source.url), host.links)
        rule.mainClock.advanceTimeBy(1_000)
        rule.onNodeWithTag("next").assertExists()
    }

    @Test
    fun nextCardDealsTheSecondCard() {
        val host = classic()
        rule.setContent { host.Content() }
        rule.onNodeWithTag("answer-false").performClick()
        rule.mainClock.advanceTimeBy(1_000)
        rule.onNodeWithTag("next").performClick()
        rule.waitForIdle()
        assertEquals(1, host.nexts)
        rule.onNodeWithText("02 / 10").assertExists()
    }

    @Test
    fun theArrowsAnswerEnterGoesOnAndEscapeAsksToLeave() {
        val host = classic()
        rule.setContent { host.Content() }
        rule.onNodeWithTag("round-screen").requestFocus()
        rule.onNodeWithTag("round-screen").performKeyInput { pressKey(Key.DirectionRight) }
        rule.waitForIdle()
        assertEquals(listOf(true), host.answers)
        rule.onNodeWithTag("round-screen").performKeyInput { pressKey(Key.Enter) }
        rule.waitForIdle()
        assertEquals(1, host.nexts)
        rule.onNodeWithTag("round-screen").requestFocus()
        rule.onNodeWithTag("round-screen").performKeyInput { pressKey(Key.DirectionLeft) }
        rule.waitForIdle()
        assertEquals(listOf(true, false), host.answers)
        rule.onNodeWithTag("round-screen").performKeyInput { pressKey(Key.Escape) }
        rule.waitForIdle()
        assertEquals(1, host.leaveRequests)
    }

    @Test
    fun timedStampsTheStubIgnoresTheDimmedPillsAndAnnouncesTheNextCard() {
        val host = RoundTestState(RoundTestData.start(Mode.TIMED), RoundTestData.ticket(Mode.TIMED))
        val card = currentCard(host.round)!!
        rule.setContent { host.Content() }
        rule.onNodeWithTag("answer-true").performClick()
        rule.waitForIdle()
        rule.onNodeWithTag("status").assertContentDescriptionEquals(if (card.answer) "Correct." else "Not quite.")
        rule.onNodeWithTag("answer-false").performClick()
        rule.waitForIdle()
        assertEquals(1, host.answers.size)
        rule.onNodeWithText("The answer is").assertDoesNotExist()
        rule.runOnIdle { host.round = reduce(host.round, RoundEvent.Tick(host.wallClock + 700.0)) }
        rule.waitForIdle()
        val second = currentCard(host.round)!!
        rule.onNodeWithTag("card-announcer").assertContentDescriptionEquals("Card 2. ${second.text.en.statement}")
        rule.onNodeWithText("02").assertExists()
    }

    @Test
    fun theLiveRegionsKeepTheirTextUnderTheSheetAndRelease150MsAfterItCloses() {
        val host = classic()
        val card = currentCard(host.round)!!
        rule.setContent { host.Content() }
        rule.onNodeWithTag("answer-true").performClick()
        rule.waitForIdle()
        val said = verdict(card.answer, correct = card.answer)
        rule.runOnIdle { host.sheetOpen = true }
        rule.waitForIdle()
        rule.runOnIdle { host.next() }
        rule.waitForIdle()
        rule.onNodeWithTag("status").assertContentDescriptionEquals(said)
        rule.mainClock.autoAdvance = false
        rule.runOnIdle { host.sheetOpen = false }
        rule.mainClock.advanceTimeBy(100)
        rule.onNodeWithTag("status").assertContentDescriptionEquals(said)
        rule.mainClock.advanceTimeBy(100)
        rule.onNodeWithTag("status").assert(SemanticsMatcher.keyNotDefined(SemanticsProperties.ContentDescription))
    }

    @Test
    fun nothingClipsAtTwiceTheTextSize() {
        val pool = RoundTestData.pool(statement = { RoundTestData.LONG_STATEMENT }, explanation = { RoundTestData.LONG_EXPLANATION })
        val host = RoundTestState(RoundTestData.start(Mode.CLASSIC, pool), RoundTestData.ticket(Mode.CLASSIC))
        host.answer(currentCard(host.round)!!.answer)
        rule.setContent {
            val density = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(density.density, fontScale = 2f)) { host.Content() }
        }
        rule.mainClock.advanceTimeBy(2_000)
        rule.waitForIdle()
        val texts = rule.onAllNodes(SemanticsMatcher.keyIsDefined(SemanticsActions.GetTextLayoutResult)).fetchSemanticsNodes()
        assertTrue(texts.isNotEmpty())
        for (node in texts) {
            val results = mutableListOf<TextLayoutResult>()
            node.config[SemanticsActions.GetTextLayoutResult].action?.invoke(results)
            val layout = results.single()
            assertFalse("clipped: ${layout.layoutInput.text}", (layout.didOverflowHeight || (0 until layout.lineCount).any { layout.getLineRight(it) - layout.getLineLeft(it) > layout.size.width + 1f }))
        }
    }
}
