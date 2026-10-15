// The golden vectors of the dealing (native-data/golden/src.engine.deal.*.json, plan A task 5): every case of
// deal and dealChunk, the constants, and each internal step of deal.ts, run through the Swift port.
// Cards are compared by id; a step that is given its rng as a list of values must use every value, no more.
import Foundation
import Testing
@testable import TruthyEngine

private let MODULE = "src/engine/deal"

// Every golden file of the module, by function name. The coverage test below fails when plan A writes one
// that is not in this list, so that no dealing vector goes unread (spec 7.1). Every test calls Golden.load with
// two string literals, which is how task 1's coverage test sees which files the suite reads.
private let DEAL_GOLDEN_FUNCTIONS: [String] = [
  "deal", "dealChunk", "DEAL", "CHUNK", "SEARCH_BUDGET", "OVERDUE_AFTER_PASSES",
  "dealRanked", "uniqueById", "dealSize", "wasSeen", "wasMissed", "lastSeenAt", "oldestFirst", "rankByPriority",
  "balanceFor", "choose", "searchOverCap", "searchWithAllRules", "relaxStepByStep", "sharesGroup", "trueCount",
  "balanceAllows", "arrange", "joinOf", "runLimit", "placementCheck", "pickAnswer",
]

// Checks that a loaded file is the file of `function` and has cases, and hands it back.
private func checked(_ file: GoldenFile, _ function: String) -> GoldenFile {
  #expect(file.module == MODULE)
  #expect(file.function == function, "the file read for \(function) holds \(file.function)")
  #expect(!file.cases.isEmpty, "\(function) has no cases")
  return file
}

private func member(_ value: GoldenValue, _ key: String) throws -> GoldenValue {
  guard let found = value[key] else { throw GoldenError(description: "no \(key) in \(value)") }
  return found
}

// A member that the TypeScript left undefined (written by leaving the key out) is nil.
private func optional(_ value: GoldenValue, _ key: String) -> GoldenValue? {
  value[key]
}

private func ids(_ cards: [Card]) -> [String] { cards.map(\.id) }

private func expectedIds(_ file: GoldenFile, _ value: GoldenValue) throws -> [String] {
  try ids(file.cards(value))
}

// Exact equality of numbers: -0 is not 0, NaN equals NaN.
private func same(_ a: Double, _ b: Double) -> Bool {
  (a.isNaN && b.isNaN) || (a == b && a.sign == b.sign)
}

// An rng of the case, wrapped to count its draws; `expected` is the number of values when the rng is a list.
private final class Draws {
  var count = 0
}

private func rng(_ file: GoldenFile, _ value: GoldenValue) throws -> (rng: Rng, draws: Draws, expected: Int?) {
  let inner = try file.rng(value)
  let draws = Draws()
  let values = try value["$rng"]?["values"]?.array()
  return ({ draws.count += 1; return inner() }, draws, values?.count)
}

