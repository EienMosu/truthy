package com.eienmosu.truthy.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.eienmosu.truthy.design.RouteIcon
import com.eienmosu.truthy.design.Text
import com.eienmosu.truthy.design.TruthyTheme
import com.eienmosu.truthy.design.TruthyType
import com.eienmosu.truthy.round.AtSize
import com.eienmosu.truthy.round.LeaveText
import com.eienmosu.truthy.round.ResultText
import com.eienmosu.truthy.round.Themed
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import kotlin.math.abs
import kotlin.math.roundToInt

/**
 * A pill label that wraps at font scale 2 on the smallest phone (320 wide): each line is centred, as the browser centres
 * the lines of a button's label (a button's text-align is center). They were drawn from the start of the label's box.
 * The pill that grows taller keeps semicircle ends: the web's pill radius is half its height, and a fixed 30 dp radius
 * on a taller pill flattened the ends into a rounded rectangle.
 */
@RunWith(AndroidJUnit4::class)
class PillWrapTest {
    @get:Rule val rule = createComposeRule()

    private var fill = Color.Unspecified

    private fun near(a: Color, b: Color): Boolean = abs(a.red - b.red) + abs(a.green - b.green) + abs(a.blue - b.blue) < 0.12f

    private fun show(width: Int, content: @Composable () -> Unit) {
        rule.setContent {
            Themed {
                fill = TruthyTheme.colors.ink
                AtSize(width.dp, 568.dp, fontScale = 2f) {
                    Column(Modifier.fillMaxSize().background(Color.White).padding(horizontal = 16.dp)) { content() }
                }
            }
        }
        rule.waitForIdle()
    }

    private fun layoutOf(label: String): TextLayoutResult {
        val node = rule.onNode(hasText(label), useUnmergedTree = true).fetchSemanticsNode()
        val layouts = mutableListOf<TextLayoutResult>()
        node.config[SemanticsActions.GetTextLayoutResult].action?.invoke(layouts)
        return layouts.single()
    }

    private fun assertLinesCentred(label: String) {
        val layout = layoutOf(label)
        assertTrue("$label does not wrap here: ${layout.lineCount} line", layout.lineCount >= 2)
        val middle = layout.size.width / 2f
        val off = (0 until layout.lineCount).map { (layout.getLineLeft(it) + layout.getLineRight(it)) / 2f - middle }
        assertTrue("$label: the lines' centres are off the label's centre by $off px", off.all { abs(it) <= 1f })
    }

    @Test fun aWrappedPillLabelIsCentred() {
        // See results at 2x on a column narrower than the phone: the pill's label wraps.
        show(200) {
            PillButton(
                label = "See results",
                onClick = {},
                trailingIcon = { Text("→", style = TruthyType.button, color = TruthyTheme.colors.onDark) },
            )
        }
        assertLinesCentred("See results")
    }

    @Test fun aPillThatGrowsKeepsSemicircleEnds() {
        // See results at 2x on a column narrower than the phone: the label wraps and the pill grows past its 60.
        show(200) {
            PillButton(
                label = "See results",
                onClick = {},
                trailingIcon = { Text("→", style = TruthyType.button, color = TruthyTheme.colors.onDark) },
            )
        }
        val bounds = rule.onNodeWithText("See results").fetchSemanticsNode().boundsInRoot
        val density = rule.density.density
        val h = bounds.height
        assertTrue("the pill did not grow: ${h / density} dp", h > 1.4f * 60f * density)
        val pixels = rule.onRoot().captureToImage().toPixelMap()
        // A semicircle of radius h / 2 leaves this corner point outside the pill; a 30 dp corner covers it.
        val corner = pixels[(bounds.left + 0.07f * h).roundToInt(), (bounds.top + 0.15f * h).roundToInt()]
        val side = pixels[(bounds.left + 2f * density).roundToInt(), (bounds.top + h / 2f).roundToInt()]
        assertTrue("the middle of the pill's left end is not filled", near(side, fill))
        assertTrue("the pill's end is not a semicircle: ($corner) at its corner is the pill's fill", !near(corner, fill))
    }

    @Test fun keepPlayingAndChooseAnotherRouteWrapCentred() {
        show(240) {
            PillButton(label = LeaveText.KEEP_PLAYING, onClick = {})
            QuietButton(label = ResultText.CHOOSE_ANOTHER_ROUTE, onClick = {}, leadingIcon = { RouteIcon() })
        }
        assertLinesCentred(LeaveText.KEEP_PLAYING)
        assertLinesCentred(ResultText.CHOOSE_ANOTHER_ROUTE)
    }

    @Test fun onTheSmallestPhoneChooseAnotherRouteWrapsCentred() {
        show(320) { QuietButton(label = ResultText.CHOOSE_ANOTHER_ROUTE, onClick = {}, leadingIcon = { RouteIcon() }) }
        assertLinesCentred(ResultText.CHOOSE_ANOTHER_ROUTE)
    }
}
