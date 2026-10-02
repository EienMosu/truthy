// The cue that a step's list goes on below the fold (design system 4): while more content lies below what the
// list shows, its bottom edge fades out over 28 px. A fade only shows where it lies over a card: where the fold
// falls in the gap between two cards, or shows only a sliver of the next one, a fade at the very edge would lie
// over sky and show nothing. The fade then ends a little higher, on the card above, which dissolves into the
// sky. Measured from the layout, so the cue is right at the first paint, after a scroll, and when the list or
// its cards change size (a turned phone, the fonts arriving).
import { useLayoutEffect, useState, type RefObject } from "react";

/** The length of the fade, as at the bottom of the missed-cards list. */
export const FADE_PX = 28;

/** A card of the list, in px from the top of the list's view (they move up as the list scrolls). */
export interface ItemSpan {
  top: number;
  bottom: number;
}

export interface ListCue {
  /** Content runs on below the view. */
  more: boolean;
  /** How far above the bottom of the view the fade ends, so that it lies over a card (0: at the edge). */
  lift: number;
}

/**
 * The cue for a list whose view is `viewHeight` tall, whose content ends at `contentBottom` and whose cards are
 * `items`, all measured from the top of the view; a pixel for rounding.
 *   - The fold cuts a card that shows 28 px or more: the fade ends at the edge.
 *   - The fold lies in a gap: the fade ends at the bottom of the card above it.
 *   - The fold shows less than 28 px of a card: in between, so the end of the fade moves with the scroll and
 *     never jumps (at 0 px shown it is at the bottom of the card above, at 28 px at the edge).
 */
export function listCue(viewHeight: number, contentBottom: number, items: readonly ItemSpan[]): ListCue {
  if (contentBottom <= viewHeight + 1) return { more: false, lift: 0 };
  const at = items.findIndex((item) => item.bottom > viewHeight + 1);
  const cut = items[at];
  if (!cut) return { more: true, lift: 0 };
  const above = items[at - 1]?.bottom ?? Math.min(cut.top, viewHeight);
  const shown = viewHeight - cut.top;
  if (shown <= 0) return { more: true, lift: Math.max(0, viewHeight - above) };
  if (shown >= FADE_PX) return { more: true, lift: 0 };
  return { more: true, lift: Math.max(0, viewHeight - above) * (1 - shown / FADE_PX) };
}

/**
 * Keeps the cue of the scrolling `list` up to date for the cards in `content`. The lift goes straight onto the
 * list as --list-fade-lift (it changes on every scroll); whether there is more comes back as state.
 */
export function useListCue(list: RefObject<HTMLElement | null>, content: RefObject<HTMLElement | null>): boolean {
  const [more, setMore] = useState(false);
  useLayoutEffect(() => {
    const view = list.current;
    const inner = content.current;
    if (!view || !inner) return;
    const update = () => {
      // The view and the content share every transform above them (the step panel moves as it comes and goes),
      // so their difference is where the content sits in the view. The cards are placed by their layout offsets,
      // not their boxes on screen: each one rises into place as the step arrives.
      const contentTop = inner.getBoundingClientRect().top - view.getBoundingClientRect().top;
      const items = [...inner.children].map((child) => {
        const item = child as HTMLElement;
        const top = contentTop + item.offsetTop - inner.offsetTop;
        return { top, bottom: top + item.offsetHeight };
      });
      const cue = listCue(view.clientHeight, contentTop + inner.offsetHeight, items);
      view.style.setProperty("--list-fade-lift", `${cue.lift}px`);
      setMore(cue.more);
    };
    update();
    view.addEventListener("scroll", update, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(view);
    observer?.observe(inner);
    return () => {
      view.removeEventListener("scroll", update);
      observer?.disconnect();
    };
  }, [list, content]);
  return more;
}
