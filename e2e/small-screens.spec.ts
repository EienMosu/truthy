import { expect, test, type Page } from "@playwright/test";
import {
  CLF_ID,
  CLF_SECURITY,
  chooseRoute,
  deckAnswers,
  openHome,
  startRound,
  verdict,
  verdictFor,
  waitForCard,
} from "./helpers";

test.use({ reducedMotion: "no-preference" });

// Nothing on the page may be wider than the screen: a sideways page scroll fights the swipe.
async function expectNoSidewaysScroll(page: Page) {
  const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client);
}

// The 320 px phones (iPhone SE first generation, small Androids): spec section 1, mobile-first.
test.describe("on a 320 by 568 screen", () => {
  test.use({ viewport: { width: 320, height: 568 } });

  test("the start flow, a whole round and the result fit the width, and the buttons can be reached", async ({ page }) => {
    await openHome(page);
    await expectNoSidewaysScroll(page);
    await chooseRoute(page, CLF_SECURITY);
    await expectNoSidewaysScroll(page);
    await expect(page.getByRole("button", { name: "Start round" })).toBeInViewport();
    await startRound(page);

    const answers = await deckAnswers(page, CLF_ID);
    await waitForCard(page, answers, 1);
    await expectNoSidewaysScroll(page);
    await expect(page.getByRole("button", { name: "True", exact: true })).toBeInViewport();
    await expect(page.getByRole("button", { name: "False", exact: true })).toBeInViewport();
    await expect(page.getByRole("button", { name: "Leave round" })).toBeInViewport();

    // The answer slip (explanation and source link) can be scrolled into view under the action row.
    await page.getByRole("button", { name: "True", exact: true }).click();
    await expect(page.getByRole("button", { name: "Next card" })).toBeInViewport();
    const source = page.getByRole("link", { name: /\(opens in a new tab\)$/ });
    await source.scrollIntoViewIfNeeded();
    await expect(source).toBeInViewport();
    await expectNoSidewaysScroll(page);
    await page.getByRole("button", { name: "Next card" }).click();

    // Cards 2 to 10, all answered right.
    for (let n = 2; n <= 10; n += 1) {
      const { truth } = await waitForCard(page, answers, n);
      await page.getByRole("button", { name: truth ? "True" : "False", exact: true }).click();
      await page.getByRole("button", { name: n === 10 ? "See results" : "Next card" }).click();
    }
    await expect(page.getByRole("heading", { name: "Round complete" })).toBeFocused();
    await expectNoSidewaysScroll(page);
    await expect(page.getByRole("button", { name: "Play again" })).toBeVisible();
  });
});

// Turning the phone in the middle of a round: the round goes on where it was (no reload, no new deal).
test.describe("turning the phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("keeps the card, the answers given and the swipe after turning to landscape and back", async ({ page }) => {
    await openHome(page);
    await chooseRoute(page, CLF_SECURITY);
    await startRound(page);
    const answers = await deckAnswers(page, CLF_ID);

    const first = await waitForCard(page, answers, 1);
    await page.getByRole("button", { name: "True", exact: true }).click();
    await expect(verdict(page)).toHaveText(verdictFor(true, first.truth));
    await page.getByRole("button", { name: "Next card" }).click();
    const second = await waitForCard(page, answers, 2);

    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.getByRole("img", { name: /^Card 2 of 10\. Card 1 (correct|wrong)\.$/ })).toBeVisible();
    await expect(page.locator("[data-statement] > p").last()).toHaveText(second.statement);
    await expect(page.getByRole("button", { name: "False", exact: true })).toBeInViewport();
    await expectNoSidewaysScroll(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator("[data-statement] > p").last()).toHaveText(second.statement);
    // A swipe still answers after the turn (the edge zones follow the new width).
    const box = await page.locator("[data-statement]").boundingBox();
    if (box === null) throw new Error("The statement is not on screen");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 140, box.y + box.height / 2, { steps: 12 });
    await page.mouse.up();
    await expect(verdict(page)).toHaveText(verdictFor(false, second.truth));
  });
});
