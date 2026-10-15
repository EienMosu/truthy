package com.eienmosu.truthy.engine

import kotlinx.serialization.json.Json

// The fixtures of the web's round tests (tests/engine/round.test.ts, modes.test.ts, timed.test.ts and
// clock-polish.test.ts). The round test classes extend this class, so these names never clash with the
// helpers of other test files.
abstract class RoundTesting {
    val route: Route = Route(deckId = "aws-clf-c02", sectionId = "CON")

    // The web tests' wall-clock origin, in epoch milliseconds.
    val T0: Double = 1_700_000_000_000.0

    val NEXT: RoundEvent = RoundEvent.Next
    val ABANDON: RoundEvent = RoundEvent.Abandon

    // c1, c3, c5 and so on are True, c2, c4 and so on False. Decoded from the shipped card shape.
    fun card(id: String, answer: Boolean): Card = Json.decodeFromString(
        Card.serializer(),
        """
        {"id": "$id", "section": "CON",
         "text": {"en": {"statement": "Statement $id", "explanation": "Explanation $id"}},
         "answer": $answer, "source": {"title": "AWS documentation", "url": "https://docs.aws.amazon.com/"},
         "difficulty": 1, "appliesTo": "", "conflictGroups": []}
        """,
    )

    fun pool(n: Int): List<Card> = List(n) { i -> card("c${i + 1}", i % 2 == 0) }

    fun start(
        mode: Mode = Mode.CLASSIC,
        size: Int = 40,
        seed: Double = 1.0,
        history: History = emptyMap(),
        cards: List<Card>? = null,
    ): RoundState = startRound(StartArgs(mode = mode, route = route, pool = cards ?: pool(size), history = history, seed = seed))

    fun play(state: RoundState, events: List<RoundEvent>): RoundState = events.fold(state) { s, e -> reduce(s, e) }

    fun play(state: RoundState, vararg events: RoundEvent): RoundState = play(state, events.toList())

    fun answer(value: Boolean, at: Double = 1000.0): RoundEvent = RoundEvent.Answer(value = value, at = at)

    fun tick(now: Double): RoundEvent = RoundEvent.Tick(now = now)

    fun hide(at: Double): RoundEvent = RoundEvent.Visibility(hidden = true, at = at)

    fun show(at: Double): RoundEvent = RoundEvent.Visibility(hidden = false, at = at)

    // Answers the card on screen right or wrong (no next).
    fun give(state: RoundState, right: Boolean, at: Double = 1000.0): RoundState {
        val truth = currentCard(state)?.answer ?: true
        return play(state, answer(if (right) truth else !truth, at))
    }

    // Answers the card on screen right, then next.
    fun answerRight(state: RoundState, at: Double = 1000.0): List<RoundEvent> =
        listOf(answer(currentCard(state)?.answer ?: true, at), NEXT)

    // Answers `count` cards right, pressing next after each.
    fun rightTimes(state: RoundState, count: Int): RoundState {
        var s = state
        repeat(count) { s = play(give(s, true), NEXT) }
        return s
    }

    // Ticks every `step` ms from `from` (exclusive) to `to` (inclusive).
    fun ticks(from: Double, to: Double, step: Double = 100.0): List<RoundEvent> {
        val events = mutableListOf<RoundEvent>()
        var now = from + step
        while (now <= to) {
            events += tick(now)
            now += step
        }
        return events
    }

    // A Timed round of a 40-card pool whose clock the first tick at T0 has started.
    fun timed(size: Int = 40, seed: Double = 1.0): RoundState = play(start(Mode.TIMED, size = size, seed = seed), tick(T0))

    // The clock one tick before zero, on the first card, nothing answered.
    fun nearlyUp(): RoundState = play(timed(), ticks(T0, T0 + 59_900))

    fun ids(cards: List<Card>): List<String> = cards.map { it.id }
}
