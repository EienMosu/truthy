// Spec 2026-10-07, sections 1, 8, 10 and 11: after one visit online the game opens and plays without a network on
// every deck the device holds, a deck it never loaded says it needs a connection, and the labels go when the
// network is back; a round goes on when the network drops in its middle; the game opened offline looks as it does
// online. "Offline" here is the test's proxy dropping every connection (e2e/offline.ts), so the same spec runs in
// Chromium and WebKit.
import { expect, type Page } from "@playwright/test";
import {
  CLF_ID,
  CLF_SECURITY,
  SETTLE_MS,
  atHome,
  atStep,
  chooseRoute,
  deckAnswers,
  expectResult,
  expectThemePage,
  openHome,
  playRoundWith,
  startRound,
  stepTitle,
  storedProgress,
  wrongOn,
} from "./helpers";
import { goOffline, goOnline, test, toDeckStep, waitForWorker } from "./offline";

test.use({ serviceWorkers: "allow", reducedMotion: "reduce" });

const CLF_KEPT = /^CLF, Cloud Practitioner, \d+ cards, \d+ percent seen$/;
const SAA_OFFLINE = "SAA, Solutions Architect Associate, needs a connection";
const CLF_OFFLINE = "CLF, Cloud Practitioner, needs a connection";

/** A deck card by its exact accessible name, whatever element carries it. */
function named(page: Page, name: string) {
  return page.locator(`[aria-label="${name}"]`);
}

test("after one round online, the game opens offline and plays the deck it kept to a saved record", async ({ page, net }) => {
  test.slow();
  await openHome(page);
  await waitForWorker(page);
  const answers = await deckAnswers(page, CLF_ID);
  await chooseRoute(page, CLF_SECURITY);
  await startRound(page);
  await playRoundWith(page, answers, wrongOn(3));
  await expectResult(page, 9);

  await goOffline(page, net);
  const opened = await page.goto("/");
  expect(opened?.status()).toBe(200);
  expect(opened?.fromServiceWorker()).toBe(true);
  await expect(page.getByRole("heading", { level: 1, name: "Truthy" })).toBeVisible();
  await atHome(page);

  // The deck played online can be chosen; one never loaded says why it cannot, and a tap on it does nothing.
  await toDeckStep(page, CLF_SECURITY.area, CLF_SECURITY.platform);
  await expect(page.getByRole("button", { name: CLF_KEPT })).toBeVisible();
  await expect(named(page, SAA_OFFLINE)).toBeVisible();
  await expect(named(page, SAA_OFFLINE)).toContainText("Needs a connection");
  await expect(page.getByRole("button", { name: /^SAA, /, disabled: false })).toHaveCount(0);
  await named(page, SAA_OFFLINE).click({ force: true });
  await page.waitForTimeout(SETTLE_MS);
  await expect(stepTitle(page)).toHaveText("Choose a deck");

  // The kept deck to its result, offline: the move to /play and the record.
  await page.getByRole("button", { name: CLF_KEPT }).click();
  await atStep(page, "Choose a section");
  await page.getByRole("button", { name: CLF_SECURITY.section ?? "" }).click();
  await atStep(page, "Choose how to play");
  await page.getByRole("button", { name: CLF_SECURITY.mode }).click();
  await atStep(page, "Your pass is ready");
  await startRound(page);
  await playRoundWith(page, answers, wrongOn());
  await expectResult(page, 10);
  expect((await storedProgress(page)).records["aws-clf-c02/SEC#classic"]).toBe(10);

  // /play opened again offline deals a new round from the kept deck.
  const reloaded = await page.reload();
  expect(reloaded?.fromServiceWorker()).toBe(true);
  await expect(page.getByRole("img", { name: /^Card 1 of 10\./ })).toBeVisible();
  await page.getByRole("button", { name: "Leave round" }).click();
  await atHome(page);

  // An unknown address offline: the game's own 404 page, kept by the worker.
  const missing = await page.goto("/nope");
  expect(missing?.status()).toBe(404);
  expect(missing?.fromServiceWorker()).toBe(true);
  await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
});

test("offline, every deck the device never loaded needs a connection, and the labels go when the network is back", async ({ page, net }) => {
  await openHome(page);
  await waitForWorker(page);
  await goOffline(page, net);
  const opened = await page.reload();
  expect(opened?.fromServiceWorker()).toBe(true);
  await atHome(page);
  // The kept stylesheet draws the day theme offline as online.
  await expectThemePage(page, "day");
  // Areas and platforms are shown as online, with their counts.
  await toDeckStep(page, CLF_SECURITY.area, CLF_SECURITY.platform);
  await expect(named(page, CLF_OFFLINE)).toBeVisible();
  await expect(named(page, SAA_OFFLINE)).toBeVisible();
  await expect(page.getByRole("button", { name: /^(CLF|SAA), / })).toHaveCount(0);

  await goOnline(page, net);
  await expect(page.getByRole("button", { name: /^CLF, Cloud Practitioner, \d+ cards, not started$/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^SAA, Solutions Architect Associate, \d+ cards, not started$/ })).toBeVisible();
  await expect(page.getByText("Needs a connection")).toHaveCount(0);
});

