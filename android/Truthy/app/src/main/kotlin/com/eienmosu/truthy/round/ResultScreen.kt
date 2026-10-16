@file:OptIn(ExperimentalFoundationApi::class)

package com.eienmosu.truthy.round

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.layout
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.eienmosu.truthy.MonotonicClock
import com.eienmosu.truthy.design.IconId
import com.eienmosu.truthy.design.LowerCloud
import com.eienmosu.truthy.design.RouteIcon
import com.eienmosu.truthy.design.SkyBackdrop
import com.eienmosu.truthy.design.Tokens
import com.eienmosu.truthy.design.TruthyFrame
import com.eienmosu.truthy.design.TruthyIcon
import com.eienmosu.truthy.design.TruthyTheme
import com.eienmosu.truthy.design.truthyShadow
import com.eienmosu.truthy.engine.FADE_PX
import com.eienmosu.truthy.ui.PillButton
import com.eienmosu.truthy.ui.QuietButton
import com.eienmosu.truthy.ui.RoundButton
import com.eienmosu.truthy.engine.Comparison
import com.eienmosu.truthy.engine.RESULT_ARRIVES_MS
import com.eienmosu.truthy.engine.RoundState
import com.eienmosu.truthy.engine.TicketInfo
import com.eienmosu.truthy.engine.compareWithBest
import com.eienmosu.truthy.engine.missedCards
import com.eienmosu.truthy.engine.resultCopy
import com.eienmosu.truthy.engine.summarise

/**
 * The result of a finished round (ResultView.tsx): the completed route, the ticket with the score block and the
 * comparison with the record from before the round (ticket.best, rule 6), the missed cards, Play again and Choose
 * another route. The actions take presses once the result has been shown for RESULT_ARRIVES_MS (rule 7); the X
 * goes through the host's decision, which applies the same time.
 */
@Composable
fun ResultScreen(
    round: RoundState,
    ticket: TicketInfo,
    shownAt: Double,
    clock: MonotonicClock,
    onClose: () -> Unit,
    onPlayAgain: () -> Unit,
    onHome: () -> Unit,
    openSource: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val result = remember(round) { summarise(round) }
    val copy = remember(round, ticket) { resultCopy(result, ticket.modeLabel, round.cards.size, ticket.best) }
    val comparison = remember(round, ticket) { compareWithBest(result.score, ticket.best) }
    val missed = remember(round) { missedCards(round.answers) }
    val results = remember(round) { round.answers.map { it.correct } }
    val newBest = comparison is Comparison.NewBest
    val arrived: (() -> Unit) -> () -> Unit = { action -> { if (clock.nowMs() - shownAt >= RESULT_ARRIVES_MS) action() } }
    val headingFocus = remember { FocusRequester() }
    val comparisonView = remember { BringIntoViewRequester() }
    LaunchedEffect(Unit) {
        headingFocus.requestFocus()
        if (newBest) comparisonView.bringIntoView()
    }
    val jolt = remember { Animatable(0f) }
    LaunchedEffect(newBest) {
        if (newBest) {
            val motion = Tokens.Transitions.jolt
            jolt.animateTo(1f, tween(durationMillis = motion.durationMs, delayMillis = motion.delayMs, easing = LinearEasing))
        }
    }
    val shortLegs = LocalConfiguration.current.screenHeightDp <= LeaveResultConstants.SHORT_LEGS_MAX_HEIGHT_DP
    val colors = TruthyTheme.colors
    val density = LocalDensity.current
    val stageScroll = rememberScrollState()
    // Rule 8: where the ticket's lower part starts and where the stage ends, in root px, for the bottom fade cue.
    var lowerTop by remember { mutableFloatStateOf(Float.MAX_VALUE) }
    var stageBottom by remember { mutableFloatStateOf(0f) }
    val fadePx = with(density) { FADE_PX.toFloat().dp.toPx() }
    val fade = stageScroll.canScrollForward && lowerTop < stageBottom - fadePx
    var ticketHeight by remember { mutableIntStateOf(0) }
    Box(modifier.fillMaxSize()) {
        SkyBackdrop(lowerCloud = LowerCloud.GAME)
        TruthyFrame {
            Row(
                Modifier.fillMaxWidth().heightIn(min = Tokens.Size.header),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s12),
            ) {
                RoundButton(label = ResultText.CLOSE_RESULTS, onClick = onClose) { TruthyIcon(IconId.CLOSE) }
                CompletedFlightPath(copy, results, Modifier.weight(1f))
            }
            BoxWithConstraints(
                Modifier
                    .padding(top = Tokens.Space.s12)
                    .weight(1f)
                    .fillMaxWidth()
                    .onGloballyPositioned { stageBottom = it.positionInRoot().y + it.size.height }
                    .semantics {
                        heading()
                        contentDescription = ResultText.HEADING
                    }
                    .focusRequester(headingFocus)
                    .focusable(),
            ) {
                val stage = maxHeight
                TicketShadow(ticketHeight, stageScroll)
                Column(Modifier.fillMaxSize().verticalScroll(stageScroll)) {
                    // Task 13's ticket shell (tagged TestTags.TICKET); with a minimum height of the stage, its lower part
                    // gets at least the height the upper part leaves and grows with the missed list (rule 8).
                    BoardingPass(
                        from = PassLeg(ticket.deckCode, ticket.deckName),
                        to = PassLeg(ticket.sectionCode, ticket.sectionName),
                        fields = copy.fields.map { PassField(it.label, it.value) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(min = stage)
                            .onSizeChanged { ticketHeight = it.height }
                            .graphicsLayer { translationY = joltOffset(jolt.value) * LeaveResultConstants.JOLT_DISTANCE_DP.dp.toPx() },
                        shortLegs = shortLegs,
                        shadow = false,
                        lower = {
                            PassLower(
                                PaperTone.SUNK,
                                Modifier
                                    .fillMaxWidth()
                                    .onGloballyPositioned { lowerTop = it.positionInRoot().y },
                            ) {
                                MissedCardsList(missed, openSource)
                            }
                        },
                    ) {
                        ScoreBlock(result.score, copy, comparison, comparisonView)
                    }
                }
                if (fade) {
                    // The web's 28 px cue (MissedCards.tsx): sunk paper fading in over the stage's foot.
                    Box(
                        Modifier
                            .align(Alignment.BottomCenter)
                            .fillMaxWidth()
                            .height(FADE_PX.toFloat().dp)
                            .testTag(MISSED_FADE_TAG)
                            .clearAndSetSemantics {}
                            .background(Brush.verticalGradient(listOf(colors.surfaceSunkClear, colors.surfaceSunk))),
                    )
                }
            }
            Column(
                Modifier.fillMaxWidth().padding(top = Tokens.Space.s12),
                verticalArrangement = Arrangement.spacedBy(Tokens.Space.s4),
            ) {
                PillButton(
                    label = ResultText.PLAY_AGAIN,
                    onClick = arrived(onPlayAgain),
                    modifier = Modifier.fillMaxWidth(),
                    leadingIcon = { TruthyIcon(IconId.REPLAY, tint = colors.onDark) },
                )
                QuietButton(
                    label = ResultText.CHOOSE_ANOTHER_ROUTE,
                    onClick = arrived(onHome),
                    modifier = Modifier.fillMaxWidth(),
                    leadingIcon = { RouteIcon() },
                )
            }
        }
    }
}

