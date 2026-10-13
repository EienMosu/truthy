import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { withoutComments } from "@/tests/support/imports";

// Motion ships only the features the screens use: m components under LazyMotion with domAnimation
// (components/MotionFeatures.tsx). One full motion component would bring all of Motion back into the first load,
// and an m element outside LazyMotion would render without animating, so both are read from the code here.

function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return tsxFiles(path);
    return entry.name.endsWith(".tsx") ? [path] : [];
  });
}

const files = [...tsxFiles("components"), ...tsxFiles("app")].map((file) => ({ file, code: withoutComments(readFileSync(file, "utf8")) }));

// The names a file imports from Motion's React entry, without `type` imports.
function motionImports(code: string): string[] {
  return [...code.matchAll(/\bimport\s*\{([^}]*)\}\s*from\s*["']motion\/react["']/g)].flatMap((match) =>
    (match[1] ?? "")
      .split(",")
      .map((name) => name.trim())
      .filter((name) => name !== "" && !name.startsWith("type ")),
  );
}

describe("Motion through LazyMotion", () => {
  it("loads domAnimation with the page, in strict mode", () => {
    const code = withoutComments(readFileSync("components/MotionFeatures.tsx", "utf8"));
    expect(code).toMatch(/<LazyMotion features=\{domAnimation\} strict>/);
    expect(code).not.toMatch(/\bimport\s*\(/);
  });

  it("renders no full motion component", () => {
    const found = files.filter(({ code }) => /<\/?motion\./.test(code) || motionImports(code).includes("motion")).map(({ file }) => file);
    expect(found).toEqual([]);
  });

  it("puts every m element under MotionFeatures", () => {
    const users = files.filter(({ code }) => /<m\./.test(code));
    // The scan finds the m elements at all: the screens and the pass render them.
    expect(users.map(({ file }) => file)).toEqual(expect.arrayContaining(["components/start/StartFlow.tsx", "components/play/PlayScreen.tsx"]));
    const unwrapped = users.filter(({ code }) => !/<MotionFeatures>/.test(code)).map(({ file }) => file);
    expect(unwrapped).toEqual([]);
  });
});
