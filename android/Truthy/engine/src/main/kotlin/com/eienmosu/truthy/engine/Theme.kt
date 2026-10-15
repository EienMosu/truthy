// The theme rules of src/app-state/theme.ts. Day ("light") or night ("dark"); by default the system decides.
// A press on the theme switch flips the theme the player sees and stores the result under THEME_KEY, which
// wins over the system from then on. Nothing removes the key: there is no way back to following the system.
package com.eienmosu.truthy.engine

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
enum class Theme(val wire: String) {
    @SerialName("light")
    LIGHT("light"),

    @SerialName("dark")
    DARK("dark"),
}

/** The preference key: SharedPreferences on Android, as localStorage on the web. */
const val THEME_KEY = "truthy.theme"

/** "light" or "dark", or null for anything else (no choice, or a value this build does not know). */
fun parseTheme(value: String?): Theme? =
    when (value) {
        "light" -> Theme.LIGHT
        "dark" -> Theme.DARK
        else -> null
    }

fun oppositeTheme(theme: Theme): Theme = if (theme == Theme.DARK) Theme.LIGHT else Theme.DARK

/** A choice wins over the system setting; without one the system decides. */
fun resolveTheme(choice: Theme?, systemDark: Boolean): Theme = choice ?: if (systemDark) Theme.DARK else Theme.LIGHT

/**
 * The flip rule of the web's switchTheme: the opposite of the theme visible now. The caller shows it and stores
 * it under THEME_KEY; the theme flips on screen even when storing fails.
 */
fun switchTheme(choice: Theme?, systemDark: Boolean): Theme = oppositeTheme(resolveTheme(choice, systemDark))
