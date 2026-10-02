import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync, readlinkSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { ALLOWED_EMAIL, findingsIn, findingsInBytes } from "@/scripts/hygiene";

// The rules live in scripts/hygiene.ts, shared with the pre-push hook.
const ROOT = join(import.meta.dirname, "..");

function trackedFiles(): string[] {
  const out = execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" });
  return out.split("\0").filter((path) => path.length > 0);
}

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

describe("hygiene rules", () => {
  // Samples are built from pieces so that this file never contains what it looks for.
  const home = "/" + "Users/alex";
  const temp = "/" + "private/tmp/tool.mjs";
  const key = "AKIA" + "ABCDEFGHIJKLMNOP";
  const email = "someone" + "@" + "example.org";

  it("flags a home folder path", () => {
    expect(findingsIn(`see ${home}/notes.md`)).toEqual([`1: absolute local path: ${home}`]);
  });

  it("flags a temp folder path", () => {
    expect(findingsIn(`node ${temp}`)).toEqual([`1: absolute local path: ${temp}`]);
  });

  it("flags a home folder encoded into a folder name", () => {
    expect(findingsIn("~/.cache/projects/" + "-Users-" + "alex-work/*.jsonl")).toHaveLength(1);
  });

  it("leaves web URLs that happen to contain /home/ alone", () => {
    expect(findingsIn("https://cloud.google.com/home/dashboard")).toEqual([]);
  });

  it("flags an AWS access key id and a GitHub token", () => {
    expect(findingsIn(key)).toEqual([`1: AWS access key id: ${key}`]);
    expect(findingsIn("token=" + "ghp_" + "a".repeat(36))).toHaveLength(1);
  });

  it("does not mistake a hyphenated word ending in sk for a key", () => {
    expect(findingsIn('"datasync-task-runs-versus-live-mount"')).toEqual([]);
  });

  it("flags a WSL, root or mounted volume path, but not the same words inside a web URL", () => {
    const wsl = "/mnt/c/" + "Users/alex";
    const root = "/ro" + "ot/.aws";
    const volume = "/Vol" + "umes/WorkDisk";
    expect(findingsIn(`${wsl}/notes.md`)).toEqual([`1: absolute local path: ${wsl}`]);
    expect(findingsIn(`cat ${root}/credentials`)).toEqual([`1: absolute local path: ${root}`]);
    expect(findingsIn(`${volume}/alex/notes.md`)).toEqual([`1: absolute local path: ${volume}`]);
    expect(findingsIn("https://example.org" + "/ro" + "ot/docs and https://example.org" + "/Vol" + "umes/x")).toEqual([]);
  });

  it("flags a folder under the home folder's Desktop, Documents or Downloads, which shows the machine's layout", () => {
    for (const folder of ["Desktop", "Documents", "Downloads"]) {
      const path = "~/" + folder + "/";
      expect(findingsIn(`cd ${path}workspace/x`), folder).toEqual([`1: home folder layout: ${path}`]);
    }
    expect(findingsIn("~/.claude/paste-cache/*")).toEqual([]);
  });

  it("flags a per-user temp folder named with the user id", () => {
    const folder = "claude" + "-502";
    expect(findingsIn(`/tmp/${folder}/project/scratchpad`)).toEqual([`1: per-user temp folder: ${folder}`]);
    expect(findingsIn("the claude-code docs and claude-3 models")).toEqual([]);
  });

  it("flags a Windows user path, also when it is escaped inside JSON", () => {
    const plain = "C:\\" + "Users\\alex";
    const escaped = "C:\\\\" + "Users\\\\alex";
    expect(findingsIn(`${plain}\\notes.md`)).toEqual([`1: Windows user path: ${plain}`]);
    expect(findingsIn(`{"file": "${escaped}\\\\notes.md"}`)).toEqual([`1: Windows user path: ${escaped}`]);
  });

  it("flags a GitLab, npm, Stripe or Google OAuth secret", () => {
    const tokens = [
      "glp" + "at-" + "Ab3dEf6hIj9kLm2nOp5q",
      "np" + "m_" + "A".repeat(36),
      "sk_" + "live_" + "4eC39HqLyjWDarjtT1zdp7dc",
      "rk_" + "live_" + "4eC39HqLyjWDarjtT1zdp7dc",
      "GOC" + "SPX-" + "a1B2c3D4e5F6g7H8i9J0k1L2m3N4",
    ];
    for (const token of tokens) expect(findingsIn(`token=${token}`), token).toEqual([`1: API key: ${token}`]);
  });

  it("flags a Slack webhook URL", () => {
    const hook = "https://hooks.sl" + "ack.com/services/" + "T00000000/B00000000/" + "X".repeat(24);
    expect(findingsIn(hook)).toEqual([`1: Slack webhook: ${hook.slice("https://".length)}`]);
  });

  it("flags a JSON web token", () => {
    const jwt = "eyJ" + "hbGciOiJIUzI1NiJ9" + ".eyJ" + "zdWIiOiJhbGV4In0" + ".abcDEFghiJKLmnoPQRstuVWXyz0123456789abcd";
    expect(findingsIn(`Authorization: Bearer ${jwt}`)).toEqual([`1: JSON web token: ${jwt}`]);
  });

  it("flags an AWS secret access key value, but not the setting's name on its own", () => {
    const line = "aws_secret_" + "access_key = " + "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
    expect(findingsIn(line)).toEqual([`1: AWS secret access key: ${line}`]);
    expect(findingsIn("AWS_SECRET_" + "ACCESS_KEY: " + '"' + "a".repeat(40) + '"')).toHaveLength(1);
    expect(findingsIn("Set aws_secret_" + "access_key in the credentials file.")).toEqual([]);
  });

  it("flags any e-mail address except the GitHub noreply one", () => {
    expect(findingsIn(`write to ${email}`)).toEqual([`1: e-mail address: ${email}`]);
    expect(findingsIn(`Author: EienMosu <${ALLOWED_EMAIL}>`)).toEqual([]);
  });
});

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

