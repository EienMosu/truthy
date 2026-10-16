package com.eienmosu.truthy.round

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.key
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Dp
import androidx.compose.foundation.Canvas
import androidx.compose.runtime.remember
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import com.eienmosu.truthy.design.Text
import com.eienmosu.truthy.design.IconId
import com.eienmosu.truthy.design.TicketMainShape
import com.eienmosu.truthy.design.Tokens
import com.eienmosu.truthy.design.TruthyIcon
import com.eienmosu.truthy.design.TruthyTheme
import com.eienmosu.truthy.design.TruthyType
import com.eienmosu.truthy.design.drawTicketPerforation
import com.eienmosu.truthy.design.keyboardFocusRing
import com.eienmosu.truthy.design.truthyShadow
import com.eienmosu.truthy.engine.Answered
import com.eienmosu.truthy.engine.barcodeBars
import com.eienmosu.truthy.ui.IntentKind
import com.eienmosu.truthy.ui.IntentStamp
import com.eienmosu.truthy.ui.Stamp
import com.eienmosu.truthy.ui.StampLanding
import com.eienmosu.truthy.ui.StampVerdict
import com.eienmosu.truthy.ui.StubStamp
import com.eienmosu.truthy.ui.StubStampKind
import com.eienmosu.truthy.ui.TestTags
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.roundToInt
import kotlin.math.sin

/**
 * The stub of a question (and of every Timed card): route line, barcode, the swipe hint or one hint line, the
 * Timed stamp, and the intent stamps while dragging. Decorative, so hidden from screen readers. The stub drops
 * |intent| x 7 and turns intent x 2 degrees about (20%, 0) while the card is dragged.
 */
@Composable
internal fun PassStubContent(
    routeLine: String,
    cardLabel: String,
    barcode: String,
    hint: String?,
    mark: StubMark?,
    stampIntent: () -> Float,
    stubTurn: () -> Float,
    modifier: Modifier = Modifier,
) {
    val colors = TruthyTheme.colors
    val quiet = TruthyType.monoDataStrong.copy(fontWeight = FontWeight.Normal)
    Box(
        modifier
            .fillMaxWidth()
            .testTag(TestTags.STUB)
            .clearAndSetSemantics {}
            .graphicsLayer {
                val turn = stubTurn()
                transformOrigin = TransformOrigin(RoundGeometry.STUB_PIVOT_X, 0f)
                translationY = abs(turn) * Tokens.Gesture.stubPull.toPx()
                rotationZ = turn * RoundGeometry.STUB_TURN
            },
    ) {
        PassLower(PaperTone.RAISED, Modifier.fillMaxWidth().heightIn(min = Tokens.Size.lower)) {
            StubColumn(
                stamp = mark?.let { { key(it) { StubStamp(it.kind()) } } },
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = Tokens.Size.lower)
                    .padding(start = Tokens.Size.ticketInset, end = Tokens.Size.ticketInset, top = RoundGeometry.STUB_TOP, bottom = Tokens.Space.s14),
            ) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(routeLine, Modifier.weight(1f, fill = false).alignByBaseline(), style = TruthyType.monoData, color = colors.inkMuted)
                    Text(cardLabel, Modifier.alignByBaseline(), style = TruthyType.monoDataStrong, color = colors.ink)
                }
                BarcodeStrip(barcode, Modifier.fillMaxWidth().height(Tokens.Size.barcode))
                if (hint == null) {
                    Row(
                        Modifier.fillMaxWidth().heightIn(min = RoundGeometry.HINT_ROW),
                        horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s8),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text("← False", style = TruthyType.monoDataStrong, color = colors.falseColor)
                        Text("swipe to board", Modifier.weight(1f), style = quiet, color = colors.inkMuted, textAlign = TextAlign.Center)
                        Text("True →", style = TruthyType.monoDataStrong, color = colors.trueColor)
                    }
                } else {
                    Box(Modifier.fillMaxWidth().heightIn(min = RoundGeometry.HINT_ROW), contentAlignment = Alignment.Center) {
                        Text(hint, style = quiet, color = colors.inkMuted, textAlign = TextAlign.Center)
                    }
                }
            }
        }
        if (hint == null) IntentStamps(stampIntent)
    }
}

/** Where the stub's stamp goes and how tall the stub's column is, in px of the column (stubStampSpot). */
internal data class StubStampSpot(val centreY: Float, val height: Int)

