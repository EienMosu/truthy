### Task 3: The decks of `native-data`: the web build's output with a fixed index version, and the manifest that keeps it

This task writes `nativeDecks`, the function that gives `native-data/decks/`: the deck index and the 54 deck files exactly as the web build (`src/content/build.ts`, written the way `scripts/build-decks.ts` writes them) produces them, with one change. The web stamps every deck of `index.json` with the date of the build, so an export on another day would rewrite the index although no card moved, and the drift gate of task 9 could never stay green. `nativeDecks` takes the manifest of the last export and, while the hash of every deck is unchanged, keeps the version that manifest recorded; when a deck is added, removed or changed, it uses today's date. The same task defines the manifest's shape (`Manifest`), how it is written (`manifestText`, `manifestOf`) and how a damaged one is refused (`parseManifest`), so that task 9 only has to read and write files.

Nothing here reads a file, a clock or the network: the content comes in as arguments, `today` is a parameter, the result is a map of repository-relative paths to file text. Task 9 (`export.ts`) reads `content/` and `native-data/manifest.json` and passes them in.

Builds on: nothing from tasks 1 and 2. It uses only the web's `buildDecks` (`src/content/build.ts`), the schemas of `src/content/schema.ts` and the content in `content/`, all of which exist today.

Commands: `pnpm` is pnpm 10.34.0. Without a global one, write `npx -y pnpm@10.34.0` in its place.

**Files:**
- Create: `scripts/native/decks.ts`
- Test: create `tests/scripts/native/decks.test.ts` (unit tests on a two-deck fixture), `tests/scripts/native/decks-content.test.ts` (the shipped content, compared with what `scripts/build-decks.ts` writes)

**Interfaces:**
- Consumes (existing web code, unchanged):

```ts
// src/content/build.ts
export interface BuildInput { catalog: unknown; reviewed: Record<string, unknown>; version: string } // version: an ISO date
export function buildDecks(input: BuildInput): { index: DeckIndex; decks: DeckFile[] }; // throws DeckBuildError
// src/content/schema.ts
export const DeckIndexSchema; export const DeckFileSchema; // zod/mini schemas of public/decks/index.json and <deckId>.json
```

