// Reads native-data/golden, the vectors plan A computes by running the TypeScript code. The format is plan A's
// "The golden vector format": one file per function or constant, a card table, tagged values. Test support
// only: the engine itself never reads a file.
package com.eienmosu.truthy.engine

import java.io.File
import kotlinx.serialization.DeserializationStrategy
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.double
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.serializer

class GoldenException(message: String) : Exception(message)

/** The tag keys of plan A's format. Kotlin reads `$card` in a string as a template, hence the escapes. */
const val CARD_TAG = "\$card"
const val DECK_TAG = "\$deck"
const val RNG_TAG = "\$rng"
const val NUMBER_TAG = "\$number"
const val UNDEFINED_TAG = "\$undefined"
const val THROWS_TAG = "\$throws"

/** The single key of an object such as {"$card": "id"}, with its value, or null for anything else. */
fun tagOf(value: JsonElement): Pair<String, JsonElement>? {
    if (value !is JsonObject || value.size != 1) return null
    val (key, inner) = value.entries.first()
    return if (key.startsWith("$")) key to inner else null
}

private fun stringOf(value: JsonElement): String? = (value as? JsonPrimitive)?.takeIf { it.isString }?.content

class GoldenCase(val name: String, val input: JsonElement, val output: JsonElement) {
    /** The message of an output written as {"$throws": message}, or null when the case returns a value. */
    val throwsMessage: String?
        get() = tagOf(output)?.takeIf { it.first == THROWS_TAG }?.let { stringOf(it.second) }

    /** The member `key` of the input object, or null when the input has no such key. */
    fun arg(key: String): JsonElement? = (input as? JsonObject)?.get(key)
}

class GoldenFile(
    val format: Int,
    val module: String,
    val function: String,
    val source: String,
    val tests: List<String>,
    val cards: Map<String, JsonElement>,
    val cases: List<GoldenCase>,
) {
    /**
     * `value` with its tags resolved: {"$card": id} becomes the card of the table, {"$deck": id} the cards of
     * native-data/decks/<id>.json (read from `decks`), {"$number": ...} the double it names, and
     * {"$undefined": true} is left out of an object (JSON null anywhere else). {"$rng": ...} and {"$throws": ...} stay.
     */
    fun resolved(value: JsonElement, decks: File = Golden.decksDirectory): JsonElement {
        val tag = tagOf(value)
        if (tag != null) {
            val (key, inner) = tag
            return when (key) {
                CARD_TAG -> {
                    val id = stringOf(inner) ?: throw GoldenException("malformed $CARD_TAG tag: $inner")
                    resolved(cards[id] ?: throw GoldenException("card \"$id\" is not in the file's card table"), decks)
                }
                DECK_TAG -> {
                    val id = stringOf(inner) ?: throw GoldenException("malformed $DECK_TAG tag: $inner")
                    Golden.json.parseToJsonElement(decks.resolve("$id.json").readText()).jsonObject["cards"]
                        ?: throw GoldenException("deck $id has no cards")
                }
                NUMBER_TAG -> when (stringOf(inner)) {
                    "Infinity" -> JsonPrimitive(Double.POSITIVE_INFINITY)
                    "-Infinity" -> JsonPrimitive(Double.NEGATIVE_INFINITY)
                    "NaN" -> JsonPrimitive(Double.NaN)
                    "-0" -> JsonPrimitive(-0.0)
                    else -> throw GoldenException("malformed $NUMBER_TAG tag: $inner")
                }
                UNDEFINED_TAG -> JsonNull
                else -> value
            }
        }
        return when (value) {
            is JsonArray -> JsonArray(value.map { resolved(it, decks) })
            is JsonObject -> JsonObject(value.filterValues { !Golden.isUndefined(it) }.mapValues { resolved(it.value, decks) })
            else -> value
        }
    }

    /** `value`, resolved, decoded with `deserializer`. Infinity, NaN and -0 survive (allowSpecialFloatingPointValues). */
    fun <T> decode(deserializer: DeserializationStrategy<T>, value: JsonElement, decks: File = Golden.decksDirectory): T =
        Golden.json.decodeFromJsonElement(deserializer, resolved(value, decks))

    inline fun <reified T> decode(value: JsonElement, decks: File = Golden.decksDirectory): T = decode(serializer<T>(), value, decks)

    /** One card: a {"$card": id} reference or a card object. */
    fun card(value: JsonElement, decks: File = Golden.decksDirectory): Card = decode(Card.serializer(), value, decks)

    /** A list of cards: an array of references or cards, or {"$deck": id}. */
    fun cards(value: JsonElement, decks: File = Golden.decksDirectory): List<Card> =
        decode(ListSerializer(Card.serializer()), value, decks)

    /**
     * The generator an rng argument stands for: {"$rng": {"seed": n}} is createRng(n); {"$rng": {"values": [...]}}
     * returns the values in order and fails the test when they run out.
     */
    fun rng(value: JsonElement): Rng {
        val tag = tagOf(value)
        if (tag == null || tag.first != RNG_TAG) throw GoldenException("not an rng argument: $value")
        val spec = tag.second as? JsonObject ?: throw GoldenException("not an rng argument: $value")
        val seed = spec["seed"]
        if (seed != null) return createRng(seed.jsonPrimitive.double)
        val values = (spec["values"] as? JsonArray)?.map { it.jsonPrimitive.double }
            ?: throw GoldenException("not an rng argument: $value")
        var next = 0
        return {
            if (next >= values.size) throw AssertionError("the rng ran out after ${values.size} values")
            values[next++]
        }
    }
}

