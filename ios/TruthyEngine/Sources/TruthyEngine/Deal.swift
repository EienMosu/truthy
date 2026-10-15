// Dealing: which cards a round gets, and in which order (spec section 6, "Dealing").
// A line-by-line port of src/engine/deal.ts. The only source of chance is the rng passed in.

/// The rules of a deal, per ten cards: at most three missed cards, four to six True cards, runs of at most three.
public struct DealConstants: Equatable, Sendable {
  public let missedPerTen: Int
  public let minTrue: Int
  public let maxTrue: Int
  public let maxRun: Int
}

public let DEAL = DealConstants(missedPerTen: 3, minTrue: 4, maxTrue: 6, maxRun: 3)

public struct DealOptions: Equatable, Sendable {
  public var count: Double // how many cards to deal (a Double, as in the TypeScript: NaN, 4.7 and -3 have pinned results)
  public var avoid: [Card]? // cards whose conflict groups must not be repeated
  public var before: [Bool]? // the answers of the cards dealt just before this deal, oldest first
  public var budget: Double? // the steps one search may take, SEARCH_BUDGET unless a test sets another

  public init(count: Double, avoid: [Card]? = nil, before: [Bool]? = nil, budget: Double? = nil) {
    self.count = count
    self.avoid = avoid
    self.before = before
    self.budget = budget
  }
}

public func deal(_ pool: [Card], _ history: History, _ rng: @escaping Rng, _ options: DealOptions) -> [Card] {
  let cards = uniqueById(pool)
  let size = dealSize(options.count, cards.count)
  if size == 0 { return [] }
  return dealRanked(
    rankByPriority(cards, history, rng, size), size, rng,
    Setting(avoid: options.avoid, before: options.before, budget: options.budget)
  )
}

// How a deal is chosen beyond its cards: the conflict groups to keep clear of, the answers just before it,
// the bound on the search and whether an unshown card is overdue (dealChunk only).
struct Setting: Equatable {
  var avoid: [Card]? = nil
  var before: [Bool]? = nil
  var budget: Double? = nil
  var overdue: Bool? = nil
}

// Chooses `size` cards from a ranking and puts them in order.
func dealRanked(_ ranking: Ranking, _ size: Int, _ rng: @escaping Rng, _ setting: Setting) -> [Card] {
  let chosen = choose(ranking, size, setting.avoid ?? [], setting.budget ?? SEARCH_BUDGET, setting.overdue ?? false)
  return arrange(chosen, rng, joinOf(setting.before ?? []))
}

// Where a deal joins the cards before it: their last answer and the length of the run of equal answers
// that ends them. Nothing before: no last answer, no run.
struct Join: Equatable {
  var last: Bool?
  var run: Int
}

func joinOf(_ before: [Bool]) -> Join {
  let last = before.last
  var run = 0
  var i = before.count - 1
  while i >= 0 && before[i] == last {
    run += 1
    i -= 1
  }
  return Join(last: last, run: run)
}

public let CHUNK = 10

// The next cards of a round, given every card the round has dealt so far (in order): ten, or as many as
// may be dealt. First in line are the cards the round has not shown, ranked by the stored history. Behind
// them stand the cards it may bring back: every card outside the last min(CHUNK, route size - 1) dealt,
// the one shown longest ago first. A card still unshown once the round has dealt the route twice over is
// overdue: the chunk then takes one unshown card even if a rule has to give way for it (see choose).
public func dealChunk(_ pool: [Card], _ history: History, _ rng: @escaping Rng, _ dealt: [Card], _ budget: Double = SEARCH_BUDGET) -> [Card] {
  let cards = uniqueById(pool)
  var lastDealtAt: [String: Int] = [:]
  for (position, card) in dealt.enumerated() { lastDealtAt[card.id] = position }
  let unshown = cards.filter { lastDealtAt[$0.id] == nil }
  let gap = min(CHUNK, cards.count - 1)
  let comeBack = stableSorted(cards.filter { (lastDealtAt[$0.id] ?? dealt.count) < dealt.count - gap }) {
    Double(lastDealtAt[$0.id] ?? 0)
  }
  let size = min(CHUNK, unshown.count + comeBack.count)
  let lastTen = Array(dealt.suffix(CHUNK))
  var ranking = rankByPriority(unshown, history, rng, size)
  ranking.comeBack = comeBack
  return dealRanked(ranking, size, rng, Setting(
    avoid: lastTen,
    before: lastTen.map(\.answer),
    budget: budget,
    overdue: !unshown.isEmpty && dealt.count >= OVERDUE_AFTER_PASSES * cards.count
  ))
}

