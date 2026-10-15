@file:OptIn(ExperimentalFoundationApi::class)

package com.eienmosu.truthy.round

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.collapse
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.expand
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import com.eienmosu.truthy.design.IconId
import com.eienmosu.truthy.design.LocalReducedMotion
import com.eienmosu.truthy.design.Tokens
import com.eienmosu.truthy.design.TruthyIcon
import com.eienmosu.truthy.design.TruthyText
import com.eienmosu.truthy.design.TruthyTheme
import com.eienmosu.truthy.design.TruthyType
import com.eienmosu.truthy.design.keyboardFocusRing
import com.eienmosu.truthy.engine.MissedCard
import kotlinx.coroutines.delay

/**
 * The missed cards on the sunk lower part of the result ticket (MissedCards.tsx): a header row, then each card's
 * number, what was said, the applies-to line, the statement, the right answer and a Why disclosure; one calm line
 * when nothing was missed. The list scrolls with the result column (rule 8).
 */
@Composable
fun MissedCardsList(missed: List<MissedCard>, openSource: (String) -> Unit, modifier: Modifier = Modifier) {
    val colors = TruthyTheme.colors
    if (missed.isEmpty()) {
        Column(
            modifier
                .fillMaxWidth()
                .semantics { contentDescription = ResultText.MISSED_CARDS }
                .padding(start = Tokens.Size.ticketInset, end = Tokens.Size.ticketInset, top = Tokens.Space.s16, bottom = Tokens.Space.s20),
        ) {
            BasicText(ResultText.NO_MISSED_CARDS, style = TruthyType.listStatement.copy(color = colors.ink))
        }
        return
    }
    Column(modifier.fillMaxWidth()) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(start = Tokens.Size.ticketInset, end = Tokens.Size.ticketInset, top = Tokens.Space.s16, bottom = Tokens.Space.s4),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Bottom,
        ) {
            BasicText(
                ResultText.MISSED_CARDS,
                style = TruthyType.monoData.copy(color = colors.inkMuted),
                modifier = Modifier.semantics { heading() },
            )
            // At a large font scale the two no longer fit on one line: 8 between them keeps them two words apart, and
            // the count wraps to the right. At 1.0 the space between them is wider than 8, as on the web (justify-between).
            BasicText(
                ResultText.toReview(missed.size),
                style = TruthyType.monoDataStrong.copy(color = colors.ink, textAlign = TextAlign.End),
                modifier = Modifier.padding(start = LeaveResultConstants.MISSED_HEADER_GAP_DP.dp),
            )
        }
        Column(Modifier.fillMaxWidth().padding(start = Tokens.Size.ticketInset, end = Tokens.Size.ticketInset, bottom = Tokens.Space.s20)) {
            missed.forEachIndexed { i, item -> MissedRow(item, first = i == 0, openSource = openSource) }
        }
    }
}

