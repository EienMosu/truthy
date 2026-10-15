package com.eienmosu.truthy

import android.content.Context
import android.content.pm.ApplicationInfo
import com.eienmosu.truthy.engine.Mode
import com.eienmosu.truthy.engine.Route
import com.eienmosu.truthy.engine.Step
import com.eienmosu.truthy.engine.Theme
import com.eienmosu.truthy.engine.WHOLE_DECK

/** The screens a debug launch can open in a known state (spec 7.4). */
enum class DebugScreen(val wire: String) {
    START("start"),
    ROUND("round"),
    ANSWERED("answered"),
    LEAVE_SHEET("sheet"),
    RESULT("result"),
}

/**
 * A debug launch from intent extras (debug builds only): a fixed seed, a route and class, the screen to open, the
 * start step for [DebugScreen.START], and a theme to store first.
 */
data class DebugLaunch(
    val seed: Long?,
    val route: Route?,
    val mode: Mode?,
    val screen: DebugScreen?,
    val theme: StoredTheme?,
    val step: Step? = null,
) {
    fun roundRequest(): RoundRequest? {
        val chosenRoute = route ?: return null
        val chosenMode = mode ?: return null
        return RoundRequest(chosenRoute, chosenMode)
    }

    companion object {
        const val SEED = "truthy.seed"
        const val DECK = "truthy.deck"
        const val SECTION = "truthy.section"
        const val MODE = "truthy.mode"
        const val SCREEN = "truthy.screen"
        const val THEME = "truthy.theme"
        const val STEP = "truthy.step"
    }
}

/** Reads the extras through [extra]; a value that is not valid is left out, and no valid value at all is no launch. */
fun parseDebugLaunch(extra: (String) -> String?): DebugLaunch? {
    val seed = extra(DebugLaunch.SEED)?.toLongOrNull()?.takeIf { it in 0L..0xFFFFFFFFL }
    val deck = extra(DebugLaunch.DECK)?.takeIf { it.isNotEmpty() }
    val route = deck?.let { id -> Route(id, extra(DebugLaunch.SECTION)?.takeIf { it.isNotEmpty() } ?: WHOLE_DECK) }
    val mode = extra(DebugLaunch.MODE)?.let { wire -> Mode.entries.firstOrNull { it.wire == wire } }
    val screen = extra(DebugLaunch.SCREEN)?.let { wire -> DebugScreen.entries.firstOrNull { it.wire == wire } }
    val theme = extra(DebugLaunch.THEME)?.let { wire -> Theme.entries.firstOrNull { it.wire == wire } }
    val step = extra(DebugLaunch.STEP)?.toIntOrNull()?.let { number -> Step.entries.firstOrNull { it.number == number } }
    if (seed == null && route == null && mode == null && screen == null && theme == null && step == null) return null
    return DebugLaunch(seed, route, mode, screen, theme, step)
}

/**
 * An intent extra as the parser reads it: a String as is, a Long or an Int (adb's --el and --ei, putExtra with a
 * number) as its digits, anything else null.
 */
fun extraText(value: Any?): String? = when (value) {
    is String -> value
    is Long, is Int -> value.toString()
    else -> null
}

/** Whether this build is debuggable (debug builds). The activity guards the extras with BuildConfig.DEBUG instead. */
fun isDebuggable(context: Context): Boolean =
    (context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0
