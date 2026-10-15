// A small PNG reader and writer for the visual review: 8-bit RGB or RGBA, not interlaced, which is what the
// simulator, XCUITest and Playwright write. The writer emits only IHDR, IDAT and IEND (no text or EXIF chunk).
import { deflateSync, inflateSync } from "node:zlib";

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** @typedef {{ width: number, height: number, data: Uint8Array, profile: "srgb" | "icc" | "none" }} Image */

/**
 * Decodes a PNG into RGBA pixels. `profile` says how the file tags its colours: an sRGB chunk, an ICC profile
 * (which review.mjs converts to sRGB with sips before reading), or nothing (sRGB by convention).
 * @param {Uint8Array} bytes
 * @returns {Image}
 */
export function decodePng(bytes) {
  const buffer = Buffer.from(bytes);
  if (!buffer.subarray(0, 8).equals(SIGNATURE)) throw new Error("not a PNG");
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = -1;
  let profile = /** @type {"srgb" | "icc" | "none"} */ ("none");
  const idat = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("latin1", offset + 4, offset + 8);
    const body = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      const depth = body[8];
      colorType = body[9] ?? -1;
      const interlace = body[12];
      if (depth !== 8 || (colorType !== 2 && colorType !== 6) || interlace !== 0) {
        throw new Error(`unsupported PNG: depth ${depth}, colour type ${colorType}, interlace ${interlace}`);
      }
    } else if (type === "sRGB") {
      profile = "srgb";
    } else if (type === "iCCP") {
      profile = "icc";
    } else if (type === "IDAT") {
      idat.push(body);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }
  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(idat));
  const pixels = new Uint8Array(width * height * channels);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x += 1) {
      const left = x >= channels ? pixels[y * stride + x - channels] ?? 0 : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] ?? 0 : 0;
      const upLeft = y > 0 && x >= channels ? pixels[(y - 1) * stride + x - channels] ?? 0 : 0;
      const value = line[x] ?? 0;
      let predicted = 0;
      if (filter === 1) predicted = left;
      else if (filter === 2) predicted = up;
      else if (filter === 3) predicted = (left + up) >> 1;
      else if (filter === 4) predicted = paeth(left, up, upLeft);
      else if (filter !== 0) throw new Error(`unknown PNG filter ${filter}`);
      pixels[y * stride + x] = (value + predicted) & 0xff;
    }
  }
  if (channels === 4) return { width, height, data: pixels, profile };
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    rgba[i * 4] = pixels[i * 3] ?? 0;
    rgba[i * 4 + 1] = pixels[i * 3 + 1] ?? 0;
    rgba[i * 4 + 2] = pixels[i * 3 + 2] ?? 0;
    rgba[i * 4 + 3] = 255;
  }
  return { width, height, data: rgba, profile };
}

/** @param {number} a @param {number} b @param {number} c */
function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/**
 * Encodes RGBA pixels as a PNG with filter 0 on every row.
 * @param {{ width: number, height: number, data: Uint8Array }} image
 * @returns {Buffer}
 */
export function encodePng(image) {
  const { width, height, data } = image;
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    Buffer.from(data.buffer, data.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([SIGNATURE, chunk("IHDR", header), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

/** @param {string} type @param {Buffer} body */
function chunk(type, body) {
  const out = Buffer.alloc(12 + body.length);
  out.writeUInt32BE(body.length, 0);
  out.write(type, 4, "latin1");
  body.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + body.length)), 8 + body.length);
  return out;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

/** @param {Uint8Array} bytes */
export function crc32(bytes) {
  let c = 0xffffffff;
  for (const byte of bytes) c = (CRC_TABLE[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * The RGB of the pixel at (x, y), clamped to the image.
 * @param {Image} image @param {number} x @param {number} y
 * @returns {[number, number, number]}
 */
export function pixelAt(image, x, y) {
  const cx = Math.min(image.width - 1, Math.max(0, Math.round(x)));
  const cy = Math.min(image.height - 1, Math.max(0, Math.round(y)));
  const i = (cy * image.width + cx) * 4;
  return [image.data[i] ?? 0, image.data[i + 1] ?? 0, image.data[i + 2] ?? 0];
}
