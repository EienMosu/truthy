### Task 2: The worker's pure decisions: cache names, the assets of a page, the strategy for a request

The service worker of task 3 makes three kinds of decision that need no browser: what its cache is called and which caches are old, which files a page of the production build loads (so that install can keep them), and what to do with each request it sees (spec section 6, the fetch table). This task writes them as pure modules in `src/offline`, tests them in Node, and adds them to the purity scan, so the worker and the unit tests run the same code. No file of the app imports them yet; nothing the player sees changes.

`assets.ts` is tested on the real HTML of `/` and `/play` from a production build, kept as fixtures. Check C3 measured that HTML: every `/_next/static` file a full round loads (Classic, Streak and Timed, in Chromium and WebKit) is named in a script `src` or a link `href` of `/` or `/play`, nothing loads later, and the inline flight data repeats some chunk paths but names nothing extra.

Builds on task 1 only through the production build the fixtures are captured from. Task 1 changes no client code, so that HTML is the HTML check C3 measured.

**Files:**
- Create: `src/offline/cache-names.ts`, `src/offline/assets.ts`, `src/offline/strategy.ts`
- Create (fixtures, captured in step 1): `tests/offline/fixtures/root.html`, `tests/offline/fixtures/play.html`
- Test: create `tests/offline/cache-names.test.ts`, `tests/offline/assets.test.ts`, `tests/offline/strategy.test.ts`; modify `tests/purity.test.ts`

