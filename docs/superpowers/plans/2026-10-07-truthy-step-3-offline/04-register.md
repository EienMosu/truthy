### Task 4: Registering the worker, and the update when the app opens

The page's side of the service worker (spec section 7). `src/offline/register.ts` registers `/sw.js` with scope `/` in a production build, asks the browser to look for a new version, and lets a waiting version take over only when a screen asks. `AppServices` gains `offline`, so every screen reaches the same client and every test passes `noOfflineClient`. `components/OfflineStart.tsx` sits in `app/layout.tsx`: once per page load it starts the client, and on a page that opened on `/` it applies a waiting update and reloads once the new version controls the page (safe moment 1, "when the app opens"). The other safe moment, coming back from a round, is task 5's `goToStart`, which uses `updateWaiting`, `applyUpdate` and `checkForUpdate` from here.

Decisions this task takes (from the checks and where the brief and the spec leave room):

1. **The condition is "this document opened on `/`", not "no round is pending".** The brief's rule "on `/` only when no round is pending (`truthy.pending.v1` absent)" never holds after the first round: `savePending` is the only writer of that key and nothing removes it (check C1, side finding 2), so it would never apply an update in a tab that has played. The condition used instead, and why it is sound:
   - A round only ever lives in the memory of a `/play` document (`useRound`); `/` renders the start flow and nothing else. So a document whose first path is `/` holds no round, whatever sessionStorage says.
   - `truthy.pending.v1` is the hand-over record a later `/play` deals a new round from. The reload keeps it, as every reload does, so nothing the player had is lost.
   - The check runs once, right after registration, before the player has done anything (spec section 7: "This happens before the player has done anything"). A round open in another tab is not touched by this tab's reload; the worker swap leaves that tab's loaded code alone (spec section 10, two tabs).
   - Spec section 7 names no other condition.
