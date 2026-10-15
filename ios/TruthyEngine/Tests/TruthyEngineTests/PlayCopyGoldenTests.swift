import Foundation
import Testing
@testable import TruthyEngine

// native-data/golden vectors of components/play/PlayScreen.tsx and components/play/leave.ts. A round is the trace
// that builds it, replayed with the engine (task 3's RoundVectors).
private typealias G = ProgressGolden

func roundOf(_ input: GoldenValue, _ file: GoldenFile) throws -> RoundState {
    try #require(try RoundVectors.replay(input, file).last)
}

/// A store over memory with what the vector says is stored, or one whose every write throws.
func vectorStore(_ input: GoldenValue) throws -> (store: LocalStore, storage: CountingStorage) {
    let storage = CountingStorage()
    if let progress = input["progress"], progress != .null {
        storage.items[PROGRESS_KEY] = String(decoding: try JSONEncoder().encode(progress), as: UTF8.self)
    }
    storage.full = input["storage"] == .string("full")
    return (createLocalStore(storage), storage)
}

/// What the progress key holds, read back as progress, or nil when nothing was written.
func storedProgress(_ storage: CountingStorage) -> TruthyEngine.Progress? {
    storage.items[PROGRESS_KEY].map { parseProgress($0) }
}

@Suite struct PlayCopyGoldenTests {
    @Test func verdictTextCases() throws {
        let file = try Golden.load("components/play/PlayScreen", "verdictText")
        for c in file.cases {
            let text = verdictText(
                try G.required(c.input, "correct").bool(), try G.required(c.input, "answer").bool(), try c.input["newBest"]?.bool() ?? false)
            #expect(text == (try c.output.string()), "\(c.name)")
        }
    }

    @Test func roundStatusCases() throws {
        let file = try Golden.load("components/play/PlayScreen", "roundStatus")
        for c in file.cases { #expect(roundStatus(try roundOf(c.input, file)) == (try c.output.string()), "\(c.name)") }
    }

    @Test func timedStatusCases() throws {
        let file = try Golden.load("components/play/PlayScreen", "timedStatus")
        for c in file.cases { #expect(timedStatus(try roundOf(c.input, file)) == (try c.output.string()), "\(c.name)") }
    }

    @Test func timedCardTextCases() throws {
        let file = try Golden.load("components/play/PlayScreen", "timedCardText")
        for c in file.cases { #expect(timedCardText(try roundOf(c.input, file)) == (try c.output.string()), "\(c.name)") }
    }

    @Test func guardTimes() throws {
        #expect(try Golden.load("components/play/PlayScreen", "NEXT_ARRIVES_MS").cases[0].output.number() == NEXT_ARRIVES_MS)
        #expect(try Golden.load("components/play/PlayScreen", "SPOKEN_RELEASE_MS").cases[0].output.number() == SPOKEN_RELEASE_MS)
        #expect(try Golden.load("components/play/ResultView", "RESULT_ARRIVES_MS").cases[0].output.number() == RESULT_ARRIVES_MS)
        #expect(try Golden.load("components/play/ticketScroll", "ARROW_STEP").cases[0].output.number() == ARROW_STEP)
    }

    @Test func leavesSomethingCases() throws {
        let file = try Golden.load("components/play/leave", "leavesSomething")
        for c in file.cases { #expect(leavesSomething(try roundOf(c.input, file)) == (try c.output.bool()), "\(c.name)") }
    }

    @Test func saveLeftRoundCases() throws {
        let file = try Golden.load("components/play/leave", "saveLeftRound")
        for c in file.cases {
            let (store, storage) = try vectorStore(c.input)
            saveLeftRound(try roundOf(c.input, file), store)
            let expected = try G.required(c.output, "stored")
            if expected == .null {
                #expect(storage.items[PROGRESS_KEY] == nil, "\(c.name): nothing stored")
            } else {
                let stored = try #require(storedProgress(storage), "\(c.name): stored")
                #expect(G.exactly(stored, try G.progress(expected)), "\(c.name)")
            }
        }
    }
}
