package com.eienmosu.truthy.engine

import com.eienmosu.truthy.engine.GoldenDecode.bool
import com.eienmosu.truthy.engine.GoldenDecode.field
import com.eienmosu.truthy.engine.GoldenDecode.isNull
import com.eienmosu.truthy.engine.GoldenDecode.string
import com.eienmosu.truthy.engine.ProgressGolden.exactly
import com.eienmosu.truthy.engine.ProgressGolden.progress
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

// native-data/golden/src.progress.progress.readProgress.json and parseProgress.json, computed by the TypeScript code.
class ProgressReadGoldenTest {
  // Every case must match the web exactly; a seen count of 2^53 - 1 is a Long and is kept (rule 5).
  private fun raw(case: GoldenCase): String? = field(case.input, "raw").let { if (isNull(it)) null else string(it) }

  @Test fun readProgressCases() {
    val file = Golden.load("src/progress/progress", "readProgress")
    assertTrue(file.cases.isNotEmpty())
    val failures = file.cases.mapNotNull { c ->
      val got = readProgress(raw(c))
      when {
        !exactly(got.progress, progress(field(c.output, "progress"))) -> "${c.name}: progress ${got.progress}"
        got.whole != bool(field(c.output, "whole")) -> "${c.name}: whole ${got.whole}"
        else -> null
      }
    }
    assertEquals(emptyList<String>(), failures)
  }

  @Test fun parseProgressCases() {
    val file = Golden.load("src/progress/progress", "parseProgress")
    assertTrue(file.cases.isNotEmpty())
    val failures = file.cases.mapNotNull { c ->
      val got = parseProgress(raw(c))
      when {
        !exactly(got, progress(c.output)) -> "${c.name}: got $got"
        else -> null
      }
    }
    assertEquals(emptyList<String>(), failures)
  }
}
