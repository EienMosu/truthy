### Task 2: Enforced purity and the shared play types

Spec section 4 makes `src/engine` and `src/input` pure and lets `src/progress` depend on content types only. Today nothing enforces the first, and `src/progress/progress.ts` breaks the second (it imports `CardHistory`, `History`, `Mode` and `RoundResult` from the engine). Step 2 gives the engine a clock concept, so the guard has to exist before the first engine change. This task adds a source-scanning test and moves the types the engine and the progress share into `src/content/play.ts`. No behaviour changes.

**Files:**
- Create: `src/content/play.ts`
- Create (test): `tests/purity.test.ts`
- Modify: `src/engine/deal.ts` (lines 7 to 12), `src/engine/round.ts` (lines 8, 12 to 17, 89 to 97), `src/progress/progress.ts` (lines 7, 8, 95)

**Interfaces:**
- Consumes (as they are today):
  - `src/engine/deal.ts`: `interface CardHistory { seen: number; lastCorrect: boolean; lastSeenAt: number }`, `type History = Readonly<Record<string, CardHistory>>`.
  - `src/engine/round.ts`: `type Mode`, `interface Answered`, `interface RoundResult`.
  - `src/content/schema.ts`: `type Card`, `interface Route`.
- Produces:

```ts
// src/content/play.ts
// What a round is made of, as far as both the engine and the progress need to know (spec section 4:
// each may depend on content types only). Types and one constant, no behaviour.
import type { Card, Route } from "./schema";

export type Mode = "classic" | "streak" | "lives" | "timed";
export const MODES = ["classic", "streak", "lives", "timed"] as const satisfies readonly Mode[];

export interface CardHistory {
  seen: number;
  lastCorrect: boolean;
  lastSeenAt: number;
}
export type History = Readonly<Record<string, CardHistory>>; // by card id

export interface Answered {
  card: Card;
  given: boolean;
  correct: boolean;
  at: number;
}

export interface RoundResult {
  mode: Mode;
  route: Route;
  score: number; // the number the mode's record keeps
  total: number; // cards answered
  answers: readonly Answered[];
  missed: readonly Answered[]; // answers with correct === false, in order
  abandoned: boolean;
}
```

  - `src/engine/deal.ts` keeps exporting the names: `export type { CardHistory, History } from "@/src/content/play";` (and imports them for its own use).
  - `src/engine/round.ts` keeps exporting the names: `export type { Answered, Mode, RoundResult } from "@/src/content/play";`. No other file's imports change in this task.
  - `src/progress/progress.ts` imports `CardHistory`, `History`, `Mode`, `RoundResult` and `MODES` from `@/src/content/play`; its private `const MODES` (line 95) is deleted and `z.enum(MODES)` uses the imported one.

**Rules:**

1. Files checked: every `.ts` or `.tsx` file directly in `src/engine` and `src/input`, plus `src/progress/progress.ts` and `src/content/play.ts`. `src/progress/local.ts` is the storage side and is not checked.
2. Allowed import sources: `src/engine`: `@/src/content/schema`, `@/src/content/play`, and its own files (`./...`). `src/input`: its own files only. `src/progress/progress.ts`: `zod`, `@/src/content/schema`, `@/src/content/play`, `./...`. `src/content/play.ts`: `./schema`.
3. Forbidden in the code of those files (comments do not count): `Date`, `performance`, `Math.random`, `crypto`, `setTimeout`, `setInterval`, `requestAnimationFrame`, `queueMicrotask`, `window`, `document`, `navigator`, `globalThis`, `localStorage`, `sessionStorage`, `indexedDB`. Consequence for later tasks: no variable in these files may be called `window` or `document`.
4. The test's list of checked files is pinned, so a new engine file cannot slip past the scan unnoticed.

**Tests:** `tests/purity.test.ts`, complete:

```ts
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
  it("covers the engine, the input rules, the progress rules and the shared play types", () => {
    expect(PURE.flatMap((entry) => entry.files).sort()).toEqual([
      "src/content/play.ts",
      "src/engine/deal.ts",
      "src/engine/rng.ts",
      "src/engine/round.ts",
      "src/input/swipe.ts",
      "src/progress/progress.ts",
    ]);
  });

  it("import only what the module table allows and use no clock, randomness, DOM or storage", () => {
    const found = PURE.flatMap((entry) => entry.files.flatMap((file) => findingsIn(file, readFileSync(file, "utf8"), entry.mayImport)));
    expect(found).toEqual([]);
  });
});
```

**Steps:**

- [ ] **Step 1: Write `tests/purity.test.ts`** as above.
- [ ] **Step 2: Run it and watch it fail.** `pnpm vitest run tests/purity.test.ts`. Expected: 5 passed, 1 failed: the last test fails with `ENOENT: no such file or directory, open 'src/content/play.ts'`. To see the real finding, create `src/content/play.ts` with only its header comment and run again: the last test now fails with exactly

```
+   "src/progress/progress.ts imports @/src/engine/deal",
+   "src/progress/progress.ts imports @/src/engine/round",
```

- [ ] **Step 3: Fill `src/content/play.ts`** with the code under "Produces".
- [ ] **Step 4: Point the engine at it.** In `src/engine/deal.ts` replace the two declarations (lines 7 to 12) with `import type { CardHistory, History } from "@/src/content/play";` and `export type { CardHistory, History } from "@/src/content/play";`. In `src/engine/round.ts` replace `Mode` (line 8), `Answered` (lines 12 to 17) and `RoundResult` (lines 89 to 97) with `import type { Answered, Mode, RoundResult } from "@/src/content/play";` and `export type { Answered, Mode, RoundResult } from "@/src/content/play";`; its `History` import now comes from `@/src/content/play` too. `AVAILABLE_MODES` and `CLASSIC_LENGTH` stay where they are.
- [ ] **Step 5: Point the progress at it.** In `src/progress/progress.ts` replace lines 7 and 8 with `import { MODES, type CardHistory, type History, type Mode, type RoundResult } from "@/src/content/play";` and delete the private `MODES` line.
- [ ] **Step 6: Run the tests.** `pnpm vitest run tests/purity.test.ts tests/engine tests/progress tests/app-state`. Expected: all pass, no other test file changed.
- [ ] **Step 7: Run the gates.** `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm e2e` (port 3100 free). All green.
- [ ] **Step 8: Commit.**

```bash
git add src/content/play.ts src/engine/deal.ts src/engine/round.ts src/progress/progress.ts tests/purity.test.ts
git commit -m "test: enforce the purity and imports of the engine, the input rules and the progress rules"
```
