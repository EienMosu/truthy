// The service worker's behaviour (spec section 6). Everything it needs from the worker global comes in through
// WorkerEnv, so the unit tests drive it with a fake CacheStorage, fetch and timer; src/offline/sw-entry.ts wires it
// to the real ones and scripts/build-sw.ts bundles that into public/sw.js.
import { NOT_FOUND_PROBE, SHELL_FILES, SHELL_PAGES, assetPathsFromHtml } from "./assets";
import { isOldShellCache, shellCacheName } from "./cache-names";
import { PAGE_TIMEOUT_MS, strategyFor } from "./strategy";

export interface WorkerEnv {
  version: string;
  origin: string;
  caches: CacheStorage;
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  skipWaiting: () => Promise<void>;
  claim: () => Promise<void>;
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (id: unknown) => void;
}

export interface ShellWorker {
  install(): Promise<void>;
  activate(): Promise<void>;
  /** The worker's answer, or null for a request it leaves to the browser (the entry then does not call respondWith). */
  respond(request: Request): Promise<Response> | null;
  /** `{ type: "apply-update" }` lets the waiting version take over; anything else is ignored. */
  message(data: unknown): Promise<void>;
}

const isOk = (status: number) => status >= 200 && status < 300;

function isApplyUpdate(data: unknown): boolean {
  return typeof data === "object" && data !== null && (data as { type?: unknown }).type === "apply-update";
}

// A script of the build, by path with its query. Every page of the build loads its scripts from /_next/static/;
// a page that names none is not a page this worker knows how to keep.
const BUILD_SCRIPT = /^\/_next\/static\/[^?]*\.js(?:\?|$)/;

export function createWorker(env: WorkerEnv): ShellWorker {
  const cacheName = shellCacheName(env.version);
  const absolute = (path: string) => new URL(path, env.origin).href;

  // One file of the shell. Files without a hash in their name (the pages, the icons, the manifest, the 404 page)
  // are revalidated with the server, so the shell is the release this worker belongs to; hashed files may come
  // from the browser's HTTP cache, as they never change. A file that came through a redirect fails the install:
  // the browser refuses a redirected response as the answer to a page load, so a kept page would fail offline.
  async function fetchShellFile(path: string, expected: (status: number) => boolean): Promise<Response> {
    const hashed = path.startsWith("/_next/static/");
    const response = await env.fetch(absolute(path), hashed ? undefined : { cache: "no-cache" });
    if (response.redirected) throw new Error(`${path} answered with a redirect`);
    if (!expected(response.status)) throw new Error(`${path} answered ${response.status}`);
    return response;
  }

  // The cached copy in this version's cache, or undefined. Looking does not create the cache.
  async function cached(key: RequestInfo): Promise<Response | undefined> {
    try {
      return await env.caches.match(key, { cacheName });
    } catch {
      return undefined;
    }
  }

  // Network first, the cached page when the network fails or is slower than PAGE_TIMEOUT_MS. A server error
  // (5xx) is no better than no network: the cached page when there is one, else the server's answer. A slow
  // network with nothing cached is waited for. A fresh page is not stored: the cache changes only with a new version.
  function page(request: Request): Promise<Response> {
    const key = absolute(new URL(request.url).pathname);
    return new Promise<Response>((resolve, reject) => {
      let done = false;
      const finish = (response: Response) => {
        if (done) return;
        done = true;
        env.clearTimeout(timer);
        resolve(response);
      };
      const timer = env.setTimeout(() => {
        void cached(key).then((hit) => {
          if (hit) finish(hit);
        });
      }, PAGE_TIMEOUT_MS);
      const answered = (response: Response) => {
        if (response.status < 500) return finish(response);
        void cached(key).then((hit) => finish(hit ?? response));
      };
      env.fetch(request).then(answered, (error: unknown) => {
        void cached(key).then((hit) => {
          if (hit) return finish(hit);
          if (done) return;
          done = true;
          env.clearTimeout(timer);
          reject(error);
        });
      });
    });
  }

  // Network first; offline, the game's own 404 page with its status.
  async function unknownPage(request: Request): Promise<Response> {
    try {
      return await env.fetch(request);
    } catch (error) {
      const notFound = await cached(absolute(NOT_FOUND_PROBE));
      if (notFound) return notFound;
      throw error;
    }
  }

  // Cache first, by the full URL with its query. A file the cache does not hold (a chunk a page loads later) is
  // fetched and kept when it is fine.
  async function staticFile(request: Request): Promise<Response> {
    const hit = await cached(request);
    if (hit) return hit;
    const response = await env.fetch(request);
    if (response.ok) {
      try {
        const cache = await env.caches.open(cacheName);
        await cache.put(request, response.clone());
      } catch {
        // A full disk only means the file is fetched again next time.
      }
    }
    return response;
  }

  return {
    // The two pages first (their HTML names the rest), then every file they name together with SHELL_FILES, in
    // parallel, then the 404 probe once those have answered.
    async install() {
      const pages = await Promise.all(
        SHELL_PAGES.map(async (path) => {
          const response = await fetchShellFile(path, isOk);
          const html = await response.clone().text();
          const named = assetPathsFromHtml(html, env.origin);
          // A page of another shape (a changed build) fails the install rather than leaving a cache without scripts.
          if (!named.some((file) => BUILD_SCRIPT.test(file))) throw new Error(`${path} names no script under /_next/static/`);
          return { path, response, named };
        }),
      );
      // Every file the pages name, and the icons and the manifest whether the pages name them or not (SHELL_FILES:
      // the home screen asks for the plain paths the manifest gives).
      const paths = [...new Set([...pages.flatMap(({ named }) => named), ...SHELL_FILES])];
      const files = await Promise.all(paths.map(async (path) => ({ path, response: await fetchShellFile(path, isOk) })));
      const notFound = { path: NOT_FOUND_PROBE, response: await fetchShellFile(NOT_FOUND_PROBE, (status) => status === 404) };

      // Stored only once every fetch has answered, so a failed install leaves no half-filled cache behind; the
      // running version's cache is never touched here.
      try {
        const cache = await env.caches.open(cacheName);
        for (const { path, response } of [...pages, ...files, notFound]) await cache.put(absolute(path), response);
      } catch (error) {
        await env.caches.delete(cacheName);
        throw error;
      }
    },

    async activate() {
      const names = await env.caches.keys();
      await Promise.all(names.filter((name) => isOldShellCache(name, env.version)).map((name) => env.caches.delete(name)));
      // The first version takes the open page at once, so the first visit already works offline. A later version
      // only activates at a safe moment (src/offline/register.ts), where taking the pages over changes no round.
      await env.claim();
    },

    respond(request) {
      switch (strategyFor(request, env.origin)) {
        case "page":
          return page(request);
        case "unknown-page":
          return unknownPage(request);
        case "static":
          return staticFile(request);
        case "pass":
          return null;
      }
    },

    async message(data) {
      if (isApplyUpdate(data)) await env.skipWaiting();
    },
  };
}
