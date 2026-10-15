import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decodeGoldenFile, goldenPath } from "@/scripts/native/golden/format";
import { NATIVE_FUNCTIONS, goldenProducers, metaOf, nativeFunction } from "@/scripts/native/registry";

const names = (module: string) => NATIVE_FUNCTIONS.filter((entry) => entry.module === module).map((entry) => entry.name);

describe("NATIVE_FUNCTIONS: reference 3.9 as data", () => {
  it("lists 130 functions and constants, each once", () => {
    expect(NATIVE_FUNCTIONS).toHaveLength(130);
    expect(NATIVE_FUNCTIONS.filter((entry) => entry.kind === "constant")).toHaveLength(21);
    const keys = NATIVE_FUNCTIONS.map((entry) => `${entry.module}.${entry.name}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(NATIVE_FUNCTIONS.map((entry) => goldenPath(entry.module, entry.name))).size).toBe(keys.length);
    // One file per entry also on a file system that ignores case (macOS by default).
    expect(new Set(NATIVE_FUNCTIONS.map((entry) => goldenPath(entry.module, entry.name).toLowerCase())).size).toBe(keys.length);
  });

  it("names each entry's web file after its module, and every web file and test file exists", () => {
    for (const entry of NATIVE_FUNCTIONS) {
      expect([`${entry.module}.ts`, `${entry.module}.tsx`, `${entry.module}.json`], entry.name).toContain(entry.source);
      expect(existsSync(entry.source), entry.source).toBe(true);
      expect(entry.tests.length, entry.name).toBeGreaterThan(0);
      for (const test of entry.tests) expect(existsSync(test), test).toBe(true);
    }
  });

  it("names only what its web file defines", () => {
    for (const entry of NATIVE_FUNCTIONS) {
      if (entry.source.endsWith(".json")) continue; // contrastPairs is data computed from the tokens, not a declaration
      const text = readFileSync(entry.source, "utf8");
      expect(new RegExp(`^(export )?(function|const) ${entry.name}\\b`, "m").test(text), `${entry.source}: ${entry.name}`).toBe(true);
    }
  });

  it("keeps the rows of reference 3.9 that this task's producers cover", () => {
    expect(names("src/engine/rng")).toEqual(["createRng", "shuffle"]);
    expect(names("components/format")).toEqual(["pad2"]);
    expect(names("components/Logo")).toEqual(["LogoMark"]);
    expect(names("src/app-state/theme")).toEqual(["parseTheme", "oppositeTheme", "resolveTheme", "switchTheme", "THEME_KEY"]);
    expect(nativeFunction("src/app-state/theme", "THEME_KEY").kind).toBe("constant");
  });

  it("carries the dealing internals reference 3.9 lists as ported", () => {
    expect(names("src/engine/deal")).toEqual([
      "deal", "dealChunk", "dealRanked", "uniqueById", "dealSize", "wasSeen", "wasMissed", "lastSeenAt", "oldestFirst",
      "rankByPriority", "balanceFor", "choose", "searchOverCap", "searchWithAllRules", "relaxStepByStep", "sharesGroup",
      "trueCount", "balanceAllows", "arrange", "joinOf", "runLimit", "placementCheck", "pickAnswer",
      "DEAL", "CHUNK", "SEARCH_BUDGET", "OVERDUE_AFTER_PASSES",
    ]);
  });

  it("leaves out the web-only entriesBehind and the browser storage adapter", () => {
    const all = NATIVE_FUNCTIONS.map((entry) => entry.name);
    expect(all).not.toContain("entriesBehind");
    expect(all).not.toContain("browserLocalStorage");
    expect(() => nativeFunction("components/start/StartFlow", "entriesBehind")).toThrow(
      "components/start/StartFlow.entriesBehind is not in the registry (reference 3.9)",
    );
  });

  it("gives a producer its meta from the registry", () => {
    expect(metaOf("src/engine/rng", "shuffle")).toEqual({
      module: "src/engine/rng",
      function: "shuffle",
      source: "src/engine/rng.ts",
      tests: ["tests/engine/rng.test.ts"],
    });
  });
});

describe("goldenProducers", () => {
  const files = goldenProducers().flatMap((produce) => produce());

  it("writes each file once, for a registered function, with the registry's source and tests", () => {
    const paths = files.map((file) => file.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const file of files) {
      const { meta, cases } = decodeGoldenFile(file.content);
      const entry = nativeFunction(meta.module, meta.function);
      expect(file.path).toBe(goldenPath(entry.module, entry.name));
      expect(meta.source).toBe(entry.source);
      expect(meta.tests.length, file.path).toBeGreaterThan(0);
      for (const test of meta.tests) expect(entry.tests, file.path).toContain(test);
      if (entry.kind === "constant") {
        expect(cases.map((item) => item.input), file.path).toEqual([null]);
      }
    }
  });

  it("gives the same bytes on a second run", () => {
    const again = goldenProducers().flatMap((produce) => produce());
    expect(again).toEqual(files);
  });
});
