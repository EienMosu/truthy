package com.eienmosu.truthy

import android.content.SharedPreferences
import com.eienmosu.truthy.engine.THEME_KEY
import com.eienmosu.truthy.engine.Theme
import com.eienmosu.truthy.engine.parseTheme

// The theme a player chose with the switch; null follows the system. The app's name for the engine's Theme.
typealias StoredTheme = Theme

// The stored theme under the web's key "truthy.theme" (reference 6). Read before the first frame (task 11).
// Anything but "light" or "dark", and preferences that throw, follow the system. Storing never throws, and
// nothing removes the key, so there is no way back to following the system, as on the web.
class ThemeStore(private val prefs: SharedPreferences) {
    val stored: StoredTheme?
        get() = try {
            parseTheme(prefs.getString(THEME_KEY, null))
        } catch (e: RuntimeException) {
            null
        }

    fun store(theme: StoredTheme) {
        try {
            prefs.edit().putString(THEME_KEY, theme.wire).apply()
        } catch (e: RuntimeException) {
            // The theme on screen still flips (task 11); only the choice is not kept.
        }
    }

    companion object {
        // The preferences file, shared_prefs/truthy.xml, which the backup rules keep (task 7's name).
        const val PREFS_NAME = StorageNames.PREFS_FILE
    }
}