2. **The path is read once, when the page opens** (`window.location.pathname` in the first effect). The layout stays mounted across in-app moves between `/` and `/play`, so a client-side move back to `/` never applies an update here: that is task 5's moment, and only through its controls.
3. **An update is "waiting" only behind a running version** (`registration.waiting` and `registration.active` both set). On the very first install no version runs yet; the worker that is briefly installed is the first version, which claims the page itself (task 3), not an update.
4. **`register()` may resolve to undefined** (check C2: Playwright's `serviceWorkers: "block"` replaces it with `async () => { console.warn(...) }`). The client then behaves as without a worker. A rejected `register()`, a rejected `update()` (offline) and a throwing `postMessage` are swallowed: the game runs as it does today (spec section 10, first row).
5. **Update check:** `start()` asks `registration.update()` once the worker is registered (spec section 7, "when the page loads"), without waiting for it, so the waiting check on `/` is not held up by the network. `checkForUpdate()` is the same call, for task 5.
6. **`applyUpdate()`** listens for `controllerchange` before posting `{ type: "apply-update" }` to the waiting worker, resolves true on the event and false after `APPLY_TIMEOUT_MS` (3000), and removes its listener either way.
7. **React runs an effect twice in development** (StrictMode): a ref keeps `OfflineStart` to one start per page load. In `next dev` the client never registers anyway (`production` false).
8. **`src/offline` stays free of React, Next.js and the components** (the plan's module boundaries). `register.ts` is the first module there that a page imports, so this task adds a guard over every file of the folder (`tests/offline/boundaries.test.ts`); it covers task 6's `availability.ts` too when it comes. Nothing in this task imports task 2's or task 3's modules.

**Files:**
- Create: `src/offline/register.ts`, `components/OfflineStart.tsx`, `e2e/register.spec.ts`
- Modify: `src/app-state/services.ts`, `app/layout.tsx`
- Test: create `tests/offline/register.test.ts`, `tests/offline/boundaries.test.ts`, `tests/components/OfflineStart.test.tsx`; modify `tests/app-state/services.test.ts`, `tests/app/layout.test.tsx`, `tests/components/start/fixtures.ts`, `tests/components/play/fixtures.ts`, `tests/components/start/useCatalog.test.tsx`

**Interfaces:**
- Consumes:
  - Task 1: `playwright.config.ts` `use.serviceWorkers = "block"`.
  - Task 3: `public/sw.js`, written by `pnpm build:sw` in `prebuild`; install does not skip waiting; activate claims the open pages; the message `{ type: "apply-update" }` calls `skipWaiting()`. The files of `src/offline` (tasks 2 and 3), which the new guard reads.
  - `src/app-state/services.ts` as it is: `AppServices { fetcher; localStorage; sessionStorage }`, `browserAppServices`.
  - `e2e/helpers.ts`: `stepTitle(page)` (the start flow's step title, "Choose an area" on step 1).
- Produces:

```ts
// src/offline/register.ts
export interface OfflineClient {
  start(): Promise<void>;          // registers /sw.js, scope "/", in production with a container; then asks for an update check; never rejects
  updateWaiting(): boolean;        // a new version waits behind the running one
  applyUpdate(): Promise<boolean>; // posts { type: "apply-update" }; true on controllerchange, false when nothing waits or after 3 s
  checkForUpdate(): Promise<void>; // registration.update(); never rejects
}
export const SW_URL = "/sw.js";
export const SW_SCOPE = "/";
export const APPLY_TIMEOUT_MS = 3000;
export function createOfflineClient(env: { container: ServiceWorkerContainer | undefined; production: boolean }): OfflineClient;
export const browserOfflineClient: OfflineClient;   // navigator.serviceWorker, process.env.NODE_ENV === "production"
export const noOfflineClient: OfflineClient;        // for tests: updateWaiting() false, applyUpdate() false

// src/app-state/services.ts
export interface AppServices { /* as today */ offline: OfflineClient }
// browserAppServices.offline === browserOfflineClient; StartServices and PlayServices inherit it.

// components/OfflineStart.tsx ("use client")
export async function openApp(offline: OfflineClient, path: string, reload: () => void): Promise<void>;
export interface OfflineStartProps { services?: Pick<AppServices, "offline">; reload?: () => void }
export function OfflineStart(props: OfflineStartProps): null;
```

  - Test fakes: every `AppServices`, `StartServices` and `PlayServices` literal in the tests carries `offline: noOfflineClient`. Task 5 gives its own fake client to the play screen's harness where it tests the return moment.
  - `e2e/register.spec.ts` is taken.

**Steps:**

- [ ] **Step 1: Write the end-to-end spec and watch it fail.**

Create `e2e/register.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { stepTitle } from "./helpers";

// Spec section 7: the app registers its service worker itself, from every page, in the production build.
test.use({ reducedMotion: "reduce" });

test.describe("with service workers allowed", () => {
  test.use({ serviceWorkers: "allow" });

  for (const path of ["/", "/play"]) {
    test(`opening ${path} registers /sw.js for the whole site, and the worker controls the page`, async ({ page, baseURL }) => {
      await page.goto(path);
      // /play without a pending round goes on to the start, whose first step shows.
      await expect(stepTitle(page)).toHaveText("Choose an area");
      const registration = await page.evaluate(async () => {
        const ready = await navigator.serviceWorker.ready;
        return { scope: ready.scope, script: ready.active?.scriptURL ?? null };
      });
      expect(registration).toEqual({ scope: `${baseURL}/`, script: `${baseURL}/sw.js` });
      await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    });
  }
});

test.describe("with service workers blocked, as in every other spec", () => {
  test("the game opens as it does without a worker, and none is registered", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await expect(stepTitle(page)).toHaveText("Choose an area");
    const registrations = await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length);
    expect(registrations).toBe(0);
    expect(errors).toEqual([]);
  });
});
```

Run (port 3714 free):

```bash
E2E_PORT=3714 pnpm exec playwright test e2e/register.spec.ts
```

Expected: `4 failed`, `2 passed`. The blocked test passes on both projects. The four "registers /sw.js" tests fail on `phone-chromium` and `phone-webkit` with `Error: page.evaluate: Test timeout of 30000ms exceeded.`: nothing registers a worker yet, so `navigator.serviceWorker.ready` never resolves.

- [ ] **Step 2: Write the client's unit tests.**

Create `tests/offline/register.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { APPLY_TIMEOUT_MS, SW_SCOPE, SW_URL, createOfflineClient, noOfflineClient, type OfflineClient } from "@/src/offline/register";

// A service worker as the page sees it: it only takes messages.
interface FakeWorker {
  messages: unknown[];
  postMessage: (message: unknown) => void;
}

function fakeWorker(): FakeWorker {
  const worker: FakeWorker = { messages: [], postMessage: (message) => worker.messages.push(message) };
  return worker;
}

interface FakeRegistration {
  waiting: FakeWorker | null;
  active: FakeWorker | null;
  update: ReturnType<typeof vi.fn<() => Promise<void>>>;
}

// navigator.serviceWorker with what register.ts uses: register, and the controllerchange event.
function fakeContainer(registered: "registration" | "nothing" | "fails" = "registration") {
  const listeners = new Set<() => void>();
  const registration: FakeRegistration = { waiting: null, active: null, update: vi.fn(async () => undefined) };
  const register = vi.fn(async (_url: string, _options?: RegistrationOptions) => {
    if (registered === "fails") throw new DOMException("The operation is insecure.", "SecurityError");
    // Playwright's serviceWorkers "block" swaps register for a function that resolves to undefined.
    return registered === "nothing" ? undefined : registration;
  });
  const container = {
    register,
    addEventListener: (type: string, listener: () => void) => {
      if (type === "controllerchange") listeners.add(listener);
    },
    removeEventListener: (type: string, listener: () => void) => {
      if (type === "controllerchange") listeners.delete(listener);
    },
  };
  return {
    container: container as unknown as ServiceWorkerContainer,
    register,
    registration,
    /** The waiting worker took over: the browser fires controllerchange. */
    changeController: () => {
      for (const listener of [...listeners]) listener();
    },
    listening: () => listeners.size,
  };
}

/** A client whose browser already runs one version and has the next one installed and waiting. */
async function withUpdateWaiting() {
  const fake = fakeContainer();
  fake.registration.active = fakeWorker();
  const waiting = fakeWorker();
  fake.registration.waiting = waiting;
  const client = createOfflineClient({ container: fake.container, production: true });
  await client.start();
  return { fake, waiting, client };
}

/** Whether a promise has settled, and with what, without waiting for it. */
function watch<T>(promise: Promise<T>): { settled: boolean; value: T | undefined } {
  const state: { settled: boolean; value: T | undefined } = { settled: false, value: undefined };
  void promise.then((value) => {
    state.settled = true;
    state.value = value;
  });
  return state;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("registering the worker", () => {
  it("registers /sw.js for the whole site in a production build, once however often it is started", async () => {
    const fake = fakeContainer();
    const client = createOfflineClient({ container: fake.container, production: true });
    await Promise.all([client.start(), client.start()]);
    await client.start();
    expect(SW_URL).toBe("/sw.js");
    expect(SW_SCOPE).toBe("/");
    expect(fake.register).toHaveBeenCalledTimes(1);
    expect(fake.register).toHaveBeenCalledWith("/sw.js", { scope: "/" });
  });

  it("registers nothing in next dev and in the unit tests", async () => {
    const fake = fakeContainer();
    fake.registration.active = fakeWorker();
    fake.registration.waiting = fakeWorker();
    const client = createOfflineClient({ container: fake.container, production: false });
    await client.start();
    await client.checkForUpdate();
    expect(fake.register).not.toHaveBeenCalled();
    expect(fake.registration.update).not.toHaveBeenCalled();
    expect(client.updateWaiting()).toBe(false);
    expect(await client.applyUpdate()).toBe(false);
  });

  it("does nothing in a browser without service workers", async () => {
    const client = createOfflineClient({ container: undefined, production: true });
    await expect(client.start()).resolves.toBeUndefined();
    await expect(client.checkForUpdate()).resolves.toBeUndefined();
    expect(client.updateWaiting()).toBe(false);
    expect(await client.applyUpdate()).toBe(false);
  });

  it.each(["fails", "nothing"] as const)("keeps the game running as today when registration %s", async (registered) => {
    const fake = fakeContainer(registered);
    const client = createOfflineClient({ container: fake.container, production: true });
    await expect(client.start()).resolves.toBeUndefined();
    await expect(client.checkForUpdate()).resolves.toBeUndefined();
    expect(fake.registration.update).not.toHaveBeenCalled();
    expect(client.updateWaiting()).toBe(false);
    expect(await client.applyUpdate()).toBe(false);
  });
});

describe("checking for a new version", () => {
  it("asks for an update check once the worker is registered, and again whenever a screen asks", async () => {
    const fake = fakeContainer();
    const client = createOfflineClient({ container: fake.container, production: true });
    await client.start();
    expect(fake.registration.update).toHaveBeenCalledTimes(1);
    await client.checkForUpdate();
    expect(fake.registration.update).toHaveBeenCalledTimes(2);
  });

  it("swallows a failed check, as offline", async () => {
    const fake = fakeContainer();
    fake.registration.update.mockRejectedValue(new TypeError("Failed to fetch"));
    const client = createOfflineClient({ container: fake.container, production: true });
    await expect(client.start()).resolves.toBeUndefined();
    await expect(client.checkForUpdate()).resolves.toBeUndefined();
  });
});

describe("a waiting update", () => {
  it("is seen when a new version waits behind the one that runs", async () => {
    const { client } = await withUpdateWaiting();
    expect(client.updateWaiting()).toBe(true);
  });

  it("is not seen when nothing waits, or on the first install (no version runs yet)", async () => {
    const fake = fakeContainer();
    const client = createOfflineClient({ container: fake.container, production: true });
    await client.start();
    expect(client.updateWaiting()).toBe(false);
    fake.registration.active = fakeWorker();
    expect(client.updateWaiting()).toBe(false);
    fake.registration.active = null;
    fake.registration.waiting = fakeWorker();
    expect(client.updateWaiting()).toBe(false);
  });

  it("takes over when asked: apply-update goes to the waiting worker, and the answer is true once it controls the page", async () => {
    const { fake, waiting, client } = await withUpdateWaiting();
    const applying = watch(client.applyUpdate());
    expect(waiting.messages).toEqual([{ type: "apply-update" }]);
    await Promise.resolve();
    expect(applying.settled).toBe(false);
    fake.changeController();
    await vi.waitFor(() => expect(applying.settled).toBe(true));
    expect(applying.value).toBe(true);
    expect(fake.listening()).toBe(0);
  });

  it("gives up after 3 s when the controller does not change", async () => {
    vi.useFakeTimers();
    const { fake, client } = await withUpdateWaiting();
    const applying = watch(client.applyUpdate());
    await vi.advanceTimersByTimeAsync(APPLY_TIMEOUT_MS - 1);
    expect(applying.settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(applying).toEqual({ settled: true, value: false });
    expect(APPLY_TIMEOUT_MS).toBe(3000);
    expect(fake.listening()).toBe(0);
    fake.changeController();
    expect(applying.value).toBe(false);
  });

  it("answers false at once and sends nothing when no update waits", async () => {
    const fake = fakeContainer();
    const runs = fakeWorker();
    fake.registration.active = runs;
    const client = createOfflineClient({ container: fake.container, production: true });
    await client.start();
    expect(await client.applyUpdate()).toBe(false);
    expect(runs.messages).toEqual([]);
    expect(fake.listening()).toBe(0);
  });

  it("answers false when the waiting worker cannot take the message", async () => {
    const { fake, waiting, client } = await withUpdateWaiting();
    waiting.postMessage = () => {
      throw new DOMException("The worker is gone.", "InvalidStateError");
    };
    expect(await client.applyUpdate()).toBe(false);
    expect(fake.listening()).toBe(0);
  });
});

describe("the clients the app uses", () => {
  it("noOfflineClient, for tests: never registers, never sees or applies an update", async () => {
    const client: OfflineClient = noOfflineClient;
    await expect(client.start()).resolves.toBeUndefined();
    await expect(client.checkForUpdate()).resolves.toBeUndefined();
    expect(client.updateWaiting()).toBe(false);
    expect(await client.applyUpdate()).toBe(false);
  });

  it("browserOfflineClient registers through navigator.serviceWorker in a production build", async () => {
    const fake = fakeContainer();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubGlobal("navigator", { serviceWorker: fake.container });
    const { browserOfflineClient } = await import("@/src/offline/register");
    await browserOfflineClient.start();
    expect(fake.register).toHaveBeenCalledWith("/sw.js", { scope: "/" });
  });

  it("browserOfflineClient registers nothing outside a production build", async () => {
    const fake = fakeContainer();
    vi.stubEnv("NODE_ENV", "development");
    vi.stubGlobal("navigator", { serviceWorker: fake.container });
    const { browserOfflineClient } = await import("@/src/offline/register");
    await browserOfflineClient.start();
    expect(fake.register).not.toHaveBeenCalled();
  });

  it("browserOfflineClient copes with a browser that has no navigator.serviceWorker, or throws on reading it", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubGlobal("navigator", {});
    const plain = await import("@/src/offline/register");
    await expect(plain.browserOfflineClient.start()).resolves.toBeUndefined();
    expect(plain.browserOfflineClient.updateWaiting()).toBe(false);
    vi.resetModules();
    vi.stubGlobal("navigator", {
      get serviceWorker(): ServiceWorkerContainer {
        throw new DOMException("The operation is insecure.", "SecurityError");
      },
    });
    const blocked = await import("@/src/offline/register");
    await expect(blocked.browserOfflineClient.start()).resolves.toBeUndefined();
  });
});
```

Create `tests/offline/boundaries.test.ts`, the guard of decision 8:

```ts
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

// src/offline is shared by the service worker and the page (offline spec section 5): it imports nothing from React,
// Next.js or the components, and holds no component. The components import from it, never the other way round.
const DIR = "src/offline";
const files = readdirSync(DIR).sort();

// The module sources a file imports: static, type-only, bare and dynamic imports. Comments are left out first.
function importsOf(file: string): string[] {
  const code = readFileSync(`${DIR}/${file}`, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  return [...code.matchAll(/\b(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map((match) => match[1] ?? "");
}

describe("src/offline", () => {
  it("holds TypeScript modules only, no component", () => {
    expect(files).toEqual(expect.arrayContaining(["assets.ts", "worker.ts"]));
    for (const file of files) expect(file, file).toMatch(/^[a-z-]+\.ts$/);
  });

  it("imports nothing from React, Next.js or the components", () => {
    for (const file of files) {
      for (const source of importsOf(file)) {
        expect(source, `${file} imports ${source}`).not.toMatch(/^(react|react-dom|next)(\/|$)|^@\/components(\/|$)/);
      }
    }
  });
});
```

- [ ] **Step 3: Run them and watch them fail.**

```bash
pnpm vitest run tests/offline/register.test.ts tests/offline/boundaries.test.ts
```

Expected: `Test Files  1 failed | 1 passed (2)`, `Tests  2 passed (2)`: `register.test.ts` fails to load with `Error: Cannot find package '@/src/offline/register' imported from .../tests/offline/register.test.ts`; the guard passes already on the files of tasks 2 and 3, and keeps every later file of the folder to the rule.

- [ ] **Step 4: Write the client.**

Create `src/offline/register.ts`:

```ts
// The page's side of the service worker (spec section 7): registers /sw.js in a production build, asks the
// browser to look for a new version, and lets a new version take over only when a screen asks at a safe
// moment. Nothing here throws: when the page cannot reach a worker, the game runs as it does without one.

/** What the screens may ask of the service worker. */
export interface OfflineClient {
  /** Registers /sw.js for the whole site (production builds only) and asks for an update check. Never rejects. */
  start(): Promise<void>;
  /** Whether a new version is installed and waits behind the one that runs. */
  updateWaiting(): boolean;
  /**
   * Asks the waiting version to take over. True once it controls the page; false when nothing waits, the
   * message cannot be sent, or the controller has not changed after APPLY_TIMEOUT_MS.
   */
  applyUpdate(): Promise<boolean>;
  /** Asks the browser to look for a new version now. Never rejects. */
  checkForUpdate(): Promise<void>;
}

/** The worker's script, built by scripts/build-sw.ts. */
export const SW_URL = "/sw.js";
/** The worker serves the whole site. */
export const SW_SCOPE = "/";
/** How long applyUpdate waits for the new version to control the page. */
export const APPLY_TIMEOUT_MS = 3000;

export function createOfflineClient(env: { container: ServiceWorkerContainer | undefined; production: boolean }): OfflineClient {
  let registration: ServiceWorkerRegistration | undefined;
  let starting: Promise<void> | undefined;

  // A new version waits behind the one that runs. On the very first install nothing runs yet, and the
  // worker that is briefly installed is the first version, not an update.
  function waitingUpdate(): ServiceWorker | null {
    if (!registration?.active) return null;
    return registration.waiting;
  }

  async function register(container: ServiceWorkerContainer): Promise<void> {
    try {
      // Playwright's serviceWorkers "block" swaps register for a function that resolves to undefined.
      const registered = (await container.register(SW_URL, { scope: SW_SCOPE })) as ServiceWorkerRegistration | undefined;
      registration = registered ?? undefined;
    } catch {
      return;
    }
    void client.checkForUpdate();
  }

  const client: OfflineClient = {
    start() {
      if (!env.production || !env.container) return Promise.resolve();
      starting ??= register(env.container);
      return starting;
    },

    updateWaiting() {
      return waitingUpdate() !== null;
    },

    applyUpdate() {
      const container = env.container;
      const waiting = waitingUpdate();
      if (!container || !waiting) return Promise.resolve(false);
      return new Promise<boolean>((resolve) => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const finish = (applied: boolean) => {
          container.removeEventListener("controllerchange", onChange);
          if (timer !== undefined) clearTimeout(timer);
          resolve(applied);
        };
        const onChange = () => finish(true);
        container.addEventListener("controllerchange", onChange);
        timer = setTimeout(() => finish(false), APPLY_TIMEOUT_MS);
        try {
          waiting.postMessage({ type: "apply-update" });
        } catch {
          finish(false);
        }
      });
    },

    async checkForUpdate() {
      if (!registration) return;
      try {
        await registration.update();
      } catch {
        // Offline, or the script could not be fetched: the browser checks again on a later visit.
      }
    },
  };
  return client;
}

// navigator.serviceWorker, or undefined on the server, in a browser without service workers, or where
// reading it throws (Firefox with site data blocked).
function browserContainer(): ServiceWorkerContainer | undefined {
  try {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return undefined;
    return navigator.serviceWorker;
  } catch {
    return undefined;
  }
}

/** The real client. A module constant, so every screen shares one registration. */
export const browserOfflineClient: OfflineClient = createOfflineClient({
  container: browserContainer(),
  production: process.env.NODE_ENV === "production",
});

/** A client that never registers and never sees an update: the screens' tests use it. */
export const noOfflineClient: OfflineClient = {
  start: async () => {},
  updateWaiting: () => false,
  applyUpdate: async () => false,
  checkForUpdate: async () => {},
};
```

- [ ] **Step 5: Run them green.**

```bash
pnpm vitest run tests/offline/register.test.ts tests/offline/boundaries.test.ts
```

Expected: `Test Files  2 passed (2)`, `Tests  19 passed (19)` (register 17, guard 2).

- [ ] **Step 6: `AppServices.offline`, test first.**

In `tests/app-state/services.test.ts`, add the import below the services import:

```ts
import { browserOfflineClient } from "@/src/offline/register";
```

and replace the test "wires the real services to fetch and the two storages" with:

```ts
  it("wires the real services to fetch, the two storages and the service worker", () => {
    expect(browserAppServices.localStorage()).toBe(window.localStorage);
    expect(browserAppServices.sessionStorage()).toBe(window.sessionStorage);
    expect(browserAppServices.offline).toBe(browserOfflineClient);
  });
```

Run `pnpm vitest run tests/app-state/services.test.ts`. Expected: `Tests  1 failed | 7 passed (8)`, the new test with `AssertionError: expected undefined to be { start: [Function start], …(3) } // Object.is equality`.

In `src/app-state/services.ts`, replace the first two comment lines and add the import:

```ts
// The outside world as the screens see it: the network, the two storages, the service worker and the browser
// history. Screens take these through an optional `services` prop, so their tests run without a browser.

import type { Fetcher } from "@/src/content/load";
import { browserOfflineClient, type OfflineClient } from "@/src/offline/register";
import { browserLocalStorage } from "@/src/progress/local";
```

add the field at the end of `AppServices`, after `sessionStorage`:

```ts
  /** The service worker: registration and the update applied at a safe moment. Tests: noOfflineClient. */
  offline: OfflineClient;
```

and the entry at the end of `browserAppServices`, after `sessionStorage: browserSessionStorage,`:

```ts
  offline: browserOfflineClient,
```

Run `pnpm typecheck`. Expected: six errors, all in the tests, each a service literal without `offline`:
- `tests/components/play/fixtures.ts(138,9): error TS2741: Property 'offline' is missing in type '{ fetcher: Fetcher; ... }' but required in type 'PlayServices'.`
- `tests/components/start/fixtures.ts(187,9): error TS2741: Property 'offline' is missing in type '{ fetcher: Fetcher; ... }' but required in type 'TestServices'.`
- four in `tests/components/start/useCatalog.test.tsx` (lines 176, 189, 201, 210), the first `error TS2345: Argument of type '{ fetcher: Fetcher; localStorage: () => MemoryStorage; sessionStorage: () => undefined; }' is not assignable to parameter of type 'AppServices'.`

Give every one of them the no-op client:
- `tests/components/start/fixtures.ts`: add `import { noOfflineClient } from "@/src/offline/register";` after the `@/src/content/schema` import, and `offline: noOfflineClient,` after `sessionStorage: () => session,` in `harness`.
- `tests/components/play/fixtures.ts`: the same import after the `@/src/content/schema` import, and `offline: noOfflineClient,` after `sessionStorage: () => session,` in `harness`.
- `tests/components/start/useCatalog.test.tsx`: the same import after the `@/src/content/schema` import; in the four literals `{ fetcher: net.fetcher, localStorage: () => local, sessionStorage: () => undefined }` (three passed to `ready`, one typed `AppServices`), add `, offline: noOfflineClient` before the closing brace, so each reads `{ fetcher: net.fetcher, localStorage: () => local, sessionStorage: () => undefined, offline: noOfflineClient }`.

Run `pnpm typecheck` (no output after `tsc --noEmit`) and `pnpm vitest run tests/app-state/services.test.ts tests/offline/register.test.ts`. Expected: `Test Files  2 passed (2)`, `Tests  25 passed (25)` (services 8, register 17).

- [ ] **Step 7: Write the tests of the safe moment when the app opens.**

Create `tests/components/OfflineStart.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OfflineStart, openApp } from "@/components/OfflineStart";
import type { OfflineClient } from "@/src/offline/register";

/** An offline client whose answers a test sets, and which records what it was asked, in order. */
function fakeClient({ waiting = false, applied = true }: { waiting?: boolean; applied?: boolean } = {}) {
  const calls: string[] = [];
  let finishStart: () => void = () => {};
  const started = new Promise<void>((resolve) => {
    finishStart = resolve;
  });
  const client: OfflineClient = {
    start: vi.fn(async () => {
      calls.push("start");
      await started;
    }),
    updateWaiting: vi.fn(() => {
      calls.push("updateWaiting");
      return waiting;
    }),
    applyUpdate: vi.fn(async () => {
      calls.push("applyUpdate");
      return applied;
    }),
    checkForUpdate: vi.fn(async () => {
      calls.push("checkForUpdate");
    }),
  };
  return { client, calls, finishStart };
}

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

describe("openApp: the safe moment when the app opens", () => {
  it("on /, with an update waiting: registers first, then applies it and reloads once it has taken over", async () => {
    const { client, calls, finishStart } = fakeClient({ waiting: true });
    const reload = vi.fn();
    const opening = openApp(client, "/", reload);
    expect(calls).toEqual(["start"]);
    finishStart();
    await opening;
    expect(calls).toEqual(["start", "updateWaiting", "applyUpdate"]);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("does not reload when the waiting update did not take over", async () => {
    const { client, finishStart } = fakeClient({ waiting: true, applied: false });
    const reload = vi.fn();
    finishStart();
    await openApp(client, "/", reload);
    expect(client.applyUpdate).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
  });

  it("applies nothing on / when no update waits", async () => {
    const { client, finishStart } = fakeClient({ waiting: false });
    const reload = vi.fn();
    finishStart();
    await openApp(client, "/", reload);
    expect(client.applyUpdate).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it.each(["/play", "/no-such-page"])("only registers on %s, also with an update waiting", async (path) => {
    const { client, calls, finishStart } = fakeClient({ waiting: true });
    const reload = vi.fn();
    finishStart();
    await openApp(client, path, reload);
    expect(calls).toEqual(["start"]);
    expect(reload).not.toHaveBeenCalled();
  });
});

describe("OfflineStart", () => {
  it("renders nothing", () => {
    const { client } = fakeClient();
    const { container } = render(<OfflineStart services={{ offline: client }} reload={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });

  it("starts the offline client once per page load, also when React runs its effects twice", async () => {
    const { client, finishStart } = fakeClient({ waiting: true });
    const reload = vi.fn();
    const services = { offline: client };
    const { rerender } = render(
      <StrictMode>
        <OfflineStart services={services} reload={reload} />
      </StrictMode>,
    );
    rerender(
      <StrictMode>
        <OfflineStart services={services} reload={reload} />
      </StrictMode>,
    );
    finishStart();
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(client.start).toHaveBeenCalledTimes(1);
    expect(client.applyUpdate).toHaveBeenCalledTimes(1);
  });

  it("applies a waiting update when the page opened on /", async () => {
    window.history.replaceState(null, "", "/");
    const { client, finishStart } = fakeClient({ waiting: true });
    const reload = vi.fn();
    finishStart();
    render(<OfflineStart services={{ offline: client }} reload={reload} />);
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  });

  it("leaves a waiting update alone when the page opened on /play", async () => {
    window.history.replaceState(null, "", "/play");
    const { client, finishStart } = fakeClient({ waiting: true });
    const reload = vi.fn();
    finishStart();
    render(<OfflineStart services={{ offline: client }} reload={reload} />);
    await waitFor(() => expect(client.start).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    await Promise.resolve();
    expect(client.updateWaiting).not.toHaveBeenCalled();
    expect(client.applyUpdate).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it("reads the path once, when the page opens: a later move to / applies nothing", async () => {
    window.history.replaceState(null, "", "/play");
    const { client, finishStart } = fakeClient({ waiting: true });
    const reload = vi.fn();
    const services = { offline: client };
    const { rerender } = render(<OfflineStart services={services} reload={reload} />);
    window.history.replaceState(null, "", "/");
    rerender(<OfflineStart services={services} reload={reload} />);
    finishStart();
    await waitFor(() => expect(client.start).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    await Promise.resolve();
    expect(client.applyUpdate).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });
});
```

In `tests/app/layout.test.tsx`, add two imports, the React one after the `react-dom/server` import and the component after the `vitest` import:

```ts
import { isValidElement, type ReactElement, type ReactNode } from "react";
```

```ts
import { OfflineStart } from "@/components/OfflineStart";
```

and add, after the `describe("root layout", ...)` block:

```tsx
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

  it("adds nothing to the markup: OfflineStart renders no element", () => {
    expect(renderLayout()).toContain('<body><div class="app-frame"><p>child</p></div></body>');
  });
});
```

- [ ] **Step 8: Run them and watch them fail.**

```bash
pnpm vitest run tests/components/OfflineStart.test.tsx tests/app/layout.test.tsx
```

Expected: `Test Files  2 failed (2)`, `Tests  no tests`, with `Error: Failed to resolve import "@/components/OfflineStart" from "tests/components/OfflineStart.test.tsx". Does the file exist?` and `Error: Cannot find package '@/components/OfflineStart' imported from .../tests/app/layout.test.tsx`.

- [ ] **Step 9: Write `OfflineStart` and put it in the layout.**

Create `components/OfflineStart.tsx`:

```tsx
"use client";

// Starts the service worker when a page opens, and applies a waiting new version at the first safe moment
// of spec section 7: "when the app opens". It sits in app/layout.tsx, so it runs once per page load, on every
// page; only a page that opened on / applies an update, and it does that before the player has done anything,
// so the reload looks like part of opening the app. The other safe moment, coming back from a round, belongs
// to the play screen's ways back to the start (goToStart).
import { useEffect, useRef } from "react";
import { browserAppServices, type AppServices } from "@/src/app-state/services";
import type { OfflineClient } from "@/src/offline/register";

/** Registers the worker; then, on / only, lets a waiting update take over and reloads once it has. */
export async function openApp(offline: OfflineClient, path: string, reload: () => void): Promise<void> {
  await offline.start();
  if (path !== "/") return;
  if (!offline.updateWaiting()) return;
  if (await offline.applyUpdate()) reload();
}

export interface OfflineStartProps {
  /** The service worker. Defaults to the browser's. */
  services?: Pick<AppServices, "offline">;
  /** Reloads the page once the update controls it. Defaults to window.location.reload. */
  reload?: () => void;
}

function reloadPage(): void {
  window.location.reload();
}

export function OfflineStart({ services = browserAppServices, reload = reloadPage }: OfflineStartProps) {
  // Once per page load: the layout stays mounted across in-app moves between / and /play, and React runs
  // an effect twice in development.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    void openApp(services.offline, window.location.pathname, reload);
  }, [services, reload]);
  return null;
}
```

In `app/layout.tsx`, add the import after `import type { ReactNode } from "react";`:

```ts
import { OfflineStart } from "@/components/OfflineStart";
```

add one comment line after the comment above `return (` in `RootLayout`:

```ts
  // OfflineStart renders nothing: it registers the service worker and applies a waiting update on / (spec section 7).
```

and render it in the body, after the app frame:

```tsx
      <body>
        <div className="app-frame">{children}</div>
        <OfflineStart />
      </body>
```

- [ ] **Step 10: Run them green.**

```bash
pnpm vitest run tests/components/OfflineStart.test.tsx tests/app/layout.test.tsx tests/offline/register.test.ts tests/offline/boundaries.test.ts tests/app-state/services.test.ts
```

Expected: `Test Files  5 passed (5)`, `Tests  50 passed (50)` (OfflineStart 10, layout 13, register 17, guard 2, services 8).

- [ ] **Step 11: Run the gates.**

```bash
pnpm typecheck
pnpm test
pnpm build
E2E_PORT=3714 pnpm exec playwright test e2e/register.spec.ts e2e/install.spec.ts e2e/direct-play.spec.ts e2e/first-round.spec.ts
```

Expected: `tsc --noEmit` prints nothing; `pnpm test` ends with `Test Files  139 passed (139)`, `Tests  2273 passed (2273)` (task 3's 136 files and 2241 tests, plus 3 files and 32 tests: register 17, OfflineStart 10, guard 2, layout 2, and the e2e guard's case for `register.spec.ts`); the build lists `/` and `/play` as `○ (Static)`; the e2e run `12 passed`: the three `register.spec.ts` tests, the install spec, the direct `/play` spec and a first Classic round, on both `phone-chromium` and `phone-webkit`. The first round runs with workers blocked (task 1's default), through Playwright's `register` stub that resolves to undefined.

- [ ] **Step 12: Commit.**

```bash
git add src/offline/register.ts components/OfflineStart.tsx app/layout.tsx src/app-state/services.ts e2e/register.spec.ts tests/offline/register.test.ts tests/offline/boundaries.test.ts tests/components/OfflineStart.test.tsx tests/app-state/services.test.ts tests/app/layout.test.tsx tests/components/start/fixtures.ts tests/components/play/fixtures.ts tests/components/start/useCatalog.test.tsx
git commit -m "feat: the app registers its service worker on every page and applies a waiting update when it opens on the start"
```

**Tried** (worktree at 5db53f3, with a hand-written `public/sw.js` of task 3's behaviour in place of the built one): the e2e spec failed first as step 1 says (4 failed, 2 passed) and passed after step 9; the register, services, OfflineStart and layout tests failed and passed as written, and `pnpm typecheck` gave the six errors of step 6 and then none; `pnpm build` green; the e2e command of step 11 passed (12). A first `pnpm test` at a machine load average of 54 timed out three cases of `tests/play/leave-decided-polish.test.tsx` at 5 s; alone and in the full rerun they passed. The guard of decision 8 was added afterwards (review); the counts above are for the plan's task order.