// How many times a round deals the whole route before a card it has not shown is overdue.
let OVERDUE_AFTER_PASSES = 2

// The first card with each id wins, so a card can never be dealt twice.
func uniqueById(_ pool: [Card]) -> [Card] {
  var seen = Set<String>()
  return pool.filter { seen.insert($0.id).inserted }
}

func dealSize(_ count: Double, _ available: Int) -> Int {
  if count.isNaN || count <= 0 { return 0 }
  return Int(min(count.rounded(.down), Double(available)))
}

func wasSeen(_ card: Card, _ history: History) -> Bool {
  guard let entry = history[card.id] else { return false }
  return entry.seen > 0
}

func wasMissed(_ card: Card, _ history: History) -> Bool {
  wasSeen(card, history) && history[card.id]?.lastCorrect == false
}

func lastSeenAt(_ card: Card, _ history: History) -> Double {
  if let at = history[card.id]?.lastSeenAt, at.isFinite { return at }
  return 0
}

// Array.prototype.sort is stable; Swift's sort is not promised to be, so equal keys keep their order through
// an index tiebreak (spec 4.4). -0 and 0 are equal keys, as `a - b` is 0 for them in the TypeScript.
func stableSorted(_ cards: [Card], by key: (Card) -> Double) -> [Card] {
  let keys: [Double] = cards.map(key)
  let order: [Int] = cards.indices.sorted { (a: Int, b: Int) -> Bool in
    if keys[a] != keys[b] { return keys[a] < keys[b] }
    return a < b
  }
  return order.map { cards[$0] }
}

// Oldest first; equal times keep their (shuffled) order.
func oldestFirst(_ cards: [Card], _ history: History) -> [Card] {
  stableSorted(cards) { lastSeenAt($0, history) }
}

// The pool in the order cards should be considered: missed cards up to the cap (oldest miss first),
// never seen (shuffled), seen longest ago. The missed cards over the cap are kept apart.
struct Ranking: Equatable {
  var withinCap: [Card]
  var overCap: [Card]
  var comeBack: [Card] // dealChunk only: cards the round has shown and may bring back, the one shown longest ago first
  var missed: Set<String> // the ids of the missed cards among withinCap and overCap
  var missedCap: Int // how many missed cards a deal of this size holds at most, unless the rules need more
}

func rankByPriority(_ cards: [Card], _ history: History, _ rng: @escaping Rng, _ size: Int) -> Ranking {
  let shuffled = shuffle(cards, rng)
  let missed = oldestFirst(shuffled.filter { wasMissed($0, history) }, history)
  let unseen = shuffled.filter { !wasSeen($0, history) }
  let seenRight = oldestFirst(shuffled.filter { wasSeen($0, history) && !wasMissed($0, history) }, history)
  let missedCap = Int((Double(size * DEAL.missedPerTen) / 10).rounded(.down))
  return Ranking(
    withinCap: Array(missed.prefix(missedCap)) + unseen + seenRight,
    overCap: Array(missed.dropFirst(missedCap)),
    comeBack: [],
    missed: Set(missed.map(\.id)),
    missedCap: missedCap
  )
}

// How many True cards a deal of `size` may have: 4 to 6 per ten, scaled (floor of 40%, ceiling of 60%).
struct Balance: Equatable {
  var minTrue: Int
  var maxTrue: Int
}

