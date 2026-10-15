package com.eienmosu.truthy.start

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.lerp
import com.eienmosu.truthy.design.IconId
import com.eienmosu.truthy.design.LogoMark
import com.eienmosu.truthy.design.LogoVariant
import com.eienmosu.truthy.design.Tokens
import com.eienmosu.truthy.ui.TestTags
import com.eienmosu.truthy.design.TruthyIcon
import com.eienmosu.truthy.design.TruthyTheme
import com.eienmosu.truthy.design.TruthyType
import com.eienmosu.truthy.design.truthyShadow
import com.eienmosu.truthy.engine.PassFieldName
import kotlin.math.roundToInt
import androidx.compose.ui.util.lerp as lerpFloat

/** FillInPass.tsx:342, :360 and BoardingPass.tsx:82: the fractions of each layout's three columns. */
private val DESTINATION_COLUMNS = listOf(0.9f, 1.45f, 0.8f)
private val ROUTE_COLUMNS = listOf(0.75f, 1.1f, 1.15f)
private val READY_COLUMNS = listOf(1.1f, 1f, 1f)

/**
 * The fill-in pass. `block` is the layout of the step drawn as current; `leavingBlock` the layout it replaces, fading
 * out over it while the paper changes shape (`layers.passMorph`); `changing` the fields whose dashes leave
 * (`direction` 1) or come back (`direction` -1); `unroll` the empty paper's scale while Start round unrolls it.
 */
@Composable
fun FillInPass(
    block: PassBlock,
    leavingBlock: PassBlock?,
    layers: StepLayers,
    changing: Set<PassFieldName>,
    direction: Int,
    interactive: Boolean,
    travels: Travels,
    onJump: (PassFieldName) -> Unit,
    unroll: Float?,
    modifier: Modifier = Modifier,
) {
    val colors = TruthyTheme.colors
    val shadows = TruthyTheme.shadows
    val shape = RoundedCornerShape(Tokens.Radius.card)
    val ready = block is ReadyBlock
    val morph = if (leavingBlock != null) layers.passMorph else 1f
    val band = if (leavingBlock != null) lerp(bandHeight(leavingBlock), bandHeight(block), morph) else bandHeight(block)
    // FillInPass.tsx:484: the ready pass carries the ticket shadow, except while the paper below unrolls and carries it.
    val shadow = when {
        !ready -> shadows.small
        unroll != null -> null
        else -> shadows.ticket
    }
    UnrollLayout(unroll = unroll, modifier = modifier.testTag(TestTags.PASS)) {
        Column(
            Modifier
                .fillMaxWidth()
                .then(if (shadow != null) Modifier.truthyShadow(shadow, Tokens.Radius.card) else Modifier)
                .clip(shape)
                .background(colors.surfaceRaised),
        ) {
            Box(Modifier.fillMaxWidth().clipToBounds().clearAndSetSemantics { }) {
                if (ready) TicketBand(band) else CompactBand(band)
            }
            PassBody(block, leavingBlock, layers, morph, changing, direction, interactive, travels, onJump)
        }
    }
}

private fun bandHeight(block: PassBlock): Dp = if (block is ReadyBlock) Tokens.Size.carrier else Tokens.Size.carrierCompact

