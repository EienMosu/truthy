package com.eienmosu.truthy.design

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.widthIn
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp

/** The padding of a screen's 430 column: top, bottom and the two sides (start and end in layout direction). */
data class FrameInsets(val top: Dp, val bottom: Dp, val start: Dp, val end: Dp)

/**
 * Spec 5.6: the larger of the system inset and 52 / 34 (8 / 12 under 568 tall, app/globals.css:29 "short", all three
 * from plan A's native group); the sides are the 16 gutter plus the side inset. Pure, so FrameInsetsTest pins it on the JVM.
 */
fun frameInsets(systemTop: Dp, systemBottom: Dp, systemStart: Dp, systemEnd: Dp, windowHeight: Dp): FrameInsets {
    val short = windowHeight < Tokens.Native.shortScreenBelow
    return FrameInsets(
        top = maxOf(systemTop, if (short) Tokens.Native.shortSafeTop else Tokens.Size.safeTop),
        bottom = maxOf(systemBottom, if (short) Tokens.Native.shortSafeBottom else Tokens.Size.safeBottom),
        start = Tokens.Size.gutter + systemStart,
        end = Tokens.Size.gutter + systemEnd,
    )
}

/** The frame insets of the current window, from the safe drawing insets (bars, cutout, IME). */
@Composable
fun rememberFrameInsets(): FrameInsets {
    val density = LocalDensity.current
    val direction = LocalLayoutDirection.current
    val safe = WindowInsets.safeDrawing
    val height = LocalConfiguration.current.screenHeightDp.dp
    return with(density) {
        val left = safe.getLeft(this, direction).toDp()
        val right = safe.getRight(this, direction).toDp()
        val rtl = direction == LayoutDirection.Rtl
        frameInsets(
            systemTop = safe.getTop(this).toDp(),
            systemBottom = safe.getBottom(this).toDp(),
            systemStart = if (rtl) right else left,
            systemEnd = if (rtl) left else right,
            windowHeight = height,
        )
    }
}

/**
 * A screen's frame: a column at most 430 wide, centred, padded by [rememberFrameInsets]. The caller draws the sky (or
 * the scrim) behind it; the frame draws nothing itself.
 */
@Composable
fun TruthyFrame(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    val insets = rememberFrameInsets()
    Box(modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
        Column(
            Modifier
                .fillMaxHeight()
                .widthIn(max = Tokens.Size.maxWidth)
                .fillMaxWidth()
                .padding(start = insets.start, end = insets.end, top = insets.top, bottom = insets.bottom),
            content = content,
        )
    }
}
