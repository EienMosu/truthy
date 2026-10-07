// Spec sections 6 and 9: the production build serves the service worker, and a registered worker keeps the app
// shell in its cache and controls the page. The app registers the worker itself on every page (src/offline/register.ts,
// checked by e2e/register.spec.ts); the call below asks for that same registration, so this spec does not depend on
// when the app's own call runs. Playing offline has specs of its own.
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
