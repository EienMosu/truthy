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
