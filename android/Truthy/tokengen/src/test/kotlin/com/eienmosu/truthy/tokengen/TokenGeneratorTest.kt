package com.eienmosu.truthy.tokengen

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class TokenGeneratorTest {
    private fun fixture(): String {
        val stream = checkNotNull(javaClass.getResourceAsStream("/tokens-fixture.json")) { "tokens-fixture.json is missing" }
        return stream.use { it.readBytes().toString(Charsets.UTF_8) }
    }

    private fun generated(): String = generateTokens(fixture())

    private fun failureOf(json: String): String {
        try {
            generateTokens(json)
        } catch (error: TokenException) {
            return error.message.orEmpty()
        }
        throw AssertionError("expected a TokenException")
    }

    private fun String.replaceLast(old: String, replacement: String): String {
        val at = lastIndexOf(old)
        require(at >= 0) { "$old does not occur" }
        return substring(0, at) + replacement + substring(at + old.length)
    }

    private fun block(vararg lines: String): String = lines.joinToString("\n") + "\n"

    @Test
    fun writesTheColoursOfBothThemesAndNamesTheKeywordRolesWithAColorSuffix() {
        val text = generated()
        assertTrue(text, text.contains(block(
            "@Immutable",
            "class TruthyColors(",
            "    val ink: Color,",
            "    val trueColor: Color,",
            "    val scrim: Color,",
            ")",
        )))
        assertTrue(text, text.contains(block(
            "        val day = TruthyColors(",
            "            ink = Color(0xFF10233F),",
            "            trueColor = Color(0xFFFDFBF5),",
            "            scrim = Color(0xFF10233F).copy(alpha = 0.32f),",
            "        )",
            "        val night = TruthyColors(",
            "            ink = Color(0xFFFDFBF5),",
            "            trueColor = Color(0xFF10233F),",
            "            scrim = Color(0xFF000000).copy(alpha = 0.6f),",
            "        )",
        )))
    }

    @Test
    fun writesDimensionsAsDpAndNumbersAsFloats() {
        val text = generated()
        for (line in listOf(
            "        val s2 = 2.dp",
            "        val maxWidth = 430.dp",
            "        val gutter = 16.dp",
            "        val card = 8.dp",
            "        val rule = 1.5.dp",
            "        const val disabled = 0.45f",
            "        val commitDistance = 90.dp",
            "        const val rotationDivisor = 18f",
        )) {
            assertTrue("missing: $line", text.lines().contains(line))
        }
    }

    @Test
    fun writesDurationsInWholeMillisecondsAndCurvesAndTransitions() {
        val text = generated()
        for (line in listOf(
            "        const val t1 = 120",
            "        const val stepEnter = 240",
            "        const val tick = 500",
            "        val ease = CubicBezierEasing(0.2f, 0.7f, 0.2f, 1f)",
            "        val spring = CubicBezierEasing(0.34f, 1.56f, 0.64f, 1f)",
            "        val snap = TransitionSpec(durationMs = 120, delayMs = 0, easing = Curves.spring)",
            "        val press = TransitionSpec(durationMs = 120, delayMs = 240, easing = Curves.ease)",
            "        val custom = TransitionSpec(durationMs = 80, delayMs = 0, easing = CubicBezierEasing(0.1f, 0.2f, 0.3f, 0.4f))",
        )) {
            assertTrue("missing: $line", text.lines().contains(line))
        }
    }

    @Test
    fun writesTypeRolesWithTheirPxLetterSpacingAndLineHeightRatio() {
        val text = generated()
        assertTrue(text.lines().contains("        val logo = TypeRole(family = FontKey.SANS, weight = 800, sizeSp = 36f, lineHeight = 1f, letterSpacingSp = -0.9f)"))
        assertTrue(text.lines().contains("        val carrierLabel = TypeRole(family = FontKey.MONO, weight = 600, sizeSp = 12f, lineHeight = 1.27f, letterSpacingSp = 0.72f)"))
    }

    @Test
    fun writesShadowsAsLayersWithNegativeSpread() {
        val text = generated()
        assertTrue(text.contains("ShadowLayer(offsetX = 0.dp, offsetY = 22.dp, blur = 36.dp, spread = -18.dp, color = Color(0xFF10233F).copy(alpha = 0.45f)),"))
        assertTrue(text.contains("ShadowLayer(offsetX = 0.dp, offsetY = 22.dp, blur = 36.dp, spread = -18.dp, color = Color(0xFF000000).copy(alpha = 0.75f)),"))
        assertTrue(text.contains(block(
            "@Immutable",
            "class TruthyShadows(",
            "    val ticket: ShadowSpec,",
            "    val press: ShadowSpec,",
            ")",
        )))
        assertTrue(text.contains("ShadowLayer(offsetX = 0.dp, offsetY = 1.dp, blur = 0.dp, spread = 0.dp, color = Color(0xFF10233F).copy(alpha = 0.1f)),"))
    }

    @Test
    fun writesTheNativeGroupAsTokensNative() {
        val text = generated()
        assertTrue(text, text.contains(block(
            "    object Native {",
            "        val skyStops: List<Float> = listOf(0f, 0.35f, 0.62f, 1f)",
            "        val sheetOffsetY = 24.dp",
            "        const val sheetReducedMs: Int = 140",
            "        val sheetMinWidth = 320.dp",
            "        val shortScreenBelow = 568.dp",
            "        val shortSafeTop = 8.dp",
            "        val shortSafeBottom = 12.dp",
            "        val stepTitleRow = 36.dp",
            "        object Type {",
            "            const val stubStampSize: Float = 28f",
            "            const val newBestSize: Float = 22f",
            "            const val missedExplanationSize: Float = 15f",
            "            const val missedAnswerSize: Float = 17f",
            "            const val carrierCompactTitle: Float = 14f",
            "            const val carrierCompactLabel: Float = 11f",
            "            const val sourceLinkSize: Float = 13.5f",
            "            const val scoreUnitSize: Float = 20f",
            "            const val timedClockSize: Float = 13f",
            "            const val stubValueSize: Float = 16f",
            "            const val stubValueLineHeight: Float = 1.27f",
            "            const val continueDeckLineHeight: Float = 1.2f",
            "        }",
            "    }",
            "}",
        )))
    }

    @Test
    fun failsWhenTheNativeGroupIsMissingOrAValueIsNotANumber() {
        val missing = failureOf(fixture().replace("\"native\"", "\"natives\""))
        assertTrue(missing, missing.contains("Required token group native is missing"))
        val text = failureOf(fixture().replace("\"step-title-row\": 36", "\"step-title-row\": \"36\""))
        assertTrue(text, text.contains("native.step-title-row has a value that is not a plain decimal number"))
        val gone = failureOf(fixture().replace("\"timed-clock-size\": 13,", ""))
        assertTrue(gone, gone.contains("Required value native.type.timed-clock-size is missing"))
    }

    @Test
    fun startsWithTheGeneratedHeaderAndEndsWithOneNewline() {
        val text = generated()
        assertTrue(text.startsWith("// Generated by :tokengen from native-data/tokens/resolved.json. Do not edit by hand.\n"))
        assertTrue(text.contains("\npackage com.eienmosu.truthy.design\n"))
        assertTrue(text.endsWith("}\n"))
        assertFalse(text.endsWith("\n\n"))
        assertTrue("no trailing spaces", text.lines().none { it != it.trimEnd() })
        assertFalse("no em dash", text.contains('\u2014'))
    }

    @Test
    fun writesTheSameTextTwice() {
        assertEquals(generated(), generated())
    }

    @Test
    fun failsOnAReferenceToATokenThatDoesNotExist() {
        val message = failureOf(fixture().replace("{color.primitive.cream}", "{color.primitive.nope}"))
        assertTrue(message, message.contains("refers to {color.primitive.nope}, which does not exist"))
    }

    @Test
    fun failsOnAReferenceToAGroup() {
        val message = failureOf(fixture().replace("{color.primitive.cream}", "{color.primitive}"))
        assertTrue(message, message.contains("which is a group, not a token"))
    }

    @Test
    fun failsOnACircularReference() {
        val message = failureOf(fixture().replace("{color.primitive.navy}", "{color.day.ink}"))
        assertTrue(message, message.contains("has a circular reference"))
    }

    @Test
    fun failsOnAMalformedReference() {
        val message = failureOf(fixture().replace("{color.primitive.cream}", "{color.primitive.cream"))
        assertTrue(message, message.contains("has a malformed reference"))
    }

    @Test
    fun failsWhenTheNightGroupDoesNotMatchTheDayGroup() {
        val message = failureOf(fixture().replaceLast("\"scrim\"", "\"scrimmed\""))
        assertTrue(message, message.contains("color.night is missing scrim"))
    }

    @Test
    fun failsOnAColourSpaceOtherThanSrgb() {
        val message = failureOf(fixture().replace("\"srgb\"", "\"display-p3\""))
        assertTrue(message, message.contains("only srgb is supported"))
    }

    @Test
    fun failsOnADimensionUnitOtherThanPx() {
        val message = failureOf(fixture().replace("\"value\": 16, \"unit\": \"px\"", "\"value\": 1, \"unit\": \"rem\""))
        assertTrue(message, message.contains("dimension unit rem, expected px"))
    }

    @Test
    fun failsOnATokenNamedLikeAKotlinKeywordOutsideTheColours() {
        val message = failureOf(fixture().replace("\"gutter\"", "\"object\""))
        assertTrue(message, message.contains("Kotlin keyword object"))
    }

    @Test
    fun failsOnATokenNameThatIsNotLowercaseWithHyphens() {
        val message = failureOf(fixture().replace("\"max-width\"", "\"maxWidth\""))
        assertTrue(message, message.contains("lowercase letters, digits and hyphens"))
    }
}
