package com.eienmosu.truthy.engine

import com.eienmosu.truthy.engine.GoldenDecode.bool
import com.eienmosu.truthy.engine.GoldenDecode.field
import com.eienmosu.truthy.engine.GoldenDecode.number
import com.eienmosu.truthy.engine.GoldenDecode.string
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.jsonArray

// native-data/golden/src.input.swipe.*.json: every case computed by src/input/swipe.ts.
class SwipeGoldenTest {
  private fun sample(value: JsonElement) =
    SwipeSample(x = number(field(value, "x")), y = number(field(value, "y")), t = number(field(value, "t")))

  private fun context(value: JsonElement) =
    SwipeContext(viewportWidth = number(field(value, "viewportWidth")), cardShownAt = number(field(value, "cardShownAt")))

  @Test fun swipeConstant() {
    val output = Golden.load("src/input/swipe", "SWIPE").cases.single().output
    val expected = SwipeConstants(
      commitPx = number(field(output, "commitPx")),
      flingPx = number(field(output, "flingPx")),
      flingVelocity = number(field(output, "flingVelocity")),
      settleMs = number(field(output, "settleMs")),
      edgePx = number(field(output, "edgePx")),
    )
    assertEquals(expected, SWIPE)
  }

  @Test fun intentCases() {
    val file = Golden.load("src/input/swipe", "intent")
    assertTrue(file.cases.isNotEmpty())
    val failures = file.cases.mapNotNull { c ->
      val got = intent(number(field(c.input, "dx")))
      val want = number(c.output)
      if (got.toRawBits() == want.toRawBits()) null else "${c.name}: got $got, want $want"
    }
    assertEquals(emptyList<String>(), failures)
  }

  @Test fun canStartCases() {
    val file = Golden.load("src/input/swipe", "canStart")
    assertTrue(file.cases.isNotEmpty())
    val failures = file.cases.mapNotNull { c ->
      val got = canStart(sample(field(c.input, "sample")), context(field(c.input, "context")))
      if (got == bool(c.output)) null else "${c.name}: got $got"
    }
    assertEquals(emptyList<String>(), failures)
  }

  @Test fun interpretCases() {
    val file = Golden.load("src/input/swipe", "interpret")
    assertTrue(file.cases.isNotEmpty())
    val failures = file.cases.mapNotNull { c ->
      val samples = field(c.input, "samples").jsonArray.map { sample(it) }
      val got = interpret(samples, context(field(c.input, "context")))
      if (got.wire == string(c.output)) null else "${c.name}: got ${got.wire}"
    }
    assertEquals(emptyList<String>(), failures)
  }
}
