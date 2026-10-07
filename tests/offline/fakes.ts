// Stand-ins for what a service worker gets from the browser: CacheStorage, fetch and a timer. Node has Request and
// Response but no CacheStorage. The caches key their entries by absolute URL, query included, as the browser does.
import { SHELL_FILES } from "@/src/offline/assets";
import type { WorkerEnv } from "@/src/offline/worker";

export const ORIGIN = "https://truthy.test";
export const VERSION = "abc1234-2026-10-07T10:00:00.000Z";

// The shape of the production build's pages: fonts as preloads, one stylesheet, the main chunk both as a preload
// and as a script, the page's own chunk, the icons with a hash query, the noModule polyfill.
export const ROOT_HTML = [
  '<!DOCTYPE html><html lang="en"><head>',
  '<link rel="preload" href="/_next/static/media/overpass_600-s.p.font1.woff2" as="font" crossorigin="" type="font/woff2"/>',
  '<link rel="stylesheet" href="/_next/static/chunks/app.css" data-precedence="next"/>',
  '<link rel="preload" as="script" fetchPriority="low" href="/_next/static/chunks/main.js"/>',
  '<script src="/_next/static/chunks/shared.js" async=""></script>',
  '<script src="/_next/static/chunks/root-page.js" async=""></script>',
  '<link rel="manifest" href="/manifest.webmanifest"/>',
  '<link rel="icon" href="/icon.svg?icon.hash1.svg" sizes="any" type="image/svg+xml"/>',
  '<link rel="apple-touch-icon" href="/apple-icon.png?apple-icon.hash2.png" sizes="180x180" type="image/png"/>',
  '<script src="/_next/static/chunks/polyfill.js" noModule=""></script>',
  '</head><body><main>Start</main><script src="/_next/static/chunks/main.js" id="_R_" async=""></script></body></html>',
].join("");

export const PLAY_HTML = ROOT_HTML.replace("root-page.js", "play-page.js").replace("<main>Start</main>", "<main>Play</main>");

export const NOT_FOUND_HTML = "<!DOCTYPE html><html><body><h1>Page not found</h1></body></html>";

// What a production server answers: the two pages, a body for every hashed file and every file of SHELL_FILES (the
// same list the worker installs), the game's 404 page for anything else. A test changes the answer for one path
// through FakeNetwork.routes.
function served(path: string): Response {
  if (path === "/") return new Response(ROOT_HTML, { status: 200 });
  if (path === "/play") return new Response(PLAY_HTML, { status: 200 });
  const pathname = new URL(path, ORIGIN).pathname;
  if (pathname.startsWith("/_next/static/") || SHELL_FILES.has(pathname)) return new Response(`file ${path}`, { status: 200 });
  return new Response(NOT_FOUND_HTML, { status: 404 });
}

export interface FetchCall {
  path: string;
  cache: RequestCache | undefined;
}

export interface FakeNetwork {
  fetch: WorkerEnv["fetch"];
  calls: FetchCall[];
  // Answers that differ from the production server, by path with its query.
  routes: Map<string, () => Response | Promise<Response>>;
  // When set, every fetch rejects as a fetch does with no network.
  offline: boolean;
}

export function fakeNetwork(): FakeNetwork {
  const network: FakeNetwork = {
    calls: [],
    routes: new Map(),
    offline: false,
    fetch: async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input), ORIGIN);
      const path = url.pathname + url.search;
      network.calls.push({ path, cache: init?.cache });
      if (network.offline) throw new TypeError("Failed to fetch");
      const route = network.routes.get(path);
      return route ? route() : served(path);
    },
  };
  return network;
}

function keyOf(input: RequestInfo | URL): string {
  return new URL(input instanceof Request ? input.url : String(input), ORIGIN).href;
}

export class FakeCache {
  readonly entries = new Map<string, Response>();

  async match(input: RequestInfo | URL): Promise<Response | undefined> {
    return this.entries.get(keyOf(input))?.clone();
  }

