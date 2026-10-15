package com.eienmosu.truthy.round

import android.os.SystemClock
import android.view.InputDevice
import android.view.MotionEvent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.SemanticsNodeInteractionsProvider
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.Dp
import androidx.test.platform.app.InstrumentationRegistry
import com.eienmosu.truthy.design.TruthyTheme
import com.eienmosu.truthy.design.resolvedTheme
import com.eienmosu.truthy.engine.Theme
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue

/** The day theme around a test's content. */
@Composable
fun Themed(content: @Composable () -> Unit) {
    TruthyTheme(resolvedTheme(Theme.LIGHT), content)
}

/** The content laid out at a given logical size and font scale (spec 7.4 sizes; README Review Focus 4 at 2f). */
@Composable
fun AtSize(width: Dp, height: Dp, fontScale: Float, content: @Composable () -> Unit) {
    val density = LocalDensity.current
    CompositionLocalProvider(LocalDensity provides Density(density.density, fontScale)) {
        Box(Modifier.requiredSize(width, height)) { content() }
    }
}

/** Fails when any text node's layout overflows its box: text must grow or scroll, never clip (spec 5.6). */
fun SemanticsNodeInteractionsProvider.assertNoClippedText() {
    val nodes = onAllNodes(SemanticsMatcher.keyIsDefined(SemanticsActions.GetTextLayoutResult), useUnmergedTree = true).fetchSemanticsNodes()
    assertTrue("no text was laid out", nodes.isNotEmpty())
    for (node in nodes) {
        val layouts = mutableListOf<TextLayoutResult>()
        node.config[SemanticsActions.GetTextLayoutResult].action?.invoke(layouts)
        // A text node hugs its longest line (Compose UI 1.12), so hasVisualOverflow is true for any line shorter than the
        // constraint; a text clips only when a line is wider than its node (1 px of rounding allowed) or the lines are taller.
        for (layout in layouts) assertFalse("clipped: ${layout.layoutInput.text}", (layout.didOverflowHeight || (0 until layout.lineCount).any { layout.getLineRight(it) - layout.getLineLeft(it) > layout.size.width + 1f }))
    }
}

/** A tap at a screen position, through the window manager: it reaches the top window (the sheet's scrim when open). */
fun injectTap(x: Float, y: Float) {
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

/** A tap halfway between the top of the screen and the top of the node with `tag`: on the scrim above the sheet card. */
fun SemanticsNodeInteractionsProvider.tapAbove(tag: String) {
    val node = onNodeWithTag(tag).fetchSemanticsNode()
    injectTap(node.positionOnScreen.x + node.size.width / 2f, node.positionOnScreen.y / 2f)
}
