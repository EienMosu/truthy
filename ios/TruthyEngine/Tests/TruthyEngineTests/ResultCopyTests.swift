import Testing
@testable import TruthyEngine

// tests/components/play/resultCopy.test.ts, ResultView.test.tsx (recording) and tests/components/MissedCards.test.tsx.
private func answered(_ card: Card, _ correct: Bool, _ at: Double) -> Answered {
    Answered(card: card, given: correct == card.answer, correct: correct, at: at)
}

@Suite struct ResultCopyTests: RoundTesting {
    private func result(_ mode: Mode, _ verdicts: [Bool]) -> RoundResult {
        let answers = verdicts.enumerated().map { answered(card("c\($0.offset + 1)", $0.offset % 2 == 0), $0.element, Double(1000 + $0.offset)) }
        return RoundResult(mode: mode, route: route, score: scoreOf(mode, answers), total: answers.count, answers: answers,
                           missed: answers.filter { !$0.correct }, abandoned: false)
    }

    @Test func classicCountsOfTheCardsDealt() {
        let copy = resultCopy(result(.classic, [true, true, false, true, true, false, true, true, false, true]), "Classic", 10, nil)
        #expect(copy.fields == [ResultField(label: "Class", value: "Classic"), ResultField(label: "Cards", value: "10 / 10"), ResultField(label: "Wrong", value: "03")])
        #expect(copy.scoreLabel == "Your score" && copy.unit == "of 10" && copy.best(9) == "9 / 10")
        #expect(copy.ended == "Arrived" && copy.endedDetail == " · 10 of 10" && copy.marks == 10 && copy.ring == nil)
        #expect(copy.label == "Round complete. 10 of 10 cards. 7 correct, 3 wrong: cards 3, 6 and 9.")
    }

    @Test func streakRingsThePreviousBestItReached() {
        let copy = resultCopy(result(.streak, [true, true, true, false]), "Streak", 10, 2)
        #expect(copy.fields[1] == ResultField(label: "Cards", value: "04"))
        #expect(copy.scoreLabel == "Correct in a row" && copy.unit == nil && copy.best(12) == "12")
        #expect(copy.label == "Streak over on card 4. 3 correct in a row. Card 4 was wrong.")
        #expect(copy.endedDetail == " · 4 cards" && copy.ring == 1)
        #expect(resultCopy(result(.streak, [true, true, false]), "Streak", 10, 2).ring == 1)
        #expect(resultCopy(result(.streak, [true, false]), "Streak", 10, 5).ring == nil)
        #expect(resultCopy(result(.streak, [true, false]), "Streak", 10, 0).ring == nil)
    }

    @Test func livesAndTimedSayTheirOwnEnds() {
        let lives = resultCopy(result(.lives, [true, false, true, false, false]), "Three lives", 10, nil)
        #expect(lives.fields[1] == ResultField(label: "Correct", value: "02") && lives.unit == "cards" && lives.best(21) == "21 cards")
        #expect(lives.label == "Out of lives after 5 cards. 2 correct, 3 wrong: cards 2, 4 and 5.")
        #expect(lives.ended == "Out of lives" && lives.endedDetail == "")
        let timed = resultCopy(result(.timed, [true]), "Timed", 1, nil)
        #expect(timed.fields == [ResultField(label: "Class", value: "Timed"), ResultField(label: "Time", value: "60 s"), ResultField(label: "Answered", value: "01")])
        #expect(timed.label == "Time is up. 1 card answered in 60 seconds. 1 correct, 0 wrong.")
        #expect(timed.unit == "of 1" && timed.endedDetail == " · 1 card")
        #expect(RESULT_ARRIVES_MS == 1000)
    }

    @Test func aRoundIsRecordedOnceHoweverOftenItIsShown() throws {
        var round = try start(.classic, size: 10)
        for i in 0..<10 { round = play(give(round, true, at: Double(1000 + i)), [.next]) }
        #expect(round.phase == .finished)
        let storage = CountingStorage()
        let store = createLocalStore(storage)
        let recorded = RecordedRounds()
        let first = recordRound(round, store, recorded)
        let second = recordRound(round, store, recorded)
        #expect(first == second)
        #expect(storage.writes == 1)
        #expect(first.isNewBest && first.previousBest == nil)
        #expect(parseProgress(storage.items[PROGRESS_KEY]).records[recordKey(route, .classic)] == 10)
    }

    @Test func theMissedListNumbersTheWrongAnswersByPlace() {
        let a = card("c1", true)
        var applied = card("c2", false)
        applied = Card(id: applied.id, section: applied.section, text: applied.text, answer: false, source: applied.source,
                       difficulty: 1, appliesTo: "Angular v22", conflictGroups: [])
        let missed = missedCards([answered(a, true, 1), answered(applied, false, 2), answered(a, false, 3)])
        #expect(missed.map(\.number) == [2, 3])
        #expect(missed[0].appliesTo == "Angular v22" && missed[1].appliesTo == nil)
        #expect(missed[0].given == true && missed[0].answer == false)
        #expect(missedCards([]).isEmpty)
    }
}
