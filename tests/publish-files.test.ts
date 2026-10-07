import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

describe("licences", () => {
  it("licenses the code under MIT in the root LICENSE file", () => {
    const licence = read("LICENSE");
    expect(licence.startsWith("MIT License\n\nCopyright (c) 2026 EienMosu\n")).toBe(true);
    expect(licence).toContain('THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND');
  });

  it("declares the same licence in package.json", () => {
    expect(JSON.parse(read("package.json")).license).toBe("MIT");
  });

  it("licenses the card content under CC BY 4.0 with a link to the licence", () => {
    const notice = read("content/LICENSE.md");
    expect(notice).toContain("Creative Commons Attribution 4.0 International");
    expect(notice).toContain("https://creativecommons.org/licenses/by/4.0/");
  });

  it("names both licences in the README", () => {
    const readme = read("README.md");
    expect(readme).toContain("\n## License\n");
    expect(readme).toContain("[MIT](LICENSE)");
    expect(readme).toContain("[CC BY 4.0](content/LICENSE.md)");
  });
});

describe("Vercel build", () => {
  it("leaves the build, install and output settings to the Next.js preset", () => {
    const config = JSON.parse(read("vercel.json"));
    expect(Object.keys(config).sort()).toEqual(["$schema", "regions"]);
    expect(config.regions).toEqual(["fra1"]);
  });

  it("generates the tokens, the decks and the service worker before every build and dev server, because all three are gitignored", () => {
    const scripts = JSON.parse(read("package.json")).scripts;
    expect(scripts.prebuild).toBe("pnpm build:tokens && pnpm build:decks && pnpm build:sw");
    expect(scripts.predev).toBe("pnpm build:tokens && pnpm build:decks && pnpm build:sw");
    expect(scripts["build:sw"]).toBe("tsx scripts/build-sw.ts");
    expect(scripts.build).toBe("next build");
    const ignored = read(".gitignore").split("\n");
    expect(ignored).toContain("app/tokens.css");
    expect(ignored).toContain("public/decks/");
    expect(ignored).toContain("public/sw.js");
  });
});

// One "key: value" line of a lockfile and the lines indented under it. The lockfile is plain YAML with block mappings
// only, so a reader that follows the indentation is enough, and it takes no dependency.
interface YamlNode {
  indent: number;
  value: string;
  children: Map<string, YamlNode>;
}

// A mapping key or scalar without the quotes YAML puts around names like '@playwright/test'.
const unquoted = (text: string): string => text.replace(/^(['"])(.*)\1$/, "$2");

// The tree of a block-mapping YAML text. Indentation width, quoting, line endings and the order of a node's children
// do not matter; comments, blank lines and anything that is not a "key:" line are skipped.
function parseYaml(text: string): YamlNode {
  const root: YamlNode = { indent: -1, value: "", children: new Map() };
  const stack = [root];
  for (const line of text.split(/\r?\n/)) {
    const entry = /^(\s*)(?!#)(\S.*?):(?:\s+(.*?))?\s*$/.exec(line);
    if (!entry) continue;
    const node: YamlNode = { indent: entry[1]?.length ?? 0, value: unquoted(entry[3] ?? ""), children: new Map() };
    while ((stack.at(-1)?.indent ?? -1) >= node.indent) stack.pop();
    stack.at(-1)?.children.set(unquoted(entry[2] ?? ""), node);
    stack.push(node);
  }
  return root;
}

// The specifier and version the lockfile records for a devDependency of the root importer.
function lockedDevDependency(lock: string, name: string): { specifier?: string; version?: string } {
  const entry = parseYaml(lock).children.get("importers")?.children.get(".")?.children.get("devDependencies")?.children.get(name);
  return { specifier: entry?.children.get("specifier")?.value, version: entry?.children.get("version")?.value };
}

const LOCK = [
  "importers:",
  "  .:",
  "    devDependencies:",
  "      esbuild:",
  "        specifier: 0.28.2",
  "        version: 0.28.2",
].join("\n");

describe("the lockfile reader", () => {
  it("reads the importer's devDependency whatever the indentation, line endings, quoting or order of the entry", () => {
    const expected = { specifier: "0.28.2", version: "0.28.2" };
    expect(lockedDevDependency(LOCK, "esbuild")).toEqual(expected);
    expect(lockedDevDependency(LOCK.replaceAll("  ", "    "), "esbuild")).toEqual(expected);
    expect(lockedDevDependency(LOCK.replaceAll("\n", "\r\n"), "esbuild")).toEqual(expected);
    expect(lockedDevDependency(LOCK.replace("esbuild:", "'esbuild':"), "esbuild")).toEqual(expected);
    const reordered = LOCK.replace("        specifier: 0.28.2\n        version: 0.28.2", "        version: 0.28.2\n\n        # pinned\n        specifier: 0.28.2");
    expect(lockedDevDependency(reordered, "esbuild")).toEqual(expected);
  });

  it("reports a devDependency that is missing, has another version, or sits under dependencies or another importer", () => {
    expect(lockedDevDependency(LOCK.replace("esbuild:", "tsx:"), "esbuild")).toEqual({});
    expect(lockedDevDependency(LOCK.replace("version: 0.28.2", "version: 0.28.3"), "esbuild").version).toBe("0.28.3");
    expect(lockedDevDependency(LOCK.replace("devDependencies:", "dependencies:"), "esbuild")).toEqual({});
    expect(lockedDevDependency(LOCK.replace("  .:", "  other:"), "esbuild")).toEqual({});
  });
});

describe("the service worker's bundler", () => {
  it("is esbuild, a devDependency at the one version the toolchain already installs", () => {
    expect(JSON.parse(read("package.json")).devDependencies.esbuild).toBe("0.28.2");
    const lock = read("pnpm-lock.yaml");
    expect(lockedDevDependency(lock, "esbuild")).toEqual({ specifier: "0.28.2", version: "0.28.2" });
    const packages = [...(parseYaml(lock).children.get("packages")?.children.keys() ?? [])];
    expect(packages.filter((key) => key.startsWith("esbuild@"))).toEqual(["esbuild@0.28.2"]);
  });
});

describe("production URL", () => {
  it("is recorded in the README as the public production address, not a preview one", () => {
    const line = /^Play it on your phone at (https:\/\/[a-z0-9.-]+)\/?$/m.exec(read("README.md"));
    expect(line, "README needs a line: Play it on your phone at https://<production domain>").not.toBeNull();
    const url = line?.[1] ?? "";
    // Preview and branch URLs carry "-git-" or the team slug and sit behind Vercel's login wall.
    expect(url).not.toMatch(/-git-|-projects\.vercel\.app$/);
  });
});