func balanceFor(_ size: Int) -> Balance {
  Balance(
    minTrue: Int((Double(size * DEAL.minTrue) / 10).rounded(.down)),
    maxTrue: Int((Double(size * DEAL.maxTrue) / 10).rounded(.up))
  )
}

// Picks `size` cards, relaxing the rules in the order of the spec only as far as needed:
// 1. every rule, without the missed cards over the cap; 2. the missed cards over the cap (searchOverCap);
// 3. a card the round has shown may come back; 4. conflict groups, then 5. answer balance (relaxStepByStep).
// When an unshown card is overdue and the chunk holds none, the first unshown card goes in and the
// fallback relaxes the rest of the chunk around it.
func choose(_ ranking: Ranking, _ size: Int, _ avoid: [Card], _ budget: Double, _ overdue: Bool) -> [Card] {
  let balance = balanceFor(size)
  let unshown = ranking.withinCap + ranking.overCap
  let everyCard = unshown + ranking.comeBack
  let search = { (ranked: [Card], limits: Limits) -> [Card]? in
    searchWithAllRules(ranked, size, avoid, balance, Limits(
      budget: limits.budget ?? budget,
      missed: limits.missed ?? ranking.missed,
      missedLimit: limits.missedLimit
    ))
  }
  let chosen: [Card]
  if let found = search(ranking.withinCap, Limits()) {
    chosen = found
  } else if let found = searchOverCap(ranking, unshown, search) {
    chosen = found
  } else if !ranking.comeBack.isEmpty, let found = search(everyCard, Limits()) {
    chosen = found
  } else {
    chosen = relaxStepByStep(everyCard, size, avoid, balance)
  }
  let unshownIds = Set(unshown.map(\.id))
  if !overdue || chosen.contains(where: { unshownIds.contains($0.id) }) { return chosen }
  return relaxStepByStep(everyCard, size, avoid, balance, Array(unshown.prefix(1)))
}

// Step 2. A deal that keeps the missed cards within the cap comes before a deal over it; over the cap, the
// fewer missed cards the better. The limits tried run from the cap up to one below what the loosest deal holds.
func searchOverCap(_ ranking: Ranking, _ unshown: [Card], _ search: ([Card], Limits) -> [Card]?) -> [Card]? {
  if ranking.overCap.isEmpty { return nil }
  guard let loosest = search(unshown, Limits()) else { return nil }
  let held = loosest.filter { ranking.missed.contains($0.id) }.count
  var limit = ranking.missedCap
  while limit < held {
    if let found = search(unshown, Limits(missedLimit: limit)) { return found }
    limit += 1
  }
  return loosest
}

// A bound on the work one search may do (a Double, so that a test can pass Infinity as the web's does).
public let SEARCH_BUDGET: Double = 20_000

// What else a search must keep to: the steps it may take, and at most `missedLimit` of the `missed` cards.
// No missedLimit is the TypeScript's Infinity.
struct Limits: Equatable {
  var budget: Double? = nil
  var missed: Set<String>? = nil
  var missedLimit: Int? = nil
}

