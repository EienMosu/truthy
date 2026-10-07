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