/**
 * The ticket's shadow as the web's result scroller shows it (ResultView.tsx SCROLLER): the scroller runs on under Play
 * again, 12 and the pill below the stage, and clips at the column's sides, so the shadow under the ticket shows in the 12
 * above the pill and none shows beside it. The stage's own scroll clips only its scroll axis and at the stage's foot (the
 * side shadow reached the screen edge and the bottom one was cut flat, review r1), and making it reach under the pill
 * would make the hidden part count as in view for scrolling; so the scroll stays as it is, the ticket draws no shadow of
 * its own, and this layer under it draws the shadow of a ticket [ticketHeight] px tall where the scroll has moved it.
 * Inside the ticket's own box nothing is drawn (truthyShadow), so under a ticket longer than the stage the gap stays clear.
 */
@Composable
private fun TicketShadow(ticketHeight: Int, scroll: ScrollState) {
    if (ticketHeight <= 0) return
    val height = with(LocalDensity.current) { ticketHeight.toDp() }
    Box(
        Modifier
            .fillMaxWidth()
            .reachingBelow(Tokens.Space.s12 + Tokens.Size.pill)
            .clipToBounds()
            .clearAndSetSemantics {},
    ) {
        Box(
            Modifier
                .fillMaxWidth()
                .wrapContentHeight(Alignment.Top, unbounded = true)
                .height(height)
                .graphicsLayer { translationY = -scroll.value.toFloat() }
                .truthyShadow(TruthyTheme.shadows.ticket, Tokens.Radius.card),
        )
    }
}

/** The element laid out [extra] taller than the space it is given, the parent told it fills that space: it reaches below. */
private fun Modifier.reachingBelow(extra: Dp): Modifier = layout { measurable, constraints ->
    if (!constraints.hasBoundedHeight) {
        val placeable = measurable.measure(constraints)
        return@layout layout(placeable.width, placeable.height) { placeable.place(0, 0) }
    }
    val height = constraints.maxHeight + extra.roundToPx()
    val placeable = measurable.measure(constraints.copy(minHeight = height, maxHeight = height))
    layout(placeable.width, constraints.maxHeight) { placeable.place(0, 0) }
}

/** The test tag of the missed list's bottom fade cue (rule 8). */
const val MISSED_FADE_TAG = "result.missed.fade"

// The jolt's keyframes (BoardingPass.tsx JOLT): 0 to 1 by the peak time, back to 0 by the end, each part on the
// ease curve. With the system animator scale at 0 the progress jumps to 1 and the ticket stays at rest.
private fun joltOffset(progress: Float): Float {
    val peak = LeaveResultConstants.JOLT_PEAK_AT
    val ease = Tokens.Curves.ease
    return when {
        progress <= 0f || progress >= 1f -> 0f
        progress < peak -> ease.transform(progress / peak)
        else -> 1f - ease.transform((progress - peak) / (1f - peak))
    }
}
