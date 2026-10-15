package com.eienmosu.truthy.round

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedContentTransitionScope
import androidx.compose.animation.ContentTransform
import androidx.compose.animation.EnterExitState
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.animation.SizeTransform
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEvent
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.isAltPressed
import androidx.compose.ui.input.key.isCtrlPressed
import androidx.compose.ui.input.key.isMetaPressed
import androidx.compose.ui.input.key.isShiftPressed
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.layout
import androidx.compose.ui.layout.onPlaced
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.max
import androidx.core.view.HapticFeedbackConstantsCompat
import androidx.core.view.ViewCompat
import androidx.compose.foundation.shape.RoundedCornerShape
import com.eienmosu.truthy.design.FocusRingSpec
import com.eienmosu.truthy.design.IconId
import com.eienmosu.truthy.design.LocalReducedMotion
import com.eienmosu.truthy.design.LowerCloud
import com.eienmosu.truthy.design.SkyBackdrop
import com.eienmosu.truthy.design.Tokens
import com.eienmosu.truthy.design.TruthyFrame
import com.eienmosu.truthy.design.TruthyIcon
import com.eienmosu.truthy.design.TruthyTheme
import com.eienmosu.truthy.design.TruthyType
import com.eienmosu.truthy.design.keyboardFocusRing
import com.eienmosu.truthy.design.truthyShadow
import com.eienmosu.truthy.start.FullSpeed
import com.eienmosu.truthy.ui.PillButton
import com.eienmosu.truthy.ui.PillTone
import com.eienmosu.truthy.ui.RoundButton
import com.eienmosu.truthy.ui.TestTags
import com.eienmosu.truthy.engine.Answered
import com.eienmosu.truthy.engine.Mode
import com.eienmosu.truthy.engine.NEXT_ARRIVES_MS
import com.eienmosu.truthy.engine.Phase
import com.eienmosu.truthy.engine.RoundState
import com.eienmosu.truthy.engine.SPOKEN_RELEASE_MS
import com.eienmosu.truthy.engine.SlipAt
import com.eienmosu.truthy.engine.Span
import com.eienmosu.truthy.engine.TIMED
import com.eienmosu.truthy.engine.TicketInfo
import com.eienmosu.truthy.engine.slipScroll
import com.eienmosu.truthy.engine.statementScroll
import kotlin.math.roundToInt
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
fun rememberRoundHaptics(): (RoundHaptic) -> Unit {
    val view = LocalView.current
    return remember(view) { { haptic: RoundHaptic -> ViewCompat.performHapticFeedback(view, haptic.feedbackConstant()) } }
}

private fun RoundHaptic.feedbackConstant(): Int = when (this) {
    RoundHaptic.THRESHOLD -> HapticFeedbackConstantsCompat.GESTURE_THRESHOLD_ACTIVATE
    RoundHaptic.CONFIRM -> HapticFeedbackConstantsCompat.CONFIRM
    RoundHaptic.REJECT -> HapticFeedbackConstantsCompat.REJECT
}

/** The round in its question, answered and stamped phases. Draws nothing once the round is finished or abandoned. */
@Composable
fun RoundScreen(
    round: RoundState,
    ticket: TicketInfo,
    cardShownAt: () -> Double,
    onAnswer: (Boolean) -> Unit,
    onNext: () -> Unit,
    onRequestLeave: () -> Unit,
    modifier: Modifier = Modifier,
    sheetOpen: Boolean = false,
    reducedMotion: Boolean = LocalReducedMotion.current,
    haptics: (RoundHaptic) -> Unit = rememberRoundHaptics(),
    openLink: (String) -> Unit = rememberSourceOpener(),
) {
    val view = remember(round, ticket) { roundView(round, ticket) }
    if (view.card == null || round.phase == Phase.FINISHED || round.abandoned) return
    val rootFocus = remember { FocusRequester() }
    var rootHasFocus by remember { mutableStateOf(false) }
    LaunchedEffect(rootHasFocus, sheetOpen) {
        if (!rootHasFocus && !sheetOpen) {
            withFrameNanos { }
            rootFocus.tryFocus()
        }
    }
    BoxWithConstraints(
        modifier
            .fillMaxSize()
            .background(TruthyTheme.colors.surface)
            .testTag("round-screen")
            .onFocusChanged { rootHasFocus = it.hasFocus }
            .focusRequester(rootFocus)
            .focusable()
            .onPreviewKeyEvent { event -> event.type == KeyEventType.KeyDown && event.roundKey() != null && event.nativeKeyEvent.repeatCount > 0 }
            .onKeyEvent { event -> handleRoundKey(event, round.phase, view.awaitsNext, sheetOpen, onAnswer, onNext, onRequestLeave) },
    ) {
        RoundBody(
            round = round,
            view = view,
            ticket = ticket,
            short = maxHeight < Tokens.Native.shortScreenBelow,
            cardShownAt = cardShownAt,
            onAnswer = onAnswer,
            onNext = onNext,
            onRequestLeave = onRequestLeave,
            sheetOpen = sheetOpen,
            reduced = reducedMotion,
            haptics = haptics,
            openLink = openLink,
        )
    }
}

