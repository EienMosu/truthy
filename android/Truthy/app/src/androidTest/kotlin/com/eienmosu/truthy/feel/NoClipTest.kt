package com.eienmosu.truthy.feel

import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.eienmosu.truthy.support.Device
import com.eienmosu.truthy.support.REVIEW_SEED
import com.eienmosu.truthy.support.ScreenWalk
import com.eienmosu.truthy.support.Ui
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** Runs only at font scale 2.0 (this step and step 22 set it); at other scales it is skipped. */
@RunWith(AndroidJUnit4::class)
class NoClipTest {
    @get:Rule val rule = createEmptyComposeRule()
    private val ui = Ui(rule)

    @Test fun nothingClipsAtTheLargestFontScale() {
        val scale = Device.app.resources.configuration.fontScale
        assumeTrue("run at font_scale 2.0; the scale is $scale", scale >= 1.99f)
        Device.reset()
        val problems = mutableListOf<String>()
        Device.launch(seed = REVIEW_SEED).use {
            ScreenWalk(ui).run { screen -> problems += ui.clippedTexts().map { "$screen: $it" } }
        }
        assertTrue(problems.joinToString("\n"), problems.isEmpty())
    }
}
