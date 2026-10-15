import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LISTED, PAIRS, colours, contrastGolden, luminance, ratioOf } from "@/scripts/native/golden/geometry-contrast";
import { fileAt, view } from "./golden-view";

const FILES = contrastGolden();
const file = fileAt(FILES, "native-data/golden/design.system.tokens.contrastPairs.json");

type Pair = {
  theme: "day" | "night";
  foreground: string;
  background: string;
  kind: string;
  foregroundHex: string;
  backgroundHex: string;
  ratio: number;
  minimum: number;
  passes: boolean;
  ownsNight?: boolean;
};
type Listed = { theme: "day" | "night"; foreground: string; background: string; foregroundHex: string; backgroundHex: string; ratio: number };
const output = view(file).cases[0]?.output as { pairs: Pair[]; listed: Listed[] };
const listedRatio = (theme: string, foreground: string, background: string) =>
  output.listed.find((entry) => entry.theme === theme && entry.foreground === foreground && entry.background === background)?.ratio;

describe("the contrast vector", () => {
  it("is one constant with a null input", () => {
    expect(FILES).toHaveLength(1);
    expect(view(file)).toMatchObject({ module: "design/system/tokens", function: "contrastPairs", source: "design/system/tokens.json", tests: ["tests/tokens/contrast.test.ts"] });
    expect(view(file).cases).toHaveLength(1);
    expect(view(file).cases[0]?.input).toBeNull();
  });

  it("holds the 27 pairs of the web test in both themes, day first", () => {
    expect(PAIRS).toHaveLength(27);
    expect(output.pairs).toHaveLength(54);
    expect(output.pairs.slice(0, 27).every((pair) => pair.theme === "day")).toBe(true);
    expect(output.pairs.slice(27).every((pair) => pair.theme === "night")).toBe(true);
    expect(output.pairs.slice(0, 27).map((pair) => [pair.foreground, pair.background, pair.kind])).toEqual(PAIRS.map(([f, b, k]) => [f, b, k]));
  });

  it("reaches the minimum of its kind in both themes: 4.5 for body text, 3 for large text and non-text", () => {
    for (const pair of output.pairs) {
      expect(pair.minimum, `${pair.theme} ${pair.foreground} on ${pair.background}`).toBe(pair.kind === "body text" ? 4.5 : 3);
      expect(pair.ratio, `${pair.theme} ${pair.foreground} on ${pair.background}`).toBeGreaterThanOrEqual(pair.minimum);
      expect(pair.passes, `${pair.theme} ${pair.foreground} on ${pair.background}`).toBe(true);
    }
  });

  it("gives every colour of the night pairs its own night value, and keeps the focus ring ink", () => {
    for (const pair of output.pairs.filter((candidate) => candidate.theme === "night")) expect(pair.ownsNight, `${pair.foreground} on ${pair.background}`).toBe(true);
    for (const pair of output.pairs.filter((candidate) => candidate.theme === "day")) expect(pair.ownsNight).toBeUndefined();
    const night = output.pairs.filter((pair) => pair.theme === "night");
    const ink = night.find((pair) => pair.foreground === "ink");
    const focus = night.find((pair) => pair.foreground === "focus");
    expect(focus?.foregroundHex).toBe(ink?.foregroundHex);
    expect(luminance(focus?.foregroundHex ?? "#000000")).toBeGreaterThan(luminance(night.find((pair) => pair.background === "surface-raised")?.backgroundHex ?? "#ffffff"));
  });

  it("matches the day ratios DESIGN-SYSTEM.md section 2.2 lists, so the two computations agree", () => {
    expect(listedRatio("day", "ink", "surface-raised")).toBe(15.21);
    expect(listedRatio("day", "ink-muted", "sky-4")).toBe(5.13);
    expect(listedRatio("day", "on-accent", "accent")).toBe(8.55);
  });

  it("would fail the two choices the decisions replaced: an ink-muted tagline and an amber focus ring", () => {
    expect(listedRatio("day", "ink-muted", "sky-1")).toBe(3.78);
    expect(listedRatio("day", "ink-muted", "sky-1") ?? 0).toBeLessThan(4.5);
    expect(listedRatio("day", "accent", "sky-3")).toBe(1.56);
    expect(listedRatio("day", "accent", "sky-3") ?? 0).toBeLessThan(3);
  });

  it("matches the night ratios DESIGN-SYSTEM.md section 2.2 lists", () => {
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
    expect(LISTED.filter(([theme]) => theme === "night")).toHaveLength(listed.length);
    for (const [foreground, background, expected] of listed) expect(listedRatio("night", foreground, background), `${foreground} / ${background}`).toBe(expected);
  });

  it("every recorded ratio is the WCAG ratio of the two recorded colours, and the colours are the tokens'", () => {
    const themes = colours(JSON.parse(readFileSync("design/system/tokens.json", "utf8")));
    for (const entry of [...output.pairs, ...output.listed]) {
      const where = `${entry.theme} ${entry.foreground} on ${entry.background}`;
      expect(entry.foregroundHex, where).toBe(themes[entry.theme](entry.foreground));
      expect(entry.backgroundHex, where).toBe(themes[entry.theme](entry.background));
      expect(entry.ratio, where).toBe(Math.round(ratioOf(entry.foregroundHex, entry.backgroundHex) * 100) / 100);
    }
  });
});
