import TruthyEngine

// Throwing readers over a raw golden value, for suites that walk a case by hand. Each throws a GoldenError that
// names the value it could not read, so a case that does not have the expected shape fails with its content.

typealias GoldenValue = JSONValue

extension JSONValue {
    /// A JSON number, or one of the numbers JSON cannot carry, written {"$number": ...}.
    func number() throws -> Double {
        if case .number(let n) = self { return n }
        if let tag, tag.key == "$number" {
            switch tag.value.stringValue {
            case "Infinity": return .infinity
            case "-Infinity": return -.infinity
            case "NaN": return .nan
            case "-0": return -0.0
            default: break
            }
        }
        throw GoldenError(description: "not a number: \(self)")
    }

    /// A number that is a whole number Int can hold.
    func int() throws -> Int {
        let n = try number()
        guard let i = Int(exactly: n) else { throw GoldenError(description: "not an integer: \(n)") }
        return i
    }

    func bool() throws -> Bool {
        guard case .bool(let b) = self else { throw GoldenError(description: "not a boolean: \(self)") }
        return b
    }

    func string() throws -> String {
        guard case .string(let s) = self else { throw GoldenError(description: "not a string: \(self)") }
        return s
    }

    func array() throws -> [JSONValue] {
        guard case .array(let a) = self else { throw GoldenError(description: "not an array: \(self)") }
        return a
    }
}

extension GoldenFile {
    /// {"$card": id} through the file's card table.
    func card(_ value: JSONValue) throws -> Card {
        try decode(Card.self, value)
    }

    /// An array of card references, or {"$deck": id} (the cards of native-data/decks/<id>.json, in file order).
    func cards(_ value: JSONValue) throws -> [Card] {
        try decode([Card].self, value)
    }
}
