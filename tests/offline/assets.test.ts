import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NOT_FOUND_PROBE, SHELL_FILES, SHELL_PAGES, assetPathsFromHtml } from "@/src/offline/assets";

// The fixtures are the prerendered HTML of `/` and `/play` from a production build (`pnpm build`, then
// .next/server/app/index.html and play.html, which `next start` serves byte for byte). Captured once; a later
// build may name other chunks, which does not matter: the tests read the shape of a real page.
const FIXTURES = join(import.meta.dirname, "fixtures");
const ROOT_HTML = readFileSync(join(FIXTURES, "root.html"), "utf8");
const PLAY_HTML = readFileSync(join(FIXTURES, "play.html"), "utf8");
const ORIGIN = "https://truthy.example";

// ---------- the build names ----------
// Every name of the build the fixtures were captured from, in the order step 1 of task 2 prints them. A build that
// names its files otherwise changes this block and nothing else in the file.
const FONTS = [
  "/_next/static/media/overpass_600-s.p.2bbaok-qso76f.woff2",
  "/_next/static/media/overpass_800-s.p.0hw8roildsect.woff2",
  "/_next/static/media/overpass_mono_400-s.p.0dw2amq682n4i.woff2",
  "/_next/static/media/overpass_mono_600-s.p.0ja0zsexlr71-.woff2",
];
const CSS = "/_next/static/chunks/1c8ovh-3ao8z6.css";
/** The runtime: a preload link in the head and the `_R_` script at the end of the body. */
const RUNTIME = "/_next/static/chunks/2nmwala9epd-b.js";
const SCRIPTS_BEFORE_PAGE = [
  "/_next/static/chunks/0a53eqxi-32wu.js",
  "/_next/static/chunks/1qwcevvpzfaoz.js",
  "/_next/static/chunks/10lcn3ktlpg9z.js",
  "/_next/static/chunks/turbopack-3-i0cl6u-6x7l.js",
  "/_next/static/chunks/2jmaa-bxsykct.js",
  "/_next/static/chunks/2mz_-znirnayg.js",
];
const ROOT_PAGE = "/_next/static/chunks/2s2se6fvkbs66.js";
const PLAY_PAGE = "/_next/static/chunks/24le-cyi5v9by.js";
const AFTER_PAGE = "/_next/static/chunks/1r82n5qyzrami.js";
const ICON_SVG = "/icon.svg?icon.31fns5a0b7277.svg";
const APPLE_ICON = "/apple-icon.png?apple-icon.1rqb135id39sj.png";
/** The noModule polyfill: named in the HTML, never loaded by a modern engine. */
const POLYFILL = "/_next/static/chunks/0cz1d0mv5g_q7.js";
// ---------- end of the build names ----------

function expectedFor(pageChunk: string): string[] {
  return [...FONTS, CSS, RUNTIME, ...SCRIPTS_BEFORE_PAGE, pageChunk, AFTER_PAGE, "/manifest.webmanifest", ICON_SVG, APPLE_ICON, POLYFILL];
}

describe("the shell", () => {
  it("is the start page and the play page, and a probe path that does not exist", () => {
    expect(SHELL_PAGES).toEqual(["/", "/play"]);
    expect(NOT_FOUND_PROBE).toBe("/__offline-not-found");
  });

  it("knows the icons and the manifest the app ships", () => {
    expect([...SHELL_FILES].sort()).toEqual(["/apple-icon.png", "/icon-192.png", "/icon-512.png", "/icon.svg", "/manifest.webmanifest"]);
  });
});

describe("assetPathsFromHtml on the production pages", () => {
  it("reads every file the start page loads, once each, in the order of the document", () => {
    expect(assetPathsFromHtml(ROOT_HTML, ORIGIN)).toEqual(expectedFor(ROOT_PAGE));
  });

  it("reads the play page with its own page chunk in place of the start page's", () => {
    const paths = assetPathsFromHtml(PLAY_HTML, ORIGIN);
    expect(paths).toEqual(expectedFor(PLAY_PAGE));
    expect(paths).not.toContain(ROOT_PAGE);
  });

  it("lists the runtime that is both preloaded and loaded as a script once", () => {
    // Two tags name it (the flight data repeats it too, but with an escaped quote after it).
    expect(ROOT_HTML.split(`${RUNTIME}"`)).toHaveLength(3);
    expect(assetPathsFromHtml(ROOT_HTML, ORIGIN).filter((path) => path === RUNTIME)).toHaveLength(1);
  });

  it("keeps the font files, which only a preload link names", () => {
    expect(assetPathsFromHtml(ROOT_HTML, ORIGIN).filter((path) => path.endsWith(".woff2"))).toEqual(FONTS);
  });

  it("keeps the hash query of the icons, because that is the URL the browser asks for", () => {
    const paths = assetPathsFromHtml(PLAY_HTML, ORIGIN);
    expect(paths).toContain(ICON_SVG);
    expect(paths).toContain(APPLE_ICON);
    expect(paths).not.toContain("/icon.svg");
  });

  it("does not read the chunk paths the inline flight data repeats", () => {
    expect(ROOT_HTML).toContain('self.__next_f.push');
    const all = assetPathsFromHtml(ROOT_HTML, ORIGIN);
    expect(new Set(all).size).toBe(all.length);
    expect(all).toHaveLength(expectedFor(ROOT_PAGE).length);
  });

  it("gives the same paths for the origin the pages are served from", () => {
    expect(assetPathsFromHtml(ROOT_HTML, "http://localhost:3100")).toEqual(assetPathsFromHtml(ROOT_HTML, ORIGIN));
  });
});

