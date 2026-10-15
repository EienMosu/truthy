### Task 10: Repository integration: the Vercel ignore command, CI paths, ignores and the documentation

Tasks 1 to 9 make the repository produce and check `native-data/`. This task makes the rest of the repository treat the native folders correctly: a commit that only touches `ios/`, `android/` or `native-data/` must not deploy the web app (every Vercel build writes a new `sw.js`, and every installed web client then updates for nothing), a commit that only touches `ios/` or `android/` must not run the web CI, the native build folders and signing files must stay out of a public repository, the TypeScript typecheck must not read the native projects, and the two documents a newcomer reads (`docs/testing.md` and `README.md`) must say how all of it works. Every piece is pinned by a test, so a later edit that loosens one fails `pnpm test`.

Review Focus 4 of the README is owned here: a push whose last commit is native-only but whose earlier commits touch the web must still build. The reason is the base of the comparison. The ignore command compares with the previously deployed commit (`VERCEL_GIT_PREVIOUS_SHA`), not with `HEAD^`. `tests/vercel-ignore-command.test.ts` runs the committed command, through `sh`, in throwaway git repositories with several commits, and reads the exit code.

Builds on tasks 1 to 9 only for names the documentation mentions: `pnpm export:native`, `tests/native-data.test.ts` and `native-data/manifest.json` (task 9), `scripts/native-token-overrides.json` (task 2). It changes no code that tasks 1 to 9 wrote.

**Files:**
- Modify: `vercel.json`, `.github/workflows/ci.yml`, `.gitignore`, `tsconfig.json`, `docs/testing.md`, `README.md`
- Test: modify `tests/publish-files.test.ts`, `tests/ci-workflow.test.ts`; create `tests/vercel-ignore-command.test.ts`, `tests/native-ignores.test.ts`, `tests/native-docs.test.ts`

