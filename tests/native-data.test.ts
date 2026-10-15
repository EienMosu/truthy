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
