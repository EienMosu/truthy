package com.eienmosu.truthy.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Easing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.State
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.unit.dp
import com.eienmosu.truthy.design.IconId
import com.eienmosu.truthy.design.LocalReducedMotion
import com.eienmosu.truthy.design.Tokens
import com.eienmosu.truthy.design.TruthyIcon
import com.eienmosu.truthy.design.TruthyText
import com.eienmosu.truthy.design.TruthyTheme
import com.eienmosu.truthy.design.TruthyType
import com.eienmosu.truthy.design.stampBorder

enum class StampVerdict { CORRECT, WRONG, NEW_BEST }

enum class StubStampKind { CORRECT, WRONG, TIME_UP }

enum class IntentKind { TRUE, FALSE }

/** Reference 4.5: the words on the stamps and the name a screen reader reads. */
object StampText {
    fun word(verdict: StampVerdict): String = when (verdict) {
        StampVerdict.CORRECT -> "Correct"
        StampVerdict.WRONG -> "Not quite"
        StampVerdict.NEW_BEST -> "New best"
    }

    /** The record stamp is "Correct. New best" to screen readers (Stamp.tsx has an sr-only "Correct. " before it). */
    fun description(verdict: StampVerdict): String =
        if (verdict == StampVerdict.NEW_BEST) "Correct. New best" else word(verdict)

    fun stubWord(kind: StubStampKind): String = when (kind) {
        StubStampKind.CORRECT -> "Correct"
        StubStampKind.WRONG -> "Not quite"
        StubStampKind.TIME_UP -> "Time is up"
    }

    fun intentWord(kind: IntentKind): String = if (kind == IntentKind.TRUE) "True" else "False"
}

data class StampFrame(val scale: Float, val rotation: Float, val alpha: Float)

/** components/easing.ts: a stamp lands from scale 1.9, -14 degrees and invisible to scale 1, -6 degrees and visible. */
object StampLanding {
    const val FROM_SCALE = 1.9f
    const val FROM_ROTATION = -14f
    const val REST_ROTATION = -6f

    /** [progress] is the eased fraction 0 to 1 (the spring curve may take it a little past 1). */
    fun at(progress: Float): StampFrame = StampFrame(
        scale = FROM_SCALE + (1f - FROM_SCALE) * progress,
        rotation = FROM_ROTATION + (REST_ROTATION - FROM_ROTATION) * progress,
        alpha = progress.coerceIn(0f, 1f),
    )
}

/** Stamp.tsx StubStamp: "Time is up" lands 120 ms later than a verdict. */
const val STUB_TIME_UP_DELAY_MS = 120

@Composable
private fun rememberLandingProgress(
    animate: Boolean,
    durationMs: Int,
    delayMs: Int,
    easing: Easing,
    replayKey: Any?,
): State<Float> {
    val reduced = LocalReducedMotion.current
    val land = animate && !reduced
    val progress = remember { Animatable(if (land) 0f else 1f) }
    LaunchedEffect(land, durationMs, delayMs, replayKey) {
        if (land) {
            progress.snapTo(0f)
            progress.animateTo(1f, tween(durationMs, delayMs, easing))
        } else {
            progress.snapTo(1f)
        }
    }
    return progress.asState()
}

/**
 * The verdict stamp on the answer slip (Stamp.tsx): an icon and a word in the verdict colour inside a double border,
 * turned -6 degrees. With [animate] it lands (420 ms after 380 ms, spring curve); with reduced motion it is shown at
 * rest. Change [replayKey] to play the landing again.
 */
