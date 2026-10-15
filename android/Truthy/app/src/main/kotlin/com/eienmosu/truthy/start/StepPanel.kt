package com.eienmosu.truthy.start

import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.layout
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.onPlaced
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.layout.positionInParent
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.CollectionInfo
import androidx.compose.ui.semantics.CollectionItemInfo
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.collectionInfo
import androidx.compose.ui.semantics.collectionItemInfo
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.constrainHeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.offset
import com.eienmosu.truthy.design.Tokens
import com.eienmosu.truthy.design.TruthyTheme
import com.eienmosu.truthy.design.TruthyType
import com.eienmosu.truthy.design.truthyShadow
import com.eienmosu.truthy.engine.ItemSpan
import com.eienmosu.truthy.engine.ListCue
import com.eienmosu.truthy.engine.MODE_TABLE
import com.eienmosu.truthy.engine.Step
import com.eienmosu.truthy.engine.listCue
import com.eienmosu.truthy.engine.revealDelta
import com.eienmosu.truthy.ui.CardStub
import com.eienmosu.truthy.ui.DestinationCard
import com.eienmosu.truthy.ui.DestinationVariant
import kotlin.math.roundToInt

/** What a step's panel holds under its title. */
sealed interface PanelContent {
    data object Loading : PanelContent
    data object Failed : PanelContent
    data class Options(val options: List<OptionModel>) : PanelContent
    data class Ready(val line: String) : PanelContent
}

/** What takes focus when a panel arrives (reference 4.4): its title going forward, the card chosen before going back. */
sealed interface PanelFocus {
    data object Title : PanelFocus
    data class Card(val id: String) : PanelFocus
}

fun panelContent(data: StartData?, failed: Boolean, snapshot: PanelSnapshot): PanelContent = when {
    snapshot.step == Step.SIX -> PanelContent.Ready(readyLine(MODE_TABLE.firstOrNull { it.id == snapshot.choice.mode }?.description ?: ""))
    data != null -> PanelContent.Options(stepOptions(data, snapshot))
    failed -> PanelContent.Failed
    else -> PanelContent.Loading
}

/**
 * One step (StartFlow.tsx:1048-1091): its title in a 36 row over its options. A leaving panel is drawn with the old
 * panel's layer, is not read out and takes no presses; an arriving one moves its title and options in with `layers.items`.
 */
@Composable
fun StepPanel(
    snapshot: PanelSnapshot,
    content: PanelContent,
    leaving: Boolean,
    layers: StepLayers,
    short: Boolean,
    tight: Boolean,
    topZoneHeight: () -> Int,
    travels: Travels,
    focus: PanelFocus?,
    onOption: (OptionModel) -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = TruthyTheme.colors
    val panel = if (leaving) layers.oldPanel else Layer(layers.newPanelAlpha, 0f)
    val title = if (leaving) Layer(layers.oldTitleAlpha, 0f) else layers.item(0)
    val titleFocus = remember { FocusRequester() }
    // StartFlow.tsx:1059: the ready step sits 112 below the 176 top zone, 88 under 600 tall, and at the top of a short
    // screen's column. The pass reaches past the zone, which grows with it here, so the offset counts from the 176 line.
    val readyOffset = when {
        content !is PanelContent.Ready || short -> null
        tight -> Tokens.Size.readyOffset - Tokens.Space.s24
        else -> Tokens.Size.readyOffset
    }
    Box(modifier) {
        Column(
            Modifier
                .fillMaxWidth()
                .then(if (short) Modifier else Modifier.fillMaxHeight())
                .moved(panel)
                .then(if (leaving) Modifier.clearAndSetSemantics { } else Modifier)
                .then(if (readyOffset == null) Modifier else Modifier.readyTop(readyOffset, topZoneHeight)),
        ) {
            Box(
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = Tokens.Native.stepTitleRow)
                    .moved(title)
                    .focusRequester(titleFocus)
                    .focusable()
                    .semantics { heading() },
                contentAlignment = Alignment.CenterStart,
            ) {
                Text(stepTitle(snapshot.step), style = TruthyType.stepTitle, color = colors.ink)
            }
            when (content) {
                PanelContent.Loading -> LoadingAreas()
                PanelContent.Failed -> LoadFailed()
                is PanelContent.Options -> OptionList(content.options, layers, leaving, short, travels, focus, onOption)
                is PanelContent.Ready -> Text(
                    content.line,
                    style = TruthyType.tagline,
                    color = colors.ink,
                    modifier = Modifier.padding(top = StartLayout.readyLineTop).widthIn(max = StartGeometry.readyLineMax),
                )
            }
        }
        if (leaving) {
            // StartFlow.tsx:1058: a leaving panel is inert; this cover takes the presses so the cards under it never see them.
            Spacer(
                Modifier.matchParentSize().pointerInput(Unit) {
                    awaitPointerEventScope {
                        while (true) awaitPointerEvent()
                    }
                },
            )
        }
    }
    LaunchedEffect(focus, leaving) {
        if (!leaving && focus == PanelFocus.Title) runCatching { titleFocus.requestFocus() }
    }
}

