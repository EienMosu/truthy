package com.eienmosu.truthy.engine

// The cue that a step's list goes on below the fold (components/start/listCue.ts): while more content lies below
// what the list shows, its bottom edge fades out over 28. A fade only shows where it lies over a card: where the
// fold falls in the gap between two cards, or shows only a sliver of the next one, a fade at the very edge would lie
// over sky and show nothing. The fade then ends a little higher, on the card above, which dissolves into the sky.
// All lengths are in one unit (dp on Android); the functions only compare and subtract them.

/** The length of the fade, as at the bottom of the missed-cards list. */
const val FADE_PX: Double = 28.0

/** A card of the list, measured from the top of the list's view (they move up as the list scrolls). */
data class ItemSpan(val top: Double, val bottom: Double)

data class ListCue(
    /** Content runs on below the view. */
    val more: Boolean,
    /** How far above the bottom of the view the fade ends, so that it lies over a card (0: at the edge). */
    val lift: Double,
)

/**
 * The cue for a list whose view is `viewHeight` tall, whose content ends at `contentBottom` and whose cards are
 * `items`, all measured from the top of the view; one unit is allowed for rounding.
 *   - The fold cuts a card that shows 28 or more: the fade ends at the edge.
 *   - The fold lies in a gap: the fade ends at the bottom of the card above it.
 *   - The fold shows less than 28 of a card: in between, so the end of the fade moves with the scroll and never
 *     jumps (at 0 shown it is at the bottom of the card above, at 28 at the edge).
 */
fun listCue(viewHeight: Double, contentBottom: Double, items: List<ItemSpan>): ListCue {
    if (contentBottom <= viewHeight + 1) return ListCue(false, 0.0)
    val at = items.indexOfFirst { it.bottom > viewHeight + 1 }
    val cut = items.getOrNull(at) ?: return ListCue(true, 0.0)
    val above = items.getOrNull(at - 1)?.bottom ?: minOf(cut.top, viewHeight)
    val shown = viewHeight - cut.top
    if (shown <= 0) return ListCue(true, maxOf(0.0, viewHeight - above))
    if (shown >= FADE_PX) return ListCue(true, 0.0)
    return ListCue(true, maxOf(0.0, viewHeight - above) * (1 - shown / FADE_PX))
}

/**
 * How far to scroll a list so that a card at `item` (measured from the top of the list's view) shows whole in a view
 * `viewHeight` tall, with `room` around it for its focus ring and, below it, room for the fade (FADE_PX): positive
 * scrolls down, negative up, 0 when it already shows. Nearest edge first: a card taller than the view shows its top.
 */
fun revealDelta(viewHeight: Double, item: ItemSpan, room: Double): Double {
    val top = item.top - room
    val bottom = item.bottom + room + FADE_PX
    if (top < 0) return top
    if (bottom > viewHeight) return minOf(bottom - viewHeight, top)
    return 0.0
}
