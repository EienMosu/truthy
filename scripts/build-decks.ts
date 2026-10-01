// Builds public/decks/ from content/catalog.json and content/reviewed/*.json. Runs before `next build`.
// Usage: tsx scripts/build-decks.ts [content dir] [output dir]   (defaults: content, public/decks)
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { DeckBuildError, buildDecks } from "@/src/content/build";

const [contentArg, outArg] = process.argv.slice(2);
const contentDir = resolve(contentArg ?? "content");
const outDir = resolve(outArg ?? "public/decks");

// Paths in messages are relative to where the script runs, so they read the same on every machine.
function shown(path: string): string {
  return relative(process.cwd(), path) || ".";
}

function readJson(path: string): unknown {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    throw new DeckBuildError(`${shown(path)} cannot be read: ${(error as Error).message}`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new DeckBuildError(`${shown(path)} is not valid JSON: ${(error as Error).message}`);
  }
}

function readReviewed(dir: string): Record<string, unknown> {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch (error) {
    throw new DeckBuildError(`${shown(dir)} cannot be read: ${(error as Error).message}`);
  }
  const reviewed: Record<string, unknown> = {};
  for (const name of names.filter((file) => file.endsWith(".json")).sort()) {
    reviewed[basename(name, ".json")] = readJson(join(dir, name));
  }
  return reviewed;
}

function main(): void {
  const catalog = readJson(join(contentDir, "catalog.json"));
  const reviewed = readReviewed(join(contentDir, "reviewed"));
  const version = new Date().toISOString().slice(0, 10);
  const { index, decks } = buildDecks({ catalog, reviewed, version });

  // Start from an empty folder so a deck that left the catalog does not linger.
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "index.json"), JSON.stringify(index));
  for (const deck of decks) writeFileSync(join(outDir, `${deck.id}.json`), JSON.stringify(deck));

  const built = new Set(decks.map((deck) => deck.id));
  for (const id of Object.keys(reviewed)) {
    if (!built.has(id)) console.warn(`build-decks: reviewed/${id}.json is not in the catalog and was skipped`);
  }
  const summary = decks.map((deck) => `${deck.id} (${deck.cards.length} cards)`).join(", ");
  const noun = decks.length === 1 ? "deck" : "decks";
  console.log(`build-decks: wrote ${decks.length} ${noun} to ${shown(outDir)}: ${summary || "none"}`);
}

try {
  main();
} catch (error) {
  console.error(`build-decks: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
