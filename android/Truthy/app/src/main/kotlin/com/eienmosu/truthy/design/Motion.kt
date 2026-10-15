package com.eienmosu.truthy.design

import androidx.compose.animation.core.FiniteAnimationSpec
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.tween
import androidx.compose.foundation.interaction.InteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.compose.runtime.getValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Whether the player asked for reduced motion (on Android: ANIMATOR_DURATION_SCALE is 0, spec 5.1). False by default; the
 * start flow and the round provide the real value once at the top of the tree (task 12), and nothing else defines it.
 */
val LocalReducedMotion = staticCompositionLocalOf { false }

/** Reference 5.7, Press: the scale each control reaches while it is held. */
object PressFeedback {
    const val ROUND_SCALE = 0.92f
    const val BACK_PILL_SCALE = 0.96f
    const val PILL_SCALE = 0.98f
    const val CARD_SCALE = 0.98f
    const val QUIET_SCALE = 0.98f
    const val CONTINUE_SCALE = 0.98f
}

/** The press transition of the tokens (120 ms, ease); instant with reduced motion. */
fun pressSpec(reducedMotion: Boolean): FiniteAnimationSpec<Float> =
    if (reducedMotion) {
        snap()
    } else {
        tween(durationMillis = Tokens.Transitions.press.durationMs, easing = Tokens.Transitions.press.easing)
    }

/** 0 at rest, 1 while pressed, animated with [pressSpec]. [active] false (a dimmed control) never leaves 0. */
@Composable
fun rememberPressProgress(interactionSource: InteractionSource, active: Boolean = true): State<Float> {
    val pressed by interactionSource.collectIsPressedAsState()
    val reduced = LocalReducedMotion.current
    return animateFloatAsState(
        targetValue = if (pressed && active) 1f else 0f,
        animationSpec = pressSpec(reduced),
        label = "press",
    )
}

/**
 * Scales the element to [pressedScale] and moves it [drop] down as [progress] goes from 0 to 1. The state is read in the
 * layer block, so a press redraws without recomposing. Put it before the shadow so the shadow moves with the element.
 */
fun Modifier.pressFeedback(progress: State<Float>, pressedScale: Float, drop: Dp = 0.dp): Modifier =
    graphicsLayer {
        val p = progress.value
        val s = 1f + (pressedScale - 1f) * p
        scaleX = s
        scaleY = s
        translationY = drop.toPx() * p
    }
