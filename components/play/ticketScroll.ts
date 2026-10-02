// Where the play screen scrolls its ticket. The ticket scrolls inside the stage when it is taller than the
// space (a short phone, a phone held sideways, a zoomed page), and the stage's scroller runs on under the
// action row: its bottom padding is the row plus the gap above it, so that part of the scroller is hidden.
// The arithmetic is pure and takes numbers; the DOM read it needs follows it.

/** A part of the ticket, from its top to its bottom, in the ticket's own coordinates. */
export interface Span {
  top: number;
  bottom: number;
}

/**
 * After an answer: the scroll that brings the slip in, which is the end of the ticket, so the slip ends above
 * the action row. A slip taller than the stage starts at the top of the stage, so its verdict row stays in view.
 */
export function slipScroll(slipTop: number, maxScroll: number): number {
  return Math.max(0, Math.min(maxScroll, slipTop));
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
