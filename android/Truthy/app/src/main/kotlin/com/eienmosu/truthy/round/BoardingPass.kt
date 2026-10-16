package com.eienmosu.truthy.round

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.keyframes
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.LineBreak
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.eienmosu.truthy.design.IconId
import com.eienmosu.truthy.design.Text
import com.eienmosu.truthy.design.ruleWidth
import com.eienmosu.truthy.design.TicketLowerShape
import com.eienmosu.truthy.design.TicketMainShape
import com.eienmosu.truthy.design.Tokens
import com.eienmosu.truthy.design.TruthyIcon
import com.eienmosu.truthy.design.TruthyTheme
import com.eienmosu.truthy.design.TruthyType
import com.eienmosu.truthy.design.drawTicketPerforation
import com.eienmosu.truthy.design.truthyShadow
import com.eienmosu.truthy.ui.TestTags

/** A leg of the pass: the three-letter code over its name. */
data class PassLeg(val code: String, val name: String)

/** A cell of the field grid. `spoken` replaces the value for screen readers (Gate: "False left, true right"). */
data class PassField(val label: String, val value: String, val spoken: String? = null, val muted: Boolean = false)

/** The paper of the lower part: raised for the stub, sunk for the slip and the result list. */
enum class PaperTone { RAISED, SUNK }

@Composable
fun BoardingPass(
    from: PassLeg,
    to: PassLeg,
    fields: List<PassField>,
    modifier: Modifier = Modifier,
    jolt: Boolean = false,
    joltDelayMs: Int = Tokens.Transitions.jolt.delayMs,
    reduced: Boolean = false,
    shortLegs: Boolean = false,
    shadow: Boolean = true,
    lower: @Composable BoxScope.() -> Unit,
    body: @Composable ColumnScope.() -> Unit,
) {
    val colors = TruthyTheme.colors
    val joltY = remember { Animatable(0f) }
    LaunchedEffect(jolt) {
        if (jolt && !reduced) {
            joltY.animateTo(
                0f,
                keyframes {
                    durationMillis = Tokens.Duration.jolt
                    delayMillis = joltDelayMs
                    0f at 0 using Tokens.Curves.ease
                    RoundGeometry.JOLT_DP at (Tokens.Duration.jolt * RoundGeometry.JOLT_PEAK).toInt() using Tokens.Curves.ease
                },
            )
        }
    }
    val main = TicketMainShape()
    // TestTags.TICKET: task 15 finds the ticket by it, on the round and on the result. propagateMinConstraints hands a
    // caller's minimum height (task 14's result stage) to the layout below. The upper part is measured first; the lower
    // part gets at least the height it leaves of that minimum and grows past it with its content. (A Column child with
    // weight(1f) would get the minimum minus the upper part, 0 once the upper part is taller than the stage at a large
    // font scale or on a 320 by 568 phone, and the result's missed list would be laid out 0 px tall.)
    Box(modifier.fillMaxWidth().testTag(TestTags.TICKET), propagateMinConstraints = true) {
        // shadow false: the caller draws the ticket's shadow itself (the result, ResultScreen's TicketShadow).
        if (shadow) Box(Modifier.matchParentSize().truthyShadow(TruthyTheme.shadows.ticket, cornerRadius = Tokens.Radius.card))
        Layout(
            content = {
            Box(
                Modifier
                    .fillMaxWidth()
                    .graphicsLayer { translationY = joltY.value.dp.toPx() }
                    .clip(main)
                    .background(colors.surfaceRaised)
                    // The perforation over the main part's foot (task 10), drawn above the content as the web's is.
                    .drawWithContent {
                        drawContent()
                        drawTicketPerforation(colors.rule)
                    },
            ) {
                Column(Modifier.fillMaxWidth()) {
                    CarrierBand(words = true)
                    Legs(from, to, shortLegs)
                    PassFieldGrid(fields, Modifier.padding(horizontal = Tokens.Size.ticketInset))
                    body()
                }
            }
            Box(Modifier.fillMaxWidth(), propagateMinConstraints = true) { lower() }
            },
        ) { measurables, constraints ->
            val width = constraints.maxWidth
            val upper = measurables[0].measure(Constraints.fixedWidth(width))
            val rest = (constraints.minHeight - upper.height).coerceAtLeast(0)
            val lowerPart = measurables[1].measure(Constraints(minWidth = width, maxWidth = width, minHeight = rest))
            layout(width, upper.height + lowerPart.height) {
                upper.place(0, 0)
                lowerPart.place(0, upper.height)
            }
        }
    }
}

/** The accent band: cloud, "Truthy" and "BOARDING PASS"; the loading placeholder shows the cloud only. Hidden from screen readers. */
@Composable
internal fun CarrierBand(words: Boolean) {
    val colors = TruthyTheme.colors
    Row(
        Modifier
            .fillMaxWidth()
            .heightIn(min = Tokens.Size.carrier)
            .background(colors.accent)
            .padding(horizontal = Tokens.Space.s16)
            .clearAndSetSemantics {},
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s10),
    ) {
        TruthyIcon(IconId.CLOUD, tint = colors.onAccent, width = RoundGeometry.CLOUD_WIDTH)
        if (words) {
            Text("Truthy", style = TruthyType.carrierTitle, color = colors.onAccent)
            Spacer(Modifier.weight(1f))
            Text("BOARDING PASS", style = TruthyType.carrierLabel, color = colors.onAccent)
        }
    }
}

