// The exact reference vectors of the web's dealing tests, written out here so that they hold even before
// a golden file is read: tests/engine/deal-pins-polish.test.ts and tests/engine/overdue-boundary.test.ts,
// plus the edges of tests/engine/deal.test.ts that decide whether the rng is touched at all.
import Foundation
import Testing
@testable import TruthyEngine

// A card as the web tests build it (section "SEC", difficulty 2, an AWS source), decoded from its JSON so
// that the test depends only on the shipped card shape.
private func card(_ id: String, _ answer: Bool, _ conflictGroups: [String] = []) -> Card {
  let object: [String: Any] = [
    "id": id,
    "section": "SEC",
    "text": ["en": ["statement": "Statement \(id)", "explanation": "Explanation \(id)"]],
    "answer": answer,
    "source": ["title": "AWS documentation", "url": "https://docs.aws.amazon.com/"],
    "difficulty": 2,
    "appliesTo": "",
    "conflictGroups": conflictGroups,
  ]
  let data = try! JSONSerialization.data(withJSONObject: object)
  return try! JSONDecoder().decode(Card.self, from: data)
}

private func cards(_ prefix: String, _ n: Int, _ answer: (Int) -> Bool = { $0 % 2 == 0 }) -> [Card] {
  (0..<n).map { card("\(prefix)\($0 + 1)", answer($0)) }
}

private func missed(_ lastSeenAt: Double) -> CardHistory { CardHistory(seen: 1, lastCorrect: false, lastSeenAt: lastSeenAt) }
private func right(_ lastSeenAt: Double) -> CardHistory { CardHistory(seen: 1, lastCorrect: true, lastSeenAt: lastSeenAt) }

private func ids(_ dealt: [Card]) -> [String] { dealt.map(\.id) }

// An rng that counts its draws.
private final class Draws {
  var count = 0
}

private func counting(_ rng: @escaping Rng, _ draws: Draws) -> Rng {
  {
    draws.count += 1
    return rng()
  }
}

// 16 cards with answers True, False, True, ...; c3 and c8 share group a, c5 and c12 share group b; c1 and c6 were
// missed, c2 was answered right.
private let pinsPool: [Card] = (0..<16).map { i in
  card("c\(i + 1)", i % 2 == 0, i == 2 || i == 7 ? ["a"] : i == 4 || i == 11 ? ["b"] : [])
}
private let pinsHistory: History = ["c1": missed(5), "c2": CardHistory(seen: 2, lastCorrect: true, lastSeenAt: 9), "c6": missed(3)]

// c1 to c3 (True) and c4 to c8 (False) were missed, oldest first; c9 to c15 (True) were never seen; c16 (False)
// was answered right. c5 and c10 share group b.
private let overCapPool: [Card] = (0..<16).map { i in
  card("c\(i + 1)", i < 3 || (i >= 8 && i < 15), i == 4 || i == 9 ? ["b"] : [])
}
private let overCapHistory: History = {
  var history: History = ["c16": right(9)]
  for (i, c) in overCapPool.prefix(8).enumerated() { history[c.id] = missed(Double(i + 1)) }
  return history
}()

@Suite struct DealReferenceTests {
  @Test("the constants")
  func constants() {
    #expect(DEAL == DealConstants(missedPerTen: 3, minTrue: 4, maxTrue: 6, maxRun: 3))
    #expect(CHUNK == 10)
    #expect(SEARCH_BUDGET == 20_000)
    #expect(OVERDUE_AFTER_PASSES == 2)
  }

  @Test("deal-pins-polish: seed n deals exactly these ten cards in this order", arguments: [
    (1.0, ["c3", "c10", "c16", "c9", "c5", "c6", "c7", "c14", "c15", "c1"]),
    (2.0, ["c11", "c13", "c8", "c10", "c14", "c9", "c16", "c15", "c1", "c6"]),
    (3.0, ["c9", "c6", "c1", "c16", "c4", "c13", "c14", "c11", "c5", "c8"]),
  ])
  func referencePool(seed: Double, expected: [String]) {
    #expect(ids(deal(pinsPool, pinsHistory, createRng(seed), DealOptions(count: 10))) == expected)
    // dealChunk with nothing dealt takes the same path as deal with a count of ten (chunks.test.ts).
    #expect(ids(dealChunk(pinsPool, pinsHistory, createRng(seed), [])) == expected)
  }

