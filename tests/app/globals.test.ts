import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("app/globals.css", "utf8");

describe("app/globals.css", () => {
  it("keeps Tailwind limited to app/ and components/, then imports the tokens, before any rule", () => {
    const tailwind = css.indexOf('@import "tailwindcss" source(none);');
    const sourceApp = css.indexOf('@source "../app";');
    const sourceComponents = css.indexOf('@source "../components";');
    const tokens = css.indexOf('@import "./tokens.css";');
    const firstRule = css.indexOf("{");
    expect(tailwind).toBeGreaterThanOrEqual(0);
    expect(sourceApp).toBeGreaterThan(tailwind);
    expect(sourceComponents).toBeGreaterThan(sourceApp);
    expect(tokens).toBeGreaterThan(sourceComponents);
    expect(firstRule).toBeGreaterThan(tokens);
  });

  it("draws the focus ring in the focus colour (ink), 2px wide with a 2px offset", () => {
    expect(css).toMatch(/--focus-ring-width: 2px;/);
    expect(css).toMatch(/--focus-ring-offset: 2px;/);
    expect(css).toMatch(
      /:focus-visible \{\s*outline: var\(--focus-ring-width\) solid var\(--color-focus\);\s*outline-offset: var\(--focus-ring-offset\);/,
    );
    expect(css).not.toContain("--color-focus-on-fill");
  });

  it("lets the browser draw its own parts in the light or dark scheme the system asks for", () => {
    const root = css.slice(css.indexOf(":root {"), css.indexOf("}", css.indexOf(":root {")));
    expect(root).toContain("color-scheme: light dark;");
  });

  it("draws the browser's own parts in the theme the player chose, when there is a choice", () => {
    const rule = (selector: string) => new RegExp(`${selector.replace(/[[\]()]/g, "\\$&")} \\{\\s*color-scheme: (\\w+);\\s*\\}`).exec(css)?.[1];
    expect(rule(":root[data-theme=light]")).toBe("light");
    expect(rule(":root[data-theme=dark]")).toBe("dark");
  });

  it("has a night variant for markup that must match the theme before the page knows it, in the same three cases as the tokens", () => {
    const variant = css.slice(css.indexOf("@custom-variant night {"));
    expect(css.indexOf("@custom-variant night {")).toBeGreaterThan(0);
    expect(variant).toMatch(
      /^@custom-variant night \{\s*@media \(prefers-color-scheme: dark\) \{\s*&:where\(:root:not\(\[data-theme=light\]\) \*\) \{\s*@slot;\s*\}\s*\}\s*&:where\(:root\[data-theme=dark\] \*\) \{\s*@slot;\s*\}\s*\}/,
    );
  });

  it("stops CSS movement when the player asks for reduced motion", () => {
    const block = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(block).toContain("animation: none !important;");
    // 0s, so no transition starts: a 1ms one is painted at its start value for a frame in WebKit.
    expect(block).toContain("transition-duration: 0s !important;");
    expect(block).toContain("transition-delay: 0ms !important;");
  });

  it("frames the app as a centred phone column, as tall as the viewport, that never scrolls", () => {
    expect(css).toMatch(/--app-max-width: 430px;/);
    const frame = css.slice(css.indexOf(".app-frame {"), css.indexOf("}", css.indexOf(".app-frame {")));
    expect(frame).toContain("max-width: var(--app-max-width);");
    expect(frame).toContain("height: 100dvh;");
    expect(frame).toContain("margin-inline: auto;");
    expect(frame).toContain("overflow: hidden;");
  });

  it("has a tight variant for screens under 600 tall and a short one for screens under 568, short declared last so it wins", () => {
    const tight = css.indexOf("@custom-variant tight (@media (max-height: 599px));");
    const short = css.indexOf("@custom-variant short (@media (max-height: 567px));");
    expect(tight).toBeGreaterThan(0);
    expect(short).toBeGreaterThan(tight);
  });

  it("uses token colours only", () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
  });
});
