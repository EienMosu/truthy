// Progress: card history, records and the last route played. A line-by-line port of
// src/progress/progress.ts (reference 3.5). Pure: every function returns new values.
import Foundation

// The last round played. score and total are nil for an abandoned round and for a last route stored
// before scores were kept.
public struct LastRound: Codable, Equatable, Sendable {
  public var route: Route
  public var mode: Mode
  public var score: Int?
  public var total: Int?

  public init(route: Route, mode: Mode, score: Int?, total: Int?) {
    self.route = route
    self.mode = mode
    self.score = score
    self.total = total
  }

  private enum CodingKeys: String, CodingKey { case route, mode, score, total }

  // Writes score and total as null, never leaves them out, so the file has the web's shape.
  public func encode(to encoder: any Encoder) throws {
    var container = encoder.container(keyedBy: CodingKeys.self)
    try container.encode(route, forKey: .route)
    try container.encode(mode, forKey: .mode)
    try container.encode(score, forKey: .score)
    try container.encode(total, forKey: .total)
  }
}

public struct Progress: Codable, Equatable, Sendable {
  public var version: Int
  public var cards: [String: CardHistory]
  public var records: [String: Int]  // key: recordKey(route, mode)
  public var last: LastRound?

  public init(version: Int = 1, cards: [String: CardHistory], records: [String: Int], last: LastRound?) {
    self.version = version
    self.cards = cards
    self.records = records
    self.last = last
  }

  private enum CodingKeys: String, CodingKey { case version, cards, records, last }

  // Writes "last": null, never leaves the key out: the web reads a value without it as not whole,
  // which would make every later save copy the stored value aside.
  public func encode(to encoder: any Encoder) throws {
    var container = encoder.container(keyedBy: CodingKeys.self)
    try container.encode(version, forKey: .version)
    try container.encode(cards, forKey: .cards)
    try container.encode(records, forKey: .records)
    try container.encode(last, forKey: .last)
  }
}

public func emptyProgress() -> Progress {
  Progress(version: 1, cards: [:], records: [:], last: nil)
}

// routeKey(route) + "#" + mode, as the web writes it ("aws-clf-c02/SEC#classic").
public func recordKey(_ route: Route, _ mode: Mode) -> String {
  "\(route.deckId)/\(route.sectionId)#\(mode.rawValue)"
}

/// The record for a route and mode, or nil when it has not been played (to the end) yet.
public func bestFor(_ progress: Progress, _ route: Route, _ mode: Mode) -> Int? {
  progress.records[recordKey(route, mode)]
}

/// How a finished round compares with the record that stood before it.
/// TypeScript kinds: "first", "new-best", "equal", "short".
public enum Comparison: Equatable, Sendable {
  case first
  case newBest(previousBest: Int)
  case equal(best: Int)
  case short(best: Int, by: Int)
}

/// Compares a score with the record before the round (nil when this route and mode had none).
public func compareWithBest(_ score: Int, _ previousBest: Int?) -> Comparison {
  guard let previousBest else { return .first }
  if score > previousBest { return .newBest(previousBest: previousBest) }
  if score == previousBest { return .equal(best: previousBest) }
  return .short(best: previousBest, by: previousBest - score)
}

public struct ApplyOutcome: Equatable, Sendable {
  public let progress: Progress
  public let previousBest: Int?
  public let isNewBest: Bool

  public init(progress: Progress, previousBest: Int?, isNewBest: Bool) {
    self.progress = progress
    self.previousBest = previousBest
    self.isNewBest = isNewBest
  }
}

// Records the answers of a round in the card history, remembers its route and mode (and its score when it
// was finished), and sets the record when a finished round beats it. A first finished round always sets the
// record, even with score 0. An abandoned round keeps its answers but never touches the record.
public func applyResult(_ progress: Progress, _ result: RoundResult) -> ApplyOutcome {
  let key = recordKey(result.route, result.mode)
  let previousBest = bestFor(progress, result.route, result.mode)
  let comparison = compareWithBest(result.score, previousBest)
  var isFirstOrBetter = false
  switch comparison {
  case .first, .newBest: isFirstOrBetter = true
  case .equal, .short: isFirstOrBetter = false
  }
  let isNewBest = !result.abandoned && isFirstOrBetter
  var records = progress.records
  if isNewBest { records[key] = result.score }
  return ApplyOutcome(
    progress: Progress(
      version: 1,
      cards: withAnswers(progress.cards, result),
      records: records,
      last: LastRound(
        route: Route(deckId: result.route.deckId, sectionId: result.route.sectionId),
        mode: result.mode,
        score: result.abandoned ? nil : result.score,
        total: result.abandoned ? nil : result.total
      )
    ),
    previousBest: previousBest,
    isNewBest: isNewBest
  )
}

// A card answered twice in one round counts twice and keeps the later verdict and time.
private func withAnswers(_ cards: [String: CardHistory], _ result: RoundResult) -> [String: CardHistory] {
  var next = cards
  for answer in result.answers {
    let id = answer.card.id
    let before = next[id]
    next[id] = CardHistory(seen: (before?.seen ?? 0) + 1, lastCorrect: answer.correct, lastSeenAt: answer.at)
  }
  return next
}

// Drops the history of cards of this deck that are not in the deck any more. A card belongs to the deck when
// its id starts with "<deckId>-" (the plain prefix, compared in UTF-16 code units as JavaScript does).
// Records and the last route are kept.
public func pruneDeck(_ progress: Progress, _ deckId: String, _ cardIds: [String]) -> Progress {
  let prefix = Array("\(deckId)-".utf16)
  let current = Set(cardIds)
  var cards: [String: CardHistory] = [:]
  for (id, entry) in progress.cards {
    if id.utf16.starts(with: prefix) && !current.contains(id) { continue }
    cards[id] = entry
  }
  return Progress(version: progress.version, cards: cards, records: progress.records, last: progress.last)
}

// The share (0 to 1) of the given cards that have been seen at least once. No cards gives 0.
public func seenShare(_ history: History, _ cardIds: [String]) -> Double {
  let ids = Set(cardIds)
  if ids.isEmpty { return 0 }
  var seen = 0
  for id in ids {
    if let entry = history[id], entry.seen > 0 { seen += 1 }
  }
  return Double(seen) / Double(ids.count)
}

// JSON.stringify(progress): the web's shape ("last": null and null scores written out), keys sorted so the
// same progress always gives the same text, and slashes in record keys left unescaped as on the web.
public func progressJSON(_ progress: Progress) throws -> String {
  let encoder = JSONEncoder()
  encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
  return String(decoding: try encoder.encode(progress), as: UTF8.self)
}
