import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { build } from "esbuild";
import { beforeAll, describe, expect, it } from "vitest";
import { shellCacheName } from "@/src/offline/cache-names";
import { importSources, withoutComments } from "@/tests/support/imports";
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
    expect(importSources(withoutComments(readFileSync("src/offline/sw-entry.ts", "utf8")))).toEqual(["./version", "./worker"]);
  });
});
