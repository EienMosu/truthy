// Golden vectors of the small helpers: pad2 (components/format.ts), the logo mark's height (components/Logo.tsx)
// and the theme rules (src/app-state/theme.ts). Each output comes from calling the web code.

import { LogoMark } from "@/components/Logo";
import { pad2 } from "@/components/format";
import { THEME_KEY, oppositeTheme, parseTheme, resolveTheme, switchTheme, type Theme } from "@/src/app-state/theme";
import { metaOf } from "../registry";
import { goldenFile, type GoldenCase, type GoldenFile } from "./format";

function pad2Cases(): GoldenCase[] {
  const pinned = [0, 7, 14, 120]; // tests/components/format.test.ts
  const edges = [1, 9, 10, 99, 100];
  return [...pinned, ...edges].map((n) => ({ name: `pad2(${n})`, input: { n }, output: pad2(n) }));
}

/** The height LogoMark draws for these props: the svg's height attribute, computed by the component itself. */
function logoHeight(props: { width?: number }): number {
  const height: unknown = LogoMark(props).props.height;
  if (typeof height !== "number") throw new Error("LogoMark drew no numeric height");
  return height;
}

function logoCases(): GoldenCase[] {
  const cases: GoldenCase[] = [{ name: "the default width 44 gives 30 (Logo.test.tsx)", input: {}, output: logoHeight({}) }];
  const widths: readonly [number, string][] = [
    [44, "next to the wordmark"],
    [26, "the continue line (Logo.test.tsx: 17.73)"],
    [20, "the compact pass band"],
    [1, "one pixel"],
    [13, "rounds down"],
    [36, "rounds up"],
    [100, "a wide mark"],
    [0.11, "an exact half, 7.5 hundredths, rounds up to 8"],
    [0.33, "an exact half, 22.5 hundredths, rounds up to 23, not to the even 22"],
    [2.53, "an exact half, 172.5 hundredths, rounds up to 173, not to the even 172"],
  ];
  for (const [width, why] of widths) {
    cases.push({ name: `width ${width}: ${why}`, input: { width }, output: logoHeight({ width }) });
  }
  return cases;
}

function parseThemeCases(): GoldenCase[] {
  // tests/app-state/theme.test.ts: light and dark, then every garbage value it lists. undefined is the empty input.
  const values: readonly [string, unknown][] = [
    ["light", "light"],
    ["dark", "dark"],
    ["null", null],
    ["undefined", undefined],
    ["the empty string", ""],
    ['"Dark"', "Dark"],
    ['" dark"', " dark"],
    ['"system"', "system"],
    ['"auto"', "auto"],
    ['"1"', "1"],
    ["the number 1", 1],
    ["an empty object", {}],
    ['the array ["dark"]', ["dark"]],
    ['the JSON string "\\"dark\\"" (theme.test.ts: readThemeChoice)', '"dark"'],
    ['"purple" (theme.test.ts: readThemeChoice)', "purple"],
  ];
  return values.map(([name, value]) => ({ name, input: value === undefined ? {} : { value }, output: parseTheme(value) }));
}

function oppositeThemeCases(): GoldenCase[] {
  return (["light", "dark"] as const).map((theme) => ({ name: theme, input: { theme }, output: oppositeTheme(theme) }));
}

const CHOICES: readonly (Theme | null)[] = [null, "light", "dark"];

function resolveThemeCases(): GoldenCase[] {
  return CHOICES.flatMap((choice) =>
    [false, true].map((systemDark) => ({
      name: `choice ${choice ?? "none"}, system ${systemDark ? "dark" : "light"}`,
      input: { choice, systemDark },
      output: resolveTheme(choice, systemDark),
    })),
  );
}

/**
 * The flip rule of switchTheme, run on a page whose data-theme attribute holds `choice` (none: the page follows
 * the system), a working storage and a system setting. The vector describes the page by what the rule reads.
 */
function switchOnce(choice: Theme | null, systemDark: boolean): { theme: Theme; stored: string | null } {
  const attributes = new Map<string, string>(choice === null ? [] : [["data-theme", choice]]);
  const page = {
    documentElement: {
      getAttribute: (name: string) => attributes.get(name) ?? null,
      setAttribute: (name: string, value: string) => void attributes.set(name, value),
    },
    querySelectorAll: () => [],
  } as unknown as Document;
  const stored = new Map<string, string>();
  const storage = { setItem: (key: string, value: string) => void stored.set(key, value) };
  const query = { matches: systemDark, addEventListener: () => {}, removeEventListener: () => {} };
  const theme = switchTheme(page, storage, () => query);
  if (attributes.get("data-theme") !== theme) throw new Error("switchTheme left another theme on the page");
  return { theme, stored: stored.get(THEME_KEY) ?? null };
}

function switchThemeCases(): GoldenCase[] {
  return CHOICES.flatMap((choice) =>
    [false, true].map((systemDark) => ({
      name: `choice ${choice ?? "none"}, system ${systemDark ? "dark" : "light"}`,
      input: { choice, systemDark },
      output: switchOnce(choice, systemDark),
    })),
  );
}

export function golden(): GoldenFile[] {
  const theme = "src/app-state/theme";
  return [
    goldenFile(metaOf("components/format", "pad2"), pad2Cases()),
    goldenFile(metaOf("components/Logo", "LogoMark"), logoCases()),
    goldenFile(metaOf(theme, "THEME_KEY"), [{ name: "THEME_KEY", input: null, output: THEME_KEY }]),
    goldenFile(metaOf(theme, "parseTheme"), parseThemeCases()),
    goldenFile(metaOf(theme, "oppositeTheme"), oppositeThemeCases()),
    goldenFile(metaOf(theme, "resolveTheme"), resolveThemeCases()),
    goldenFile(metaOf(theme, "switchTheme"), switchThemeCases()),
  ];
}
