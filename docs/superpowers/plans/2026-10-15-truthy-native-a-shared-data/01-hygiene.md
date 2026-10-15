### Task 1: Native-scoped hygiene rules, UTF-16 runs, and the pre-push hook turned on

The repository is public, and `scripts/hygiene.ts` holds the rules that keep a local path, a foreign e-mail address or a secret out of it. Two callers share them: `tests/repo-hygiene.test.ts` scans every tracked file, and `.githooks/pre-push` (through `scripts/pre-push.ts`) scans every commit about to be pushed. The native apps add files the rules were not written for: Xcode and Gradle projects, signing material, PNG assets with metadata, TrueType fonts whose name records are UTF-16. This task extends the same module so that both callers pick the new rules up, and turns the hook on in the clone, where it is off today.

Three things change. First, the scan of a binary file also reads UTF-16 text (big and little endian), because the name table of a font stores its copyright and vendor strings that way and an ASCII-only scan never sees them; this applies to every binary file. Second, inside the native scopes (`ios/`, `android/`, `native-data/` and the native documents under `docs/superpowers/`) three more rules apply: no em dash in a text file, no signing file by type, no PNG with a text or EXIF chunk. Third, the tracked-files scan moves into `scripts/hygiene.ts` as `scanFiles`, so that a test can run it on a scratch folder and prove that the tracked-files test would reject a native file, and `scanCommit` (the hook's per-commit scan) applies the same rules to the lines and files a commit adds.

Builds on: nothing. This is the first task; the repository root is the executor's checkout of branch `native` (see "Before task 1" in the README). No `node_modules` exists there yet.

**Files:**
- Modify: `scripts/hygiene.ts`, `tests/repo-hygiene.test.ts`, `tests/pre-push.test.ts`
- Create: `tests/support/png.ts`
- Test: create `tests/scripts/hygiene-native.test.ts`
- Unchanged on purpose: `scripts/pre-push.ts` and `.githooks/pre-push`. The hook calls `pushRanges` and `scanCommits`, both in `scripts/hygiene.ts`, so the new rules reach it without an edit.

**Interfaces:**
- Consumes (all already in `scripts/hygiene.ts`):

```ts
export const ALLOWED_EMAIL: string;
export function findingsIn(text: string): string[];                  // "<line>: <rule>: <match>", one per rule hit
export function findingsInBytes(bytes: Uint8Array): string[];        // text as is; a binary file without line numbers
export function scanCommits(cwd: string, revisions: readonly string[]): string[]; // "<short sha> <path>: <finding>"
export function pushRanges(cwd: string, stdin: string): string[][];
```

- Produces (added to `scripts/hygiene.ts`; later tasks rely on the behaviour, not on the names, except where the README names a file):

```ts
export const NATIVE_SCOPES: readonly RegExp[];                       // ios/, android/, native-data/, docs/superpowers/**/*native*
export function inNativeScope(path: string): boolean;                // path is repository-relative with "/" separators
export function emDashFindings(text: string): string[];              // "<line>: em dash: U+2014"
export const SIGNING_EXTENSIONS: readonly [".jks", ".keystore", ".p12", ".mobileprovision"];
export function signingFileFindings(path: string): string[];         // "signing file: <extension>"
export function pngMetadataFindings(bytes: Uint8Array): string[];    // "PNG metadata chunk: <tEXt|zTXt|iTXt|eXIf>", once per kind
export function nativePathFindings(path: string): string[];          // signingFileFindings inside a native scope, else []
export function findingsForPath(path: string, bytes: Uint8Array): string[]; // findingsInBytes plus the native rules of path's scope
export function scanFiles(root: string, paths: readonly string[]): string[]; // "<path>:<finding>"; a symlink as "<path> -> <finding>"

// tests/support/png.ts
export function png(...chunks: [type: string, data: Buffer][]): Buffer; // IHDR, the given chunks, IEND; checksums left at zero
```

**Rules:**

1. **Scopes.** A path is native when it starts with `ios/`, `android/` or `native-data/`, or when it starts with `docs/superpowers/` and has `native` anywhere after that (case-insensitive). The README's `docs/superpowers/**/*native*` is read this way because the plan folders are named `...-truthy-native-a-shared-data` while their files (`01-hygiene.md`) are not; a base name rule would leave the plans unchecked. Every other path keeps today's rules only: the course content under `content/` holds em dashes and must not be reported.
2. **Em dash.** The character U+2014, in a text file of a native scope (the bytes hold no zero byte, as `findingsInBytes` decides). One finding per line that holds one, with the line number: `2: em dash: U+2014`. The character itself is not printed. An en dash, a hyphen and the six characters of a JSON escape are not em dashes. A binary file is not looked at (a font may legitimately spell one in a name record). In the hook only the lines a commit adds are looked at, so a commit that removes an em dash is clean.
3. **Signing files.** A native path ending in `.jks`, `.keystore`, `.p12` or `.mobileprovision`, compared in lower case, is a finding `signing file: <extension>` whatever the file holds, text or binary. `release.keystore.md` is not one. The hook checks every file a commit adds or changes that still exists in the commit.
4. **PNG metadata.** Bytes that start with the PNG signature, in a native scope: the chunk headers are walked up to IEND, and every kind among `tEXt`, `zTXt`, `iTXt`, `eXIf` found gives one finding `PNG metadata chunk: <type>`, in the order the kinds first appear. A chunk that runs past the end of the file still counts by its type. Chunks such as `pHYs`, `tIME` and `IDAT` are allowed. The text inside a text chunk is still read by the older rule, so a chunk that holds a local path gives both findings (the path first). Bytes that are not a PNG have no such finding, whatever their name.
5. **UTF-16 runs.** In any binary file (no scope needed), after the ASCII runs, runs of 4 or more printable ASCII characters (space to tilde, and tab) written as UTF-16 are read, little endian (character, zero) and big endian (zero, character). Inside one run both readings match, one shifted by a byte; of two overlapping readings the longer wins and, when equal, the earlier, so a run is reported once and under its right text. A run shorter than 4 characters is ignored.
6. **Finding formats.** A text file's findings carry the line number (`1: em dash: U+2014`); a binary file's do not. The tracked-files scan prefixes the path (`ios/Strings.swift:1: em dash: U+2014`). The hook strips the line number and prefixes the short commit id and the path (`1a2b3c4 ios/Strings.swift: em dash: U+2014`).
7. **Test samples are built from pieces.** The files of this task are public and are themselves scanned: the em dash is written as the escape `"\u2014"`, a home path as `"/" + "Users/alex"`, an e-mail address as `"someone" + "@" + "example.org"`. The new files must contain no em dash character.
8. **The hook is turned on per clone,** with `git config core.hooksPath .githooks`. A clone made with `git worktree` shares that setting, and git runs a relative hooks path from the top of each working tree. The hook runs `node_modules/.bin/tsx` of its own working tree, so each checkout needs `pnpm install`.

**Steps:**

- [ ] **Step 1: Install the dependencies and take the baseline.**

```bash
git branch --show-current
git config user.email
npx -y pnpm@10.34.0 install --frozen-lockfile
npx -y pnpm@10.34.0 vitest run tests/repo-hygiene.test.ts tests/pre-push.test.ts
```

Expected: `native`, then `EienMosu@users.noreply.github.com`, then pnpm installs without changing the lockfile, then `Test Files  2 passed (2)` and `Tests  35 passed (35)` (20 in `repo-hygiene.test.ts`, 15 in `pre-push.test.ts`). If the e-mail differs, set it in this clone (`git config user.email EienMosu@users.noreply.github.com`) before any commit: the hook of step 12 rejects other authors.

- [ ] **Step 2: Move the PNG test helper to a shared file.** The new tests build PNG files too, and `tests/repo-hygiene.test.ts` already has a helper for it. Create `tests/support/png.ts`:

```ts
// A PNG file for the hygiene tests: the signature, then each chunk as length, type, data and checksum (left at
// zero, nothing here checks it). IHDR comes first and IEND last, so a call lists only the chunks in between.
export function png(...chunks: [type: string, data: Buffer][]): Buffer {
  const parts: Buffer[] = [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])];
  const all: [string, Buffer][] = [["IHDR", Buffer.alloc(13)], ...chunks, ["IEND", Buffer.alloc(0)]];
  for (const [type, data] of all) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    parts.push(length, Buffer.from(type, "latin1"), data, Buffer.alloc(4));
  }
  return Buffer.concat(parts);
}
```

In `tests/repo-hygiene.test.ts`, delete the local helper (the comment line, the function and the blank line after it):

```ts
// A PNG file: the signature, then each chunk as length, type, data and checksum (left at zero, nothing here checks it).
function png(...chunks: [type: string, data: Buffer][]): Buffer {
  const parts: Buffer[] = [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])];
  const all: [string, Buffer][] = [["IHDR", Buffer.alloc(13)], ...chunks, ["IEND", Buffer.alloc(0)]];
  for (const [type, data] of all) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    parts.push(length, Buffer.from(type, "latin1"), data, Buffer.alloc(4));
  }
  return Buffer.concat(parts);
}

```

and add the import below the existing hygiene import. Replace

```ts
import { ALLOWED_EMAIL, findingsIn, findingsInBytes } from "@/scripts/hygiene";
```

with

```ts
import { ALLOWED_EMAIL, findingsIn, findingsInBytes } from "@/scripts/hygiene";
import { png } from "@/tests/support/png";
```

Run `npx -y pnpm@10.34.0 vitest run tests/repo-hygiene.test.ts`. Expected: `Tests  20 passed (20)`, unchanged.

- [ ] **Step 3: Write the failing tests for UTF-16 runs.** Create `tests/scripts/hygiene-native.test.ts`. The `nameTable` helper builds the layout of a TrueType `name` table (header, 12-byte records for the Windows platform, strings in UTF-16 big endian), so that the last two tests read what a real font carries:

```ts
import { describe, expect, it } from "vitest";
import { findingsInBytes } from "@/scripts/hygiene";

// Samples are built from pieces so that this file never contains what it looks for.
const home = "/" + "Users/alex";
const email = "someone" + "@" + "example.org";

const littleEndian = (text: string) => Buffer.from(text, "utf16le");
const bigEndian = (text: string) => Buffer.from(text, "utf16le").swap16();
const filler = Buffer.from([0x00, 0x01, 0xff, 0x02]);

// The 'name' table of a font: format 0, the record count, the offset of the strings, one 12-byte record per
// string (platform 3 is Windows, encoding 1 is Unicode, language 0x0409, the name id, the byte length, the
// offset), then the strings in UTF-16 big endian.
function nameTable(strings: readonly string[]): Buffer {
  const encoded = strings.map(bigEndian);
  const head = Buffer.alloc(6 + 12 * strings.length);
  head.writeUInt16BE(0, 0);
  head.writeUInt16BE(strings.length, 2);
  head.writeUInt16BE(head.length, 4);
  let offset = 0;
  encoded.forEach((bytes, index) => {
    const record = 6 + 12 * index;
    head.writeUInt16BE(3, record);
    head.writeUInt16BE(1, record + 2);
    head.writeUInt16BE(0x0409, record + 4);
    head.writeUInt16BE(index === 0 ? 0 : 1, record + 6);
    head.writeUInt16BE(bytes.length, record + 8);
    head.writeUInt16BE(offset, record + 10);
    offset += bytes.length;
  });
  return Buffer.concat([head, ...encoded]);
}

describe("UTF-16 runs in binary files", () => {
  it("reads text in UTF-16 big endian, the layout of a font's name records", () => {
    const bytes = Buffer.concat([filler, bigEndian(`see ${home}/notes.md`), filler]);
    expect(findingsInBytes(bytes)).toEqual([`absolute local path: ${home}`]);
  });

  it("reads text in UTF-16 little endian", () => {
    const bytes = Buffer.concat([filler, littleEndian(`write to ${email}`), filler]);
    expect(findingsInBytes(bytes)).toEqual([`e-mail address: ${email}`]);
  });

  it("reports a run once, not once for each way of pairing its bytes", () => {
    expect(findingsInBytes(Buffer.concat([filler, bigEndian(email), filler]))).toEqual([`e-mail address: ${email}`]);
    expect(findingsInBytes(Buffer.concat([filler, littleEndian(email), filler]))).toEqual([`e-mail address: ${email}`]);
  });

  it("reads a run that ends the file, and one that starts it", () => {
    expect(findingsInBytes(Buffer.concat([filler, bigEndian(home + "/a")]))).toEqual([`absolute local path: ${home}`]);
    expect(findingsInBytes(Buffer.concat([littleEndian(home + "/a"), filler]))).toEqual([`absolute local path: ${home}`]);
  });

  it("ignores a UTF-16 run of fewer than four characters", () => {
    expect(findingsInBytes(Buffer.concat([filler, bigEndian("a@b"), filler]))).toEqual([]);
  });

  it("still reads the ASCII runs of the same file", () => {
    const bytes = Buffer.concat([filler, Buffer.from(`${home}/one`, "latin1"), filler, bigEndian(email), filler]);
    expect(findingsInBytes(bytes)).toEqual([`absolute local path: ${home}`, `e-mail address: ${email}`]);
  });

  it("finds a copyright holder's address in the name table of a font", () => {
    const table = nameTable([`Copyright 2026 The Authors (${email})`, "Overpass"]);
    const font = Buffer.concat([Buffer.from("\0\x01\0\0\0\x01\0\x10name", "latin1"), filler, table, filler]);
    expect(findingsInBytes(font)).toEqual([`e-mail address: ${email}`]);
  });

  it("finds nothing in a name table that holds a plain family name", () => {
    expect(findingsInBytes(Buffer.concat([filler, nameTable(["Overpass", "Regular"]), filler]))).toEqual([]);
  });
});
```

Run `npx -y pnpm@10.34.0 vitest run tests/scripts/hygiene-native.test.ts`. Expected: `Tests  6 failed | 2 passed (8)`. The first failure reads `AssertionError: expected [] to deeply equal [ 'absolute local path: ...' ]`: the scan sees no ASCII run in UTF-16 text. The two tests that pass are the short run and the plain family name, which find nothing before and after.

- [ ] **Step 4: Read UTF-16 runs.** In `scripts/hygiene.ts`, replace

```ts
// Runs of four or more printable ASCII characters, one per line.
function readableRuns(bytes: Buffer): string {
  return (bytes.toString("latin1").match(/[\x20-\x7e\t]{4,}/g) ?? []).join("\n");
}
```

with

```ts
// Runs of four or more printable ASCII characters, one per line, then the runs of the same kind written as
// UTF-16 (see utf16Runs).
function readableRuns(bytes: Buffer): string {
  const latin1 = bytes.toString("latin1");
  return [...(latin1.match(/[\x20-\x7e\t]{4,}/g) ?? []), ...utf16Runs(latin1)].join("\n");
}

// Runs of four or more printable ASCII characters written as UTF-16, which is how the name records of a font on
// the Windows platform are stored: big endian, a zero byte before every character. Little endian puts the zero
// after it. The bytes arrive as a Latin-1 string, one character per byte. Inside one run both readings match,
// one pairing the bytes right and one shifted by a byte; the longest reading of a stretch of bytes wins, and of
// two equally long ones the earlier, so that a run is reported once and with its right text.
function utf16Runs(latin1: string): string[] {
  const readings: { start: number; end: number; text: string }[] = [];
  for (const [pattern, first] of [
    [/(?:[\x20-\x7e\t]\0){4,}/g, 0], // little endian: the character comes first
    [/(?:\0[\x20-\x7e\t]){4,}/g, 1], // big endian: the character comes second
  ] as const) {
    for (const match of latin1.matchAll(pattern)) {
      let text = "";
      for (let at = first; at < match[0].length; at += 2) text += match[0].charAt(at);
      readings.push({ start: match.index, end: match.index + match[0].length, text });
    }
  }
  readings.sort((a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start);
  const kept: typeof readings = [];
  for (const reading of readings) {
    if (!kept.some((other) => reading.start < other.end && other.start < reading.end)) kept.push(reading);
  }
  return kept.sort((a, b) => a.start - b.start).map((reading) => reading.text);
}
```

The sort puts the longest reading first and the earlier one first among equals; a reading is kept only when it overlaps none already kept. That is what `reports a run once` pins: without the overlap check, the shifted reading of a big endian address is a second, different finding.

Run `npx -y pnpm@10.34.0 vitest run tests/scripts/hygiene-native.test.ts tests/repo-hygiene.test.ts`. Expected: `Test Files  2 passed (2)`, `Tests  28 passed (28)` (8 and 20). The tracked-files test in the second file now reads the UTF-16 runs of every binary file in the repository (fonts, icons) and still finds nothing.

Commit:

```bash
git add scripts/hygiene.ts tests/support/png.ts tests/repo-hygiene.test.ts tests/scripts/hygiene-native.test.ts
git commit -m "feat: read UTF-16 text in the binary files the hygiene scan checks"
```

- [ ] **Step 5: Write the failing tests for the native rules.** In `tests/scripts/hygiene-native.test.ts`, replace the two import lines

```ts
import { describe, expect, it } from "vitest";
import { findingsInBytes } from "@/scripts/hygiene";
```

with

```ts
import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { findingsForPath, findingsInBytes, inNativeScope } from "@/scripts/hygiene";
import { png } from "@/tests/support/png";
```

and append this to the end of the file:

```ts

// The character is spelled with an escape, so that this file holds none.
const emDash = "\u2014";

describe("native scopes", () => {
  it("cover ios, android, native-data and the native documents under docs/superpowers", () => {
    for (const path of [
      "ios/Truthy/Truthy.xcodeproj/project.pbxproj",
      "android/Truthy/app/build.gradle.kts",
      "native-data/golden/src.engine.rng.mulberry32.json",
      "docs/superpowers/specs/2026-10-14-truthy-native-apps-design.md",
      "docs/superpowers/plans/2026-10-15-truthy-native-a-shared-data/01-hygiene.md",
    ]) {
      expect(inNativeScope(path), path).toBe(true);
    }
  });

  it("leave every other path alone", () => {
    for (const path of [
      "README.md",
      "src/engine/deal.ts",
      "content/raw/go-fundamentals-b1.json",
      "docs/testing.md",
      "docs/superpowers/plans/2026-10-07-truthy-step-3-offline/02-pure.md",
      "tests/ios/notes.md",
      "scripts/native/export.ts",
      "public/ios/icon.png",
    ]) {
      expect(inNativeScope(path), path).toBe(false);
    }
  });
});

describe("em dash", () => {
  const text = Buffer.from(`one\ntwo ${emDash} three\nfour\nfive ${emDash} six ${emDash} seven\n`);

  it("is reported by line in a text file of a native scope", () => {
    expect(findingsForPath("ios/Truthy/Strings.swift", text)).toEqual(["2: em dash: U+2014", "4: em dash: U+2014"]);
    expect(findingsForPath("native-data/decks/index.json", text)).toHaveLength(2);
    expect(findingsForPath("docs/superpowers/specs/2026-10-14-truthy-native-apps-design.md", text)).toHaveLength(2);
  });

  it("is left alone in a file outside the native scopes", () => {
    expect(findingsForPath("content/raw/go-fundamentals-b1.json", text)).toEqual([]);
    expect(findingsForPath("src/engine/deal.ts", text)).toEqual([]);
  });

  it("is not looked for in a binary file, which has no text to hold it", () => {
    const font = Buffer.concat([Buffer.from([0, 1, 2, 3]), Buffer.from(`Overpass ${emDash} Regular`, "utf8")]);
    expect(findingsForPath("android/Truthy/app/src/main/res/font/overpass_600.ttf", font)).toEqual([]);
  });

  it("is told apart from an en dash and a hyphen", () => {
    expect(findingsForPath("ios/a.md", Buffer.from("a \u2013 b - c -- d\n"))).toEqual([]);
  });
});

describe("signing files", () => {
  it.each([".jks", ".keystore", ".p12", ".mobileprovision"])("%s is rejected in a native scope, whatever it holds", (extension) => {
    expect(findingsForPath(`android/Truthy/app/release${extension}`, Buffer.from("not a key"))).toEqual([`signing file: ${extension}`]);
  });

  it("is told by the end of the name, in any case", () => {
    expect(findingsForPath("ios/Truthy/Dist.MobileProvision", Buffer.from("x"))).toEqual(["signing file: .mobileprovision"]);
    expect(findingsForPath("android/Truthy/app/release.keystore.md", Buffer.from("x"))).toEqual([]);
    expect(findingsForPath("android/Truthy/app/jks.md", Buffer.from("x"))).toEqual([]);
  });

  it("is left alone outside the native scopes", () => {
    expect(findingsForPath("keys/release.jks", Buffer.from("x"))).toEqual([]);
  });
});

describe("PNG metadata", () => {
  const chunks: Record<string, Buffer> = {
    tEXt: Buffer.from("Software\0Preview", "latin1"),
    zTXt: Buffer.concat([Buffer.from("Comment\0\0", "latin1"), deflateSync("a note")]),
    iTXt: Buffer.from("Title\0\0\0en\0\0Truthy", "utf8"),
    eXIf: Buffer.concat([Buffer.from("MM\0*\0\0\0\x08", "latin1"), Buffer.alloc(6)]),
  };

  it.each(Object.keys(chunks))("%s chunk is rejected in a native scope, whatever it says", (type) => {
    expect(findingsForPath("ios/Truthy/Assets/icon.png", png([type, chunks[type] ?? Buffer.alloc(0)]))).toEqual([`PNG metadata chunk: ${type}`]);
  });

  it("is reported once per kind, in the order the chunks come, next to what the chunk says", () => {
    const bytes = png(
      ["tEXt", Buffer.from(`Comment\0${home}/shot.png`, "latin1")],
      ["eXIf", chunks.eXIf ?? Buffer.alloc(0)],
      ["tEXt", Buffer.from("Author\0someone", "latin1")],
    );
    expect(findingsForPath("android/Truthy/app/icon.png", bytes)).toEqual([
      `absolute local path: ${home}`,
      "PNG metadata chunk: tEXt",
      "PNG metadata chunk: eXIf",
    ]);
  });

  it("lets a PNG through that has image, palette, time and size chunks only", () => {
    const bytes = png(["pHYs", Buffer.alloc(9)], ["tIME", Buffer.alloc(7)], ["IDAT", Buffer.from([1, 2, 3])]);
    expect(findingsForPath("ios/Truthy/Assets/icon.png", bytes)).toEqual([]);
  });

  it("is left alone outside the native scopes", () => {
    expect(findingsForPath("public/icon-192.png", png(["tEXt", chunks.tEXt ?? Buffer.alloc(0)]))).toEqual([]);
  });

  it("is not looked for in a file that is no PNG", () => {
    expect(findingsForPath("ios/Truthy/Assets/icon.png", Buffer.from("tEXt Software Preview\0"))).toEqual([]);
  });
});
```

Run `npx -y pnpm@10.34.0 vitest run tests/scripts/hygiene-native.test.ts`. Expected: `Tests  20 failed | 8 passed (28)`. The failures read `TypeError: inNativeScope is not a function` (the two scope tests) and `TypeError: findingsForPath is not a function` (all the others). The 8 that pass are the UTF-16 tests of step 3.

- [ ] **Step 6: Implement the native rules.** In `scripts/hygiene.ts`, find the comment line `// A co-author trailer or a tool's "Generated with ..." footer: commits carry the owner's name only.` and replace it with the block below, which ends with that same line:

```ts
// The native apps live in ios/, android/ and native-data/, and their documents under docs/superpowers (a plan or
// a spec with "native" in its path). The rules below apply to these paths only: the web files keep the
// conventions they were written under (the course content in content/raw holds em dashes, for example).
export const NATIVE_SCOPES: readonly RegExp[] = [/^ios\//, /^android\//, /^native-data\//, /^docs\/superpowers\/.*native/i];

export function inNativeScope(path: string): boolean {
  return NATIVE_SCOPES.some((scope) => scope.test(path));
}

const EM_DASH = "\u2014";

// One finding per line that holds an em dash: "<line>: em dash: U+2014".
export function emDashFindings(text: string): string[] {
  const found: string[] = [];
  text.split("\n").forEach((line, index) => {
    if (line.includes(EM_DASH)) found.push(`${index + 1}: em dash: U+2014`);
  });
  return found;
}

// Files that sign an app are told by their type, whatever they hold: the repository never carries one.
export const SIGNING_EXTENSIONS = [".jks", ".keystore", ".p12", ".mobileprovision"] as const;

export function signingFileFindings(path: string): string[] {
  const lower = path.toLowerCase();
  const extension = SIGNING_EXTENSIONS.find((candidate) => lower.endsWith(candidate));
  return extension ? [`signing file: ${extension}`] : [];
}

// The chunks in which a PNG carries text, a time stamp of an editor or a camera's EXIF block.
const PNG_METADATA_CHUNKS: ReadonlySet<string> = new Set(["tEXt", "zTXt", "iTXt", "eXIf"]);

// One finding for each kind of metadata chunk a PNG has, in file order. Chunks are walked by their headers up to
// IEND, and a chunk that runs past the end of the file still counts by its type. Bytes that do not start with the
// PNG signature are no PNG and have none.
export function pngMetadataFindings(bytes: Uint8Array): string[] {
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return [];
  const found: string[] = [];
  let offset = 8;
  while (offset + 12 <= buffer.length) {
    const type = buffer.toString("latin1", offset + 4, offset + 8);
    if (PNG_METADATA_CHUNKS.has(type) && !found.includes(`PNG metadata chunk: ${type}`)) found.push(`PNG metadata chunk: ${type}`);
    if (type === "IEND") break;
    offset += 12 + buffer.readUInt32BE(offset);
  }
  return found;
}

// What the native rules find in a file's name alone.
export function nativePathFindings(path: string): string[] {
  return inNativeScope(path) ? signingFileFindings(path) : [];
}

// Every finding in a whole file: the rules for every file (findingsInBytes) and, inside a native scope, the
// signing, em dash and PNG metadata rules. An em dash is looked for in text files only (no zero byte), because
// the bytes of a binary file, a font for example, are no text.
export function findingsForPath(path: string, bytes: Uint8Array): string[] {
  const found = findingsInBytes(bytes);
  if (!inNativeScope(path)) return found;
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return [
    ...found,
    ...nativePathFindings(path),
    ...(buffer.includes(0) ? [] : emDashFindings(buffer.toString("utf8"))),
    ...pngMetadataFindings(bytes),
  ];
}

// A co-author trailer or a tool's "Generated with ..." footer: commits carry the owner's name only.
```

`PNG_SIGNATURE` is declared earlier in the file; the functions only run after the module has loaded, so the order of the declarations does not matter.

Run `npx -y pnpm@10.34.0 vitest run tests/scripts/hygiene-native.test.ts` and `npx -y pnpm@10.34.0 typecheck`. Expected: `Tests  28 passed (28)`; typecheck prints `> tsc --noEmit` and nothing else.

- [ ] **Step 7: Write the failing tests for `scanFiles`.** In `tests/scripts/hygiene-native.test.ts`, replace the import lines

```ts
import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { findingsForPath, findingsInBytes, inNativeScope } from "@/scripts/hygiene";
```

with

```ts
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { deflateSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";
import { findingsForPath, findingsInBytes, inNativeScope, scanFiles } from "@/scripts/hygiene";
```

and append to the end of the file:

```ts

describe("scanFiles, the scan of the tracked-files test", () => {
  const made: string[] = [];
  afterEach(() => {
    for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  function tree(files: Record<string, string | Buffer>): string {
    const root = mkdtempSync(join(tmpdir(), "truthy-scan-"));
    made.push(root);
    for (const [path, content] of Object.entries(files)) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), content);
    }
    return root;
  }

  it("applies the native rules to the native folders and the base rules everywhere", () => {
    const root = tree({
      "README.md": "Truthy\n",
      "content/raw/a.json": `{"text": "a ${emDash} b"}\n`,
      "ios/Truthy/Strings.swift": `let a = "x ${emDash} y"\n`,
      "android/Truthy/app/release.keystore": "not a key",
      "native-data/icon.png": png(["tEXt", Buffer.from("Software\0Preview", "latin1")]),
      "notes.md": `see ${home}/notes.md\n`,
      "ios/Truthy/Clean.swift": "let a = 1\n",
    });
    expect(
      scanFiles(root, [
        "README.md",
        "content/raw/a.json",
        "ios/Truthy/Strings.swift",
        "android/Truthy/app/release.keystore",
        "native-data/icon.png",
        "notes.md",
        "ios/Truthy/Clean.swift",
        "ios/Truthy/Gone.swift",
      ]),
    ).toEqual([
      "ios/Truthy/Strings.swift:1: em dash: U+2014",
      "android/Truthy/app/release.keystore:signing file: .keystore",
      "native-data/icon.png:PNG metadata chunk: tEXt",
      `notes.md:1: absolute local path: ${home}`,
    ]);
  });

  it("reads a symbolic link as the text of its target, and judges its name by the native rules", () => {
    const root = tree({});
    mkdirSync(join(root, "ios"));
    symlinkSync(`${home}/notes.md`, join(root, "ios", "link.md"));
    symlinkSync("elsewhere", join(root, "ios", "release.p12"));
    expect(scanFiles(root, ["ios/link.md", "ios/release.p12"])).toEqual([
      `ios/link.md -> 1: absolute local path: ${home}`,
      "ios/release.p12:signing file: .p12",
    ]);
  });
});
```

Run `npx -y pnpm@10.34.0 vitest run tests/scripts/hygiene-native.test.ts`. Expected: `Tests  2 failed | 28 passed (30)`, both with `TypeError: scanFiles is not a function`.

- [ ] **Step 8: Implement `scanFiles` and let the tracked-files test use it.** In `scripts/hygiene.ts`, replace the first two lines of imports

```ts
import { execFileSync, spawnSync } from "node:child_process";
import { inflateSync } from "node:zlib";
```

with

```ts
import { execFileSync, spawnSync } from "node:child_process";
import { lstatSync, readFileSync, readlinkSync } from "node:fs";
import { join } from "node:path";
import { inflateSync } from "node:zlib";
```

and replace the comment line `// A co-author trailer or a tool's "Generated with ..." footer: commits carry the owner's name only.` with

```ts
// Every finding in the files `paths` (relative to `root`, for example the output of `git ls-files`), as
// "<path>:<finding>". A symbolic link is read as the text of its target, which is what gets published; a path that
// is gone from the working tree is skipped.
export function scanFiles(root: string, paths: readonly string[]): string[] {
  const found: string[] = [];
  for (const path of paths) {
    const full = join(root, path);
    let stats;
    try {
      stats = lstatSync(full);
    } catch {
      continue; // deleted in the working tree but not yet committed
    }
    if (stats.isSymbolicLink()) {
      for (const finding of findingsIn(readlinkSync(full))) found.push(`${path} -> ${finding}`);
      for (const finding of nativePathFindings(path)) found.push(`${path}:${finding}`);
      continue;
    }
    for (const finding of findingsForPath(path, readFileSync(full))) found.push(`${path}:${finding}`);
  }
  return found;
}

// A co-author trailer or a tool's "Generated with ..." footer: commits carry the owner's name only.
```

In `tests/repo-hygiene.test.ts`, replace the imports

```ts
import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync, readlinkSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { ALLOWED_EMAIL, findingsIn, findingsInBytes } from "@/scripts/hygiene";
import { png } from "@/tests/support/png";
```

with

```ts
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { ALLOWED_EMAIL, findingsIn, findingsInBytes, scanFiles } from "@/scripts/hygiene";
import { png } from "@/tests/support/png";
```

and replace the body of `scanRepository`

```ts
function scanRepository(): string[] {
  const found: string[] = [];
  for (const path of trackedFiles()) {
    const full = join(ROOT, path);
    let stats;
    try {
      stats = lstatSync(full);
    } catch {
      continue; // deleted in the working tree but not yet committed
    }
    if (stats.isSymbolicLink()) {
      // The link target is published as text.
      for (const finding of findingsIn(readlinkSync(full))) found.push(`${path} -> ${finding}`);
      continue;
    }
    for (const finding of findingsInBytes(readFileSync(full))) found.push(`${path}:${finding}`);
  }
  return found;
}
```

with

```ts
function scanRepository(): string[] {
  return scanFiles(ROOT, trackedFiles());
}
```

Run `npx -y pnpm@10.34.0 vitest run tests/scripts/hygiene-native.test.ts tests/repo-hygiene.test.ts`. Expected: `Tests  50 passed (50)` (30 and 20). Then check the scope boundary on the real tree, where the tracked-files test passes although tracked course files hold em dashes:

```bash
git grep -lI $'\xe2\x80\x94' | grep -v '^content/' | wc -l
```

Expected: `0` (every tracked file with an em dash is under `content/`, outside the native scopes; `git grep -lI $'\xe2\x80\x94' | wc -l` alone prints about sixty).

Commit:

```bash
git add scripts/hygiene.ts tests/repo-hygiene.test.ts tests/scripts/hygiene-native.test.ts
git commit -m "feat: reject em dashes, signing files and PNG metadata in the native folders"
```

- [ ] **Step 9: Write the failing tests for the hook.** These go in `tests/pre-push.test.ts`, whose helpers (`repo`, `commit`, `git`, `pushSetup`) build throwaway repositories and run `.githooks/pre-push` through a real `git push`. Four edits. Replace

```ts
import { ALLOWED_EMAIL, pushRanges, scanCommits } from "@/scripts/hygiene";
```

with

```ts
import { ALLOWED_EMAIL, pushRanges, scanCommits } from "@/scripts/hygiene";
import { png } from "@/tests/support/png";
```

Replace

```ts
const email = "someone" + "@" + "example.org";

const made: string[] = [];
```

with

```ts
const email = "someone" + "@" + "example.org";
const emDash = "\u2014"; // spelled with an escape, so that this file holds none

const made: string[] = [];
```

Replace the line `describe("pushRanges", () => {` with

```ts
describe("scanCommits, native scopes", () => {
  const plan = "docs/superpowers/plans/2026-10-15-truthy-native-a-shared-data/README.md";

  it("finds an em dash a commit adds under ios, android, native-data or a native document", () => {
    const dir = repo();
    const sha = commit(
      dir,
      {
        "ios/Truthy/Strings.swift": `let a = "x ${emDash} y"\n`,
        "android/Truthy/app/strings.xml": `<s>a ${emDash} b</s>\n`,
        "native-data/decks/index.json": `{"a": "${emDash}"}\n`,
        [plan]: `one ${emDash} two\n`,
      },
      "feat: native files",
    );
    expect(scanCommits(dir, [sha])).toEqual(
      ["android/Truthy/app/strings.xml", plan, "ios/Truthy/Strings.swift", "native-data/decks/index.json"].map(
        (path) => `${sha.slice(0, 7)} ${path}: em dash: U+2014`,
      ),
    );
  });

  it("finds an em dash in a file whose name is not ASCII, which git prints quoted", () => {
    const dir = repo();
    const sha = commit(dir, { "ios/Truthy/\u00c7evir.swift": `let a = "x ${emDash} y"\n` }, "feat: native file");
    expect(scanCommits(dir, [sha])).toEqual([`${sha.slice(0, 7)} ios/Truthy/\u00c7evir.swift: em dash: U+2014`]);
  });

  it("does not find an em dash a commit adds to a web file, or one a native file loses", () => {
    const dir = repo();
    const web = commit(dir, { "content/raw/a.json": `{"a": "${emDash}"}\n`, "src/a.ts": `// a ${emDash} b\n` }, "docs: web files");
    expect(scanCommits(dir, [web])).toEqual([]);
    const old = commit(dir, { "ios/Truthy/Strings.swift": `let a = "x ${emDash} y"\n` }, "feat: native file");
    const fix = commit(dir, { "ios/Truthy/Strings.swift": 'let a = "x, y"\n' }, "fix: no dash");
    expect(scanCommits(dir, [`${old}..${fix}`])).toEqual([]);
  });

  it("finds a signing file by its type and a PNG with a text chunk, but not the same files outside the native folders", () => {
    const dir = repo();
    const text = png(["tEXt", Buffer.from("Software\0Preview", "latin1")]);
    const sha = commit(
      dir,
      {
        "android/Truthy/app/release.keystore": Buffer.from([0, 1, 2, 0xfe]),
        "ios/Truthy/Dist.mobileprovision": "not a profile\n",
        "ios/Truthy/Assets/icon.png": text,
        "keys/release.jks": Buffer.from([0, 1, 2, 0xfe]),
        "public/icon.png": text,
      },
      "feat: files",
    );
    expect(scanCommits(dir, [sha]).sort()).toEqual(
      [
        `${sha.slice(0, 7)} android/Truthy/app/release.keystore: signing file: .keystore`,
        `${sha.slice(0, 7)} ios/Truthy/Assets/icon.png: PNG metadata chunk: tEXt`,
        `${sha.slice(0, 7)} ios/Truthy/Dist.mobileprovision: signing file: .mobileprovision`,
      ].sort(),
    );
  });

  it("finds a local path in the UTF-16 text of a binary file a commit adds", () => {
    const dir = repo();
    const font = Buffer.concat([Buffer.from([0, 1, 2, 3]), Buffer.from(`see ${home}/fonts`, "utf16le").swap16(), Buffer.from([0xff])]);
    const sha = commit(dir, { "android/Truthy/app/overpass.ttf": font }, "feat: font");
    expect(scanCommits(dir, [sha])).toEqual([`${sha.slice(0, 7)} android/Truthy/app/overpass.ttf: absolute local path: ${home}`]);
  });
});

