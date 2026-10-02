import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync, readlinkSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ALLOWED_EMAIL, findingsIn } from "@/scripts/hygiene";

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
    const bytes = readFileSync(full);
    if (bytes.includes(0)) continue; // binary (images, fonts)
    for (const finding of findingsIn(bytes.toString("utf8"))) found.push(`${path}:${finding}`);
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

describe("tracked files", () => {
  it("contain no local paths, foreign e-mail addresses or secrets", () => {
    expect(scanRepository()).toEqual([]);
  });
});