describe("assetPathsFromHtml rules", () => {
  it("accepts absolute same-origin URLs and relative URLs, and returns the path", () => {
    const html = [
      `<script src="${ORIGIN}/_next/static/chunks/a.js"></script>`,
      '<script src="_next/static/chunks/b.js"></script>',
      '<link rel="stylesheet" href="./_next/static/chunks/c.css">',
      '<link rel="modulepreload" href="/_next/static/chunks/d.js">',
    ].join("");
    expect(assetPathsFromHtml(html, ORIGIN)).toEqual([
      "/_next/static/chunks/a.js",
      "/_next/static/chunks/b.js",
      "/_next/static/chunks/c.css",
      "/_next/static/chunks/d.js",
    ]);
  });

  it("leaves out other origins, protocol relative URLs to them, and data: URLs", () => {
    const html = [
      '<script src="https://cdn.example/_next/static/chunks/a.js"></script>',
      '<script src="//cdn.example/_next/static/chunks/b.js"></script>',
      `<script src="http://truthy.example/_next/static/chunks/c.js"></script>`,
      '<link rel="icon" href="data:image/svg+xml,%3Csvg%3E%3C/svg%3E">',
      '<link rel="stylesheet" href="https://fonts.example/css">',
    ].join("");
    expect(assetPathsFromHtml(html, ORIGIN)).toEqual([]);
  });

  it("reads only files of the shell: /_next/static, the icons and the manifest", () => {
    const html = [
      '<script src="/analytics.js"></script>',
      '<link rel="preload" href="/decks/index.json" as="fetch">',
      '<link rel="icon" href="/icon-192.png">',
      '<link rel="apple-touch-icon" href="/icon-512.png">',
      '<link rel="icon" href="/favicon.ico">',
    ].join("");
    expect(assetPathsFromHtml(html, ORIGIN)).toEqual(["/icon-192.png", "/icon-512.png"]);
  });

  it("takes links that load a file, not a prefetch or a preconnect", () => {
    const html = [
      '<link rel="prefetch" href="/_next/static/chunks/later.js">',
      '<link rel="preconnect" href="/_next/static/">',
      '<link rel="alternate" href="/manifest.webmanifest">',
      '<link rel="shortcut icon" href="/icon.svg">',
      '<link rel="PRELOAD" as="script" href="/_next/static/chunks/upper.js">',
    ].join("");
    expect(assetPathsFromHtml(html, ORIGIN)).toEqual(["/icon.svg", "/_next/static/chunks/upper.js"]);
  });

  it("skips comments and the bodies of inline scripts and styles", () => {
    const html = [
      '<!-- <script src="/_next/static/chunks/commented.js"></script> -->',
      '<script>document.write(\'<script src="/_next/static/chunks/written.js"></\' + "script>")</script>',
      '<style>/* <link rel="stylesheet" href="/_next/static/chunks/styled.css"> */</style>',
      '<script>self.__next_f.push([1,"<link rel=\\"stylesheet\\" href=\\"/_next/static/chunks/flight.css\\">"])</script>',
      '<script src="/_next/static/chunks/real.js" async=""></script>',
    ].join("");
    expect(assetPathsFromHtml(html, ORIGIN)).toEqual(["/_next/static/chunks/real.js"]);
  });

  it("reads single quoted and unquoted values, attributes in any case and order, and decodes &amp;", () => {
    const html = [
      "<SCRIPT async SRC='/_next/static/chunks/single.js'></SCRIPT>",
      "<link href=/_next/static/chunks/bare.css rel=stylesheet>",
      '<link rel="icon" href="/icon.svg?v=1&amp;w=2">',
    ].join("");
    expect(assetPathsFromHtml(html, ORIGIN)).toEqual(["/_next/static/chunks/single.js", "/_next/static/chunks/bare.css", "/icon.svg?v=1&w=2"]);
  });

  it("does not end a tag at a > inside a quoted attribute value", () => {
    const html = [
      '<script data-x="a>b" src="/_next/static/chunks/double.js"></script>',
      "<script data-x='a>b' src='/_next/static/chunks/single.js'></script>",
      '<link data-x="a>b" rel="stylesheet" href="/_next/static/chunks/quoted.css">',
      '<link rel="stylesheet" href="/_next/static/chunks/after.css">',
    ].join("");
    expect(assetPathsFromHtml(html, ORIGIN)).toEqual([
      "/_next/static/chunks/double.js",
      "/_next/static/chunks/single.js",
      "/_next/static/chunks/quoted.css",
      "/_next/static/chunks/after.css",
    ]);
  });

  it("decodes an entity once, so &amp;quot; stays the text &quot;", () => {
    const html = [
      '<link rel="icon" href="/icon.svg?a=&amp;quot;">',
      '<link rel="icon" href="/icon-192.png?a=&amp;amp;b=1">',
      '<link rel="icon" href="/icon-512.png?a=&amp;&#x26;&#38;">',
    ].join("");
    // The query keeps its text; the URL parser would write a decoded quote as %22.
    expect(assetPathsFromHtml(html, ORIGIN)).toEqual(["/icon.svg?a=&quot;", "/icon-192.png?a=&amp;b=1", "/icon-512.png?a=&&&"]);
  });

  it("drops a fragment, keeps a query, and ignores an empty or broken URL", () => {
    const html = [
      '<script src="/_next/static/chunks/a.js?dpl=x#part"></script>',
      '<script src=""></script>',
      '<script src="http://[broken"></script>',
      "<script async></script>",
      '<link rel="stylesheet">',
    ].join("");
    expect(assetPathsFromHtml(html, ORIGIN)).toEqual(["/_next/static/chunks/a.js?dpl=x"]);
  });

  it("is empty for a page that loads nothing", () => {
    expect(assetPathsFromHtml("<!DOCTYPE html><html><head><title>x</title></head><body></body></html>", ORIGIN)).toEqual([]);
  });
});