@Composable
private fun Legs(from: PassLeg, to: PassLeg, shortLegs: Boolean) {
    val compact = shortLegs && LocalConfiguration.current.screenHeightDp <= RoundGeometry.SHORT_LEGS_HEIGHT
    Row(
        Modifier.fillMaxWidth().padding(
            start = Tokens.Size.ticketInset,
            end = Tokens.Size.ticketInset,
            top = if (compact) Tokens.Space.s8 else Tokens.Space.s14,
            bottom = if (compact) Tokens.Space.s8 else Tokens.Space.s12,
        ),
        horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s8),
    ) {
        Leg(from, compact, end = false, modifier = Modifier.weight(1f))
        Spacer(Modifier.width(RoundGeometry.LEG_ARROW_COLUMN))
        Leg(to, compact, end = true, modifier = Modifier.weight(1f))
    }
}

@Composable
private fun Leg(leg: PassLeg, compact: Boolean, end: Boolean, modifier: Modifier) {
    val colors = TruthyTheme.colors
    val align = if (end) TextAlign.End else TextAlign.Start
    Column(modifier, horizontalAlignment = if (end) Alignment.End else Alignment.Start) {
        Text(
            leg.code,
            modifier = if (compact) Modifier.semantics { contentDescription = "${leg.code}, ${leg.name}" } else Modifier,
            style = TruthyType.legCode,
            color = colors.ink,
            textAlign = align,
        )
        if (!compact) Text(leg.name, Modifier.padding(top = Tokens.Space.s6), style = TruthyType.legName, color = colors.inkMuted, textAlign = align)
    }
}

/** Class / Card / Gate between two rules, the columns 1.1 / 1 / 1 but never narrower than a value (fieldColumnWidths). */
@Composable
fun PassFieldGrid(fields: List<PassField>, modifier: Modifier = Modifier) {
    val colors = TruthyTheme.colors
    val rule = ruleWidth()
    Layout(
        content = { fields.forEachIndexed { i, field -> FieldCell(field, first = i == 0, rule = rule) } },
        modifier = modifier
            .fillMaxWidth()
            .drawBehind {
                val w = rule.toPx()
                drawLine(colors.rule, Offset(0f, w / 2), Offset(size.width, w / 2), w)
                drawLine(colors.rule, Offset(0f, size.height - w / 2), Offset(size.width, size.height - w / 2), w)
            }
            .padding(vertical = rule),
    ) { measurables, constraints ->
        val widths = fieldColumnWidths(measurables.map { it.maxIntrinsicWidth(Constraints.Infinity) }, constraints.maxWidth)
        val height = measurables.indices.maxOfOrNull { measurables[it].maxIntrinsicHeight(widths[it]) } ?: 0
        val placeables = measurables.mapIndexed { i, measurable -> measurable.measure(Constraints.fixed(widths[i], height)) }
        layout(constraints.maxWidth, height) {
            var x = 0
            placeables.forEach {
                it.placeRelative(x, 0)
                x += it.width
            }
        }
    }
}

@Composable
private fun FieldCell(field: PassField, first: Boolean, rule: Dp) {
    val colors = TruthyTheme.colors
    val divider = if (first) {
        Modifier
    } else {
        Modifier
            .drawBehind {
                val w = rule.toPx()
                drawLine(colors.rule, Offset(w / 2, 0f), Offset(w / 2, size.height), w)
            }
            .padding(start = rule + Tokens.Space.s12)
    }
    val spoken = field.spoken
    Column(divider.padding(top = Tokens.Space.s8, bottom = RoundGeometry.FIELD_BOTTOM)) {
        Text(field.label, style = TruthyType.fieldLabel, color = colors.inkMuted)
        Text(
            field.value,
            modifier = Modifier.padding(top = Tokens.Space.s2).then(if (spoken != null) Modifier.semantics { contentDescription = spoken } else Modifier),
            style = TruthyType.fieldValue,
            color = if (field.muted) colors.inkMuted else colors.ink,
        )
    }
}

/** The statement area: at least 188 tall, the text centred; the appliesTo line above it is never cut (BoardingPass.tsx PassStatement). */
@Composable
fun PassStatement(statement: String, appliesTo: String, muted: Boolean, modifier: Modifier = Modifier, textModifier: Modifier = Modifier) {
    val colors = TruthyTheme.colors
    Column(
        modifier
            .fillMaxWidth()
            .heightIn(min = Tokens.Size.statementMin)
            .padding(start = Tokens.Size.ticketInset, end = Tokens.Size.ticketInset, top = Tokens.Space.s18, bottom = Tokens.Space.s24),
        verticalArrangement = Arrangement.Center,
    ) {
        Column(textModifier.fillMaxWidth()) {
            if (appliesTo.isNotEmpty()) {
                Text(
                    appliesTo,
                    modifier = Modifier.padding(bottom = Tokens.Space.s6).semantics { contentDescription = "Applies to $appliesTo" },
                    style = TruthyType.monoData.copy(lineBreak = LineBreak.Heading),
                    color = colors.inkMuted,
                )
            }
            Text(cardText(statement), style = TruthyType.cardStatement, color = if (muted) colors.inkMuted else colors.ink)
        }
    }
}

/** The lower part's paper: notches at the top, radius 16 at the bottom. */
@Composable
fun PassLower(tone: PaperTone, modifier: Modifier = Modifier, content: @Composable BoxScope.() -> Unit = {}) {
    val colors = TruthyTheme.colors
    val shape = TicketLowerShape()
    Box(modifier.background(if (tone == PaperTone.RAISED) colors.surfaceRaised else colors.surfaceSunk, shape), content = content)
}