- Produces (the first three are the README's names exactly; the last three are extra and are what task 9 should use for the manifest file):

```ts
// scripts/native/decks.ts
export interface Manifest { format: 1; generator: 1; deckIndexVersion: string; deckHashes: Record<string, string> }
export function nativeDecks(input: { catalog: unknown; reviewed: Record<string, unknown>; previous: Manifest | null; today: string }):
  { files: Record<string, string>; deckIndexVersion: string; deckHashes: Record<string, string> }; // files keyed "native-data/decks/<name>.json"
export function manifestOf(result: { deckIndexVersion: string; deckHashes: Record<string, string> }): Manifest;
export function manifestText(manifest: Manifest): string;   // the text of native-data/manifest.json
export function parseManifest(raw: unknown): Manifest;      // throws Error("manifest.json: <path>: <reason>") on a damaged manifest
```

  - `NativeDecksInput` and `NativeDecksResult` are exported as named interface types too; they are the two object types above.
  - `native-data/manifest.json` holds exactly the four fields of `Manifest`: `format` (the layout version of `native-data/`), `generator` (the generator version spec 4.1 asks for, raised when the export's layout or encoding changes), `deckIndexVersion` and `deckHashes` (the hashes are the "source hashes" of spec 4.1). Both versions are `1` in this plan.

**Rules:**

1. `files` has the key `native-data/decks/index.json` first, then `native-data/decks/<deckId>.json` for every deck the build produced, in catalog order. A text is `JSON.stringify(value)` with no indentation and no trailing newline, which is what `scripts/build-decks.ts` writes, so a deck file is the web build's file byte for byte, cards in file order. Native code relies on that order: the first shuffle runs over the file order.
2. `deckHashes` maps each deck id to the `hash` of its deck file (the web's `hashDeck`: the first 16 hex characters of the sha256 of the cards as JSON), in catalog order. It is not recomputed anywhere else.
3. The version rule. `previous` is kept when it is not `null` and its `deckHashes` has exactly the same deck ids, each with the same hash as the new build (the order of the keys does not matter). Then `deckIndexVersion` is `previous.deckIndexVersion`, and every deck of the index carries it. In every other case (no manifest, a deck added, removed or changed, even only its card order) it is `today`. There is one version for the whole index, not one per deck.
4. A change that moves no deck hash (a catalog title, a section title, a `passName`) changes `index.json` but keeps the version. That is the intended reading of spec 4.3: the version changes only when a deck hash changes. The drift gate of task 9 still fails until the export is run, because the index text differs.
5. `nativeDecks` reads no clock. `today` and a kept `previous.deckIndexVersion` must be ISO dates (`YYYY-MM-DD`): the web build refuses anything else with a `DeckBuildError` ("version must be an ISO date (YYYY-MM-DD), not ..."), and this task lets that error through, so a damaged manifest cannot put a bad version into the index.
6. A catalog that does not validate, or a deck whose cards do not, stops the call with the web build's own `DeckBuildError`. A reviewed file that is not in the catalog is left out (the web script only warns); a catalog deck without a reviewed file is not in the index, as on the web.
7. `manifestText(manifest)` is `JSON.stringify` with two spaces and a final newline, in the key order `format`, `generator`, `deckIndexVersion`, `deckHashes`, with the decks sorted by name, so a reordered catalog does not rewrite the file. `parseManifest` accepts only `format: 1`, `generator: 1`, an ISO date for `deckIndexVersion` and a record of 16-hex-character strings for `deckHashes`; it drops any other field and names the failing path in its message.

**Steps:**

- [ ] **Step 1: Check the starting point.**

```bash
git status --short
pnpm vitest run tests/content/build.test.ts tests/content/build-decks-script.test.ts
```

Expected: `git status --short` prints nothing that this task touches (`scripts/native/` may already exist from task 2). The two test files pass: `Test Files  2 passed (2)` and `Tests  121 passed (121)`.

- [ ] **Step 2: Write the first tests.** They cover what `nativeDecks` writes when there is no manifest.

Create `tests/scripts/native/decks.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DeckBuildError } from "@/src/content/build";
import { DeckFileSchema, DeckIndexSchema } from "@/src/content/schema";
import { nativeDecks } from "@/scripts/native/decks";

// A catalog of two decks: "alpha" with two sections, "beta" without any (its cards sit in the whole deck).
const CATALOG = {
  areas: [
    {
      id: "cloud",
      title: "Cloud",
      platforms: [
        {
          id: "aws",
          title: "AWS",
          decks: [
            {
              id: "alpha",
              code: "ALP",
              title: "Alpha",
              sections: [
                { id: "AAA", title: "First", match: ["a"] },
                { id: "BBB", title: "Second", match: ["b"] },
              ],
            },
            { id: "beta", code: "BET", title: "Beta", passName: "Beta Pass", sections: [] },
          ],
        },
      ],
    },
  ],
};

function reviewedCard(id: string, section: string | undefined, statement: string) {
  return {
    id,
    ...(section === undefined ? {} : { section }),
    statement,
    answer: true,
    explanation: `Explanation of ${id}.`,
    difficulty: 2,
    source: { title: "Docs", url: "https://docs.aws.amazon.com/" },
    conflictGroups: [],
    pipelineOnlyField: "dropped from the shipped card",
  };
}

function reviewed() {
  return {
    alpha: {
      deck: "alpha",
      cards: [reviewedCard("alpha-1", "a", "One."), reviewedCard("alpha-2", "b", "Two."), reviewedCard("alpha-3", "a", "Three.")],
    },
    beta: { deck: "beta", cards: [reviewedCard("beta-1", undefined, "Uno."), reviewedCard("beta-2", undefined, "Dos.")] },
  };
}

describe("nativeDecks without a manifest", () => {
  it("writes the index and one file per deck under native-data/decks, in catalog order", () => {
    const { files } = nativeDecks({ catalog: CATALOG, reviewed: reviewed(), previous: null, today: "2026-10-15" });
    expect(Object.keys(files)).toEqual(["native-data/decks/index.json", "native-data/decks/alpha.json", "native-data/decks/beta.json"]);
  });

  it("stamps the index with today's date and records a hash for every deck", () => {
    const result = nativeDecks({ catalog: CATALOG, reviewed: reviewed(), previous: null, today: "2026-10-15" });
    expect(result.deckIndexVersion).toBe("2026-10-15");
    const index = DeckIndexSchema.parse(JSON.parse(result.files["native-data/decks/index.json"] ?? ""));
    const decks = index.areas.flatMap((area) => area.platforms.flatMap((platform) => platform.decks));
    expect(decks.map((deck) => [deck.id, deck.version])).toEqual([
      ["alpha", "2026-10-15"],
      ["beta", "2026-10-15"],
    ]);
    expect(Object.keys(result.deckHashes)).toEqual(["alpha", "beta"]);
    for (const deck of decks) expect(result.deckHashes[deck.id]).toBe(deck.hash);
    for (const hash of Object.values(result.deckHashes)) expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it("writes the deck files as the web build does: compact JSON, no trailing newline, cards in file order, pipeline fields dropped", () => {
    const { files } = nativeDecks({ catalog: CATALOG, reviewed: reviewed(), previous: null, today: "2026-10-15" });
    const text = files["native-data/decks/alpha.json"] ?? "";
    expect(text.endsWith("\n")).toBe(false);
    expect(text).not.toContain("\n");
    expect(text).not.toContain("pipelineOnlyField");
    const deck = DeckFileSchema.parse(JSON.parse(text));
    expect(deck.cards.map((card) => card.id)).toEqual(["alpha-1", "alpha-2", "alpha-3"]);
    expect(deck.cards.map((card) => card.section)).toEqual(["AAA", "BBB", "AAA"]);
    expect(Object.keys(deck.cards[0] ?? {})).toEqual(["id", "section", "text", "answer", "source", "difficulty", "appliesTo", "conflictGroups"]);
    const beta = DeckFileSchema.parse(JSON.parse(files["native-data/decks/beta.json"] ?? ""));
    expect(beta.cards.map((card) => card.section)).toEqual(["ALL", "ALL"]);
  });

  it("is deterministic: the same input twice gives the same result", () => {
    const first = nativeDecks({ catalog: CATALOG, reviewed: reviewed(), previous: null, today: "2026-10-15" });
    const second = nativeDecks({ catalog: CATALOG, reviewed: reviewed(), previous: null, today: "2026-10-15" });
    expect(second).toEqual(first);
  });

  it("leaves a reviewed file that is not in the catalog out, as the web build does", () => {
    const input = { ...reviewed(), orphan: { deck: "orphan", cards: [reviewedCard("orphan-1", undefined, "Lost.")] } };
    const { files, deckHashes } = nativeDecks({ catalog: CATALOG, reviewed: input, previous: null, today: "2026-10-15" });
    expect(Object.keys(files)).not.toContain("native-data/decks/orphan.json");
    expect(Object.keys(deckHashes)).toEqual(["alpha", "beta"]);
  });

  it("fails like the web build on a bad catalog or a bad deck, and on a date that is not a date", () => {
    expect(() => nativeDecks({ catalog: { areas: "no" }, reviewed: reviewed(), previous: null, today: "2026-10-15" })).toThrow(DeckBuildError);
    const broken = { ...reviewed(), beta: { deck: "beta", cards: [reviewedCard("gamma-1", undefined, "Wrong prefix.")] } };
    expect(() => nativeDecks({ catalog: CATALOG, reviewed: broken, previous: null, today: "2026-10-15" })).toThrow(/beta: card gamma-1/);
    expect(() => nativeDecks({ catalog: CATALOG, reviewed: reviewed(), previous: null, today: "15.10.2026" })).toThrow(/ISO date/);
  });
});
```

Run it before there is any implementation:

```bash
pnpm vitest run tests/scripts/native/decks.test.ts
```

Expected: the file fails to load, `FAIL  tests/scripts/native/decks.test.ts`, with `Error: Cannot find package '@/scripts/native/decks' imported from` the test file, then `Test Files  1 failed (1)` and `Tests  no tests`.

- [ ] **Step 3: Write the first implementation.** It runs the web build and writes its output; it does not yet look at a manifest.

Create `scripts/native/decks.ts`:

```ts
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

// The web's own deck build (src/content/build.ts), written the way scripts/build-decks.ts writes it.
export function nativeDecks(input: NativeDecksInput): NativeDecksResult {
  const { index, decks } = buildDecks({ catalog: input.catalog, reviewed: input.reviewed, version: input.today });
  const files: Record<string, string> = { "native-data/decks/index.json": JSON.stringify(index) };
  for (const deck of decks) files[`native-data/decks/${deck.id}.json`] = JSON.stringify(deck);
  const deckHashes = Object.fromEntries(decks.map((deck) => [deck.id, deck.hash]));
  return { files, deckIndexVersion: input.today, deckHashes };
}
```

Run:

```bash
pnpm vitest run tests/scripts/native/decks.test.ts
```

Expected: `Test Files  1 passed (1)` and `Tests  6 passed (6)`.

- [ ] **Step 4: Write the tests for the manifest.** They pin Review Focus 2 of the README: the same decks on another day give the same bytes, the index included.

In `tests/scripts/native/decks.test.ts`, replace the import line

```ts
import { nativeDecks } from "@/scripts/native/decks";
```

with

```ts
import { nativeDecks, type Manifest } from "@/scripts/native/decks";
```

and append this to the end of the file, after a blank line:

```ts
// Review Focus 2 of the plan: exporting on another day with unchanged decks gives the same bytes.
describe("nativeDecks with the manifest of an earlier export", () => {
  function firstExport(): { files: Record<string, string>; manifest: Manifest } {
    const result = nativeDecks({ catalog: CATALOG, reviewed: reviewed(), previous: null, today: "2026-10-15" });
    return { files: result.files, manifest: { format: 1, generator: 1, deckIndexVersion: result.deckIndexVersion, deckHashes: result.deckHashes } };
  }

  it("keeps the recorded version on a later day while every deck hash is unchanged: byte-identical files, the index included", () => {
    const { files, manifest } = firstExport();
    const later = nativeDecks({ catalog: CATALOG, reviewed: reviewed(), previous: manifest, today: "2026-11-02" });
    expect(later.deckIndexVersion).toBe("2026-10-15");
    expect(later.deckHashes).toEqual(manifest.deckHashes);
    expect(later.files).toEqual(files);
    const index = later.files["native-data/decks/index.json"] ?? "";
    expect(index).toBe(files["native-data/decks/index.json"]);
    expect(index).toContain('"version":"2026-10-15"');
    expect(index).not.toContain("2026-11-02");
  });

  it("gives the same result for two runs on two different days", () => {
    const { manifest } = firstExport();
    const dayOne = nativeDecks({ catalog: CATALOG, reviewed: reviewed(), previous: manifest, today: "2027-01-01" });
    const dayTwo = nativeDecks({ catalog: CATALOG, reviewed: reviewed(), previous: manifest, today: "2027-06-30" });
    expect(dayTwo).toEqual(dayOne);
  });

  it("moves to today when one card changes: the whole index gets the new version, only the changed deck file differs", () => {
    const { files, manifest } = firstExport();
    const edited = reviewed();
    edited.alpha.cards[1] = reviewedCard("alpha-2", "b", "Two, corrected.");
    const later = nativeDecks({ catalog: CATALOG, reviewed: edited, previous: manifest, today: "2026-11-02" });
    expect(later.deckIndexVersion).toBe("2026-11-02");
    expect(later.deckHashes.alpha).not.toBe(manifest.deckHashes.alpha);
    expect(later.deckHashes.beta).toBe(manifest.deckHashes.beta);
    expect(later.files["native-data/decks/beta.json"]).toBe(files["native-data/decks/beta.json"]);
    expect(later.files["native-data/decks/alpha.json"]).not.toBe(files["native-data/decks/alpha.json"]);
    const index = DeckIndexSchema.parse(JSON.parse(later.files["native-data/decks/index.json"] ?? ""));
    const versions = index.areas.flatMap((area) => area.platforms.flatMap((platform) => platform.decks.map((deck) => deck.version)));
    expect(versions).toEqual(["2026-11-02", "2026-11-02"]);
  });

  it("moves to today when a deck is removed from the build", () => {
    const { manifest } = firstExport();
    const withoutBeta = { alpha: reviewed().alpha };
    expect(nativeDecks({ catalog: CATALOG, reviewed: withoutBeta, previous: manifest, today: "2026-11-02" }).deckIndexVersion).toBe("2026-11-02");
  });

  it("moves to today when a deck is added to the build", () => {
    const { manifest } = firstExport();
    const onlyBeta: Manifest = { ...manifest, deckHashes: { beta: manifest.deckHashes.beta ?? "" } };
    expect(nativeDecks({ catalog: CATALOG, reviewed: reviewed(), previous: onlyBeta, today: "2026-11-02" }).deckIndexVersion).toBe("2026-11-02");
  });

  it("moves to today when a deck keeps its cards and changes only their order", () => {
    const { manifest } = firstExport();
    const swapped = reviewed();
    swapped.beta.cards.reverse();
    expect(nativeDecks({ catalog: CATALOG, reviewed: swapped, previous: manifest, today: "2026-11-02" }).deckIndexVersion).toBe("2026-11-02");
  });

  it("does not care in which order the manifest lists its hashes", () => {
    const { files, manifest } = firstExport();
    const reversed: Manifest = { ...manifest, deckHashes: Object.fromEntries(Object.entries(manifest.deckHashes).reverse()) };
    expect(nativeDecks({ catalog: CATALOG, reviewed: reviewed(), previous: reversed, today: "2026-11-02" }).files).toEqual(files);
  });

  it("fails when the kept version is not a date, instead of writing it into the index", () => {
    const { manifest } = firstExport();
    const damaged: Manifest = { ...manifest, deckIndexVersion: "yesterday" };
    expect(() => nativeDecks({ catalog: CATALOG, reviewed: reviewed(), previous: damaged, today: "2026-11-02" })).toThrow(/ISO date/);
  });
});
```

Run:

```bash
pnpm vitest run tests/scripts/native/decks.test.ts
```

Expected: 4 tests fail and 10 pass, `Tests  4 failed | 10 passed (14)`. The failures are the four that need a kept version:
- `keeps the recorded version on a later day while every deck hash is unchanged...`: `AssertionError: expected '2026-11-02' to be '2026-10-15'`
- `gives the same result for two runs on two different days`
- `does not care in which order the manifest lists its hashes`
- `fails when the kept version is not a date, instead of writing it into the index`: `AssertionError: expected [Function] to throw an error`

The four `moves to today when ...` tests already pass: the first implementation always uses today, which is right for them and stays right for them.

- [ ] **Step 5: Keep the recorded version while the hashes are unchanged.**

Replace the whole content of `scripts/native/decks.ts` with:

```ts
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
```

Run:

```bash
pnpm vitest run tests/scripts/native/decks.test.ts
```

Expected: `Test Files  1 passed (1)` and `Tests  14 passed (14)`.

- [ ] **Step 6: Test the function against the shipped content and the web's own script.** This is the check that the deck files are the web build's output byte for byte, that the card order of every reviewed file survives, and that the version rule holds on the 54 real decks.

Create `tests/scripts/native/decks-content.test.ts`:

```ts
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
```

Run:

```bash
pnpm vitest run tests/scripts/native/decks-content.test.ts
```

Expected: `Test Files  1 passed (1)` and `Tests  3 passed (3)`. The three pass at once because they describe what the implementation of step 5 already does; step 7 shows that the first one can fail.

- [ ] **Step 7: Prove that the byte-for-byte test can fail.** Indent the deck files (a change the unit tests of step 2 would also catch), run the shipped-content test, and put the line back.

```bash
sed -i.bak 's#JSON.stringify(deck);#JSON.stringify(deck, null, 2);#' scripts/native/decks.ts && rm scripts/native/decks.ts.bak
pnpm vitest run tests/scripts/native/decks-content.test.ts
sed -i.bak 's#JSON.stringify(deck, null, 2);#JSON.stringify(deck);#' scripts/native/decks.ts && rm scripts/native/decks.ts.bak
pnpm vitest run tests/scripts/native/decks.test.ts tests/scripts/native/decks-content.test.ts
```

Expected: the first run fails, `Tests  1 failed | 2 passed (3)`, with `AssertionError: angular-fundamentals.json differs from the web build: expected false to be true`. After the line is put back, the second run passes: `Test Files  2 passed (2)` and `Tests  17 passed (17)`.

- [ ] **Step 8: Write the tests for the manifest file.**

In `tests/scripts/native/decks.test.ts`, replace the import line

```ts
import { nativeDecks, type Manifest } from "@/scripts/native/decks";
```

with

```ts
import { manifestOf, manifestText, nativeDecks, parseManifest, type Manifest } from "@/scripts/native/decks";
```

and append this to the end of the file, after a blank line:

```ts
describe("the manifest", () => {
  const HASH_A = "0123456789abcdef";
  const HASH_B = "fedcba9876543210";
  const manifest: Manifest = { format: 1, generator: 1, deckIndexVersion: "2026-10-15", deckHashes: { beta: HASH_B, alpha: HASH_A } };

  it("manifestOf takes the version and the hashes of an export", () => {
    const result = nativeDecks({ catalog: CATALOG, reviewed: reviewed(), previous: null, today: "2026-10-15" });
    expect(manifestOf(result)).toEqual({ format: 1, generator: 1, deckIndexVersion: "2026-10-15", deckHashes: result.deckHashes });
  });

  it("manifestText is two-space JSON with a final newline, the format, generator and version first, the decks by name", () => {
    expect(manifestText(manifest)).toBe(
      [
        "{",
        '  "format": 1,',
        '  "generator": 1,',
        '  "deckIndexVersion": "2026-10-15",',
        '  "deckHashes": {',
        `    "alpha": "${HASH_A}",`,
        `    "beta": "${HASH_B}"`,
        "  }",
        "}",
        "",
      ].join("\n"),
    );
  });

  it("manifestText does not depend on the order the hashes were collected in", () => {
    const other: Manifest = { ...manifest, deckHashes: { alpha: HASH_A, beta: HASH_B } };
    expect(manifestText(other)).toBe(manifestText(manifest));
  });

  it("parseManifest reads back what manifestText wrote", () => {
    expect(parseManifest(JSON.parse(manifestText(manifest)))).toEqual(manifest);
  });

  it("parseManifest keeps the four fields and drops any other", () => {
    expect(parseManifest({ ...manifest, extra: "7" })).toEqual(manifest);
  });

  it.each<[string, unknown, RegExp]>([
    ["a value that is not an object", "manifest", /^manifest\.json: /],
    ["another format", { ...manifest, format: 2 }, /^manifest\.json: format: /],
    ["a missing version", { format: 1, generator: 1, deckHashes: {} }, /^manifest\.json: deckIndexVersion: /],
    ["a version that is not a date", { ...manifest, deckIndexVersion: "yesterday" }, /^manifest\.json: deckIndexVersion: /],
    ["hashes that are an array", { ...manifest, deckHashes: [HASH_A] }, /^manifest\.json: deckHashes: /],
    ["a hash that is not 16 hex characters", { ...manifest, deckHashes: { alpha: "xyz" } }, /^manifest\.json: deckHashes\.alpha: /],
  ])("parseManifest rejects %s", (_name, raw, message) => {
    expect(() => parseManifest(raw)).toThrow(message);
  });
});
```

Run:

```bash
pnpm vitest run tests/scripts/native/decks.test.ts
```

Expected: 11 tests fail, `Tests  11 failed | 14 passed (25)`. Five fail with `TypeError: manifestOf is not a function`, `TypeError: manifestText is not a function` or `TypeError: parseManifest is not a function`; the six `parseManifest rejects ...` cases fail with `AssertionError: expected [Function] to throw error matching /^manifest\.json: .../`, because the call throws a `TypeError` instead.

- [ ] **Step 9: Write the manifest helpers.**

Replace the whole content of `scripts/native/decks.ts` with:

```ts
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
```

Run:

```bash
pnpm vitest run tests/scripts/native/decks.test.ts tests/scripts/native/decks-content.test.ts
```

Expected: `Test Files  2 passed (2)` and `Tests  28 passed (28)`.

- [ ] **Step 10: Typecheck and run the whole suite.**

```bash
pnpm typecheck
pnpm test
```

Expected: `pnpm typecheck` prints the `tsc --noEmit` line and nothing else (no error). `pnpm test` ends with `Test Files  155 passed (155)` and `Tests  3225 passed (3225)`: task 2's 153 and 3197 plus this task's 2 files and 28 tests.

- [ ] **Step 11: Stage, check the hygiene rules on the staged files, and commit.**

```bash
git add scripts/native/decks.ts tests/scripts/native/decks.test.ts tests/scripts/native/decks-content.test.ts
pnpm vitest run tests/repo-hygiene.test.ts
git commit -m "feat: add nativeDecks, the web deck build with an index version that moves only with a deck, and the native manifest"
```

Expected: `tests/repo-hygiene.test.ts` passes (the staged files count as tracked: it reads `git ls-files`), and the commit lists exactly three files created. No co-author or generator line in the message.
