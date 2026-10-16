package com.eienmosu.truthy.design

import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.TextUnitType
import androidx.compose.ui.unit.dp
import com.eienmosu.truthy.RepoFiles
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.ceil

// Review X4 and X6: the ticket's head drifted 3 dp down against the web, a pixel per line and per rule.
class PixelLinesTest {
    private fun density(density: Float, fontScale: Float): Density = object : Density {
        override val density = density
        override val fontScale = fontScale
    }

    private val pixel8 = density(2.625f, 1f)

    /** The line box Compose draws for a style: the ceiling of its line height in pixels (LineHeightStyleSpan). */
    private fun drawnLinePx(style: androidx.compose.ui.text.TextStyle, density: Density): Float {
        val fontPx = with(density) { style.fontSize.toPx() }
        val linePx = if (style.lineHeight.type == TextUnitType.Em) style.lineHeight.value * fontPx else with(density) { style.lineHeight.toPx() }
        return ceil(linePx)
    }

    @Test
    fun theTicketsHeadLinesLandOnTheNearestPixelNotTheNextOne() {
        // Role, the web's exact line in device px at density 2.625, the pixel Android draws.
        val rows = listOf(
            Triple(TruthyType.legCode, 89.25f, 89f),
            Triple(TruthyType.legName, 39.375f, 39f),
            Triple(TruthyType.fieldLabel, 35.004f, 35f),
            Triple(TruthyType.fieldValue, 50.006f, 50f),
            Triple(TruthyType.carrierTitle, 53.34f, 53f),
            Triple(TruthyType.routeLabel, 36.671f, 37f),
            Triple(TruthyType.cardStatement, 84f, 84f),
        )
        for ((style, web, drawn) in rows) {
            assertEquals(web, with(pixel8) { style.lineHeight.toPx() }, 0.01f)
            assertEquals(drawn, drawnLinePx(style.onPixelLines(pixel8), pixel8), 0f)
            // Before: the ceiling, a pixel more on every fractional line.
            assertEquals(ceil(web), drawnLinePx(style, pixel8), 0f)
        }
    }

    @Test
    fun theRoundingFollowsTheFontScaleAndKeepsTheRatioInEm() {
        val large = density(2.625f, 2f)
        val style = TruthyType.fieldLabel.onPixelLines(large)
        assertEquals(TextUnitType.Em, style.lineHeight.type)
        val fontPx = with(large) { TruthyType.fieldLabel.fontSize.toPx() }
        assertEquals(pixelLineHeight(1.27f * fontPx), drawnLinePx(style, large), 0f)
        assertEquals(TruthyType.fieldLabel.lineHeightStyle, style.lineHeightStyle)
        assertEquals(TruthyType.fieldLabel.fontSize, style.fontSize)
    }

    @Test
    fun theNearestPixelRoundsHalfUpAndIsAtLeastOne() {
        assertEquals(58f, pixelLineHeight(57.5f), 0f)
        assertEquals(57f, pixelLineHeight(57.49f), 0f)
        assertEquals(1f, pixelLineHeight(0.2f), 0f)
    }

    // CSS Values 4: a border is floored to whole device pixels and is at least one.
    @Test
    fun aRuleIsFlooredToWholeDevicePixelsAsTheBrowserDrawsABorder() {
        assertEquals(3f, borderPx(Tokens.Stroke.rule, 2.625f), 0f)
        assertEquals(4f, borderPx(1.5.dp, 3f), 0f)
        assertEquals(3f, borderPx(1.5.dp, 2f), 0f)
        assertEquals(1f, borderPx(0.5.dp, 1f), 0f)
        assertEquals(0f, borderPx(0.dp, 2.625f), 0f)
    }

    // Every text goes through design/TruthyText.kt, where the line heights are put on whole pixels.
    @Test
    fun noTextOfTheAppSkipsThePixelLines() {
        val sources = RepoFiles.main.resolve("kotlin").walkTopDown().filter { it.isFile && it.extension == "kt" }.toList()
        assertTrue(sources.size > 50)
        val offenders = sources.filter { it.name != "TruthyText.kt" }.filter { file ->
            val text = file.readText()
            "import androidx.compose.material3.Text\n" in text || "import androidx.compose.foundation.text.BasicText" in text
        }
        assertEquals(offenders.joinToString { it.name }, 0, offenders.size)
    }
}
