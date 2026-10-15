import Testing
@testable import TruthyEngine

// The round against the vectors the TypeScript computed (native-data/golden/src.engine.round.*.json): every
// case of every file, every state of every trace. A trace is replayed once per file and compared state by
// state; the first differing state is reported with the case name.
@Suite("Round: golden vectors")
struct RoundGoldenTests {
    typealias V = RoundVectors

    @Test func classicLengthLivesAndTimedAreTheWebConstants() throws {
        let classic = try Golden.load("src/engine/round", "CLASSIC_LENGTH")
        let lives = try Golden.load("src/engine/round", "LIVES")
        let timed = try Golden.load("src/engine/round", "TIMED")
        #expect(V.normalized(classic.cases[0].output) == V.encode(CLASSIC_LENGTH))
        #expect(V.normalized(lives.cases[0].output) == V.encode(LIVES))
        #expect(V.normalized(timed.cases[0].output) == .object([
            "roundMs": .number(TIMED.roundMs), "holdMs": .number(TIMED.holdMs), "maxStepMs": .number(TIMED.maxStepMs),
        ]))
    }

    @Test func chunkSeedVectors() throws {
        let file = try Golden.load("src/engine/round", "chunkSeed")
        #expect(!file.cases.isEmpty)
        for c in file.cases {
            let input = try V.object(c.input)
            let seed = try V.number(V.field(input, "seed"))
            let chunk = try V.int(V.field(input, "chunk"))
            #expect(chunkSeed(seed, chunk) == (try V.number(c.output)), "\(c.name)")
        }
    }

    @Test func scoreOfVectors() throws {
        let file = try Golden.load("src/engine/round", "scoreOf")
        #expect(!file.cases.isEmpty)
        for c in file.cases {
            let input = try V.object(c.input)
            let mode = try #require(Mode(rawValue: try V.string(V.field(input, "mode"))))
            let answers = try V.array(V.field(input, "answers")).map { try V.answered($0, file) }
            #expect(scoreOf(mode, answers) == (try V.int(c.output)), "\(c.name)")
        }
    }

    @Test func startRoundVectors() throws {
        let file = try Golden.load("src/engine/round", "startRound")
        #expect(!file.cases.isEmpty)
        for c in file.cases {
            let start = try V.field(V.object(c.input), "args")
            let expected = V.normalized(c.output)
            let mode = try V.modeName(ofStart: start)
            guard Mode(rawValue: mode) != nil else {
                // A Mode value is always one of the four: the TypeScript's unknown-mode throw cannot be built in Swift.
                #expect(expected == .object(["$throws": .string("The mode \"\(mode)\" is not available.")]), "\(c.name)")
                continue
            }
            let actual: JSONValue
            do {
                actual = V.encode(try startRound(V.startArgs(start, file)))
            } catch let error as RoundError {
                actual = .object(["$throws": .string(error.message)])
            }
            #expect(actual == expected, "\(c.name)")
        }
    }

    @Test func reduceTraces() throws {
        let file = try Golden.load("src/engine/round", "reduce")
        #expect(!file.cases.isEmpty)
        for c in file.cases {
            let states = try V.replay(c.input, file)
            let expected = try V.array(c.output).map(V.normalized)
            #expect(states.count == expected.count, "\(c.name): one snapshot per event plus the start")
            for (index, (state, snapshot)) in zip(states, expected).enumerated() where V.encode(state) != snapshot {
                Issue.record("\(c.name): state \(index) differs.\nexpected: \(snapshot)\nactual:   \(V.encode(state))")
                break
            }
        }
    }

    // Each reader's file is loaded with two string literals, so task 1's coverage test sees all six.
    private static func readerFile(_ function: String) throws -> GoldenFile {
        switch function {
        case "currentCard": try Golden.load("src/engine/round", "currentCard")
        case "lastAnswer": try Golden.load("src/engine/round", "lastAnswer")
        case "wrongCount": try Golden.load("src/engine/round", "wrongCount")
        case "livesLeft": try Golden.load("src/engine/round", "livesLeft")
        case "isDecided": try Golden.load("src/engine/round", "isDecided")
        default: try Golden.load("src/engine/round", "summarise")
        }
    }

    @Test(arguments: ["currentCard", "lastAnswer", "wrongCount", "livesLeft", "isDecided", "summarise"])
    func stateReaderVectors(function: String) throws {
        let file = try Self.readerFile(function)
        #expect(file.function == function)
        #expect(!file.cases.isEmpty)
        for c in file.cases {
            let states = try V.replay(c.input, file)
            let expected = try V.array(c.output).map(V.normalized)
            #expect(states.count == expected.count, "\(c.name): one value per state")
            for (index, (state, value)) in zip(states, expected).enumerated() {
                let actual = try V.read(file.function, state)
                if actual != value {
                    Issue.record("\(c.name): \(file.function) of state \(index) is \(actual), expected \(value)")
                    break
                }
            }
        }
    }
}