**Interfaces:**
- Consumes (exact names, all existing when this task starts):
  - `ALLOWED_EMAIL` from `scripts/hygiene.ts` (a string constant: the GitHub noreply address the repository's commits use). The scratch repositories of the tests commit with it, so no test file contains an e-mail-shaped string.
  - `package.json` script `"export:native"` and the file `tests/native-data.test.ts` (task 9); `native-data/manifest.json` (task 9); `scripts/native-token-overrides.json` (task 2). The documentation test only checks that they exist, not what they contain.
- Produces (later tasks and the native plans B and C rely on these):

```jsonc
// vercel.json: a new key, exactly this string (the other keys stay)
"ignoreCommand": "git diff --quiet ${VERCEL_GIT_PREVIOUS_SHA:-HEAD^} HEAD -- . ':!ios' ':!android' ':!native-data'"
```

```yaml
# .github/workflows/ci.yml: the triggers, exactly
on:
  push:
    branches: ["**"]
    paths-ignore:
      - "ios/**"
      - "android/**"
  pull_request:
    paths-ignore:
      - "ios/**"
      - "android/**"
```

  - The root `.gitignore` ignores, under `ios/`: `xcuserdata/`, `*.xcuserstate`, `build/`, `DerivedData/`, `.build/`, `.swiftpm/`; under `android/`: `.idea/`, `.gradle/`, `.kotlin/`, `build/`, `local.properties`; everywhere: `*.jks`, `*.keystore`, `*.p12`, `*.mobileprovision`. Plans B and C add their own `.gitignore` files inside `ios/` and `android/Truthy/`; the root file is the floor under them, so the two sets may overlap.
  - `tsconfig.json` `exclude` gains `"ios"` and `"android"`.
  - `docs/testing.md` has a section `## Native data`, and `README.md` has `## Native apps` and a `pnpm export:native` row in its scripts table.

**Rules:**

1. **How Vercel reads the command** (checked against Vercel's documentation on 2026-10-15: "Configuring projects with vercel.json", "Project settings, Ignored Build Step", "System environment variables", and the guide "How do I use the Ignored Build Step field on Vercel?"):
   - `ignoreCommand` in `vercel.json` overrides the project setting. It runs when the deployment enters the `BUILDING` state, in the project's root directory, with the build-time system environment variables.
   - "When the command exits with code 1, the build will continue. When the command exits with 0, the build is ignored." The guide adds: "If, however, a code 1 or greater is returned, then a new deployment will be built." So exit 0 is the only way to skip; every other exit code builds.
   - `VERCEL_GIT_PREVIOUS_SHA` is "the git SHA of the last successful deployment for the project and branch", empty on a branch's first deployment, and "only exposed when an Ignored Build Step is provided". A build that was skipped is a canceled deployment, not a successful one, so after several skipped native-only commits the base is still the last commit that was deployed. That is what makes a run of native commits keep skipping, and what makes a web commit followed by a native commit build.
   - Vercel clones shallowly (the guide says `--depth=10`). If the base is not in the clone, `git diff` fails with exit code 128, which builds. The same happens when `HEAD^` does not exist (a repository of one commit). Both are the safe side; the tests pin 128.
   - The documentation does not name the shell. `${NAME:-fallback}` is POSIX, so it works in `sh` and `bash`; it uses the fallback when `NAME` is unset or empty, which covers a branch's first deployment. The tests run the command with `sh -c`.
2. **The pathspec.** `-- . ':!ios' ':!android' ':!native-data'` means "everything under the current directory except these three directories". A pathspec names a directory by whole path components, so a root file called `ios-notes.md` or `native-data.json` is not excluded and builds. A change to `vercel.json`, `.github/`, `docs/`, `package.json` or anything else outside the three folders builds, even beside native files.
3. **The CI filter.** GitHub's `paths-ignore` skips a run "when all the path names match patterns in `paths-ignore`"; one file outside the patterns runs the workflow. With `branches` on the same trigger, both filters must be satisfied. A push of more than 1,000 commits, or a diff that times out, always runs. `native-data/**` is deliberately not ignored: the drift test and the hygiene test run in the web checks. A required status check that a path filter skips never reports, so the web check must not be made required for native-only merges (the owner's repository settings, not this task).
4. **No new action, no new step.** `ci.yml`'s `run:` steps and its actions stay as they are; `tests/ci-workflow.test.ts` and `tests/ci-workflow-polish.test.ts` still pass unchanged apart from the new cases.
5. **Ignores are patterns, tested on a copy.** The `.gitignore` tests run `git check-ignore` in a scratch repository that holds a copy of the root `.gitignore`, with the machine's own ignore file switched off, so a developer's global ignore cannot change the result. They also list files that must not be ignored (the Xcode project file, shared schemes, Gradle build scripts and wrapper, fonts, everything in `native-data/`), because an ignore pattern that is too wide is as bad as one that is too narrow.
6. **The typecheck.** `include` stays `**/*.ts` and `**/*.tsx`; `exclude` gains the two folders. The test parses the real `tsconfig.json` with the TypeScript API against a scratch folder that holds stray `.ts`, `.tsx` and `.js` files under `ios/` and `android/`, and checks which files the project would read.
7. **No em dash** in any file of this task, no absolute local path, no e-mail-shaped string. The scratch folders of the tests are made with `os.tmpdir()`, never a literal path.

**Steps:**

- [ ] **Step 1: Check the starting point.**

```bash
git branch --show-current
git config core.hooksPath
test -f tests/native-data.test.ts && test -f native-data/manifest.json && test -f scripts/native-token-overrides.json && echo "task 2 and 9 files present"
node -e 'console.log(typeof JSON.parse(require("fs").readFileSync("package.json","utf8")).scripts["export:native"])'
cat vercel.json
npx -y pnpm@10.34.0 vitest run tests/publish-files.test.ts tests/ci-workflow.test.ts tests/readme-polish.test.ts
```

Expected: `native`, `.githooks`, `task 2 and 9 files present`, `string`, the two-key `vercel.json` (`$schema` and `regions`), and `Test Files  3 passed (3)`, `Tests  15 passed (15)`. If an earlier task added tests to one of these files, the count is higher; what matters is that all pass. If the branch, the hook or a file is wrong, stop: an earlier task is not finished.

- [ ] **Step 2: Write the failing pin of the key and the command.** In `tests/publish-files.test.ts`, inside `describe("Vercel build", ...)`, replace the first test and add one after it. The old text:

```ts
  it("leaves the build, install and output settings to the Next.js preset", () => {
    const config = JSON.parse(read("vercel.json"));
    expect(Object.keys(config).sort()).toEqual(["$schema", "regions"]);
    expect(config.regions).toEqual(["fra1"]);
  });
```

becomes:

```ts
  it("leaves the build, install and output settings to the Next.js preset", () => {
    const config = JSON.parse(read("vercel.json"));
    expect(Object.keys(config).sort()).toEqual(["$schema", "ignoreCommand", "regions"]);
    expect(config.regions).toEqual(["fra1"]);
  });

  // Vercel skips a build when this command exits 0, which git diff --quiet does only when nothing outside the three
  // native folders changed since the previously deployed commit (tests/vercel-ignore-command.test.ts runs it).
  it("skips the build of a change that touches only ios, android and native-data, against the previously deployed commit", () => {
    expect(JSON.parse(read("vercel.json")).ignoreCommand).toBe(
      "git diff --quiet ${VERCEL_GIT_PREVIOUS_SHA:-HEAD^} HEAD -- . ':!ios' ':!android' ':!native-data'",
    );
  });
```

- [ ] **Step 3: Run it and see it fail.**

```bash
npx -y pnpm@10.34.0 vitest run tests/publish-files.test.ts
```

Expected: `Tests  2 failed | 9 passed (11)`. The first failure is `expected [ '$schema', 'regions' ] to deeply equal [ '$schema', 'ignoreCommand', …(1) ]`; the second is `expected undefined to be 'git diff --quiet ${VERCEL_GIT_PREVIOU…'`.

- [ ] **Step 4: Write the behaviour test.** Create `tests/vercel-ignore-command.test.ts`:

```ts
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
```

The cases, in words: native-only commits skip (with and without the variable); a web file beside native files builds, for six different web files; names that merely start with `ios`, `android` or `native-data` build; an earlier web commit hidden behind a native-only last commit builds with the variable and would wrongly skip with the old `HEAD^` command (this is Review Focus 4); a run of native-only commits keeps skipping because the base is the last deployed commit; an empty variable falls back to `HEAD^`; an unknown base and a repository of one commit exit 128.

- [ ] **Step 5: Run it and see it fail.**

```bash
npx -y pnpm@10.34.0 vitest run tests/vercel-ignore-command.test.ts
```

Expected: `Tests  7 failed (7)`. The first failure reads `expected 127 to be +0`: exit code 127 is "command not found", because `vercel.json` has no `ignoreCommand` yet and the test runs the string `undefined`.

- [ ] **Step 6: Add the key to `vercel.json`.** Replace the file with:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "regions": ["fra1"],
  "ignoreCommand": "git diff --quiet ${VERCEL_GIT_PREVIOUS_SHA:-HEAD^} HEAD -- . ':!ios' ':!android' ':!native-data'"
}
```

- [ ] **Step 7: Run both files and see them pass.**

```bash
npx -y pnpm@10.34.0 vitest run tests/vercel-ignore-command.test.ts tests/publish-files.test.ts
```

Expected: `Test Files  2 passed (2)`, `Tests  18 passed (18)` (7 and 11).

- [ ] **Step 8: Prove the test sees the base.** Temporarily make the command compare with `HEAD^` only, run the behaviour test, and restore the file:

```bash
cp vercel.json vercel.json.orig
sed -i.bak 's/\${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}/HEAD^/' vercel.json
npx -y pnpm@10.34.0 vitest run tests/vercel-ignore-command.test.ts
mv vercel.json.orig vercel.json && rm -f vercel.json.bak
git diff --stat vercel.json
```

Expected: `Tests  2 failed | 5 passed (7)`, the failures being "builds when an earlier commit since the last deploy touched the web, although the last commit is native-only" and "builds when the base cannot be found, as in Vercel's shallow clone, or when there is no commit before the last"; then `git diff --stat` shows `vercel.json | 3 ++-` (the real change, restored).

- [ ] **Step 9: Commit.**

```bash
git add vercel.json tests/publish-files.test.ts tests/vercel-ignore-command.test.ts
git commit -m "chore: skip the Vercel build for commits that touch only ios, android and native-data"
```

- [ ] **Step 10: Write the failing CI trigger test.** Append to `tests/ci-workflow.test.ts` (after its last line, which closes the first `describe`; leave one blank line between):

```ts
describe("CI workflow triggers", () => {
  // The text of the `on:` block, from its key to the line before the next top-level key.
  function triggers(): string {
    const text = readFileSync(".github/workflows/ci.yml", "utf8");
    const start = text.indexOf("\non:\n") + 1;
    const end = text.indexOf("\npermissions:");
    return text.slice(start, end);
  }

  it("runs on every push and pull request, except one that changes only ios or android files", () => {
    expect(triggers()).toBe(
      [
        "on:",
        "  push:",
        '    branches: ["**"]',
        "    paths-ignore:",
        '      - "ios/**"',
        '      - "android/**"',
        "  pull_request:",
        "    paths-ignore:",
        '      - "ios/**"',
        '      - "android/**"',
        "",
      ].join("\n"),
    );
  });

  // The drift test (tests/native-data.test.ts) and the hygiene test live in the web checks: a change that only
  // touches native-data must still run them.
  it("does not ignore native-data, nor any path outside ios and android", () => {
    const ignored = [...triggers().matchAll(/^\s+- "([^"]+)"$/gm)].map((match) => match[1]);
    expect(ignored).toEqual(["ios/**", "android/**", "ios/**", "android/**"]);
    expect(triggers()).not.toMatch(/^\s+paths:/m);
  });
});
```

- [ ] **Step 11: Run it and see it fail.**

```bash
npx -y pnpm@10.34.0 vitest run tests/ci-workflow.test.ts
```

Expected: `Tests  2 failed | 2 passed (4)`. The first failure's diff shows the five `paths-ignore` lines missing from the push trigger and from `pull_request:`; the second reads `expected [] to deeply equal [ 'ios/**', 'android/**', …(2) ]`.

- [ ] **Step 12: Add the filters to `.github/workflows/ci.yml`.** Replace the `on:` block

```yaml
on:
  push:
    branches: ["**"]
  pull_request:
