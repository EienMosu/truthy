package com.eienmosu.truthy.start

import androidx.activity.compose.PredictiveBackHandler
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.lerp
import androidx.compose.ui.unit.max
import com.eienmosu.truthy.BackTransition
import com.eienmosu.truthy.HardwareKeyHandler
import com.eienmosu.truthy.design.LocalReducedMotion
import com.eienmosu.truthy.design.Logo
import com.eienmosu.truthy.design.rememberFrameInsets
import androidx.compose.ui.platform.testTag
import com.eienmosu.truthy.ui.TestTags
import com.eienmosu.truthy.design.LowerCloud
import com.eienmosu.truthy.design.SkyBackdrop
import com.eienmosu.truthy.design.Tokens
import com.eienmosu.truthy.design.TruthyTheme
import com.eienmosu.truthy.design.TruthyType
import com.eienmosu.truthy.engine.PassFieldName
import com.eienmosu.truthy.engine.RECENT
import com.eienmosu.truthy.engine.Step
import com.eienmosu.truthy.engine.Theme
import com.eienmosu.truthy.engine.chosenOn
import com.eienmosu.truthy.engine.clearFrom
import com.eienmosu.truthy.ui.BackPill
import com.eienmosu.truthy.ui.PillButton
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch

/**
 * What the start screen reads from task 11's model: the catalog (null while it loads, `failed` when it could not),
 * the step and choices with the model's direction, the card to focus going back, the field a name travels into,
 * the step change's sequence number, the arrival from a round, boarding, and the theme on screen.
 */
data class StartFlowUi(
    val data: StartData?,
    val failed: Boolean,
    val current: PanelSnapshot,
    val forward: Boolean,
    val focusId: String?,
    val travel: PassFieldName?,
    val seq: Int,
    val fromRound: Boolean,
    val boarding: Boolean,
    val theme: Theme,
)

/** What the start screen asks of the model and the app (StartFlowRoute binds it to task 11's names). */
interface StartFlowActions {
    fun choose(forward: Forward): Boolean
    fun tapBack()
    fun jump(field: PassFieldName)
    fun backOne()
    fun backTo(step: Step)
    fun backTransition(itemCount: Int): BackTransition?
    fun columnJumped()
    fun continueLast(): Boolean
    fun startRound(): Boolean
    fun onUnrolled()
    fun switchTheme()
    fun arrivalFocusTaken()
    fun retryCatalog()
}

/** The card a forward tap came from, so its name can travel once the model has moved (Rule 2). */
private data class PendingName(val optionId: String, val field: PassFieldName, val from: Spot, val to: PanelSnapshot)

/** Reduced motion comes from the app root (`TruthyRoot` provides `LocalReducedMotion` for every screen, rule 4). */
@Composable
fun StartFlowScreen(ui: StartFlowUi, actions: StartFlowActions) {
    StartFlowContent(ui, actions, LocalReducedMotion.current)
}