/** The pass, with the empty paper that unrolls below it (FillInPass.tsx:318-322, :523-534): it starts 16 above the pass's bottom edge and is drawn behind it. */
@Composable
private fun UnrollLayout(unroll: Float?, modifier: Modifier, pass: @Composable () -> Unit) {
    val colors = TruthyTheme.colors
    val shadows = TruthyTheme.shadows
    val radius = Tokens.Radius.card
    val bottom = RoundedCornerShape(bottomStart = radius, bottomEnd = radius)
    val paperHeight = Tokens.Size.statementMin + Tokens.Size.lower - Tokens.Space.s18 + radius
    Layout(
        modifier = modifier,
        content = {
            if (unroll != null) {
                Box(
                    Modifier
                        .graphicsLayer {
                            scaleY = unroll
                            transformOrigin = TransformOrigin(0.5f, 0f)
                        }
                        .truthyShadow(shadows.ticket, radius)
                        .clip(bottom)
                        .background(colors.surfaceRaised)
                        .clearAndSetSemantics { },
                )
            }
            Box { pass() }
        },
    ) { measurables, constraints ->
        val passPlaceable = measurables.last().measure(constraints.copy(minHeight = 0))
        val paper = if (measurables.size > 1) {
            measurables.first().measure(Constraints.fixed(passPlaceable.width, paperHeight.roundToPx()))
        } else {
            null
        }
        layout(passPlaceable.width, passPlaceable.height) {
            paper?.place(0, passPlaceable.height - radius.roundToPx())
            passPlaceable.place(0, 0)
        }
    }
}

/** FillInPass.tsx:97-114: the compact band, 30 tall (`height` grows it with the paper; text at large sizes grows it further). */
@Composable
private fun CompactBand(height: Dp) {
    val colors = TruthyTheme.colors
    Row(
        Modifier.fillMaxWidth().heightIn(min = height).background(colors.accent).padding(horizontal = Tokens.Space.s14),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s8),
    ) {
        Box(
            Modifier.size(width = StartGeometry.compactMarkBoxWidth, height = StartGeometry.compactMarkBoxHeight),
            contentAlignment = Alignment.Center,
        ) {
            LogoMark(width = StartGeometry.compactMarkWidth, variant = LogoVariant.COMPACT)
        }
        Text(StartCopy.BAND_TITLE, style = TruthyType.carrierTitleCompact, color = colors.onAccent, maxLines = 1)
        Spacer(Modifier.weight(1f))
        Text(StartCopy.YOUR_PASS, style = TruthyType.carrierLabelCompact, color = colors.onAccent, maxLines = 1)
    }
}

/** FillInPass.tsx:116-128: the ready band, 44 tall, with the cloud and "BOARDING PASS". */
@Composable
private fun TicketBand(height: Dp) {
    val colors = TruthyTheme.colors
    Row(
        Modifier.fillMaxWidth().heightIn(min = height).background(colors.accent).padding(horizontal = Tokens.Space.s16),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s10),
    ) {
        TruthyIcon(IconId.CLOUD, tint = colors.onAccent)
        Text(StartCopy.BAND_TITLE, style = TruthyType.carrierTitle, color = colors.onAccent, maxLines = 1)
        Spacer(Modifier.weight(1f))
        Text(StartCopy.BOARDING_PASS, style = TruthyType.carrierLabel, color = colors.onAccent, maxLines = 1)
    }
}

/** The body under the band: the current block, and the old one fading out over it while the body's height goes from the old block's to the new one's. */
@Composable
private fun PassBody(
    block: PassBlock,
    leavingBlock: PassBlock?,
    layers: StepLayers,
    morph: Float,
    changing: Set<PassFieldName>,
    direction: Int,
    interactive: Boolean,
    travels: Travels,
    onJump: (PassFieldName) -> Unit,
) {
    Layout(
        modifier = Modifier
            .fillMaxWidth()
            .semantics { liveRegion = LiveRegionMode.Polite }
            .then(if (morph < 1f) Modifier.clipToBounds() else Modifier),
        content = {
            Box(Modifier.graphicsLayer { alpha = if (leavingBlock != null) layers.newBlockAlpha else 1f }) {
                BlockContent(block, layers, changing, direction, interactive, travels, onJump)
            }
            if (leavingBlock != null) {
                Box(Modifier.graphicsLayer { alpha = layers.oldBlockAlpha }.clearAndSetSemantics { }) {
                    BlockContent(leavingBlock, layers, emptySet(), direction, interactive = false, travels = travels, onJump = {})
                }
            }
        },
    ) { measurables, constraints ->
        val loose = constraints.copy(minHeight = 0)
        val current = measurables[0].measure(loose)
        val old = measurables.getOrNull(1)?.measure(loose)
        val height = if (old == null) current.height else lerpFloat(old.height.toFloat(), current.height.toFloat(), morph).roundToInt()
        layout(current.width, height) {
            current.place(0, 0)
            old?.place(0, 0)
        }
    }
}