describe("binary files", () => {
  const home = "/" + "Users/alex";
  const email = "someone" + "@" + "example.org";

  // A binary file has no lines, so its findings carry no line number.
  it("flags a local path or an e-mail address in a PNG text chunk, plain, compressed or international", () => {
    const text = png(["tEXt", Buffer.from(`Comment\0${home}/Pictures/shot.png`, "latin1")]);
    expect(findingsInBytes(text)).toEqual([`absolute local path: ${home}`]);
    const compressed = png(["zTXt", Buffer.concat([Buffer.from("Comment\0\0", "latin1"), deflateSync(`by ${email}`)])]);
    expect(findingsInBytes(compressed)).toEqual([`e-mail address: ${email}`]);
    const international = png(["iTXt", Buffer.from(`XML:com.adobe.xmp\0\0\0en\0\0<x:path>${home}/Desktop</x:path>`, "utf8")]);
    expect(findingsInBytes(international)).toEqual([`absolute local path: ${home}`]);
    const compressedInternational = png([
      "iTXt",
      Buffer.concat([Buffer.from("Description\0\x01\0\0\0", "latin1"), deflateSync(`${home}/notes.md`)]),
    ]);
    expect(findingsInBytes(compressedInternational)).toEqual([`absolute local path: ${home}`]);
  });

  it("flags a local path in a PNG's EXIF data", () => {
    const exif = png(["eXIf", Buffer.concat([Buffer.from("MM\0*\0\0\0\x08", "latin1"), Buffer.from(`\0\0${home}/Pictures\0`, "latin1")])]);
    expect(findingsInBytes(exif)).toEqual([`absolute local path: ${home}`]);
  });

  it("does not read the compressed pixels of a PNG as text", () => {
    // Pixel data can hold any bytes, an e-mail shape among them; only the text chunks are read.
    expect(findingsInBytes(png(["IDAT", Buffer.from(`\0\x01${email}\0`, "latin1")]))).toEqual([]);
  });

  it("flags a local path in the readable text of another binary file, or of a broken PNG", () => {
    const other = Buffer.concat([Buffer.from([0, 1, 2, 3]), Buffer.from(`${home}/fonts/x.woff2`, "latin1"), Buffer.from([0, 0xff])]);
    expect(findingsInBytes(other)).toEqual([`absolute local path: ${home}`]);
    const broken = Buffer.concat([png().subarray(0, 8), Buffer.from(`\0\0\0\0tEXtComment\0${home}/shot.png`, "latin1")]);
    expect(findingsInBytes(broken)).toEqual([`absolute local path: ${home}`]);
  });
});

describe("tracked files", () => {
  it("contain no local paths, foreign e-mail addresses or secrets", () => {
    expect(scanRepository()).toEqual([]);
  });
});
