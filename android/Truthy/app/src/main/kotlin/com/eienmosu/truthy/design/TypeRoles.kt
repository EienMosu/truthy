package com.eienmosu.truthy.design

import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontSynthesis
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.TextUnitType
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import kotlin.math.max
import kotlin.math.floor

/**
 * Overpass's own line height: hhea ascender 1766 plus descender 766 over 2000 units, the same in all four cuts
 * (TypeRolesTest reads it from the font files).
 */
const val OVERPASS_LINE_HEIGHT = 2532f / 2000f

// The browser puts the extra leading above and below the line; Center with no trim does the same.
private val LINES = LineHeightStyle(
    alignment = LineHeightStyle.Alignment.Center,
    trim = LineHeightStyle.Trim.None,
)

// A line height below the font's own: the browser's line box is still the line height, and the glyphs reach past it,
// half above and half below. Compose's default (Mode.Fixed) pads the first and last line back to the font's height,
// which made the logo, the leg code, the score and the 1.2 roles taller than on the web. Tight with both ends trimmed
// keeps every line, the first and the last included, at the line height.
private val TIGHT_LINES = LineHeightStyle(
    alignment = LineHeightStyle.Alignment.Center,
    trim = LineHeightStyle.Trim.Both,
    mode = LineHeightStyle.Mode.Tight,
)

/** The line style of a role: the web's line box, whether the line height is above or below the font's own. */
fun lineStyleFor(lineHeight: Float): LineHeightStyle = if (lineHeight < OVERPASS_LINE_HEIGHT) TIGHT_LINES else LINES

// Compose takes the ceiling of a line height in pixels (LineHeightStyleSpan), so a line height a hair under a whole
// pixel lands on that pixel and not on the next one.
private const val PIXEL_SLACK = 0.01f

/**
 * The line box the app draws for a line [exactPx] tall: the nearest whole pixel, at least one. The browser keeps a line
 * box at its fraction (a 15 px line is 39.375 device px at density 2.625) and lays the next element at the fraction;
 * Compose rounds every line up to a whole pixel, so a column of lines grew by up to a pixel per line and the ticket's head
 * drifted 3 dp down against the web (review X4). Rounded to the nearest pixel, each line is within half a pixel of the
 * browser's, up or down, and the column no longer adds the rounding up.
 */
fun pixelLineHeight(exactPx: Float): Float = max(1f, floor(exactPx + 0.5f))

/**
 * This style with its line height on the whole pixel nearest to the role's own (pixelLineHeight), at [density] and its
 * font scale. The line height is given in em of the font size in pixels, which Compose also uses under the non-linear
 * font scaling of Android 14 and later, so the role keeps its ratio at every scale. A style without a line height, or
 * with a font size that is not in sp, is returned as it is.
 */
fun TextStyle.onPixelLines(density: Density): TextStyle {
    if (fontSize.type != TextUnitType.Sp) return this
    val ratio = when (lineHeight.type) {
        TextUnitType.Sp -> lineHeight.value / fontSize.value
        TextUnitType.Em -> lineHeight.value
        else -> return this
    }
    val fontPx = with(density) { fontSize.toPx() }
    if (fontPx <= 0f) return this
    return copy(lineHeight = ((pixelLineHeight(ratio * fontPx) - PIXEL_SLACK) / fontPx).em)
}

/** The Compose style of a role. Sizes, line height and letter spacing are sp, so they follow the system font scale. */
fun TypeRole.toTextStyle(): TextStyle = TextStyle(
    fontFamily = family.family(),
    fontWeight = FontWeight(weight),
    fontSize = sizeSp.sp,
    lineHeight = (sizeSp * lineHeight).sp,
    letterSpacing = letterSpacingSp.sp,
    fontSynthesis = FontSynthesis.None,
    lineHeightStyle = lineStyleFor(lineHeight),
)

/**
 * The type roles the app draws (30 of the 35 in tokens.json) and the sizes the code draws them at that have no
 * role of their own (reference 5.0 and 5.3). Colour is never part of a style; the caller sets it.
 */
