### Task 3: The service worker, built into public/sw.js

The worker that keeps the app shell on the device (spec section 6) and the build that ships it (spec section 9). `createWorker` holds all of its behaviour behind a small `WorkerEnv`, so the unit tests drive install, activate, fetch and message with a fake CacheStorage, fetch and timer. `src/offline/version.ts` is the release version the worker carries (spec section 5), filled in at build time; `sw-entry.ts` is the one file that touches the worker global; `scripts/build-sw.ts` bundles it with esbuild into `public/sw.js` with the release version filled in, before every `next build` and `next dev`. `next.config.ts` sends `/sw.js` with `Cache-Control: no-cache`. Nothing registers the worker yet (task 4), so the smoke spec registers it by hand.

Decisions this task takes (from the checks and where the brief and the spec leave room):

1. **The files the HTML does not name** (check C3). The pages name the icons only with a hash query (`/icon.svg?icon.<hash>.svg`, `/apple-icon.png?apple-icon.<hash>.png`) and never `/icon-192.png` or `/icon-512.png`; the manifest lists the plain `/icon.svg`, `/icon-192.png` and `/icon-512.png`. Install adds task 2's `SHELL_FILES` (the manifest and the four icons, by path without a query) to what `assetPathsFromHtml` finds in the two pages. `SHELL_FILES` is the only list of such files: `strategyFor` reads the same set for "static", and the test fakes serve from it. Cache keys are full URLs with their query, so `/icon.svg?icon.<hash>.svg` and `/icon.svg` are two entries and each request matches its own exactly; no `ignoreSearch`.
2. **Claim.** `activate` always calls `claim()` after deleting the old caches. This is what spec section 6 asks: the very first version claims the open page so the first visit already works offline, and a later version only activates when a page posts `apply-update` at a safe moment (tasks 4 and 5), so claiming then cannot change a running round. `WorkerEnv` (fixed by the brief) gives the worker no way to tell a first install from an update, and none is needed: pages the old version controls switch to the new one on activation whether or not it claims; `claim()` only adds the open pages no worker controls yet.
3. **Install.** The two pages are fetched first (their HTML names the rest), then every named file, `SHELL_FILES` and the 404 probe, in parallel. Files without a hash in their name (the pages, icons, manifest, probe) are fetched with `cache: "no-cache"`, so the shell is the release the worker belongs to; hashed `/_next/static` files may come from the HTTP cache. Every page and file must answer 2xx and the probe exactly 404, or the install fails with `<path> answered <status>`. Nothing is stored until every fetch has answered; if storing fails midway (a full device), the version's cache is deleted and the running version's cache is left as it was. No `skipWaiting` at install.
4. **Pages** are looked up by pathname, so `/?from=home-screen` offline gets the cached `/`. The 3 s timer serves the cached page only if there is one; with nothing cached the worker waits for the network. A cache lookup never creates the cache (`caches.match(key, { cacheName })`).
5. **Static files** missing from the cache are fetched and kept when the answer is ok (C3 shows a round loads nothing the HTML does not name, so this is a safety net); a failed answer is passed on and not kept.
6. **Version** (brief, spec section 5): `${commit}-${buildTime}`, commit from `VERCEL_GIT_COMMIT_SHA`, else `git rev-parse --short HEAD`, else `local`; build time `new Date().toISOString()`. `src/offline/version.ts` exports it as `RELEASE_VERSION`, read from the esbuild `define` of `__TRUTHY_VERSION__`; only `sw-entry.ts` imports it, inside the bundle, and passes it to `createWorker` through `WorkerEnv.version`, so the unit tests give the worker any version they like.
7. **Engines** (check C2): the smoke spec stays online, where registration, control after `claim()` and a worker-served reload work in both Playwright 1.63 engines, so it runs on `phone-chromium` and `phone-webkit`. It asserts on `response.fromServiceWorker()` and on what the page reads from `caches`, never on Playwright's worker events (Chromium only).

**Files:**
- Create: `src/offline/worker.ts`, `src/offline/version.ts`, `src/offline/sw-entry.ts`, `scripts/build-sw.ts`, `e2e/service-worker.spec.ts`
- Modify: `package.json` (scripts), `.gitignore`, `next.config.ts`, `README.md` (the commands table), `docs/testing.md` (the gates table)
- Test: create `tests/offline/fakes.ts`, `tests/offline/worker.test.ts`, `tests/offline/sw-entry.test.ts`, `tests/scripts/build-sw.test.ts`; modify `tests/security-headers.test.ts`, `tests/publish-files.test.ts`

**Interfaces:**
- Consumes:
  - Task 1: `esbuild` 0.28.2 in `devDependencies`; `playwright.config.ts` `use.serviceWorkers = "block"`; the `tests/publish-files.test.ts` case that pins `prebuild` (changed in step 9).
  - Task 2, `src/offline/cache-names.ts`: `shellCacheName(version)`, `isOldShellCache(name, version)`.
  - Task 2, `src/offline/assets.ts`: `assetPathsFromHtml(html, origin)`, `SHELL_PAGES`, `NOT_FOUND_PROBE`, `SHELL_FILES`.
  - Task 2, `src/offline/strategy.ts`: `strategyFor(request, origin)`, `PAGE_TIMEOUT_MS`.
- Produces:

