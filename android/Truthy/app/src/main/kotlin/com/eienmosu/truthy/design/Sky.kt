package com.eienmosu.truthy.design

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.graphics.vector.rememberVectorPainter
import androidx.compose.ui.unit.dp
import kotlin.math.min

/** Top of the lower cloud in dp: 620 on the game and result screens, 660 in the start flow (under its foot zone). */
enum class LowerCloud(val top: Float) { GAME(620f), START(660f) }

data class CloudRect(val x: Float, val y: Float, val width: Float, val height: Float)

/** components/SkyBackdrop.tsx and reference 5.1: the stops and the two clouds, in dp inside the 430 frame. */
object SkyGeometry {
    // The gradient's stops are Tokens.Native.skyStops (plan A's native group), not a constant here.

    private const val UPPER_LEFT = -30f
    private const val UPPER_TOP = 196f
    private const val UPPER_WIDTH = 150f
    private const val UPPER_HEIGHT = 46f
    private const val LOWER_RIGHT = -40f
    private const val LOWER_WIDTH = 170f
    private const val LOWER_HEIGHT = 50f

    private fun frameLeft(viewportWidth: Float, frameMax: Float) = (viewportWidth - min(viewportWidth, frameMax)) / 2f

    fun upper(viewportWidth: Float, frameMax: Float): CloudRect =
        CloudRect(frameLeft(viewportWidth, frameMax) + UPPER_LEFT, UPPER_TOP, UPPER_WIDTH, UPPER_HEIGHT)

    fun lower(viewportWidth: Float, frameMax: Float, top: Float): CloudRect {
        val frameRight = frameLeft(viewportWidth, frameMax) + min(viewportWidth, frameMax)
        return CloudRect(frameRight - LOWER_RIGHT - LOWER_WIDTH, top, LOWER_WIDTH, LOWER_HEIGHT)
    }
}

/**
 * The calm ground of every screen: the four sky colours blended from top to bottom and two clouds. As wide and as tall as
 * its parent (put it first in a full-screen Box); the clouds stay inside the 430 wide frame. It takes no touches and has
 * no accessibility semantics.
 */
@Composable
fun SkyBackdrop(modifier: Modifier = Modifier, lowerCloud: LowerCloud = LowerCloud.GAME) {
    val colors = TruthyTheme.colors
    val sky = remember(colors) {
        val tones = listOf(colors.sky1, colors.sky2, colors.sky3, colors.sky4)
        val stops = Array(tones.size) { i -> Tokens.Native.skyStops[i] to tones[i] }
        Brush.verticalGradient(*stops)
    }
    val painter = rememberVectorPainter(remember { iconVector(IconId.SKY_CLOUD) })
    BoxWithConstraints(modifier.fillMaxSize().background(sky)) {
        val frameMax = Tokens.Size.maxWidth.value
        val upper = SkyGeometry.upper(maxWidth.value, frameMax)
        val lower = SkyGeometry.lower(maxWidth.value, frameMax, lowerCloud.top)
        val tint = ColorFilter.tint(colors.cloud)
        Image(
            painter = painter,
            contentDescription = null,
            modifier = Modifier.offset(upper.x.dp, upper.y.dp).size(upper.width.dp, upper.height.dp),
            contentScale = ContentScale.FillBounds,
            alpha = Tokens.Opacity.cloud,
            colorFilter = tint,
        )
        Image(
            painter = painter,
            contentDescription = null,
            modifier = Modifier.offset(lower.x.dp, lower.y.dp).size(lower.width.dp, lower.height.dp),
            contentScale = ContentScale.FillBounds,
            alpha = Tokens.Opacity.cloud,
            colorFilter = tint,
        )
    }
}