```

with

```yaml
on:
  push:
    branches: ["**"]
    paths-ignore:
      - "ios/**"
      - "android/**"
  pull_request:
    paths-ignore:
      - "ios/**"
      - "android/**"
```

- [ ] **Step 13: Run the workflow tests and see them pass.**

```bash
npx -y pnpm@10.34.0 vitest run tests/ci-workflow.test.ts tests/ci-workflow-polish.test.ts
```

Expected: `Test Files  2 passed (2)`, `Tests  8 passed (8)` (4 and 4). The `run:` list and the action versions are untouched, so the older cases pass unchanged.

- [ ] **Step 14: Commit.**

```bash
git add .github/workflows/ci.yml tests/ci-workflow.test.ts
git commit -m "chore: skip the web CI for commits that touch only ios or android"
```

- [ ] **Step 15: Write the failing ignore and typecheck tests.** Create `tests/native-ignores.test.ts`:

```ts
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { devNull, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import ts from "typescript";

// What the root .gitignore keeps out of a public repository's native folders, and what the typecheck leaves alone.
// Both are checked on a throwaway copy of the real files, so a global ignore file on the machine cannot change the result.
const ROOT = join(import.meta.dirname, "..");

const made: string[] = [];
afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function scratch(): string {
  const dir = mkdtempSync(join(tmpdir(), "truthy-ignores-"));
  made.push(dir);
  return dir;
}

// The paths, out of the given ones, that the root .gitignore ignores. The machine's own ignore file is switched off.
function ignored(paths: string[]): string[] {
  const dir = scratch();
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const name of Object.keys(env)) if (name.startsWith("GIT_")) delete env[name];
  spawnSync("git", ["init", "-q"], { cwd: dir, env });
  copyFileSync(join(ROOT, ".gitignore"), join(dir, ".gitignore"));
  const args = ["-c", `core.excludesFile=${devNull}`, "check-ignore", "--no-index", ...paths];
  return spawnSync("git", args, { cwd: dir, encoding: "utf8", env }).stdout.split("\n").filter(Boolean);
}