```ts
// src/offline/worker.ts
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
  respond(request: Request): Promise<Response> | null;   // null for "pass": the entry does not call respondWith
  message(data: unknown): Promise<void>;                  // { type: "apply-update" } calls skipWaiting
}
export function createWorker(env: WorkerEnv): ShellWorker;

// src/offline/version.ts (bundled into public/sw.js only)
export const RELEASE_VERSION: string;   // "<commit>-<ISO build time>", the esbuild define __TRUTHY_VERSION__
```

  - `public/sw.js` (generated, git-ignored): one classic script, scope `/`, served with `Cache-Control: no-cache` and the hardening headers. Its cache is `truthy-shell-<version>`; the version is in the script as one string literal. Task 4 registers it; tasks 7 and 8 drive it offline; the end-to-end proxy of task 6 rewrites that string literal when task 8's update spec makes a new release.
  - `package.json`: `"build:sw": "tsx scripts/build-sw.ts"`; `predev` and `prebuild`: `"pnpm build:tokens && pnpm build:decks && pnpm build:sw"`.
  - `e2e/service-worker.spec.ts` is taken.

**Steps:**

- [ ] **Step 1: Write the fakes and the worker tests.**

Create `tests/offline/fakes.ts`:

```ts
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
```

Create `tests/offline/worker.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NOT_FOUND_PROBE, SHELL_FILES, SHELL_PAGES, assetPathsFromHtml } from "@/src/offline/assets";
import { shellCacheName } from "@/src/offline/cache-names";
import { PAGE_TIMEOUT_MS } from "@/src/offline/strategy";
import { createWorker } from "@/src/offline/worker";
import { NOT_FOUND_HTML, ORIGIN, PLAY_HTML, ROOT_HTML, VERSION, get, harness, navigate } from "./fakes";

const OWN = shellCacheName(VERSION);

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

function sorted(paths: readonly string[]): string[] {
  return [...new Set(paths)].sort();
}

// What the install must keep: the two pages, every file their HTML names, the manifest and every icon, the 404 page.
const SHELL = sorted([
  ...SHELL_PAGES,
  ...assetPathsFromHtml(ROOT_HTML, ORIGIN),
  ...assetPathsFromHtml(PLAY_HTML, ORIGIN),
  ...SHELL_FILES,
  NOT_FOUND_PROBE,
]);

async function installed() {
  const h = harness();
  const worker = createWorker(h.env);
  await worker.install();
  h.network.calls.length = 0;
  return { ...h, worker };
}

describe("install", () => {
  it("keeps the two pages, every file their HTML names, the manifest, its icons and the 404 page in this version's cache", async () => {
    const h = harness();
    await createWorker(h.env).install();
    expect(await h.caches.keys()).toEqual([OWN]);
    const cache = await h.caches.open(OWN);
    expect(sorted(cache.paths())).toEqual(SHELL);
    // The files the production pages name in their own ways: once although named twice, with the icons' hash
    // query, the page chunk of each page, and the icons the HTML names with a query or not at all.
    expect(cache.paths().filter((path) => path === "/_next/static/chunks/main.js")).toHaveLength(1);
    expect(cache.paths()).toEqual(
      expect.arrayContaining([
        "/_next/static/media/overpass_600-s.p.font1.woff2",
        "/_next/static/chunks/root-page.js",
        "/_next/static/chunks/play-page.js",
        "/icon.svg?icon.hash1.svg",
        "/apple-icon.png?apple-icon.hash2.png",
        "/icon.svg",
        "/icon-192.png",
        "/icon-512.png",
        "/apple-icon.png",
        "/manifest.webmanifest",
      ]),
    );
    expect(await (await cache.match(`${ORIGIN}/`))?.text()).toBe(ROOT_HTML);
    expect(await (await cache.match(`${ORIGIN}/play`))?.text()).toBe(PLAY_HTML);
  });

  it("keeps the game's 404 page with its status", async () => {
    const h = harness();
    await createWorker(h.env).install();
    const notFound = await (await h.caches.open(OWN)).match(`${ORIGIN}${NOT_FOUND_PROBE}`);
    expect(notFound?.status).toBe(404);
    expect(await notFound?.text()).toBe(NOT_FOUND_HTML);
  });

  it("fetches each file once, the pages and the files without a hash past the browser's HTTP cache", async () => {
    const h = harness();
    await createWorker(h.env).install();
    expect(sorted(h.network.calls.map((call) => call.path))).toEqual(SHELL);
    expect(h.network.calls).toHaveLength(SHELL.length);
    for (const call of h.network.calls) {
      const hashed = call.path.startsWith("/_next/static/");
      expect(call.cache, call.path).toBe(hashed ? undefined : "no-cache");
    }
  });

  it.each([
    ["a page", "/play"],
    ["a file a page names", "/_next/static/chunks/shared.js"],
    ["an icon", "/icon-512.png"],
  ])("fails when %s cannot be fetched, and leaves no cache of this version", async (_what, path) => {
    const h = harness();
    h.network.routes.set(path, () => new Response("down", { status: 503 }));
    await expect(createWorker(h.env).install()).rejects.toThrow(`${path} answered 503`);
    expect(await h.caches.keys()).toEqual([]);
  });

  it("fails when the network is gone, and leaves no cache of this version", async () => {
    const h = harness();
    h.network.offline = true;
    await expect(createWorker(h.env).install()).rejects.toThrow("Failed to fetch");
    expect(await h.caches.keys()).toEqual([]);
  });

  it("fails when the 404 probe does not answer 404, so a page is never kept as the 404 page", async () => {
    const h = harness();
    h.network.routes.set(NOT_FOUND_PROBE, () => new Response("a page", { status: 200 }));
    await expect(createWorker(h.env).install()).rejects.toThrow(`${NOT_FOUND_PROBE} answered 200`);
    expect(await h.caches.keys()).toEqual([]);
  });

  it("fails when the device cannot store the shell (its storage is full), and leaves the running version's cache as it was", async () => {
    const h = harness();
    const running = await h.caches.open(shellCacheName("running"));
    await running.put(`${ORIGIN}/`, new Response("<html>running</html>"));
    // The fifth file this version stores finds the device full.
    const own = await h.caches.open(OWN);
    const put = own.put.bind(own);
    let stored = 0;
    own.put = async (input, response) => {
      stored += 1;
      if (stored > 4) throw new Error("QuotaExceededError: the device is full");
      await put(input, response);
    };
    await expect(createWorker(h.env).install()).rejects.toThrow("the device is full");
    expect(await h.caches.keys()).toEqual([shellCacheName("running")]);
    expect(await (await running.match(`${ORIGIN}/`))?.text()).toBe("<html>running</html>");
  });

  it("does not take over on its own", async () => {
    const h = harness();
    await createWorker(h.env).install();
    expect(h.skipWaiting.calls).toBe(0);
    expect(h.claim.calls).toBe(0);
  });
});

describe("activate", () => {
  it("deletes the shell caches of other versions, keeps its own and any other cache, then claims the open pages", async () => {
    const h = harness();
    for (const name of [shellCacheName("old-1"), OWN, "someone-else", shellCacheName("old-2")]) await h.caches.open(name);
    await createWorker(h.env).activate();
    expect(await h.caches.keys()).toEqual([OWN, "someone-else"]);
    expect(h.claim.calls).toBe(1);
    expect(h.claim.cachesAtClaim).toEqual([OWN, "someone-else"]);
    expect(h.skipWaiting.calls).toBe(0);
  });
});

describe("requests the worker leaves to the browser", () => {
  it.each([
    ["another origin", new Request("https://elsewhere.test/_next/static/chunks/main.js")],
    ["a POST", get("/_next/static/chunks/main.js", { method: "POST", body: "x" })],
    ["a deck", get("/decks/aws-clf-c02.json?v=63acac4acc4a6213")],
    ["the deck index", get("/decks/index.json")],
    ["the worker script", get("/sw.js")],
    ["a server components payload by query", get("/play?_rsc=QLBdCDjfpGkLRHBX")],
    ["a server components payload by header", get("/play", { headers: { RSC: "1" } })],
  ])("%s gets no answer from the worker", async (_what, request) => {
    const { worker, network } = await installed();
    expect(worker.respond(request)).toBeNull();
    expect(network.calls).toEqual([]);
  });
});

describe("the two pages", () => {
  it("come from the network when it answers in time, and the cache stays as the install left it", async () => {
    const { worker, network, caches, timers } = await installed();
    network.routes.set("/play", () => new Response("<html>newer</html>", { status: 200 }));
    const response = await worker.respond(navigate("/play"));
    expect(await response?.text()).toBe("<html>newer</html>");
    expect(network.calls.map((call) => call.path)).toEqual(["/play"]);
    expect(await (await (await caches.open(OWN)).match(`${ORIGIN}/play`))?.text()).toBe(PLAY_HTML);
    expect(timers.cleared.size).toBe(1);
  });

  it.each([
    ["/", ROOT_HTML],
    ["/play", PLAY_HTML],
    ["/?from=home-screen", ROOT_HTML],
  ])("%s comes from the cache when the network fails", async (path, html) => {
    const { worker, network } = await installed();
    network.offline = true;
    const response = await worker.respond(navigate(path));
    expect(response?.status).toBe(200);
    expect(await response?.text()).toBe(html);
  });

  it(`comes from the cache when the network takes longer than ${PAGE_TIMEOUT_MS} ms, without waiting for it`, async () => {
    const { worker, network, timers } = await installed();
    network.routes.set("/", () => new Promise<Response>(() => {}));
    const pending = worker.respond(navigate("/"));
    await flush();
    expect(timers.delays).toEqual([PAGE_TIMEOUT_MS]);
    timers.fire();
    expect(await (await pending)?.text()).toBe(ROOT_HTML);
  });

  it("waits for a slow network when the page is not in the cache", async () => {
    const h = harness();
    const worker = createWorker(h.env);
    let answer: (response: Response) => void = () => {};
    h.network.routes.set("/", () => new Promise<Response>((resolve) => (answer = resolve)));
    let settled = false;
    const pending = worker.respond(navigate("/"));
    void pending?.then(() => (settled = true));
    await flush();
    h.timers.fire();
    await flush();
    expect(settled).toBe(false);
    answer(new Response("<html>late</html>", { status: 200 }));
    expect(await (await pending)?.text()).toBe("<html>late</html>");
    // Looking in the cache does not create one.
    expect(await h.caches.keys()).toEqual([]);
  });

  it("fails as the network failed when the page is not in the cache", async () => {
    const h = harness();
    h.network.offline = true;
    await expect(createWorker(h.env).respond(navigate("/play"))).rejects.toThrow("Failed to fetch");
  });
});

describe("any other page", () => {
  it("comes from the network online, the game's 404 page included", async () => {
    const { worker } = await installed();
    const response = await worker.respond(navigate("/nope"));
    expect(response?.status).toBe(404);
    expect(await response?.text()).toBe(NOT_FOUND_HTML);
  });

  it("is the kept 404 page, status 404, when the network fails", async () => {
    const { worker, network } = await installed();
    network.offline = true;
    const response = await worker.respond(navigate("/Play"));
    expect(response?.status).toBe(404);
    expect(await response?.text()).toBe(NOT_FOUND_HTML);
  });
});

describe("hashed files, icons and the manifest", () => {
  it.each(["/_next/static/chunks/main.js", "/icon.svg?icon.hash1.svg", "/icon-192.png", "/apple-icon.png", "/manifest.webmanifest"])(
    "%s comes from the cache without the network",
    async (path) => {
      const { worker, network } = await installed();
      network.offline = true;
      const response = await worker.respond(get(path));
      expect(await response?.text()).toBe(`file ${path}`);
      expect(network.calls).toEqual([]);
    },
  );

  it("fetches a file the cache does not hold, and keeps it for the next time", async () => {
    const { worker, network, caches } = await installed();
    const path = "/_next/static/chunks/lazy.js";
    expect(await (await worker.respond(get(path)))?.text()).toBe(`file ${path}`);
    expect((await caches.open(OWN)).paths()).toContain(path);
    network.offline = true;
    expect(await (await worker.respond(get(path)))?.text()).toBe(`file ${path}`);
    expect(network.calls.map((call) => call.path)).toEqual([path]);
  });

  it("passes on a failed answer for a file it does not hold, and does not keep it", async () => {
    const { worker, network, caches } = await installed();
    const path = "/_next/static/chunks/missing.js";
    network.routes.set(path, () => new Response(NOT_FOUND_HTML, { status: 404 }));
    const response = await worker.respond(get(path));
    expect(response?.status).toBe(404);
    expect((await caches.open(OWN)).paths()).not.toContain(path);
  });

  it("fails as the network failed for a file it does not hold", async () => {
    const { worker, network } = await installed();
    network.offline = true;
    await expect(worker.respond(get("/_next/static/chunks/lazy.js"))).rejects.toThrow("Failed to fetch");
  });
});

describe("messages", () => {
  it("takes over when the page asks it to apply the update", async () => {
    const h = harness();
    await createWorker(h.env).message({ type: "apply-update" });
    expect(h.skipWaiting.calls).toBe(1);
  });

  it.each([null, undefined, "apply-update", { type: "something-else" }, { kind: "apply-update" }])("ignores %j", async (data) => {
    const h = harness();
    await createWorker(h.env).message(data);
    expect(h.skipWaiting.calls).toBe(0);
  });
});

describe("module boundaries", () => {
  const code = (path: string) => readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const imports = (path: string) => [...code(path).matchAll(/\bfrom\s*["']([^"']+)["']/g)].map((match) => match[1]);

  it("the worker reads only its sibling modules and never the worker global, so the tests can drive it", () => {
    expect(sorted(imports("src/offline/worker.ts").map(String))).toEqual(["./assets", "./cache-names", "./strategy"]);
    expect(code("src/offline/worker.ts")).not.toMatch(/\bself\b|\bglobalThis\b/);
  });
});
```

