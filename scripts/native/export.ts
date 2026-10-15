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
