package com.eienmosu.truthy.engine

import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sign

// Swipe interpretation, a line-by-line port of src/input/swipe.ts (reference 3.4).
// Pure: callers pass numbers. Positions are window coordinates in dp (the web's CSS px), times are monotonic
// milliseconds on the base of the pointer events' own uptime stamps (reference 7.3), and viewportWidth is the
// window width in dp.

data class SwipeConstants(
  val commitPx: Double,
  val flingPx: Double,
  val flingVelocity: Double, // dp per ms
  val settleMs: Double,
  val edgePx: Double,
)

val SWIPE = SwipeConstants(commitPx = 90.0, flingPx = 40.0, flingVelocity = 0.5, settleMs = 250.0, edgePx = 24.0)

// How far a drag must go for the preview to show full intent.
private const val INTENT_FULL_PX = 110.0

// The release velocity is measured over this many ms before the last sample.
private const val VELOCITY_WINDOW_MS = 80.0

data class SwipeSample(val x: Double, val y: Double, val t: Double)

data class SwipeContext(val viewportWidth: Double, val cardShownAt: Double)

enum class SwipeOutcome(val wire: String) { TRUE("true"), FALSE("false"), CANCEL("cancel") }

// -1 (fully towards False) to 1 (fully towards True), for the drag preview. clamp(value, -1, 1) on the web is
// Math.min(1, Math.max(-1, value)); kotlin.math.min and max treat signed zeros and NaN the same way.
fun intent(dx: Double): Double = min(1.0, max(-1.0, dx / INTENT_FULL_PX))

// A gesture may start only after the settle time and outside the edge zones, both ends inclusive.
fun canStart(sample: SwipeSample, context: SwipeContext): Boolean {
  val settled = sample.t - context.cardShownAt >= SWIPE.settleMs
  val awayFromEdges = sample.x >= SWIPE.edgePx && sample.x <= context.viewportWidth - SWIPE.edgePx
  return settled && awayFromEdges
}

private fun swipeSideOf(dx: Double): SwipeOutcome = if (dx > 0) SwipeOutcome.TRUE else SwipeOutcome.FALSE

// Horizontal velocity in dp per ms between the oldest earlier sample inside the window and the last one.
// No such sample, or no time between them, means 0.
private fun releaseVelocity(samples: List<SwipeSample>, last: SwipeSample): Double {
  val reference = samples.dropLast(1).firstOrNull { last.t - it.t <= VELOCITY_WINDOW_MS } ?: return 0.0
  val dt = last.t - reference.t
  if (dt <= 0) return 0.0
  return (last.x - reference.x) / dt
}

// Turns the samples of one gesture (first = touch down, last = release) into an answer or cancel.
fun interpret(samples: List<SwipeSample>, context: SwipeContext): SwipeOutcome {
  val first = samples.firstOrNull()
  val last = samples.lastOrNull()
  if (samples.size < 2 || first == null || last == null) return SwipeOutcome.CANCEL
  if (!canStart(first, context)) return SwipeOutcome.CANCEL

  val dx = last.x - first.x
  val dy = last.y - first.y
  if (dx == 0.0) return SwipeOutcome.CANCEL
  if (abs(dy) > abs(dx)) return SwipeOutcome.CANCEL

  if (abs(dx) >= SWIPE.commitPx) return swipeSideOf(dx)

  val velocityTowardsSide = releaseVelocity(samples, last) * sign(dx)
  if (abs(dx) >= SWIPE.flingPx && velocityTowardsSide >= SWIPE.flingVelocity) return swipeSideOf(dx)
  return SwipeOutcome.CANCEL
}
