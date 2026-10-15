package com.eienmosu.truthy.design

import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontSynthesis
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.unit.sp
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.nio.ByteBuffer

// The 30 roles the app uses, against reference 5.3 (size, weight, line height ratio) and tokens.json (letter
// spacing in px at the role's own size). list-title carries the code's 1.25.
class TypeRolesTest {
    private class Row(
        val name: String,
        val style: TextStyle,
        val sans: Boolean,
        val weight: Int,
        val size: Float,
        val lineHeight: Float,
        val tracking: Float,
    )

    private val rows = listOf(
        Row("logo", TruthyType.logo, true, 800, 36f, 1f, -0.9f),
        Row("step-title", TruthyType.stepTitle, true, 800, 22f, 1.27f, -0.33f),
        Row("tagline", TruthyType.tagline, true, 600, 17f, 1.4f, 0f),
        Row("card-statement", TruthyType.cardStatement, true, 600, 25f, 1.28f, -0.3f),
        Row("card-name", TruthyType.cardName, true, 800, 26f, 1.2f, -0.39f),
        Row("deck-code", TruthyType.deckCode, false, 600, 30f, 1.2f, 0.6f),
        Row("answer-label", TruthyType.answerLabel, true, 600, 13f, 1.2f, 0f),
        Row("answer-value", TruthyType.answerValue, true, 800, 26f, 1.27f, -0.26f),
        Row("stamp", TruthyType.stamp, true, 800, 24f, 1.27f, -0.24f),
        Row("button", TruthyType.button, true, 800, 20f, 1.27f, -0.2f),
        Row("button-quiet", TruthyType.buttonQuiet, true, 800, 16f, 1.27f, -0.16f),
        Row("button-back", TruthyType.buttonBack, true, 800, 15f, 1.27f, -0.15f),
        Row("carrier-title", TruthyType.carrierTitle, true, 800, 16f, 1.27f, -0.16f),
        Row("carrier-label", TruthyType.carrierLabel, false, 600, 12f, 1.27f, 0.72f),
        Row("leg-code", TruthyType.legCode, false, 600, 34f, 1f, 0.68f),
        Row("leg-name", TruthyType.legName, true, 600, 12f, 1.25f, 0f),
        Row("field-label", TruthyType.fieldLabel, false, 400, 10.5f, 1.27f, 0.42f),
        Row("field-value", TruthyType.fieldValue, false, 600, 15f, 1.27f, 0f),
        Row("field-value-pass", TruthyType.fieldValuePass, true, 800, 16f, 1.2f, -0.16f),
        Row("pass-line", TruthyType.passLine, true, 600, 13f, 1.69f, 0f),
        Row("body", TruthyType.body, true, 600, 15.5f, 1.45f, 0f),
        Row("list-title", TruthyType.listTitle, true, 600, 16f, 1.25f, -0.16f),
        Row("list-statement", TruthyType.listStatement, true, 600, 16f, 1.38f, -0.08f),
        Row("emphasis", TruthyType.emphasis, true, 800, 16f, 1.27f, -0.16f),
        Row("score", TruthyType.score, false, 600, 48f, 1f, 0.96f),
        Row("intent-stamp", TruthyType.intentStamp, false, 600, 26f, 1.27f, 0.52f),
        Row("mono-data", TruthyType.monoData, false, 400, 12f, 1.27f, 0f),
        Row("mono-data-strong", TruthyType.monoDataStrong, false, 600, 13f, 1.27f, 0f),
        Row("mono-caption", TruthyType.monoCaption, false, 400, 11f, 1.27f, 0.44f),
        Row("route-label", TruthyType.routeLabel, false, 400, 11f, 1.27f, 0f),
    )

    private fun family(sans: Boolean): FontFamily = if (sans) OverpassSans else OverpassMono

    @Test
    fun theThirtyUsedRolesMatchReference53() {
        assertEquals(30, rows.size)
        for (row in rows) {
            val style = row.style
            assertSame(row.name, family(row.sans), style.fontFamily)
            assertEquals(row.name, FontWeight(row.weight), style.fontWeight)
            assertEquals(row.name, row.size.sp, style.fontSize)
            assertEquals(row.name, (row.size * row.lineHeight).sp, style.lineHeight)
            assertEquals(row.name, row.tracking.sp, style.letterSpacing)
        }
    }

