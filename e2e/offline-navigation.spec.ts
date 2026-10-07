// Step 3 spec section 8, "Moving to /play offline" and "Coming back to the start offline", as check C1 of the plan
// found them: offline, the router's payload fetch fails and Next.js loads the document instead, which the service
// worker serves from its cache. Every way between the start and /play works offline: Start round, and Leave round,
// Choose another route and Close results on a /play with no start entry behind it (every /play an offline Start
// round opens is a fresh document). The start still focuses its step 1 title after such a load. Also spec section
// 10 as amended in section 14: a stored round whose deck has no copy shows the load failure with Try again, and
// Leave round goes home; and section 8's network that fails while the browser still says it is online.
import { expect, type Page, type Response } from "@playwright/test";
import {
  CLF_ID,
  CLF_SECURITY,
  answerCard,
  atHome,
  chooseRoute,
  deckAnswers,
  inClass,
  openHome,
  seeResults,
  stepTitle,
} from "./helpers";
import { expectNetworkGone, goOffline, test, waitForWorker } from "./offline";

test.use({ reducedMotion: "reduce", serviceWorkers: "allow" });

// Offline is the test's proxy dropping every connection (e2e/offline.ts), not context.setOffline: in Playwright
// 1.63's WebKit an offline context fails every page request before the service worker sees it (check C2 of the
// plan), so this spec runs in both engines.

/** The next document load of `path`, as the page receives it. */
function documentLoad(page: Page, path: string): Promise<Response> {
  return page.waitForResponse((response) => response.request().isNavigationRequest() && new URL(response.url()).pathname === path);
}

/** The start at step 1 in a document the worker served, with the step 1 title focused (a way back from /play). */
async function expectStartFromWorker(page: Page, load: Promise<Response>): Promise<void> {
  const response = await load;
  expect(response.status()).toBe(200);
  expect(response.fromServiceWorker()).toBe(true);
  await expect(page).toHaveURL(/\/$/);
  await expect(stepTitle(page)).toHaveText("Choose an area");
  await expect(stepTitle(page)).toBeFocused();
  await atHome(page);
}

/**
 * Opens the start online until the worker controls it, then starts a round on CLF / SEC in `mode` and leaves it at
 * once, so the device holds the deck (the online round loaded it). Back at step 1 of the start.
 */
async function playedOnce(page: Page, mode: "Classic" | "Streak"): Promise<void> {
  await openHome(page);
  await waitForWorker(page);
  await chooseRoute(page, inClass(CLF_SECURITY, mode));
  await page.getByRole("button", { name: "Start round" }).click();
  await expect(page).toHaveURL(/\/play$/);
  await expect(page.getByRole("button", { name: "True", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Leave round" }).click();
  await atHome(page);
}

/** Start round, offline: /play is a document the worker served, with the round's first card. */
async function startRoundOffline(page: Page): Promise<void> {
  const load = documentLoad(page, "/play");
  await page.getByRole("button", { name: "Start round" }).click();
  const response = await load;
  expect(response.status()).toBe(200);
  expect(response.fromServiceWorker()).toBe(true);
  await expect(page).toHaveURL(/\/play$/);
  await expect(page.getByRole("button", { name: "True", exact: true })).toBeVisible();
}

test("offline, Start round opens /play from the worker, and Leave round comes back to the start from the worker", async ({ page, net }) => {
  await playedOnce(page, "Classic");
  await goOffline(page, net);
  await chooseRoute(page, CLF_SECURITY);
  await startRoundOffline(page);
  await expect(page.getByRole("img", { name: /^Card 1 of 10\./ })).toBeVisible();

  const home = documentLoad(page, "/");
  await page.getByRole("button", { name: "Leave round" }).click();
  await expectStartFromWorker(page, home);
});

for (const control of ["Choose another route", "Close results"]) {
  test(`offline, ${control} on the result comes back to the start from the worker`, async ({ page, net }) => {
    await playedOnce(page, "Streak");
    const answers = await deckAnswers(page, CLF_ID);
    await goOffline(page, net);
    await chooseRoute(page, inClass(CLF_SECURITY, "Streak"));
    await startRoundOffline(page);
    await answerCard(page, answers, 1, false);
    await seeResults(page);
    // The result's actions take presses once they have arrived: ResultView drops pointer-events-none from them
    // when RESULT_ARRIVES_MS has passed.
    await expect(page.getByRole("button", { name: "Close results" })).not.toHaveClass(/\bpointer-events-none\b/);

    const home = documentLoad(page, "/");
    await page.getByRole("button", { name: control }).click();
    await expectStartFromWorker(page, home);
  });
}

test("offline, a stored round whose deck has no copy shows the load failure, and Leave round goes to the start", async ({ page, net }) => {
  await openHome(page);
  await waitForWorker(page);
  await goOffline(page, net);
  await page.evaluate(() =>
    sessionStorage.setItem("truthy.pending.v1", JSON.stringify({ route: { deckId: "aws-clf-c02", sectionId: "SEC" }, mode: "classic" })),
  );

  let deckRequests = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === `/decks/${CLF_ID}.json`) deckRequests += 1;
  });
  const response = await page.goto("/play");
  expect(response?.status()).toBe(200);
  expect(response?.fromServiceWorker()).toBe(true);
  // Next's route announcer is an alert too: the message is the one in <main>.
  const alert = page.locator("main").getByRole("alert");
  await expect(alert).toContainText("This deck didn't load");
  await expect(alert).toContainText("Check your connection and try again.");
  await expect.poll(() => deckRequests).toBe(1);

  await page.getByRole("button", { name: "Try again" }).click();
  await expect.poll(() => deckRequests).toBe(2);
  await expect(alert).toContainText("This deck didn't load");
  await expect(page.getByRole("button", { name: "True", exact: true })).toHaveCount(0);

  const home = documentLoad(page, "/");
  await page.getByRole("button", { name: "Leave round" }).click();
  await expectStartFromWorker(page, home);
});

test("a network that is gone while the browser still says it is online: a deck with no copy ends at the load failure, and Leave round goes home", async ({
  page,
  net,
}) => {
  await openHome(page);
  await waitForWorker(page);
  // The connection is gone, but navigator.onLine stays true, as on a Wi-Fi without internet.
  net.setOffline(true);
  await expectNetworkGone(page);
  expect(await page.evaluate(() => navigator.onLine)).toBe(true);

  const opened = await page.reload();
  expect(opened?.fromServiceWorker()).toBe(true);
  await atHome(page);
  // The deck step offers every deck as it does online, CLF too, which the device holds no copy of.
  await chooseRoute(page, CLF_SECURITY);
  const play = documentLoad(page, "/play");
  await page.getByRole("button", { name: "Start round" }).click();
  expect((await play).fromServiceWorker()).toBe(true);
  await expect(page).toHaveURL(/\/play$/);
  const alert = page.locator("main").getByRole("alert");
  await expect(alert).toContainText("This deck didn't load");
  await expect(alert).toContainText("Check your connection and try again.");

  const home = documentLoad(page, "/");
  await page.getByRole("button", { name: "Leave round" }).click();
  await expectStartFromWorker(page, home);
});
