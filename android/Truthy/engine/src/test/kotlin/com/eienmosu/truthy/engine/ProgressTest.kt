package com.eienmosu.truthy.engine

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

// Ports of the pinned cases of tests/progress/progress.test.ts and progress-polish.test.ts.
class ProgressTest {
  private val sec = Route(deckId = "aws-clf-c02", sectionId = "SEC")
  private val con = Route(deckId = "aws-clf-c02", sectionId = "CON")
  private val seenOnce = CardHistory(seen = 1, lastCorrect = true, lastSeenAt = 1.0)

  private fun answered(id: String, correct: Boolean, at: Double) =
    Answered(card = ProgressFixtures.card(id), given = correct, correct = correct, at = at)

  private fun result(answers: List<Answered>, abandoned: Boolean = false) = RoundResult(
    mode = Mode.CLASSIC,
    route = sec,
    score = answers.count { it.correct },
    total = answers.size,
    answers = answers,
    missed = answers.filter { !it.correct },
    abandoned = abandoned,
  )

  // A Classic result with the given score out of ten, all answered at time 1.
  private fun scored(score: Int, abandoned: Boolean = false) =
    result((0 until 10).map { answered("c$it", it < score, 1.0) }, abandoned)

  private fun withRecord(best: Int) =
    Progress(version = 1, cards = emptyMap(), records = mapOf(recordKey(sec, Mode.CLASSIC) to best), last = null)

  @Test fun emptyProgressHasVersion1AndNothingElse() {
    assertEquals(Progress(version = 1, cards = emptyMap(), records = emptyMap(), last = null), emptyProgress())
  }

  @Test fun recordKeyJoinsTheRouteKeyAndTheMode() {
    assertEquals("aws-clf-c02/SEC#classic", recordKey(sec, Mode.CLASSIC))
    assertEquals("nextjs-rendering/ALL#timed", recordKey(Route(deckId = "nextjs-rendering", sectionId = WHOLE_DECK), Mode.TIMED))
  }

  @Test fun bestForReadsTheRecordOfARouteAndMode() {
    val played = Progress(version = 1, cards = emptyMap(), records = mapOf("aws-clf-c02/SEC#classic" to 9, "aws-clf-c02/CON#timed" to 0), last = null)
    assertEquals(9, bestFor(played, sec, Mode.CLASSIC))
    assertNull(bestFor(played, sec, Mode.TIMED))
    assertEquals(0, bestFor(played, con, Mode.TIMED))
  }

  @Test fun compareWithBestKindsCarryTheTypeScriptKind() {
    assertEquals(Comparison.First, compareWithBest(0, null))
    assertEquals(Comparison.NewBest(previousBest = 7), compareWithBest(8, 7))
    assertEquals(Comparison.Equal(best = 9), compareWithBest(9, 9))
    assertEquals(Comparison.Short(best = 9, by = 2), compareWithBest(7, 9))
    assertEquals(listOf("first", "new-best", "equal", "short"), listOf(compareWithBest(0, null), compareWithBest(8, 7), compareWithBest(9, 9), compareWithBest(7, 9)).map { it.kind })
  }

  @Test fun applyResultAddsToTheHistoryAndKeepsTheLaterAnswer() {
    val before = Progress(version = 1, cards = mapOf("c1" to CardHistory(seen = 4, lastCorrect = true, lastSeenAt = 500.0)), records = emptyMap(), last = null)
    val outcome = applyResult(before, result(listOf(answered("c1", true, 100.0), answered("c2", true, 150.0), answered("c1", false, 200.0))))
    assertEquals(CardHistory(seen = 6, lastCorrect = false, lastSeenAt = 200.0), outcome.progress.cards["c1"])
    assertEquals(CardHistory(seen = 1, lastCorrect = true, lastSeenAt = 150.0), outcome.progress.cards["c2"])
  }

  @Test fun applyResultSetsAFirstRecordEvenWithScore0AndReplacesOnlyOnAHigherScore() {
    val first = applyResult(emptyProgress(), scored(0))
    assertTrue(first.isNewBest)
    assertNull(first.previousBest)
    assertEquals(0, first.progress.records["aws-clf-c02/SEC#classic"])
    val equal = applyResult(withRecord(7), scored(7))
    assertFalse(equal.isNewBest)
    assertEquals(7, equal.previousBest)
    assertEquals(7, equal.progress.records["aws-clf-c02/SEC#classic"])
    val better = applyResult(withRecord(6), scored(8))
    assertTrue(better.isNewBest)
    assertEquals(8, better.progress.records["aws-clf-c02/SEC#classic"])
    assertEquals(LastRound(route = sec, mode = Mode.CLASSIC, score = 8, total = 10), better.progress.last)
  }

