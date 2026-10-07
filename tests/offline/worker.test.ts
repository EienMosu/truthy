import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NOT_FOUND_PROBE, SHELL_FILES, SHELL_PAGES, assetPathsFromHtml } from "@/src/offline/assets";
import { shellCacheName } from "@/src/offline/cache-names";
import { PAGE_TIMEOUT_MS } from "@/src/offline/strategy";
import { createWorker } from "@/src/offline/worker";
import { importSources, withoutComments } from "@/tests/support/imports";
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

  it("fails when a page's HTML names no script under /_next/static/, so a page of another shape never leaves a thin cache", async () => {
    const h = harness();
    // The page still names its stylesheet, a font and the icons, but not one script.
    const scriptless = PLAY_HTML.replace(/<script\b[^>]*><\/script>/g, "").replace(/<link rel="preload" as="script"[^>]*>/, "");
    const named = assetPathsFromHtml(scriptless, ORIGIN);
    expect(named).toContain("/_next/static/chunks/app.css");
    expect(named.filter((path) => path.endsWith(".js"))).toEqual([]);
    h.network.routes.set("/play", () => new Response(scriptless, { status: 200 }));
    await expect(createWorker(h.env).install()).rejects.toThrow("/play names no script under /_next/static/");
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
  it("the worker reads only its sibling modules and never the worker global, so the tests can drive it", () => {
    const code = withoutComments(readFileSync("src/offline/worker.ts", "utf8"));
    expect(sorted(importSources(code))).toEqual(["./assets", "./cache-names", "./strategy"]);
    expect(code).not.toMatch(/\bself\b|\bglobalThis\b/);
  });
});
