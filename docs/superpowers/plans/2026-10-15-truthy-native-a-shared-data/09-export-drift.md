### Task 9: The export, `pnpm export:native`, the drift and coverage gate, and the first committed `native-data/`

Tasks 2 to 8 built the three producers: `resolveTokens` (task 2), `nativeDecks` (task 3) and the golden vector producers behind `goldenProducers()` with their registry `NATIVE_FUNCTIONS` (tasks 4 to 8). Nothing writes `native-data/` yet. This task composes them in `scripts/native/export.ts` into one map of repository-relative paths to file contents, adds `tests/native-data.test.ts`, which exports everything again in memory and compares it with the files under `native-data/` (spec 4.3, "Drift"), and adds `pnpm export:native`, which runs the same test with `UPDATE_NATIVE_DATA=1` so that it writes the map first. A content, token, override or engine change without a re-export then fails `pnpm test` and names the first differing file (README, review focus 1). The test also proves that it catches such a change, one mutation case per producer, and that every function and constant of reference 3.9 has a vector file. The task ends with the first export committed.

The export runs under Vitest, not `tsx`, because several functions it exports live in React component files (README, Architecture). Where the writer lives is a recorded deviation from the spec (README, "Deviations from the spec").

Builds on tasks 1 to 8: `findingsForPath` (task 1), `scripts/native-token-overrides.json` and `resolveTokens` (task 2), `nativeDecks`, `Manifest`, `manifestOf`, `manifestText` and `parseManifest` (task 3), `GoldenFile`, `NATIVE_FUNCTIONS` and `goldenProducers()` with every producer of tasks 4 to 8.

