import * as z from "zod/mini";
import { buildDecks } from "@/src/content/build";

// What native-data/manifest.json remembers between exports. The index of the web build is stamped with the day of the
// build, which says nothing about the content; the apps need a version that moves only when a deck does.
export interface Manifest {
  format: 1;
  generator: 1; // the generator version (spec 4.1), raised when the export's layout or encoding changes
  deckIndexVersion: string;
  deckHashes: Record<string, string>; // deck id -> the hash the web build computes for it
}

export interface NativeDecksInput {
  catalog: unknown;
  reviewed: Record<string, unknown>; // keyed by deck id
  previous: Manifest | null; // the manifest of the last export, or null when there is none
  today: string; // YYYY-MM-DD, passed in so that this module reads no clock
}

export interface NativeDecksResult {
  files: Record<string, string>; // "native-data/decks/<name>.json" -> file text: the index first, then the decks in catalog order
  deckIndexVersion: string;
  deckHashes: Record<string, string>;
}

// The same decks, the same names, whatever the order the manifest lists them in.
function sameHashes(recorded: Readonly<Record<string, string>>, current: Readonly<Record<string, string>>): boolean {
  const names = Object.keys(current);
  if (Object.keys(recorded).length !== names.length) return false;
  return names.every((name) => Object.hasOwn(recorded, name) && recorded[name] === current[name]);
}

// The web's own deck build (src/content/build.ts), written the way scripts/build-decks.ts writes it, with one change:
// the per-deck `version` of the index is the recorded version for as long as no deck hash has changed.
export function nativeDecks(input: NativeDecksInput): NativeDecksResult {
  const { catalog, reviewed, previous, today } = input;
  const built = buildDecks({ catalog, reviewed, version: today });
  const deckHashes = Object.fromEntries(built.decks.map((deck) => [deck.id, deck.hash]));
  const keep = previous !== null && sameHashes(previous.deckHashes, deckHashes);
  const deckIndexVersion = keep ? previous.deckIndexVersion : today;
  // A hash does not depend on the version, so a kept version only needs the build run once more with it.
  const { index, decks } = keep ? buildDecks({ catalog, reviewed, version: deckIndexVersion }) : built;
  const files: Record<string, string> = { "native-data/decks/index.json": JSON.stringify(index) };
  for (const deck of decks) files[`native-data/decks/${deck.id}.json`] = JSON.stringify(deck);
  return { files, deckIndexVersion, deckHashes };
}

export function manifestOf(result: Pick<NativeDecksResult, "deckIndexVersion" | "deckHashes">): Manifest {
  return { format: 1, generator: 1, deckIndexVersion: result.deckIndexVersion, deckHashes: result.deckHashes };
}

// The text of native-data/manifest.json: two-space JSON and a final newline, the decks by name so that a reordered
// catalog does not rewrite the file.
export function manifestText(manifest: Manifest): string {
  const names = Object.keys(manifest.deckHashes).sort();
  const deckHashes = Object.fromEntries(names.map((name) => [name, manifest.deckHashes[name]]));
  return `${JSON.stringify({ format: 1, generator: 1, deckIndexVersion: manifest.deckIndexVersion, deckHashes }, null, 2)}\n`;
}

const ManifestSchema = z.object({
  format: z.literal(1),
  generator: z.literal(1),
  deckIndexVersion: z.iso.date(),
  deckHashes: z.record(z.string(), z.string().check(z.regex(/^[0-9a-f]{16}$/))),
});

// Reads a parsed manifest.json. A damaged manifest stops the export, because a silently reset version would
// change every deck's version in the index.
export function parseManifest(raw: unknown): Manifest {
  const result = ManifestSchema.safeParse(raw);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const path = issue?.path.map(String).join(".") ?? "";
  throw new Error(`manifest.json: ${path === "" ? "" : `${path}: `}${issue?.message ?? "is not valid"}`);
}
