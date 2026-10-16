package com.eienmosu.truthy.design

import android.graphics.BlurMaskFilter
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.CacheDrawScope
import androidx.compose.ui.draw.DrawResult
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Canvas
import androidx.compose.ui.graphics.ClipOp
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.ImageBitmapConfig
import androidx.compose.ui.graphics.Paint
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import kotlin.math.ceil
import kotlin.math.max

/** A shadow layer's rectangle in the element's coordinates. */
data class ShadowRect(val left: Float, val top: Float, val right: Float, val bottom: Float, val cornerRadius: Float)

/** Where a blurred layer's bitmap lies, in the element's pixels, and how it is rendered (shadowPlan). */
data class ShadowPlan(
    /** The bitmap's top left corner and the area it covers, in the element's pixels: the shadow rectangle grown by the blur's reach. */
    val left: Float,
    val top: Float,
    val width: Float,
    val height: Float,
    /** The bitmap is rendered this much smaller and drawn scaled up by its inverse. */
    val scale: Float,
    /** The bitmap's size in its own pixels: the area times the scale, rounded up (the extra edge is empty). */
    val bitmapWidth: Int,
    val bitmapHeight: Int,
    /** BlurMaskFilter's radius in the bitmap's pixels: a Gaussian of the CSS sigma times the scale. */
    val maskRadius: Float,
)

object ShadowMath {
    /** Skia, and so Android's BlurMaskFilter, turns a blur radius r into a Gaussian of sigma 0.57735 r + 0.5. */
    const val SKIA_SIGMA_PER_RADIUS = 0.57735f
    const val SKIA_SIGMA_OFFSET = 0.5f

    /** How far the drawn shadow reaches past its rectangle, in sigmas: past 3 a Gaussian edge is below 0.14 % of its alpha. */
    const val SIGMA_REACH = 3f

    /**
     * A blur wider than this many pixels of sigma is rendered smaller, at the scale that brings its sigma down to it, and
     * drawn scaled up with bilinear filtering: a Gaussian that wide has nothing finer than the scaled pixel, and the
     * bitmap of the ticket's shadow is then about 200 by 300 pixels instead of 1200 by 1800.
     */
    const val SMALL_SIGMA = 8f

    /** CSS: a box shadow's blur radius is twice the Gaussian's standard deviation. */
    fun sigma(blurPx: Float): Float = blurPx / 2f

    /** The BlurMaskFilter radius that gives a Gaussian of [sigma] pixels; 0 where Skia cannot blur that little. */
    fun maskRadius(sigma: Float): Float = max(0f, (sigma - SKIA_SIGMA_OFFSET) / SKIA_SIGMA_PER_RADIUS)

    /** The scale a blur of [sigma] pixels is rendered at: 1, or what brings the sigma down to SMALL_SIGMA. */
    fun scale(sigma: Float): Float = if (sigma <= SMALL_SIGMA) 1f else SMALL_SIGMA / sigma

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

    /** The bitmap for [rect] blurred by a CSS blur of [blurPx] pixels (blur > 0). */
    fun plan(rect: ShadowRect, blurPx: Float): ShadowPlan {
        val sigma = sigma(blurPx)
        val reach = SIGMA_REACH * sigma
        val width = rect.right - rect.left + 2f * reach
        val height = rect.bottom - rect.top + 2f * reach
        val scale = scale(sigma)
        return ShadowPlan(
            left = rect.left - reach,
            top = rect.top - reach,
            width = width,
            height = height,
            scale = scale,
            bitmapWidth = max(1, ceil(width * scale).toInt()),
            bitmapHeight = max(1, ceil(height * scale).toInt()),
            maskRadius = maskRadius(sigma * scale),
        )
    }
}

