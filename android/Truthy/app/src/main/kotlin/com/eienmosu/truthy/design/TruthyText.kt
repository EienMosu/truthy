package com.eienmosu.truthy.design

import androidx.compose.material3.LocalContentColor
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.takeOrElse
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.AnnotatedString
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