describe("the root .gitignore", () => {
  it("keeps Xcode user data and build output out of git", () => {
    const paths = [
      "ios/Truthy/Truthy.xcodeproj/xcuserdata/alex.xcuserdatad/UserInterfaceState.xcuserstate",
      "ios/Truthy/Truthy.xcodeproj/project.xcworkspace/xcuserdata/alex.xcuserdatad/UserInterfaceState.xcuserstate",
      "ios/Truthy/build/Truthy.app/Info.plist",
      "ios/Truthy/DerivedData/Build/Products/a.o",
      "ios/TruthyEngine/.build/debug/TruthyEngine",
      "ios/TruthyEngine/.swiftpm/xcode/package.xcworkspace/contents.xcworkspacedata",
    ];
    expect(ignored(paths)).toEqual(paths);
  });

  it("keeps Gradle, IDE and local machine files out of git", () => {
    const paths = [
      "android/Truthy/local.properties",
      "android/Truthy/.gradle/8.14/fileHashes/fileHashes.bin",
      "android/Truthy/.idea/workspace.xml",
      "android/Truthy/.kotlin/errors/errors-1.log",
      "android/Truthy/build/reports/problems/problems-report.html",
      "android/Truthy/app/build/outputs/apk/release/app-release.apk",
      "android/Truthy/engine/build/classes/kotlin/main/A.class",
    ];
    expect(ignored(paths)).toEqual(paths);
  });

  it("keeps every signing file out of git, wherever it sits", () => {
    const paths = [
      "truthy-release.jks",
      "android/Truthy/app/release.keystore",
      "android/Truthy/app/debug.jks",
      "ios/Truthy/Certificates.p12",
      "ios/Truthy/Truthy.mobileprovision",
      "native-data/signing.p12",
    ];
    expect(ignored(paths)).toEqual(paths);
  });

  it("does not ignore the files the native projects commit", () => {
    const paths = [
      "ios/Truthy/Truthy.xcodeproj/project.pbxproj",
      "ios/Truthy/Truthy.xcodeproj/xcshareddata/xcschemes/Truthy.xcscheme",
      "ios/TruthyEngine/Package.swift",
      "ios/TruthyEngine/Sources/TruthyEngine/Deal.swift",
      "android/Truthy/settings.gradle.kts",
      "android/Truthy/app/build.gradle.kts",
      "android/Truthy/engine/build.gradle.kts",
      "android/Truthy/gradle/libs.versions.toml",
      "android/Truthy/gradle/wrapper/gradle-wrapper.jar",
      "android/Truthy/gradle/wrapper/gradle-wrapper.properties",
      "android/Truthy/app/src/main/res/font/overpass_600.ttf",
      "native-data/manifest.json",
      "native-data/decks/index.json",
      "native-data/golden/src.engine.deal.deal.json",
      "native-data/tokens/resolved.json",
      "scripts/native/export.ts",
    ];
    expect(ignored(paths)).toEqual([]);
  });
});

