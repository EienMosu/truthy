package com.eienmosu.truthy.engine

import kotlin.math.abs
import kotlin.math.floor
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

// Plain values from golden JSON (plan A's README, "The golden vector format"). Numbers JSON cannot carry
// come tagged as {"$number": "Infinity" | "-Infinity" | "NaN" | "-0"}.
object GoldenDecode {
  fun field(value: JsonElement, key: String): JsonElement =
    value.jsonObject[key] ?: error("no field $key in $value")

  fun isNull(value: JsonElement): Boolean = value is JsonNull

  fun number(value: JsonElement): Double {
    if (value is JsonObject) {
      return when (value["\$number"]?.jsonPrimitive?.content) {
        "Infinity" -> Double.POSITIVE_INFINITY
        "-Infinity" -> Double.NEGATIVE_INFINITY
        "NaN" -> Double.NaN
        "-0" -> -0.0
        else -> error("not a number: $value")
      }
    }
    val primitive = value.jsonPrimitive
    require(!primitive.isString && primitive !is JsonNull) { "not a number: $value" }
    return primitive.content.toDouble()
  }

  fun int(value: JsonElement): Int {
    val n = number(value)
    require(n == floor(n) && abs(n) <= Int.MAX_VALUE) { "not an Int: $value" }
    return n.toInt()
  }

  // A count up to 2^53 - 1, the largest safe integer, held exactly by a Long (CardHistory.seen).
  fun long(value: JsonElement): Long {
    val n = number(value)
    require(n == floor(n) && abs(n) <= 9_007_199_254_740_991.0) { "not a safe integer: $value" }
    return n.toLong()
  }

  fun optionalInt(value: JsonElement): Int? = if (isNull(value)) null else int(value)

  fun string(value: JsonElement): String {
    val primitive = value.jsonPrimitive
    require(primitive.isString) { "not a string: $value" }
    return primitive.content
  }

  fun bool(value: JsonElement): Boolean {
    val primitive = value.jsonPrimitive
    require(!primitive.isString && primitive !is JsonNull) { "not a boolean: $value" }
    return primitive.boolean
  }

  fun strings(value: JsonElement): List<String> = value.jsonArray.map { string(it) }
}
