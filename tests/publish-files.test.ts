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

  it("generates the tokens and the decks before every build, because both are gitignored", () => {
    const scripts = JSON.parse(read("package.json")).scripts;
    expect(scripts.prebuild).toBe("pnpm build:tokens && pnpm build:decks");
    expect(scripts.build).toBe("next build");
    const ignored = read(".gitignore").split("\n");
    expect(ignored).toContain("app/tokens.css");
    expect(ignored).toContain("public/decks/");
  });
});
