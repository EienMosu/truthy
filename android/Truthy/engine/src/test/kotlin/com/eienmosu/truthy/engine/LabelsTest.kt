package com.eienmosu.truthy.engine

import com.eienmosu.truthy.engine.support.asBoolean
import com.eienmosu.truthy.engine.support.asString
import com.eienmosu.truthy.engine.support.expectCases
import com.eienmosu.truthy.engine.support.field
import com.eienmosu.truthy.engine.support.optionalField
import com.eienmosu.truthy.engine.support.optionalString
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlinx.serialization.json.jsonObject

class LabelsTest {
    @Test
    fun changeLabelIsTheVector() {
        val golden = Golden.load("components/FillInPass", "changeLabel")
        expectCases(golden.cases, 8)
        for (item in golden.cases) {
            val wire = item.input.field("field").asString()
            val field = PassFieldName.entries.first { it.wire == wire }
            assertEquals(item.output.asString(), changeLabel(field, item.input.field("value").asString()), item.name)
        }
    }

    @Test
    fun continueLabelIsTheVector() {
        val golden = Golden.load("components/start/ContinueLine", "continueLabel")
        expectCases(golden.cases, 13)
        for (item in golden.cases) {
            val props = item.input.field("props").jsonObject
            val needsConnection = props.optionalField("needsConnection")?.asBoolean()
            val actual =
                if (needsConnection == null) {
                    continueLabel(props.getValue("deckName").asString(), props.getValue("sectionTitle").asString(), props.getValue("modeLabel").asString(), props.optionalString("lastScore"))
                } else {
                    continueLabel(props.getValue("deckName").asString(), props.getValue("sectionTitle").asString(), props.getValue("modeLabel").asString(), props.optionalString("lastScore"), needsConnection)
                }
            assertEquals(item.output.asString(), actual, item.name)
        }
    }

    @Test
    fun theClassFieldIsCalledClassOnTheLabel() {
        assertEquals("Change class, now Three lives", changeLabel(PassFieldName.MODE, "Three lives"))
        assertEquals("Change section, now Whole deck", changeLabel(PassFieldName.SECTION, "Whole deck"))
    }
}
