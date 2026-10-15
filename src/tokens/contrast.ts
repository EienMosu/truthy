// The contrast pairs of the design system: DESIGN-SYSTEM.md section 2.2 as corrected by two product owner decisions
// (the start-flow tagline and the "Your pass is ready" line are ink, and the focus ring is ink everywhere), the
// minimum of each kind and the WCAG 2.x relative luminance. tests/tokens/contrast.test.ts checks every pair against
// the CSS the app ships; the native golden vectors (scripts/native/golden/geometry-contrast.ts) read the same list,
// so a pair added here reaches both.

export type Kind = "body text" | "large text" | "non-text";
export const MINIMUM: Readonly<Record<Kind, number>> = { "body text": 4.5, "large text": 3, "non-text": 3 };

// [foreground, background, kind, where the screens use it]. Large text is 24px, or 18.66px bold, and up.
export const PAIRS: readonly (readonly [string, string, Kind, string])[] = [
  ["ink", "surface-raised", "body text", "ticket, cards, fill-in pass, Back pill"],
  ["ink", "surface-sunk", "body text", "answer slip, missed-cards slip"],
  ["ink-muted", "surface-raised", "body text", "field labels, leg names, card details"],
  ["ink-muted", "surface-sunk", "body text", "missed-card heads, unavailable card"],
  ["true", "surface-raised", "body text", "True hint"],
  ["true", "surface-sunk", "body text", "source link, Why link"],
  ["false", "surface-raised", "body text", "False hint"],
  ["on-dark", "true", "body text", "True pill label"],
  ["on-dark", "false", "body text", "False pill label"],
  ["on-dark", "ink", "body text", "Next card, Play again, Start round"],
  ["on-accent", "accent", "body text", "carrier band"],
  ["ink", "sky-1", "body text", "start-flow tagline (decision: ink)"],
  ["ink", "sky-2", "body text", "the tagline where it crosses into sky-2, step titles"],
  ["ink", "sky-3", "body text", "the ready line (decision: ink)"],
  ["ink", "sky-4", "body text", "continue line, quiet buttons"],
  ["ink-muted", "sky-4", "body text", "continue line route"],
  ["correct", "surface-sunk", "large text", "Correct stamp on the slip, 24px ExtraBold"],
  ["correct", "surface-raised", "large text", "New best stamp, 22px ExtraBold"],
  ["wrong", "surface-sunk", "large text", "Not quite stamp, 24px ExtraBold"],
  ["wrong", "surface-raised", "large text", "Not quite stamp on the stub, 28px ExtraBold"],
  ["false", "surface-raised", "large text", "False intent stamp, 26px"],
  ["focus", "sky-1", "non-text", "focus ring on the sky"],
  ["focus", "sky-2", "non-text", "focus ring on the sky"],
  ["focus", "sky-3", "non-text", "focus ring on the sky (filled pills)"],
  ["focus", "sky-4", "non-text", "focus ring on the sky (filled pills)"],
  ["focus", "surface-raised", "non-text", "focus ring inside the pass and the ticket"],
  ["focus", "surface-sunk", "non-text", "focus ring on the slip"],
];

/** Relative luminance of an opaque #rrggbb colour (WCAG 2.x). */
export function luminance(hex: string): number {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) throw new Error(`${hex} is not an opaque #rrggbb colour`);
  const [r, g, b] = match.slice(1).map((part) => {
    const c = parseInt(part, 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
