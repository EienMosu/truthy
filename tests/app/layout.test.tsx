import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { OfflineStart } from "@/components/OfflineStart";
import { THEME_COLOR, themeScript } from "@/src/app-state/theme";
import { NEXT_FONT_VARIABLES, tokensToCss } from "@/src/tokens/build";

// Records the options app/layout.tsx passes to next/font/local, by the variable each family is exposed as.
const fontCalls = vi.hoisted(() => new Map<string, unknown>());
vi.mock("next/font/local", () => ({
  default: (options: { variable: string }) => {
    fontCalls.set(options.variable, options);
    const className = options.variable.replace(/^--/, "");
    return { className, variable: `${className}-variable`, style: { fontFamily: className } };
  },
}));

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

  // The body holds the frame and nothing else in the markup, which also shows that OfflineStart renders no element.
  it("renders its children inside the app frame in the body", () => {
    expect(renderLayout()).toContain('<body><div class="app-frame"><p>child</p></div></body>');
  });

  it("names the page Truthy with a one-line description", () => {
    expect(metadata.title).toBe("Truthy");
    expect(metadata.description).toBe("A true or false card game that teaches IT, one swipe at a time.");
  });
});

// The elements of a rendered tree whose type is `type`, at any depth below `node`.
function elementsOfType(node: ReactNode, type: unknown): ReactElement[] {
  if (Array.isArray(node)) return node.flatMap((child: ReactNode) => elementsOfType(child, type));
  if (!isValidElement<{ children?: ReactNode }>(node)) return [];
  return [...(node.type === type ? [node] : []), ...elementsOfType(node.props.children, type)];
}

describe("the service worker", () => {
  it("starts the offline client from every page: OfflineStart sits once in the body, after the app frame", () => {
    const html = RootLayout({ children: null });
    const [body] = elementsOfType(html, "body");
    expect(elementsOfType(html, OfflineStart)).toHaveLength(1);
    const children = (body?.props as { children?: ReactNode } | undefined)?.children;
    expect(Array.isArray(children)).toBe(true);
    const [frame, starter] = children as ReactNode[];
    expect(isValidElement(frame) && frame.type).toBe("div");
    expect(isValidElement(starter) && starter.type).toBe(OfflineStart);
  });
});

describe("the theme the player chose", () => {
  it("runs the theme script first thing in <head>, so a chosen theme applies before the first paint", () => {
    expect(renderLayout()).toMatch(/^<html [^>]*><head><script>/);
    expect(renderLayout()).toContain(`<head><script>${themeScript()}</script>`);
  });

  it("tells React that the script may change <html> before hydration", () => {
    const html = RootLayout({ children: null });
    expect(html.type).toBe("html");
    expect(html.props.suppressHydrationWarning).toBe(true);
  });

  it("takes the browser bar colours from the theme module, which the theme script also uses", () => {
    expect(viewport.themeColor).toEqual([
      { media: "(prefers-color-scheme: light)", color: THEME_COLOR.light },
      { media: "(prefers-color-scheme: dark)", color: THEME_COLOR.dark },
    ]);
  });
});

describe("fonts", () => {
  it("loads Overpass 600 and 800 from app/fonts under the variable name the tokens point at", () => {
    expect(fontCalls.get(NEXT_FONT_VARIABLES.sans ?? "")).toEqual({
      src: [
        { path: "./fonts/overpass-600.woff2", weight: "600", style: "normal" },
        { path: "./fonts/overpass-800.woff2", weight: "800", style: "normal" },
      ],
      variable: "--font-overpass",
      display: "swap",
    });
  });

  it("loads Overpass Mono 400 and 600 from app/fonts under the variable name the tokens point at", () => {
    expect(fontCalls.get(NEXT_FONT_VARIABLES.mono ?? "")).toEqual({
      src: [
        { path: "./fonts/overpass-mono-400.woff2", weight: "400", style: "normal" },
        { path: "./fonts/overpass-mono-600.woff2", weight: "600", style: "normal" },
      ],
      variable: "--font-overpass-mono",
      display: "swap",
    });
  });

  it("puts both font variable classes on <html>, where --font-sans and --font-mono resolve", () => {
    expect(renderLayout()).toMatch(/^<html lang="en" class="font-overpass-variable font-overpass-mono-variable">/);
    expect(fontCalls.size).toBe(2);
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
