package com.eienmosu.truthy.support

import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.eienmosu.truthy.ui.TestTags
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class SupportTest {
    @get:Rule val rule = createEmptyComposeRule()
    private val ui = Ui(rule)

    @Before fun firstLaunch() = Device.reset()

    @Test fun theWindowStartsAtTheScreenOrigin() {
        Device.launch().use { scenario ->
            ui.atHome()
            scenario.onActivity { activity ->
                val origin = IntArray(2)
                activity.window.decorView.getLocationOnScreen(origin)
                assertEquals(0, origin[0])
                assertEquals(0, origin[1])
            }
        }
    }

    @Test fun stepOneShowsTheLogoTheAreasAndTheThemeSwitch() {
        Device.launch().use {
            ui.atHome()
            ui.waitFor(hasTestTag(TestTags.LOGO))
            assertTrue(ui.exists(label("Truthy")))
            ui.waitFor(label("True or false cards that teach you IT, one swipe at a time."))
            for (area in listOf("Cloud", "Frontend", "DevOps", "Backend")) ui.waitFor(button(Regex("$area, (\\d+ decks?|no decks yet)")))
            ui.waitFor(button(Regex("Switch to (dark|light) theme")))
            assertFalse(ui.exists(label(Regex("Continue: .*"))))
        }
    }
}
