import Foundation
import Testing
import TruthyEngine

// Reads native-data/golden, the vectors plan A computes by running the TypeScript code. The format is plan A's
// "The golden vector format": one file per function or constant, a card table, tagged values.

/// Any failure to read a golden value. A struct with a description, so a test can throw one of its own.
struct GoldenError: Error, CustomStringConvertible {
    let description: String
}

struct GoldenCase: Decodable, Sendable {
    let name: String
    let input: JSONValue
    let output: JSONValue

    /// The message of an output written as {"$throws": message}, or nil when the case returns a value.
    var throwsMessage: String? {
        if let tag = output.tag, tag.key == "$throws" { return tag.value.stringValue }
        return nil
    }
}

struct GoldenFile: Decodable, Sendable {
    let format: Int
    let module: String
    let function: String
    let source: String
    let tests: [String]
    let cards: [String: JSONValue]
    let cases: [GoldenCase]

    /// `value` with its tags resolved: {"$card": id} becomes the card of the table, {"$deck": id} the cards of
    /// native-data/decks/<id>.json (read from `decks`), {"$number": ...} the double it names, and
    /// {"$undefined": true} is left out of an object (null anywhere else). {"$rng": ...} and {"$throws": ...} stay.
    func resolved(_ value: JSONValue, decks: URL = Golden.decksDirectory) throws -> JSONValue {
        if let tag = value.tag {
            switch tag.key {
            case "$card":
                guard let id = tag.value.stringValue else { throw GoldenError(description: "malformed tag: $card \(tag.value)") }
                guard let card = cards[id] else { throw GoldenError(description: "card \"\(id)\" is not in the file's card table") }
                return try resolved(card, decks: decks)
            case "$deck":
                guard let id = tag.value.stringValue else { throw GoldenError(description: "malformed tag: $deck \(tag.value)") }
                let data = try Data(contentsOf: decks.appending(path: "\(id).json"))
                guard let cardList = try JSONDecoder().decode(JSONValue.self, from: data)["cards"] else {
                    throw GoldenError(description: "malformed tag: deck \(id) has no cards")
                }
                return cardList
            case "$number":
                switch tag.value.stringValue {
                case "Infinity": return .number(.infinity)
                case "-Infinity": return .number(-.infinity)
                case "NaN": return .number(.nan)
                case "-0": return .number(-0.0)
                default: throw GoldenError(description: "malformed tag: $number \(tag.value)")
                }
            case "$undefined":
                return .null
            default:
                return value
            }
        }
        switch value {
        case .array(let items):
            return .array(try items.map { try resolved($0, decks: decks) })
        case .object(let members):
            var result: [String: JSONValue] = [:]
            for (key, member) in members where !Golden.isUndefined(member) {
                result[key] = try resolved(member, decks: decks)
            }
            return .object(result)
        default:
            return value
        }
    }

    /// `value`, resolved, decoded as `type`. Numbers JSON cannot carry survive: they travel as the strings
    /// "Infinity", "-Infinity" and "NaN" between the encoder and the decoder, and -0 keeps its sign.
    func decode<T: Decodable>(_ type: T.Type, _ value: JSONValue, decks: URL = Golden.decksDirectory) throws -> T {
        let encoder = JSONEncoder()
        encoder.nonConformingFloatEncodingStrategy = .convertToString(positiveInfinity: "Infinity", negativeInfinity: "-Infinity", nan: "NaN")
        let decoder = JSONDecoder()
        decoder.nonConformingFloatDecodingStrategy = .convertFromString(positiveInfinity: "Infinity", negativeInfinity: "-Infinity", nan: "NaN")
        return try decoder.decode(type, from: encoder.encode(resolved(value, decks: decks)))
    }

    /// The generator an rng argument stands for: {"$rng": {"seed": n}} is createRng(n); {"$rng": {"values": [...]}}
    /// returns the values in order and records a test failure when they run out.
    func rng(_ value: JSONValue) throws -> Rng {
        guard let tag = value.tag, tag.key == "$rng" else { throw GoldenError(description: "not an rng argument: \(value)") }
        if let seed = tag.value["seed"]?.numberValue {
            return createRng(seed)
        }
        guard let values = tag.value["values"]?.arrayValue?.compactMap(\.numberValue) else {
            throw GoldenError(description: "not an rng argument: \(value)")
        }
        var next = 0
        return {
            guard next < values.count else {
                Issue.record("the rng ran out after \(values.count) values")
                return 0
            }
            next += 1
            return values[next - 1]
        }
    }
}

enum Golden {
    /// The repository root, five folders above this file's folder (ios/TruthyEngine/Tests/TruthyEngineTests/Support).
    static let root: URL = URL(filePath: #filePath)
        .deletingLastPathComponent()
        .deletingLastPathComponent()
        .deletingLastPathComponent()
        .deletingLastPathComponent()
        .deletingLastPathComponent()
        .deletingLastPathComponent()

    static let directory: URL = root.appending(path: "native-data/golden")
    static let decksDirectory: URL = root.appending(path: "native-data/decks")
    static let testsDirectory: URL = root.appending(path: "ios/TruthyEngine/Tests/TruthyEngineTests")

    /// Plan A's one name that does not follow "<module with / as .>.<name>.json": the constant DEAL of src/engine/deal,
    /// because src.engine.deal.DEAL.json and the function's src.engine.deal.deal.json are one file on a volume that
    /// ignores case (plan A README, "The golden vector format").
    static let nameExceptions: [String: String] = ["src/engine/deal|DEAL": "src.engine.deal.DEAL.constant.json"]

    /// The file name of a function's or constant's vectors: "src/engine/rng" and "createRng" give "src.engine.rng.createRng.json".
    static func fileName(_ module: String, _ function: String) -> String {
        nameExceptions[module + "|" + function] ?? module.replacingOccurrences(of: "/", with: ".") + "." + function + ".json"
    }

    /// The vectors of one function or constant. Every test that ports a function calls this with string literals,
    /// so the coverage test can find which files the suite consumes.
    static func load(_ module: String, _ function: String) throws -> GoldenFile {
        try decodeFile(at: directory.appending(path: fileName(module, function)))
    }

    static func decodeFile(at url: URL) throws -> GoldenFile {
        try JSONDecoder().decode(GoldenFile.self, from: Data(contentsOf: url))
    }

    /// Every file name in native-data/golden, sorted.
    static func fileNames() throws -> [String] {
        try FileManager.default.contentsOfDirectory(atPath: directory.path(percentEncoded: false))
            .filter { $0.hasSuffix(".json") }
            .sorted()
    }

    static func isUndefined(_ value: JSONValue) -> Bool {
        if let tag = value.tag, tag.key == "$undefined" { return true }
        return false
    }
}