**Files:**
- Create: `scripts/native/export.ts`
- Create: `tests/scripts/native/export.test.ts` (unit tests of the export's own logic)
- Create: `tests/native-data.test.ts` (the drift and coverage gate, and the writer behind `pnpm export:native`)
- Modify: `package.json` (the `export:native` script)
- Create (generated, step 9): `native-data/manifest.json`, `native-data/decks/index.json` and the 54 deck files, `native-data/tokens/tokens.json`, `native-data/tokens/overrides.json`, `native-data/tokens/resolved.json`, one `native-data/golden/<module>.<function>.json` per entry of `NATIVE_FUNCTIONS`

**Interfaces:**
- Consumes:

```ts
// scripts/hygiene.ts (task 1)
export function findingsForPath(path: string, bytes: Uint8Array): string[]; // path relative to the repository root
// scripts/native/tokens.ts (task 2)
export interface Override { path: string; value: unknown; reason: string; evidence: string; add?: true }
export function resolveTokens(tokens: unknown, overrides: readonly Override[]): unknown;
// scripts/native/decks.ts (task 3)
export interface Manifest { format: 1; generator: 1; deckIndexVersion: string; deckHashes: Record<string, string> }
export function nativeDecks(input: { catalog: unknown; reviewed: Record<string, unknown>; previous: Manifest | null; today: string }):
  { files: Record<string, string>; deckIndexVersion: string; deckHashes: Record<string, string> };
export function manifestOf(result: { deckIndexVersion: string; deckHashes: Record<string, string> }): Manifest;
export function manifestText(manifest: Manifest): string;   // two-space JSON, decks sorted by name, final newline
export function parseManifest(raw: unknown): Manifest;      // throws Error("manifest.json: <path>: <reason>")
// scripts/native/golden/format.ts (task 4)
export interface GoldenFile { path: string; content: string }
// scripts/native/registry.ts (task 4, extended by 5 to 8)
export interface NativeFunction { module: string; name: string; source: string; tests: readonly string[]; kind: "function" | "constant" }
export const NATIVE_FUNCTIONS: readonly NativeFunction[];
export function goldenProducers(): readonly (() => GoldenFile[])[];
```

  Also consumed as data: `scripts/native-token-overrides.json` is a JSON array of `Override` objects (task 2); `src/engine/deal.ts` exports `DEAL` and the registry has its constant entry (`module: "src/engine/deal"`, `name: "DEAL"`, task 5); `design/system/tokens.json` has `color.primitive.sky-200.$value.hex`, and no override targets it.

- Produces (`scripts/native/export.ts`; task 10 and plans B and C rely on the command and the files, nothing imports the module outside this task's tests):

```ts
export const NATIVE_DATA_DIR = "native-data";
export const MANIFEST_PATH = "native-data/manifest.json";
export interface NativeInputs {
  catalog: unknown; reviewed: Record<string, unknown>; tokensText: string; overridesText: string; previous: Manifest | null;
}
export function parseManifest(text: string): Manifest;                       // the text of the file, read with task 3's parseManifest
export function readNativeInputs(root: string): NativeInputs;
export function deckFiles(inputs: NativeInputs, today: string): Map<string, string>;   // decks and the manifest
export function tokenFiles(inputs: NativeInputs): Map<string, string>;               // the three token files
export function goldenPathOf(entry: Pick<NativeFunction, "module" | "name">): string;
export function checkGoldenCoverage(registry: readonly NativeFunction[], files: readonly GoldenFile[]): void;
export function goldenFiles(): Map<string, string>;                                    // all producers, coverage checked
export function assembleNativeData(inputs: NativeInputs, today: string, golden: ReadonlyMap<string, string>): Map<string, string>;
export function nativeDataFiles(options: { root: string; today: string }): Map<string, string>; // the README's interface
export function committedNativeData(root: string): Map<string, string>;
export function differences(exported: ReadonlyMap<string, string>, committed: ReadonlyMap<string, string>): string[];
export function firstDifference(exported: ReadonlyMap<string, string>, committed: ReadonlyMap<string, string>): string | null;
export function writeNativeData(root: string, files: ReadonlyMap<string, string>): { written: number; removed: number };
```

  And in `package.json`: `"export:native": "UPDATE_NATIVE_DATA=1 vitest run tests/native-data.test.ts"`.

**Rules:**

1. **Paths and order.** Every key is relative to the repository root, starts with `native-data/` and uses `/`. `nativeDataFiles` and `assembleNativeData` return their map sorted by path (code unit order), so "the first differing file" is well defined. A path produced twice is an error (`<path> is produced twice`).
2. **Decks and the manifest.** `deckFiles` passes the content to `nativeDecks` with the committed manifest as `previous` (null before the first export) and keeps its `files` as they are; a path outside `native-data/decks/` is an error. It adds `native-data/manifest.json`, written by task 3's `manifestText(manifestOf({ deckIndexVersion, deckHashes }))`: two-space JSON, the decks sorted by name, a final newline, so a reordered catalog does not rewrite it. This is the spec's manifest (spec 4.1: "source hashes, the fixed deck index version, generator version"): `deckHashes` are the source hashes, `generator` is the generator version, `format` the layout version of `native-data/`. Tokens and golden vectors need no hash, because the drift test compares them whole.
3. **The committed manifest is read strictly.** `parseManifest` reads the text and validates it with task 3's `parseManifest` (format 1, generator 1, an ISO date, 16-hex hashes). It throws `native-data/manifest.json is not valid JSON: ...` or `native-data/manifest.json is not a format 1 manifest (<task 3's message>)` for anything else, because a manifest that is silently ignored would restamp every deck with today's date.
4. **Tokens.** `native-data/tokens/tokens.json` and `native-data/tokens/overrides.json` are byte copies of `design/system/tokens.json` and `scripts/native-token-overrides.json`. `native-data/tokens/resolved.json` is `resolveTokens(tokens, overrides)` written with two-space indentation and a final newline. An override list that is not an array of `{ path, value, reason, evidence }` fails with `scripts/native-token-overrides.json must be a list of { path, value, reason, evidence }` before `resolveTokens` runs; a stale or dangling override fails inside `resolveTokens` (task 2).
5. **Golden coverage.** `goldenFiles()` runs every producer and calls `checkGoldenCoverage(NATIVE_FUNCTIONS, files)`, which collects every problem and throws one error starting `golden vectors: `, the problems joined with `; `:
   - `no golden vector file for <module>.<name> (<path>)` for a registry entry without its file (spec 4.3: "The export fails if a 3.9 function has no vector file");
   - `<path> is produced twice`;
   - `<path> does not name format 1, module <module> and function <name>` when the file's `format`, `module` or `function` do not match its entry;
   - `<path> has no cases`;
   - `<path> is a constant and needs exactly one case with a null input` (README, golden format);
   - `<path> belongs to no entry of NATIVE_FUNCTIONS` for a file no entry asks for.
   The path of an entry is task 4's `goldenPath(module, name)` (`goldenPathOf`): `native-data/golden/<module with "/" replaced by ".">.<name>.json`, and `src.engine.deal.DEAL.constant.json` for the one constant whose path would clash with a function's on a file system that ignores case.
6. **What counts as committed.** `committedNativeData(root)` reads every file under `native-data/` in the working tree, so the gate also passes between an export and `git add`. Names that start with `.` (a Finder `.DS_Store`) are skipped; `native-data/` never contains such a name.
7. **Differences.** `differences` lists one line per differing path in path order: `<path>: exported but not committed`, `<path>: committed but no longer exported` (a deck that left the catalog), or `<path>: the committed file differs from the export at line <n>` (the line of the first differing character; deck files and the index are one line, as the web build writes them). `firstDifference` is the first line or `null`.
8. **Writing.** `writeNativeData` refuses any path outside `native-data/` or containing a `..` segment before it writes anything, writes only files whose content changed (creating folders), and deletes files under `native-data/` that the export no longer produces (dot names left alone). It returns the counts.
9. **The date.** The test passes `today = new Date().toISOString().slice(0, 10)`, the UTC date, as `scripts/build-decks.ts` stamps its builds. It only matters when a deck hash changed or on the first export; otherwise the recorded `deckIndexVersion` is kept (README, review focus 2).
10. **The gate's tests.** With `UPDATE_NATIVE_DATA=1` the test writes the export in `beforeAll` and prints `export:native: <n> files in native-data/, <w> written, <r> removed` to stdout (Vitest keeps `console.log` of passing tests to itself, so it writes to `process.stdout`). It then reads the inputs again, so the manifest just written is the `previous` of every later export in the file. The comparisons run in both modes.
11. **Mutation cases** (README, review focus 1), each one value changed in memory, never on disk:
    - a card text: the statement of the first card of the first reviewed deck in name order (`angular-fundamentals` today) gets a different first letter; exported on another day, exactly that deck file, `decks/index.json` and `manifest.json` differ, in that order;
    - a token value: `color.primitive.sky-200.$value.hex` becomes `#000000`; exactly `tokens/resolved.json` and `tokens/tokens.json` differ;
    - an override: the first override's `value` becomes a string; exactly `tokens/overrides.json` and `tokens/resolved.json` differ;
    - an engine constant: `DEAL` of `src/engine/deal.ts` gets `maxRun: 4` through `vi.doMock`, and a fresh import of the export recomputes the vectors; `golden/src.engine.deal.DEAL.constant.json` differs and every difference is under `golden/`.

**Steps:**

- [ ] **Step 1: Write the unit tests of the export's own logic.**

Create `tests/scripts/native/export.test.ts`:

```ts
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  checkGoldenCoverage,
  committedNativeData,
  differences,
  firstDifference,
  goldenPathOf,
  parseManifest,
  readNativeInputs,
  tokenFiles,
  writeNativeData,
} from "@/scripts/native/export";
import type { GoldenFile } from "@/scripts/native/golden/format";
import type { NativeFunction } from "@/scripts/native/registry";
import { resolveTokens, type Override } from "@/scripts/native/tokens";

const ROOT = join(import.meta.dirname, "..", "..", "..");

describe("goldenPathOf", () => {
  it("names a vector file after the module path with dots and the function", () => {
    expect(goldenPathOf({ module: "src/engine/deal", name: "dealChunk" })).toBe("native-data/golden/src.engine.deal.dealChunk.json");
    expect(goldenPathOf({ module: "components/FlightPath", name: "pointAt" })).toBe("native-data/golden/components.FlightPath.pointAt.json");
    expect(goldenPathOf({ module: "src/engine/deal", name: "DEAL" })).toBe("native-data/golden/src.engine.deal.DEAL.constant.json");
  });
});

describe("parseManifest", () => {
  it("reads a format 1 manifest", () => {
    const text = JSON.stringify({ format: 1, generator: 1, deckIndexVersion: "2026-10-15", deckHashes: { "aws-clf-c02": "0123456789abcdef" } });
    expect(parseManifest(text)).toEqual({ format: 1, generator: 1, deckIndexVersion: "2026-10-15", deckHashes: { "aws-clf-c02": "0123456789abcdef" } });
  });

  it("rejects anything else, so a broken manifest never restamps the decks silently", () => {
    const bad = [
      "{",
      "null",
      JSON.stringify({ format: 2, generator: 1, deckIndexVersion: "2026-10-15", deckHashes: {} }),
      JSON.stringify({ format: 1, deckIndexVersion: "2026-10-15", deckHashes: {} }),
      JSON.stringify({ format: 1, generator: 1, deckHashes: {} }),
      JSON.stringify({ format: 1, generator: 1, deckIndexVersion: "2026-10-15" }),
      JSON.stringify({ format: 1, generator: 1, deckIndexVersion: "2026-10-15", deckHashes: [] }),
      JSON.stringify({ format: 1, generator: 1, deckIndexVersion: "2026-10-15", deckHashes: { a: 1 } }),
    ];
    for (const text of bad) expect(() => parseManifest(text), text).toThrow(/native-data\/manifest\.json/);
  });
});

function entry(module: string, name: string, kind: NativeFunction["kind"] = "function"): NativeFunction {
  return { module, name, source: `${module}.ts`, tests: [], kind };
}

function file(module: string, name: string, cases: unknown[]): GoldenFile {
  const content = `${JSON.stringify({ format: 1, module, function: name, source: `${module}.ts`, tests: [], cards: {}, cases }, null, 2)}\n`;
  return { path: goldenPathOf({ module, name }), content };
}

describe("checkGoldenCoverage", () => {
  const registry = [entry("src/engine/rng", "createRng"), entry("src/engine/deal", "DEAL", "constant")];
  const rng = file("src/engine/rng", "createRng", [{ name: "seed 1", input: { seed: 1 }, output: [0.5] }]);
  const deal = file("src/engine/deal", "DEAL", [{ name: "value", input: null, output: { maxRun: 3 } }]);

  it("accepts one vector file with cases per registry entry", () => {
    expect(() => checkGoldenCoverage(registry, [rng, deal])).not.toThrow();
  });

  it("fails when a function of reference 3.9 has no vector file, naming it", () => {
    expect(() => checkGoldenCoverage(registry, [rng])).toThrow(
      "golden vectors: no golden vector file for src/engine/deal.DEAL (native-data/golden/src.engine.deal.DEAL.constant.json)",
    );
  });

  it("fails on a vector file without cases, or a constant without exactly one case of null input", () => {
    expect(() => checkGoldenCoverage(registry, [file("src/engine/rng", "createRng", []), deal])).toThrow(
      "native-data/golden/src.engine.rng.createRng.json has no cases",
    );
    const twoCases = file("src/engine/deal", "DEAL", [
      { name: "a", input: null, output: 1 },
      { name: "b", input: null, output: 2 },
    ]);
    expect(() => checkGoldenCoverage(registry, [rng, twoCases])).toThrow("is a constant and needs exactly one case with a null input");
    const withInput = file("src/engine/deal", "DEAL", [{ name: "a", input: {}, output: 1 }]);
    expect(() => checkGoldenCoverage(registry, [rng, withInput])).toThrow("is a constant and needs exactly one case with a null input");
  });

  it("fails on a file that names another function than its path", () => {
    const misnamed = { path: rng.path, content: file("src/engine/rng", "shuffle", [{ name: "a", input: {}, output: [] }]).content };
    expect(() => checkGoldenCoverage(registry, [misnamed, deal])).toThrow(
      "native-data/golden/src.engine.rng.createRng.json does not name format 1, module src/engine/rng and function createRng",
    );
  });

  it("fails on a file produced twice and on a file no registry entry asks for", () => {
    expect(() => checkGoldenCoverage(registry, [rng, rng, deal])).toThrow("native-data/golden/src.engine.rng.createRng.json is produced twice");
    const extra = file("src/engine/rng", "shuffle", [{ name: "a", input: {}, output: [] }]);
    expect(() => checkGoldenCoverage(registry, [rng, deal, extra])).toThrow(
      "native-data/golden/src.engine.rng.shuffle.json belongs to no entry of NATIVE_FUNCTIONS",
    );
  });
});

describe("tokenFiles", () => {
  it("copies tokens.json and the override list byte for byte and writes the resolved tokens", () => {
    const inputs = readNativeInputs(ROOT);
    const files = tokenFiles(inputs);
    expect([...files.keys()]).toEqual([
      "native-data/tokens/tokens.json",
      "native-data/tokens/overrides.json",
      "native-data/tokens/resolved.json",
    ]);
    expect(files.get("native-data/tokens/tokens.json")).toBe(readFileSync(join(ROOT, "design/system/tokens.json"), "utf8"));
    expect(files.get("native-data/tokens/overrides.json")).toBe(readFileSync(join(ROOT, "scripts/native-token-overrides.json"), "utf8"));
    const overrides = JSON.parse(inputs.overridesText) as Override[];
    const resolved = resolveTokens(JSON.parse(inputs.tokensText), overrides);
    expect(files.get("native-data/tokens/resolved.json")).toBe(`${JSON.stringify(resolved, null, 2)}\n`);
  });

  it("rejects an override list that is not a list of { path, value, reason, evidence }", () => {
    const inputs = readNativeInputs(ROOT);
    for (const overridesText of ["{}", JSON.stringify([{ path: "size.max-width.$value", reason: "r", evidence: "e" }])]) {
      expect(() => tokenFiles({ ...inputs, overridesText })).toThrow("scripts/native-token-overrides.json must be a list");
    }
  });
});

describe("differences and firstDifference", () => {
  const a = new Map([
    ["native-data/a.json", "{\n  \"x\": 1\n}\n"],
    ["native-data/b.json", "{}\n"],
  ]);

  it("find nothing when the export and the committed files agree", () => {
    expect(differences(a, new Map(a))).toEqual([]);
    expect(firstDifference(a, new Map(a))).toBeNull();
  });

  it("name every differing path in path order, with the line of a changed file", () => {
    const committed = new Map([
      ["native-data/a.json", "{\n  \"x\": 2\n}\n"],
      ["native-data/c.json", "{}\n"],
    ]);
    expect(differences(a, committed)).toEqual([
      "native-data/a.json: the committed file differs from the export at line 2",
      "native-data/b.json: exported but not committed",
      "native-data/c.json: committed but no longer exported",
    ]);
    expect(firstDifference(a, committed)).toBe("native-data/a.json: the committed file differs from the export at line 2");
  });
});

describe("writeNativeData and committedNativeData", () => {
  const made: string[] = [];
  afterEach(() => {
    for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  function scratch(): string {
    const dir = mkdtempSync(join(tmpdir(), "truthy-native-data-"));
    made.push(dir);
    return dir;
  }

  it("writes the files, then reads back the same map", () => {
    const root = scratch();
    expect(committedNativeData(root)).toEqual(new Map());
    const files = new Map([
      ["native-data/decks/index.json", "{}"],
      ["native-data/golden/src.engine.rng.createRng.json", "{\n}\n"],
      ["native-data/manifest.json", "{}\n"],
    ]);
    expect(writeNativeData(root, files)).toEqual({ written: 3, removed: 0 });
    expect(committedNativeData(root)).toEqual(files);
    expect(writeNativeData(root, files)).toEqual({ written: 0, removed: 0 });
  });

  it("removes files the export no longer produces and ignores dot files", () => {
    const root = scratch();
    mkdirSync(join(root, "native-data", "decks"), { recursive: true });
    writeFileSync(join(root, "native-data", "decks", "gone.json"), "{}");
    writeFileSync(join(root, "native-data", ".DS_Store"), "finder");
    expect([...committedNativeData(root).keys()]).toEqual(["native-data/decks/gone.json"]);
    expect(writeNativeData(root, new Map([["native-data/manifest.json", "{}\n"]]))).toEqual({ written: 1, removed: 1 });
    expect(existsSync(join(root, "native-data", "decks", "gone.json"))).toBe(false);
    expect(existsSync(join(root, "native-data", ".DS_Store"))).toBe(true);
  });

  it("refuses a path outside native-data/", () => {
    const root = scratch();
    expect(() => writeNativeData(root, new Map([["package.json", "{}"]]))).toThrow("package.json is outside native-data/");
    expect(() => writeNativeData(root, new Map([["native-data/../x.json", "{}"]]))).toThrow("is outside native-data/");
    expect(existsSync(join(root, "native-data"))).toBe(false);
  });
});
```

- [ ] **Step 2: Run the unit tests and watch them fail.**

```bash
npx -y pnpm@10.34.0 vitest run tests/scripts/native/export.test.ts
```

Expected: the suite fails before any test runs, with `Error: Cannot find package '@/scripts/native/export' imported from <repository root>/tests/scripts/native/export.test.ts`, then `Test Files  1 failed (1)` and `Tests  no tests`.

- [ ] **Step 3: Write the export.**

Create `scripts/native/export.ts`:

```ts
// Builds native-data/: the decks with the fixed index version, the tokens with the code's overrides applied, and
// the golden vectors computed by the TypeScript code. The native apps read nothing else from the web repository.
// tests/native-data.test.ts compares this export with the committed files (the drift gate) and, with
// UPDATE_NATIVE_DATA=1 (`pnpm export:native`), writes it. Every path here is relative to the repository root and
// uses "/" separators.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { manifestOf, manifestText, nativeDecks, parseManifest as parseManifestValue, type Manifest } from "./decks";
import { goldenPath, type GoldenFile } from "./golden/format";
import { NATIVE_FUNCTIONS, goldenProducers, type NativeFunction } from "./registry";
import { resolveTokens, type Override } from "./tokens";

export const NATIVE_DATA_DIR = "native-data";
export const MANIFEST_PATH = "native-data/manifest.json";

// What the export reads from the repository, kept as the files' text where the export copies a file as it is.
export interface NativeInputs {
  catalog: unknown; // content/catalog.json, parsed
  reviewed: Record<string, unknown>; // content/reviewed/<deck id>.json, parsed, keyed by deck id
  tokensText: string; // design/system/tokens.json, as it is
  overridesText: string; // scripts/native-token-overrides.json, as it is
  previous: Manifest | null; // the committed native-data/manifest.json, or null before the first export
}

function readJson(root: string, path: string): unknown {
  const text = readFileSync(join(root, path), "utf8");
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${path} is not valid JSON: ${(error as Error).message}`);
  }
}

