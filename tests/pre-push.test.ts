import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ALLOWED_EMAIL, pushRanges, scanCommits } from "@/scripts/hygiene";

// The pre-push gate scans every commit about to be pushed, not only the tree it ends with: a public
// repository publishes each commit. These tests build throwaway repositories in the system temp folder.
const HOOKS = join(import.meta.dirname, "..", ".githooks");
const ZERO = "0".repeat(40);

// Samples are built from pieces so that this file never contains what it looks for.
const home = "/" + "Users/alex";
const email = "someone" + "@" + "example.org";

const made: string[] = [];
afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

// git without the variables of an outer git process (this suite may itself run inside a hook).
function git(cwd: string, args: string[], extraEnv: Record<string, string> = {}, { allowFailure = false } = {}) {
  const env = { ...process.env, ...extraEnv };
  for (const name of Object.keys(env)) if (name.startsWith("GIT_") && !(name in extraEnv)) delete env[name];
  const result = spawnSync("git", args, { cwd, encoding: "utf8", env });
  if (result.status !== 0 && !allowFailure && !args.includes("push")) throw new Error(`git ${args.join(" ")}: ${result.stderr}`);
  return result;
}

function repo(): string {
  const dir = mkdtempSync(join(tmpdir(), "truthy-prepush-"));
  made.push(dir);
  git(dir, ["init", "-q", "-b", "main"]);
  git(dir, ["config", "user.name", "EienMosu"]);
  git(dir, ["config", "user.email", ALLOWED_EMAIL]);
  git(dir, ["config", "commit.gpgsign", "false"]);
  return dir;
}

function commit(dir: string, files: Record<string, string | Buffer>, message: string, extraEnv: Record<string, string> = {}): string {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
  git(dir, ["add", "-A"]);
  git(dir, ["commit", "-q", "--allow-empty", "-m", message], extraEnv);
  return git(dir, ["rev-parse", "HEAD"]).stdout.trim();
}

describe("scanCommits", () => {
  it("finds a local path that one commit adds and a later commit removes, although the final tree is clean", () => {
    const dir = repo();
    commit(dir, { "README.md": "Truthy\n" }, "docs: readme");
    const leak = commit(dir, { "notes.md": `see ${home}/notes.md\n` }, "docs: notes");
    const head = commit(dir, { "notes.md": "see the notes\n" }, "docs: no path");
    expect(git(dir, ["show", `${head}:notes.md`]).stdout).toBe("see the notes\n"); // the head tree has no path
    expect(scanCommits(dir, [head])).toEqual([`${leak.slice(0, 7)} notes.md: absolute local path: ${home}`]);
  });

  it("finds nothing in clean commits", () => {
    const dir = repo();
    const head = commit(dir, { "a.md": "one\n", "b.md": "two\n" }, "docs: two files");
    expect(scanCommits(dir, [head])).toEqual([]);
  });

  it("finds an author or committer e-mail address other than the GitHub noreply one", () => {
    const dir = repo();
    const sha = commit(dir, { "a.md": "one\n" }, "docs: one", { GIT_AUTHOR_EMAIL: email });
    const next = commit(dir, { "b.md": "two\n" }, "docs: two", { GIT_COMMITTER_EMAIL: email });
    expect(scanCommits(dir, [next])).toEqual([
      `${next.slice(0, 7)} committer: e-mail address: ${email}`,
      `${sha.slice(0, 7)} author: e-mail address: ${email}`,
    ]);
  });

  it("finds a co-author or tool attribution line, or a leak, in a commit message", () => {
    const dir = repo();
    const trailer = "Co-authored-" + `by: A Person <${email}>`;
    const coauthor = commit(dir, {}, `docs: one\n\n${trailer}`);
    const tool = commit(dir, {}, "docs: two\n\n" + "Gener" + "ated with Some Tool");
    const path = commit(dir, {}, `docs: three, written in ${home}/x`);
    expect(scanCommits(dir, [path])).toEqual([
      `${path.slice(0, 7)} message: absolute local path: ${home}`,
      `${tool.slice(0, 7)} message: attribution line: ${"Gener" + "ated with Some Tool"}`,
      `${coauthor.slice(0, 7)} message: e-mail address: ${email}`,
      `${coauthor.slice(0, 7)} message: attribution line: ${trailer}`,
    ]);
  });

  it("finds a local path in a binary file a commit adds, and in a file name", () => {
    const dir = repo();
    const blob = Buffer.concat([Buffer.from([0, 1, 2]), Buffer.from(`${home}/Pictures/shot.png`, "latin1"), Buffer.from([0])]);
    const sha = commit(dir, { "shot.bin": blob, ["-Users-" + "alex-work/x.md"]: "x\n" }, "chore: files");
    expect(scanCommits(dir, [sha])).toEqual([
      `${sha.slice(0, 7)} ${"-Users-" + "alex-work/x.md"}: file name: encoded local path: ${"-Users-" + "alex-"}`,
      `${sha.slice(0, 7)} shot.bin: absolute local path: ${home}`,
    ]);
  });

  it("finds a line a merge adds itself while resolving a conflict", () => {
    const dir = repo();
    commit(dir, { "a.md": "base\n" }, "docs: base");
    git(dir, ["checkout", "-q", "-b", "side"]);
    commit(dir, { "a.md": "side\n" }, "docs: side");
    git(dir, ["checkout", "-q", "main"]);
    commit(dir, { "a.md": "main\n" }, "docs: main");
    git(dir, ["merge", "-q", "side"], {}, { allowFailure: true });
    writeFileSync(join(dir, "a.md"), `merged in ${home}/a.md\n`);
    git(dir, ["add", "a.md"]);
    git(dir, ["commit", "-q", "--no-edit"]);
    const merge = git(dir, ["rev-parse", "HEAD"]).stdout.trim();
    expect(scanCommits(dir, [`${merge}^..${merge}`])).toEqual([`${merge.slice(0, 7)} a.md: absolute local path: ${home}`]);
  });

  it("does not count the lines a clean merge brings from its parents as its own", () => {
    const dir = repo();
    commit(dir, { "a.md": "base\n" }, "docs: base");
    git(dir, ["checkout", "-q", "-b", "side"]);
    commit(dir, { "b.md": `${home}/b.md\n` }, "docs: side");
    git(dir, ["checkout", "-q", "main"]);
    commit(dir, { "c.md": "c\n" }, "docs: main");
    git(dir, ["merge", "-q", "--no-edit", "side"]);
    const merge = git(dir, ["rev-parse", "HEAD"]).stdout.trim();
    expect(scanCommits(dir, [`${merge}^1..${merge}`]).filter((finding) => finding.startsWith(merge.slice(0, 7)))).toEqual([]);
  });

  it("does not report what a commit deletes", () => {
    const dir = repo();
    // Written before the rules existed: a later push only removes it.
    const leak = commit(dir, { "notes.md": `${home}/x\n` }, "docs: notes");
    const fix = commit(dir, { "notes.md": "x\n" }, "docs: fix");
    expect(scanCommits(dir, [`${leak}..${fix}`])).toEqual([]);
  });
});

