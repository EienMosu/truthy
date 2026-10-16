package com.eienmosu.truthy.design

import androidx.compose.material3.LocalContentColor
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.takeOrElse
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.foundation.text.BasicText as FoundationBasicText

// Every text of the app goes through this file: TruthyText, Text (material3's parameters) and BasicText (foundation's
// parameters). Each draws its style with the line height on a whole pixel (onPixelLines), so a column of lines adds up
// as the browser's does (TextRoutesTest keeps the other text composables out of the app). No text is selectable
// (spec section 2), which BasicText gives without a SelectionContainer.

@Composable
private fun TextStyle.onPixelLines(): TextStyle {
    val density = LocalDensity.current
    return remember(this, density) { onPixelLines(density) }
}

/** Text without Material's content colour and text style locals: a type role from TruthyType and a colour from the theme. */
@Composable
fun TruthyText(
    text: String,
    style: TextStyle,
    color: Color,
    modifier: Modifier = Modifier,
    textAlign: TextAlign? = null,
    maxLines: Int = Int.MAX_VALUE,
    overflow: TextOverflow = TextOverflow.Clip,
) {
    FoundationBasicText(
        text = text,
        modifier = modifier,
        style = (if (textAlign == null) style.copy(color = color) else style.copy(color = color, textAlign = textAlign)).onPixelLines(),
        overflow = overflow,
        maxLines = maxLines,
    )
}

@Composable
fun TruthyText(
    text: AnnotatedString,
    style: TextStyle,
    color: Color,
    modifier: Modifier = Modifier,
    textAlign: TextAlign? = null,
    maxLines: Int = Int.MAX_VALUE,
    overflow: TextOverflow = TextOverflow.Clip,
) {
    FoundationBasicText(
        text = text,
        modifier = modifier,
        style = (if (textAlign == null) style.copy(color = color) else style.copy(color = color, textAlign = textAlign)).onPixelLines(),
        overflow = overflow,
        maxLines = maxLines,
    )
}

/** material3's Text with the parameters the app passes, the colour resolved as material3 resolves it. */
@Composable
fun Text(
    text: String,
    modifier: Modifier = Modifier,
    color: Color = Color.Unspecified,
    textAlign: TextAlign? = null,
    overflow: TextOverflow = TextOverflow.Clip,
    softWrap: Boolean = true,
    maxLines: Int = Int.MAX_VALUE,
    style: TextStyle,
) {
    val ink = color.takeOrElse { style.color.takeOrElse { LocalContentColor.current } }
    FoundationBasicText(
        text = text,
        modifier = modifier,
        style = style.merge(color = ink, textAlign = textAlign ?: TextAlign.Unspecified).onPixelLines(),
        overflow = overflow,
        softWrap = softWrap,
        maxLines = maxLines,
    )
}

@Composable
fun Text(
    text: AnnotatedString,
    modifier: Modifier = Modifier,
    color: Color = Color.Unspecified,
    textAlign: TextAlign? = null,
    overflow: TextOverflow = TextOverflow.Clip,
    softWrap: Boolean = true,
    maxLines: Int = Int.MAX_VALUE,
    style: TextStyle,
) {
    val ink = color.takeOrElse { style.color.takeOrElse { LocalContentColor.current } }
    FoundationBasicText(
        text = text,
        modifier = modifier,
        style = style.merge(color = ink, textAlign = textAlign ?: TextAlign.Unspecified).onPixelLines(),
        overflow = overflow,
        softWrap = softWrap,
        maxLines = maxLines,
    )
}

/** foundation's BasicText with the parameters the app passes: the colour is the style's. */
@Composable
fun BasicText(text: String, modifier: Modifier = Modifier, style: TextStyle) {
    FoundationBasicText(text = text, modifier = modifier, style = style.onPixelLines())
}

/**
 * The web's underlined link text, <u className="decoration-[1.5px] underline-offset-[3px]"> (BoardingPass.tsx,
 * MissedCards.tsx): a line THICKNESS_DP thick whose top is OFFSET_DP below the baseline, clear of the descenders.
 * The font's own underline, a text decoration, is thinner and closer, through the descenders.
 */
object WebUnderline {
    const val THICKNESS_DP = 1.5f
    const val OFFSET_DP = 3f

    /** The line under each line of [layout]: its top [offsetPx] below the line's baseline, [thicknessPx] tall. */
    fun rects(layout: TextLayoutResult, offsetPx: Float, thicknessPx: Float): List<Rect> =
        (0 until layout.lineCount).mapNotNull { line ->
            val left = layout.getLineLeft(line)
            val right = layout.getLineRight(line)
            if (right <= left) {
                null
            } else {
                val top = layout.getLineBaseline(line) + offsetPx
                Rect(left, top, right, top + thicknessPx)
            }
        }
}

/**
 * Text underlined as the web underlines its links (WebUnderline). The web's px grow with the text when the page is
 * zoomed; here the line and its offset grow as much as the font size does at the system font scale, so at 2.0 the line
 * stays as far below the descenders as at 1.0.
 */
@Composable
fun UnderlinedText(text: String, style: TextStyle, color: Color, modifier: Modifier = Modifier) {
    val density = LocalDensity.current
    var layout by remember { mutableStateOf<TextLayoutResult?>(null) }
    val growth = with(density) { style.fontSize.toPx() } / (style.fontSize.value * density.density)
    FoundationBasicText(
        text = text,
        modifier = modifier.drawBehind {
            val result = layout ?: return@drawBehind
            val offset = WebUnderline.OFFSET_DP * density.density * growth
            val thickness = WebUnderline.THICKNESS_DP * density.density * growth
            for (line in WebUnderline.rects(result, offset, thickness)) drawRect(color, line.topLeft, line.size)
        },
        style = style.copy(color = color).onPixelLines(),
        onTextLayout = { layout = it },
    )
}
