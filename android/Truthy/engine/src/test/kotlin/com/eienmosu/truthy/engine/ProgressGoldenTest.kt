package com.eienmosu.truthy.engine

import com.eienmosu.truthy.engine.GoldenDecode.bool
import com.eienmosu.truthy.engine.GoldenDecode.field
import com.eienmosu.truthy.engine.GoldenDecode.int
import com.eienmosu.truthy.engine.GoldenDecode.number
import com.eienmosu.truthy.engine.GoldenDecode.optionalInt
import com.eienmosu.truthy.engine.GoldenDecode.string
import com.eienmosu.truthy.engine.GoldenDecode.strings
import com.eienmosu.truthy.engine.ProgressGolden.comparison
import com.eienmosu.truthy.engine.ProgressGolden.exactly
import com.eienmosu.truthy.engine.ProgressGolden.history
import com.eienmosu.truthy.engine.ProgressGolden.mode
import com.eienmosu.truthy.engine.ProgressGolden.progress
import com.eienmosu.truthy.engine.ProgressGolden.roundResult
import com.eienmosu.truthy.engine.ProgressGolden.route
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

// native-data/golden/src.progress.progress.*.json: every case computed by src/progress/progress.ts.
class ProgressGoldenTest {
  // Every call site loads its file with two string literals, so task 1's coverage scan sees it.
  private fun check(file: GoldenFile, mismatch: (GoldenFile, GoldenCase) -> String?) {
    val function = file.function
    assertEquals("src/progress/progress", file.module, function)
    assertTrue(file.cases.isNotEmpty(), function)
    val failures = file.cases.mapNotNull { c -> mismatch(file, c)?.let { "${c.name}: $it" } }
    assertEquals(emptyList<String>(), failures, function)
  }

  @Test fun emptyProgressCases() = check(Golden.load("src/progress/progress", "emptyProgress")) { _, c ->
    if (exactly(emptyProgress(), progress(c.output))) null else "got ${emptyProgress()}"
  }

  @Test fun recordKeyCases() = check(Golden.load("src/progress/progress", "recordKey")) { _, c ->
    val got = recordKey(route(field(c.input, "route")), mode(field(c.input, "mode")))
    if (got == string(c.output)) null else "got $got"
  }

  @Test fun bestForCases() = check(Golden.load("src/progress/progress", "bestFor")) { _, c ->
    val got = bestFor(progress(field(c.input, "progress")), route(field(c.input, "route")), mode(field(c.input, "mode")))
    if (got == optionalInt(c.output)) null else "got $got"
  }

  @Test fun compareWithBestCases() = check(Golden.load("src/progress/progress", "compareWithBest")) { _, c ->
    val got = compareWithBest(int(field(c.input, "score")), optionalInt(field(c.input, "previousBest")))
    if (got == comparison(c.output)) null else "got $got"
  }

  @Test fun applyResultCases() = check(Golden.load("src/progress/progress", "applyResult")) { file, c ->
    val got = applyResult(progress(field(c.input, "progress")), roundResult(file, field(c.input, "result")))
    when {
      !exactly(got.progress, progress(field(c.output, "progress"))) -> "progress ${got.progress}"
      got.previousBest != optionalInt(field(c.output, "previousBest")) -> "previousBest ${got.previousBest}"
      got.isNewBest != bool(field(c.output, "isNewBest")) -> "isNewBest ${got.isNewBest}"
      else -> null
    }
  }

  @Test fun pruneDeckCases() = check(Golden.load("src/progress/progress", "pruneDeck")) { _, c ->
    val got = pruneDeck(progress(field(c.input, "progress")), string(field(c.input, "deckId")), strings(field(c.input, "cardIds")))
    if (exactly(got, progress(c.output))) null else "got $got"
  }

  @Test fun seenShareCases() = check(Golden.load("src/progress/progress", "seenShare")) { _, c ->
    val got = seenShare(history(field(c.input, "history")), strings(field(c.input, "cardIds")))
    if (got.toRawBits() == number(c.output).toRawBits()) null else "got $got"
  }
}