The case of the entry's imports lives in `tests/offline/sw-entry.test.ts` (step 5): `src/offline/sw-entry.ts` does not exist until step 7.

- [ ] **Step 2: Run them and watch them fail.**

```bash
pnpm vitest run tests/offline/worker.test.ts
```

Expected: the file fails to load, `Error: Cannot find package '@/src/offline/worker' imported from .../tests/offline/worker.test.ts`; `Test Files  1 failed (1)`.

- [ ] **Step 3: Write the worker.**

Create `src/offline/worker.ts`:

```ts
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
  respond(request: Request): Promise<Response> | null;
  message(data: unknown): Promise<void>;
}

function isApplyUpdate(data: unknown): boolean {
  return typeof data === "object" && data !== null && (data as { type?: unknown }).type === "apply-update";
}

export function createWorker(env: WorkerEnv): ShellWorker {
  const cacheName = shellCacheName(env.version);
  const absolute = (path: string) => new URL(path, env.origin).href;

  // One file of the shell. Files without a hash in their name (the pages, the icons, the manifest, the 404 page)
  // are revalidated with the server, so the shell is the release this worker belongs to; hashed files may come
  // from the browser's HTTP cache, as they never change.
  async function fetchShellFile(path: string, expected: (status: number) => boolean): Promise<Response> {
    const hashed = path.startsWith("/_next/static/");
    const response = await env.fetch(absolute(path), hashed ? undefined : { cache: "no-cache" });
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

  // Network first, the cached page when the network fails or is slower than PAGE_TIMEOUT_MS. A slow network
  // with nothing cached is waited for. A fresh page is not stored: the cache changes only with a new version.
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
      env.fetch(request).then(finish, (error: unknown) => {
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
    async install() {
      const pages = await Promise.all(
        SHELL_PAGES.map(async (path) => {
          const response = await fetchShellFile(path, (status) => status >= 200 && status < 300);
          return { path, response, html: await response.clone().text() };
        }),
      );
      // Every file the pages name, and the icons and the manifest whether the pages name them or not (SHELL_FILES:
      // the home screen asks for the plain paths the manifest gives).
      const paths = [...new Set([...pages.flatMap(({ html }) => assetPathsFromHtml(html, env.origin)), ...SHELL_FILES])];
      const files = await Promise.all(
        paths.map(async (path) => ({ path, response: await fetchShellFile(path, (status) => status >= 200 && status < 300) })),
      );
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
```

