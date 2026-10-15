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
