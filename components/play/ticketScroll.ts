// Where the play screen scrolls its ticket. The ticket scrolls inside the stage when it is taller than the
// space (a short phone, a phone held sideways, a zoomed page), and the stage's scroller runs on under the
// action row: its bottom padding is the row plus the gap above it, so that part of the scroller is hidden.
// The arithmetic is pure and takes numbers; the two DOM reads it needs follow it.

/** A part of the ticket, from its top to its bottom, in the ticket's own coordinates. */
export interface Span {
  top: number;
  bottom: number;
}

/**
 * A new card: the scroll that shows the statement's text in the visible stage, ending above the action row.
 * Where the text fits nothing moves (0). A text taller than the stage starts at the top of the stage.
 */
export function statementScroll(text: Span, visible: number): number {
  return Math.max(0, Math.min(text.bottom - visible, text.top));
}

/**
 * After an answer: the scroll that brings the slip in, or null when the slip is in view already. In view means
 * it starts inside the stage and ends no lower than the top of the action row: the gap above the row hides
 * nothing, so a slip that ends there leaves the ticket where it is (at 390 by 844 most tickets are a few pixels
 * taller than the stage, and a nudge would cut the pass's top corners flat for nothing). Otherwise the scroll
 * goes to the end of the ticket, which is the slip, so the slip ends above the row with the gap under it; a slip
 * taller than the stage starts at the top of the stage, so its verdict row stays in view.
 * `at` is the scroll now, the visible stage (above the gap), the gap and the largest scroll.
 */
export function slipScroll(slip: Span, at: { top: number; visible: number; gap: number; max: number }): number | null {
  if (slip.top >= at.top && slip.bottom <= at.top + at.visible + at.gap) return null;
  return Math.max(0, Math.min(at.max, slip.top));
}

/** One arrow press scrolls this far, as a page does. */
export const ARROW_STEP = 40;

/**
 * Where a key that scrolls a page takes the ticket, or null for any other key: the arrows by a line, Page Up
 * and Page Down and Space (Shift+Space up) by the visible stage less a line, Home and End to the ends.
 */
export function keyScroll(key: string, shift: boolean, at: { top: number; visible: number; max: number }): number | null {
  const page = Math.max(ARROW_STEP, at.visible - ARROW_STEP);
  let top: number;
  if (key === " ") top = at.top + (shift ? -page : page);
  else if (shift) return null;
  else if (key === "ArrowDown") top = at.top + ARROW_STEP;
  else if (key === "ArrowUp") top = at.top - ARROW_STEP;
  else if (key === "PageDown") top = at.top + page;
  else if (key === "PageUp") top = at.top - page;
  else if (key === "Home") top = 0;
  else if (key === "End") top = at.max;
  else return null;
  return Math.max(0, Math.min(at.max, top));
}

/** The visible stage: the scroller's height less the part under the action row (its bottom padding). */
export function visibleHeight(scroller: HTMLElement): number {
  const under = parseFloat(getComputedStyle(scroller).paddingBottom);
  return scroller.clientHeight - (Number.isFinite(under) ? under : 0);
}

/** The gap between the visible stage and the action row (--space-12), which hides nothing; 0 where it has no value. */
export function gapAboveRow(scroller: HTMLElement): number {
  const gap = parseFloat(getComputedStyle(scroller).getPropertyValue("--space-12"));
  return Number.isFinite(gap) ? gap : 0;
}

/**
 * Where an element lies in the ticket, from layout offsets: a transform (the jolt, the Timed deal, a drag)
 * does not move it. The scroller is positioned, so the chain of offset parents ends there.
 */
export function spanInTicket(element: HTMLElement, scroller: HTMLElement): Span {
  let top = 0;
  for (let node: HTMLElement | null = element; node !== null && node !== scroller; ) {
    top += node.offsetTop;
    const parent: Element | null = node.offsetParent;
    node = parent instanceof HTMLElement ? parent : null;
  }
  return { top, bottom: top + element.offsetHeight };
}