/** Moves the ready panel down by [StartLayout.readyTop] of the top zone's height, read while measuring. */
private fun Modifier.readyTop(offset: Dp, topZoneHeight: () -> Int): Modifier = layout { measurable, constraints ->
    val top = StartLayout.readyTop(offset, topZoneHeight().toDp()).roundToPx()
    val placeable = measurable.measure(constraints.offset(vertical = -top))
    layout(placeable.width, constraints.constrainHeight(placeable.height + top)) { placeable.place(0, top) }
}

/** StartFlow.tsx:1106-1118: three quiet placeholders while the index loads, and the status "Loading the decks". */
@Composable
private fun LoadingAreas() {
    Column(
        Modifier.fillMaxWidth().padding(top = Tokens.Space.s8 + Tokens.Space.s6),
        verticalArrangement = Arrangement.spacedBy(Tokens.Space.s12),
    ) {
        Box(
            Modifier.semantics {
                liveRegion = LiveRegionMode.Polite
                contentDescription = StartCopy.LOADING_DECKS
            },
        )
        repeat(3) {
            Box(
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = Tokens.Size.cardMin)
                    .clip(RoundedCornerShape(Tokens.Radius.card))
                    .background(TruthyTheme.colors.surfaceSunk)
                    .clearAndSetSemantics { },
            )
        }
    }
}

/** StartFlow.tsx:1120-1132: the alert card when the index did not load (unreachable with embedded decks; Try again sits in the foot zone). */
@Composable
private fun LoadFailed() {
    val colors = TruthyTheme.colors
    Column(
        Modifier
            .fillMaxWidth()
            .padding(top = Tokens.Space.s8 + Tokens.Space.s6)
            .truthyShadow(TruthyTheme.shadows.small, Tokens.Radius.card)
            .clip(RoundedCornerShape(Tokens.Radius.card))
            .background(colors.surfaceRaised)
            .semantics { liveRegion = LiveRegionMode.Assertive }
            .padding(Tokens.Space.s20),
    ) {
        Text(StartCopy.DECKS_FAILED, style = TruthyType.emphasis, color = colors.ink)
        Text(StartCopy.CHECK_CONNECTION, style = TruthyType.body, color = colors.ink, modifier = Modifier.padding(top = Tokens.Space.s8))
    }
}

/**
 * StartFlow.tsx:1069-1087: the scrolling list, padded 6 above and 24 below, cards 12 apart, fading its bottom 28 while
 * more lies below (listCue). On a short screen the whole column scrolls instead and the list takes its own height.
 */
