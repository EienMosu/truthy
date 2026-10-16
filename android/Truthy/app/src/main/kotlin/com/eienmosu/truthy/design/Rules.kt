package com.eienmosu.truthy.design

import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.Dp
import kotlin.math.floor

/**
 * The width a CSS border of [width] is drawn and laid out at: whole device pixels, floored, and at least one (CSS Values 4,
 * as Chrome does). The ticket's 1.5 rules are 3.94 px at density 2.625: the browser draws and lays out 3, and Android
 * drew 4 and laid out 4 (review X6), one pixel more per rule in the ticket's head.
 */
fun borderPx(width: Dp, density: Float): Float = if (width.value <= 0f) 0f else maxOf(1f, floor(width.value * density))

/** borderPx in this density. */
fun Density.borderPx(width: Dp): Float = borderPx(width, density)

/** The rule's width (Tokens.Stroke.rule) as the browser draws a border of it, in dp, for paddings and line widths. */
@Composable
@ReadOnlyComposable
fun ruleWidth(): Dp = with(LocalDensity.current) { borderPx(Tokens.Stroke.rule).toDp() }