// The manifest a previous export committed, read with task 3's parseManifest. Anything that is not a format 1
// manifest is an error, because a silently ignored manifest would restamp every deck with today's date.
export function parseManifest(text: string): Manifest {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw new Error(`${MANIFEST_PATH} is not valid JSON: ${(error as Error).message}`);
  }
  try {
    return parseManifestValue(raw);
  } catch (error) {
    throw new Error(`${MANIFEST_PATH} is not a format 1 manifest (${(error as Error).message})`);
  }
}

export function readNativeInputs(root: string): NativeInputs {
  const reviewedDir = join(root, "content", "reviewed");
  const reviewed: Record<string, unknown> = {};
  for (const name of readdirSync(reviewedDir).filter((file) => file.endsWith(".json")).sort()) {
    reviewed[basename(name, ".json")] = readJson(root, `content/reviewed/${name}`);
  }
  const manifestFile = join(root, MANIFEST_PATH);
  return {
    catalog: readJson(root, "content/catalog.json"),
    reviewed,
    tokensText: readFileSync(join(root, "design", "system", "tokens.json"), "utf8"),
    overridesText: readFileSync(join(root, "scripts", "native-token-overrides.json"), "utf8"),
    previous: existsSync(manifestFile) ? parseManifest(readFileSync(manifestFile, "utf8")) : null,
  };
}

