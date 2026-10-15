import Testing
@testable import TruthyEngine

// Decoders from golden JSON to the progress types of task 4, and an exact comparison.
// A namespace, so these names never meet the decoders other tasks add to the golden loader.
enum ProgressGolden {
  static func required(_ value: GoldenValue, _ key: String) throws -> GoldenValue {
    guard let member = value[key] else { throw GoldenError(description: "no field \(key) in \(value)") }
    return member
  }

  static func optionalInt(_ value: GoldenValue) throws -> Int? {
    value == .null ? nil : try value.int()
  }

  static func strings(_ value: GoldenValue) throws -> [String] {
    try value.array().map { try $0.string() }
  }

  static func route(_ value: GoldenValue) throws -> Route {
    Route(deckId: try required(value, "deckId").string(), sectionId: try required(value, "sectionId").string())
  }

  static func mode(_ value: GoldenValue) throws -> Mode {
    let name = try value.string()
    guard let mode = Mode(rawValue: name) else { throw GoldenError(description: "not a mode: \(name)") }
    return mode
  }

  static func history(_ value: GoldenValue) throws -> [String: CardHistory] {
    guard case .object(let entries) = value else { throw GoldenError(description: "not a history: \(value)") }
    return try entries.mapValues {
      CardHistory(seen: try required($0, "seen").int(), lastCorrect: try required($0, "lastCorrect").bool(), lastSeenAt: try required($0, "lastSeenAt").number())
    }
  }

  static func progress(_ value: GoldenValue) throws -> Progress {
    guard case .object(let records) = try required(value, "records") else { throw GoldenError(description: "not records: \(value)") }
    let last = try required(value, "last")
    return Progress(
      version: try required(value, "version").int(),
      cards: try history(try required(value, "cards")),
      records: try records.mapValues { try $0.int() },
      last: last == .null
        ? nil
        : LastRound(
          route: try route(try required(last, "route")), mode: try mode(try required(last, "mode")),
          score: try optionalInt(try required(last, "score")), total: try optionalInt(try required(last, "total"))))
  }

  static func comparison(_ value: GoldenValue) throws -> Comparison {
    switch try required(value, "kind").string() {
    case "first": return .first
    case "new-best": return .newBest(previousBest: try required(value, "previousBest").int())
    case "equal": return .equal(best: try required(value, "best").int())
    case "short": return .short(best: try required(value, "best").int(), by: try required(value, "by").int())
    case let kind: throw GoldenError(description: "unknown comparison kind \(kind)")
    }
  }

  static func answered(_ file: GoldenFile, _ value: GoldenValue) throws -> Answered {
    Answered(
      card: try file.card(try required(value, "card")), given: try required(value, "given").bool(),
      correct: try required(value, "correct").bool(), at: try required(value, "at").number())
  }

  static func roundResult(_ file: GoldenFile, _ value: GoldenValue) throws -> RoundResult {
    RoundResult(
      mode: try mode(try required(value, "mode")), route: try route(try required(value, "route")),
      score: try required(value, "score").int(), total: try required(value, "total").int(),
      answers: try required(value, "answers").array().map { try answered(file, $0) },
      missed: try required(value, "missed").array().map { try answered(file, $0) },
      abandoned: try required(value, "abandoned").bool())
  }

  // Equal, and every lastSeenAt the same double bit for bit (so -0 stays -0).
  static func exactly(_ a: Progress, _ b: Progress) -> Bool {
    a == b && a.cards.allSatisfy { id, entry in b.cards[id]?.lastSeenAt.bitPattern == entry.lastSeenAt.bitPattern }
  }
}
