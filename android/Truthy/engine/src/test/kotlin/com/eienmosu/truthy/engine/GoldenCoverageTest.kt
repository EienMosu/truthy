package com.eienmosu.truthy.engine

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test

// Spec 7.1: every file in native-data/golden is consumed, and a vector the suite skips is a failing test.
// Which files the suite consumes is read from the test sources: every Golden.load call with two string literals.

/** Off until every ported module has its golden tests; task 6 turns it on, and from then on a golden file
 * without a test fails the suite. */
private const val EVERY_FILE_REQUIRED = true

private val LOAD_CALL = Regex("""Golden\.load\("([^"]+)", "([^"]+)"\)""")

private fun consumedFileNames(): Set<String> =
    Golden.testsDirectory.walkTopDown()
        .filter { it.isFile && it.extension == "kt" }
        .flatMap { file -> LOAD_CALL.findAll(file.readText()).map { Golden.fileName(it.groupValues[1], it.groupValues[2]) } }
        .toSet()

private fun cardReferences(value: JsonElement): List<String> {
    val tag = tagOf(value)
    if (tag != null && tag.first == CARD_TAG) return listOfNotNull((tag.second as? JsonPrimitive)?.content)
    return when (value) {
        is JsonArray -> value.flatMap(::cardReferences)
        is JsonObject -> value.values.flatMap(::cardReferences)
        else -> emptyList()
    }
}

class GoldenCoverageTest {
    @Test
    fun everyGoldenFileIsWellFormed() {
        val names = Golden.fileNames()
        assertTrue("native-data/golden is empty: run plan A first", names.isNotEmpty())
        for (name in names) {
            val golden = Golden.decodeFile(Golden.directory.resolve(name))
            assertEquals("$name: format", 1, golden.format)
            assertEquals("$name: module and function", name, Golden.fileName(golden.module, golden.function))
            assertTrue("$name: no cases", golden.cases.isNotEmpty())
            assertEquals("$name: two cases share a name", golden.cases.size, golden.cases.map { it.name }.toSet().size)
            for ((id, card) in golden.cards) {
                assertEquals("$name: card table entry $id", id, golden.decode<Card>(card).id)
            }
            for (case in golden.cases) {
                for (id in cardReferences(case.input) + cardReferences(case.output)) {
                    assertTrue("$name, ${case.name}: card $id is not in the table", golden.cards.containsKey(id))
                }
            }
        }
    }

    @Test
    fun everyFileTheSuiteLoadsExists() {
        val consumed = consumedFileNames()
        assertTrue("the scan found no Golden.load call", consumed.size >= 2)
        assertEquals(emptyList<String>(), (consumed - Golden.fileNames().toSet()).sorted())
    }

    @Test
    fun everyGoldenFileHasATest() {
        assumeTrue("task 6 turns this check on", EVERY_FILE_REQUIRED)
        assertEquals(emptyList<String>(), (Golden.fileNames().toSet() - consumedFileNames()).sorted())
    }

    /** A load through a variable or a helper parameter is invisible to the scan, so its file would count as untested. */
    @Test
    fun everyLoadCallNamesItsFileWithTwoLiterals() {
        val loose = Golden.testsDirectory.walkTopDown()
            .filter { it.isFile && it.extension == "kt" && it.name != "Golden.kt" && it.name != "GoldenCoverageTest.kt" }
            .flatMap { file -> file.readLines().filter { "Golden.load(" in it && !LOAD_CALL.containsMatchIn(it) }.map { file.name + ": " + it.trim() } }
            .toList()
        assertEquals(emptyList<String>(), loose)
    }

    /** Plan A's registry refuses two paths equal ignoring case; this keeps the Kotlin side honest about it too. */
    @Test
    fun noTwoGoldenFilesDifferOnlyInCase() {
        val names = Golden.fileNames()
        assertEquals(names.size, names.map { it.lowercase() }.toSet().size)
    }
}
