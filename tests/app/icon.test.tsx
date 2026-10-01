import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LogoMark } from "@/components/Logo";
import { tokensToCss } from "@/src/tokens/build";

function tokenValue(name: string): string | undefined {
  const tokens: unknown = JSON.parse(readFileSync("design/system/tokens.json", "utf8"));
  return new RegExp(`--${name}: (#[0-9a-f]{6});`).exec(tokensToCss(tokens))?.[1];
}

function attributes(markup: string, name: string): string[] {
  return [...markup.matchAll(new RegExp(`\\s${name}="([^"]*)"`, "g"))].map((match) => match[1] ?? "");
}

// Width and height from a PNG's IHDR chunk (bytes 16 to 23, big-endian).
function pngSize(path: string): { width: number; height: number } {
  const bytes = readFileSync(path);
  expect(bytes.subarray(1, 4).toString("ascii")).toBe("PNG");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe("app/icon.svg", () => {
  const svg = readFileSync("app/icon.svg", "utf8");

  it("draws the same three paths as the logo mark", () => {
    const mark = renderToStaticMarkup(<LogoMark />);
    expect(attributes(svg, "d")).toEqual(attributes(mark, "d"));
  });

  it("is square, so it is not squashed as a favicon", () => {
    const [, , width, height] = (attributes(svg, "viewBox")[0] ?? "").split(" ").map(Number);
    expect(width).toBe(height);
  });

  it("paints the ticket in the accent colour and the tear line and check in on-accent", () => {
    expect(attributes(svg, "fill")[0]).toBe(tokenValue("color-accent"));
    expect(attributes(svg, "stroke")).toEqual([tokenValue("color-on-accent"), tokenValue("color-on-accent")]);
  });
});

describe("home screen icons", () => {
  it("has the 180 pixel Apple touch icon and the 192 and 512 pixel manifest icons", () => {
    expect(pngSize("app/apple-icon.png")).toEqual({ width: 180, height: 180 });
    expect(pngSize("public/icon-192.png")).toEqual({ width: 192, height: 192 });
    expect(pngSize("public/icon-512.png")).toEqual({ width: 512, height: 512 });
  });
});
