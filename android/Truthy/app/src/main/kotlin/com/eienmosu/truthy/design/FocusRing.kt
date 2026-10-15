package com.eienmosu.truthy.design

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.drawOutline
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.input.InputMode
import androidx.compose.ui.platform.LocalInputModeManager
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** Reference 5.0, focus: an ink ring 2 wide, 2 outside the control; -2 (inside) on the pass fields and the ticket. */
object FocusRingSpec {
    val WIDTH = 2.dp
    val OFFSET = 2.dp
    val INSET = (-2).dp
}

/**
 * Draws the focus ring around [shape] while this control has focus and a hardware keyboard drives the input mode,
 * never after a touch. Place it before the control's clip and before its clickable or focusable, so it sees the focus
 * and draws outside the clipped content.
 */
@Composable
fun Modifier.keyboardFocusRing(shape: Shape, offset: Dp = FocusRingSpec.OFFSET): Modifier {
    var focused by remember { mutableStateOf(false) }
    val keyboard = LocalInputModeManager.current.inputMode == InputMode.Keyboard
    val ring = TruthyTheme.colors.focus
    return this
        .onFocusChanged { focused = it.isFocused }
        .drawWithContent {
            drawContent()
            if (focused && keyboard) {
                val o = offset.toPx()
                val outline = shape.createOutline(Size(size.width + 2 * o, size.height + 2 * o), layoutDirection, this)
                translate(-o, -o) { drawOutline(outline, ring, style = Stroke(FocusRingSpec.WIDTH.toPx())) }
            }
        }
}