describe("pushRanges", () => {
  it("scans from the remote's commit for an existing branch, every commit not on a remote for a new one, and skips a deletion", () => {
    const dir = repo();
    const first = commit(dir, { "a.md": "a\n" }, "docs: a");
    const second = commit(dir, { "b.md": "b\n" }, "docs: b");
    const stdin = [
      `refs/heads/main ${second} refs/heads/main ${first}`,
      `refs/heads/new ${second} refs/heads/new ${ZERO}`,
      `(delete) ${ZERO} refs/heads/old ${first}`,
      "",
    ].join("\n");
    expect(pushRanges(dir, stdin)).toEqual([[`${first}..${second}`], [second, "--not", "--remotes"]]);
  });

  it("scans every commit not on a remote when the remote's commit is not known here (a forced push)", () => {
    const dir = repo();
    const head = commit(dir, { "a.md": "a\n" }, "docs: a");
    const unknown = "1234567".repeat(5) + "12345";
    expect(pushRanges(dir, `refs/heads/main ${head} refs/heads/main ${unknown}\n`)).toEqual([[head, "--not", "--remotes"]]);
  });
});

describe(".githooks/pre-push", () => {
  function pushSetup() {
    const remote = mkdtempSync(join(tmpdir(), "truthy-remote-"));
    made.push(remote);
    git(remote, ["init", "-q", "--bare", "-b", "main"]);
    const dir = repo();
    git(dir, ["remote", "add", "origin", remote]);
    git(dir, ["config", "core.hooksPath", HOOKS]);
    return { dir, remote };
  }

  it("lets a clean push through", () => {
    const { dir, remote } = pushSetup();
    const head = commit(dir, { "README.md": "Truthy\n" }, "docs: readme");
    const push = git(dir, ["push", "-q", "origin", "main"]);
    expect(push.status, push.stderr).toBe(0);
    expect(git(remote, ["rev-parse", "main"]).stdout.trim()).toBe(head);
  });

  it("refuses a push with a commit that leaks a local path, although a later commit removes it", () => {
    const { dir, remote } = pushSetup();
    const base = commit(dir, { "README.md": "Truthy\n" }, "docs: readme");
    expect(git(dir, ["push", "-q", "origin", "main"]).status).toBe(0);
    const leak = commit(dir, { "notes.md": `${home}/notes.md\n` }, "docs: notes");
    commit(dir, { "notes.md": "notes\n" }, "docs: no path");
    const push = git(dir, ["push", "-q", "origin", "main"]);
    expect(push.status).not.toBe(0);
    expect(push.stderr).toContain(`${leak.slice(0, 7)} notes.md: absolute local path: ${home}`);
    expect(git(remote, ["rev-parse", "main"]).stdout.trim()).toBe(base);
  });

  it("refuses a new branch whose first commit has a foreign author e-mail", () => {
    const { dir, remote } = pushSetup();
    commit(dir, { "README.md": "Truthy\n" }, "docs: readme", { GIT_AUTHOR_EMAIL: email });
    const push = git(dir, ["push", "-q", "origin", "main"]);
    expect(push.status).not.toBe(0);
    expect(push.stderr).toContain(`author: e-mail address: ${email}`);
    expect(git(remote, ["branch", "--list"]).stdout).toBe("");
  });
});