// Depth-first over the ranked cards: at each card, first try to take it, then try to leave it out.
// Returns nil when no deal keeps both the conflict groups and the balance (or the search ran out of steps).
func searchWithAllRules(_ ranked: [Card], _ size: Int, _ avoid: [Card], _ balance: Balance, _ limits: Limits = Limits()) -> [Card]? {
  var usedGroups = Set(avoid.flatMap(\.conflictGroups))
  var picked: [Card] = []
  let missed = limits.missed ?? []
  let missedLimit = limits.missedLimit ?? Int.max // Int.max stands for Infinity: nothing below overflows with it
  var trues = 0
  var missedTaken = 0
  var budget = limits.budget ?? SEARCH_BUDGET

  func isMissed(_ card: Card) -> Bool { missed.contains(card.id) }

  func canTake(_ card: Card) -> Bool {
    !card.conflictGroups.contains { usedGroups.contains($0) }
      && !(isMissed(card) && missedTaken >= missedLimit)
      && balanceAllows(card.answer, trues, picked.count - trues, size, balance)
  }

  func take(_ card: Card) {
    picked.append(card)
    if card.answer { trues += 1 }
    if isMissed(card) { missedTaken += 1 }
    for group in card.conflictGroups { usedGroups.insert(group) }
  }

  // A card is only taken when none of its groups is in use, so removing them on the way back is safe.
  func putBack(_ card: Card) {
    picked.removeLast()
    if card.answer { trues -= 1 }
    if isMissed(card) { missedTaken -= 1 }
    for group in card.conflictGroups { usedGroups.remove(group) }
  }

  // Whether ranked[from...] can still fill the deal: an upper bound on what those cards can add.
  func canStillFinish(_ from: Int) -> Bool {
    var loose = [0, 0] // cards with no group, by answer (0 False, 1 True)
    var grouped = [0, 0] // cards with groups, by answer
    var groupsOf = [Set<String>(), Set<String>()]
    var allGroups = Set<String>()
    var takeable = 0
    var missedLeft = 0
    for card in ranked.dropFirst(from) {
      if card.conflictGroups.contains(where: { usedGroups.contains($0) }) { continue }
      let answer = card.answer ? 1 : 0
      takeable += 1
      if isMissed(card) { missedLeft += 1 }
      if card.conflictGroups.isEmpty {
        loose[answer] += 1
        continue
      }
      grouped[answer] += 1
      for group in card.conflictGroups {
        groupsOf[answer].insert(group)
        allGroups.insert(group)
      }
    }
    let need = size - picked.count
    let falses = picked.count - trues
    let cardsLeft = loose[0] + loose[1] + min(grouped[0] + grouped[1], allGroups.count)
    let withinMissedLimit = takeable - max(0, missedLeft - (missedLimit - missedTaken))
    let truesLeft = min(loose[1] + min(grouped[1], groupsOf[1].count), balance.maxTrue - trues)
    let falsesLeft = min(loose[0] + min(grouped[0], groupsOf[0].count), size - balance.minTrue - falses)
    return min(cardsLeft, withinMissedLimit, truesLeft + falsesLeft) >= need
  }

  func visit(_ from: Int) -> Bool {
    if picked.count == size { return true }
    let left = budget
    budget -= 1
    if left <= 0 || !canStillFinish(from) { return false }
    guard from < ranked.count else { return false }
    let card = ranked[from]
    if canTake(card) {
      take(card)
      if visit(from + 1) { return true }
      putBack(card)
    }
    return visit(from + 1)
  }

  return visit(0) ? picked : nil
}

struct Rules: Equatable {
  var conflicts: Bool // keep conflict groups apart (within the deal and against `avoid`)
  var balance: Bool // keep the number of True cards inside the balance
}

// The fallback when no deal keeps every rule. Three passes over the ranked cards, each adding to the cards
// already picked (`first`, if given): all rules, then without conflict groups, then without the balance.
func relaxStepByStep(_ ranked: [Card], _ size: Int, _ avoid: [Card], _ balance: Balance, _ first: [Card] = []) -> [Card] {
  var picked = first
  var pickedIds = Set(first.map(\.id))

  func breaks(_ card: Card, _ rules: Rules) -> Bool {
    if rules.conflicts && sharesGroup(card, avoid + picked) { return true }
    if !rules.balance { return false }
    let trues = trueCount(picked)
    return !balanceAllows(card.answer, trues, picked.count - trues, size, balance)
  }

  func fill(_ rules: Rules) {
    for card in ranked {
      if picked.count == size { return }
      if pickedIds.contains(card.id) || breaks(card, rules) { continue }
      picked.append(card)
      pickedIds.insert(card.id)
    }
  }

  fill(Rules(conflicts: true, balance: true))
  fill(Rules(conflicts: false, balance: true))
  fill(Rules(conflicts: false, balance: false))
  return picked
}

