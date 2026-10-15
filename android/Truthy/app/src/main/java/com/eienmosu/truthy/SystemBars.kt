package com.eienmosu.truthy

import android.content.res.Configuration
import android.graphics.Color
import android.os.Build
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge

/** True when this configuration is in night mode: the system's, or the app's once UiModeManager has it (task 8). */
fun Configuration.isNightMode(): Boolean =
    (uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES

/**
 * Edge to edge with transparent bars whose icons follow the app's theme, not the system's (spec 5.6, System bars):
 * dark icons when [dark] is false, light ones when it is true. Call it in onCreate and again whenever the app's theme
 * changes.
 *
 * SystemBarStyle.auto makes the activity library enforce navigation bar contrast on API 29 and later, which puts a
 * translucent scrim behind three-button navigation; it is turned off again here.
 */
fun ComponentActivity.applySystemBars(dark: Boolean) {
    val style = SystemBarStyle.auto(Color.TRANSPARENT, Color.TRANSPARENT) { dark }
    enableEdgeToEdge(statusBarStyle = style, navigationBarStyle = style)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        window.isNavigationBarContrastEnforced = false
    }
}
