package com.eienmosu.truthy.review

import android.graphics.Bitmap
import android.os.SystemClock
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.eienmosu.truthy.support.Device
import com.eienmosu.truthy.support.ELEMENT_MATCHERS
import com.eienmosu.truthy.support.REVIEW_SEED
import com.eienmosu.truthy.support.SCREEN_ELEMENTS
import com.eienmosu.truthy.support.ScreenWalk
import com.eienmosu.truthy.support.Ui
import java.io.File
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Screenshots and element frames of every reviewed screen, for pair.mjs. Started by capture-android.sh with the
 * arguments capture=1 and theme=day or night; writes files/visual/<font100|font200>-<theme>-<screen>.{png,json}.
 */
@RunWith(AndroidJUnit4::class)
class VisualCaptureTest {
    @get:Rule val rule = createEmptyComposeRule()
    private val ui = Ui(rule)
    private val arguments = InstrumentationRegistry.getArguments()

    @Test fun captureEveryScreen() {
        assumeTrue("started by capture-android.sh (argument capture=1)", arguments.getString("capture") == "1")
        val theme = arguments.getString("theme") ?: "day"
        val label = if (Device.app.resources.configuration.fontScale >= 1.99f) "font200" else "font100"
        Device.reset()
        Device.systemNight(theme == "night")
        try {
            Device.launch(seed = REVIEW_SEED).use {
                ScreenWalk(ui).run { screen -> capture(screen, theme, label) }
            }
        } finally {
            Device.systemNight(false)
        }
    }

    private fun capture(screen: String, theme: String, label: String) {
        ui.idle()
        SystemClock.sleep(500)
        ui.idle()
        val shot = Device.screenshot()
        val density = Device.density
        val name = "$label-$theme-$screen"
        val dir = File(Device.app.filesDir, "visual").apply { mkdirs() }
        File(dir, "$name.png").outputStream().use { shot.compress(Bitmap.CompressFormat.PNG, 100, it) }

        val frames = JSONObject()
        for (element in SCREEN_ELEMENTS.getValue(screen)) {
            val node = rule.onAllNodes(ELEMENT_MATCHERS.getValue(element))
                .fetchSemanticsNodes(atLeastOneRootRequired = false)
                .firstOrNull() ?: continue
            val bounds = node.boundsInWindow
            frames.put(element, JSONArray(listOf(bounds.left, bounds.top, bounds.width, bounds.height).map { (it / density).toDouble() }))
        }
        val json = JSONObject()
            .put("platform", "android")
            .put("screen", screen)
            .put("theme", theme)
            .put("label", label)
            .put("density", density.toDouble())
            .put("widthDp", shot.width / density.toDouble())
            .put("heightDp", shot.height / density.toDouble())
            .put("frames", frames)
        File(dir, "$name.json").writeText(json.toString(2))
    }
}