@Composable
private fun ColumnScope.OptionList(
    options: List<OptionModel>,
    layers: StepLayers,
    leaving: Boolean,
    short: Boolean,
    travels: Travels,
    focus: PanelFocus?,
    onOption: (OptionModel) -> Unit,
) {
    val density = LocalDensity.current
    val scroll = rememberScrollState()
    var viewHeight by remember { mutableIntStateOf(0) }
    var contentHeight by remember { mutableIntStateOf(0) }
    val tops = remember(options) { mutableStateListOf<Int>().apply { repeat(options.size) { add(0) } } }
    val heights = remember(options) { mutableStateListOf<Int>().apply { repeat(options.size) { add(0) } } }
    val cardFocus = remember { FocusRequester() }
    val padTop = with(density) { Tokens.Space.s6.roundToPx() }
    fun dp(px: Int): Double = with(density) { px.toDp().value.toDouble() }
    fun span(i: Int): ItemSpan {
        val top = dp(padTop + tops[i] - scroll.value)
        return ItemSpan(top, top + dp(heights[i]))
    }
    val cue = if (short) {
        ListCue(more = false, lift = 0.0)
    } else {
        listCue(dp(viewHeight), dp(padTop + contentHeight - scroll.value), options.indices.map { span(it) })
    }
    val ink = TruthyTheme.colors.ink
    val focusId = (focus as? PanelFocus.Card)?.id
    Box(
        Modifier
            .fillMaxWidth()
            .then(if (short) Modifier else Modifier.weight(1f))
            .padding(top = Tokens.Space.s8)
            .onSizeChanged { viewHeight = it.height }
            .then(if (cue.more) Modifier.fadeBottom(cue.lift.toFloat(), ink) else Modifier),
    ) {
        Column(
            Modifier
                .fillMaxWidth()
                .then(if (short) Modifier else Modifier.verticalScroll(scroll))
                .padding(top = Tokens.Space.s6, bottom = Tokens.Space.s24)
                .semantics { collectionInfo = CollectionInfo(rowCount = options.size, columnCount = 1) },
        ) {
            Column(
                Modifier.fillMaxWidth().onSizeChanged { contentHeight = it.height },
                verticalArrangement = Arrangement.spacedBy(Tokens.Space.s12),
            ) {
                options.forEachIndexed { i, option ->
                    OptionItem(
                        option = option,
                        index = i,
                        layer = if (leaving) Layer.Shown else layers.item(i + 1),
                        interactive = !leaving,
                        travels = travels,
                        onOption = onOption,
                        modifier = Modifier
                            .onPlaced {
                                tops[i] = it.positionInParent().y.roundToInt()
                                heights[i] = it.size.height
                            }
                            .then(if (option.id == focusId) Modifier.focusRequester(cardFocus) else Modifier),
                    )
                }
            }
        }
    }
    // StartFlow.tsx:522-548: going back, the card chosen before is scrolled into view whole, with 8 of room, then takes focus.
    LaunchedEffect(focusId, leaving) {
        val id = focusId ?: return@LaunchedEffect
        if (leaving) return@LaunchedEffect
        val index = options.indexOfFirst { it.id == id }
        if (index < 0) return@LaunchedEffect
        withFrameNanos { }
        if (!short) {
            val delta = revealDelta(dp(viewHeight), span(index), StartGeometry.FOCUS_ROOM)
            if (delta != 0.0) scroll.scrollTo(scroll.value + with(density) { delta.toFloat().dp.roundToPx() })
        }
        runCatching { cardFocus.requestFocus() }
    }
}

@Composable
private fun OptionItem(
    option: OptionModel,
    index: Int,
    layer: Layer,
    interactive: Boolean,
    travels: Travels,
    onOption: (OptionModel) -> Unit,
    modifier: Modifier,
) {
    val ink = TruthyTheme.colors.ink
    val nameStyle = if (option.code) TruthyType.deckCode else TruthyType.cardName
    Box(
        modifier
            .moved(layer)
            .semantics { collectionItemInfo = CollectionItemInfo(rowIndex = index, rowSpan = 1, columnIndex = 0, columnSpan = 1) },
    ) {
        DestinationCard(
            variant = when (option.kind) {
                OptionKind.PLACE -> DestinationVariant.PLACE
                OptionKind.DECK -> DestinationVariant.DECK
                OptionKind.SECTION -> DestinationVariant.SECTION
                OptionKind.CLASS -> DestinationVariant.CLASS
            },
            name = option.name,
            label = option.label,
            onSelect = if (interactive && option.forward != null) ({ onOption(option) }) else null,
            code = option.code,
            sub = option.sub,
            detail = option.detail,
            seenPercent = option.seenPercent,
            stub = option.stub?.let { CardStub(it.label, it.value, it.unit, it.muted) },
            unavailable = option.unavailable,
            nameHidden = travels.hiddenName == option.id,
            nameLayout = Modifier.onGloballyPositioned {
                travels.reportName(option.id, Spot(option.name, nameStyle, ink, it.boundsInRoot(), right = false))
            },
        )
    }
}
