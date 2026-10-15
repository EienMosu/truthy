package com.eienmosu.truthy.start

import androidx.compose.animation.core.Easing
import androidx.compose.runtime.Immutable
import com.eienmosu.truthy.design.Tokens
import com.eienmosu.truthy.engine.Step
import kotlin.math.max
import kotlin.math.roundToInt

/** How a part is drawn in one frame: its opacity and its vertical offset in dp (positive downwards). */
@Immutable
data class Layer(val alpha: Float, val offsetY: Float) {
    companion object {
        val Shown = Layer(1f, 0f)
        val Gone = Layer(0f, 0f)
    }
}

/** A zone (top or foot) that swaps its content: the leaving content moves to `outRise`, the arriving one comes from `inRise` (dp). */
@Immutable
data class ZoneSwap(val outRise: Float, val inRise: Float)

/** What a step change moves besides the panels: the top zone, the foot zone, the pass's layout, the theme switch. */
@Immutable
data class Swaps(val top: ZoneSwap?, val foot: ZoneSwap?, val block: Boolean, val switchMoves: Boolean) {
    companion object {
        val NONE = Swaps(top = null, foot = null, block = false, switchMoves = false)
    }
}

/** What the foot zone holds (StartFlow.tsx:837-866): the continue line on step 1, Start round on step 6. */
enum class FootContent { NONE, CONTINUE, START }

/**
 * One frame of a step change. `oldPanel` and `oldTitleAlpha` draw the step being left; `newPanelAlpha` and `items`
 * (the title first, then each option) the arriving one; `dashOutAlpha` the dashes of the fields being filled (forward),
 * `dashInAlpha` those of the fields being cleared (back); the pass's two blocks and the change of its shape; the two
 * zones; and how far the theme switch has moved to its new row (0 to 1).
 */
@Immutable
data class StepLayers(
    val oldPanel: Layer,
    val oldTitleAlpha: Float,
    val newPanelAlpha: Float,
    val items: List<Layer>,
    val dashOutAlpha: Float,
    val dashInAlpha: Float,
    val oldBlockAlpha: Float,
    val newBlockAlpha: Float,
    val passMorph: Float,
    val topOut: Layer,
    val topIn: Layer,
    val footOut: Layer,
    val footIn: Layer,
    val switchMove: Float,
) {
    fun item(index: Int): Layer = items.getOrElse(index) { Layer.Shown }

    companion object {
        fun rest(itemCount: Int): StepLayers = StepLayers(
            oldPanel = Layer.Gone,
            oldTitleAlpha = 0f,
            newPanelAlpha = 1f,
            items = List(itemCount) { Layer.Shown },
            dashOutAlpha = 0f,
            dashInAlpha = 1f,
            oldBlockAlpha = 0f,
            newBlockAlpha = 1f,
            passMorph = 1f,
            topOut = Layer.Gone,
            topIn = Layer.Shown,
            footOut = Layer.Gone,
            footIn = Layer.Shown,
            switchMove = 1f,
        )
    }
}

/** Times and distances of the start flow's motion that are not a token of their own. */
object StartMotionTimes {
    /** FillInPass.tsx:131: the dashes of a field being filled wait 120 ms (the value of t1) before they leave. */
    val dashOutDelayMs: Int get() = Tokens.Duration.t1

    /** FillInPass.tsx:379 and :382, StartFlow.tsx:249: the 90 ms before a new pass block or a reduced step fades in. No token holds 90. */
    const val FADE_IN_DELAY_MS = 90

    /** StartFlow.tsx:234: the panel's 10 px rise (forward) or sink (back). */
    val panelTravelDp: Float get() = Tokens.Space.s10.value

    /** StartFlow.tsx:238: the items' 24 px. */
    val itemTravelDp: Float get() = Tokens.Space.s24.value

    /** StartFlow.tsx:263: the zones' 12 px. */
    val zoneTravelDp: Float get() = Tokens.Space.s12.value
}

fun footContent(step: Step, hasContinue: Boolean): FootContent = when {
    step == Step.ONE && hasContinue -> FootContent.CONTINUE
    step == Step.SIX -> FootContent.START
    else -> FootContent.NONE
}

/** StartFlow.tsx:775-866: the logo leaves upward and the trip rises in, or the reverse; the foot swaps its content; the pass changes layout between stages. */
fun swapsFor(from: Step, to: Step, footFrom: FootContent, footTo: FootContent): Swaps {
    val zone = StartMotionTimes.zoneTravelDp
    val top = when {
        from == Step.ONE && to != Step.ONE -> ZoneSwap(outRise = -zone, inRise = zone)
        from != Step.ONE && to == Step.ONE -> ZoneSwap(outRise = zone, inRise = -zone)
        else -> null
    }
    val foot = if (footFrom == footTo) null else ZoneSwap(outRise = zone, inRise = zone)
    val block = from != Step.ONE && to != Step.ONE && stageOf(from) != stageOf(to)
    return Swaps(top = top, foot = foot, block = block, switchMoves = (from == Step.ONE) != (to == Step.ONE))
}