@Composable
private fun RoundBody(
    round: RoundState,
    view: RoundView,
    ticket: TicketInfo,
    short: Boolean,
    cardShownAt: () -> Double,
    onAnswer: (Boolean) -> Unit,
    onNext: () -> Unit,
    onRequestLeave: () -> Unit,
    sheetOpen: Boolean,
    reduced: Boolean,
    haptics: (RoundHaptic) -> Unit,
    openLink: (String) -> Unit,
) {
    val screenDensity = LocalDensity.current
    val hostView = LocalView.current
    val scope = rememberCoroutineScope()
    val currentHaptics by rememberUpdatedState(haptics)
    val currentAnswer by rememberUpdatedState(onAnswer)
    val currentShownAt by rememberUpdatedState(cardShownAt)

    // Verdict and time-up haptics, once per change of the round (spec 5.5).
    val previous = remember { RoundRef(round) }
    LaunchedEffect(round) {
        val haptic = verdictHaptic(previous.state, round)
        previous.state = round
        if (haptic != null) currentHaptics(haptic)
    }

    // The live regions keep what they said while the sheet is open and release it SPOKEN_RELEASE_MS after it closes.
    var held by remember { mutableStateOf<Spoken?>(null) }
    val live = view.spoken
    LaunchedEffect(sheetOpen) {
        if (sheetOpen) {
            if (held == null) held = live
        } else {
            delay(SPOKEN_RELEASE_MS.toLong())
            held = null
        }
    }
    val said = held ?: live

    val statementFocus = remember { FocusRequester() }
    val scrollerFocus = remember { FocusRequester() }
    val nextFocus = remember { FocusRequester() }
    var statementFocused by remember { mutableStateOf(false) }
    var answerRowFocused by remember { mutableStateOf(false) }
    var focusedAtTimeUp by remember { mutableStateOf(false) }
    val scroll = rememberScrollState()
    var viewportPx by remember { mutableIntStateOf(0) }
    var rowPx by remember { mutableIntStateOf(with(screenDensity) { Tokens.Size.actions.roundToPx() }) }
    val content = remember { Placed() }
    val statementText = remember { Placed() }
    val slip = remember { Placed() }
    val swipeArea = remember { Placed() }
    val swipe = remember(scope) { SwipeCardState(scope) }
    val gapPx = with(screenDensity) { Tokens.Space.s12.toPx() }
    val underPx = if (short) gapPx else gapPx + rowPx

    // A new card: scroll the statement into the stage and give it focus (in Timed only the first card's).
    LaunchedEffect(round.index, round.phase == Phase.QUESTION, round.cards.size) {
        if (round.phase != Phase.QUESTION) return@LaunchedEffect
        withFrameNanos { }
        val span = content.spanOf(statementText)
        val top = if (span == null) 0 else statementScroll(span, (viewportPx - underPx).toDouble()).roundToInt()
        launch { if (view.timed && !reduced) scroll.animateScrollTo(top) else scroll.scrollTo(top) }
        if (!view.timed || round.index == 0) statementFocus.tryFocus() else if (statementFocused) scrollerFocus.tryFocus()
    }

    // Timed: a stamped stub (an answer, or time up) scrolls the ticket to its end.
    val stubStamped = view.beat || view.timeUp
    LaunchedEffect(stubStamped, round.index) {
        if (!stubStamped) return@LaunchedEffect
        withFrameNanos { }
        if (reduced) scroll.scrollTo(scroll.maxValue) else scroll.animateScrollTo(scroll.maxValue)
    }

    // The other classes: an answer scrolls the slip into view when it is not already above the action row.
    LaunchedEffect(view.answered, round.index) {
        if (!view.answered || view.timed) return@LaunchedEffect
        withFrameNanos { }
        val span = content.spanOf(slip) ?: return@LaunchedEffect
        val at = SlipAt(top = scroll.value.toDouble(), visible = (viewportPx - underPx).toDouble(), gap = gapPx.toDouble(), max = scroll.maxValue.toDouble())
        val target = slipScroll(span, at) ?: return@LaunchedEffect
        if (reduced) scroll.scrollTo(target.roundToInt()) else scroll.animateScrollTo(target.roundToInt())
    }

    // Time up: whether True or False had focus decides whether See results takes it.
    LaunchedEffect(view.timeUp) {
        if (view.timeUp) focusedAtTimeUp = answerRowFocused
    }

    // The Next row arrives NEXT_ARRIVES_MS after the answer; focus moves to it then, or at once with reduced motion.
    var arrivedAt by remember { mutableIntStateOf(-1) }
    LaunchedEffect(view.awaitsNext, round.index) {
        if (!view.awaitsNext) return@LaunchedEffect
        delay(NEXT_ARRIVES_MS.toLong())
        arrivedAt = round.index
    }
    val focusNext = view.awaitsNext && (reduced || arrivedAt == round.index)
    LaunchedEffect(focusNext, round.index, view.timeUp) {
        if (!focusNext || (view.timeUp && !focusedAtTimeUp)) return@LaunchedEffect
        withFrameNanos { }
        nextFocus.tryFocus()
    }

    Box(Modifier.fillMaxSize()) {
        SkyBackdrop(lowerCloud = LowerCloud.GAME)
        LiveRegions(view, said)
        TruthyFrame {
            Row(
                Modifier.fillMaxWidth().heightIn(min = Tokens.Size.header),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s12),
            ) {
                RoundButton(label = "Leave round", onClick = onRequestLeave) { TruthyIcon(IconId.CLOSE) }
                RoundHeader(round, view, ticket.best, reduced, Modifier.weight(1f))
            }
            Spacer(Modifier.height(Tokens.Space.s12))
            Box(Modifier.weight(1f).fillMaxWidth()) {
                Box(
                    Modifier
                        .fillMaxSize()
                        .padding(bottom = if (short) with(screenDensity) { rowPx.toDp() } else 0.dp)
                        .widenBy(Tokens.Size.gutter)
                        .onSizeChanged { viewportPx = it.height }
                        .testTag("ticket-scroller")
                        .focusRequester(scrollerFocus)
                        // Reference 5.0: the ring sits 2 inside the ticket, for a hardware keyboard only (task 10).
                        .keyboardFocusRing(RoundedCornerShape(Tokens.Radius.card), FocusRingSpec.INSET)
                        .focusable()
                        .semantics { contentDescription = "Ticket" }
                        .verticalScroll(scroll),
                ) {
                    Column(
                        Modifier
                            .fillMaxWidth()
                            .onPlaced { content.coords = it }
                            .padding(start = Tokens.Size.gutter, end = Tokens.Size.gutter, bottom = with(screenDensity) { underPx.toDp() }),
                    ) {
                        val offsetDp = swipe.drawnPx / screenDensity.density
                        val takes = view.takesAnswers && !sheetOpen
                        Box(
                            Modifier
                                .fillMaxWidth()
                                .testTag("swipe-card")
                                .onPlaced { swipeArea.coords = it }
                                .swipeGesture(
                                    state = swipe,
                                    enabled = takes,
                                    reduced = reduced,
                                    coordinates = { swipeArea.coords },
                                    windowWidthPx = { hostView.rootView.width },
                                    cardShownAt = { currentShownAt() },
                                    onThreshold = { currentHaptics(RoundHaptic.THRESHOLD) },
                                    onSwipe = { value -> currentAnswer(value) },
                                )
                                .semantics {
                                    this[CardDragOffset] = offsetDp
                                    if (takes) {
                                        customActions = listOf(
                                            CustomAccessibilityAction("Answer true") { currentAnswer(true); true },
                                            CustomAccessibilityAction("Answer false") { currentAnswer(false); true },
                                        )
                                    }
                                },
                        ) {
                            Box(
                                Modifier
                                    .graphicsLayer {
                                        translationX = swipe.drawnPx
                                        rotationZ = swipe.drawnPx / density / Tokens.Gesture.rotationDivisor
                                    }
                                    // The drawn card, for task 15's captures; "swipe-card" above is the stationary drag area.
                                    .testTag(TestTags.CARD),
                            ) {
                                CardSwap(
                                    round = round,
                                    view = view,
                                    ticket = ticket,
                                    reduced = reduced,
                                    swipe = swipe,
                                    statementModifier = Modifier
                                        .onPlaced { statementText.coords = it }
                                        .onFocusChanged { statementFocused = it.isFocused }
                                        .focusRequester(statementFocus)
                                        .focusable(),
                                    slipModifier = Modifier.onPlaced { slip.coords = it },
                                    onOpenSource = openLink,
                                )
                            }
                        }
                    }
                }
                ActionRows(
                    view = view,
                    reduced = reduced,
                    nextFocus = nextFocus,
                    onAnswer = onAnswer,
                    onNext = onNext,
                    onAnswerRowFocus = { answerRowFocused = it },
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .fillMaxWidth()
                        .heightIn(min = Tokens.Size.actions)
                        .onSizeChanged { rowPx = it.height },
                )
            }
        }
    }
}

