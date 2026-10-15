@file:OptIn(ExperimentalFoundationApi::class)

package com.eienmosu.truthy.round

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import com.eienmosu.truthy.design.IconId
import com.eienmosu.truthy.design.LocalReducedMotion
import com.eienmosu.truthy.design.Tokens
import com.eienmosu.truthy.design.TruthyIcon
import com.eienmosu.truthy.design.TruthyTheme
import com.eienmosu.truthy.design.TruthyType
import com.eienmosu.truthy.engine.Comparison
import com.eienmosu.truthy.engine.ResultCopy
import kotlin.math.max

/**
 * The score block of the result (ScoreBlock.tsx): the score and its unit on the left, the comparison with the record
 * on the right, bottom-aligned. Only the New best stamp may move under the score, when it does not fit beside it.
 */
@Composable
fun ScoreBlock(score: Int, copy: ResultCopy, comparison: Comparison, comparisonView: BringIntoViewRequester, modifier: Modifier = Modifier) {
    val colors = TruthyTheme.colors
    ScoreRow(
        wraps = comparison is Comparison.NewBest,
        modifier = modifier
            .fillMaxWidth()
            .padding(start = Tokens.Size.ticketInset, end = Tokens.Size.ticketInset, top = Tokens.Space.s14, bottom = Tokens.Space.s18),
        left = {
            Column(Modifier.semantics(mergeDescendants = true) {}) {
                BasicText(copy.scoreLabel, style = TruthyType.fieldLabel.copy(color = colors.inkMuted))
                Row(Modifier.padding(top = Tokens.Space.s4), horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s8)) {
                    BasicText("$score", style = TruthyType.score.copy(color = colors.ink), modifier = Modifier.alignByBaseline())
                    val unit = copy.unit
                    if (unit != null) {
                        BasicText(unit, style = TruthyType.scoreUnit.copy(color = colors.inkMuted), modifier = Modifier.alignByBaseline())
                    }
                }
            }
        },
        right = {
            Column(
                Modifier.bringIntoViewRequester(comparisonView).padding(bottom = Tokens.Space.s2),
                horizontalAlignment = Alignment.End,
            ) {
                val emphasis = TruthyType.emphasis.copy(color = colors.ink, textAlign = TextAlign.End)
                val best = TruthyType.monoData.copy(color = colors.inkMuted, textAlign = TextAlign.End)
                when (comparison) {
                    Comparison.First -> BasicText(ResultText.FIRST_ROUND, style = emphasis)
                    is Comparison.NewBest -> {
                        NewBestStamp(animate = true)
                        BasicText(ResultText.previousBest(copy.best(comparison.previousBest)), style = best, modifier = Modifier.padding(top = Tokens.Space.s10))
                    }
                    is Comparison.Equal -> {
                        BasicText(ResultText.EQUALS_BEST, style = emphasis)
                        BasicText(ResultText.best(copy.best(comparison.best)), style = best, modifier = Modifier.padding(top = Tokens.Space.s2))
                    }
                    is Comparison.Short -> {
                        BasicText(ResultText.shortOfBest(comparison.by), style = emphasis)
                        BasicText(ResultText.best(copy.best(comparison.best)), style = best, modifier = Modifier.padding(top = Tokens.Space.s2))
                    }
                }
            }
        },
    )
}

// Side by side when they fit (the comparison's text wraps in what is left); a New best stamp that does not fit beside
// the score moves under it, still at the right (ScoreBlock.tsx flex-wrap).
@Composable
private fun ScoreRow(wraps: Boolean, modifier: Modifier, left: @Composable () -> Unit, right: @Composable () -> Unit) {
    val gapX = Tokens.Space.s16
    val gapY = Tokens.Space.s10
    Layout(contents = listOf(left, right), modifier = modifier) { (leftMeasurables, rightMeasurables), constraints ->
        val width = constraints.maxWidth
        val gx = gapX.roundToPx()
        val gy = gapY.roundToPx()
        val loose = constraints.copy(minWidth = 0, minHeight = 0)
        val leftPlaceable = leftMeasurables.first().measure(loose)
        val rightMeasurable = rightMeasurables.first()
        val besideFits = !wraps || leftPlaceable.width + gx + rightMeasurable.maxIntrinsicWidth(loose.maxHeight) <= width
        if (besideFits) {
            val rightPlaceable = rightMeasurable.measure(loose.copy(maxWidth = (width - leftPlaceable.width - gx).coerceAtLeast(0)))
            val height = max(leftPlaceable.height, rightPlaceable.height)
            layout(width, height) {
                leftPlaceable.place(0, height - leftPlaceable.height)
                rightPlaceable.place(width - rightPlaceable.width, height - rightPlaceable.height)
            }
        } else {
            val rightPlaceable = rightMeasurable.measure(loose)
            val height = leftPlaceable.height + gy + rightPlaceable.height
            layout(width, height) {
                leftPlaceable.place(0, 0)
                rightPlaceable.place(width - rightPlaceable.width, leftPlaceable.height + gy)
            }
        }
    }
}

/** "New best" on the result (ScoreBlock.tsx): a double-ruled stamp in the correct colour that lands with the web's pose. */
@Composable
fun NewBestStamp(animate: Boolean, modifier: Modifier = Modifier) {
    val colors = TruthyTheme.colors
    val reduced = LocalReducedMotion.current
    val landing = remember { Animatable(if (animate && !reduced) 0f else 1f) }
    LaunchedEffect(Unit) {
        val stamp = Tokens.Transitions.stamp
        landing.animateTo(1f, tween(durationMillis = stamp.durationMs, delayMillis = stamp.delayMs, easing = stamp.easing))
    }
    val c = LeaveResultConstants
    val border = Tokens.Stroke.stamp
    val radius = Tokens.Radius.small
    Row(
        modifier
            .graphicsLayer {
                val t = landing.value
                alpha = t.coerceIn(0f, 1f)
                val scale = c.STAMP_LANDING_SCALE + (1f - c.STAMP_LANDING_SCALE) * t
                scaleX = scale
                scaleY = scale
                rotationZ = c.STAMP_LANDING_ROTATION + (c.STAMP_REST_ROTATION - c.STAMP_LANDING_ROTATION) * t
            }
            .drawBehind { drawDoubleBorder(colors.correct, border.toPx(), radius.toPx()) }
            .padding(border)
            .padding(start = Tokens.Space.s14, end = Tokens.Space.s14, top = Tokens.Space.s6, bottom = Tokens.Space.s4)
            .semantics(mergeDescendants = true) {},
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s8),
    ) {
        TruthyIcon(IconId.STAR, tint = colors.correct)
        BasicText(ResultText.NEW_BEST, style = TruthyType.stampBest.copy(color = colors.correct))
    }
}

// A CSS double border: two lines of a third of its width each, a third apart.
private fun DrawScope.drawDoubleBorder(color: Color, width: Float, radius: Float) {
    val line = width / 3f
    for (inset in listOf(line / 2f, width - line / 2f)) {
        drawRoundRect(
            color = color,
            topLeft = Offset(inset, inset),
            size = Size(size.width - 2 * inset, size.height - 2 * inset),
            cornerRadius = CornerRadius((radius - inset).coerceAtLeast(0f)),
            style = Stroke(width = line),
        )
    }
}