// The JSON the export writes itself: two-space indentation and a final newline. Copies and deck files keep the
// bytes of their source.
function pretty(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

// The decks as the web build writes them, with the fixed index version, and the manifest that records it.
export function deckFiles(inputs: NativeInputs, today: string): Map<string, string> {
  const { files, deckIndexVersion, deckHashes } = nativeDecks({
    catalog: inputs.catalog,
    reviewed: inputs.reviewed,
    previous: inputs.previous,
    today,
  });
  const out = new Map<string, string>();
  for (const [path, content] of Object.entries(files)) {
    if (!path.startsWith(`${NATIVE_DATA_DIR}/decks/`)) throw new Error(`nativeDecks returned ${path}, outside native-data/decks/`);
    out.set(path, content);
  }
  out.set(MANIFEST_PATH, manifestText(manifestOf({ deckIndexVersion, deckHashes })));
  return out;
}

function parseOverrides(text: string): Override[] {
  const raw: unknown = JSON.parse(text);
  const valid =
    Array.isArray(raw) &&
    raw.every(
      (item: unknown) =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as Override).path === "string" &&
        Object.hasOwn(item, "value") &&
        typeof (item as Override).reason === "string" &&
        typeof (item as Override).evidence === "string",
    );
  if (!valid) throw new Error("scripts/native-token-overrides.json must be a list of { path, value, reason, evidence }");
  return raw as Override[];
}

