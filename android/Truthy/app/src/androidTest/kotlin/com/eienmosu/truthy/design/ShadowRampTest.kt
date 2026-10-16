package com.eienmosu.truthy.design

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * Review X5: the shadows were stepped, flat bands of one colour with hard steps between them (10 levels at a step under
 * the ticket at density 2.625). A Gaussian edge changes by at most about one level a pixel there: the ramp under and
 * beside a ticket-sized paper has no step between neighbouring pixels of more than 3 levels, and it is there (it darkens
 * the white by more than 40 levels under the paper).
 */
@RunWith(AndroidJUnit4::class)
class ShadowRampTest {
    @get:Rule val rule = createComposeRule()

    private fun ramp(spec: ShadowSpec, widthDp: Int, heightDp: Int, maxStep: Int, minDepth: Int) {
        var paper = androidx.compose.ui.geometry.Rect.Zero
        rule.setContent {
            Box(Modifier.fillMaxSize().background(Color.White), contentAlignment = Alignment.TopCenter) {
                Box(
                    Modifier
                        .size(widthDp.dp, heightDp.dp)
                        .onGloballyPositioned { paper = it.boundsInRoot() }
                        .truthyShadow(spec, Tokens.Radius.card)
                        .background(Color.White),
                )
            }
        }
        rule.waitForIdle()
        val pixels = rule.onRoot().captureToImage().toPixelMap()
        val density = rule.density.density
        val reach = (80 * density).roundToInt()
        val red = { x: Int, y: Int -> (pixels[x, y].red * 255f).roundToInt() }

        val centre = paper.center.x.roundToInt()
        // Under the paper, past the first layer's crisp 1 dp line (0 1 0 0), which the web draws too.
        val lineEnd = paper.bottom.roundToInt() + (1 * density).roundToInt() + 2
        val under = (lineEnd until minOf(pixels.height, paper.bottom.roundToInt() + reach)).map { red(centre, it) }
        val middle = paper.center.y.roundToInt()
        val beside = (paper.right.roundToInt() + 1 until minOf(pixels.width, paper.right.roundToInt() + reach)).map { red(it, middle) }

        for ((name, line) in listOf("under" to under, "beside" to beside)) {
            val steps = line.zipWithNext { a, b -> abs(a - b) }
            val worst = steps.maxOrNull() ?: 0
            assertTrue("$name: a step of $worst levels between neighbouring pixels: $line", worst <= maxStep)
        }
        val depth = 255 - under.minOrNull()!!
        assertTrue("under: only $depth levels of shadow", depth >= minDepth)
        assertTrue("under: the ramp ends in white", 255 - under.last() <= 1)
        assertTrue("beside: the ramp ends in white", 255 - beside.last() <= 1)
        // Darkest by the paper, lighter going out: never darker again by more than a level.
        for ((name, line) in listOf("under" to under, "beside" to beside)) {
            var lightest = 0
            line.forEach { value ->
                assertTrue("$name: darker again after $lightest: $line", value >= lightest - 1)
                lightest = max(lightest, value)
            }
        }
    }

    @Test fun theTicketShadowIsASmoothRamp() = ramp(Tokens.Shadows.day.ticket, 300, 400, maxStep = 3, minDepth = 40)

    @Test fun theSmallShadowIsASmoothRamp() = ramp(Tokens.Shadows.day.small, 300, 117, maxStep = 6, minDepth = 20)
}
