#!/usr/bin/env python3
"""Prints every record of a TrueType name table, decoded: platform 3 (Windows) and 0 (Unicode) as UTF-16BE, platform 1
(Mac) as Mac Roman. The repository's hygiene scan reads only ASCII runs and, with plan A, UTF-16 runs; this shows a
person what the file says before it is committed (reference 8.4)."""
import struct
import sys

def records(path):
    data = open(path, "rb").read()
    count = struct.unpack(">H", data[4:6])[0]
    tables = {}
    for i in range(count):
        tag, _, offset, length = struct.unpack(">4sIII", data[12 + 16 * i:28 + 16 * i])
        tables[tag.decode("latin-1")] = (offset, length)
    offset, _ = tables["name"]
    _, n, strings = struct.unpack(">HHH", data[offset:offset + 6])
    for i in range(n):
        platform, encoding, language, name_id, length, at = struct.unpack(">HHHHHH", data[offset + 6 + 12 * i:offset + 18 + 12 * i])
        raw = data[offset + strings + at:offset + strings + at + length]
        text = raw.decode("utf-16-be", "replace") if platform in (0, 3) else raw.decode("mac_roman", "replace")
        yield platform, encoding, language, name_id, text

if __name__ == "__main__":
    for path in sys.argv[1:]:
        print(f"== {path}")
        for platform, encoding, language, name_id, text in records(path):
            print(f"{platform}/{encoding}/{language} id {name_id}: {text}")
