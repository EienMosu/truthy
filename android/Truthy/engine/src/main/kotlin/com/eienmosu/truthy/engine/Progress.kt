package com.eienmosu.truthy.engine

import kotlin.math.abs
import kotlin.math.floor
import kotlinx.serialization.Serializable

// Progress: card history, records and the last route played. A line-by-line port of src/progress/progress.ts
// (reference 3.5). Pure: every function returns new values and never changes its inputs.
// The stored text is written by progressJson only, never by kotlinx Json: that encoder leaves out properties
// with default values, prints 1790000000000.0 as 1.79E12 and writes enum names.

// The last round played. score and total are null for an abandoned round and for a last route stored before
// scores were kept.
@Serializable
data class LastRound(val route: Route, val mode: Mode, val score: Int?, val total: Int?)

@Serializable
data class Progress(
  val version: Int,
  val cards: Map<String, CardHistory>,
  val records: Map<String, Int>, // key: recordKey(route, mode)
  val last: LastRound?,
)

fun emptyProgress(): Progress = Progress(version = 1, cards = emptyMap(), records = emptyMap(), last = null)

// routeKey(route) + "#" + mode, as the web writes it ("aws-clf-c02/SEC#classic").
fun recordKey(route: Route, mode: Mode): String = "${route.deckId}/${route.sectionId}#${mode.wire}"

// The record for a route and mode, or null when it has not been played (to the end) yet.
fun bestFor(progress: Progress, route: Route, mode: Mode): Int? = progress.records[recordKey(route, mode)]

// How a finished round compares with the record that stood before it. kind is the TypeScript kind.
sealed interface Comparison {
  val kind: String

  data object First : Comparison {
    override val kind: String get() = "first"
  }

  data class NewBest(val previousBest: Int) : Comparison {
    override val kind: String get() = "new-best"
  }

  data class Equal(val best: Int) : Comparison {
    override val kind: String get() = "equal"
  }

  data class Short(val best: Int, val by: Int) : Comparison {
    override val kind: String get() = "short"
  }
}

// Compares a score with the record before the round (null when this route and mode had none).
fun compareWithBest(score: Int, previousBest: Int?): Comparison {
  if (previousBest == null) return Comparison.First
  if (score > previousBest) return Comparison.NewBest(previousBest = previousBest)
  if (score == previousBest) return Comparison.Equal(best = previousBest)
  return Comparison.Short(best = previousBest, by = previousBest - score)
}

data class ApplyOutcome(val progress: Progress, val previousBest: Int?, val isNewBest: Boolean)

// Records the answers of a round in the card history, remembers its route and mode (and its score when it was
// finished), and sets the record when a finished round beats it. A first finished round always sets the record,
// even with score 0. An abandoned round keeps its answers but never touches the record.
fun applyResult(progress: Progress, result: RoundResult): ApplyOutcome {
  val key = recordKey(result.route, result.mode)
  val previousBest = bestFor(progress, result.route, result.mode)
  val comparison = compareWithBest(result.score, previousBest)
  val isNewBest = !result.abandoned && (comparison is Comparison.First || comparison is Comparison.NewBest)
  val records = LinkedHashMap(progress.records)
  if (isNewBest) records[key] = result.score
  return ApplyOutcome(
    progress = Progress(
      version = 1,
      cards = withAnswers(progress.cards, result),
      records = records,
      last = LastRound(
        route = Route(deckId = result.route.deckId, sectionId = result.route.sectionId),
        mode = result.mode,
        score = if (result.abandoned) null else result.score,
        total = if (result.abandoned) null else result.total,
      ),
    ),
    previousBest = previousBest,
    isNewBest = isNewBest,
  )
}

// A card answered twice in one round counts twice and keeps the later verdict and time.
private fun withAnswers(cards: Map<String, CardHistory>, result: RoundResult): Map<String, CardHistory> {
  val next = LinkedHashMap(cards)
  for (answer in result.answers) {
    val id = answer.card.id
    val before = next[id]
    next[id] = CardHistory(seen = (before?.seen ?: 0L) + 1L, lastCorrect = answer.correct, lastSeenAt = answer.at)
  }
  return next
}