/** What the card shows: the round and its view, frozen per card so a leaving Timed card keeps its own stamp. */
private data class CardFrame(val key: Int, val round: RoundState, val view: RoundView)

@Composable
private fun CardSwap(
    round: RoundState,
    view: RoundView,
    ticket: TicketInfo,
    reduced: Boolean,
    swipe: SwipeCardState,
    statementModifier: Modifier,
    slipModifier: Modifier,
    onOpenSource: (String) -> Unit,
) {
    val dealRisePx = with(LocalDensity.current) { RoundGeometry.DEAL_RISE.roundToPx() }
    val animated = view.timed && !reduced
    AnimatedContent(
        targetState = CardFrame(if (view.timed) round.index else 0, round, view),
        transitionSpec = { cardSwap(animated, dealRisePx) },
        contentKey = { it.key },
        label = "card",
    ) { shown ->
        val turn by transition.animateFloat(
            transitionSpec = { tweenOf(Tokens.Duration.leaveTimed, Tokens.Curves.fall) },
            label = "leave-turn",
        ) { state -> if (state == EnterExitState.PostExit) 1f else 0f }
        val current = shown.round.index == round.index
        val side = if (shown.view.leaveSide == TearSide.RIGHT) 1f else -1f
        TicketCard(
            frame = shown,
            ticket = ticket,
            reduced = reduced,
            swipe = swipe,
            statementModifier = if (current) statementModifier else Modifier,
            slipModifier = if (current) slipModifier else Modifier,
            onOpenSource = onOpenSource,
            modifier = Modifier.graphicsLayer { rotationZ = turn * RoundGeometry.LEAVE_TURN * side },
        )
    }
}

