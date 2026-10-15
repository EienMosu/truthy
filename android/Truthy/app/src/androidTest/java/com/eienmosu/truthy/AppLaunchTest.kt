package com.eienmosu.truthy

import android.os.Build
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.core.content.res.ResourcesCompat
import androidx.core.view.WindowCompat
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** The app launches, draws, goes edge to edge with theme-following bars, and carries its decks, fonts and licence. */
@RunWith(AndroidJUnit4::class)
class AppLaunchTest {
    @get:Rule
    val compose = createAndroidComposeRule<MainActivity>()

    private val context = InstrumentationRegistry.getInstrumentation().targetContext

    @Test
    fun drawsTheRoot() {
        compose.onNodeWithTag(ROOT_TAG).assertExists()
    }

    @Test
    fun barIconsFollowTheThemeAndTheNavigationBarHasNoScrim() {
        compose.runOnIdle {
            val activity = compose.activity
            val night = activity.resources.configuration.isNightMode()
            val controller = WindowCompat.getInsetsController(activity.window, activity.window.decorView)
            assertEquals(!night, controller.isAppearanceLightStatusBars)
            assertEquals(!night, controller.isAppearanceLightNavigationBars)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                assertFalse(activity.window.isNavigationBarContrastEnforced)
            }
        }
    }

    @Test
    fun theDecksAreAssetsAtTheRoot() {
        val index = JSONObject(context.assets.open("index.json").bufferedReader().use { it.readText() })
        val ids = buildList {
            val areas = index.getJSONArray("areas")
            for (a in 0 until areas.length()) {
                val platforms = areas.getJSONObject(a).getJSONArray("platforms")
                for (p in 0 until platforms.length()) {
                    val decks = platforms.getJSONObject(p).getJSONArray("decks")
                    for (d in 0 until decks.length()) add(decks.getJSONObject(d).getString("id"))
                }
            }
        }
        assertEquals(54, ids.size)
        val files = context.assets.list("").orEmpty().filter { it.endsWith(".json") }.toSet()
        assertEquals(ids.map { "$it.json" }.toSet() + "index.json", files)
    }

    @Test
    fun theFontLicenceShips() {
        val first = context.assets.open("licenses/OFL.txt").bufferedReader().use { it.readLine() }
        assertEquals("Copyright 2021 The Overpass Project Authors (https://github.com/RedHatOfficial/Overpass)", first)
    }

    @Test
    fun theFourFontsLoad() {
        val ids = listOf(R.font.overpass_600, R.font.overpass_800, R.font.overpass_mono_400, R.font.overpass_mono_600)
        for (id in ids) {
            assertNotNull(ResourcesCompat.getFont(context, id))
        }
    }
}
