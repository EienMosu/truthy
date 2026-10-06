import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// docs/testing.md: every spec file that looks at the game sets reducedMotion itself, since headless Chromium on
// a Mac with "Reduce motion" turned on reports prefers-reduced-motion: reduce and would run otherwise than CI.
// e2e/install.spec.ts only reads the links in <head>, the manifest and the icons.
const EXCEPTIONS = new Set(["install.spec.ts"]);

// Whether a spec's code passes reducedMotion to test.use: either a value (`reducedMotion: "reduce"`) or each value in
// turn (`test.use({ reducedMotion })` in a loop), beside other options that may hold an object of their own (a
// viewport). Comments are left out first, so a spec that only mentions the option in a comment does not count.
function setsReducedMotion(source: string): boolean {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
  return /\btest\.use\(\s*\{(?:[^{}]|\{[^{}]*\})*\breducedMotion\b/.test(code);
}

describe("the motion preference of the end-to-end specs", () => {
  const specs = readdirSync("e2e").filter((name) => name.endsWith(".spec.ts"));

  it("finds the specs", () => {
    expect(specs.length).toBeGreaterThan(10);
    expect(specs).toContain("reload-history.spec.ts");
  });

  it.each([
    ['test.use({ reducedMotion: "reduce" });', true],
    ['test.use({ colorScheme: "dark", reducedMotion: "no-preference" });', true],
    ['test.use({ viewport: { width: 320, height: 568 }, reducedMotion: "reduce" });', true],
    ["for (const reducedMotion of values) {\n  test.describe(`motion: ${reducedMotion}`, () => {\n    test.use({ reducedMotion });", true],
    ['// No reducedMotion needed here.\ntest.use({ viewport: { width: 320, height: 568 } });', false],
    ['// test.use({ reducedMotion: "reduce" });\ntest("plays", () => {});', false],
    ['/* test.use({ reducedMotion: "reduce" }); */\ntest("plays", () => {});', false],
    ['test.use({ viewport: { width: 320, height: 568 } }); // reducedMotion comes from the machine', false],
    ['const reducedMotion = "reduce";\ntest.use({ viewport: { width: 320, height: 568 } });', false],
  ])("reads %j as setting it: %s", (source, expected) => {
    expect(setsReducedMotion(source)).toBe(expected);
  });

  it.each(specs.filter((name) => !EXCEPTIONS.has(name)))("%s sets reducedMotion itself", (name) => {
    expect(setsReducedMotion(readFileSync(`e2e/${name}`, "utf8")), name).toBe(true);
  });
});