@Composable
private fun BlockContent(
    block: PassBlock,
    layers: StepLayers,
    changing: Set<PassFieldName>,
    direction: Int,
    interactive: Boolean,
    travels: Travels,
    onJump: (PassFieldName) -> Unit,
) {
    when (block) {
        is DestinationBlock -> FrRow(DESTINATION_COLUMNS, minContent = false, modifier = Modifier.fillMaxWidth().padding(horizontal = Tokens.Space.s16)) {
            block.fields.forEachIndexed { i, field ->
                FieldCell(field, PassStage.DESTINATION, first = i == 0, dash = dashFor(field, layers, changing, direction), interactive, travels, onJump)
            }
        }
        is RouteBlock -> Column(Modifier.fillMaxWidth()) {
            Row(
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = Tokens.Size.passLine)
                    .padding(start = Tokens.Space.s10, end = Tokens.Space.s10, top = Tokens.Space.s8),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s2),
            ) {
                block.area?.let { LineWord(it, interactive, travels, onJump) }
                Text(StartCopy.MIDDLE_DOT, style = TruthyType.passLine, color = TruthyTheme.colors.rule, modifier = Modifier.clearAndSetSemantics { })
                block.platform?.let { LineWord(it, interactive, travels, onJump) }
            }
            FrRow(ROUTE_COLUMNS, minContent = true, modifier = Modifier.fillMaxWidth().padding(horizontal = Tokens.Space.s16)) {
                block.fields.forEachIndexed { i, field ->
                    FieldCell(field, PassStage.ROUTE, first = i == 0, dash = dashFor(field, layers, changing, direction), interactive, travels, onJump)
                }
            }
        }
        is ReadyBlock -> ReadyContent(block, interactive, travels, onJump)
    }
}

/** How a field's dashes are drawn now: a blank field's own dashes, and the dashes leaving under a value that just arrived. */
private data class DashLook(val blankAlpha: Float, val leavingAlpha: Float)

private fun dashFor(field: PassField, layers: StepLayers, changing: Set<PassFieldName>, direction: Int): DashLook {
    val moving = field.field in changing
    return DashLook(
        blankAlpha = if (moving && direction < 0) layers.dashInAlpha else 1f,
        leavingAlpha = if (moving && direction > 0) layers.dashOutAlpha else 0f,
    )
}

/** FillInPass.tsx:173-209: label, then the value or three dashes; a filled field that is not being chosen is a way back over the whole cell. */
@Composable
private fun FieldCell(
    field: PassField,
    stage: PassStage,
    first: Boolean,
    dash: DashLook,
    interactive: Boolean,
    travels: Travels,
    onJump: (PassFieldName) -> Unit,
) {
    val colors = TruthyTheme.colors
    val wayBack = field.wayBack?.takeIf { interactive }
    val labelStyle = if (field.now) TruthyType.fieldLabel.copy(fontWeight = FontWeight.SemiBold) else TruthyType.fieldLabel
    val valueStyle = if (field.code) TruthyType.passCode else TruthyType.fieldValuePass
    Box(
        Modifier
            .fillMaxWidth()
            .then(if (first) Modifier else Modifier.ruleStart(colors.rule).padding(start = Tokens.Stroke.rule))
            .then(if (wayBack != null) Modifier.wayBack(wayBack) { onJump(field.field) } else Modifier)
            .padding(start = if (first) 0.dp else Tokens.Space.s12, top = StartGeometry.fieldTop, bottom = StartGeometry.fieldBottom),
    ) {
        Column {
            Text(field.label, style = labelStyle, color = if (field.now) colors.ink else colors.inkMuted, maxLines = 1)
            Box(
                Modifier.padding(top = StartGeometry.fieldValueTop).heightIn(min = Tokens.Space.s20),
                contentAlignment = Alignment.CenterStart,
            ) {
                val value = field.value
                if (value == null) {
                    Dashes(now = field.now, alpha = dash.blankAlpha, spoken = true)
                } else {
                    if (dash.leavingAlpha > 0f) Dashes(now = field.now, alpha = dash.leavingAlpha, spoken = false)
                    Text(
                        value,
                        style = valueStyle,
                        color = colors.ink,
                        maxLines = 1,
                        softWrap = false,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.travelSpot(travels, SpotKey(stage, field.field), value, valueStyle, colors.ink, right = false),
                    )
                }
            }
        }
    }
}

