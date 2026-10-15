package com.eienmosu.truthy.design

import android.app.UiModeManager
import android.content.Context
import android.content.res.Configuration
import android.os.Build
import androidx.annotation.RequiresApi
import com.eienmosu.truthy.engine.Theme

/** The UiModeManager night mode that makes the app's resources, and on Android 12 and later its splash, follow a stored theme. */
fun nightModeFor(theme: Theme): Int =
    if (theme == Theme.DARK) UiModeManager.MODE_NIGHT_YES else UiModeManager.MODE_NIGHT_NO

/** Whether a configuration's uiMode says night. */
fun isNightUiMode(uiMode: Int): Boolean =
    (uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES

/**
 * Hands a stored theme to the system for this app (Android 12 and later; below that the splash follows the system).
 * With nothing stored nothing is set: the system decides, as on the web. The system keeps the setting, so calling
 * this again with the same theme changes nothing.
 */
fun applyStoredNightMode(context: Context, stored: Theme?) {
    if (stored == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return
    setApplicationNightMode(context, nightModeFor(stored))
}

@RequiresApi(Build.VERSION_CODES.S)
private fun setApplicationNightMode(context: Context, mode: Int) {
    val manager = context.getSystemService(UiModeManager::class.java) ?: return
    manager.setApplicationNightMode(mode)
}
