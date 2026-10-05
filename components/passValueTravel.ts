// The values that stay on the fill-in pass when it changes layout (design system 7, "Pass changes layout"):
// each field's value travels from its old place to its new one. Its look may change on the way (a Sans 16 field
// becomes a word on the quiet line, a Mono 16 code becomes a Mono 34 leg), and so may its words (the route
// pass says "Whole deck" where the ready pass's leg says "ALL"), so it travels as two copies laid over the
// pass, the old look and the new, that follow one eased path while they cross-fade on a linear clock: the old
// copy is gone by 60 percent, the new one comes in from 40 percent. Values are matched by field, never by
// text. The values themselves are hidden meanwhile, so the block fades of the two layouts never show them.
import { EASE } from "./easing";
import type { PassFieldName } from "./FillInPass";

/** The fields whose values can be on two layouts of the pass. */
const FIELDS: readonly PassFieldName[] = ["area", "platform", "deck", "section", "mode"];
/** The time of the paper's change of shape (--duration-t3). */
export const TRAVEL_MS = 360;
const PATH_EASING = `cubic-bezier(${EASE.join(", ")})`;
/** What a copy takes from its value's computed style, so that it looks the same away from its parent. */
const LOOK = ["fontFamily", "fontSize", "fontWeight", "fontStyle", "letterSpacing", "fontVariantNumeric", "fontFeatureSettings", "color"] as const;

interface Box {
  left: number;
  /** The right edge of what shows: the value's own right edge where its text is cut with an ellipsis. */
  right: number;
  top: number;
  height: number;
}

/** The box of the text itself: a value can be a block as wide as its leg, with its text on the right. */
function textBox(el: HTMLElement, origin: DOMRect): Box | null {
  const range = document.createRange();
  range.selectNodeContents(el);
  const rect = range.getBoundingClientRect();
  if (rect.height === 0) return null;
  const right = Math.min(rect.right, el.getBoundingClientRect().right);
  return { left: rect.left - origin.left, right: right - origin.left, top: rect.top - origin.top, height: rect.height };
}

/** Whether the value is cut with an ellipsis: its copy is cut the same way, at the same width. */
function isCut(el: HTMLElement): boolean {
  return el.scrollWidth > el.clientWidth + 1;
}

/** Whether the value's text keeps to the right of its place (the section leg of the ready pass). */
function keepsRight(el: HTMLElement): boolean {
  const align = getComputedStyle(el).textAlign;
  return align === "right" || align === "end";
}

/** A copy of `el` laid over `root` with its text exactly where `box` says. */
function copyAt(el: HTMLElement, root: HTMLElement, box: Box, origin: DOMRect): HTMLElement {
  const copy = document.createElement("span");
  copy.textContent = el.textContent;
  copy.setAttribute("aria-hidden", "true");
  copy.dataset.passTravel = el.dataset.passValue;
  const look = getComputedStyle(el);
  for (const property of LOOK) copy.style[property] = look[property];
  Object.assign(copy.style, {
    position: "absolute",
    left: "0px",
    top: "0px",
    margin: "0",
    whiteSpace: "nowrap",
    lineHeight: "normal",
    pointerEvents: "none",
  });
  if (isCut(el)) Object.assign(copy.style, { width: `${el.clientWidth}px`, overflow: "hidden", textOverflow: "ellipsis" });
  root.appendChild(copy);
  // A copy's text sits where its own line box puts it; move the copy by whatever is left over.
  const own = textBox(copy, origin);
  copy.style.left = `${box.left - (own?.left ?? 0)}px`;
  copy.style.top = `${box.top - (own?.top ?? 0)}px`;
  return copy;
}

/**
 * Starts the travel of every value that is on both `leaving` (the old layout) and `entering` (the new one),
 * except `skip` (a name travelling in from its card). `shift` is how far the new block still moves down on
 * the paper while it travels: the band above it grows (or shrinks) with the paper, so the new values end
 * that much lower than where they are measured. Returns a function that ends the travel at once; it ends by
 * itself after TRAVEL_MS. Does nothing where the browser cannot animate elements (jsdom).
 */
export function travelPassValues(root: HTMLElement, leaving: HTMLElement, entering: HTMLElement, shift: number, skip?: PassFieldName): () => void {
  if (typeof root.animate !== "function") return () => {};
  const origin = root.getBoundingClientRect();
  const copies: HTMLElement[] = [];
  const hidden: HTMLElement[] = [];
  const animations: Animation[] = [];
  for (const field of FIELDS) {
    if (field === skip) continue;
    const from = leaving.querySelector<HTMLElement>(`[data-pass-value="${field}"]`);
    const to = entering.querySelector<HTMLElement>(`[data-pass-value="${field}"]`);
    if (!from || !to) continue;
    const a = textBox(from, origin);
    const measured = textBox(to, origin);
    if (!a || !measured) continue;
    const b = { ...measured, top: measured.top + shift };
    // The tops meet, and so do the edges the text keeps to: the left edges, or the right edges where either
    // end keeps to the right, so a copy whose words are longer than the other's ("Whole deck" grown to the
    // size of "ALL") stays on the pass. The scale is the change of text height, so where the words are the
    // same the two copies cover each other.
    const anchorRight = keepsRight(from) || keepsRight(to);
    const scale = b.height / a.height;
    const dx = anchorRight ? b.right - a.right : b.left - a.left;
    const dy = b.top - a.top;
    const timing = { duration: TRAVEL_MS, fill: "both" as const };
    const oldCopy = copyAt(from, root, a, origin);
    const newCopy = copyAt(to, root, b, origin);
    for (const copy of [oldCopy, newCopy]) copy.style.transformOrigin = anchorRight ? "100% 0" : "0 0";
    copies.push(oldCopy, newCopy);
    animations.push(
      oldCopy.animate({ transform: ["none", `translate(${dx}px, ${dy}px) scale(${scale})`] }, { ...timing, easing: PATH_EASING }),
      oldCopy.animate({ opacity: [1, 0, 0], offset: [0, 0.6, 1] }, { ...timing, easing: "linear" }),
      newCopy.animate({ transform: [`translate(${-dx}px, ${-dy}px) scale(${1 / scale})`, "none"] }, { ...timing, easing: PATH_EASING }),
      newCopy.animate({ opacity: [0, 0, 1], offset: [0, 0.4, 1] }, { ...timing, easing: "linear" }),
    );
    for (const value of [from, to]) {
      value.style.opacity = "0";
      hidden.push(value);
    }
  }
  if (copies.length === 0) return () => {};
  let done = false;
  const end = () => {
    if (done) return;
    done = true;
    for (const animation of animations) animation.cancel();
    for (const copy of copies) copy.remove();
    for (const value of hidden) value.style.removeProperty("opacity");
  };
  void Promise.all(animations.map((animation) => animation.finished)).then(end, () => {});
  return end;
}
