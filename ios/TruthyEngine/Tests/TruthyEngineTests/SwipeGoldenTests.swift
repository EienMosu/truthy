import Testing
@testable import TruthyEngine

// native-data/golden/src.input.swipe.*.json: every case computed by src/input/swipe.ts. Every load names the
// module and the function as literals, for task 1's coverage test.

private func member(_ value: GoldenValue, _ key: String) throws -> GoldenValue {
  guard let found = value[key] else { throw GoldenError(description: "no field \(key) in \(value)") }
  return found
}

private func sample(_ value: GoldenValue) throws -> SwipeSample {
  SwipeSample(x: try member(value, "x").number(), y: try member(value, "y").number(), t: try member(value, "t").number())
}

private func context(_ value: GoldenValue) throws -> SwipeContext {
  SwipeContext(viewportWidth: try member(value, "viewportWidth").number(), cardShownAt: try member(value, "cardShownAt").number())
}

@Suite struct SwipeGoldenTests {
  @Test func swipeConstant() throws {
    let output = try #require(try Golden.load("src/input/swipe", "SWIPE").cases.first).output
    #expect(SWIPE.commitPx == (try member(output, "commitPx").number()))
    #expect(SWIPE.flingPx == (try member(output, "flingPx").number()))
    #expect(SWIPE.flingVelocity == (try member(output, "flingVelocity").number()))
    #expect(SWIPE.settleMs == (try member(output, "settleMs").number()))
    #expect(SWIPE.edgePx == (try member(output, "edgePx").number()))
  }

  @Test func intentCases() throws {
    let file = try Golden.load("src/input/swipe", "intent")
    #expect(!file.cases.isEmpty)
    for c in file.cases {
      let got = intent(try member(c.input, "dx").number())
      #expect(got.bitPattern == (try c.output.number()).bitPattern, "\(c.name)")
    }
  }

  @Test func canStartCases() throws {
    let file = try Golden.load("src/input/swipe", "canStart")
    #expect(!file.cases.isEmpty)
    for c in file.cases {
      let got = canStart(try sample(try member(c.input, "sample")), try context(try member(c.input, "context")))
      #expect(got == (try c.output.bool()), "\(c.name)")
    }
  }

  @Test func interpretCases() throws {
    let file = try Golden.load("src/input/swipe", "interpret")
    #expect(!file.cases.isEmpty)
    for c in file.cases {
      let samples = try member(c.input, "samples").array().map(sample)
      let got = interpret(samples, try context(try member(c.input, "context")))
      #expect(got.rawValue == (try c.output.string()), "\(c.name)")
    }
  }
}
