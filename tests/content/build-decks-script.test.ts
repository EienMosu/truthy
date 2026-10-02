import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { DeckIndexSchema } from "@/src/content/schema";

// scripts/build-decks.ts writes public/decks/. It starts from an empty folder, so a deck that left the catalog is
// not served at /decks/<id>.json any more (a reused working copy, a local next start).
describe("scripts/build-decks.ts", () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const tsx = join(root, "node_modules/tsx/dist/cli.mjs");

  const made: string[] = [];
  afterEach(() => {
    for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it("removes a file of an earlier build from the output folder and writes the index", () => {
    const out = mkdtempSync(join(tmpdir(), "truthy-decks-"));
    made.push(out);
    mkdirSync(join(out, "nested"));
    writeFileSync(join(out, "dropped-deck.json"), "{}");
    writeFileSync(join(out, "nested", "old.json"), "{}");
    const result = spawnSync(process.execPath, [tsx, "scripts/build-decks.ts", "content", out], { cwd: root, encoding: "utf8" });
    expect(result.status, result.stderr).toBe(0);
    expect(existsSync(join(out, "dropped-deck.json"))).toBe(false);
    expect(existsSync(join(out, "nested"))).toBe(false);
    expect(existsSync(join(out, "index.json"))).toBe(true);
    const index = DeckIndexSchema.parse(JSON.parse(readFileSync(join(out, "index.json"), "utf8")));
    const listed = index.areas.flatMap((area) => area.platforms.flatMap((platform) => platform.decks.map((deck) => `${deck.id}.json`)));
    expect(readdirSync(out).sort()).toEqual(["index.json", ...listed].sort());
  }, 60_000);
});
