import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync, readlinkSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The repository is public. Nothing tracked may reveal a local machine, a work identity or a secret.
const ROOT = join(import.meta.dirname, "..");
const ALLOWED_EMAIL = "EienMosu@users.noreply.github.com";

const RULES: readonly { name: string; pattern: RegExp }[] = [
  // A slash-led home or temp path, but not the same words inside a web URL ("example.com/home/x").
  { name: "absolute local path", pattern: /(?<![\w.-])(?:\/Users|\/home|\/private\/tmp|\/private\/var|\/var\/folders)\/[\w.-]+/ },
  { name: "Windows user path", pattern: /\b[A-Za-z]:\\Users\\[\w.-]+/ },
  // Tools encode a home folder into a folder name, for example a transcript folder per project.
  { name: "encoded local path", pattern: /-Users-[A-Za-z0-9.]+-/ },
  { name: "AWS access key id", pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { name: "GitHub token", pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,})/ },
  { name: "API key", pattern: /\b(?:sk-[A-Za-z0-9_-]{20,}|xox[abprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{35})/ },
  { name: "private key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
];
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;

function findingsIn(text: string): string[] {
  const found: string[] = [];
  text.split("\n").forEach((line, index) => {
    for (const rule of RULES) {
      const match = rule.pattern.exec(line);
      if (match) found.push(`${index + 1}: ${rule.name}: ${match[0]}`);
    }
    for (const match of line.matchAll(EMAIL)) {
      if (match[0] !== ALLOWED_EMAIL) found.push(`${index + 1}: e-mail address: ${match[0]}`);
    }
  });
  return found;
}

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