/** FillInPass.tsx:135-156: three 14 by 3 dashes, ink on the field being chosen, rule elsewhere; "not chosen" for assistive technology. */
@Composable
private fun Dashes(now: Boolean, alpha: Float, spoken: Boolean) {
    val color = if (now) TruthyTheme.colors.ink else TruthyTheme.colors.rule
    Row(
        Modifier
            .heightIn(min = Tokens.Space.s20)
            .graphicsLayer { this.alpha = alpha }
            .then(if (spoken) Modifier.semantics { contentDescription = StartCopy.NOT_CHOSEN } else Modifier.clearAndSetSemantics { }),
        horizontalArrangement = Arrangement.spacedBy(StartGeometry.dashGap),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        repeat(3) {
            Box(
                Modifier
                    .size(width = StartGeometry.dashWidth, height = StartGeometry.dashHeight)
                    .clip(RoundedCornerShape(Tokens.Radius.tick))
                    .background(color),
            )
        }
    }
}

/** FillInPass.tsx:218-236: a word of the route pass's quiet line, a way back to the area or the platform. */
@Composable
private fun LineWord(word: PassField, interactive: Boolean, travels: Travels, onJump: (PassFieldName) -> Unit) {
    val value = word.value ?: return
    val muted = TruthyTheme.colors.inkMuted
    val wayBack = word.wayBack?.takeIf { interactive }
    Box(
        Modifier
            .heightIn(min = StartGeometry.lineWordHeight)
            .then(if (wayBack != null) Modifier.wayBack(wayBack) { onJump(word.field) } else Modifier)
            .padding(horizontal = Tokens.Space.s6),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            value,
            style = TruthyType.passLine,
            color = muted,
            maxLines = 1,
            softWrap = false,
            modifier = Modifier.travelSpot(travels, SpotKey(PassStage.ROUTE, word.field), value, TruthyType.passLine, muted, right = false),
        )
    }
}

/** FillInPass.tsx:269-316: the legs (code over name), then Class, Cards and Gate between two rules. */
@Composable
private fun ReadyContent(block: ReadyBlock, interactive: Boolean, travels: Travels, onJump: (PassFieldName) -> Unit) {
    val colors = TruthyTheme.colors
    Column(Modifier.fillMaxWidth()) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(start = Tokens.Size.ticketInset, end = Tokens.Size.ticketInset, top = Tokens.Space.s14, bottom = Tokens.Space.s12),
            horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s8),
        ) {
            Leg(block.deck, alignEnd = false, interactive, travels, onJump, Modifier.weight(1f))
            Spacer(Modifier.width(StartGeometry.legGap))
            Leg(block.section, alignEnd = true, interactive, travels, onJump, Modifier.weight(1f))
        }
        FrRow(
            READY_COLUMNS,
            minContent = true,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = Tokens.Size.ticketInset)
                .ruleTopBottom(colors.rule)
                .padding(vertical = Tokens.Stroke.rule),
        ) {
            ReadyCell(StartCopy.LABEL_CLASS, first = true, wayBack = block.modeWayBack?.takeIf { interactive }, onClick = { onJump(PassFieldName.MODE) }) {
                Text(
                    block.mode,
                    style = TruthyType.fieldValue,
                    color = colors.ink,
                    maxLines = 1,
                    softWrap = false,
                    modifier = Modifier.travelSpot(travels, SpotKey(PassStage.READY, PassFieldName.MODE), block.mode, TruthyType.fieldValue, colors.ink, right = false),
                )
            }
            ReadyCell(StartCopy.LABEL_CARDS, first = false, wayBack = null, onClick = {}) {
                Text(block.cards, style = TruthyType.fieldValue, color = colors.ink, maxLines = 1, softWrap = false)
            }
            ReadyCell(StartCopy.LABEL_GATE, first = false, wayBack = null, onClick = {}) {
                Text(
                    StartCopy.GATE_SHOWN,
                    style = TruthyType.fieldValue,
                    color = colors.ink,
                    maxLines = 1,
                    softWrap = false,
                    modifier = Modifier.clearAndSetSemantics { contentDescription = StartCopy.GATE_SPOKEN },
                )
            }
        }
        Spacer(Modifier.height(Tokens.Space.s18))
    }
}