@Composable
private fun MissedRow(item: MissedCard, first: Boolean, openSource: (String) -> Unit) {
    val colors = TruthyTheme.colors
    val reduced = LocalReducedMotion.current
    var open by rememberSaveable(item.number) { mutableStateOf(false) }
    val chevron by animateFloatAsState(
        targetValue = if (open) 180f else 0f,
        animationSpec = tween(durationMillis = Tokens.Duration.t2, easing = Tokens.Curves.ease),
        label = "why chevron",
    )
    val whyView = remember { BringIntoViewRequester() }
    var whySize by remember { mutableStateOf(IntSize.Zero) }
    val density = LocalDensity.current
    val below = with(density) { (Tokens.Space.s4 + LeaveResultConstants.WHY_SCROLL_CLEARANCE_DP.dp).toPx() }
    LaunchedEffect(open) {
        if (open) {
            delay(if (reduced) LeaveResultConstants.WHY_SCROLL_DELAY_REDUCED_MS else LeaveResultConstants.WHY_SCROLL_DELAY_MS)
            whyView.bringIntoView(Rect(0f, 0f, whySize.width.toFloat(), whySize.height + below))
        }
    }
    val toggle: () -> Unit = { open = !open }
    val rule = colors.rule
    val ruleWidth = Tokens.Stroke.rule
    Column(
        Modifier
            .fillMaxWidth()
            .then(
                if (first) Modifier
                else Modifier.drawBehind { drawLine(rule, Offset(0f, 0f), Offset(size.width, 0f), ruleWidth.toPx()) },
            )
            .padding(top = Tokens.Space.s12, bottom = Tokens.Space.s4),
    ) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            BasicText(ResultText.cardCaption(item.number), style = TruthyType.monoCaption.copy(color = colors.inkMuted))
            BasicText(ResultText.youSaid(item.given), style = TruthyType.monoCaption.copy(color = colors.inkMuted))
        }
        val applies = item.appliesTo
        if (applies != null) {
            BasicText(
                applies,
                style = TruthyType.monoData.copy(color = colors.inkMuted),
                modifier = Modifier.padding(top = Tokens.Space.s6).clearAndSetSemantics { contentDescription = ResultText.appliesTo(applies) },
            )
        }
        // Task 13's cardText: code parts in Overpass Mono at 0.92 em, the one helper for card text.
        TruthyText(cardText(item.statement), TruthyType.listStatement, colors.ink, modifier = Modifier.padding(top = Tokens.Space.s6))
        Row(
            Modifier.fillMaxWidth().heightIn(min = Tokens.Size.touchMin),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s12),
        ) {
            Row(
                Modifier.weight(1f).semantics(mergeDescendants = true) {},
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s8),
            ) {
                BasicText(ResultText.ANSWER, style = TruthyType.monoData.copy(color = colors.inkMuted))
                BasicText(ResultText.word(item.answer), style = TruthyType.missedAnswer.copy(color = colors.ink))
            }
            Row(
                Modifier
                    .offset(x = Tokens.Space.s8)
                    .heightIn(min = Tokens.Size.touchMin)
                    .keyboardFocusRing(RoundedCornerShape(Tokens.Radius.small))
                    .clip(RoundedCornerShape(Tokens.Radius.small))
                    .clickable(interactionSource = null, indication = null, onClick = toggle)
                    .clearAndSetSemantics {
                        contentDescription = ResultText.whyLabel(item.number)
                        onClick { toggle(); true }
                        if (open) collapse { toggle(); true } else expand { toggle(); true }
                    }
                    .padding(start = Tokens.Space.s8, end = Tokens.Space.s8),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s6),
            ) {
                BasicText(
                    ResultText.WHY,
                    style = TruthyType.monoDataStrong.copy(color = colors.trueColor, textDecoration = TextDecoration.Underline),
                )
                TruthyIcon(IconId.CHEVRON_DOWN, tint = colors.trueColor, modifier = Modifier.graphicsLayer { rotationZ = chevron })
            }
        }
        val disclosure = Tokens.Transitions.disclosure
        AnimatedVisibility(
            visible = open,
            enter = expandVertically(animationSpec = tween(durationMillis = disclosure.durationMs, easing = disclosure.easing)),
            exit = shrinkVertically(animationSpec = tween(durationMillis = disclosure.durationMs, easing = disclosure.easing)),
        ) {
            Row(
                Modifier
                    .fillMaxWidth()
                    .onSizeChanged { whySize = it }
                    .bringIntoViewRequester(whyView)
                    .padding(bottom = Tokens.Space.s12)
                    .height(IntrinsicSize.Min),
            ) {
                Box(Modifier.width(Tokens.Stroke.quote).fillMaxHeight().background(colors.rule))
                Column(Modifier.padding(start = Tokens.Space.s12)) {
                    TruthyText(cardText(item.explanation), TruthyType.missedExplanation, colors.ink)
                    SourceLink(item.source.title, item.source.url, openSource)
                }
            }
        }
    }
}

@Composable
private fun SourceLink(title: String, url: String, openSource: (String) -> Unit) {
    val colors = TruthyTheme.colors
    val style = TruthyType.monoDataStrong.copy(color = colors.trueColor)
    Row(
        Modifier
            .fillMaxWidth()
            .heightIn(min = Tokens.Size.touchMin)
            .keyboardFocusRing(RoundedCornerShape(Tokens.Radius.small))
            .clickable(interactionSource = null, indication = null) { openSource(url) }
            .clearAndSetSemantics {
                contentDescription = ResultText.sourceLabel(title)
                onClick { openSource(url); true }
            },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s8),
    ) {
        TruthyIcon(IconId.BOOK, tint = colors.trueColor)
        BasicText(title, style = style.copy(textDecoration = TextDecoration.Underline), modifier = Modifier.weight(1f, fill = false))
        BasicText("→", style = style)
    }
}