- [ ] **Step 4: Run them green.**

```bash
pnpm vitest run tests/offline/worker.test.ts
```

Expected: `Test Files  1 passed (1)`, `Tests  42 passed (42)`.

- [ ] **Step 5: Write the tests of the entry and the build script.**

Create `tests/offline/sw-entry.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { build } from "esbuild";
import { beforeAll, describe, expect, it } from "vitest";
import { shellCacheName } from "@/src/offline/cache-names";
import { FakeCaches, ORIGIN, fakeNetwork, get, navigate } from "./fakes";

// The entry is the one file that touches the worker global. It is bundled the way scripts/build-sw.ts bundles it
// and run against a stand-in for that global, so the wiring of each event to createWorker is what is tested.
const VERSION = "entry-test-version";

let bundle = "";

beforeAll(async () => {
  const result = await build({
    entryPoints: ["src/offline/sw-entry.ts"],
    bundle: true,
    write: false,
    format: "iife",
    target: "es2022",
    define: { __TRUTHY_VERSION__: JSON.stringify(VERSION) },
    logLevel: "silent",
  });
  bundle = result.outputFiles[0]?.text ?? "";
}, 30_000);

type Listener = (event: unknown) => void;

function boot() {
  const listeners = new Map<string, Listener>();
  const caches = new FakeCaches();
  const network = fakeNetwork();
  const taken = { skipWaiting: 0, claim: 0 };
  const scope = {
    location: { origin: ORIGIN },
    caches: caches.asCacheStorage(),
    // The real fetch must be called with the worker global as its this; the entry binds it.
    fetch(this: unknown, input: RequestInfo | URL, init?: RequestInit) {
      if (this !== scope) throw new TypeError("Illegal invocation");
      return network.fetch(input, init);
    },
    skipWaiting: async () => {
      taken.skipWaiting += 1;
    },
    clients: {
      claim: async () => {
        taken.claim += 1;
      },
    },
    addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
  };
  runInNewContext(bundle, { self: scope, setTimeout, clearTimeout, URL, Request, Response, Promise });
  return { listeners, caches, network, taken };
}

// An event with waitUntil, as install, activate and message events have.
function extendable(extra: Record<string, unknown> = {}) {
  const waited: Promise<unknown>[] = [];
  return { event: { ...extra, waitUntil: (promise: Promise<unknown>) => waited.push(promise) }, waited };
}

function fetchEvent(request: Request) {
  const answered: Promise<Response>[] = [];
  return { event: { request, respondWith: (response: Promise<Response>) => answered.push(response) }, answered };
}

describe("the worker entry", () => {
  it("is one classic script with the version filled in", () => {
    expect(bundle).not.toMatch(/^\s*(import|export)\b/m);
    expect(bundle).not.toContain("__TRUTHY_VERSION__");
    expect(bundle).toContain(JSON.stringify(VERSION));
  });

  it("listens for install, activate, fetch and message", () => {
    expect([...boot().listeners.keys()].sort()).toEqual(["activate", "fetch", "install", "message"]);
  });

  it("holds the install open until the shell is in the cache named for its version", async () => {
    const { listeners, caches } = boot();
    const { event, waited } = extendable();
    listeners.get("install")?.(event);
    expect(waited).toHaveLength(1);
    await Promise.all(waited);
    expect(await caches.keys()).toEqual([shellCacheName(VERSION)]);
  });

  it("holds the activation open until old caches are gone and the pages are claimed", async () => {
    const { listeners, caches, taken } = boot();
    await caches.open(shellCacheName("older"));
    const { event, waited } = extendable();
    listeners.get("activate")?.(event);
    await Promise.all(waited);
    expect(await caches.keys()).toEqual([]);
    expect(taken.claim).toBe(1);
  });

  it("answers the requests the worker handles, through the bound fetch, and leaves the others alone", async () => {
    const { listeners } = boot();
    const page = fetchEvent(navigate("/"));
    listeners.get("fetch")?.(page.event);
    expect(page.answered).toHaveLength(1);
    expect((await page.answered[0])?.status).toBe(200);

    const deck = fetchEvent(get("/decks/index.json"));
    listeners.get("fetch")?.(deck.event);
    expect(deck.answered).toEqual([]);
  });

  it("takes over when a page posts apply-update", async () => {
    const { listeners, taken } = boot();
    const { event, waited } = extendable({ data: { type: "apply-update" } });
    listeners.get("message")?.(event);
    await Promise.all(waited);
    expect(taken.skipWaiting).toBe(1);
  });
});

describe("module boundaries", () => {
  it("the entry reads only the release version and the worker", () => {
    const code = readFileSync("src/offline/sw-entry.ts", "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect([...code.matchAll(/\bfrom\s*["']([^"']+)["']/g)].map((match) => match[1])).toEqual(["./version", "./worker"]);
  });
});
```

