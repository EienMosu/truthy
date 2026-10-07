import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { describe, expect, it } from "vitest";
import { importSources, withoutComments } from "@/tests/support/imports";

// src/offline is shared by the service worker and the page (offline spec section 5): it imports nothing from React,
// Next.js or the components, and holds no component. The components import from it, never the other way round.
const DIR = "src/offline";
const files = readdirSync(DIR).sort();

// The module sources a file imports, read from its code without its comments (tests/support/imports.ts).
function importsOf(file: string): string[] {
  return importSources(withoutComments(readFileSync(`${DIR}/${file}`, "utf8")));
}

// The folders src/offline must not reach into, as paths from the repository root.
const FORBIDDEN_DIRS = ["components", "app"];

// Whether an import source reaches React, Next.js or a forbidden folder: by package name, by the @ alias, or by a
// relative path that climbs out of src/offline (a relative import skips the alias, so the alias test alone misses it).
function reachesForbidden(file: string, source: string): boolean {
  if (/^(react|react-dom|next)(\/|$)/.test(source)) return true;
  const target = source.startsWith("@/") ? source.slice(2) : source.startsWith(".") ? normalize(join(dirname(`${DIR}/${file}`), source)) : "";
  return FORBIDDEN_DIRS.some((dir) => target === dir || target.startsWith(`${dir}/`));
}

describe("src/offline", () => {
  it("holds TypeScript modules only, no component", () => {
    expect(files).toEqual(expect.arrayContaining(["assets.ts", "worker.ts"]));
    for (const file of files) expect(file, file).toMatch(/^[a-z-]+\.ts$/);
  });

  it("imports nothing from React, Next.js or the components", () => {
    // The scan reads the folder's imports at all: the worker takes its decisions from the modules beside it.
    expect(importsOf("worker.ts")).toEqual(expect.arrayContaining(["./assets", "./strategy"]));
    for (const file of files) {
      for (const source of importsOf(file)) {
        expect(reachesForbidden(file, source), `${file} imports ${source}`).toBe(false);
      }
    }
  });
});
