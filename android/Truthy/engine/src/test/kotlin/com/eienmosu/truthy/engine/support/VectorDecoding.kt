package com.eienmosu.truthy.engine.support

import com.eienmosu.truthy.engine.DeckIndex
import com.eienmosu.truthy.engine.Golden
import com.eienmosu.truthy.engine.Mode
import com.eienmosu.truthy.engine.Progress
import com.eienmosu.truthy.engine.Route
import kotlin.test.assertEquals
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.double
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

// Reading the plan A vectors of the content, class table, catalog, start flow, list cue and label functions.
// A vector holds plain JSON; these helpers turn the parts a test needs into engine values.

fun JsonElement.field(name: String): JsonElement = jsonObject.getValue(name)

/** The member of an object, or null when the key is absent or holds JSON null. */
fun JsonObject.optionalField(name: String): JsonElement? = this[name]?.takeIf { it !is JsonNull }

fun JsonObject.optionalString(name: String): String? = optionalField(name)?.jsonPrimitive?.content

fun JsonElement.asString(): String = jsonPrimitive.content

fun JsonElement.asInt(): Int = jsonPrimitive.int

fun JsonElement.asDouble(): Double = jsonPrimitive.double

fun JsonElement.asBoolean(): Boolean = jsonPrimitive.boolean

/** An output of the form {"$undefined": true}: the TypeScript function answered undefined. */
fun isUndefined(output: JsonElement): Boolean = output is JsonObject && output.containsKey("\$undefined")

/** An output of the form {"$throws": "message"}: the message, or null for any other output. */
fun thrownMessage(output: JsonElement): String? = (output as? JsonObject)?.get("\$throws")?.jsonPrimitive?.content

fun modeOrNull(wire: String): Mode? = Mode.entries.firstOrNull { it.wire == wire }

fun modeOf(wire: String): Mode = modeOrNull(wire) ?: error("no class named $wire")

// Golden.json (task 1) allows Infinity, NaN and -0, which resolved {"$number": ...} tags become; the default Json would refuse them.
fun decodeIndex(value: JsonElement): DeckIndex = Golden.json.decodeFromJsonElement(DeckIndex.serializer(), value)

fun decodeProgress(value: JsonElement): Progress = Golden.json.decodeFromJsonElement(Progress.serializer(), value)

fun decodeRoute(value: JsonElement): Route = Route(value.field("deckId").asString(), value.field("sectionId").asString())

/** A vector file keeps every case it was written with: the count is part of the contract. */
fun <T> expectCases(cases: List<T>, count: Int) {
    assertEquals(count, cases.size, "the number of cases in the vector file")
}