Create `tests/scripts/build-sw.test.ts`:

```ts
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

// scripts/build-sw.ts bundles src/offline/sw-entry.ts into one classic script (public/sw.js by default) and fills
// in the release version: the deploy's commit, else the checkout's short commit, else "local", then the build time.
// Every deploy changes the worker's bytes, so the browser installs the new worker.
describe("scripts/build-sw.ts", () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const tsx = join(root, "node_modules/tsx/dist/cli.mjs");
  const TIME = String.raw`\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z`;

  const made: string[] = [];
  afterEach(() => {
    for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  function run(env: Record<string, string>) {
    const dir = mkdtempSync(join(tmpdir(), "truthy-sw-"));
    made.push(dir);
    const out = join(dir, "nested", "sw.js");
    const result = spawnSync(process.execPath, [tsx, "scripts/build-sw.ts", out], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, VERCEL_GIT_COMMIT_SHA: "", ...env },
    });
    expect(result.status, result.stderr).toBe(0);
    const code = readFileSync(out, "utf8");
    // The version the script reports; the bundle carries it as one string literal (src/offline/version.ts).
    const version = /, version (\S+)\n$/.exec(result.stdout)?.[1] ?? "";
    expect(code).toContain(JSON.stringify(version));
    return { dir, code, version, stdout: result.stdout };
  }

  it("writes one classic script with the deploy's commit and the build time as the version", () => {
    const { code, version, stdout } = run({ VERCEL_GIT_COMMIT_SHA: "9f3c2b1e0d4a5f6789abcdef0123456789abcdef" });
    expect(version).toMatch(new RegExp(`^9f3c2b1e0d4a5f6789abcdef0123456789abcdef-${TIME}$`));
    expect(code.startsWith('"use strict";\n(() => {\n')).toBe(true);
    expect(code).not.toMatch(/^\s*(import|export)\b/m);
    expect(code).not.toContain("__TRUTHY_VERSION__");
    expect(code).toContain("addEventListener(\"install\"");
    expect(stdout).toMatch(new RegExp(`^build-sw: wrote .*sw\\.js, version 9f3c2b1e0d4a5f6789abcdef0123456789abcdef-${TIME}\\n$`));
  }, 60_000);

  it("takes the checkout's short commit when the deploy names none", () => {
    const short = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
    expect(run({}).version).toMatch(new RegExp(`^${short}-${TIME}$`));
  }, 60_000);

  it("says local when there is no commit to name", () => {
    const dir = mkdtempSync(join(tmpdir(), "truthy-no-git-"));
    made.push(dir);
    expect(run({ GIT_DIR: join(dir, "missing") }).version).toMatch(new RegExp(`^local-${TIME}$`));
  }, 60_000);
});
```

