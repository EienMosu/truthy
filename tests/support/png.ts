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