/**
 * The stamp's centre on the stub: [preferred] (BoardingPass.tsx: 96 from the stub's top), or lower when its tilted
 * outline ([stampWidth] by [stampHeight] turned [turn] degrees) would reach above [routeBottom], the foot of the route
 * line; and the column's height, [height] or taller so the hint row ([hintHeight] at the foot) starts under the stamp.
 * At font scale 1 the stamp is where the web puts it; at 2 the route line wraps and the stamp's top border ran through
 * its second line (review F2).
 */
internal fun stubStampSpot(preferred: Float, routeBottom: Int, stampWidth: Int, stampHeight: Int, turn: Float, height: Int, hintHeight: Int): StubStampSpot {
    val radians = Math.toRadians(abs(turn).toDouble())
    val half = ((stampHeight * cos(radians) + stampWidth * sin(radians)) / 2.0).toFloat()
    val centre = max(preferred, routeBottom + half)
    return StubStampSpot(centre, max(height, ceil(centre + half).toInt() + hintHeight))
}

/**
 * The stub's column (BoardingPass.tsx PassStub: flex-col justify-between): the route line at the top, the barcode in the
 * middle of what is left, the hint row at the foot; and the Timed stamp over the barcode where stubStampSpot puts it.
 */
@Composable
private fun StubColumn(stamp: (@Composable () -> Unit)?, modifier: Modifier, content: @Composable () -> Unit) {
    Layout(contents = listOf(content, stamp ?: {}), modifier = modifier) { (rows, stamps), constraints ->
        val loose = constraints.copy(minHeight = 0)
        val route = rows[0].measure(loose)
        val barcode = rows[1].measure(loose)
        val hint = rows[2].measure(loose)
        val stampPlaceable = stamps.firstOrNull()?.measure(Constraints())
        val content = route.height + barcode.height + hint.height
        var height = max(constraints.minHeight, content)
        var stampY = 0
        if (stampPlaceable != null) {
            val spot = stubStampSpot(
                preferred = (RoundGeometry.STUB_STAMP_CENTRE - RoundGeometry.STUB_TOP).toPx(),
                routeBottom = route.height,
                stampWidth = stampPlaceable.width,
                stampHeight = stampPlaceable.height,
                turn = StampLanding.REST_ROTATION,
                height = height,
                hintHeight = hint.height,
            )
            height = spot.height
            stampY = (spot.centreY - stampPlaceable.height / 2f).roundToInt()
        }
        layout(constraints.maxWidth, height) {
            route.place(0, 0)
            barcode.place(0, route.height + (height - content) / 2)
            hint.place(0, height - hint.height)
            stampPlaceable?.place((constraints.maxWidth - stampPlaceable.width) / 2, stampY)
        }
    }
}

/** components/BoardingPass.tsx Barcode: the engine's bars (barcodeBars, task 6) stretched to the strip's size, in ink. */
@Composable
private fun BarcodeStrip(data: String, modifier: Modifier) {
    val ink = TruthyTheme.colors.ink
    val code = remember(data) { barcodeBars(data) }
    Canvas(modifier) {
        val unit = size.width / code.width
        for (bar in code.bars) {
            drawRect(ink, topLeft = Offset(bar.x * unit, 0f), size = Size(bar.width * unit, size.height))
        }
    }
}

private fun StubMark.kind(): StubStampKind = when (this) {
    StubMark.CORRECT -> StubStampKind.CORRECT
    StubMark.WRONG -> StubStampKind.WRONG
    StubMark.TIME_UP -> StubStampKind.TIME_UP
}

/** True (left, -7 degrees) and False (right, +7 degrees), opacity intent x 1.6 toward their side; task 10's intent stamps. */
@Composable
private fun IntentStamps(stampIntent: () -> Float) {
    val gain = Tokens.Gesture.intentOpacityGain
    Box(Modifier.fillMaxWidth()) {
        IntentStamp(
            kind = IntentKind.TRUE,
            modifier = Modifier
                .align(Alignment.TopStart)
                .padding(start = Tokens.Space.s16, top = RoundGeometry.INTENT_STAMP_TOP)
                .graphicsLayer {
                    rotationZ = -RoundGeometry.INTENT_STAMP_TURN
                    alpha = (stampIntent() * gain).coerceIn(0f, 1f)
                },
        )
        IntentStamp(
            kind = IntentKind.FALSE,
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(end = Tokens.Space.s16, top = RoundGeometry.INTENT_STAMP_TOP)
                .graphicsLayer {
                    rotationZ = RoundGeometry.INTENT_STAMP_TURN
                    alpha = (-stampIntent() * gain).coerceIn(0f, 1f)
                },
        )
    }
}