- [ ] **Step 6: Run them and watch them fail.**

```bash
pnpm vitest run tests/offline/sw-entry.test.ts tests/scripts/build-sw.test.ts
```

Expected: `sw-entry.test.ts` fails in `beforeAll` with `Error: Build failed with 1 error` (esbuild: `Could not resolve "src/offline/sw-entry.ts"`), its 7 tests skipped; the 3 cases of `build-sw.test.ts` fail with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../scripts/build-sw.ts'`.

- [ ] **Step 7: Write the version, the entry and the build script.**

Create `src/offline/version.ts`:

```ts
// The release version the service worker carries (spec sections 5 and 6): "<commit>-<ISO build time>". It exists
// only at build time: scripts/build-sw.ts bundles the worker with esbuild, which replaces __TRUTHY_VERSION__ with
// that string. src/offline/sw-entry.ts is the only importer, inside that bundle; the app never imports this file.
declare const __TRUTHY_VERSION__: string;

export const RELEASE_VERSION: string = __TRUTHY_VERSION__;
```

Create `src/offline/sw-entry.ts`:

```ts
// The service worker script: the only file that touches the worker global. scripts/build-sw.ts bundles it into
// public/sw.js with the release version of src/offline/version.ts filled in. The project's TypeScript setup uses the
// DOM library, whose `self` is a window, so the few worker members used here are typed locally.
import { RELEASE_VERSION } from "./version";
import { createWorker } from "./worker";

interface WaitingEvent {
  waitUntil(promise: Promise<unknown>): void;
}

interface WorkerFetchEvent {
  request: Request;
  respondWith(response: Promise<Response>): void;
}

interface WorkerMessageEvent extends WaitingEvent {
  data: unknown;
}

interface WorkerScope {
  location: { origin: string };
  caches: CacheStorage;
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  skipWaiting(): Promise<void>;
  clients: { claim(): Promise<void> };
  addEventListener(type: "install" | "activate", listener: (event: WaitingEvent) => void): void;
  addEventListener(type: "fetch", listener: (event: WorkerFetchEvent) => void): void;
  addEventListener(type: "message", listener: (event: WorkerMessageEvent) => void): void;
}

const scope = self as unknown as WorkerScope;

const worker = createWorker({
  version: RELEASE_VERSION,
  origin: scope.location.origin,
  caches: scope.caches,
  fetch: (input, init) => scope.fetch(input, init),
  skipWaiting: () => scope.skipWaiting(),
  claim: () => scope.clients.claim(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
});

scope.addEventListener("install", (event) => event.waitUntil(worker.install()));
scope.addEventListener("activate", (event) => event.waitUntil(worker.activate()));
scope.addEventListener("fetch", (event) => {
  const response = worker.respond(event.request);
  if (response) event.respondWith(response);
});
scope.addEventListener("message", (event) => event.waitUntil(worker.message(event.data)));
```

Create `scripts/build-sw.ts`:

```ts
// Bundles src/offline/sw-entry.ts into public/sw.js, one classic script with the release version filled in.
// Runs before `next build` and `next dev`, after build:tokens and build:decks.
// Usage: tsx scripts/build-sw.ts [output file]   (default: public/sw.js)
import { execFileSync } from "node:child_process";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const ENTRY = fileURLToPath(new URL("../src/offline/sw-entry.ts", import.meta.url));
const out = resolve(process.argv[2] ?? "public/sw.js");

// The commit Vercel builds, else the checkout's, else "local"; then the build time. Every build changes the
// worker's bytes, so the browser installs a new worker after each deploy and its cache gets a new name.
function commit(): string {
  const deployed = process.env.VERCEL_GIT_COMMIT_SHA;
  if (deployed) return deployed;
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || "local";
  } catch {
    return "local";
  }
}

async function main(): Promise<void> {
  const version = `${commit()}-${new Date().toISOString()}`;
  await build({
    entryPoints: [ENTRY],
    outfile: out,
    bundle: true,
    format: "iife",
    target: "es2022",
    platform: "browser",
    minify: false,
    // src/offline/version.ts reads it.
    define: { __TRUTHY_VERSION__: JSON.stringify(version) },
    logLevel: "warning",
  });
  console.log(`build-sw: wrote ${relative(process.cwd(), out)}, version ${version}`);
}

main().catch((error: unknown) => {
  console.error(`build-sw: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
