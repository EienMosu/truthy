package com.eienmosu.truthy.round

import android.content.ActivityNotFoundException
import android.content.Context
import android.net.Uri
import androidx.browser.customtabs.CustomTabColorSchemeParams
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import com.eienmosu.truthy.design.LocalResolvedTheme
import com.eienmosu.truthy.design.TruthyColors

/** The source link's spoken label (reference 4.5, decided in spec 5.6). */
fun sourceLinkLabel(title: String): String = "$title (opens in browser)"

/** A Custom Tab in the app's resolved theme, not the system's (spec 5.6). */
fun sourceTabIntent(colors: TruthyColors, dark: Boolean): CustomTabsIntent {
    val bars = CustomTabColorSchemeParams.Builder()
        .setToolbarColor(colors.surface.toArgb())
        .setNavigationBarColor(colors.surface.toArgb())
        .build()
    return CustomTabsIntent.Builder()
        .setColorScheme(if (dark) CustomTabsIntent.COLOR_SCHEME_DARK else CustomTabsIntent.COLOR_SCHEME_LIGHT)
        .setDefaultColorSchemeParams(bars)
        .setShowTitle(true)
        .build()
}

/** Opens a card's source in the in-app browser. A device without any browser does nothing. */
fun openSource(context: Context, url: String, colors: TruthyColors, dark: Boolean) {
    try {
        sourceTabIntent(colors, dark).launchUrl(context, Uri.parse(url))
    } catch (missing: ActivityNotFoundException) {
        return
    }
}

@Composable
fun rememberSourceOpener(): (String) -> Unit {
    val context = LocalContext.current
    val theme = LocalResolvedTheme.current
    return remember(context, theme) { { url: String -> openSource(context, url, theme.colors, theme.isDark) } }
}