describe("pushRanges", () => {
```

And at the end of the file, replace the last four lines (the ending of the last test of the `.githooks/pre-push` block and the closing of the `describe`)

```ts
    expect(push.status, push.stderr).toBe(0);
    expect(git(remote, ["rev-parse", "main"]).stdout.trim()).toBe(head);
  });
});
```

with

```ts
    expect(push.status, push.stderr).toBe(0);
    expect(git(remote, ["rev-parse", "main"]).stdout.trim()).toBe(head);
  });

  it("refuses a push that adds an em dash under ios, and lets the same em dash through in a web file", () => {
    const { dir, remote } = pushSetup();
    const base = commit(dir, { "README.md": "Truthy\n" }, "docs: readme");
    expect(git(dir, ["push", "-q", "origin", "main"]).status).toBe(0);
    const web = commit(dir, { "content/raw/a.json": `{"a": "${emDash}"}\n` }, "docs: web file");
    const native = commit(dir, { "ios/Truthy/Strings.swift": `let a = "x ${emDash} y"\n` }, "feat: native file");
    const refused = git(dir, ["push", "-q", "origin", "main"]);
    expect(refused.status).not.toBe(0);
    expect(refused.stderr).toContain(`${native.slice(0, 7)} ios/Truthy/Strings.swift: em dash: U+2014`);
    expect(refused.stderr).not.toContain(web.slice(0, 7));
    expect(git(remote, ["rev-parse", "main"]).stdout.trim()).toBe(base);
    git(dir, ["reset", "-q", "--hard", web]);
    const pushed = git(dir, ["push", "-q", "origin", "main"]);
    expect(pushed.status, pushed.stderr).toBe(0);
    expect(git(remote, ["rev-parse", "main"]).stdout.trim()).toBe(web);
  });

  it("refuses a push that adds a keystore under android, or a PNG with a text chunk under ios", () => {
    const { dir, remote } = pushSetup();
    const base = commit(dir, { "README.md": "Truthy\n" }, "docs: readme");
    expect(git(dir, ["push", "-q", "origin", "main"]).status).toBe(0);
    const key = commit(dir, { "android/Truthy/app/release.keystore": Buffer.from([0, 1, 2, 0xfe]) }, "feat: key");
    const text = commit(dir, { "ios/Truthy/Assets/icon.png": png(["tEXt", Buffer.from("Software\0Preview", "latin1")]) }, "feat: icon");
    const push = git(dir, ["push", "-q", "origin", "main"]);
    expect(push.status).not.toBe(0);
    expect(push.stderr).toContain(`${key.slice(0, 7)} android/Truthy/app/release.keystore: signing file: .keystore`);
    expect(push.stderr).toContain(`${text.slice(0, 7)} ios/Truthy/Assets/icon.png: PNG metadata chunk: tEXt`);
    expect(git(remote, ["rev-parse", "main"]).stdout.trim()).toBe(base);
  });
});
```

Run `npx -y pnpm@10.34.0 vitest run tests/pre-push.test.ts`. Expected: `Tests  5 failed | 17 passed (22)`. Three failures read `AssertionError: expected [] to deeply equal [ ... ]` (the scan finds nothing yet) and two, the pushes, read `AssertionError: expected +0 not to be +0` (the hook lets the push through). The 17 that pass include the clean-merge, deletion and UTF-16 tests, which hold before the change.

- [ ] **Step 10: Apply the native rules in `scanCommit`.** In `scripts/hygiene.ts`, replace

```ts
  for (const { path } of changes) {
    if (present(path)) report(path, findingsIn(path).map((finding) => `file name: ${finding.replace(/^\d+: /, "")}`));
  }

  for (const [path, lines] of addedLines(git(cwd, ["show", "--format=", "--unified=0", "--no-color", "--no-ext-diff", "--no-textconv", "--no-renames", sha]).toString("utf8"))) {
    report(path, lines.flatMap((line) => findingsIn(line)));
  }
  for (const { path, binary } of changes) {
    if (binary && present(path)) report(path, findingsInBytes(git(cwd, ["cat-file", "blob", `${sha}:${path}`])));
  }
  return found;
