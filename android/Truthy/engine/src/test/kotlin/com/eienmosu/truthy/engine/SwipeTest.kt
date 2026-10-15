package com.eienmosu.truthy.engine

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

// Ports of tests/input/swipe.test.ts, swipe-polish.test.ts and swipe-early-touch-polish.test.ts.
// A 390 wide window whose card appeared at t = 0; gestures start mid-screen at (195, 400) at t = 1000.
class SwipeTest {
  private val phone = SwipeContext(viewportWidth = 390.0, cardShownAt = 0.0)

  private fun touch(x: Int, t: Int) = SwipeSample(x = x.toDouble(), y = 400.0, t = t.toDouble())

  private fun p(dx: Int, dy: Int, dt: Int) = Triple(dx, dy, dt)

  // Samples given as (dx, dy, dt) from the touch-down point.
  private fun gesture(vararg offsets: Triple<Int, Int, Int>): List<SwipeSample> =
    offsets.map { (dx, dy, dt) -> SwipeSample(x = 195.0 + dx, y = 400.0 + dy, t = 1000.0 + dt) }

  @Test fun constantsMatchTheInputTable() {
    assertEquals(SwipeConstants(commitPx = 90.0, flingPx = 40.0, flingVelocity = 0.5, settleMs = 250.0, edgePx = 24.0), SWIPE)
  }

  @Test fun intentIsProportionalInside110AndClampedBeyond() {
    assertEquals(0.0, intent(0.0))
    assertEquals(0.5, intent(55.0))
    assertEquals(-0.5, intent(-55.0))
    assertEquals(1.0, intent(110.0))
    assertEquals(-1.0, intent(-110.0))
    assertEquals(1.0, intent(500.0))
    assertEquals(-1.0, intent(-500.0))
  }

  @Test fun canStartWaitsForTheSettleTimeFromCardShownAt() {
    assertFalse(canStart(touch(195, 249), phone))
    assertTrue(canStart(touch(195, 250), phone))
    val later = SwipeContext(viewportWidth = 390.0, cardShownAt = 10_000.0)
    assertFalse(canStart(touch(195, 10_100), later))
    assertTrue(canStart(touch(195, 10_250), later))
    val shown = SwipeContext(viewportWidth = 390.0, cardShownAt = 1_000.0)
    assertFalse(canStart(touch(100, 0), shown))
    assertFalse(canStart(touch(100, 749), shown))
  }

  @Test fun canStartRejectsTheEdgeZonesBothEndsInclusive() {
    assertFalse(canStart(touch(23, 1000), phone))
    assertTrue(canStart(touch(24, 1000), phone))
    assertFalse(canStart(touch(367, 1000), phone))
    assertTrue(canStart(touch(366, 1000), phone))
    assertFalse(canStart(touch(0, 1000), phone))
    val tablet = SwipeContext(viewportWidth = 1024.0, cardShownAt = 0.0)
    assertTrue(canStart(touch(1000, 1000), tablet))
    assertFalse(canStart(touch(1001, 1000), tablet))
  }

  @Test fun interpretNeedsTwoSamplesAMoveAndAValidStart() {
    assertEquals(SwipeOutcome.CANCEL, interpret(emptyList(), phone))
    assertEquals(SwipeOutcome.CANCEL, interpret(gesture(p(0, 0, 0)), phone))
    assertEquals(SwipeOutcome.CANCEL, interpret(gesture(p(0, 0, 0), p(0, 0, 500)), phone))
    assertEquals(SwipeOutcome.CANCEL, interpret(gesture(p(0, 0, 0), p(120, 0, 300)), SwipeContext(viewportWidth = 390.0, cardShownAt = 900.0)))
    assertEquals(SwipeOutcome.CANCEL, interpret(listOf(touch(10, 1000), touch(130, 1300)), phone))
  }

  @Test fun interpretCommitsBy90AtReleaseByTheSideAtRelease() {
    assertEquals(SwipeOutcome.TRUE, interpret(gesture(p(0, 0, 0), p(45, 0, 300), p(90, 0, 600)), phone))
    assertEquals(SwipeOutcome.CANCEL, interpret(gesture(p(0, 0, 0), p(45, 0, 300), p(89, 0, 600)), phone))
    assertEquals(SwipeOutcome.FALSE, interpret(gesture(p(0, 0, 0), p(-45, 0, 300), p(-90, 0, 600)), phone))
    assertEquals(SwipeOutcome.CANCEL, interpret(gesture(p(0, 0, 0), p(150, 0, 300), p(60, 0, 900)), phone))
    assertEquals(SwipeOutcome.FALSE, interpret(gesture(p(0, 0, 0), p(120, 0, 300), p(-100, 0, 900)), phone))
  }

  @Test fun interpretCancelsMostlyVerticalAndCommitsAnExactDiagonal() {
    assertEquals(SwipeOutcome.CANCEL, interpret(gesture(p(0, 0, 0), p(50, 150, 300), p(100, 300, 600)), phone))
    assertEquals(SwipeOutcome.CANCEL, interpret(gesture(p(0, 0, 0), p(-100, -101, 600)), phone))
    assertEquals(SwipeOutcome.TRUE, interpret(gesture(p(0, 0, 0), p(100, 100, 600)), phone))
  }

  @Test fun interpretFlingsFrom40AtHalfADpPerMs() {
    assertEquals(SwipeOutcome.TRUE, interpret(gesture(p(0, 0, 0), p(20, 0, 20), p(40, 0, 40)), phone))
    assertEquals(SwipeOutcome.CANCEL, interpret(gesture(p(0, 0, 0), p(20, 0, 20), p(39, 0, 40)), phone))
    assertEquals(SwipeOutcome.FALSE, interpret(gesture(p(0, 0, 0), p(-20, 0, 20), p(-40, 0, 40)), phone))
    assertEquals(SwipeOutcome.TRUE, interpret(gesture(p(0, 0, 0), p(20, 0, 400), p(60, 0, 480)), phone))
    assertEquals(SwipeOutcome.CANCEL, interpret(gesture(p(0, 0, 0), p(20, 0, 400), p(59, 0, 480)), phone))
    assertEquals(SwipeOutcome.CANCEL, interpret(gesture(p(0, 0, 0), p(80, 0, 400), p(65, 0, 420), p(50, 0, 440)), phone))
  }

  @Test fun interpretMeasuresVelocityFromTheOldestSampleInsideThe80MsWindow() {
    assertEquals(SwipeOutcome.CANCEL, interpret(gesture(p(0, 0, 0), p(5, 0, 400), p(50, 0, 481)), phone))
    assertEquals(SwipeOutcome.TRUE, interpret(gesture(p(0, 0, 0), p(5, 0, 401), p(50, 0, 481)), phone))
    assertEquals(SwipeOutcome.TRUE, interpret(gesture(p(0, 0, 0), p(10, 0, 400), p(48, 0, 460), p(50, 0, 470)), phone))
    assertEquals(SwipeOutcome.CANCEL, interpret(gesture(p(0, 0, 0), p(30, 0, 400), p(30, 0, 460), p(50, 0, 470)), phone))
  }

  @Test fun interpretReadsNoTimeBetweenSamplesAsNoVelocity() {
    assertEquals(SwipeOutcome.CANCEL, interpret(gesture(p(0, 0, 0), p(50, 0, 0)), phone))
    assertEquals(SwipeOutcome.TRUE, interpret(gesture(p(0, 0, 0), p(100, 0, 0)), phone))
    assertEquals(SwipeOutcome.CANCEL, interpret(gesture(p(0, 0, 0), p(50, 0, 200), p(60, 0, 200)), phone))
  }
}
