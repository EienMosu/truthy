package com.eienmosu.truthy.debug

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.eienmosu.truthy.design.TruthyTheme
import com.eienmosu.truthy.design.applyWindowTheme
import com.eienmosu.truthy.design.bootTheme
import com.eienmosu.truthy.design.resolvedTheme
import com.eienmosu.truthy.engine.Theme

/**
 * Debug only. Shows every component of task 10.
 *
 *     adb shell am start -n com.eienmosu.truthy/.debug.GalleryActivity --es section buttons --ez night true
 *
 * `section` is all, icons, buttons, cards, stamps or shapes; `night` (true or false) fixes the theme, otherwise the
 * system's decides. The round button at the top switches the theme.
 */
class GalleryActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val activity = this
        val section = intent.getStringExtra(EXTRA_SECTION) ?: "all"
        val stored: Theme? = if (intent.hasExtra(EXTRA_NIGHT)) {
            if (intent.getBooleanExtra(EXTRA_NIGHT, false)) Theme.DARK else Theme.LIGHT
        } else {
            null
        }
        val first = bootTheme(activity, stored)
        setContent {
            var theme by remember { mutableStateOf(first) }
            LaunchedEffect(theme) { applyWindowTheme(activity, theme) }
            TruthyTheme(theme) {
                ComponentGallery(
                    section = section,
                    onToggleTheme = {
                        theme = resolvedTheme(if (theme.isDark) Theme.LIGHT else Theme.DARK)
                    },
                )
            }
        }
    }

    companion object {
        const val EXTRA_SECTION = "section"
        const val EXTRA_NIGHT = "night"
    }
}
