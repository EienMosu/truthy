@testable import TruthyEngine

// Reads the round's golden vectors (plan A, "The golden vector format") and writes round values back in the
// same JSON shape, so a test compares a whole snapshot with one ==. Everything is namespaced here so that
// no name clashes with another test file.
enum RoundVectors {
    struct Failure: Error, CustomStringConvertible {
        let description: String
    }

    static func object(_ value: JSONValue) throws -> [String: JSONValue] {
        guard case let .object(fields) = value else { throw Failure(description: "expected an object, got \(value)") }
        return fields
    }

    static func array(_ value: JSONValue) throws -> [JSONValue] {
        guard case let .array(items) = value else { throw Failure(description: "expected an array, got \(value)") }
        return items
    }

    static func string(_ value: JSONValue) throws -> String {
        guard case let .string(text) = value else { throw Failure(description: "expected a string, got \(value)") }
        return text
    }

    static func bool(_ value: JSONValue) throws -> Bool {
        guard case let .bool(flag) = value else { throw Failure(description: "expected a boolean, got \(value)") }
        return flag
    }

    static func field(_ fields: [String: JSONValue], _ key: String) throws -> JSONValue {
        guard let value = fields[key] else { throw Failure(description: "missing key \(key) in \(fields)") }
        return value
    }

    // A plain number, or one of the tagged numbers JSON cannot carry.
    static func number(_ value: JSONValue) throws -> Double {
        switch value {
        case let .number(number):
            return number
        case let .object(fields):
            switch try string(field(fields, "$number")) {
            case "NaN": return .nan
            case "Infinity": return .infinity
            case "-Infinity": return -.infinity
            case "-0": return -0.0
            case let other: throw Failure(description: "unknown tagged number \(other)")
            }
        default:
            throw Failure(description: "expected a number, got \(value)")
        }
    }

    static func int(_ value: JSONValue) throws -> Int {
        let parsed = try number(value)
        guard let whole = Int(exactly: parsed) else { throw Failure(description: "expected an integer, got \(parsed)") }
        return whole
    }

    // A {"$card": id} reference, decoded through the file's card table (task 1's loader resolves it). Round
    // vectors use the web tests' own cards, never a whole shipped deck.
    static func card(_ value: JSONValue, _ file: GoldenFile) throws -> Card {
        try file.decode(Card.self, value)
    }

    static func route(_ value: JSONValue) throws -> Route {
        let fields = try object(value)
        return Route(deckId: try string(field(fields, "deckId")), sectionId: try string(field(fields, "sectionId")))
    }

    static func history(_ value: JSONValue) throws -> History {
        var history: History = [:]
        for (id, entry) in try object(value) {
            let fields = try object(entry)
            history[id] = CardHistory(
                seen: try int(field(fields, "seen")),
                lastCorrect: try bool(field(fields, "lastCorrect")),
                lastSeenAt: try number(field(fields, "lastSeenAt"))
            )
        }
        return history
    }

    // The mode as the vector spells it: a string that is not a Mode is the TypeScript's unknown-mode case.
    static func modeName(ofStart value: JSONValue) throws -> String {
        try string(field(object(value), "mode"))
    }

    static func startArgs(_ value: JSONValue, _ file: GoldenFile) throws -> StartArgs {
        let fields = try object(value)
        let name = try string(field(fields, "mode"))
        guard let mode = Mode(rawValue: name) else { throw Failure(description: "unknown mode \(name)") }
        return StartArgs(
            mode: mode,
            route: try route(field(fields, "route")),
            pool: try array(field(fields, "pool")).map { try card($0, file) },
            history: try history(field(fields, "history")),
            seed: try number(field(fields, "seed"))
        )
    }

    static func event(_ value: JSONValue) throws -> RoundEvent {
        let fields = try object(value)
        switch try string(field(fields, "type")) {
        case "answer":
            return .answer(value: try bool(field(fields, "value")), at: try number(field(fields, "at")))
        case "next":
            return .next
        case "tick":
            return .tick(now: try number(field(fields, "now")))
        case "visibility":
            return .visibility(hidden: try bool(field(fields, "hidden")), at: try number(field(fields, "at")))
        case "abandon":
            return .abandon
        case let other:
            throw Failure(description: "unknown event type \(other)")
        }
    }