/** Timed: the answered card leaves towards its side over the next one coming up from 14 dp (PlayScreen.tsx CARD_SWAP). */
private fun AnimatedContentTransitionScope<CardFrame>.cardSwap(animated: Boolean, dealRisePx: Int): ContentTransform {
    val transform = if (!animated) {
        EnterTransition.None togetherWith ExitTransition.None
    } else {
        val toRight = initialState.view.leaveSide == TearSide.RIGHT
        val enter = fadeIn(tweenOf(Tokens.Duration.dealTimed, Tokens.Curves.ease)) +
            slideInVertically(tweenOf(Tokens.Duration.dealTimed, Tokens.Curves.ease)) { dealRisePx }
        val exit = fadeOut(tweenOf(Tokens.Duration.leaveTimed, Tokens.Curves.easeIn)) +
            slideOutHorizontally(tweenOf(Tokens.Duration.leaveTimed, Tokens.Curves.fall)) { width ->
                ((if (toRight) 1f else -1f) * width * RoundGeometry.LEAVE_FRACTION).roundToInt()
            }
        enter togetherWith exit
    }
    val sized = transform using SizeTransform(clip = false)
    sized.targetContentZIndex = -targetState.key.toFloat()
    return sized
}

@Composable
private fun TicketCard(
    frame: CardFrame,
    ticket: TicketInfo,
    reduced: Boolean,
    swipe: SwipeCardState,
    statementModifier: Modifier,
    slipModifier: Modifier,
    onOpenSource: (String) -> Unit,
    modifier: Modifier,
) {
    val view = frame.view
    val card = view.card ?: return
    val index = frame.round.index
    BoardingPass(
        from = PassLeg(ticket.deckCode, ticket.deckName),
        to = PassLeg(ticket.sectionCode, ticket.sectionName),
        fields = listOf(
            PassField("Class", ticket.modeLabel),
            PassField("Card", view.cardField),
            if (view.timeUp) PassField("Gate", "Closed", muted = true) else PassField("Gate", "F ← → T", spoken = "False left, true right"),
        ),
        modifier = modifier,
        jolt = view.answered || view.beat || view.timeUp,
        joltDelayMs = when {
            view.timeUp -> RoundGeometry.JOLT_DELAY_TIME_UP
            view.beat -> RoundGeometry.JOLT_DELAY_BEAT
            else -> Tokens.Transitions.jolt.delayMs
        },
        reduced = reduced,
        lower = {
            Box(Modifier.fillMaxWidth().heightIn(min = Tokens.Size.lower)) {
                val answered = view.slip
                if (answered != null) {
                    key(index) { SlipLayer(answered, view.newBest, reduced, onOpenSource, slipModifier) }
                }
                key(index) {
                    StubLayer(visible = view.showStub, enterAnimated = !view.timed && index > 0, tear = view.tear, reduced = reduced) {
                        PassStubContent(
                            routeLine = view.routeLine,
                            cardLabel = "Card ${view.cardNumber}",
                            barcode = card.id,
                            hint = view.stubHint,
                            mark = view.stubMark,
                            stampIntent = { swipe.stampIntent },
                            stubTurn = { swipe.stubTurn },
                        )
                    }
                }
            }
        },
    ) {
        PassStatement(card.text.en.statement, card.appliesTo, muted = view.timeUp, textModifier = statementModifier)
    }
}