    // A role drawn at another size keeps its px letter spacing and its line height ratio (reference 5.3),
    // as the web's text-[28px] with the role's leading and tracking tokens does.
    @Test
    fun variantsKeepTheRolesPxTrackingAndScaleItsLineHeight() {
        val stub = TruthyType.stampStub
        assertEquals(28f.sp, stub.fontSize)
        assertEquals((28f * 1.27f).sp, stub.lineHeight)
        assertEquals((-0.24f).sp, stub.letterSpacing)
        assertEquals(FontWeight(800), stub.fontWeight)

        assertEquals(22f.sp, TruthyType.stampBest.fontSize)
        assertEquals(17f.sp, TruthyType.missedAnswer.fontSize)
        assertEquals(800, TruthyType.missedAnswer.fontWeight?.weight)
        assertEquals(15f.sp, TruthyType.missedExplanation.fontSize)
        assertEquals((15f * 1.45f).sp, TruthyType.missedExplanation.lineHeight)
        assertEquals(14f.sp, TruthyType.carrierTitleCompact.fontSize)
        assertEquals((-0.16f).sp, TruthyType.carrierTitleCompact.letterSpacing)
        assertEquals(11f.sp, TruthyType.carrierLabelCompact.fontSize)
        assertEquals(0.66f.sp, TruthyType.carrierLabelCompact.letterSpacing)
        assertEquals(13.5f.sp, TruthyType.sourceLink.fontSize)
        assertSame(OverpassMono, TruthyType.sourceLink.fontFamily)
        assertEquals(20f.sp, TruthyType.scoreUnit.fontSize)
        assertEquals(0f.sp, TruthyType.scoreUnit.letterSpacing)
        assertEquals(13f.sp, TruthyType.timedClock.fontSize)
        assertEquals("tnum", TruthyType.timedClock.fontFeatureSettings)
        assertEquals((16f * 1.27f).sp, TruthyType.stubValue.lineHeight)
        assertSame(OverpassMono, TruthyType.stubValue.fontFamily)
        assertEquals(0.32f.sp, TruthyType.passCode.letterSpacing)
        assertEquals((16f * 1.2f).sp, TruthyType.passCode.lineHeight)
        assertEquals((16f * 1.2f).sp, TruthyType.continueDeckName.lineHeight)
        assertEquals((-0.16f).sp, TruthyType.continueDeckName.letterSpacing)
    }

    @Test
    fun noStyleSynthesisesAWeightOrASlant() {
        val styles = rows.map { it.style } + listOf(
            TruthyType.stampStub, TruthyType.stampBest, TruthyType.missedAnswer, TruthyType.missedExplanation,
            TruthyType.carrierTitleCompact, TruthyType.carrierLabelCompact, TruthyType.sourceLink, TruthyType.scoreUnit,
            TruthyType.timedClock, TruthyType.stubValue, TruthyType.passCode, TruthyType.continueDeckName,
        )
        assertTrue(styles.all { it.fontSynthesis == FontSynthesis.None })
    }

    // A line height below Overpass's own (1.266) keeps the web's line box: Tight, both ends trimmed, so Compose does
    // not pad the first and last line back to the font's height. At or above it, the leading goes above and below.
    @Test
    fun aLineHeightBelowTheFontsOwnKeepsTheLineBox() {
        val tight = LineHeightStyle(LineHeightStyle.Alignment.Center, LineHeightStyle.Trim.Both, LineHeightStyle.Mode.Tight)
        val open = LineHeightStyle(LineHeightStyle.Alignment.Center, LineHeightStyle.Trim.None)
        for (row in rows) {
            val expected = if (row.lineHeight < 1.266f) tight else open
            assertEquals(row.name, expected, row.style.lineHeightStyle)
        }
        val tightRoles = rows.filter { it.style.lineHeightStyle == tight }.map { it.name }
        assertEquals(
            listOf("logo", "card-name", "deck-code", "answer-label", "leg-code", "leg-name", "field-value-pass", "list-title", "score"),
            tightRoles,
        )
        assertEquals(tight, TruthyType.passCode.lineHeightStyle)
        assertEquals(tight, TruthyType.continueDeckName.lineHeightStyle)
        assertEquals(open, TruthyType.stubValue.lineHeightStyle)
        assertEquals(open, TruthyType.missedExplanation.lineHeightStyle)
    }

    // The constant is the fonts' own: (hhea ascender - descender) / unitsPerEm, the same in the four cuts.
    @Test
    fun overpassLineHeightIsReadFromTheFonts() {
        for (name in listOf("overpass_600", "overpass_800", "overpass_mono_400", "overpass_mono_600")) {
            val data = ByteBuffer.wrap(File("src/main/res/font/$name.ttf").readBytes())
            val tables = (0 until (data.getShort(4).toInt() and 0xFFFF)).associate { index ->
                val record = 12 + 16 * index
                String(ByteArray(4) { data.get(record + it) }, Charsets.US_ASCII) to data.getInt(record + 8)
            }
            val unitsPerEm = data.getShort(tables.getValue("head") + 18).toInt() and 0xFFFF
            val hhea = tables.getValue("hhea")
            val ascender = data.getShort(hhea + 4).toInt()
            val descender = data.getShort(hhea + 6).toInt()
            assertEquals(name, OVERPASS_LINE_HEIGHT, (ascender - descender).toFloat() / unitsPerEm, 0f)
        }
    }

    // 35 roles are defined, 30 used (reference 5.0). The five unused ones stay in the tokens, undrawn.
    @Test
    fun theUnusedRolesStayInTheTokensOnly() {
        assertEquals(24f, Tokens.Type.screenTitle.sizeSp)
        assertEquals(14f, Tokens.Type.bodySmall.sizeSp)
        assertEquals(18f, Tokens.Type.optionTitle.sizeSp)
        assertEquals(18f, Tokens.Type.sectionCode.sizeSp)
        assertEquals(12f, Tokens.Type.sheetTitle.sizeSp)
    }
}
