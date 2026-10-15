package com.eienmosu.truthy

import androidx.compose.animation.core.Easing
import androidx.compose.animation.core.LinearEasing
import com.eienmosu.truthy.design.Tokens
import com.eienmosu.truthy.engine.Step

/** Where a layer of the start flow is during a back: its opacity, and its vertical offset in dp (positive is down). */
data class BackLayer(val alpha: Float, val offsetY: Float)

/**
 * The web's back motion of the start flow (StartFlow.tsx:230-267, 815-822; FillInPass.tsx:131-132, 379-385;
 * passValueTravel.ts:104-113) as a pure function of progress p, so that predictive back can scrub it (spec 5.1).
 * Time is p times durationMs, linear; each part keeps its own easing inside its window. [itemCount] counts the new
 * step's items, its title included; the stagger of 25 per item sets how long the whole back takes.
 */
data class BackTransition(val from: Step, val to: Step, val itemCount: Int) {
    init {
        require(to < from) { "A back goes to an earlier step, not from $from to $to." }
        require(itemCount >= 1) { "A step has at least its title, not $itemCount items." }
    }

    fun durationMs(reducedMotion: Boolean): Int =
        if (reducedMotion) {
            REDUCED_IN_DELAY_MS + Tokens.Duration.reducedIn
        } else {
            maxOf(
                Tokens.Duration.t3,
                Tokens.Duration.stepEnterDelay + Tokens.Duration.stepStagger * (itemCount - 1) + Tokens.Duration.stepEnter,
            )
        }

    fun frame(p: Float, reducedMotion: Boolean): BackFrame {
        val progress = if (p.isNaN()) 0f else p.coerceIn(0f, 1f)
        return BackFrame(this, progress * durationMs(reducedMotion), reducedMotion)
    }

    companion object {
        /** The leaving panel sinks 10 on the way back (StartFlow.tsx PANEL.gone: y = -10 * dir). */
        const val PANEL_SINK_DP = 10f

        /** The new step's items drop in from 24 above on the way back (StartFlow.tsx ITEM.hidden: y = 24 * dir). */
        const val ITEM_DROP_DP = 24f

        /** The top and foot zones move 12 as they swap (StartFlow.tsx swapMotion). */
        const val ZONE_SHIFT_DP = 12f

        /** Reduced motion: the new step fades in after 90 (StartFlow.tsx PANEL_REDUCED, 230 = 90 + 140). */
        const val REDUCED_IN_DELAY_MS = 90

        /** The pass's new block fades in after 90 (FillInPass.tsx BLOCK_IN). */
        const val BLOCK_IN_DELAY_MS = 90

        /** The old value copy is gone by 60 percent of the morph, the new one comes in from 40 percent (passValueTravel.ts). */
        const val VALUE_OUT_END = 0.6f
        const val VALUE_IN_START = 0.4f
    }
}

/** One frame of a [BackTransition], [timeMs] into it. */
data class BackFrame(val transition: BackTransition, val timeMs: Float, val reducedMotion: Boolean) {
    /** The step being left: it fades out and sinks. Its title fades faster, inside it ([oldTitleAlpha] multiplies). */
    val oldPanel: BackLayer
        get() = if (reducedMotion) {
            BackLayer(1f - reducedOut(), 0f)
        } else {
            val f = window(0, Tokens.Duration.stepExit, Tokens.Curves.easeOut)
            BackLayer(1f - f, BackTransition.PANEL_SINK_DP * f)
        }

    val oldTitleAlpha: Float
        get() = if (reducedMotion) 1f else 1f - window(0, Tokens.Duration.stepExitTitle, Tokens.Curves.easeOut)

    /** Item [index] of the new step (0 is its title); an index past the last item moves with the last one. */
    fun newItem(index: Int): BackLayer {
        if (reducedMotion) return BackLayer(reducedIn(), 0f)
        val i = index.coerceIn(0, transition.itemCount - 1)
        val f = window(Tokens.Duration.stepEnterDelay + Tokens.Duration.stepStagger * i, Tokens.Duration.stepEnter, Tokens.Curves.ease)
        return BackLayer(f, -BackTransition.ITEM_DROP_DP * (1f - f))
    }

    /** Back to step 1: the pass and the Back pill leave, the logo and the tagline come in. */
    val topSwap: Boolean get() = transition.to == Step.ONE
    val tripOut: BackLayer get() = zoneOut()
    val brandIn: BackLayer get() = zoneIn(-BackTransition.ZONE_SHIFT_DP)

