import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { tokensToCss } from "@/src/tokens/build";
import { MINIMUM, PAIRS, luminance } from "@/src/tokens/contrast";

// WCAG 2.x contrast of both themes, computed from the CSS the app ships: tokensToCss on the real
// design/system/tokens.json, with var() references resolved. The pairs are DESIGN-SYSTEM.md section 2.2 as
// corrected by two product owner decisions: the start-flow tagline and the "Your pass is ready" line are
// ink (not ink-muted) on the sky bands, and the focus ring is ink (--color-focus) everywhere, never amber.
// rule on surface-raised (1.47 day, 1.43 night) is not checked: rules and the pass-line dots are decorative only.
// Night is the day block with the night overrides of the prefers-color-scheme: dark block on top, as the
// browser cascades them; every pair is checked in both themes against the same minimums.

const CSS = tokensToCss(JSON.parse(readFileSync("design/system/tokens.json", "utf8")));
const DARK = "@media (prefers-color-scheme: dark)";

type Theme = "day" | "night";

function declarations(css: string): Map<string, string> {
  return new Map([...css.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1] ?? "", (m[2] ?? "").trim()]));
}

const dark = CSS.indexOf(DARK);
const DAY = declarations(dark === -1 ? CSS : CSS.slice(0, dark));
const NIGHT_OVERRIDES = declarations(dark === -1 ? "" : CSS.slice(dark));
const VARIABLES: Record<Theme, ReadonlyMap<string, string>> = { day: DAY, night: new Map([...DAY, ...NIGHT_OVERRIDES]) };

/** The value of a variable in a theme with every var() inside it replaced, as a browser would compute it. */
function resolve(theme: Theme, name: string, seen: readonly string[] = []): string {
  if (seen.includes(name)) throw new Error(`var() cycle: ${[...seen, name].join(" -> ")}`);
  const value = VARIABLES[theme].get(name);
  if (value === undefined) throw new Error(`${name} is not in the generated CSS`);
  return value.replace(/var\((--[\w-]+)\)/g, (_, inner: string) => resolve(theme, inner, [...seen, name]));
}

/** The contrast ratio of two colour roles in a theme, by their --color-* names. */
function ratio(theme: Theme, foreground: string, background: string): number {
  const a = luminance(resolve(theme, `--color-${foreground}`));
  const b = luminance(resolve(theme, `--color-${background}`));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe("day theme contrast", () => {
  for (const [foreground, background, kind, where] of PAIRS) {
    it(`${foreground} on ${background} reaches ${MINIMUM[kind]} for ${kind} (${where})`, () => {
      expect(ratio("day", foreground, background)).toBeGreaterThanOrEqual(MINIMUM[kind]);
    });
  }

  it("matches the ratios DESIGN-SYSTEM.md section 2.2 lists, so the two computations agree", () => {
    expect(ratio("day", "ink", "surface-raised")).toBeCloseTo(15.21, 2);
    expect(ratio("day", "ink-muted", "sky-4")).toBeCloseTo(5.13, 2);
    expect(ratio("day", "on-accent", "accent")).toBeCloseTo(8.55, 2);
  });

  it("would fail the two choices the decisions replaced: ink-muted tagline and amber focus ring", () => {
    expect(ratio("day", "ink-muted", "sky-1")).toBeCloseTo(3.78, 2);
    expect(ratio("day", "ink-muted", "sky-1")).toBeLessThan(MINIMUM["body text"]);
    expect(ratio("day", "accent", "sky-3")).toBeCloseTo(1.56, 2);
    expect(ratio("day", "accent", "sky-3")).toBeLessThan(MINIMUM["non-text"]);
  });
});

describe("night theme contrast", () => {
  it("gives every colour of the pairs its own night value, so no pair is checked with a day value", () => {
    const roles = new Set(PAIRS.flatMap(([foreground, background]) => [foreground, background]));
    for (const role of roles) expect(NIGHT_OVERRIDES.has(`--color-${role}`), `--color-${role}`).toBe(true);
  });

  for (const [foreground, background, kind, where] of PAIRS) {
    it(`${foreground} on ${background} reaches ${MINIMUM[kind]} for ${kind} (${where})`, () => {
      expect(ratio("night", foreground, background)).toBeGreaterThanOrEqual(MINIMUM[kind]);
    });
  }

  it("keeps the focus ring ink, which is light at night, and checks it against the night surfaces", () => {
    expect(resolve("night", "--color-focus")).toBe(resolve("night", "--color-ink"));
    expect(luminance(resolve("night", "--color-focus"))).toBeGreaterThan(luminance(resolve("night", "--color-surface-raised")));
  });

  it("matches the night ratios DESIGN-SYSTEM.md section 2.2 lists, so the two computations agree", () => {
    const listed: readonly [string, string, number][] = [
      ["ink", "surface-raised", 10.48],
      ["ink", "surface-sunk", 11.83],
      ["ink-muted", "surface-raised", 5.35],
      ["ink-muted", "surface-sunk", 6.04],
      ["true", "surface-raised", 4.72],
      ["true", "surface-sunk", 5.33],
      ["false", "surface-raised", 4.94],
      ["correct", "surface-sunk", 6.24],
      ["correct", "surface-raised", 5.53],
      ["wrong", "surface-sunk", 5.58],
      ["on-dark", "true", 6.12],
      ["on-dark", "false", 6.4],
      ["on-dark", "ink", 13.59],
      ["on-accent", "accent", 7.79],
      ["ink", "sky-1", 14.2],
      ["ink-muted", "sky-1", 7.25],
      ["ink-muted", "sky-2", 6.76],
      ["accent", "sky-3", 7.16],
      ["accent", "sky-4", 6.99],
      ["ink-muted", "sky-3", 6.24],
      ["ink-muted", "sky-4", 6.09],
      ["rule", "surface-raised", 1.43],
    ];
    for (const [foreground, background, expected] of listed) {
      expect(ratio("night", foreground, background), `${foreground} / ${background}`).toBeCloseTo(expected, 2);
    }
  });
});
