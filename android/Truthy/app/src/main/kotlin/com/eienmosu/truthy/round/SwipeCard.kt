package com.eienmosu.truthy.round

import androidx.compose.animation.core.Animatable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.PointerInputChange
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.util.VelocityTracker
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.semantics.SemanticsPropertyKey
import com.eienmosu.truthy.design.Tokens
import com.eienmosu.truthy.engine.SwipeContext
import com.eienmosu.truthy.engine.SwipeOutcome
import com.eienmosu.truthy.engine.SwipeSample
import com.eienmosu.truthy.engine.canStart
import com.eienmosu.truthy.engine.intent
import com.eienmosu.truthy.engine.interpret
import kotlin.math.abs
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

/** The drawn card offset in dp, exposed for the UI tests that compare it with the finger travel (feel item N4). */
val CardDragOffset = SemanticsPropertyKey<Float>("CardDragOffset")

/**
 * The card's offset under the finger and its spring back. While a drag runs the drawn offset is c + dx (c: where a
 * springing card was caught); the intent stamps and the stub use dx alone.
 */
@Stable
internal class SwipeCardState(private val scope: CoroutineScope) {
    private val settle = Animatable(0f)
    private val stub = Animatable(0f)
    private var active = false
    private var dragging by mutableStateOf(false)
    private var caught by mutableFloatStateOf(0f)
    private var dragPx by mutableFloatStateOf(0f)
    private var liveIntent by mutableFloatStateOf(0f)

    /** The card's translation in px. */
    val drawnPx: Float get() = if (dragging) caught + dragPx else settle.value

    /** The intent stamps' intent: back to 0 at once on release, as the web resets --intent. */
    val stampIntent: Float get() = if (dragging) liveIntent else 0f

    /** The stub's pull and turn: the live intent, then springing back with the card. */
    val stubTurn: Float get() = if (dragging) liveIntent else stub.value

    fun begin() {
        caught = settle.value
        dragPx = 0f
        liveIntent = 0f
        dragging = true
        active = true
        scope.launch {
            settle.stop()
            stub.stop()
        }
    }

    fun move(dxPx: Float, dxDp: Double) {
        dragPx = dxPx
        liveIntent = intent(dxDp).toFloat()
    }

    /** Springs the card back to rest from where it is, seeded with the release velocity in px per second. No-op unless a drag is active. */
    fun release(velocityPxPerSecond: Float, reduced: Boolean) {
        if (!active) return
        active = false
        val from = caught + dragPx
        val turn = liveIntent
        scope.launch {
            settle.snapTo(from)
            stub.snapTo(turn)
            dragging = false
            if (reduced) {
                settle.snapTo(0f)
                stub.snapTo(0f)
                return@launch
            }
            launch { settle.animateTo(0f, snapSpring(), initialVelocity = velocityPxPerSecond) }
            stub.animateTo(0f, tweenOf(Tokens.SpringTransitions.snap.durationMs, Tokens.SpringTransitions.snap.easing))
        }
    }
}

/**
 * The drag on the stationary container inside the ticket's verticalScroll. It claims only horizontal-dominant
 * movement past the touch slop, so the scroll keeps vertical drags; `interpret` decides the outcome.
 */
internal fun Modifier.swipeGesture(
    state: SwipeCardState,
    enabled: Boolean,
    reduced: Boolean,
    coordinates: () -> LayoutCoordinates?,
    windowWidthPx: () -> Int,
    cardShownAt: () -> Double,
    onThreshold: () -> Unit,
    onSwipe: (Boolean) -> Unit,
): Modifier = pointerInput(enabled, reduced) {
    if (!enabled) return@pointerInput
    awaitEachGesture {
        val down = awaitFirstDown(requireUnconsumed = false)
        val origin = coordinates()
        if (origin == null || !origin.isAttached) return@awaitEachGesture
        val scale = density.toDouble()
        fun sampleOf(change: PointerInputChange): SwipeSample {
            val at = origin.localToWindow(change.position)
            return SwipeSample(at.x / scale, at.y / scale, change.uptimeMillis.toDouble())
        }
        val first = sampleOf(down)
        val context = SwipeContext(viewportWidth = windowWidthPx() / scale, cardShownAt = cardShownAt())
        if (!canStart(first, context)) return@awaitEachGesture
        val samples = mutableListOf(first)
        val velocity = VelocityTracker()
        velocity.addPosition(down.uptimeMillis, down.position)
        val line = CommitLine()
        var claimed = false
        state.begin()
        try {
            while (true) {
                val event = awaitPointerEvent()
                val change = event.changes.firstOrNull { it.id == down.id }
                val secondPointer = event.changes.any { it.id != down.id && it.pressed }
                if (change == null || secondPointer || (!change.pressed && change.isConsumed) || (!claimed && change.isConsumed)) {
                    state.release(0f, reduced)
                    return@awaitEachGesture
                }
                samples.add(sampleOf(change))
                velocity.addPosition(change.uptimeMillis, change.position)
                if (!claimed) {
                    val travel = change.position - down.position
                    if (change.pressed && travel.getDistance() <= viewConfiguration.touchSlop) continue
                    if (change.pressed && abs(travel.x) <= abs(travel.y)) {
                        state.release(0f, reduced)
                        return@awaitEachGesture
                    }
                    claimed = true
                }
                change.consume()
                val dxDp = samples.last().x - first.x
                state.move(change.position.x - down.position.x, dxDp)
                if (line.crossed(dxDp)) onThreshold()
                if (!change.pressed) {
                    val outcome = interpret(samples, context)
                    state.release(velocity.calculateVelocity().x, reduced)
                    if (outcome != SwipeOutcome.CANCEL) onSwipe(outcome == SwipeOutcome.TRUE)
                    return@awaitEachGesture
                }
            }
        } finally {
            state.release(0f, reduced)
        }
    }
}
