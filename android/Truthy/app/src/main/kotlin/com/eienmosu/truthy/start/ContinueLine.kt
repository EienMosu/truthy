package com.eienmosu.truthy.start

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.Placeable
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Constraints
import com.eienmosu.truthy.design.Text
import com.eienmosu.truthy.design.IconId
import com.eienmosu.truthy.design.LogoMark
import com.eienmosu.truthy.design.PressFeedback
import com.eienmosu.truthy.design.Tokens
import com.eienmosu.truthy.design.TruthyIcon
import com.eienmosu.truthy.design.TruthyTheme
import com.eienmosu.truthy.design.TruthyType
import com.eienmosu.truthy.design.keyboardFocusRing
import com.eienmosu.truthy.design.pressFeedback
import com.eienmosu.truthy.design.rememberPressProgress
import com.eienmosu.truthy.design.rememberPressTint

/** ContinueLine.tsx: the logo disc, the deck's pass name on one line, the mono route line, a chevron; one button labelled in full. */
@Composable
fun ContinueLine(model: ContinueModel, onContinue: () -> Unit, modifier: Modifier = Modifier) {
    val colors = TruthyTheme.colors
    val source = remember { MutableInteractionSource() }
    val press = rememberPressProgress(source)
    val tint = rememberPressTint(Tokens.Radius.card)
    Row(
        modifier
            .fillMaxWidth()
            .heightIn(min = Tokens.Size.pill)
            .pressFeedback(press, PressFeedback.CONTINUE_SCALE)
            .keyboardFocusRing(RoundedCornerShape(Tokens.Radius.card))
            .clip(RoundedCornerShape(Tokens.Radius.card))
            .clickable(interactionSource = source, indication = tint, role = Role.Button, onClick = onContinue)
            .clearAndSetSemantics {
                contentDescription = model.label
                role = Role.Button
            }
            .padding(start = Tokens.Space.s4, end = Tokens.Space.s12),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s14),
    ) {
        Box(
            Modifier.size(Tokens.Size.continueIcon).clip(CircleShape).background(colors.surfaceRaised),
            contentAlignment = Alignment.Center,
        ) {
            LogoMark(width = StartGeometry.continueMarkWidth)
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(StartGeometry.continueLineGap)) {
            // The web truncates a long name (ContinueLine.tsx:63-71); here it wraps instead, as a card name does (task 10
            // rule 7): at font scale 2.0 "Google Cloud Digital Leader" no longer fits one line, and text never clips (spec 5.6).
            Text(model.deckName, style = TruthyType.continueDeckName, color = colors.ink)
            PartsLine(continueParts(model, colors.ink), TruthyType.monoData, colors.inkMuted, maxLines = 2)
        }
        TruthyIcon(IconId.CHEVRON_RIGHT, tint = colors.ink)
    }
}

/** ContinueLine.tsx:84-110: "CLF → SEC", "Classic", "last 7 of 10" (the score in ink and semibold). */
private fun continueParts(model: ContinueModel, ink: Color): List<AnnotatedString> = buildList {
    add(AnnotatedString("${model.deckCode} ${StartCopy.ARROW} ${model.sectionCode}"))
    add(AnnotatedString(model.modeLabel))
    model.lastScore?.let { score ->
        add(
            buildAnnotatedString {
                append(StartCopy.LAST)
                withStyle(SpanStyle(fontWeight = FontWeight.SemiBold, color = ink)) { append(score) }
            },
        )
    }
}

/**
 * ContinueLine.tsx:75-111: parts that are never split; a part that does not fit after the others starts the next line
 * without its " · ", and at most `maxLines` lines show. Each part after the first is composed twice, with and without
 * its separator, and only the one that fits is measured and placed.
 */
@Composable
private fun PartsLine(parts: List<AnnotatedString>, style: TextStyle, color: Color, maxLines: Int, modifier: Modifier = Modifier) {
    Layout(
        modifier = modifier,
        content = {
            parts.forEachIndexed { i, part ->
                Text(part, style = style, color = color, maxLines = 1, softWrap = false, overflow = TextOverflow.Ellipsis)
                if (i > 0) {
                    Text(AnnotatedString(StartCopy.SEPARATOR) + part, style = style, color = color, maxLines = 1, softWrap = false, overflow = TextOverflow.Ellipsis)
                }
            }
        },
    ) { measurables, constraints ->
        val width = constraints.maxWidth
        val placed = mutableListOf<Triple<Placeable, Int, Int>>()
        var x = 0
        var y = 0
        var line = 0
        var lineHeight = 0
        var index = 0
        for (i in parts.indices) {
            val bare = measurables[index]
            index += 1
            val joined = if (i > 0) measurables[index].also { index += 1 } else null
            if (line >= maxLines) continue
            if (joined != null && x > 0 && x + joined.maxIntrinsicWidth(Constraints.Infinity) <= width) {
                val p = joined.measure(Constraints(maxWidth = width - x))
                placed += Triple(p, x, y)
                x += p.width
                lineHeight = maxOf(lineHeight, p.height)
            } else {
                if (x > 0) {
                    line += 1
                    y += lineHeight
                    x = 0
                    lineHeight = 0
                    if (line >= maxLines) continue
                }
                val p = bare.measure(Constraints(maxWidth = width))
                placed += Triple(p, 0, y)
                x = p.width
                lineHeight = maxOf(lineHeight, p.height)
            }
        }
        layout(width, y + lineHeight) {
            placed.forEach { (p, px, py) -> p.place(px, py) }
        }
    }
}
