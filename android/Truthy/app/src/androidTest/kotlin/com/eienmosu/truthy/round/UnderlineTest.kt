package com.eienmosu.truthy.round

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PixelMap
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.eienmosu.truthy.design.TruthyTheme
import com.eienmosu.truthy.engine.Answered
import com.eienmosu.truthy.engine.MissedCard
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * The underlines of "Why" and the source links (BoardingPass.tsx, MissedCards.tsx: decoration-[1.5px]
 * underline-offset-[3px]): a 1.5 line whose top is 3 below the baseline, clear of the descenders, as the browser draws
 * it. The font's own underline (TextDecoration.Underline) was 1.1 thick and 1.2 below the baseline, through the
 * descenders. At font scale 2 both grow with the text, so the line stays clear of the descenders.
 */
@RunWith(AndroidJUnit4::class)
class UnderlineTest {
    @get:Rule val rule = createComposeRule()

    private val missed = MissedCard(
        number = 3,
        given = true,
        answer = false,
        appliesTo = null,
        statement = "Statement 3",
        explanation = "Explanation 3",
        source = TestRounds.card(3).source,
    )

    private var ink = Color.Unspecified

    private fun show(fontScale: Float, content: @androidx.compose.runtime.Composable () -> Unit) {
        rule.setContent {
            Themed {
                ink = TruthyTheme.colors.trueColor
                AtSize(412.dp, 915.dp, fontScale) {
                    Box(Modifier.fillMaxSize().background(Color.White)) { content() }
                }
            }
        }
        rule.waitForIdle()
    }

    /** A line's measures in pixels: its top under the baseline and its thickness. */
    private class Measured(val gap: Float, val thickness: Float)

    private fun coverage(pixels: PixelMap, x: Int, y: Int): Float {
        val c = pixels[x, y]
        val dr = 1f - ink.red
        val dg = 1f - ink.green
        val db = 1f - ink.blue
        val t = ((1f - c.red) * dr + (1f - c.green) * dg + (1f - c.blue) * db) / (dr * dr + dg * dg + db * db)
        return t.coerceIn(0f, 1f)
    }

    /**
     * The underline in the node's bounds: the rows whose longest run of ink is the widest (the line), the text above it
     * over the first 60 % of the line (no descender there in "Why" or "Source 3").
     */
    private fun measure(node: SemanticsNodeInteraction): Measured {
        val pixels = rule.onRoot().captureToImage().toPixelMap()
        val b: Rect = node.fetchSemanticsNode().boundsInRoot
        val left = b.left.roundToInt().coerceAtLeast(0)
        val right = b.right.roundToInt().coerceAtMost(pixels.width)
        val top = b.top.roundToInt().coerceAtLeast(0)
        val bottom = b.bottom.roundToInt().coerceAtMost(pixels.height)
        val runs = (top until bottom).map { y ->
            var best = 0 to 0
            var start = -1
            for (x in left..right) {
                val on = x < right && coverage(pixels, x, y) > 0.5f
                if (on && start < 0) start = x
                if (!on && start >= 0) {
                    if (x - start > best.second - best.first) best = start to x
                    start = -1
                }
            }
            best
        }
        val widest = runs.maxOf { it.second - it.first }
        val core = runs.indices.filter { runs[it].second - runs[it].first >= 0.8f * widest }
        assertTrue("no underline in the node", widest > 0 && core.isNotEmpty())
        val (x0, x1) = runs[core.first()]
        fun median(y: Int): Float = (x0 until x1).map { coverage(pixels, it, y) }.sorted()[(x1 - x0) / 2]
        fun mean(y: Int, until: Int): Float = (x0 until until).map { coverage(pixels, it, y) }.average().toFloat()
        val firstCore = top + core.first()
        val lastCore = top + core.last()
        val above = median(firstCore - 1)
        val below = median(lastCore + 1)
        val thickness = above + (lastCore - firstCore + 1) + below
        val lineTop = firstCore - above
        val textEnd = x0 + ((x1 - x0) * 0.6f).roundToInt()
        var y = firstCore - 2
        while (y > top && mean(y, textEnd) < 0.15f) y--
        val baseline = y + 1
        return Measured(lineTop - baseline, thickness)
    }

    private fun check(what: String, measured: Measured, scale: Float) {
        val density = rule.density.density
        val gap = measured.gap / density
        val thickness = measured.thickness / density
        val problems = mutableListOf<String>()
        if (abs(gap - 3f * scale) > 0.6f * max(1f, scale)) problems += "$what: the line is $gap below the baseline, expected ${3f * scale}"
        if (abs(thickness - 1.5f * scale) > 0.35f * max(1f, scale)) problems += "$what: the line is $thickness thick, expected ${1.5f * scale}"
        assertEquals(problems.joinToString("\n"), 0, problems.size)
    }

    /** How much the mono strong role at [sizeSp] grows at [fontScale]: its pixels there over its pixels at scale 1. */
    private fun growth(sizeSp: Float, fontScale: Float): Float =
        with(Density(rule.density.density, fontScale)) { sizeSp.sp.toPx() } / (sizeSp * rule.density.density)

    @Test fun theStubsSourceLinkIsUnderlinedAsOnTheWeb() {
        val card = TestRounds.card(3)
        show(1f) { PassSlipContent(Answered(card, given = card.answer, correct = true, at = 0.0), newBest = false, animateStamp = false, onOpenSource = {}) }
        check("stub source link", measure(rule.onNodeWithTag("source-link")), 1f)
    }

    @Test fun theMissedCardsWhyAndSourceLinkAreUnderlinedAsOnTheWeb() {
        show(1f) { MissedCardsList(listOf(missed), openSource = {}) }
        check("Why", measure(rule.onNodeWithContentDescription(ResultText.whyLabel(3))), 1f)
        rule.onNodeWithContentDescription(ResultText.whyLabel(3)).performClick()
        rule.mainClock.advanceTimeBy(1_000)
        rule.waitForIdle()
        check("missed source link", measure(rule.onNodeWithContentDescription(ResultText.sourceLabel(missed.source.title))), 1f)
    }

    @Test fun atFontScaleTwoTheLineGrowsWithTheText() {
        show(2f) { MissedCardsList(listOf(missed), openSource = {}) }
        check("Why at font scale 2", measure(rule.onNodeWithContentDescription(ResultText.whyLabel(3))), growth(13f, 2f))
    }
}
