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
  /**
   * Whether a version this page asked to take over (applyUpdate) now controls it, although the page was not
   * loaded again since: the code that runs is then older than the worker's. A page load starts afresh with false.
   */
  updateApplied(): boolean;
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
  // The worker that controlled the page when it first asked a waiting version to take over (null: none did), or
  // undefined while it has not asked. A different controller later means the version it asked for took over,
  // even after applyUpdate gave up waiting. Only an ask counts: the first install's claim and an update that
  // another tab applied change the controller too, and spec section 10 lets those wait for the next page load.
  let controllerWhenAsked: ServiceWorker | null | undefined;

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
          const controller = container.controller;
          waiting.postMessage({ type: "apply-update" });
          if (controllerWhenAsked === undefined) controllerWhenAsked = controller;
        } catch {
          finish(false);
        }
      });
    },

    updateApplied() {
      if (controllerWhenAsked === undefined || !env.container) return false;
      return env.container.controller !== controllerWhenAsked;
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
  updateApplied: () => false,
  checkForUpdate: async () => {},
};