func sharesGroup(_ card: Card, _ others: [Card]) -> Bool {
  card.conflictGroups.contains { group in others.contains { $0.conflictGroups.contains(group) } }
}

func trueCount(_ cards: [Card]) -> Int {
  cards.filter(\.answer).count
}

// True cards may not pass maxTrue, and False cards may not pass size - minTrue,
// so a full deal picked under this rule always lands inside the balance.
func balanceAllows(_ answer: Bool, _ trues: Int, _ falses: Int, _ size: Int, _ balance: Balance) -> Bool {
  answer ? trues < balance.maxTrue : falses < size - balance.minTrue
}

// Puts the chosen cards in an order drawn from the rng with no run of equal answers longer than the run limit.
// Position by position, it draws True or False in proportion to how many of each are left, among the answers
// that still allow the rest to be placed; then it takes the next card of that answer.
func arrange(_ chosen: [Card], _ rng: @escaping Rng, _ join: Join) -> [Card] {
  var trues = shuffle(chosen.filter(\.answer), rng)
  var falses = shuffle(chosen.filter { !$0.answer }, rng)
  let limit = runLimit(trues.count, falses.count, join)
  let canPlace = placementCheck(limit)
  var order: [Card] = []
  var last = join.last
  var run = join.run

  while trues.count + falses.count > 0 {
    let allowed = [true, false].filter { answer in
      let left = answer ? trues.count : falses.count
      if left == 0 || (answer == last && run >= limit) { return false }
      let nextRun = answer == last ? run + 1 : 1
      return canPlace(trues.count - (answer ? 1 : 0), falses.count - (answer ? 0 : 1), answer, nextRun)
    }
    let answer = pickAnswer(allowed, trues.count, falses.count, rng)
    guard let card = answer ? trues.first : falses.first else { break }
    if answer { trues.removeFirst() } else { falses.removeFirst() }
    order.append(card)
    run = answer == last ? run + 1 : 1
    last = answer
  }
  return order
}

// The run limit is DEAL.maxRun, unless no order of these answers after the cards before them can keep it;
// then it is the smallest limit some order can keep.
func runLimit(_ trues: Int, _ falses: Int, _ join: Join) -> Int {
  var limit = DEAL.maxRun
  while !placementCheck(limit)(trues, falses, join.last, join.run) { limit += 1 }
  return limit
}

// canPlace(t, f, last, run): can t True and f False cards still be placed after a run of `run` cards
// with answer `last`, without any run passing the limit? Memoised, so a whole deal costs little.
func placementCheck(_ limit: Int) -> (Int, Int, Bool?, Int) -> Bool {
  let memo = PlacementMemo()
  func canPlace(_ t: Int, _ f: Int, _ last: Bool?, _ run: Int) -> Bool {
    if t == 0 && f == 0 { return true }
    let key = PlacementKey(t: t, f: f, last: last, run: run)
    if let known = memo.known[key] { return known }
    let result =
      (t > 0 && (last != true || run < limit) && canPlace(t - 1, f, true, last == true ? run + 1 : 1))
      || (f > 0 && (last != false || run < limit) && canPlace(t, f - 1, false, last == false ? run + 1 : 1))
    memo.known[key] = result
    return result
  }
  return canPlace
}

private final class PlacementMemo {
  var known: [PlacementKey: Bool] = [:]
}

private struct PlacementKey: Hashable {
  let t: Int
  let f: Int
  let last: Bool?
  let run: Int
}

// Chooses between the allowed answers in proportion to the cards left of each.
// The run limit always leaves at least one allowed answer; the empty case is only a guard.
func pickAnswer(_ allowed: [Bool], _ trues: Int, _ falses: Int, _ rng: @escaping Rng) -> Bool {
  if allowed.isEmpty { return trues > 0 }
  if allowed.count == 1 { return allowed[0] == true }
  return rng() * Double(trues + falses) < Double(trues)
}
