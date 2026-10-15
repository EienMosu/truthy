import Testing
@testable import TruthyEngine

// native-data/golden/src.progress.progress.readProgress.json and parseProgress.json, computed by the TypeScript code.
private typealias G = ProgressGolden

@Suite struct ProgressReadGoldenTests {
  @Test func readProgressCases() throws {
    let file = try Golden.load("src/progress/progress", "readProgress")
    #expect(!file.cases.isEmpty)
    for c in file.cases {
      let raw = try G.required(c.input, "raw")
      let got = readProgress(raw == .null ? nil : try raw.string())
      #expect(G.exactly(got.progress, try G.progress(try G.required(c.output, "progress"))), "\(c.name): progress")
      #expect(got.whole == (try G.required(c.output, "whole").bool()), "\(c.name): whole")
    }
  }

  @Test func parseProgressCases() throws {
    let file = try Golden.load("src/progress/progress", "parseProgress")
    #expect(!file.cases.isEmpty)
    for c in file.cases {
      let raw = try G.required(c.input, "raw")
      let got = parseProgress(raw == .null ? nil : try raw.string())
      #expect(G.exactly(got, try G.progress(c.output)), "\(c.name)")
    }
  }
}
