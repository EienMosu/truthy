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
