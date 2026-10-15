package com.eienmosu.truthy.design

import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow

// Text without Material's content colour and text style locals: a type role from TruthyType and a colour from the theme.
// No text is selectable (spec section 2), which BasicText gives without a SelectionContainer.

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
    BasicText(
        text = text,
        modifier = modifier,
        style = if (textAlign == null) style.copy(color = color) else style.copy(color = color, textAlign = textAlign),
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
    BasicText(
        text = text,
        modifier = modifier,
        style = if (textAlign == null) style.copy(color = color) else style.copy(color = color, textAlign = textAlign),
        overflow = overflow,
        maxLines = maxLines,
    )
}
