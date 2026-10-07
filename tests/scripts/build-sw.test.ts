import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

// scripts/build-sw.ts bundles src/offline/sw-entry.ts into one classic script (public/sw.js by default) and fills
// in the release version: the deploy's commit, else the checkout's short commit, else "local", then the build time.
// Every deploy changes the worker's bytes, so the browser installs the new worker.
describe("scripts/build-sw.ts", () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const tsx = join(root, "node_modules/tsx/dist/cli.mjs");
  const TIME = String.raw`\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z`;

  const made: string[] = [];
  afterEach(() => {
    for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  function run(env: Record<string, string>) {
    const dir = mkdtempSync(join(tmpdir(), "truthy-sw-"));
    made.push(dir);
    const out = join(dir, "nested", "sw.js");
    const result = spawnSync(process.execPath, [tsx, "scripts/build-sw.ts", out], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, VERCEL_GIT_COMMIT_SHA: "", ...env },
    });
    expect(result.status, result.stderr).toBe(0);
    const code = readFileSync(out, "utf8");
    // The version the script reports; the bundle carries it as one string literal (src/offline/version.ts).
    const version = /, version (\S+)\n$/.exec(result.stdout)?.[1] ?? "";
    expect(code).toContain(JSON.stringify(version));
    return { dir, code, version, stdout: result.stdout };
  }

  it("writes one classic script with the deploy's commit and the build time as the version", () => {
    const { code, version, stdout } = run({ VERCEL_GIT_COMMIT_SHA: "9f3c2b1e0d4a5f6789abcdef0123456789abcdef" });
    expect(version).toMatch(new RegExp(`^9f3c2b1e0d4a5f6789abcdef0123456789abcdef-${TIME}$`));
    expect(code.startsWith('"use strict";\n(() => {\n')).toBe(true);
    expect(code).not.toMatch(/^\s*(import|export)\b/m);
    expect(code).not.toContain("__TRUTHY_VERSION__");
    expect(code).toContain("addEventListener(\"install\"");
    expect(stdout).toMatch(new RegExp(`^build-sw: wrote .*sw\\.js, version 9f3c2b1e0d4a5f6789abcdef0123456789abcdef-${TIME}\\n$`));
  }, 60_000);

  it("takes the checkout's short commit when the deploy names none", () => {
    const short = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
    expect(run({}).version).toMatch(new RegExp(`^${short}-${TIME}$`));
  }, 60_000);

  it("says local when there is no commit to name", () => {
    const dir = mkdtempSync(join(tmpdir(), "truthy-no-git-"));
    made.push(dir);
    expect(run({ GIT_DIR: join(dir, "missing") }).version).toMatch(new RegExp(`^local-${TIME}$`));
  }, 60_000);
});
