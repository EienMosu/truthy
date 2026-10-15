import Testing
@testable import TruthyEngine

// Ports of tests/progress/partial-read.test.ts and the reading rules of reference 3.5.
private let stored = #"{"version":1,"cards":{"a":{"seen":3,"lastCorrect":false,"lastSeenAt":5}},"records":{"a/ALL#classic":7},"last":{"route":{"deckId":"a","sectionId":"ALL"},"mode":"classic","score":7,"total":10}}"#
private let keptA = CardHistory(seen: 3, lastCorrect: false, lastSeenAt: 5)
private let lastA = LastRound(route: Route(deckId: "a", sectionId: "ALL"), mode: .classic, score: 7, total: 10)

private func cardsOnly(_ cards: String) -> String { #"{"version":1,"cards":"# + cards + #","records":{},"last":null}"# }

@Suite struct ProgressReadTests {
  @Test func nothingStoredIsEmptyAndWhole() {
    #expect(readProgress(nil) == (progress: emptyProgress(), whole: true))
  }

  @Test func aValidValueReadsWhole() {
    #expect(readProgress(stored) == (progress: Progress(cards: ["a": keptA], records: ["a/ALL#classic": 7], last: lastA), whole: true))
  }

  @Test func valuesThatAreNotProgressReadEmptyAndNotWhole() {
    for raw in ["{not json", "", " ", "{", "undefined", "NaN", "true", "\u{0}", "null", "42", "\"progress\"", "[]", "{}",
      #"{"version":2}"#, #"{"version":"1"}"#, #"{"version":true}"#, "\u{FEFF}{\"version\":1}", #"{"version":1,}"#, "01"] {
      #expect(readProgress(raw) == (progress: emptyProgress(), whole: false), "\(raw)")
    }
  }

  @Test func aVersionWritten1Point0IsVersion1() {
    #expect(readProgress(#"{"version":1.0,"cards":{},"records":{},"last":null}"#) == (progress: emptyProgress(), whole: true))
  }

  @Test func aMissingLastKeyReadsNotWholeWhileAMissingScoreIsNull() {
    #expect(readProgress(#"{"version":1,"cards":{},"records":{}}"#) == (progress: emptyProgress(), whole: false))
    let older = #"{"version":1,"cards":{},"records":{},"last":{"route":{"deckId":"a","sectionId":"ALL"},"mode":"classic"}}"#
    let read = readProgress(older)
    #expect(read.whole)
    #expect(read.progress.last == LastRound(route: Route(deckId: "a", sectionId: "ALL"), mode: .classic, score: nil, total: nil))
  }

  @Test func aFailingPartIsDroppedAloneAndTheRestKept() {
    let badRecord = #"{"version":1,"cards":{},"records":{"x/ALL#classic":7.5,"y/ALL#classic":2},"last":null}"#
    #expect(readProgress(badRecord) == (progress: Progress(cards: [:], records: ["y/ALL#classic": 2], last: nil), whole: false))
    let badMode = #"{"version":1,"cards":{},"records":{},"last":{"route":{"deckId":"a","sectionId":"ALL"},"mode":"daily"}}"#
    #expect(readProgress(badMode) == (progress: emptyProgress(), whole: false))
    let cardsArray = #"{"version":1,"cards":[],"records":{"y/ALL#classic":2},"last":null}"#
    #expect(readProgress(cardsArray) == (progress: Progress(cards: [:], records: ["y/ALL#classic": 2], last: nil), whole: false))
  }

  @Test func numbersFollowJavaScriptAndZod() {
    // 1e999 parses to Infinity, so only the entry that holds it is dropped.
    let infinite = readProgress(cardsOnly(#"{"a":{"seen":1,"lastCorrect":true,"lastSeenAt":1e999},"b":{"seen":1,"lastCorrect":true,"lastSeenAt":2}}"#))
    #expect(infinite == (progress: Progress(cards: ["b": CardHistory(seen: 1, lastCorrect: true, lastSeenAt: 2)], records: [:], last: nil), whole: false))
    // Safe integers only.
    #expect(!readProgress(cardsOnly(#"{"a":{"seen":9007199254740992,"lastCorrect":true,"lastSeenAt":1}}"#)).whole)
    #expect(readProgress(cardsOnly(#"{"a":{"seen":9007199254740991,"lastCorrect":true,"lastSeenAt":1}}"#)).progress.cards["a"]?.seen == 9_007_199_254_740_991)
    // A fractional lastSeenAt is kept, and -0 stays -0.
    #expect(readProgress(cardsOnly(#"{"a":{"seen":1,"lastCorrect":true,"lastSeenAt":1.5}}"#)).progress.cards["a"]?.lastSeenAt == 1.5)
    let negativeZero = readProgress(cardsOnly(#"{"a":{"seen":1,"lastCorrect":true,"lastSeenAt":-0}}"#))
    #expect(negativeZero.whole && negativeZero.progress.cards["a"]?.lastSeenAt.sign == .minus)
  }

  @Test func unknownFieldsAreDroppedAndProtoIsAPlainKey() {
    let raw = #"{"version":1,"theme":"night","cards":{"__proto__":{"seen":1,"lastCorrect":true,"lastSeenAt":1,"flagged":true},"bad":{"seen":-1}},"records":{},"last":null}"#
    #expect(readProgress(raw) == (progress: Progress(cards: ["__proto__": CardHistory(seen: 1, lastCorrect: true, lastSeenAt: 1)], records: [:], last: nil), whole: false))
  }

  @Test func aLaterDuplicateKeyWinsAsInJSONParse() {
    let raw = #"{"version":1,"cards":{},"records":{"a/ALL#classic":1,"a/ALL#classic":4},"last":null}"#
    #expect(readProgress(raw).progress.records == ["a/ALL#classic": 4])
  }

  @Test func escapesInStringsAreDecoded() {
    let raw = #"{"version":1,"cards":{"café-\"1\"":{"seen":1,"lastCorrect":true,"lastSeenAt":1}},"records":{},"last":null}"#
    #expect(readProgress(raw).progress.cards.keys.first == "caf\u{e9}-\"1\"")
  }

  // A recorded deviation: JSON.parse reads any depth; the native reader stops at 512 instead of overflowing the stack.
  @Test func moreThan512NestedValuesFailTheReadWithoutCrashing() {
    #expect(readProgress(String(repeating: "[", count: 100_000)).whole == false)
    func withExtra(_ depth: Int) -> String {
      #"{"version":1,"cards":{},"records":{},"last":null,"extra":"# + String(repeating: "[", count: depth) + String(repeating: "]", count: depth) + "}"
    }
    // The outer object is one level, so 511 arrays inside it are the most that still read.
    #expect(readProgress(withExtra(511)).whole)
    #expect(readProgress(withExtra(512)) == (progress: emptyProgress(), whole: false))
  }

  @Test func aUnicodeEscapeNeedsFourHexDigits() {
    #expect(readProgress(#"{"version":1,"cards":{},"records":{"\u0041/ALL#classic":1},"last":null}"#).progress.records == ["A/ALL#classic": 1])
    #expect(readProgress(#"{"version":1,"cards":{},"records":{"\u+041/ALL#classic":1},"last":null}"#) == (progress: emptyProgress(), whole: false))
    #expect(readProgress(#"{"version":1,"cards":{},"records":{"\u004g/ALL#classic":1},"last":null}"#).whole == false)
  }
}