// tokens.json and the override list as they are, and the tokens with every override applied.
export function tokenFiles(inputs: NativeInputs): Map<string, string> {
  const resolved = resolveTokens(JSON.parse(inputs.tokensText), parseOverrides(inputs.overridesText));
  return new Map([
    [`${NATIVE_DATA_DIR}/tokens/tokens.json`, inputs.tokensText],
    [`${NATIVE_DATA_DIR}/tokens/overrides.json`, inputs.overridesText],
    [`${NATIVE_DATA_DIR}/tokens/resolved.json`, pretty(resolved)],
  ]);
}

// "native-data/golden/<module with / as .>.<name>.json", as task 4's goldenPath writes it (with its one case clash).
export function goldenPathOf(entry: Pick<NativeFunction, "module" | "name">): string {
  return goldenPath(entry.module, entry.name);
}

// The export fails unless every registry entry has exactly one vector file that names it and holds at least one
// case (a constant: exactly one case, with a null input), and every vector file belongs to a registry entry.
export function checkGoldenCoverage(registry: readonly NativeFunction[], files: readonly GoldenFile[]): void {
  const problems: string[] = [];
  const byPath = new Map<string, GoldenFile>();
  for (const file of files) {
    if (byPath.has(file.path)) problems.push(`${file.path} is produced twice`);
    byPath.set(file.path, file);
  }
  const expected = new Set<string>();
  for (const entry of registry) {
    const path = goldenPathOf(entry);
    expected.add(path);
    const file = byPath.get(path);
    if (file === undefined) {
      problems.push(`no golden vector file for ${entry.module}.${entry.name} (${path})`);
      continue;
    }
    const body = JSON.parse(file.content) as { format?: unknown; module?: unknown; function?: unknown; cases?: unknown };
    const cases = Array.isArray(body.cases) ? (body.cases as { input?: unknown }[]) : [];
    if (body.format !== 1 || body.module !== entry.module || body.function !== entry.name) {
      problems.push(`${path} does not name format 1, module ${entry.module} and function ${entry.name}`);
    } else if (cases.length === 0) {
      problems.push(`${path} has no cases`);
    } else if (entry.kind === "constant" && (cases.length !== 1 || cases[0]?.input !== null)) {
      problems.push(`${path} is a constant and needs exactly one case with a null input`);
    }
  }
  for (const path of byPath.keys()) {
    if (!expected.has(path)) problems.push(`${path} belongs to no entry of NATIVE_FUNCTIONS`);
  }
  if (problems.length > 0) throw new Error(`golden vectors: ${problems.join("; ")}`);
}

