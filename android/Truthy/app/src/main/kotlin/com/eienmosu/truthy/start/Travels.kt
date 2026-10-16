package com.eienmosu.truthy.start

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.util.lerp
import com.eienmosu.truthy.design.Text
import com.eienmosu.truthy.design.Tokens
import com.eienmosu.truthy.engine.PassFieldName
import kotlin.math.roundToInt

/** A pass value or a card name as laid out: its text, its look and its box in root coordinates (px). */
@Immutable
data class Spot(val text: String, val style: TextStyle, val color: Color, val rect: Rect, val right: Boolean)

/** Where a value sits: a layout of the pass and a field. */
data class SpotKey(val stage: PassStage, val field: PassFieldName)

/** The chosen name flying from its card into its field (StartFlow.tsx:1134-1150). */
data class NameFlight(val from: Spot, val target: SpotKey)

/** A value moving from its place on the old layout to its place on the new one (passValueTravel.ts). */
data class ValueFlight(val from: Spot, val target: SpotKey)

/** What a step change sends travelling: the name (with the card it leaves) and the values that sit on both layouts. */
data class TravelStart(val name: NameFlight?, val nameId: String?, val values: List<ValueFlight>)

/** Where the pass values and card names are, and what is travelling now. `clockMs` counts from the start of the step change. */
@Stable
class Travels {
    val spots = mutableStateMapOf<SpotKey, Spot>()
    val names = mutableStateMapOf<String, Spot>()
    var clockMs by mutableFloatStateOf(0f)
    var name by mutableStateOf<NameFlight?>(null)
        private set
    var values by mutableStateOf<List<ValueFlight>>(emptyList())
        private set
    var hiddenFields by mutableStateOf<Set<PassFieldName>>(emptySet())
        private set
    var hiddenName by mutableStateOf<String?>(null)
        private set

    fun report(key: SpotKey, spot: Spot) {
        if (spots[key] != spot) spots[key] = spot
    }

    fun reportName(id: String, spot: Spot) {
        if (names[id] != spot) names[id] = spot
    }

    fun start(travel: TravelStart) {
        clockMs = 0f
        name = travel.name
        values = travel.values
        hiddenFields = buildSet {
            travel.name?.let { add(it.target.field) }
            travel.values.forEach { add(it.target.field) }
        }
        hiddenName = if (travel.name != null) travel.nameId else null
    }

    fun clear() {
        name = null
        values = emptyList()
        hiddenFields = emptySet()
        hiddenName = null
        clockMs = 0f
    }
}

/** passValueTravel.ts: the old copy is gone by 60 percent of the travel, the new one comes in from 40 percent. */
private const val OLD_GONE_AT = 0.6f
private const val NEW_FROM = 0.4f

/** The layer above the whole start screen where the copies travel. It takes no presses and is not read out. */
@Composable
fun TravelOverlay(travels: Travels, modifier: Modifier = Modifier) {
    var origin by remember { mutableStateOf(Offset.Zero) }
    Box(
        modifier
            .fillMaxSize()
            .onGloballyPositioned { origin = it.positionInRoot() }
            .clearAndSetSemantics { },
    ) {
        val t = travels.clockMs
        travels.name?.let { flight ->
            travels.spots[flight.target]?.let { to -> NameGhost(flight.from, to, t, origin) }
        }
        travels.values.forEach { flight ->
            travels.spots[flight.target]?.let { to -> ValueCopies(flight.from, to, t, origin) }
        }
    }
}

/** StartFlow.tsx:1134-1150: left edges and vertical centres meet; the copy scales by the change of font size; 300 ms ease after 60. */
@Composable
private fun NameGhost(from: Spot, to: Spot, t: Float, origin: Offset) {
    val e = Tokens.Curves.ease.at(progress(t, Tokens.Duration.travelHold, Tokens.Duration.travel))
    val scale = to.style.fontSize.value / from.style.fontSize.value
    val dx = to.rect.left - from.rect.left
    val dy = to.rect.top + to.rect.height / 2f - from.rect.top - from.rect.height * scale / 2f
    CopyText(from, origin, alpha = 1f, dx = dx * e, dy = dy * e, scale = lerp(1f, scale, e), pivotX = 0f, fixedWidth = false)
}

/** passValueTravel.ts:76-131: two copies on one eased path, cross-fading on a linear clock; right edges meet where a value keeps to the right. */
@Composable
private fun ValueCopies(from: Spot, to: Spot, t: Float, origin: Offset) {
    val duration = Tokens.Duration.t3
    val e = Tokens.Curves.ease.at(progress(t, 0, duration))
    val linear = progress(t, 0, duration)
    val right = from.right || to.right
    val scale = if (from.rect.height > 0f) to.rect.height / from.rect.height else 1f
    val dx = if (right) to.rect.right - from.rect.right else to.rect.left - from.rect.left
    val dy = to.rect.top - from.rect.top
    val pivot = if (right) 1f else 0f
    CopyText(from, origin, alpha = (1f - linear / OLD_GONE_AT).coerceIn(0f, 1f), dx = dx * e, dy = dy * e, scale = lerp(1f, scale, e), pivotX = pivot, fixedWidth = true)
    CopyText(
        to, origin,
        alpha = ((linear - NEW_FROM) / (1f - NEW_FROM)).coerceIn(0f, 1f),
        dx = -dx * (1f - e), dy = -dy * (1f - e), scale = lerp(1f / scale, 1f, e), pivotX = pivot, fixedWidth = true,
    )
}

@Composable
private fun CopyText(spot: Spot, origin: Offset, alpha: Float, dx: Float, dy: Float, scale: Float, pivotX: Float, fixedWidth: Boolean) {
    val density = LocalDensity.current
    val width = with(density) { spot.rect.width.toDp() }
    Text(
        text = spot.text,
        style = spot.style,
        color = spot.color,
        maxLines = 1,
        softWrap = false,
        overflow = TextOverflow.Ellipsis,
        modifier = Modifier
            .offset { IntOffset((spot.rect.left - origin.x).roundToInt(), (spot.rect.top - origin.y).roundToInt()) }
            .then(if (fixedWidth) Modifier.width(width) else Modifier)
            .graphicsLayer {
                transformOrigin = TransformOrigin(pivotX, 0f)
                translationX = dx
                translationY = dy
                scaleX = scale
                scaleY = scale
                this.alpha = alpha
            },
    )
}
