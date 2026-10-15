package com.eienmosu.truthy.design

import androidx.compose.foundation.IndicationNodeFactory
import androidx.compose.foundation.LocalIndication
import androidx.compose.foundation.LocalOverscrollFactory
import androidx.compose.foundation.rememberPlatformOverscrollFactory
import androidx.compose.foundation.interaction.InteractionSource
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.drawscope.ContentDrawScope
import androidx.compose.ui.node.DelegatableNode
import androidx.compose.ui.node.DrawModifierNode
import com.eienmosu.truthy.engine.Theme
import com.eienmosu.truthy.engine.resolveTheme

/** The theme the player sees: which one, and its colours and shadows. Two instances exist, one per theme. */
@Immutable
class ResolvedTheme internal constructor(
    val theme: Theme,
    val colors: TruthyColors,
    val shadows: TruthyShadows,
) {
    val isDark: Boolean get() = theme == Theme.DARK
}

private val LIGHT_THEME = ResolvedTheme(Theme.LIGHT, Tokens.Colors.day, Tokens.Shadows.day)
private val DARK_THEME = ResolvedTheme(Theme.DARK, Tokens.Colors.night, Tokens.Shadows.night)

fun resolvedTheme(theme: Theme): ResolvedTheme = when (theme) {
    Theme.LIGHT -> LIGHT_THEME
    Theme.DARK -> DARK_THEME
}

/** The web's rule: a stored choice wins over the system setting; with none, the system decides. */
fun resolvedTheme(stored: Theme?, systemDark: Boolean): ResolvedTheme = resolvedTheme(resolveTheme(stored, systemDark))

val LocalResolvedTheme = staticCompositionLocalOf { resolvedTheme(Theme.LIGHT) }

/** No press indication at all. Foundation's default draws a debug overlay; the app's controls draw their own press feedback. */
object NoIndication : IndicationNodeFactory {
    override fun create(interactionSource: InteractionSource): DelegatableNode = NoIndicationNode()

    override fun hashCode(): Int = -1

    override fun equals(other: Any?): Boolean = other === this
}

private class NoIndicationNode : Modifier.Node(), DrawModifierNode {
    override fun ContentDrawScope.draw() {
        drawContent()
    }
}

/**
 * Provides the resolved theme, turns the default press indication off for everything below, and gives the
 * overscroll edge glow of API 26 to 30 the ink colour (spec 5.6; API 31 and later stretch, the platform's).
 */
@Composable
fun TruthyTheme(theme: ResolvedTheme, content: @Composable () -> Unit) {
    CompositionLocalProvider(
        LocalResolvedTheme provides theme,
        LocalIndication provides NoIndication,
        LocalOverscrollFactory provides rememberPlatformOverscrollFactory(glowColor = theme.colors.ink),
        content = content,
    )
}

/** The current theme, read in composition. */
object TruthyTheme {
    val resolved: ResolvedTheme
        @Composable @ReadOnlyComposable get() = LocalResolvedTheme.current

    val colors: TruthyColors
        @Composable @ReadOnlyComposable get() = LocalResolvedTheme.current.colors

    val shadows: TruthyShadows
        @Composable @ReadOnlyComposable get() = LocalResolvedTheme.current.shadows

    val isDark: Boolean
        @Composable @ReadOnlyComposable get() = LocalResolvedTheme.current.isDark
}