// Every producer's vector files, checked against the registry of reference 3.9.
export function goldenFiles(): Map<string, string> {
  const files = goldenProducers().flatMap((produce) => produce());
  checkGoldenCoverage(NATIVE_FUNCTIONS, files);
  return new Map(files.map((file) => [file.path, file.content]));
}

function sorted(entries: Iterable<[string, string]>): Map<string, string> {
  return new Map([...entries].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

// The whole export from inputs already read and golden files already computed, in path order.
export function assembleNativeData(inputs: NativeInputs, today: string, golden: ReadonlyMap<string, string>): Map<string, string> {
  const all = new Map<string, string>();
  for (const part of [deckFiles(inputs, today), tokenFiles(inputs), golden]) {
    for (const [path, content] of part) {
      if (all.has(path)) throw new Error(`${path} is produced twice`);
      all.set(path, content);
    }
  }
  return sorted(all);
}

export function nativeDataFiles(options: { root: string; today: string }): Map<string, string> {
  return assembleNativeData(readNativeInputs(options.root), options.today, goldenFiles());
}

// Names starting with "." (a Finder .DS_Store) are never part of native-data/.
function walk(root: string, relative: string, out: [string, string][]): void {
  for (const entry of readdirSync(join(root, relative), { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const path = `${relative}/${entry.name}`;
    if (entry.isDirectory()) walk(root, path, out);
    else if (entry.isFile()) out.push([path, readFileSync(join(root, path), "utf8")]);
  }
}

// The files under native-data/ in the working tree, in path order (empty before the first export).
export function committedNativeData(root: string): Map<string, string> {
  const out: [string, string][] = [];
  if (existsSync(join(root, NATIVE_DATA_DIR))) walk(root, NATIVE_DATA_DIR, out);
  return sorted(out);
}

function lineOfFirstDifference(a: string, b: string): number {
  let index = 0;
  while (index < a.length && index < b.length && a[index] === b[index]) index += 1;
  return a.slice(0, index).split("\n").length;
}

// One line per path that differs, in path order.
export function differences(exported: ReadonlyMap<string, string>, committed: ReadonlyMap<string, string>): string[] {
  const paths = [...new Set([...exported.keys(), ...committed.keys()])].sort();
  const found: string[] = [];
  for (const path of paths) {
    const want = exported.get(path);
    const have = committed.get(path);
    if (want === have) continue;
    if (have === undefined) found.push(`${path}: exported but not committed`);
    else if (want === undefined) found.push(`${path}: committed but no longer exported`);
    else found.push(`${path}: the committed file differs from the export at line ${lineOfFirstDifference(want, have)}`);
  }
  return found;
}

export function firstDifference(exported: ReadonlyMap<string, string>, committed: ReadonlyMap<string, string>): string | null {
  return differences(exported, committed)[0] ?? null;
}

// Writes the export under root and deletes the files under native-data/ it no longer produces. Files whose
// content is already right are not touched. Returns how many files were written and removed.
export function writeNativeData(root: string, files: ReadonlyMap<string, string>): { written: number; removed: number } {
  for (const path of files.keys()) {
    if (!path.startsWith(`${NATIVE_DATA_DIR}/`) || path.split("/").includes("..")) throw new Error(`${path} is outside native-data/`);
  }
  const committed = committedNativeData(root);
  let written = 0;
  let removed = 0;
  for (const [path, content] of files) {
    if (committed.get(path) === content) continue;
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
    written += 1;
  }
  for (const path of committed.keys()) {
    if (files.has(path)) continue;
    rmSync(join(root, path));
    removed += 1;
  }
  return { written, removed };
}
```

- [ ] **Step 4: Run the unit tests and the typecheck.**

```bash
npx -y pnpm@10.34.0 vitest run tests/scripts/native/export.test.ts
npx -y pnpm@10.34.0 typecheck
```

Expected: `Test Files  1 passed (1)`, `Tests  15 passed (15)`; the typecheck prints only `> tsc --noEmit` and exits 0.

- [ ] **Step 5: Commit.**

```bash
git add scripts/native/export.ts tests/scripts/native/export.test.ts
git commit -m "feat: assemble native-data from the decks, the resolved tokens and the golden vectors"
```

- [ ] **Step 6: Write the drift and coverage gate.**

Create `tests/native-data.test.ts`:

```ts
import { join } from "node:path";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { findingsForPath } from "@/scripts/hygiene";
import {
  assembleNativeData,
  committedNativeData,
  differences,
  firstDifference,
  goldenFiles,
  goldenPathOf,
  nativeDataFiles,
  parseManifest,
  readNativeInputs,
  writeNativeData,
  type NativeInputs,
} from "@/scripts/native/export";
import { NATIVE_FUNCTIONS } from "@/scripts/native/registry";

// The drift gate of spec 4.3. native-data/ is what the native apps build from: the decks, the tokens with the
// code's overrides, and the golden vectors computed by the TypeScript code. This test exports everything again in
// memory and compares it with the committed files, so a content, token, override or engine change without a
// re-export fails `pnpm test`, naming the first file that differs. `pnpm export:native` runs this same file with
// UPDATE_NATIVE_DATA=1, which writes the export before the comparisons.
const ROOT = join(import.meta.dirname, "..");
const UPDATE = process.env.UPDATE_NATIVE_DATA === "1";
const TODAY = new Date().toISOString().slice(0, 10);
const OTHER_DAY = "2099-12-31";
const EXPORT_MS = 120_000;

let inputs: NativeInputs;
let golden: Map<string, string>;
let exported: Map<string, string>;
let committed: Map<string, string>;

beforeAll(() => {
  exported = nativeDataFiles({ root: ROOT, today: TODAY });
  if (UPDATE) {
    const { written, removed } = writeNativeData(ROOT, exported);
    // Vitest keeps console output of passing tests to itself; the summary goes to stdout directly.
    process.stdout.write(`export:native: ${exported.size} files in native-data/, ${written} written, ${removed} removed\n`);
  }
  // Read after a write, so the manifest just written is the one later exports keep the deck index version from.
  inputs = readNativeInputs(ROOT);
  golden = new Map([...exported].filter(([path]) => path.startsWith("native-data/golden/")));
  committed = committedNativeData(ROOT);
}, EXPORT_MS);

function pathOf(difference: string): string {
  return difference.slice(0, difference.indexOf(": "));
}

describe("native-data/", () => {
  it("matches a fresh export (after a content, token, override or engine change, run pnpm export:native and commit native-data/)", () => {
    expect(firstDifference(exported, committed)).toBeNull();
  });

  it("holds the index and one file per shipped deck, the manifest and the three token files", () => {
    const manifest = parseManifest(exported.get("native-data/manifest.json") ?? "");
    const deckIds = Object.keys(manifest.deckHashes);
    expect(deckIds.length).toBe(Object.keys(inputs.reviewed).length);
    const decks = [...exported.keys()].filter((path) => path.startsWith("native-data/decks/"));
    expect(decks.sort()).toEqual(["index.json", ...deckIds.map((id) => `${id}.json`)].map((name) => `native-data/decks/${name}`).sort());
    const tokens = [...exported.keys()].filter((path) => path.startsWith("native-data/tokens/"));
    expect(tokens).toEqual(["native-data/tokens/overrides.json", "native-data/tokens/resolved.json", "native-data/tokens/tokens.json"]);
  });

  it("has a vector file for every function and constant of reference 3.9 and nothing else under golden/", () => {
    const names = NATIVE_FUNCTIONS.map((entry) => entry.name);
    expect(names).not.toContain("entriesBehind");
    expect(names).not.toContain("browserLocalStorage");
    const wanted = NATIVE_FUNCTIONS.map(goldenPathOf).sort();
    const present = [...exported.keys()].filter((path) => path.startsWith("native-data/golden/"));
    expect(present).toEqual(wanted);
  });

  it(
    "is byte-identical when exported again, also on another day while no deck changed",
    () => {
      expect(differences(assembleNativeData(inputs, OTHER_DAY, goldenFiles()), exported)).toEqual([]);
    },
    EXPORT_MS,
  );

  it("carries nothing the public-repository hygiene rules reject", () => {
    const found = [...exported].flatMap(([path, content]) =>
      findingsForPath(path, Buffer.from(content, "utf8")).map((finding) => `${path}: ${finding}`),
    );
    expect(found).toEqual([]);
  });
});

// Each producer, changed by one value without a re-export, must fail the gate above and name the file.
describe("the drift gate catches a change without a re-export", () => {
  afterEach(() => {
    vi.doUnmock("@/src/engine/deal");
    vi.resetModules();
  });

  it("a card text", () => {
    const changed = structuredClone(inputs);
    const deckId = Object.keys(changed.reviewed).sort()[0] ?? "";
    const card = (changed.reviewed[deckId] as { cards: { statement: string }[] }).cards[0];
    if (card === undefined) throw new Error(`content/reviewed/${deckId}.json has no cards`);
    card.statement = (card.statement.startsWith("Z") ? "Y" : "Z") + card.statement.slice(1);
    const found = differences(assembleNativeData(changed, OTHER_DAY, golden), committed);
    expect(found).toEqual([
      `native-data/decks/${deckId}.json: the committed file differs from the export at line 1`,
      "native-data/decks/index.json: the committed file differs from the export at line 1",
      "native-data/manifest.json: the committed file differs from the export at line 4",
    ]);
  });

  it("a token value", () => {
    const tokens = JSON.parse(inputs.tokensText);
    tokens.color.primitive["sky-200"].$value.hex = "#000000";
    const changed = { ...inputs, tokensText: `${JSON.stringify(tokens, null, 2)}\n` };
    const found = differences(assembleNativeData(changed, TODAY, golden), committed);
    expect(found.map(pathOf)).toEqual(["native-data/tokens/resolved.json", "native-data/tokens/tokens.json"]);
  });

  it("an override", () => {
    const overrides = JSON.parse(inputs.overridesText) as { value: unknown }[];
    const first = overrides[0];
    if (first === undefined) throw new Error("scripts/native-token-overrides.json is empty");
    first.value = "changed by the drift test";
    const changed = { ...inputs, overridesText: `${JSON.stringify(overrides, null, 2)}\n` };
    const found = differences(assembleNativeData(changed, TODAY, golden), committed);
    expect(found.map(pathOf)).toEqual(["native-data/tokens/overrides.json", "native-data/tokens/resolved.json"]);
  });

  it(
    "an engine constant",
    async () => {
      vi.resetModules();
      vi.doMock("@/src/engine/deal", async (importOriginal) => {
        const actual = await importOriginal<typeof import("@/src/engine/deal")>();
        return { ...actual, DEAL: { ...actual.DEAL, maxRun: 4 } };
      });
      const fresh = await import("@/scripts/native/export");
      const found = differences(assembleNativeData(inputs, TODAY, fresh.goldenFiles()), committed);
      expect(found.map(pathOf)).toContain("native-data/golden/src.engine.deal.DEAL.constant.json");
      expect(found.every((difference) => pathOf(difference).startsWith("native-data/golden/"))).toBe(true);
    },
    EXPORT_MS,
  );
});
```

- [ ] **Step 7: Run the gate before any export and watch it fail.**

```bash
npx -y pnpm@10.34.0 vitest run tests/native-data.test.ts
```

Expected: `Tests  6 failed | 3 passed (9)`. The first failure is `matches a fresh export (...)` with `AssertionError: expected 'native-data/decks/angular-fundamental…' to be null` and the received value `"native-data/decks/angular-fundamentals.json: exported but not committed"`. "is byte-identical when exported again, also on another day" fails because there is no manifest yet, so the other day stamps the deck index; the four mutation cases fail because every exported path is missing from the empty `native-data/`. The three passing tests are the file inventory, the coverage test and the hygiene test, which read only the export.

- [ ] **Step 8: Add the `export:native` script.**

In `package.json`, under `"scripts"`, replace

```json
    "typecheck": "tsc --noEmit",
    "e2e": "playwright test"
```

with

```json
    "typecheck": "tsc --noEmit",
    "export:native": "UPDATE_NATIVE_DATA=1 vitest run tests/native-data.test.ts",
    "e2e": "playwright test"
```

- [ ] **Step 9: Run the first export.**

First print the size N of the registry, then export:

```bash
npx -y pnpm@10.34.0 exec tsx -e 'import("@/scripts/native/registry").then((m) => console.log(m.NATIVE_FUNCTIONS.length))'
npx -y pnpm@10.34.0 export:native
ls native-data/decks | wc -l
ls native-data/tokens
ls native-data/golden | wc -l
head -4 native-data/manifest.json
```

Expected:
- the first command prints N, the number of entries tasks 4 to 8 put into `NATIVE_FUNCTIONS`;
- the export prints `export:native: <59 + N> files in native-data/, <59 + N> written, 0 removed` (54 deck files, the index, the manifest, 3 token files and N vector files), then `Test Files  1 passed (1)` and `Tests  9 passed (9)`;
- `55`; `overrides.json  resolved.json  tokens.json`; N;
- `{`, `  "format": 1,`, `  "generator": 1,`, `  "deckIndexVersion": "<today's UTC date>",`.

If the export throws `golden vectors: no golden vector file for ...`, a task of 4 to 8 left a registry entry without a producer: stop and report, do not add the file by hand.

- [ ] **Step 10: Export again and check that nothing changes.**

```bash
npx -y pnpm@10.34.0 export:native
npx -y pnpm@10.34.0 vitest run tests/native-data.test.ts tests/scripts/native/export.test.ts
```

Expected: `export:native: <59 + N> files in native-data/, 0 written, 0 removed` and `Tests  9 passed (9)`; then `Test Files  2 passed (2)`, `Tests  24 passed (24)`.

- [ ] **Step 11: See the gate fail on a real content change, then undo it.**

```bash
node -e 'const fs = require("node:fs"); const p = "content/reviewed/angular-fundamentals.json"; const d = JSON.parse(fs.readFileSync(p, "utf8")); d.cards[0].statement = "Z" + d.cards[0].statement.slice(1); fs.writeFileSync(p, JSON.stringify(d, null, 2) + "\n");'
npx -y pnpm@10.34.0 vitest run tests/native-data.test.ts
git restore content/reviewed/angular-fundamentals.json
git status --short content
npx -y pnpm@10.34.0 vitest run tests/native-data.test.ts
```

Expected from the first test run: `Tests  5 failed | 4 passed (9)`, the first failure `matches a fresh export (...)` with the received value `"native-data/decks/angular-fundamentals.json: the committed file differs from the export at line 1"`. The other day's export, the token, override and engine cases fail too, because the drifted deck adds to their differences. No golden file carries that card (the first chunk of `angular-fundamentals` at seed 0 does not deal it), so the card text case passes. `git status --short content` prints nothing, and the last run gives `Tests  9 passed (9)`.

- [ ] **Step 12: Run every gate and the hygiene scan over the staged export.**

```bash
npx -y pnpm@10.34.0 test
npx -y pnpm@10.34.0 typecheck
git add package.json tests/native-data.test.ts native-data
git diff --cached --name-only | wc -l
npx -y pnpm@10.34.0 vitest run tests/repo-hygiene.test.ts
```

Expected: every test file passes, `Test Files  184 passed (184)` and `Tests  3584 passed (3584)` (task 8's 182 and 3560 plus 2 files and 24 tests); the typecheck exits 0; `61 + N` staged paths (`package.json`, the test and the `59 + N` files of `native-data/`); the hygiene test passes, now scanning `native-data/` as tracked files under the native-scoped rules of task 1.

- [ ] **Step 13: Commit.**

```bash
git commit -m "feat: export native-data with pnpm export:native and fail the tests when it drifts"
git status --short
```

Expected: `git status --short` prints nothing.