    /** How far the theme switch has moved from the Back pill row to the logo row, 0 to 1 (back to step 1 only). */
    val switchShift: Float
        get() = when {
            !topSwap -> 0f
            reducedMotion -> snap()
            else -> window(0, Tokens.Duration.stepEnter, Tokens.Curves.ease)
        }

    /** Start round leaving (a back from step 6) and the continue line coming in (a back to step 1, when it shows). */
    val footOut: BackLayer get() = zoneOut()
    val footIn: BackLayer get() = zoneIn(BackTransition.ZONE_SHIFT_DP)

    /** The dashes of the pass fields this back clears. */
    val dashAlpha: Float
        get() = if (reducedMotion) snap() else window(Tokens.Duration.t3 - Tokens.Duration.dashIn, Tokens.Duration.dashIn, Tokens.Curves.ease)

    /** The pass changes stage (destination, route, ready) and stays on screen. */
    val stageChange: Boolean get() = transition.to != Step.ONE && stageOf(transition.from) != stageOf(transition.to)

    val oldBlockAlpha: Float
        get() = 1f - if (reducedMotion) reducedOut() else window(0, Tokens.Duration.t1, Tokens.Curves.easeOut)

    val newBlockAlpha: Float
        get() = if (reducedMotion) reducedIn() else window(BackTransition.BLOCK_IN_DELAY_MS, Tokens.Duration.t2, Tokens.Curves.ease)

    /** The paper's height and the band's height, from the old stage (0) to the new one (1). */
    val morph: Float
        get() = if (reducedMotion) snap() else window(0, Tokens.Duration.t3, Tokens.Curves.ease)

    /** Whether the values travel as two cross-fading copies; under reduced motion the blocks carry them. */
    val valuesTravel: Boolean get() = !reducedMotion

    val oldValueAlpha: Float
        get() = if (reducedMotion) 0f else 1f - windowOf(0f, Tokens.Duration.t3 * BackTransition.VALUE_OUT_END, LinearEasing)

    val newValueAlpha: Float
        get() = if (reducedMotion) {
            1f
        } else {
            windowOf(
                Tokens.Duration.t3 * BackTransition.VALUE_IN_START,
                Tokens.Duration.t3 * (1f - BackTransition.VALUE_IN_START),
                LinearEasing,
            )
        }

    private fun window(delayMs: Int, durationMs: Int, easing: Easing): Float =
        windowOf(delayMs.toFloat(), durationMs.toFloat(), easing)

    private fun windowOf(delayMs: Float, durationMs: Float, easing: Easing): Float {
        val f = (timeMs - delayMs) / durationMs
        return when {
            f <= 0f -> 0f
            f >= 1f -> 1f
            else -> easing.transform(f)
        }
    }

    // Reduced motion: out over 100, in over 140 after 90, with the web's default opacity easing (ease-out).
    private fun reducedOut(): Float = window(0, Tokens.Duration.reducedOut, Tokens.Curves.easeOut)

    private fun reducedIn(): Float = window(BackTransition.REDUCED_IN_DELAY_MS, Tokens.Duration.reducedIn, Tokens.Curves.easeOut)

    // What the web switches at once under reduced motion switches when the old step has faded out.
    private fun snap(): Float = if (timeMs >= Tokens.Duration.reducedOut.toFloat()) 1f else 0f

    private fun zoneOut(): BackLayer =
        if (reducedMotion) {
            BackLayer(1f - reducedOut(), 0f)
        } else {
            val f = window(0, Tokens.Duration.topExit, Tokens.Curves.ease)
            BackLayer(1f - f, BackTransition.ZONE_SHIFT_DP * f)
        }

    private fun zoneIn(fromOffset: Float): BackLayer =
        if (reducedMotion) {
            BackLayer(reducedIn(), 0f)
        } else {
            val f = window(Tokens.Duration.topEnterDelay, Tokens.Duration.stepEnter, Tokens.Curves.ease)
            BackLayer(f, fromOffset * (1f - f))
        }

    private fun stageOf(step: Step): Int = when (step) {
        Step.ONE -> 0
        Step.TWO, Step.THREE -> 1
        Step.FOUR, Step.FIVE -> 2
        Step.SIX -> 3
    }
}
