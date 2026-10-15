// Swipe interpretation, a line-by-line port of src/input/swipe.ts (reference 3.4).
// Pure: callers pass numbers. Positions are window points, times are monotonic milliseconds on the base
// of UITouch.timestamp (reference 7.3), and viewportWidth is the window width.

public struct SwipeConstants: Equatable, Sendable {
  public let commitPx: Double
  public let flingPx: Double
  public let flingVelocity: Double  // points per ms
  public let settleMs: Double
  public let edgePx: Double
}

public let SWIPE = SwipeConstants(commitPx: 90, flingPx: 40, flingVelocity: 0.5, settleMs: 250, edgePx: 24)

// How far a drag must go for the preview to show full intent.
private let INTENT_FULL_PX: Double = 110

// The release velocity is measured over this many ms before the last sample.
private let VELOCITY_WINDOW_MS: Double = 80

public struct SwipeSample: Equatable, Sendable {
  public let x: Double
  public let y: Double
  public let t: Double
  public init(x: Double, y: Double, t: Double) { self.x = x; self.y = y; self.t = t }
}

public struct SwipeContext: Equatable, Sendable {
  public let viewportWidth: Double
  public let cardShownAt: Double
  public init(viewportWidth: Double, cardShownAt: Double) { self.viewportWidth = viewportWidth; self.cardShownAt = cardShownAt }
}

public enum SwipeOutcome: String, Sendable {
  case `true`, `false`, cancel
}

private func clamp(_ value: Double, _ min: Double, _ max: Double) -> Double {
  Swift.min(max, Swift.max(min, value))
}

// -1 (fully towards False) to 1 (fully towards True), for the drag preview.
public func intent(_ dx: Double) -> Double {
  clamp(dx / INTENT_FULL_PX, -1, 1)
}

// A gesture may start only after the settle time and outside the edge zones, both ends inclusive.
public func canStart(_ sample: SwipeSample, _ context: SwipeContext) -> Bool {
  let settled = sample.t - context.cardShownAt >= SWIPE.settleMs
  let awayFromEdges = sample.x >= SWIPE.edgePx && sample.x <= context.viewportWidth - SWIPE.edgePx
  return settled && awayFromEdges
}

private func sideOf(_ dx: Double) -> SwipeOutcome {
  dx > 0 ? .true : .false
}

// Horizontal velocity in points per ms between the oldest earlier sample inside the window and the last one.
// No such sample, or no time between them, means 0.
private func releaseVelocity(_ samples: [SwipeSample], _ last: SwipeSample) -> Double {
  guard let reference = samples.dropLast().first(where: { last.t - $0.t <= VELOCITY_WINDOW_MS }) else { return 0 }
  let dt = last.t - reference.t
  if dt <= 0 { return 0 }
  return (last.x - reference.x) / dt
}

// Turns the samples of one gesture (first = touch down, last = release) into an answer or cancel.
public func interpret(_ samples: [SwipeSample], _ context: SwipeContext) -> SwipeOutcome {
  guard samples.count >= 2, let first = samples.first, let last = samples.last else { return .cancel }
  if !canStart(first, context) { return .cancel }

  let dx = last.x - first.x
  let dy = last.y - first.y
  if dx == 0 { return .cancel }
  if abs(dy) > abs(dx) { return .cancel }

  if abs(dx) >= SWIPE.commitPx { return sideOf(dx) }

  let velocityTowardsSide = releaseVelocity(samples, last) * (dx > 0 ? 1 : -1)
  if abs(dx) >= SWIPE.flingPx && velocityTowardsSide >= SWIPE.flingVelocity { return sideOf(dx) }
  return .cancel
}
