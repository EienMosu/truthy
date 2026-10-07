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
