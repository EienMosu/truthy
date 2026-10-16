package com.eienmosu.truthy.start

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.eienmosu.truthy.engine.PassFieldName
import com.eienmosu.truthy.round.Themed
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import kotlin.math.abs
import kotlin.math.roundToInt

/**
 * Review s4, s5: on the web the middle dot of "Cloud · AWS" is centred in the line while each word's text sits 1 down in
 * its 22 box (FillInPass.tsx pt-px), so the dot lies above the middle of the words; on Android it sat on their middle.
 */
@RunWith(AndroidJUnit4::class)
class QuietLineTest {
    @get:Rule val rule = createComposeRule()

    private fun field(name: PassFieldName, label: String, value: String?, code: Boolean) =
        PassField(name, label, value, code = code, now = value == null, wayBack = null)

    @Test fun theMiddleDotLiesAboveTheMiddleOfTheWords() {
        val block = RouteBlock(
            area = field(PassFieldName.AREA, "Area", "Cloud", code = false),
            platform = field(PassFieldName.PLATFORM, "Platform", "AWS", code = false),
            fields = listOf(
                field(PassFieldName.DECK, "Deck", "CLF", code = true),
                field(PassFieldName.SECTION, "Section", null, code = true),
                field(PassFieldName.MODE, "Class", null, code = false),
            ),
        )
        rule.setContent {
            Themed {
                Box(Modifier.fillMaxSize().background(Color.White).padding(16.dp)) {
                    FillInPass(
                        block = block,
                        leavingBlock = null,
                        layers = StepLayers.rest(0),
                        changing = emptySet(),
                        direction = 1,
                        interactive = false,
                        travels = Travels(),
                        onJump = {},
                        unroll = null,
                    )
                }
            }
        }
        rule.waitForIdle()
        val cloud = rule.onNodeWithText("Cloud", useUnmergedTree = true).fetchSemanticsNode().boundsInRoot
        val aws = rule.onNodeWithText("AWS", useUnmergedTree = true).fetchSemanticsNode().boundsInRoot
        val pixels = rule.onRoot().captureToImage().toPixelMap()
        val paper = pixels[(cloud.left - 4f).roundToInt(), cloud.top.roundToInt()]
        fun inked(x: Int, y: Int): Boolean {
            val c = pixels[x, y]
            return abs(c.red - paper.red) + abs(c.green - paper.green) + abs(c.blue - paper.blue) > 0.15f
        }
        fun inkRows(left: Float, right: Float): IntRange {
            val top = (cloud.top - 10f).roundToInt()
            val bottom = (cloud.bottom + 10f).roundToInt()
            val rows = (top..bottom).filter { y -> (left.roundToInt()..right.roundToInt()).any { x -> inked(x, y) } }
            return rows.first()..rows.last()
        }
        val words = inkRows(cloud.left, cloud.right)
        // The dot lies between the two words' boxes (their 6 padding and the 2 gap; the web's dot is 0 wide).
        val dot = inkRows(cloud.right + 1f, aws.left - 1f)
        val d = rule.density.density
        val dotMiddle = (dot.first + dot.last) / 2f
        val wordsMiddle = (words.first + words.last) / 2f
        assertTrue("the dot ($dot) is not above the middle of the words ($words)", wordsMiddle - dotMiddle >= 0.75f * d)
        // Still on the line: well inside the words' height.
        assertTrue("the dot ($dot) has left the words ($words)", dot.first > words.first && dot.last < words.last)
    }
}