@Composable
private fun StartFlowContent(ui: StartFlowUi, actions: StartFlowActions, reduced: Boolean) {
    val scope = rememberCoroutineScope()
    val travels = remember { Travels() }
    val motion = remember { StartMotion(scope, travels, ui.current) }
    val latest by rememberUpdatedState(ui)
    val columnScroll = rememberScrollState()
    var pendingName by remember { mutableStateOf<PendingName?>(null) }
    var focus by remember { mutableStateOf<PanelFocus?>(null) }
    val unroll = remember { Animatable(0f) }
    var unrolling by remember { mutableStateOf(false) }
    val chrome by animateFloatAsState(
        targetValue = if (ui.boarding) 0f else 1f,
        animationSpec = if (reduced) snap() else tween(durationMillis = Tokens.Duration.topExit),
        label = "boarding",
    )

    BoxWithConstraints(Modifier.fillMaxSize()) {
        val short = maxHeight < Tokens.Native.shortScreenBelow
        val tight = maxHeight < Breakpoints.tight

        fun swapsBetween(from: PanelSnapshot, to: PanelSnapshot): Swaps {
            val data = latest.data
            val withContinue = data != null && continueModel(data) != null
            return swapsFor(from.step, to.step, footContent(from.step, withContinue), footContent(to.step, withContinue))
        }

        fun travelStart(name: PendingName?, from: PanelSnapshot, to: PanelSnapshot, swaps: Swaps): TravelStart? {
            val data = latest.data
            if (reduced || data == null) return null
            val toStage = stageOf(to.step)
            val nameFlight = name?.let { NameFlight(it.from, SpotKey(toStage, it.field)) }
            val values = if (!swaps.block) {
                emptyList()
            } else {
                val fromStage = stageOf(from.step)
                val oldFilled = filledFields(passValues(resolveChoice(data.index, from.choice)))
                val newFilled = filledFields(passValues(resolveChoice(data.index, to.choice)))
                PassFieldName.entries
                    .filter { it != name?.field && it in oldFilled && it in newFilled && stageShows(fromStage, it) && stageShows(toStage, it) }
                    .mapNotNull { field -> travels.spots[SpotKey(fromStage, field)]?.let { ValueFlight(it, SpotKey(toStage, field)) } }
            }
            if (nameFlight == null && values.isEmpty()) return null
            return TravelStart(nameFlight, name?.optionId, values)
        }

        fun onOption(option: OptionModel) {
            val forward = option.forward ?: return
            val field = forward.field
            val from = travels.names[option.id]
            pendingName = if (!reduced && field != null && field != PassFieldName.MODE && from != null) {
                PendingName(option.id, field, from, PanelSnapshot(forward.step, forward.choice))
            } else {
                null
            }
            if (!actions.choose(forward)) pendingName = null
        }

        // Reference 4.4: arriving from the round by a control, the step 1 title takes focus once.
        LaunchedEffect(ui.fromRound) {
            if (ui.fromRound) {
                focus = PanelFocus.Title
                actions.arrivalFocusTaken()
            }
        }

        // Rule 1: a new step from the model starts its motion, unless the screen already shows it (a committed gesture).
        LaunchedEffect(ui.seq, ui.current) {
            val state = latest
            val now = state.current
            if (now == motion.shown) return@LaunchedEffect
            val from = motion.finishNow()
            if (now == from) return@LaunchedEffect
            val data = state.data
            val swaps = swapsBetween(from, now)
            if (short && columnScroll.value > 0) {
                columnScroll.scrollTo(0)
                actions.columnJumped()
            }
            when {
                state.forward -> {
                    val name = pendingName?.takeIf { it.to == now && it.field == state.travel }
                    focus = PanelFocus.Title
                    motion.forward(now, itemCount(data, now), reduced, swaps, travelStart(name, from, now, swaps))
                }
                now.step < from.step -> {
                    focus = state.focusId?.let { PanelFocus.Card(it) }
                    motion.backOverTime(now, itemCount(data, now), reduced, swaps, travelStart(null, from, now, swaps))
                }
                else -> motion.showAtOnce(now)
            }
            pendingName = null
        }

        // Rule 3: predictive back on every step after the first; consumed while the pass boards.
        PredictiveBackHandler(enabled = ui.current.step != Step.ONE || ui.boarding) { events ->
            val state = latest
            val data = state.data
            if (state.boarding || unrolling || data == null || state.current.step == Step.ONE) {
                events.collect { }
                return@PredictiveBackHandler
            }
            val from = motion.finishNow()
            val target = backTarget(data.index, from)
            val to = PanelSnapshot(target, clearFrom(from.choice, target))
            val count = itemCount(data, to)
            val transition = actions.backTransition(count)
            if (transition == null) {
                events.collect { }
                return@PredictiveBackHandler
            }
            val swaps = swapsBetween(from, to)
            motion.beginScrub(to, transition, count, reduced, swaps, travelStart(null, from, to, swaps))
            followBack(events.map { it.progress }, onProgress = { motion.scrubTo(it) }) { end ->
                when (end) {
                    is BackEnd.Committed -> motion.commitScrub(end.lastProgress) {
                        focus = chosenOn(transition.to, from.choice)?.let { PanelFocus.Card(it) }
                        actions.backTo(transition.to)
                    }
                    BackEnd.Cancelled -> motion.cancelScrub()
                }
            }
        }

        // Rule 5: Escape.
        HardwareKeyHandler { event ->
            val state = latest
            when (startKeyAction(event.keyCode, event.action, event.repeatCount, state.current.step, state.boarding || unrolling)) {
                StartKey.BACK -> {
                    actions.backOne()
                    true
                }
                StartKey.CONSUME -> true
                StartKey.PASS -> false
            }
        }

        // StartFlow.tsx:694-726, FillInPass.tsx:523-534: Start round unrolls the empty paper (at once with reduced motion), then the round opens.
        LaunchedEffect(ui.boarding) {
            if (!ui.boarding) {
                unrolling = false
                unroll.snapTo(0f)
                return@LaunchedEffect
            }
            motion.finishNow()
            if (columnScroll.value > 0) launch { if (reduced) columnScroll.scrollTo(0) else columnScroll.animateScrollTo(0) }
            if (reduced) {
                actions.onUnrolled()
                return@LaunchedEffect
            }
            unrolling = true
            unroll.snapTo(0f)
            unroll.animateTo(1f, tween(durationMillis = Tokens.Duration.t3, easing = Tokens.Curves.ease))
            actions.onUnrolled()
        }

        // Spec 5.6's safe areas, task 10's one implementation (the short-window rule is inside it).
        val frame = rememberFrameInsets()
        val top = frame.top
        val bottom = frame.bottom
        val start = frame.start
        val end = frame.end
        val data = ui.data
        val shown = motion.shown
        val leaving = motion.leaving
        val layers = motion.layers
        val continueLine = data?.let { continueModel(it) }

        @Composable
        fun TopZone(snapshot: PanelSnapshot, layer: Layer, interactive: Boolean, isLeaving: Boolean) {
            if (snapshot.step == Step.ONE) {
                Column(Modifier.fillMaxWidth().moved(layer).padding(top = StartGeometry.logoTop)) {
                    Logo(modifier = Modifier.testTag(TestTags.LOGO), asHeading = true)
                    Text(
                        StartCopy.TAGLINE,
                        style = TruthyType.tagline,
                        color = TruthyTheme.colors.ink,
                        modifier = Modifier.padding(top = Tokens.Space.s14).widthIn(max = StartGeometry.taglineMax),
                    )
                }
                return
            }
            val index = data?.index ?: return
            val resolved = resolveChoice(index, snapshot.choice)
            val values = passValues(resolved)
            val block = passBlock(stageOf(snapshot.step), values, nowField(snapshot.step), resolved.hasSections)
            val other = if (isLeaving) null else leaving?.takeIf { it.step != Step.ONE }
            val otherResolved = other?.let { resolveChoice(index, it.choice) }
            val leavingBlock = if (other != null && otherResolved != null && motion.swaps.block) {
                passBlock(stageOf(other.step), passValues(otherResolved), nowField(other.step), otherResolved.hasSections)
            } else {
                null
            }
            Column(
                Modifier.fillMaxWidth().moved(layer),
                verticalArrangement = Arrangement.spacedBy(Tokens.Space.s12),
            ) {
                BackPill(
                    description = backLabel(snapshot.step, resolved.hasSections, snapshot.choice.via == RECENT),
                    onClick = { if (interactive) actions.tapBack() },
                    modifier = Modifier.graphicsLayer { alpha = chrome },
                )
                FillInPass(
                    block = block,
                    leavingBlock = leavingBlock,
                    layers = layers,
                    changing = if (otherResolved != null) changingFields(passValues(otherResolved), values) else emptySet(),
                    direction = motion.direction,
                    interactive = interactive && !ui.boarding,
                    travels = travels,
                    onJump = { actions.jump(it) },
                    unroll = if (interactive && unrolling && snapshot.step == Step.SIX) unroll.value else null,
                    modifier = if (snapshot.step == Step.SIX) Modifier.padding(top = Tokens.Space.s8) else Modifier,
                )
            }
        }

        @Composable
        fun FootItem(content: FootContent, layer: Layer) {
            when (content) {
                FootContent.CONTINUE -> if (continueLine != null) {
                    ContinueLine(continueLine, onContinue = { actions.continueLast() }, modifier = Modifier.moved(layer))
                }
                FootContent.START -> PillButton(
                    label = StartCopy.START_ROUND,
                    onClick = { if (!ui.boarding) actions.startRound() },
                    modifier = Modifier.moved(layer).graphicsLayer { alpha = chrome },
                    trailingIcon = {
                        Text(StartCopy.ARROW, style = TruthyType.button, color = TruthyTheme.colors.onDark, modifier = Modifier.clearAndSetSemantics { })
                    },
                )
                FootContent.NONE -> Unit
            }
        }

        @Composable
        fun Foot(modifier: Modifier) {
            Box(modifier.fillMaxWidth().heightIn(min = Tokens.Size.pill)) {
                if (ui.failed && data == null && shown.step == Step.ONE) {
                    PillButton(label = StartCopy.TRY_AGAIN, onClick = { actions.retryCatalog() })
                } else {
                    val shownFoot = footContent(shown.step, continueLine != null)
                    val leavingFoot = leaving?.let { footContent(it.step, continueLine != null) }?.takeIf { it != shownFoot }
                    if (leavingFoot != null) FootItem(leavingFoot, layers.footOut)
                    FootItem(shownFoot, if (leavingFoot != null) layers.footIn else Layer.Shown)
                }
            }
        }

        SkyBackdrop(modifier = Modifier.fillMaxSize(), lowerCloud = LowerCloud.START)
        Column(
            Modifier
                .fillMaxSize()
                .then(if (short) Modifier.verticalScroll(columnScroll) else Modifier)
                .padding(start = start, end = end, top = top, bottom = bottom),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Column(
                Modifier
                    .widthIn(max = Tokens.Size.maxWidth)
                    .fillMaxWidth()
                    .then(if (short) Modifier else Modifier.weight(1f)),
            ) {
                // StartFlow.tsx:772-823: the top zone, 176 tall (its content's height on a short screen).
                Box(Modifier.fillMaxWidth().then(if (short) Modifier else Modifier.heightIn(min = Tokens.Size.startTopZone))) {
                    val leavingTop = leaving?.takeIf { (it.step == Step.ONE) != (shown.step == Step.ONE) }
                    if (leavingTop != null) TopZone(leavingTop, layers.topOut, interactive = false, isLeaving = true)
                    TopZone(shown, if (leavingTop != null) layers.topIn else Layer.Shown, interactive = true, isLeaving = false)
                    val fromY = if ((leaving ?: shown).step == Step.ONE) StartGeometry.switchLogoRow else 0.dp
                    val toY = if (shown.step == Step.ONE) StartGeometry.switchLogoRow else 0.dp
                    ThemeSwitch(
                        theme = ui.theme,
                        onSwitch = { actions.switchTheme() },
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .offset { IntOffset(0, lerp(fromY, toY, layers.switchMove).roundToPx()) }
                            .graphicsLayer { alpha = chrome },
                    )
                }
                // StartFlow.tsx:826-832: the main area, 20 below the top zone; the list stops 76 above the bottom when the continue line shows.
                Box(
                    Modifier
                        .fillMaxWidth()
                        .padding(top = Tokens.Space.s20)
                        .then(if (short) Modifier else Modifier.weight(1f))
                        .padding(bottom = if (!short && shown.step == Step.ONE && continueLine != null) Tokens.Size.footGap else 0.dp),
                ) {
                    // One call site for both panels, keyed by the step and choices drawn, so a panel keeps its own state
                    // (its list's scroll) when it turns from arriving into leaving, and a new step gets fresh state.
                    listOfNotNull(leaving?.let { it to true }, shown to false).forEach { (snapshot, isLeaving) ->
                        key(snapshot) {
                            StepPanel(
                                snapshot = snapshot,
                                content = panelContent(data, ui.failed, snapshot),
                                leaving = isLeaving,
                                layers = layers,
                                short = short,
                                tight = tight,
                                travels = travels,
                                focus = if (isLeaving) null else focus,
                                onOption = { if (!isLeaving) onOption(it) },
                            )
                        }
                    }
                }
                if (short) Foot(Modifier.padding(bottom = Tokens.Space.s4))
            }
        }
        // StartFlow.tsx:837: the foot zone, 16 from the sides and safe-bottom + 4 from the bottom, over the list.
        if (!short) {
            Foot(
                Modifier
                    .align(Alignment.BottomCenter)
                    .padding(start = start, end = end, bottom = bottom + Tokens.Space.s4)
                    .widthIn(max = Tokens.Size.maxWidth),
            )
        }
        TravelOverlay(travels)
    }
}
