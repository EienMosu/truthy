import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { tokensToCss } from "@/src/tokens/build";

// WCAG 2.x contrast of the day theme, computed from the CSS the app ships: tokensToCss on the real
// design/system/tokens.json, with var() references resolved. The pairs are DESIGN-SYSTEM.md section 2.2 as
// corrected by two product owner decisions: the start-flow tagline and the "Your pass is ready" line are
// ink (not ink-muted) on the sky bands, and the focus ring is ink (--color-focus) everywhere, never amber.
// rule on surface-raised (1.47) is not checked: rules and the pass-line dots are decorative only.

const CSS = tokensToCss(JSON.parse(readFileSync("design/system/tokens.json", "utf8")));

// The day block: everything before the night overrides under prefers-color-scheme: dark.
const DAY_CSS = CSS.slice(0, CSS.indexOf("@media (prefers-color-scheme: dark)") >>> 0);
const VARIABLES = new Map([...DAY_CSS.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1] ?? "", (m[2] ?? "").trim()]));

/** The value of a variable with every var() inside it replaced, as a browser would compute it. */
function resolve(name: string, seen: readonly string[] = []): string {
  if (seen.includes(name)) throw new Error(`var() cycle: ${[...seen, name].join(" -> ")}`);
  const value = VARIABLES.get(name);
  if (value === undefined) throw new Error(`${name} is not in the generated CSS`);
  return value.replace(/var\((--[\w-]+)\)/g, (_, inner: string) => resolve(inner, [...seen, name]));
}

/** Relative luminance of an opaque #rrggbb colour (WCAG 2.x). */
function luminance(hex: string): number {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) throw new Error(`${hex} is not an opaque #rrggbb colour`);
  const [r, g, b] = match.slice(1).map((part) => {
    const c = parseInt(part, 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The contrast ratio of two colour roles, by their --color-* names. */
function ratio(foreground: string, background: string): number {
  const a = luminance(resolve(`--color-${foreground}`));
  const b = luminance(resolve(`--color-${background}`));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

type Kind = "body text" | "large text" | "non-text";
const MINIMUM: Record<Kind, number> = { "body text": 4.5, "large text": 3, "non-text": 3 };

// [foreground, background, kind, where the screens use it]. Large text is 24px, or 18.66px bold, and up.
const PAIRS: readonly [string, string, Kind, string][] = [
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
  ["false", "surface-raised", "large text", "False intent stamp, 26px"],
  ["focus", "sky-1", "non-text", "focus ring on the sky"],
  ["focus", "sky-2", "non-text", "focus ring on the sky"],
  ["focus", "sky-3", "non-text", "focus ring on the sky (filled pills)"],
  ["focus", "sky-4", "non-text", "focus ring on the sky (filled pills)"],
  ["focus", "surface-raised", "non-text", "focus ring inside the pass and the ticket"],
  ["focus", "surface-sunk", "non-text", "focus ring on the slip"],
];

describe("day theme contrast", () => {
  for (const [foreground, background, kind, where] of PAIRS) {
    it(`${foreground} on ${background} reaches ${MINIMUM[kind]} for ${kind} (${where})`, () => {
      expect(ratio(foreground, background)).toBeGreaterThanOrEqual(MINIMUM[kind]);
    });
  }

  it("matches the ratios DESIGN-SYSTEM.md section 2.2 lists, so the two computations agree", () => {
    expect(ratio("ink", "surface-raised")).toBeCloseTo(15.21, 2);
    expect(ratio("ink-muted", "sky-4")).toBeCloseTo(5.13, 2);
    expect(ratio("on-accent", "accent")).toBeCloseTo(8.55, 2);
  });

  it("would fail the two choices the decisions replaced: ink-muted tagline and amber focus ring", () => {
    expect(ratio("ink-muted", "sky-1")).toBeCloseTo(3.78, 2);
    expect(ratio("ink-muted", "sky-1")).toBeLessThan(MINIMUM["body text"]);
    expect(ratio("accent", "sky-3")).toBeCloseTo(1.56, 2);
    expect(ratio("accent", "sky-3")).toBeLessThan(MINIMUM["non-text"]);
  });
});