object Golden {
    /** Set by the :engine test task from the project directory (engine/build.gradle.kts). */
    private fun property(name: String): File =
        File(System.getProperty(name) ?: throw GoldenException("system property $name is not set: run the tests through Gradle"))

    val directory: File by lazy { property("truthy.golden") }
    val decksDirectory: File by lazy { property("truthy.decks") }
    val engineDirectory: File by lazy { property("truthy.engine") }
    val sourcesDirectory: File by lazy { engineDirectory.resolve("src/main/kotlin/com/eienmosu/truthy/engine") }
    val testsDirectory: File by lazy { engineDirectory.resolve("src/test/kotlin") }

    val json: Json = Json { allowSpecialFloatingPointValues = true }

    /** Plan A task 4 rule 1: the constant DEAL would share a file with the function deal on a disk that ignores case. */
    private val NAME_EXCEPTIONS = mapOf(("src/engine/deal" to "DEAL") to "src.engine.deal.DEAL.constant.json")

    /** "src/engine/rng" and "createRng" give "src.engine.rng.createRng.json"; DEAL is plan A's one exception. */
    fun fileName(module: String, function: String): String =
        NAME_EXCEPTIONS[module to function] ?: (module.replace('/', '.') + "." + function + ".json")

    /**
     * The vectors of one function or constant. Every test that ports a function calls this with two string
     * literals, so the coverage test can find which files the suite consumes.
     */
    fun load(module: String, function: String): GoldenFile = decodeFile(directory.resolve(fileName(module, function)))

    fun decodeFile(file: File): GoldenFile = parse(file.readText())

    fun parse(text: String): GoldenFile {
        val root = json.parseToJsonElement(text).jsonObject
        fun field(key: String): JsonElement = root[key] ?: throw GoldenException("a golden file has no \"$key\"")
        return GoldenFile(
            format = field("format").jsonPrimitive.int,
            module = field("module").jsonPrimitive.content,
            function = field("function").jsonPrimitive.content,
            source = field("source").jsonPrimitive.content,
            tests = field("tests").jsonArray.map { it.jsonPrimitive.content },
            cards = field("cards").jsonObject.toMap(),
            cases = field("cases").jsonArray.map {
                val case = it.jsonObject
                GoldenCase(
                    name = case["name"]?.jsonPrimitive?.content ?: throw GoldenException("a case has no name"),
                    input = case["input"] ?: throw GoldenException("a case has no input"),
                    output = case["output"] ?: throw GoldenException("a case has no output"),
                )
            },
        )
    }

    /** Every file name in native-data/golden, sorted. */
    fun fileNames(): List<String> =
        (directory.list() ?: throw GoldenException("$directory cannot be read")).filter { it.endsWith(".json") }.sorted()

    fun isUndefined(value: JsonElement): Boolean = tagOf(value)?.first == UNDEFINED_TAG
}
