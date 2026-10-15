package com.eienmosu.truthy.engine

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue
import kotlin.test.Test
import java.io.File
import kotlin.math.abs

class ContrastGoldenTest : CopyGoldenBase() {
    private val file = Golden.load("design/system/tokens", "contrastPairs")
    private val output = file.cases[0].output
    private val pairs = output.field("pairs").list()
    private val listed = output.field("listed").list()

    private val tokens: JsonObject by lazy {
        val golden = File(System.getProperty("truthy.golden") ?: throw AssertionError("the truthy.golden property is not set"))
        Json.parseToJsonElement(golden.parentFile.resolve("tokens/resolved.json").readText()).jsonObject
    }

    private fun tokenAt(path: String): JsonObject? {
        var node: JsonElement = tokens
        for (part in path.split(".")) node = (node as? JsonObject)?.get(part) ?: return null
        return node as? JsonObject
    }

    private fun hexOf(path: String, depth: Int = 0): String {
        if (depth > 8) throw AssertionError("a reference cycle at $path")
        val token = tokenAt(path) ?: throw AssertionError("the token $path does not exist")
        val value = token.getValue("\$value")
        if (value is JsonObject) return value.getValue("hex").jsonPrimitive.content
        val reference = Regex("^\\{([^{}]+)\\}\$").matchEntire(value.jsonPrimitive.content)
            ?: throw AssertionError("$path is neither a colour nor a reference")
        return hexOf(reference.groupValues[1], depth + 1)
    }

    private fun ownsNight(role: String): Boolean = tokenAt("color.night.$role") != null

    private fun colourOf(theme: String, role: String): String =
        if (theme == "night" && ownsNight(role)) hexOf("color.night.$role") else hexOf("color.day.$role")

    private fun listedRatio(theme: String, foreground: String, background: String): Double =
        listed.first {
            it.field("theme").text() == theme && it.field("foreground").text() == foreground && it.field("background").text() == background
        }.field("ratio").number()

    @Test
    fun `luminance and the contrast ratio follow WCAG 2`() {
        assertTrue(luminance("#000000") == 0.0)
        assertTrue(abs(luminance("#ffffff") - 1.0) < 1e-12)
        assertTrue(abs(contrastRatio("#000000", "#ffffff") - 21.0) < 1e-9)
        assertTrue(contrastRatio("#10233f", "#fdfbf5") == contrastRatio("#fdfbf5", "#10233f"))
        assertTrue(contrastRatio("#336699", "#336699") == 1.0)
        for (bad in listOf("#fff", "red", "#12345g", "10233f")) {
            assertFailsWith<IllegalArgumentException> { luminance(bad) }
        }
    }

    @Test
    fun `the vector holds the 27 pairs of the web test in both themes, day first, and all of them pass`() {
        assertEquals(54, pairs.size)
        assertTrue(pairs.take(27).all { it.field("theme").text() == "day" })
        assertTrue(pairs.drop(27).all { it.field("theme").text() == "night" })
        for (i in 0 until 27) {
            for (key in listOf("foreground", "background", "kind")) {
                assertEquals(pairs[i].field(key).text(), pairs[i + 27].field(key).text(), "pair $i $key")
            }
        }
        for (pair in pairs) {
            val where = "${pair.field("theme").text()} ${pair.field("foreground").text()} on ${pair.field("background").text()}"
            val minimum = pair.field("minimum").number()
            assertTrue(minimum == (if (pair.field("kind").text() == "body text") 4.5 else 3.0), "$where: minimum")
            assertTrue(pair.field("passes").flag(), "$where: passes")
            assertTrue(pair.field("ratio").number() >= minimum, "$where: ratio")
        }
        for (pair in pairs.take(27)) assertNull(pair.optional("ownsNight"), "a day pair has no ownsNight")
        for (pair in pairs.drop(27)) assertTrue(pair.field("ownsNight").flag(), "${pair.field("foreground").text()} on ${pair.field("background").text()}: ownsNight")
        val night = pairs.drop(27)
        val ink = night.first { it.field("foreground").text() == "ink" }.field("foregroundHex").text()
        val focus = night.first { it.field("foreground").text() == "focus" }.field("foregroundHex").text()
        assertEquals(ink, focus)
    }

    @Test
    fun `every recorded ratio is the WCAG ratio of its two recorded colours`() {
        for (entry in pairs + listed) {
            val where = "${entry.field("theme").text()} ${entry.field("foreground").text()} on ${entry.field("background").text()}"
            val ratio = contrastRatio(entry.field("foregroundHex").text(), entry.field("backgroundHex").text())
            assertTrue(entry.field("ratio").number() == roundToHundredth(ratio), "$where: ratio")
            val minimum = entry.optional("minimum")?.number()
            if (minimum != null) assertEquals(ratio >= minimum, entry.field("passes").flag(), "$where: passes")
        }
    }

    @Test
    fun `the ratios DESIGN-SYSTEM section 2 2 lists, and the two choices the decisions replaced`() {
        assertTrue(listedRatio("day", "ink", "surface-raised") == 15.21)
        assertTrue(listedRatio("day", "ink-muted", "sky-4") == 5.13)
        assertTrue(listedRatio("day", "on-accent", "accent") == 8.55)
        assertTrue(listedRatio("day", "ink-muted", "sky-1") == 3.78)
        assertTrue(listedRatio("day", "accent", "sky-3") == 1.56)
        val night = listOf(
            Triple("ink", "surface-raised", 10.48), Triple("ink", "surface-sunk", 11.83),
            Triple("ink-muted", "surface-raised", 5.35), Triple("ink-muted", "surface-sunk", 6.04),
            Triple("true", "surface-raised", 4.72), Triple("true", "surface-sunk", 5.33),
            Triple("false", "surface-raised", 4.94), Triple("correct", "surface-sunk", 6.24),
            Triple("correct", "surface-raised", 5.53), Triple("wrong", "surface-sunk", 5.58),
            Triple("on-dark", "true", 6.12), Triple("on-dark", "false", 6.4),
            Triple("on-dark", "ink", 13.59), Triple("on-accent", "accent", 7.79),
            Triple("ink", "sky-1", 14.2), Triple("ink-muted", "sky-1", 7.25),
            Triple("ink-muted", "sky-2", 6.76), Triple("accent", "sky-3", 7.16),
            Triple("accent", "sky-4", 6.99), Triple("ink-muted", "sky-3", 6.24),
            Triple("ink-muted", "sky-4", 6.09), Triple("rule", "surface-raised", 1.43),
        )
        assertEquals(22, night.size)
        for ((foreground, background, expected) in night) {
            assertTrue(listedRatio("night", foreground, background) == expected, "night $foreground on $background")
        }
        assertEquals(27, listed.size)
    }

    @Test
    fun `the recorded colours are the colours of the resolved tokens the generator reads`() {
        for (entry in pairs + listed) {
            val theme = entry.field("theme").text()
            for ((roleKey, hexKey) in listOf("foreground" to "foregroundHex", "background" to "backgroundHex")) {
                val role = entry.field(roleKey).text()
                assertEquals(colourOf(theme, role), entry.field(hexKey).text().lowercase(), "$theme $role")
            }
        }
        for (pair in pairs.drop(27)) {
            val expected = ownsNight(pair.field("foreground").text()) && ownsNight(pair.field("background").text())
            assertEquals(expected, pair.field("ownsNight").flag(), "${pair.field("foreground").text()} on ${pair.field("background").text()}")
        }
    }
}
