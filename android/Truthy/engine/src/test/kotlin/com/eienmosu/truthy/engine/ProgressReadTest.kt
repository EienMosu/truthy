package com.eienmosu.truthy.engine

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

// Ports of tests/progress/partial-read.test.ts and the reading rules of reference 3.5.
class ProgressReadTest {
  private val stored =
    """{"version":1,"cards":{"a":{"seen":3,"lastCorrect":false,"lastSeenAt":5}},"records":{"a/ALL#classic":7},""" +
      """"last":{"route":{"deckId":"a","sectionId":"ALL"},"mode":"classic","score":7,"total":10}}"""
  private val keptA = CardHistory(seen = 3, lastCorrect = false, lastSeenAt = 5.0)
  private val lastA = LastRound(route = Route(deckId = "a", sectionId = "ALL"), mode = Mode.CLASSIC, score = 7, total = 10)
  private val notWhole = ReadResult(emptyProgress(), false)

  private fun cardsOnly(cards: String) = """{"version":1,"cards":""" + cards + ""","records":{},"last":null}"""

  private fun progressOf(cards: Map<String, CardHistory> = emptyMap(), records: Map<String, Int> = emptyMap(), last: LastRound? = null) =
    Progress(version = 1, cards = cards, records = records, last = last)

  @Test fun nothingStoredIsEmptyAndWhole() {
    assertEquals(ReadResult(emptyProgress(), true), readProgress(null))
  }

  @Test fun aValidValueReadsWhole() {
    assertEquals(ReadResult(progressOf(mapOf("a" to keptA), mapOf("a/ALL#classic" to 7), lastA), true), readProgress(stored))
  }

  @Test fun valuesThatAreNotProgressReadEmptyAndNotWhole() {
    val raws = listOf(
      "{not json", "", " ", "{", "undefined", "NaN", "true", "\u0000", "null", "42", "\"progress\"", "[]", "{}",
      """{"version":2}""", """{"version":"1"}""", """{"version":true}""", "﻿{\"version\":1}", """{"version":1,}""", "01",
    )
    for (raw in raws) assertEquals(notWhole, readProgress(raw), raw)
  }

  @Test fun aVersionWritten1Point0IsVersion1() {
    assertEquals(ReadResult(emptyProgress(), true), readProgress("""{"version":1.0,"cards":{},"records":{},"last":null}"""))
  }

  @Test fun aMissingLastKeyReadsNotWholeWhileAMissingScoreIsNull() {
    assertEquals(notWhole, readProgress("""{"version":1,"cards":{},"records":{}}"""))
    val older = readProgress("""{"version":1,"cards":{},"records":{},"last":{"route":{"deckId":"a","sectionId":"ALL"},"mode":"classic"}}""")
    assertTrue(older.whole)
    assertEquals(LastRound(route = Route(deckId = "a", sectionId = "ALL"), mode = Mode.CLASSIC, score = null, total = null), older.progress.last)
  }

  @Test fun aFailingPartIsDroppedAloneAndTheRestKept() {
    val badRecord = """{"version":1,"cards":{},"records":{"x/ALL#classic":7.5,"y/ALL#classic":2},"last":null}"""
    assertEquals(ReadResult(progressOf(records = mapOf("y/ALL#classic" to 2)), false), readProgress(badRecord))
    val badMode = """{"version":1,"cards":{},"records":{},"last":{"route":{"deckId":"a","sectionId":"ALL"},"mode":"daily"}}"""
    assertEquals(notWhole, readProgress(badMode))
    val cardsArray = """{"version":1,"cards":[],"records":{"y/ALL#classic":2},"last":null}"""
    assertEquals(ReadResult(progressOf(records = mapOf("y/ALL#classic" to 2)), false), readProgress(cardsArray))
  }

  @Test fun numbersFollowJavaScriptAndZod() {
    // 1e999 parses to Infinity, so only the entry that holds it is dropped.
    val infinite = readProgress(cardsOnly("""{"a":{"seen":1,"lastCorrect":true,"lastSeenAt":1e999},"b":{"seen":1,"lastCorrect":true,"lastSeenAt":2}}"""))
    assertEquals(ReadResult(progressOf(mapOf("b" to CardHistory(seen = 1, lastCorrect = true, lastSeenAt = 2.0))), false), infinite)
    val infiniteRecord = readProgress("""{"version":1,"cards":{},"records":{"a/ALL#classic":1e999,"b/ALL#classic":2},"last":null}""")
    assertEquals(ReadResult(progressOf(records = mapOf("b/ALL#classic" to 2)), false), infiniteRecord)
    // 2^53 is not a safe integer; the largest Int is kept.
    assertFalse(readProgress(cardsOnly("""{"a":{"seen":9007199254740992,"lastCorrect":true,"lastSeenAt":1}}""")).whole)
    assertEquals(2_147_483_647L, readProgress(cardsOnly("""{"a":{"seen":2147483647,"lastCorrect":true,"lastSeenAt":1}}""")).progress.cards["a"]?.seen)
    // A fractional lastSeenAt is kept, -0 stays -0, and a score written 7.0 is 7.
    assertEquals(1.5, readProgress(cardsOnly("""{"a":{"seen":1,"lastCorrect":true,"lastSeenAt":1.5}}""")).progress.cards["a"]?.lastSeenAt)
    val negativeZero = readProgress(cardsOnly("""{"a":{"seen":1,"lastCorrect":true,"lastSeenAt":-0}}"""))
    assertTrue(negativeZero.whole)
    assertEquals((-0.0).toRawBits(), negativeZero.progress.cards.getValue("a").lastSeenAt.toRawBits())
    val sevenPointZero = readProgress("""{"version":1,"cards":{},"records":{},"last":{"route":{"deckId":"a","sectionId":"ALL"},"mode":"classic","score":7.0,"total":10}}""")
    assertEquals(ReadResult(progressOf(last = lastA), true), sevenPointZero)
  }

