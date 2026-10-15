package com.eienmosu.truthy.stories

import android.content.res.Configuration
import android.os.SystemClock
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.core.view.WindowCompat
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.eienmosu.truthy.MainActivity
import com.eienmosu.truthy.design.Tokens
import com.eienmosu.truthy.support.CLF_SECURITY
import com.eienmosu.truthy.support.Colours
import com.eienmosu.truthy.support.Device
import com.eienmosu.truthy.support.Ui
import com.eienmosu.truthy.support.button
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ThemeTest {
    @get:Rule val rule = createEmptyComposeRule()
    private val ui = Ui(rule)

    @Before fun firstLaunch() {
        Device.systemNight(false)
        Device.reset()
    }

    @After fun systemBackToDay() = Device.systemNight(false)

    private val toDark = button("Switch to dark theme")
    private val toLight = button("Switch to light theme")

    @Test fun theSwitchFlipsTheVisibleThemeOnEveryStepAndIsKept() {
        Device.launch().use {
            ui.atHome()
            ui.tap(toDark)
            ui.waitFor(toLight)
            assertEquals("dark", Device.storedTheme())
            ui.choose(CLF_SECURITY.area)
            ui.atStep("Choose a platform")
            ui.waitFor(toLight)
        }
        Device.launch().use {
            ui.atHome()
            ui.waitFor(toLight)
        }
    }

    @Test fun aStoredLightThemeWinsOverTheSystemDarkTheme() {
        assumeTrue("Android has a system dark theme from API 29", Device.sdk >= 29)
        Device.systemNight(true)
        Device.launch().use {
            ui.atHome()
            ui.tap(toLight)
            ui.waitFor(toDark)
            assertEquals("light", Device.storedTheme())
        }
        Device.launch().use { scenario ->
            ui.atHome()
            ui.waitFor(toDark)
            assertDrawnIn(scenario, light = true)
        }
    }

    @Test fun aStoredDarkThemeWinsOverTheSystemLightTheme() {
        Device.launch().use {
            ui.atHome()
            ui.tap(toDark)
            ui.waitFor(toLight)
        }
        Device.launch().use { scenario ->
            ui.atHome()
            ui.waitFor(toLight)
            assertDrawnIn(scenario, light = false)
        }
    }

    private fun assertDrawnIn(scenario: ActivityScenario<MainActivity>, light: Boolean) {
        scenario.onActivity { activity ->
            val bars = WindowCompat.getInsetsController(activity.window, activity.window.decorView)
            assertEquals("dark status bar icons on a light theme", light, bars.isAppearanceLightStatusBars)
            if (Device.sdk >= 27) assertEquals("dark navigation bar icons on a light theme", light, bars.isAppearanceLightNavigationBars)
            if (Device.sdk >= 31) {
                val night = activity.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK
                assertEquals(if (light) Configuration.UI_MODE_NIGHT_NO else Configuration.UI_MODE_NIGHT_YES, night)
            }
        }
        ui.idle()
        // The sky at 4 dp from the left edge, 300 dp down: nothing else is drawn there on step 1. Read again for up to
        // 2 s: on API 26 the window's open animation, which Compose's idle does not wait for, can still be fading the
        // new window in over the old one (one suite run read #0e192e for #101c32). A wrong theme never comes close.
        val y = (300 * Device.density).toInt()
        var expected = 0
        var actual = 0
        val end = SystemClock.uptimeMillis() + 2000
        do {
            val shot = Device.screenshot()
            expected = Colours.skyAt(if (light) Tokens.Colors.day else Tokens.Colors.night, y / shot.height.toFloat())
            actual = shot.getPixel((4 * Device.density).toInt(), y)
            if (Colours.close(actual, expected)) break
            SystemClock.sleep(100)
        } while (SystemClock.uptimeMillis() < end)
        assertTrue("the sky is ${Colours.hex(actual)}, the stored theme's is ${Colours.hex(expected)}", Colours.close(actual, expected))
    }
}