/** The slip appears under the stub as it tears; with reduced motion it fades in over 140 ms, kept at any system scale. */
@Composable
private fun SlipLayer(answer: Answered, newBest: Boolean, reduced: Boolean, onOpenSource: (String) -> Unit, modifier: Modifier) {
    val alpha = remember { Animatable(if (reduced) 0f else 1f) }
    LaunchedEffect(Unit) {
        if (alpha.value < 1f) withContext(FullSpeed) { alpha.animateTo(1f, tweenOf(Tokens.Duration.reducedIn, Tokens.Curves.easeOut)) }
    }
    PassSlipContent(answer, newBest, animateStamp = !reduced, onOpenSource = onOpenSource, modifier = modifier.graphicsLayer { this.alpha = alpha.value })
}

/** The stub's presence: it enters from 12 dp, and tears off towards `tear` when it leaves (fades with reduced motion). */
@Composable
private fun StubLayer(visible: Boolean, enterAnimated: Boolean, tear: TearSide, reduced: Boolean, content: @Composable () -> Unit) {
    var present by remember { mutableStateOf(visible) }
    val alpha = remember { Animatable(if (visible && !enterAnimated) 1f else 0f) }
    val rise = remember { Animatable(if (visible && enterAnimated && !reduced) RoundGeometry.STUB_RISE.value else 0f) }
    val fall = remember { Animatable(0f) }
    var side by remember { mutableStateOf(tear) }
    LaunchedEffect(visible) {
        if (visible) {
            present = true
            if (alpha.value >= 1f) return@LaunchedEffect
            coroutineScope {
                if (reduced) {
                    launch { withContext(FullSpeed) { alpha.animateTo(1f, tweenOf(Tokens.Duration.reducedIn, Tokens.Curves.easeOut)) } }
                } else {
                    launch { alpha.animateTo(1f, tweenOf(Tokens.Duration.t2, Tokens.Curves.ease)) }
                    launch { rise.animateTo(0f, tweenOf(Tokens.Duration.t2, Tokens.Curves.ease)) }
                }
            }
        } else {
            side = tear
            coroutineScope {
                if (reduced) {
                    launch { withContext(FullSpeed) { alpha.animateTo(0f, tweenOf(Tokens.Duration.reducedOut, Tokens.Curves.easeOut)) } }
                } else {
                    launch { fall.animateTo(1f, tweenOf(Tokens.Duration.tear, Tokens.Curves.fall)) }
                    launch { alpha.animateTo(0f, tweenOf(Tokens.Duration.tear, Tokens.Curves.easeIn)) }
                }
            }
            present = false
        }
    }
    if (!present) return
    Box(
        Modifier.graphicsLayer {
            val direction = if (side == TearSide.RIGHT) 1f else -1f
            this.alpha = alpha.value
            translationX = direction * RoundGeometry.TEAR_X.toPx() * fall.value
            translationY = rise.value.dp.toPx() + RoundGeometry.TEAR_Y.toPx() * fall.value
            rotationZ = direction * RoundGeometry.TEAR_TURN * fall.value
        },
    ) { content() }
}

