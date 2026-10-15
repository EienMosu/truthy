import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ALLOWED_EMAIL } from "@/scripts/hygiene";

// Vercel runs vercel.json's ignoreCommand at the repository root once a build starts: exit 0 skips the build, any other
// exit code builds (Vercel documents 1 and 0; a failed git diff exits 128, which builds). These tests run the committed
// command, through sh as Vercel does, in throwaway repositories, and read the exit code.
const COMMAND: string = JSON.parse(readFileSync(join(import.meta.dirname, "..", "vercel.json"), "utf8")).ignoreCommand;

const made: string[] = [];
afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

// git and sh without the variables of an outer git process (this suite may itself run inside a hook).
function cleanEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, ...extra };
  for (const name of Object.keys(env)) if ((name.startsWith("GIT_") || name === "VERCEL_GIT_PREVIOUS_SHA") && !(name in extra)) delete env[name];
  return env;
}

function git(cwd: string, args: string[]): string {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", env: cleanEnv() });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")}: ${result.stderr}`);
  return result.stdout.trim();
}

function repo(): string {
  const dir = mkdtempSync(join(tmpdir(), "truthy-ignore-"));
  made.push(dir);
  git(dir, ["init", "-q", "-b", "main"]);
  git(dir, ["config", "user.name", "EienMosu"]);
  git(dir, ["config", "user.email", ALLOWED_EMAIL]);
  git(dir, ["config", "commit.gpgsign", "false"]);
  return dir;
}

// One commit that writes the given files; returns its sha.
function commit(dir: string, files: string[]): string {
  for (const path of files) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), `${path} ${Math.random()}\n`);
  }
  git(dir, ["add", "-A"]);
  git(dir, ["commit", "-q", "-m", `chore: ${files.join(" ")}`]);
  return git(dir, ["rev-parse", "HEAD"]);
}

// The exit code of the command in a repository; `previous` is VERCEL_GIT_PREVIOUS_SHA, left out when undefined.
function exitCode(dir: string, previous?: string, command: string = COMMAND): number | null {
  const extra: Record<string, string> = previous === undefined ? {} : { VERCEL_GIT_PREVIOUS_SHA: previous };
  return spawnSync("sh", ["-c", command], { cwd: dir, encoding: "utf8", env: cleanEnv(extra) }).status;
}

const SKIP = 0;

describe("vercel.json ignoreCommand", () => {
  it("skips a commit that touches only ios, android and native-data, whatever the files below them", () => {
    const dir = repo();
    const deployed = commit(dir, ["package.json", "src/a.ts"]);
    commit(dir, ["ios/Truthy/App.swift", "android/Truthy/app/build.gradle.kts", "native-data/manifest.json", "native-data/golden/a.b.json"]);
    expect(exitCode(dir, deployed)).toBe(SKIP);
    expect(exitCode(dir)).toBe(SKIP); // no variable: the last commit is the base
  });

  it("builds a commit that touches anything else, alone or beside native files", () => {
    for (const web of ["src/engine/deal.ts", "package.json", "content/catalog.json", "docs/testing.md", "vercel.json", ".github/workflows/ci.yml"]) {
      const dir = repo();
      const deployed = commit(dir, ["package.json"]);
      commit(dir, ["ios/Truthy/App.swift", web, "native-data/manifest.json"]);
      expect(exitCode(dir, deployed), web).toBe(1);
    }
  });

  it("excludes the three folders by name, not by prefix: a file that merely starts with ios or android builds", () => {
    for (const name of ["ios-notes.md", "android.md", "native-data.json", "iosx/readme.md"]) {
      const dir = repo();
      const deployed = commit(dir, ["package.json"]);
      commit(dir, [name]);
      expect(exitCode(dir, deployed), name).toBe(1);
    }
  });

  it("builds when an earlier commit since the last deploy touched the web, although the last commit is native-only", () => {
    const dir = repo();
    const deployed = commit(dir, ["src/a.ts"]);
    commit(dir, ["src/engine/deal.ts"]);
    commit(dir, ["ios/Truthy/App.swift"]);
    expect(exitCode(dir, deployed)).toBe(1);
    // The old fallback alone would have skipped it: the last commit is the only one it looks at.
    expect(exitCode(dir, undefined, "git diff --quiet HEAD^ HEAD -- . ':!ios' ':!android' ':!native-data'")).toBe(SKIP);
  });

  it("keeps skipping a run of native-only commits after a skipped build, because the base is the last deployed commit", () => {
    const dir = repo();
    const deployed = commit(dir, ["src/a.ts"]);
    commit(dir, ["ios/a.swift"]);
    commit(dir, ["android/b.kt"]);
    commit(dir, ["native-data/c.json"]);
    expect(exitCode(dir, deployed)).toBe(SKIP);
  });

  it("falls back to the last commit when the variable is empty, a branch's first deploy", () => {
    const dir = repo();
    commit(dir, ["src/a.ts"]);
    commit(dir, ["ios/a.swift"]);
    expect(exitCode(dir, "")).toBe(SKIP);
    commit(dir, ["src/b.ts"]);
    expect(exitCode(dir, "")).toBe(1);
  });

  it("builds when the base cannot be found, as in Vercel's shallow clone, or when there is no commit before the last", () => {
    const dir = repo();
    commit(dir, ["src/a.ts"]);
    commit(dir, ["ios/a.swift"]);
    expect(exitCode(dir, "0".repeat(40))).toBe(128);
    const single = repo();
    commit(single, ["ios/a.swift"]);
    expect(exitCode(single)).toBe(128);
  });
});
