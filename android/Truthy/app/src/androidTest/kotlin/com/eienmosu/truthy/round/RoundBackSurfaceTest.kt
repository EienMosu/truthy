package com.eienmosu.truthy.round

import androidx.activity.BackEventCompat
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class RoundBackSurfaceTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private var commits = 0

    @Before
    fun surface() {
        rule.setContent {
            Themed {
                RoundBackSurface(enabled = true, onBack = { commits += 1 }) { Box(Modifier.fillMaxSize()) }
            }
        }
    }

    private fun scale(): Float = rule.onNodeWithTag(ROUND_SURFACE_TAG).fetchSemanticsNode().config[RoundBackScale]

    private fun event(progress: Float) = BackEventCompat(touchX = 0f, touchY = 0f, progress = progress, swipeEdge = BackEventCompat.EDGE_LEFT)

    @Test
    fun aScrubbedBackShrinksTheSurfaceAndACancelSpringsItBackWithoutActing() {
        rule.runOnUiThread { rule.activity.onBackPressedDispatcher.dispatchOnBackStarted(event(0f)) }
        rule.runOnUiThread { rule.activity.onBackPressedDispatcher.dispatchOnBackProgressed(event(0.5f)) }
        rule.waitForIdle()
        assertEquals(0.97f, scale(), 0.001f)
        rule.runOnUiThread { rule.activity.onBackPressedDispatcher.dispatchOnBackCancelled() }
        rule.waitForIdle()
        assertEquals(1f, scale(), 0.001f)
        assertEquals(0, commits)
    }

    @Test
    fun aCompletedBackActsOnceAndReturnsTheSurfaceToRest() {
        rule.runOnUiThread { rule.activity.onBackPressedDispatcher.dispatchOnBackStarted(event(0f)) }
        rule.runOnUiThread { rule.activity.onBackPressedDispatcher.dispatchOnBackProgressed(event(1f)) }
        rule.waitForIdle()
        assertEquals(0.94f, scale(), 0.001f)
        rule.runOnUiThread { rule.activity.onBackPressedDispatcher.onBackPressed() }
        rule.waitForIdle()
        assertEquals(1, commits)
        assertEquals(1f, scale(), 0.001f)
    }

    @Test
    fun aBackWithoutProgressCommitsAtOnceAsBelowApi34() {
        rule.runOnUiThread { rule.activity.onBackPressedDispatcher.onBackPressed() }
        rule.waitForIdle()
        assertEquals(1, commits)
        assertEquals(1f, scale(), 0.001f)
    }
}