/** The answer row (False, True) and the Next row (Next card or See results), crossing over in place. */
@Composable
private fun ActionRows(
    view: RoundView,
    reduced: Boolean,
    nextFocus: FocusRequester,
    onAnswer: (Boolean) -> Unit,
    onNext: () -> Unit,
    onAnswerRowFocus: (Boolean) -> Unit,
    modifier: Modifier,
) {
    Box(modifier) {
        FadingRow(visible = !view.awaitsNext, reduced = reduced, enterDelayMs = 0) {
            Row(
                Modifier.fillMaxWidth().onFocusChanged { onAnswerRowFocus(it.hasFocus) },
                horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s12),
            ) {
                PillButton(
                    label = "False",
                    onClick = { if (!view.beat) onAnswer(false) },
                    modifier = Modifier.weight(1f).testTag("answer-false"),
                    tone = PillTone.FALSE,
                    dimmed = view.beat,
                    leadingIcon = { TruthyIcon(IconId.CROSS, tint = TruthyTheme.colors.onDark, width = RoundGeometry.CROSS_ICON) },
                )
                PillButton(
                    label = "True",
                    onClick = { if (!view.beat) onAnswer(true) },
                    modifier = Modifier.weight(1f).testTag("answer-true"),
                    tone = PillTone.TRUE,
                    dimmed = view.beat,
                    leadingIcon = { TruthyIcon(IconId.CHECK, tint = TruthyTheme.colors.onDark, width = RoundGeometry.CHECK_ICON) },
                )
            }
        }
        FadingRow(visible = view.awaitsNext, reduced = reduced, enterDelayMs = Tokens.Transitions.answerRow.delayMs) {
            PillButton(
                label = view.actionLabel,
                onClick = onNext,
                modifier = Modifier.fillMaxWidth().focusRequester(nextFocus).testTag("next"),
                trailingIcon = { TruthyIcon(IconId.FORWARD, tint = TruthyTheme.colors.onDark) },
            )
        }
    }
}

