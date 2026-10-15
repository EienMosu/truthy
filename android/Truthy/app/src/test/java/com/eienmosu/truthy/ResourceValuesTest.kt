package com.eienmosu.truthy

import org.junit.Assert.assertEquals
import org.junit.Test

/** The name, the surface colour, the bar icon flags and the themes the splash and the first frame use (spec 5.6). */
class ResourceValuesTest {
    @Test
    fun appNameIsTruthy() {
        // Reference 4.5, App: the name "Truthy".
        assertEquals("Truthy", RepoFiles.resource("values/strings.xml").value("string", "app_name"))
    }

    @Test
    fun surfaceFollowsTheTokensByDayAndNight() {
        assertEquals(
            RepoFiles.tokenColor("color.day.surface"),
            RepoFiles.resource("values/colors.xml").value("color", "truthy_surface").lowercase(),
        )
        assertEquals(
            RepoFiles.tokenColor("color.night.surface"),
            RepoFiles.resource("values-night/colors.xml").value("color", "truthy_surface").lowercase(),
        )
    }

    @Test
    fun barIconsAreDarkByDayAndLightByNight() {
        assertEquals("true", RepoFiles.resource("values/bools.xml").value("bool", "truthy_light_bars"))
        assertEquals("false", RepoFiles.resource("values-night/bools.xml").value("bool", "truthy_light_bars"))
    }

    @Test
    fun windowAndSplashUseTheSurface() {
        val themes = RepoFiles.resource("values/themes.xml")
        val app = themes.style("Theme.Truthy")
        assertEquals("Base.Theme.Truthy", app.parent)
        assertEquals(
            mapOf(
                "android:windowBackground" to "@color/truthy_surface",
                "android:windowLightStatusBar" to "@bool/truthy_light_bars",
                "android:windowLightNavigationBar" to "@bool/truthy_light_bars",
            ),
            app.items,
        )
        val starting = themes.style("Theme.Truthy.Starting")
        assertEquals("Theme.SplashScreen", starting.parent)
        assertEquals(
            mapOf(
                "windowSplashScreenBackground" to "@color/truthy_surface",
                "windowSplashScreenAnimatedIcon" to "@drawable/ic_launcher_foreground",
                "postSplashScreenTheme" to "@style/Theme.Truthy",
                "android:windowLightStatusBar" to "@bool/truthy_light_bars",
                "android:windowLightNavigationBar" to "@bool/truthy_light_bars",
            ),
            starting.items,
        )
    }

    @Test
    fun baseThemeIsLightByDayAndDarkByNight() {
        val day = RepoFiles.resource("values/themes.xml")
        val night = RepoFiles.resource("values-night/themes.xml")
        assertEquals("android:Theme.Material.Light.NoActionBar", day.style("Base.Theme.Truthy").parent)
        assertEquals("android:Theme.Material.NoActionBar", night.style("Base.Theme.Truthy").parent)
        assertEquals(listOf("Base.Theme.Truthy"), night.elements("style").map { it.getAttribute("name") })
    }
}
