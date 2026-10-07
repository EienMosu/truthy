// The fixture and the steps of every end-to-end spec that goes offline (offline spec sections 11 and 14). Each test
// gets its own proxy in front of the production server (e2e/proxy.ts) and uses it as its baseURL, so it can cut the
// network and serve a new release of sw.js without touching the server other specs use. "Offline" is the proxy
// dropping every connection plus navigator.onLine reading false with an "offline" event, which is what a phone
// without a network gives the page; the same in Chromium and WebKit.
import { expect, test as base, type Page } from "@playwright/test";
import { e2ePort } from "../playwright.config";
import { atStep } from "./helpers";
import { startProxy, type NetProxy } from "./proxy";

// The key the onLine switch reads. The app never reads or writes it.
const OFFLINE_FLAG = "truthy.e2e.offline";

export const test = base.extend<{ net: NetProxy }>({
  net: async ({}, use) => {
    const proxy = await startProxy(`http://localhost:${e2ePort(process.env.E2E_PORT)}`);
    await use(proxy);
    await proxy.close();
  },
  baseURL: async ({ net }, use) => {
    await use(net.url);
  },
  context: async ({ context }, use) => {
    // Every page of the context reads navigator.onLine from the switch, on every load.
    await context.addInitScript((flag) => {
      Object.defineProperty(Navigator.prototype, "onLine", {
        configurable: true,
        get: () => {
          try {
            return localStorage.getItem(flag) !== "1";
          } catch {
            return true;
          }
        },
      });
    }, OFFLINE_FLAG);
    await use(context);
  },
});

/** The network goes away: connections drop, navigator.onLine reads false and the page hears "offline". */
export async function goOffline(page: Page, net: NetProxy): Promise<void> {
  net.setOffline(true);
  await page.evaluate((flag) => {
    localStorage.setItem(flag, "1");
    window.dispatchEvent(new Event("offline"));
  }, OFFLINE_FLAG);
  // The page's own requests fail now (a worker passes /decks/ to the network untouched).
  const reached = await page.evaluate(() =>
    fetch("/decks/index.json", { cache: "no-store" }).then(
      () => true,
      () => false,
    ),
  );
  expect(reached, "a request went through while offline").toBe(false);
}

/** The network comes back, without a reload. */
export async function goOnline(page: Page, net: NetProxy): Promise<void> {
  net.setOffline(false);
  await page.evaluate((flag) => {
    localStorage.removeItem(flag);
    window.dispatchEvent(new Event("online"));
  }, OFFLINE_FLAG);
}

/**
 * From start step 1, chooses this area and this platform and waits until the deck step is shown and has settled
 * (atStep waits SETTLE_MS after each step appears). Areas and platforms are the same offline as online.
 */
export async function toDeckStep(page: Page, area: string | RegExp, platform: string | RegExp): Promise<void> {
  const option = (name: string | RegExp) => page.getByRole("button", typeof name === "string" ? { name, exact: true } : { name });
  await option(area).click();
  await atStep(page, "Choose a platform");
  await option(platform).click();
  await atStep(page, "Choose a deck");
}

export interface WorkerState {
  /** A service worker controls the page. */
  controlled: boolean;
  /** A new release has installed and waits for a safe moment. */
  waiting: boolean;
  /** The worker caches of the origin (truthy-shell-<version>), sorted. */
  caches: string[];
}

/** What the page sees of its service worker; null while the page is between two documents. */
export async function workerState(page: Page): Promise<WorkerState | null> {
  try {
    return await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      const names = (await caches.keys()).filter((name) => name.startsWith("truthy-shell-")).sort();
      return { controlled: navigator.serviceWorker.controller !== null, waiting: Boolean(registration?.waiting), caches: names };
    });
  } catch {
    return null;
  }
}

/**
 * Waits until the worker of the first visit controls the page and its cache is complete (it claims the page once it
 * has activated, and it activates once every file is in its cache). Returns the release it carries.
 */
export async function waitForWorker(page: Page): Promise<string> {
  await expect.poll(async () => (await workerState(page))?.controlled, { timeout: 20_000 }).toBe(true);
  const state = await workerState(page);
  expect(state?.caches).toHaveLength(1);
  return (state?.caches[0] ?? "").replace(/^truthy-shell-/, "");
}