    static func answered(_ value: JSONValue, _ file: GoldenFile) throws -> Answered {
        let fields = try object(value)
        return Answered(
            card: try card(field(fields, "card"), file),
            given: try bool(field(fields, "given")),
            correct: try bool(field(fields, "correct")),
            at: try number(field(fields, "at"))
        )
    }

    // A trace: the state startRound returned, then the state after each event.
    static func replay(_ input: JSONValue, _ file: GoldenFile) throws -> [RoundState] {
        let fields = try object(input)
        var state = try startRound(startArgs(field(fields, "start"), file))
        var states = [state]
        for event in try array(field(fields, "events")) {
            state = reduce(state, try self.event(event))
            states.append(state)
        }
        return states
    }

    // Tagged numbers in an expected value become plain numbers, so that a loader that keeps the tags and one
    // that resolves them compare the same.
    static func normalized(_ value: JSONValue) -> JSONValue {
        switch value {
        case let .array(items):
            return .array(items.map(normalized))
        case let .object(fields):
            if fields.count == 1, fields["$number"] != nil, let parsed = try? number(value) {
                return .number(parsed)
            }
            return .object(fields.mapValues(normalized))
        default:
            return value
        }
    }

    static let undefined: JSONValue = .object(["$undefined": .bool(true)])

    static func encode(_ card: Card) -> JSONValue {
        .object(["$card": .string(card.id)])
    }

    static func encode(_ route: Route) -> JSONValue {
        .object(["deckId": .string(route.deckId), "sectionId": .string(route.sectionId)])
    }

    static func encode(_ answer: Answered) -> JSONValue {
        .object([
            "card": encode(answer.card),
            "given": .bool(answer.given),
            "correct": .bool(answer.correct),
            "at": .number(answer.at),
        ])
    }

    static func encode(_ clock: Clock?) -> JSONValue {
        guard let clock else { return .null }
        return .object([
            "remainingMs": .number(clock.remainingMs),
            "lastTick": clock.lastTick.map { .number($0) } ?? .null,
            "hidden": .bool(clock.hidden),
            "holdMs": .number(clock.holdMs),
        ])
    }

    // The snapshot of plan A's format: the state's own fields, with source replaced by its chunk count.
    static func encode(_ state: RoundState) -> JSONValue {
        .object([
            "mode": .string(state.mode.rawValue),
            "route": encode(state.route),
            "cards": .array(state.cards.map(encode)),
            "index": .number(Double(state.index)),
            "answers": .array(state.answers.map(encode)),
            "phase": .string(state.phase.rawValue),
            "abandoned": .bool(state.abandoned),
            "chunks": .number(Double(state.source.chunks)),
            "clock": encode(state.clock),
        ])
    }

    static func encode(_ result: RoundResult) -> JSONValue {
        .object([
            "mode": .string(result.mode.rawValue),
            "route": encode(result.route),
            "score": .number(Double(result.score)),
            "total": .number(Double(result.total)),
            "answers": .array(result.answers.map(encode)),
            "missed": .array(result.missed.map(encode)),
            "abandoned": .bool(result.abandoned),
        ])
    }

    static func encode(_ number: Int) -> JSONValue {
        .number(Double(number))
    }

    // What each state reader returns, in the vector's shape; nil is the TypeScript's undefined.
    static func read(_ function: String, _ state: RoundState) throws -> JSONValue {
        switch function {
        case "currentCard": return currentCard(state).map { encode($0) } ?? undefined
        case "lastAnswer": return lastAnswer(state).map { encode($0) } ?? undefined
        case "wrongCount": return encode(wrongCount(state))
        case "livesLeft": return encode(livesLeft(state))
        case "isDecided": return .bool(isDecided(state))
        case "summarise": return encode(summarise(state))
        default: throw Failure(description: "no reader named \(function)")
        }
    }
}
