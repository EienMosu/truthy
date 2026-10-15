package com.eienmosu.truthy.engine

import kotlin.math.abs
import kotlin.math.truncate

// Reading a stored progress value part by part, a port of readProgress and parseProgress in
// src/progress/progress.ts and of the zod schemas they use (reference 3.5). Each card entry, each record and the
// last route stand on their own: one that fails is dropped alone, and the read is then not whole.
// Unknown fields are dropped.

// A stored value as read: the progress kept from it, and whether all of it was kept. When whole is false the raw
// value holds something the progress does not, which the store keeps aside before it writes over it.
data class ReadResult(val progress: Progress, val whole: Boolean)

// Number.MAX_SAFE_INTEGER, 2^53 - 1, exactly representable.
private const val STORED_SAFE_INTEGER_LIMIT = 9_007_199_254_740_991.0

// zod 4: z.number() rejects Infinity and NaN; z.int() accepts safe integers only; nonnegative is >= 0 (so -0 passes).
// A seen count: every such safe integer, held exactly by a Long (rule 5).
private fun storedSafeCount(value: JsonValue?): Long? {
  if (value !is JsonValue.Num) return null
  val n = value.value
  if (!n.isFinite() || n != truncate(n) || abs(n) > STORED_SAFE_INTEGER_LIMIT) return null
  if (n < 0) return null
  return n.toLong()
}

// A record, score or total. Decision D1: above Int.MAX_VALUE it cannot be held and fails like a negative one.
private fun storedCount(value: JsonValue?): Int? {
  val n = storedSafeCount(value) ?: return null
  if (n > Int.MAX_VALUE) return null
  return n.toInt()
}

private fun storedCardHistory(value: JsonValue): CardHistory? {
  if (value !is JsonValue.Obj) return null
  val seen = storedSafeCount(value.members["seen"]) ?: return null
  val lastCorrect = (value.members["lastCorrect"] as? JsonValue.Bool)?.value ?: return null
  val lastSeenAt = (value.members["lastSeenAt"] as? JsonValue.Num)?.value ?: return null
  if (!lastSeenAt.isFinite() || lastSeenAt < 0) return null
  return CardHistory(seen = seen, lastCorrect = lastCorrect, lastSeenAt = lastSeenAt)
}

private fun storedRecord(value: JsonValue): Int? = storedCount(value)

// A score or total: missing reads as null (stored before scores were kept), null is null, otherwise a count.
private class StoredOptionalCount(val ok: Boolean, val value: Int?)

private fun storedOptionalCount(value: JsonValue?): StoredOptionalCount {
  if (value == null || value == JsonValue.Null) return StoredOptionalCount(ok = true, value = null)
  val n = storedCount(value) ?: return StoredOptionalCount(ok = false, value = null)
  return StoredOptionalCount(ok = true, value = n)
}

private fun storedNonEmptyString(value: JsonValue?): String? {
  if (value !is JsonValue.Str || value.value.isEmpty()) return null
  return value.value
}

// The last route: null reads as null and succeeds; a missing key fails (undefined is not null in zod).
private class StoredLast(val success: Boolean, val last: LastRound?)

private fun storedLast(value: JsonValue?): StoredLast {
  if (value == null) return StoredLast(success = false, last = null)
  if (value == JsonValue.Null) return StoredLast(success = true, last = null)
  val fail = StoredLast(success = false, last = null)
  if (value !is JsonValue.Obj) return fail
  val route = value.members["route"] as? JsonValue.Obj ?: return fail
  val deckId = storedNonEmptyString(route.members["deckId"]) ?: return fail
  val sectionId = storedNonEmptyString(route.members["sectionId"]) ?: return fail
  val modeName = (value.members["mode"] as? JsonValue.Str)?.value ?: return fail
  val mode = Mode.entries.firstOrNull { it.wire == modeName } ?: return fail
  val score = storedOptionalCount(value.members["score"])
  val total = storedOptionalCount(value.members["total"])
  if (!score.ok || !total.ok) return fail
  return StoredLast(
    success = true,
    last = LastRound(route = Route(deckId = deckId, sectionId = sectionId), mode = mode, score = score.value, total = total.value),
  )
}

// The entries of a stored map that pass; a value that is not an object reads as empty and not whole.
private fun <T : Any> storedEntries(value: JsonValue?, parse: (JsonValue) -> T?): Pair<Map<String, T>, Boolean> {
  if (value !is JsonValue.Obj) return Pair(emptyMap(), false)
  val kept = LinkedHashMap<String, T>()
  var whole = true
  for ((key, entry) in value.members) {
    val parsed = parse(entry)
    if (parsed != null) kept[key] = parsed else whole = false
  }
  return Pair(kept, whole)
}

// Never throws. Nothing stored reads as empty and whole. Invalid JSON, a value that is not an object and any
// version other than the number 1 read as empty and not whole. Otherwise a card entry, a record or a last route
// that fails is dropped alone (the last route becomes null), and the rest is kept.
fun readProgress(raw: String?): ReadResult {
  if (raw == null) return ReadResult(emptyProgress(), true)
  val data = parseJson(raw)
  if (data !is JsonValue.Obj || data.members["version"] != JsonValue.Num(1.0)) return ReadResult(emptyProgress(), false)
  val (cards, cardsWhole) = storedEntries(data.members["cards"], ::storedCardHistory)
  val (records, recordsWhole) = storedEntries(data.members["records"], ::storedRecord)
  val last = storedLast(data.members["last"])
  return ReadResult(
    Progress(version = 1, cards = cards, records = records, last = last.last),
    cardsWhole && recordsWhole && last.success,
  )
}

// The progress kept from a stored value (see readProgress).
fun parseProgress(raw: String?): Progress = readProgress(raw).progress