```

- [ ] **Step 8: Run them green.**

```bash
pnpm vitest run tests/offline/worker.test.ts tests/offline/sw-entry.test.ts tests/scripts/build-sw.test.ts
```

Expected: `Test Files  3 passed (3)`, `Tests  52 passed (52)` (worker 42, entry 7, build script 3).

- [ ] **Step 9: Pin the build wiring and the header in the existing tests.**

In `tests/security-headers.test.ts`, replace the case "sends the hardening headers on every route" with:

```ts
  it("sends the hardening headers on every route, and Cache-Control: no-cache on /sw.js only", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    expect(rules.map((rule) => rule.source)).toEqual(["/:path*", "/sw.js"]);
    const headers = (index: number) => Object.fromEntries((rules[index]?.headers ?? []).map((header) => [header.key, header.value]));
    expect(headers(0)).toEqual({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Frame-Options": "DENY",
      "Content-Security-Policy": "frame-ancestors 'none'",
    });
    // The browser checks the worker script on every visit, so a new release is found at once (spec section 9).
    // Next applies every rule whose source matches, so /sw.js gets both.
    expect(headers(1)).toEqual({ "Cache-Control": "no-cache" });
  });
```

In `tests/publish-files.test.ts`, replace the case "generates the tokens and the decks before every build, because both are gitignored" with:

```ts
  it("generates the tokens, the decks and the service worker before every build and dev server, because all three are gitignored", () => {
    const scripts = JSON.parse(read("package.json")).scripts;
    expect(scripts.prebuild).toBe("pnpm build:tokens && pnpm build:decks && pnpm build:sw");
    expect(scripts.predev).toBe("pnpm build:tokens && pnpm build:decks && pnpm build:sw");
    expect(scripts["build:sw"]).toBe("tsx scripts/build-sw.ts");
    expect(scripts.build).toBe("next build");
    const ignored = read(".gitignore").split("\n");
    expect(ignored).toContain("app/tokens.css");
    expect(ignored).toContain("public/decks/");
    expect(ignored).toContain("public/sw.js");
  });
```

- [ ] **Step 10: Run them and watch them fail.**

```bash
pnpm vitest run tests/security-headers.test.ts tests/publish-files.test.ts
```

Expected: `Tests  2 failed | 9 passed (11)` (security headers 3, publish files 8 with task 1's case). `AssertionError: expected [ '/:path*' ] to deeply equal [ '/:path*', '/sw.js' ]` and `AssertionError: expected 'pnpm build:tokens && pnpm build:decks' to be 'pnpm build:tokens && pnpm build:decks…'`.

- [ ] **Step 11: Wire the build, the ignore rule and the header.**

`package.json`, the scripts block becomes:

```json
    "predev": "pnpm build:tokens && pnpm build:decks && pnpm build:sw",
    "dev": "next dev",
    "prebuild": "pnpm build:tokens && pnpm build:decks && pnpm build:sw",
    "build": "next build",
    "build:tokens": "tsx scripts/build-tokens.ts",
    "build:decks": "tsx scripts/build-decks.ts",
    "build:sw": "tsx scripts/build-sw.ts",
```

(the scripts after `build:decks`, from `start` on, stay as they are).

`.gitignore`: after the line `public/decks/` add the line `public/sw.js`.

`next.config.ts`, `headers()` returns a second rule after the `/:path*` rule:

```ts
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
      // The browser checks the service worker script on every visit, so a new release is found at once. Next applies
      // every rule whose source matches, so /sw.js also gets the headers above.
      {
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
    ];
  },
