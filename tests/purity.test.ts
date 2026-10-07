import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Spec section 4, "Modules": src/engine and src/input are pure, and the rules of progress depend on content
// types only. The Swift and Kotlin clones translate these files line by line, so nothing in them may reach
// for a clock, randomness, the DOM, storage or React. Each entry: the files, and the import sources they
// may use (exact, or a prefix ending in "/").
const CONTENT_TYPES = ["@/src/content/schema", "@/src/content/play"] as const;
const PURE: readonly { files: string[]; mayImport: readonly string[] }[] = [
  { files: sources("src/engine"), mayImport: [...CONTENT_TYPES, "./"] },
  { files: sources("src/input"), mayImport: ["./"] },
  { files: ["src/progress/progress.ts"], mayImport: ["zod", ...CONTENT_TYPES, "./"] },
  { files: ["src/content/play.ts"], mayImport: ["./schema"] },
  { files: ["src/content/text.ts"], mayImport: [] },
  // The service worker's decisions (offline spec section 5): the worker and the unit tests run the same code.
  { files: ["src/offline/assets.ts", "src/offline/cache-names.ts", "src/offline/strategy.ts"], mayImport: ["./"] },
];

const FORBIDDEN: readonly { name: string; pattern: RegExp }[] = [
  { name: "Date", pattern: /\bDate\b/ },
  { name: "performance", pattern: /\bperformance\b/ },
  { name: "Math.random", pattern: /\bMath\s*\.\s*random\b/ },
  { name: "crypto", pattern: /\bcrypto\b/ },
  { name: "a timer", pattern: /\b(?:setTimeout|setInterval|requestAnimationFrame|queueMicrotask)\b/ },
  { name: "the DOM", pattern: /\b(?:window|document|navigator|globalThis)\b/ },
  { name: "storage", pattern: /\b(?:localStorage|sessionStorage|indexedDB)\b/ },
];

function sources(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => /\.tsx?$/.test(name))
    .map((name) => join(dir, name));
}

// The code without its comments: a comment may name what the code must not use.
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function importSources(code: string): string[] {
  return [...code.matchAll(/\b(?:import|export)\b[^;'"]*?\bfrom\s*["']([^"']+)["']|\bimport\s*\(?\s*["']([^"']+)["']/g)].map(
    (match) => match[1] ?? match[2] ?? "",
  );
}

function allowed(source: string, mayImport: readonly string[]): boolean {
  return mayImport.some((entry) => (entry.endsWith("/") ? source.startsWith(entry) : source === entry));
}

function findingsIn(file: string, source: string, mayImport: readonly string[]): string[] {
  const code = withoutComments(source);
  const found: string[] = [];
  for (const from of importSources(code)) if (!allowed(from, mayImport)) found.push(`${file} imports ${from}`);
  for (const rule of FORBIDDEN) if (rule.pattern.test(code)) found.push(`${file} uses ${rule.name}`);
  return found;
}

describe("the scanner", () => {
  it("ignores what a comment says and reads what the code does", () => {
    expect(withoutComments("// never Math.random\nconst a = 1; /* Date */")).not.toMatch(/Math|Date/);
    expect(withoutComments('const url = "https://example.com/x";')).toContain("https://example.com/x");
  });

  it("finds static, type-only, re-exported, dynamic and bare imports", () => {
    const code = 'import { a } from "x";\nimport type { B } from "@/y";\nexport { c } from "./z";\nconst d = import("w");\nimport "v";';
    expect(importSources(code)).toEqual(["x", "@/y", "./z", "w", "v"]);
  });

  it("reports a clock, randomness, a timer, the DOM, storage and a foreign import", () => {
    const planted = [
      'import { useState } from "react";',
      'import { loadDeck } from "@/src/content/load";',
      "const now = Date.now() + performance.now() + Math.random();",
      "setTimeout(() => window.localStorage.clear(), 1);",
    ].join("\n");
    expect(findingsIn("planted.ts", planted, [...CONTENT_TYPES, "./"])).toEqual([
      "planted.ts imports react",
      "planted.ts imports @/src/content/load",
      "planted.ts uses Date",
      "planted.ts uses performance",
      "planted.ts uses Math.random",
      "planted.ts uses a timer",
      "planted.ts uses the DOM",
      "planted.ts uses storage",
    ]);
  });

  it("accepts the content types and a module's own files", () => {
    const code = 'import type { Card } from "@/src/content/schema";\nimport { shuffle } from "./rng";\nexport type { Mode } from "@/src/content/play";';
    expect(findingsIn("ok.ts", code, [...CONTENT_TYPES, "./"])).toEqual([]);
  });
});

describe("pure modules", () => {
  it("covers the engine, the input rules, the progress rules, the shared play types, how card text marks code and the service worker's decisions", () => {
    expect(PURE.flatMap((entry) => entry.files).sort()).toEqual([
      "src/content/play.ts",
      "src/content/text.ts",
      "src/engine/deal.ts",
      "src/engine/rng.ts",
      "src/engine/round.ts",
      "src/input/swipe.ts",
      "src/offline/assets.ts",
      "src/offline/cache-names.ts",
      "src/offline/strategy.ts",
      "src/progress/progress.ts",
    ]);
  });

  it("import only what the module table allows and use no clock, randomness, DOM or storage", () => {
    const found = PURE.flatMap((entry) => entry.files.flatMap((file) => findingsIn(file, readFileSync(file, "utf8"), entry.mayImport)));
    expect(found).toEqual([]);
  });
});