test("offline, the continue line of a deck with no copy says it needs a connection and is not a button", async ({ page, net }) => {
  await page.addInitScript(() => {
    const last = { route: { deckId: "aws-clf-c02", sectionId: "SEC" }, mode: "classic", score: 7, total: 10 };
    if (localStorage.getItem("truthy.progress.v1") === null) {
      localStorage.setItem("truthy.progress.v1", JSON.stringify({ version: 1, cards: {}, records: {}, last }));
    }
  });
  await openHome(page);
  await expect(page.getByRole("button", { name: /^Continue: AWS Cloud Practitioner, Security and compliance, Classic\./ })).toBeVisible();
  await waitForWorker(page);

  await goOffline(page, net);
  await page.reload();
  await atHome(page);
  await expect(page.getByRole("button", { name: /^Continue/ })).toHaveCount(0);
  await expect(page.getByText("Needs a connection")).toBeVisible();

  await goOnline(page, net);
  await expect(page.getByRole("button", { name: /^Continue: AWS Cloud Practitioner, Security and compliance, Classic\./ })).toBeVisible();
});

test("the network drops in the middle of a round: the round goes on to its saved result, and the way back to the start works offline", async ({ page, net }) => {
  await openHome(page);
  await waitForWorker(page);
  const answers = await deckAnswers(page, CLF_ID);
  await chooseRoute(page, CLF_SECURITY);
  await startRound(page);
  await expect(page.getByRole("img", { name: /^Card 1 of 10\./ })).toBeVisible();

  // Spec section 10: nothing changes, the round has its deck in memory.
  await goOffline(page, net);
  await playRoundWith(page, answers, wrongOn(2));
  await expectResult(page, 9);
  expect((await storedProgress(page)).records["aws-clf-c02/SEC#classic"]).toBe(9);

  // Choose another route once the result's actions take presses (ResultView drops pointer-events-none from them
  // when RESULT_ARRIVES_MS has passed). The start's entry is right behind /play, so the way back is a step back in
  // the history, which needs no network.
  await expect(page.getByRole("button", { name: "Close results" })).not.toHaveClass(/\bpointer-events-none\b/);
  await page.getByRole("button", { name: "Choose another route" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(stepTitle(page)).toBeFocused();
  await atHome(page);
  await toDeckStep(page, CLF_SECURITY.area, CLF_SECURITY.platform);
  await expect(page.getByRole("button", { name: CLF_KEPT })).toBeVisible();
  await expect(named(page, SAA_OFFLINE)).toBeVisible();
});

test.describe("in the night theme", () => {
  test.use({ colorScheme: "dark" });

  test("offline, the start opens in the night theme with the game's own four font faces, as it does online", async ({ page, net }) => {
    await openHome(page);
    await waitForWorker(page);
    // Every font the page preloads is in the worker's cache. Offline, Chromium's HTTP cache can still serve a font
    // the worker did not keep, so the face check below bites in WebKit alone; this one bites in both engines.
    const uncached = await page.evaluate(async () => {
      const hrefs = [...document.querySelectorAll<HTMLLinkElement>('link[rel="preload"][as="font"]')].map((link) => link.href);
      const kept = await Promise.all(hrefs.map(async (href) => (await caches.match(href)) !== undefined));
      return { count: hrefs.length, missing: hrefs.filter((_, index) => !kept[index]) };
    });
    expect(uncached.count, "the page preloads its font files").toBeGreaterThan(0);
    expect(uncached.missing, "a preloaded font the worker did not keep").toEqual([]);
    await goOffline(page, net);
    const opened = await page.reload();
    expect(opened?.fromServiceWorker()).toBe(true);
    await atHome(page);
    // Spec section 1: offline the pages "look as they do online", in both themes.
    await expectThemePage(page, "night");
    // Each face of the self-hosted fonts loads from the device: a font file the worker did not keep would fail
    // offline and leave the fallback font in its place.
    const faces = await page.evaluate(async () => {
      const own = [...document.fonts].filter((face) => !face.family.includes("Fallback"));
      await Promise.allSettled(own.map((face) => face.load()));
      return own.map((face) => face.status);
    });
    expect(faces).toEqual(["loaded", "loaded", "loaded", "loaded"]);
  });
});