  @Test fun applyResultForAnAbandonedRoundKeepsTheAnswersButNeverTheRecord() {
    val outcome = applyResult(withRecord(2), scored(9, abandoned = true))
    assertFalse(outcome.isNewBest)
    assertEquals(2, outcome.progress.records["aws-clf-c02/SEC#classic"])
    assertEquals(10, outcome.progress.cards.size)
    assertEquals(LastRound(route = sec, mode = Mode.CLASSIC, score = null, total = null), outcome.progress.last)
    assertTrue(applyResult(emptyProgress(), scored(5, abandoned = true)).progress.records.isEmpty())
  }

  @Test fun applyResultAndPruneDeckLeaveTheirInputUnchanged() {
    val before = Progress(version = 1, cards = mapOf("aws-clf-c02-x" to seenOnce), records = mapOf("aws-clf-c02/SEC#classic" to 3), last = null)
    val copy = before.copy(cards = before.cards.toMap(), records = before.records.toMap())
    applyResult(before, scored(9))
    pruneDeck(before, "aws-clf-c02", emptyList())
    assertEquals(copy, before)
  }

  @Test fun pruneDeckDropsOnlyThisDecksRemovedCardsByThePlainPrefix() {
    val before = Progress(
      version = 1,
      cards = mapOf("aws-clf-c02-t1.1-01" to seenOnce, "aws-clf-c02-t1.1-02" to seenOnce, "aws-clf-c02x-1" to seenOnce, "gcp-cdl-pro-1" to seenOnce),
      records = mapOf("aws-clf-c02/SEC#classic" to 7),
      last = LastRound(route = sec, mode = Mode.CLASSIC, score = 7, total = 10),
    )
    val pruned = pruneDeck(before, "aws-clf-c02", listOf("aws-clf-c02-t1.1-01"))
    assertEquals(setOf("aws-clf-c02-t1.1-01", "aws-clf-c02x-1", "gcp-cdl-pro-1"), pruned.cards.keys)
    assertEquals(before.records, pruned.records)
    assertEquals(before.last, pruned.last)
    assertNull(pruneDeck(before, "gcp-cdl", emptyList()).cards["gcp-cdl-pro-1"])
  }

  @Test fun seenShareCountsDistinctListedCardsSeenAtLeastOnce() {
    assertEquals(0.0, seenShare(mapOf("a" to seenOnce), emptyList()))
    assertEquals(0.5, seenShare(mapOf("a" to seenOnce, "c" to seenOnce), listOf("a", "b", "c", "d")))
    assertEquals(0.0, seenShare(mapOf("a" to CardHistory(seen = 0, lastCorrect = false, lastSeenAt = 0.0)), listOf("a")))
    assertEquals(0.5, seenShare(mapOf("a" to seenOnce), listOf("a", "a", "b")))
    assertEquals(1.0 / 3.0, seenShare(mapOf("a" to seenOnce), listOf("a", "b", "c")))
  }

  @Test fun progressJsonWritesTheWebShapeWithLastAndScoresAsNull() {
    assertEquals("""{"version":1,"cards":{},"records":{},"last":null}""", progressJson(emptyProgress()))
    val abandoned = Progress(version = 1, cards = emptyMap(), records = emptyMap(), last = LastRound(route = sec, mode = Mode.LIVES, score = null, total = null))
    assertEquals(
      """{"version":1,"cards":{},"records":{},"last":{"route":{"deckId":"aws-clf-c02","sectionId":"SEC"},"mode":"lives","score":null,"total":null}}""",
      progressJson(abandoned),
    )
  }

  @Test fun progressJsonWritesWholeNumbersAsIntegersAndNonFiniteAsNull() {
    val played = Progress(
      version = 1,
      cards = mapOf(
        "a" to CardHistory(seen = 2, lastCorrect = true, lastSeenAt = 1_790_000_000_000.0),
        "b" to CardHistory(seen = 1, lastCorrect = false, lastSeenAt = -0.0),
        "c" to CardHistory(seen = 1, lastCorrect = true, lastSeenAt = 1.5),
        "d" to CardHistory(seen = 1, lastCorrect = true, lastSeenAt = Double.POSITIVE_INFINITY),
      ),
      records = mapOf("aws-clf-c02/SEC#classic" to 7),
      last = null,
    )
    assertEquals(
      """{"version":1,"cards":{"a":{"seen":2,"lastCorrect":true,"lastSeenAt":1790000000000},"b":{"seen":1,"lastCorrect":false,"lastSeenAt":0},""" +
        """"c":{"seen":1,"lastCorrect":true,"lastSeenAt":1.5},"d":{"seen":1,"lastCorrect":true,"lastSeenAt":null}},"records":{"aws-clf-c02/SEC#classic":7},"last":null}""",
      progressJson(played),
    )
  }

  @Test fun progressJsonEscapesStringsAsJsonStringifyDoes() {
    val key = "q\"b\\s/\n\t\u0001\uD800é😀"
    val progress = Progress(version = 1, cards = emptyMap(), records = mapOf(key to 3), last = null)
    assertEquals(
      "{\"version\":1,\"cards\":{},\"records\":{\"q\\\"b\\\\s/\\n\\t\\u0001\\ud800é😀\":3},\"last\":null}",
      progressJson(progress),
    )
  }
}
