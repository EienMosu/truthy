package com.eienmosu.truthy.start

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.eienmosu.truthy.BackTransition
import com.eienmosu.truthy.design.Tokens
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

/**
 * What the start screen draws and how far its step change has got (Rule 1). One motion runs at a time: starting a
 * new one first ends the running one, as if it had finished (a gesture not yet committed returns to its step).
 */
@Stable
class StartMotion(private val scope: CoroutineScope, private val travels: Travels, initial: PanelSnapshot) {
    var shown by mutableStateOf(initial)
        private set
    var leaving by mutableStateOf<PanelSnapshot?>(null)
        private set
    var layers by mutableStateOf(StepLayers.rest(0))
        private set
    var direction by mutableIntStateOf(1)
        private set
    var swaps by mutableStateOf(Swaps.NONE)
        private set

    private val clock = Animatable(0f)
    private var job: Job? = null
    private var pendingEnd: (() -> Unit)? = null
    private var scrub: Scrub? = null

    private inner class Scrub(val from: PanelSnapshot, val transition: BackTransition, val itemCount: Int, val reduced: Boolean, val swaps: Swaps) {
        var p = 0f
        fun at(p: Float): StepLayers {
            val frame = transition.frame(p, reduced)
            travels.clockMs = frame.timeMs
            return backLayers(frame, itemCount, swaps)
        }
    }

    /** Ends the running motion now and returns the step drawn as current. */
    fun finishNow(): PanelSnapshot {
        job?.cancel()
        job = null
        val end = pendingEnd
        pendingEnd = null
        scrub = null
        end?.invoke()
        settle()
        return shown
    }

    /** A step change with nothing to animate (a step shown at once): draw it at rest. */
    fun showAtOnce(to: PanelSnapshot) {
        finishNow()
        shown = to
    }

    fun forward(to: PanelSnapshot, itemCount: Int, reduced: Boolean, swaps: Swaps, travel: TravelStart?) {
        val from = finishNow()
        begin(from, to, direction = 1, swaps = swaps)
        if (travel != null && !reduced) travels.start(travel)
        play(forwardDurationMs(itemCount, reduced), reduced) { t ->
            travels.clockMs = t
            forwardLayers(t, itemCount, reduced, swaps)
        }
    }

    /** A back by a tap or a key: the model has already gone back; the motion plays over its whole duration. */
    fun backOverTime(to: PanelSnapshot, itemCount: Int, reduced: Boolean, swaps: Swaps, travel: TravelStart?) {
        val from = finishNow()
        begin(from, to, direction = -1, swaps = swaps)
        if (travel != null && !reduced) travels.start(travel)
        val transition = BackTransition(from.step, to.step, itemCount)
        val total = transition.durationMs(reduced)
        play(total, reduced) { t ->
            val frame = transition.frame(t / total, reduced)
            travels.clockMs = frame.timeMs
            backLayers(frame, itemCount, swaps)
        }
    }

    /** A back gesture began: draw the step behind at progress 0; the model is not told until the gesture commits. */
    fun beginScrub(to: PanelSnapshot, transition: BackTransition, itemCount: Int, reduced: Boolean, swaps: Swaps, travel: TravelStart?) {
        val from = finishNow()
        begin(from, to, direction = -1, swaps = swaps)
        if (travel != null && !reduced) travels.start(travel)
        val s = Scrub(from, transition, itemCount, reduced, swaps)
        scrub = s
        pendingEnd = { shown = s.from }
        layers = s.at(0f)
    }

    fun scrubTo(p: Float) {
        val s = scrub ?: return
        s.p = p
        layers = s.at(p)
    }

    /** The gesture committed: play what is left (nothing for an instant commit), then tell the model. */
    fun commitScrub(lastProgress: Float?, onCommitted: () -> Unit) {
        val s = scrub ?: return
        scrub = null
        val ms = remainingMs(lastProgress, s.transition.durationMs(s.reduced))
        if (ms == 0) {
            pendingEnd = null
            settle()
            onCommitted()
            return
        }
        pendingEnd = onCommitted
        val start = s.p
        job = scope.launch(motionContext(s.reduced)) {
            clock.snapTo(start)
            clock.animateTo(1f, tween(durationMillis = ms, easing = LinearEasing)) { layers = s.at(value) }
            finishRun()
        }
    }

    /** The gesture was cancelled: spring back to progress 0, then draw the step it started from. */
    fun cancelScrub() {
        val s = scrub ?: return
        scrub = null
        pendingEnd = { shown = s.from }
        val snap = Tokens.SpringTransitions.snap
        job = scope.launch(motionContext(s.reduced)) {
            clock.snapTo(s.p)
            clock.animateTo(0f, tween(durationMillis = snap.durationMs, easing = snap.easing)) { layers = s.at(value) }
            finishRun()
        }
    }

    private fun begin(from: PanelSnapshot, to: PanelSnapshot, direction: Int, swaps: Swaps) {
        leaving = from
        shown = to
        this.direction = direction
        this.swaps = swaps
    }

    private fun settle() {
        leaving = null
        layers = StepLayers.rest(0)
        swaps = Swaps.NONE
        travels.clear()
    }

    private fun finishRun() {
        val end = pendingEnd
        pendingEnd = null
        job = null
        settle()
        end?.invoke()
    }

    private fun play(totalMs: Int, reduced: Boolean, frameAt: (Float) -> StepLayers) {
        layers = frameAt(0f)
        pendingEnd = null
        job = scope.launch(motionContext(reduced)) {
            clock.snapTo(0f)
            clock.animateTo(totalMs.toFloat(), tween(durationMillis = totalMs, easing = LinearEasing)) { layers = frameAt(value) }
            finishRun()
        }
    }
}
