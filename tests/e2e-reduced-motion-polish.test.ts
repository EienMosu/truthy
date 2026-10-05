import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// docs/testing.md: every spec file that looks at the game sets reducedMotion itself, since headless Chromium on
// a Mac with "Reduce motion" turned on reports prefers-reduced-motion: reduce and would run otherwise than CI.
// e2e/install.spec.ts only reads the links in <head>, the manifest and the icons.
const EXCEPTIONS = new Set(["install.spec.ts"]);

describe("the motion preference of the end-to-end specs", () => {
  const specs = readdirSync("e2e").filter((name) => name.endsWith(".spec.ts"));

  it("finds the specs", () => {
    expect(specs.length).toBeGreaterThan(10);
    expect(specs).toContain("reload-history.spec.ts");
  });

  it.each(specs.filter((name) => !EXCEPTIONS.has(name)))("%s sets reducedMotion itself", (name) => {
    // Either a value (`reducedMotion: "reduce"`) or each value in turn (`test.use({ reducedMotion })` in a loop).
    expect(readFileSync(`e2e/${name}`, "utf8")).toMatch(/\breducedMotion\b/);
  });
});