```

`README.md`, in the commands table after the `pnpm build:decks` row:

```markdown
| `pnpm build:sw` | Bundle the service worker (`src/offline/sw-entry.ts`) into `public/sw.js` with the release version (runs automatically before `pnpm dev` and `pnpm build`) |
```

`docs/testing.md`, the `pnpm build` row of the gates table becomes:

```markdown
| `pnpm build` | Tokens, decks and the service worker (`public/sw.js`), then the Next.js production build |
```

- [ ] **Step 12: Run them green, and build the worker once by hand.**

```bash
pnpm vitest run tests/security-headers.test.ts tests/publish-files.test.ts
pnpm build:sw
```

Expected: `Tests  11 passed (11)`; then `build-sw: wrote public/sw.js, version <short commit>-<ISO time>` (for example `build-sw: wrote public/sw.js, version 5db53f3-2026-10-06T23:52:13.270Z`). `public/sw.js` starts with `"use strict";` and `(() => {`, holds the version once as a string literal, and is about 8 kB; `git status --short` does not list it.

- [ ] **Step 13: The smoke spec.**

Create `e2e/service-worker.spec.ts`:

```ts
// Spec sections 6 and 9: the production build serves the service worker, and a registered worker keeps the app
// shell in its cache and controls the page. The app registers the worker itself from src/offline/register.ts;
// this spec registers it by hand so that it tests the worker alone. Playing offline has specs of its own.
import { expect, test } from "@playwright/test";
import { atHome } from "./helpers";

test.use({ reducedMotion: "reduce", serviceWorkers: "allow" });

test("the production build serves /sw.js as a script the browser checks on every visit", async ({ request }) => {
  const response = await request.get("/sw.js");
  expect(response.status()).toBe(200);
  const headers = response.headers();
  expect(headers["content-type"]).toContain("javascript");
  expect(headers["cache-control"]).toBe("no-cache");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  const code = await response.text();
  expect(code).not.toContain("__TRUTHY_VERSION__");
  // The release version, "<commit>-<ISO build time>", as one string literal.
  expect(code).toMatch(/"[0-9a-z]+-\d{4}-\d{2}-\d{2}T[\d:.]+Z"/);
});

test("a registered worker keeps the shell, controls the page and answers its next load", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  });
  // The first version claims the open page as soon as it is active.
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  const shell = await page.evaluate(async () => {
    const names = (await caches.keys()).filter((name) => name.startsWith("truthy-shell-"));
    const cache = await caches.open(names[0] ?? "none");
    const keys = (await cache.keys()).map((request) => {
      const url = new URL(request.url);
      return url.pathname + url.search;
    });
    const notFound = await cache.match("/__offline-not-found");
    const loaded = [...document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>("script[src], link[rel=stylesheet]")].map((element) => {
      const url = new URL(element instanceof HTMLScriptElement ? element.src : element.href);
      return url.pathname + url.search;
    });
    return { names, keys, notFound: notFound?.status ?? null, loaded };
  });

  expect(shell.names).toHaveLength(1);
  expect(shell.keys).toEqual(
    expect.arrayContaining(["/", "/play", "/manifest.webmanifest", "/icon.svg", "/icon-192.png", "/icon-512.png", "/apple-icon.png"]),
  );
  expect(shell.loaded.length).toBeGreaterThan(3);
  for (const path of shell.loaded) expect(shell.keys, path).toContain(path);
  expect(shell.notFound).toBe(404);

  const reload = await page.reload();
  expect(reload?.status()).toBe(200);
  expect(reload?.fromServiceWorker()).toBe(true);
  await atHome(page);
});
```

```bash
E2E_PORT=3713 pnpm exec playwright test e2e/service-worker.spec.ts e2e/install.spec.ts
```

Expected (the web server builds first; port 3713 free): `6 passed`, both specs on `phone-chromium` and `phone-webkit`. The `/sw.js` case shows `Cache-Control: no-cache` next to `X-Content-Type-Options: nosniff`, so `next start` applies both rules to a public file. The registration case shows a controlled page, one `truthy-shell-*` cache holding every script and stylesheet `/` loads, the pages, the manifest, the four plain icons and the 404 page with status 404, and a reload answered by the worker.

- [ ] **Step 14: Run the gates.**

```bash
pnpm typecheck
pnpm test
pnpm build
```

Expected: `tsc --noEmit` prints nothing; `pnpm test` ends with `Test Files  136 passed (136)`, `Tests  2241 passed (2241)` (task 2's 133 files and 2188 tests, plus this task's 3 files and 52 tests, plus one case of `tests/e2e-reduced-motion-polish.test.ts`, which finds `reducedMotion` in the new spec); `pnpm build` prints `build-sw: wrote public/sw.js, version …` after `build-decks: wrote 19 decks …`, then `✓ Compiled successfully` and the route table with every route `○` (static), as before.

- [ ] **Step 15: Commit.**

```bash
git add src/offline/worker.ts src/offline/version.ts src/offline/sw-entry.ts scripts/build-sw.ts e2e/service-worker.spec.ts package.json .gitignore next.config.ts README.md docs/testing.md tests/offline/fakes.ts tests/offline/worker.test.ts tests/offline/sw-entry.test.ts tests/scripts/build-sw.test.ts tests/security-headers.test.ts tests/publish-files.test.ts
git commit -m "feat: a service worker that keeps the app shell on the device is bundled into public/sw.js before every build"
```

**Tried** (worktree at 5db53f3, Node 24, pnpm 10.34.0, Playwright 1.63.0, macOS), before the review changes below: the worker, entry and build script tests failed and then passed as written; `pnpm build:sw` wrote a 6,795 byte `public/sw.js`; the smoke spec and the install spec passed in both engines (6 passed); `pnpm typecheck` and `pnpm build` green; `pnpm test` green apart from two 5 s timeouts of `tests/play/leave-decided-polish.test.tsx` on a machine at load average 46, which passed alone. Changed after that run, by the review and the checks: the install list is task 2's `SHELL_FILES` (it adds the plain `/apple-icon.png`) instead of a list of the worker's own; the release version lives in `src/offline/version.ts` (spec section 5), so the entry's import case moved to `sw-entry.test.ts` and the version is read from the script's output instead of from the bundle's shape; one case for a full device and one for the plain apple icon were added. In the scratch run of the whole plan (README) these files gave the counts of steps 4, 6 and 8 (42 passed; the entry's 7 skipped while `sw-entry.ts` was missing; 52 passed), `pnpm build:sw` wrote an 8,192 byte `public/sw.js` with a short commit in the version (8,190 bytes in a copy without git, where the commit part is "local"), the smoke spec passed in both engines (4), and the build served `/sw.js` with `Cache-Control: no-cache` and `nosniff`. The counts above are for these files in the plan's task order.
