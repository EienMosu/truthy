package com.eienmosu.truthy.engine

import kotlin.math.max
import kotlin.math.min

// Where the play screen scrolls its ticket (components/play/ticketScroll.ts): pure arithmetic on numbers. The
// native ticket scrolls inside the stage like the web's, and the stage's scroller runs on under the action row
// (its bottom padding is the row plus the gap above it).

/** A part of the ticket, from its top to its bottom, in the ticket's own coordinates. */
data class Span(val top: Double, val bottom: Double)

/** The scroll now, the visible stage (above the gap), the gap above the action row and the largest scroll. */
data class SlipAt(val top: Double, val visible: Double, val gap: Double, val max: Double)

/** The scroll now, the visible stage and the largest scroll. */
data class KeyAt(val top: Double, val visible: Double, val max: Double)

/**
 * A new card: the scroll that shows the statement's text in the visible stage, ending above the action row.
 * Where the text fits nothing moves (0). A text taller than the stage starts at the top of the stage.
 */
fun statementScroll(text: Span, visible: Double): Double = max(0.0, min(text.bottom - visible, text.top))

/**
 * After an answer: the scroll that brings the slip in, or null when the slip is in view already. In view means
 * it starts inside the stage and ends no lower than the top of the action row (the gap above the row hides
 * nothing). Otherwise the scroll goes to the end of the ticket, which is the slip; a slip taller than the stage
 * starts at the top of the stage, so its verdict row stays in view.
 */
fun slipScroll(slip: Span, at: SlipAt): Double? {
    if (slip.top >= at.top && slip.bottom <= at.top + at.visible + at.gap) return null
    return max(0.0, min(at.max, slip.top))
}

/** One arrow press scrolls this far, as a page does. */
const val ARROW_STEP: Double = 40.0

/**
 * Where a key that scrolls a page takes the ticket, or null for any other key: the arrows by a line, Page Up
 * and Page Down and Space (Shift+Space up) by the visible stage less a line, Home and End to the ends.
 */
fun keyScroll(key: String, shift: Boolean, at: KeyAt): Double? {
    val page = max(ARROW_STEP, at.visible - ARROW_STEP)
    val top: Double = when {
        key == " " -> at.top + (if (shift) -page else page)
        shift -> return null
        key == "ArrowDown" -> at.top + ARROW_STEP
        key == "ArrowUp" -> at.top - ARROW_STEP
        key == "PageDown" -> at.top + page
        key == "PageUp" -> at.top - page
        key == "Home" -> 0.0
        key == "End" -> at.max
        else -> return null
    }
    return max(0.0, min(at.max, top))
}
