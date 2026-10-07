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

// The inside of a tag: any run of characters other than ">", where a quoted value is taken whole, so the ">" in
// "a>b" does not end the tag (the first alternative cannot start with a quote, so the runs cannot overlap).
const INSIDE = `(?:[^>"']|"[^"]*"|'[^']*')*`;

// One pass from left to right, so the paths keep the order of the document. Comments, and the bodies of scripts
// and styles, are consumed whole: text inside them (the inline flight data names chunk paths) is never read as a tag.
const TAGS = new RegExp(
  `<!--[\\s\\S]*?-->|<script\\b(${INSIDE})>[\\s\\S]*?</script\\s*>|<style\\b${INSIDE}>[\\s\\S]*?</style\\s*>|<link\\b(${INSIDE})>`,
  "gi",
);

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

const ENTITIES: Record<string, string> = { amp: "&", "#38": "&", "#x26": "&", quot: '"', "#34": '"', "#x22": '"', "#39": "'", "#x27": "'", apos: "'" };

// One pass, so the text an entity decodes to is never decoded again: "&amp;quot;" is the text "&quot;". The
// pattern names only entities in ENTITIES, so the lookup always finds one; the fallback, which keeps the text as
// it is, only gives the lookup a string type.
function decodeEntities(value: string): string {
  return value.replace(/&(amp|quot|apos|#38|#x26|#34|#x22|#39|#x27);/gi, (whole, name: string) => ENTITIES[name.toLowerCase()] ?? whole);
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
