package com.eienmosu.truthy.engine

import com.eienmosu.truthy.engine.support.asBoolean
import com.eienmosu.truthy.engine.support.asInt
import com.eienmosu.truthy.engine.support.asString
import com.eienmosu.truthy.engine.support.expectCases
import com.eienmosu.truthy.engine.support.field
import com.eienmosu.truthy.engine.support.modeOf
import com.eienmosu.truthy.engine.support.thrownMessage
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray

/** A class row as the vectors write it. */
fun decodeModeInfo(value: JsonElement): ModeInfo =
    ModeInfo(
        id = modeOf(value.field("id").asString()),
        name = value.field("name").asString(),
        description = value.field("description").asString(),
        unit = value.field("unit").asString(),
        offered = value.field("offered").asBoolean(),
    )

/** The table a case ran on: its `modeTable` when it closed a class, else the real table. */
fun tableOf(input: JsonElement): List<ModeInfo> =
    (input as JsonObject)["modeTable"]?.jsonArray?.map(::decodeModeInfo) ?: MODE_TABLE

class ClassTableTest {
    @Test
    fun theTableIsTheVector() {
        val golden = Golden.load("src/app-state/modes", "MODE_TABLE")
        expectCases(golden.cases, 1)
        val expected = golden.cases.single().output.jsonArray.map(::decodeModeInfo)
        assertEquals(expected, MODE_TABLE)
    }

    @Test
    fun modeInfoIsTheVector() {
        val golden = Golden.load("src/app-state/modes", "modeInfo")
        expectCases(golden.cases, 6)
        for (item in golden.cases) {
            val wire = item.input.field("mode").asString()
            val message = thrownMessage(item.output)
            if (message != null) {
                val error = assertFailsWith<IllegalArgumentException>(item.name) { modeInfo(wire) }
                assertEquals(message, error.message, item.name)
            } else {
                assertEquals(decodeModeInfo(item.output), modeInfo(wire), item.name)
                assertEquals(decodeModeInfo(item.output), modeInfo(modeOf(wire)), item.name)
            }
        }
    }

    @Test
    fun isOfferedIsTheVector() {
        val golden = Golden.load("src/app-state/modes", "isOffered")
        expectCases(golden.cases, 9)
        for (item in golden.cases) {
            val wire = item.input.field("mode").asString()
            val table = tableOf(item.input)
            val message = thrownMessage(item.output)
            if (message != null) {
                val error = assertFailsWith<IllegalArgumentException>(item.name) { isOffered(wire, table) }
                assertEquals(message, error.message, item.name)
            } else {
                assertEquals(item.output.asBoolean(), isOffered(wire, table), item.name)
                assertEquals(item.output.asBoolean(), isOffered(modeOf(wire), table), item.name)
            }
        }
    }

    @Test
    fun lastScoreTextIsTheVector() {
        val golden = Golden.load("src/app-state/modes", "lastScoreText")
        expectCases(golden.cases, 10)
        for (item in golden.cases) {
            val mode = modeOf(item.input.field("mode").asString())
            val actual = lastScoreText(mode, item.input.field("score").asInt(), item.input.field("total").asInt())
            assertEquals(item.output.asString(), actual, item.name)
        }
    }

    @Test
    fun aTableWithoutTheRowThrowsTheWebsMessage() {
        val error = assertFailsWith<IllegalArgumentException> { modeInfo(Mode.STREAK, emptyList()) }
        assertEquals("Unknown mode \"streak\".", error.message)
        assertTrue(MODE_TABLE.all { it.offered }, "the real table offers all four classes")
    }
}