  async put(input: RequestInfo | URL, response: Response): Promise<void> {
    // The browser reads the whole body when it stores a response.
    const body = await response.arrayBuffer();
    this.entries.set(keyOf(input), new Response(body, { status: response.status, headers: response.headers }));
  }

  // The stored paths with their query, in the order they were stored.
  paths(): string[] {
    return [...this.entries.keys()].map((href) => {
      const url = new URL(href);
      return url.pathname + url.search;
    });
  }
}

export class FakeCaches {
  readonly stores = new Map<string, FakeCache>();

  async open(name: string): Promise<FakeCache> {
    let cache = this.stores.get(name);
    if (!cache) {
      cache = new FakeCache();
      this.stores.set(name, cache);
    }
    return cache;
  }

  async keys(): Promise<string[]> {
    return [...this.stores.keys()];
  }

  async has(name: string): Promise<boolean> {
    return this.stores.has(name);
  }

  async delete(name: string): Promise<boolean> {
    return this.stores.delete(name);
  }

  // Like the browser's, it looks in the named cache only when a cacheName is given, and never creates one.
  async match(input: RequestInfo | URL, options?: MultiCacheQueryOptions): Promise<Response | undefined> {
    const names = options?.cacheName === undefined ? [...this.stores.keys()] : [options.cacheName];
    for (const name of names) {
      const cache = this.stores.get(name);
      if (!cache) continue;
      const hit = await cache.match(input);
      if (hit) return hit;
    }
    return undefined;
  }

  asCacheStorage(): CacheStorage {
    return this as unknown as CacheStorage;
  }
}

export interface FakeTimers {
  setTimeout: WorkerEnv["setTimeout"];
  clearTimeout: WorkerEnv["clearTimeout"];
  // The delays asked for, by timer id.
  delays: number[];
  cleared: Set<number>;
  // Runs every timer that was set and not cleared.
  fire(): void;
}

export function fakeTimers(): FakeTimers {
  const pending: (() => void)[] = [];
  const timers: FakeTimers = {
    delays: [],
    cleared: new Set(),
    setTimeout: (fn, ms) => {
      pending.push(fn);
      timers.delays.push(ms);
      return pending.length - 1;
    },
    clearTimeout: (id) => {
      timers.cleared.add(id as number);
    },
    fire: () => {
      pending.forEach((fn, id) => {
        if (!timers.cleared.has(id)) fn();
      });
    },
  };
  return timers;
}

export interface Harness {
  env: WorkerEnv;
  caches: FakeCaches;
  network: FakeNetwork;
  timers: FakeTimers;
  skipWaiting: { calls: number };
  claim: { calls: number; cachesAtClaim: string[] };
}

export function harness(): Harness {
  const caches = new FakeCaches();
  const network = fakeNetwork();
  const timers = fakeTimers();
  const skipWaiting = { calls: 0 };
  const claim = { calls: 0, cachesAtClaim: [] as string[] };
  const env: WorkerEnv = {
    version: VERSION,
    origin: ORIGIN,
    caches: caches.asCacheStorage(),
    fetch: network.fetch,
    skipWaiting: async () => {
      skipWaiting.calls += 1;
    },
    claim: async () => {
      claim.calls += 1;
      claim.cachesAtClaim = await caches.keys();
    },
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
  };
  return { env, caches, network, timers, skipWaiting, claim };
}

// A page load. Node's Request refuses mode "navigate" in its constructor, so the mode is set the way the browser
// reports it.
export function navigate(path: string): Request {
  const request = new Request(new URL(path, ORIGIN));
  Object.defineProperty(request, "mode", { value: "navigate" });
  return request;
}

export function get(path: string, init?: RequestInit): Request {
  return new Request(new URL(path, ORIGIN), init);
}

// A response that came through a redirect. Node's Response sets `redirected` only for a fetch it followed, so the
// flag is set the way the browser reports it.
export function redirected(response: Response): Response {
  Object.defineProperty(response, "redirected", { value: true });
  return response;
}