@Composable
private fun Leg(leg: PassLeg, alignEnd: Boolean, interactive: Boolean, travels: Travels, onJump: (PassFieldName) -> Unit, modifier: Modifier) {
    val colors = TruthyTheme.colors
    val wayBack = leg.wayBack?.takeIf { interactive }
    Column(
        modifier
            .clip(RoundedCornerShape(Tokens.Radius.small))
            .then(if (wayBack != null) Modifier.wayBack(wayBack) { onJump(leg.field) } else Modifier),
        horizontalAlignment = if (alignEnd) Alignment.End else Alignment.Start,
    ) {
        Text(
            leg.code,
            style = TruthyType.legCode,
            color = colors.ink,
            maxLines = 1,
            softWrap = false,
            modifier = Modifier.travelSpot(travels, SpotKey(PassStage.READY, leg.field), leg.code, TruthyType.legCode, colors.ink, right = alignEnd),
        )
        Text(
            leg.name,
            style = TruthyType.legName,
            color = colors.inkMuted,
            textAlign = if (alignEnd) TextAlign.End else TextAlign.Start,
            modifier = Modifier.padding(top = Tokens.Space.s6),
        )
    }
}

@Composable
private fun ReadyCell(label: String, first: Boolean, wayBack: String?, onClick: () -> Unit, value: @Composable () -> Unit) {
    val colors = TruthyTheme.colors
    Box(
        Modifier
            .fillMaxWidth()
            .then(if (first) Modifier else Modifier.ruleStart(colors.rule).padding(start = Tokens.Stroke.rule))
            .then(if (wayBack != null) Modifier.wayBack(wayBack, onClick) else Modifier)
            .padding(start = if (first) 0.dp else Tokens.Space.s12, top = Tokens.Space.s8, bottom = StartGeometry.readyCellBottom),
    ) {
        Column {
            Text(label, style = TruthyType.fieldLabel, color = colors.inkMuted, maxLines = 1)
            Box(Modifier.padding(top = Tokens.Space.s2)) { value() }
        }
    }
}

/** A row of cells sized like a CSS grid of `minmax(min, fr)` tracks (frWidths), every cell as tall as the tallest. */
@Composable
private fun FrRow(fractions: List<Float>, minContent: Boolean, modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Layout(content = content, modifier = modifier) { measurables, constraints ->
        val total = constraints.maxWidth
        val mins = measurables.map { if (minContent) it.maxIntrinsicWidth(Constraints.Infinity) else 0 }
        val widths = frWidths(total, fractions, mins)
        val height = measurables.mapIndexed { i, m -> m.maxIntrinsicHeight(widths[i]) }.maxOrNull() ?: 0
        val placeables = measurables.mapIndexed { i, m -> m.measure(Constraints.fixed(widths[i], height)) }
        layout(total, height) {
            var x = 0
            placeables.forEach {
                it.place(x, 0)
                x += it.width
            }
        }
    }
}
