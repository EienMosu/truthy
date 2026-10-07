// Spec 2026-10-07, sections 2, 7 and 11: a new release downloads in the background and waits; it takes over only
// at a safe moment, when the app opens on the start or when the player comes back to the start from a round, and
// never while a round is open; also when the app opens without a network. The test's proxy (e2e/proxy.ts) serves
// sw.js with a new version string, which is what a deploy does.
import { expect } from "@playwright/test";
import { CLF_SECURITY, atHome, chooseRoute, openHome, startRound, stepTitle } from "./helpers";
import { goOffline, test, waitForWorker, workerState } from "./offline";

test.use({ serviceWorkers: "allow", reducedMotion: "reduce" });

const shell = (version: string) => `truthy-shell-${version}`;

test("a new release waits, then takes over when the app opens on the start", async ({ page, net }) => {
  await openHome(page);
  const first = await waitForWorker(page);
  const next = `${first}-next`;
  net.release(first, next);

  // The load after the deploy finds the release and installs it beside the running one.
  await page.reload();
  await atHome(page);
  await expect.poll(() => workerState(page), { timeout: 20_000 }).toEqual({ controlled: true, waiting: true, caches: [shell(first), shell(next)].sort() });

  // The next opening of the app applies it: the new worker controls the page and the old cache is gone.
  await page.reload();
  await expect.poll(() => workerState(page), { timeout: 20_000 }).toEqual({ controlled: true, waiting: false, caches: [shell(next)] });
  await atHome(page);
});

test("a new release waits while a round is open, also over a reload of /play, and takes over when the player leaves", async ({ page, net }) => {
  await openHome(page);
  const first = await waitForWorker(page);
  const next = `${first}-next`;
  await chooseRoute(page, CLF_SECURITY);
  await startRound(page);
  await expect(page.getByRole("img", { name: /^Card 1 of 10\./ })).toBeVisible();

  net.release(first, next);
  await page.evaluate(async () => {
    await (await navigator.serviceWorker.getRegistration())?.update();
  });
  const waitingDuringRound = { controlled: true, waiting: true, caches: [shell(first), shell(next)].sort() };
  await expect.poll(() => workerState(page), { timeout: 20_000 }).toEqual(waitingDuringRound);

  // Nothing applies it during the round: not time, not a reload of /play.
  await page.waitForTimeout(1500);
  expect(await workerState(page)).toEqual(waitingDuringRound);
  await expect(page.getByRole("img", { name: /^Card 1 of 10\./ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("img", { name: /^Card 1 of 10\./ })).toBeVisible();
  await page.waitForTimeout(1500);
  expect(await workerState(page)).toEqual(waitingDuringRound);

  // Leaving the round is a safe moment: the way back to the start is a full load under the new release, and the
  // start focuses its step 1 title as after any way back from /play (task 7's RETURN_KEY).
  await page.getByRole("button", { name: "Leave round" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(stepTitle(page)).toBeFocused();
  await atHome(page);
  await expect.poll(() => workerState(page), { timeout: 20_000 }).toEqual({ controlled: true, waiting: false, caches: [shell(next)] });
});

test("a release that waits takes over when the app next opens without a network, and the start opens from it", async ({ page, net }) => {
  await openHome(page);
  const first = await waitForWorker(page);
  const next = `${first}-next`;
  net.release(first, next);
  await page.reload();
  await atHome(page);
  await expect.poll(() => workerState(page), { timeout: 20_000 }).toEqual({ controlled: true, waiting: true, caches: [shell(first), shell(next)].sort() });

  // The next opening is on a plane: the page comes from the running worker, applies the waiting release, and the
  // reload it makes comes from the new release's cache, which its install filled completely.
  await goOffline(page, net);
  const opened = await page.reload();
  expect(opened?.fromServiceWorker()).toBe(true);
  await expect.poll(() => workerState(page), { timeout: 20_000 }).toEqual({ controlled: true, waiting: false, caches: [shell(next)] });
  await atHome(page);
});
