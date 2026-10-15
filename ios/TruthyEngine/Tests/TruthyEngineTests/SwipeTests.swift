import Testing
@testable import TruthyEngine

// Ports of tests/input/swipe.test.ts, swipe-polish.test.ts and swipe-early-touch-polish.test.ts.
// A 390 wide window whose card appeared at t = 0; gestures start mid-screen at t = 1000.
private let phone = SwipeContext(viewportWidth: 390, cardShownAt: 0)

private func gesture(_ offsets: (Double, Double, Double)...) -> [SwipeSample] {
  offsets.map { SwipeSample(x: 195 + $0.0, y: 400 + $0.1, t: 1000 + $0.2) }
}

@Suite struct SwipeTests {
  @Test func constantsMatchTheInputTable() {
    #expect(SWIPE == SwipeConstants(commitPx: 90, flingPx: 40, flingVelocity: 0.5, settleMs: 250, edgePx: 24))
  }

  @Test func intentIsProportionalInside110AndClampedBeyond() {
    #expect(intent(0) == 0)
    #expect(intent(55) == 0.5)
    #expect(intent(-55) == -0.5)
    #expect(intent(110) == 1)
    #expect(intent(-110) == -1)
    #expect(intent(500) == 1)
    #expect(intent(-500) == -1)
  }

  @Test func canStartWaitsForTheSettleTimeFromCardShownAt() {
    #expect(!canStart(SwipeSample(x: 195, y: 400, t: 249), phone))
    #expect(canStart(SwipeSample(x: 195, y: 400, t: 250), phone))
    let later = SwipeContext(viewportWidth: 390, cardShownAt: 10_000)
    #expect(!canStart(SwipeSample(x: 195, y: 400, t: 10_100), later))
    #expect(canStart(SwipeSample(x: 195, y: 400, t: 10_250), later))
    let shown = SwipeContext(viewportWidth: 390, cardShownAt: 1_000)
    #expect(!canStart(SwipeSample(x: 100, y: 400, t: 0), shown))
    #expect(!canStart(SwipeSample(x: 100, y: 400, t: 749), shown))
  }

  @Test func canStartRejectsTheEdgeZonesBothEndsInclusive() {
    #expect(!canStart(SwipeSample(x: 23, y: 400, t: 1000), phone))
    #expect(canStart(SwipeSample(x: 24, y: 400, t: 1000), phone))
    #expect(!canStart(SwipeSample(x: 367, y: 400, t: 1000), phone))
    #expect(canStart(SwipeSample(x: 366, y: 400, t: 1000), phone))
    #expect(!canStart(SwipeSample(x: 0, y: 400, t: 1000), phone))
    let tablet = SwipeContext(viewportWidth: 1024, cardShownAt: 0)
    #expect(canStart(SwipeSample(x: 1000, y: 400, t: 1000), tablet))
    #expect(!canStart(SwipeSample(x: 1001, y: 400, t: 1000), tablet))
  }

  @Test func interpretNeedsTwoSamplesAMoveAndAValidStart() {
    #expect(interpret([], phone) == .cancel)
    #expect(interpret(gesture((0, 0, 0)), phone) == .cancel)
    #expect(interpret(gesture((0, 0, 0), (0, 0, 500)), phone) == .cancel)
    #expect(interpret(gesture((0, 0, 0), (120, 0, 300)), SwipeContext(viewportWidth: 390, cardShownAt: 900)) == .cancel)
    #expect(interpret([SwipeSample(x: 10, y: 400, t: 1000), SwipeSample(x: 130, y: 400, t: 1300)], phone) == .cancel)
  }

  @Test func interpretCommitsBy90AtReleaseByTheSideAtRelease() {
    #expect(interpret(gesture((0, 0, 0), (45, 0, 300), (90, 0, 600)), phone) == .true)
    #expect(interpret(gesture((0, 0, 0), (45, 0, 300), (89, 0, 600)), phone) == .cancel)
    #expect(interpret(gesture((0, 0, 0), (-45, 0, 300), (-90, 0, 600)), phone) == .false)
    #expect(interpret(gesture((0, 0, 0), (150, 0, 300), (60, 0, 900)), phone) == .cancel)
    #expect(interpret(gesture((0, 0, 0), (120, 0, 300), (-100, 0, 900)), phone) == .false)
  }

  @Test func interpretCancelsMostlyVerticalAndCommitsAnExactDiagonal() {
    #expect(interpret(gesture((0, 0, 0), (50, 150, 300), (100, 300, 600)), phone) == .cancel)
    #expect(interpret(gesture((0, 0, 0), (-100, -101, 600)), phone) == .cancel)
    #expect(interpret(gesture((0, 0, 0), (100, 100, 600)), phone) == .true)
  }

  @Test func interpretFlingsFrom40AtHalfAPointPerMs() {
    #expect(interpret(gesture((0, 0, 0), (20, 0, 20), (40, 0, 40)), phone) == .true)
    #expect(interpret(gesture((0, 0, 0), (20, 0, 20), (39, 0, 40)), phone) == .cancel)
    #expect(interpret(gesture((0, 0, 0), (-20, 0, 20), (-40, 0, 40)), phone) == .false)
    #expect(interpret(gesture((0, 0, 0), (20, 0, 400), (60, 0, 480)), phone) == .true)
    #expect(interpret(gesture((0, 0, 0), (20, 0, 400), (59, 0, 480)), phone) == .cancel)
    #expect(interpret(gesture((0, 0, 0), (80, 0, 400), (65, 0, 420), (50, 0, 440)), phone) == .cancel)
  }

  @Test func interpretMeasuresVelocityFromTheOldestSampleInsideThe80MsWindow() {
    #expect(interpret(gesture((0, 0, 0), (5, 0, 400), (50, 0, 481)), phone) == .cancel)
    #expect(interpret(gesture((0, 0, 0), (5, 0, 401), (50, 0, 481)), phone) == .true)
    #expect(interpret(gesture((0, 0, 0), (10, 0, 400), (48, 0, 460), (50, 0, 470)), phone) == .true)
    #expect(interpret(gesture((0, 0, 0), (30, 0, 400), (30, 0, 460), (50, 0, 470)), phone) == .cancel)
  }

  @Test func interpretReadsNoTimeBetweenSamplesAsNoVelocity() {
    #expect(interpret(gesture((0, 0, 0), (50, 0, 0)), phone) == .cancel)
    #expect(interpret(gesture((0, 0, 0), (100, 0, 0)), phone) == .true)
    #expect(interpret(gesture((0, 0, 0), (50, 0, 200), (60, 0, 200)), phone) == .cancel)
  }
}
