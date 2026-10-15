package com.eienmosu.truthy.engine

import kotlin.test.fail
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

// Reads the round's golden vectors (plan A, "The golden vector format") from the raw JSON of a case, and turns
// round values and expected outputs into the same plain views, so one assertEquals compares a whole snapshot.
// Numbers become doubles and are compared exactly: an expected 59650 and an actual 59650.0 are equal views.
object RoundVectors {
    data class AnswerView(val card: String, val given: Boolean, val correct: Boolean, val at: Double)

    data class StateView(
        val mode: String,
        val route: Route,
        val cards: List<String>,
        val index: Int,
        val answers: List<AnswerView>,
        val phase: String,
        val abandoned: Boolean,
        val chunks: Int,
        val clock: Clock?,
    )

    data class ResultView(
        val mode: String,
        val route: Route,
        val score: Int,
        val total: Int,
        val answers: List<AnswerView>,
        val missed: List<AnswerView>,
        val abandoned: Boolean,
    )

    // The TypeScript's undefined, which a vector writes as {"$undefined": true}.
    data object Undefined

    fun obj(value: JsonElement): JsonObject = value as? JsonObject ?: fail("expected an object, got $value")

    fun array(value: JsonElement): JsonArray = value as? JsonArray ?: fail("expected an array, got $value")

    fun field(fields: JsonObject, key: String): JsonElement = fields[key] ?: fail("missing key $key in $fields")

    private fun primitive(value: JsonElement): JsonPrimitive =
        (value as? JsonPrimitive)?.takeIf { it !is JsonNull } ?: fail("expected a primitive, got $value")

    fun string(value: JsonElement): String =
        primitive(value).takeIf { it.isString }?.content ?: fail("expected a string, got $value")

    fun bool(value: JsonElement): Boolean =
        primitive(value).takeIf { !it.isString }?.content?.toBooleanStrictOrNull() ?: fail("expected a boolean, got $value")

    // A plain number, or one of the tagged numbers JSON cannot carry.
    fun number(value: JsonElement): Double {
        if (value is JsonObject) {
            return when (val name = string(field(value, "\$number"))) {
                "NaN" -> Double.NaN
                "Infinity" -> Double.POSITIVE_INFINITY
                "-Infinity" -> Double.NEGATIVE_INFINITY
                "-0" -> -0.0
                else -> fail("unknown tagged number $name")
            }
        }
        val p = primitive(value)
        if (p.isString) fail("expected a number, got $value")
        return p.content.toDoubleOrNull() ?: fail("expected a number, got $value")
    }

    fun int(value: JsonElement): Int {
        val n = number(value)
        val whole = n.toInt()
        if (whole.toDouble() != n) fail("expected an integer, got $n")
        return whole
    }

    // The file's card table, decoded with the engine's own serializer; every entry must hold its own id.
    fun cardTable(raw: Map<String, JsonElement>): Map<String, Card> = raw.mapValues { (id, element) ->
        val decoded = Json.decodeFromJsonElement(Card.serializer(), element)
        if (decoded.id != id) fail("the card table entry $id holds the card ${decoded.id}")
        decoded
    }

    fun ref(value: JsonElement): String = string(field(obj(value), "\$card"))

    // A {"$card": id} reference, looked up in the file's card table. Round vectors use the web tests' own cards,
    // never a whole shipped deck.
    fun card(value: JsonElement, cards: Map<String, Card>): Card {
        val id = ref(value)
        return cards[id] ?: fail("card $id is not in the card table")
    }

    fun isUndefined(value: JsonElement): Boolean = value is JsonObject && value.size == 1 && value.containsKey("\$undefined")

    fun throwsMessage(value: JsonElement): String? =
        (value as? JsonObject)?.takeIf { it.size == 1 }?.get("\$throws")?.let { string(it) }

    fun mode(name: String): Mode? = Mode.entries.firstOrNull { it.wire == name }

    fun route(value: JsonElement): Route {
        val f = obj(value)
        return Route(deckId = string(field(f, "deckId")), sectionId = string(field(f, "sectionId")))
    }

    fun history(value: JsonElement): History = obj(value).mapValues { (_, entry) ->
        val f = obj(entry)
        CardHistory(seen = int(field(f, "seen")).toLong(), lastCorrect = bool(field(f, "lastCorrect")), lastSeenAt = number(field(f, "lastSeenAt")))
    }

    fun startArgs(value: JsonElement, cards: Map<String, Card>): StartArgs {
        val f = obj(value)
        val name = string(field(f, "mode"))
        return StartArgs(
            mode = mode(name) ?: fail("unknown mode $name"),
            route = route(field(f, "route")),
            pool = array(field(f, "pool")).map { card(it, cards) },
            history = history(field(f, "history")),
            seed = number(field(f, "seed")),
        )
    }

