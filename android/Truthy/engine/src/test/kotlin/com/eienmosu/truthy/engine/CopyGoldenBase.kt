package com.eienmosu.truthy.engine

import kotlinx.serialization.builtins.MapSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.double
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * What the tests of task 6 share: reading a golden value, decoding the round and the result a case describes,
 * and comparing an engine result with a recorded output as JSON (numbers by value, objects by key set).
 * The names of the golden loader (`resolved`, `cases`, `name`, `input`, `output`) appear in this file and in
 * the `Golden.load` calls of the tests, nowhere else.
 */
abstract class CopyGoldenBase {
    protected val wire = Json { ignoreUnknownKeys = true }

    protected fun GoldenFile.resolve(value: JsonElement): JsonElement = resolved(value)

    protected fun GoldenFile.inputOf(name: String): JsonElement =
        (cases.firstOrNull { it.name == name } ?: throw AssertionError("no case named \"$name\"")).input

    protected fun GoldenFile.outputOf(name: String): JsonElement =
        (cases.firstOrNull { it.name == name } ?: throw AssertionError("no case named \"$name\"")).output

    protected fun JsonElement.field(name: String): JsonElement =
        (this as? JsonObject)?.get(name) ?: throw AssertionError("no field \"$name\" in $this")

    protected fun JsonElement.optional(name: String): JsonElement? = (this as? JsonObject)?.get(name)

    protected fun JsonElement.text(): String = jsonPrimitive.content
    protected fun JsonElement.number(): Double = jsonPrimitive.double
    protected fun JsonElement.count(): Int = jsonPrimitive.int
    protected fun JsonElement.flag(): Boolean = jsonPrimitive.boolean
    protected fun JsonElement.countOrNull(): Int? = if (this is JsonNull) null else jsonPrimitive.int
    protected fun JsonElement.list(): List<JsonElement> = jsonArray

    /** This object without the named fields. */
    protected fun JsonElement.without(vararg names: String): JsonElement =
        JsonObject((this as JsonObject).filterKeys { it !in names })

    protected fun cardOf(element: JsonElement): Card = wire.decodeFromJsonElement(Card.serializer(), element)

    protected fun routeOf(element: JsonElement): Route = Route(element.field("deckId").text(), element.field("sectionId").text())

    protected fun modeOf(name: String): Mode = Mode.entries.first { it.wire == name }

    protected fun historyOf(element: JsonElement): History =
        wire.decodeFromJsonElement(MapSerializer(String.serializer(), CardHistory.serializer()), element)

    protected fun startArgsOf(element: JsonElement): StartArgs = StartArgs(
        mode = modeOf(element.field("mode").text()),
        route = routeOf(element.field("route")),
        pool = element.field("pool").list().map { cardOf(it) },
        history = historyOf(element.field("history")),
        seed = element.field("seed").number(),
    )

    protected fun eventOf(element: JsonElement): RoundEvent = when (val type = element.field("type").text()) {
        "answer" -> RoundEvent.Answer(element.field("value").flag(), element.field("at").number())
        "next" -> RoundEvent.Next
        "tick" -> RoundEvent.Tick(element.field("now").number())
        "visibility" -> RoundEvent.Visibility(element.field("hidden").flag(), element.field("at").number())
        "abandon" -> RoundEvent.Abandon
        else -> throw AssertionError("unknown event type $type")
    }

    protected fun answeredOf(element: JsonElement): Answered = Answered(
        card = cardOf(element.field("card")),
        given = element.field("given").flag(),
        correct = element.field("correct").flag(),
        at = element.field("at").number(),
    )

    protected fun resultOf(element: JsonElement): RoundResult = RoundResult(
        mode = modeOf(element.field("mode").text()),
        route = routeOf(element.field("route")),
        score = element.field("score").count(),
        total = element.field("total").count(),
        answers = element.field("answers").list().map { answeredOf(it) },
        missed = element.field("missed").list().map { answeredOf(it) },
        abandoned = element.field("abandoned").flag(),
    )

    /** The round a case input of the form {start, events} builds: startRound, then every event in order. */
    protected fun replay(file: GoldenFile, input: JsonElement): RoundState {
        val trace = file.resolve(input)
        var state = startRound(startArgsOf(trace.field("start")))
        for (item in trace.field("events").list()) state = reduce(state, eventOf(item))
        return state
    }

    /** Stored progress as the vectors write it: the JSON the progress key holds; null means nothing stored. */
    protected fun progressOf(element: JsonElement): Progress =
        if (element is JsonNull) emptyProgress() else readProgress(element.toString()).progress

    /** A Kotlin value as JSON: null, String, Boolean, Number, List, Map with String keys, or a JsonElement. */
    protected fun json(value: Any?): JsonElement = when (value) {
        null -> JsonNull
        is JsonElement -> value
        is String -> JsonPrimitive(value)
        is Boolean -> JsonPrimitive(value)
        is Number -> JsonPrimitive(value)
        is List<*> -> JsonArray(value.map { json(it) })
        is Map<*, *> -> JsonObject(value.entries.associate { (key, item) -> (key as String) to json(item) })
        else -> throw IllegalArgumentException("cannot write ${value::class} as JSON")
    }

    protected fun assertSameJson(expected: JsonElement, actual: JsonElement, where: String) {
        when {
            expected is JsonNull || actual is JsonNull ->
                assertTrue(expected is JsonNull && actual is JsonNull, "$where: expected $expected but was $actual")
            expected is JsonObject && actual is JsonObject -> {
                assertEquals(expected.keys, actual.keys, "$where: keys")
                for ((key, item) in expected) assertSameJson(item, actual.getValue(key), "$where.$key")
            }
            expected is JsonArray && actual is JsonArray -> {
                assertEquals(expected.size, actual.size, "$where: length")
                for (i in expected.indices) assertSameJson(expected[i], actual[i], "$where[$i]")
            }
            expected is JsonPrimitive && actual is JsonPrimitive -> samePrimitive(expected, actual, where)
            else -> throw AssertionError("$where: expected $expected but was $actual")
        }
    }

    private fun samePrimitive(expected: JsonPrimitive, actual: JsonPrimitive, where: String) {
        assertEquals(expected.isString, actual.isString, "$where: a string against a non-string ($expected and $actual)")
        if (expected.isString) {
            assertEquals(expected.content, actual.content, where)
            return
        }
        val e = expected.content
        val a = actual.content
        if (e == "true" || e == "false" || a == "true" || a == "false") {
            assertEquals(e, a, where)
            return
        }
        val x = e.toDouble()
        val y = a.toDouble()
        assertTrue(x == y, "$where: expected $e but was $a")
    }
}
