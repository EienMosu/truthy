import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { DeckFileSchema, DeckIndexSchema } from "@/src/content/schema";
import { nativeDecks, type Manifest } from "@/scripts/native/decks";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const TSX = join(ROOT, "node_modules/tsx/dist/cli.mjs");
const TODAY = "2026-10-15";
const VERSION_FIELD = /"version":"\d{4}-\d{2}-\d{2}"/g;

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

// Read the way scripts/build-decks.ts reads: the catalog, and every reviewed file keyed by its name.
function readContent(): { catalog: unknown; reviewed: Record<string, unknown> } {
  const dir = join(ROOT, "content/reviewed");
  const reviewed: Record<string, unknown> = {};
  for (const name of readdirSync(dir).filter((file) => file.endsWith(".json")).sort()) {
    reviewed[basename(name, ".json")] = readJson(join(dir, name));
  }
  return { catalog: readJson(join(ROOT, "content/catalog.json")), reviewed };
}

describe("nativeDecks on the shipped content", () => {
  const made: string[] = [];
  afterEach(() => {
    for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it("writes what scripts/build-decks.ts writes, byte for byte, except the date in the index", () => {
    const out = mkdtempSync(join(tmpdir(), "truthy-native-decks-"));
    made.push(out);
    const run = spawnSync(process.execPath, [TSX, "scripts/build-decks.ts", "content", out], { cwd: ROOT, encoding: "utf8" });
    expect(run.status, run.stderr).toBe(0);
    const { files } = nativeDecks({ ...readContent(), previous: null, today: TODAY });
    const webNames = readdirSync(out).sort();
    expect(Object.keys(files).map((path) => basename(path)).sort()).toEqual(webNames);
    for (const name of webNames) {
      const web = readFileSync(join(out, name), "utf8");
      const expected = name === "index.json" ? web.replace(VERSION_FIELD, `"version":"${TODAY}"`) : web;
      expect(files[`native-data/decks/${name}`] === expected, `${name} differs from the web build`).toBe(true);
    }
  }, 120_000);

  it("covers every deck of the catalog, validates against the web schemas and keeps the card order of each reviewed file", () => {
    const content = readContent();
    const { files, deckHashes } = nativeDecks({ ...content, previous: null, today: TODAY });
    const index = DeckIndexSchema.parse(JSON.parse(files["native-data/decks/index.json"] ?? ""));
    const listed = index.areas.flatMap((area) => area.platforms.flatMap((platform) => platform.decks));
    expect(listed.length).toBeGreaterThanOrEqual(54);
    expect(Object.keys(files)).toHaveLength(listed.length + 1);
    expect(Object.keys(deckHashes)).toEqual(listed.map((entry) => entry.id));
    for (const entry of listed) {
      const deck = DeckFileSchema.parse(JSON.parse(files[`native-data/decks/${entry.id}.json`] ?? ""));
      expect(deck.hash).toBe(entry.hash);
      expect(deck.cards).toHaveLength(entry.cardCount);
      const source = content.reviewed[entry.id] as { cards: { id: string }[] };
      expect(deck.cards.map((card) => card.id)).toEqual(source.cards.map((card) => card.id));
    }
  });

  // Review Focus 2 of the plan, on the real decks.
  it("gives byte-identical files on a later day while the decks are unchanged, the index included", () => {
    const content = readContent();
    const first = nativeDecks({ ...content, previous: null, today: TODAY });
    const manifest: Manifest = { format: 1, generator: 1, deckIndexVersion: first.deckIndexVersion, deckHashes: first.deckHashes };
    const later = nativeDecks({ ...content, previous: manifest, today: "2027-03-09" });
    expect(later.deckIndexVersion).toBe(TODAY);
    expect(Object.keys(later.files)).toEqual(Object.keys(first.files));
    for (const [path, text] of Object.entries(first.files)) expect(later.files[path] === text, `${path} changed`).toBe(true);
    const index = DeckIndexSchema.parse(JSON.parse(later.files["native-data/decks/index.json"] ?? ""));
    const versions = new Set(index.areas.flatMap((area) => area.platforms.flatMap((platform) => platform.decks.map((deck) => deck.version))));
    expect([...versions]).toEqual([TODAY]);
  });
});
