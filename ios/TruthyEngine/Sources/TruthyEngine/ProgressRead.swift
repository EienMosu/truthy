// Reading a stored progress value part by part, a port of readProgress and parseProgress in
// src/progress/progress.ts and of the zod schemas they use (reference 3.5). Each card entry, each record and
// the last route stand on their own: one that fails is dropped alone, and the read is then not whole.
// Unknown fields are dropped.

private let MAX_SAFE_INTEGER: Double = 9_007_199_254_740_991

// zod 4: z.number() rejects Infinity and NaN; z.int() accepts safe integers only.
private func safeInteger(_ value: StoredJSON?) -> Int? {
  guard case .number(let n)? = value, n.isFinite, n == n.rounded(.towardZero), abs(n) <= MAX_SAFE_INTEGER else { return nil }
  return Int(n)
}

private func nonnegativeInteger(_ value: StoredJSON?) -> Int? {
  guard let n = safeInteger(value), n >= 0 else { return nil }
  return n
}

private func cardHistory(_ value: StoredJSON) -> CardHistory? {
  guard case .object(let fields) = value,
    let seen = nonnegativeInteger(fields["seen"]),
    case .bool(let lastCorrect)? = fields["lastCorrect"],
    case .number(let lastSeenAt)? = fields["lastSeenAt"], lastSeenAt.isFinite, lastSeenAt >= 0
  else { return nil }
  return CardHistory(seen: seen, lastCorrect: lastCorrect, lastSeenAt: lastSeenAt)
}

private func record(_ value: StoredJSON) -> Int? {
  nonnegativeInteger(value)
}

// A score or total: missing reads as nil (stored before scores were kept), null is nil, otherwise a
// non-negative safe integer. The outer nil means the value fails.
private func optionalCount(_ value: StoredJSON?) -> Int?? {
  switch value {
  case nil, .null?: return .some(nil)
  default:
    guard let n = nonnegativeInteger(value) else { return nil }
    return .some(n)
  }
}

private func nonEmptyString(_ value: StoredJSON?) -> String? {
  guard case .string(let s)? = value, !s.isEmpty else { return nil }
  return s
}

// The last route: null reads as nil and succeeds; a missing key fails (undefined is not null in zod).
private func lastRound(_ value: StoredJSON?) -> (success: Bool, last: LastRound?) {
  guard let value else { return (false, nil) }
  if value == .null { return (true, nil) }
  guard case .object(let fields) = value,
    case .object(let route)? = fields["route"],
    let deckId = nonEmptyString(route["deckId"]),
    let sectionId = nonEmptyString(route["sectionId"]),
    case .string(let modeName)? = fields["mode"], let mode = Mode(rawValue: modeName),
    let score = optionalCount(fields["score"]),
    let total = optionalCount(fields["total"])
  else { return (false, nil) }
  return (true, LastRound(route: Route(deckId: deckId, sectionId: sectionId), mode: mode, score: score, total: total))
}

// The entries of a stored map that pass; a value that is not an object reads as empty and not whole.
private func validEntries<T>(_ value: StoredJSON?, _ parse: (StoredJSON) -> T?) -> (kept: [String: T], whole: Bool) {
  guard case .object(let entries)? = value else { return ([:], false) }
  var kept: [String: T] = [:]
  var whole = true
  for (key, entry) in entries {
    if let parsed = parse(entry) { kept[key] = parsed } else { whole = false }
  }
  return (kept, whole)
}

// Never fails. Nothing stored reads as empty and whole. Invalid JSON, a value that is not an object and any
// version other than the number 1 read as empty and not whole. Otherwise a card entry, a record or a last
// route that fails is dropped alone (the last route becomes nil), and the rest is kept.
public func readProgress(_ raw: String?) -> (progress: Progress, whole: Bool) {
  guard let raw else { return (emptyProgress(), true) }
  guard let data = parseJSON(raw), case .object(let fields) = data, fields["version"] == .number(1) else {
    return (emptyProgress(), false)
  }
  let cards = validEntries(fields["cards"], cardHistory)
  let records = validEntries(fields["records"], record)
  let last = lastRound(fields["last"])
  return (
    Progress(version: 1, cards: cards.kept, records: records.kept, last: last.last),
    cards.whole && records.whole && last.success
  )
}

/// The progress kept from a stored value (see readProgress).
public func parseProgress(_ raw: String?) -> Progress {
  readProgress(raw).progress
}