// The files the typecheck would read in a project laid out like this one.
function typecheckedFiles(files: string[]): string[] {
  const dir = scratch();
  copyFileSync(join(ROOT, "tsconfig.json"), join(dir, "tsconfig.json"));
  for (const file of files) {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    writeFileSync(join(dir, file), "export const x: number = 1;\n");
  }
  const config = ts.readConfigFile(join(dir, "tsconfig.json"), ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, dir);
  return parsed.fileNames.map((name) => name.slice(dir.length + 1)).sort();
}

describe("tsconfig.json", () => {
  it("leaves the native projects out of the typecheck, because a stray script there is not the web's", () => {
    const files = ["scripts/a.ts", "tests/b.test.ts", "scripts/native/c.ts", "ios/Tools/d.ts", "android/Truthy/e.ts", "android/Truthy/f.js", "ios/g.tsx"];
    expect(typecheckedFiles(files)).toEqual(["scripts/a.ts", "scripts/native/c.ts", "tests/b.test.ts"]);
  });

  it("still leaves out what it left out before", () => {
    const files = ["src/a.ts", "content/b.ts", "design/c.ts", "public/d.ts", "node_modules/e/index.ts"];
    expect(typecheckedFiles(files)).toEqual(["src/a.ts"]);
  });
});
```

- [ ] **Step 16: Run it and see it fail.**

```bash
npx -y pnpm@10.34.0 vitest run tests/native-ignores.test.ts
```

Expected: `Tests  4 failed | 2 passed (6)`. The three ignore cases fail with `expected [] to deeply equal [ …(6) ]` (and the same for 7 and 6 paths): nothing is ignored yet. The typecheck case fails because the stray files under `ios/` and `android/` are read. The two passing cases are the guards (files that must not be ignored, folders already excluded).

- [ ] **Step 17: Add the ignore patterns.** Append these lines to the end of `.gitignore` (the file has no comments; keep it so):

```gitignore
ios/**/xcuserdata/
ios/**/*.xcuserstate
ios/**/build/
ios/**/DerivedData/
ios/**/.build/
ios/**/.swiftpm/
android/**/.idea/
android/**/.gradle/
android/**/.kotlin/
android/**/build/
android/**/local.properties
*.jks
*.keystore
*.p12
*.mobileprovision
```

- [ ] **Step 18: Exclude the native folders from the typecheck.** In `tsconfig.json` replace

```json
  "exclude": ["node_modules", "content", "design", "public"]
