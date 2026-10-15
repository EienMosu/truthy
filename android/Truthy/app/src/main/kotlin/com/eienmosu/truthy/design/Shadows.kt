package com.eienmosu.truthy.design

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.ClipOp
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Dp
import kotlin.math.abs
import kotlin.math.exp
import kotlin.math.max
import kotlin.math.sqrt

/** One rounded rectangle of a shadow's stack: how far it is grown (negative: shrunk) and its alpha. */
data class ShadowPass(val expand: Float, val alpha: Float)

/** A shadow layer's rectangle in the element's coordinates. */
data class ShadowRect(val left: Float, val top: Float, val right: Float, val bottom: Float, val cornerRadius: Float)

object ShadowMath {
    const val PASS_COUNT = 14
    const val SIGMA_SPAN = 2.0

    /** The standard normal distribution function (Abramowitz and Stegun 7.1.26, error below 1.5e-7). */
    fun normalCdf(z: Double): Double {
        val x = abs(z) / sqrt(2.0)
        val t = 1.0 / (1.0 + 0.3275911 * x)
        val polynomial = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))))
        val erf = 1.0 - polynomial * exp(-x * x)
        return if (z >= 0.0) 0.5 * (1.0 + erf) else 0.5 * (1.0 - erf)
    }

    /**
     * The stack for a blur of [blur] (the CSS blur radius, so sigma is blur / 2) and a colour alpha of [alpha], outermost
     * first. A rectangle grown by e covers every point whose distance outside the shadow rectangle is at most e. The point
     * in the band between two neighbouring rectangles is covered by all the rectangles outside it, so each alpha is chosen
     * to bring the running total to alpha * normalCdf(-distance / sigma) at the middle of its band, and the innermost to
     * the full alpha.
     */
    fun passes(blur: Float, alpha: Float, count: Int = PASS_COUNT): List<ShadowPass> {
        if (blur <= 0f || alpha <= 0f) return listOf(ShadowPass(0f, alpha))
        val sigma = blur / 2.0
        val span = SIGMA_SPAN * sigma
        val edges = DoubleArray(count) { k -> span - 2.0 * span * k / (count - 1) }
        val result = ArrayList<ShadowPass>(count)
        var covered = 0.0
        for (j in 0 until count) {
            val target = if (j == count - 1) {
                alpha.toDouble()
            } else {
                alpha * normalCdf(-((edges[j] + edges[j + 1]) / 2.0) / sigma)
            }
            val own = 1.0 - (1.0 - target) / (1.0 - covered)
            result += ShadowPass(edges[j].toFloat(), own.coerceIn(0.0, 1.0).toFloat())
            covered = target
        }
        return result
    }

    /**
     * CSS: the shadow rectangle is the border box grown by [spread] and moved by the offset; the corner radius grows
     * with the spread and never goes below 0.
     */
    fun rect(width: Float, height: Float, cornerRadius: Float, offsetX: Float, offsetY: Float, spread: Float): ShadowRect =
        ShadowRect(
            left = -spread + offsetX,
            top = -spread + offsetY,
            right = width + spread + offsetX,
            bottom = height + spread + offsetY,
            cornerRadius = max(0f, cornerRadius + spread),
        )
}

private class ShadowPlan(val layer: ShadowLayer, val passes: List<ShadowPass>)

/**
 * Draws [spec] behind the element, whose paper has corner radius [cornerRadius]. [alpha] scales the whole shadow, read
 * while drawing (the pill cross-fades its button shadow into its press shadow with it). As in CSS, nothing is painted
 * inside the element's own border box, so a notch of the paper shows what is behind it.
 */
@Composable
fun Modifier.truthyShadow(
    spec: ShadowSpec,
    cornerRadius: Dp = Tokens.Radius.card,
    alpha: () -> Float = { 1f },
): Modifier {
    val density = LocalDensity.current.density
    val plans = remember(spec, density) {
        spec.layers.map { layer -> ShadowPlan(layer, ShadowMath.passes(layer.blur.value * density, layer.color.alpha)) }
    }
    return drawBehind {
        val scale = alpha()
        if (scale <= 0f) return@drawBehind
        val own = Path().apply { addRoundRect(RoundRect(0f, 0f, size.width, size.height, CornerRadius(cornerRadius.toPx()))) }
        clipPath(own, clipOp = ClipOp.Difference) {
            for (plan in plans) {
                val layer = plan.layer
                val rect = ShadowMath.rect(
                    size.width,
                    size.height,
                    cornerRadius.toPx(),
                    layer.offsetX.toPx(),
                    layer.offsetY.toPx(),
                    layer.spread.toPx(),
                )
                for (pass in plan.passes) {
                    val width = rect.right - rect.left + 2f * pass.expand
                    val height = rect.bottom - rect.top + 2f * pass.expand
                    if (width <= 0f || height <= 0f) continue
                    drawRoundRect(
                        color = layer.color.copy(alpha = pass.alpha * scale),
                        topLeft = Offset(rect.left - pass.expand, rect.top - pass.expand),
                        size = Size(width, height),
                        cornerRadius = CornerRadius(max(0f, rect.cornerRadius + pass.expand)),
                    )
                }
            }
        }
    }
}
