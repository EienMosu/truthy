// The start flow's offline labels in a real browser (offline spec section 8): the page is opened online, then the
// network goes. No service worker is involved (workers stay blocked here) and no page is loaded while offline.
// Offline is the one way every offline spec of step 3 goes offline (e2e/offline.ts): the test's proxy drops every
// connection, navigator.onLine reads false and the page hears "offline", the same in Chromium and WebKit.
// Opening the app with no network is the service worker's part, which has specs of its own.
import { expect, type Page } from "@playwright/test";
import { CLF_ID, CLF_SECURITY, CONTINUE_CLF_SECURITY, SETTLE_MS, atHome, openHome, stepTitle } from "./helpers";
import { goOffline, goOnline, test, toDeckStep } from "./offline";

test.use({ reducedMotion: "reduce" });

/** Puts a copy of a deck on the device, as a round on it would: the file the app serves, under truthy.deck.<id>. */
async function keepDeck(page: Page, deckId: string): Promise<void> {
  await page.evaluate(async (id) => {
    type Index = { areas: { platforms: { decks: { id: string; hash: string }[] }[] }[] };
    const index = (await (await fetch("/decks/index.json")).json()) as Index;
    const entry = index.areas.flatMap((area) => area.platforms.flatMap((platform) => platform.decks)).find((deck) => deck.id === id);
    if (!entry) throw new Error(`no deck ${id} in the index`);
    const deck: unknown = await (await fetch(`/decks/${id}.json?v=${entry.hash}`)).json();
    localStorage.setItem(`truthy.deck.${id}`, JSON.stringify(deck));
  }, deckId);
}

/** Stores a last round on CLF / SEC / Classic that was left before the end, so step 1 shows the continue line. */
async function keepLastRound(page: Page): Promise<void> {
  await page.evaluate((deckId) => {
    const last = { route: { deckId, sectionId: "SEC" }, mode: "classic", score: null, total: null };
    localStorage.setItem("truthy.progress.v1", JSON.stringify({ version: 1, cards: {}, records: {}, last }));
  }, CLF_ID);
}

test("offline, the deck step offers the decks on the device and says the others need a connection, until the network is back", async ({ page, net }) => {
  await openHome(page);
  await keepDeck(page, CLF_ID);
  await keepLastRound(page);
  await page.reload();
  await atHome(page);

  await goOffline(page, net);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
  // The continue line still leads into its route: the deck is on the device.
  await expect(page.getByRole("button", { name: CONTINUE_CLF_SECURITY })).toBeVisible();

  await toDeckStep(page, CLF_SECURITY.area, CLF_SECURITY.platform);
  await expect(page.getByRole("button", { name: CLF_SECURITY.deck })).toBeVisible();
  const saa = page.getByRole("group", { name: "SAA, Solutions Architect Associate, needs a connection" });
  await expect(saa).toBeVisible();
  await expect(saa).toContainText("Needs a connection");
  await expect(page.getByRole("group", { name: "DVA, Developer Associate, needs a connection" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^SAA/ })).toHaveCount(0);
  // A tap on it does nothing (force: Playwright itself refuses to click an aria-disabled element).
  await saa.click({ force: true });
  await page.waitForTimeout(SETTLE_MS);
  await expect(stepTitle(page)).toHaveText("Choose a deck");

  await goOnline(page, net);
  await expect(page.getByRole("button", { name: /^SAA, Solutions Architect Associate, \d+ cards, / })).toBeVisible();
  await expect(page.getByText("Needs a connection")).toHaveCount(0);
});

test("offline, the continue line to a deck that is not on the device says so and is not a button", async ({ page, net }) => {
  await openHome(page);
  await keepLastRound(page);
  await page.reload();
  await atHome(page);
  await expect(page.getByRole("button", { name: CONTINUE_CLF_SECURITY })).toBeVisible();

  await goOffline(page, net);
  const line = page.getByRole("group", { name: "Continue: AWS Cloud Practitioner, Security and compliance, Classic, needs a connection." });
  await expect(line).toBeVisible();
  await expect(line).toContainText("CLF → SEC · Classic · Needs a connection");
  await expect(page.getByRole("button", { name: /^Continue/ })).toHaveCount(0);

  await goOnline(page, net);
  await expect(page.getByRole("button", { name: CONTINUE_CLF_SECURITY })).toBeVisible();
});
