package com.eienmosu.truthy.design

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.eienmosu.truthy.engine.logoMarkHeight

/** The app's name (reference 4.5). */
const val APP_NAME = "Truthy"

/** components/Logo.tsx: the ticket, the tear line and the check, in a 44 by 30 box. */
object LogoPaths {
    const val TICKET =
        "M6 0H38A6 6 0 0 1 44 6V10.5A4.5 4.5 0 0 0 44 19.5V24A6 6 0 0 1 38 30H6A6 6 0 0 1 0 24V19.5A4.5 4.5 0 0 0 0 10.5V6A6 6 0 0 1 6 0Z"
    const val TEAR = "M33 5v20"
    const val CHECK = "M9 15.5l4.5 4.5 9-10"
    const val WIDTH = 44f
    const val HEIGHT = 30f
    const val TEAR_STROKE = 1.6f
    const val TEAR_DASH_ON = 2.5f
    const val TEAR_DASH_OFF = 3f
    const val CHECK_STROKE = 3f
    const val COMPACT_CHECK_STROKE = 3.4f
}

enum class LogoVariant { FULL, COMPACT }

/**
 * The ticket mark on its own, always decorative. FULL: an accent ticket with the tear line and the check in on-accent
 * (44 wide beside the wordmark, 26 on the continue line). COMPACT: an on-accent ticket with an accent check and no tear
 * line (20 wide on the compact pass band). The tear line is drawn here because a vector cannot dash.
 */
@Composable
fun LogoMark(
    modifier: Modifier = Modifier,
    width: Dp = LogoPaths.WIDTH.dp,
    variant: LogoVariant = LogoVariant.FULL,
) {
    val colors = TruthyTheme.colors
    val ticket = remember { PathParser().parsePathString(LogoPaths.TICKET).toPath() }
    val check = remember { PathParser().parsePathString(LogoPaths.CHECK).toPath() }
    val height = logoMarkHeight(width.value.toDouble()).toFloat().dp
    Canvas(modifier.size(width, height)) {
        val k = size.width / LogoPaths.WIDTH
        withTransform({ scale(k, k, pivot = Offset.Zero) }) {
            if (variant == LogoVariant.FULL) {
                drawPath(ticket, colors.accent)
                drawLine(
                    colors.onAccent,
                    Offset(33f, 5f),
                    Offset(33f, 25f),
                    strokeWidth = LogoPaths.TEAR_STROKE,
                    cap = StrokeCap.Round,
                    pathEffect = PathEffect.dashPathEffect(floatArrayOf(LogoPaths.TEAR_DASH_ON, LogoPaths.TEAR_DASH_OFF)),
                )
                drawPath(
                    check,
                    colors.onAccent,
                    style = Stroke(LogoPaths.CHECK_STROKE, cap = StrokeCap.Round, join = StrokeJoin.Round),
                )
            } else {
                drawPath(ticket, colors.onAccent)
                drawPath(
                    check,
                    colors.accent,
                    style = Stroke(LogoPaths.COMPACT_CHECK_STROKE, cap = StrokeCap.Round, join = StrokeJoin.Round),
                )
            }
        }
    }
}

/** The mark, a 12 gap (0.3333 of the 36 type size) and "Truthy" in the logo role. Start step 1 passes asHeading. */
@Composable
fun Logo(modifier: Modifier = Modifier, asHeading: Boolean = false) {
    Row(
        modifier = if (asHeading) modifier.semantics { heading() } else modifier,
        horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s12),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        LogoMark()
        // The web nudges the word down by 0.1111 of the type size (4) so it sits on the mark's centre line.
        TruthyText(APP_NAME, TruthyType.logo, TruthyTheme.colors.ink, Modifier.padding(top = Tokens.Space.s4))
    }
}
