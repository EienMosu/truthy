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
