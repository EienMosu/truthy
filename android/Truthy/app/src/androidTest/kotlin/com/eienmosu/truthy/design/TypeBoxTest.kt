package com.eienmosu.truthy.design

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.getBoundsInRoot
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import kotlin.math.abs
import kotlin.math.ceil

/**
 * A text's box is its line count times its line height, as the browser's line box is, also when the line height is
 * smaller than Overpass's own 1.266 (the logo, the leg code and the score at 1, the card name at 1.2). The glyphs may
 * reach past the box, as on the web. Font scale 1, so the expected heights are the roles' own.
 */
@RunWith(AndroidJUnit4::class)
class TypeBoxTest {
    @get:Rule val rule = createComposeRule()

    private class Case(val tag: String, val style: TextStyle, val text: String, val widthDp: Float? = null)

    private val cases = listOf(
        Case("logo", TruthyType.logo, "Truthy"),
        Case("leg-code", TruthyType.legCode, "CLF"),
        Case("score", TruthyType.score, "7"),
        Case("card-name", TruthyType.cardName, "Classic"),
        Case("card-name-2", TruthyType.cardName, "Three lives", widthDp = 90f),
        Case("deck-code", TruthyType.deckCode, "CLF"),
        Case("field-value-pass", TruthyType.fieldValuePass, "Classic"),
        Case("list-title", TruthyType.listTitle, "Whole deck"),
        Case("body", TruthyType.body, "Correct answers out of 10 cards."),
        Case("tagline-2", TruthyType.tagline, "True or false cards that teach you IT", widthDp = 160f),
    )

    @Test fun aTextBoxIsItsLinesTimesItsLineHeight() {
        val layouts = mutableMapOf<String, TextLayoutResult>()
        var density = 0f
        rule.setContent {
            val outer = LocalDensity.current
            density = outer.density
            CompositionLocalProvider(LocalDensity provides Density(outer.density, 1f)) {
                Column {
                    cases.forEach { case ->
                        BasicText(
                            case.text,
                            style = case.style.copy(color = Color.Black),
                            modifier = Modifier.testTag(case.tag).then(case.widthDp?.let { Modifier.width(it.dp) } ?: Modifier),
                            onTextLayout = { layouts[case.tag] = it },
                        )
                    }
                }
            }
        }
        rule.waitForIdle()
        val problems = cases.mapNotNull { case ->
            val lines = layouts.getValue(case.tag).lineCount
            val linePx = case.style.lineHeight.value * density
            val expectedPx = lines * ceil(linePx)
            val bounds = rule.onNodeWithTag(case.tag).getBoundsInRoot()
            val actualPx = (bounds.bottom - bounds.top).value * density
            if (abs(actualPx - expectedPx) > 1.5f) "${case.tag}: $lines lines, ${actualPx}px, expected ${expectedPx}px" else null
        }
        assertEquals(problems.joinToString("\n"), 0, problems.size)
        assertEquals("card-name-2 wraps", 2, layouts.getValue("card-name-2").lineCount)
        assertEquals("tagline-2 wraps", true, layouts.getValue("tagline-2").lineCount >= 2)
    }
}
