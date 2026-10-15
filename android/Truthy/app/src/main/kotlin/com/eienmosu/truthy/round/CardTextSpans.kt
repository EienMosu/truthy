package com.eienmosu.truthy.round

import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.eienmosu.truthy.design.OverpassMono
import com.eienmosu.truthy.engine.textParts

private val CODE = SpanStyle(fontFamily = OverpassMono, fontSize = RoundGeometry.CODE_SCALE.em, letterSpacing = 0.sp)

/** A statement or an explanation: code parts in the mono face at 0.92 em, backticks stripped (components/CardText.tsx). */
fun cardText(text: String): AnnotatedString = buildAnnotatedString {
    for (part in textParts(text)) {
        if (part.code) withStyle(CODE) { append(part.text) } else append(part.text)
    }
}
