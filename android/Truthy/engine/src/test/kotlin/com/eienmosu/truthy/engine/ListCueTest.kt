package com.eienmosu.truthy.engine

import com.eienmosu.truthy.engine.support.asBoolean
import com.eienmosu.truthy.engine.support.asDouble
import com.eienmosu.truthy.engine.support.expectCases
import com.eienmosu.truthy.engine.support.field
import kotlin.math.abs
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.jsonArray

private fun decodeSpan(value: JsonElement): ItemSpan = ItemSpan(value.field("top").asDouble(), value.field("bottom").asDouble())

/** `count` cards of `height` with `gap` between them, the first at `first`, minus how far the list has scrolled. */
private fun cards(count: Int, height: Double, gap: Double, first: Double, scrollTop: Double = 0.0): List<ItemSpan> =
    (0 until count).map { i ->
        val top = first + i * (height + gap) - scrollTop
        ItemSpan(top, top + height)
    }

class ListCueTest {
    @Test
    fun theFadeLengthIsTheVector() {
        val golden = Golden.load("components/start/listCue", "FADE_PX")
        expectCases(golden.cases, 1)
        assertEquals(golden.cases.single().output.asDouble(), FADE_PX)
    }

    @Test
    fun listCueIsTheVector() {
        val golden = Golden.load("components/start/listCue", "listCue")
        expectCases(golden.cases, 52)
        for (item in golden.cases) {
            val actual =
                listCue(
                    item.input.field("viewHeight").asDouble(),
                    item.input.field("contentBottom").asDouble(),
                    item.input.field("items").jsonArray.map(::decodeSpan),
                )
            assertEquals(item.output.field("more").asBoolean(), actual.more, item.name)
            assertEquals(item.output.field("lift").asDouble(), actual.lift, item.name)
        }
    }

    @Test
    fun revealDeltaIsTheVector() {
        val golden = Golden.load("components/start/listCue", "revealDelta")
        expectCases(golden.cases, 12)
        for (item in golden.cases) {
            val actual = revealDelta(item.input.field("viewHeight").asDouble(), decodeSpan(item.input.field("item")), item.input.field("room").asDouble())
            assertEquals(item.output.asDouble(), actual, item.name)
        }
    }

    @Test
    fun theEndOfTheFadeMovesWithoutAJumpAsTheListScrolls() {
        // The web's own test: nine cards scrolled one pixel at a time from 0 to 300; the end of the fade moves at most 2 px per pixel.
        var previous: Double? = null
        for (scrollTop in 0..300) {
            val nine = cards(9, 90.0, 12.0, 6.0, scrollTop.toDouble())
            val end = 518.0 - listCue(518.0, nine.last().bottom, nine).lift
            val before = previous
            if (before != null) assertTrue(abs(end - before) <= 2.0, "the fade end jumped at scroll $scrollTop")
            previous = end
        }
    }
}
