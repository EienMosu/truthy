import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The native documents name commands and files that must exist, and say which checks a native-only change runs.
const ROOT = join(import.meta.dirname, "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

const readme = read("README.md");
const testing = read("docs/testing.md");

// The part of docs/testing.md under "## Native data", up to the next "## " heading.
function nativeSection(): string {
  const start = testing.indexOf("\n## Native data\n");
  expect(start, "docs/testing.md needs a section: ## Native data").toBeGreaterThan(-1);
  const end = testing.indexOf("\n## ", start + 1);
  return testing.slice(start, end === -1 ? undefined : end);
}

describe("the README", () => {
  it("lists pnpm export:native next to the other scripts, and the script exists", () => {
    expect(JSON.parse(read("package.json")).scripts["export:native"]).toEqual(expect.any(String));
    expect(readme).toMatch(/^\| `pnpm export:native` \| [^\n]*`native-data\/`/m);
  });

  it("has a Native apps section that links the design, the port reference and the testing notes", () => {
    const start = readme.indexOf("\n## Native apps\n");
    expect(start, "README needs a section: ## Native apps").toBeGreaterThan(-1);
    const section = readme.slice(start, readme.indexOf("\n## ", start + 1));
    for (const path of [
      "docs/superpowers/specs/2026-10-14-truthy-native-apps-design.md",
      "docs/superpowers/specs/2026-10-14-truthy-native-port-reference.md",
      "docs/testing.md#native-data",
    ]) {
      expect(section, path).toContain(`](${path})`);
      expect(existsSync(join(ROOT, path.split("#")[0] ?? "")), path).toBe(true);
    }
    expect(section).toContain("`native-data/`");
    expect(section).toContain("`pnpm export:native`");
  });
});

describe("docs/testing.md", () => {
  it("says that a change that only touches ios or android skips the web CI", () => {
    expect(testing).toContain("except one that changes only files under `ios/` or `android/`");
  });

  it("explains the export, the drift gate and the fixed deck index version", () => {
    const native = nativeSection();
    expect(native).toContain("`pnpm export:native`");
    expect(native).toContain("`tests/native-data.test.ts`");
    expect(native).toContain("`native-data/manifest.json`");
    expect(native).toContain("scripts/native-token-overrides.json");
    expect(native).toContain("never renamed or reused");
  });

  it("tells which checks a change runs, for each kind of change, and why Vercel skips", () => {
    const native = nativeSection();
    expect(native).toMatch(/\| only `ios\/` or `android\/` \| skipped \| skipped \|/);
    expect(native).toMatch(/\| only `native-data\/` \| runs \| skipped \|/);
    expect(native).toMatch(/\| anything else \| runs \| builds \|/);
    expect(native).toContain("`VERCEL_GIT_PREVIOUS_SHA`");
    expect(native).toContain("`tests/vercel-ignore-command.test.ts`");
    expect(native).toContain("`sw.js`");
  });

  it("names only files that exist", () => {
    const native = nativeSection();
    const names = [...native.matchAll(/`((?:tests|scripts|native-data|\.github)\/[\w./-]+\.(?:ts|json|yml))`/g)].map((match) => match[1] ?? "");
    expect(names.length).toBeGreaterThan(4);
    const missing = names.filter((name) => !existsSync(join(ROOT, name)));
    expect(missing).toEqual([]);
  });
});
