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

// navigator.serviceWorker with what register.ts uses: register, the controller, and the controllerchange event.
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
    // The worker that controls the page: the one that runs, or none on a page loaded without a worker.
    controller: null as FakeWorker | null,
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
    /** Sets the worker that controls the page, without an event (the state a page loads with). */
    setController: (worker: FakeWorker | null) => {
      container.controller = worker;
    },
    /** The waiting worker took over: it controls the page, and the browser fires controllerchange. */
    changeController: () => {
      container.controller = registration.waiting ?? fakeWorker();
      for (const listener of [...listeners]) listener();
    },
    listening: () => listeners.size,
  };
}

/** A client whose browser already runs one version and has the next one installed and waiting. */
async function withUpdateWaiting() {
  const fake = fakeContainer();
  fake.registration.active = fakeWorker();
  fake.setController(fake.registration.active);
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
    expect(client.updateApplied()).toBe(false);
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

// A press during the app-open update leaves the new version in control without the reload, so the way back to
// the start must load the page afresh (spec section 14, amendment 6). The client tells it from the controller.
describe("an update applied without a reload", () => {
  it("is reported once the version the page asked for controls it", async () => {
    const { fake, client } = await withUpdateWaiting();
    expect(client.updateApplied()).toBe(false);
    const applying = client.applyUpdate();
    expect(client.updateApplied()).toBe(false);
    fake.changeController();
    expect(await applying).toBe(true);
    expect(client.updateApplied()).toBe(true);
  });

  it("is reported when the version takes over after applyUpdate gave up waiting", async () => {
    vi.useFakeTimers();
    const { fake, client } = await withUpdateWaiting();
    const applying = watch(client.applyUpdate());
    await vi.advanceTimersByTimeAsync(APPLY_TIMEOUT_MS);
    expect(applying).toEqual({ settled: true, value: false });
    expect(client.updateApplied()).toBe(false);
    fake.changeController();
    expect(client.updateApplied()).toBe(true);
  });

  it("is reported on a page that no worker controlled when it asked (a reload that skipped the worker)", async () => {
    const { fake, client } = await withUpdateWaiting();
    fake.setController(null);
    const applying = client.applyUpdate();
    fake.changeController();
    expect(await applying).toBe(true);
    expect(client.updateApplied()).toBe(true);
  });

  it("is not reported when the page asked for nothing: the first install's claim, or another tab's update", async () => {
    const fake = fakeContainer();
    const client = createOfflineClient({ container: fake.container, production: true });
    await client.start();
    fake.registration.active = fakeWorker();
    fake.changeController();
    expect(client.updateApplied()).toBe(false);
  });

  it("is not reported when nothing waited or the waiting worker could not take the message", async () => {
    const { fake, waiting, client } = await withUpdateWaiting();
    waiting.postMessage = () => {
      throw new DOMException("The worker is gone.", "InvalidStateError");
    };
    expect(await client.applyUpdate()).toBe(false);
    expect(client.updateApplied()).toBe(false);
    // A failed ask does not count: a version that takes over later (another tab's update) was not asked for here.
    fake.changeController();
    expect(client.updateApplied()).toBe(false);
    fake.registration.waiting = null;
    expect(await client.applyUpdate()).toBe(false);
    expect(client.updateApplied()).toBe(false);
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
