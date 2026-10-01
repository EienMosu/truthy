import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Components use the generated CSS variables only (spec section 9, "Tokens in code").
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|css)$/.test(name) ? [path] : [];
  });
}

describe("components/", () => {
  it("contains no raw hex, rgb or hsl colour", () => {
    const offenders = sourceFiles("components").filter((file) =>
      /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/.test(readFileSync(file, "utf8")),
    );
    expect(offenders).toEqual([]);
  });
});
