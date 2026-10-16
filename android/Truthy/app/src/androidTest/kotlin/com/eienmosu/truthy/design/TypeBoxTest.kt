package com.eienmosu.truthy.design

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import kotlin.math.abs

/**
 * A text's box is its line count times its line height on the nearest whole pixel (pixelLineHeight), the browser's line
 * box rounded, also when the line height is smaller than Overpass's own 1.266 (the logo, the leg code and the score at 1,
 * the card name at 1.2) and when it is just above it (the 1.27 roles of the ticket's head). The glyphs may reach past the
 * box, as on the web. At font scale 1 and 2, through TruthyText as the app draws them.
 */
@RunWith(AndroidJUnit4::class)
class TypeBoxTest {
    @get:Rule val rule = createComposeRule()

    private class Case(val tag: String, val style: TextStyle, val text: String, val widthDp: Float? = null)

    private val cases = listOf(
        Case("logo", TruthyType.logo, "Truthy"),
        Case("leg-code", TruthyType.legCode, "CLF"),
        Case("leg-name", TruthyType.legName, "Cloud Practitioner"),
        Case("field-label", TruthyType.fieldLabel, "CLASS"),
        Case("field-value", TruthyType.fieldValue, "Classic"),
        Case("carrier-title", TruthyType.carrierTitle, "Truthy"),
        Case("mono-data", TruthyType.monoData, "CLF → SEC"),
        Case("route-label", TruthyType.routeLabel, "Card 1 of 10"),
        Case("score", TruthyType.score, "7"),
        Case("card-name", TruthyType.cardName, "Classic"),
        Case("card-name-2", TruthyType.cardName, "Three lives", widthDp = 90f),
        Case("deck-code", TruthyType.deckCode, "CLF"),
        Case("field-value-pass", TruthyType.fieldValuePass, "Classic"),
        Case("list-title", TruthyType.listTitle, "Whole deck"),
        Case("pass-line", TruthyType.passLine, "Cloud"),
        Case("card-statement-2", TruthyType.cardStatement, "Amazon S3 stores objects in buckets", widthDp = 200f),
        Case("body", TruthyType.body, "Correct answers out of 10 cards."),
        Case("tagline-2", TruthyType.tagline, "True or false cards that teach you IT", widthDp = 160f),
    )

    private fun check(fontScale: Float) {
        val lineCounts = mutableMapOf<String, Int>()
        val heights = mutableMapOf<String, Int>()
        var density: Density? = null
        rule.setContent {
            val outer = LocalDensity.current
            val scaled = Density(outer.density, fontScale)
            density = scaled
            CompositionLocalProvider(LocalDensity provides scaled) {
                // Scrolled, so the last cases get their own height at font scale 2, not what is left of the screen.
                Column(Modifier.verticalScroll(rememberScrollState())) {
                    cases.forEach { case ->
                        TruthyText(
                            case.text,
                            case.style,
                            Color.Black,
                            modifier = Modifier
                                .onSizeChanged { heights[case.tag] = it.height }
                                .then(case.widthDp?.let { Modifier.width(it.dp) } ?: Modifier),
                        )
                    }
                }
            }
        }
        rule.waitForIdle()
        val d = density!!
        val problems = cases.mapNotNull { case ->
            val actualPx = heights.getValue(case.tag).toFloat()
            val fontPx = with(d) { case.style.fontSize.toPx() }
            val linePx = pixelLineHeight(case.style.lineHeight.value / case.style.fontSize.value * fontPx)
            val lines = Math.round(actualPx / linePx).coerceAtLeast(1)
            lineCounts[case.tag] = lines
            if (abs(actualPx - lines * linePx) > 0.5f) "${case.tag} at $fontScale: ${actualPx}px, expected $lines x ${linePx}px" else null
        }
        assertEquals(problems.joinToString("\n"), 0, problems.size)
        if (fontScale == 1f) {
            assertEquals("card-name-2 wraps", 2, lineCounts.getValue("card-name-2"))
            assertEquals("tagline-2 wraps", true, lineCounts.getValue("tagline-2") >= 2)
            assertEquals("card-statement-2 wraps", true, lineCounts.getValue("card-statement-2") >= 2)
        }
    }

    @Test fun aTextBoxIsItsLinesTimesItsLineHeightOnAWholePixel() = check(1f)

    @Test fun aTextBoxIsItsLinesTimesItsLineHeightOnAWholePixelAtFontScaleTwo() = check(2f)
}