```

with

```json
  "exclude": ["node_modules", "content", "design", "public", "ios", "android"]
```

- [ ] **Step 19: Run the test and the typecheck, and see them pass.**

```bash
npx -y pnpm@10.34.0 vitest run tests/native-ignores.test.ts
npx -y pnpm@10.34.0 typecheck
```

Expected: `Tests  6 passed (6)`; the typecheck prints `tsc --noEmit` and no error. (With only step 17 done, `Tests  1 failed | 5 passed (6)`: the typecheck case, whose message lists six files including `android/Truthy/e.ts`.)

- [ ] **Step 20: Commit.**

```bash
git add .gitignore tsconfig.json tests/native-ignores.test.ts
git commit -m "chore: ignore native build output and signing files, and keep ios and android out of the typecheck"
```

- [ ] **Step 21: Write the failing documentation test.** Create `tests/native-docs.test.ts`:

```ts
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
```

- [ ] **Step 22: Run it and see it fail.**

```bash
npx -y pnpm@10.34.0 vitest run tests/native-docs.test.ts
```

Expected: `Tests  6 failed (6)`, with messages such as `README needs a section: ## Native apps: expected -1 to be greater than -1` and `docs/testing.md needs a section: ## Native data: expected -1 to be greater than -1`.

- [ ] **Step 23: Write the `docs/testing.md` changes.** Two edits.

First, replace the opening sentence

```markdown
Four gates, all run by CI (`.github/workflows/ci.yml`) on every push and pull request:
```

with

```markdown
Four gates, all run by CI (`.github/workflows/ci.yml`) on every push and pull request, except one that changes only files under `ios/` or `android/` (see Native data below):
```

Second, insert this section directly after the line `Install the browsers once with `pnpm exec playwright install chromium webkit`.` (and its blank line), so that it comes before `## End-to-end specs`:

````markdown
## Native data

`native-data/` is what the iOS and Android apps read: the 54 decks as the web builds them, the design tokens with the native overrides applied, and golden vectors, the inputs and outputs of the TypeScript functions the apps port. It is generated and committed, and nothing in it is edited by hand. `scripts/native-token-overrides.json` is the only hand-kept native data file.

- **The drift gate.** `pnpm test` includes `tests/native-data.test.ts`. It builds every file in memory and compares it with the committed one, and a failure names the first file that differs. A change to a card, a token, an override or an engine constant that is not followed by an export fails there.
- **Exporting.** After such a change run `pnpm export:native`, read the diff of `native-data/` (every changed vector is a behaviour change both native apps must make too), and commit it with the change that caused it.
- **Same tree, same bytes.** Running the export twice gives identical files. The deck index keeps the version recorded in `native-data/manifest.json` until the hash of a deck changes, so a new day alone changes nothing.
- **Vectors are computed.** A vector comes from running the TypeScript function, never from typing it. A function in the port inventory (section 3.9 of the port reference) without a vector file fails the same test.
- **Ids are permanent.** Deck ids and card ids are never renamed or reused: the native apps key progress by them, as the web does. A removed deck shows in the drift gate as `committed but no longer exported`.
- **Typecheck.** `tsconfig.json` leaves `ios/` and `android/` out of `pnpm typecheck`.

### What a change runs

| Changed files | Web CI | Vercel build |
|---|---|---|
| only `ios/` or `android/` | skipped | skipped |
| only `native-data/` | runs | skipped |
| anything else | runs | builds |