internal fun progress(t: Float, delayMs: Int, durationMs: Int): Float =
    if (durationMs <= 0) (if (t >= delayMs) 1f else 0f) else ((t - delayMs) / durationMs).coerceIn(0f, 1f)

internal fun Easing.at(x: Float): Float = when {
    x <= 0f -> 0f
    x >= 1f -> 1f
    else -> transform(x)
}

/** How long a step change runs: until the last item has arrived, and at least as long as the pass's change of shape and the zone swap. */
fun forwardDurationMs(itemCount: Int, reduced: Boolean): Int {
    val d = Tokens.Duration
    if (reduced) return StartMotionTimes.FADE_IN_DELAY_MS + d.reducedIn
    val lastItem = d.stepEnterDelay + d.stepStagger * max(0, itemCount - 1) + d.stepEnter
    return max(lastItem, max(d.t3, d.topEnterDelay + d.stepEnter))
}

/** The time left for a back that commits at `lastProgress`; none at all when no progress was ever reported (an instant commit). */
fun remainingMs(lastProgress: Float?, totalMs: Int): Int =
    if (lastProgress == null) 0 else ((1f - lastProgress.coerceIn(0f, 1f)) * totalMs).roundToInt()

/** The forward step change at `tMs` (StartFlow.tsx:230-269, FillInPass.tsx:131-132 and 379-385; reduced: StartFlow.tsx:247-260). */
fun forwardLayers(tMs: Float, itemCount: Int, reduced: Boolean, swaps: Swaps): StepLayers {
    val d = Tokens.Duration
    if (reduced) {
        val out = 1f - progress(tMs, 0, d.reducedOut)
        val enter = progress(tMs, StartMotionTimes.FADE_IN_DELAY_MS, d.reducedIn)
        return StepLayers(
            oldPanel = Layer(out, 0f),
            oldTitleAlpha = 1f, // the title fades with its panel (a title's alpha multiplies the panel's)
            newPanelAlpha = enter,
            items = List(itemCount) { Layer.Shown },
            dashOutAlpha = 0f,
            dashInAlpha = 1f,
            oldBlockAlpha = if (swaps.block) out else 0f,
            newBlockAlpha = if (swaps.block) enter else 1f,
            passMorph = 1f,
            topOut = if (swaps.top != null) Layer(out, 0f) else Layer.Gone,
            topIn = if (swaps.top != null) Layer(enter, 0f) else Layer.Shown,
            footOut = if (swaps.foot != null) Layer(out, 0f) else Layer.Gone,
            footIn = if (swaps.foot != null) Layer(enter, 0f) else Layer.Shown,
            switchMove = 1f,
        )
    }
    val ease = Tokens.Curves.ease
    val easeOut = Tokens.Curves.easeOut
    val exit = easeOut.at(progress(tMs, 0, d.stepExit))
    val zoneOut = ease.at(progress(tMs, 0, d.topExit))
    val zoneIn = ease.at(progress(tMs, d.topEnterDelay, d.stepEnter))
    return StepLayers(
        oldPanel = Layer(1f - exit, -StartMotionTimes.panelTravelDp * exit),
        oldTitleAlpha = 1f - easeOut.at(progress(tMs, 0, d.stepExitTitle)),
        newPanelAlpha = 1f,
        items = List(itemCount) { i ->
            val e = ease.at(progress(tMs, d.stepEnterDelay + d.stepStagger * i, d.stepEnter))
            Layer(e, StartMotionTimes.itemTravelDp * (1f - e))
        },
        dashOutAlpha = 1f - easeOut.at(progress(tMs, StartMotionTimes.dashOutDelayMs, d.dashOut)),
        dashInAlpha = 1f,
        oldBlockAlpha = if (swaps.block) 1f - easeOut.at(progress(tMs, 0, d.t1)) else 0f,
        newBlockAlpha = if (swaps.block) ease.at(progress(tMs, StartMotionTimes.FADE_IN_DELAY_MS, d.t2)) else 1f,
        passMorph = if (swaps.block) ease.at(progress(tMs, 0, d.t3)) else 1f,
        topOut = swaps.top?.let { Layer(1f - zoneOut, it.outRise * zoneOut) } ?: Layer.Gone,
        topIn = swaps.top?.let { Layer(zoneIn, it.inRise * (1f - zoneIn)) } ?: Layer.Shown,
        footOut = swaps.foot?.let { Layer(1f - zoneOut, it.outRise * zoneOut) } ?: Layer.Gone,
        footIn = swaps.foot?.let { Layer(zoneIn, it.inRise * (1f - zoneIn)) } ?: Layer.Shown,
        switchMove = if (swaps.switchMoves) ease.at(progress(tMs, 0, d.stepEnter)) else 1f,
    )
}