/** A row that rises in from 12 dp and sinks out to it over 220 ms; with reduced motion only the fade, kept at any system scale. */
@Composable
private fun FadingRow(visible: Boolean, reduced: Boolean, enterDelayMs: Int, content: @Composable () -> Unit) {
    var present by remember { mutableStateOf(visible) }
    var settled by remember { mutableStateOf(false) }
    val alpha = remember { Animatable(if (visible) 1f else 0f) }
    val rise = remember { Animatable(0f) }
    LaunchedEffect(visible) {
        if (!settled) {
            settled = true
            return@LaunchedEffect
        }
        val travel = if (reduced) 0f else RoundGeometry.ROW_RISE.value
        val delayMs = if (reduced) 0 else enterDelayMs
        if (visible) {
            present = true
            rise.snapTo(travel)
            coroutineScope {
                launch { withContext(FullSpeed) { alpha.animateTo(1f, tweenOf(Tokens.Duration.t2, Tokens.Curves.ease, delayMs)) } }
                launch { rise.animateTo(0f, tweenOf(Tokens.Duration.t2, Tokens.Curves.ease, delayMs)) }
            }
        } else {
            coroutineScope {
                launch { withContext(FullSpeed) { alpha.animateTo(0f, tweenOf(Tokens.Duration.t2, Tokens.Curves.ease)) } }
                launch { rise.animateTo(travel, tweenOf(Tokens.Duration.t2, Tokens.Curves.ease)) }
            }
            present = false
        }
    }
    if (!present) return
    Box(
        Modifier.fillMaxWidth().graphicsLayer {
            this.alpha = alpha.value
            translationY = rise.value.dp.toPx()
        },
    ) { content() }
}

@Composable
private fun RoundHeader(round: RoundState, view: RoundView, best: Int?, reduced: Boolean, modifier: Modifier) {
    when (round.mode) {
        Mode.STREAK -> StreakHeader(view.streak, best, view.slip?.correct, reduced, modifier)
        Mode.LIVES -> LivesHeader(view.results, view.answered, reduced, modifier)
        Mode.TIMED -> TimedHeader(round.clock?.remainingMs ?: TIMED.roundMs, view.correctCount, view.wrongCount, reduced, modifier)
        Mode.CLASSIC -> FlightPathHeader(round.cards.size, view.results, round.index, view.answered, reduced, modifier)
    }
}

/** The heading and the two live regions, drawn as nothing (reference 4.5 and 5.9). */
@Composable
private fun LiveRegions(view: RoundView, said: Spoken) {
    Box(Modifier.size(RoundGeometry.SPOKEN_NODE).semantics { heading(); contentDescription = view.heading })
    Box(
        Modifier.size(RoundGeometry.SPOKEN_NODE).testTag("status").semantics {
            liveRegion = LiveRegionMode.Polite
            if (said.status.isNotEmpty()) contentDescription = said.status
        },
    )
    if (view.timed) {
        Box(
            Modifier.size(RoundGeometry.SPOKEN_NODE).testTag("card-announcer").semantics {
                liveRegion = LiveRegionMode.Polite
                if (said.card.isNotEmpty()) contentDescription = said.card
            },
        )
    }
}

// The 430 column and the safe areas are task 10's TruthyFrame (spec 5.6, one implementation for every screen).

/** P0: the sky, the X, the placeholder ticket, the heading "Your round" and the status "Loading your round". */
@Composable
fun RoundLoading(onRequestLeave: () -> Unit, modifier: Modifier = Modifier) {
    BoxWithConstraints(modifier.fillMaxSize().background(TruthyTheme.colors.surface)) {
        val short = maxHeight < Tokens.Native.shortScreenBelow
        SkyBackdrop(lowerCloud = LowerCloud.GAME)
        Box(Modifier.size(RoundGeometry.SPOKEN_NODE).semantics { heading(); contentDescription = "Your round" })
        Box(Modifier.size(RoundGeometry.SPOKEN_NODE).semantics { liveRegion = LiveRegionMode.Polite; contentDescription = "Loading your round" })
        TruthyFrame {
            Row(Modifier.fillMaxWidth().heightIn(min = Tokens.Size.header), verticalAlignment = Alignment.CenterVertically) {
                RoundButton(label = "Leave round", onClick = onRequestLeave) { TruthyIcon(IconId.CLOSE) }
            }
            Spacer(Modifier.height(Tokens.Space.s12))
            Box(Modifier.weight(1f).fillMaxWidth()) { PlaceholderTicket() }
            Spacer(Modifier.height(Tokens.Space.s12 + Tokens.Size.actions))
        }
    }
}

/**
 * P1: the sky, the X, the alert card "This deck didn't load" with its heading, and the pill "Try again" in the actions
 * area that P0 reserves (useRound.ts LOAD_FAILED_MESSAGE). Reachable with embedded decks only on a corrupt bundle.
 */
