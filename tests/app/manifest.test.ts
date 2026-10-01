import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import { tokensToCss } from "@/src/tokens/build";

// The value of one CSS variable in the generated app/tokens.css text.
function tokenValue(name: string): string | undefined {
  const tokens: unknown = JSON.parse(readFileSync("design/system/tokens.json", "utf8"));
  return new RegExp(`--${name}: (#[0-9a-f]{6});`).exec(tokensToCss(tokens))?.[1];
}

describe("web app manifest", () => {
  it("names the app Truthy and describes it with the line from src/meta.ts", () => {
    expect(manifest()).toMatchObject({
      name: "Truthy",
      short_name: "Truthy",
      description: "A true or false card game that teaches IT, one swipe at a time.",
    });
  });

  it("opens the start screen as a standalone app", () => {
    expect(manifest().start_url).toBe("/");
    expect(manifest().display).toBe("standalone");
  });

  it("colours the browser bar with the top sky band and the splash screen with the page background", () => {
    const sky1 = tokenValue("color-sky-1");
    const surface = tokenValue("color-surface");
    expect(sky1).toBeDefined();
    expect(surface).toBeDefined();
    expect(manifest().theme_color).toBe(sky1);
    expect(manifest().background_color).toBe(surface);
  });

  it("offers the vector icon and the 192 and 512 pixel icons Android asks for, the 512 one also maskable", () => {
    expect(manifest().icons).toEqual([
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ]);
  });

  it("points only at icon files that exist", () => {
    for (const icon of manifest().icons ?? []) {
      const file = icon.src === "/icon.svg" ? "app/icon.svg" : `public${icon.src}`;
      expect(existsSync(file), file).toBe(true);
    }
  });
});