object TruthyType {
    val logo = Tokens.Type.logo.toTextStyle()
    val stepTitle = Tokens.Type.stepTitle.toTextStyle()
    val tagline = Tokens.Type.tagline.toTextStyle()
    val cardStatement = Tokens.Type.cardStatement.toTextStyle()
    val cardName = Tokens.Type.cardName.toTextStyle()
    val deckCode = Tokens.Type.deckCode.toTextStyle()
    val answerLabel = Tokens.Type.answerLabel.toTextStyle()
    val answerValue = Tokens.Type.answerValue.toTextStyle()
    val stamp = Tokens.Type.stamp.toTextStyle()
    val button = Tokens.Type.button.toTextStyle()
    val buttonQuiet = Tokens.Type.buttonQuiet.toTextStyle()
    val buttonBack = Tokens.Type.buttonBack.toTextStyle()
    val carrierTitle = Tokens.Type.carrierTitle.toTextStyle()
    val carrierLabel = Tokens.Type.carrierLabel.toTextStyle()
    val legCode = Tokens.Type.legCode.toTextStyle()
    val legName = Tokens.Type.legName.toTextStyle()
    val fieldLabel = Tokens.Type.fieldLabel.toTextStyle()
    val fieldValue = Tokens.Type.fieldValue.toTextStyle()
    val fieldValuePass = Tokens.Type.fieldValuePass.toTextStyle()
    val passLine = Tokens.Type.passLine.toTextStyle()
    val body = Tokens.Type.body.toTextStyle()
    val listTitle = Tokens.Type.listTitle.toTextStyle()
    val listStatement = Tokens.Type.listStatement.toTextStyle()
    val emphasis = Tokens.Type.emphasis.toTextStyle()
    val score = Tokens.Type.score.toTextStyle()
    val intentStamp = Tokens.Type.intentStamp.toTextStyle()
    val monoData = Tokens.Type.monoData.toTextStyle()
    val monoDataStrong = Tokens.Type.monoDataStrong.toTextStyle()
    val monoCaption = Tokens.Type.monoCaption.toTextStyle()
    val routeLabel = Tokens.Type.routeLabel.toTextStyle()

    // Every size and line height below comes from Tokens.Native.Type (plan A's native group), never from a literal.

    // The stamp role at the stub's size (Stamp.tsx) and at the result's New best size (ScoreBlock.tsx).
    val stampStub = Tokens.Type.stamp.copy(sizeSp = Tokens.Native.Type.stubStampSize).toTextStyle()
    val stampBest = Tokens.Type.stamp.copy(sizeSp = Tokens.Native.Type.newBestSize).toTextStyle()

    // The missed cards: the answer word is the emphasis role at 17, the explanation the body role at 15 (MissedCards.tsx).
    val missedAnswer = Tokens.Type.emphasis.copy(sizeSp = Tokens.Native.Type.missedAnswerSize).toTextStyle()
    val missedExplanation = Tokens.Type.body.copy(sizeSp = Tokens.Native.Type.missedExplanationSize).toTextStyle()

    // The compact pass band (FillInPass.tsx): the title at 14 keeps its px tracking; the label at 11 tracks 0.66,
    // tracking-[0.06em] at 11 px, not the role's 0.72 (the one variant whose tracking is its own).
    val carrierTitleCompact = Tokens.Type.carrierTitle.copy(sizeSp = Tokens.Native.Type.carrierCompactTitle).toTextStyle()
    val carrierLabelCompact = Tokens.Type.carrierLabel.copy(sizeSp = Tokens.Native.Type.carrierCompactLabel, letterSpacingSp = 0.66f).toTextStyle()

    // The source link: the strong mono data role at 13.5 (BoardingPass.tsx).
    val sourceLink = Tokens.Type.monoDataStrong.copy(sizeSp = Tokens.Native.Type.sourceLinkSize).toTextStyle()

    // The score's unit: the score role at 20 with no tracking (ScoreBlock.tsx).
    val scoreUnit = Tokens.Type.score.copy(sizeSp = Tokens.Native.Type.scoreUnitSize, letterSpacingSp = 0f).toTextStyle()

    // The Timed clock: the strong mono data role at 13 with tabular figures (TimedPath.tsx).
    val timedClock = Tokens.Type.monoDataStrong.copy(sizeSp = Tokens.Native.Type.timedClockSize).toTextStyle().copy(fontFeatureSettings = "tnum")

    // The card stub value: Mono 600 16 / 1.27 (DestinationCard.tsx). The pass code: Mono 600 16 / 1.2 with 0.02em (FillInPass.tsx).
    val stubValue = TypeRole(FontKey.MONO, 600, Tokens.Native.Type.stubValueSize, Tokens.Native.Type.stubValueLineHeight, 0f).toTextStyle()
    val passCode = TypeRole(FontKey.MONO, 600, 16f, 1.2f, 0.32f).toTextStyle()

    // The continue line's deck name: the emphasis role with line height 1.2 (ContinueLine.tsx).
    val continueDeckName = Tokens.Type.emphasis.copy(lineHeight = Tokens.Native.Type.continueDeckLineHeight).toTextStyle()
}
