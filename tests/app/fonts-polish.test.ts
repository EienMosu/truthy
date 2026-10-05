import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { brotliDecompressSync } from "node:zlib";
import { describe, expect, it } from "vitest";

// The fonts ship from app/fonts (app/layout.tsx), so the build fetches nothing and the arrows the screens draw
// come from Overpass itself rather than from a stretched fallback.
const FONTS = "app/fonts";
const FILES = [
  { file: "overpass-600.woff2", family: "Overpass", weight: 600 },
  { file: "overpass-800.woff2", family: "Overpass", weight: 800 },
  { file: "overpass-mono-400.woff2", family: "Overpass Mono", weight: 400 },
  { file: "overpass-mono-600.woff2", family: "Overpass Mono", weight: 600 },
];

// The arrows in the start flow, the route line, the swipe hints and the pills, all left out of Google's latin files.
const ARROWS = [0x2190, 0x2192];

// WOFF2 (https://www.w3.org/TR/WOFF2/): a table directory, then every table in one brotli stream, in directory order.
// Only cmap and OS/2 are read here, and WOFF2 never transforms either of them.
const KNOWN_TAGS = ["cmap", "head", "hhea", "hmtx", "maxp", "name", "OS/2", "post", "cvt ", "fpgm", "glyf", "loca", "prep"];

function base128(bytes: Buffer, at: { offset: number }): number {
  let value = 0;
  for (let i = 0; i < 5; i += 1) {
    const byte = bytes[at.offset++] ?? 0;
    value = value * 128 + (byte & 0x7f);
    if ((byte & 0x80) === 0) return value;
  }
  throw new Error("UIntBase128 longer than five bytes");
}

function woff2Tables(bytes: Buffer): Map<string, Buffer> {
  expect(bytes.toString("latin1", 0, 4)).toBe("wOF2");
  const count = bytes.readUInt16BE(12);
  const compressed = bytes.readUInt32BE(20);
  const at = { offset: 48 };
  const entries: { tag: string; length: number }[] = [];
  for (let i = 0; i < count; i += 1) {
    const flags = bytes[at.offset++] ?? 0;
    let tag = KNOWN_TAGS[flags & 0x3f] ?? "";
    if ((flags & 0x3f) === 63) {
      tag = bytes.toString("latin1", at.offset, at.offset + 4);
      at.offset += 4;
    }
    const version = flags >> 6;
    const original = base128(bytes, at);
    // glyf and loca are transformed under version 0, every other table under any version but 0.
    const transformed = tag === "glyf" || tag === "loca" ? version !== 3 : version !== 0;
    entries.push({ tag, length: transformed ? base128(bytes, at) : original });
  }
  const stream = brotliDecompressSync(bytes.subarray(at.offset, at.offset + compressed));
  const tables = new Map<string, Buffer>();
  let offset = 0;
  for (const { tag, length } of entries) {
    tables.set(tag, stream.subarray(offset, offset + length));
    offset += length;
  }
  return tables;
}

// The glyph a Windows Unicode cmap subtable (format 4 or 12) gives a code point, 0 when it has none.
function glyphFor(cmap: Buffer, codePoint: number): number {
  const count = cmap.readUInt16BE(2);
  for (let i = 0; i < count; i += 1) {
    const platform = cmap.readUInt16BE(4 + i * 8);
    const encoding = cmap.readUInt16BE(6 + i * 8);
    if (platform !== 3 || (encoding !== 1 && encoding !== 10)) continue;
    const table = cmap.subarray(cmap.readUInt32BE(8 + i * 8));
    const format = table.readUInt16BE(0);
    if (format === 12) {
      const groups = table.readUInt32BE(12);
      for (let g = 0; g < groups; g += 1) {
        const start = table.readUInt32BE(16 + g * 12);
        const end = table.readUInt32BE(20 + g * 12);
        if (codePoint >= start && codePoint <= end) return table.readUInt32BE(24 + g * 12) + codePoint - start;
      }
      return 0;
    }
    if (format === 4) {
      const segments = table.readUInt16BE(6) / 2;
      const ends = 14;
      const starts = ends + segments * 2 + 2;
      const deltas = starts + segments * 2;
      const ranges = deltas + segments * 2;
      for (let s = 0; s < segments; s += 1) {
        const end = table.readUInt16BE(ends + s * 2);
        const start = table.readUInt16BE(starts + s * 2);
        if (codePoint > end || codePoint < start) continue;
        const delta = table.readUInt16BE(deltas + s * 2);
        const range = table.readUInt16BE(ranges + s * 2);
        if (range === 0) return (codePoint + delta) & 0xffff;
        const glyph = table.readUInt16BE(ranges + s * 2 + range + (codePoint - start) * 2);
        return glyph === 0 ? 0 : (glyph + delta) & 0xffff;
      }
    }
  }
  return 0;
}

function font(file: string): Map<string, Buffer> {
  return woff2Tables(readFileSync(join(FONTS, file)));
}

describe("self-hosted fonts", () => {
  it("ship as the four woff2 files app/layout.tsx loads, next to the OFL text, and nothing else", () => {
    expect(readdirSync(FONTS).sort()).toEqual([...FILES.map(({ file }) => file), "OFL.txt"].sort());
    const layout = readFileSync("app/layout.tsx", "utf8");
    for (const { file } of FILES) expect(layout).toContain(`"./fonts/${file}"`);
  });

  it.each(FILES)("$file is $family at weight $weight", ({ file, family, weight }) => {
    const tables = font(file);
    expect(tables.get("OS/2")?.readUInt16BE(4)).toBe(weight);
    // The name table holds its Windows names in UTF-16 big-endian.
    expect(tables.get("name")?.includes(Buffer.from(family, "utf16le").swap16())).toBe(true);
  });

  it.each(FILES)("$file draws the left and right arrows, the latin letters and the typographic quotes", ({ file }) => {
    const cmap = font(file).get("cmap");
    expect(cmap).toBeDefined();
    if (!cmap) return;
    for (const codePoint of [...ARROWS, 0x41, 0x7a, 0xe9, 0xb7, 0x2013, 0x2019, 0x201c]) {
      expect(glyphFor(cmap, codePoint), `U+${codePoint.toString(16).toUpperCase()}`).toBeGreaterThan(0);
    }
  });

  it("carries the copyright notice and the SIL Open Font License, as the OFL asks", () => {
    const ofl = readFileSync(join(FONTS, "OFL.txt"), "utf8");
    expect(ofl.startsWith("Copyright 2021 The Overpass Project Authors (https://github.com/RedHatOfficial/Overpass)\n")).toBe(true);
    expect(ofl).toContain("SIL OPEN FONT LICENSE Version 1.1");
    const readme = readFileSync("README.md", "utf8");
    expect(readme).toContain("[SIL Open Font License 1.1](app/fonts/OFL.txt)");
  });

  it("are never fetched from Google at build time", () => {
    const sources = ["app", "components", "src"].flatMap((folder) =>
      readdirSync(folder, { recursive: true, encoding: "utf8" })
        .filter((path) => /\.(ts|tsx)$/.test(path))
        .map((path) => join(folder, path)),
    );
    expect(sources.length).toBeGreaterThan(10);
    for (const path of sources) expect(readFileSync(path, "utf8"), path).not.toContain("next/font/google");
  });
});
