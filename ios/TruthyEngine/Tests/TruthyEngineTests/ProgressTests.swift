import Testing
@testable import TruthyEngine

// Ports of the pinned cases of tests/progress/progress.test.ts and progress-polish.test.ts.
private let sec = Route(deckId: "aws-clf-c02", sectionId: "SEC")
private let con = Route(deckId: "aws-clf-c02", sectionId: "CON")

private func answered(_ id: String, _ correct: Bool, _ at: Double) throws -> Answered {
  Answered(card: try ProgressFixtures.card(id), given: correct, correct: correct, at: at)
}

private func result(_ answers: [Answered], route: Route = sec, mode: Mode = .classic, score: Int? = nil, abandoned: Bool = false) -> RoundResult {
  RoundResult(
    mode: mode, route: route, score: score ?? answers.filter(\.correct).count, total: answers.count, answers: answers,
    missed: answers.filter { !$0.correct }, abandoned: abandoned)
}

// A classic result with the given score out of ten, all answered at time 1.
private func scored(_ score: Int, abandoned: Bool = false) throws -> RoundResult {
  result(try (0..<10).map { try answered("c\($0)", $0 < score, 1) }, abandoned: abandoned)
}

private func withRecord(_ best: Int, _ route: Route = sec, _ mode: Mode = .classic) -> Progress {
  Progress(cards: [:], records: [recordKey(route, mode): best], last: nil)
}

private func seenOnce() -> CardHistory { CardHistory(seen: 1, lastCorrect: true, lastSeenAt: 1) }

@Suite struct ProgressTests {
  @Test func emptyProgressHasVersion1AndNothingElse() {
    #expect(emptyProgress() == Progress(version: 1, cards: [:], records: [:], last: nil))
  }

  @Test func recordKeyJoinsTheRouteKeyAndTheMode() {
    #expect(recordKey(sec, .classic) == "aws-clf-c02/SEC#classic")
    #expect(recordKey(Route(deckId: "nextjs-rendering", sectionId: WHOLE_DECK), .timed) == "nextjs-rendering/ALL#timed")
  }

  @Test func bestForReadsTheRecordOfARouteAndMode() {
    let played = Progress(cards: [:], records: ["aws-clf-c02/SEC#classic": 9, "aws-clf-c02/CON#timed": 0], last: nil)
    #expect(bestFor(played, sec, .classic) == 9)
    #expect(bestFor(played, sec, .timed) == nil)
    #expect(bestFor(played, con, .timed) == 0)
  }

  @Test func compareWithBestKinds() {
    #expect(compareWithBest(0, nil) == .first)
    #expect(compareWithBest(8, 7) == .newBest(previousBest: 7))
    #expect(compareWithBest(9, 9) == .equal(best: 9))
    #expect(compareWithBest(7, 9) == .short(best: 9, by: 2))
  }

  @Test func applyResultAddsToTheHistoryAndKeepsTheLaterAnswer() throws {
    let before = Progress(cards: ["c1": CardHistory(seen: 4, lastCorrect: true, lastSeenAt: 500)], records: [:], last: nil)
    let outcome = applyResult(before, result([try answered("c1", true, 100), try answered("c2", true, 150), try answered("c1", false, 200)]))
    #expect(outcome.progress.cards["c1"] == CardHistory(seen: 6, lastCorrect: false, lastSeenAt: 200))
    #expect(outcome.progress.cards["c2"] == CardHistory(seen: 1, lastCorrect: true, lastSeenAt: 150))
  }

  @Test func applyResultSetsAFirstRecordEvenWithScore0AndReplacesOnlyOnAHigherScore() throws {
    let first = applyResult(emptyProgress(), try scored(0))
    #expect(first.isNewBest && first.previousBest == nil && first.progress.records["aws-clf-c02/SEC#classic"] == 0)
    let equal = applyResult(withRecord(7), try scored(7))
    #expect(!equal.isNewBest && equal.previousBest == 7 && equal.progress.records["aws-clf-c02/SEC#classic"] == 7)
    let better = applyResult(withRecord(6), try scored(8))
    #expect(better.isNewBest && better.progress.records["aws-clf-c02/SEC#classic"] == 8)
    #expect(better.progress.last == LastRound(route: sec, mode: .classic, score: 8, total: 10))
  }

  @Test func applyResultForAnAbandonedRoundKeepsTheAnswersButNeverTheRecord() throws {
    let outcome = applyResult(withRecord(2), try scored(9, abandoned: true))
    #expect(!outcome.isNewBest)
    #expect(outcome.progress.records["aws-clf-c02/SEC#classic"] == 2)
    #expect(outcome.progress.cards.count == 10)
    #expect(outcome.progress.last == LastRound(route: sec, mode: .classic, score: nil, total: nil))
    #expect(applyResult(emptyProgress(), try scored(5, abandoned: true)).progress.records.isEmpty)
  }

  @Test func pruneDeckDropsOnlyThisDecksRemovedCardsByThePlainPrefix() {
    let before = Progress(
      cards: ["aws-clf-c02-t1.1-01": seenOnce(), "aws-clf-c02-t1.1-02": seenOnce(), "aws-clf-c02x-1": seenOnce(), "gcp-cdl-pro-1": seenOnce()],
      records: ["aws-clf-c02/SEC#classic": 7], last: LastRound(route: sec, mode: .classic, score: 7, total: 10))
    let pruned = pruneDeck(before, "aws-clf-c02", ["aws-clf-c02-t1.1-01"])
    #expect(Set(pruned.cards.keys) == ["aws-clf-c02-t1.1-01", "aws-clf-c02x-1", "gcp-cdl-pro-1"])
    #expect(pruned.records == before.records && pruned.last == before.last)
    #expect(pruneDeck(before, "gcp-cdl", []).cards["gcp-cdl-pro-1"] == nil)
  }

  @Test func seenShareCountsDistinctListedCardsSeenAtLeastOnce() {
    #expect(seenShare(["a": seenOnce()], []) == 0)
    #expect(seenShare(["a": seenOnce(), "c": seenOnce()], ["a", "b", "c", "d"]) == 0.5)
    #expect(seenShare(["a": CardHistory(seen: 0, lastCorrect: false, lastSeenAt: 0)], ["a"]) == 0)
    #expect(seenShare(["a": seenOnce()], ["a", "a", "b"]) == 0.5)
    #expect(seenShare(["a": seenOnce()], ["a", "b", "c"]) == 1.0 / 3.0)
  }

  @Test func encodingWritesLastAndScoresAsNullNeverLeavesThemOut() throws {
    let empty = try progressJSON(emptyProgress())
    #expect(empty == #"{"cards":{},"last":null,"records":{},"version":1}"#)
    let abandoned = Progress(cards: [:], records: [:], last: LastRound(route: sec, mode: .lives, score: nil, total: nil))
    #expect(try progressJSON(abandoned).contains(#""last":{"mode":"lives","route":{"deckId":"aws-clf-c02","sectionId":"SEC"},"score":null,"total":null}"#))
  }

  @Test func encodingKeepsEpochMillisecondsAsIntegersAndSlashesUnescaped() throws {
    let played = Progress(
      cards: ["aws-clf-c02-t2.1-06": CardHistory(seen: 2, lastCorrect: true, lastSeenAt: 1_790_000_000_000)],
      records: ["aws-clf-c02/SEC#classic": 7], last: nil)
    let json = try progressJSON(played)
    #expect(json.contains(#""lastSeenAt":1790000000000"#))
    #expect(json.contains(#""aws-clf-c02/SEC#classic":7"#))
  }
}