  @Test("deal-pins-polish: three chunks with the seeds 100, 101 and 102")
  func threeChunks() {
    var dealt: [Card] = []
    for k in 0..<3 { dealt += dealChunk(pinsPool, pinsHistory, createRng(Double(100 + k)), dealt) }
    #expect(ids(dealt) == [
      "c11", "c6", "c14", "c9", "c13", "c10", "c3", "c16", "c1", "c15",
      "c7", "c4", "c12", "c8", "c5", "c2",
      "c6", "c14", "c11", "c10", "c9", "c13",
    ])
  }

  @Test("deal-pins-polish: more missed cards than the cap, seed n", arguments: [
    (1.0, ["c10", "c7", "c6", "c12", "c15", "c16", "c13", "c4", "c9", "c14"]),
    (2.0, ["c13", "c11", "c4", "c14", "c6", "c16", "c10", "c15", "c9", "c7"]),
    (3.0, ["c9", "c16", "c10", "c4", "c7", "c14", "c13", "c6", "c11", "c15"]),
  ])
  func overCap(seed: Double, expected: [String]) {
    #expect(ids(deal(overCapPool, overCapHistory, createRng(seed), DealOptions(count: 10))) == expected)
  }

  @Test("deal-pins-polish: six chunks with the seeds 210 to 215, k1 overdue in the sixth")
  func overdue() {
    let route = (0..<21).map { i in card("k\(i + 1)", i % 2 == 0, i == 0 || i == 11 ? ["pair"] : []) }
    var dealt: [Card] = []
    for k in 0..<6 { dealt += dealChunk(route, [:], createRng(Double(210 + k)), dealt) }
    #expect(ids(dealt) == [
      "k7", "k3", "k15", "k8", "k12", "k19", "k4", "k14", "k17", "k11",
      "k9", "k10", "k16", "k6", "k21", "k5", "k18", "k2", "k20", "k13",
      "k7", "k11", "k12", "k19", "k3", "k17", "k14", "k4", "k15", "k8",
      "k6", "k13", "k9", "k20", "k5", "k2", "k16", "k21", "k10", "k18",
      "k15", "k7", "k14", "k17", "k4", "k3", "k19", "k8", "k11", "k12",
      "k20", "k1", "k9", "k21", "k2", "k5", "k13", "k10", "k16", "k6",
    ])
  }

  @Test("overdue-boundary: six chunks with the seeds 150 to 155, k1 overdue at exactly twice the route")
  func overdueBoundary() {
    let route = (0..<25).map { i -> Card in
      let pair = i < 5 ? i : i - (CHUNK + 1)
      return card("k\(i + 1)", i % 2 == 0, pair >= 0 && pair < 5 ? ["pair\(pair + 1)"] : [])
    }
    var dealt: [Card] = []
    for k in 0..<6 { dealt += dealChunk(route, [:], createRng(Double(150 + k)), dealt) }
    #expect(!ids(Array(dealt.prefix(50))).contains("k1"))
    #expect(ids(dealt) == [
      "k15", "k23", "k2", "k6", "k10", "k11", "k22", "k5", "k24", "k14",
      "k12", "k7", "k25", "k21", "k18", "k17", "k20", "k8", "k9", "k19",
      "k3", "k10", "k16", "k6", "k13", "k4", "k22", "k11", "k23", "k24",
      "k12", "k21", "k17", "k19", "k18", "k8", "k25", "k20", "k9", "k7",
      "k10", "k5", "k15", "k23", "k24", "k6", "k22", "k11", "k14", "k2",
      "k25", "k1", "k20", "k9", "k19", "k8", "k21", "k17", "k16", "k18",
    ])
  }

  @Test("deal.test: no cards and no draw for a count of 0, -3 or NaN, or an empty pool", arguments: [0.0, -3.0, Double.nan])
  func nothingToDeal(count: Double) {
    let draws = Draws()
    let rng = counting(createRng(1), draws)
    #expect(deal(cards("c", 12), [:], rng, DealOptions(count: count)).isEmpty)
    #expect(deal([], [:], rng, DealOptions(count: 10)).isEmpty)
    #expect(draws.count == 0)
  }

  @Test("deal.test: a fractional count deals its floor, a pool that lists each id twice deals each card once")
  func countsAndDuplicates() {
    #expect(deal(cards("c", 40), [:], createRng(1), DealOptions(count: 4.7)).count == 4)
    let twice = deal(cards("c", 6) + cards("c", 6), [:], createRng(1), DealOptions(count: 10))
    #expect(twice.count == 6)
    #expect(Set(ids(twice)).count == 6)
  }

  // 16 unshown cards: 15 draws to rank them; t - 1 and f - 1 to shuffle the chosen True and False cards; then one
  // draw at each position where both answers are allowed. Counted with the TypeScript on the same pool.
  @Test("the draws of a first chunk, counted", arguments: [(1.0, 31), (2.0, 31), (3.0, 32)])
  func drawCount(seed: Double, expected: Int) {
    let draws = Draws()
    #expect(dealChunk(pinsPool, pinsHistory, counting(createRng(seed), draws), []).count == 10)
    #expect(draws.count == expected)
  }
}
