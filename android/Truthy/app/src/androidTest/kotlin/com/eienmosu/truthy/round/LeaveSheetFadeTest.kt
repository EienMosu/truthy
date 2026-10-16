package com.eienmosu.truthy.round

import androidx.activity.ComponentActivity
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.MotionDurationScale
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.eienmosu.truthy.design.LocalReducedMotion
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** The system animator scale of 0 that reduced motion means on Android (spec 5.1), applied to the whole composition. */
private object FrozenMotion : MotionDurationScale {
    override val scaleFactor: Float = 0f
}

@RunWith(AndroidJUnit4::class)
class LeaveSheetFadeTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>(effectContext = FrozenMotion)

    private fun alpha(): Float = rule.onNodeWithTag(SHEET_CARD_TAG).fetchSemanticsNode().config[SheetCardAlpha]

    private fun card(reduced: Boolean) {
        rule.mainClock.autoAdvance = false
        rule.setContent {
            Themed {
                CompositionLocalProvider(LocalReducedMotion provides reduced) {
                    LeaveSheetCard(decided = false, decidedAtOpen = false, hiding = false, onKeepPlaying = {}, onLeave = {})
                }
            }
        }
    }

    @Test
    fun reducedMotionStillFadesTheCardInOver140Milliseconds() {
        card(reduced = true)
        rule.mainClock.advanceTimeBy(70)
        val halfway = alpha()
        assertTrue("alpha at 70 ms was $halfway", halfway > 0.05f && halfway < 0.99f)
        rule.mainClock.advanceTimeBy(80)
        assertEquals("the card is opaque by 140 ms", 1f, alpha(), 0.001f)
    }

    // Reference 5.0 and 5.8: under reduced motion the scrim keeps its 360 ms ease fade while the card takes 140.
    @Test
    fun reducedMotionKeepsTheScrimsFullFade() {
        rule.mainClock.autoAdvance = false
        rule.setContent {
            Themed {
                CompositionLocalProvider(LocalReducedMotion provides true) {
                    LeaveScrim(visible = true)
                }
            }
        }
        rule.mainClock.advanceTimeBy(180)
        val scrim = rule.onNodeWithTag(SCRIM_TAG).fetchSemanticsNode().config[ScrimAlpha]
        // The token curve is --ease, cubic-bezier(0.2, 0.7, 0.2, 1): about 0.93 at 180 of 360 ms. Still fading, and above
        // what the 140 ms reduced fade would leave.
        assertTrue("scrim alpha at 180 ms was $scrim", scrim > 0.5f && scrim < 0.98f)
        rule.mainClock.advanceTimeBy(300)
        assertEquals(1f, rule.onNodeWithTag(SCRIM_TAG).fetchSemanticsNode().config[ScrimAlpha], 0.001f)
    }

    @Test
    fun fullMotionFadesTheCardInOver360Milliseconds() {
        card(reduced = false)
        rule.mainClock.advanceTimeBy(150)
        val early = alpha()
        assertTrue("alpha at 150 ms was $early", early > 0.05f && early < 0.99f)
        rule.mainClock.advanceTimeBy(400)
        assertEquals(1f, alpha(), 0.001f)
    }
}
