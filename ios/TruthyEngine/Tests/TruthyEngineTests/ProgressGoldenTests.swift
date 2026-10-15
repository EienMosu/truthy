import Testing
@testable import TruthyEngine

// native-data/golden/src.progress.progress.*.json: every case computed by src/progress/progress.ts.
private typealias G = ProgressGolden

@Suite struct ProgressGoldenTests {
  @Test func emptyProgressCase() throws {
    let file = try Golden.load("src/progress/progress", "emptyProgress")
    for c in file.cases { #expect(G.exactly(emptyProgress(), try G.progress(c.output)), "\(c.name)") }
  }

  @Test func recordKeyCases() throws {
    let file = try Golden.load("src/progress/progress", "recordKey")
    #expect(!file.cases.isEmpty)
    for c in file.cases {
      let got = recordKey(try G.route(try G.required(c.input, "route")), try G.mode(try G.required(c.input, "mode")))
      #expect(got == (try c.output.string()), "\(c.name)")
    }
  }

  @Test func bestForCases() throws {
    let file = try Golden.load("src/progress/progress", "bestFor")
    #expect(!file.cases.isEmpty)
    for c in file.cases {
      let got = bestFor(try G.progress(try G.required(c.input, "progress")), try G.route(try G.required(c.input, "route")), try G.mode(try G.required(c.input, "mode")))
      #expect(got == (try G.optionalInt(c.output)), "\(c.name)")
    }
  }

  @Test func compareWithBestCases() throws {
    let file = try Golden.load("src/progress/progress", "compareWithBest")
    #expect(!file.cases.isEmpty)
    for c in file.cases {
      let got = compareWithBest(try G.required(c.input, "score").int(), try G.optionalInt(try G.required(c.input, "previousBest")))
      #expect(got == (try G.comparison(c.output)), "\(c.name)")
    }
  }

  @Test func applyResultCases() throws {
    let file = try Golden.load("src/progress/progress", "applyResult")
    #expect(!file.cases.isEmpty)
    for c in file.cases {
      let got = applyResult(try G.progress(try G.required(c.input, "progress")), try G.roundResult(file, try G.required(c.input, "result")))
      #expect(G.exactly(got.progress, try G.progress(try G.required(c.output, "progress"))), "\(c.name): progress")
      #expect(got.previousBest == (try G.optionalInt(try G.required(c.output, "previousBest"))), "\(c.name): previousBest")
      #expect(got.isNewBest == (try G.required(c.output, "isNewBest").bool()), "\(c.name): isNewBest")
    }
  }

  @Test func pruneDeckCases() throws {
    let file = try Golden.load("src/progress/progress", "pruneDeck")
    #expect(!file.cases.isEmpty)
    for c in file.cases {
      let got = pruneDeck(
        try G.progress(try G.required(c.input, "progress")), try G.required(c.input, "deckId").string(),
        try G.strings(try G.required(c.input, "cardIds")))
      #expect(G.exactly(got, try G.progress(c.output)), "\(c.name)")
    }
  }

  @Test func seenShareCases() throws {
    let file = try Golden.load("src/progress/progress", "seenShare")
    #expect(!file.cases.isEmpty)
    for c in file.cases {
      let got = seenShare(try G.history(try G.required(c.input, "history")), try G.strings(try G.required(c.input, "cardIds")))
      #expect(got.bitPattern == (try c.output.number()).bitPattern, "\(c.name)")
    }
  }
}