```

with

```ts
  for (const { path } of changes) {
    if (!present(path)) continue;
    report(path, findingsIn(path).map((finding) => `file name: ${finding.replace(/^\d+: /, "")}`));
    report(path, nativePathFindings(path));
  }

  // core.quotepath=false keeps a file name with letters outside ASCII unquoted, so that its scope is told.
  const patch = git(cwd, ["-c", "core.quotepath=false", "show", "--format=", "--unified=0", "--no-color", "--no-ext-diff", "--no-textconv", "--no-renames", sha]);
  for (const [path, lines] of addedLines(patch.toString("utf8"))) {
    report(path, lines.flatMap((line) => [...findingsIn(line), ...(inNativeScope(path) ? emDashFindings(line) : [])]));
  }
  for (const { path, binary } of changes) {
    if (!binary || !present(path)) continue;
    const blob = git(cwd, ["cat-file", "blob", `${sha}:${path}`]);
    report(path, [...findingsInBytes(blob), ...(inNativeScope(path) ? pngMetadataFindings(blob) : [])]);
  }
  return found;
```

`core.quotepath=false` matters for the em dash rule: git prints a file name with letters outside ASCII quoted (`"b/ios/\303\207evir.swift"`), the scope test would then not recognise the path, and the em dash would go unreported; the test `finds an em dash in a file whose name is not ASCII` fails without it.

Run `npx -y pnpm@10.34.0 vitest run tests/pre-push.test.ts`. Expected: `Tests  22 passed (22)` (the hook tests take about fifteen seconds in all).

- [ ] **Step 11: Run the gates and commit.**

```bash
npx -y pnpm@10.34.0 test
npx -y pnpm@10.34.0 typecheck
git add scripts/hygiene.ts tests/pre-push.test.ts
git commit -m "feat: apply the native hygiene rules to the commits the pre-push hook scans"
git status --short
```

Expected: `Test Files  151 passed (151)` and `Tests  3144 passed (3144)` on the tree this plan was written against (30 tests in the new file and 7 in `pre-push.test.ts` are the additions; a tree with other commits on `native` counts higher by what they add, and nothing fails); typecheck prints `> tsc --noEmit` only; `git status --short` prints nothing.

- [ ] **Step 12: Turn the hook on and confirm that it runs.** `git hook run` hands a hook no standard input unless asked, and the pre-push hook reads the refs from it, so the commands below write the line git would send into a file and pass it with `--to-stdin`.

```bash
git config core.hooksPath .githooks
git config --get core.hooksPath
stdin=$(mktemp)
printf 'refs/heads/native %s refs/heads/native %s\n' "$(git rev-parse HEAD)" 0000000000000000000000000000000000000000 > "$stdin"
git hook run --to-stdin="$stdin" pre-push -- origin none; echo "exit $?"
rm -f "$stdin"
```

Expected: `.githooks`, then `exit 0` with no other output. The line is the push of a new branch: the hook scans every commit of `native` that is on no remote branch yet, which includes the three commits of this task, the plan commit and whatever else was committed on the branch. If it lists findings instead, they are in those unpublished commits: fix them (the README forbids pushing `native` without the owner's approval, so rewriting local commits is safe) and run the commands again.

- [ ] **Step 13: Prove that the clone's hook rejects, without touching the branch.** The commands build a commit that exists in no branch (a temporary index, `git commit-tree`) and holds an em dash under `ios/`, then offer it to the hook:

```bash
index=$(mktemp -u)
blob=$(printf 'a \xe2\x80\x94 b\n' | git hash-object -w --stdin)
GIT_INDEX_FILE="$index" git read-tree HEAD
GIT_INDEX_FILE="$index" git update-index --add --cacheinfo "100644,$blob,ios/probe.txt"
probe=$(git commit-tree "$(GIT_INDEX_FILE="$index" git write-tree)" -p HEAD -m "chore: probe")
rm -f "$index"
stdin=$(mktemp)
printf 'refs/heads/native %s refs/heads/native %s\n' "$probe" 0000000000000000000000000000000000000000 > "$stdin"
git hook run --to-stdin="$stdin" pre-push -- origin none; echo "exit $?"
rm -f "$stdin"
git status --short
```

Expected (the short id differs):

```text
pre-push: the repository is public, and these commits would publish:
  dc752df ios/probe.txt: em dash: U+2014
Rewrite the commits (git rebase -i, git commit --amend), then push again.
exit 1
```

and nothing from `git status --short`: the probe commit has no branch and the next `git gc` discards it. The same em dash in a file outside the native folders is not reported; `tests/pre-push.test.ts` pins that case with real pushes.
