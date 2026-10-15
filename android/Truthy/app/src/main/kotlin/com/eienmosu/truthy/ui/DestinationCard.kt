package com.eienmosu.truthy.ui

import androidx.compose.foundation.Canvas
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.disabled
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import com.eienmosu.truthy.design.DestinationCardShape
import com.eienmosu.truthy.design.IconId
import com.eienmosu.truthy.design.PressFeedback
import com.eienmosu.truthy.design.Tokens
import com.eienmosu.truthy.design.TruthyIcon
import com.eienmosu.truthy.design.TruthyText
import com.eienmosu.truthy.design.TruthyTheme
import com.eienmosu.truthy.design.TruthyType
import com.eienmosu.truthy.design.drawCardPerforation
import com.eienmosu.truthy.design.keyboardFocusRing
import com.eienmosu.truthy.design.pressFeedback
import com.eienmosu.truthy.design.rememberPressProgress
import com.eienmosu.truthy.design.truthyShadow

enum class DestinationVariant { PLACE, DECK, SECTION, CLASS }

/** What the stub of a deck, section or class card shows: "Cards / 214" or "Best / 9 / of 10". */
data class CardStub(val label: String, val value: String, val unit: String? = null, val muted: Boolean = false)

data class DestinationMetrics(val stubWidth: Dp, val minHeight: Dp, val gap: Dp, val vertical: Dp)

/** DestinationCard.tsx STUB_WIDTH, MIN_HEIGHT and MAIN_PADDING. */
object DestinationLayout {
    fun of(variant: DestinationVariant): DestinationMetrics = when (variant) {
        DestinationVariant.PLACE ->
            DestinationMetrics(Tokens.Size.cardStub, Tokens.Size.cardMin, Tokens.Space.s4, Tokens.Space.s18)
        DestinationVariant.DECK ->
            DestinationMetrics(Tokens.Size.cardStubDeck, Tokens.Size.cardMinDeck, Tokens.Space.s2, Tokens.Space.s18)
        DestinationVariant.SECTION ->
            DestinationMetrics(Tokens.Size.cardStubDeck, Tokens.Size.cardMinSection, Tokens.Space.s2, Tokens.Space.s14)
        DestinationVariant.CLASS ->
            DestinationMetrics(Tokens.Size.cardStubDeck, Tokens.Size.cardMinClass, Tokens.Space.s4, Tokens.Space.s16)
    }
}

object TrackGeometry {
    /** The seen part is `percent`% of the track (DestinationCard.tsx: `width: percent%`). */
    fun seenWidth(percent: Int, trackWidth: Float): Float = trackWidth * percent / 100f

    // The track is dashed 4 on, 4 off in rule, 2 thick, at y 3 of 8; the seen part is a solid ink line with an accent dot
    // (8 across) on its end, ringed in ink by a 1.5 spread.
    const val DASH = 4f
    const val LINE_TOP = 3f
    const val DOT_RADIUS = 4f
    const val DOT_RING = 1.5f
}

/** The 56 by 8 progress track: dashed for the part not seen, a solid ink line with an amber dot for the part seen. */
@Composable
fun ProgressTrack(percent: Int, modifier: Modifier = Modifier) {
    val colors = TruthyTheme.colors
    Canvas(modifier.size(Tokens.Size.progressTrack, Tokens.Space.s8)) {
        val d = density
        val thick = Tokens.Stroke.perforation.toPx()
        val y = TrackGeometry.LINE_TOP * d + thick / 2f
        drawLine(
            color = colors.rule,
            start = Offset(0f, y),
            end = Offset(size.width, y),
            strokeWidth = thick,
            cap = StrokeCap.Butt,
            pathEffect = PathEffect.dashPathEffect(floatArrayOf(TrackGeometry.DASH * d, TrackGeometry.DASH * d)),
        )
        if (percent > 0) {
            val seen = TrackGeometry.seenWidth(percent, size.width)
            drawRoundRect(
                color = colors.ink,
                topLeft = Offset(0f, TrackGeometry.LINE_TOP * d),
                size = Size(seen, thick),
                cornerRadius = CornerRadius(1f * d),
            )
            drawCircle(colors.ink, (TrackGeometry.DOT_RADIUS + TrackGeometry.DOT_RING) * d, Offset(seen, y))
            drawCircle(colors.accent, TrackGeometry.DOT_RADIUS * d, Offset(seen, y))
        }
    }
}

/**
 * The destination card of the start flow (DestinationCard.tsx): one large, calm choice per row. A ticket with a stub on the
 * right, notches of 7 on the stub line and a dashed perforation between them. [label] is the card's accessible name, a full
 * sentence from reference 4.5; the visible texts are not read separately. An [unavailable] card is a disabled group: sunk
 * paper, no stub, no click. [nameHidden] hides the name while a copy of it travels into the pass (task 12).
 */