@Composable
fun RoundLoadFailed(onRetry: () -> Unit, onRequestLeave: () -> Unit, modifier: Modifier = Modifier) {
    val colors = TruthyTheme.colors
    BoxWithConstraints(modifier.fillMaxSize().background(colors.surface)) {
        SkyBackdrop(lowerCloud = LowerCloud.GAME)
        TruthyFrame {
            Row(Modifier.fillMaxWidth().heightIn(min = Tokens.Size.header), verticalAlignment = Alignment.CenterVertically) {
                RoundButton(label = "Leave round", onClick = onRequestLeave) { TruthyIcon(IconId.CLOSE) }
            }
            Spacer(Modifier.height(Tokens.Space.s12))
            Column(Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState())) {
                Column(
                    Modifier
                        .fillMaxWidth()
                        .truthyShadow(TruthyTheme.shadows.small, Tokens.Radius.card)
                        .clip(RoundedCornerShape(Tokens.Radius.card))
                        .background(colors.surfaceRaised)
                        .semantics { liveRegion = LiveRegionMode.Assertive }
                        .padding(Tokens.Space.s20),
                ) {
                    Text(
                        "This deck didn't load",
                        style = TruthyType.emphasis,
                        color = colors.ink,
                        modifier = Modifier.semantics { heading() },
                    )
                    Text(
                        "Check your connection and try again.",
                        style = TruthyType.body,
                        color = colors.ink,
                        modifier = Modifier.padding(top = Tokens.Space.s8),
                    )
                }
            }
            Spacer(Modifier.height(Tokens.Space.s12))
            Box(Modifier.fillMaxWidth().heightIn(min = Tokens.Size.actions), contentAlignment = Alignment.BottomCenter) {
                PillButton(label = "Try again", onClick = onRetry)
            }
        }
    }
}

private class RoundRef(var state: RoundState)

private class Placed {
    var coords: LayoutCoordinates? = null
}

/** Where a part lies in the ticket's scroll content, from top to bottom in px. */
private fun Placed.spanOf(part: Placed): Span? {
    val base = coords ?: return null
    val node = part.coords ?: return null
    if (!base.isAttached || !node.isAttached) return null
    val top = base.localPositionOf(node, Offset.Zero).y.toDouble()
    return Span(top, top + node.size.height)
}

/** The scroller runs from frame edge to frame edge, so a dragged card reaches it (PlayScreen.tsx -mx gutter). */
private fun Modifier.widenBy(side: Dp): Modifier = layout { measurable, constraints ->
    val extra = side.roundToPx() * 2
    val width = constraints.maxWidth + extra
    val placeable = measurable.measure(constraints.copy(minWidth = width, maxWidth = width))
    layout(constraints.maxWidth, placeable.height) { placeable.place(-extra / 2, 0) }
}

private fun FocusRequester.tryFocus() {
    try {
        requestFocus()
    } catch (notAttached: IllegalStateException) {
        return
    }
}

private fun KeyEvent.roundKey(): RoundKey? = when (key) {
    Key.DirectionLeft -> RoundKey.LEFT
    Key.DirectionRight -> RoundKey.RIGHT
    Key.Enter, Key.NumPadEnter -> RoundKey.ENTER
    Key.Escape -> RoundKey.ESCAPE
    else -> null
}

private fun handleRoundKey(
    event: KeyEvent,
    phase: Phase,
    awaitsNext: Boolean,
    sheetOpen: Boolean,
    onAnswer: (Boolean) -> Unit,
    onNext: () -> Unit,
    onLeave: () -> Unit,
): Boolean {
    val key = event.roundKey() ?: return false
    val modified = event.isAltPressed || event.isCtrlPressed || event.isMetaPressed || event.isShiftPressed
    if (event.type == KeyEventType.KeyUp) return key == RoundKey.ESCAPE && !modified && !sheetOpen
    if (event.type != KeyEventType.KeyDown) return false
    when (val action = roundKeyAction(key, event.nativeKeyEvent.repeatCount > 0, modified, sheetOpen, phase, awaitsNext)) {
        null -> return false
        is RoundKeyAction.Answer -> onAnswer(action.value)
        RoundKeyAction.Next -> onNext()
        RoundKeyAction.Leave -> onLeave()
        RoundKeyAction.Swallow -> Unit
    }
    return true
}
