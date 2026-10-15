package com.eienmosu.truthy.round

import androidx.activity.compose.PredictiveBackHandler
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.SemanticsPropertyKey
import androidx.compose.ui.semantics.semantics
import com.eienmosu.truthy.design.Tokens
import com.eienmosu.truthy.ui.TestTags
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch

const val ROUND_SURFACE_TAG = TestTags.ROUND_SURFACE

/** The round surface's current scale, for tests. */
val RoundBackScale = SemanticsPropertyKey<Float>("RoundBackScale")

/**
 * The round's only back handler (rule 2): the system's progress shrinks the surface from 1 to 0.94 about its
 * centre, a cancel springs back, a commit calls `onBack` (task 11's roundBack in the app) and springs back. Below API 34 the
 * flow completes with no progress, so the commit runs with the surface at 1.
 */
@Composable
fun RoundBackSurface(enabled: Boolean, onBack: () -> Unit, modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    val scale = remember { Animatable(1f) }
    val scope = rememberCoroutineScope()
    val currentOnBack by rememberUpdatedState(onBack)
    val settle: () -> Unit = {
        scope.launch { scale.animateTo(1f, tween(durationMillis = Tokens.Duration.t3, easing = Tokens.Curves.spring)) }
    }
    PredictiveBackHandler(enabled = enabled) { progress ->
        followRoundBack(progress.map { it.progress }, show = { scale.snapTo(it) }, onCancel = settle)
        currentOnBack()
        settle()
    }
    val current = scale.value
    Box(
        modifier
            .fillMaxSize()
            // The layer first: the tagged node inside it reports the scaled bounds (task 15's BackTest reads them).
            .graphicsLayer {
                scaleX = current
                scaleY = current
            }
            .testTag(ROUND_SURFACE_TAG)
            .semantics { this[RoundBackScale] = current },
    ) {
        content()
    }
}
