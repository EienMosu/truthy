package com.eienmosu.truthy.design

import android.graphics.drawable.ColorDrawable
import androidx.activity.ComponentActivity
import androidx.compose.ui.graphics.toArgb
import com.eienmosu.truthy.applySystemBars
import com.eienmosu.truthy.engine.Theme

/**
 * Edge to edge and the bar icons from the app's theme (not the system's), through task 7's applySystemBars
 * (spec 5.6: enableEdgeToEdge with SystemBarStyle.auto, no enforced navigation bar contrast), then the window
 * background. Call it again whenever the theme changes.
 */
fun applyWindowTheme(activity: ComponentActivity, theme: ResolvedTheme) {
    activity.applySystemBars(dark = theme.isDark)
    activity.window.setBackgroundDrawable(ColorDrawable(theme.colors.surface.toArgb()))
}

/**
 * Everything the first frame needs, in the order it needs it: the stored theme to the system, the theme the
 * player sees (a stored choice, else the system's night bit), then the window. Call it in onCreate before
 * setContent (task 11) and use the result as the initial theme.
 */
fun bootTheme(activity: ComponentActivity, stored: Theme?): ResolvedTheme {
    applyStoredNightMode(activity, stored)
    val systemDark = isNightUiMode(activity.resources.configuration.uiMode)
    val resolved = resolvedTheme(stored, systemDark)
    applyWindowTheme(activity, resolved)
    return resolved
}