/** The shadow rectangle of [rect] blurred in an alpha bitmap laid out by [plan]: a true Gaussian, as the browser's. */
private fun blurredMask(rect: ShadowRect, plan: ShadowPlan): ImageBitmap {
    val image = ImageBitmap(plan.bitmapWidth, plan.bitmapHeight, ImageBitmapConfig.Alpha8)
    val paint = Paint().apply {
        color = Color.Black
        isAntiAlias = true
    }
    if (plan.maskRadius > 0f) paint.asFrameworkPaint().maskFilter = BlurMaskFilter(plan.maskRadius, BlurMaskFilter.Blur.NORMAL)
    val s = plan.scale
    val radius = rect.cornerRadius * s
    Canvas(image).drawRoundRect(
        left = (rect.left - plan.left) * s,
        top = (rect.top - plan.top) * s,
        right = (rect.right - plan.left) * s,
        bottom = (rect.bottom - plan.top) * s,
        radiusX = radius,
        radiusY = radius,
        paint = paint,
    )
    return image
}

private class LayerDrawing(val color: Color, val rect: ShadowRect, val plan: ShadowPlan?, val mask: ImageBitmap?)

/**
 * Draws [spec] behind the element, whose paper has corner radius [cornerRadius]. [alpha] scales the whole shadow, read
 * while drawing (the pill cross-fades its button shadow into its press shadow with it). As in CSS, nothing is painted
 * inside the element's own border box, so a notch of the paper shows what is behind it. Each blurred layer is a Gaussian
 * of the CSS sigma rendered once per size into an alpha bitmap (review X5: the stack of 14 rectangles it replaces drew
 * flat bands with hard steps at density 2.625).
 */
@Composable
fun Modifier.truthyShadow(
    spec: ShadowSpec,
    cornerRadius: Dp = Tokens.Radius.card,
    alpha: () -> Float = { 1f },
): Modifier {
    // One drawing per spec and radius: a recomposition of the caller keeps the bitmaps; a new size renders them again.
    val currentAlpha = rememberUpdatedState(alpha)
    val build = remember(spec, cornerRadius) { shadowDrawing(spec, cornerRadius) { currentAlpha.value() } }
    return drawWithCache(build)
}

private fun shadowDrawing(spec: ShadowSpec, cornerRadius: Dp, alpha: () -> Float): CacheDrawScope.() -> DrawResult = {
    val radius = cornerRadius.toPx()
    val own = Path().apply { addRoundRect(RoundRect(0f, 0f, size.width, size.height, CornerRadius(radius))) }
    val layers = spec.layers.map { layer ->
        val rect = ShadowMath.rect(size.width, size.height, radius, layer.offsetX.toPx(), layer.offsetY.toPx(), layer.spread.toPx())
        val blur = layer.blur.toPx()
        val drawable = rect.right > rect.left && rect.bottom > rect.top
        val plan = if (blur > 0f && drawable) ShadowMath.plan(rect, blur) else null
        LayerDrawing(layer.color, rect, plan, plan?.let { blurredMask(rect, it) })
    }
    onDrawBehind {
        val strength = alpha()
        if (strength <= 0f) return@onDrawBehind
        clipPath(own, clipOp = ClipOp.Difference) {
            for (layer in layers) {
                val plan = layer.plan
                val mask = layer.mask
                if (plan == null || mask == null) {
                    val rect = layer.rect
                    if (rect.right <= rect.left || rect.bottom <= rect.top) continue
                    drawRoundRect(
                        color = layer.color.copy(alpha = layer.color.alpha * strength),
                        topLeft = Offset(rect.left, rect.top),
                        size = Size(rect.right - rect.left, rect.bottom - rect.top),
                        cornerRadius = CornerRadius(rect.cornerRadius),
                    )
                    continue
                }
                // The bitmap's pixels are the element's at plan.scale: drawn back at its inverse, bilinear.
                withTransform({
                    translate(plan.left, plan.top)
                    scale(1f / plan.scale, 1f / plan.scale, pivot = Offset.Zero)
                }) {
                    drawImage(
                        image = mask,
                        srcOffset = IntOffset.Zero,
                        srcSize = IntSize(plan.bitmapWidth, plan.bitmapHeight),
                        dstOffset = IntOffset.Zero,
                        dstSize = IntSize(plan.bitmapWidth, plan.bitmapHeight),
                        alpha = strength,
                        colorFilter = ColorFilter.tint(layer.color),
                        filterQuality = FilterQuality.Low,
                    )
                }
            }
        }
    }
}