  @Test fun unknownFieldsAreDroppedAndProtoIsAPlainKey() {
    val raw = """{"version":1,"theme":"night","cards":{"__proto__":{"seen":1,"lastCorrect":true,"lastSeenAt":1,"flagged":true},"bad":{"seen":-1}},"records":{},"last":null}"""
    assertEquals(ReadResult(progressOf(mapOf("__proto__" to CardHistory(seen = 1, lastCorrect = true, lastSeenAt = 1.0))), false), readProgress(raw))
  }

  @Test fun aLaterDuplicateKeyWinsAsInJsonParse() {
    val raw = """{"version":1,"cards":{},"records":{"a/ALL#classic":1,"a/ALL#classic":4},"last":null}"""
    assertEquals(mapOf("a/ALL#classic" to 4), readProgress(raw).progress.records)
  }

  @Test fun escapesInStringsAreDecoded() {
    val raw = """{"version":1,"cards":{"café-\"1\"":{"seen":1,"lastCorrect":true,"lastSeenAt":1}},"records":{},"last":null}"""
    assertEquals(setOf("café-\"1\""), readProgress(raw).progress.cards.keys)
  }

  @Test fun aUnicodeEscapeNeedsFourAsciiHexDigits() {
    for (escape in listOf("""\u+041""", """\u-041""", """\u0G41""", """\u004""")) {
      val raw = """{"version":1,"cards":{"x""" + escape + """":{"seen":1,"lastCorrect":true,"lastSeenAt":1}},"records":{},"last":null}"""
      assertEquals(notWhole, readProgress(raw), escape)
    }
  }

  @Test fun aLoneSurrogateEscapeIsKeptAsJavaScriptKeepsIt() {
    val raw = """{"version":1,"cards":{"\ud800x":{"seen":1,"lastCorrect":true,"lastSeenAt":1}},"records":{},"last":null}"""
    val read = readProgress(raw)
    assertEquals(setOf("\uD800x"), read.progress.cards.keys)
    assertEquals(ReadResult(read.progress, true), readProgress(progressJson(read.progress)))
  }

  // Rule 5: a seen count is a Long and keeps every safe integer, as the web does.
  @Test fun seenCountsUpToTheLargestSafeIntegerAreKept() {
    val bigSeen = readProgress(cardsOnly("""{"a":{"seen":2147483648,"lastCorrect":true,"lastSeenAt":1}}"""))
    assertEquals(ReadResult(progressOf(mapOf("a" to CardHistory(seen = 2_147_483_648L, lastCorrect = true, lastSeenAt = 1.0))), true), bigSeen)
    val safe = readProgress(cardsOnly("""{"a":{"seen":9007199254740991,"lastCorrect":true,"lastSeenAt":1}}"""))
    assertEquals(ReadResult(progressOf(mapOf("a" to CardHistory(seen = 9_007_199_254_740_991L, lastCorrect = true, lastSeenAt = 1.0))), true), safe)
    assertEquals("""{"version":1,"cards":{"a":{"seen":9007199254740991,"lastCorrect":true,"lastSeenAt":1}},"records":{},"last":null}""", progressJson(safe.progress))
  }

  // Decision D1: a record or score above Int.MAX_VALUE is a count the Kotlin types cannot hold; it fails its part alone.
  @Test fun recordsAndScoresAboveIntMaxAreDroppedAlone() {
    assertEquals(notWhole, readProgress("""{"version":1,"cards":{},"records":{"a/ALL#classic":3000000000},"last":null}"""))
    val bigScore = """{"version":1,"cards":{},"records":{},"last":{"route":{"deckId":"a","sectionId":"ALL"},"mode":"classic","score":2147483648,"total":10}}"""
    assertEquals(notWhole, readProgress(bigScore))
  }

  // Decision D2: more than 512 nested arrays or objects fail the parse instead of overflowing the stack.
  @Test fun nestingDeeperThan512ReadsNotWholeWithoutOverflowingTheStack() {
    fun withDeep(depth: Int) = """{"version":1,"cards":{},"records":{},"last":null,"deep":""" + "[".repeat(depth) + "]".repeat(depth) + "}"
    assertEquals(ReadResult(emptyProgress(), true), readProgress(withDeep(100)))
    assertEquals(notWhole, readProgress(withDeep(600)))
    assertEquals(notWhole, readProgress("[".repeat(200_000)))
  }
}
