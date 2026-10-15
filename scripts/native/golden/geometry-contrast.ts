// The contrast pairs of the design system (src/tokens/contrast.ts, which tests/tokens/contrast.test.ts checks) as a
// vector: for every pair and both themes, the two colours as hex, the WCAG 2.x contrast ratio rounded to two
// decimals, the minimum the pair must reach and whether it does. The colours come from the CSS the web ships:
// tokensToCss on design/system/tokens.json, with var() references resolved and the night values laid over the day
// ones as a browser cascades them; a night pair also says whether both its colours have a night value of their
// own, so that no pair is checked with a day value. The web test reads the raw file, and no colour of a pair is
// among the values the token overrides change (they change focus-on-fill, which no pair uses). A native app
// computes the ratio from its own colour constants and compares.
import { readFileSync } from "node:fs";
import { tokensToCss } from "@/src/tokens/build";
import { MINIMUM, PAIRS, luminance } from "@/src/tokens/contrast";
import { goldenFile, type GoldenFile } from "./format";

export { PAIRS, luminance };

type Theme = "day" | "night";

/** The ratios DESIGN-SYSTEM.md section 2.2 lists, and the two choices the product owner decisions replaced: [theme, foreground, background]. */
export const LISTED: readonly (readonly [Theme, string, string])[] = [
  ["day", "ink", "surface-raised"],
  ["day", "ink-muted", "sky-4"],
  ["day", "on-accent", "accent"],
  ["day", "ink-muted", "sky-1"],
  ["day", "accent", "sky-3"],
  ["night", "ink", "surface-raised"],
  ["night", "ink", "surface-sunk"],
  ["night", "ink-muted", "surface-raised"],
  ["night", "ink-muted", "surface-sunk"],
  ["night", "true", "surface-raised"],
  ["night", "true", "surface-sunk"],
  ["night", "false", "surface-raised"],
  ["night", "correct", "surface-sunk"],
  ["night", "correct", "surface-raised"],
  ["night", "wrong", "surface-sunk"],
  ["night", "on-dark", "true"],
  ["night", "on-dark", "false"],
  ["night", "on-dark", "ink"],
  ["night", "on-accent", "accent"],
  ["night", "ink", "sky-1"],
  ["night", "ink-muted", "sky-1"],
  ["night", "ink-muted", "sky-2"],
  ["night", "accent", "sky-3"],
  ["night", "accent", "sky-4"],
  ["night", "ink-muted", "sky-3"],
  ["night", "ink-muted", "sky-4"],
  ["night", "rule", "surface-raised"],
];

function declarations(css: string): Map<string, string> {
  return new Map([...css.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1] ?? "", (m[2] ?? "").trim()]));
}

/** The colour roles of both themes as `#rrggbb`, from the generated CSS, and whether a role has a night value of its own. */
export function colours(tokens: unknown): Record<Theme, (role: string) => string> & { ownsNight: (role: string) => boolean } {
  const css = tokensToCss(tokens);
  const dark = css.indexOf("@media (prefers-color-scheme: dark)");
  const day = declarations(dark === -1 ? css : css.slice(0, dark));
  const overrides = declarations(dark === -1 ? "" : css.slice(dark));
  const night = new Map([...day, ...overrides]);
  const resolver = (variables: ReadonlyMap<string, string>) => {
    const resolve = (name: string, seen: readonly string[]): string => {
      if (seen.includes(name)) throw new Error(`var() cycle: ${[...seen, name].join(" -> ")}`);
      const value = variables.get(name);
      if (value === undefined) throw new Error(`${name} is not in the generated CSS`);
      return value.replace(/var\((--[\w-]+)\)/g, (_, inner: string) => resolve(inner, [...seen, name]));
    };
    return (role: string) => resolve(`--color-${role}`, []);
  };
  return { day: resolver(day), night: resolver(night), ownsNight: (role) => overrides.has(`--color-${role}`) };
}

/** The contrast ratio of two opaque colours. */
export function ratioOf(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/** The file of this group: contrastPairs, one constant. */
export function contrastGolden(): GoldenFile[] {
  const themes = colours(JSON.parse(readFileSync("design/system/tokens.json", "utf8")));
  const pairs = (["day", "night"] as const).flatMap((theme) =>
    PAIRS.map(([foreground, background, kind, where]) => {
      const foregroundHex = themes[theme](foreground);
      const backgroundHex = themes[theme](background);
      const ratio = ratioOf(foregroundHex, backgroundHex);
      const ownsNight = theme === "night" ? { ownsNight: themes.ownsNight(foreground) && themes.ownsNight(background) } : {};
      return { theme, foreground, background, kind, where, foregroundHex, backgroundHex, ratio: round2(ratio), minimum: MINIMUM[kind], passes: ratio >= MINIMUM[kind], ...ownsNight };
    }),
  );
  const listed = LISTED.map(([theme, foreground, background]) => {
    const foregroundHex = themes[theme](foreground);
    const backgroundHex = themes[theme](background);
    return { theme, foreground, background, foregroundHex, backgroundHex, ratio: round2(ratioOf(foregroundHex, backgroundHex)) };
  });
  return [
    goldenFile(
      { module: "design/system/tokens", function: "contrastPairs", source: "design/system/tokens.json", tests: ["tests/tokens/contrast.test.ts"] },
      [{ name: "value", input: null, output: { pairs, listed } }],
    ),
  ];
}
