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