**Interfaces:**
- Consumes: nothing in `src`. The production build of the tree as task 1 leaves it (`pnpm build`), for the fixtures.
- Produces (the brief's shared names, exactly, plus one extra constant):

```ts
// src/offline/cache-names.ts
export const SHELL_CACHE_PREFIX = "truthy-shell-";
export function shellCacheName(version: string): string;                  // "truthy-shell-<version>"
export function isOldShellCache(name: string, version: string): boolean;  // a truthy-shell-* name that is not this version's

// src/offline/assets.ts
export const SHELL_PAGES = ["/", "/play"] as const;
export const NOT_FOUND_PROBE = "/__offline-not-found";
export const SHELL_FILES: ReadonlySet<string>;   // "/icon.svg", "/icon-192.png", "/icon-512.png", "/apple-icon.png", "/manifest.webmanifest" (paths without a query)
export function assetPathsFromHtml(html: string, origin: string): string[];

// src/offline/strategy.ts
export type Strategy = "page" | "unknown-page" | "static" | "pass";
export interface RequestFacts { url: string; method: string; mode: string; headers: { get(name: string): string | null } }
export function strategyFor(request: RequestFacts, origin: string): Strategy;
export const PAGE_TIMEOUT_MS = 3000;
```

  - `SHELL_FILES` is not in the brief's list. It exists because the HTML never names `/icon-192.png`, `/icon-512.png` or the bare `/icon.svg` (only the manifest does; check C3), so task 3's install adds `[...SHELL_FILES]` to what it caches next to the paths `assetPathsFromHtml` finds, and `strategyFor` uses the same set for "static". One list, two users.
  - What task 3 must know about these results:
    - `assetPathsFromHtml` returns paths with their query: the icons come as `/icon.svg?icon.<hash>.svg` and `/apple-icon.png?apple-icon.<hash>.png`, which is the URL the browser asks for. Cache them under that exact URL; `SHELL_FILES` adds the bare paths.
    - `strategyFor` says "page" for `/` and `/play` whatever their query (`/?utm_source=homescreen`). The worker looks a page up by its path (`SHELL_PAGES` entry), not by the request URL.
    - "static" is decided on the path alone, so an icon with any query is "static"; the cache lookup uses the full request URL.
    - The noModule polyfill (`0cz1d0mv5g_q7.js`, 112,594 B) is in the list: modern engines never load it, keeping it costs one fetch at install and makes no special case.

**Rules:**

1. `shellCacheName(version)` is `SHELL_CACHE_PREFIX + version`. `isOldShellCache(name, version)` is true only for a name that starts with the prefix and is not `shellCacheName(version)`; any other cache is left alone.
2. `assetPathsFromHtml(html, origin)` reads the HTML as text (a service worker has no `DOMParser`), in one pass from left to right:
   - It skips comments and the bodies of `<script>` and `<style>` elements, so the inline flight data (`self.__next_f.push(...)`, which repeats chunk paths) and inline code are never read as tags.
   - A `<script>` counts by its `src`. A `<link>` counts by its `href` when one of its `rel` tokens is `stylesheet`, `preload`, `modulepreload`, `icon`, `apple-touch-icon` or `manifest` (not `prefetch`, `preconnect`, `alternate`).
   - Attribute names in any case, values double quoted, single quoted or unquoted; `&amp;` (also `&#38;`, `&#x26;`), `&quot;` and `&#39;` are decoded.
   - The value is resolved against `origin + "/"`: absolute and relative URLs both work. Another origin (also protocol relative, another scheme or port), a `data:` URL, an empty value and a value that is not a URL are left out.
   - Only shell paths are kept: a path under `/_next/static/`, or one of `SHELL_FILES`. The result is `pathname + search` (the fragment dropped, the query kept), each path once, in the order of first appearance.
   - On the production `/` this gives 18 paths: 4 fonts, the stylesheet, the runtime `2nmwala9epd-b.js` (preloaded and loaded as the `_R_` script, listed once), 8 async scripts with the page chunk `2s2se6fvkbs66.js`, the manifest, the two icons with their query, and the noModule polyfill. `/play` gives the same with `24le-cyi5v9by.js` in place of the page chunk.
3. `strategyFor(request, origin)`, in this order:
   1. a method other than GET: "pass";
   2. a URL that does not parse, or another origin: "pass";
   3. `/sw.js`: "pass" (the worker is never served by itself);
   4. an RSC request, a `_rsc` query or an `RSC` header (any case, `Headers.get` is case-insensitive): "pass", also with mode navigate;
   5. a path under `/decks/`: "pass", also with mode navigate;
   6. mode navigate: "page" for the path `/` or `/play` (any query), "unknown-page" for any other path (also `/play/`);
   7. a path under `/_next/static/` or one of `SHELL_FILES` (any query): "static";
   8. anything else (a non-navigate `/`, `/favicon.ico`, `/_next/image`): "pass".
4. Purity: the three files import only each other (`./`) and use no clock, randomness, DOM, storage or timer; `tests/purity.test.ts` scans them like the engine. `PAGE_TIMEOUT_MS` is a number here; the timer that uses it lives in the worker (task 3).

**Steps:**

- [ ] **Step 1: Capture the fixtures from a production build.**

```bash
pnpm build
mkdir -p tests/offline/fixtures
cp .next/server/app/index.html tests/offline/fixtures/root.html
cp .next/server/app/play.html tests/offline/fixtures/play.html
wc -c tests/offline/fixtures/root.html tests/offline/fixtures/play.html
grep -oE '(src|href)="/[^"]*"' tests/offline/fixtures/root.html | awk '!seen[$0]++'
```

These are the prerendered pages `next start` serves byte for byte (checked with `curl` against `pnpm start`; the only part that changes from one build to the next is the build id inside the flight data). Expected: `18583 tests/offline/fixtures/root.html`, `17064 tests/offline/fixtures/play.html`, and the list:

```text
href="/_next/static/media/overpass_600-s.p.2bbaok-qso76f.woff2"
href="/_next/static/media/overpass_800-s.p.0hw8roildsect.woff2"
href="/_next/static/media/overpass_mono_400-s.p.0dw2amq682n4i.woff2"
href="/_next/static/media/overpass_mono_600-s.p.0ja0zsexlr71-.woff2"
href="/_next/static/chunks/1c8ovh-3ao8z6.css"
href="/_next/static/chunks/2nmwala9epd-b.js"
src="/_next/static/chunks/0a53eqxi-32wu.js"
src="/_next/static/chunks/1qwcevvpzfaoz.js"
src="/_next/static/chunks/10lcn3ktlpg9z.js"
src="/_next/static/chunks/turbopack-3-i0cl6u-6x7l.js"
src="/_next/static/chunks/2jmaa-bxsykct.js"
src="/_next/static/chunks/2mz_-znirnayg.js"
src="/_next/static/chunks/2s2se6fvkbs66.js"
src="/_next/static/chunks/1r82n5qyzrami.js"
href="/manifest.webmanifest"
href="/icon.svg?icon.31fns5a0b7277.svg"
href="/apple-icon.png?apple-icon.1rqb135id39sj.png"
src="/_next/static/chunks/0cz1d0mv5g_q7.js"
src="/_next/static/chunks/2nmwala9epd-b.js"
```

The chunk names are content hashes of the client code at 5db53f3; task 1 changes no client code, and two builds in two different worktrees gave the same names. If a name differs all the same, keep the captured files and put the printed names into the block of build names at the top of `tests/offline/assets.test.ts` in step 2. That block holds every build-specific name the tests use, and nothing else in the file names a build file:

| Constant | Line of the list above |
| --- | --- |
| `FONTS` | 1 to 4, in that order |
| `CSS` | 5 |
| `RUNTIME` | 6 (line 19 names it again) |
| `SCRIPTS_BEFORE_PAGE` | 7 to 12, in that order |
| `ROOT_PAGE` | 13 |
| `AFTER_PAGE` | 14 |
| (the manifest, no hash) | 15 |
| `ICON_SVG` | 16, with its query |
| `APPLE_ICON` | 17, with its query |
| `POLYFILL` | 18 |
| `PLAY_PAGE` | 13 of the same command run on `play.html` |

The fixtures contain no local path or e-mail (`findingsIn` of `scripts/hygiene.ts` returns `[]` for both) and no em dash.

- [ ] **Step 2: Write the tests.**

`tests/offline/cache-names.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { SHELL_CACHE_PREFIX, isOldShellCache, shellCacheName } from "@/src/offline/cache-names";

describe("shellCacheName", () => {
  it("names the cache of a release after its version", () => {
    expect(SHELL_CACHE_PREFIX).toBe("truthy-shell-");
    expect(shellCacheName("5db53f3-20261007T120000Z")).toBe("truthy-shell-5db53f3-20261007T120000Z");
    expect(shellCacheName("local")).toBe("truthy-shell-local");
  });
});

describe("isOldShellCache", () => {
  const version = "b2c3d4e-20261008T090000Z";

  it("is true for the shell cache of another release", () => {
    expect(isOldShellCache("truthy-shell-5db53f3-20261007T120000Z", version)).toBe(true);
    expect(isOldShellCache("truthy-shell-local", version)).toBe(true);
  });

  it("is false for this release's own cache", () => {
    expect(isOldShellCache(shellCacheName(version), version)).toBe(false);
  });

  it("leaves caches with other names alone", () => {
    expect(isOldShellCache("other-cache", version)).toBe(false);
    expect(isOldShellCache("truthy-decks", version)).toBe(false);
    expect(isOldShellCache("my-truthy-shell-old", version)).toBe(false);
  });
});
```

`tests/offline/assets.test.ts`:

```ts
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
```

`tests/offline/strategy.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { PAGE_TIMEOUT_MS, type RequestFacts, strategyFor } from "@/src/offline/strategy";

const ORIGIN = "https://truthy.example";

function request(path: string, init: { method?: string; mode?: string; headers?: Record<string, string> } = {}): RequestFacts {
  return {
    url: path.startsWith("http") ? path : `${ORIGIN}${path}`,
    method: init.method ?? "GET",
    mode: init.mode ?? "no-cors",
    headers: new Headers(init.headers),
  };
}

const navigate = (path: string) => request(path, { mode: "navigate" });

describe("strategyFor: pages", () => {
  it("serves the start page and the play page network first, with the cached copy", () => {
    expect(strategyFor(navigate("/"), ORIGIN)).toBe("page");
    expect(strategyFor(navigate("/play"), ORIGIN)).toBe("page");
  });

  it("keeps a page a page whatever its query or fragment", () => {
    expect(strategyFor(navigate("/?utm_source=homescreen"), ORIGIN)).toBe("page");
    expect(strategyFor(navigate("/play#card"), ORIGIN)).toBe("page");
  });

  it("serves any other same-origin page network first, with the 404 page offline", () => {
    expect(strategyFor(navigate("/missing"), ORIGIN)).toBe("unknown-page");
    expect(strategyFor(navigate("/play/"), ORIGIN)).toBe("unknown-page");
    expect(strategyFor(navigate("/play/extra"), ORIGIN)).toBe("unknown-page");
    expect(strategyFor(navigate("/__offline-not-found"), ORIGIN)).toBe("unknown-page");
  });

  it("waits 3 s for the network before it serves a cached page", () => {
    expect(PAGE_TIMEOUT_MS).toBe(3000);
  });
});

describe("strategyFor: static files", () => {
  it("serves hashed /_next/static files cache first", () => {
    expect(strategyFor(request("/_next/static/chunks/2nmwala9epd-b.js"), ORIGIN)).toBe("static");
    expect(strategyFor(request("/_next/static/chunks/1c8ovh-3ao8z6.css", { mode: "cors" }), ORIGIN)).toBe("static");
    expect(strategyFor(request("/_next/static/media/overpass_600-s.p.2bbaok-qso76f.woff2", { mode: "cors" }), ORIGIN)).toBe("static");
  });

  it("serves the icons and the manifest cache first, also with the hash query the HTML gives them", () => {
    for (const path of [
      "/icon.svg",
      "/icon.svg?icon.31fns5a0b7277.svg",
      "/apple-icon.png?apple-icon.1rqb135id39sj.png",
      "/icon-192.png",
      "/icon-512.png",
      "/manifest.webmanifest",
    ]) {
      expect(strategyFor(request(path), ORIGIN), path).toBe("static");
    }
  });
});

describe("strategyFor: left to the network", () => {
  it("passes deck data, also when it is opened as a page", () => {
    expect(strategyFor(request("/decks/index.json", { mode: "cors" }), ORIGIN)).toBe("pass");
    expect(strategyFor(request("/decks/aws-clf-c02.json?v=63acac4acc4a6213", { mode: "cors" }), ORIGIN)).toBe("pass");
    expect(strategyFor(navigate("/decks/index.json"), ORIGIN)).toBe("pass");
  });

  it("passes the worker's own script", () => {
    expect(strategyFor(request("/sw.js"), ORIGIN)).toBe("pass");
    expect(strategyFor(navigate("/sw.js"), ORIGIN)).toBe("pass");
  });

  it("passes a React Server Components request, by its _rsc query or its RSC header", () => {
    expect(strategyFor(request("/play?_rsc=QLBdCDjfpGkLRHBX", { mode: "cors" }), ORIGIN)).toBe("pass");
    expect(strategyFor(request("/?_rsc=QcbQXlok0Dzyyx9o", { mode: "cors" }), ORIGIN)).toBe("pass");
    expect(strategyFor(request("/play", { mode: "cors", headers: { RSC: "1" } }), ORIGIN)).toBe("pass");
    expect(strategyFor(request("/", { mode: "cors", headers: { rsc: "1", "next-router-prefetch": "1" } }), ORIGIN)).toBe("pass");
    expect(strategyFor(request("/play?_rsc=abc", { mode: "navigate" }), ORIGIN)).toBe("pass");
  });

  it("passes other origins, also for their pages and their static files", () => {
    expect(strategyFor(navigate("https://other.example/"), ORIGIN)).toBe("pass");
    expect(strategyFor(request("https://cdn.example/_next/static/chunks/a.js"), ORIGIN)).toBe("pass");
    expect(strategyFor(request("http://truthy.example/_next/static/chunks/a.js"), ORIGIN)).toBe("pass");
    expect(strategyFor(request("https://truthy.example:8443/icon.svg"), ORIGIN)).toBe("pass");
  });

  it("passes every method but GET", () => {
    for (const method of ["POST", "HEAD", "PUT", "DELETE", "OPTIONS"]) {
      expect(strategyFor(request("/_next/static/chunks/a.js", { method }), ORIGIN), method).toBe("pass");
      expect(strategyFor(request("/", { method, mode: "navigate" }), ORIGIN), method).toBe("pass");
    }
  });

  it("passes any other same-origin request that is not a page", () => {
    expect(strategyFor(request("/", { mode: "cors" }), ORIGIN)).toBe("pass");
    expect(strategyFor(request("/play", { mode: "same-origin" }), ORIGIN)).toBe("pass");
    expect(strategyFor(request("/favicon.ico"), ORIGIN)).toBe("pass");
    expect(strategyFor(request("/_next/image?url=x"), ORIGIN)).toBe("pass");
    expect(strategyFor(request("/icon-1024.png"), ORIGIN)).toBe("pass");
  });

  it("passes a request whose URL cannot be read", () => {
    expect(strategyFor({ url: "not a url", method: "GET", mode: "navigate", headers: new Headers() }, ORIGIN)).toBe("pass");
  });
});
```

`tests/purity.test.ts`: add the offline modules to `PURE`, after the `src/content/text.ts` entry:

```ts
  { files: ["src/content/text.ts"], mayImport: [] },
  // The service worker's decisions (offline spec section 5): the worker and the unit tests run the same code.
  { files: ["src/offline/assets.ts", "src/offline/cache-names.ts", "src/offline/strategy.ts"], mayImport: ["./"] },
];
```

and pin them in the "covers" case, which is renamed:

```ts
  it("covers the engine, the input rules, the progress rules, the shared play types, how card text marks code and the service worker's decisions", () => {
    expect(PURE.flatMap((entry) => entry.files).sort()).toEqual([
      "src/content/play.ts",
      "src/content/text.ts",
      "src/engine/deal.ts",
      "src/engine/rng.ts",
      "src/engine/round.ts",
      "src/input/swipe.ts",
      "src/offline/assets.ts",
      "src/offline/cache-names.ts",
      "src/offline/strategy.ts",
      "src/progress/progress.ts",
    ]);
  });
```

- [ ] **Step 3: Run them and watch them fail.**

```bash
pnpm vitest run tests/offline tests/purity.test.ts
```

Expected: the three offline files fail to load (`Error: Cannot find package '@/src/offline/assets'`, `'@/src/offline/cache-names'`, `'@/src/offline/strategy'`), and in `tests/purity.test.ts` the case "import only what the module table allows and use no clock, randomness, DOM or storage" fails with `ENOENT: no such file or directory, open 'src/offline/assets.ts'`. Summary: `Test Files  4 failed (4)`, `Tests  1 failed | 5 passed (6)`.

- [ ] **Step 4: Write the modules.**

`src/offline/cache-names.ts`:

```ts
// The names of the service worker's caches (spec section 6). Each release keeps its app shell in a cache of its
// own, "truthy-shell-<version>", so a page and the assets it loads always come from the same release; the
// worker deletes the caches of other releases when it activates.

export const SHELL_CACHE_PREFIX = "truthy-shell-";

/** The cache that holds the app shell of this release. */
export function shellCacheName(version: string): string {
  return `${SHELL_CACHE_PREFIX}${version}`;
}

/** A shell cache of another release: the worker of `version` deletes it. Caches with other names are left alone. */
export function isOldShellCache(name: string, version: string): boolean {
  return name.startsWith(SHELL_CACHE_PREFIX) && name !== shellCacheName(version);
}
```

`src/offline/assets.ts`:

```ts
// What the app shell is made of (spec section 6, "Install"): the two pages, and the same-origin files their HTML
// loads. The worker reads the HTML as text (a service worker has no DOM parser), so the tags are found with
// patterns. Every file a round needs is named in the HTML of `/` or `/play`: the scripts (also the noModule
// polyfill and the runtime that is both preloaded and loaded), the stylesheet, the preloaded font files of the
// self-hosted faces, the manifest and the icons. Nothing loads later.

/** The pages the worker keeps and serves offline. */
export const SHELL_PAGES = ["/", "/play"] as const;

/** A path that does not exist: the worker fetches it once and keeps the response as the offline 404 page. */
export const NOT_FOUND_PROBE = "/__offline-not-found";

/**
 * The icons and the manifest the app ships (app/icon.svg, app/apple-icon.png, public/icon-*.png, app/manifest.ts),
 * by path without a query. The HTML names only some of them, with a hash query; the manifest names the others.
 */
export const SHELL_FILES: ReadonlySet<string> = new Set(["/icon.svg", "/icon-192.png", "/icon-512.png", "/apple-icon.png", "/manifest.webmanifest"]);

// A link loads a file for the page only with one of these rel values. A prefetch or a preconnect is not part of it.
const LOADING_RELS: ReadonlySet<string> = new Set(["stylesheet", "preload", "modulepreload", "icon", "apple-touch-icon", "manifest"]);

// One pass from left to right, so the paths keep the order of the document. Comments, and the bodies of scripts
// and styles, are consumed whole: text inside them (the inline flight data names chunk paths) is never read as a tag.
const TAGS = /<!--[\s\S]*?-->|<script\b([^>]*)>[\s\S]*?<\/script\s*>|<style\b[^>]*>[\s\S]*?<\/style\s*>|<link\b([^>]*)>/gi;

// name, then a double quoted, single quoted or unquoted value (or none).
const ATTRIBUTE = /([^\s"'=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

function attributes(source: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const match of source.matchAll(ATTRIBUTE)) {
    const name = (match[1] ?? "").toLowerCase();
    if (!found.has(name)) found.set(name, decodeEntities(match[2] ?? match[3] ?? match[4] ?? ""));
  }
  return found;
}

function decodeEntities(value: string): string {
  return value.replace(/&(?:amp|#38|#x26);/gi, "&").replace(/&(?:quot|#34|#x22);/gi, '"').replace(/&(?:#39|#x27|apos);/gi, "'");
}

function isShellPath(pathname: string): boolean {
  return pathname.startsWith("/_next/static/") || SHELL_FILES.has(pathname);
}

// The path with its query (a hashed icon is requested as "/icon.svg?icon.<hash>.svg"), or null for another origin,
// a data: URL or a value that is not a URL.
function sameOriginPath(raw: string, origin: string): string | null {
  const value = raw.trim();
  if (value === "") return null;
  let url: URL;
  try {
    url = new URL(value, `${origin}/`);
  } catch {
    return null;
  }
  if (url.origin !== origin) return null;
  return isShellPath(url.pathname) ? `${url.pathname}${url.search}` : null;
}

function loadedBy(tag: RegExpMatchArray): string | undefined {
  if (tag[1] !== undefined) return attributes(tag[1]).get("src");
  if (tag[2] === undefined) return undefined;
  const link = attributes(tag[2]);
  const rels = (link.get("rel") ?? "").toLowerCase().split(/\s+/);
  return rels.some((rel) => LOADING_RELS.has(rel)) ? link.get("href") : undefined;
}

/**
 * The same-origin files a page's HTML loads that belong to the app shell: `/_next/static/...` from a script's src
 * or a stylesheet, preload or modulepreload link, and the icons and the manifest when a link names them. Each path
 * once, with its query, in the order of first appearance. Other origins and data: URLs are left out.
 */
export function assetPathsFromHtml(html: string, origin: string): string[] {
  const paths: string[] = [];
  const seen = new Set<string>();
  for (const tag of html.matchAll(TAGS)) {
    const raw = loadedBy(tag);
    if (raw === undefined) continue;
    const path = sameOriginPath(raw, origin);
    if (path === null || seen.has(path)) continue;
    seen.add(path);
    paths.push(path);
  }
  return paths;
}
```

`src/offline/strategy.ts`:

```ts
// What the service worker does with one request (spec section 6, "Fetch"). Pure: the worker passes the facts of
// the request, and the unit tests pass the same facts without a browser.

import { SHELL_FILES, SHELL_PAGES } from "./assets";

/**
 * - "page": a navigation to `/` or `/play`: the network first, the cached page when it fails or is slow.
 * - "unknown-page": a navigation to any other same-origin path: the network first, offline the cached 404 page.
 * - "static": a hashed `/_next/static/` file, an icon or the manifest: the cache first.
 * - "pass": the worker leaves the request to the network (no respondWith).
 */
export type Strategy = "page" | "unknown-page" | "static" | "pass";

/** The parts of a Request the decision reads. A real Request has them all. */
export interface RequestFacts {
  url: string;
  method: string;
  mode: string;
  headers: { get(name: string): string | null };
}

/** How long a page waits for the network before the cached copy is served. */
export const PAGE_TIMEOUT_MS = 3000;

const PAGES: ReadonlySet<string> = new Set(SHELL_PAGES);

/** The strategy for a request, seen from a page of `origin` (for example "https://truthy.example"). */
export function strategyFor(request: RequestFacts, origin: string): Strategy {
  if (request.method !== "GET") return "pass";
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return "pass";
  }
  if (url.origin !== origin) return "pass";
  // The worker's own script is always checked against the network, never served by the worker.
  if (url.pathname === "/sw.js") return "pass";
  // A React Server Components payload (router navigation or prefetch): the network only (spec section 8).
  if (url.searchParams.has("_rsc") || request.headers.get("RSC") !== null) return "pass";
  // Deck data: the app's own localStorage copy is the offline copy (spec section 3).
  if (url.pathname.startsWith("/decks/")) return "pass";
  if (request.mode === "navigate") return PAGES.has(url.pathname) ? "page" : "unknown-page";
  if (url.pathname.startsWith("/_next/static/") || SHELL_FILES.has(url.pathname)) return "static";
  return "pass";
}
```

- [ ] **Step 5: Run them green.**

```bash
pnpm vitest run tests/offline tests/purity.test.ts
```

Expected: `Test Files  4 passed (4)`, `Tests  40 passed (40)` (cache-names 4, assets 17, strategy 13, purity 6).

- [ ] **Step 6: Run the gates.**

```bash
pnpm typecheck
pnpm test
pnpm build
```

Expected: `tsc --noEmit` prints nothing and exits 0; `pnpm test` ends with `Test Files  133 passed (133)`, `Tests  2188 passed (2188)` (task 1's 130 files and 2154 tests, plus this task's 3 files and 34 tests); `pnpm build` lists the same six static routes as before (`/`, `/_not-found`, `/apple-icon.png`, `/icon.svg`, `/manifest.webmanifest`, `/play`, all `○`). This task names no e2e spec. `tests/repo-hygiene.test.ts` scans the fixtures once they are tracked; it passes with them added (checked with `git add -N` before the commit).

- [ ] **Step 7: Commit.**

```bash
git add src/offline tests/offline tests/purity.test.ts
git commit -m "feat: name the shell caches, read the files a page loads from its HTML and decide what the service worker does with each request"
```

**Tried:** in a worktree at 5db53f3: `pnpm build`, the fixtures copied from `.next/server/app` (`curl` of `pnpm start --port 3712` gave the same bytes for `/` and `/play`; a second build gave the same chunk names as check C3's build in another worktree); the tests failed as step 3 says, then passed with the modules (`40 passed (40)`); `pnpm typecheck` exit 0; `pnpm test` green; `tests/repo-hygiene.test.ts` green with the new files marked intent-to-add; `pnpm build` green. The build names were moved into one block afterwards (review); the assertions are the same.
