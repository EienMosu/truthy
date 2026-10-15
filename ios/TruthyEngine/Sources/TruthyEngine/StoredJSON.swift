// A strict JSON parser with JavaScript's JSON.parse results, for reading stored progress.
// Foundation's JSONSerialization rejects a whole document that holds a number such as 1e999, while
// JSON.parse reads it as Infinity and readProgress then drops only the part that holds it (reference 3.5).
// Every number is a Double, as in JavaScript; a later duplicate key replaces an earlier one.

enum StoredJSON: Equatable, Sendable {
  case null
  case bool(Bool)
  case number(Double)
  case string(String)
  case array([StoredJSON])
  case object([String: StoredJSON])
}

// The value of a whole JSON text, or nil when JSON.parse would throw.
func parseJSON(_ text: String) -> StoredJSON? {
  var parser = JSONParser(units: Array(text.utf16))
  parser.skipWhitespace()
  guard let value = parser.value() else { return nil }
  parser.skipWhitespace()
  return parser.index == parser.units.count ? value : nil
}

private struct JSONParser {
  let units: [UInt16]
  var index = 0
  // Nested arrays and objects open now. Deeper than maxDepth fails the parse instead of overflowing the stack.
  private var depth = 0
  static let maxDepth = 512

  init(units: [UInt16]) { self.units = units }

  private var current: UInt16? { index < units.count ? units[index] : nil }

  private static func unit(_ character: Unicode.Scalar) -> UInt16 { UInt16(character.value) }

  mutating func skipWhitespace() {
    while let c = current, c == 0x20 || c == 0x09 || c == 0x0A || c == 0x0D { index += 1 }
  }

  mutating func value() -> StoredJSON? {
    guard let c = current else { return nil }
    switch c {
    case Self.unit("{"): return object()
    case Self.unit("["): return array()
    case Self.unit("\""): return string().map(StoredJSON.string)
    case Self.unit("t"): return literal("true", .bool(true))
    case Self.unit("f"): return literal("false", .bool(false))
    case Self.unit("n"): return literal("null", .null)
    default: return number()
    }
  }

  private mutating func literal(_ word: String, _ result: StoredJSON) -> StoredJSON? {
    let expected = Array(word.utf16)
    guard index + expected.count <= units.count, Array(units[index..<index + expected.count]) == expected else { return nil }
    index += expected.count
    return result
  }

  private mutating func object() -> StoredJSON? {
    index += 1
    depth += 1
    defer { depth -= 1 }
    if depth > Self.maxDepth { return nil }
    var members: [String: StoredJSON] = [:]
    skipWhitespace()
    if current == Self.unit("}") { index += 1; return .object(members) }
    while true {
      skipWhitespace()
      guard current == Self.unit("\""), let key = string() else { return nil }
      skipWhitespace()
      guard current == Self.unit(":") else { return nil }
      index += 1
      skipWhitespace()
      guard let member = value() else { return nil }
      members[key] = member
      skipWhitespace()
      if current == Self.unit(",") { index += 1; continue }
      if current == Self.unit("}") { index += 1; return .object(members) }
      return nil
    }
  }

  private mutating func array() -> StoredJSON? {
    index += 1
    depth += 1
    defer { depth -= 1 }
    if depth > Self.maxDepth { return nil }
    var items: [StoredJSON] = []
    skipWhitespace()
    if current == Self.unit("]") { index += 1; return .array(items) }
    while true {
      skipWhitespace()
      guard let item = value() else { return nil }
      items.append(item)
      skipWhitespace()
      if current == Self.unit(",") { index += 1; continue }
      if current == Self.unit("]") { index += 1; return .array(items) }
      return nil
    }
  }

  // A string's UTF-16 code units; a lone surrogate becomes U+FFFD, which a Swift String cannot avoid.
  private mutating func string() -> String? {
    index += 1
    var out: [UInt16] = []
    while let c = current {
      index += 1
      if c == Self.unit("\"") { return String(decoding: out, as: UTF16.self) }
      if c < 0x20 { return nil }
      if c != Self.unit("\\") { out.append(c); continue }
      guard let escape = current else { return nil }
      index += 1
      switch escape {
      case Self.unit("\""), Self.unit("\\"), Self.unit("/"): out.append(escape)
      case Self.unit("b"): out.append(0x08)
      case Self.unit("f"): out.append(0x0C)
      case Self.unit("n"): out.append(0x0A)
      case Self.unit("r"): out.append(0x0D)
      case Self.unit("t"): out.append(0x09)
      case Self.unit("u"):
        // Exactly four ASCII hex digits, as JSON.parse requires (UInt16(_:radix:) would also take a sign).
        guard index + 4 <= units.count else { return nil }
        var code: UInt16 = 0
        for u in units[index..<index + 4] {
          switch u {
          case 0x30...0x39: code = code << 4 | (u - 0x30)
          case 0x41...0x46: code = code << 4 | (u - 0x37)
          case 0x61...0x66: code = code << 4 | (u - 0x57)
          default: return nil
          }
        }
        out.append(code)
        index += 4
      default: return nil
      }
    }
    return nil
  }

  private static func isDigit(_ c: UInt16?) -> Bool { c.map { $0 >= 0x30 && $0 <= 0x39 } ?? false }

  // -? (0 | [1-9][0-9]*) (. [0-9]+)? ([eE] [+-]? [0-9]+)?, read as the nearest Double (1e999 is Infinity).
  private mutating func number() -> StoredJSON? {
    let start = index
    if current == Self.unit("-") { index += 1 }
    if current == Self.unit("0") {
      index += 1
    } else if Self.isDigit(current) {
      while Self.isDigit(current) { index += 1 }
    } else {
      return nil
    }
    if current == Self.unit(".") {
      index += 1
      guard Self.isDigit(current) else { return nil }
      while Self.isDigit(current) { index += 1 }
    }
    if current == Self.unit("e") || current == Self.unit("E") {
      index += 1
      if current == Self.unit("+") || current == Self.unit("-") { index += 1 }
      guard Self.isDigit(current) else { return nil }
      while Self.isDigit(current) { index += 1 }
    }
    guard let parsed = Double(String(decoding: units[start..<index], as: UTF16.self)) else { return nil }
    return .number(parsed)
  }
}