@Composable
fun Stamp(
    verdict: StampVerdict,
    modifier: Modifier = Modifier,
    animate: Boolean = false,
    replayKey: Any? = null,
) {
    val colors = TruthyTheme.colors
    val color = if (verdict == StampVerdict.WRONG) colors.wrong else colors.correct
    val landing = Tokens.Transitions.stamp
    val progress = rememberLandingProgress(animate, landing.durationMs, landing.delayMs, landing.easing, replayKey)
    Row(
        modifier = modifier
            .graphicsLayer {
                val frame = StampLanding.at(progress.value)
                scaleX = frame.scale
                scaleY = frame.scale
                rotationZ = frame.rotation
                alpha = frame.alpha
            }
            .stampBorder(color, double = true)
            .padding(Tokens.Stroke.stamp)
            .padding(start = Tokens.Space.s14, end = Tokens.Space.s14, top = Tokens.Space.s6, bottom = Tokens.Space.s4)
            .clearAndSetSemantics { contentDescription = StampText.description(verdict) },
        horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s8),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        when (verdict) {
            StampVerdict.CORRECT -> TruthyIcon(IconId.CHECK, tint = color, width = 22.dp)
            StampVerdict.WRONG -> TruthyIcon(IconId.CROSS, tint = color, width = 18.dp)
            StampVerdict.NEW_BEST -> TruthyIcon(IconId.STAR, tint = color, width = 20.dp)
        }
        TruthyText(StampText.word(verdict), TruthyType.stamp, color)
    }
}

/**
 * The stamp on the stub of a Timed card (Stamp.tsx StubStamp): the same stamp at 28 on raised paper, so the barcode under
 * it does not show through. It lands over 300 ms (120 ms late for Time is up); with reduced motion it is shown at rest.
 */
@Composable
fun StubStamp(kind: StubStampKind, modifier: Modifier = Modifier, replayKey: Any? = null) {
    val colors = TruthyTheme.colors
    val color = when (kind) {
        StubStampKind.CORRECT -> colors.correct
        StubStampKind.WRONG -> colors.wrong
        StubStampKind.TIME_UP -> colors.ink
    }
    val delay = if (kind == StubStampKind.TIME_UP) STUB_TIME_UP_DELAY_MS else 0
    val progress = rememberLandingProgress(true, Tokens.Duration.stampTimed, delay, Tokens.Curves.spring, replayKey)
    Row(
        modifier = modifier
            .graphicsLayer {
                val frame = StampLanding.at(progress.value)
                scaleX = frame.scale
                scaleY = frame.scale
                rotationZ = frame.rotation
                alpha = frame.alpha
            }
            .background(colors.surfaceRaised, RoundedCornerShape(Tokens.Radius.small))
            .stampBorder(color, double = true)
            .padding(Tokens.Stroke.stamp)
            .padding(start = Tokens.Space.s18, end = Tokens.Space.s18, top = Tokens.Space.s8, bottom = Tokens.Space.s6)
            .clearAndSetSemantics { contentDescription = StampText.stubWord(kind) },
        horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s8),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        when (kind) {
            StubStampKind.CORRECT -> TruthyIcon(IconId.CHECK, tint = color, width = 24.dp)
            StubStampKind.WRONG -> TruthyIcon(IconId.CROSS, tint = color, width = 20.dp)
            StubStampKind.TIME_UP -> TruthyIcon(IconId.CLOCK, tint = color)
        }
        TruthyText(StampText.stubWord(kind), TruthyType.stampStub, color)
    }
}

/**
 * The preview that follows the finger while the card is dragged (BoardingPass.tsx INTENT_STAMP): True in the true colour
 * with a check, False in the false colour with a cross, on raised paper inside a solid 3 border. The round screen sets
 * its opacity and rotation (task 13); this draws it at rest.
 */
@Composable
fun IntentStamp(kind: IntentKind, modifier: Modifier = Modifier) {
    val colors = TruthyTheme.colors
    val color = if (kind == IntentKind.TRUE) colors.trueColor else colors.falseColor
    Row(
        modifier = modifier
            .background(colors.surfaceRaised, RoundedCornerShape(Tokens.Radius.small))
            .stampBorder(color, double = false)
            .padding(Tokens.Stroke.stamp)
            .padding(horizontal = Tokens.Space.s12, vertical = Tokens.Space.s6)
            .clearAndSetSemantics { },
        horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s8),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (kind == IntentKind.TRUE) {
            TruthyIcon(IconId.CHECK, tint = color, width = 18.dp)
        } else {
            TruthyIcon(IconId.CROSS, tint = color, width = 16.dp)
        }
        TruthyText(StampText.intentWord(kind), TruthyType.intentStamp, color)
    }
}
