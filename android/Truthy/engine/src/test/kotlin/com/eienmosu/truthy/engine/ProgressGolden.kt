package com.eienmosu.truthy.engine

import com.eienmosu.truthy.engine.GoldenDecode.bool
import com.eienmosu.truthy.engine.GoldenDecode.field
import com.eienmosu.truthy.engine.GoldenDecode.int
import com.eienmosu.truthy.engine.GoldenDecode.isNull
import com.eienmosu.truthy.engine.GoldenDecode.long
import com.eienmosu.truthy.engine.GoldenDecode.number
import com.eienmosu.truthy.engine.GoldenDecode.optionalInt
import com.eienmosu.truthy.engine.GoldenDecode.string
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject

// Decoders from golden JSON to the progress types of task 4, and an exact comparison.
object ProgressGolden {
  fun route(value: JsonElement) = Route(deckId = string(field(value, "deckId")), sectionId = string(field(value, "sectionId")))

  fun mode(value: JsonElement): Mode {
    val name = string(value)
    return Mode.entries.firstOrNull { it.wire == name } ?: error("not a mode: $name")
  }

  fun history(value: JsonElement): Map<String, CardHistory> =
    value.jsonObject.mapValues { (_, entry) ->
      CardHistory(
        seen = long(field(entry, "seen")),
        lastCorrect = bool(field(entry, "lastCorrect")),
        lastSeenAt = number(field(entry, "lastSeenAt")),
      )
    }

  fun progress(value: JsonElement): Progress {
    val last = field(value, "last")
    return Progress(
      version = int(field(value, "version")),
      cards = history(field(value, "cards")),
      records = field(value, "records").jsonObject.mapValues { (_, best) -> int(best) },
      last = if (isNull(last)) {
        null
      } else {
        LastRound(
          route = route(field(last, "route")),
          mode = mode(field(last, "mode")),
          score = optionalInt(field(last, "score")),
          total = optionalInt(field(last, "total")),
        )
      },
    )
  }

  fun comparison(value: JsonElement): Comparison = when (val kind = string(field(value, "kind"))) {
    "first" -> Comparison.First
    "new-best" -> Comparison.NewBest(previousBest = int(field(value, "previousBest")))
    "equal" -> Comparison.Equal(best = int(field(value, "best")))
    "short" -> Comparison.Short(best = int(field(value, "best")), by = int(field(value, "by")))
    else -> error("unknown comparison kind $kind")
  }

  fun answered(file: GoldenFile, value: JsonElement) = Answered(
    card = file.card(field(value, "card")),
    given = bool(field(value, "given")),
    correct = bool(field(value, "correct")),
    at = number(field(value, "at")),
  )

  fun roundResult(file: GoldenFile, value: JsonElement) = RoundResult(
    mode = mode(field(value, "mode")),
    route = route(field(value, "route")),
    score = int(field(value, "score")),
    total = int(field(value, "total")),
    answers = field(value, "answers").jsonArray.map { answered(file, it) },
    missed = field(value, "missed").jsonArray.map { answered(file, it) },
    abandoned = bool(field(value, "abandoned")),
  )

  // Equal, and every lastSeenAt the same double bit for bit (so -0.0 stays -0.0).
  fun exactly(a: Progress, b: Progress): Boolean =
    a == b && a.cards.all { (id, entry) -> b.cards[id]?.lastSeenAt?.toRawBits() == entry.lastSeenAt.toRawBits() }
}
