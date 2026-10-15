package com.eienmosu.truthy.round

import androidx.compose.animation.core.Easing
import androidx.compose.animation.core.SpringSpec
import androidx.compose.animation.core.TweenSpec
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.ui.unit.dp

/**
 * Values the web writes in its component code rather than in tokens.json (reference 5.4 and 5.7). Every other
 * size, duration and curve of the round comes from Tokens.
 */
internal object RoundGeometry {
    // globals.css "short" (under 568 tall, 8 and 12) is Tokens.Native.shortScreenBelow, shortSafeTop and shortSafeBottom.
    const val SHORT_LEGS_HEIGHT = 600      // BoardingPass.tsx:93, max-height 600, inclusive
    val LEG_ARROW_COLUMN = 40.dp           // BoardingPass.tsx:122
    val FIELD_BOTTOM = 7.dp                // BoardingPass.tsx:141
    val CLOUD_WIDTH = 22.dp                // carrierCloud, 22 by 16
    val CLOUD_HEIGHT = 16.dp
    val STUB_TOP = 22.dp                   // BoardingPass.tsx:384
    val HINT_ROW = 32.dp                   // min-h-8
    val STUB_STAMP_CENTRE = 96.dp          // BoardingPass.tsx:404
    val INTENT_STAMP_TOP = 64.dp           // BoardingPass.tsx:331
    const val INTENT_STAMP_TURN = 7f
    val CHECK_ICON = 18.dp
    val CROSS_ICON = 16.dp
    val BOOK_ICON = 18.dp
    const val STUB_TURN = 2f               // degrees per unit of intent, about (20%, 0)
    const val STUB_PIVOT_X = 0.2f
    val TEAR_X = 40.dp                     // BoardingPass.tsx:302-315
    val TEAR_Y = 360.dp
    const val TEAR_TURN = 18f
    val STUB_RISE = 12.dp
    val ROW_RISE = 12.dp                   // PlayScreen.tsx:816-847
    val DEAL_RISE = 14.dp                  // PlayScreen.tsx:148-157
    const val LEAVE_FRACTION = 1.2f
    const val LEAVE_TURN = 8f
    const val JOLT_DP = 2f                 // BoardingPass.tsx:65-68
    const val JOLT_PEAK = 0.4f
    const val JOLT_DELAY_BEAT = 120
    const val JOLT_DELAY_TIME_UP = 240
    val SLIP_VERDICT_ROW = 60.dp
    const val CODE_SCALE = 0.92f           // components/CardText.tsx
    const val SNAP_DAMPING = 0.6f          // reference 5.7, native springs: snap 360
    const val SNAP_STIFFNESS = 360f
    val PLACEHOLDER_BODY = 336.dp          // BoardingPassPlaceholder
    val SPOKEN_NODE = 1.dp                 // the invisible heading and live regions
}

// The fades the web keeps under reduced motion run inside withContext(FullSpeed) (task 12), and reduced motion is
// task 10's LocalReducedMotion, provided at the app root: this file adds no second implementation of either.

internal fun <T> tweenOf(durationMs: Int, easing: Easing, delayMs: Int = 0): TweenSpec<T> =
    tween(durationMillis = durationMs, delayMillis = delayMs, easing = easing)

/** The card's snap back, seeded with the release velocity by the caller. */
internal fun snapSpring(): SpringSpec<Float> =
    spring(dampingRatio = RoundGeometry.SNAP_DAMPING, stiffness = RoundGeometry.SNAP_STIFFNESS)
