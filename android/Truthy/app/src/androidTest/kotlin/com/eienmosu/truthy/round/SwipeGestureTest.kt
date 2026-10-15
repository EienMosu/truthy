package com.eienmosu.truthy.round

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipe
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.eienmosu.truthy.engine.Card
import com.eienmosu.truthy.engine.Mode
import com.eienmosu.truthy.engine.currentCard
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class SwipeGestureTest {
    @get:Rule
    val rule = createComposeRule()

    private fun px(dp: Float): Float = with(rule.density) { dp.dp.toPx() }

    private fun offset(): Float = rule.onNodeWithTag("swipe-card").fetchSemanticsNode().config[CardDragOffset]

    private fun scrolled(): Float =
        rule.onNodeWithTag("ticket-scroller").fetchSemanticsNode().config[SemanticsProperties.VerticalScrollAxisRange].value()

    private fun scrollRoom(): Float =
        rule.onNodeWithTag("ticket-scroller").fetchSemanticsNode().config[SemanticsProperties.VerticalScrollAxisRange].maxValue()

    private fun classic(pool: List<Card> = RoundTestData.pool()) =
        RoundTestState(RoundTestData.start(Mode.CLASSIC, pool), RoundTestData.ticket(Mode.CLASSIC))

    private fun moveAndCheck(dxDp: Float, dyDp: Float, times: Int, check: (step: Int) -> Unit) {
        repeat(times) { step ->
            rule.onNodeWithTag("ticket-scroller").performTouchInput { moveBy(Offset(px(dxDp), px(dyDp))) }
            rule.waitForIdle()
            check(step + 1)
        }
    }

    @Test
    fun theCardFollowsTheFingerOneToOneAndACancelAnswersNothing() {
        val host = classic()
        rule.setContent { host.Content() }
        rule.onNodeWithTag("ticket-scroller").performTouchInput { down(center) }
        moveAndCheck(12f, 0f, 10) { step -> assertEquals(12f * step, offset(), 1f) }
        rule.onNodeWithTag("ticket-scroller").performTouchInput { cancel() }
        rule.waitForIdle()
        assertTrue(host.answers.isEmpty())
        assertEquals(0f, offset(), 0.5f)
    }

    @Test
    fun aSwipeRightAnswersTrueWithOneThresholdHapticAndTheCardSpringsBack() {
        val host = classic()
        val right = currentCard(host.round)!!.answer
        rule.setContent { host.Content() }
        rule.onNodeWithTag("ticket-scroller").performTouchInput {
            swipe(start = center, end = center + Offset(px(150f), 0f), durationMillis = 300)
        }
        rule.waitForIdle()
        assertEquals(listOf(true), host.answers)
        assertEquals(listOf(RoundHaptic.THRESHOLD, if (right) RoundHaptic.CONFIRM else RoundHaptic.REJECT), host.haptics)
        assertEquals(0f, offset(), 0.5f)
    }

    @Test
    fun aDragThatStartsInsideThe24DpEdgeZoneNeverMovesTheCard() {
        val host = classic()
        rule.setContent { host.Content() }
        val card = rule.onNodeWithTag("swipe-card").fetchSemanticsNode().boundsInRoot
        assumeTrue("the card reaches into the edge zone only when the frame meets the window edge", card.left < px(22f))
        val y = rule.onNodeWithTag("ticket-scroller").fetchSemanticsNode().boundsInRoot.center.y
        rule.onRoot().performTouchInput { down(Offset(px(22f), y)) }
        repeat(10) {
            rule.onRoot().performTouchInput { moveBy(Offset(px(15f), 0f)) }
            rule.waitForIdle()
            assertEquals(0f, offset(), 0.01f)
        }
        rule.onRoot().performTouchInput { up() }
        rule.waitForIdle()
        assertTrue(host.answers.isEmpty())
        rule.onRoot().performTouchInput {
            down(Offset(px(30f), y))
            moveBy(Offset(px(40f), 0f))
        }
        rule.waitForIdle()
        assertTrue("a drag from 30 dp moves the card", offset() > 30f)
        rule.onRoot().performTouchInput { cancel() }
    }

    @Test
    fun aVerticalDiagonalOnALongStatementScrollsTheTicketAndNeverMovesTheCard() {
        val host = classic(RoundTestData.pool(statement = { RoundTestData.LONG_STATEMENT }))
        rule.setContent { Box(Modifier.width(412.dp).height(480.dp)) { host.Content() } }
        rule.waitForIdle()
        assertTrue("the ticket must be taller than the stage", scrollRoom() > 0f)
        val before = scrolled()
        rule.onNodeWithTag("ticket-scroller").performTouchInput { down(center) }
        moveAndCheck(3f, -12f, 10) { assertEquals(0f, offset(), 0.01f) }
        rule.onNodeWithTag("ticket-scroller").performTouchInput { up() }
        rule.waitForIdle()
        assertTrue("the ticket scrolled", scrolled() > before)
        assertTrue(host.answers.isEmpty())
    }

    @Test
    fun aHorizontalDiagonalOnALongStatementMovesTheCardAndNeverScrolls() {
        val host = classic(RoundTestData.pool(statement = { RoundTestData.LONG_STATEMENT }))
        rule.setContent { Box(Modifier.width(412.dp).height(480.dp)) { host.Content() } }
        rule.waitForIdle()
        val before = scrolled()
        rule.onNodeWithTag("ticket-scroller").performTouchInput { down(center) }
        moveAndCheck(10f, 3f, 10) { step ->
            assertEquals(before, scrolled(), 0.5f)
            assertEquals(10f * step, offset(), 1f)
        }
        rule.onNodeWithTag("ticket-scroller").performTouchInput { cancel() }
        rule.waitForIdle()
        assertTrue(host.answers.isEmpty())
    }

    @Test
    fun theThresholdHapticFiresOncePerCrossingOfTheCommitLine() {
        val host = classic()
        rule.setContent { host.Content() }
        rule.onNodeWithTag("ticket-scroller").performTouchInput {
            down(center)
            repeat(3) { moveBy(Offset(px(40f), 0f)) }
            repeat(2) { moveBy(Offset(px(-30f), 0f)) }
            moveBy(Offset(px(40f), 0f))
            repeat(2) { moveBy(Offset(px(10f), 0f)) }
            cancel()
        }
        rule.waitForIdle()
        assertEquals(2, host.haptics.count { it == RoundHaptic.THRESHOLD })
        assertTrue(host.answers.isEmpty())
    }

    @Test
    fun aSecondFingerCancelsTheDrag() {
        val host = classic()
        rule.setContent { host.Content() }
        rule.onNodeWithTag("ticket-scroller").performTouchInput {
            down(0, center)
            moveBy(0, Offset(px(60f), 0f))
            down(1, center + Offset(0f, px(40f)))
        }
        rule.waitForIdle()
        assertEquals(0f, offset(), 0.5f)
        rule.onNodeWithTag("ticket-scroller").performTouchInput {
            moveBy(0, Offset(px(80f), 0f))
            up(1)
            up(0)
        }
        rule.waitForIdle()
        assertTrue(host.answers.isEmpty())
    }

    @Test
    fun beforeTheSettleTimeADragIsIgnored() {
        val host = classic()
        rule.setContent { host.Content(cardShownAt = 1.0e15) }
        rule.onNodeWithTag("ticket-scroller").performTouchInput {
            swipe(start = center, end = center + Offset(px(150f), 0f), durationMillis = 300)
        }
        rule.waitForIdle()
        assertTrue(host.answers.isEmpty())
        assertTrue(host.haptics.isEmpty())
    }
}
