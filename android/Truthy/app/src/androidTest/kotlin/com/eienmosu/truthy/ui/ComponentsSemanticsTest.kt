package com.eienmosu.truthy.ui

import android.os.SystemClock
import android.view.InputDevice
import android.view.MotionEvent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.input.InputMode
import androidx.compose.ui.input.InputModeManager
import androidx.compose.ui.platform.LocalInputModeManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.assertHasClickAction
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.unit.dp
import kotlin.math.abs
import androidx.compose.ui.test.assertHasNoClickAction
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.eienmosu.truthy.design.IconId
import com.eienmosu.truthy.design.TruthyIcon
import com.eienmosu.truthy.design.TruthyTheme
import com.eienmosu.truthy.design.resolvedTheme
import com.eienmosu.truthy.engine.Theme
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

class ComponentsSemanticsTest {
    @get:Rule
    val rule = createComposeRule()

    private fun show(content: @Composable () -> Unit) {
        rule.setContent { TruthyTheme(resolvedTheme(Theme.LIGHT)) { content() } }
    }

    @Test
    fun aPillTakesClicksAndIsNamedByItsLabel() {
        var clicks = 0
        show { PillButton("Next card", onClick = { clicks++ }) }
        rule.onNodeWithText("Next card").assertIsEnabled().assertHasClickAction().performClick()
        assertEquals(1, clicks)
    }

    @Test
    fun aDimmedPillIsDisabledAndIgnoresClicks() {
        var clicks = 0
        show { PillButton("Next card", onClick = { clicks++ }, dimmed = true) }
        rule.onNodeWithText("Next card").assertIsNotEnabled().performClick()
        assertEquals(0, clicks)
    }

    @Test
    fun aRoundButtonIsNamedByItsLabelNotByItsIcon() {
        var clicks = 0
        show { RoundButton("Leave round", onClick = { clicks++ }) { TruthyIcon(IconId.CLOSE) } }
        rule.onNodeWithContentDescription("Leave round").assertHasClickAction().performClick()
        assertEquals(1, clicks)
    }

    @Test
    fun theBackPillNamesItsDestination() {
        var clicks = 0
        show { BackPill("Back to areas", onClick = { clicks++ }) }
        rule.onNodeWithContentDescription("Back to areas").assertHasClickAction().performClick()
        assertEquals(1, clicks)
    }

    @Test
    fun aDeckCardIsOneButtonNamedByItsLabel() {
        var chosen = 0
        val label = "CLF, Cloud Practitioner, 214 cards, not started"
        show {
            DestinationCard(
                variant = DestinationVariant.DECK,
                name = "CLF",
                code = true,
                detail = "Cloud Practitioner",
                seenPercent = 0,
                stub = CardStub("Cards", "214"),
                label = label,
                onSelect = { chosen++ },
            )
        }
        rule.onNodeWithContentDescription(label).assertHasClickAction().performClick()
        assertEquals(1, chosen)
        // The visible texts are not separate nodes in the merged tree.
        rule.onNodeWithText("Cloud Practitioner").assertDoesNotExist()
    }

    @Test
    fun anUnavailableCardIsADisabledGroupWithNoClickAction() {
        val label = "Cloud, no decks yet"
        show {
            DestinationCard(
                variant = DestinationVariant.PLACE,
                name = "Cloud",
                sub = "No decks yet",
                label = label,
                unavailable = true,
            )
        }
        rule.onNodeWithContentDescription(label).assertHasNoClickAction().assertIsNotEnabled()
    }

    @Test
    fun theRecordStampIsOneElementNamedCorrectNewBest() {
        show { Stamp(StampVerdict.NEW_BEST) }
        rule.onNodeWithContentDescription("Correct. New best").assertExists()
    }

    @Test
    fun theTimedStubStampsAreNamedByTheirWords() {
        show { StubStamp(StubStampKind.TIME_UP) }
        rule.onNodeWithContentDescription("Time is up").assertExists()
    }

    // Spec 5.6: a ring for hardware keyboard focus, none after a touch. The quiet button has no shadow and no fill, so
    // the pixel 2 dp left of it is either the ring or the frame's own colour.
    @Test
    fun theFocusRingShowsForKeyboardFocusAndNotAfterATap() {
        val requester = FocusRequester()
        lateinit var inputMode: InputModeManager
        var frame = Color.Unspecified
        var ring = Color.Unspecified
        show {
            inputMode = LocalInputModeManager.current
            frame = TruthyTheme.colors.surfaceSunk
            ring = TruthyTheme.colors.focus
            Box(Modifier.testTag("frame").background(frame).padding(8.dp)) {
                QuietButton("Choose another route", onClick = {}, modifier = Modifier.focusRequester(requester))
            }
        }
        rule.runOnIdle {
            inputMode.requestInputMode(InputMode.Keyboard)
            requester.requestFocus()
        }
        rule.waitForIdle()
        assertTrue("no ring under keyboard focus", near(ring, pixelLeftOfButton()))
        // A real tap through the window manager: performClick dispatches inside the test, past the window manager, so
        // the window never enters touch mode and the input mode stays Keyboard.
        val button = rule.onNodeWithText("Choose another route").fetchSemanticsNode()
        realTap(button.positionOnScreen.x + button.size.width / 2f, button.positionOnScreen.y + button.size.height / 2f)
        rule.waitForIdle()
        assertTrue("a ring after a tap", near(frame, pixelLeftOfButton()))
    }

    private fun realTap(x: Float, y: Float) {
        val automation = InstrumentationRegistry.getInstrumentation().uiAutomation
        val downAt = SystemClock.uptimeMillis()
        val down = MotionEvent.obtain(downAt, downAt, MotionEvent.ACTION_DOWN, x, y, 0)
        down.source = InputDevice.SOURCE_TOUCHSCREEN
        automation.injectInputEvent(down, true)
        val up = MotionEvent.obtain(downAt, downAt + 20, MotionEvent.ACTION_UP, x, y, 0)
        up.source = InputDevice.SOURCE_TOUCHSCREEN
        automation.injectInputEvent(up, true)
        down.recycle()
        up.recycle()
    }

    // 6 dp from the frame's left edge is 2 dp outside the button: the middle of the ring's 2 dp stroke.
    private fun pixelLeftOfButton(): Color {
        val image = rule.onNodeWithTag("frame").captureToImage().toPixelMap()
        val x = with(rule.density) { 6.dp.roundToPx() }
        return image[x, image.height / 2]
    }

    private fun near(a: Color, b: Color): Boolean =
        abs(a.red - b.red) < 0.08f && abs(a.green - b.green) < 0.08f && abs(a.blue - b.blue) < 0.08f
}
