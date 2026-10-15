package com.eienmosu.truthy.tokengen

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

// The committed Tokens.kt against the real resolved.json. The two paths come from the Gradle build file
// (tokengen/build.gradle.kts) as system properties; nothing here knows where the checkout is.
class TokensFreshnessTest {
    private fun property(name: String): File =
        File(checkNotNull(System.getProperty(name)) { "system property $name is not set; run the test through Gradle" })

    private fun generated(): String = generateTokens(property("truthy.tokens.resolved").readText())

    // The lines of "    object <name> {" up to its closing "    }".
    private fun section(text: String, name: String): List<String> {
        val lines = text.lines()
        val start = lines.indexOf("    object $name {")
        require(start >= 0) { "no object $name in the generated file" }
        val end = lines.subList(start + 1, lines.size).indexOf("    }")
        require(end >= 0) { "object $name is not closed" }
        return lines.subList(start + 1, start + 1 + end)
    }

    private fun members(text: String, name: String): Int =
        section(text, name).count { it.startsWith("        val ") || it.startsWith("        const val ") }

    private fun classFields(text: String, header: String): Int {
        val lines = text.lines()
        val start = lines.indexOf(header)
        require(start >= 0) { "no $header" }
        val end = lines.subList(start + 1, lines.size).indexOf(")")
        return lines.subList(start + 1, start + 1 + end).count { it.startsWith("    val ") }
    }

    @Test
    fun theCommittedFileIsWhatTheGeneratorWrites() {
        val committed = property("truthy.tokens.committed")
        assertTrue("Tokens.kt is missing; run ./gradlew :tokengen:generateTokens", committed.isFile)
        assertEquals(
            "Tokens.kt is stale; run ./gradlew :tokengen:generateTokens and commit the result",
            generated(),
            committed.readText(),
        )
    }

    @Test
    fun theCodesOverridesReachTheConstants() {
        val lines = generated().lines()
        for (expected in listOf(
            // size.max-width: 430 in the code, 390 in the stale tokens.json (reference 5.0)
            "        val maxWidth = 430.dp",
            // typography.list-title: the destination card sets 1.25 itself (reference 5.3)
            "        val listTitle = TypeRole(family = FontKey.SANS, weight = 600, sizeSp = 16f, lineHeight = 1.25f, letterSpacingSp = -0.16f)",
            // the leave sheet: 360 ms ease both ways, no spring (reference 5.0)
            "        val sheetOpen = TransitionSpec(durationMs = 360, delayMs = 0, easing = Curves.ease)",
            "        val sheetClose = TransitionSpec(durationMs = 360, delayMs = 0, easing = Curves.ease)",
            // reference 5.1
            "            sky1 = Color(0xFFA9D6F0),",
            "            sky1 = Color(0xFF0B1528),",
            "            scrim = Color(0xFF10233F).copy(alpha = 0.32f),",
            "            scrim = Color(0xFF000000).copy(alpha = 0.6f),",
            // plan A's native group (reference 5.0 and 5.3)
            "        val skyStops: List<Float> = listOf(0f, 0.35f, 0.62f, 1f)",
            "        const val sheetReducedMs: Int = 140",
            "        val shortScreenBelow = 568.dp",
            "        val stepTitleRow = 36.dp",
            "            const val sourceLinkSize: Float = 13.5f",
        )) {
            assertTrue("missing: $expected", lines.contains(expected))
        }
        assertFalse("the stale frame width must not survive", lines.contains("        val maxWidth = 390.dp"))
    }

    @Test
    fun everyGroupOfTheTokensIsEmitted() {
        val text = generated()
        assertEquals(23, classFields(text, "class TruthyColors("))
        assertEquals(5, classFields(text, "class TruthyShadows("))
        assertEquals(11, members(text, "Space"))
        assertEquals(37, members(text, "Size"))
        assertEquals(5, members(text, "Radius"))
        assertEquals(7, members(text, "Stroke"))
        assertEquals(2, members(text, "Opacity"))
        assertEquals(25, members(text, "Duration"))
        assertEquals(5, members(text, "Curves"))
        assertEquals(3, members(text, "SpringTransitions"))
        assertEquals(15, members(text, "Transitions"))
        assertEquals(5, members(text, "Gesture"))
        assertEquals(35, members(text, "Type"))
        assertEquals(8, members(text, "Native"))
    }
}