    fun roundEvent(value: JsonElement): RoundEvent {
        val f = obj(value)
        return when (val type = string(field(f, "type"))) {
            "answer" -> RoundEvent.Answer(value = bool(field(f, "value")), at = number(field(f, "at")))
            "next" -> RoundEvent.Next
            "tick" -> RoundEvent.Tick(now = number(field(f, "now")))
            "visibility" -> RoundEvent.Visibility(hidden = bool(field(f, "hidden")), at = number(field(f, "at")))
            "abandon" -> RoundEvent.Abandon
            else -> fail("unknown event type $type")
        }
    }

    fun answered(value: JsonElement, cards: Map<String, Card>): Answered {
        val f = obj(value)
        return Answered(
            card = card(field(f, "card"), cards),
            given = bool(field(f, "given")),
            correct = bool(field(f, "correct")),
            at = number(field(f, "at")),
        )
    }

    // A trace: the state startRound returned, then the state after each event.
    fun replay(input: JsonElement, cards: Map<String, Card>): List<RoundState> {
        val f = obj(input)
        var state = startRound(startArgs(field(f, "start"), cards))
        val states = mutableListOf(state)
        for (raw in array(field(f, "events"))) {
            state = reduce(state, roundEvent(raw))
            states += state
        }
        return states
    }

    fun view(answer: Answered): AnswerView =
        AnswerView(card = answer.card.id, given = answer.given, correct = answer.correct, at = answer.at)

    fun view(state: RoundState): StateView = StateView(
        mode = state.mode.wire,
        route = state.route,
        cards = state.cards.map { it.id },
        index = state.index,
        answers = state.answers.map { view(it) },
        phase = state.phase.wire,
        abandoned = state.abandoned,
        chunks = state.source.chunks,
        clock = state.clock,
    )

    fun view(result: RoundResult): ResultView = ResultView(
        mode = result.mode.wire,
        route = result.route,
        score = result.score,
        total = result.total,
        answers = result.answers.map { view(it) },
        missed = result.missed.map { view(it) },
        abandoned = result.abandoned,
    )

    fun expectedAnswer(value: JsonElement): AnswerView {
        val f = obj(value)
        return AnswerView(
            card = ref(field(f, "card")),
            given = bool(field(f, "given")),
            correct = bool(field(f, "correct")),
            at = number(field(f, "at")),
        )
    }

    fun expectedClock(value: JsonElement): Clock? {
        if (value is JsonNull) return null
        val f = obj(value)
        val lastTick = field(f, "lastTick")
        return Clock(
            remainingMs = number(field(f, "remainingMs")),
            lastTick = if (lastTick is JsonNull) null else number(lastTick),
            hidden = bool(field(f, "hidden")),
            holdMs = number(field(f, "holdMs")),
        )
    }

    // The snapshot of plan A's format: the state's own fields, with source replaced by its chunk count.
    fun expectedState(value: JsonElement): StateView {
        val f = obj(value)
        return StateView(
            mode = string(field(f, "mode")),
            route = route(field(f, "route")),
            cards = array(field(f, "cards")).map { ref(it) },
            index = int(field(f, "index")),
            answers = array(field(f, "answers")).map { expectedAnswer(it) },
            phase = string(field(f, "phase")),
            abandoned = bool(field(f, "abandoned")),
            chunks = int(field(f, "chunks")),
            clock = expectedClock(field(f, "clock")),
        )
    }

    fun expectedResult(value: JsonElement): ResultView {
        val f = obj(value)
        return ResultView(
            mode = string(field(f, "mode")),
            route = route(field(f, "route")),
            score = int(field(f, "score")),
            total = int(field(f, "total")),
            answers = array(field(f, "answers")).map { expectedAnswer(it) },
            missed = array(field(f, "missed")).map { expectedAnswer(it) },
            abandoned = bool(field(f, "abandoned")),
        )
    }

    // What a state reader returns, as a view; Undefined is the TypeScript's undefined.
    fun read(function: String, state: RoundState): Any = when (function) {
        "currentCard" -> currentCard(state)?.id ?: Undefined
        "lastAnswer" -> lastAnswer(state)?.let { view(it) } ?: Undefined
        "wrongCount" -> wrongCount(state)
        "livesLeft" -> livesLeft(state)
        "isDecided" -> isDecided(state)
        "summarise" -> view(summarise(state))
        else -> fail("no reader named $function")
    }

    fun expectedRead(function: String, value: JsonElement): Any = when {
        isUndefined(value) -> Undefined
        function == "currentCard" -> ref(value)
        function == "lastAnswer" -> expectedAnswer(value)
        function == "wrongCount" || function == "livesLeft" -> int(value)
        function == "isDecided" -> bool(value)
        function == "summarise" -> expectedResult(value)
        else -> fail("no reader named $function")
    }
}
