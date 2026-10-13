import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { describe, expect, it } from "vitest";
import { withoutComments } from "@/tests/support/imports";

// app/layout.tsx is part of every route, so whatever it imports ships in every route's first load. The progress
// rules and zod belong to the screens that read progress and decks, not to the code that starts the service worker.

// The import sources that load code: static, re-exported, dynamic and bare imports. An `import type` or
// `export type` is left out, because the compiler drops it and it ships nothing.
function valueImportSources(code: string): string[] {
  const sources: string[] = [];
  for (const match of code.matchAll(/\b(import|export)(\s+type\b)?[^;'"]*?\bfrom\s*["']([^"']+)["']|\bimport\s*\(?\s*["']([^"']+)["']/g)) {
    if (match[2] === undefined) sources.push(match[3] ?? match[4] ?? "");
  }
  return sources;
}

// The repository file an import of the app's own code points at, or null for a package or a file that is not code.
function resolveLocal(from: string, source: string): string | null {
  const base = source.startsWith("@/") ? source.slice(2) : source.startsWith(".") ? normalize(join(dirname(from), source)) : null;
  if (base === null) return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    if (/\.tsx?$/.test(candidate) && existsSync(candidate)) return candidate;
  }
  return null;
}

// Every file of the app's own code that `entry` reaches through value imports, and every package source on the way.
function moduleGraph(entry: string): { files: Set<string>; packages: Set<string> } {
  const files = new Set<string>();
  const packages = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (files.has(file)) continue;
    files.add(file);
    for (const source of valueImportSources(withoutComments(readFileSync(file, "utf8")))) {
      const local = resolveLocal(file, source);
      if (local !== null) queue.push(local);
      else if (!source.startsWith(".") && !source.startsWith("@/")) packages.add(source);
    }
  }
  return { files, packages };
}

describe("the module graph of the root layout", () => {
  it("reads value imports and leaves type-only imports out", () => {
    const code = 'import type { A } from "a";\nimport { b, type C } from "b";\nexport type { D } from "d";\nexport { e } from "e";\nimport "f";\nconst g = import("g");';
    expect(valueImportSources(code)).toEqual(["b", "e", "f", "g"]);
  });

  it("starts the service worker without loading the progress rules or zod", () => {
    const { files, packages } = moduleGraph("app/layout.tsx");
    // The walk follows the layout to the code it starts, so a graph without zod is not an empty one.
    expect(files).toContain("components/OfflineStart.tsx");
    expect(files).toContain("src/offline/register.ts");
    expect([...files].filter((file) => file.startsWith("src/progress/") || file === "src/app-state/pending.ts")).toEqual([]);
    expect([...packages].filter((source) => /^zod(\/|$)/.test(source))).toEqual([]);
  });
});
