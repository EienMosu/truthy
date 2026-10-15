package com.eienmosu.truthy.engine

// A strict JSON parser with JavaScript's JSON.parse results, for reading stored progress (reference 3.5).
// kotlinx's parseToJsonElement takes unquoted literals such as NaN or 01, and a reader that rejects 1e999
// would lose a whole stored value where the web drops only the part that holds it. Every number is a Double,
// as in JavaScript; a later duplicate key replaces an earlier one; strings keep lone surrogates.

internal sealed interface JsonValue {
  data object Null : JsonValue
  data class Bool(val value: Boolean) : JsonValue
  data class Num(val value: Double) : JsonValue
  data class Str(val value: String) : JsonValue
  data class Arr(val items: List<JsonValue>) : JsonValue
  data class Obj(val members: Map<String, JsonValue>) : JsonValue
}

// Decision D2: deeper nesting fails the parse instead of overflowing the stack.
private const val MAX_JSON_DEPTH = 512

// The value of a whole JSON text, or null when JSON.parse would throw.
internal fun parseJson(text: String): JsonValue? {
  val reader = StrictJsonReader(text)
  reader.skipWhitespace()
  val value = reader.value(0) ?: return null
  reader.skipWhitespace()
  return if (reader.index == text.length) value else null
}

private class StrictJsonReader(private val text: String) {
  var index = 0

  private fun current(): Char? = if (index < text.length) text[index] else null

  fun skipWhitespace() {
    while (index < text.length) {
      val c = text[index]
      if (c == ' ' || c == '\t' || c == '\n' || c == '\r') index += 1 else return
    }
  }

  // depth: how many arrays and objects enclose this value.
  fun value(depth: Int): JsonValue? {
    val c = current() ?: return null
    return when (c) {
      '{' -> if (depth >= MAX_JSON_DEPTH) null else members(depth + 1)
      '[' -> if (depth >= MAX_JSON_DEPTH) null else items(depth + 1)
      '"' -> string()?.let { JsonValue.Str(it) }
      't' -> literal("true", JsonValue.Bool(true))
      'f' -> literal("false", JsonValue.Bool(false))
      'n' -> literal("null", JsonValue.Null)
      else -> number()
    }
  }

  private fun literal(word: String, result: JsonValue): JsonValue? {
    if (!text.startsWith(word, index)) return null
    index += word.length
    return result
  }

  private fun members(depth: Int): JsonValue? {
    index += 1
    val members = LinkedHashMap<String, JsonValue>()
    skipWhitespace()
    if (current() == '}') {
      index += 1
      return JsonValue.Obj(members)
    }
    while (true) {
      skipWhitespace()
      if (current() != '"') return null
      val key = string() ?: return null
      skipWhitespace()
      if (current() != ':') return null
      index += 1
      skipWhitespace()
      val member = value(depth) ?: return null
      members[key] = member
      skipWhitespace()
      when (current()) {
        ',' -> index += 1
        '}' -> {
          index += 1
          return JsonValue.Obj(members)
        }
        else -> return null
      }
    }
  }

  private fun items(depth: Int): JsonValue? {
    index += 1
    val items = ArrayList<JsonValue>()
    skipWhitespace()
    if (current() == ']') {
      index += 1
      return JsonValue.Arr(items)
    }
    while (true) {
      skipWhitespace()
      val item = value(depth) ?: return null
      items.add(item)
      skipWhitespace()
      when (current()) {
        ',' -> index += 1
        ']' -> {
          index += 1
          return JsonValue.Arr(items)
        }
        else -> return null
      }
    }
  }

  // A string's UTF-16 code units, escapes decoded. Unescaped control characters fail, as in JSON.parse.
  private fun string(): String? {
    index += 1
    val out = StringBuilder()
    while (index < text.length) {
      val c = text[index]
      index += 1
      when {
        c == '"' -> return out.toString()
        c < ' ' -> return null
        c != '\\' -> out.append(c)
        else -> {
          val escape = current() ?: return null
          index += 1
          when (escape) {
            '"', '\\', '/' -> out.append(escape)
            'b' -> out.append('\b')
            'f' -> out.append('\u000C')
            'n' -> out.append('\n')
            'r' -> out.append('\r')
            't' -> out.append('\t')
            'u' -> {
              if (index + 4 > text.length) return null
              var code = 0
              for (k in 0 until 4) {
                val digit = hexDigit(text[index + k])
                if (digit < 0) return null
                code = code * 16 + digit
              }
              out.append(code.toChar())
              index += 4
            }
            else -> return null
          }
        }
      }
    }
    return null
  }

  // ASCII hex digits only; Character.digit would also take other scripts' digits.
  private fun hexDigit(c: Char): Int = when (c) {
    in '0'..'9' -> c - '0'
    in 'a'..'f' -> c - 'a' + 10
    in 'A'..'F' -> c - 'A' + 10
    else -> -1
  }

  private fun isDigit(c: Char?): Boolean = c != null && c in '0'..'9'

  // -? (0 | [1-9][0-9]*) (. [0-9]+)? ([eE] [+-]? [0-9]+)?, read as the nearest Double (1e999 is Infinity).
  private fun number(): JsonValue? {
    val start = index
    if (current() == '-') index += 1
    if (current() == '0') {
      index += 1
    } else if (isDigit(current())) {
      while (isDigit(current())) index += 1
    } else {
      return null
    }
    if (current() == '.') {
      index += 1
      if (!isDigit(current())) return null
      while (isDigit(current())) index += 1
    }
    if (current() == 'e' || current() == 'E') {
      index += 1
      if (current() == '+' || current() == '-') index += 1
      if (!isDigit(current())) return null
      while (isDigit(current())) index += 1
    }
    return JsonValue.Num(text.substring(start, index).toDouble())
  }
}
