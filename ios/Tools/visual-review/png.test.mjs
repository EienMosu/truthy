import assert from "node:assert/strict";
import { test } from "node:test";
import { deflateSync } from "node:zlib";
import { crc32, decodePng, encodePng, pixelAt } from "./png.mjs";

/** A 3 by 2 RGBA image whose every byte differs. */
function sample() {
  const data = new Uint8Array(3 * 2 * 4);
  for (let i = 0; i < data.length; i += 1) data[i] = (i * 37 + 11) & 0xff;
  return { width: 3, height: 2, data };
}

test("crc32 is the PNG checksum", () => {
  assert.equal(crc32(Buffer.from("IEND", "latin1")), 0xae426082);
});

test("an encoded image decodes to the same pixels, untagged", () => {
  const image = sample();
  const decoded = decodePng(encodePng(image));
  assert.equal(decoded.width, 3);
  assert.equal(decoded.height, 2);
  assert.equal(decoded.profile, "none");
  assert.deepEqual([...decoded.data], [...image.data]);
});

test("the encoder writes only IHDR, IDAT and IEND", () => {
  const png = encodePng(sample());
  const types = [];
  for (let offset = 8; offset < png.length; offset += 12 + png.readUInt32BE(offset)) {
    types.push(png.toString("latin1", offset + 4, offset + 8));
  }
  assert.deepEqual(types, ["IHDR", "IDAT", "IEND"]);
});

/** Builds a PNG by hand from RGB rows, each row with its own filter type. */
function filteredRgbPng(rows, filters, tags = []) {
  const width = rows[0].length / 3;
  const lines = [];
  rows.forEach((row, y) => {
    const filter = filters[y];
    const previous = y > 0 ? rows[y - 1] : new Array(row.length).fill(0);
    const out = [filter];
    for (let x = 0; x < row.length; x += 1) {
      const left = x >= 3 ? row[x - 3] : 0;
      const up = previous[x];
      const upLeft = x >= 3 ? previous[x - 3] : 0;
      let predicted = 0;
      if (filter === 1) predicted = left;
      if (filter === 2) predicted = up;
      if (filter === 3) predicted = (left + up) >> 1;
      if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        predicted = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      }
      out.push((row[x] - predicted) & 0xff);
    }
    lines.push(...out);
  });
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(rows.length, 4);
  header[8] = 8;
  header[9] = 2;
  const chunk = (type, body) => {
    const out = Buffer.alloc(12 + body.length);
    out.writeUInt32BE(body.length, 0);
    out.write(type, 4, "latin1");
    body.copy(out, 8);
    out.writeUInt32BE(crc32(out.subarray(4, 8 + body.length)), 8 + body.length);
    return out;
  };
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    ...tags.map((type) => chunk(type, Buffer.from([0]))),
    chunk("IDAT", deflateSync(Buffer.from(lines))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

test("RGB rows with the Sub, Up, Average and Paeth filters decode to RGBA", () => {
  const rows = [
    [10, 20, 30, 200, 100, 50],
    [11, 22, 33, 199, 98, 47],
    [250, 5, 128, 3, 255, 64],
    [0, 0, 0, 255, 255, 255],
    [17, 34, 51, 68, 85, 102],
  ];
  const image = decodePng(filteredRgbPng(rows, [1, 2, 3, 4, 0]));
  assert.equal(image.width, 2);
  assert.equal(image.height, 5);
  rows.forEach((row, y) => {
    assert.deepEqual(pixelAt(image, 0, y), row.slice(0, 3));
    assert.deepEqual(pixelAt(image, 1, y), row.slice(3, 6));
  });
  assert.equal(image.data[3], 255);
});

test("the colour tag is read: an sRGB chunk, an ICC profile", () => {
  const rows = [[1, 2, 3]];
  assert.equal(decodePng(filteredRgbPng(rows, [0], ["sRGB"])).profile, "srgb");
  assert.equal(decodePng(filteredRgbPng(rows, [0], ["iCCP"])).profile, "icc");
});

test("pixelAt clamps to the image", () => {
  const image = decodePng(encodePng(sample()));
  assert.deepEqual(pixelAt(image, -5, -5), pixelAt(image, 0, 0));
  assert.deepEqual(pixelAt(image, 99, 99), pixelAt(image, 2, 1));
});