/** The answer slip under the torn stub: the right answer, the verdict stamp, the explanation and the source. */
@Composable
internal fun PassSlipContent(answer: Answered, newBest: Boolean, animateStamp: Boolean, onOpenSource: (String) -> Unit, modifier: Modifier = Modifier) {
    val colors = TruthyTheme.colors
    val card = answer.card
    PassLower(PaperTone.SUNK, modifier.fillMaxWidth().heightIn(min = Tokens.Size.lower)) {
        Column(
            Modifier
                .fillMaxWidth()
                .heightIn(min = Tokens.Size.lower)
                .padding(start = Tokens.Size.ticketInset, end = Tokens.Size.ticketInset, top = Tokens.Space.s18, bottom = Tokens.Space.s12),
            verticalArrangement = Arrangement.SpaceBetween,
        ) {
            Column(Modifier.fillMaxWidth()) {
                Row(
                    Modifier.fillMaxWidth().heightIn(min = RoundGeometry.SLIP_VERDICT_ROW),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s12),
                ) {
                    Column(Modifier.weight(1f).semantics(mergeDescendants = true) {}) {
                        Text("The answer is", style = TruthyType.answerLabel, color = colors.inkMuted)
                        Text(if (card.answer) "True" else "False", Modifier.padding(top = Tokens.Space.s2), style = TruthyType.answerValue, color = colors.ink)
                    }
                    Stamp(
                        verdict = when {
                            !answer.correct -> StampVerdict.WRONG
                            newBest -> StampVerdict.NEW_BEST
                            else -> StampVerdict.CORRECT
                        },
                        animate = animateStamp,
                    )
                }
                Text(cardText(card.text.en.explanation), Modifier.padding(top = Tokens.Space.s10), style = TruthyType.body, color = colors.ink)
            }
            SourceRow(card.source.title, card.source.url, onOpenSource)
        }
    }
}

@Composable
private fun SourceRow(title: String, url: String, onOpen: (String) -> Unit) {
    val colors = TruthyTheme.colors
    Row(
        Modifier
            .fillMaxWidth()
            .heightIn(min = Tokens.Size.touchMin)
            .testTag("source-link")
            .keyboardFocusRing(RoundedCornerShape(Tokens.Radius.small))
            .clickable(role = Role.Button) { onOpen(url) }
            .clearAndSetSemantics { contentDescription = sourceLinkLabel(title) },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s8),
    ) {
        TruthyIcon(IconId.BOOK, tint = colors.trueColor, width = RoundGeometry.BOOK_ICON)
        Text(title, Modifier.weight(1f, fill = false), style = TruthyType.sourceLink.copy(textDecoration = TextDecoration.Underline), color = colors.trueColor)
        Text("→", style = TruthyType.sourceLink, color = colors.trueColor)
    }
}

/** The calm stand-in while the round loads: the band with the cloud, an empty body and the stub's paper. */
@Composable
fun PlaceholderTicket(modifier: Modifier = Modifier) {
    val colors = TruthyTheme.colors
    Box(modifier.fillMaxWidth().clearAndSetSemantics {}) {
        Box(Modifier.matchParentSize().truthyShadow(TruthyTheme.shadows.ticket, cornerRadius = Tokens.Radius.card))
        Column(Modifier.fillMaxWidth()) {
            Box(
                Modifier
                    .fillMaxWidth()
                    .clip(TicketMainShape())
                    .background(colors.surfaceRaised)
                    .drawWithContent {
                        drawContent()
                        drawTicketPerforation(colors.rule)
                    },
            ) {
                Column(Modifier.fillMaxWidth()) {
                    CarrierBand(words = false)
                    Spacer(Modifier.height(RoundGeometry.PLACEHOLDER_BODY))
                }
            }
            PassLower(PaperTone.RAISED, Modifier.fillMaxWidth().height(Tokens.Size.lower))
        }
    }
}
