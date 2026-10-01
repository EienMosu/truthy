import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { NEXT_FONT_VARIABLES, tokensToCss } from "@/src/tokens/build";

// Records the options app/layout.tsx passes to next/font/google.
const fontCalls = vi.hoisted(() => new Map<string, unknown>());
vi.mock("next/font/google", () => {
  const font = (name: string, className: string) => (options: unknown) => {
    fontCalls.set(name, options);
    return { className, variable: `${className}-variable`, style: { fontFamily: name } };
  };
  return { Overpass: font("Overpass", "font-overpass"), Overpass_Mono: font("Overpass Mono", "font-overpass-mono") };
});

const { default: RootLayout, metadata, viewport } = await import("@/app/layout");

function renderLayout(): string {
  return renderToStaticMarkup(
    <RootLayout>
      <p>child</p>
    </RootLayout>,
  );
}

describe("root layout", () => {
  it("declares the page language as English for screen readers", () => {
    expect(renderLayout()).toMatch(/^<html lang="en"/);
  });

  it("renders its children inside the app frame in the body", () => {
    expect(renderLayout()).toContain('<body><div class="app-frame"><p>child</p></div></body>');
  });

  it("names the page Truthy with a one-line description", () => {
    expect(metadata.title).toBe("Truthy");
    expect(metadata.description).toBe("A true or false card game that teaches IT, one swipe at a time.");
  });
});

describe("fonts", () => {
  it("loads Overpass 600 and 800 under the variable name the tokens point at", () => {
    expect(fontCalls.get("Overpass")).toMatchObject({
      subsets: ["latin"],
      weight: ["600", "800"],
      variable: NEXT_FONT_VARIABLES.sans,
    });
  });

  it("loads Overpass Mono 400 and 600 under the variable name the tokens point at", () => {
    expect(fontCalls.get("Overpass Mono")).toMatchObject({
      subsets: ["latin"],
      weight: ["400", "600"],
      variable: NEXT_FONT_VARIABLES.mono,
    });
  });

  it("puts both font variable classes on <html>, where --font-sans and --font-mono resolve", () => {
    expect(renderLayout()).toMatch(/^<html lang="en" class="font-overpass-variable font-overpass-mono-variable">/);
    expect(renderLayout()).toContain("<body>");
  });
});

describe("viewport", () => {
  // The top sky band of each theme in the generated CSS: the day :root block, then the night block.
  function sky1(theme: "day" | "night"): string | undefined {
    const tokens: unknown = JSON.parse(readFileSync("design/system/tokens.json", "utf8"));
    const css = tokensToCss(tokens);
    const dark = css.indexOf("@media (prefers-color-scheme: dark)");
    const block = theme === "day" ? css.slice(0, dark) : css.slice(dark);
    return /--color-sky-1: (#[0-9a-f]{6});/.exec(block)?.[1];
  }

  it("colours the browser bar with the top sky band of the theme the system asks for", () => {
    const day = sky1("day");
    const night = sky1("night");
    expect(day).toBeDefined();
    expect(night).toBeDefined();
    expect(night).not.toBe(day);
    expect(viewport.themeColor).toEqual([
      { media: "(prefers-color-scheme: light)", color: day },
      { media: "(prefers-color-scheme: dark)", color: night },
    ]);
  });

  it("is a device-width page in the light or dark scheme the system asks for, that still allows zooming", () => {
    expect(viewport.colorScheme).toBe("light dark");
    expect(viewport.width).toBe("device-width");
    expect(viewport.maximumScale).toBeUndefined();
    expect(viewport.userScalable).toBeUndefined();
  });
});