private func expectAllDrawn(_ r: (rng: Rng, draws: Draws, expected: Int?), _ name: String) {
  if let expected = r.expected { #expect(r.draws.count == expected, "\(name): \(r.draws.count) draws of \(expected)") }
}

private func optionalCards(_ file: GoldenFile, _ value: GoldenValue?) throws -> [Card]? {
  guard let value else { return nil }
  return try file.cards(value)
}

private func optionalNumber(_ value: GoldenValue?) throws -> Double? {
  try value?.number()
}

// A history of a case. CardHistory.seen is an Int (README, task 1), as every stored entry is: readProgress keeps
// only a non-negative integer. The web's "a history with corrupt numbers" (deal.test.ts) and the history kinds of
// the internal vectors write seen NaN. Dealing asks one thing of seen, `seen > 0`, so a seen that is not a whole
// number reads as the Int with the same answer: 1 when it is above 0, 0 otherwise (NaN is not above 0).
private func history(_ value: GoldenValue) throws -> History {
  guard case .object(let entries) = value else { throw GoldenError(description: "not a history: \(value)") }
  var history: History = [:]
  for (id, entry) in entries {
    let seen = try member(entry, "seen").number()
    let whole = seen.isFinite && seen == seen.rounded(.towardZero) && abs(seen) < 9_007_199_254_740_992
    history[id] = CardHistory(
      seen: whole ? Int(seen) : (seen > 0 ? 1 : 0),
      lastCorrect: try member(entry, "lastCorrect").bool(),
      lastSeenAt: try member(entry, "lastSeenAt").number()
    )
  }
  return history
}

private func ranking(_ file: GoldenFile, _ value: GoldenValue) throws -> Ranking {
  Ranking(
    withinCap: try file.cards(member(value, "withinCap")),
    overCap: try file.cards(member(value, "overCap")),
    comeBack: try file.cards(member(value, "comeBack")),
    missed: Set(try member(value, "missed").array().map { try $0.string() }),
    missedCap: try member(value, "missedCap").int()
  )
}

private func balance(_ value: GoldenValue) throws -> Balance {
  Balance(minTrue: try member(value, "minTrue").int(), maxTrue: try member(value, "maxTrue").int())
}

private func lastAnswer(_ value: GoldenValue) throws -> Bool? {
  value == .null ? nil : try value.bool()
}

private func join(_ value: GoldenValue) throws -> Join {
  Join(last: try lastAnswer(member(value, "last")), run: try member(value, "run").int())
}

private func bools(_ value: GoldenValue) throws -> [Bool] {
  try value.array().map { try $0.bool() }
}

private func setting(_ file: GoldenFile, _ value: GoldenValue) throws -> Setting {
  Setting(
    avoid: try optionalCards(file, optional(value, "avoid")),
    before: try optional(value, "before").map(bools),
    budget: try optionalNumber(optional(value, "budget")),
    overdue: try optional(value, "overdue")?.bool()
  )
}

private func limits(_ value: GoldenValue) throws -> Limits {
  Limits(
    budget: try optionalNumber(optional(value, "budget")),
    missed: try optional(value, "missed").map { Set(try $0.array().map { try $0.string() }) },
    missedLimit: try optional(value, "missedLimit")?.int()
  )
}

// A deal or no deal (null).
private func expectedDeal(_ file: GoldenFile, _ value: GoldenValue) throws -> [String]? {
  value == .null ? nil : try expectedIds(file, value)
}

@Suite struct DealGoldenTests {
  @Test("every golden file of src/engine/deal is read by this suite")
  func coverage() throws {
    let prefix = MODULE.replacingOccurrences(of: "/", with: ".") + "."
    let names = try FileManager.default.contentsOfDirectory(atPath: Golden.directory.path)
      .filter { $0.hasPrefix(prefix) && $0.hasSuffix(".json") }
      .map { String($0.dropFirst(prefix.count).dropLast(".json".count)) }
      .map { $0 == "DEAL.constant" ? "DEAL" : $0 }
    #expect(Set(names) == Set(DEAL_GOLDEN_FUNCTIONS))
  }

  @Test("deal")
  func dealVectors() throws {
    let file = checked(try Golden.load("src/engine/deal", "deal"), "deal")
    for c in file.cases {
      let options = try member(c.input, "options")
      let r = try rng(file, member(c.input, "rng"))
      let dealt = deal(
        try file.cards(member(c.input, "pool")), try history(member(c.input, "history")), r.rng,
        DealOptions(
          count: try member(options, "count").number(),
          avoid: try optionalCards(file, optional(options, "avoid")),
          before: try optional(options, "before").map(bools),
          budget: try optionalNumber(optional(options, "budget"))
        )
      )
      #expect(ids(dealt) == (try expectedIds(file, c.output)), "\(c.name)")
    }
  }

  @Test("dealChunk")
  func dealChunkVectors() throws {
    let file = checked(try Golden.load("src/engine/deal", "dealChunk"), "dealChunk")
    for c in file.cases {
      let pool = try file.cards(member(c.input, "pool"))
      let history = try history(member(c.input, "history"))
      let r = try rng(file, member(c.input, "rng"))
      let dealt = try file.cards(member(c.input, "dealt"))
      let output = if let budget = optional(c.input, "budget") {
        dealChunk(pool, history, r.rng, dealt, try budget.number())
      } else {
        dealChunk(pool, history, r.rng, dealt)
      }
      #expect(ids(output) == (try expectedIds(file, c.output)), "\(c.name)")
    }
  }

  @Test("the constants DEAL, CHUNK, SEARCH_BUDGET and OVERDUE_AFTER_PASSES")
  func constants() throws {
    let deal = checked(try Golden.load("src/engine/deal", "DEAL"), "DEAL")
    for c in deal.cases {
      #expect(c.input == .null)
      #expect(DEAL == DealConstants(
        missedPerTen: try member(c.output, "missedPerTen").int(),
        minTrue: try member(c.output, "minTrue").int(),
        maxTrue: try member(c.output, "maxTrue").int(),
        maxRun: try member(c.output, "maxRun").int()
      ))
    }
    for c in checked(try Golden.load("src/engine/deal", "CHUNK"), "CHUNK").cases { #expect(CHUNK == (try c.output.int())) }
    for c in checked(try Golden.load("src/engine/deal", "SEARCH_BUDGET"), "SEARCH_BUDGET").cases { #expect(same(SEARCH_BUDGET, try c.output.number())) }
    for c in checked(try Golden.load("src/engine/deal", "OVERDUE_AFTER_PASSES"), "OVERDUE_AFTER_PASSES").cases { #expect(OVERDUE_AFTER_PASSES == (try c.output.int())) }
  }

  @Test("uniqueById")
  func uniqueByIdVectors() throws {
    let file = checked(try Golden.load("src/engine/deal", "uniqueById"), "uniqueById")
    for c in file.cases {
      #expect(ids(uniqueById(try file.cards(member(c.input, "pool")))) == (try expectedIds(file, c.output)), "\(c.name)")
    }
  }

  @Test("dealSize")
  func dealSizeVectors() throws {
    let file = checked(try Golden.load("src/engine/deal", "dealSize"), "dealSize")
    for c in file.cases {
      let size = dealSize(try member(c.input, "count").number(), try member(c.input, "available").int())
      #expect(size == (try c.output.int()), "\(c.name)")
    }
  }

  @Test("wasSeen, wasMissed and lastSeenAt")
  func historyVectors() throws {
    let seen = checked(try Golden.load("src/engine/deal", "wasSeen"), "wasSeen")
    for c in seen.cases {
      let output = wasSeen(try seen.card(member(c.input, "card")), try history(member(c.input, "history")))
      #expect(output == (try c.output.bool()), "wasSeen: \(c.name)")
    }
    let missed = checked(try Golden.load("src/engine/deal", "wasMissed"), "wasMissed")
    for c in missed.cases {
      let output = wasMissed(try missed.card(member(c.input, "card")), try history(member(c.input, "history")))
      #expect(output == (try c.output.bool()), "wasMissed: \(c.name)")
    }
    let file = checked(try Golden.load("src/engine/deal", "lastSeenAt"), "lastSeenAt")
    for c in file.cases {
      let at = lastSeenAt(try file.card(member(c.input, "card")), try history(member(c.input, "history")))
      #expect(same(at, try c.output.number()), "lastSeenAt: \(c.name)")
    }
  }

  @Test("oldestFirst")
  func oldestFirstVectors() throws {
    let file = checked(try Golden.load("src/engine/deal", "oldestFirst"), "oldestFirst")
    for c in file.cases {
      let sorted = oldestFirst(try file.cards(member(c.input, "cards")), try history(member(c.input, "history")))
      #expect(ids(sorted) == (try expectedIds(file, c.output)), "\(c.name)")
    }
  }

  @Test("rankByPriority")
  func rankByPriorityVectors() throws {
    let file = checked(try Golden.load("src/engine/deal", "rankByPriority"), "rankByPriority")
    for c in file.cases {
      let r = try rng(file, member(c.input, "rng"))
      let ranked = rankByPriority(
        try file.cards(member(c.input, "cards")), try history(member(c.input, "history")), r.rng,
        try member(c.input, "size").int()
      )
      #expect(ranked == (try ranking(file, c.output)), "\(c.name)")
      expectAllDrawn(r, c.name)
    }
  }

  @Test("dealRanked")
  func dealRankedVectors() throws {
    let file = checked(try Golden.load("src/engine/deal", "dealRanked"), "dealRanked")
    for c in file.cases {
      let r = try rng(file, member(c.input, "rng"))
      let dealt = dealRanked(
        try ranking(file, member(c.input, "ranking")), try member(c.input, "size").int(), r.rng,
        try setting(file, member(c.input, "setting"))
      )
      #expect(ids(dealt) == (try expectedIds(file, c.output)), "\(c.name)")
      expectAllDrawn(r, c.name)
    }
  }

  @Test("choose")
  func chooseVectors() throws {
    let file = checked(try Golden.load("src/engine/deal", "choose"), "choose")
    for c in file.cases {
      let chosen = choose(
        try ranking(file, member(c.input, "ranking")), try member(c.input, "size").int(),
        try file.cards(member(c.input, "avoid")), try member(c.input, "budget").number(),
        try member(c.input, "overdue").bool()
      )
      #expect(ids(chosen) == (try expectedIds(file, c.output)), "\(c.name)")
    }
  }

  @Test("searchOverCap")
  func searchOverCapVectors() throws {
    let file = checked(try Golden.load("src/engine/deal", "searchOverCap"), "searchOverCap")
    for c in file.cases {
      let ranked = try ranking(file, member(c.input, "ranking"))
      let unshown = try file.cards(member(c.input, "unshown"))
      let spec = try member(c.input, "search")
      let size = try member(spec, "size").int()
      let avoid = try file.cards(member(spec, "avoid"))
      let budget = try member(spec, "budget").number()
      // The search choose hands over: its own budget and the ranking's missed cards, then the limits given.
      let search = { (cards: [Card], given: Limits) -> [Card]? in
        searchWithAllRules(cards, size, avoid, balanceFor(size), Limits(
          budget: given.budget ?? budget, missed: given.missed ?? ranked.missed, missedLimit: given.missedLimit
        ))
      }
      let found = searchOverCap(ranked, unshown, search)
      #expect(found.map(ids) == (try expectedDeal(file, c.output)), "\(c.name)")
    }
  }

  @Test("searchWithAllRules")
  func searchWithAllRulesVectors() throws {
    let file = checked(try Golden.load("src/engine/deal", "searchWithAllRules"), "searchWithAllRules")
    for c in file.cases {
      let found = searchWithAllRules(
        try file.cards(member(c.input, "ranked")), try member(c.input, "size").int(),
        try file.cards(member(c.input, "avoid")), try balance(member(c.input, "balance")),
        try limits(member(c.input, "limits"))
      )
      #expect(found.map(ids) == (try expectedDeal(file, c.output)), "\(c.name)")
    }
  }

  @Test("relaxStepByStep")
  func relaxStepByStepVectors() throws {
    let file = checked(try Golden.load("src/engine/deal", "relaxStepByStep"), "relaxStepByStep")
    for c in file.cases {
      let picked = relaxStepByStep(
        try file.cards(member(c.input, "ranked")), try member(c.input, "size").int(),
        try file.cards(member(c.input, "avoid")), try balance(member(c.input, "balance")),
        try file.cards(member(c.input, "first"))
      )
      #expect(ids(picked) == (try expectedIds(file, c.output)), "\(c.name)")
    }
  }

  @Test("sharesGroup and trueCount")
  func groupsAndCounts() throws {
    let shares = checked(try Golden.load("src/engine/deal", "sharesGroup"), "sharesGroup")
    for c in shares.cases {
      let output = sharesGroup(try shares.card(member(c.input, "card")), try shares.cards(member(c.input, "others")))
      #expect(output == (try c.output.bool()), "sharesGroup: \(c.name)")
    }
    let counts = checked(try Golden.load("src/engine/deal", "trueCount"), "trueCount")
    for c in counts.cases {
      #expect(trueCount(try counts.cards(member(c.input, "cards"))) == (try c.output.int()), "trueCount: \(c.name)")
    }
  }

  @Test("balanceFor and balanceAllows")
  func balanceVectors() throws {
    let file = checked(try Golden.load("src/engine/deal", "balanceFor"), "balanceFor")
    for c in file.cases {
      #expect(balanceFor(try member(c.input, "size").int()) == (try balance(c.output)), "balanceFor: \(c.name)")
    }
    let allows = checked(try Golden.load("src/engine/deal", "balanceAllows"), "balanceAllows")
    for c in allows.cases {
      let output = balanceAllows(
        try member(c.input, "answer").bool(), try member(c.input, "trues").int(), try member(c.input, "falses").int(),
        try member(c.input, "size").int(), try balance(member(c.input, "balance"))
      )
      #expect(output == (try c.output.bool()), "balanceAllows: \(c.name)")
    }
  }

  @Test("arrange")
  func arrangeVectors() throws {
    let file = checked(try Golden.load("src/engine/deal", "arrange"), "arrange")
    for c in file.cases {
      let r = try rng(file, member(c.input, "rng"))
      let order = arrange(try file.cards(member(c.input, "chosen")), r.rng, try join(member(c.input, "join")))
      #expect(ids(order) == (try expectedIds(file, c.output)), "\(c.name)")
      expectAllDrawn(r, c.name)
    }
  }

  @Test("joinOf, runLimit and placementCheck")
  func runVectors() throws {
    let joins = checked(try Golden.load("src/engine/deal", "joinOf"), "joinOf")
    for c in joins.cases {
      #expect(joinOf(try bools(member(c.input, "before"))) == (try join(c.output)), "joinOf: \(c.name)")
    }
    let limits = checked(try Golden.load("src/engine/deal", "runLimit"), "runLimit")
    for c in limits.cases {
      let limit = runLimit(try member(c.input, "trues").int(), try member(c.input, "falses").int(), try join(member(c.input, "join")))
      #expect(limit == (try c.output.int()), "runLimit: \(c.name)")
    }
    let places = checked(try Golden.load("src/engine/deal", "placementCheck"), "placementCheck")
    for c in places.cases {
      let canPlace = placementCheck(try member(c.input, "limit").int())
      let output = canPlace(
        try member(c.input, "t").int(), try member(c.input, "f").int(), try lastAnswer(member(c.input, "last")),
        try member(c.input, "run").int()
      )
      #expect(output == (try c.output.bool()), "placementCheck: \(c.name)")
    }
  }

  @Test("pickAnswer")
  func pickAnswerVectors() throws {
    let file = checked(try Golden.load("src/engine/deal", "pickAnswer"), "pickAnswer")
    for c in file.cases {
      let r = try rng(file, member(c.input, "rng"))
      let output = pickAnswer(
        try bools(member(c.input, "allowed")), try member(c.input, "trues").int(), try member(c.input, "falses").int(), r.rng
      )
      #expect(output == (try c.output.bool()), "\(c.name)")
      expectAllDrawn(r, c.name)
    }
  }
}
