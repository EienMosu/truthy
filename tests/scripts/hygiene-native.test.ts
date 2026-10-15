import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { deflateSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";
import { findingsForPath, findingsInBytes, inNativeScope, scanFiles } from "@/scripts/hygiene";
import { png } from "@/tests/support/png";

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