- **Web CI.** `.github/workflows/ci.yml` has `paths-ignore` for `ios/**` and `android/**` on both triggers. GitHub skips a run only when every changed file matches, so a push that also touches the web still runs. `native-data/**` is not ignored, because the drift test and the hygiene test (`tests/repo-hygiene.test.ts`) live in the web checks. A required check that a path filter skips never reports, so the web check is not made a required check for native-only merges.
- **Vercel.** `vercel.json` has an `ignoreCommand` that runs `git diff --quiet` between the previously deployed commit and `HEAD`, outside `ios`, `android` and `native-data`; exit 0 (no difference) skips the build. The base is `VERCEL_GIT_PREVIOUS_SHA`, the last successful deployment of the branch, so a native-only commit that follows a web commit nobody has deployed yet still builds. The variable is empty on a branch's first deploy, and the command then compares with `HEAD^`. When the base is missing from Vercel's shallow clone, `git diff` fails with 128 and Vercel builds, the safe side. `tests/vercel-ignore-command.test.ts` runs the committed command in scratch repositories.
- **Why skip.** Every build writes a new `sw.js` (its version is the commit and the build time), so deploying a native-only commit would make every installed web client update for nothing. The Vercel build runs no tests and never reads `native-data/`.
````

- [ ] **Step 24: Write the `README.md` changes.** Two edits.

First, add this row to the scripts table, directly after the `pnpm e2e` row:

```markdown
| `pnpm export:native` | Regenerate `native-data/` (the decks, tokens and golden vectors the native apps read) and write it to disk; `pnpm test` fails when it is out of date |
```

Second, insert this section directly before `## Before you push`:

```markdown
## Native apps

An iOS app (SwiftUI) and an Android app (Kotlin and Jetpack Compose) that play the same game are designed in [the native apps design](docs/superpowers/specs/2026-10-14-truthy-native-apps-design.md); the measured facts they port are in [the port reference](docs/superpowers/specs/2026-10-14-truthy-native-port-reference.md). They read `native-data/`, which this repository generates and commits: the 54 decks, the design tokens and golden vectors computed by the TypeScript code. `pnpm export:native` writes it and `pnpm test` fails when it is out of date; [docs/testing.md](docs/testing.md#native-data) says when to export. A commit that changes only `ios/` or `android/` skips the web CI, and one that changes nothing outside `ios/`, `android/` and `native-data/` does not deploy the web app.
```

- [ ] **Step 25: Run the documentation test and see it pass.**

```bash
npx -y pnpm@10.34.0 vitest run tests/native-docs.test.ts tests/readme-polish.test.ts
```

Expected: `Test Files  2 passed (2)`, `Tests  9 passed (9)` (6 and 3). The `pnpm e2e` row regexp of `readme-polish.test.ts` still matches because the new row comes after it.

- [ ] **Step 26: Commit.**

```bash
git add docs/testing.md README.md tests/native-docs.test.ts
git commit -m "docs: describe native-data, the export and which checks a native change runs"
```

- [ ] **Step 27: Run all gates.**

```bash
npx -y pnpm@10.34.0 test
npx -y pnpm@10.34.0 typecheck
git status --short
git log --oneline -4
```

Expected: `pnpm test` ends with `Test Files  187 passed (187)` and `Tests  3606 passed (3606)`: task 9's 184 and 3584 plus this task's 3 new files and 22 tests (19 in the new files, 1 more in `tests/publish-files.test.ts`, 2 more in `tests/ci-workflow.test.ts`), with no failed file (`tests/repo-hygiene.test.ts` scans the new test files, `vercel.json`, `ci.yml`, `.gitignore`, `README.md` and `docs/testing.md` and finds nothing), the typecheck prints no error, `git status --short` prints nothing, and the log shows the four commits of this task, newest first: `docs: describe native-data...`, `chore: ignore native build output...`, `chore: skip the web CI...`, `chore: skip the Vercel build...`. Do not push: `main` and the branch `native` are pushed only with the owner's approval.

After the owner pushes `native` for the first time, a push whose commits touch only `ios/` or `android/` shows no `checks` run on GitHub, and a push that touches only `native-data/` runs it; in the Vercel dashboard the native-only push shows as `Canceled` (the ignored build step), while a push that includes a web change builds. That is the live confirmation of what the tests show here; it needs no step of this task.