@Composable
fun DestinationCard(
    variant: DestinationVariant,
    name: String,
    label: String,
    modifier: Modifier = Modifier,
    onSelect: (() -> Unit)? = null,
    code: Boolean = false,
    sub: String? = null,
    detail: String? = null,
    seenPercent: Int? = null,
    stub: CardStub? = null,
    unavailable: Boolean = false,
    nameHidden: Boolean = false,
    nameLayout: Modifier = Modifier,
) {
    val colors = TruthyTheme.colors
    val shadows = TruthyTheme.shadows
    val metrics = DestinationLayout.of(variant)
    val nameStyle = if (code) TruthyType.deckCode else TruthyType.cardName
    // nameLayout: the start flow measures the name's box for the name that travels into the pass (task 12).
    val nameModifier = nameLayout.then(if (nameHidden) Modifier.alpha(0f) else Modifier)

    if (unavailable) {
        Column(
            modifier = modifier
                .fillMaxWidth()
                .heightIn(min = Tokens.Size.cardMinOff)
                .clip(RoundedCornerShape(Tokens.Radius.card))
                .background(colors.surfaceSunk)
                .clearAndSetSemantics {
                    contentDescription = label
                    disabled()
                }
                .padding(
                    start = Tokens.Space.s20,
                    end = Tokens.Space.s12,
                    top = Tokens.Space.s18,
                    bottom = Tokens.Space.s18,
                ),
            verticalArrangement = Arrangement.spacedBy(Tokens.Space.s4, Alignment.CenterVertically),
        ) {
            TruthyText(name, nameStyle, colors.inkMuted)
            if (detail != null) TruthyText(detail, TruthyType.listTitle, colors.inkMuted)
            if (sub != null) TruthyText(sub, TruthyType.monoData, colors.inkMuted)
        }
        return
    }

    val source = remember { MutableInteractionSource() }
    val press = rememberPressProgress(source)
    val rule = colors.rule
    Box(
        modifier = modifier
            .fillMaxWidth()
            .pressFeedback(press, PressFeedback.CARD_SCALE)
            .truthyShadow(shadows.small, Tokens.Radius.card)
            .keyboardFocusRing(DestinationCardShape(metrics.stubWidth))
            .background(colors.surfaceRaised, DestinationCardShape(metrics.stubWidth))
            .drawBehind { drawCardPerforation(rule, metrics.stubWidth) }
            .clickable(interactionSource = source, indication = null, role = Role.Button) { onSelect?.invoke() }
            // Clears the visible texts of the card from the accessibility tree; the click action of this node stays.
            .clearAndSetSemantics { contentDescription = label },
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(min = metrics.minHeight)
                .padding(end = metrics.stubWidth)
                .padding(
                    start = Tokens.Space.s20,
                    end = Tokens.Space.s12,
                    top = metrics.vertical,
                    bottom = metrics.vertical,
                ),
            verticalArrangement = Arrangement.spacedBy(metrics.gap, Alignment.CenterVertically),
        ) {
            TruthyText(name, nameStyle, colors.ink, nameModifier)
            if (sub != null) TruthyText(sub, TruthyType.monoData, colors.inkMuted)
            if (detail != null) {
                TruthyText(detail, TruthyType.listTitle, if (variant == DestinationVariant.CLASS) colors.inkMuted else colors.ink)
            }
            if (seenPercent != null) {
                Row(
                    modifier = Modifier.padding(top = Tokens.Space.s10),
                    horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s10),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    ProgressTrack(seenPercent)
                    if (seenPercent > 0) {
                        val seen = buildAnnotatedString {
                            withStyle(SpanStyle(fontWeight = FontWeight.SemiBold, color = colors.ink)) { append("$seenPercent%") }
                            append(" seen")
                        }
                        TruthyText(seen, TruthyType.monoData, colors.inkMuted)
                    } else {
                        TruthyText("Not started", TruthyType.monoData, colors.inkMuted)
                    }
                }
            }
        }
        Box(Modifier.matchParentSize(), contentAlignment = Alignment.CenterEnd) {
            Column(
                modifier = Modifier.width(metrics.stubWidth),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(Tokens.Space.s2, Alignment.CenterVertically),
            ) {
                if (stub != null) {
                    TruthyText(stub.label, TruthyType.fieldLabel, colors.inkMuted, textAlign = TextAlign.Center)
                    TruthyText(stub.value, TruthyType.stubValue, if (stub.muted) colors.inkMuted else colors.ink, textAlign = TextAlign.Center)
                    if (stub.unit != null) TruthyText(stub.unit, TruthyType.fieldLabel, colors.inkMuted, textAlign = TextAlign.Center)
                }
                if (variant != DestinationVariant.CLASS) {
                    Box(if (stub != null) Modifier.padding(top = Tokens.Space.s8) else Modifier) {
                        TruthyIcon(IconId.CHEVRON_RIGHT, tint = colors.ink)
                    }
                }
            }
        }
    }
}
