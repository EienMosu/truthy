package com.eienmosu.truthy.engine

import com.eienmosu.truthy.engine.support.asBoolean
import com.eienmosu.truthy.engine.support.asInt
import com.eienmosu.truthy.engine.support.asString
import com.eienmosu.truthy.engine.support.decodeIndex
import com.eienmosu.truthy.engine.support.expectCases
import com.eienmosu.truthy.engine.support.field
import com.eienmosu.truthy.engine.support.isUndefined
import com.eienmosu.truthy.engine.support.modeOrNull
import com.eienmosu.truthy.engine.support.optionalField
import com.eienmosu.truthy.engine.support.optionalString
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject

/**
 * A choice as the vectors write it. A class that is not in the engine's four ("zen", stored by an older or a
 * broken build) decodes to no class at all: the web's canShow looks the class up in its table and finds nothing,
 * and `mode = null` is the same finding.
 */
private fun decodeChoice(value: JsonElement): StartChoice {
    val obj = value.jsonObject
    return StartChoice(
        via = obj.optionalString("via"),
        areaId = obj.optionalString("areaId"),
        platformId = obj.optionalString("platformId"),
        deckId = obj.optionalString("deckId"),
        sectionId = obj.optionalString("sectionId"),
        mode = obj.optionalString("mode")?.let(::modeOrNull),
    )
}

private fun keyOf(wire: String): ChoiceKey = ChoiceKey.entries.first { it.wire == wire }

private fun stepsOf(value: JsonElement): List<Step> = value.jsonArray.map { Step.of(it.asInt()) }

class StartStepsTest {
    @Test
    fun stepOfTableIsTheVector() {
        val golden = Golden.load("components/start/StartFlow", "STEP_OF")
        expectCases(golden.cases, 1)
        val expected = golden.cases.single().output.jsonObject.entries.associate { (wire, step) -> wire to step.asInt() }
        val actual = STEP_OF.entries.associate { (key, step) -> key.wire to step.number }
        assertEquals(expected, actual)
    }

    @Test
    fun stepOfIsTheVector() {
        val golden = Golden.load("components/start/StartFlow", "stepOf")
        expectCases(golden.cases, 14)
        for (item in golden.cases) {
            val actual = stepOf(keyOf(item.input.field("key").asString()), decodeChoice(item.input.field("choice")))
            assertEquals(Step.of(item.output.asInt()), actual, item.name)
        }
    }

    @Test
    fun clearFromIsTheVector() {
        val golden = Golden.load("components/start/StartFlow", "clearFrom")
        expectCases(golden.cases, 17)
        for (item in golden.cases) {
            val actual = clearFrom(decodeChoice(item.input.field("choice")), Step.of(item.input.field("step").asInt()))
            assertEquals(decodeChoice(item.output), actual, item.name)
        }
    }

    @Test
    fun pathToIsTheVector() {
        val golden = Golden.load("components/start/StartFlow", "pathTo")
        expectCases(golden.cases, 30)
        for (item in golden.cases) {
            val input = item.input.jsonObject
            val step = Step.of(input.getValue("step").asInt())
            val hasSections = input.getValue("hasSections").asBoolean()
            val recent = input.optionalField("recent")?.asBoolean()
            val actual = if (recent == null) pathTo(step, hasSections) else pathTo(step, hasSections, recent)
            assertEquals(stepsOf(item.output), actual, item.name)
        }
    }

    @Test
    fun previousStepIsTheVector() {
        val golden = Golden.load("components/start/StartFlow", "previousStep")
        expectCases(golden.cases, 24)
        for (item in golden.cases) {
            val input = item.input.jsonObject
            val step = Step.of(input.getValue("step").asInt())
            val hasSections = input.getValue("hasSections").asBoolean()
            val recent = input.optionalField("recent")?.asBoolean()
            val actual = if (recent == null) previousStep(step, hasSections) else previousStep(step, hasSections, recent)
            assertEquals(Step.of(item.output.asInt()), actual, item.name)
        }
    }

    @Test
    fun chosenOnIsTheVector() {
        val golden = Golden.load("components/start/StartFlow", "chosenOn")
        expectCases(golden.cases, 14)
        for (item in golden.cases) {
            val actual = chosenOn(Step.of(item.input.field("target").asInt()), decodeChoice(item.input.field("choice")))
            if (isUndefined(item.output)) {
                assertNull(actual, item.name)
            } else {
                assertEquals(item.output.asString(), actual, item.name)
            }
        }
    }

    @Test
    fun canShowIsTheVector() {
        val golden = Golden.load("components/start/StartFlow", "canShow")
        expectCases(golden.cases, 43)
        for (item in golden.cases) {
            val actual =
                canShow(
                    decodeIndex(item.input.field("index")),
                    Step.of(item.input.field("step").asInt()),
                    decodeChoice(item.input.field("choice")),
                    tableOf(item.input),
                )
            assertEquals(item.output.asBoolean(), actual, item.name)
        }
    }

    @Test
    fun aStepIsItsNumberAndNothingElse() {
        assertEquals(listOf(1, 2, 3, 4, 5, 6), Step.entries.map { it.number })
        for (step in Step.entries) assertEquals(step, Step.of(step.number))
        assertFailsWith<IllegalArgumentException> { Step.of(0) }
        assertFailsWith<IllegalArgumentException> { Step.of(7) }
        assertTrue(Step.TWO < Step.THREE && Step.FIVE >= Step.FIVE && Step.SIX > Step.ONE)
    }

    @Test
    fun aNewChoiceHasChosenNothing() {
        assertEquals(StartChoice(), clearFrom(StartChoice(via = RECENT, areaId = "cloud", mode = Mode.TIMED), Step.ONE))
    }
}