// Drops the history of cards of this deck that are not in the deck any more. A card belongs to the deck when its
// id starts with "<deckId>-" (the plain prefix, compared in UTF-16 code units as JavaScript does).
// Records and the last route are kept.
fun pruneDeck(progress: Progress, deckId: String, cardIds: List<String>): Progress {
  val prefix = "$deckId-"
  val current = cardIds.toSet()
  val cards = LinkedHashMap<String, CardHistory>()
  for ((id, entry) in progress.cards) {
    if (id.startsWith(prefix) && id !in current) continue
    cards[id] = entry
  }
  return Progress(version = progress.version, cards = cards, records = LinkedHashMap(progress.records), last = progress.last)
}

// The share (0 to 1) of the given cards that have been seen at least once. No cards gives 0.
fun seenShare(history: History, cardIds: List<String>): Double {
  val ids = cardIds.toSet()
  if (ids.isEmpty()) return 0.0
  var seen = 0
  for (id in ids) {
    val entry = history[id]
    if (entry != null && entry.seen > 0) seen += 1
  }
  return seen.toDouble() / ids.size
}

// JSON.stringify(progress): the web's key order, "last": null and null scores written out, whole numbers as
// integers, non-finite numbers as null, strings escaped as JSON.stringify escapes them.
fun progressJson(progress: Progress): String = buildString {
  append("{\"version\":").append(progress.version)
  append(",\"cards\":{")
  var first = true
  for ((id, entry) in progress.cards) {
    if (!first) append(',')
    first = false
    appendJsonString(id)
    append(":{\"seen\":").append(entry.seen)
    append(",\"lastCorrect\":").append(entry.lastCorrect)
    append(",\"lastSeenAt\":")
    appendJsonNumber(entry.lastSeenAt)
    append('}')
  }
  append("},\"records\":{")
  first = true
  for ((key, best) in progress.records) {
    if (!first) append(',')
    first = false
    appendJsonString(key)
    append(':').append(best)
  }
  append("},\"last\":")
  val last = progress.last
  if (last == null) {
    append("null")
  } else {
    append("{\"route\":{\"deckId\":")
    appendJsonString(last.route.deckId)
    append(",\"sectionId\":")
    appendJsonString(last.route.sectionId)
    append("},\"mode\":")
    appendJsonString(last.mode.wire)
    append(",\"score\":").append(last.score?.toString() ?: "null")
    append(",\"total\":").append(last.total?.toString() ?: "null")
    append('}')
  }
  append('}')
}

// JSON.stringify's number text: null when not finite, an integer when whole (-0 is "0"). Doubles of magnitude
// 9.0E18 and above, and fractions, use Double.toString, which JSON.parse reads back as the same double.
private fun StringBuilder.appendJsonNumber(value: Double) {
  when {
    !value.isFinite() -> append("null")
    value == floor(value) && abs(value) < 9.0E18 -> append(value.toLong())
    else -> append(value.toString())
  }
}

// JSON.stringify's string escaping, by UTF-16 code unit: a lone surrogate is written as a lowercase \u escape.
private fun StringBuilder.appendJsonString(text: String) {
  append('"')
  var i = 0
  while (i < text.length) {
    val c = text[i]
    when {
      c == '"' -> append("\\\"")
      c == '\\' -> append("\\\\")
      c == '\b' -> append("\\b")
      c == '\u000C' -> append("\\f")
      c == '\n' -> append("\\n")
      c == '\r' -> append("\\r")
      c == '\t' -> append("\\t")
      c < ' ' -> append("\\u").append(c.code.toString(16).padStart(4, '0'))
      c.isHighSurrogate() && i + 1 < text.length && text[i + 1].isLowSurrogate() -> {
        append(c).append(text[i + 1])
        i += 1
      }
      c.isSurrogate() -> append("\\u").append(c.code.toString(16).padStart(4, '0'))
      else -> append(c)
    }
    i += 1
  }
  append('"')
}
