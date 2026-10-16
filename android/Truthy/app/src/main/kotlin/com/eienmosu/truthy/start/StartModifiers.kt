package com.eienmosu.truthy.start

import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import com.eienmosu.truthy.design.FocusRingSpec
import com.eienmosu.truthy.design.Tokens
import com.eienmosu.truthy.design.borderPx
import com.eienmosu.truthy.design.keyboardFocusRing
import com.eienmosu.truthy.design.rememberPressTint
import com.eienmosu.truthy.engine.FADE_PX

/** A field of the pass that returns to its step (FillInPass.tsx:85-86, :204): radius 6, task 10's press tint, its full-sentence label. */
@Composable
fun Modifier.wayBack(label: String, onClick: () -> Unit): Modifier {
    val source = remember { MutableInteractionSource() }
    val tint = rememberPressTint(StartGeometry.wayBackRadius)
    return this
        // Reference 5.0: the focus ring sits 2 inside a pass field (hardware keyboard only, task 10).
        .keyboardFocusRing(RoundedCornerShape(StartGeometry.wayBackRadius), FocusRingSpec.INSET)
        .clip(RoundedCornerShape(StartGeometry.wayBackRadius))
        .clickable(interactionSource = source, indication = tint, role = Role.Button, onClick = onClick)
        .clearAndSetSemantics {
            contentDescription = label
            role = Role.Button
        }
}

/** Draws a part where its layer says: moved by `offsetY` dp (a placement, so measured positions follow it) and faded to `alpha`. */
fun Modifier.moved(layer: Layer): Modifier = this
    .offset { IntOffset(0, layer.offsetY.dp.roundToPx()) }
    .graphicsLayer { alpha = layer.alpha }

/** The 1.5 rule on the start side of a grid cell (FillInPass.tsx:182, :301), as wide as the browser draws it (borderPx). */
fun Modifier.ruleStart(color: Color): Modifier = this.drawBehind {
    val width = borderPx(Tokens.Stroke.rule)
    drawLine(color, start = Offset(width / 2f, 0f), end = Offset(width / 2f, size.height), strokeWidth = width)
}

/** The rules above and below the ready pass's Class, Cards and Gate (FillInPass.tsx:297), as wide as the browser draws them. */
fun Modifier.ruleTopBottom(color: Color): Modifier = this.drawBehind {
    val width = borderPx(Tokens.Stroke.rule)
    drawLine(color, start = Offset(0f, width / 2f), end = Offset(size.width, width / 2f), strokeWidth = width)
    drawLine(color, start = Offset(0f, size.height - width / 2f), end = Offset(size.width, size.height - width / 2f), strokeWidth = width)
}

/** StartFlow.tsx:1081: while more lies below, the list fades out over 28 at its bottom, ending `liftDp` above the edge (listCue). */
fun Modifier.fadeBottom(liftDp: Float, ink: Color): Modifier = this
    .graphicsLayer { compositingStrategy = CompositingStrategy.Offscreen }
    .drawWithContent {
        drawContent()
        val end = size.height - liftDp.dp.toPx()
        val start = end - FADE_PX.toFloat().dp.toPx()
        drawRect(
            brush = Brush.verticalGradient(listOf(ink, ink.copy(alpha = 0f)), startY = start, endY = end),
            blendMode = BlendMode.DstIn,
        )
    }

/** A pass value: reports where it is laid out and how it looks, and hides while a copy of it travels (FillInPass.tsx:51-55). */
fun Modifier.travelSpot(travels: Travels, key: SpotKey, text: String, style: TextStyle, color: Color, right: Boolean): Modifier = this
    .onGloballyPositioned { travels.report(key, Spot(text, style, color, it.boundsInRoot(), right)) }
    .graphicsLayer { alpha = if (key.field in travels.hiddenFields) 0f else 1f }
