import Testing
@testable import TruthyEngine

// native-data/golden vectors of resultCopy, recordRound, missedCards and ticketFor.
private typealias G = ProgressGolden

@Suite struct ResultGoldenTests {
    @Test func resultCopyCases() throws {
        let file = try Golden.load("components/play/resultCopy", "resultCopy")
        for c in file.cases {
            let previous = try G.optionalInt(G.required(c.input, "previousBest"))
            let copy = resultCopy(
                try G.roundResult(file, G.required(c.input, "result")), try G.required(c.input, "modeName").string(),
                try G.required(c.input, "dealt").int(), previous)
            let fields = try G.required(c.output, "fields").array().map {
                ResultField(label: try G.required($0, "label").string(), value: try G.required($0, "value").string())
            }
            #expect(copy.fields == fields, "\(c.name): fields")
            #expect(copy.scoreLabel == (try G.required(c.output, "scoreLabel").string()), "\(c.name): scoreLabel")
            #expect(copy.unit == (try c.output["unit"]?.string()), "\(c.name): unit")
            #expect(copy.ended == (try G.required(c.output, "ended").string()), "\(c.name): ended")
            #expect(copy.endedDetail == (try G.required(c.output, "endedDetail").string()), "\(c.name): endedDetail")
            #expect(copy.label == (try G.required(c.output, "label").string()), "\(c.name): label")
            #expect(copy.marks == (try G.required(c.output, "marks").int()), "\(c.name): marks")
            #expect(copy.ring == (try c.output["ring"]?.int()), "\(c.name): ring")
            guard case .object(let best) = try G.required(c.output, "best") else { throw GoldenError(description: "\(c.name): best") }
            for (record, text) in best {
                #expect(copy.best(try #require(Int(record))) == (try text.string()), "\(c.name): best(\(record))")
            }
        }
    }

    @Test func recordRoundCases() throws {
        let file = try Golden.load("components/play/ResultView", "recordRound")
        for c in file.cases {
            let (store, storage) = try vectorStore(c.input)
            let round = try roundOf(c.input, file)
            let recorded = RecordedRounds()
            let outcomes = (0..<(try G.required(c.input, "calls").int())).map { _ in recordRound(round, store, recorded) }
            let expected = try G.required(c.output, "outcome")
            #expect(storage.writes == (try G.required(c.output, "writes").int()), "\(c.name): writes")
            #expect(outcomes.allSatisfy { $0 == outcomes[0] } == (try G.required(c.output, "sameOutcome").bool()), "\(c.name): same")
            #expect(G.exactly(outcomes[0].progress, try G.progress(G.required(expected, "progress"))), "\(c.name): outcome progress")
            #expect(outcomes[0].previousBest == (try G.optionalInt(G.required(expected, "previousBest"))), "\(c.name): previousBest")
            #expect(outcomes[0].isNewBest == (try G.required(expected, "isNewBest").bool()), "\(c.name): isNewBest")
            let stored = try G.required(c.output, "stored")
            if stored != .null { #expect(G.exactly(try #require(storedProgress(storage)), try G.progress(stored)), "\(c.name): stored") }
        }
    }

    private struct MissedVector: Decodable {
        let number: Int
        let given: Bool
        let answer: Bool
        let appliesTo: String?
        let statement: String
        let explanation: String
        let source: CardSource
    }

    @Test func missedCardsCases() throws {
        let file = try Golden.load("components/MissedCards", "missedCards")
        for c in file.cases {
            let answers = try G.required(c.input, "answers").array().map { try G.answered(file, $0) }
            let expected = try file.decode([MissedVector].self, c.output).map {
                MissedCard(number: $0.number, given: $0.given, answer: $0.answer, appliesTo: $0.appliesTo, statement: $0.statement,
                           explanation: $0.explanation, source: $0.source)
            }
            #expect(missedCards(answers) == expected, "\(c.name)")
        }
    }

    @Test func ticketForCases() throws {
        let file = try Golden.load("components/play/useRound", "ticketFor")
        for c in file.cases {
            let found = try G.required(c.input, "found")
            let section = try G.required(found, "section")
            let info = ticketFor(
                RouteInIndex(
                    area: try file.decode(IndexArea.self, G.required(found, "area")),
                    platform: try file.decode(IndexPlatform.self, G.required(found, "platform")),
                    deck: try file.decode(IndexDeck.self, G.required(found, "deck")),
                    section: section == .null ? nil : try file.decode(IndexSection.self, section)),
                try G.mode(G.required(c.input, "mode")), try G.optionalInt(G.required(c.input, "best")))
            let expected = TicketInfo(
                deckCode: try G.required(c.output, "deckCode").string(), deckName: try G.required(c.output, "deckName").string(),
                sectionCode: try G.required(c.output, "sectionCode").string(), sectionName: try G.required(c.output, "sectionName").string(),
                modeLabel: try G.required(c.output, "modeLabel").string(), best: try G.optionalInt(G.required(c.output, "best")))
            #expect(info == expected, "\(c.name)")
        }
    }
}
